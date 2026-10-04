package model

// MoneyLogStruct は部費の入出金ログ。
// 削除は重複行をまとめて消さないよう ID で行うため、ID を必ず返す。
type MoneyLogStruct struct {
	ID      int    `json:"id"`
	Date    string `json:"date"`
	Content string `json:"content"`
	Amount  int    `json:"amount"`
}

// DeleteMoneyLogRequest は削除対象のログを指す。
type DeleteMoneyLogRequest struct {
	ID int `json:"id"`
}
