'use client';

import { useCallback, useEffect, useState } from 'react';
import { Application } from '../utils/schema';
import { backendURL, readErrorMessage } from '../utils/api';
import { useToast } from '../../components/Toast';

export default function MembersPage() {
  const { showToast } = useToast();
  const [apps, setApps] = useState<Application[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${backendURL}/api/applications`, { credentials: 'include' });
      if (!res.ok) {
        showToast(await readErrorMessage(res, '申請の取得に失敗しました。'), 'error');
        setApps([]);
        return;
      }
      setApps((await res.json()) ?? []);
    } catch (e) {
      console.error('failed to load applications:', e);
      showToast('通信に失敗しました。', 'error');
      setApps([]);
    }
  }, [showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。
    load();
  }, [load]);

  const decide = async (app: Application, approve: boolean) => {
    const label = approve ? '承認' : '却下';
    if (!window.confirm(`${app.name}(${app.student_id})を${label}しますか？`)) return;
    try {
      const res = await fetch(`${backendURL}/api/decideApplication`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: app.id, approve }),
        credentials: 'include',
      });
      if (!res.ok) {
        showToast(await readErrorMessage(res, `${label}に失敗しました。`), 'error');
        return;
      }
      showToast(`${label}しました。`, 'success');
      await load();
    } catch (e) {
      console.error('failed to decide application:', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-forest-800 mb-1">入部申請</h1>
      <p className="text-sm text-earth-600 mb-4">
        名簿と照らし合わせて、部員本人かどうかを確認してから承認してください(部長・副部長のみ)。
      </p>

      {apps === null ? (
        <p className="text-earth-600">読み込み中…</p>
      ) : apps.length === 0 ? (
        <p className="text-forest-700">承認待ちの申請はありません。</p>
      ) : (
        <ul className="divide-y divide-earth-100 bg-white rounded-xl border border-earth-200">
          {apps.map((app) => (
            <li key={app.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>
                {app.name}
                <span className="text-sm text-earth-600 ml-2">{app.student_id}</span>
                <span className="block text-xs text-earth-600">{app.created_at.slice(0, 10)}</span>
              </span>
              <span className="flex gap-2 shrink-0">
                <button className="px-3 py-1 rounded-lg bg-forest-600 text-white" onClick={() => decide(app, true)}>
                  承認
                </button>
                <button className="px-3 py-1 rounded-lg bg-earth-200 text-forest-800" onClick={() => decide(app, false)}>
                  却下
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
