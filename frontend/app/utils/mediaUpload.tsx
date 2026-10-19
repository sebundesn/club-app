import { backendURL, readErrorMessage } from './api';

export const VIDEO_MAX_SEC = 60;
/** サーバーの上限(1リクエストの大きさ・枚数)に収まるよう、まとめて送る枚数を絞る */
export const PHOTOS_PER_REQUEST = 10;
export const RECEIPTS_PER_REQUEST = 3;

export interface UploadResult {
  ok: boolean;
  /** 失敗したときの、利用者向けの理由 */
  error?: string;
}

// 動画の長さをアップロード前に確認する。サーバーでも確認するので、これは待たせないための早期チェック。
export const readVideoDuration = (file: File): Promise<number> =>
  new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('metadata error'));
    };
    video.src = url;
  });

const post = async (path: string, form: FormData, fallback: string): Promise<UploadResult> => {
  try {
    const res = await fetch(`${backendURL}${path}`, { method: 'POST', body: form, credentials: 'include' });
    if (!res.ok) return { ok: false, error: await readErrorMessage(res, fallback) };
    return { ok: true };
  } catch (e) {
    console.error(`failed to upload (${path}):`, e);
    return { ok: false, error: '通信に失敗しました。' };
  }
};

/** 写真(複数可)または動画(1本)をアルバムに送る */
export const uploadMedia = (eventID: number, kind: 'photo' | 'video', files: File[]): Promise<UploadResult> => {
  const form = new FormData();
  form.append('eventID', String(eventID));
  form.append('kind', kind);
  files.forEach((f) => form.append('files', f));
  return post('/api/uploadMedia', form, 'アップロードに失敗しました。');
};

/** レシート・領収書の画像を送る */
export const uploadReceipts = (eventID: number, files: File[]): Promise<UploadResult> => {
  const form = new FormData();
  form.append('eventID', String(eventID));
  files.forEach((f) => form.append('images', f));
  return post('/api/uploadReceipt', form, 'アップロードに失敗しました。');
};

/** files を size 枚ずつに分けて順に送る。途中で失敗したらそこで止め、送れた枚数と理由を返す。 */
export const uploadInBatches = async (
  files: File[],
  size: number,
  send: (batch: File[]) => Promise<UploadResult>,
  onProgress?: (sent: number) => void,
): Promise<{ sent: number; error?: string }> => {
  let sent = 0;
  for (let i = 0; i < files.length; i += size) {
    onProgress?.(sent);
    const batch = files.slice(i, i + size);
    const result = await send(batch);
    if (!result.ok) return { sent, error: result.error };
    sent += batch.length;
  }
  return { sent };
};
