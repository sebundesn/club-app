'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { RECEIPTS_PER_REQUEST, uploadInBatches, uploadReceipts } from '../../utils/mediaUpload';
import { useToast } from '../../../components/Toast';
import PickGrid from '../../../components/line/PickGrid';
import { clearPendingFiles, peekPendingFiles } from '../../utils/pendingFiles';
import '../../line.css';

// サーバーの上限(1イベント20枚)に合わせる
const MAX_PICK = 20;

/** レシートを提出する。部員なら誰でも出せて、見られるのは会計・部長・副部長だけ。 */
function ReceiptUpload() {
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

  const upload = async () => {
    if (!eventID || files.length === 0) return;

    const { sent, error } = await uploadInBatches(
      files,
      RECEIPTS_PER_REQUEST,
      (batch) => uploadReceipts(eventID, batch),
      (n) => setUploading(`アップロード中… ${n}/${files.length}`),
    );
    setUploading('');
    if (error) showToast(error, 'error');
    if (sent > 0) showToast(`レシートを${sent}枚アップロードしました。`, 'success');
    // 送れた分は選択から外す(失敗したときは、残りをそのまま選び直せる)
    setFiles(files.slice(sent));
    // すべて送れたら、そのイベントのレシート一覧へ
    if (!error && sent === files.length) router.push(`/receipts?eventID=${eventID}`);
  };

  // 一覧の＋で選んで来たときは、アップロードボタンを待たずにすぐ始める
  const autoStart = useRef(files.length > 0);
  useEffect(() => {
    if (!autoStart.current || !eventID) return;
    autoStart.current = false;
    upload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 最初の1回だけ
  }, []);

  return (
    <div className="la-page">
      <div className="la-bar">
        <button type="button" className="la-icon-btn" aria-label="戻る" onClick={() => router.back()}>
          ‹
        </button>
        <h1 className="la-bar-title">レシートを提出</h1>
      </div>

      {eventID ? (
        <p className="la-ev-name">{eventTitle || '(無題)'}</p>
      ) : (
        <p className="la-notice">一覧のイベントの＋ボタンから開いてください。</p>
      )}

      {eventID && (
        <>
          <h2 className="la-section">レシート・領収書の画像を選ぶ</h2>
          <PickGrid files={files} onChange={setFiles} accept="image/jpeg,image/png" max={MAX_PICK} disabled={uploading !== ''} />
          {uploading && <p className="la-progress">{uploading}</p>}
        </>
      )}

      <div className="la-footbar">
        <div className="la-footbar-inner">
          <span className="la-footbar-info">{eventID ? `${files.length}枚を選択中` : '＋ボタンから開いてください'}</span>
          <button type="button" className="la-text-btn" disabled={!eventID || files.length === 0 || uploading !== ''} onClick={upload}>
            アップロード
          </button>
        </div>
      </div>

      <p className="la-meta">
        <Link href="/receipts">← レシート一覧へ</Link>
      </p>
    </div>
  );
}

// useSearchParams は静的エクスポートで Suspense が必要
export default function ReceiptUploadPage() {
  return (
    <Suspense fallback={<p className="la-page la-empty">読み込み中…</p>}>
      <ReceiptUpload />
    </Suspense>
  );
}
