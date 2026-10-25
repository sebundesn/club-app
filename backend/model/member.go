package model

// Member は役職ページの部員一覧の1人分。
type Member struct {
	ID        int    `json:"id"`
	StudentID string `json:"student_id"`
	Name      string `json:"name"`
	Role      string `json:"role"`
	Linked    bool   `json:"linked"`
}

// SetRolesRequest は役職ごとに就く部員のIDの一覧。
// 部長・副部長・会計の全部をまとめて送る(1つでも欠けたら受け付けない)。
type SetRolesRequest struct {
	Roles map[string][]int `json:"roles"`
}
