'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Application, Member } from '../utils/schema';
import { backendURL, readErrorMessage } from '../utils/api';
import { notifyApplicationsChanged } from '../utils/pendingApplications';
import { useToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import { DropTarget, useLongPressDrag } from './useLongPressDrag';
import '../subpages.css';

const ROLES = ['部長', '副部長', '会計'] as const;
type Role = (typeof ROLES)[number];
/** 役職ごとの部員ID */
type RoleDraft = Record<Role, number[]>;

// 1つの役職に就ける人数。代わりの人を立てられるよう2人まで、空席は作らない(サーバー側と同じ)
const MIN_PER_ROLE = 1;
const MAX_PER_ROLE = 2;

const emptyDraft = (): RoleDraft => ({ 部長: [], 副部長: [], 会計: [] });

const isRole = (r: string): r is Role => (ROLES as readonly string[]).includes(r);

/** 部員一覧から、いまの役職の割り当てを作る */
const draftFrom = (members: Member[]): RoleDraft => {
  const draft = emptyDraft();
  for (const m of members) {
    if (isRole(m.role)) draft[m.role].push(m.id);
  }
  return draft;
};

const sameIDs = (a: number[], b: number[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** 下書きで、その人がどの役職に入っているか */
const roleOf = (draft: RoleDraft, id: number): Role | undefined => ROLES.find((r) => draft[r].includes(id));

/** 役職の候補を選ぶ画面。replace があれば、その人と入れ替える */
interface Picking {
  role: Role;
  replace?: number;
}

/** 長押しで動かしている人。from は下書きでの今の役職 */
interface Dragged {
  id: number;
  from?: Role;
}

// 部員一覧に落とすと役職なしになる
const NO_ROLE_ZONE = 'none';

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
  const [picking, setPicking] = useState<Picking | null>(null);
  const [search, setSearch] = useState('');
  const [confirming, setConfirming] = useState(false);
  // ドラッグで変えた直後の確認で「やめる」を押したら、この下書きに戻す
  const [undoDraft, setUndoDraft] = useState<RoleDraft | null>(null);

  const loadApps = useCallback(async () => {
    try {
      const res = await fetch(`${backendURL}/api/applications`, { credentials: 'include' });
      if (!res.ok) {
        showToast(await readErrorMessage(res, '申請の取得に失敗'), 'error');
        setApps([]);
        return;
      }
      setApps((await res.json()) ?? []);
    } catch (e) {
      console.error('failed to load applications:', e);
      showToast('通信に失敗', 'error');
      setApps([]);
    }
  }, [showToast]);

  const loadMembers = useCallback(async () => {
    try {
      const res = await fetch(`${backendURL}/api/members`, { credentials: 'include' });
      if (!res.ok) {
        showToast(await readErrorMessage(res, '部員の取得に失敗'), 'error');
        setMembers([]);
        return;
      }
      const data: Member[] = (await res.json()) ?? [];
      setMembers(data);
      setDraft(draftFrom(data));
    } catch (e) {
      console.error('failed to load members:', e);
      showToast('通信に失敗', 'error');
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

  const saved = useMemo(() => (members ? draftFrom(members) : emptyDraft()), [members]);
  const changedRoles = ROLES.filter((r) => !sameIDs(saved[r], draft[r]));
  const invalidRoles = ROLES.filter((r) => draft[r].length < MIN_PER_ROLE || draft[r].length > MAX_PER_ROLE);
  const nameOf = (id: number) => {
    const m = members?.find((x) => x.id === id);
    return m ? m.name || m.student_id : '?';
  };

  /** その人を role に入れる。ほかの役職に入っていれば、そこから外して移す(兼任はできない) */
  const assign = ({ role, replace }: Picking, id: number) => {
    setDraft((d) => {
      const next = Object.fromEntries(ROLES.map((r) => [r, d[r].filter((x) => x !== id)])) as RoleDraft;
      const i = replace === undefined ? -1 : next[role].indexOf(replace);
      if (i >= 0) next[role][i] = id;
      else next[role] = [...next[role], id];
      return next;
    });
    setPicking(null);
  };

  const unassign = (role: Role, id: number) => setDraft((d) => ({ ...d, [role]: d[role].filter((x) => x !== id) }));

  /**
   * 長押しで人を落としたとき。役職のカードに落とせばそこへ移し、人の上に重ねれば入れ替える。
   * 部員一覧に落とせば役職を外す。変わるときは保存の確認をすぐ出す。
   */
  const dropMember = (item: Dragged, target: DropTarget | null) => {
    if (!target) return;
    const to = isRole(target.zone) ? target.zone : target.zone === NO_ROLE_ZONE ? undefined : null;
    if (to === null) return;
    const other = target.memberID !== undefined && target.memberID !== item.id ? target.memberID : undefined;
    if (to === item.from && other === undefined) return;
    if (to !== undefined && to === item.from) return; // 同じ役職の中での並べ替えは意味がない

    const next = Object.fromEntries(ROLES.map((r) => [r, draft[r].filter((x) => x !== item.id)])) as RoleDraft;
    if (to === undefined) {
      // 役職を外すだけ
    } else if (other !== undefined) {
      // 重ねた相手と入れ替える。相手は動かした人の元の役職へ(元が役職なしなら、相手も役職なしに)
      next[to] = next[to].map((x) => (x === other ? item.id : x));
      if (item.from) next[item.from] = [...next[item.from], other];
    } else {
      if (next[to].length >= MAX_PER_ROLE) {
        showToast(`${to}は${MAX_PER_ROLE}人までです。名前の上に重ねると入れ替えられます。`, 'error');
        return;
      }
      next[to] = [...next[to], item.id];
    }

    const empty = ROLES.find((r) => next[r].length < MIN_PER_ROLE);
    if (empty) {
      showToast(`${empty}が誰もいなくなるので、この移動はできません。`, 'error');
      return;
    }
    setUndoDraft(draft);
    setDraft(next);
    setConfirming(true);
  };

  const { drag, bind, justDropped } = useLongPressDrag<Dragged>(dropMember);

  const cancelConfirm = () => {
    if (undoDraft) setDraft(undoDraft);
    setUndoDraft(null);
    setConfirming(false);
  };

  const saveRoles = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${backendURL}/api/setRoles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: draft }),
        credentials: 'include',
      });
      if (!res.ok) {
        showToast(await readErrorMessage(res, '役職の保存に失敗'), 'error');
        return;
      }
      // 自分の役職が変わったら、ナビや開けるタブが変わるので開き直す
      if (myID !== null && roleOf(saved, myID) !== roleOf(draft, myID)) {
        window.location.reload();
        return;
      }
      showToast('役職を保存しました。', 'success');
      setConfirming(false);
      setUndoDraft(null);
      await loadMembers();
    } catch (e) {
      console.error('failed to save roles:', e);
      showToast('通信に失敗', 'error');
    } finally {
      setSaving(false);
    }
  };

  const query = search.trim().toLowerCase();
  const candidates = (members ?? []).filter(
    (m) => m.name && (query === '' || m.name.toLowerCase().includes(query) || m.student_id.toLowerCase().includes(query)),
  );

  return (
    <div className="sp-page">
      <h2 className="sp-title">入部申請</h2>

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

      {members === null ? (
        <p className="sp-muted">読み込み中…</p>
      ) : (
        <>
          <p className="sp-muted role-hint">名前を押すと入れ替え、× で外せます。長押しでつかんで、ほかの役職や人の上へ動かすこともできます。1つの役職は{MIN_PER_ROLE}〜{MAX_PER_ROLE}人です。</p>
          <div className="role-cards">
            {ROLES.map((role) => {
              const ids = draft[role];
              const changed = changedRoles.includes(role);
              const empty = ids.length < MIN_PER_ROLE;
              return (
                <section
                  key={role}
                  data-drop={role}
                  className={`sp-card role-card${changed ? ' changed' : ''}${empty ? ' invalid' : ''}${
                    drag?.over?.zone === role && drag.item.from !== role ? ' drop-over' : ''
                  }`}
                >
                  <header className="role-card-head">
                    <h3 className="role-card-title">{role}</h3>
                    <span className="role-card-count">
                      {ids.length}/{MAX_PER_ROLE}人
                    </span>
                    {changed && <span className="role-card-changed">変更あり</span>}
                  </header>
                  <ul className="role-slots">
                    {ids.map((id) => (
                      <li
                        key={id}
                        data-drop-member={id}
                        className={`role-slot${drag?.item.id === id ? ' dragging' : ''}${
                          drag?.over?.memberID === id && drag.item.id !== id && drag.item.from !== role ? ' drop-swap' : ''
                        }`}
                      >
                        <button
                          type="button"
                          className="role-slot-name"
                          aria-label={`${role}の${nameOf(id)}をほかの人と入れ替える`}
                          {...bind({ id, from: role }, nameOf(id))}
                          onClick={() => {
                            if (justDropped()) return;
                            setSearch('');
                            setPicking({ role, replace: id });
                          }}
                        >
                          {nameOf(id)}
                          {id === myID && <span className="role-slot-me">自分</span>}
                        </button>
                        <button
                          type="button"
                          className="role-slot-remove"
                          aria-label={`${nameOf(id)}を${role}から外す`}
                          onClick={() => unassign(role, id)}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                    {ids.length < MAX_PER_ROLE && (
                      <li>
                        <button
                          type="button"
                          className="role-slot-add"
                          onClick={() => {
                            setSearch('');
                            setPicking({ role });
                          }}
                        >
                          ＋ {role}を追加
                        </button>
                      </li>
                    )}
                  </ul>
                  {empty && <p className="role-card-error">{role}を{MIN_PER_ROLE}人以上選んでください。</p>}
                </section>
              );
            })}
          </div>

          {changedRoles.length > 0 && (
            <div className="role-savebar">
              <span className="role-savebar-text">
                {invalidRoles.length > 0 ? `${invalidRoles.join('・')}が空いています` : `${changedRoles.length}つの役職を変更中`}
              </span>
              <button className="sp-btn-sub" onClick={() => setDraft(saved)} disabled={saving}>
                元に戻す
              </button>
              <button className="sp-btn" onClick={() => setConfirming(true)} disabled={saving || invalidRoles.length > 0}>
                保存
              </button>
            </div>
          )}
        </>
      )}

      {picking && (
        <Modal title={picking.replace === undefined ? `${picking.role}を選ぶ` : `${nameOf(picking.replace)}と入れ替える`} onClose={() => setPicking(null)}>
          <input
            type="search"
            className="role-search"
            placeholder="名前・学籍番号で探す"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {candidates.length === 0 ? (
            <p className="sp-muted">部員が見つかりません。</p>
          ) : (
            <ul className="role-pick-list">
              {candidates.map((m) => {
                const current = roleOf(draft, m.id);
                const here = current === picking.role;
                return (
                  <li key={m.id}>
                    <button type="button" className="role-pick" disabled={here} onClick={() => assign(picking, m.id)}>
                      <span className="role-pick-main">
                        {m.name}
                        <span className="sp-row-sub">
                          {m.student_id}
                          {!m.linked && ' ・ LINE未連携'}
                        </span>
                      </span>
                      {here ? (
                        <span className="role-pick-note">選択中</span>
                      ) : current ? (
                        <span className="role-pick-note move">{current}から移す</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Modal>
      )}

      {confirming && (
        <Modal title="役職を保存しますか？" onClose={saving ? undefined : cancelConfirm}>
          <ul className="role-diff">
            {changedRoles.map((r) => (
              <li key={r}>
                <span className="role-diff-role">{r}</span>
                <span className="role-diff-before">{saved[r].map(nameOf).join('、') || 'なし'}</span>
                <span aria-hidden="true">→</span>
                <span className="role-diff-after">{draft[r].map(nameOf).join('、')}</span>
              </li>
            ))}
          </ul>
          {myID !== null && roleOf(saved, myID) !== roleOf(draft, myID) && (
            <p className="app-modal-error">
              自分の役職が「{roleOf(saved, myID) ?? 'なし'}」から「{roleOf(draft, myID) ?? 'なし'}」に変わります。開けるページが変わることがあります。
            </p>
          )}
          <div className="role-save">
            <button className="sp-btn-sub" onClick={cancelConfirm} disabled={saving}>
              やめる
            </button>
            <button className="sp-btn" onClick={saveRoles} disabled={saving}>
              {saving ? '保存中…' : '保存する'}
            </button>
          </div>
        </Modal>
      )}

      <h2 className="sp-title">
        部員一覧{members && <span className="member-count">{members.length}人</span>}
        {drag?.item.from && <span className="member-drop-hint">ここに落とすと役職を外せます</span>}
      </h2>
      {members === null ? (
        <p className="sp-muted">読み込み中…</p>
      ) : members.length === 0 ? (
        <p className="sp-empty">部員はいません。</p>
      ) : (
        <ul
          data-drop={NO_ROLE_ZONE}
          className={`sp-card sp-list member-list${drag?.over?.zone === NO_ROLE_ZONE && drag.item.from ? ' drop-over' : ''}`}
        >
          {members.map((m) => {
            const draftRole = roleOf(draft, m.id);
            return (
              <li
                key={m.id}
                className={`sp-row${m.name ? ' member-draggable' : ''}${drag?.item.id === m.id ? ' dragging' : ''}`}
                // 名前のない人は役職に選べないので、つかめないようにする
                {...(m.name ? bind({ id: m.id, from: draftRole }, m.name) : {})}
              >
                <span className="sp-row-main">
                  {m.name || '(名前未設定)'}
                  <span className="sp-row-sub">
                    {m.student_id}
                    {!m.linked && ' ・ LINE未連携'}
                  </span>
                </span>
                {draftRole && <span className={`role-badge${draftRole !== m.role ? ' changed' : ''}`}>{draftRole}</span>}
              </li>
            );
          })}
        </ul>
      )}

      {/* 指(カーソル)についてくる名前 */}
      {drag && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          {drag.label}
        </div>
      )}
    </div>
  );
}
