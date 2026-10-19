import { DateTitle } from './schema';
import { toDateKey } from './calendar';

export const UPCOMING_DAYS = 30;

export interface UpcomingRow {
  /** YYYY-MM-DD */
  date: string;
  /** 1〜12 */
  month: number;
  day: number;
  /** 0:日 〜 6:土 */
  weekday: number;
  titles: string[];
  isToday: boolean;
}

const keyOf = (d: Date) => toDateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());

/** 今日から days 日先までの、月を取得する対象(YYYY-MM)。月をまたぐので複数になることがある。 */
export const monthsToFetch = (today: Date, days = UPCOMING_DAYS): string[] => {
  const months: string[] = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const m = keyOf(d).slice(0, 7);
    if (!months.includes(m)) months.push(m);
  }
  return months;
};

/**
 * 今日を最上段にして、days 日先までの予定を日付順に並べる。
 * 今日は予定がなくても必ず先頭に出す。それ以降は予定のある日だけを出す(同じ日の予定は1行にまとめる)。
 */
export const buildUpcomingRows = (events: DateTitle[], today: Date, days = UPCOMING_DAYS): UpcomingRow[] => {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + days);
  const startKey = keyOf(start);
  const endKey = keyOf(end);

  const byDate = new Map<string, string[]>();
  for (const e of events) {
    const date = e.date.slice(0, 10);
    if (date < startKey || date > endKey) continue;
    byDate.set(date, [...(byDate.get(date) ?? []), e.title || '(無題)']);
  }

  const toRow = (date: string): UpcomingRow => {
    const [y, m, d] = date.split('-').map(Number);
    return {
      date,
      month: m,
      day: d,
      weekday: new Date(y, m - 1, d).getDay(),
      titles: byDate.get(date) ?? [],
      isToday: date === startKey,
    };
  };

  const rows = [toRow(startKey)];
  [...byDate.keys()]
    .filter((date) => date !== startKey)
    .sort()
    .forEach((date) => rows.push(toRow(date)));
  return rows;
};
