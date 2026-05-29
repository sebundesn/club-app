"use client";

import { useEffect, useState} from "react";
import "./calendar.css"
import { generateCalendarDays, createEmptyEvents} from "../utils/calendar";
import { getNowTime} from "../utils/getTime";
import {DateTitle, EventStruct} from "../utils/schema";


export default function CalendarPage() {
    const [thisYear, thisMonth, today, dayNames] = getNowTime();

    const [year, setYear] = useState<number>(thisYear);
    const [month, setMonth] = useState<number>(thisMonth);
    const [selectedDate, setSelectedDate] = useState("");
    const [opinion, setOpinion] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [eventMap, setEventMap] = useState<Record<string, DateTitle> | null>({});
    const [eventData, setEventData] = useState<EventStruct>({
      Date: "",
      Title: "",
      Subtitle: "",
      PDFPath: "",
      Content: "",
    });

    const days = generateCalendarDays(year, month);

    const handlePrevMonth = () => {
      if (month === 1) {
        setMonth(12);
        setYear(year-1);
      } else {
        setMonth(month-1);
      }
    };

    const handleNextMonth = () => {
      if (month === 12) {
        setMonth(1);
        setYear(year+1);
      } else {
        setMonth(month+1);
      }
    };

    const getMonthEvents = async () => { 
      try{
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/getMonthEvents?month=${String(year)}-${String(month).padStart(2, '0')}`);
        const data: DateTitle[] = await res.json();

        const newMap = {...createEmptyEvents(year, month)};
        if(data === null || data.length === 0) {
          setEventMap(newMap);
          return;
        };

        data.forEach((d) => {
          newMap[d.date] = d;
        });
        setEventMap(newMap);
      } catch (e){
        console.error("event failed", e);
      }                    
    };

    const handleDateClick = async (date: number) => {
      const dateStr = `${String(year)}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
      setSelectedDate(dateStr);

      try{
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/getDateEvent?date=${dateStr}`);
        const data = await res.json();
        setEventData({
          Date: dateStr,
          Title: data.title || "",
          Subtitle: data.subtitle || "",
          Content: data.content || "",
          PDFPath: data.pdf_path || "",
      });

      setIsModalOpen(true);
      }catch (e) {
        console.error("詳細取得失敗", e);
      }
    };

    const saveEvent = async () => {
      if (eventData.Title.trim() === "") {
        alert("タイトルをつけてください");
        return;
      };

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/saveEvent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            date: selectedDate,
            title: eventData.Title,
            subtitle: eventData.Subtitle,
            content: eventData.Content,
            pdf_path: eventData.PDFPath,
          }), 
        });

        if(res.ok){
          setEventMap((prev)=> ({
            ...prev,
            [selectedDate]: {date: selectedDate, title: eventData.Title },
          }));

          setEventData(eventData);

          alert("保存完了！");
          setIsModalOpen(false);
        }else{
          alert("保存失敗ー")
        };
      } catch (e) {
        console.error("通信エラーが発生", e);
      }
    };

    useEffect(() => {
      getMonthEvents();
    }, [year, month]);

    const closeModal = () => {
      setIsModalOpen(false);
      setSelectedDate("");

      setEventData({
        Date: "",
        Title: "",
        Subtitle: "",
        PDFPath: "",
        Content: "",
      });
    };

    const sendMessage = async () => {
      if(!opinion.trim()){
        alert("メッセージを入力してください");
        return;
      }

      const isConfirmed = window.confirm("この内容で送信しますか？");

      if(isConfirmed) {
        console.log("sent message: ", opinion);
        setOpinion("");
      };

      /*
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sendMessage`, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({opinion: opinion}),
        });

        if(res.ok){
          alert("sending success!");
          setOpinion("");
        }else{
          alert("sending failed");
        };

      } catch (e) {
        console.error("failed to send message", e);
        alert("通信エラーが発生しました。")
      }
      */
    }

    return (
    <div className="container">
      <div className="calendar-container">
        <div className="calendar-title-area">
          <h1 className="calendar-title">{year}年 {month}月</h1>

          <div className="calendar-nav-buttons">
            <button onClick={handlePrevMonth} className="nav-btn" aria-label="前の月">◀</button>
            <button onClick={handleNextMonth} className="nav-btn" aria-label="次の月">▶</button>
          </div>
        </div>
        
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

                {eventMap?.[dateKey]  && (
                      <p className="event-title">{eventMap[dateKey].title}</p>

                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="todo-container">
        <h2>TODO list</h2>
        <ul className="todo-list-container">
          <li>ワカサギ釣り：　　1000円支払いお願いします。</li>
          <li>投票: スポーツ大会　　　 残り8日!</li>
        </ul>
      </div>

      <div className="anonymous-opinion-container">
        <h2 className="anonymous-title">匿名意見箱</h2>
        
        <div className="anonymous-form">
          <textarea
            placeholder="  行きたい場所・やりたいこと・意見等何でも書いてね"
            value={opinion}
            rows={5}
            onChange={(e)=>{setOpinion(e.target.value)}}
          >
          </textarea>

          <button onClick={sendMessage}>送信</button>
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