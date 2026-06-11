package function

import(
	"net/http"
	"fmt"
	"encoding/json"

	"club-app/utility"
	"club-app/SQLquery"
)

func FirstLogin(w http.Request, r *http.Request) error {
	if r.Method != http.MethodPost {
		return fmt.Errorf("Method not allowed: %s", r.Method)
	}

	var name 
	if err := json.NewEncoder(r.Body).Encode(&name); err != nil {
		return fmt.Errorf("Failed to encode: %w", err)
	}
	defer r.Body.Close()


	session, err := utility.Store.Get(r, "club-app-session")
	if err != nil {
		return fmt.Errorf("session error: %w", err)
	}

	id := session.Values["id"].(int)

	err = utility.DB.Exec(SQLquery.NameChangeFirst, id, name["realname"], name["username"])
	if err != nil {
		return fmt.Errorf("SQL execution error: %w", err)
	}

	return nil
}