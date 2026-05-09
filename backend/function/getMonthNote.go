package function

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"club-app/SQLquery"
	"club-app/utility"
)

func GetMonthNotes(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return fmt.Errorf("method not allowed: %s", r.Method)
	}

	month := r.URL.Query().Get("month")

	rows, err := utility.DB.Query(SQLquery.SelectMonthNotes, month+"%")
	if err != nil {
		return err
	}
	defer rows.Close()

	type EventSummary struct {
		Date     string `json:"date"`
		Title    string `json:"title"`
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
