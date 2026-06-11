package model

// for club recipt info
type EventReceipts struct {
	ID     int      `json:"id"`
	Title  string   `json:"title"`
	Date   string   `json:"date"`
	Images []string `json:"images"`
}

type DeleteImageRequest struct {
	Date string `json:"date"`
	URL  string `json:"url"`
}
