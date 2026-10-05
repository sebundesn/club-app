'use client';

import React, { useState } from 'react';
import Modal from './Modal';
import { useToast } from './Toast';
import { backendURL, readErrorMessage } from '../app/utils/api';

interface LineLinkModalProps {
  /** 連携に成功したあとに呼ばれる */
  onLinked: () => void | Promise<void>;
}

/** 初回ログイン時に学籍番号でLINEアカウントを部員レコードに紐づけるモーダル。閉じられない。 */
export default function LineLinkModal({ onLinked }: LineLinkModalProps) {
  const { showToast } = useToast();
  const [studentID, setStudentID] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (studentID.trim() === '') {
      showToast('学籍番号を入力してください。', 'error');
      return;
    }

    try {
      const res = await fetch(`${backendURL}/api/auth/line/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentID.trim() }),
        credentials: 'include',
      });

      if (!res.ok) {
        showToast(await readErrorMessage(res, '連携に失敗しました。'), 'error');
        return;
      }

      setStudentID('');
      showToast('LINEアカウントを連携しました。', 'success');
      await onLinked();
    } catch (e) {
      console.error('failed to link line account:', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  return (
    <Modal title="部員情報との連携">
      <p className="text-sm text-earth-600 mb-4">
        初回のみ学籍番号の入力が必要です。次回からはLINEでログインするだけで利用できます。
      </p>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-forest-700 mb-2 font-medium">学籍番号</label>
          <input
            type="text"
            value={studentID}
            onChange={(e) => setStudentID(e.target.value)}
            required
            className="input-field"
          />
        </div>
        <button type="submit" className="btn-primary w-full">
          連携する
        </button>
      </form>
    </Modal>
  );
}
