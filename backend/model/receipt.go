package model

// ReceiptImage はレシート1枚。URL は表示用で、S3のものは有効期限が付く。
type ReceiptImage struct {
	ID  int    `json:"id"`
	URL string `json:"url"`
}

// for club recipt info
type EventReceipts struct {
	ID     int            `json:"id"`
	Title  string         `json:"title"`
	Date   string         `json:"date"`
	Images []ReceiptImage `json:"images"`
}

// ReceiptsPage は一覧の1回分。HasMore はその向きにまだ続きがあるか。
type ReceiptsPage struct {
	Events  []EventReceipts `json:"events"`
	HasMore bool            `json:"hasMore"`
}

// DeleteImageRequest は削除対象のレシート画像。
// 表示用のURLは有効期限付きで毎回変わるので、URLではなく画像の ID で指す。
type DeleteImageRequest struct {
	EventID int `json:"event_id"`
	ImageID int `json:"image_id"`
}
