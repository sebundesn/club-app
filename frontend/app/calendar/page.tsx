"use client";

import { useEffect, useState} from "react";
import { generateCalendarDays } from "../utils/calendar";
import { getNowTime} from "../utils/getTime";

export default function CalendarPage() {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [events, setEvents] = useState<any[]>([]);
    //events = date: "2020-05-23" title: "森吉山" subtitle: "8:00~"
    const [eventData, setEventData] = useState({
      title: "",
      subtitle: "",
      pdf_path: "",
      content: "",
    });

    //ほかの月もできるように
    const [year, month, today, dayNames] = getNowTime();
    const days = generateCalendarDays(year, month);

    const fetchMonthEvents = async () => {                                  
      const res = await fetch(`http://localhost:8080/getMonthEvents?month=${String(year)}-${String(month).padStart(2, '0')}`);
      const data = await res.json();
      setEvents(data);
      console.log("monthData: ", data);
    };

    const eventMap = (events ?? []).reduce((acc, cur) => {
      acc[cur.date] = cur;
      return acc;
    }, {});

    const handleDateClick = async (date: number) => {
        const dateStr = `${String(year)}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
        setSelectedDate(dateStr);
        setIsModalOpen(true);

        // 本来はここでGoのAPI(GET /memo?date=...)を叩いて既存のメモを取得する
    };

    const closeModal = () => {
      setIsModalOpen(false);
      setSelectedDate("");
    };

    const saveEvent = async () => {
      const res = await fetch("http://localhost:8080/saveEvent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: selectedDate,
          title: eventData.title,
          subtitle: eventData.subtitle,
          content: eventData.content,
          pdf_path: eventData.pdf_path 
        }), 
      });

      if(res.ok){
        alert("保存完了！");
        setIsModalOpen(false);
      }else{
        alert("保存失敗ー")
      };
    };

    useEffect(() => {
      fetchMonthEvents();
    }, []);

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
            const event = eventMap[dateKey];

            return (
              <div
                key={i}
                className={`calendar-cell
                  ${isToday ? "today": ""}
                `}
                onClick={() => date && handleDateClick(date)}
              >
                {date}

                {event && (
                    <div className="event-info">
                      <p className="event-title">{event.title}</p>
                      <p className="event-subtitle">{event.subtitle}</p>
                    </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="reservation-container">
          <button onClick={()=> setIsOpen(!isOpen)}>
            {isOpen ? "閉じる" : "体育館・レンタカー予約"}
          </button>

          {
            isOpen && (
              <ul>
                <li>
                  <a href="https://hirosaki.e-rev.jp/index.jsp">体育館予約サイト</a>
                  <p>利用者ID: 69290365  パスワード: 1031</p>
                </li>

                <li>
                  トヨタレンタカー弘前駅: 050-1712-2914
                  {/* 定型文も入れる */}
                </li>
              </ul>
            )
          }
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
                  value={eventData.title}
                  onChange={(e) => setEventData({...eventData, title: e.target.value})}
                />
                <input
                  type="text"
                  placeholder="サブタイトル"
                  value={eventData.subtitle}
                  onChange={(e) => setEventData({...eventData, subtitle: e.target.value})}
                />
                <textarea
                  placeholder="内容"
                  value={eventData.content}
                  onChange={(e) => setEventData({...eventData, content: e.target.value})}
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