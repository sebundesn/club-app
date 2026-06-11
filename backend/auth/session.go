package auth

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"

	"club-app/SQLquery"
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

	var userInfo schema.UserInfo
	err := utility.DB.QueryRow(SQLquery.AuthenticatingQuery, req.Password).Scan(&userInfo.ID, &userInfo.Name, &userInfo.Role)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("invalid credentials")
		}

		return fmt.Errorf("database error: %w", err)
	}

	isInitial := req.Password == userInfo.Name

	session, err := utility.Store.Get(r, "club-app-session")
	if err != nil {
		return fmt.Errorf("didn`t get session: %w", err)
	}

	session.Values["authenticated"] = true
	session.Values["id"] = userInfo.ID
	session.Values["name"] = userInfo.Name
	session.Values["role"] = userInfo.Role

	//Cookieのセキュリティ設定
	session.Options.HttpOnly = true
	session.Options.Secure = false                  // Https connection(true in release)
	session.Options.SameSite = http.SameSiteLaxMode //CSRF対策
	session.Options.MaxAge = 86400 * 7

	if err := session.Save(r, w); err != nil {
		return fmt.Errorf("Couldn`t save session: %w", err)
	}

	w.WriteHeader(http.StatusOK)
	return json.NewEncoder(w).Encode(map[string]interface{}{
		"message":    "login success!",
		"is_initial": isInitial,
		"name":       userInfo.Name,
	})
}
