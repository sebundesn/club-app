package model

// UnpaidItem は未払いの1件。UserID / UserName は会計用の全員分の一覧でだけ入る。
type UnpaidItem struct {
	EventID  int    `json:"event_id"`
	Title    string `json:"title"`
	Date     string `json:"date"`
	Amount   int    `json:"amount"`
	UserID   int    `json:"user_id,omitempty"`
	UserName string `json:"user_name,omitempty"`
}

type UnpaidResponse struct {
	Items []UnpaidItem `json:"items"`
	Total int          `json:"total"`
}

type SetPaidRequest struct {
	EventID int  `json:"event_id"`
	UserID  int  `json:"user_id"`
	Paid    bool `json:"paid"`
}

type SetEventFeeRequest struct {
	EventID int `json:"event_id"`
	Fee     int `json:"fee"`
}
