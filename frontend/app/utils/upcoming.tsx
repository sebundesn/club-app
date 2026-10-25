import { DateTitle } from './schema';
import { toDateKey } from './calendar';

export const UPCOMING_DAYS = 30;

interface DayInfo {
  /** YYYY-MM-DD */
  date: string;
  /** 1〜12 */
  month: number;
  day: number;
  /** 0:日 〜 6:土 */
  weekday: number;
}

/** 一覧の1行。同じタイトルが連日続く予定は1行にまとめ、end に最終日が入る */
export interface UpcomingRow extends DayInfo {
  end?: DayInfo;
  titles: string[];
  /** 今日がこの行の期間に入っているか */
  isToday: boolean;
}

/** 同じタイトルが連日続く予定を1つにまとめたもの */
export interface EventRange {
  title: string;
  /** YYYY-MM-DD */
  start: string;
  end: string;
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

const dayInfo = (date: string): DayInfo => {
  const [y, m, d] = date.split('-').map(Number);
  return { date, month: m, day: d, weekday: new Date(y, m - 1, d).getDay() };
};

const nextDay = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return keyOf(new Date(y, m - 1, d + 1));
};

/** 同じタイトルの予定が連日続いていれば1つの期間にまとめる。並びは開始日順(同じ日は短い方が先)。 */
export const buildRanges = (events: DateTitle[]): EventRange[] => {
  const byTitle = new Map<string, Set<string>>();
  for (const e of events) {
    const title = e.title || '(無題)';
    if (!byTitle.has(title)) byTitle.set(title, new Set());
    byTitle.get(title)!.add(e.date.slice(0, 10));
  }

  const ranges: EventRange[] = [];
  for (const [title, dates] of byTitle) {
    const sorted = [...dates].sort();
    let start = sorted[0];
    let prev = sorted[0];
    for (const date of sorted.slice(1)) {
      if (date !== nextDay(prev)) {
        ranges.push({ title, start, end: prev });
        start = date;
      }
      prev = date;
    }
    ranges.push({ title, start, end: prev });
  }
  return ranges.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
};

/** 期間が同じ予定は1行にまとめて、一覧の行にする */
const toRows = (ranges: EventRange[], todayKey: string): UpcomingRow[] => {
  const rows: UpcomingRow[] = [];
  for (const r of ranges) {
    const last = rows[rows.length - 1];
    if (last && last.date === r.start && (last.end?.date ?? last.date) === r.end) {
      last.titles.push(r.title);
      continue;
    }
    rows.push({
      ...dayInfo(r.start),
      end: r.end === r.start ? undefined : dayInfo(r.end),
      titles: [r.title],
      isToday: r.start <= todayKey && todayKey <= r.end,
    });
  }
  return rows;
};

/**
 * 今日を最上段にして、days 日先までの予定を日付順に並べる。
 * 今日は予定がなくても必ず先頭に出す。同じタイトルが連日続く予定は1行(10/25〜10/27)にまとめる。
 */
export const buildUpcomingRows = (events: DateTitle[], today: Date, days = UPCOMING_DAYS): UpcomingRow[] => {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startKey = keyOf(start);
  const endKey = keyOf(new Date(start.getFullYear(), start.getMonth(), start.getDate() + days));

  // 今日より前から続いている予定(合宿の途中など)も、今日にかかっていれば出す
  const rows = toRows(
    buildRanges(events).filter((r) => r.end >= startKey && r.start <= endKey),
    startKey,
  );
  if (!rows.some((r) => r.isToday)) rows.unshift({ ...dayInfo(startKey), titles: [], isToday: true });
  return rows;
};

/** 1か月分の予定を、予定のある日だけ日付順に並べる。同じタイトルが連日続く予定は1行にまとめる。 */
export const buildMonthRows = (events: DateTitle[], today: Date): UpcomingRow[] => toRows(buildRanges(events), keyOf(today));

/** 月カレンダーの1週に引くバー。同じタイトルが連日続く予定は日付をまたいで1本にする */
export interface WeekBar {
  title: string;
  /** 0:日 〜 6:土 の列 */
  col: number;
  span: number;
  /** 上から何段目か(重ならないように積む) */
  lane: number;
  /** 前の週(月)から続いている / 次の週(月)へ続く */
  fromBefore: boolean;
  toAfter: boolean;
}

export interface CalendarWeek {
  /** 7マス。月の外は null */
  days: (number | null)[];
  bars: WeekBar[];
  lanes: number;
}

/** 月カレンダーを週ごとに分け、それぞれの週に予定のバーを並べる */
export const buildCalendarWeeks = (year: number, month: number, days: (number | null)[], events: DateTitle[]): CalendarWeek[] => {
  const cells = [...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const ranges = buildRanges(events);

  const weeks: CalendarWeek[] = [];
  for (let w = 0; w < cells.length / 7; w++) {
    const week = cells.slice(w * 7, w * 7 + 7);
    const keys = week.map((d) => (d ? toDateKey(year, month, d) : null));
    const segments: Omit<WeekBar, 'lane'>[] = [];
    for (const r of ranges) {
      const cols = keys.flatMap((k, i) => (k && r.start <= k && k <= r.end ? [i] : []));
      if (cols.length === 0) continue;
      segments.push({
        title: r.title,
        col: cols[0],
        span: cols[cols.length - 1] - cols[0] + 1,
        fromBefore: r.start < keys[cols[0]]!,
        toAfter: r.end > keys[cols[cols.length - 1]]!,
      });
    }

    // 早く始まる順、同じなら長い順に、空いているいちばん上の段へ入れる
    segments.sort((a, b) => a.col - b.col || b.span - a.span);
    const laneEnds: number[] = [];
    const bars = segments.map((s) => {
      let lane = laneEnds.findIndex((end) => end < s.col);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = s.col + s.span - 1;
      return { ...s, lane };
    });
    weeks.push({ days: week, bars, lanes: laneEnds.length });
  }
  return weeks;
};
