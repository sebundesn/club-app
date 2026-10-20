'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

interface Props {
  /** 真ん中の画像を押したときに開く、そのイベントの全件ページ */
  href: string;
  label: string;
  thumbs: string[];
}

/** 自動で流れる速さ(1秒に何px)と、指で触ったあと自動に戻るまでの時間 */
const SPEED_PX = 25;
const RESUME_MS = 4000;
/** 2枚以上なら同じ並びを3回つなげ、端に来たら1周ぶん戻して切れ目なく回す */
const COPIES = 3;

/** 横にスワイプして見るカバーフロー。真ん中の画像は大きく正面、左右は奥へ傾く。止まらずゆっくり流れ続ける。
 *  真ん中を押すと全件ページへ、左右を押すとその画像が真ん中に来る。 */
export default function CoverFlow({ href, label, thumbs }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const center = useRef(0);
  const loops = thumbs.length >= 2;
  const cells = loops ? Array.from({ length: COPIES }, () => thumbs).flat() : thumbs;

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

    // 1周ぶんの幅(1組目の先頭から2組目の先頭まで)。最初は真ん中の組から始める
    const cellAt = (i: number) => el.children[i] as HTMLElement | undefined;
    const loopWidth = () => (loops ? (cellAt(thumbs.length)?.offsetLeft ?? 0) - (cellAt(0)?.offsetLeft ?? 0) : 0);
    // 真ん中の組の範囲に戻す。同じ並びが続いているので、戻しても見た目は変わらない
    const wrap = (x: number) => {
      const w = loopWidth();
      if (w <= 0) return x;
      while (x < w * 0.5) x += w;
      while (x >= w * 1.5) x -= w;
      return x;
    };
    if (loops) el.scrollLeft = loopWidth();
    apply();

    let auto = 0;
    let pos = el.scrollLeft;
    let last = 0;
    let pausedUntil = 0;
    let visible = true;
    // 流れている間はスナップを外す(付けたままだと少し動かすたびに引き戻される)。触ったら付け直して1枚ずつ止まるように
    const pause = () => {
      pausedUntil = Date.now() + RESUME_MS;
      el.classList.remove('flowing');
    };
    const tick = (now: number) => {
      auto = requestAnimationFrame(tick);
      const dt = last ? Math.min(now - last, 100) : 0;
      last = now;
      if (!visible || document.hidden || Date.now() < pausedUntil) return;
      if (!el.classList.contains('flowing')) {
        el.classList.add('flowing');
        pos = el.scrollLeft;
      }
      pos = wrap(pos + (SPEED_PX * dt) / 1000);
      el.scrollLeft = pos;
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (loops && !reduced) {
      io.observe(el);
      auto = requestAnimationFrame(tick);
      el.addEventListener('pointerdown', pause);
      el.addEventListener('touchstart', pause, { passive: true });
      el.addEventListener('wheel', pause, { passive: true });
    }

    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(auto);
      io.disconnect();
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      el.removeEventListener('pointerdown', pause);
      el.removeEventListener('touchstart', pause);
      el.removeEventListener('wheel', pause);
    };
  }, [thumbs, loops]);

  const bringToCenter = (i: number) => {
    const el = track.current;
    const cell = el?.children[i] as HTMLElement | undefined;
    if (!el || !cell) return;
    el.scrollTo({ left: cell.offsetLeft - (el.clientWidth - cell.offsetWidth) / 2, behavior: 'smooth' });
  };

  return (
    <div className="la-flow" ref={track} aria-label={label}>
      {cells.map((src, i) => (
        <Link
          key={i}
          href={href}
          className="la-flow-cell"
          // つなげた2組目以降は、読み上げやタブ移動で同じ画像を繰り返さない
          aria-hidden={i >= thumbs.length || undefined}
          tabIndex={i >= thumbs.length ? -1 : undefined}
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
