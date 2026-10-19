'use client';

import React, { useEffect, useRef, useState } from 'react';

interface UserMenuProps {
  userName: string;
  /** LINEのプロフィール画像のURL。未保存(ログインし直す前)なら空 */
  picture: string;
  onLogout: () => void;
}

/** ヘッダー右上の、自分のLINEアイコン。押すと名前とログアウトが開く。 */
export default function UserMenu({ userName, picture, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // メニューの外を押す・Escキーで閉じる
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // LINEの画像URLは末尾に /small を付けると小さい画像が返る(通信量を抑える)
  const src = picture && !imageFailed ? `${picture}/small` : '';

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className="user-avatar-btn"
        aria-label="アカウントメニュー"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {src ? (
          // LINEの画像サーバーから直接読み込む。静的エクスポートでは next/image の最適化が使えない。
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" width={44} height={44} onError={() => setImageFailed(true)} />
        ) : (
          <span className="user-avatar-initial">{userName[0] || '?'}</span>
        )}
      </button>

      {open && (
        <div className="user-menu-panel" role="menu">
          <p className="user-menu-name">{userName || '(名前未設定)'}</p>
          <button
            type="button"
            className="user-menu-logout"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            ログアウト
          </button>
        </div>
      )}
    </div>
  );
}
