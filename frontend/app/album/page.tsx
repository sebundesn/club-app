'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MediaAlbum, MediaItem } from '../utils/schema';
import { backendURL, readErrorMessage } from '../utils/api';
import { useToast } from '../../components/Toast';
import { PHOTOS_PER_REQUEST, VIDEO_MAX_SEC, readVideoDuration, uploadInBatches, uploadMedia } from '../utils/mediaUpload';
import '../subpages.css';

interface EventSummary {
  id: number;
  date: string;
  title: string;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// リッチメニューから開いたとき(イベント未指定)に、今月と先月のイベントから選ばせる
function EventPicker() {
  const { showToast } = useToast();
  const [events, setEvents] = useState<EventSummary[] | null>(null);

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const months = [monthKey(now), monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1))];
      try {
        const lists = await Promise.all(
          months.map(async (m) => {
            const res = await fetch(`${backendURL}/api/getMonthEvents?month=${m}`);
            return res.ok ? ((await res.json()) as EventSummary[] | null) ?? [] : [];
          }),
        );
        setEvents(lists.flat().sort((a, b) => b.date.localeCompare(a.date)));
      } catch (e) {
        console.error('failed to load events:', e);
        showToast('通信に失敗しました。', 'error');
        setEvents([]);
      }
    };
    load();
  }, [showToast]);

  return (
    <div className="sp-page">
      <h1 className="sp-title">アルバム</h1>
      <p className="sp-lead">イベントを選んでください(先月・今月)。それ以前は予定表から開けます。</p>
      {events === null ? (
        <p className="sp-muted">読み込み中…</p>
      ) : events.length === 0 ? (
        <p className="sp-muted">イベントがありません。</p>
      ) : (
        <ul className="sp-card sp-list">
          {events.map((e) => (
            <li key={e.id} className="sp-row">
              <a href={`/album?eventID=${e.id}`} className="sp-link-row" style={{ flex: 1 }}>
                <span className="sp-row-main">{e.title || '(無題)'}</span>
                <span className="sp-muted">{e.date}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AlbumContent() {
  const { showToast } = useToast();
  const params = useSearchParams();
  const eventID = Number(params.get('eventID'));

  const [album, setAlbum] = useState<MediaAlbum | null>(null);
  const [uploading, setUploading] = useState('');
  const [viewing, setViewing] = useState<MediaItem | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!eventID) return;
    try {
      const res = await fetch(`${backendURL}/api/getAlbum?eventID=${eventID}`, { credentials: 'include' });
      if (!res.ok) {
        showToast(await readErrorMessage(res, 'アルバムの取得に失敗しました。'), 'error');
        return;
      }
      setAlbum(await res.json());
    } catch (e) {
      console.error('failed to load album:', e);
      showToast('通信に失敗しました。', 'error');
    }
  }, [eventID, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。
    load();
  }, [load]);

  // 動画の変換が終わるまで、数秒おきに取り直す
  const hasProcessing = album?.items.some((i) => i.status === 'processing') ?? false;
  useEffect(() => {
    if (!hasProcessing) return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [hasProcessing, load]);

  const onPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    // 1リクエストの枚数に上限があるので、まとめて送らず10枚ずつ順に送る
    const { sent, error } = await uploadInBatches(
      files,
      PHOTOS_PER_REQUEST,
      (batch) => uploadMedia(eventID, 'photo', batch),
      (n) => setUploading(`写真をアップロード中… ${n}/${files.length}`),
    );
    setUploading('');
    if (error) showToast(error, 'error');
    if (sent > 0) showToast(`${sent}枚アップロードしました。`, 'success');
    await load();
  };

  const onVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const sec = await readVideoDuration(file);
      if (sec > VIDEO_MAX_SEC + 1) {
        showToast(`動画は${VIDEO_MAX_SEC}秒以内にしてください。`, 'error');
        return;
      }
    } catch {
      // 端末で読めない形式でもサーバーで判定するので、ここでは止めない
    }

    setUploading('動画をアップロード中…(完了まで画面を閉じないでください)');
    const result = await uploadMedia(eventID, 'video', [file]);
    setUploading('');
    if (result.ok) showToast('動画を受け付けました。変換が終わると表示されます。', 'success');
    else showToast(result.error ?? 'アップロードに失敗しました。', 'error');
    await load();
  };

  const remove = async (item: MediaItem) => {
    if (!window.confirm(`この${item.kind === 'video' ? '動画' : '写真'}を削除しますか？`)) return;
    try {
      const res = await fetch(`${backendURL}/api/deleteMedia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
        credentials: 'include',
      });
      if (!res.ok) {
        showToast(await readErrorMessage(res, '削除に失敗しました。'), 'error');
        return;
      }
      setViewing(null);
      await load();
    } catch (e) {
      console.error('failed to delete media:', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  if (!eventID) return <EventPicker />;

  const photoFull = album ? album.photo_count >= album.photo_limit : false;
  const videoFull = album ? album.video_count >= album.video_limit : false;

  return (
    <div className="sp-page">
      <h1 className="sp-title">アルバム</h1>
      {album && (
        <p className="sp-lead">
          写真 {album.photo_count}/{album.photo_limit}枚 ・ 動画 {album.video_count}/{album.video_limit}本
          {(photoFull || videoFull) && '(枠がいっぱいです。不要なものを削除すると追加できます)'}
        </p>
      )}

      <div className="sp-toolbar">
        <button
          className="sp-btn"
          disabled={photoFull || uploading !== ''}
          onClick={() => photoInput.current?.click()}
        >
          写真を追加
        </button>
        <button
          className="sp-btn"
          disabled={videoFull || uploading !== ''}
          onClick={() => videoInput.current?.click()}
        >
          動画を追加(1分以内)
        </button>
        <input ref={photoInput} type="file" accept="image/jpeg,image/png" multiple hidden onChange={onPhotos} />
        <input ref={videoInput} type="file" accept="video/*" hidden onChange={onVideo} />
      </div>

      {uploading && <p className="sp-status">{uploading}</p>}

      {album && album.items.length === 0 && <p className="sp-muted">まだ写真・動画がありません。</p>}

      <div className="album-grid">
        {album?.items.map((item) =>
          item.status === 'processing' ? (
            <div
              key={item.id}
              className="album-cell-processing"
            >
              変換中…
            </div>
          ) : (
            <button key={item.id} className="album-cell" onClick={() => setViewing(item)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- 静的エクスポートでは next/image の最適化が使えない */}
              <img src={item.thumb_url} alt="" loading="lazy" />
              {item.kind === 'video' && (
                <span className="album-video-mark">▶</span>
              )}
            </button>
          ),
        )}
      </div>

      {viewing && (
        <div
          className="album-viewer"
          onClick={() => setViewing(null)}
        >
          {viewing.kind === 'video' ? (
            <video
              src={viewing.url}
              controls
              playsInline
              autoPlay
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- 同上
            <img src={viewing.url} alt="" />
          )}
          {viewing.can_delete && (
            <button
              className="sp-btn-danger"
              onClick={(e) => {
                e.stopPropagation();
                remove(viewing);
              }}
            >
              削除
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// useSearchParams は静的エクスポートで Suspense が必要
export default function AlbumPage() {
  return (
    <Suspense fallback={<p className="sp-page sp-muted">読み込み中…</p>}>
      <AlbumContent />
    </Suspense>
  );
}
