package function

import (
	"encoding/json"
	"fmt"
	"net/http"

	"club-app/SQLquery"
	"club-app/schema"
	"club-app/utility"
)

func GetAccountInfo(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return fmt.Errorf("Method not allowed %s", r.Method)
	}

	year := r.URL.Query().Get("year")
	rows, err := utility.DB.Query(SQLquery.MoneyInfo, year+"%")
	if err != nil {
		return fmt.Errorf("failed to execute query: %w", err)
	}
	defer rows.Close()

	var moneyLogs []schema.MoneyLogStruct
	for rows.Next() {
		var log schema.MoneyLogStruct
		if err := rows.Scan(&log.Date, &log.Content, &log.Amount); err != nil {
			return fmt.Errorf("failed to scan row: %w", err)
		}
		moneyLogs = append(moneyLogs, log)
	}

	if err = rows.Err(); err != nil {
		return fmt.Errorf("rows iteration error: %w", err)
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(moneyLogs)
}

func GetMoneyTotal(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return fmt.Errorf("method not allowed :%s", r.Method)
	}
	var sum int
	err := utility.DB.QueryRow(SQLquery.MoneySum).Scan(&sum)
	if err != nil {
		return fmt.Errorf("failed to scan sql: %w", err)
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(sum)
}
