'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
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
import { clearPendingFiles, peekPendingFiles } from '../../utils/pendingFiles';
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

  // 一覧の＋で選んだファイルを受け取る
  const [files, setFiles] = useState<File[]>(() => peekPendingFiles().slice(0, MAX_PICK));
  useEffect(() => clearPendingFiles, []);
  const [uploading, setUploading] = useState('');
  // 選んだ状態で来たとき(自動で送る間)は true。失敗したら false にして、フォームから送り直せるようにする
  const [autoMode, setAutoMode] = useState(() => peekPendingFiles().length > 0);

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
    if (failed) setAutoMode(false);
    else router.push(`/album?eventID=${eventID}`);
  };

  // 一覧の＋で選んで来たときは、アップロードボタンを待たずにすぐ始める
  const autoStart = useRef(files.length > 0);
  useEffect(() => {
    if (!autoStart.current || !eventID) return;
    autoStart.current = false;
    upload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 最初の1回だけ
  }, []);

  // 一覧の＋から来て自動で送っている間は、フォームを出さず進み具合だけを見せる
  if (autoMode) {
    return (
      <div className="la-page">
        <p className="la-progress">{uploading || 'アップロードを準備中…'}</p>
      </div>
    );
  }

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
