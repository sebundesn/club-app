import React from 'react';

interface LineLoginButtonProps {
  onClick: () => void;
}

/**
 * LINEログインボタン。色・文言はLINEのガイドライン(基本色 #06C755、日本語の推奨表記)に合わせている。
 * 狭い画面では短い表記(ログイン)にして、ヘッダーに収める。
 */
export default function LineLoginButton({ onClick }: LineLoginButtonProps) {
  return (
    <button type="button" className="line-login-btn" onClick={onClick} aria-label="LINEでログイン">
      <span className="line-login-icon">
        {/* 静的エクスポートでは next/image の最適化が使えない。LINE公式のアイコンをそのまま表示する */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/line-login/line_icon.png" alt="" width={44} height={44} />
      </span>
      <span className="line-login-text line-login-text-long">LINEでログイン</span>
      <span className="line-login-text line-login-text-short">ログイン</span>
    </button>
  );
}
