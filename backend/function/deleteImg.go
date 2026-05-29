package function

import (
	"encoding/json"
	"fmt"
	"net/http"

	"club-app/SQLquery"
	"club-app/schema"
	"club-app/utility"
)

func DeleteImg(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return fmt.Errorf("Method not allowed: %s", r.Method)
	}

	var res schema.DeleteImageRequest
	err := json.NewDecoder(r.Body).Decode(&res)
	if err != nil {
		return fmt.Errorf("Failed to decode: %s", err)
	}
	defer r.Body.Close()

	_, err = utility.DB.Exec(SQLquery.DeleteImgQuery, res.Date, res.URL)
	if err != nil {
		return fmt.Errorf("Failed to delete url: %s", res.URL)
	}

	return nil
}
