package model

// LinkAccountRequest は初回LINEログイン時に送られる学籍番号。
type LinkAccountRequest struct {
	StudentID string `json:"student_id"`
	// 未登録の学籍番号で申請するときに必要
	Name string `json:"name"`
}

type UserInfo struct {
	ID   int    `json:"id"`
	Role string `json:"role"`
	Name string `json:"name"`
}
