package model

type EventMember struct {
	EventID  int    `json:"event_id"`
	UserID   int    `json:"user_id"`
	UserName string `json:"user_name"`
	Amount   int    `json:"amount"`
}

// ClubMember は react-select の選択肢に渡す形。
// フロントが {value, label} を要求するのでそのまま合わせている。
type ClubMember struct {
	Value int    `json:"value"`
	Label string `json:"label"`
}

// TakePartInRequest はイベントの参加者リストの保存リクエスト。
type TakePartInRequest struct {
	EventID int   `json:"event_id"`
	UserIDs []int `json:"user_ids"`
}
