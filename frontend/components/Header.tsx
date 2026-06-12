'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserInfoStruct } from '../app/utils/schema';

// ヘッダーコンポーネント：ナビゲーションとユーザー認証機能を提供
export default function Header() {
  const pathname = usePathname();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInitialLogin, setIsInitialLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [realname, setRealname] = useState('');
  const [username, setUsername] = useState('');
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
  const handleLoginSubmitPassword = async (e: React.FormEvent<HTMLFormElement>) => {
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

    if (username === '' || realname === '') {
      alert('本名とユーザ名を書いてください。');
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/firstLogin`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realname, username }),
      });

      if (!res.ok) {
        alert('保存に失敗しました。');
        return;
      }

      setIsInitialLogin(false);
    } catch (e) {
      alert(`connection error: ${e}`);
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
    { path: '/calendar', label: 'ホーム' },
    { path: '/account', label: '会計' },
    { path: '/management', label: '管理画面' },
  ];

  useEffect(() => {
    checkAuth();
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <>
      {/* ヘッダー */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-earth-50/95 backdrop-blur-sm shadow-md py-3'
            : 'bg-earth-50 py-4'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
          {/* ロゴ */}
          <Link href="/calendar" className="text-2xl font-bold text-forest-700">
            ワンダーフォーゲル部
          </Link>

          {/* ナビゲーション */}
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                  pathname === item.path
                    ? 'bg-forest-600 text-white font-medium'
                    : 'text-forest-800 hover:bg-forest-100'
                }`}
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
            className="flex items-center justify-center w-12 h-12 rounded-full bg-forest-100 border-2 border-forest-300 hover:bg-forest-200 transition-all duration-200 hover:shadow-md"
          >
            {userInfo.isLoggedIn ? (
              <span className="text-lg font-bold text-forest-700">
                {userInfo.userName[0]?.toUpperCase() || '?'}
              </span>
            ) : (
              <svg className="w-6 h-6 text-forest-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </button>
        </div>

        {/* モバイルナビゲーション */}
        <nav className="md:hidden mt-3 flex items-center justify-center gap-3 px-4">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                pathname === item.path
                  ? 'bg-forest-600 text-white font-medium'
                  : 'text-forest-800 hover:bg-forest-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* メインコンテンツのオフセット */}
      <div className="h-24 md:h-20" />

      {/* ログインモーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setIsModalOpen(false)}>
          <div className="bg-earth-50 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-forest-800 mb-6 text-center">Login</h3>
            <form onSubmit={handleLoginSubmitPassword}>
              <div className="mb-6">
                <label className="block text-forest-700 mb-2 font-medium">学籍番号</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border-2 border-earth-300 focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200 transition-all"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-lg bg-earth-200 text-forest-800 font-medium hover:bg-earth-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 rounded-lg bg-forest-600 text-white font-medium hover:bg-forest-700 transition-all"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setIsInitialLogin(false)}>
          <div className="bg-earth-50 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-forest-800 mb-6 text-center">初期設定</h3>
            <form onSubmit={handleLoginSubmitFirst}>
              <div className="mb-4">
                <label className="block text-forest-700 mb-2 font-medium">本名</label>
                <input
                  type="text"
                  value={realname}
                  onChange={(e) => setRealname(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border-2 border-earth-300 focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200 transition-all"
                />
                <p className="text-sm text-earth-600 mt-1">*名字と名前の間はスペースを空けてください！</p>
              </div>
              <div className="mb-6">
                <label className="block text-forest-700 mb-2 font-medium">ユーザー名</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border-2 border-earth-300 focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200 transition-all"
                />
              </div>
              <button
                type="submit"
                className="w-full px-4 py-3 rounded-lg bg-forest-600 text-white font-medium hover:bg-forest-700 transition-all"
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
