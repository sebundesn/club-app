// 一覧の＋ボタンで選んだファイルを、アップロードページに渡すための置き場。
// ページ移動(SPA)の間だけメモリに持つ。再読み込みすると消える。
let pending: File[] = [];

export const setPendingFiles = (files: File[]) => {
  pending = files;
};

export const peekPendingFiles = () => pending;

export const clearPendingFiles = () => {
  pending = [];
};
