package function

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"club-app/SQLquery"
	"club-app/utility"
	"club-app/schema"
)


func GetDateEvent(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return fmt.Errorf("method not allowed: %w", r.Method)
	}

	date := r.URL.Query().Get("date")

	var event schema.EventDetail
	row := utility.DB.QueryRow(SQLquery.GetDateEvent, date)
	err := row.Scan(&event.Title, &event.Subtitle, &event.Content, &event.PDFPath)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			w.Header().Set("Content-Type", "application/json")
			return json.NewEncoder(w).Encode(schema.EventDetail{})
		}

		return fmt.Errorf("failed to scan row: %w", err)
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(event)
}
