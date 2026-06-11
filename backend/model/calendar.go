package model

import (
	"time"
)

type EventDetail struct {
	Title    string `json:"title"`
	Subtitle string `json:"subtitle"`
	Content  string `json:"content"`
	PDFPath  string `json:"pdf_path"`
}

type CreateTodoRequest struct {
	UserIDs []int     `json:"user_ids"`
	Title   string    `json:"title"`
	Amount  int       `json:"amount"`
	DueDate time.Time `json:"due_date"`
}
