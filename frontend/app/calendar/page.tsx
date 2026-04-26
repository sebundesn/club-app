"use client";
import { useState} from "react";
import { generateCalendarDays } from "../utils/calendar";

export default function CalendarPage() {
    const [selectedDate, setSelectedDate] = useState<number | null>(null);
    const [memo, setMemo] = useState("");

    //ほかの月もできるように
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const today = now.getDate();
    const days = generateCalendarDays(year, month);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const handleDateClick = (day: number) => {
        setSelectedDate(day);
        // 本来はここでGoのAPI(GET /memo?date=...)を叩いて既存のメモを取得する
        setMemo("");
    };

    return (
    <div className="calendar-container">
      <h1 className="calendar-title">{year}年 {month}月</h1>
      
      {/* 曜日ヘッダー */}
      <div className="calendar-header">
        {dayNames.map((name) => <div key={name}>{name}</div>)}
      </div>

      {/* 日付グリッド */}
      <div className="calendar-grid">
        {days.map((day, i) => {
          const isToday = day === today;

          return (
            <div
              key={i}
              className={`calendar-cell
                ${isToday ? "today": ""}
              `}//今日は赤点とかつける
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
};