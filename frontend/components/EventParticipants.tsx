'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Select, { SelectInstance } from 'react-select';
import { EventMember, MemberOption } from '../app/utils/schema';
import { backendURL, readErrorMessage } from '../app/utils/api';
import { useToast } from './Toast';
import './eventParticipants.css';

/**
 * イベントの参加者と徴収額の欄。レシートページの各イベントで使う。
 * 参加者の保存は会計・部長・副部長、支払い済みの切り替えと徴収額の設定は canEdit(会計・部長)のときだけ出す。
 * 画面を出し分けるだけで、実際の権限チェックはサーバー側で行っている。
 */
export default function EventParticipants({ eventID, canEdit }: { eventID: number; canEdit: boolean }) {
  const { showToast } = useToast();
  const [isMembersMenuOpen, setIsMembersMenuOpen] = useState(false);
  const [allClubMembers, setAllClubMembers] = useState<MemberOption[]>([]);
  const [participants, setParticipants] = useState<EventMember[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<MemberOption[]>([]);
  const [feeInput, setFeeInput] = useState('');
  const selectRef = useRef<SelectInstance<MemberOption, true> | null>(null);

  // 現在の参加者を取得
  const fetchCurrentParticipants = useCallback(async () => {
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
  }, [eventID, showToast]);

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

  // 支払い済みの切り替え(会計・部長だけ)
  const setPaid = async (userID: number, paid: boolean) => {
    try {
      const res = await fetch(`${backendURL}/api/setPaid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventID, user_id: userID, paid }),
        credentials: 'include',
      });
      if (!res.ok) {
        showToast(await readErrorMessage(res, '更新に失敗しました。'), 'error');
        return;
      }
      await fetchCurrentParticipants();
    } catch (e) {
      console.error('failed to set paid:', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  // 徴収額の設定(会計・部長だけ)。支払い済みの人の請求額は変わらない。
  const saveFee = async () => {
    const fee = Number(feeInput);
    if (feeInput === '' || !Number.isInteger(fee) || fee < 0) {
      showToast('金額を正しく入力してください。', 'error');
      return;
    }
    try {
      const res = await fetch(`${backendURL}/api/setEventFee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventID, fee }),
        credentials: 'include',
      });
      if (!res.ok) {
        showToast(await readErrorMessage(res, '徴収額の設定に失敗しました。'), 'error');
        return;
      }
      await fetchCurrentParticipants();
      showToast('徴収額を設定しました。', 'success');
    } catch (e) {
      console.error('failed to set fee:', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  // 参加者を保存
  const takePartIn = async () => {
    try {
      const res = await fetch(`${backendURL}/api/takePartIn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventID,
          user_ids: selectedOptions.map((opt) => opt.value),
        }),
        credentials: 'include',
      });

      if (!res.ok) {
        showToast(await readErrorMessage(res, '参加者の保存に失敗しました。'), 'error');
        return;
      }

      setIsMembersMenuOpen(false);
      await fetchCurrentParticipants();
      showToast('参加者を保存しました。', 'success');
    } catch (e) {
      console.error('failed to save participants:', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。同期的な連鎖レンダリングは起きない。
    fetchCurrentParticipants();
    getAllClubMembers();
  }, [fetchCurrentParticipants, getAllClubMembers]);

  return (
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
                {canEdit && (
                  <label className="paid-label">
                    <input type="checkbox" checked={m.paid} onChange={(e) => setPaid(m.user_id, e.target.checked)} />{' '}
                    支払い済み
                  </label>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEdit && (
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

        <div className="participants-select">
          <Select
            ref={selectRef}
            isMulti
            instanceId={`participants-${eventID}`}
            name="members"
            options={allClubMembers}
            value={selectedOptions}
            onChange={(newValue) => setSelectedOptions([...newValue])}
            menuIsOpen={isMembersMenuOpen}
            onMenuClose={() => setIsMembersMenuOpen(false)}
            placeholder="メンバー検索"
            noOptionsMessage={() => '部員が見つかりません'}
            theme={(theme) => ({ ...theme, colors: { ...theme.colors, primary: '#15803d' } })}
          />
        </div>

        <div>
          <button type="button" className="btn-small btn-small-primary" onClick={takePartIn}>
            参加者を保存
          </button>
        </div>
      </div>
    </div>
  );
}
