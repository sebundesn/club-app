export const backendURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

/**
 * バックエンドは失敗時に {"message": "..."} を返す。
 * message はユーザー向けの日本語文言だけで、内部エラーはサーバーのログにしか出ない。
 * 読めなければステータスコードから当たり障りのない文言にフォールバックする。
 */
export const readErrorMessage = async (res: Response, fallback: string): Promise<string> => {
  try {
    const data = await res.json();
    if (data && typeof data.message === 'string' && data.message !== '') {
      return data.message;
    }
  } catch {
    // JSON でない（プロキシのエラーページ等）場合はフォールバックする
  }

  switch (res.status) {
    case 400:
      return '入力内容を確認してください。';
    case 401:
      return 'ログインしてください。';
    case 403:
      return 'この操作をする権限がありません。';
    case 404:
      return '対象が見つかりませんでした。';
    case 405:
      return '許可されていない操作です。';
    default:
      return fallback;
  }
};
