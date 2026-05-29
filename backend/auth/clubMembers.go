package auth

import (
	"encoding/json"
	"fmt"
	"net/http"

	"club-app/SQLquery"
	"club-app/schema"
	"club-app/utility"
)

func UpdateMembers(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return fmt.Errorf("Method not allowed : %s", r.Method)
	}

	var members []schema.Member
	if err := json.NewDecoder(r.Body).Decode(&members); err != nil {
		return fmt.Errorf("failed to decode: %w", err)
	}

	for _, m := range members {
		_, err := utility.DB.Exec(SQLquery.UpsertMembersQuery, m.StudentID, m.Name, m.Role)
		if err != nil {
			return fmt.Errorf("Failed to update member ID %s: %w", m.StudentID, err)
		}
	}

	return nil
}
