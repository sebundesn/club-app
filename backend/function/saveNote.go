package function

import (
	"club-app/SQLquery"
	"club-app/utility"
	"encoding/json"
	"fmt"
	"net/http"
)

func SaveNote(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return fmt.Errorf("method not allowed: %s", r.Method)
	}

	session, err := utility.Store.Get(r, "club-app-session")
	if err != nil {
		return fmt.Errorf("session failure: %w", err)
	}

	userRole, ok := session.Values["role"].(string)
	if !ok {
		return fmt.Errorf("authorization error: %v", ok)
	}
	if !(userRole == "部長" || userRole == "副部長") {
		return fmt.Errorf("authorization not allowed: %s", userRole)
	}

	var e struct {
		Date     string `json:"date"`
		Title    string `json:"title"`
		Subtitle string `json:"subtitle"`
		Content  string `json:"content"`
		PDF_path string `json:"pdf_path"`
	}

	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		return fmt.Errorf("failed to decode r.Body: %w", err)
	}

	_, err = utility.DB.Exec(SQLquery.UpSertDateContent, e.Date, e.Title, e.Subtitle, e.Content, e.PDF_path)
	if err != nil {
		return fmt.Errorf("failed to sql execution: %w", err)
	}

	return nil
}
