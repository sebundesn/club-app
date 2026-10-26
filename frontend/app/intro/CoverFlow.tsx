'use client';

import { useEffect, useRef } from 'react';

export type FlowItem = {
  src: string;
  alt: string;
  badge?: string;
  /** 正方形に切り抜くときに見せる場所(object-position) */
  position?: string;
};

/**
 * アルバムのページと同じ、横にスワイプして見るカバーフロー。
 * 真ん中の写真は大きく正面、左右は奥へ傾く。自動では動かず、スワイプで送る(1枚目から最後の写真まで)。
 * PCではマウスのドラッグでも動かせる。
 */
export default function CoverFlow({ items, label }: { items: FlowItem[]; label: string }) {
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    // スクロール位置から、各写真が真ん中からどれだけ離れているかを出して傾ける
    const apply = () => {
      frame = 0;
      const mid = el.scrollLeft + el.clientWidth / 2;
      Array.from(el.children).forEach((child) => {
        const cell = child as HTMLElement;
        const offset = (cell.offsetLeft + cell.offsetWidth / 2 - mid) / cell.offsetWidth;
        const o = Math.max(-1.5, Math.min(1.5, offset));
        const a = Math.min(Math.abs(o), 1);
        cell.style.transform = `perspective(600px) translateZ(${-a * 120}px) rotateY(${-o * 40}deg)`;
        cell.style.zIndex = String(100 - Math.round(Math.abs(offset) * 10));
        cell.style.opacity = String(1 - Math.min(Math.abs(o), 1.5) * 0.25);
      });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    apply();

    // マウスは横スクロールを持たないので、ドラッグで動かす(指は元々スワイプできる)
    let dragX = 0;
    let dragLeft = 0;
    let dragging = false;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      dragging = true;
      dragX = e.clientX;
      dragLeft = el.scrollLeft;
      el.classList.add('dragging');
    };
    const move = (e: PointerEvent) => {
      if (dragging) el.scrollLeft = dragLeft - (e.clientX - dragX);
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('dragging');
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);

    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [items.length]);

  return (
    <div className="cf" ref={track} aria-label={label} role="group">
      {items.map((it) => (
        <figure key={it.src} className="cf-cell">
          {/* eslint-disable-next-line @next/next/no-img-element -- 静的エクスポートでは next/image の最適化が使えない */}
          <img src={it.src} alt={it.alt} loading="lazy" draggable={false} style={{ objectPosition: it.position }} />
          <figcaption>
            {it.badge && <span className="cf-badge">{it.badge}</span>}
            <span className="cf-caption">{it.alt}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
