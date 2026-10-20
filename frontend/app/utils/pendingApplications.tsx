'use client';

import { useCallback, useEffect, useState } from 'react';
import { backendURL } from './api';

const CHANGED = 'applications-changed';

/** 入部申請の状態が変わったこと(承認・却下・読み込み)を、ヘッダーなど他の表示に知らせる。 */
export const notifyApplicationsChanged = () => window.dispatchEvent(new Event(CHANGED));

/** 承認待ちの入部申請の件数。enabled が false(権限がない)のときは取りに行かず 0。 */
export function usePendingApplications(enabled: boolean): number {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${backendURL}/api/applications`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setCount(Array.isArray(data) ? data.length : 0);
    } catch (e) {
      console.error('failed to load pending applications:', e);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期の取得なので state 更新は await のあと。
    load();
    window.addEventListener(CHANGED, load);
    // 開いたままでも、新しい申請に気づけるよう1分おきに取り直す
    const timer = setInterval(load, 60000);
    return () => {
      window.removeEventListener(CHANGED, load);
      clearInterval(timer);
    };
  }, [enabled, load]);

  return enabled ? count : 0;
}
