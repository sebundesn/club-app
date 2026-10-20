'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserInfoStruct } from '../app/utils/schema';
import { backendURL, readErrorMessage } from '../app/utils/api';
import { usePendingApplications } from '../app/utils/pendingApplications';
import { useToast } from './Toast';
import Modal from './Modal';
import LineLoginButton from './LineLoginButton';
import UserMenu from './UserMenu';
import LineLinkModal from './LineLinkModal';
import './header.css'; // Vanilla CSSの読み込み

// ヘッダーコンポーネント：ナビゲーションとユーザー認証機能を提供
export default function Header() {
  const pathname = usePathname();
  const { showToast } = useToast();
  const [isInitialLogin, setIsInitialLogin] = useState(false);
  const [needsLink, setNeedsLink] = useState(false);
  const [application, setApplication] = useState('');
  const [realname, setRealname] = useState('');
  const [userInfo, setUserInfo] = useState<UserInfoStruct>({
    ID: null,
    userName: '',
    role: '',
    picture: '',
    isLoggedIn: false,
  });
  const [isScrolled, setIsScrolled] = useState(false);

  // 認証状態の確認(ページ遷移ごとに)
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch(`${backendURL}/api/checkAuth`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!res.ok) return;

      const data = await res.json();

      if (data.logged_in) {
        setUserInfo({
          ID: data.id,
          userName: data.name,
          role: data.role,
          picture: typeof data.picture === 'string' ? data.picture : '',
          isLoggedIn: true,
        });
        setNeedsLink(false);
        setIsInitialLogin(Boolean(data.is_initial));
        return;
      }

      setUserInfo({ ID: null, userName: '', role: '', picture: '', isLoggedIn: false });
      // LINE認証は通ったが、まだ部員レコードと紐づいていない状態
      setNeedsLink(Boolean(data.needs_link));
      setApplication(typeof data.application === 'string' ? data.application : '');
    } catch (e) {
      console.error('failed to check auth:', e);
    }
  }, []);

  // 初期ログイン時のユーザー情報設定
  const handleLoginSubmitFirst = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (realname === '') {
      showToast('名前を書いてください。', 'error');
      return;
    }

    try {
      const res = await fetch(`${backendURL}/api/firstLogin`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realname }),
      });

      if (!res.ok) {
        showToast(await readErrorMessage(res, '保存に失敗しました。'), 'error');
        return;
      }

      setIsInitialLogin(false);
      setUserInfo({ ...userInfo, userName: realname });
    } catch (e) {
      console.error('failed to save realname:', e);
      showToast('通信に失敗しました。', 'error');
    } finally {
      setRealname('');
    }
  };

  // LINEの認可画面へ。戻り先はバックエンドの /api/auth/line/callback
  const goLineLogin = () => {
    window.location.href = `${backendURL}/api/auth/line/login`;
  };

  // ログアウト処理
  const handleLogout = async () => {
    if (!window.confirm('ログアウトしますか？')) return;

    try {
      const res = await fetch(`${backendURL}/api/logout`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!res.ok) {
        showToast(await readErrorMessage(res, 'ログアウトに失敗しました。'), 'error');
        return;
      }

      setUserInfo({
        ID: null,
        userName: '',
        role: '',
        picture: '',
        isLoggedIn: false,
      });
      showToast('ログアウトしました。', 'success');
    } catch (e) {
      console.error('failed to logout:', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  // 入部申請の承認待ち件数(承認できる部長・副部長にだけ出す)
  const pending = usePendingApplications(['部長', '副部長'].includes(userInfo.role));

  // ナビゲーション項目
  const navItems = [
    { path: '/calendar', label: 'ワンゲル', badge: 0 },
    { path: '/album', label: 'アルバム', badge: 0 },
    ...(userInfo.isLoggedIn ? [{ path: '/receipts', label: 'レシート', badge: 0 }] : []),
    // 部長・副部長・会計には、役職名のページを出す
    ...(['部長', '副部長', '会計'].includes(userInfo.role) ? [{ path: '/admin', label: userInfo.role, badge: pending }] : []),
  ];

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。同期的な連鎖レンダリングは起きない。
    checkAuth();
  }, [checkAuth]);

  // スクロール検知。handleScroll は定義されているだけでリスナーに繋がっておらず、
  // .scrolled のスタイルが一度も当たらなかったので登録する。
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // LINEのコールバックから戻ってきたときの結果表示。
  // useSearchParams はプリレンダリングで Suspense を要求するため、
  // ここでは location から直接読んで、読んだらURLから消す。
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const login = params.get('login');
    if (!login) return;

    if (login === 'success') {
      showToast('ログインしました。', 'success');
    } else if (login === 'cancelled') {
      showToast('ログインをキャンセルしました。', 'info');
    } else if (login === 'error') {
      showToast('ログインに失敗しました。もう一度お試しください。', 'error');
    }

    params.delete('login');
    const rest = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
  }, [showToast]);

  return (
    <>
      {/* ログイン / ログアウト。ヘッダーに含めず、スクロールしても動かない */}
      <div className="account-bar">
        {/* ログイン / ログアウト */}
        {userInfo.isLoggedIn ? (
          <UserMenu userName={userInfo.userName} picture={userInfo.picture} onLogout={handleLogout} />
        ) : (
          <LineLoginButton onClick={goLineLogin} />
        )}
      </div>

      {/* ヘッダー(ナビゲーションだけが浮く) */}
      <header className={`site-header ${isScrolled ? 'scrolled' : ''}`}>
        <div className="header-container">
          {/* ナビゲーション（PC用） */}
          <nav className="nav-desktop">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`nav-link ${pathname === item.path ? 'active' : ''}`}
              >
                {item.label}
                {item.badge > 0 && <span className="notify-badge">{item.badge}</span>}
              </Link>
            ))}
          </nav>

        </div>

        {/* ナビゲーション（モバイル用） */}
        <nav className="nav-mobile">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`nav-link-mobile ${pathname === item.path ? 'active' : ''}`}
            >
              {item.label}
              {item.badge > 0 && <span className="notify-badge">{item.badge}</span>}
            </Link>
          ))}
        </nav>
      </header>


      {/* LINEログインモーダル */}

      {/* LINE連携モーダル（初回のみ） */}
      {needsLink && (
        <LineLinkModal
          application={application}
          onLinked={async () => {
            setNeedsLink(false);
            await checkAuth();
          }}
          onClose={() => setNeedsLink(false)}
        />
      )}

      {/* 初期ログインモーダル */}
      {isInitialLogin && (
        <Modal title="初期設定">
          <form onSubmit={handleLoginSubmitFirst}>
            <div className="mb-4">
              <label className="block text-forest-700 mb-2 font-medium">本名</label>
              <input
                type="text"
                value={realname}
                onChange={(e) => setRealname(e.target.value)}
                required
                className="input-field"
              />
              <p className="text-sm text-earth-600 mt-1">*名字と名前の間はスペースを空けてください！</p>
            </div>
            <button type="submit" className="btn-primary w-full">
              OK
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
