'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EventMember, MemberOption } from '../app/utils/schema';
import { backendURL, readErrorMessage } from '../app/utils/api';
import { useToast } from './Toast';
import './eventParticipants.css';

type Filter = 'all' | 'unpaid' | 'paid';

// これより多いときだけ、未払い・支払い済みの絞り込みを出す
const FILTER_MIN = 6;

const yen = (n: number) => `${n.toLocaleString('ja-JP')}円`;

const fetchMembers = async (eventID: number): Promise<EventMember[]> => {
  const res = await fetch(`${backendURL}/api/fetchMembersAndPayment?event_id=${eventID}`, { credentials: 'include' });
  if (!res.ok) throw new Error(await readErrorMessage(res, '参加者の取得に失敗しました。'));
  return (await res.json()) ?? [];
};

/** 未払いの人の請求額でいちばん多いもの。今の徴収額として入力欄の初期値にする */
const currentFee = (members: EventMember[]) => {
  const counts = new Map<number, number>();
  for (const m of members) if (!m.paid) counts.set(m.amount, (counts.get(m.amount) ?? 0) + 1);
  let best: number | null = null;
  for (const [amount, n] of counts) if (best === null || n > counts.get(best)!) best = amount;
  return best;
};

/**
 * イベントの参加者と徴収額の欄。レシートページの各イベントで使う。
 * 連日のイベント(合宿など)は参加者を全日程で共通にするので、呼び出し側が初日の eventID を渡す。
 * 上に集金の進み具合、その下に参加者の一覧。支払い済みは行の右のボタンで切り替える。
 * 参加者の編集は会計・部長・副部長、支払い済みの切り替えと徴収額の設定は canEdit(会計・部長)のときだけ出す。
 * 画面を出し分けるだけで、実際の権限チェックはサーバー側で行っている。
 */
export default function EventParticipants({ eventID, canEdit }: { eventID: number; canEdit: boolean }) {
  const { showToast } = useToast();
  const [participants, setParticipants] = useState<EventMember[] | null>(null);
  const [allMembers, setAllMembers] = useState<MemberOption[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const [feeInput, setFeeInput] = useState('');
  const feeTouched = useRef(false);
  // 全員同じ金額か、人を選んで金額を付けるか(学年・グループで金額が違うとき)
  const [feeSame, setFeeSame] = useState(true);
  const [feeTargets, setFeeTargets] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    try {
      const data = await fetchMembers(eventID);
      setParticipants(data);
      // 入力中の値は上書きしない
      if (!feeTouched.current) {
        const fee = currentFee(data);
        setFeeInput(fee === null ? '' : String(fee));
        // 未払いの人の金額がばらばらなら、最初から人ごとの設定を開いておく
        setFeeSame(new Set(data.filter((m) => !m.paid).map((m) => m.amount)).size <= 1);
      }
    } catch (e) {
      console.error('failed to fetch event members:', e);
      showToast(e instanceof Error && e.message ? e.message : '通信に失敗しました。', 'error');
      setParticipants((p) => p ?? []);
    }
  }, [eventID, showToast]);

  const loadAllMembers = useCallback(async () => {
    try {
      const res = await fetch(`${backendURL}/api/getClubMembers`, { credentials: 'include' });
      if (!res.ok) {
        showToast(await readErrorMessage(res, '部員の取得に失敗しました。'), 'error');
        return;
      }
      setAllMembers((await res.json()) ?? []);
    } catch (e) {
      console.error('failed to get club members:', e);
      showToast('通信に失敗しました。', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。同期的な連鎖レンダリングは起きない。
    load();
    loadAllMembers();
  }, [load, loadAllMembers]);

  // 支払い済みの切り替え(会計・部長だけ)。押したらすぐ画面を変えて、失敗したら元に戻す
  const togglePaid = async (m: EventMember) => {
    const paid = !m.paid;
    const apply = (value: boolean) =>
      setParticipants((ps) => ps?.map((p) => (p.user_id === m.user_id ? { ...p, paid: value } : p)) ?? ps);
    apply(paid);
    try {
      const res = await fetch(`${backendURL}/api/setPaid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventID, user_id: m.user_id, paid }),
        credentials: 'include',
      });
      if (!res.ok) {
        apply(!paid);
        showToast(await readErrorMessage(res, '更新に失敗しました。'), 'error');
      }
    } catch (e) {
      apply(!paid);
      console.error('failed to set paid:', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  // 徴収額の設定(会計・部長だけ)。支払い済みの人の請求額は変わらない。
  // 全員同じならイベントの徴収額ごと変え、人ごとなら選んだ人の請求額だけ変える。
  const saveFee = async () => {
    const fee = Number(feeInput);
    if (feeInput === '' || !Number.isInteger(fee) || fee < 0) {
      showToast('金額を正しく入力してください。', 'error');
      return;
    }
    const userIDs = feeSame ? undefined : [...feeTargets];
    try {
      const res = await fetch(`${backendURL}/api/setEventFee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventID, fee, user_ids: userIDs }),
        credentials: 'include',
      });
      if (!res.ok) {
        showToast(await readErrorMessage(res, '徴収額の設定に失敗しました。'), 'error');
        return;
      }
      feeTouched.current = false;
      setFeeTargets(new Set());
      await load();
      showToast(userIDs ? `${userIDs.length}人の金額を${yen(fee)}にしました。` : `徴収額を${yen(fee)}にしました。`, 'success');
    } catch (e) {
      console.error('failed to set fee:', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  const startEdit = () => {
    setDraft(new Set(participants?.map((p) => p.user_id)));
    setEditing(true);
  };

  const toggleDraft = (id: number) =>
    setDraft((d) => {
      const next = new Set(d);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const saveParticipants = async () => {
    setSaving(true);
    try {
      // 支払い済みの人を外すと支払いの記録も消えるので、先に確かめる
      const removedPaid = (participants ?? []).filter((m) => m.paid && !draft.has(m.user_id)).map((m) => m.user_name);
      if (
        removedPaid.length > 0 &&
        !window.confirm(`支払い済みの人を外すと、支払いの記録も消えます。\n\n${removedPaid.join('\n')}\n\n外してよいですか？`)
      ) {
        return;
      }

      const res = await fetch(`${backendURL}/api/takePartIn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventID, user_ids: [...draft] }),
        credentials: 'include',
      });
      if (!res.ok) {
        showToast(await readErrorMessage(res, '参加者の保存に失敗しました。'), 'error');
        return;
      }

      setEditing(false);
      await load();
      showToast('参加者を保存しました。', 'success');
    } catch (e) {
      console.error('failed to save participants:', e);
      showToast('通信に失敗しました。', 'error');
    } finally {
      setSaving(false);
    }
  };

  const list = participants ?? [];
  const paidCount = list.filter((m) => m.paid).length;
  const total = list.reduce((n, m) => n + m.amount, 0);
  const collected = list.reduce((n, m) => n + (m.paid ? m.amount : 0), 0);
  const unpaidCount = list.length - paidCount;
  const shown = filter === 'all' ? list : list.filter((m) => m.paid === (filter === 'paid'));

  // 編集中: 今の参加者との差分
  const before = useMemo(() => new Set(participants?.map((p) => p.user_id)), [participants]);
  const added = [...draft].filter((id) => !before.has(id)).length;
  const removed = [...before].filter((id) => !draft.has(id)).length;
  const paidIDs = new Set(list.filter((m) => m.paid).map((m) => m.user_id));
  const unpaid = list.filter((m) => !m.paid);

  const toggleFeeTarget = (id: number) =>
    setFeeTargets((t) => {
      const next = new Set(t);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (editing) {
    return (
      <section className="ep" aria-label="参加者の編集">
        <div className="ep-head">
          <h2 className="ep-title">参加者を選ぶ</h2>
          <span className="ep-count">{draft.size}人</span>
        </div>

        {draft.size > 0 && (
          <div className="ep-pick-tools">
            <button type="button" className="ep-link" onClick={() => setDraft(new Set())}>
              選択をすべて外す
            </button>
          </div>
        )}

        <ul className="ep-pick-list">
          {allMembers.length === 0 && <li className="ep-empty">部員がいません</li>}
          {allMembers.map((m) => {
            const on = draft.has(m.value);
            return (
              <li key={m.value}>
                <button type="button" className={`ep-pick${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggleDraft(m.value)}>
                  <span className="ep-check" aria-hidden>
                    {on ? '✓' : ''}
                  </span>
                  <span className="ep-name">{m.label}</span>
                  {paidIDs.has(m.value) && <span className="ep-tag">支払い済み</span>}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="ep-editor-foot">
          <span className="ep-diff">
            {added === 0 && removed === 0
              ? '変更なし'
              : [added > 0 && `+${added}人`, removed > 0 && `−${removed}人`].filter(Boolean).join(' / ')}
          </span>
          <button type="button" className="ep-btn" onClick={() => setEditing(false)} disabled={saving}>
            キャンセル
          </button>
          <button
            type="button"
            className="ep-btn ep-btn-primary"
            onClick={saveParticipants}
            disabled={saving || (added === 0 && removed === 0)}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="ep" aria-label="参加者">
      <div className="ep-head">
        <h2 className="ep-title">参加者</h2>
        {participants && <span className="ep-count">{list.length}人</span>}
        <button type="button" className="ep-btn ep-btn-edit" onClick={startEdit} disabled={!participants}>
          {list.length === 0 ? '＋ 追加' : '編集'}
        </button>
      </div>

      {participants === null && <p className="ep-empty">読み込み中…</p>}

      {participants && list.length === 0 && (
        <div className="ep-empty">
          <p>まだ参加者がいません。</p>
          <button type="button" className="ep-btn ep-btn-primary" onClick={startEdit}>
            参加者を選ぶ
          </button>
        </div>
      )}

      {list.length > 0 && (
        <>
          {/* 集金の進み具合 */}
          <div className="ep-summary">
            <div className="ep-summary-nums">
              <span>
                支払い済み <b>{paidCount}</b>/{list.length}人
              </span>
              {total > 0 && (
                <span>
                  <b>{yen(collected)}</b> / {yen(total)}
                </span>
              )}
            </div>
            <div
              className="ep-bar"
              role="progressbar"
              aria-label="支払い済みの人数"
              aria-valuemin={0}
              aria-valuemax={list.length}
              aria-valuenow={paidCount}
            >
              <span style={{ width: `${(paidCount / list.length) * 100}%` }} />
            </div>
          </div>

          {list.length >= FILTER_MIN && (
            <div className="ep-filters" role="tablist" aria-label="絞り込み">
              {(
                [
                  ['all', 'すべて', list.length],
                  ['unpaid', '未払い', unpaidCount],
                  ['paid', '支払い済み', paidCount],
                ] as const
              ).map(([key, label, n]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={filter === key}
                  className={`ep-chip${filter === key ? ' on' : ''}`}
                  onClick={() => setFilter(key)}
                >
                  {label} {n}
                </button>
              ))}
            </div>
          )}

          <ul className="ep-list">
            {shown.length === 0 && <li className="ep-empty">{filter === 'paid' ? '支払い済みの人はいません' : '全員支払い済みです'}</li>}
            {shown.map((m) => (
              <li key={m.user_id} className={`ep-row${m.paid ? ' paid' : ''}`}>
                <span className="ep-name">{m.user_name}</span>
                <span className="ep-amount">{m.amount > 0 ? yen(m.amount) : '—'}</span>
                {canEdit ? (
                  <button
                    type="button"
                    className={`ep-paid${m.paid ? ' on' : ''}`}
                    aria-pressed={m.paid}
                    aria-label={`${m.user_name}を${m.paid ? '未払いに戻す' : '支払い済みにする'}`}
                    onClick={() => togglePaid(m)}
                  >
                    {m.paid ? '✓ 済み' : '未払い'}
                  </button>
                ) : (
                  <span className={`ep-paid ep-paid-static${m.paid ? ' on' : ''}`}>{m.paid ? '✓ 済み' : '未払い'}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {canEdit && participants && (
        <div className="ep-fee">
          <div className="ep-fee-head">
            <span className="ep-fee-label">徴収額</span>
            <label className="ep-fee-same">
              <input
                type="checkbox"
                checked={feeSame}
                onChange={(e) => {
                  setFeeSame(e.target.checked);
                  setFeeTargets(new Set());
                }}
              />
              <span>全員同じ金額</span>
            </label>
          </div>

          {/* 人ごと: 金額を付ける人を選ぶ。支払い済みの人は金額を変えないので出さない */}
          {!feeSame && (
            <>
              {unpaid.length === 0 ? (
                <p className="ep-hint">未払いの人がいません。</p>
              ) : (
                <>
                  <div className="ep-pick-tools">
                    <span className="ep-hint">金額を付ける人を選んでください</span>
                    <button
                      type="button"
                      className="ep-link"
                      onClick={() => setFeeTargets(feeTargets.size === unpaid.length ? new Set() : new Set(unpaid.map((m) => m.user_id)))}
                    >
                      {feeTargets.size === unpaid.length ? 'すべて外す' : 'すべて選ぶ'}
                    </button>
                  </div>
                  <ul className="ep-fee-list">
                    {unpaid.map((m) => (
                      <li key={m.user_id}>
                        <label className="ep-fee-member">
                          <input type="checkbox" checked={feeTargets.has(m.user_id)} onChange={() => toggleFeeTarget(m.user_id)} />
                          <span className="ep-name">{m.user_name}</span>
                          <span className="ep-amount">{m.amount > 0 ? yen(m.amount) : '—'}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          <div className="ep-fee-row">
            <input
              id={`fee-${eventID}`}
              type="number"
              inputMode="numeric"
              min={0}
              step={100}
              value={feeInput}
              placeholder="0"
              aria-label={feeSame ? '1人あたりの徴収額' : '選んだ人の金額'}
              onChange={(e) => {
                feeTouched.current = true;
                setFeeInput(e.target.value);
              }}
              className="ep-fee-input"
            />
            <span>円</span>
            <button
              type="button"
              className="ep-btn ep-btn-primary"
              onClick={saveFee}
              disabled={feeInput === '' || (!feeSame && feeTargets.size === 0)}
            >
              {feeSame ? (unpaidCount > 0 ? `未払いの${unpaidCount}人に反映` : '設定') : `選んだ${feeTargets.size}人に反映`}
            </button>
          </div>
          <p className="ep-hint">
            {feeSame
              ? 'あとから追加した参加者にもこの金額が付きます。支払い済みの人の金額は変わりません。'
              : '選んだ人の金額だけが変わります。あとから追加した参加者には「全員同じ金額」で最後に決めた金額が付きます。'}
          </p>
        </div>
      )}
    </section>
  );
}
