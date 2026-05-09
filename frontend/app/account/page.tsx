"use client";

import {useState, useEffect} from "react";
import   "./account.css";

interface MoneyLogStruct {
    date: string;
    content: string;
    amount: number;
}

export default function account (){
    const [moneyLogs, setMoneyLogs] = useState<MoneyLogStruct[]>([]);
    const [totalSum, setTotalSum] = useState<number>(0);
    const [newLog, setNewLog] = useState<MoneyLogStruct>({
        date: new Date().toISOString().split("T")[0],
        content: "",
        amount: 0
    });

    const year = new Date().getFullYear();
    const getAccountInfo = async () => {
        const res = await fetch(`http://localhost:8080/accountInfo?year=${year}`);

        const data = await res.json();
        setMoneyLogs(data || []);
    };

    const getMoneySum = async () => {
        const res = await fetch(`http://localhost:8080/getMoneySum`);
        const data = await res.json();
        setTotalSum(data);
    };

    const addAccountLog = async () => {
        const res = await fetch(`http://localhost:8080/addMoneyLog`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(newLog),
        });

        if(res.ok){
            alert("adding success");
            getAccountInfo();
            getMoneySum();
            setNewLog({...newLog, content: "", amount: 0})
        }else{
            alert("adding failed!");
        }
    }

    useEffect(()=>{
        getAccountInfo();
        getMoneySum();
    }, []);

    return (
        <div className="container">
            <div className="recipt-upload">
                <ul>
                    <li>
                        <p className="event-name">アジャラ山</p>

                        <label className="upload-button">
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="file-input-hidden"
                            />
                        </label>
                    </li>

                    <li>
                        <p className="event-name">バーベキュー</p>
                    </li>
                    <li>
                        <p className="event-name">青森観光</p>
                    </li>
                </ul>
            </div>


            <div className="balance-cards">
                <p>現在の部費残高:  ￥{totalSum.toLocaleString()}</p>
            </div>

            <ul className="history-list">
                {moneyLogs.map((oneMoneyLog, index)=> (
                    <li key={index}>
                        <span className="history-date">{oneMoneyLog.date}</span>
                        <span className="history-content">{oneMoneyLog.content}</span>
                        <span className="history-amount">{oneMoneyLog.amount}</span>
                    </li>
                ))}
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
                    type="number"
                    placeholder="金額"
                    required
                    value={newLog.amount}
                    onChange={(e)=> setNewLog({...newLog, amount: Number(e.target.value)})}
                />

                <button onClick={addAccountLog}>追加</button>
            </div>
        </div>
    )
};