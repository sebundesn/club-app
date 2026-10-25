'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ReceiptDataStruct } from '../utils/schema';
import { backendURL, readErrorMessage, receiptSrc } from '../utils/api';
import { useToast } from '../../components/Toast';
import Calculator from '../../components/line/Calculator';
import EventStrip from '../../components/line/EventStrip';
import EventParticipants from '../../components/EventParticipants';
import MediaViewer from '../../components/line/MediaViewer';
import { setPendingFiles } from '../utils/pendingFiles';
import EventTimeline, { formatEventDate, TimelineResult } from '../../components/line/EventTimeline';
import '../line.css';

type LoadState = 'loading' | 'ok' | 'loggedOut' | 'forbidden' | 'error';

interface ApiEvent {
  id: number;
  title: string;
  date: string;
  images: { id: number; url: string }[] | null;
}

type FetchResult = TimelineResult<ReceiptDataStruct, Exclude<LoadState, 'ok' | 'loading'>>;

const toReceipt = (e: ApiEvent): ReceiptDataStruct => ({
  ID: e.id,
  Title: e.title,
  Date: e.date.split('T')[0],
  Images: e.images ?? [],
});

/** レシートを取得する。見られるのは会計・部長・副部長だけなので、権限がない場合も区別して返す。 */
function useFetchReceipts() {
  const { showToast } = useToast();
  return useCallback(
    async (query: string): Promise<FetchResult> => {
      try {
        const res = await fetch(`${backendURL}/api/getReceiptsInfo?${query}`, { credentials: 'include' });
        if (res.status === 401) return { ok: false, state: 'loggedOut' };
        if (res.status === 403) return { ok: false, state: 'forbidden' };
        if (!res.ok) {
          showToast(await readErrorMessage(res, 'レシートの取得に失敗しました。'), 'error');
          return { ok: false, state: 'error' };
        }
        const data: { events: ApiEvent[] | null; hasMore: boolean } = await res.json();
        return { ok: true, page: { items: (data.events ?? []).map(toReceipt), hasMore: data.hasMore } };
      } catch (e) {
        console.error('failed to load receipts:', e);
        showToast('通信に失敗しました。', 'error');
        return { ok: false, state: 'error' };
      }
    },
    [showToast],
  );
}

/** 1つのイベントのレシート。日付に関係なく取れる。 */
function useEventReceipts(eventID: number) {
  const fetchReceipts = useFetchReceipts();
  const [event, setEvent] = useState<ReceiptDataStruct | undefined>();
  const [state, setState] = useState<LoadState>('loading');

  const load = useCallback(async () => {
    const res = await fetchReceipts(`eventID=${eventID}`);
    if (!res.ok) return setState(res.state);
    setEvent(res.page.items[0]);
    setState('ok');
  }, [eventID, fetchReceipts]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。
    load();
  }, [load]);

  return { event, state, reload: load };
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

const cursorOf = (r: ReceiptDataStruct) => ({ date: r.Date, id: r.ID });

/** レシート一覧。直近のイベントを中央に、上へスクロールで過去、下へスクロールで未来を読み足す。 */
function ReceiptList() {
  const router = useRouter();
  const fetchReceipts = useFetchReceipts();

  // ＋で選んだファイルをアップロードページに渡して、確認の画面へ進む
  const pickFor = (eventID: number, title: string, files: File[]) => {
    setPendingFiles(files);
    router.push(`/receipts/upload?eventID=${eventID}&title=${encodeURIComponent(title)}`);
  };

  return (
    <div className="la-page">
      <div className="la-bar">
        <h1 className="la-bar-title" style={{ paddingLeft: '0.75rem' }}>レシート管理</h1>
      </div>

      <EventTimeline
        fetchPage={fetchReceipts}
        cursorOf={cursorOf}
        renderState={(state) => <Notice state={state} />}
        emptyMessage="イベントがありません。"
        renderItem={(r, isNext) => (
          <EventStrip
            title={r.Title}
            sub={`${formatEventDate(r.Date)} ・ ${r.Images.length}枚`}
            href={`/receipts?eventID=${r.ID}`}
            uploadLabel={`${r.Title || '(無題)'}にレシートを追加`}
            accept="image/jpeg,image/png"
            onPick={(files) => pickFor(r.ID, r.Title, files)}
            next={isNext}
          />
        )}
      />

      <Calculator />
    </div>
  );
}

/**
 * 1つのイベントのレシートと参加者・徴収。レシートは押すと黒地で1枚ずつ見られる。
 * レシートの削除・支払い済みの切り替え・徴収額の設定は会計・部長だけ。
 */
function ReceiptDetail({ eventID }: { eventID: number }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { event, state, reload } = useEventReceipts(eventID);
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
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
          <div className="la-participants">
            <EventParticipants eventID={eventID} canEdit={canDelete} />
          </div>
        </>
      )}

      <Calculator raised={state === 'ok'} />

      {state === 'ok' && event && (
        <ul className="la-notes">
          <li>JPEG・PNG(1枚20MBまで)の画像を選べます。</li>
          <li>1つのイベントに入れられるのは20枚までです。</li>
          <li>見られるのは会計・部長・副部長だけです。</li>
        </ul>
      )}

      {state === 'ok' && (
        <>
          <button type="button" className="la-fab" aria-label="レシートを追加" onClick={() => fileInput.current?.click()}>
            ＋
          </button>
          {/* ＋を押すと、そのままスマホの写真選択が開く */}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (files.length === 0) return;
              setPendingFiles(files);
              router.push(`/receipts/upload?eventID=${eventID}&title=${encodeURIComponent(event?.Title ?? '')}`);
            }}
          />
        </>
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
