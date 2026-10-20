'use client';

import { useEffect, useState } from 'react';
import { UnpaidResponse } from '../utils/schema';
import { backendURL } from '../utils/api';

const yen = (n: number) => `${n.toLocaleString()}円`;

/** ホームに出す、自分の部費の支払い状況。ログインしていなければ、ログインを促す。 */
export default function MyUnpaidCard() {
  const [data, setData] = useState<UnpaidResponse | null>(null);
  const [loggedOut, setLoggedOut] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${backendURL}/api/myUnpaid`, { credentials: 'include' });
        // 未ログインは401。エラーは出さず、ログインを促す表示にする
        if (res.status === 401) {
          setLoggedOut(true);
          return;
        }
        if (!res.ok) return;
        setData(await res.json());
      } catch (e) {
        console.error('failed to load unpaid:', e);
      }
    };
    load();
  }, []);

  if (loggedOut) {
    return (
      <div className="card mb-8 unpaid-card">
        <div className="unpaid-head">
          <h2 className="upcoming-title">Your 未払い状況</h2>
        </div>
        <p className="unpaid-login">ログインしてください。右上の「LINEでログイン」から入れます。</p>
      </div>
    );
  }

  if (data === null) return null;

  return (
    <div className="card mb-8 unpaid-card">
      <div className="unpaid-head">
        <h2 className="upcoming-title">Your 未払い状況</h2>
      </div>

      {data.items.length === 0 ? (
        <p className="unpaid-ok">No 未払い 🎉</p>
      ) : (
        <>
          <p className="unpaid-total">
            未払い <strong>{yen(data.total)}</strong>
          </p>
          <ul className="unpaid-list">
            {data.items.map((it) => (
              <li key={it.event_id} className="unpaid-item">
                <span className="unpaid-name">
                  {it.title || '(無題)'}
                  <span className="unpaid-date">{it.date.split('T')[0]}</span>
                </span>
                <span className="unpaid-amount">{yen(it.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
