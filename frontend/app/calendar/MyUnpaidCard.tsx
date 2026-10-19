'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UnpaidResponse } from '../utils/schema';
import { backendURL } from '../utils/api';

const yen = (n: number) => `${n.toLocaleString()}円`;
const SHOW_MAX = 3;

/** ホームに出す、自分の部費の未払い。ログインしていなければ何も出さない。 */
export default function MyUnpaidCard() {
  const [data, setData] = useState<UnpaidResponse | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${backendURL}/api/myUnpaid`, { credentials: 'include' });
        // 未ログイン(401)などのときは、エラーを出さずにカードごと出さない
        if (!res.ok) return;
        setData(await res.json());
      } catch (e) {
        console.error('failed to load unpaid:', e);
      }
    };
    load();
  }, []);

  if (data === null) return null;

  const shown = data.items.slice(0, SHOW_MAX);
  const rest = data.items.length - shown.length;

  return (
    <div className="card mb-8 unpaid-card">
      <div className="unpaid-head">
        <h2 className="upcoming-title">あなたの部費</h2>
        <Link href="/payments" className="unpaid-more">
          くわしく →
        </Link>
      </div>

      {data.items.length === 0 ? (
        <p className="unpaid-ok">未払いはありません 🎉</p>
      ) : (
        <>
          <p className="unpaid-total">
            未払い <strong>{yen(data.total)}</strong>
          </p>
          <ul className="unpaid-list">
            {shown.map((it) => (
              <li key={it.event_id} className="unpaid-item">
                <span className="unpaid-name">
                  {it.title || '(無題)'}
                  <span className="unpaid-date">{it.date.split('T')[0]}</span>
                </span>
                <span className="unpaid-amount">{yen(it.amount)}</span>
              </li>
            ))}
          </ul>
          {rest > 0 && <p className="unpaid-rest">ほか{rest}件</p>}
        </>
      )}
    </div>
  );
}
