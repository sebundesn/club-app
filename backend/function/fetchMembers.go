package function

import (
	"encoding/json"
	"fmt"
	"net/http"

	"club-app/SQLquery"
	"club-app/schema"
	"club-app/utility"
)

func FetchMembers(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return fmt.Errorf("Method not allowed: %s", r.Method)
	}

	rows, err := utility.DB.Query(SQLquery.SelectMembers)
	if err != nil {
		return fmt.Errorf("SQL error: %w", err)
	}
	defer rows.Close()

	var members []schema.Member
	var row schema.Member
	for rows.Next() {
		err := rows.Scan(&row.StudentID, &row.Name, &row.Role)
		if err != nil {
			return fmt.Errorf("Failed to Scan: %w", err)
		}

		members = append(members, row)
	}

	return json.NewEncoder(w).Encode(members)
}
