package middleware

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"

	"club-app/query"
	"club-app/model"
	"club-app/util"
)

func LoginHandler(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return fmt.Errorf("Method not allowed: %s", r.Method)
	}

	var req model.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return fmt.Errorf("Decoding request: %w", err)
	}

	var userInfo model.UserInfo
	err := util.DB.QueryRow(query.AuthenticatingQuery, req.Password).Scan(&userInfo.ID, &userInfo.Name, &userInfo.Role)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("invalid credentials")
		}

		return fmt.Errorf("database error: %w", err)
	}

	isInitial := req.Password == userInfo.Name

	session, err := util.Store.Get(r, "club-app-session")
	if err != nil {
		return fmt.Errorf("didn`t get session: %w", err)
	}

	session.Values["authenticated"] = true
	session.Values["id"] = userInfo.ID
	session.Values["name"] = userInfo.Name
	session.Values["role"] = userInfo.Role

	//Cookieのセキュリティ設定
	session.Options.HttpOnly = true
	session.Options.Secure = true                  // Https connection(true in release)
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

func CheckAuthHandler(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return fmt.Errorf("Method not allowed: %s", r.Method)
	}

	session, err := util.Store.Get(r, "club-app-session")
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return fmt.Errorf("session error: %w", err)
	}

	auth, ok := session.Values["authenticated"].(bool)
	if !ok || !auth {
		w.Header().Set("Content-Type", "application/json")
		return json.NewEncoder(w).Encode(map[string]interface{}{"logged_in": false})
	}

	id := session.Values["id"].(int)
	name := session.Values["name"].(string)
	role := session.Values["role"].(string)

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(map[string]interface{}{
		"id":        id,
		"role":      role,
		"name":      name,
		"logged_in": true,
	})
}
