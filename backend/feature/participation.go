package feature

import (
	"fmt"
	"net/http"
	"encoding/json"

	"club-app/util"
	"club-app/query"
	"club-app/model"
)

//get students and their payment of specific event
func GetMembersWithPayment (w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return fmt.Errorf("Method not allowed: %s", r.Method)
	}

	id := r.URL.Query().Get("event_id")
	if id == "" {
		return fmt.Errorf("event_id is required")
	}

	rows, err := util.DB.Query(query.GetEventMembers, id)
	if err != nil {
		return fmt.Errorf("query error: %w", err)
	}
	defer rows.Close()

	eventMembers := []model.EventMember{}
	for rows.Next() {
		var em model.EventMember
		err := rows.Scan(&em.EventID, &em.UserID, &em.UserName, &em.Amount)
		if err != nil {
			return fmt.Errorf("Scan error: w", err)
		}
		eventMembers = append(eventMembers, em)
	}

	if err = rows.Err(); err != nil {
		return fmt.Errorf("rows loop error: %w", err)
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(eventMembers)
}

func GetAllClubMembers (w http.ResponseWriter, r *http.Request) error {
	
}