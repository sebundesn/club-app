package function

import (
	"encoding/json"
	"fmt"
	"net/http"

	"club-app/SQLquery"
	"club-app/schema"
	"club-app/utility"
)

func CreateTodoHandler(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return fmt.Errorf("Method not allowed: %s", r.Method)
	}

	fmt.Printf("here")

	var req schema.CreateTodoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return fmt.Errorf("Failed to decode: %w", err)
	}

	for _, userID := range req.UserIDs {
		_, err := utility.DB.Exec(SQLquery.FetchTodos,
			userID, req.Title, req.Amount, req.DueDate)
		if err != nil {
			return fmt.Errorf("Failed to make todos")
		}
	}

	w.WriteHeader(http.StatusCreated)
	return json.NewEncoder(w).Encode(map[string]string{"message": "ToDoを割り当てました。"})
}
