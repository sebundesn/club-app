package feature

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
	"errors"

	"club-app/query"
	"club-app/util"
	"club-app/model"
)


func GetMonthNotes(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return fmt.Errorf("method not allowed: %s", r.Method)
	}

	month := r.URL.Query().Get("month")

	rows, err := util.DB.Query(query.SelectMonthNotes, month+"%")
	if err != nil {
		return err
	}
	defer rows.Close()

	type EventSummary struct {
		Date  string `json:"date"`
		Title string `json:"title"`
	}

	var events []EventSummary
	var e EventSummary
	var t time.Time

	for rows.Next() {
		if err := rows.Scan(&t, &e.Title); err != nil {
			return err
		}
		e.Date = t.Format("2006-01-02")

		events = append(events, e)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("failed to iterate rows: %w", err)
	}

	//      func (enc *Encoder) Encode(v any) error
	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(events)
}

func GetDateEvent(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return fmt.Errorf("method not allowed: %w", r.Method)
	}

	date := r.URL.Query().Get("date")

	var event model.EventDetail
	row := util.DB.QueryRow(query.GetDateEvent, date)
	err := row.Scan(&event.Title, &event.Subtitle, &event.Content, &event.PDFPath)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			w.Header().Set("Content-Type", "application/json")
			return json.NewEncoder(w).Encode(model.EventDetail{})
		}

		return fmt.Errorf("failed to scan row: %w", err)
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(event)
}

func SaveNote(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return fmt.Errorf("method not allowed: %s", r.Method)
	}

	session, err := util.Store.Get(r, "club-app-session")
	if err != nil {
		return fmt.Errorf("session failure: %w", err)
	}

	userRole, ok := session.Values["role"].(string)
	if !ok {
		return fmt.Errorf("authorization error: %v", ok)
	}
	if !(userRole == "部長" || userRole == "副部長") {
		return fmt.Errorf("authorization not allowed: %s", userRole)
	}

	var e struct {
		Date     string `json:"date"`
		Title    string `json:"title"`
		Subtitle string `json:"subtitle"`
		Content  string `json:"content"`
		PDF_path string `json:"pdf_path"`
	}

	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		return fmt.Errorf("failed to decode r.Body: %w", err)
	}

	_, err = util.DB.Exec(query.UpSertDateContent, e.Date, e.Title, e.Subtitle, e.Content, e.PDF_path)
	if err != nil {
		return fmt.Errorf("failed to sql execution: %w", err)
	}

	return nil
}
