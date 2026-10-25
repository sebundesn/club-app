// 本番は同一オリジン(CloudFront経由)なので空文字を指定する。未設定のときだけローカル用の値を使う。
export const backendURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

/**
 * レシートの表示URL。S3の有効期限付きURLは絶対URLなのでそのまま使い、
 * 旧データのサーバー内パス(/uploads/...)だけバックエンドのURLを前に付ける。
 */
export const receiptSrc = (url: string): string =>
  /^https?:\/\//.test(url) ? url : `${backendURL}${url}`;

/** イベントのPDF・画像の表示URL。本番は /media/... の同一オリジン、ローカルはバックエンドの /uploads/... */
export const eventFileSrc = receiptSrc;

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
