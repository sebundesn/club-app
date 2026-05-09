"use client";

import { useEffect, useState} from "react";
import { generateCalendarDays, createEmptyEvents} from "../utils/calendar";
import { getNowTime} from "../utils/getTime";

interface DateTitle {
  date: string;
  title: string;
};

interface eventStruct {
  Date: string;
  Title: string;
  Subtitle: string;
  Content: string;
  PDFPath: string;
}

export default function CalendarPage() {
    const [selectedDate, setSelectedDate] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [eventMap, setEventMap] = useState<Record<string, DateTitle>>({});
    const [eventData, setEventData] = useState<eventStruct>({
      Date: "",
      Title: "",
      Subtitle: "",
      PDFPath: "",
      Content: "",
    });

    const [year, month, today, dayNames] = getNowTime();
    const days = generateCalendarDays(year, month);

    const getMonthEvents = async () => {                                  
      const res = await fetch(`http://localhost:8080/getMonthEvents?month=${String(year)}-${String(month).padStart(2, '0')}`);
      const data: DateTitle[] = await res.json();
      data.forEach((d) => {
        eventMap[d.date] = d;
      });
      setEventMap(eventMap);
    };

    const handleDateClick = async (date: number) => {
      const dateStr = `${String(year)}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
      setSelectedDate(dateStr);
      setIsModalOpen(true);

      const res = await fetch(`http://localhost:8080/getDateEvent?date=${dateStr}`);
      const data = await res.json();
      const nextEventData: eventStruct = {...eventData, Subtitle: data.subtitle, Content: data.content, PDFPath: data.pdf_path};
      setEventData(nextEventData);
      console.log(eventData);
    };

    const saveEvent = async () => {
      const res = await fetch("http://localhost:8080/saveEvent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: selectedDate,
          title: eventData.Title,
          subtitle: eventData.Subtitle,
          content: eventData.Content,
          pdf_path: eventData.PDFPath 
        }), 
      });

      if(res.ok){
        const nextMap = {...eventMap};
        nextMap[selectedDate] = {
          ...nextMap[selectedDate],
          title: eventData.Title
        };
        setEventMap(nextMap);

        setEventData(eventData);

        alert("保存完了！");
        setIsModalOpen(false);
      }else{
        alert("保存失敗ー")
      };
    };

    useEffect(() => {
      setEventMap(createEmptyEvents(year, month));
      getMonthEvents();
    }, [year, month]);

    const closeModal = () => {
      setIsModalOpen(false);
      setSelectedDate("");
    };

    return (
    <div className="container">
      <div className="calendar-container">
        <h1 className="calendar-title">{year}年 {month}月</h1>
        
        {/* 曜日ヘッダー */}
        <div className="calendar-header">
          {dayNames.map((name) => <div key={name} className="header-cell">{name}</div>)}
        </div>

        {/* 日付グリッド */}
        <div className="calendar-grid">
          {days.map((date, i) => {
            const isToday = date === today;
            const dateKey = `${String(year)}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;

            return (
              <div
                key={i}
                className={`calendar-cell
                  ${isToday ? "today": ""}
                `}
                onClick={() => date && handleDateClick(date)}
              >
                {date}

                {eventMap[dateKey] && (
                      <p className="event-title">{eventMap[dateKey].title}</p>

                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* -- modal part */}
      { isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e)=> e.stopPropagation()}>
              <p>{selectedDate.slice(5, 7)}月{selectedDate.slice(8, 10)}日</p>

              <div className="modal-form">
                <input
                  type="text"
                  placeholder="タイトル"
                  required
                  value={eventData.Title}
                  onChange={(e) => setEventData({...eventData, Title: e.target.value})}
                />
                <input
                  type="text"
                  placeholder="サブタイトル"
                  value={eventData.Subtitle}
                  onChange={(e) => setEventData({...eventData, Subtitle: e.target.value})}
                />
                <textarea
                  placeholder="内容"
                  value={eventData.Content}
                  onChange={(e) => setEventData({...eventData, Content: e.target.value})}
                  rows={5}
                />
              </div>

              <div className="memo-button">
                <button className="cancel-button" onClick={closeModal}>
                  キャンセル
                </button>
                <button className="save-button" onClick={saveEvent}>
                  保存
                </button>
              </div>
          </div>
        </div>
      )}
    </div>
  );
};