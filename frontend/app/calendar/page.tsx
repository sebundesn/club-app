"use client";
import { useState} from "react";
import { generateCalendarDays } from "../utils/calendar";

export default function CalendarPage() {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [eventData, setEventData] = useState({
      title: "",
      subtitle: "",
      pdf_path: "",
      content: "",
    });
    

    //ほかの月もできるように
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const today = now.getDate();
    const days = generateCalendarDays(year, month);
    const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

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

            return (
              <div
                key={i}
                className={`calendar-cell
                  ${isToday ? "today": ""}
                `}
                onClick={() => date && handleDateClick(date)}
              >
                {date}
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
                <button className="save-button">
                  保存
                </button>
              </div>
          </div>
        </div>
      )}
    </div>
  );
};