'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MediaAlbum, MediaItem } from '../utils/schema';
import { backendURL, readErrorMessage } from '../utils/api';
import { useToast } from '../../components/Toast';

const PHOTOS_PER_REQUEST = 10;
const VIDEO_MAX_SEC = 60;

// 動画の長さをアップロード前に確認する。サーバーでも確認するので、これは待たせないための早期チェック。
const readVideoDuration = (file: File): Promise<number> =>
  new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('metadata error'));
    };
    video.src = url;
  });

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

  const send = async (kind: 'photo' | 'video', files: File[]): Promise<boolean> => {
    const form = new FormData();
    form.append('eventID', String(eventID));
    form.append('kind', kind);
    files.forEach((f) => form.append('files', f));
    try {
      const res = await fetch(`${backendURL}/api/uploadMedia`, {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      if (!res.ok) {
        showToast(await readErrorMessage(res, 'アップロードに失敗しました。'), 'error');
        return false;
      }
      return true;
    } catch (e) {
      console.error('failed to upload:', e);
      showToast('通信に失敗しました。', 'error');
      return false;
    }
  };

  const onPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    // 1リクエストの枚数に上限があるので、まとめて送らず10枚ずつ順に送る
    let sent = 0;
    for (let i = 0; i < files.length; i += PHOTOS_PER_REQUEST) {
      setUploading(`写真をアップロード中… ${sent}/${files.length}`);
      const batch = files.slice(i, i + PHOTOS_PER_REQUEST);
      if (!(await send('photo', batch))) break;
      sent += batch.length;
    }
    setUploading('');
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
    const ok = await send('video', [file]);
    setUploading('');
    if (ok) showToast('動画を受け付けました。変換が終わると表示されます。', 'success');
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

  if (!eventID) {
    return <p className="p-6">イベントが指定されていません。カレンダーからアルバムを開いてください。</p>;
  }

  const photoFull = album ? album.photo_count >= album.photo_limit : false;
  const videoFull = album ? album.video_count >= album.video_limit : false;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-forest-800 mb-1">アルバム</h1>
      {album && (
        <p className="text-sm text-earth-700 mb-4">
          写真 {album.photo_count}/{album.photo_limit}枚 ・ 動画 {album.video_count}/{album.video_limit}本
          {(photoFull || videoFull) && '(枠がいっぱいです。不要なものを削除すると追加できます)'}
        </p>
      )}

      <div className="flex gap-3 mb-4">
        <button
          className="px-4 py-2 rounded-lg bg-forest-600 text-white disabled:opacity-40"
          disabled={photoFull || uploading !== ''}
          onClick={() => photoInput.current?.click()}
        >
          写真を追加
        </button>
        <button
          className="px-4 py-2 rounded-lg bg-forest-600 text-white disabled:opacity-40"
          disabled={videoFull || uploading !== ''}
          onClick={() => videoInput.current?.click()}
        >
          動画を追加(1分以内)
        </button>
        <input ref={photoInput} type="file" accept="image/jpeg,image/png" multiple hidden onChange={onPhotos} />
        <input ref={videoInput} type="file" accept="video/*" hidden onChange={onVideo} />
      </div>

      {uploading && <p className="text-sm text-forest-700 mb-3">{uploading}</p>}

      {album && album.items.length === 0 && <p className="text-earth-600">まだ写真・動画がありません。</p>}

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1">
        {album?.items.map((item) =>
          item.status === 'processing' ? (
            <div
              key={item.id}
              className="aspect-square bg-earth-100 flex items-center justify-center text-xs text-earth-600"
            >
              変換中…
            </div>
          ) : (
            <button key={item.id} className="relative aspect-square" onClick={() => setViewing(item)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- 静的エクスポートでは next/image の最適化が使えない */}
              <img
                src={item.thumb_url}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover"
              />
              {item.kind === 'video' && (
                <span className="absolute bottom-1 right-1 text-xs bg-black/60 text-white px-1 rounded">▶</span>
              )}
            </button>
          ),
        )}
      </div>

      {viewing && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setViewing(null)}
        >
          {viewing.kind === 'video' ? (
            <video
              src={viewing.url}
              controls
              playsInline
              autoPlay
              className="max-w-full max-h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- 同上
            <img src={viewing.url} alt="" className="max-w-full max-h-[80vh] object-contain" />
          )}
          {viewing.can_delete && (
            <button
              className="mt-4 px-4 py-2 rounded-lg bg-red-600 text-white"
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
    <Suspense fallback={<p className="p-6">読み込み中…</p>}>
      <AlbumContent />
    </Suspense>
  );
}
