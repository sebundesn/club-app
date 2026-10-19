'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { generateCalendarDays, toDateKey } from '../utils/calendar';
import { getNowTime } from '../utils/getTime';
import { buildMonthRows, buildUpcomingRows, monthsToFetch } from '../utils/upcoming';
import EventTable from './EventTable';
import MyUnpaidCard from './MyUnpaidCard';
import { DateTitle, EventDetail, EventStruct } from '../utils/schema';
import { backendURL, readErrorMessage } from '../utils/api';
import { useToast } from '../../components/Toast';
import './calendar.css';

const emptyEvent: EventStruct = {
  ID: 0,
  Date: '',
  Title: '',
  Subtitle: '',
  PDFPath: '',
  Content: '',
};

export default function CalendarPage() {
  const { showToast } = useToast();
  const [thisYear, thisMonth, today, dayNames] = getNowTime();

  const [year, setYear] = useState<number>(thisYear);
  const [month, setMonth] = useState<number>(thisMonth);
  const [selectedDate, setSelectedDate] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventMap, setEventMap] = useState<Record<string, DateTitle[]>>({});
  const [dayEvents, setDayEvents] = useState<EventDetail[]>([]);
  const [editing, setEditing] = useState<EventStruct | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<DateTitle[]>([]);
  const [viewMode, setViewMode] = useState<'upcoming' | 'month'>('upcoming');
  const [role, setRole] = useState('');
  // 予定の登録・編集は部長・副部長だけ。画面の出し分けだけで、実際の権限チェックはサーバー側で行っている。
  const isManager = role === '部長' || role === '副部長';
  const days = generateCalendarDays(year, month);

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
    try {
      const res = await fetch(
        `${backendURL}/api/getMonthEvents?month=${String(year)}-${String(month).padStart(2, '0')}`
      );

      if (!res.ok) {
        showToast(await readErrorMessage(res, 'イベントの取得に失敗しました。'), 'error');
        return;
      }

      const data: DateTitle[] = (await res.json()) ?? [];

      const newMap: Record<string, DateTitle[]> = {};
      data.forEach((d) => {
        (newMap[d.date] ||= []).push(d);
      });
      setEventMap(newMap);
    } catch (e) {
      console.error('event failed', e);
      showToast('通信に失敗しました。', 'error');
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
      // その日にイベントがなければ、部長・副部長はいきなり作成フォームを開く
      setEditing(events.length === 0 && isManager ? { ...emptyEvent, Date: dateStr } : null);
      setIsModalOpen(true);
    } catch (e) {
      console.error('詳細取得失敗', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  const handleDateClick = (date: number) => {
    if (!date) return;
    return openDay(toDateKey(year, month, date));
  };

  // イベント保存（新規作成 / 更新）
  const saveEvent = async () => {
    if (!editing) return;

    if (!editing.Title.trim()) {
      showToast('タイトルを入力してください。', 'error');
      return;
    }

    try {
      const res = await fetch(`${backendURL}/api/saveEvent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editing.ID,
          date: selectedDate,
          title: editing.Title,
          subtitle: editing.Subtitle,
          content: editing.Content,
          pdf_path: editing.PDFPath,
        }),
        credentials: 'include',
      });

      if (!res.ok) {
        showToast(await readErrorMessage(res, '保存に失敗しました。'), 'error');
        return;
      }

      await getMonthEvents();
      await getUpcomingEvents();
      setDayEvents(await getDateEvents(selectedDate));
      setEditing(null);
      showToast('保存しました。', 'success');
    } catch (e) {
      console.error('通信エラーが発生', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  // モーダルを閉じる
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedDate('');
    setDayEvents([]);
    setEditing(null);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。同期的な連鎖レンダリングは起きない。
    getMonthEvents();
  }, [getMonthEvents]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 同上
    getUpcomingEvents();
  }, [getUpcomingEvents]);

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

  const upcomingRows = useMemo(() => buildUpcomingRows(upcomingEvents, new Date()), [upcomingEvents]);
  // 月別の一覧は、表示中の月(下の月カレンダーと共通)の予定を使う
  const monthRows = useMemo(() => buildMonthRows(Object.values(eventMap).flat(), new Date()), [eventMap]);

  return (
    <div className="calendar-container">
      {/* 自分の部費の未払い */}
      <MyUnpaidCard />

      {/* 予定の一覧(日付・曜日・内容)。「これから」は今日を最上段に1か月先まで、「月別」は月ごと */}
      <div className="card mb-8">
        <div className="list-modes" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'upcoming'}
            className={`list-mode${viewMode === 'upcoming' ? ' active' : ''}`}
            onClick={() => setViewMode('upcoming')}
          >
            これから(1か月先まで)
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
          canSelectEmpty={isManager}
          emptyMessage="この月の予定はありません。"
        />
      </div>

      {/* 月カレンダー。予定を登録できる部長・副部長だけに出す(部員は上の一覧で見られる) */}
      {isManager && (
        <div className="card mb-8">
          <div className="calendar-header">
            <h1 className="calendar-title">
              {year}年 {month}月
            </h1>
            <div className="nav-buttons">
              <button
                onClick={handlePrevMonth}
                className="nav-btn"
                aria-label="前の月"
              >
                ◀
              </button>
              <button
                onClick={handleNextMonth}
                className="nav-btn"
                aria-label="次の月"
              >
                ▶
              </button>
            </div>
          </div>

          {/* 曜日ヘッダー */}
          <div className="grid-cols-7 mb-2">
            {dayNames.map((name, i) => (
              <div
                key={name}
                className={`day-name ${
                  i === 0 ? 'sunday' : i === 6 ? 'saturday' : 'weekday'
                }`}
              >
                {name}
              </div>
            ))}
          </div>

          {/* 日付グリッド */}
          <div className="grid-cols-7">
            {days.map((date, i) => {
              const isToday = year === thisYear && month === thisMonth && date === today;
              const dayEventList = date ? eventMap[toDateKey(year, month, date)] ?? [] : [];

              return (
                <div
                  key={i}
                  className={`day-cell ${
                    !date
                      ? 'empty'
                      : isToday
                      ? 'today'
                      : 'normal'
                  }`}
                  onClick={() => date && handleDateClick(date)}
                >
                  {date && (
                    <>
                      <span
                        className={`day-number ${
                          isToday ? 'text-today' : 'text-normal'
                        }`}
                      >
                        {date}
                      </span>
                      {dayEventList.length > 0 && (
                        <>
                          {/* スマホではタイトルが読めないので点だけにする(詳細は日付を押すか、上の一覧で見る) */}
                          <div className="event-dots" aria-label={`予定${dayEventList.length}件`}>
                            {dayEventList.slice(0, 3).map((event) => (
                              <span key={event.id} className="event-dot" />
                            ))}
                          </div>
                          <div className="event-badge-container">
                            {dayEventList.map((event) =>
                              event.title ? (
                                <span key={event.id} className="event-badge">
                                  {event.title}
                                </span>
                              ) : null,
                            )}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* イベント編集モーダル */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <p className="modal-title">
              {selectedDate.slice(5, 7)}月{selectedDate.slice(8, 10)}日
            </p>

            {editing === null ? (
              /* その日のイベント一覧。1日に複数登録できる。 */
              <>
                <ul className="day-event-list">
                  {dayEvents.map((event) => (
                    <li key={event.id} className="day-event-item">
                      <div className="day-event-text">
                        <p className="day-event-title">{event.title}</p>
                        {event.subtitle && <p className="day-event-subtitle">{event.subtitle}</p>}
                        {event.content && <p className="day-event-content">{event.content}</p>}
                      </div>
                      <div className="day-event-actions">
                        <a href={`/album?eventID=${event.id}`} className="btn-secondary">
                          アルバム
                        </a>
                        {isManager && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() =>
                              setEditing({
                                ID: event.id,
                                Date: selectedDate,
                                Title: event.title,
                                Subtitle: event.subtitle,
                                Content: event.content,
                                PDFPath: event.pdf_path,
                              })
                            }
                          >
                            編集
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="flex-gap-3">
                  <button onClick={closeModal} className="btn-secondary flex-1">
                    閉じる
                  </button>
                  {isManager && (
                    <button
                      onClick={() => setEditing({ ...emptyEvent, Date: selectedDate })}
                      className="btn-primary flex-1"
                    >
                      ＋ イベントを追加
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4 mb-2" style={{ marginBottom: '1.5rem' }}>
                  <input
                    type="text"
                    placeholder="タイトル"
                    required
                    value={editing.Title}
                    onChange={(e) => setEditing({ ...editing, Title: e.target.value })}
                    className="input-field"
                  />
                  <input
                    type="text"
                    placeholder="サブタイトル"
                    value={editing.Subtitle}
                    onChange={(e) => setEditing({ ...editing, Subtitle: e.target.value })}
                    className="input-field"
                  />
                  <textarea
                    placeholder="内容"
                    value={editing.Content}
                    onChange={(e) => setEditing({ ...editing, Content: e.target.value })}
                    rows={5}
                    className="input-field resize-none"
                  />
                </div>

                <div className="flex-gap-3">
                  <button
                    onClick={() => (dayEvents.length === 0 ? closeModal() : setEditing(null))}
                    className="btn-secondary flex-1"
                  >
                    キャンセル
                  </button>
                  <button onClick={saveEvent} className="btn-primary flex-1">
                    保存
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
