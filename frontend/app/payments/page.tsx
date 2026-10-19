'use client';

import { useCallback, useEffect, useState } from 'react';
import { UnpaidResponse } from '../utils/schema';
import { backendURL, readErrorMessage } from '../utils/api';
import { useToast } from '../../components/Toast';
import '../subpages.css';

const yen = (n: number) => `${n.toLocaleString()}円`;

export default function PaymentsPage() {
  const { showToast } = useToast();
  const [mine, setMine] = useState<UnpaidResponse | null>(null);
  const [all, setAll] = useState<UnpaidResponse | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${backendURL}/api/myUnpaid`, { credentials: 'include' });
      if (!res.ok) {
        showToast(await readErrorMessage(res, '未払いの取得に失敗しました。'), 'error');
        return;
      }
      setMine(await res.json());

      // 全員分は会計・役員だけが取れる。権限がなければ403が返るので、そのときは出さない。
      const allRes = await fetch(`${backendURL}/api/allUnpaid`, { credentials: 'include' });
      setAll(allRes.ok ? await allRes.json() : null);
    } catch (e) {
      console.error('failed to load payments:', e);
      showToast('通信に失敗しました。', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。
    load();
  }, [load]);

  return (
    <div className="sp-page">
      <h1 className="sp-title">部費の支払い状況</h1>

      <section className="sp-card">
        <h2 className="sp-card-title">あなたの未払い</h2>
        {mine === null ? (
          <p className="sp-muted">読み込み中…</p>
        ) : mine.items.length === 0 ? (
          <p className="sp-empty">未払いはありません 🎉</p>
        ) : (
          <>
            <ul className="sp-list">
              {mine.items.map((it) => (
                <li key={it.event_id} className="sp-row">
                  <span className="sp-row-main">
                    {it.title || '(無題)'}
                    <span className="sp-row-sub">{it.date.split('T')[0]}</span>
                  </span>
                  <span className="sp-amount">{yen(it.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="sp-total">合計 {yen(mine.total)}</p>
          </>
        )}
      </section>

      {all && (
        <section className="sp-card">
          <h2 className="sp-card-title">全員の未払い(会計・役員のみ)</h2>
          <p className="sp-muted" style={{ marginBottom: '0.75rem' }}>合計 {yen(all.total)}</p>
          {all.items.length === 0 ? (
            <p className="sp-empty">未払いはありません。</p>
          ) : (
            <ul className="sp-list">
              {all.items.map((it) => (
                <li key={`${it.event_id}-${it.user_id}`} className="sp-row">
                  <span className="sp-row-main">
                    {it.user_name}
                    <span className="sp-row-sub">{it.title || '(無題)'}</span>
                  </span>
                  <span className="sp-amount">{yen(it.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="sp-muted" style={{ marginTop: '0.75rem' }}>支払い済みにするには、会計ページのイベントの参加者欄で操作します。</p>
        </section>
      )}
    </div>
  );
}
