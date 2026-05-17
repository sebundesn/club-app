"use client";

import React, { useState, useEffect } from "react";
import   "./account.css";
import { ReceiptDataStruct, MoneyLogStruct } from "../utils/schema"

export default function Account (){
    const [moneyLogs, setMoneyLogs] = useState<MoneyLogStruct[]>([]);
    const [totalSum, setTotalSum] = useState<number>(0);
    const [receiptDatas, setReceiptDatas] = useState<ReceiptDataStruct[]>([]);
    const [newLog, setNewLog] = useState<Omit<MoneyLogStruct, "amount"> & {amount: number | string}>({
        date: new Date().toISOString().split("T")[0],
        content: "",
        amount: ""
    });

    const year = new Date().getFullYear();
    const howLongMonth = 1;

    const getReceipts = async () => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/getReceiptsInfo?howLongMonth=${howLongMonth}`);
            const data = await res.json();

            const formattedData: ReceiptDataStruct[] = data.map((item: any) => ({
                ID: item.id,
                Title: item.title,
                Date: item.date.split("T")[0],
                ImageURLs: item.images || []
            }));

            console.log(formattedData)
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
            });

            if(res.ok){
                alert("adding success");
                getAccountInfo();
                getMoneySum();
                setNewLog({...newLog, content: "", amount: ""})
            }else{
                alert("adding failed!");
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

        try{
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/uploadReceipt`, {
                method: "POST",
                body: formData,
            });

            if(!res.ok){
                console.error("failed for response for uploading files");
                alert("画像のアップロードに失敗しました。");
                return;
            }

            console.log("uploding succeeds");
            alert("uploading receipt succeeds");

            window.location.reload();

        } catch (e) {
            console.error("failed to upload receipts: ", e);
            alert("画像のアップロードに失敗しました。")
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
                <ul>
                    {
                        receiptDatas.map((event, index) => (
                            <li key={index} className="event-item">
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

                                    {event.ImageURLs.map((url, imgIndex) => (
                                        <img key={imgIndex} src={url} alt={`${event.Title}-${imgIndex}`} className="receipt-img"/>
                                    ))}
                                </div>
                            </li>
                        ))
                    }
                </ul>
            </div>


            <div className="balance-cards">
                <p>現在の部費残高:  ￥{totalSum.toLocaleString()}</p>
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
                            <span className="history-date">{oneMoneyLog.date}</span>
                            <span className="history-content">{oneMoneyLog.content}</span>
                            <span className={`history-amount ${statusClass}`}>
                                {displayAmount}
                            </span>
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

                <button onClick={addAccountLog}>追加</button>
            </div>
        </div>
    );
};