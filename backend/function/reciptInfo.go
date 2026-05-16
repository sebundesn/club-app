package function

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"

	"club-app/SQLquery"
	"club-app/schema"
	"club-app/utility"
)

func GetMonthReceipts(w http.ResponseWriter, r *http.Request) error {
	fmt.Printf("ここまで来た")
	if r.Method != http.MethodGet {
		return fmt.Errorf("Method not allowed: %s", r.Method)
	}

	howLongMonth := r.URL.Query().Get("howLongMonth")
	if howLongMonth == "" {
		howLongMonth = "1"
	}

	rows, err := utility.DB.Query(SQLquery.GetReciptLog, howLongMonth)
	if err != nil {
		return fmt.Errorf("Failed to get rows: %w", err)
	}
	defer rows.Close()

	eventsMap := make(map[int]*schema.EventRecipts)
	var order []int

	for rows.Next() {
		var id int
		var title, date string
		var imgURL sql.NullString

		err := rows.Scan(&id, &title, &date, &imgURL)
		if err != nil {
			return err
		}

		if _, ok := eventsMap[id]; !ok {
			eventsMap[id] = &schema.EventRecipts{
				Title:  title,
				Date:   date,
				Images: []string{},
			}
			order = append(order, id)
		}

		if imgURL.Valid {
			eventsMap[id].Images = append(eventsMap[id].Images, imgURL.String)
		}
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("error during rows iteration: %w", err)
	}

	var recipts []schema.EventRecipts
	for _, id := range order {
		recipts = append(recipts, *eventsMap[id])
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(recipts)
}
