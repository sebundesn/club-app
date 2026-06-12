'use client';

import { useEffect, useState } from 'react';
import { generateCalendarDays, createEmptyEvents } from '../utils/calendar';
import { getNowTime } from '../utils/getTime';
import { DateTitle, EventStruct } from '../utils/schema';

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
    if (eventData.Title.trim() === '') {
      alert('タイトルをつけてください');
      return;
    }

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

  // メッセージ送信（TODO: 実装中）
  const sendMessage = async () => {
    if (!opinion.trim()) {
      alert('メッセージを入力してください');
      return;
    }

    const isConfirmed = window.confirm('この内容で送信しますか？');

    if (isConfirmed) {
      console.log('sent message: ', opinion);
      setOpinion('');
    }
  };

  useEffect(() => {
    getMonthEvents();
  }, [year, month]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* カレンダーエリア */}
      <div className="card p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-forest-800">
            {year}年 {month}月
          </h1>
          <div className="flex gap-3">
            <button
              onClick={handlePrevMonth}
              className="w-12 h-12 rounded-lg bg-earth-200 hover:bg-earth-300 text-forest-700 font-bold text-xl transition-all duration-200 flex items-center justify-center"
              aria-label="前の月"
            >
              ◀
            </button>
            <button
              onClick={handleNextMonth}
              className="w-12 h-12 rounded-lg bg-earth-200 hover:bg-earth-300 text-forest-700 font-bold text-xl transition-all duration-200 flex items-center justify-center"
              aria-label="次の月"
            >
              ▶
            </button>
          </div>
        </div>

        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {dayNames.map((name, i) => (
            <div
              key={name}
              className={`text-center py-3 font-bold rounded-lg ${
                i === 0 ? 'text-red-500 bg-red-50' : i === 6 ? 'text-blue-500 bg-blue-50' : 'text-forest-700 bg-forest-50'
              }`}
            >
              {name}
            </div>
          ))}
        </div>

        {/* 日付グリッド */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((date, i) => {
            const isToday = year === thisYear && month === thisMonth && date === today;
            const dateKey = `${String(year)}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
            const hasEvent = eventMap?.[dateKey];

            return (
              <div
                key={i}
                className={`min-h-[100px] p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                  !date
                    ? 'bg-transparent border-transparent cursor-default'
                    : isToday
                    ? 'bg-forest-100 border-forest-500 hover:bg-forest-200'
                    : 'bg-white border-earth-200 hover:bg-earth-50 hover:border-forest-300'
                }`}
                onClick={() => date && handleDateClick(date)}
              >
                {date && (
                  <>
                    <span
                      className={`text-lg font-bold ${
                        isToday ? 'text-forest-700' : 'text-forest-800'
                      }`}
                    >
                      {date}
                    </span>
                    {hasEvent && (
                      <div className="mt-2">
                        <span className="inline-block px-2 py-1 bg-accent-orange text-white text-xs rounded-full truncate w-full">
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

      <div className="grid md:grid-cols-2 gap-8">
        {/* TODOリスト */}
        <div className="card p-6">
          <h2 className="text-xl font-bold text-forest-800 mb-4">TODO list (開発中)</h2>
          <ul className="space-y-3">
            <li className="p-4 bg-earth-50 rounded-lg border border-earth-200 flex items-start gap-3">
              <span className="w-2 h-2 bg-accent-orange rounded-full mt-2 flex-shrink-0" />
              <span className="text-forest-700">ワカサギ釣り：　　1000円支払いお願いします。</span>
            </li>
            <li className="p-4 bg-earth-50 rounded-lg border border-earth-200 flex items-start gap-3">
              <span className="w-2 h-2 bg-accent-yellow rounded-full mt-2 flex-shrink-0" />
              <span className="text-forest-700">投票: スポーツ大会　　　 残り8日!</span>
            </li>
          </ul>
        </div>

        {/* 匿名意見箱 */}
        <div className="card p-6">
          <h2 className="text-xl font-bold text-forest-800 mb-4">匿名意見箱</h2>
          <div className="space-y-4">
            <textarea
              placeholder="行きたい場所・やりたいこと・意見等何でも書いてね"
              value={opinion}
              rows={5}
              onChange={(e) => setOpinion(e.target.value)}
              className="input-field resize-none"
            />
            <button onClick={sendMessage} className="btn-primary w-full">
              送信
            </button>
          </div>
        </div>
      </div>

      {/* イベント編集モーダル */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-earth-50 rounded-2xl p-8 max-w-lg w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-2xl font-bold text-forest-800 mb-6 text-center">
              {selectedDate.slice(5, 7)}月{selectedDate.slice(8, 10)}日
            </p>

            <div className="space-y-4 mb-6">
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

            <div className="flex gap-3">
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
