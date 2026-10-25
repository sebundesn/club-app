'use client';

import { Fragment, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { toDateKey } from '../utils/calendar';
import '../line.css';

// 一覧は過去・未来それぞれ、端まで来たらこの件数ずつ読み足す
const PAGE_SIZE = 10;
// 端に着く少し前から読み始める
const PRELOAD_MARGIN = '600px 0px';

type LoadState = 'loading' | 'ok' | 'loggedOut' | 'forbidden' | 'error';

interface ApiEvent {
  id: number;
  title: string;
  date: string;
  images: { id: number; url: string }[] | null;
}

interface ReceiptsPage {
  receipts: ReceiptDataStruct[];
  hasMore: boolean;
}

type FetchResult = { state: 'ok'; page: ReceiptsPage } | { state: Exclude<LoadState, 'ok' | 'loading'> };

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
        if (res.status === 401) return { state: 'loggedOut' };
        if (res.status === 403) return { state: 'forbidden' };
        if (!res.ok) {
          showToast(await readErrorMessage(res, 'レシートの取得に失敗しました。'), 'error');
          return { state: 'error' };
        }
        const data: { events: ApiEvent[] | null; hasMore: boolean } = await res.json();
        return { state: 'ok', page: { receipts: (data.events ?? []).map(toReceipt), hasMore: data.hasMore } };
      } catch (e) {
        console.error('failed to load receipts:', e);
        showToast('通信に失敗しました。', 'error');
        return { state: 'error' };
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
    setState(res.state);
    if (res.state === 'ok') setEvent(res.page.receipts[0]);
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

const todayKey = () => {
  const d = new Date();
  return toDateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** 今年なら 10/25(土)、それ以外は 2025/10/25(土) */
const formatDate = (date: string, thisYear: string) => {
  const [y, m, d] = date.split('-');
  const weekday = WEEKDAYS[new Date(Number(y), Number(m) - 1, Number(d)).getDay()];
  return `${y === thisYear ? '' : `${y}/`}${m}/${d}(${weekday})`;
};

type Side = 'past' | 'future';

/**
 * レシート一覧。イベントを古い順に上から並べ、最初は今日以降でいちばん近いイベントが画面の中央に来る。
 * 上へスクロールすると過去、下へスクロールすると未来のイベントを読み足していく。
 */
function ReceiptList() {
  const router = useRouter();
  const fetchReceipts = useFetchReceipts();
  const [today] = useState(todayKey);
  const [receipts, setReceipts] = useState<ReceiptDataStruct[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [hasMore, setHasMore] = useState<Record<Side, boolean>>({ past: false, future: false });
  const [loading, setLoading] = useState<Record<Side, boolean>>({ past: false, future: false });
  const [failed, setFailed] = useState<Record<Side, boolean>>({ past: false, future: false });

  const listRef = useRef<HTMLUListElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const centered = useRef(false);
  // 上に足す前のページの高さ。足したあとに同じ分だけ下へずらして、見ている位置を保つ
  const heightBeforePrepend = useRef<number | null>(null);
  const busy = useRef<Record<Side, boolean>>({ past: false, future: false });

  // 最初は今日を境に、過去と未来を同時に取る
  useEffect(() => {
    const load = async () => {
      const cursor = `date=${today}&id=0&limit=${PAGE_SIZE}`;
      const [past, future] = await Promise.all([
        fetchReceipts(`dir=past&${cursor}`),
        fetchReceipts(`dir=future&${cursor}`),
      ]);
      if (past.state !== 'ok') return setState(past.state);
      if (future.state !== 'ok') return setState(future.state);
      setReceipts([...[...past.page.receipts].reverse(), ...future.page.receipts]);
      setHasMore({ past: past.page.hasMore, future: future.page.hasMore });
      setState('ok');
    };
    load();
  }, [today, fetchReceipts]);

  const loadMore = useCallback(
    async (side: Side) => {
      if (busy.current[side] || receipts.length === 0) return;
      busy.current[side] = true;
      setLoading((l) => ({ ...l, [side]: true }));
      const edge = side === 'past' ? receipts[0] : receipts[receipts.length - 1];
      const res = await fetchReceipts(`dir=${side}&date=${edge.Date}&id=${edge.ID}&limit=${PAGE_SIZE}`);
      if (res.state === 'ok') {
        if (side === 'past') {
          heightBeforePrepend.current = document.documentElement.scrollHeight;
          setReceipts((rs) => [...[...res.page.receipts].reverse(), ...rs]);
        } else {
          setReceipts((rs) => [...rs, ...res.page.receipts]);
        }
        setHasMore((h) => ({ ...h, [side]: res.page.hasMore }));
      } else {
        setFailed((f) => ({ ...f, [side]: true }));
      }
      setLoading((l) => ({ ...l, [side]: false }));
      busy.current[side] = false;
    },
    [receipts, fetchReceipts],
  );

  // ブラウザのスクロール位置の自動補正と二重にずれないよう、このページでは切っておく
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflowAnchor;
    html.style.overflowAnchor = 'none';
    return () => {
      html.style.overflowAnchor = prev;
    };
  }, []);

  // 描画の直後(画面に出る前)に、最初の中央寄せと、上に足したぶんの位置合わせをする
  useLayoutEffect(() => {
    if (state !== 'ok') return;
    if (!centered.current) {
      centered.current = true;
      const next = listRef.current?.querySelector('[data-next]') ?? listRef.current?.lastElementChild;
      next?.scrollIntoView({ block: 'center' });
      return;
    }
    if (heightBeforePrepend.current !== null) {
      window.scrollBy(0, document.documentElement.scrollHeight - heightBeforePrepend.current);
      heightBeforePrepend.current = null;
    }
  }, [state, receipts]);

  // 上端・下端が近づいたら読み足す。件数が変わるたびに付け直すので、
  // 読み足しても端がまだ見えている(画面が埋まっていない)ときは続けて読む
  useEffect(() => {
    if (state !== 'ok') return;
    const targets: [HTMLElement | null, Side][] = [
      [topRef.current, 'past'],
      [bottomRef.current, 'future'],
    ];
    const observers = targets
      .filter(([el, side]) => el && hasMore[side] && !failed[side])
      .map(([el, side]) => {
        const io = new IntersectionObserver(
          (entries) => {
            if (entries.some((e) => e.isIntersecting)) loadMore(side);
          },
          { rootMargin: PRELOAD_MARGIN },
        );
        io.observe(el!);
        return io;
      });
    return () => observers.forEach((io) => io.disconnect());
  }, [state, hasMore, failed, loadMore]);

  // ＋で選んだファイルをアップロードページに渡して、確認の画面へ進む
  const pickFor = (eventID: number, title: string, files: File[]) => {
    setPendingFiles(files);
    router.push(`/receipts/upload?eventID=${eventID}&title=${encodeURIComponent(title)}`);
  };

  const edge = (side: Side) => {
    if (loading[side]) return <p className="la-tl-edge">読み込み中…</p>;
    if (failed[side])
      return (
        <button
          type="button"
          className="la-tl-edge la-tl-retry"
          onClick={() => {
            setFailed((f) => ({ ...f, [side]: false }));
            loadMore(side);
          }}
        >
          読み込めませんでした。もう一度読み込む
        </button>
      );
    if (!hasMore[side]) return <p className="la-tl-edge">{side === 'past' ? 'これより前のイベントはありません' : 'これより先のイベントはありません'}</p>;
    return null;
  };

  const nextIndex = receipts.findIndex((r) => r.Date >= today);
  const thisYear = today.slice(0, 4);

  return (
    <div className="la-page">
      <div className="la-bar">
        <h1 className="la-bar-title" style={{ paddingLeft: '0.75rem' }}>レシート管理</h1>
      </div>

      <Notice state={state} />

      {state === 'ok' &&
        (receipts.length === 0 ? (
          <p className="la-empty">イベントがありません。</p>
        ) : (
          <>
            <div ref={topRef}>{edge('past')}</div>
            <ul ref={listRef} className="la-ev-list la-tl">
              {receipts.map((r, i) => (
                <Fragment key={r.ID}>
                  {i === nextIndex && (
                    <li className="la-tl-today" aria-label="ここから今日以降">
                      今日 {formatDate(today, thisYear)}
                    </li>
                  )}
                  <EventStrip
                    title={r.Title}
                    sub={`${formatDate(r.Date, thisYear)} ・ ${r.Images.length}枚`}
                    href={`/receipts?eventID=${r.ID}`}
                    uploadLabel={`${r.Title || '(無題)'}にレシートを追加`}
                    accept="image/jpeg,image/png"
                    onPick={(files) => pickFor(r.ID, r.Title, files)}
                    next={i === nextIndex}
                  />
                </Fragment>
              ))}
              {nextIndex === -1 && <li className="la-tl-today">今日 {formatDate(today, thisYear)}</li>}
            </ul>
            <div ref={bottomRef}>{edge('future')}</div>
          </>
        ))}

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
