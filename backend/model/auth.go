package model

type LoginRequest struct {
	Password string `json:"password"`
}

type UserInfo struct {
	ID   int    `json:"id"`
	Role string `json:"role"`
	Name string `json:"name"`
}
