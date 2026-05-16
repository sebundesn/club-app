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
}