package middleware

import (
	"encoding/json"
	"net/http"

	"club-app/util"
)

// CheckAuthHandler は現在のログイン状態を返す。
// セッションの値はログアウト後などに期待した型でないことがあるため、
// チェックなしの型アサーションはせず util.CurrentUser 経由で読む。
func CheckAuthHandler(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return util.MethodNotAllowed(r.Method)
	}

	w.Header().Set("Content-Type", "application/json")

	user, err := util.CurrentUser(r)
	if err != nil {
		return err
	}

	if user == nil {
		// LINE認証は通ったが学籍番号との紐づけがまだ、という状態をフロントに伝える
		return json.NewEncoder(w).Encode(map[string]interface{}{
			"logged_in":  false,
			"needs_link": hasPendingLineAccount(r),
		})
	}

	// 名前が未設定なら初期設定モーダルを出してもらう
	return json.NewEncoder(w).Encode(map[string]interface{}{
		"id":         user.ID,
		"role":       user.Role,
		"name":       user.Name,
		"logged_in":  true,
		"needs_link": false,
		"is_initial": user.Name == "",
	})
}

func hasPendingLineAccount(r *http.Request) bool {
	session, err := util.Store.Get(r, util.SessionName)
	if err != nil {
		return false
	}

	pending, ok := session.Values[util.PendingLineIDKey].(string)
	return ok && pending != ""
}
