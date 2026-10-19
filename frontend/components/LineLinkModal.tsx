'use client';

import React, { useState } from 'react';
import Modal from './Modal';
import { useToast } from './Toast';
import { backendURL, readErrorMessage } from '../app/utils/api';

interface LineLinkModalProps {
  /** 連携に成功したあとに呼ばれる */
  onLinked: () => void | Promise<void>;
  /** 申請済みなら pending / rejected。未申請なら空 */
  application: string;
  /** 連携せずに閉じる(背景クリック・Esc・×)。未連携のままなのでログインはされない。 */
  onClose: () => void;
}

/** 初回ログイン時に学籍番号でLINEアカウントを部員レコードに紐づけるモーダル。 */
export default function LineLinkModal({ onLinked, application, onClose }: LineLinkModalProps) {
  const { showToast } = useToast();
  const [studentID, setStudentID] = useState('');
  const [name, setName] = useState('');
  // 申請を出した直後に、画面を「承認待ち」に切り替えるため
  const [justApplied, setJustApplied] = useState(false);
  const isPending = justApplied || application === 'pending';

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
        body: JSON.stringify({ student_id: studentID.trim(), name: name.trim() }),
        credentials: 'include',
      });

      if (!res.ok) {
        showToast(await readErrorMessage(res, '連携に失敗しました。'), 'error');
        return;
      }

      setStudentID('');
      setName('');
      // 202 は「未登録の学籍番号だったので申請として受け付けた」という意味
      if (res.status === 202) {
        setJustApplied(true);
        return;
      }
      showToast('LINEアカウントを連携しました。', 'success');
      await onLinked();
    } catch (e) {
      console.error('failed to link line account:', e);
      showToast('通信に失敗しました。', 'error');
    }
  };

  if (isPending) {
    return (
      <Modal title="承認待ちです" onClose={onClose}>
        <p className="text-sm text-earth-600 mb-4">
          入部の申請を受け付けました。部長・副部長が承認すると利用できます。
          承認されたら、もう一度LINEでログインしてください。
        </p>
        <button type="button" className="btn-primary w-full" onClick={onClose}>
          閉じる
        </button>
      </Modal>
    );
  }

  return (
    <Modal title="部員情報との連携" onClose={onClose}>
      {application === 'rejected' && (
        <p className="text-sm text-red-600 mb-3">
          前回の申請は承認されませんでした。学籍番号や名前を確認して、もう一度申請できます。
        </p>
      )}
      <p className="text-sm text-earth-600 mb-4">
        初回のみ入力が必要です。登録済みの学籍番号ならすぐ利用できます。未登録の場合は、名前も入力すると
        入部の申請になり、部長・副部長の承認後に利用できます。
      </p>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-forest-700 mb-2 font-medium">学籍番号(半角英数字7文字)</label>
          <input
            type="text"
            value={studentID}
            onChange={(e) => setStudentID(e.target.value)}
            required
            maxLength={7}
            className="input-field"
          />
        </div>
        <div className="mb-4">
          <label className="block text-forest-700 mb-2 font-medium">名前(未登録の方は必須)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            className="input-field"
          />
        </div>
        <button type="submit" className="btn-primary w-full">
          送信
        </button>
      </form>
    </Modal>
  );
}
