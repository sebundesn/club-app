'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { DateTitle, MediaAlbum } from '../utils/schema';
import { getNowTime } from '../utils/getTime';
import { backendURL } from '../utils/api';
import { fetchEventsBetween } from '../utils/eventsRange';
import {
  PHOTOS_PER_REQUEST,
  RECEIPTS_PER_REQUEST,
  VIDEO_MAX_SEC,
  readVideoDuration,
  uploadInBatches,
  uploadMedia,
  uploadReceipts,
} from '../utils/mediaUpload';
import { useToast } from '../../components/Toast';
import '../subpages.css';

type Kind = 'photo' | 'video' | 'receipt';

const WINDOW_DAYS = 7;
const KIND_LABEL: Record<Kind, string> = { photo: '写真', video: '動画', receipt: 'レシート' };

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

export default function UploadPage() {
  const { showToast } = useToast();
  const [, , , dayNames] = getNowTime();

  // 表示する期間は「anchor の WINDOW_DAYS 日前 〜 anchor」。初期は今日(=今日から1週間前まで)。
  const [anchor, setAnchor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  // どの期間の結果かを一緒に持つ。期間を動かした直後は、古い結果を出さず「読み込み中」にするため。
  const [loaded, setLoaded] = useState<{ key: string; list: DateTitle[] } | null>(null);
  const [picked, setPicked] = useState<DateTitle | null>(null);
  const [kind, setKind] = useState<Kind>('photo');
  const [uploading, setUploading] = useState('');
  const [album, setAlbum] = useState<MediaAlbum | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const from = addDays(anchor, -WINDOW_DAYS);
  const windowKey = `${anchor.getFullYear()}-${anchor.getMonth()}-${anchor.getDate()}`;
  const events = loaded?.key === windowKey ? loaded.list : null;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const list = await fetchEventsBetween(addDays(anchor, -WINDOW_DAYS), anchor);
        if (!cancelled) setLoaded({ key: windowKey, list });
      } catch (e) {
        console.error('failed to load events:', e);
        if (!cancelled) {
          showToast('予定の取得に失敗しました。', 'error');
          setLoaded({ key: windowKey, list: [] });
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [anchor, windowKey, showToast]);

  // 期間を動かして、選んでいたイベントが範囲から外れたときは、選んでいない状態として扱う
  const selected = picked && events?.some((e) => e.id === picked.id) ? picked : null;

  // 写真・動画は、残り枠をアルバムから取る(レシートは枠を返すAPIが無いので、上限に達したらエラー文言で知らせる)
  const loadAlbum = useCallback(async (eventID: number) => {
    try {
      const res = await fetch(`${backendURL}/api/getAlbum?eventID=${eventID}`, { credentials: 'include' });
      setAlbum(res.ok ? await res.json() : null);
    } catch {
      setAlbum(null);
    }
  }, []);

  useEffect(() => {
    if (!selected) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。
    loadAlbum(selected.id);
  }, [selected, loadAlbum]);

  const goToday = () => {
    const now = new Date();
    setAnchor(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  };

  const isFull =
    kind === 'photo' ? (album ? album.photo_count >= album.photo_limit : false)
    : kind === 'video' ? (album ? album.video_count >= album.video_limit : false)
    : false;

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!selected || files.length === 0) return;
    const eventID = selected.id;

    if (kind === 'video') {
      try {
        const sec = await readVideoDuration(files[0]);
        if (sec > VIDEO_MAX_SEC + 1) {
          showToast(`動画は${VIDEO_MAX_SEC}秒以内にしてください。`, 'error');
          return;
        }
      } catch {
        // 端末で読めない形式でもサーバーで判定するので、ここでは止めない
      }
      setUploading('動画をアップロード中…(完了まで画面を閉じないでください)');
      const result = await uploadMedia(eventID, 'video', [files[0]]);
      setUploading('');
      if (result.ok) showToast('動画を受け付けました。変換が終わるとアルバムに表示されます。', 'success');
      else showToast(result.error ?? 'アップロードに失敗しました。', 'error');
    } else {
      const label = KIND_LABEL[kind];
      const { sent, error } = await uploadInBatches(
        files,
        kind === 'photo' ? PHOTOS_PER_REQUEST : RECEIPTS_PER_REQUEST,
        (batch) => (kind === 'photo' ? uploadMedia(eventID, 'photo', batch) : uploadReceipts(eventID, batch)),
        (n) => setUploading(`${label}をアップロード中… ${n}/${files.length}`),
      );
      setUploading('');
      if (error) showToast(error, 'error');
      if (sent > 0) showToast(`${label}を${sent}枚アップロードしました。`, 'success');
    }

    await loadAlbum(eventID);
  };

  const accept = kind === 'video' ? 'video/*' : 'image/jpeg,image/png';

  return (
    <div className="sp-page">
      <h1 className="sp-title">アップロード</h1>
      <p className="sp-lead">イベントを選んで、写真・動画・レシートを追加できます。</p>

      <section className="sp-card">
        <h2 className="sp-card-title">1. イベントを選ぶ</h2>

        <div className="up-week-nav">
          <button type="button" className="sp-btn-sub" onClick={() => setAnchor(addDays(anchor, -WINDOW_DAYS))}>
            ◀ 前の1週間
          </button>
          <span className="up-week-label">
            {md(from)} 〜 {md(anchor)}
          </span>
          <button type="button" className="sp-btn-sub" onClick={() => setAnchor(addDays(anchor, WINDOW_DAYS))}>
            次の1週間 ▶
          </button>
        </div>
        <button type="button" className="up-today" onClick={goToday}>
          今日に戻る
        </button>

        {events === null ? (
          <p className="sp-muted">読み込み中…</p>
        ) : events.length === 0 ? (
          <p className="sp-muted">この期間のイベントはありません。前後の週を見てください。</p>
        ) : (
          <ul className="sp-list">
            {events.map((ev) => {
              const [y, m, d] = ev.date.slice(0, 10).split('-').map(Number);
              const on = selected?.id === ev.id;
              return (
                <li key={ev.id}>
                  <button
                    type="button"
                    className={`up-event${on ? ' selected' : ''}`}
                    aria-pressed={on}
                    onClick={() => setPicked(ev)}
                  >
                    <span className="up-event-date">
                      {m}/{d}({dayNames[new Date(y, m - 1, d).getDay()]})
                    </span>
                    <span className="up-event-title">{ev.title || '(無題)'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selected && (
        <section className="sp-card">
          <h2 className="sp-card-title">2. 追加するものを選ぶ</h2>
          <p className="sp-lead" style={{ marginBottom: '0.75rem' }}>
            対象: {selected.title || '(無題)'}
          </p>

          <div className="up-kinds" role="tablist">
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                className={`up-kind${kind === k ? ' active' : ''}`}
                onClick={() => setKind(k)}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>

          <p className="sp-lead" style={{ marginTop: '0.75rem' }}>
            {kind === 'photo' && (
              <>
                JPEG・PNGの写真を、まとめて選べます(1枚20MBまで)。
                {album && ` 現在 ${album.photo_count}/${album.photo_limit}枚。`}
              </>
            )}
            {kind === 'video' && (
              <>
                {VIDEO_MAX_SEC}秒以内の動画を1本ずつ選んでください。
                {album && ` 現在 ${album.video_count}/${album.video_limit}本。`}
              </>
            )}
            {kind === 'receipt' && (
              <>レシート・領収書の画像を選べます(JPEG・PNG、1イベント20枚まで)。会計と役員だけが見られます。</>
            )}
            {isFull && ' 枠がいっぱいです。アルバムで不要なものを削除すると追加できます。'}
          </p>

          <button
            type="button"
            className="sp-btn up-pick"
            disabled={uploading !== '' || isFull}
            onClick={() => fileInput.current?.click()}
          >
            {KIND_LABEL[kind]}を選んでアップロード
          </button>
          <input ref={fileInput} type="file" accept={accept} multiple={kind !== 'video'} hidden onChange={onPick} />

          {uploading && <p className="sp-status">{uploading}</p>}

          <p className="sp-muted" style={{ marginTop: '1rem' }}>
            <Link href={`/album?eventID=${selected.id}`}>このイベントのアルバムを見る →</Link>
          </p>
        </section>
      )}
    </div>
  );
}
