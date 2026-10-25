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
	// UserIDs を指定したときは、その人たち(未払いのみ)の請求額だけを変える。イベントの徴収額は変えない。
	UserIDs []int `json:"user_ids,omitempty"`
}

// MemberPayment は部員1人・イベント1件ぶんの支払い状況。会計用の全員分の一覧で使う。
type MemberPayment struct {
	EventID  int    `json:"event_id"`
	Title    string `json:"title"`
	Date     string `json:"date"`
	UserID   int    `json:"user_id"`
	UserName string `json:"user_name"`
	Amount   int    `json:"amount"`
	Paid     bool   `json:"paid"`
}
