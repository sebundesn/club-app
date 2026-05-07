package function

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"club-app/SQLquery"
	"club-app/utility"
)

type EventDetail struct {
	Subtitle string `json:"subtitle"`
	Content  string `json:"content"`
	PDFPath  string `json:"pdf_path"`
}

func GetDateEvent(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return fmt.Errorf("method not allowed: %s", r.Method)
	}

	date := r.URL.Query().Get("date")

	var event EventDetail
	row := utility.DB.QueryRow(SQLquery.GetDateEvent, date)
	err := row.Scan(&event.Subtitle, &event.Content, &event.PDFPath)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			w.Header().Set("Content-Type", "application/json")
			return json.NewEncoder(w).Encode(EventDetail{})
		}

		return fmt.Errorf("failed to scan row: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(event)
}
