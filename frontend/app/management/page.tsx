"use client"

import React, { useState, useEffect } from "react";
import { CSVRow, MemberInfo } from "../utils/schema"
import Papa from 'papaparse';
import "./management.css";

export default function Management() {
    const [name, setName] = useState("");
    const [role, setRole] = useState("なし");
    const [members, setMembers] = useState<MemberInfo[]>([]);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [passwordInput, setPasswordInput] = useState("");

    const getMembers = async () => {
        try{
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/getMembers`);
        
            const data = await res.json();

            console.log(data);
        } catch (e: any) {
            alert(`Failed to connect: ${e}`);
        }
    };

    const handlePasswordSubmit = (e: React.SubmitEvent) => {
        e.preventDefault();

        if(passwordInput === "24S4014") {
            setIsAuthorized(true);
        } else {
            alert("The password is wrong");
            setPasswordInput("");
        }
    };

    const updateMembers = async (currentMembers: MemberInfo[]) => {
        try{
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/updateMembers`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(currentMembers),
                credentials: "include",
            });
            
            if(!res.ok){
                alert("Update failed")
            }

        } catch(error: any) {
            alert(`failed to connect: ${error}`);
            return;
        };
    };

    const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(!file) return;

        if (!window.confirm("本当に変更しますか？学籍番号と名前が一致している行は全て反映されます。")) return;

        Papa.parse<CSVRow>(file, {
            header: true,
            skipEmptyLines: true,
            quoteChar: '"',
            escapeChar: '"',
            encoding: 'SJIS',
            complete: (results) => {

                console.log("データ: ", results.data);
                const hasInvalidMember = results.data.some((row) => !row['名前']);

                if(hasInvalidMember) {
                    alert("名前がない欄があります。");
                    return;
                }

                const parsedMembers = results.data.map((row, index) => {
                    return {
                        student_id: row['学籍番号'], 
                        name: row['名前'],
                        role: row['役職'] || '',
                    }
                });

                setMembers(parsedMembers);

                updateMembers(parsedMembers);
            },
            error: (error: Error) => {
                alert("CSVの読み込みに失敗しました:" + error.message);
            }
        });
    };

    const handleCSVDownload = () => {
        if(members.length === 0) {
            alert("There are no exported datas");
            return;
        };

        const csvData = members.map((m, index) => ({
            '整理番号': index + 1,
            '学籍番号': m.student_id,
            '名前': m.name,
            '役職': m.role,
        }));

        const csvString = Papa.unparse(csvData);
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvString], {type: 'text/csv;charset=utf-8;'});

        // generate download link and click it
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('download', 'member_list.csv');
        document.body.appendChild(link);
        link.href = url;
        link.click();
        document.body.removeChild(link);
    };

    useEffect(() => {
        getMembers()
    }, []);

    return (
        <div className="container">
            {!isAuthorized && (
                <div className="auth-overlay">
                    <form className="auth-card" onSubmit={handlePasswordSubmit}>
                        <h2>管理画面ロック 🔒</h2>
                        <p>この画面にアクセスするには、管理者パスワードを入力して下さい。</p>

                        <input
                            type="password"
                            placeholder="Please type password" 
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            required
                        />
                        <button type="submit">認証解除</button>
                    </form>
                </div>
            )}



            <h1>管理画面(CSV連携版)</h1>

            {/* CSV file operation area */}
            <div className="csv-actions">              
                <label className="csv-label-btn">
                   📁 CSV import
                   <input type="file" accept=".csv" onChange={handleCSVUpload} />
                </label>
            
                <button className="csv-label-btn export-btn" onClick={handleCSVDownload}>
                    📥 CSV export
                </button>
            </div>

            {/*  メンバー構成 */}
            <div className="member-list-section">
                <h3>members list ({members.length} 名)</h3>

                {members.length === 0 ? (
                    <p className="empty-message">データがありません。CSVを読み込んで下さい。</p>
                ): (
                    <table className="member-table">
                        <thead>
                            <tr><th>学籍番号</th><th>名前</th><th>役職</th><th>ユーザ名</th></tr>
                        </thead>
                        <tbody>
                            {members.map((member, index) => (
                                <tr key={index}>
                                    <td>{member.student_id}</td>
                                    <td>{member.name}</td>
                                    <td><span className={`badge role-${member.role}`}>{member.role}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};