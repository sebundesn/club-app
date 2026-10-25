'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// 押し続けてからドラッグが始まるまで。短いとスクロールのつもりの指で始まってしまう
const HOLD_MS = 400;
// 始まる前にこれ以上動いたら、スクロールとみなしてやめる
const MOVE_TOLERANCE = 8;
// 画面の上下の端にこれより近づいたら、ドラッグしたまま自動でスクロールする
const EDGE = 64;
const EDGE_SPEED = 12;
// 離したあと、この間に来た click は無視する(スマホでは click が少し遅れて来る)
const CLICK_GUARD_MS = 500;

/** ドロップ先。要素の data-drop / data-drop-member から読む */
export interface DropTarget {
  zone: string;
  /** 人の上に重ねたとき、その人のID */
  memberID?: number;
}

export interface DragState<T> {
  item: T;
  label: string;
  x: number;
  y: number;
  over: DropTarget | null;
}

const targetAt = (x: number, y: number): DropTarget | null => {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]');
  if (!el) return null;
  const member = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop-member]');
  const memberID = member && el.contains(member) ? Number(member.dataset.dropMember) : undefined;
  return { zone: el.dataset.drop ?? '', memberID };
};

/**
 * 長押しで始まるドラッグ&ドロップ。マウス(左ボタン)とタッチの両方を Pointer Events で扱う。
 * 落とせる場所には data-drop="<zone>"、人の上に重ねられる場所には data-drop-member="<id>" を付ける。
 */
export function useLongPressDrag<T>(onDrop: (item: T, target: DropTarget | null) => void) {
  const [drag, setDrag] = useState<DragState<T> | null>(null);
  const dragRef = useRef<DragState<T> | null>(null);
  const onDropRef = useRef(onDrop);
  // ドラッグを離した直後の click を、ふつうのタップとして扱わないため
  const droppedAt = useRef(0);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  useEffect(() => () => cleanup.current?.(), []);

  const update = useCallback((next: DragState<T> | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  const start = useCallback((e: React.PointerEvent, item: T, label: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    cleanup.current?.();

    const startX = e.clientX;
    const startY = e.clientY;
    let active = false;
    let lastX = startX;
    let lastY = startY;
    let scrollTimer: number | undefined;

    const autoScroll = () => {
      window.clearInterval(scrollTimer);
      const dy = lastY < EDGE ? -EDGE_SPEED : lastY > window.innerHeight - EDGE ? EDGE_SPEED : 0;
      if (dy === 0) return;
      scrollTimer = window.setInterval(() => {
        window.scrollBy(0, dy);
        const cur = dragRef.current;
        if (cur) update({ ...cur, over: targetAt(lastX, lastY) });
      }, 16);
    };

    const timer = window.setTimeout(() => {
      active = true;
      document.body.classList.add('is-dragging');
      navigator.vibrate?.(15);
      update({ item, label, x: lastX, y: lastY, over: targetAt(lastX, lastY) });
    }, HOLD_MS);

    const move = (ev: PointerEvent) => {
      lastX = ev.clientX;
      lastY = ev.clientY;
      if (!active) {
        if (Math.hypot(lastX - startX, lastY - startY) > MOVE_TOLERANCE) end();
        return;
      }
      update({ item, label, x: lastX, y: lastY, over: targetAt(lastX, lastY) });
      autoScroll();
    };

    const up = (ev: PointerEvent) => {
      if (active) {
        droppedAt.current = performance.now();
        const target = targetAt(ev.clientX, ev.clientY);
        end();
        onDropRef.current(item, target);
        return;
      }
      end();
    };

    // ドラッグ中は指でページがスクロールしないようにする(リスナーは passive にしない)
    const blockTouch = (ev: TouchEvent) => {
      if (active) ev.preventDefault();
    };

    const end = () => {
      window.clearTimeout(timer);
      window.clearInterval(scrollTimer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('touchmove', blockTouch);
      document.body.classList.remove('is-dragging');
      cleanup.current = null;
      if (active) update(null);
      active = false;
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', end);
    window.addEventListener('touchmove', blockTouch, { passive: false });
    cleanup.current = end;
  }, [update]);

  /** ドラッグできる要素に付けるもの */
  const bind = useCallback(
    (item: T, label: string) => ({
      onPointerDown: (e: React.PointerEvent) => start(e, item, label),
      // スマホの長押しで出るメニュー(コピーなど)を出さない
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
      'data-draggable': true,
    }),
    [start],
  );

  /** click の最初で呼ぶ。ドラッグを離した直後なら true を返すので、そのときは何もしない */
  const justDropped = useCallback(() => performance.now() - droppedAt.current < CLICK_GUARD_MS, []);

  return { drag, bind, justDropped };
}
