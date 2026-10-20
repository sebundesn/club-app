'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

interface Props {
  /** 真ん中の画像を押したときに開く、そのイベントの全件ページ */
  href: string;
  label: string;
  thumbs: string[];
}

/** 横にスワイプして見るカバーフロー。真ん中の画像は大きく正面、左右は奥へ傾く。真ん中を押すと全件ページへ、左右を押すとその画像が真ん中に来る。 */
export default function CoverFlow({ href, label, thumbs }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const center = useRef(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    // スクロール位置から、各画像が真ん中からどれだけ離れているかを出して傾ける
    const apply = () => {
      frame = 0;
      const mid = el.scrollLeft + el.clientWidth / 2;
      let nearest = 0;
      let best = Infinity;
      Array.from(el.children).forEach((child, i) => {
        const cell = child as HTMLElement;
        const offset = (cell.offsetLeft + cell.offsetWidth / 2 - mid) / cell.offsetWidth;
        const o = Math.max(-1.5, Math.min(1.5, offset));
        const a = Math.min(Math.abs(o), 1);
        cell.style.transform = `perspective(600px) translateZ(${-a * 120}px) rotateY(${-o * 40}deg)`;
        cell.style.zIndex = String(100 - Math.round(Math.abs(offset) * 10));
        cell.style.opacity = String(1 - Math.min(Math.abs(o), 1.5) * 0.25);
        if (Math.abs(offset) < best) {
          best = Math.abs(offset);
          nearest = i;
        }
      });
      center.current = nearest;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    apply();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [thumbs]);

  const bringToCenter = (i: number) => {
    const el = track.current;
    const cell = el?.children[i] as HTMLElement | undefined;
    if (!el || !cell) return;
    el.scrollTo({ left: cell.offsetLeft - (el.clientWidth - cell.offsetWidth) / 2, behavior: 'smooth' });
  };

  return (
    <div className="la-flow" ref={track} aria-label={label}>
      {thumbs.map((src, i) => (
        <Link
          key={i}
          href={href}
          className="la-flow-cell"
          onClick={(e) => {
            if (i === center.current) return;
            e.preventDefault();
            bringToCenter(i);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 静的エクスポートでは next/image の最適化が使えない */}
          <img src={src} alt="" loading="lazy" draggable={false} />
        </Link>
      ))}
    </div>
  );
}
