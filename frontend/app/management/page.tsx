'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CSVRow, MemberInfo } from '../utils/schema';
import { backendURL, readErrorMessage } from '../utils/api';
import { useToast } from '../../components/Toast';
import Papa from 'papaparse';
import './management.css';

// 部員情報を書き換えられるロール。実際の認可はサーバー側でも同じ判定をしている。
const MANAGEMENT_ROLES = ['部長', '副部長'];

// 管理ページ：メンバー管理とCSVのインポート/エクスポート機能を提供
export default function Management() {
  const { showToast } = useToast();
  const [members, setMembers] = useState<MemberInfo[]>([]);
  // 認可はサーバーのロール判定に一本化する。
  // 以前はクライアント側のパスワード比較だけで、パスワードはバンドルに埋め込まれていた。
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // メンバー情報を取得
  const getMembers = useCallback(async () => {
    try {
      const res = await fetch(`${backendURL}/getMembers`, {
        credentials: 'include',
      });

      if (!res.ok) {
        showToast(await readErrorMessage(res, '部員の取得に失敗しました。'), 'error');
        return;
      }

      const data: MemberInfo[] = (await res.json()) ?? [];
      setMembers(data);
    } catch (e) {
      console.error('failed to get members:', e);
      showToast('通信に失敗しました。', 'error');
    }
  }, [showToast]);

  // ログイン中のユーザーのロールを確認する
  const checkAuthorization = useCallback(async () => {
    try {
      const res = await fetch(`${backendURL}/checkAuth`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!res.ok) return;

      const data = await res.json();
      const authorized = Boolean(data.logged_in) && MANAGEMENT_ROLES.includes(data.role);
      setIsAuthorized(authorized);

      if (authorized) {
        await getMembers();
      }
    } catch (e) {
      console.error('failed to check authorization:', e);
    } finally {
      setIsChecking(false);
    }
  }, [getMembers]);

  // メンバー情報を更新
  const updateMembers = async (currentMembers: MemberInfo[]) => {
    try {
      const res = await fetch(`${backendURL}/updateMembers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentMembers),
        credentials: 'include',
      });

      if (!res.ok) {
        showToast(await readErrorMessage(res, '更新に失敗しました。'), 'error');
        return;
      }

      await getMembers();
      showToast('部員情報を更新しました。', 'success');
    } catch (error) {
      console.error('failed to update members:', error);
      showToast('通信に失敗しました。', 'error');
    }
  };

  // CSVインポート
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    if (!window.confirm('本当に変更しますか？学籍番号と名前が一致している行は全て反映されます。')) {
      input.value = '';
      return;
    }

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      quoteChar: '"',
      escapeChar: '"',
      encoding: 'SJIS',
      complete: (results) => {
        const hasInvalidMember = results.data.some((row) => !row['学生氏名']);

        if (hasInvalidMember) {
          showToast('名前が空欄の行があります。', 'error');
          input.value = '';
          return;
        }

        const parsedMembers = results.data.map((row) => ({
          student_id: row['学籍番号'],
          name: row['学生氏名'] || '',
          role: row['役職'] || '',
        }));
        setMembers(parsedMembers);
        updateMembers(parsedMembers);
        input.value = '';
      },
      error: (error: Error) => {
        console.error('failed to parse CSV:', error);
        showToast('CSVの読み込みに失敗しました。', 'error');
        input.value = '';
      },
    });
  };

  // CSVエクスポート
  const handleCSVDownload = () => {
    if (members.length === 0) {
      showToast('出力するデータがありません。', 'error');
      return;
    }

    const csvData = members.map((m, index) => ({
      '整理番号': index + 1,
      '学籍番号': m.student_id,
      '学生氏名': m.name,
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
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。同期的な連鎖レンダリングは起きない。
    checkAuthorization();
  }, [checkAuthorization]);

  if (isChecking) {
    return (
      <div className="management-container">
        <div className="card p-8">
          <p className="text-earth-600">確認しています...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="management-container">
        <div className="card p-8">
          <h1 className="text-3xl font-bold text-forest-800 mb-4">管理画面 🔒</h1>
          <p className="text-earth-700 mb-6">
            この画面は{MANAGEMENT_ROLES.join('・')}のみが利用できます。LINEでログインしてから開いてください。
          </p>
          <button className="btn-primary" onClick={() => { window.location.href = '/calendar'; }}>
            HOME へ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="management-container">
      <div className="card p-8">
        <h1 className="text-3xl font-bold text-forest-800 mb-8">管理画面</h1>

        {/* CSV操作エリア */}
        <div className="csv-action-row mb-8">
          <label className="flex-1">
            <div className="btn-csv-import">
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
            className="btn-accent flex-1"
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
            <div className="empty-state">
              <p className="text-earth-600 text-lg">データがありません。CSVを読み込んでください。</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="member-table">
                <thead className="table-thead-bg">
                  <tr>
                    <th className="text-left font-bold">学籍番号</th>
                    <th className="text-left font-bold">名前</th>
                    <th className="text-left font-bold">役職</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.student_id} className="table-row">
                      <td className="text-forest-800">{member.student_id}</td>
                      <td className="text-forest-800 font-medium">{member.name}</td>
                      <td>
                        {member.role && (
                          <span className="role-badge">
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
