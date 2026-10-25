'use client';

import { useCallback, useEffect, useState } from 'react';
import Select from 'react-select';
import { Application, Member, MemberOption } from '../utils/schema';
import { backendURL, readErrorMessage } from '../utils/api';
import { notifyApplicationsChanged } from '../utils/pendingApplications';
import { useToast } from '../../components/Toast';
import '../subpages.css';

const ROLES = ['部長', '副部長', '会計'] as const;
type Role = (typeof ROLES)[number];
type RoleDraft = Record<Role, MemberOption[]>;

// 1つの役職に就ける人数。代わりの人を立てられるよう2人まで、空席は作らない(サーバー側と同じ)
const MIN_PER_ROLE = 1;
const MAX_PER_ROLE = 2;

const emptyDraft = (): RoleDraft => ({ 部長: [], 副部長: [], 会計: [] });

const toOption = (m: Member): MemberOption => ({ value: m.id, label: m.name || m.student_id });

/** 部員一覧から、いまの役職の割り当てを作る */
const draftFrom = (members: Member[]): RoleDraft => {
  const draft = emptyDraft();
  for (const m of members) {
    if ((ROLES as readonly string[]).includes(m.role)) draft[m.role as Role].push(toOption(m));
  }
  return draft;
};

/**
 * 役職ページの「部員」: 入部申請の承認、役職の付け替え、部員の一覧。部長・副部長のみ。
 * myID は自分の役職が変わったときに画面を開き直すために使う。
 */
export default function MembersSection({ myID }: { myID: number | null }) {
  const { showToast } = useToast();
  const [apps, setApps] = useState<Application[] | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [draft, setDraft] = useState<RoleDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const loadApps = useCallback(async () => {
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

  const loadMembers = useCallback(async () => {
    try {
      const res = await fetch(`${backendURL}/api/members`, { credentials: 'include' });
      if (!res.ok) {
        showToast(await readErrorMessage(res, '部員の取得に失敗しました。'), 'error');
        setMembers([]);
        return;
      }
      const data: Member[] = (await res.json()) ?? [];
      setMembers(data);
      setDraft(draftFrom(data));
    } catch (e) {
      console.error('failed to load members:', e);
      showToast('通信に失敗しました。', 'error');
      setMembers([]);
    }
  }, [showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。
    loadApps();
    loadMembers();
  }, [loadApps, loadMembers]);

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
      await loadApps();
      if (approve) await loadMembers();
      notifyApplicationsChanged();
    } catch (e) {
      console.error('failed to decide application:', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  const saveRoles = async () => {
    const short = ROLES.find((r) => draft[r].length < MIN_PER_ROLE || draft[r].length > MAX_PER_ROLE);
    if (short) {
      showToast(`${short}は${MIN_PER_ROLE}〜${MAX_PER_ROLE}人で選んでください。`, 'error');
      return;
    }
    if (!window.confirm('この内容で役職を保存しますか？')) return;

    const roles = Object.fromEntries(ROLES.map((r) => [r, draft[r].map((o) => o.value)]));
    setSaving(true);
    try {
      const res = await fetch(`${backendURL}/api/setRoles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles }),
        credentials: 'include',
      });
      if (!res.ok) {
        showToast(await readErrorMessage(res, '役職の保存に失敗しました。'), 'error');
        return;
      }
      // 自分の役職が変わったら、ナビや開けるタブが変わるので開き直す
      const myOldRole = members?.find((m) => m.id === myID)?.role ?? '';
      const myNewRole = ROLES.find((r) => draft[r].some((o) => o.value === myID)) ?? '';
      if (myOldRole !== myNewRole) {
        window.location.reload();
        return;
      }
      showToast('役職を保存しました。', 'success');
      await loadMembers();
    } catch (e) {
      console.error('failed to save roles:', e);
      showToast('通信に失敗しました。', 'error');
    } finally {
      setSaving(false);
    }
  };

  // 兼任はできないので、ほかの役職で選ばれている人は選択肢から外す
  const optionsFor = (role: Role): MemberOption[] => {
    const taken = new Set(ROLES.filter((r) => r !== role).flatMap((r) => draft[r].map((o) => o.value)));
    return (members ?? []).filter((m) => m.name && !taken.has(m.id)).map(toOption);
  };

  const unchanged =
    members !== null &&
    ROLES.every((r) => {
      const now = draftFrom(members)[r].map((o) => o.value).sort();
      const next = draft[r].map((o) => o.value).sort();
      return now.length === next.length && now.every((v, i) => v === next[i]);
    });

  return (
    <div className="sp-page">
      <h2 className="sp-title">入部申請</h2>
      <p className="sp-lead">名簿と照らし合わせて、部員本人かどうかを確認してから承認してください。</p>

      {apps === null ? (
        <p className="sp-muted">読み込み中…</p>
      ) : apps.length === 0 ? (
        <p className="sp-empty sp-section-gap">承認待ちの申請はありません。</p>
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

      <h2 className="sp-title">役職</h2>
      <p className="sp-lead">
        部長・副部長・会計は、それぞれ{MIN_PER_ROLE}〜{MAX_PER_ROLE}人選べます。代わりの人を立てるときは2人目に追加してください。
      </p>

      {members === null ? (
        <p className="sp-muted">読み込み中…</p>
      ) : (
        <div className="sp-card">
          {ROLES.map((role) => (
            <div key={role} className="role-row">
              <span className="role-row-label">{role}</span>
              <div className="role-row-select">
                <Select
                  isMulti
                  instanceId={`role-${role}`}
                  options={optionsFor(role)}
                  value={draft[role]}
                  onChange={(v) => setDraft({ ...draft, [role]: [...v] })}
                  // 2人選んだら、それ以上は選べない
                  isOptionDisabled={() => draft[role].length >= MAX_PER_ROLE}
                  placeholder="部員を選ぶ"
                  noOptionsMessage={() => '部員が見つかりません'}
                  theme={(theme) => ({ ...theme, colors: { ...theme.colors, primary: '#15803d' } })}
                />
              </div>
            </div>
          ))}
          <div className="role-save">
            <button className="sp-btn-sub" onClick={() => setDraft(draftFrom(members))} disabled={unchanged || saving}>
              元に戻す
            </button>
            <button className="sp-btn" onClick={saveRoles} disabled={unchanged || saving}>
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      )}

      <h2 className="sp-title">
        部員一覧{members && <span className="member-count">{members.length}人</span>}
      </h2>
      {members === null ? (
        <p className="sp-muted">読み込み中…</p>
      ) : members.length === 0 ? (
        <p className="sp-empty">部員はいません。</p>
      ) : (
        <ul className="sp-card sp-list">
          {members.map((m) => (
            <li key={m.id} className="sp-row">
              <span className="sp-row-main">
                {m.name || '(名前未設定)'}
                <span className="sp-row-sub">
                  {m.student_id}
                  {!m.linked && ' ・ LINE未連携'}
                </span>
              </span>
              {m.role && <span className="role-badge">{m.role}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
