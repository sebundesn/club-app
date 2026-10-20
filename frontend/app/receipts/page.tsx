'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ReceiptDataStruct } from '../utils/schema';
import { backendURL, readErrorMessage, receiptSrc } from '../utils/api';
import { useToast } from '../../components/Toast';
import Calculator from '../../components/line/Calculator';
import EventStrip from '../../components/line/EventStrip';
import MediaViewer from '../../components/line/MediaViewer';
import '../line.css';

const PERIODS = [
  { weeks: 4, label: '1か月' },
  { weeks: 13, label: '3か月' },
  { weeks: 26, label: '半年' },
  { weeks: 52, label: '1年' },
];
// 個別のレシートを開くときは、期間の絞り込みに関係なく探せるよう広めに取る
const DETAIL_WEEKS = 260;

type LoadState = 'loading' | 'ok' | 'loggedOut' | 'forbidden' | 'error';

interface ApiEvent {
  id: number;
  title: string;
  date: string;
  images: { id: number; url: string }[] | null;
}

/** レシートを取得する。見られるのは会計・部長・副部長だけなので、権限がない場合も区別して返す。 */
function useReceipts(weeks: number) {
  const { showToast } = useToast();
  const [receipts, setReceipts] = useState<ReceiptDataStruct[]>([]);
  const [state, setState] = useState<LoadState>('loading');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${backendURL}/api/getReceiptsInfo?howLongWeek=${weeks}`, { credentials: 'include' });
      if (res.status === 401) return setState('loggedOut');
      if (res.status === 403) return setState('forbidden');
      if (!res.ok) {
        showToast(await readErrorMessage(res, 'レシートの取得に失敗しました。'), 'error');
        return setState('error');
      }
      const data: ApiEvent[] = (await res.json()) ?? [];
      setReceipts(
        data.map((e) => ({ ID: e.id, Title: e.title, Date: e.date.split('T')[0], Images: e.images ?? [] })),
      );
      setState('ok');
    } catch (e) {
      console.error('failed to load receipts:', e);
      showToast('通信に失敗しました。', 'error');
      setState('error');
    }
  }, [weeks, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。
    load();
  }, [load]);

  return { receipts, state, reload: load };
}

function Notice({ state }: { state: LoadState }) {
  if (state === 'loading') return <p className="la-empty">読み込み中…</p>;
  if (state === 'loggedOut') return <p className="la-notice">レシートを見るには、右上の「LINEでログイン」からログインしてください。</p>;
  if (state === 'forbidden')
    return (
      <p className="la-notice">
        レシートを見られるのは、会計・部長・副部長だけです。
        <br />
        レシートの提出は <Link href="/receipts/upload">こちら</Link> からできます。
      </p>
    );
  if (state === 'error') return <p className="la-empty">取得できませんでした。</p>;
  return null;
}

/** レシート一覧。レシートがあるイベントを、表紙つきのカードで新しい順に並べる。 */
function ReceiptList() {
  const [weeks, setWeeks] = useState(PERIODS[0].weeks);
  const { receipts, state } = useReceipts(weeks);

  return (
    <div className="la-page">
      <div className="la-bar">
        <h1 className="la-bar-title" style={{ paddingLeft: '0.75rem' }}>レシート管理</h1>
      </div>

      <div className="la-chips" role="tablist">
        {PERIODS.map((p) => (
          <button
            key={p.weeks}
            type="button"
            role="tab"
            aria-selected={weeks === p.weeks}
            className={`la-chip${weeks === p.weeks ? ' active' : ''}`}
            onClick={() => setWeeks(p.weeks)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Notice state={state} />

      {state === 'ok' &&
        (receipts.length === 0 ? (
          <p className="la-empty">この期間のイベントはありません。</p>
        ) : (
          <ul className="la-ev-list">
            {receipts.map((r) => (
              <EventStrip
                key={r.ID}
                title={r.Title}
                sub={`${r.Date.slice(5).replace('-', '/')} ・ ${r.Images.length}枚`}
                href={`/receipts?eventID=${r.ID}`}
                uploadHref={`/receipts/upload?eventID=${r.ID}`}
                uploadLabel={`${r.Title || '(無題)'}にレシートを追加`}
                thumbs={r.Images.map((img) => receiptSrc(img.url))}
              />
            ))}
          </ul>
        ))}

      <Calculator />
    </div>
  );
}

/** 1つのイベントのレシート。押すと黒地で1枚ずつ見られる。削除できるのは会計・部長。 */
function ReceiptDetail({ eventID }: { eventID: number }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { receipts, state, reload } = useReceipts(DETAIL_WEEKS);
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const [role, setRole] = useState('');
  // 画面を出し分けるだけ。実際の権限チェックはサーバー側で行っている
  const canDelete = role === '会計' || role === '部長';

  useEffect(() => {
    const loadRole = async () => {
      try {
        const res = await fetch(`${backendURL}/api/checkAuth`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        setRole(typeof data.role === 'string' ? data.role : '');
      } catch (e) {
        console.error('failed to check role:', e);
      }
    };
    loadRole();
  }, []);

  const event = receipts.find((r) => r.ID === eventID);
  const items = useMemo(
    () =>
      (event?.Images ?? []).map((img) => ({
        id: img.id,
        kind: 'photo' as const,
        url: receiptSrc(img.url),
        can_delete: canDelete,
      })),
    [event, canDelete],
  );

  const remove = async (imageID: number) => {
    try {
      const res = await fetch(`${backendURL}/api/deleteImage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventID, image_id: imageID }),
        credentials: 'include',
      });
      if (!res.ok) {
        showToast(await readErrorMessage(res, '画像の削除に失敗しました。'), 'error');
        return;
      }
      setViewIndex((i) => (i === null || items.length <= 1 ? null : Math.min(i, items.length - 2)));
      await reload();
    } catch (e) {
      console.error('failed to delete image:', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  return (
    <div className="la-page">
      <div className="la-bar">
        <button type="button" className="la-icon-btn" aria-label="レシート一覧に戻る" onClick={() => router.push('/receipts')}>
          ‹
        </button>
        <h1 className="la-bar-title">{event ? event.Title || '(無題)' : 'レシート'}</h1>
      </div>

      <Notice state={state} />

      {state === 'ok' && !event && <p className="la-empty">イベントが見つかりません。</p>}

      {event && (
        <>
          <p className="la-meta">
            {event.Date} ・ {event.Images.length}枚
          </p>
          {event.Images.length === 0 && <p className="la-empty">レシートがありません。右下の＋から追加できます。</p>}
          <div className="la-grid">
            {event.Images.map((img, i) => (
              <button key={img.id} type="button" className="la-cell" onClick={() => setViewIndex(i)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- 静的エクスポートでは next/image の最適化が使えない */}
                <img src={receiptSrc(img.url)} alt="レシート" loading="lazy" />
              </button>
            ))}
          </div>
        </>
      )}

      <Calculator raised={state === 'ok'} />

      {state === 'ok' && (
        <Link href={`/receipts/upload?eventID=${eventID}`} className="la-fab" aria-label="レシートを追加">
          ＋
        </Link>
      )}

      {viewIndex !== null && items.length > 0 && (
        <MediaViewer
          items={items}
          index={Math.min(viewIndex, items.length - 1)}
          onIndex={setViewIndex}
          onClose={() => setViewIndex(null)}
          onDelete={(item) => remove(item.id)}
          noun="レシート"
        />
      )}
    </div>
  );
}

function ReceiptsContent() {
  const params = useSearchParams();
  const eventID = Number(params.get('eventID'));
  return eventID ? <ReceiptDetail eventID={eventID} /> : <ReceiptList />;
}

// useSearchParams は静的エクスポートで Suspense が必要
export default function ReceiptsPage() {
  return (
    <Suspense fallback={<p className="la-page la-empty">読み込み中…</p>}>
      <ReceiptsContent />
    </Suspense>
  );
}
