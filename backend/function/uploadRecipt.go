package function

/*
import (
	"net/http"
	"fmt"
	"encoding/json"

	"club-app/schema"
	"club-app/utility"
	"club-app/SQLquery"
)

func UploadRecipt (w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return fmt.Errorf("Method not allowed: %s", r.Method)
	}

	var data schema.EventRecipts
	err := json.NewDecoder(r).Decode(&data)
	if err != nil {
		return fmt.Errorf("failed to decode: %w", err)
	}

	_, err := utility.DB.Exec(SQLquery.InsertRecipts, data.ID, data.Images)
	if err != nil {
		return fmt.Errorf("failed to execute: %w", err)
	}
}
*/
