package function

import (
	"encoding/json"
	"fmt"
	"net/http"

	"club-app/SQLquery"
	"club-app/schema"
	"club-app/utility"
)

func SaveMoneyLog(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return fmt.Errorf("method not allowed: %s", r.Method)
	}

	session, err := utility.Store.Get(r, "club-app-session")
	if err != nil {
		return fmt.Errorf("Failed to connect session: %w", err)
	}

	role, ok := session.Values["role"].(string)

	if !ok || role == "" {
		return fmt.Errorf("authorization error; ok: %v, role: %s", ok, role)
	}
	if role != "会計" {
		return fmt.Errorf("authorization not allowed: %s", role)
	}

	var l schema.MoneyLogStruct
	if err := json.NewDecoder(r.Body).Decode(&l); err != nil {
		return fmt.Errorf("failed to decode: %w", err)
	}

	if _, err := utility.DB.Exec(SQLquery.AddLog, l.Date, l.Content, l.Amount); err != nil {
		return fmt.Errorf("failed to execute in sql: %w", err)
	}

	return nil
}
