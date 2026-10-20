'use client';

import { useCallback, useEffect, useRef } from 'react';

export interface ViewerItem {
  id: number;
  kind: 'photo' | 'video';
  url: string;
  can_delete?: boolean;
}

interface Props {
  items: ViewerItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  /** 渡すと、削除できる項目に「削除」ボタンを出す */
  onDelete?: (item: ViewerItem) => void;
  /** 「写真」「動画」「レシート」など。削除の確認文に使う */
  noun: string;
}

const SWIPE_PX = 50;

/** LINEのアルバムのように、黒地で1枚ずつ見る画面。左右スワイプ・矢印キーで前後に動く。 */
export default function MediaViewer({ items, index, onIndex, onClose, onDelete, noun }: Props) {
  const startX = useRef<number | null>(null);
  const item = items[index];

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next >= 0 && next < items.length) onIndex(next);
    },
    [index, items.length, onIndex],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  if (!item) return null;

  return (
    <div
      className="la-viewer"
      role="dialog"
      aria-modal="true"
      onTouchStart={(e) => {
        startX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (startX.current === null) return;
        const dx = e.changedTouches[0].clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) >= SWIPE_PX) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="la-viewer-bar">
        <button type="button" className="la-icon-btn" aria-label="閉じる" onClick={onClose}>
          ×
        </button>
        <span className="la-viewer-count">
          {index + 1} / {items.length}
        </span>
        <span className="la-icon-btn" aria-hidden="true" />
      </div>

      <div className="la-viewer-stage">
        {item.kind === 'video' ? (
          <video key={item.id} src={item.url} controls playsInline autoPlay />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- 静的エクスポートでは next/image の最適化が使えない
          <img key={item.id} src={item.url} alt="" />
        )}
        {index > 0 && (
          <button type="button" className="la-viewer-nav prev" aria-label="前へ" onClick={() => go(-1)}>
            ‹
          </button>
        )}
        {index < items.length - 1 && (
          <button type="button" className="la-viewer-nav next" aria-label="次へ" onClick={() => go(1)}>
            ›
          </button>
        )}
      </div>

      <div className="la-viewer-foot">
        {onDelete && item.can_delete && (
          <button
            type="button"
            className="la-viewer-delete"
            onClick={() => {
              if (window.confirm(`この${noun}を削除しますか？`)) onDelete(item);
            }}
          >
            削除
          </button>
        )}
      </div>
    </div>
  );
}
