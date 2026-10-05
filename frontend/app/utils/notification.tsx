import { backendURL } from './api';
import { NotificateStruct } from './schema';

// 通知取得。失敗しても画面は動かせるので、詳細は console に出して空配列を返す。
export const GetNotification = async (): Promise<NotificateStruct[]> => {
  try {
    const res = await fetch(`${backendURL}/api/getNotification`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      console.error('failed to get notification:', res.status);
      return [];
    }

    const data = await res.json();

    return data ?? [];
  } catch (e) {
    console.error('failed to get notification:', e);
    return [];
  }
};
