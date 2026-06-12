'use client';

import React, { useState, useEffect } from 'react';
import { CSVRow, MemberInfo } from '../../utils/schema';
import Papa from 'papaparse';

// 管理ページ：メンバー管理とCSVのインポート/エクスポート機能を提供
export default function Management() {
  const [name, setName] = useState('');
  const [role, setRole] = useState('なし');
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // メンバー情報を取得
  const getMembers = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/getMembers`);
      const data = await res.json();
      setMembers(data || []);
    } catch (e: any) {
      alert(`Failed to connect: ${e}`);
    }
  };

  // パスワード認証
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === `${process.env.NEXT_PUBLIC_MANAGEMENT_PASSWORD}`) {
      setIsAuthorized(true);
    } else {
      alert('The password is wrong');
      setPasswordInput('');
    }
  };

  // メンバー情報を更新
  const updateMembers = async (currentMembers: MemberInfo[]) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/updateMembers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentMembers),
        credentials: 'include',
      });

      if (!res.ok) {
        alert('Update failed');
      }
    } catch (error: any) {
      alert(`failed to connect: ${error}`);
    }
  };

  // CSVインポート
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('本当に変更しますか？学籍番号と名前が一致している行は全て反映されます。')) return;

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      quoteChar: '"',
      escapeChar: '"',
      encoding: 'SJIS',
      complete: (results) => {
        console.log('データ: ', results.data);
        const hasInvalidMember = results.data.some((row) => !row['名前']);

        if (hasInvalidMember) {
          alert('名前がない欄があります。');
          return;
        }

        const parsedMembers = results.data.map((row) => ({
          student_id: row['学籍番号'],
          name: row['名前'],
          role: row['役職'] || '',
        }));

        setMembers(parsedMembers);
        updateMembers(parsedMembers);
      },
      error: (error: Error) => {
        alert('CSVの読み込みに失敗しました:' + error.message);
      },
    });
  };

  // CSVエクスポート
  const handleCSVDownload = () => {
    if (members.length === 0) {
      alert('There are no exported datas');
      return;
    }

    const csvData = members.map((m, index) => ({
      '整理番号': index + 1,
      '学籍番号': m.student_id,
      '名前': m.name,
      '役職': m.role,
    }));

    const csvString = Papa.unparse(csvData);
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([bom, csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('download', 'member_list.csv');
    document.body.appendChild(link);
    link.href = url;
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    getMembers();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* パスワード認証モーダル */}
      {!isAuthorized && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-earth-50 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <h2 className="text-2xl font-bold text-forest-800 mb-4 text-center">
              管理画面ロック 🔒
            </h2>
            <p className="text-earth-700 mb-6 text-center">
              この画面にアクセスするには、管理者パスワードを入力してください。
            </p>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <input
                type="password"
                placeholder="Please type password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="input-field"
                required
              />
              <button type="submit" className="btn-primary w-full">
                認証解除
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="card p-8">
        <h1 className="text-3xl font-bold text-forest-800 mb-8">管理画面</h1>

        {/* CSV操作エリア */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <label className="flex-1">
            <div className="w-full px-6 py-4 bg-forest-600 text-white text-center rounded-xl font-medium cursor-pointer hover:bg-forest-700 transition-all flex items-center justify-center gap-2">
              📁 CSVインポート
            </div>
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
            />
          </label>
          <button
            onClick={handleCSVDownload}
            className="flex-1 btn-accent flex items-center justify-center gap-2"
          >
            📥 CSVエクスポート
          </button>
        </div>

        {/* メンバーリスト */}
        <div>
          <h2 className="text-xl font-bold text-forest-800 mb-4">
            メンバーリスト ({members.length}名)
          </h2>
          {members.length === 0 ? (
            <div className="text-center py-12 bg-earth-50 rounded-xl border-2 border-dashed border-earth-300">
              <p className="text-earth-600 text-lg">データがありません。CSVを読み込んでください。</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-earth-200">
              <table className="w-full">
                <thead className="bg-forest-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-forest-800 font-bold">学籍番号</th>
                    <th className="px-6 py-4 text-left text-forest-800 font-bold">名前</th>
                    <th className="px-6 py-4 text-left text-forest-800 font-bold">役職</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-earth-200">
                  {members.map((member, index) => (
                    <tr key={index} className="hover:bg-earth-50 transition-all">
                      <td className="px-6 py-4 text-forest-800">{member.student_id}</td>
                      <td className="px-6 py-4 text-forest-800 font-medium">{member.name}</td>
                      <td className="px-6 py-4">
                        {member.role && (
                          <span className="px-3 py-1 bg-earth-200 text-earth-800 text-sm rounded-full font-medium">
                            {member.role}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
