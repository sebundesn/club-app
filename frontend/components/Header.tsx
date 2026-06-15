'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserInfoStruct } from '../app/utils/schema';
import './header.css'; // Vanilla CSSの読み込み

// ヘッダーコンポーネント：ナビゲーションとユーザー認証機能を提供
export default function Header() {
  const pathname = usePathname();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInitialLogin, setIsInitialLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [realname, setRealname] = useState('');
  const [userInfo, setUserInfo] = useState<UserInfoStruct>({
    ID: null,
    userName: '',
    role: '',
    isLoggedIn: false,
  });
  const [isScrolled, setIsScrolled] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // スクロール検知
  const handleScroll = () => {
    setIsScrolled(window.scrollY > 20);
  };

  // ログイン処理（パスワード認証）
  const handleLoginSubmitPassword = async (e: React.SubmitEvent<HTMLElement>) => {
    e.preventDefault();

    if (password === '') {
      alert('空欄です。');
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'include',
      });

      if (!res.ok) {
        const errorText = await res.text();
        alert(errorText || 'failed to login');
        setPassword('');
        return;
      }

      const data = await res.json();
      setUserInfo({
        ...userInfo,
        ID: data.id,
        userName: data.name,
        role: data.role,
        isLoggedIn: true,
      });

      data.is_initial ? setIsInitialLogin(true) : setIsInitialLogin(false);

      setPassword('');
      setIsModalOpen(false);
    } catch (error: any) {
      alert(error.message);
    }
  };

  // 初期ログイン時のユーザー情報設定
  const handleLoginSubmitFirst = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (realname === '') {
      alert('名前を書いてください。');
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/firstLogin`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realname, }),
      });

      if (!res.ok) {
        alert('保存に失敗しました。');
        return;
      }

      setIsInitialLogin(false);
      setUserInfo({ ...userInfo, userName: realname});
    } catch (e) {
      alert(`connection error: ${e}`);
    } finally {
      setRealname("");
    }
  };

  // 認証状態の確認
  const checkAuth = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/checkAuth`, {
        method: 'GET',
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        if (data.logged_in) {
          setUserInfo({
            ID: data.id,
            userName: data.name,
            role: data.role,
            isLoggedIn: true,
          });
        }
      }
    } catch (e) {
      console.error('Failed to connect:', e);
    }
  };

  // ログアウト処理
  const handleLogout = async () => {
    if (!window.confirm('ログアウトしますか？')) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/logout`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!res.ok) {
        alert('サーバーエラーです。');
        return;
      }

      setUserInfo({
        ID: null,
        userName: '',
        role: '',
        isLoggedIn: false,
      });
    } catch (e) {
      alert(`logout failed: ${e}`);
    }
  };

  // ナビゲーション項目
  const navItems = [
    { path: '/calendar', label: 'HOME' },
    { path: '/account', label: '会計' },
    { path: '/management', label: '管理画面' },
  ];

  useEffect(() => {
    checkAuth();
  }, []);

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
            onClick={
              userInfo.isLoggedIn ? handleLogout : () => setIsModalOpen(true)
            }
            className="user-menu-btn"
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

      {/* ログインモーダル */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-forest-800 mb-6 text-center">Login</h3>
            <form onSubmit={handleLoginSubmitPassword}>
              <div className="mb-6">
                <label className="block text-forest-700 mb-2 font-medium">学籍番号</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-field"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                >
                  OK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 初期ログインモーダル */}
      {isInitialLogin && (
        <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-forest-800 mb-6 text-center">初期設定</h3>
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
              <button
                type="submit"
                className="btn-primary w-full"
              >
                OK
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}