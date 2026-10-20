'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MoneyLogStruct } from '../utils/schema';
import { backendURL } from '../utils/api';

const yen = (n: number) => `${n.toLocaleString()}円`;
const RECENT = 5;

/** ホームに出す、部費の残高と収入・支出の詳細。ログインしなくても見られる。 */
export default function AccountSummaryCard() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [balance, setBalance] = useState<number | null>(null);
  const [logs, setLogs] = useState<MoneyLogStruct[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (y: number) => {
    try {
      const [sumRes, logRes] = await Promise.all([
        fetch(`${backendURL}/api/getMoneySum`, { credentials: 'include' }),
        fetch(`${backendURL}/api/accountInfo?year=${y}`, { credentials: 'include' }),
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
    load(year);
  }, [year, load]);

  // 新しい順(同じ日は後から登録したものが上)
  const sorted = useMemo(
    () => [...(logs ?? [])].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    [logs],
  );
  const income = sorted.filter((l) => l.amount > 0).reduce((sum, l) => sum + l.amount, 0);
  const expense = sorted.filter((l) => l.amount < 0).reduce((sum, l) => sum + -l.amount, 0);
  const shown = showAll ? sorted : sorted.slice(0, RECENT);

  if (failed || balance === null || logs === null) return null;

  const changeYear = (delta: number) => {
    setShowAll(false);
    setLogs(null);
    setYear((y) => y + delta);
  };

  return (
    <div className="card mb-8 account-summary">
      <h2 className="upcoming-title">部費の残高</h2>
      <p className="account-balance">{yen(balance)}</p>

      <div className="account-year">
        <button type="button" className="nav-btn" aria-label="前の年" onClick={() => changeYear(-1)}>
          ◀
        </button>
        <span className="account-year-label">{year}年</span>
        <button type="button" className="nav-btn" aria-label="次の年" onClick={() => changeYear(1)}>
          ▶
        </button>
      </div>

      <div className="account-totals">
        <span className="account-total in">
          収入 <strong>+{yen(income)}</strong>
        </span>
        <span className="account-total out">
          支出 <strong>-{yen(expense)}</strong>
        </span>
      </div>

      {sorted.length === 0 ? (
        <p className="upcoming-empty">この年の入出金はありません。</p>
      ) : (
        <>
          <ul className="account-list">
            {shown.map((l) => (
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
          {sorted.length > RECENT && (
            <button type="button" className="account-more" onClick={() => setShowAll(!showAll)}>
              {showAll ? '閉じる' : `すべて見る(${sorted.length}件)`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
