package schema

type MoneyLogStruct struct {
	Date    string `json:"date"`
	Content string `json:"content"`
	Amount  int    `json:"amount"`
}