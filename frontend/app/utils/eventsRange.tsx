import { backendURL } from './api';
import { toDateKey } from './calendar';
import { DateTitle } from './schema';

const keyOf = (d: Date) => toDateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());

/** from〜to の日付が含まれる月(YYYY-MM)を順に返す */
export const monthKeysBetween = (from: Date, to: Date): string[] => {
  const months: string[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const last = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cur <= last) {
    months.push(keyOf(cur).slice(0, 7));
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
};

/** from〜to(両端を含む)のイベントを、日付の新しい順で返す。取得に失敗したらエラーを投げる。 */
export const fetchEventsBetween = async (from: Date, to: Date): Promise<DateTitle[]> => {
  const fromKey = keyOf(from);
  const toKey = keyOf(to);

  const lists = await Promise.all(
    monthKeysBetween(from, to).map(async (m) => {
      const res = await fetch(`${backendURL}/api/getMonthEvents?month=${m}`);
      if (!res.ok) throw new Error('予定の取得に失敗しました。');
      return ((await res.json()) as DateTitle[] | null) ?? [];
    }),
  );

  return lists
    .flat()
    .filter((e) => {
      const d = e.date.slice(0, 10);
      return d >= fromKey && d <= toKey;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
};
