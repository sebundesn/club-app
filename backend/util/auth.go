package util

import (
	"errors"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gorilla/sessions"
)

// セッション名とロール名は各ハンドラで直書きされていたので定数にまとめた
const SessionName = "club-app-session"

const (
	RoleChief     = "部長"
	RoleViceChief = "副部長"
	RoleTreasurer = "会計"
)

// ManagementRoles は部員情報を書き換えられるロール
var ManagementRoles = []string{RoleChief, RoleViceChief}

// SessionUser はセッションに保存しているログイン中のユーザー情報
type SessionUser struct {
	ID   int
	Name string
	Role string
}

// CurrentUser はログイン中のユーザーを返す。未ログインなら (nil, nil)。
// セッションの値は型アサーションに失敗しうる（ログアウト時に空文字が入る等）ので、
// カンマok形式で受けて失敗時は未ログイン扱いにする。
func CurrentUser(r *http.Request) (*SessionUser, error) {
	session, err := Store.Get(r, SessionName)
	if err != nil {
		// 壊れた/期限切れのCookieはエラーになる。未ログインとして扱う。
		log.Printf("session decode failed, treating as anonymous: %v", err)
		return nil, nil
	}

	auth, ok := session.Values["authenticated"].(bool)
	if !ok || !auth {
		return nil, nil
	}

	id, ok := session.Values["id"].(int)
	if !ok {
		return nil, nil
	}
	name, _ := session.Values["name"].(string)
	role, _ := session.Values["role"].(string)

	return &SessionUser{ID: id, Name: name, Role: role}, nil
}

// RequireLogin はログイン必須のハンドラで使う。未ログインなら401を返す。
func RequireLogin(r *http.Request) (*SessionUser, error) {
	user, err := CurrentUser(r)
	if err != nil {
		return nil, Internal("失敗しました。", err)
	}
	if user == nil {
		return nil, Unauthorized("ログインしてください。", errors.New("not logged in"))
	}
	return user, nil
}

// HasRole は指定されたロールのいずれかに一致するかを返す。
func (u *SessionUser) HasRole(roles ...string) bool {
	for _, role := range roles {
		// ロール未設定のユーザーが、空ロールの指定で通ってしまわないようにする
		if role != "" && u.Role == role {
			return true
		}
	}
	return false
}

// RequireRole はログイン済みかつ指定ロールのいずれかであることを要求する。
// 権限が足りなければ403を返す。
func RequireRole(r *http.Request, roles ...string) (*SessionUser, error) {
	user, err := RequireLogin(r)
	if err != nil {
		return nil, err
	}

	if user.HasRole(roles...) {
		return user, nil
	}

	return nil, Forbidden(
		"この操作には"+strings.Join(roles, "・")+"の権限が必要です。",
		errors.New("role not allowed: "+user.Role),
	)
}

// ApplyCookieOptions はセッションCookieのセキュリティ設定をまとめる。
// Secure / SameSite は環境ごとに変える必要があるため環境変数で切り替える
// （localhost の http では Secure Cookie が保存されずログインできないため）。
func ApplyCookieOptions(options *sessions.Options) {
	options.HttpOnly = true
	options.Path = "/"
	options.MaxAge = 86400 * 7
	options.Secure = cookieSecure()
	options.SameSite = cookieSameSite()
}

func cookieSecure() bool {
	switch strings.ToLower(os.Getenv("COOKIE_SECURE")) {
	case "true", "1", "yes":
		return true
	case "false", "0", "no":
		return false
	}
	// 未設定なら APP_ENV で判断する。本番だけ Secure。
	return strings.ToLower(os.Getenv("APP_ENV")) == "production"
}

// フロントとバックが別ドメインの本番では SameSite=None でないとCookieが送られない。
// None は Secure 必須なので、Secure が false のときは Lax に落とす。
func cookieSameSite() http.SameSite {
	value := strings.ToLower(os.Getenv("COOKIE_SAMESITE"))
	if value == "none" && cookieSecure() {
		return http.SameSiteNoneMode
	}
	if value == "strict" {
		return http.SameSiteStrictMode
	}
	return http.SameSiteLaxMode
}

// Login はログイン成功時にセッションを張る。Cookie設定もここに集約する。
func Login(w http.ResponseWriter, r *http.Request, user *SessionUser) error {
	session, err := Store.Get(r, SessionName)
	if err != nil {
		// 壊れたCookieでも新しいセッションが返るので、続行してよい
		log.Printf("reusing new session after decode error: %v", err)
	}

	session.Values["authenticated"] = true
	session.Values["id"] = user.ID
	session.Values["name"] = user.Name
	session.Values["role"] = user.Role

	// 連携待ちの一時情報はログイン完了時点で不要になる
	delete(session.Values, PendingLineIDKey)
	delete(session.Values, PendingLineNameKey)
	delete(session.Values, OAuthStateKey)

	ApplyCookieOptions(session.Options)

	if err := session.Save(r, w); err != nil {
		return Internal("ログインに失敗しました。", err)
	}
	return nil
}

// LINE連携が済んでいないユーザーの一時情報をセッションに置くためのキー
const (
	PendingLineIDKey   = "pending_line_user_id"
	PendingLineNameKey = "pending_line_name"
	OAuthStateKey      = "oauth_state"
)
