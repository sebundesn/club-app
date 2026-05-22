"use client"

import { useState } from "react";
import { CSVRow, MemberInfo } from "../utils/schema"
import Papa from 'papaparse';
import "./management.css";

export default function Management() {
    const [name, setName] = useState("");
    const [role, setRole] = useState("なし");
    const [isDriver, setIsDriver] = useState(false);
    const [members, setMembers] = useState<MemberInfo[]>([]);

    const updateMembers = async () => {
        try{
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/updateMembers`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(members),
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
                        id: Date.now() + index,
                        name: row['名前'],
                        role: row['役職'] || '',
                        isDriver: row['運転可否'] === '可'
                    }
                });

                setMembers(parsedMembers);

                updateMembers();
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

        const csvData = members.map((m) => ({
            '名前': m.name,
            '役職': m.role,
            '運転可否': m.isDriver ? '可' : ''
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

    return (
        <div className="container">
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
                            <tr><th>名前</th><th>役職</th><th>運転</th></tr>
                        </thead>
                        <tbody>
                            {members.map((member) => (
                                <tr key={member.id}>
                                    <td>{member.name}</td>
                                    <td><span className={`badge role-${member.role}`}>{member.role}</span></td>
                                    <td>{member.isDriver ? "✅" : "❌"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};