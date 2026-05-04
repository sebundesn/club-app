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
	if r.Method == http.MethodGet {
		month := r.URL.Query().Get("month")

		rows, err := utility.DB.Query(SQLquery.SelectMonthNotes, month+"%")
		if err != nil {
			return err
		}
		defer rows.Close()

		type EventSummary struct {
			Date     string `json:"date"`
			Title    string `json:"title"`
			Subtitle string `json:"subtitle"`
		}

		var events []EventSummary
		var e EventSummary
		var t time.Time

		for rows.Next() {
			if err := rows.Scan(&t, &e.Title, &e.Subtitle); err != nil {
				return err
			}
			e.Date = t.Format("2006-01-02")

			events = append(events, e)
		}
		fmt.Printf("monthdata: %v\n", events)

		//      func (enc *Encoder) Encode(v any) error
		w.Header().Set("Content-Type", "application/json")
		return json.NewEncoder(w).Encode(events)

	} else {
		return fmt.Errorf("Not Get Method")
	}
}
