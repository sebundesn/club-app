package schema

// for club money log
type MoneyLogStruct struct {
	Date    string `json:"date"`
	Content string `json:"content"`
	Amount  int    `json:"amount"`
}

// for club recipt info
type EventRecipts struct {
	ID     int     `json:"id"`
	Title  string   `json:"title"`
	Date   string   `json:"date"`
	Images []string `json:"images"`
}
