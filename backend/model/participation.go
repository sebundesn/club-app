package model

type EventMember struct {
	EventID int `json:"event_id"`
	UserID int `json:"user_id"`
	UserName string `json:"user_name"`
	Amount int `json:"amount"`
}