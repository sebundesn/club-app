'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlbumSummary, MediaAlbum } from '../utils/schema';
import { backendURL, readErrorMessage } from '../utils/api';
import { useToast } from '../../components/Toast';
import EventStrip from '../../components/line/EventStrip';
import MediaViewer from '../../components/line/MediaViewer';
import EventTimeline, { formatEventDate, formatEventRange, TimelineResult } from '../../components/line/EventTimeline';
import { VIDEO_MAX_SEC } from '../utils/mediaUpload';
import { setPendingFiles } from '../utils/pendingFiles';
import { defaultDay, eventIDsParam, parseEventIDs, uploadURL } from '../utils/eventGroup';
import '../line.css';

const ALBUM_ACCEPT = 'image/jpeg,image/png,video/*';

type AlbumState = 'loggedOut' | 'error';

const cursorOf = (a: AlbumSummary) => ({ date: a.date.slice(0, 10), id: a.event_id });

/** アルバム一覧。直近のイベントを中央に、上へスクロールで過去、下へスクロールで未来を読み足す。同じタイトルの連日のイベントは1行にまとめる。 */
function AlbumList() {
  const router = useRouter();
  const { showToast } = useToast();

  // ＋で選んだファイルをアップロードページに渡して、確認の画面へ進む
  const pickFor = (eventID: number, title: string, files: File[], group: number[]) => {
    setPendingFiles(files);
    router.push(uploadURL('/album/upload', eventID, title, group));
  };

  const fetchAlbums = useCallback(
    async (query: string): Promise<TimelineResult<AlbumSummary, AlbumState>> => {
      try {
        const res = await fetch(`${backendURL}/api/getAlbums?${query}`, { credentials: 'include' });
        if (res.status === 401) return { ok: false, state: 'loggedOut' };
        if (!res.ok) {
          showToast(await readErrorMessage(res, 'アルバムの取得に失敗しました。'), 'error');
          return { ok: false, state: 'error' };
        }
        const data: { events: AlbumSummary[] | null; hasMore: boolean } = await res.json();
        return { ok: true, page: { items: data.events ?? [], hasMore: data.hasMore } };
      } catch (e) {
        console.error('failed to load albums:', e);
        showToast('通信に失敗しました。', 'error');
        return { ok: false, state: 'error' };
      }
    },
    [showToast],
  );

  return (
    <div className="la-page">
      <div className="la-bar">
        <h1 className="la-bar-title" style={{ paddingLeft: '0.75rem' }}>アルバム</h1>
      </div>

      <EventTimeline
        fetchPage={fetchAlbums}
        cursorOf={cursorOf}
        emptyMessage="イベントがありません。カレンダーでイベントを登録してください。"
        renderState={(state) =>
          state === 'loading' ? (
            <p className="la-empty">読み込み中…</p>
          ) : state === 'loggedOut' ? (
            <p className="la-notice">アルバムを見るには、右上の「LINEでログイン」からログインしてください。</p>
          ) : (
            <p className="la-empty">取得できませんでした。</p>
          )
        }
        titleOf={(a) => a.title}
        renderGroup={(g, isNext) => {
          // 連日のイベントは1行にまとめる。＋は今日(期間外なら初日)に追加する
          const days = g.map((a) => ({ ...a, date: a.date.slice(0, 10) }));
          const ids = days.map((a) => a.event_id);
          const target = defaultDay(days)!;
          const photos = days.reduce((n, a) => n + a.photo_count, 0);
          const videos = days.reduce((n, a) => n + a.video_count, 0);
          return (
            <EventStrip
              title={days[0].title}
              sub={`${formatEventRange(days[0].date, days[days.length - 1].date)} ・ 写真${photos}${videos > 0 ? ` ・ 動画${videos}` : ''}`}
              href={`/album?eventID=${eventIDsParam(ids)}`}
              uploadLabel={`${days[0].title || '(無題)'}に写真・動画を追加`}
              accept={ALBUM_ACCEPT}
              onPick={(files) => pickFor(target.event_id, target.title, files, ids)}
              thumbs={days.flatMap((a) => a.preview_urls)}
              next={isNext}
            />
          );
        }}
      />
    </div>
  );
}

/**
 * 1つのイベントのアルバム。サムネイルを押すと、黒地で1枚ずつ見られる。
 * 連日のイベント(合宿など)は、日ごとに見出しを付けて1ページにまとめる。写真の上限は日ごと。
 */
function AlbumDetail({ eventIDs }: { eventIDs: number[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [albums, setAlbums] = useState<MediaAlbum[] | null>(null);
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // ＋で選んだファイルを入れる日
  const pickTarget = useRef<MediaAlbum | null>(null);
  const idsKey = eventIDsParam(eventIDs);

  const load = useCallback(async () => {
    try {
      const results = await Promise.all(
        parseEventIDs(idsKey).map(async (id) => {
          const res = await fetch(`${backendURL}/api/getAlbum?eventID=${id}`, { credentials: 'include' });
          if (!res.ok) throw new Error(await readErrorMessage(res, 'アルバムの取得に失敗しました。'));
          return (await res.json()) as MediaAlbum;
        }),
      );
      setAlbums(results);
    } catch (e) {
      console.error('failed to load album:', e);
      showToast(e instanceof Error && e.message ? e.message : '通信に失敗しました。', 'error');
    }
  }, [idsKey, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。
    load();
  }, [load]);

  const items = albums?.flatMap((a) => a.items) ?? [];

  // 動画の変換が終わるまで、数秒おきに取り直す
  const hasProcessing = items.some((i) => i.status === 'processing');
  useEffect(() => {
    if (!hasProcessing) return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [hasProcessing, load]);

  // 拡大表示は変換が終わったものだけで前後に動く(連日なら日をまたいで続けて見られる)
  const ready = items.filter((i) => i.status === 'ready');

  const remove = async (id: number) => {
    try {
      const res = await fetch(`${backendURL}/api/deleteMedia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
        credentials: 'include',
      });
      if (!res.ok) {
        showToast(await readErrorMessage(res, '削除に失敗しました。'), 'error');
        return;
      }
      setViewIndex((i) => (i === null || ready.length <= 1 ? null : Math.min(i, ready.length - 2)));
      await load();
    } catch (e) {
      console.error('failed to delete media:', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  const pick = (album: MediaAlbum | undefined) => {
    if (!album) return;
    pickTarget.current = album;
    fileInput.current?.click();
  };

  const multi = (albums?.length ?? 0) > 1;
  const first = albums?.[0];
  const dayOf = (a: MediaAlbum) => a.date.slice(0, 10);
  const sum = (key: 'photo_count' | 'video_count') => albums?.reduce((n, a) => n + a[key], 0) ?? 0;

  const grid = (album: MediaAlbum) => (
    <div className="la-grid">
      {album.items.map((item) => {
        if (item.status === 'processing') {
          return (
            <div key={item.id} className="la-cell-processing">
              変換中…
            </div>
          );
        }
        const at = ready.findIndex((r) => r.id === item.id);
        return (
          <button key={item.id} type="button" className="la-cell" onClick={() => setViewIndex(at)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- 静的エクスポートでは next/image の最適化が使えない */}
            <img src={item.thumb_url} alt="" loading="lazy" />
            {item.kind === 'video' && <span className="la-badge">▶</span>}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="la-page">
      <div className="la-bar">
        <button type="button" className="la-icon-btn" aria-label="アルバム一覧に戻る" onClick={() => router.push('/album')}>
          ‹
        </button>
        <h1 className="la-bar-title">{first?.title || (first ? '(無題)' : 'アルバム')}</h1>
      </div>

      {albums && first && !multi && (
        <p className="la-meta">
          {first.date && `${formatEventDate(dayOf(first))} ・ `}写真 {first.photo_count}/{first.photo_limit}枚 ・ 動画 {first.video_count}/
          {first.video_limit}本
        </p>
      )}
      {albums && first && multi && (
        <p className="la-meta">
          {formatEventRange(dayOf(first), dayOf(albums[albums.length - 1]))} ・ {albums.length}日間 ・ 写真 {sum('photo_count')}枚 ・ 動画{' '}
          {sum('video_count')}本
        </p>
      )}

      {albums && items.length === 0 && <p className="la-empty">まだ写真・動画がありません。右下の＋から追加できます。</p>}

      {albums && !multi && first && grid(first)}
      {albums &&
        multi &&
        items.length > 0 &&
        albums.map((a, i) => (
          <section key={a.event_id} className="la-day">
            <div className="la-day-head">
              <span className="la-day-label">{i + 1}日目</span>
              <span className="la-day-date">{formatEventDate(dayOf(a))}</span>
              <span className="la-day-count">
                写真{a.photo_count}
                {a.video_count > 0 && ` ・ 動画${a.video_count}`}
              </span>
              <button type="button" className="la-plus la-plus-sm" aria-label={`${i + 1}日目に写真・動画を追加`} onClick={() => pick(a)}>
                ＋
              </button>
            </div>
            {a.items.length === 0 ? <p className="la-day-empty">まだありません</p> : grid(a)}
          </section>
        ))}

      {/* 写真・動画を選ぶときの注意 */}
      <ul className="la-notes">
        <li>写真はJPEG・PNG(1枚20MBまで)、動画は{VIDEO_MAX_SEC}秒以内です。</li>
        {first && (
          <li>
            {multi ? '1日' : '1つのイベント'}に入れられるのは、写真{first.photo_limit}枚・動画{first.video_limit}本までです。
          </li>
        )}
        {multi && <li>右下の＋は今日(期間外なら初日)に追加します。ほかの日に入れるときは、日付の横の＋から選んでください。</li>}
        <li>1回に選べるのは50件までです。選んだあとの画面で、丸を押すと選択を外せます。</li>
        <li>動画は変換が終わるまで「変換中…」と表示されます。完了まで画面を閉じないでください。</li>
      </ul>

      <button
        type="button"
        className="la-fab"
        aria-label="写真・動画を追加"
        onClick={() => pick(albums ? defaultDay(albums.map((a) => ({ ...a, date: dayOf(a) }))) : undefined)}
      >
        ＋
      </button>
      {/* ＋を押すと、そのままスマホの写真選択が開く */}
      <input
        ref={fileInput}
        type="file"
        accept={ALBUM_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          const target = pickTarget.current;
          if (files.length === 0 || !target) return;
          setPendingFiles(files);
          router.push(uploadURL('/album/upload', target.event_id, target.title, eventIDs));
        }}
      />

      {viewIndex !== null && ready.length > 0 && (
        <MediaViewer
          items={ready}
          index={Math.min(viewIndex, ready.length - 1)}
          onIndex={setViewIndex}
          onClose={() => setViewIndex(null)}
          onDelete={(item) => remove(item.id)}
          noun="写真・動画"
        />
      )}
    </div>
  );
}

function AlbumContent() {
  const params = useSearchParams();
  const eventIDs = parseEventIDs(params.get('eventID'));
  return eventIDs.length > 0 ? <AlbumDetail key={eventIDsParam(eventIDs)} eventIDs={eventIDs} /> : <AlbumList />;
}

// useSearchParams は静的エクスポートで Suspense が必要
export default function AlbumPage() {
  return (
    <Suspense fallback={<p className="la-page la-empty">読み込み中…</p>}>
      <AlbumContent />
    </Suspense>
  );
}
