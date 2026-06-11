package function

import (
	"encoding/json"
	"fmt"
	"net/http"

	"club-app/utility"
)

func CheckAuthHandler(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return fmt.Errorf("Method not allowed: %s", r.Method)
	}

	session, err := utility.Store.Get(r, "club-app-session")
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

func Logout(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return fmt.Errorf("Method not allowed: %s", r.Method)
	}

	session, err := utility.Store.Get(r, "club-app-session")
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
