'use client';

import { useEffect, useState } from 'react';
import { DateTitle } from '../../app/utils/schema';
import { fetchEventsBetween } from '../../app/utils/eventsRange';
import { getNowTime } from '../../app/utils/getTime';
import { useToast } from '../Toast';

const WINDOW_DAYS = 7;

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
const today = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

interface Props {
  selectedID: number | null;
  onSelect: (ev: DateTitle) => void;
}

/** アップロード先のイベントを選ぶ一覧。初期は今日から1週間前までで、前後に1週間ずつ動かせる。 */
export default function EventSelect({ selectedID, onSelect }: Props) {
  const { showToast } = useToast();
  const [, , , dayNames] = getNowTime();
  const [anchor, setAnchor] = useState(today);
  // どの期間の結果かを一緒に持つ。期間を動かした直後に古い結果を出さず「読み込み中」にするため。
  const [loaded, setLoaded] = useState<{ key: string; list: DateTitle[] } | null>(null);

  const from = addDays(anchor, -WINDOW_DAYS);
  const windowKey = `${anchor.getFullYear()}-${anchor.getMonth()}-${anchor.getDate()}`;
  const events = loaded?.key === windowKey ? loaded.list : null;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const list = await fetchEventsBetween(addDays(anchor, -WINDOW_DAYS), anchor);
        if (!cancelled) setLoaded({ key: windowKey, list });
      } catch (e) {
        console.error('failed to load events:', e);
        if (!cancelled) {
          showToast('予定の取得に失敗しました。', 'error');
          setLoaded({ key: windowKey, list: [] });
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [anchor, windowKey, showToast]);

  return (
    <>
      <div className="la-weeknav">
        <button type="button" className="la-icon-btn" aria-label="前の1週間" onClick={() => setAnchor(addDays(anchor, -WINDOW_DAYS))}>
          ‹
        </button>
        <button type="button" className="la-chip" onClick={() => setAnchor(today())}>
          {md(from)} 〜 {md(anchor)}
        </button>
        <button type="button" className="la-icon-btn" aria-label="次の1週間" onClick={() => setAnchor(addDays(anchor, WINDOW_DAYS))}>
          ›
        </button>
      </div>

      {events === null ? (
        <p className="la-empty">読み込み中…</p>
      ) : events.length === 0 ? (
        <p className="la-empty">この期間のイベントはありません。前後の週を見てください。</p>
      ) : (
        <ul className="la-events">
          {events.map((ev) => {
            const [y, m, d] = ev.date.slice(0, 10).split('-').map(Number);
            const on = selectedID === ev.id;
            return (
              <li key={ev.id}>
                <button type="button" className={`la-event${on ? ' selected' : ''}`} aria-pressed={on} onClick={() => onSelect(ev)}>
                  <span className="la-event-date">
                    {m}/{d}({dayNames[new Date(y, m - 1, d).getDay()]})
                  </span>
                  <span className="la-event-title">{ev.title || '(無題)'}</span>
                  <span className="la-radio" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
