'use client';

import { Fragment, ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toDateKey } from '../../app/utils/calendar';

// 足りなくなったらこの件数ずつ読み足す
const PAGE_SIZE = 10;
// ▲・▼を押すたびにこの件数ずつ見せる
const REVEAL_STEP = 5;
// 最初に見せる過去のイベントは、今日からこの日数前まで
const RECENT_DAYS = 7;

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

/** 1日なら 10/25(土)、連日なら 10/25(土)〜10/27(月) */
export const formatEventRange = (start: string, end: string, thisYear = todayKey().slice(0, 4)) =>
  start === end ? formatEventDate(start, thisYear) : `${formatEventDate(start, thisYear)}〜${formatEventDate(end, thisYear)}`;

const addDays = (date: string, days: number) => {
  const [y, m, d] = date.split('-').map(Number);
  const n = new Date(y, m - 1, d + days);
  return toDateKey(n.getFullYear(), n.getMonth() + 1, n.getDate());
};

const nextDay = (date: string) => addDays(date, 1);

/**
 * 同じタイトルで日付が続いているイベントを1つにまとめる(合宿の3日分など)。
 * 間に別のイベントが挟まっていてもまとめる。items は日付順に並んでいること。
 */
export const groupConsecutive = <T,>(items: T[], dateOf: (item: T) => string, titleOf: (item: T) => string): T[][] => {
  const groups: T[][] = [];
  // タイトルごとに、まだ続きを受け付けているグループ
  const open = new Map<string, T[]>();
  for (const item of items) {
    const title = titleOf(item) || '(無題)';
    const date = dateOf(item);
    const g = open.get(title);
    const last = g && dateOf(g[g.length - 1]);
    if (g && last && (date === last || date === nextDay(last))) {
      g.push(item);
      continue;
    }
    const fresh = [item];
    groups.push(fresh);
    open.set(title, fresh);
  }
  return groups;
};

interface Props<T, S extends string> {
  /** `dir=past|future&date=YYYY-MM-DD&id=N&limit=N` を受け取って1回分を取る */
  fetchPage: (query: string) => Promise<TimelineResult<T, S>>;
  /** カーソルに使う、その行のイベントの日付(YYYY-MM-DD)とID */
  cursorOf: (item: T) => { date: string; id: number };
  /** 連日のイベントをまとめるためのタイトル */
  titleOf: (item: T) => string;
  /**
   * 1行分を描く。同じタイトルが連日続くイベントは group にまとめて渡す(1日だけなら1件)。
   * isNext は今日以降でいちばん近いイベント
   */
  renderGroup: (group: T[], isNext: boolean) => ReactNode;
  /** 読み込み中や、ok 以外のときの表示 */
  renderState: (state: 'loading' | S) => ReactNode;
  emptyMessage: string;
}

/**
 * イベントを古い順に上から並べる一覧(レシート・アルバムで共通)。最初は今日以降でいちばん近いイベントと、
 * 1週間前までのイベントだけを見せる。上の▲で過去、下の▼で未来のイベントを5件ずつ見せていき、
 * 手元に足りなければ読み足す。同じタイトルが連日続くイベントは1行にまとめる。
 */
export default function EventTimeline<T, S extends string>({
  fetchPage,
  cursorOf,
  titleOf,
  renderGroup,
  renderState,
  emptyMessage,
}: Props<T, S>) {
  const [today] = useState(todayKey);
  const [items, setItems] = useState<T[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | S>('loading');
  const [hasMore, setHasMore] = useState<Record<Side, boolean>>({ past: false, future: false });
  const [loading, setLoading] = useState<Record<Side, boolean>>({ past: false, future: false });
  const [failed, setFailed] = useState<Record<Side, boolean>>({ past: false, future: false });
  // ▲・▼で、最初の表示より何件多く見せているか
  const [extra, setExtra] = useState<Record<Side, number>>({ past: 0, future: 0 });

  const listRef = useRef<HTMLUListElement>(null);
  const centered = useRef(false);
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
        if (side === 'past') setItems((xs) => [...[...res.page.items].reverse(), ...xs]);
        else setItems((xs) => [...xs, ...res.page.items]);
        setHasMore((h) => ({ ...h, [side]: res.page.hasMore }));
      } else {
        setFailed((f) => ({ ...f, [side]: true }));
      }
      setLoading((l) => ({ ...l, [side]: false }));
      busy.current[side] = false;
    },
    [items, fetchPage, cursorOf],
  );

  const groups = groupConsecutive(items, (x) => cursorOf(x).date, titleOf);
  // 今日が途中に入っている連日のイベント(合宿の2日目など)も「次」に数える
  const nextIndex = groups.findIndex((g) => cursorOf(g[g.length - 1]).date >= today);
  // 次のイベントの位置(なければ末尾)。ここより前が過去
  const pivot = nextIndex === -1 ? groups.length : nextIndex;
  const weekAgo = addDays(today, -RECENT_DAYS);
  const recentPast = groups.slice(0, pivot).filter((g) => cursorOf(g[g.length - 1]).date >= weekAgo).length;
  const wantPast = recentPast + extra.past;
  // 次のイベントは最初から見せる。▼で見せるのはその先
  const wantFuture = (nextIndex === -1 ? 0 : 1) + extra.future;
  const from = Math.max(0, pivot - wantPast);
  const to = Math.min(groups.length, pivot + wantFuture);
  const hidden: Record<Side, boolean> = { past: from > 0 || hasMore.past, future: to < groups.length || hasMore.future };

  // 5件ずつ見せていき、まだ見せていない手元の分が次の5件に足りなくなったら先に読み足しておく
  const reveal = (side: Side) => {
    setExtra((e) => ({ ...e, [side]: e[side] + REVEAL_STEP }));
    const left = side === 'past' ? from - REVEAL_STEP : groups.length - to - REVEAL_STEP;
    if (left < REVEAL_STEP && hasMore[side]) loadMore(side);
  };

  // 最初の描画の直後(画面に出る前)に、次のイベントを画面の中央に寄せる
  useLayoutEffect(() => {
    if (state !== 'ok' || centered.current) return;
    centered.current = true;
    const next = listRef.current?.querySelector('[data-next]') ?? listRef.current?.lastElementChild;
    next?.scrollIntoView({ block: 'center' });
  }, [state]);

  if (state !== 'ok') return <>{renderState(state)}</>;
  if (items.length === 0) return <p className="la-empty">{emptyMessage}</p>;

  const edge = (side: Side) => {
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
    if (loading[side]) return <p className="la-tl-edge">読み込み中…</p>;
    if (!hidden[side]) return <p className="la-tl-edge">{side === 'past' ? 'これより前のイベントはありません' : 'これより先のイベントはありません'}</p>;
    return (
      <button
        type="button"
        className="la-tl-edge la-tl-more"
        onClick={() => reveal(side)}
      >
        {side === 'past' ? `▲ 前の${REVEAL_STEP}件` : `▼ 次の${REVEAL_STEP}件`}
      </button>
    );
  };

  const thisYear = today.slice(0, 4);
  const todayLine = <li className="la-tl-today">今日 {formatEventDate(today, thisYear)}</li>;

  return (
    <>
      {edge('past')}
      <ul ref={listRef} className="la-ev-list la-tl">
        {groups.slice(from, to).map((g, i) => (
          <Fragment key={cursorOf(g[0]).id}>
            {from + i === nextIndex && todayLine}
            {renderGroup(g, from + i === nextIndex)}
          </Fragment>
        ))}
        {nextIndex === -1 && todayLine}
      </ul>
      {edge('future')}
    </>
  );
}
