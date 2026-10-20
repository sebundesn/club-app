'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlbumSummary, MediaAlbum } from '../utils/schema';
import { backendURL, readErrorMessage } from '../utils/api';
import { useToast } from '../../components/Toast';
import MediaViewer from '../../components/line/MediaViewer';
import '../line.css';

const md = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${m}/${d}`;
};

/** アルバム一覧。写真・動画があるイベントを、表紙つきのカードで新しい順に並べる。 */
function AlbumList() {
  const { showToast } = useToast();
  const [albums, setAlbums] = useState<AlbumSummary[] | null>(null);
  const [loggedOut, setLoggedOut] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${backendURL}/api/getAlbums`, { credentials: 'include' });
        if (res.status === 401) {
          setLoggedOut(true);
          return;
        }
        if (!res.ok) {
          showToast(await readErrorMessage(res, 'アルバムの取得に失敗しました。'), 'error');
          setAlbums([]);
          return;
        }
        setAlbums((await res.json()) ?? []);
      } catch (e) {
        console.error('failed to load albums:', e);
        showToast('通信に失敗しました。', 'error');
        setAlbums([]);
      }
    };
    load();
  }, [showToast]);

  return (
    <div className="la-page">
      <div className="la-bar">
        <h1 className="la-bar-title" style={{ paddingLeft: '0.75rem' }}>アルバム</h1>
        <Link href="/album/upload" className="la-text-btn">
          ＋ アップロード
        </Link>
      </div>

      {loggedOut ? (
        <p className="la-notice">アルバムを見るには、右上の「LINEでログイン」からログインしてください。</p>
      ) : albums === null ? (
        <p className="la-empty">読み込み中…</p>
      ) : albums.length === 0 ? (
        <p className="la-empty">まだアルバムがありません。右上からアップロードできます。</p>
      ) : (
        <ul className="la-albums">
          {albums.map((a) => (
            <li key={a.event_id}>
              <Link href={`/album?eventID=${a.event_id}`} className="la-album">
                <span className="la-cover">
                  {a.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 静的エクスポートでは next/image の最適化が使えない
                    <img src={a.cover_url} alt="" loading="lazy" />
                  ) : (
                    <span className="la-cover-empty">▶</span>
                  )}
                </span>
                <span className="la-album-title">{a.title || '(無題)'}</span>
                <span className="la-album-sub">
                  {md(a.date)} ・ 写真{a.photo_count}
                  {a.video_count > 0 && ` ・ 動画${a.video_count}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 1つのイベントのアルバム。サムネイルを押すと、黒地で1枚ずつ見られる。 */
function AlbumDetail({ eventID }: { eventID: number }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [album, setAlbum] = useState<MediaAlbum | null>(null);
  const [viewIndex, setViewIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
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

  // 拡大表示は変換が終わったものだけで前後に動く
  const ready = album?.items.filter((i) => i.status === 'ready') ?? [];

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

  return (
    <div className="la-page">
      <div className="la-bar">
        <button type="button" className="la-icon-btn" aria-label="アルバム一覧に戻る" onClick={() => router.push('/album')}>
          ‹
        </button>
        <h1 className="la-bar-title">{album?.title || (album ? '(無題)' : 'アルバム')}</h1>
      </div>

      {album && (
        <p className="la-meta">
          {album.date && `${album.date} ・ `}写真 {album.photo_count}/{album.photo_limit}枚 ・ 動画 {album.video_count}/{album.video_limit}本
        </p>
      )}

      {album && album.items.length === 0 && <p className="la-empty">まだ写真・動画がありません。右下の＋から追加できます。</p>}

      <div className="la-grid">
        {album?.items.map((item) => {
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

      <Link href={`/album/upload?eventID=${eventID}`} className="la-fab" aria-label="写真・動画を追加">
        ＋
      </Link>

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
  const eventID = Number(params.get('eventID'));
  return eventID ? <AlbumDetail eventID={eventID} /> : <AlbumList />;
}

// useSearchParams は静的エクスポートで Suspense が必要
export default function AlbumPage() {
  return (
    <Suspense fallback={<p className="la-page la-empty">読み込み中…</p>}>
      <AlbumContent />
    </Suspense>
  );
}
