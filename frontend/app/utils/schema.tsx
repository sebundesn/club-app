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
  名前: string;
  役職?: string;
  運転可否?: string;
  [key: string]: string | undefined;
};

export interface MemberInfo {
  id: number;
  name: string;
  role: string;
  isDriver: boolean;
}