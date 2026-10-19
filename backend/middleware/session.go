package middleware

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"club-app/query"
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
		lineID := pendingLineID(r)
		return json.NewEncoder(w).Encode(map[string]interface{}{
			"logged_in":  false,
			"needs_link": lineID != "",
			// 申請済みなら pending / rejected。未申請なら空
			"application": applicationStatus(lineID),
		})
	}

	// 開くたびにログインの期限を延ばす(最後に開いてから SessionMaxAge まで保つ)
	util.RefreshSession(w, r)

	// 名前が未設定なら初期設定モーダルを出してもらう
	return json.NewEncoder(w).Encode(map[string]interface{}{
		"picture":    pictureURL(user.ID),
		"id":         user.ID,
		"role":       user.Role,
		"name":       user.Name,
		"logged_in":  true,
		"needs_link": false,
		"is_initial": user.Name == "",
	})
}

// pendingLineID は LINE認証は通ったが部員と未連携の人のLINE ID。いなければ空。
func pendingLineID(r *http.Request) string {
	session, err := util.Store.Get(r, util.SessionName)
	if err != nil {
		return ""
	}

	pending, _ := session.Values[util.PendingLineIDKey].(string)
	return pending
}

// pictureURL は本人のLINEプロフィール画像のURL。未保存(ログインし直す前)なら空。
func pictureURL(userID int) string {
	var picture sql.NullString
	if err := util.DB.QueryRow(query.SelectPictureURL, userID).Scan(&picture); err != nil {
		log.Printf("picture lookup failed: %v", err)
		return ""
	}
	return util.SafePictureURL(picture.String)
}

func applicationStatus(lineID string) string {
	if lineID == "" {
		return ""
	}
	var status string
	err := util.DB.QueryRow(query.SelectApplicationStatus, lineID).Scan(&status)
	if errors.Is(err, sql.ErrNoRows) {
		return ""
	}
	if err != nil {
		log.Printf("application status lookup failed: %v", err)
		return ""
	}
	return status
}
