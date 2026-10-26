'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getNowTime } from '../utils/getTime';
import { buildMonthRows, buildUpcomingRows, monthsToFetch } from '../utils/upcoming';
import EventTable from './EventTable';
import MyUnpaidCard from './MyUnpaidCard';
import AccountSummaryCard from './AccountSummaryCard';
import { DateTitle, EventDetail } from '../utils/schema';
import { toDateKey } from '../utils/calendar';
import { backendURL, readErrorMessage } from '../utils/api';
import { useToast } from '../../components/Toast';
import EventFiles from '../../components/EventFiles';
import EventParticipants from '../../components/EventParticipants';
import './calendar.css';

const prevDay = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  const p = new Date(y, m - 1, d - 1);
  return toDateKey(p.getFullYear(), p.getMonth() + 1, p.getDate());
};

/** 同じタイトルが前の日から続いていれば、その初日の予定のID(参加者は初日に記録している) */
const firstDayID = (id: number, date: string, title: string, events: DateTitle[]) => {
  let first = id;
  let day = date;
  for (;;) {
    const before = prevDay(day);
    const e = events.find((x) => x.date.slice(0, 10) === before && (x.title || '(無題)') === (title || '(無題)'));
    if (!e) return first;
    first = e.id;
    day = before;
  }
};

export default function CalendarPage() {
  const { showToast } = useToast();
  const [thisYear, thisMonth, , dayNames] = getNowTime();

  const [year, setYear] = useState<number>(thisYear);
  const [month, setMonth] = useState<number>(thisMonth);
  const [selectedDate, setSelectedDate] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  // 表示中の月と、その前後の月の予定。前後の月は、月をまたぐ予定を1行にまとめるためだけに使う
  const [monthEvents, setMonthEvents] = useState<DateTitle[]>([]);
  const [dayEvents, setDayEvents] = useState<EventDetail[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<DateTitle[]>([]);
  const [viewMode, setViewMode] = useState<'upcoming' | 'month'>('upcoming');
  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const getMonthEvents = useCallback(async () => {
    const monthKey = (offset: number) => {
      const d = new Date(year, month - 1 + offset, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };
    try {
      const lists = await Promise.all(
        [-1, 0, 1].map(async (offset) => {
          const res = await fetch(`${backendURL}/api/getMonthEvents?month=${monthKey(offset)}`);
          if (!res.ok) throw new Error(await readErrorMessage(res, 'イベントの取得に失敗しました。'));
          return ((await res.json()) as DateTitle[] | null) ?? [];
        }),
      );
      setMonthEvents(lists.flat());
    } catch (e) {
      console.error('event failed', e);
      showToast(e instanceof Error ? e.message : '通信に失敗しました。', 'error');
    }
  }, [year, month, showToast]);

  // 今日から1か月先までの予定(一覧用)。表示中の月とは別に取得する。
  const getUpcomingEvents = useCallback(async () => {
    try {
      const lists = await Promise.all(
        monthsToFetch(new Date()).map(async (m) => {
          const res = await fetch(`${backendURL}/api/getMonthEvents?month=${m}`);
          if (!res.ok) throw new Error(await readErrorMessage(res, '予定の取得に失敗しました。'));
          return ((await res.json()) as DateTitle[] | null) ?? [];
        }),
      );
      setUpcomingEvents(lists.flat());
    } catch (e) {
      console.error('failed to get upcoming events:', e);
      showToast(e instanceof Error ? e.message : '通信に失敗しました。', 'error');
    }
  }, [showToast]);

  const getDateEvents = useCallback(
    async (dateStr: string): Promise<EventDetail[]> => {
      const res = await fetch(`${backendURL}/api/getDateEvent?date=${dateStr}`);

      if (!res.ok) {
        showToast(await readErrorMessage(res, 'イベントの取得に失敗しました。'), 'error');
        return [];
      }

      return (await res.json()) ?? [];
    },
    [showToast],
  );

  // 日付(YYYY-MM-DD)を指定して、その日の詳細モーダルを開く
  const openDay = async (dateStr: string) => {
    setSelectedDate(dateStr);

    try {
      const events = await getDateEvents(dateStr);
      setDayEvents(events);
      setIsModalOpen(true);
    } catch (e) {
      console.error('詳細取得失敗', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  // モーダルを閉じる
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedDate('');
    setDayEvents([]);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。同期的な連鎖レンダリングは起きない。
    getMonthEvents();
  }, [getMonthEvents]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 同上
    getUpcomingEvents();
  }, [getUpcomingEvents]);

  const upcomingRows = useMemo(() => buildUpcomingRows(upcomingEvents, new Date()), [upcomingEvents]);
  // 月別の一覧は、表示中の月(下の月カレンダーと共通)の予定を使う
  const monthRows = useMemo(() => buildMonthRows(monthEvents, year, month, new Date()), [monthEvents, year, month]);

  return (
    <div className="calendar-container">
      {/* 自分の部費の未払い */}
      <MyUnpaidCard />

      {/* 予定の一覧(日付・曜日・内容)。「これから」は今日を最上段に2週間先まで、「月別」は月ごと */}
      <div className="card mb-8">
        <div className="list-modes" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'upcoming'}
            className={`list-mode${viewMode === 'upcoming' ? ' active' : ''}`}
            onClick={() => setViewMode('upcoming')}
          >
            これから(2週間先まで)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'month'}
            className={`list-mode${viewMode === 'month' ? ' active' : ''}`}
            onClick={() => setViewMode('month')}
          >
            月別
          </button>
        </div>

        {viewMode === 'month' && (
          <div className="month-switch">
            <button onClick={handlePrevMonth} className="nav-btn" aria-label="前の月">
              ◀
            </button>
            <span className="month-switch-label">
              {year}年 {month}月
            </span>
            <button onClick={handleNextMonth} className="nav-btn" aria-label="次の月">
              ▶
            </button>
          </div>
        )}

        <EventTable
          rows={viewMode === 'upcoming' ? upcomingRows : monthRows}
          dayNames={dayNames}
          onSelect={openDay}
          emptyMessage="この月の予定はありません。"
        />
      </div>

      {/* 部費の残高(新しい順、5件ぶんの高さでスクロール) */}
      <AccountSummaryCard />

      {/* 予定の詳細モーダル(閲覧のみ。登録・編集は管理ページ)。外側を押すと閉じる */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <p className="modal-title">
              {selectedDate.slice(5, 7)}月{selectedDate.slice(8, 10)}日
            </p>

            {/* その日のイベント一覧。1日に複数登録できる。 */}
            <ul className="day-event-list">
              {dayEvents.map((event) => (
                <li key={event.id} className="day-event-item">
                  <div className="day-event-text">
                    <p className="day-event-title">{event.title}</p>
                    {event.subtitle && <p className="day-event-subtitle">{event.subtitle}</p>}
                    {event.content && <p className="day-event-content">{event.content}</p>}
                    <EventFiles files={event.files ?? []} />
                    {/* 参加者と金額(部員だけ。参加者がいなければ出さない)。連日の予定は初日にまとめて記録している */}
                    <div className="day-event-participants">
                      <EventParticipants eventID={firstDayID(event.id, selectedDate, event.title, [...monthEvents, ...upcomingEvents])} hideEmpty />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
