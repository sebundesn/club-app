package function

import (
	"encoding/json"
	"fmt"
	"net/http"

	"club-app/SQLquery"
	"club-app/schema"
	"club-app/utility"
)

func DeleteMoneyLog(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return fmt.Errorf("Method not allowed: %s", r.Method)
	}

	session, err := utility.Store.Get(r, "club-app-session")
	if err != nil {
		return fmt.Errorf("session failure: %w", err)
	}
	role, ok := session.Values["role"].(string)
	if !ok {
		return fmt.Errorf("Authorization Error; ok: %v, role: %s", ok, role)
	}

	if role != "会計" {
		return fmt.Errorf("authorization not allowed: %s", role)
	}

	var req schema.MoneyLog
	err = json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		return fmt.Errorf("Failed to decode: %w", err)
	}

	_, err = utility.DB.Exec(SQLquery.DelMoneyLog, req.Date, req.Content, req.Amount)
	if err != nil {
		return fmt.Errorf("Failed to delete in sql: %w", err)
	}

	return nil
}
