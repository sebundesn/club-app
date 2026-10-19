'use client';

import { useCallback, useEffect, useState } from 'react';
import { Application } from '../utils/schema';
import { backendURL, readErrorMessage } from '../utils/api';
import { useToast } from '../../components/Toast';
import '../subpages.css';

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
    <div className="sp-page">
      <h1 className="sp-title">入部申請</h1>
      <p className="sp-lead">
        名簿と照らし合わせて、部員本人かどうかを確認してから承認してください(部長・副部長のみ)。
      </p>

      {apps === null ? (
        <p className="sp-muted">読み込み中…</p>
      ) : apps.length === 0 ? (
        <p className="sp-empty">承認待ちの申請はありません。</p>
      ) : (
        <ul className="sp-card sp-list">
          {apps.map((app) => (
            <li key={app.id} className="sp-row">
              <span className="sp-row-main">
                {app.name}
                <span className="sp-row-sub">
                  {app.student_id} ・ {app.created_at.slice(0, 10)}
                </span>
              </span>
              <span className="sp-actions">
                <button className="sp-btn" onClick={() => decide(app, true)}>
                  承認
                </button>
                <button className="sp-btn-sub" onClick={() => decide(app, false)}>
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
