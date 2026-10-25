export interface DateTitle {
  id: number;
  date: string;
  title: string;
};

export interface EventStruct {
  ID: number;
  Date: string;
  Title: string;
  Subtitle: string;
  Content: string;
  PDFPath: string;
  /** すでに付いているPDF・画像 */
  Files: EventFile[];
};

/** イベントに付けたPDF・画像 */
export interface EventFile {
  id: number;
  kind: 'pdf' | 'image';
  /** 元のファイル名(表示用) */
  name: string;
  url: string;
}

/** バックエンドの /getDateEvent が返す1件分のイベント */
export interface EventDetail {
  id: number;
  title: string;
  subtitle: string;
  content: string;
  pdf_path: string;
  files: EventFile[] | null;
};

export interface MoneyLogStruct {
  id: number;
  date: string;
  content: string;
  amount: number;
};

/** 追加フォームの入力中の値。金額は入力途中に '' や '-' になりうる。 */
export interface NewMoneyLog {
  date: string;
  content: string;
  amount: number | string;
};

export interface ReceiptImage {
  id: number;
  url: string;
}

export interface ReceiptDataStruct {
  ID: number;
  Title: string;
  Date: string;
  Images: ReceiptImage[];
};

export interface UserInfoStruct {
  ID: number | null;
  userName: string;
  role: string;
  /** LINEのプロフィール画像のURL。未保存なら空 */
  picture: string;
  isLoggedIn: boolean;
};

/** react-select の選択肢。バックエンドも同じ形で返す。 */
export interface MemberOption {
  value: number;
  label: string;
};

/** イベントの参加者と支払額 */
export interface EventMember {
  event_id: number;
  user_id: number;
  user_name: string;
  amount: number;
  paid: boolean;
};

/** アルバムの1件(写真・動画) */
export interface MediaItem {
  id: number;
  kind: 'photo' | 'video';
  url: string;
  thumb_url: string;
  status: 'processing' | 'ready';
  mine: boolean;
  can_delete: boolean;
}

export interface MediaAlbum {
  event_id: number;
  title: string;
  date: string;
  items: MediaItem[];
  photo_count: number;
  photo_limit: number;
  video_count: number;
  video_limit: number;
}

/** 部費の未払い1件。user_id / user_name は会計用の全員分の一覧でだけ入る */
export interface UnpaidItem {
  event_id: number;
  title: string;
  date: string;
  amount: number;
  user_id?: number;
  user_name?: string;
}

export interface UnpaidResponse {
  items: UnpaidItem[];
  total: number;
}

/** 承認待ちの入部申請 */
export interface Application {
  id: number;
  student_id: string;
  name: string;
  created_at: string;
}

/** 会計用の全部員の支払い状況(部員1人・イベント1件ぶん) */
export interface MemberPayment {
  event_id: number;
  title: string;
  date: string;
  user_id: number;
  user_name: string;
  amount: number;
  paid: boolean;
}

/** アルバム一覧の1件(イベントごとの表紙と枚数) */
export interface AlbumSummary {
  event_id: number;
  title: string;
  date: string;
  preview_urls: string[];
  photo_count: number;
  video_count: number;
}

/** 役職ページの部員一覧の1人分 */
export interface Member {
  id: number;
  student_id: string;
  name: string;
  /** 部長・副部長・会計。役職なしは空 */
  role: string;
  /** LINEと連携済み(ログインできる)か */
  linked: boolean;
}
