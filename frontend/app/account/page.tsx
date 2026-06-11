"use client";

import React, { useState, useEffect } from "react";
import   "./account.css";
import { ReceiptDataStruct, MoneyLogStruct } from "../utils/schema"

export default function Account (){
    const [moneyLogs, setMoneyLogs] = useState<MoneyLogStruct[]>([]);
    const [totalSum, setTotalSum] = useState<number>(0);
    const [receiptDatas, setReceiptDatas] = useState<ReceiptDataStruct[]>([]);
    const [fullScreenImg, setFullScreenImg] = useState<string | null>(null);
    const [receiptModal, setReceiptModal] = useState<any | null>(null);
    const [newLog, setNewLog] = useState<Omit<MoneyLogStruct, "amount"> & {amount: number | string}>({
        date: new Date().toISOString().split("T")[0],
        content: "",
        amount: ""
    });

    const backendURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
    const year = new Date().getFullYear();
    const howLongWeek = 2;

    const getReceipts = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/getReceiptsInfo?howLongMonth=${howLongWeek}`);
            const data = await res.json();

            const formattedData: ReceiptDataStruct[] = data.map((item: any) => ({
                ID: item.id,
                Title: item.title,
                Date: item.date.split("T")[0],
                ImageURLs: item.images || []
            }));

            setReceiptDatas(formattedData);
        } catch (e) {
            console.error("failed to getReceipts:", e);
            alert("通信に失敗しました。");
        };
    };

    const getAccountInfo = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/accountInfo?year=${year}`);
            const data = await res.json();
            setMoneyLogs(data || []);
        } catch (e) {
            console.error("failed to getAccountInfo:", e)
            alert("通信に失敗しました。")
        };
    };

    const getMoneySum = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/getMoneySum`);
            const data = await res.json();
            setTotalSum(data);
        } catch (e) {
            console.error("failed to getMoneySum:", e)
            alert("通信に失敗しました。")
        };
    };

    const addAccountLog = async () => {
        if(!newLog.content || !newLog.amount || newLog.amount === "-"){
            alert("内容と金額を入力してください");
            return;
        };

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/addMoneyLog`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(newLog),
                credentials: "include",
            });

            if(res.ok){
                getAccountInfo();
                getMoneySum();
                setNewLog({...newLog, content: "", amount: ""})
            }else{
                alert("追加できませんでした。会計権限のユーザのみが可能です。");
            }
        } catch (e) {
            console.error("failed to add account log:", e)
            alert("通信にしっぱいしました。")
        }
        
    };

    const handleFileChange= async (e: React.ChangeEvent<HTMLInputElement>, eventID: number) => {
        const files = e.target.files;
        if(!files || files.length === 0) return;

        const formData = new FormData();
        formData.append("eventID", String(eventID));

        for(let i=0; i < files.length; i++){
            formData.append("images", files[i]);
        }
        console.log(formData.getAll("images"));

        try{
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/uploadReceipt`, {
                method: "POST",
                body: formData,
            });

            if(!res.ok){
                alert("画像のアップロードに失敗しました。");
                return;
            }

            await getReceipts();

        } catch (e) {
            alert("画像のアップロードに失敗しました。")
        }
    };        

    const deleteMoneyLog = async (oneMoneyLog: MoneyLogStruct) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/deleteMoneyLog`, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(oneMoneyLog),
                credentials: "include"
            });

            if(!res.ok){
                alert("Failed to fetch");
                return;
            };

            const date = oneMoneyLog.date;
            const content = oneMoneyLog.content;

            setMoneyLogs(prevLogs => {
                return  prevLogs.filter((log: MoneyLogStruct) => log.content !== content && log.date !== date)
            })

            await getAccountInfo();
            await getMoneySum();

        } catch(error) {
            alert("failed to delete image");
        };
    };

    const deleteImage = async (date: string, url: string) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/deleteImage`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ "date": date, "url": url}),
                credentials: "include"      
            });

            if(!res.ok){
                alert("Failed to fetch");
                return;
            };

            setReceiptModal((prevModal: any)=> {
                if(!prevModal || !prevModal.ImageURLs) return prevModal;
                return {
                    ...prevModal,
                    ImageURLs: prevModal.ImageURLs.filter((imgURL: any) => imgURL !== url)
                }
            })

            setReceiptDatas((prevDatas) => 
                prevDatas.map((item) => {
                    if(item.Date === date.split("T")[0]) {
                        return {
                            ...item,
                            ImageURLs: item.ImageURLs.filter((imgURL) => imgURL !== url)
                        };
                    }

                    return item;
                })
            )

        } catch(error) {
            alert("failed to delete image");
        };
    };

    const fetchTodos = async () => {
        try{
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/getTodos`, {
                method: "GET",
                credentials: "include",
            });

            const data = await res.json();

            console.log(data);

        } catch(error) {
            alert("Failed to connect");
            return;
        }
    };

    useEffect(()=>{
        getAccountInfo();
        getMoneySum();
        getReceipts()
    }, []);

    return (
        <div className="container">
            <div className="receipt-container">
                <div className="event-grid">
                    {
                        receiptDatas.map((event, index) => (
                            <div key={index} className="event-item">
                                <div className="event-info">
                                    <span className="event-date">{event.Date}</span>
                                    <p className="event-name">{event.Title}</p>
                                </div>

                                <div className="event-images">
                                    <label className="upload-button">
                                        画像を追加
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="file-input-hidden"
                                            onChange={(e)=> handleFileChange(e, event.ID)}
                                            hidden
                                        />
                                    </label>

                                    <button
                                        type="button"
                                        className="view-list-button"
                                        onClick={() => setReceiptModal(event)}
                                    >
                                        レシート ➔
                                        <span className="image-count">({event.ImageURLs.length}枚)</span>
                                    </button>

                                    {receiptModal && (
                                        <div className="receipt-modal-overlay" onClick={()=> setReceiptModal(null)}>
                                            <div className="receipt-modal-content" onClick={(e)=> e.stopPropagation()}>
                                                <h4>{receiptModal.Title} ({receiptModal.Date})</h4>

                                                {receiptModal.ImageURLs.length === 0 ? (
                                                    <p className="no-images-text">登録されているレシート画像はありません。</p>
                                                ): (
                                                    <div className="receipt-modal-grid">
                                                        {receiptModal.ImageURLs.map((url: string, idx: number) => (
                                                            <div key={idx} className="modal-img-wrapper">
                                                                <button className="delete-btn"
                                                                    onClick={() => {
                                                                        if(window.confirm("写真を削除しますか？")) {
                                                                            deleteImage(receiptModal.Date, url);
                                                                        };
                                                                    }}
                                                                >
                                                                    <img src="/trash.svg" alt="削除"/>
                                                                </button>
                                                                <img src={`${backendURL}${url}`} alt="receipt" className="modal-receipt-img" onClick={()=>setFullScreenImg(url)}/>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    }
                </div>

                {fullScreenImg && (
                    <div className="fullscreen-overlay" onClick={() => setFullScreenImg(null)}>
                        <img src={`${backendURL}${fullScreenImg}`} alt="receiptImg" className="fullscreen-image" />
                    </div>
                )}
            </div>


            <div className="balance-cards">
                <p>現在の部費残高:</p>
                <h1>￥{totalSum.toLocaleString()}</h1>
            </div>

            <ul className="history-list">
                {[...moneyLogs].reverse().map((oneMoneyLog, index)=> {
                    const isPlus = Number(oneMoneyLog.amount) > 0;
                    const statusClass = isPlus ? "text-plus" : "text-minus";
                    const displayAmount = isPlus
                        ? `▲  +${oneMoneyLog.amount.toLocaleString()}`
                        : `▼  -${Math.abs(Number(oneMoneyLog.amount)).toLocaleString()}`;

                    return (
                        <li key={index}>
                            <button className="delete-btn"
                                onClick={() => {
                                    if(window.confirm(`「${oneMoneyLog.content}」の履歴を削除しますか？`)) {
                                        deleteMoneyLog(oneMoneyLog);
                                    };
                                }}
                            >
                                <img src="/trash.svg" alt="削除"/>
                            </button>

                            <div className="history-item-content">
                                <span className="history-date">{oneMoneyLog.date}</span>
                                <span className="history-content">{oneMoneyLog.content}</span>
                                <span className={`history-amount ${statusClass}`}>
                                    {displayAmount}
                                </span>
                            </div>
                        </li>
                    );
                })}
            </ul>

            <div className="input-form">
                <input
                    type="date"
                    value={newLog.date}
                    required
                    onChange={(e)=> setNewLog({...newLog, date: e.target.value})}
                />
                <input
                    type="text"
                    placeholder="内容（例：熊スプレー購入）"
                    required
                    value={newLog.content}
                    onChange={(e)=> setNewLog({...newLog, content: e.target.value})}
                />
                <input
                    type="text"
                    placeholder="金額(出金の場合は'-'をつけて)"
                    inputMode="numeric"
                    pattern="\d*"
                    required
                    value={newLog.amount}
                    onChange={(e)=> {
                        const val = e.target.value;
                        if(val === "" || val === "-"){
                            setNewLog({...newLog, amount: val as any});
                            return;
                        }
                        const num = Number(val);
                        if(!isNaN(num)){
                            setNewLog({ ...newLog, amount: num });
                        }
                    }}
                    onFocus={(e) => e.target.select()}
                />

                <button onClick={addAccountLog}>+</button>
            </div>
        </div>
    );
};