package model

import (
	"time"
)

// EventDetail は1件のイベント。1日に複数件ありうるので ID を持つ。
type EventDetail struct {
	ID       int    `json:"id"`
	Title    string `json:"title"`
	Subtitle string `json:"subtitle"`
	Content  string `json:"content"`
	PDFPath  string `json:"pdf_path"`
}

// EventSummary はカレンダーの各セルに出す最小限の情報。
type EventSummary struct {
	ID    int    `json:"id"`
	Date  string `json:"date"`
	Title string `json:"title"`
}

// SaveEventRequest はイベントの作成・更新リクエスト。
// ID が 0 なら新規作成、それ以外はその ID の更新。
type SaveEventRequest struct {
	ID       int    `json:"id"`
	Date     string `json:"date"`
	Title    string `json:"title"`
	Subtitle string `json:"subtitle"`
	Content  string `json:"content"`
	PDFPath  string `json:"pdf_path"`
}

// ------------notificate section-------------------------

type Notificate struct {
	ID      int        `json:"id"`
	Title   string     `json:"title"`
	DueDate *time.Time `json:"due_date"`
}
