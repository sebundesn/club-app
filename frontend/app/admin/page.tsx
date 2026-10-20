'use client';

import { useEffect, useState } from 'react';
import { backendURL } from '../utils/api';
import AccountingSection from './AccountingSection';
import ApplicationsSection from './ApplicationsSection';
import ManageCalendar from './ManageCalendar';
import './admin.css';

type Tab = 'accounting' | 'calendar' | 'applications';

const TAB_LABEL: Record<Tab, string> = {
  accounting: '会計',
  calendar: 'カレンダー',
  applications: '入部申請',
};

/** 役職ごとに開ける内容。画面の出し分けだけで、実際の権限チェックはサーバー側で行っている。 */
const TABS_BY_ROLE: Record<string, Tab[]> = {
  部長: ['accounting', 'calendar', 'applications'],
  副部長: ['accounting', 'calendar', 'applications'],
  会計: ['accounting'],
};

/**
 * 部長・副部長・会計のページ。ナビの名前は役職名。
 * 会計: 会計の処理と全体の支払い状況。部長: それに加えてカレンダーの登録と入部申請。
 * 副部長: 部長と同じ画面だが、会計は見るだけ。
 */
export default function AdminPage() {
  const [role, setRole] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('accounting');

  useEffect(() => {
    const loadRole = async () => {
      try {
        const res = await fetch(`${backendURL}/api/checkAuth`, { credentials: 'include' });
        const data = res.ok ? await res.json() : null;
        setRole(data && typeof data.role === 'string' ? data.role : '');
      } catch (e) {
        console.error('failed to check role:', e);
        setRole('');
      }
    };
    loadRole();
  }, []);

  if (role === null) return <p className="admin-note">読み込み中…</p>;

  const tabs = TABS_BY_ROLE[role];
  if (!tabs) {
    return <p className="admin-note">このページは部長・副部長・会計だけが開けます。ログインしているか確認してください。</p>;
  }

  return (
    <div>
      <h1 className="admin-title">{role}</h1>

      {tabs.length > 1 && (
        <div className="admin-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`admin-tab${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
      )}

      {tab === 'accounting' && <AccountingSection role={role} />}
      {tab === 'calendar' && tabs.includes('calendar') && <ManageCalendar />}
      {tab === 'applications' && tabs.includes('applications') && <ApplicationsSection />}
    </div>
  );
}
