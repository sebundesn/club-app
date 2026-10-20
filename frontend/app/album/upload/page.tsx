'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PHOTOS_PER_REQUEST,
  VIDEO_MAX_SEC,
  readVideoDuration,
  uploadInBatches,
  uploadMedia,
} from '../../utils/mediaUpload';
import { useToast } from '../../../components/Toast';
import PickGrid from '../../../components/line/PickGrid';
import '../../line.css';

// 1回に選べる数。サーバーの枠(写真150枚・動画10本)の範囲で、選びすぎて重くならない程度にしている
const MAX_PICK = 50;

/** アルバムに写真・動画を追加する。イベントを選び、端末から選んだ写真・動画を送る。 */
function AlbumUpload() {
  const router = useRouter();
  const params = useSearchParams();
  const { showToast } = useToast();

  // イベントは一覧の＋ボタンで決まって渡される
  const eventID = Number(params.get('eventID')) || null;
  const eventTitle = params.get('title') ?? '';

  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState('');

  const upload = async () => {
    if (!eventID || files.length === 0) return;
    const photos = files.filter((f) => !f.type.startsWith('video/'));
    const videos = files.filter((f) => f.type.startsWith('video/'));
    let failed = false;

    if (photos.length > 0) {
      const { sent, error } = await uploadInBatches(
        photos,
        PHOTOS_PER_REQUEST,
        (batch) => uploadMedia(eventID, 'photo', batch),
        (n) => setUploading(`写真をアップロード中… ${n}/${photos.length}`),
      );
      if (error) {
        showToast(error, 'error');
        failed = true;
      }
      if (sent > 0) showToast(`写真を${sent}枚アップロードしました。`, 'success');
    }

    // 動画は1本ずつ。長さの確認 → 送信
    for (let i = 0; i < videos.length && !failed; i++) {
      const v = videos[i];
      try {
        const sec = await readVideoDuration(v);
        if (sec > VIDEO_MAX_SEC + 1) {
          showToast(`動画は${VIDEO_MAX_SEC}秒以内にしてください。`, 'error');
          failed = true;
          break;
        }
      } catch {
        // 端末で読めない形式でもサーバーで判定するので、ここでは止めない
      }
      setUploading(`動画をアップロード中… ${i + 1}/${videos.length}(完了まで画面を閉じないでください)`);
      const result = await uploadMedia(eventID, 'video', [v]);
      if (!result.ok) {
        showToast(result.error ?? 'アップロードに失敗しました。', 'error');
        failed = true;
      } else if (i === videos.length - 1) {
        showToast('動画を受け付けました。変換が終わると表示されます。', 'success');
      }
    }

    setUploading('');
    if (!failed) router.push(`/album?eventID=${eventID}`);
  };

  return (
    <div className="la-page">
      <div className="la-bar">
        <button type="button" className="la-icon-btn" aria-label="戻る" onClick={() => router.back()}>
          ‹
        </button>
        <h1 className="la-bar-title">アルバムに追加</h1>
      </div>

      {eventID ? (
        <p className="la-ev-name">{eventTitle || '(無題)'}</p>
      ) : (
        <p className="la-notice">一覧のイベントの＋ボタンから開いてください。</p>
      )}

      {eventID && (
        <>
          <h2 className="la-section">写真・動画を選ぶ</h2>
          <p className="la-meta" style={{ paddingTop: 0 }}>
            写真はJPEG・PNG(1枚20MBまで)、動画は{VIDEO_MAX_SEC}秒以内。最大{MAX_PICK}件まで選べます。丸を押すと選択を外せます。
          </p>
          <PickGrid files={files} onChange={setFiles} accept="image/jpeg,image/png,video/*" max={MAX_PICK} disabled={uploading !== ''} />
          {uploading && <p className="la-progress">{uploading}</p>}
        </>
      )}

      <div className="la-footbar">
        <div className="la-footbar-inner">
          <span className="la-footbar-info">
            {eventID ? `${files.length}件を選択中` : '＋ボタンから開いてください'}
          </span>
          <button type="button" className="la-text-btn" disabled={!eventID || files.length === 0 || uploading !== ''} onClick={upload}>
            アップロード
          </button>
        </div>
      </div>

      <p className="la-meta">
        <Link href="/album">← アルバム一覧へ</Link>
      </p>
    </div>
  );
}

// useSearchParams は静的エクスポートで Suspense が必要
export default function AlbumUploadPage() {
  return (
    <Suspense fallback={<p className="la-page la-empty">読み込み中…</p>}>
      <AlbumUpload />
    </Suspense>
  );
}
