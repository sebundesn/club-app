'use client';

import { Fragment, ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toDateKey } from '../../app/utils/calendar';

// 過去・未来それぞれ、端まで来たらこの件数ずつ読み足す
const PAGE_SIZE = 10;
// 端に着く少し前から読み始める
const PRELOAD_MARGIN = '600px 0px';

export interface TimelinePage<T> {
  items: T[];
  hasMore: boolean;
}

/** 1回分の取得結果。ok 以外はページ全体の状態(ログインしていない、など)として呼び出し側が表示する */
export type TimelineResult<T, S extends string> = { ok: true; page: TimelinePage<T> } | { ok: false; state: S };

type Side = 'past' | 'future';

const todayKey = () => {
  const d = new Date();
  return toDateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** 今年なら 10/25(土)、それ以外は 2025/10/25(土) */
export const formatEventDate = (date: string, thisYear = todayKey().slice(0, 4)) => {
  const [y, m, d] = date.split('-');
  const weekday = WEEKDAYS[new Date(Number(y), Number(m) - 1, Number(d)).getDay()];
  return `${y === thisYear ? '' : `${y}/`}${m}/${d}(${weekday})`;
};

interface Props<T, S extends string> {
  /** `dir=past|future&date=YYYY-MM-DD&id=N&limit=N` を受け取って1回分を取る */
  fetchPage: (query: string) => Promise<TimelineResult<T, S>>;
  /** カーソルに使う、その行のイベントの日付(YYYY-MM-DD)とID */
  cursorOf: (item: T) => { date: string; id: number };
  /** isNext は今日以降でいちばん近いイベント。最初はここが画面の中央に来る */
  renderItem: (item: T, isNext: boolean) => ReactNode;
  /** 読み込み中や、ok 以外のときの表示 */
  renderState: (state: 'loading' | S) => ReactNode;
  emptyMessage: string;
}

/**
 * イベントを古い順に上から並べる一覧。最初は今日以降でいちばん近いイベントが画面の中央に来て、
 * 上へスクロールすると過去、下へスクロールすると未来のイベントを読み足していく(レシート・アルバムで共通)。
 */
export default function EventTimeline<T, S extends string>({ fetchPage, cursorOf, renderItem, renderState, emptyMessage }: Props<T, S>) {
  const [today] = useState(todayKey);
  const [items, setItems] = useState<T[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | S>('loading');
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
      const [past, future] = await Promise.all([fetchPage(`dir=past&${cursor}`), fetchPage(`dir=future&${cursor}`)]);
      if (!past.ok) return setState(past.state);
      if (!future.ok) return setState(future.state);
      setItems([...[...past.page.items].reverse(), ...future.page.items]);
      setHasMore({ past: past.page.hasMore, future: future.page.hasMore });
      setState('ok');
    };
    load();
  }, [today, fetchPage]);

  const loadMore = useCallback(
    async (side: Side) => {
      if (busy.current[side] || items.length === 0) return;
      busy.current[side] = true;
      setLoading((l) => ({ ...l, [side]: true }));
      const edge = cursorOf(side === 'past' ? items[0] : items[items.length - 1]);
      const res = await fetchPage(`dir=${side}&date=${edge.date}&id=${edge.id}&limit=${PAGE_SIZE}`);
      if (res.ok) {
        if (side === 'past') {
          heightBeforePrepend.current = document.documentElement.scrollHeight;
          setItems((xs) => [...[...res.page.items].reverse(), ...xs]);
        } else {
          setItems((xs) => [...xs, ...res.page.items]);
        }
        setHasMore((h) => ({ ...h, [side]: res.page.hasMore }));
      } else {
        setFailed((f) => ({ ...f, [side]: true }));
      }
      setLoading((l) => ({ ...l, [side]: false }));
      busy.current[side] = false;
    },
    [items, fetchPage, cursorOf],
  );

  // ブラウザのスクロール位置の自動補正と二重にずれないよう、この一覧を出している間は切っておく
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
  }, [state, items]);

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

  if (state !== 'ok') return <>{renderState(state)}</>;
  if (items.length === 0) return <p className="la-empty">{emptyMessage}</p>;

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

  const nextIndex = items.findIndex((x) => cursorOf(x).date >= today);
  const thisYear = today.slice(0, 4);
  const todayLine = <li className="la-tl-today">今日 {formatEventDate(today, thisYear)}</li>;

  return (
    <>
      <div ref={topRef}>{edge('past')}</div>
      <ul ref={listRef} className="la-ev-list la-tl">
        {items.map((item, i) => (
          <Fragment key={cursorOf(item).id}>
            {i === nextIndex && todayLine}
            {renderItem(item, i === nextIndex)}
          </Fragment>
        ))}
        {nextIndex === -1 && todayLine}
      </ul>
      <div ref={bottomRef}>{edge('future')}</div>
    </>
  );
}
