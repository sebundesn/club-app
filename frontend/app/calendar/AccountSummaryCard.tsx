'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MoneyLogStruct } from '../utils/schema';
import { backendURL } from '../utils/api';

const yen = (n: number) => `${n.toLocaleString()}円`;

/** ホームに出す、部費の残高と収入・支出の詳細。ログインしなくても見られる。 */
export default function AccountSummaryCard() {
  const [balance, setBalance] = useState<number | null>(null);
  const [logs, setLogs] = useState<MoneyLogStruct[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      // year を空にすると全期間が返る
      const [sumRes, logRes] = await Promise.all([
        fetch(`${backendURL}/api/getMoneySum`, { credentials: 'include' }),
        fetch(`${backendURL}/api/accountInfo?year=`, { credentials: 'include' }),
      ]);
      // 取得できなかったときは、エラーを出さずにカードごと出さない
      if (!sumRes.ok || !logRes.ok) {
        setFailed(true);
        return;
      }
      setBalance(await sumRes.json());
      setLogs((await logRes.json()) ?? []);
    } catch (e) {
      console.error('failed to load account summary:', e);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。
    load();
  }, [load]);

  // 新しい順(同じ日は後から登録したものが上)
  const sorted = useMemo(
    () => [...(logs ?? [])].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    [logs],
  );

  if (failed || balance === null || logs === null) return null;

  return (
    <div className="card mb-8 account-summary">
      <h2 className="upcoming-title">部費の残高</h2>
      <p className="account-balance">{yen(balance)}</p>

      {sorted.length === 0 ? (
        <p className="upcoming-empty">入出金はありません。</p>
      ) : (
        // 5件ぶんの高さで、それ以上はスクロール
        <ul className="account-list">
          {sorted.map((l) => (
            <li key={l.id} className="account-item">
              <span className="account-name">
                {l.content}
                <span className="account-date">{l.date.split('T')[0]}</span>
              </span>
              <span className={`account-amount ${l.amount > 0 ? 'in' : 'out'}`}>
                {l.amount > 0 ? '+' : '-'}
                {yen(Math.abs(l.amount))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
