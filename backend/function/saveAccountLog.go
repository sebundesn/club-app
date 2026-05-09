package function

import (
	"encoding/json"
	"fmt"
	"net/http"

	"club-app/SQLquery"
	"club-app/utility"
	"club-app/schema"
)

func SaveMoneyLog(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return fmt.Errorf("method not allowed: %s", r.Method)
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
