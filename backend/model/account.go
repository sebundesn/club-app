package model

// for club money log
type MoneyLogStruct struct {
	Date    string `json:"date"`
	Content string `json:"content"`
	Amount  int    `json:"amount"`
}

type MoneyLog struct {
	Date    string `json:"date"`
	Content string `json:"content"`
	Amount  int    `json:"amount"`
}
