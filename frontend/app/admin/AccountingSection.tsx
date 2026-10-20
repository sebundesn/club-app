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
import PaymentStatusCard from './PaymentStatusCard';
import { useToast } from '../../components/Toast';
import './account.css';
import Select, { SelectInstance } from 'react-select';

// 直近何週間分のイベントを出すか（バックエンドの howLongWeek と同じ単位）
const HOW_LONG_WEEK = 4;

// 管理ページの「会計」：部費の収支、全部員の支払い状況、イベントの参加者・徴収額の管理。
// 部費の収支はログインなしで誰でも見られる。管理の操作は権限のある人にだけ出す。
export default function AccountingSection({ role }: { role: string }) {
  const { showToast } = useToast();
  const [moneyLogs, setMoneyLogs] = useState<MoneyLogStruct[]>([]);
  const [totalSum, setTotalSum] = useState<number>(0);
  const [receiptDatas, setReceiptDatas] = useState<ReceiptDataStruct[]>([]);
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
  const [feeInput, setFeeInput] = useState('');
  // 画面を出し分けるだけ。実際の権限チェックはサーバー側で行っている
  const canEditPayment = role === '会計' || role === '部長';
  // 副部長は会計の画面を見るだけで、操作はできない
  const canView = canEditPayment || role === '副部長';
  const year = new Date().getFullYear();
  const selectRef = useRef<SelectInstance<MemberOption, true> | null>(null);

  // 直近のイベント一覧を取得(会計・役員のみ)
  const getEvents = useCallback(async () => {
    try {
      const res = await fetch(`${backendURL}/api/getReceiptsInfo?howLongWeek=${HOW_LONG_WEEK}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        showToast(await readErrorMessage(res, 'イベントの取得に失敗しました。'), 'error');
        return;
      }

      const data: { id: number; title: string; date: string }[] = (await res.json()) ?? [];

      const formattedData: ReceiptDataStruct[] = data.map((item) => ({
        ID: item.id,
        Title: item.title,
        Date: item.date.split('T')[0],
        Images: [],
      }));

      setReceiptDatas(formattedData);
    } catch (e) {
      console.error('failed to getEvents:', e);
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

  // 支払い済みの切り替え(会計だけ)
  const setPaid = async (userID: number, paid: boolean) => {
    if (!receiptModal) return;
    try {
      const res = await fetch(`${backendURL}/api/setPaid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: receiptModal.ID, user_id: userID, paid }),
        credentials: 'include',
      });
      if (!res.ok) {
        showToast(await readErrorMessage(res, '更新に失敗しました。'), 'error');
        return;
      }
      await fetchCurrentParticipants(receiptModal.ID);
    } catch (e) {
      console.error('failed to set paid:', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  // 徴収額の設定(会計だけ)。支払い済みの人の請求額は変わらない。
  const saveFee = async () => {
    if (!receiptModal) return;
    const fee = Number(feeInput);
    if (feeInput === '' || !Number.isInteger(fee) || fee < 0) {
      showToast('金額を正しく入力してください。', 'error');
      return;
    }
    try {
      const res = await fetch(`${backendURL}/api/setEventFee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: receiptModal.ID, fee }),
        credentials: 'include',
      });
      if (!res.ok) {
        showToast(await readErrorMessage(res, '徴収額の設定に失敗しました。'), 'error');
        return;
      }
      await fetchCurrentParticipants(receiptModal.ID);
      showToast('徴収額を設定しました。', 'success');
    } catch (e) {
      console.error('failed to set fee:', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

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
  }, [getAccountInfo, getMoneySum]);

  useEffect(() => {
    if (!canView) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 同上
    getEvents();
  }, [canView, getEvents]);

  useEffect(() => {
    if (!receiptModal) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。同期的な連鎖レンダリングは起きない。
    fetchCurrentParticipants(receiptModal.ID);
    getAllClubMembers();
  }, [receiptModal, fetchCurrentParticipants, getAllClubMembers]);

  return (
    <div className="account-container max-w-6xl mx-auto px-4 py-8">
      <div className={`main-grid grid lg:grid-cols-3 gap-8${canView ? '' : ' main-grid-single'}`}>
        {/* 管理エリア(会計・役員のみ) */}
        {canView && (
          <div className="space-y-6">
            <PaymentStatusCard canEdit={canEditPayment} />

            <div className="card p-6">
              <h2 className="text-2xl font-bold text-forest-800 mb-2">イベントの参加者・徴収</h2>
              <p className="text-sm text-earth-600 mb-4">直近{HOW_LONG_WEEK}週間のイベントです。参加者と徴収額を設定します。</p>
              {receiptDatas.length === 0 ? (
                <p className="text-earth-600">イベントはありません。</p>
              ) : (
                <div className="space-y-3">
                  {receiptDatas.map((event) => (
                    <button
                      key={event.ID}
                      type="button"
                      onClick={() => setReceiptModal(event)}
                      className="event-pick-row"
                    >
                      <span className="text-sm text-earth-600 font-medium">{event.Date}</span>
                      <span className="text-forest-800 font-bold">{event.Title || '(無題)'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          {/* 参加者モーダル */}
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
                <div className="participants-panel">
                  <h4 className="participants-heading">👥 参加者</h4>

                  <div className="participants-list-container">
                    {participants.length === 0 ? (
                      <span>参加者はいません。</span>
                    ) : (
                      <ul>
                        {participants.map((m) => (
                          <li key={m.user_id}>
                            <span className="participant_name">{m.user_name}</span>
                            <span className="participant_amount">{m.amount}円</span>
                            {canEditPayment && (
                              <label className="paid-label">
                                <input
                                  type="checkbox"
                                  checked={m.paid}
                                  onChange={(e) => setPaid(m.user_id, e.target.checked)}
                                />{' '}
                                支払い済み
                              </label>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {canEditPayment && (
                    <div className="fee-row">
                      <span>徴収額(未払いの人に反映)</span>
                      <input
                        type="number"
                        min={0}
                        value={feeInput}
                        onChange={(e) => setFeeInput(e.target.value)}
                        className="fee-input"
                      />
                      <span>円</span>
                      <button type="button" className="btn-small" onClick={saveFee}>
                        設定
                      </button>
                    </div>
                  )}

                  <div className="participants-actions">
                    <div className="participants-toggle">
                      {/* participants addition section */}
                      <button
                        type="button"
                        className="btn-small"
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
                    <div className="participants-select">
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
                      <button type="button" className="btn-small btn-small-primary" onClick={takePartInButton}>
                        参加者を保存
                      </button>
                    </div>
                  </div>

                  <hr className="participants-divider" />
                </div>

              </div>
            </div>
          )}
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
