'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ReceiptDataStruct,
  MoneyLogStruct,
  NewMoneyLog,
  MemberOption,
  EventMember,
} from '../utils/schema';
import { backendURL, readErrorMessage } from '../utils/api';
import { useToast } from '../../components/Toast';
import './account.css';
import Select, { SelectInstance } from 'react-select';

// 直近何週間分のレシートを表示するか（バックエンドの howLongWeek と同じ単位）
const HOW_LONG_WEEK = 2;

// 会計ページ：部費の管理とレシートのアップロード機能を提供
export default function Account() {
  const { showToast } = useToast();
  const [moneyLogs, setMoneyLogs] = useState<MoneyLogStruct[]>([]);
  const [totalSum, setTotalSum] = useState<number>(0);
  const [receiptDatas, setReceiptDatas] = useState<ReceiptDataStruct[]>([]);
  const [fullScreenImg, setFullScreenImg] = useState<string | null>(null);
  const [receiptModal, setReceiptModal] = useState<ReceiptDataStruct | null>(null);
  const [newLog, setNewLog] = useState<NewMoneyLog>({
    date: new Date().toISOString().split('T')[0],
    content: '',
    amount: '',
  });

  const [isMembersMenuOpen, setIsMembersMenuOpen] = useState(false);
  const [allClubMembers, setAllClubMembers] = useState<MemberOption[]>([]);
  const [participants, setParticipants] = useState<EventMember[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<MemberOption[]>([]);
  const year = new Date().getFullYear();
  const selectRef = useRef<SelectInstance<MemberOption, true> | null>(null);

  // レシート情報を取得
  const getReceipts = useCallback(async () => {
    try {
      const res = await fetch(`${backendURL}/api/getReceiptsInfo?howLongWeek=${HOW_LONG_WEEK}`);

      if (!res.ok) {
        showToast(await readErrorMessage(res, 'レシートの取得に失敗しました。'), 'error');
        return;
      }

      const data: { id: number; title: string; date: string; images: string[] | null }[] =
        (await res.json()) ?? [];

      const formattedData: ReceiptDataStruct[] = data.map((item) => ({
        ID: item.id,
        Title: item.title,
        Date: item.date.split('T')[0],
        ImageURLs: item.images || [],
      }));

      setReceiptDatas(formattedData);
    } catch (e) {
      console.error('failed to getReceipts:', e);
      showToast('通信に失敗しました。', 'error');
    }
  }, [showToast]);

  // 会計情報を取得
  const getAccountInfo = useCallback(async () => {
    try {
      const res = await fetch(`${backendURL}/api/accountInfo?year=${year}`);

      if (!res.ok) {
        showToast(await readErrorMessage(res, '会計情報の取得に失敗しました。'), 'error');
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
        showToast(await readErrorMessage(res, '残高の取得に失敗しました。'), 'error');
        return;
      }

      const data: number = await res.json();
      setTotalSum(data ?? 0);
    } catch (e) {
      console.error('failed to getMoneySum:', e);
      showToast('通信に失敗しました。', 'error');
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
      const res = await fetch(`${backendURL}/api/uploadReceipt`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        showToast(await readErrorMessage(res, '画像のアップロードに失敗しました。'), 'error');
        return;
      }

      await getReceipts();
      showToast('画像をアップロードしました。', 'success');
    } catch (err) {
      console.error('failed to upload receipt:', err);
      showToast('通信に失敗しました。', 'error');
    } finally {
      // 同じファイルを選び直せるように入力をリセットする
      e.target.value = '';
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

  // 画像を削除
  const deleteImage = async (eventID: number, url: string) => {
    try {
      const res = await fetch(`${backendURL}/api/deleteImage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventID, url }),
        credentials: 'include',
      });

      if (!res.ok) {
        showToast(await readErrorMessage(res, '画像の削除に失敗しました。'), 'error');
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
          if (item.ID === eventID) {
            return {
              ...item,
              ImageURLs: item.ImageURLs.filter((imgUrl) => imgUrl !== url),
            };
          }
          return item;
        }),
      );

      await getReceipts();
      showToast('画像を削除しました。', 'success');
    } catch (error) {
      console.error('failed to delete image:', error);
      showToast('通信に失敗しました。', 'error');
    }
  };

  // 現在の参加者を取得
  const fetchCurrentParticipants = useCallback(
    async (eventID: number) => {
      try {
        const res = await fetch(`${backendURL}/api/fetchMembersAndPayment?event_id=${eventID}`, {
          method: 'GET',
          credentials: 'include',
        });

        if (!res.ok) {
          showToast(await readErrorMessage(res, '参加者の取得に失敗しました。'), 'error');
          return;
        }

        const data: EventMember[] = (await res.json()) ?? [];

        setParticipants(data);
        // react-select は {value, label} を要求するので、ここで詰め替える
        setSelectedOptions(data.map((m) => ({ value: m.user_id, label: m.user_name })));
      } catch (e) {
        console.error('failed to fetch event members:', e);
        showToast('通信に失敗しました。', 'error');
      }
    },
    [showToast],
  );

  const getAllClubMembers = useCallback(async () => {
    try {
      const res = await fetch(`${backendURL}/api/getClubMembers`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!res.ok) {
        showToast(await readErrorMessage(res, '部員の取得に失敗しました。'), 'error');
        return;
      }

      const data: MemberOption[] = (await res.json()) ?? [];
      setAllClubMembers(data);
    } catch (e) {
      console.error('failed to get club members:', e);
      showToast('通信に失敗しました。', 'error');
    }
  }, [showToast]);

  //　button that preserve participants
  const takePartInButton = async () => {
    if (!receiptModal) return;

    try {
      const userIDs = selectedOptions.map((opt) => opt.value);

      const res = await fetch(`${backendURL}/api/takePartIn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: receiptModal.ID,
          user_ids: userIDs,
        }),
        credentials: 'include',
      });

      if (!res.ok) {
        showToast(await readErrorMessage(res, '参加者の保存に失敗しました。'), 'error');
        return;
      }

      setIsMembersMenuOpen(false);
      await fetchCurrentParticipants(receiptModal.ID);
      showToast('参加者を保存しました。', 'success');
    } catch (e) {
      console.error('failed to save participants:', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。同期的な連鎖レンダリングは起きない。
    getAccountInfo();
    getMoneySum();
    getReceipts();
  }, [getAccountInfo, getMoneySum, getReceipts]);

  useEffect(() => {
    if (!receiptModal) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。同期的な連鎖レンダリングは起きない。
    fetchCurrentParticipants(receiptModal.ID);
    getAllClubMembers();
  }, [receiptModal, fetchCurrentParticipants, getAllClubMembers]);

  return (
    <div className="account-container max-w-6xl mx-auto px-4 py-8">
      <div className="main-grid grid lg:grid-cols-3 gap-8">
        {/* レシートエリア */}
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-2xl font-bold text-forest-800 mb-6">レシート管理</h2>
            <div className="receipt-grid grid md:grid-cols-2 gap-4">
              {receiptDatas.map((event) => (
                <div key={event.ID} className="receipt-item-card bg-earth-50 rounded-xl p-5 border border-earth-200">
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
                        accept="image/jpeg,image/png"
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

                {/* participants section */}
                <div className="bg-white p-5 rounded-xl border border-earth-200 mb-6 shadow-sm">
                  <h4 className="text-lg font-bold text-forest-700 mb-3">👥 参加者</h4>

                  <div className="participants-list-container">
                    {participants.length === 0 ? (
                      <span>参加者はいません。</span>
                    ) : (
                      <ul>
                        {participants.map((m) => (
                          <li key={m.user_id}>
                            <span className="participant_name">{m.user_name}</span>
                            <span className="participant_amount">{m.amount}円</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex justify-between items-center gap-2 mb-3">
                    <div className="flex gap-2 text-xs">
                      {/* participants addition section */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsMembersMenuOpen(!isMembersMenuOpen);
                          if (!isMembersMenuOpen) {
                            //reactが反応するように、50ms待ってから検索窓にfocusするようにした
                            setTimeout(() => selectRef.current?.focus(), 50);
                          }
                        }}
                      >
                        {isMembersMenuOpen ? '▲ リストを閉じる' : '参加者を追加'}
                      </button>
                    </div>

                    {/* select box */}
                    <div className="mb-4">
                      <Select
                        ref={selectRef}
                        isMulti
                        name="members"
                        options={allClubMembers}
                        value={selectedOptions}
                        onChange={(newValue) => {
                          setSelectedOptions([...newValue]);
                        }}
                        menuIsOpen={isMembersMenuOpen}
                        onMenuClose={() => setIsMembersMenuOpen(false)}
                        placeholder="メンバー検索"
                        noOptionsMessage={() => '部員が見つかりません'}
                        theme={(theme) => ({
                          ...theme,
                          colors: {
                            ...theme.colors,
                            primary: '#15803d',
                          },
                        })}
                      />
                    </div>

                    {/* participants preservation button */}
                    <div>
                      <button type="button" onClick={takePartInButton}>
                        参加者を保存
                      </button>
                    </div>
                  </div>

                  <hr className="border-earth-200 mb-6" />
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
                          className="receipt-thumbnail w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-all"
                          onClick={() => setFullScreenImg(url)}
                        />
                        <button
                          className="btn-delete-image absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('写真を削除しますか？')) {
                              deleteImage(receiptModal.ID, url);
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
              {[...moneyLogs].reverse().map((oneMoneyLog) => {
                const isPlus = Number(oneMoneyLog.amount) > 0;
                return (
                  <div key={oneMoneyLog.id} className="history-item flex items-center gap-3 p-3 bg-earth-50 rounded-lg border border-earth-200">
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
