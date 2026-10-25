'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MoneyLogStruct, NewMoneyLog } from '../utils/schema';
import { backendURL, readErrorMessage } from '../utils/api';
import PaymentStatusCard from './PaymentStatusCard';
import { useToast } from '../../components/Toast';
import './account.css';

// 管理ページの「会計」：部費の収支と全部員の支払い状況。イベントの参加者・徴収はレシートページで扱う。
// 部費の収支はログインなしで誰でも見られる。管理の操作は権限のある人にだけ出す。
export default function AccountingSection({ role }: { role: string }) {
  const { showToast } = useToast();
  const [moneyLogs, setMoneyLogs] = useState<MoneyLogStruct[]>([]);
  const [totalSum, setTotalSum] = useState<number>(0);
  const [newLog, setNewLog] = useState<NewMoneyLog>({
    date: new Date().toISOString().split('T')[0],
    content: '',
    amount: '',
  });

  // 画面を出し分けるだけ。実際の権限チェックはサーバー側で行っている
  const canEditPayment = role === '会計' || role === '部長';
  // 副部長は会計の画面を見るだけで、操作はできない
  const canView = canEditPayment || role === '副部長';
  const year = new Date().getFullYear();

  // 会計情報を取得
  const getAccountInfo = useCallback(async () => {
    try {
      const res = await fetch(`${backendURL}/api/accountInfo?year=${year}`);

      if (!res.ok) {
        showToast(await readErrorMessage(res, '会計情報の取得に失敗'), 'error');
        return;
      }

      const data: MoneyLogStruct[] = (await res.json()) ?? [];
      setMoneyLogs(data);
    } catch (e) {
      console.error('failed to getAccountInfo:', e);
      showToast('通信に失敗しました。', 'error');
    }
  }, [showToast, year]);

  // 合計金額を取得
  const getMoneySum = useCallback(async () => {
    try {
      const res = await fetch(`${backendURL}/api/getMoneySum`);

      if (!res.ok) {
        showToast(await readErrorMessage(res, '残高の取得に失敗'), 'error');
        return;
      }

      const data: number = await res.json();
      setTotalSum(data ?? 0);
    } catch (e) {
      console.error('failed to getMoneySum:', e);
      showToast('通信に失敗。', 'error');
    }
  }, [showToast]);

  // 会計ログを追加
  const addAccountLog = async () => {
    if (!newLog.content || !newLog.amount || newLog.amount === '-') {
      showToast('内容と金額を入力してください。', 'error');
      return;
    }

    try {
      const res = await fetch(`${backendURL}/api/addMoneyLog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newLog, amount: Number(newLog.amount) }),
        credentials: 'include',
      });

      if (!res.ok) {
        showToast(await readErrorMessage(res, '追加できませんでした。'), 'error');
        return;
      }

      await getAccountInfo();
      await getMoneySum();
      setNewLog({ ...newLog, content: '', amount: '' });
      showToast('追加しました。', 'success');
    } catch (e) {
      console.error('failed to add account log:', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  // 会計ログを削除
  const deleteMoneyLog = async (oneMoneyLog: MoneyLogStruct) => {
    try {
      const res = await fetch(`${backendURL}/api/deleteMoneyLog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 同日・同額・同内容の行を巻き添えにしないよう id で指定する
        body: JSON.stringify({ id: oneMoneyLog.id }),
        credentials: 'include',
      });

      if (!res.ok) {
        showToast(await readErrorMessage(res, '削除に失敗しました。'), 'error');
        return;
      }

      await getAccountInfo();
      await getMoneySum();
      showToast('削除しました。', 'success');
    } catch (error) {
      console.error('failed to delete money log:', error);
      showToast('通信に失敗しました。', 'error');
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。同期的な連鎖レンダリングは起きない。
    getAccountInfo();
    getMoneySum();
  }, [getAccountInfo, getMoneySum]);

  return (
    <div className="account-container max-w-6xl mx-auto px-4 py-8">
      <div className={`main-grid grid lg:grid-cols-3 gap-8${canView ? '' : ' main-grid-single'}`}>
        {/* 管理エリア(会計・役員のみ) */}
        {canView && (
          <div className="space-y-6">
            <PaymentStatusCard canEdit={canEditPayment} />
          </div>
        )}

        {/* 会計エリア */}
        <div className="space-y-6">
          {/* 履歴リスト */}
          <div className="card p-6">
            <h3 className="text-xl font-bold text-forest-800 mb-4">
              部費 <span className="ml-2 text-base font-semibold text-forest-600">残高 ￥{totalSum.toLocaleString()}</span>
            </h3>
            <div className="space-y-3 history-list max-h-96 overflow-y-auto">
              {[...moneyLogs].reverse().map((oneMoneyLog) => {
                const isPlus = Number(oneMoneyLog.amount) > 0;
                return (
                  <div key={oneMoneyLog.id} className="history-item flex items-center gap-3 p-3 bg-earth-50 rounded-lg border border-earth-200">
                    {canEditPayment && (
                      <button
                        onClick={() => {
                          if (window.confirm(`「${oneMoneyLog.content}」の履歴を削除しますか？`)) {
                            deleteMoneyLog(oneMoneyLog);
                          }
                        }}
                        className="btn-history-delete w-8 h-8 flex-shrink-0 rounded-lg bg-red-100 hover:bg-red-200 flex items-center justify-center"
                      >
                        <img src="/trash.svg" alt="削除" className="w-4 h-4" />
                      </button>
                    )}
                    <div className="history-content-wrap flex-1 min-w-0">
                      <div className="history-header-row flex items-center justify-between gap-2">
                        <span className="text-sm text-earth-600 font-medium">{oneMoneyLog.date}</span>
                        <span className={`font-bold ${isPlus ? 'text-green-600' : 'text-red-600'}`}>
                          {isPlus ? '▲ ' : '▼ '}
                          {Math.abs(Number(oneMoneyLog.amount)).toLocaleString()}円
                        </span>
                      </div>
                      <p className="text-forest-800 font-medium truncate">{oneMoneyLog.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 新規追加フォーム(会計・部長のみ) */}
          {canEditPayment && (
          <div className="card p-6">
            <div className="money-form-head">
              <h3 className="text-xl font-bold text-forest-800">部費：支出・収益</h3>
              <button
                type="button"
                onClick={addAccountLog}
                aria-label="追加"
                className="money-form-add"
              >
                ＋
              </button>
            </div>
            <div className="money-form-grid">
              <input
                type="date"
                value={newLog.date}
                onChange={(e) => setNewLog({ ...newLog, date: e.target.value })}
                className="input-field"
              />
              <input
                type="text"
                placeholder="金額(出金は'-'を付ける)"
                inputMode="numeric"
                value={newLog.amount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || val === '-') {
                    setNewLog({ ...newLog, amount: val });
                    return;
                  }
                  const num = Number(val);
                  if (!isNaN(num)) {
                    setNewLog({ ...newLog, amount: num });
                  }
                }}
                onFocus={(e) => e.target.select()}
                className="input-field"
              />
              <input
                type="text"
                placeholder="内容（例：熊スプレー購入）"
                value={newLog.content}
                onChange={(e) => setNewLog({ ...newLog, content: e.target.value })}
                className="input-field money-form-wide"
              />
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
