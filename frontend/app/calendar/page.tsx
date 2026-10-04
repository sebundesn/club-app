'use client';

import { useCallback, useEffect, useState } from 'react';
import { generateCalendarDays, toDateKey } from '../utils/calendar';
import { getNowTime } from '../utils/getTime';
import { DateTitle, EventDetail, EventStruct, NotificateStruct } from '../utils/schema';
import { backendURL, readErrorMessage } from '../utils/api';
import { useToast } from '../../components/Toast';
import './calendar.css'; // Vanilla CSSをインポート

const emptyEvent: EventStruct = {
  ID: 0,
  Date: '',
  Title: '',
  Subtitle: '',
  PDFPath: '',
  Content: '',
};

// カレンダーページ：月間カレンダーとイベント管理機能を提供
export default function CalendarPage() {
  const { showToast } = useToast();
  const [thisYear, thisMonth, today, dayNames] = getNowTime();

  const [year, setYear] = useState<number>(thisYear);
  const [month, setMonth] = useState<number>(thisMonth);
  const [selectedDate, setSelectedDate] = useState('');
  const [opinion, setOpinion] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  // 1日に複数イベントを持てるので、日付キーに対して配列を持つ
  const [eventMap, setEventMap] = useState<Record<string, DateTitle[]>>({});
  const [dayEvents, setDayEvents] = useState<EventDetail[]>([]);
  // 編集中のイベント。ID が 0 なら新規作成。null なら一覧表示。
  const [editing, setEditing] = useState<EventStruct | null>(null);
  const [notificate] = useState<NotificateStruct[]>([]);
  const days = generateCalendarDays(year, month);

  // 前月へ移動
  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  // 次月へ移動
  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  // 月のイベントを取得
  const getMonthEvents = useCallback(async () => {
    try {
      const res = await fetch(
        `${backendURL}/getMonthEvents?month=${String(year)}-${String(month).padStart(2, '0')}`
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

  // 指定日のイベントを取得
  const getDateEvents = useCallback(
    async (dateStr: string): Promise<EventDetail[]> => {
      const res = await fetch(`${backendURL}/getDateEvent?date=${dateStr}`);

      if (!res.ok) {
        showToast(await readErrorMessage(res, 'イベントの取得に失敗しました。'), 'error');
        return [];
      }

      return (await res.json()) ?? [];
    },
    [showToast],
  );

  // 日付クリック時の処理
  const handleDateClick = async (date: number) => {
    if (!date) return;

    const dateStr = toDateKey(year, month, date);
    setSelectedDate(dateStr);

    try {
      const events = await getDateEvents(dateStr);
      setDayEvents(events);
      // その日にイベントがなければ、いきなり作成フォームを開く
      setEditing(events.length === 0 ? { ...emptyEvent, Date: dateStr } : null);
      setIsModalOpen(true);
    } catch (e) {
      console.error('詳細取得失敗', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  // イベント保存（新規作成 / 更新）
  const saveEvent = async () => {
    if (!editing) return;

    if (!editing.Title.trim()) {
      showToast('タイトルを入力してください。', 'error');
      return;
    }

    try {
      const res = await fetch(`${backendURL}/saveEvent`, {
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

  // メッセージ送信（TODO: 実装中）
  const sendMessage = async () => {
    if (!opinion.trim()) {
      showToast('メッセージを入力してください。', 'error');
      return;
    }

    const isConfirmed = window.confirm('この内容で送信しますか？');

    if (isConfirmed) {
      setOpinion('');
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。同期的な連鎖レンダリングは起きない。
    getMonthEvents();
  }, [getMonthEvents]);

  return (
    <div className="calendar-container">
      {/* カレンダーエリア */}
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
                      <div className="event-badge-container">
                        {dayEventList.map((event) =>
                          event.title ? (
                            <span key={event.id} className="event-badge">
                              {event.title}
                            </span>
                          ) : null,
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bottom-grid">
        {/* 通知 */}
        <div className="card">
          <h2 className="section-title">通知 (開発中)</h2>
          {
            !notificate || notificate.length === 0 ? (
              <p>報告はないです!</p>
            ) : (
              <ul className="todo-list">
                {notificate.map((n) => (
                  <li key={n.id} className="todo-item">
                    <span className="todo-dot orange" />
                    <span className="todo-text">{n.title}</span>
                  </li>
                ))}
              </ul>
             )
          }
        </div>

        {/* 匿名意見箱 */}
        <div className="card">
          <h2 className="section-title">匿名意見箱(開発中)</h2>
          <div className="space-y-4">
            <textarea
              placeholder="行きたい場所・やりたいこと・意見等何でも書いてね"
              value={opinion}
              rows={5}
              onChange={(e) => setOpinion(e.target.value)}
              className="input-field resize-none"
            />
            <button onClick={sendMessage} className="btn-primary">
              送信
            </button>
          </div>
        </div>
      </div>

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
                    </li>
                  ))}
                </ul>

                <div className="flex-gap-3">
                  <button onClick={closeModal} className="btn-secondary flex-1">
                    閉じる
                  </button>
                  <button
                    onClick={() => setEditing({ ...emptyEvent, Date: selectedDate })}
                    className="btn-primary flex-1"
                  >
                    ＋ イベントを追加
                  </button>
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
