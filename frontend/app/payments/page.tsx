'use client';

import { useCallback, useEffect, useState } from 'react';
import { UnpaidResponse } from '../utils/schema';
import { backendURL, readErrorMessage } from '../utils/api';
import { useToast } from '../../components/Toast';

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
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-forest-800 mb-4">部費の支払い状況</h1>

      <section className="bg-white rounded-xl border border-earth-200 p-5 mb-6">
        <h2 className="font-bold text-forest-700 mb-3">あなたの未払い</h2>
        {mine === null ? (
          <p className="text-earth-600">読み込み中…</p>
        ) : mine.items.length === 0 ? (
          <p className="text-forest-700">未払いはありません 🎉</p>
        ) : (
          <>
            <ul className="divide-y divide-earth-100">
              {mine.items.map((it) => (
                <li key={it.event_id} className="flex justify-between py-2">
                  <span>
                    {it.title || '(無題)'}
                    <span className="text-xs text-earth-600 ml-2">{it.date.split('T')[0]}</span>
                  </span>
                  <span className="font-medium">{yen(it.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="text-right font-bold mt-3">合計 {yen(mine.total)}</p>
          </>
        )}
      </section>

      {all && (
        <section className="bg-white rounded-xl border border-earth-200 p-5">
          <h2 className="font-bold text-forest-700 mb-1">全員の未払い(会計・役員のみ)</h2>
          <p className="text-sm text-earth-600 mb-3">合計 {yen(all.total)}</p>
          {all.items.length === 0 ? (
            <p className="text-forest-700">未払いはありません。</p>
          ) : (
            <ul className="divide-y divide-earth-100">
              {all.items.map((it) => (
                <li key={`${it.event_id}-${it.user_id}`} className="flex justify-between py-2">
                  <span>
                    {it.user_name}
                    <span className="text-xs text-earth-600 ml-2">{it.title || '(無題)'}</span>
                  </span>
                  <span>{yen(it.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-earth-600 mt-3">支払い済みにするには、会計ページのイベントの参加者欄で操作します。</p>
        </section>
      )}
    </div>
  );
}
