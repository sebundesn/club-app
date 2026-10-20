'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MemberPayment } from '../utils/schema';
import { backendURL, readErrorMessage } from '../utils/api';
import { useToast } from '../../components/Toast';

const yen = (n: number) => `${n.toLocaleString()}円`;

interface MemberRow {
  userID: number;
  name: string;
  items: MemberPayment[];
  unpaidTotal: number;
}

/** 管理画面の「全部員の支払い状況」。会計・部長・副部長だけが見られる。支払い済みの切り替えは canEdit のときだけ。 */
export default function PaymentStatusCard({ canEdit }: { canEdit: boolean }) {
  const { showToast } = useToast();
  const [rows, setRows] = useState<MemberPayment[] | null>(null);
  const [onlyUnpaid, setOnlyUnpaid] = useState(true);
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${backendURL}/api/allPayments`, { credentials: 'include' });
      if (!res.ok) {
        showToast(await readErrorMessage(res, '支払い状況の取得に失敗しました。'), 'error');
        return;
      }
      setRows((await res.json()) ?? []);
    } catch (e) {
      console.error('failed to load payments:', e);
      showToast('通信に失敗しました。', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。
    load();
  }, [load]);

  const setPaid = async (p: MemberPayment, paid: boolean) => {
    try {
      const res = await fetch(`${backendURL}/api/setPaid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: p.event_id, user_id: p.user_id, paid }),
        credentials: 'include',
      });
      if (!res.ok) {
        showToast(await readErrorMessage(res, '更新に失敗しました。'), 'error');
        return;
      }
      await load();
    } catch (e) {
      console.error('failed to set paid:', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  const members = useMemo<MemberRow[]>(() => {
    const byUser = new Map<number, MemberRow>();
    for (const p of rows ?? []) {
      let m = byUser.get(p.user_id);
      if (!m) {
        m = { userID: p.user_id, name: p.user_name, items: [], unpaidTotal: 0 };
        byUser.set(p.user_id, m);
      }
      m.items.push(p);
      if (!p.paid) m.unpaidTotal += p.amount;
    }
    // 未払いの多い人を上に。同額なら名前順
    return [...byUser.values()].sort((a, b) => b.unpaidTotal - a.unpaidTotal || a.name.localeCompare(b.name, 'ja'));
  }, [rows]);

  const unpaidMembers = members.filter((m) => m.unpaidTotal > 0);
  const unpaidSum = unpaidMembers.reduce((sum, m) => sum + m.unpaidTotal, 0);
  const shown = onlyUnpaid ? unpaidMembers : members;

  return (
    <div className="card p-6">
      <h2 className="text-2xl font-bold text-forest-800 mb-4">全部員の支払い状況</h2>

      {rows === null ? (
        <p className="text-earth-600">読み込み中…</p>
      ) : (
        <>
          <p className="pay-summary">
            <span>
              未払い <strong>{unpaidMembers.length}人</strong>
            </span>
            <span>
              未払い合計 <strong>{yen(unpaidSum)}</strong>
            </span>
          </p>

          <div className="pay-filter" role="tablist">
            <button type="button" role="tab" aria-selected={onlyUnpaid} className={onlyUnpaid ? 'active' : ''} onClick={() => setOnlyUnpaid(true)}>
              未払いのみ
            </button>
            <button type="button" role="tab" aria-selected={!onlyUnpaid} className={!onlyUnpaid ? 'active' : ''} onClick={() => setOnlyUnpaid(false)}>
              全員
            </button>
          </div>

          {shown.length === 0 ? (
            <p className="text-forest-700">{onlyUnpaid ? '未払いの人はいません 🎉' : '徴収の記録がありません。'}</p>
          ) : (
            <div>
              {shown.map((m) => {
                const expanded = open === m.userID;
                return (
                  <div key={m.userID} className="pay-member">
                    <button
                      type="button"
                      className="pay-member-head"
                      aria-expanded={expanded}
                      onClick={() => setOpen(expanded ? null : m.userID)}
                    >
                      <span className="pay-member-name">{m.name || '(名前未設定)'}</span>
                      {m.unpaidTotal > 0 ? (
                        <span className="pay-badge unpaid">未払い {yen(m.unpaidTotal)}</span>
                      ) : (
                        <span className="pay-badge done">完納</span>
                      )}
                    </button>
                    {expanded && (
                      <ul className="pay-detail">
                        {m.items.map((p) => (
                          <li key={p.event_id}>
                            <span className="pay-event">
                              {p.title || '(無題)'}
                              <span className="pay-date">{p.date.split('T')[0]}</span>
                            </span>
                            <span className={`pay-amount ${p.paid ? 'paid' : 'unpaid'}`}>
                              {yen(p.amount)} {p.paid ? '済' : '未'}
                            </span>
                            {canEdit && (
                              <label className="paid-label">
                                <input type="checkbox" checked={p.paid} onChange={(e) => setPaid(p, e.target.checked)} /> 支払い済み
                              </label>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
