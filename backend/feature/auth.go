package feature

import (
	"encoding/json"
	"fmt"
	"net/http"

	"club-app/query"
	"club-app/util"
)

func FirstLogin(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return fmt.Errorf("Method not allowed: %s", r.Method)
	}

	var name map[string]string
	if err := json.NewDecoder(r.Body).Decode(&name); err != nil {
		return fmt.Errorf("Failed to encode: %w", err)
	}
	defer r.Body.Close()

	session, err := util.Store.Get(r, "club-app-session")
	if err != nil {
		return fmt.Errorf("session error: %w", err)
	}

	id, ok := session.Values["id"].(int)
	if !ok {
		return fmt.Errorf("session expires")
	}

	_, err = util.DB.Exec(query.NameChangeFirst, id, name["name"])
	if err != nil {
		return fmt.Errorf("SQL execution error: %w", err)
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(map[string]string{"message": "success"})
}

func Logout(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return fmt.Errorf("Method not allowed: %s", r.Method)
	}

	session, err := util.Store.Get(r, "club-app-session")
	if err != nil {
		return fmt.Errorf("session error: %w", err)
	}

	session.Values["authenticated"] = false
	session.Values["id"] = ""
	session.Values["name"] = ""
	session.Values["role"] = ""
	session.Options.MaxAge = -1

	if err := session.Save(r, w); err != nil {
		return fmt.Errorf("Failed to save session")
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	return json.NewEncoder(w).Encode(map[string]string{"message": "logout success"})
}
