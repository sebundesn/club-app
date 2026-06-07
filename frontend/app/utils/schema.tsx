export interface DateTitle {
  date: string;
  title: string;
};

export interface EventStruct {
  Date: string;
  Title: string;
  Subtitle: string;
  Content: string;
  PDFPath: string;
};

export interface MoneyLogStruct {
  date: string;
  content: string;
  amount: number | "";
};

export interface ReceiptDataStruct {
  ID: number;
  Title: string;
  Date: string;
  ImageURLs: string[];
};

export interface CSVRow {
  学籍番号: string;
  名前: string;
  役職?: string;
  [key: string]: string | undefined;
};

export interface MemberInfo {
  student_id: string;
  name: string;
  role: string;
};

export interface UserInfoStruct {
  ID: number | null;
  userName: string;
  role: string;
  isLoggedIn: boolean;
};