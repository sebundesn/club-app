package schema

type LoginRequest struct {
	Name string `json:"name"`
	Password string `json:"password"`
}