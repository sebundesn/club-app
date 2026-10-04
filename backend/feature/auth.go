package feature

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"club-app/query"
	"club-app/util"
)

// FirstLogin は初回ログイン時に本名を登録する。
func FirstLogin(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return util.MethodNotAllowed(r.Method)
	}

	user, err := util.RequireLogin(r)
	if err != nil {
		return err
	}

	var body map[string]string
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		return util.BadRequest("入力内容を確認してください。", err)
	}
	defer r.Body.Close()

	realname := strings.TrimSpace(body["realname"])
	if realname == "" {
		return util.BadRequest("名前を入力してください。", errors.New("realname is empty"))
	}

	if _, err := util.DB.Exec(query.NameChangeFirst, user.ID, realname); err != nil {
		return util.Internal("保存に失敗しました。", err)
	}

	// DBを更新したらセッション上の名前も合わせて保存し直す
	user.Name = realname
	if err := util.Login(w, r, user); err != nil {
		return err
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(map[string]string{"message": "success"})
}

func Logout(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return util.MethodNotAllowed(r.Method)
	}

	session, err := util.Store.Get(r, util.SessionName)
	if err != nil {
		// Cookieが壊れていてもログアウトは成功扱いでよい
		w.Header().Set("Content-Type", "application/json")
		return json.NewEncoder(w).Encode(map[string]string{"message": "logout success"})
	}

	// 値を空文字で上書きすると型アサーションが壊れるので、キーごと消す
	for key := range session.Values {
		delete(session.Values, key)
	}
	util.ApplyCookieOptions(session.Options)
	session.Options.MaxAge = -1

	if err := session.Save(r, w); err != nil {
		return util.Internal("ログアウトに失敗しました。", err)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	return json.NewEncoder(w).Encode(map[string]string{"message": "logout success"})
}
