package feature

import (
	"encoding/json"
	"fmt"
	"net/http"

	"club-app/query"
	"club-app/model"
	"club-app/util"
)

func SaveMoneyLog(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return fmt.Errorf("method not allowed: %s", r.Method)
	}

	session, err := util.Store.Get(r, "club-app-session")
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

	var l model.MoneyLogStruct
	if err := json.NewDecoder(r.Body).Decode(&l); err != nil {
		return fmt.Errorf("failed to decode: %w", err)
	}

	if _, err := util.DB.Exec(query.AddLog, l.Date, l.Content, l.Amount); err != nil {
		return fmt.Errorf("failed to execute in sql: %w", err)
	}

	return nil
}

func GetAccountInfo(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return fmt.Errorf("Method not allowed %s", r.Method)
	}

	year := r.URL.Query().Get("year")
	rows, err := util.DB.Query(query.MoneyInfo, year+"%")
	if err != nil {
		return fmt.Errorf("failed to execute query: %w", err)
	}
	defer rows.Close()

	var moneyLogs []model.MoneyLogStruct
	for rows.Next() {
		var log model.MoneyLogStruct
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
	err := util.DB.QueryRow(query.MoneySum).Scan(&sum)
	if err != nil {
		return fmt.Errorf("failed to scan sql: %w", err)
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(sum)
}

func DeleteMoneyLog(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return fmt.Errorf("Method not allowed: %s", r.Method)
	}

	session, err := util.Store.Get(r, "club-app-session")
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

	var req model.MoneyLog
	err = json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		return fmt.Errorf("Failed to decode: %w", err)
	}

	_, err = util.DB.Exec(query.DelMoneyLog, req.Date, req.Content, req.Amount)
	if err != nil {
		return fmt.Errorf("Failed to delete in sql: %w", err)
	}

	return nil
}
