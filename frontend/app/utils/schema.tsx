export interface DateTitle {
  Date: string;
  Title: string;
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
}