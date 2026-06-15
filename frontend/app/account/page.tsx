'use client';

import React, { useState, useEffect } from 'react';
import { ReceiptDataStruct, MoneyLogStruct } from '../utils/schema';
import "./account.css"

// 会計ページ：部費の管理とレシートのアップロード機能を提供
export default function Account() {
  const [moneyLogs, setMoneyLogs] = useState<MoneyLogStruct[]>([]);
  const [totalSum, setTotalSum] = useState<number>(0);
  const [receiptDatas, setReceiptDatas] = useState<ReceiptDataStruct[]>([]);
  const [fullScreenImg, setFullScreenImg] = useState<string | null>(null);
  const [receiptModal, setReceiptModal] = useState<ReceiptDataStruct | null>(null);
  const [newLog, setNewLog] = useState<Omit<MoneyLogStruct, 'amount'> & { amount: number | string }>({
    date: new Date().toISOString().split('T')[0],
    content: '',
    amount: '',
  });

  const backendURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const year = new Date().getFullYear();
  const howLongWeek = 2;

  // レシート情報を取得
  const getReceipts = async () => {
    try {
      const res = await fetch(`${backendURL}/getReceiptsInfo?howLongMonth=${howLongWeek}`);
      const data = await res.json();

      const formattedData: ReceiptDataStruct[] = data.map((item: any) => ({
        ID: item.id,
        Title: item.title,
        Date: item.date.split('T')[0],
        ImageURLs: item.images || [],
      }));

      setReceiptDatas(formattedData);
    } catch (e) {
      console.error('failed to getReceipts:', e);
      alert('通信に失敗しました。');
    }
  };

  // 会計情報を取得
  const getAccountInfo = async () => {
    try {
      const res = await fetch(`${backendURL}/accountInfo?year=${year}`);
      const data = await res.json();
      setMoneyLogs(data || []);
    } catch (e) {
      console.error('failed to getAccountInfo:', e);
      alert('通信に失敗しました。');
    }
  };

  // 合計金額を取得
  const getMoneySum = async () => {
    try {
      const res = await fetch(`${backendURL}/getMoneySum`);
      const data = await res.json();
      setTotalSum(data);
    } catch (e) {
      console.error('failed to getMoneySum:', e);
      alert('通信に失敗しました。');
    }
  };

  // 会計ログを追加
  const addAccountLog = async () => {
    if (!newLog.content || !newLog.amount || newLog.amount === '-') {
      alert('内容と金額を入力してください');
      return;
    }

    try {
      const res = await fetch(`${backendURL}/addMoneyLog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLog),
        credentials: 'include',
      });

      if (res.ok) {
        getAccountInfo();
        getMoneySum();
        setNewLog({ ...newLog, content: '', amount: '' });
      } else {
        alert('追加できませんでした。会計権限のユーザのみが可能です。');
      }
    } catch (e) {
      console.error('failed to add account log:', e);
      alert('通信に失敗しました。');
    }
  };

  // ファイルアップロード処理
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, eventID: number) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    formData.append('eventID', String(eventID));

    for (let i = 0; i < files.length; i++) {
      formData.append('images', files[i]);
    }

    try {
      const res = await fetch(`${backendURL}/uploadReceipt`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        alert('画像のアップロードに失敗しました。');
        return;
      }

      await getReceipts();
    } catch (e) {
      alert('画像のアップロードに失敗しました。');
    }
  };

  // 会計ログを削除
  const deleteMoneyLog = async (oneMoneyLog: MoneyLogStruct) => {
    try {
      const res = await fetch(`${backendURL}/deleteMoneyLog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(oneMoneyLog),
        credentials: 'include',
      });

      if (!res.ok) {
        alert('Failed to fetch');
        return;
      }

      await getAccountInfo();
      await getMoneySum();
    } catch (error) {
      alert('failed to delete image');
    }
  };

  // 画像を削除
  const deleteImage = async (date: string, url: string) => {
    try {
      const res = await fetch(`${backendURL}/deleteImage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, url }),
        credentials: 'include',
      });

      if (!res.ok) {
        alert('Failed to fetch');
        return;
      }

      setReceiptModal((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          ImageURLs: prev.ImageURLs.filter((imgUrl) => imgUrl !== url),
        };
      });

      setReceiptDatas((prev) =>
        prev.map((item) => {
          if (item.Date === date.split('T')[0]) {
            return {
            ...item,
            ImageURLs: item.ImageURLs.filter((imgUrl) => imgUrl !== url),
          };
        }
        return item;
      })
    );

      await getReceipts();
    } catch (error) {
      alert('failed to delete image');
    }
  };

  useEffect(() => {
    getAccountInfo();
    getMoneySum();
    getReceipts();
  }, []);

  return (
    <div className="account-container max-w-6xl mx-auto px-4 py-8">
      <div className="main-grid grid lg:grid-cols-3 gap-8">
        {/* レシートエリア */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="text-2xl font-bold text-forest-800 mb-6">レシート管理</h2>
            <div className="receipt-grid grid md:grid-cols-2 gap-4">
              {receiptDatas.map((event, index) => (
                <div key={index} className="receipt-item-card bg-earth-50 rounded-xl p-5 border border-earth-200">
                  <div className="receipt-card-top flex items-start justify-between mb-3">
                    <div>
                      <span className="text-sm text-earth-600 font-medium">{event.Date}</span>
                      <h3 className="text-lg font-bold text-forest-800">{event.Title}</h3>
                    </div>
                    <span className="badge-count px-3 py-1 bg-forest-100 text-forest-700 text-sm rounded-full font-medium">
                      {event.ImageURLs.length}枚
                    </span>
                  </div>
                  <div className="flex-actions flex gap-2">
                    <label className="flex-1">
                      <div className="btn-add-image w-full px-4 py-2 bg-forest-600 text-white text-center rounded-lg font-medium cursor-pointer hover:bg-forest-700 transition-all">
                        画像を追加
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFileChange(e, event.ID)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setReceiptModal(event)}
                      className="btn-view-receipt flex-1 px-4 py-2 bg-earth-200 text-forest-800 rounded-lg font-medium hover:bg-earth-300 transition-all"
                    >
                      レシートを見る
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* レシートモーダル */}
          {receiptModal && (
            <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setReceiptModal(null)}>
              <div className="modal-content bg-earth-50 rounded-2xl p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-forest-800">
                    {receiptModal.Title} ({receiptModal.Date})
                  </h3>
                  <button
                    onClick={() => setReceiptModal(null)}
                    className="btn-close-modal text-earth-600 hover:text-forest-800 text-2xl"
                  >
                    ×
                  </button>
                </div>
                {receiptModal.ImageURLs.length === 0 ? (
                  <p className="modal-empty-text text-center text-earth-600 py-8">登録されているレシート画像はありません。</p>
                ) : (
                  <div className="image-thumbnail-grid grid md:grid-cols-2 gap-4">
                    {receiptModal.ImageURLs.map((url, idx) => (
                      <div key={idx} className="image-wrapper relative group">
                        <img
                          src={`${backendURL}${url}`}
                          alt="receipt"
                          className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-all"
                          onClick={() => setFullScreenImg(url)}
                        />
                        <button
                          className="btn-delete-image absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('写真を削除しますか？')) {
                              deleteImage(receiptModal.Date, url);
                            }
                          }}
                        >
                          <img src="/trash.svg" alt="削除" className="icon-trash w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* フルスクリーン画像 */}
          {fullScreenImg && (
            <div className="fullscreen-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/90" onClick={() => setFullScreenImg(null)}>
              <img
                src={`${backendURL}${fullScreenImg}`}
                alt="receiptImg"
                className="fullscreen-image max-w-[90vw] max-h-[90vh] object-contain"
              />
            </div>
          )}
        </div>

        {/* 会計エリア */}
        <div className="space-y-6">
          {/* 残高カード */}
          <div className="card p-6 balance-card bg-gradient-to-br from-forest-600 to-forest-800">
            <p className="text-earth-100 text-lg mb-2">現在の部費残高</p>
            <p className="text-4xl font-bold text-white">
              ￥{totalSum.toLocaleString()}
            </p>
          </div>

          {/* 履歴リスト */}
          <div className="card p-6">
            <h3 className="text-xl font-bold text-forest-800 mb-4">部費</h3>
            <div className="space-y-3 history-list max-h-96 overflow-y-auto">
              {[...moneyLogs].reverse().map((oneMoneyLog, index) => {
                const isPlus = Number(oneMoneyLog.amount) > 0;
                return (
                  <div key={index} className="history-item flex items-center gap-3 p-3 bg-earth-50 rounded-lg border border-earth-200">
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

          {/* 新規追加フォーム */}
          <div className="card p-6">
            <h3 className="text-xl font-bold text-forest-800 mb-4">部費：支出・収益</h3>
            <div className="space-y-3">
              <input
                type="date"
                value={newLog.date}
                onChange={(e) => setNewLog({ ...newLog, date: e.target.value })}
                className="input-field"
              />
              <input
                type="text"
                placeholder="内容（例：熊スプレー購入）"
                value={newLog.content}
                onChange={(e) => setNewLog({ ...newLog, content: e.target.value })}
                className="input-field"
              />
              <input
                type="text"
                placeholder="金額(出金の場合は'-'をつけて)"
                inputMode="numeric"
                value={newLog.amount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || val === '-') {
                    setNewLog({ ...newLog, amount: val as any });
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
              <button onClick={addAccountLog} className="btn-primary w-full">
                追加
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
