package model

// LinkAccountRequest は初回LINEログイン時に送られる学籍番号。
type LinkAccountRequest struct {
	StudentID string `json:"student_id"`
}

type UserInfo struct {
	ID   int    `json:"id"`
	Role string `json:"role"`
	Name string `json:"name"`
}
