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

	var req schema.MoneyLog
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		return fmt.Errorf("Failed to decode: %w", err)
	}

	_, err = utility.DB.Exec(SQLquery.DelMoneyLog, req.Date, req.Content, req.Amount)
	if err != nil {
		return fmt.Errorf("Failed to delete in sql: %w", err)
	}

	return nil
}
