package model

// EventDetail は1件のイベント。1日に複数件ありうるので ID を持つ。
type EventDetail struct {
	ID       int    `json:"id"`
	Title    string `json:"title"`
	Subtitle string `json:"subtitle"`
	Content  string `json:"content"`
	PDFPath  string `json:"pdf_path"`
	// 付いているPDF・画像。無ければ空配列
	Files []EventFile `json:"files"`
}

// EventFile はイベントに付けたPDF・画像1つ。
type EventFile struct {
	ID int `json:"id"`
	// "pdf" か "image"
	Kind string `json:"kind"`
	// 表示用の元のファイル名
	Name string `json:"name"`
	URL  string `json:"url"`
}

// DeleteEventFileRequest は削除するファイル。
type DeleteEventFileRequest struct {
	EventID int `json:"event_id"`
	FileID  int `json:"file_id"`
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
