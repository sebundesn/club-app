'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserInfoStruct } from '../app/utils/schema';
import { backendURL, readErrorMessage } from '../app/utils/api';
import { useToast } from './Toast';
import Modal from './Modal';
import LineLoginModal from './LineLoginModal';
import LineLinkModal from './LineLinkModal';
import './header.css'; // Vanilla CSSの読み込み

// ヘッダーコンポーネント：ナビゲーションとユーザー認証機能を提供
export default function Header() {
  const pathname = usePathname();
  const { showToast } = useToast();
  const [isInitialLogin, setIsInitialLogin] = useState(false);
  const [needsLink, setNeedsLink] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [realname, setRealname] = useState('');
  const [userInfo, setUserInfo] = useState<UserInfoStruct>({
    ID: null,
    userName: '',
    role: '',
    isLoggedIn: false,
  });
  const [isScrolled, setIsScrolled] = useState(false);

  // 認証状態の確認(ページ遷移ごとに)
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch(`${backendURL}/checkAuth`, {
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
          isLoggedIn: true,
        });
        setNeedsLink(false);
        setIsInitialLogin(Boolean(data.is_initial));
        return;
      }

      setUserInfo({ ID: null, userName: '', role: '', isLoggedIn: false });
      // LINE認証は通ったが、まだ部員レコードと紐づいていない状態
      setNeedsLink(Boolean(data.needs_link));
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
      const res = await fetch(`${backendURL}/firstLogin`, {
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

  // ログアウト処理
  const handleLogout = async () => {
    if (!window.confirm('ログアウトしますか？')) return;

    try {
      const res = await fetch(`${backendURL}/logout`, {
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
        isLoggedIn: false,
      });
      showToast('ログアウトしました。', 'success');
    } catch (e) {
      console.error('failed to logout:', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  // ナビゲーション項目
  const navItems = [
    { path: '/calendar', label: 'HOME' },
    { path: '/account', label: '会計' },
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
      {/* ヘッダー */}
      <header className={`site-header ${isScrolled ? 'scrolled' : ''}`}>
        <div className="header-container">
          {/* ロゴ */}
          <Link href="/calendar" className="header-logo">
            ワンダーフォーゲル部
          </Link>

          {/* ナビゲーション（PC用） */}
          <nav className="nav-desktop">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`nav-link ${pathname === item.path ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* ユーザーボタン */}
          <button
            onClick={userInfo.isLoggedIn ? handleLogout : () => setShowLogin(true)}
            className="user-menu-btn"
            aria-label={userInfo.isLoggedIn ? 'ログアウト' : 'LINEでログイン'}
          >
            {userInfo.isLoggedIn ? (
              <span className="user-avatar-text">
                {userInfo.userName[0] || '?'}
              </span>
            ) : (
              <svg className="user-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </button>
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
            </Link>
          ))}
        </nav>
      </header>

      {/* メインコンテンツのオフセット */}
      <div className="header-offset" />

      {/* LINEログインモーダル */}
      {showLogin && !userInfo.isLoggedIn && <LineLoginModal onClose={() => setShowLogin(false)} />}

      {/* LINE連携モーダル（初回のみ） */}
      {needsLink && <LineLinkModal onLinked={async () => { setNeedsLink(false); await checkAuth(); }} />}

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
