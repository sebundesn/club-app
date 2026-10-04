package model

// for club recipt info
type EventReceipts struct {
	ID     int      `json:"id"`
	Title  string   `json:"title"`
	Date   string   `json:"date"`
	Images []string `json:"images"`
}

// DeleteImageRequest は削除対象のレシート画像。
// 同じ日に複数イベントがありうるので、日付ではなく event_id で指す。
type DeleteImageRequest struct {
	EventID int    `json:"event_id"`
	URL     string `json:"url"`
}
