'use client';

import React, { useEffect } from 'react';
import './modal.css';

interface ModalProps {
  title: string;
  children: React.ReactNode;
  /** 渡すと × ボタン・背景クリック・Esc で閉じられる。渡さなければ閉じられないモーダルになる。 */
  onClose?: () => void;
}

/** 共通のモーダル。各画面の .modal-overlay とは別クラスなので CSS が衝突しない。 */
export default function Modal({ title, children, onClose }: ModalProps) {
  useEffect(() => {
    if (!onClose) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="app-modal-overlay" onClick={onClose}>
      <div
        className="app-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {onClose && (
          <button type="button" className="app-modal-close" aria-label="閉じる" onClick={onClose}>
            ×
          </button>
        )}
        <h3 className="app-modal-title">{title}</h3>
        {children}
      </div>
    </div>
  );
}
