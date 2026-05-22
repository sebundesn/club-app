package auth

import (
	"encoding/json"
	"fmt"
	"net/http"

	"club-app/schema"
	"club-app/utility"
)


func LoginHandler(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return fmt.Errorf("Method not allowed: %s", r.Method)
	}

	var req schema.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return fmt.Errorf("Decoding request: %w", err)
	}

	session, err := utility.Store.Get(r, "club-app-session")
	if err != nil {
		return fmt.Errorf("didnt get session: %w", err)
	}

	session.Values["name"] = req.Name

	//Cookieのセキュリティ設定
	session.Options.HttpOnly = true
	session.Options.Secure = false                  // Https connection(true in release)
	session.Options.SameSite = http.SameSiteLaxMode //CSRF対策
	session.Options.MaxAge = 86400 * 7

	if err := session.Save(r, w); err != nil {
		return fmt.Errorf("Couldn`t save session: %w", err)
	}

	w.WriteHeader(http.StatusOK)
	return json.NewEncoder(w).Encode(map[string]string{"message": "login success!"})
}
