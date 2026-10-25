import { toDateKey } from './calendar';

/**
 * 連日のイベント(合宿の3日分など)は、詳細ページの URL に `eventID=12,13,14` とまとめて渡す。
 * 1日だけなら今までどおり `eventID=12`。
 */
export const parseEventIDs = (param: string | null): number[] =>
  (param ?? '')
    .split(',')
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);

export const eventIDsParam = (ids: number[]) => ids.join(',');

/** ＋で追加するときや、最初に開く日。今日が期間に入っていればその日、なければ初日。 */
export const defaultDay = <T extends { date: string }>(days: T[]): T | undefined => {
  const d = new Date();
  const today = toDateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return days.find((x) => x.date === today) ?? days[0];
};

/** アップロードページの URL。連日のイベントなら、終わったあとにまとめた詳細ページへ戻れるよう group も渡す */
export const uploadURL = (base: string, eventID: number, title: string, group: number[] = []) =>
  `${base}?eventID=${eventID}&title=${encodeURIComponent(title)}${group.length > 1 ? `&group=${eventIDsParam(group)}` : ''}`;

/** アップロードが終わったあとに戻る詳細ページ */
export const detailURLAfterUpload = (base: string, eventID: number, group: string | null) => {
  const ids = parseEventIDs(group);
  return ids.length > 1 ? `${base}?eventID=${eventIDsParam(ids)}&day=${eventID}` : `${base}?eventID=${eventID}`;
};
