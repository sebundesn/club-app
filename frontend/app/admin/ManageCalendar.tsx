'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { generateCalendarDays, toDateKey } from '../utils/calendar';
import { getNowTime } from '../utils/getTime';
import { DateTitle, EventDetail, EventFile, EventStruct } from '../utils/schema';
import { backendURL, readErrorMessage } from '../utils/api';
import { useToast } from '../../components/Toast';
import EventFiles from '../../components/EventFiles';
import '../calendar/calendar.css';

const emptyEvent: EventStruct = {
  ID: 0,
  Date: '',
  Title: '',
  Subtitle: '',
  PDFPath: '',
  Content: '',
  Files: [],
};

// サーバー側と同じ上限
const MAX_FILES_PER_EVENT = 10;
const MAX_FILE_BYTES = 20 << 20;
const FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

/** 管理ページの「カレンダー」。月カレンダーから日付を選んで、予定の登録・編集をする(部長・副部長)。 */
export default function ManageCalendar() {
  const { showToast } = useToast();
  const [thisYear, thisMonth, today, dayNames] = getNowTime();

  const [year, setYear] = useState<number>(thisYear);
  const [month, setMonth] = useState<number>(thisMonth);
  const [selectedDate, setSelectedDate] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventMap, setEventMap] = useState<Record<string, DateTitle[]>>({});
  const [dayEvents, setDayEvents] = useState<EventDetail[]>([]);
  const [editing, setEditing] = useState<EventStruct | null>(null);
  // 保存したときにアップロードする、まだ送っていないPDF・画像
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
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
      const res = await fetch(`${backendURL}/api/getMonthEvents?month=${String(year)}-${String(month).padStart(2, '0')}`);

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

  const handleDateClick = async (date: number) => {
    const dateStr = toDateKey(year, month, date);
    setSelectedDate(dateStr);

    try {
      const events = await getDateEvents(dateStr);
      setDayEvents(events);
      // その日にイベントがなければ、いきなり作成フォームを開く
      setEditing(events.length === 0 ? { ...emptyEvent, Date: dateStr } : null);
      setPendingFiles([]);
      setIsModalOpen(true);
    } catch (e) {
      console.error('詳細取得失敗', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  const pickFiles = (picked: File[]) => {
    if (!editing) return;
    const ok = picked.filter((f) => FILE_TYPES.includes(f.type) && f.size <= MAX_FILE_BYTES);
    if (ok.length < picked.length) showToast('PDF・JPEG・PNG(1つ20MBまで)だけ追加できます。', 'error');
    const room = MAX_FILES_PER_EVENT - editing.Files.length - pendingFiles.length;
    if (ok.length > room) showToast(`PDF・画像は1イベント${MAX_FILES_PER_EVENT}個までです。`, 'error');
    setPendingFiles((p) => [...p, ...ok.slice(0, Math.max(room, 0))]);
  };

  /** 1つずつ送る(まとめるとリクエストの大きさの上限に当たりやすい)。失敗した分は返す */
  const uploadFiles = async (eventID: number, files: File[]): Promise<File[]> => {
    const failed: File[] = [];
    for (const file of files) {
      const form = new FormData();
      form.append('eventID', String(eventID));
      form.append('files', file);
      try {
        const res = await fetch(`${backendURL}/api/uploadEventFile`, { method: 'POST', body: form, credentials: 'include' });
        if (!res.ok) {
          showToast(await readErrorMessage(res, `${file.name}のアップロードに失敗`), 'error');
          failed.push(file);
        }
      } catch (e) {
        console.error('failed to upload event file:', e);
        showToast(`${file.name}のアップロードに失敗`, 'error');
        failed.push(file);
      }
    }
    return failed;
  };

  const deleteFile = async (file: EventFile) => {
    if (!editing || !window.confirm(`${file.name || 'このファイル'}を削除しますか？`)) return;
    try {
      const res = await fetch(`${backendURL}/api/deleteEventFile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: editing.ID, file_id: file.id }),
        credentials: 'include',
      });
      if (!res.ok) {
        showToast(await readErrorMessage(res, '削除に失敗'), 'error');
        return;
      }
      setEditing({ ...editing, Files: editing.Files.filter((f) => f.id !== file.id) });
      setDayEvents(await getDateEvents(selectedDate));
    } catch (e) {
      console.error('failed to delete event file:', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  // イベント保存（新規作成 / 更新）。そのあと、追加したPDF・画像を送る
  const saveEvent = async () => {
    if (!editing) return;

    if (!editing.Title.trim()) {
      showToast('タイトルを入力', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${backendURL}/api/saveEvent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        showToast(await readErrorMessage(res, '保存に失敗'), 'error');
        return;
      }
      const saved: { id: number } = await res.json();

      const failed = await uploadFiles(saved.id, pendingFiles);
      await getMonthEvents();
      const events = await getDateEvents(selectedDate);
      setDayEvents(events);
      if (failed.length > 0) {
        // 失敗した分だけ残して、編集を続けられるようにする
        const ev = events.find((e) => e.id === saved.id);
        setEditing({ ...editing, ID: saved.id, Files: ev?.files ?? [] });
        setPendingFiles(failed);
        return;
      }
      setEditing(null);
      setPendingFiles([]);
      showToast('保存しました。', 'success');
    } catch (e) {
      console.error('通信エラーが発生', e);
      showToast('通信に失敗しました。', 'error');
    } finally {
      setSaving(false);
    }
  };

  // モーダルを閉じる
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedDate('');
    setDayEvents([]);
    setEditing(null);
    setPendingFiles([]);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。
    getMonthEvents();
  }, [getMonthEvents]);

  return (
    <div className="calendar-container">
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

      {/* イベント編集モーダル */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className={editing ? 'edit-date-row' : undefined}>
              <p className="modal-title">
                {selectedDate.slice(5, 7)}月{selectedDate.slice(8, 10)}日
              </p>
              {editing && (
                <>
                  <button
                    type="button"
                    className="btn-attach"
                    onClick={() => fileInput.current?.click()}
                    disabled={editing.Files.length + pendingFiles.length >= MAX_FILES_PER_EVENT}
                  >
                    ＋PDF/画像
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept={FILE_TYPES.join(',')}
                    multiple
                    hidden
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      e.target.value = '';
                      if (files.length > 0) pickFiles(files);
                    }}
                  />
                </>
              )}
            </div>

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
                        <EventFiles files={event.files ?? []} />
                      </div>
                      <div className="day-event-actions">
                        <a href={`/album?eventID=${event.id}`} className="btn-secondary">
                          アルバム
                        </a>
                        {(
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
                                Files: event.files ?? [],
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
                  {(
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
                    autoFocus
                    required
                    value={editing.Title}
                    onChange={(e) => setEditing({ ...editing, Title: e.target.value })}
                    className="input-field"
                  />
                  <textarea
                    placeholder="内容"
                    value={editing.Content}
                    onChange={(e) => setEditing({ ...editing, Content: e.target.value })}
                    rows={5}
                    className="input-field resize-none"
                  />
                  {(editing.Files.length > 0 || pendingFiles.length > 0) && (
                    <div className="edit-files">
                      <EventFiles files={editing.Files} onDelete={deleteFile} />
                      {pendingFiles.length > 0 && (
                        <ul className="pending-files">
                          {pendingFiles.map((f, i) => (
                            <li key={`${f.name}-${i}`} className="pending-file">
                              <span className="pending-file-name">{f.name}</span>
                              <span className="pending-file-note">保存で追加</span>
                              <button
                                type="button"
                                className="pending-file-remove"
                                aria-label={`${f.name}を取り消す`}
                                onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}
                              >
                                ×
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-gap-3">
                  <button onClick={saveEvent} className="btn-primary w-full" disabled={saving}>
                    {saving ? (pendingFiles.length > 0 ? 'アップロード中…' : '保存中…') : '保存'}
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
