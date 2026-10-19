package model

import "time"

// Application は承認待ちの入部申請。
type Application struct {
	ID        int       `json:"id"`
	StudentID string    `json:"student_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type DecideApplicationRequest struct {
	ID      int  `json:"id"`
	Approve bool `json:"approve"`
}
