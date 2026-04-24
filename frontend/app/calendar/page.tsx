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
    const day = now.getDate();
    const days = generateCalendarDays(year, month);
    const dayNames = ["Sun", "Mon", "Tues", "Wednes", "Thurs", "Fri", "Satur"];

    const handleDateClick = (day: number) => {
        setSelectedDate(day);
        // 本来はここでGoのAPI(GET /memo?date=...)を叩いて既存のメモを取得する
        setMemo("");
    };

    return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">{year}年 {month}月</h1>
      
      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 gap-1 text-center font-bold mb-2">
        {dayNames.map(name => <div key={name}>{name}</div>)}
      </div>

      {/* 日付グリッド */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => (
          <div
            key={i}
            onClick={() => day && handleDateClick(day)}
            className={`h-16 border p-1 cursor-pointer hover:bg-blue-50 ${
              day === null ? "bg-gray-100" : "bg-white"
              //基本土日を赤表示　祝日も自動でできるように
              //今日は赤点とかつける
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* メモ入力エリア（簡易モーダル風） */}
      {selectedDate && (
        <div className="mt-6 p-4 border-t shadow-lg rounded-lg bg-yellow-50">
          <h2 className="font-bold">{month}月{selectedDate}日のメモ</h2>
          <textarea 
            className="w-full p-2 mt-2 border rounded"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="予定を入力..."
          />
          <button 
            className="mt-2 bg-blue-600 text-white px-4 py-2 rounded"
            onClick={() => alert(`保存: ${memo}`)} // ここでGoのAPI(POST /memo)を叩く
          >
            保存する
          </button>
        </div>
      )}
    </div>
  );
};