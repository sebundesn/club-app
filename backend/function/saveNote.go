package function

import (
	"club-app/utility"
	"club-app/SQLquery"
	"encoding/json"
	"fmt"
	"net/http"
)

func SaveNote(w http.ResponseWriter, r *http.Request) error {
	if r.Method == http.MethodPost {
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

		_, err := utility.DB.Exec(SQLquery.UpSertDateContent, e.Date, e.Title, e.Subtitle, e.Content, e.PDF_path)
		if err != nil {
			return fmt.Errorf("failed to sql execution: %w", err)
		}

		return nil

	} else {
		return fmt.Errorf("not POST method")
	}
}
