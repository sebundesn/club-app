'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { DateTitle } from '../../utils/schema';
import { RECEIPTS_PER_REQUEST, uploadInBatches, uploadReceipts } from '../../utils/mediaUpload';
import { useToast } from '../../../components/Toast';
import EventSelect from '../../../components/line/EventSelect';
import PickGrid from '../../../components/line/PickGrid';
import '../../line.css';

// サーバーの上限(1イベント20枚)に合わせる
const MAX_PICK = 20;

/** レシートを提出する。部員なら誰でも出せて、見られるのは会計・部長・副部長だけ。 */
function ReceiptUpload() {
  const router = useRouter();
  const params = useSearchParams();
  const { showToast } = useToast();

  const presetID = Number(params.get('eventID')) || null;
  const [picked, setPicked] = useState<DateTitle | null>(null);
  const eventID = picked?.id ?? presetID;
  const [changing, setChanging] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
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
  };

  return (
    <div className="la-page">
      <div className="la-bar">
        <button type="button" className="la-icon-btn" aria-label="戻る" onClick={() => router.back()}>
          ‹
        </button>
        <h1 className="la-bar-title">レシートを提出</h1>
      </div>

      <h2 className="la-section">1. イベントを選ぶ</h2>
      {presetID && !changing ? (
        <p className="la-notice">
          選択中のイベントに追加します。{' '}
          <button type="button" className="la-chip" onClick={() => setChanging(true)}>
            イベントを変える
          </button>
        </p>
      ) : (
        <EventSelect selectedID={eventID} onSelect={setPicked} />
      )}

      {eventID && (
        <>
          <h2 className="la-section">2. レシート・領収書の画像を選ぶ</h2>
          <p className="la-meta" style={{ paddingTop: 0 }}>
            JPEG・PNG(1枚20MBまで)、1イベント{MAX_PICK}枚まで。見られるのは会計・部長・副部長だけです。丸を押すと選択を外せます。
          </p>
          <PickGrid files={files} onChange={setFiles} accept="image/jpeg,image/png" max={MAX_PICK} disabled={uploading !== ''} />
          {uploading && <p className="la-progress">{uploading}</p>}
        </>
      )}

      <div className="la-footbar">
        <div className="la-footbar-inner">
          <span className="la-footbar-info">{eventID ? `${files.length}枚を選択中` : 'イベントを選んでください'}</span>
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
