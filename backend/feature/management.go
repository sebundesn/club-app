package feature

import (
	"encoding/json"
	"fmt"
	"net/http"

	"club-app/query"
	"club-app/model"
	"club-app/util"
)

func FetchMembers(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return fmt.Errorf("Method not allowed: %s", r.Method)
	}

	rows, err := util.DB.Query(query.SelectMembers)
	if err != nil {
		return fmt.Errorf("SQL error: %w", err)
	}
	defer rows.Close()

	var members []model.Member
	var row model.Member
	for rows.Next() {
		err := rows.Scan(&row.StudentID, &row.Name, &row.Role)
		if err != nil {
			return fmt.Errorf("Failed to Scan: %w", err)
		}

		members = append(members, row)
	}

	return json.NewEncoder(w).Encode(members)
}

func UpdateMembers(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return fmt.Errorf("Method not allowed : %s", r.Method)
	}

	var members []model.Member
	if err := json.NewDecoder(r.Body).Decode(&members); err != nil {
		return fmt.Errorf("failed to decode: %w", err)
	}

	for _, m := range members {
		_, err := util.DB.Exec(query.UpsertMembersQuery, m.StudentID, m.Name, m.Role)
		if err != nil {
			return fmt.Errorf("Failed to update member ID %s: %w", m.StudentID, err)
		}
	}

	return nil
}
