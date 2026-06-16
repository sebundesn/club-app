'use client';

import { useEffect, useState } from 'react';
import { generateCalendarDays, createEmptyEvents } from '../utils/calendar';
import { getNowTime } from '../utils/getTime';
import { DateTitle, EventStruct } from '../utils/schema';
import './calendar.css'; // Vanilla CSSをインポート

// カレンダーページ：月間カレンダーとイベント管理機能を提供
export default function CalendarPage() {
  const [thisYear, thisMonth, today, dayNames] = getNowTime();

  const [year, setYear] = useState<number>(thisYear);
  const [month, setMonth] = useState<number>(thisMonth);
  const [selectedDate, setSelectedDate] = useState('');
  const [opinion, setOpinion] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventMap, setEventMap] = useState<Record<string, DateTitle> | null>({});
  const [eventData, setEventData] = useState<EventStruct>({
    Date: '',
    Title: '',
    Subtitle: '',
    PDFPath: '',
    Content: '',
  });
  const [notificate, setNotificate] = useState([]);

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
  const getMonthEvents = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/getMonthEvents?month=${String(year)}-${String(month).padStart(2, '0')}`
      );
      const data: DateTitle[] = await res.json();

      const newMap = { ...createEmptyEvents(year, month) };
      if (data === null || data.length === 0) {
        setEventMap(newMap);
        return;
      }

      data.forEach((d) => {
        newMap[d.date] = d;
      });
      setEventMap(newMap);
    } catch (e) {
      console.error('event failed', e);
    }
  };

  // 日付クリック時の処理
  const handleDateClick = async (date: number) => {
    if (!date) return;

    const dateStr = `${String(year)}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    setSelectedDate(dateStr);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/getDateEvent?date=${dateStr}`
      );
      const data = await res.json();
      setEventData({
        Date: dateStr,
        Title: data.title || '',
        Subtitle: data.subtitle || '',
        Content: data.content || '',
        PDFPath: data.pdf_path || '',
      });

      setIsModalOpen(true);
    } catch (e) {
      console.error('詳細取得失敗', e);
    }
  };

  // イベント保存
  const saveEvent = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/saveEvent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          title: eventData.Title,
          subtitle: eventData.Subtitle,
          content: eventData.Content,
          pdf_path: eventData.PDFPath,
        }),
        credentials: 'include',
      });

      console.log(eventData);

      if (res.ok) {
        setEventMap((prev) => ({
          ...prev,
          [selectedDate]: { date: selectedDate, title: eventData.Title },
        }));

        setEventData(eventData);
        setIsModalOpen(false);
      } else {
        alert('保存失敗しました。保存には"部長、副部長"の権限が必要です');
      }
    } catch (e) {
      console.error('通信エラーが発生', e);
    }
  };

  // モーダルを閉じる
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedDate('');

    setEventData({
      Date: '',
      Title: '',
      Subtitle: '',
      PDFPath: '',
      Content: '',
    });
  };
  
  // 通知取得
  const getNotification = async () => {
    try{
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/getNotification`, {
        method: "GET",
        credentials: "include",
      })

      if(!res.ok){
        alert("response error")
        return;
      }

      const data = await res.json();
      console.log(data);
      setNotificate(data);

    } catch (e) {
      alert(`Failed to get notification: ${e}`);
    };
  };

  // メッセージ送信（TODO: 実装中）
  const sendMessage = async () => {
    if (!opinion.trim()) {
      alert('メッセージを入力してください');
      return;
    }

    const isConfirmed = window.confirm('この内容で送信しますか？');

    if (isConfirmed) {
      setOpinion('');
    }
  };

  useEffect(() => {
    getMonthEvents();
  }, [year, month]);

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
            const dateKey = `${String(year)}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
            const hasEvent = eventMap?.[dateKey];

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
                    {hasEvent?.title && (
                      <div className="event-badge-container">
                        <span className="event-badge">
                          {hasEvent.title}
                        </span>
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
            !notificate ? <p>報告はないです!</p> : 
            <ul className="todo-list">
              <li className="todo-item">
                <span className="todo-dot orange" />
                <span className="todo-text">ワカサギ釣り：  1000円支払いお願いします。</span>
              </li>
              <li className="todo-item">
                <span className="todo-dot yellow" />
                <span className="todo-text">投票: キャンプ    残り8日!</span>
              </li>
            </ul>
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

            <div className="space-y-4 mb-2" style={{ marginBottom: '1.5rem' }}>
              <input
                type="text"
                placeholder="タイトル"
                required
                value={eventData.Title}
                onChange={(e) => setEventData({ ...eventData, Title: e.target.value })}
                className="input-field"
              />
              <input
                type="text"
                placeholder="サブタイトル"
                value={eventData.Subtitle}
                onChange={(e) => setEventData({ ...eventData, Subtitle: e.target.value })}
                className="input-field"
              />
              <textarea
                placeholder="内容"
                value={eventData.Content}
                onChange={(e) => setEventData({ ...eventData, Content: e.target.value })}
                rows={5}
                className="input-field resize-none"
              />
            </div>

            <div className="flex-gap-3">
              <button onClick={closeModal} className="btn-secondary flex-1">
                キャンセル
              </button>
              <button onClick={saveEvent} className="btn-primary flex-1">
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}