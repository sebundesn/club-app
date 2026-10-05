'use client';

import React from 'react';
import Modal from './Modal';
import { backendURL } from '../app/utils/api';

interface LineLoginModalProps {
  onClose: () => void;
}

/** LINEログインの案内モーダル。ボタンでLINEの認可画面へ送る（戻り先はバックエンドの /api/auth/line/callback）。 */
export default function LineLoginModal({ onClose }: LineLoginModalProps) {
  const handleLineLogin = () => {
    window.location.href = `${backendURL}/api/auth/line/login`;
  };

  return (
    <Modal title="ログイン" onClose={onClose}>
      <p className="text-sm text-earth-600 mb-6">
        LINEアカウントでログインします。初回のみ学籍番号の入力が必要です。
      </p>
      <button type="button" className="btn-primary w-full" onClick={handleLineLogin}>
        LINEでログイン
      </button>
    </Modal>
  );
}
