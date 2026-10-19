package feature

import (
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
	"unicode"

	"club-app/model"
	"club-app/query"
	"club-app/util"
)

const (
	lineAuthorizeURL = "https://access.line.me/oauth2/v2.1/authorize"
	lineTokenURL     = "https://api.line.me/oauth2/v2.1/token"
	lineProfileURL   = "https://api.line.me/v2/profile"
)

// LINEへの通信は外部APIなので、ぶら下がったままにならないよう必ずタイムアウトを付ける
var lineClient = &http.Client{Timeout: 10 * time.Second}

func lineChannelID() string     { return os.Getenv("LINE_CHANNEL_ID") }
func lineChannelSecret() string { return os.Getenv("LINE_CHANNEL_SECRET") }

func lineRedirectURI() string {
	if uri := os.Getenv("LINE_REDIRECT_URI"); uri != "" {
		return uri
	}
	return "http://localhost:8080/api/auth/line/callback"
}

func frontendURL() string {
	if u := os.Getenv("FRONTEND_URL"); u != "" {
		return strings.TrimRight(u, "/")
	}
	return "http://localhost:3000"
}

// LineLogin はLINEの認可画面へリダイレクトする。
// CSRF対策の state をセッションに保存してから飛ばす。
func LineLogin(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return util.MethodNotAllowed(r.Method)
	}

	if lineChannelID() == "" || lineChannelSecret() == "" {
		return util.Internal("LINEログインが設定されていません。", errors.New("LINE_CHANNEL_ID / LINE_CHANNEL_SECRET is not set"))
	}

	state, err := randomState()
	if err != nil {
		return util.Internal("ログインに失敗しました。", err)
	}

	session, err := util.Store.Get(r, util.SessionName)
	if err != nil {
		// 壊れた/期限切れのCookieでも新規セッションが返るので、そのまま続行してよい
		log.Printf("starting login with a fresh session: %v", err)
	}
	session.Values[util.OAuthStateKey] = state
	util.ApplyCookieOptions(session.Options)
	if err := session.Save(r, w); err != nil {
		return util.Internal("ログインに失敗しました。", err)
	}

	params := url.Values{
		"response_type": {"code"},
		"client_id":     {lineChannelID()},
		"redirect_uri":  {lineRedirectURI()},
		"state":         {state},
		"scope":         {"profile openid"},
	}

	http.Redirect(w, r, lineAuthorizeURL+"?"+params.Encode(), http.StatusFound)
	return nil
}

// LineCallback はLINEからのリダイレクトを受け、部員レコードと突き合わせる。
// 紐づけ済みならログイン完了、未紐づけなら学籍番号の入力待ち状態にする。
func LineCallback(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return util.MethodNotAllowed(r.Method)
	}

	if errCode := r.URL.Query().Get("error"); errCode != "" {
		// ユーザーが認可をキャンセルした場合もここに来る
		http.Redirect(w, r, frontendURL()+"/calendar?login=cancelled", http.StatusFound)
		return nil
	}

	session, err := util.Store.Get(r, util.SessionName)
	if err != nil {
		http.Redirect(w, r, frontendURL()+"/calendar?login=error", http.StatusFound)
		return nil
	}

	savedState, _ := session.Values[util.OAuthStateKey].(string)
	gotState := r.URL.Query().Get("state")
	if savedState == "" || subtle.ConstantTimeCompare([]byte(savedState), []byte(gotState)) != 1 {
		return util.BadRequest("ログインに失敗しました。もう一度お試しください。", errors.New("oauth state mismatch"))
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		return util.BadRequest("ログインに失敗しました。", errors.New("authorization code is missing"))
	}

	accessToken, err := exchangeLineCode(code)
	if err != nil {
		return util.Internal("LINEとの通信に失敗しました。", err)
	}

	profile, err := fetchLineProfile(accessToken)
	if err != nil {
		return util.Internal("LINEとの通信に失敗しました。", err)
	}

	var user util.SessionUser
	var name sql.NullString
	var role sql.NullString
	err = util.DB.QueryRow(query.SelectUserByLineID, profile.UserID).Scan(&user.ID, &name, &role)
	if err == nil {
		user.Name = name.String
		user.Role = role.String
		if err := util.Login(w, r, &user); err != nil {
			return err
		}
		http.Redirect(w, r, frontendURL()+"/calendar?login=success", http.StatusFound)
		return nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return util.Internal("ログインに失敗しました。", err)
	}

	// 未連携のLINEアカウント。学籍番号の入力を待つ一時状態にする。
	session.Values[util.PendingLineIDKey] = profile.UserID
	session.Values[util.PendingLineNameKey] = profile.DisplayName
	delete(session.Values, util.OAuthStateKey)
	util.ApplyCookieOptions(session.Options)
	if err := session.Save(r, w); err != nil {
		return util.Internal("ログインに失敗しました。", err)
	}

	http.Redirect(w, r, frontendURL()+"/calendar?login=link", http.StatusFound)
	return nil
}

// LinkLineAccount は初回ログイン時に学籍番号とLINEアカウントを紐づける。
// 既に別のLINEアカウントと連携済みの学籍番号は更新されないため、
// 他人の学籍番号を入力してもなりすませない。
func LinkLineAccount(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return util.MethodNotAllowed(r.Method)
	}

	session, err := util.Store.Get(r, util.SessionName)
	if err != nil {
		return util.Unauthorized("もう一度LINEでログインしてください。", err)
	}

	lineUserID, ok := session.Values[util.PendingLineIDKey].(string)
	if !ok || lineUserID == "" {
		return util.Unauthorized("もう一度LINEでログインしてください。", errors.New("no pending line account"))
	}
	displayName, _ := session.Values[util.PendingLineNameKey].(string)

	var req model.LinkAccountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return util.BadRequest("入力内容を確認してください。", err)
	}
	defer r.Body.Close()

	req.StudentID = strings.TrimSpace(req.StudentID)
	req.Name = removeSpaces(req.Name)
	if !validStudentID(req.StudentID) {
		return util.BadRequest("学籍番号は半角英数字7文字で入力してください。", errors.New("invalid student_id"))
	}

	var user util.SessionUser
	var name sql.NullString
	var role sql.NullString
	err = util.DB.QueryRow(query.LinkLineAccount, req.StudentID, lineUserID, displayName).
		Scan(&user.ID, &name, &role)
	if errors.Is(err, sql.ErrNoRows) {
		return applyForMembership(w, lineUserID, req)
	}
	if err != nil {
		return util.Internal("連携に失敗しました。", err)
	}

	user.Name = name.String
	user.Role = role.String
	if err := util.Login(w, r, &user); err != nil {
		return err
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(map[string]interface{}{
		"id":   user.ID,
		"name": user.Name,
		"role": user.Role,
	})
}

// applyForMembership は学籍番号が連携できなかったときの続き。
// 既に誰かと連携済みの番号は断り、未登録の番号なら入部申請として保存する。
func applyForMembership(w http.ResponseWriter, lineUserID string, req model.LinkAccountRequest) error {
	var exists bool
	if err := util.DB.QueryRow(query.StudentIDExists, req.StudentID).Scan(&exists); err != nil {
		return util.Internal("連携に失敗しました。", err)
	}
	if exists {
		return util.Forbidden(
			"この学籍番号は既に別のLINEアカウントと連携済みです。心当たりがなければ部長・副部長に連絡してください。",
			errors.New("student_id already linked"),
		)
	}

	if req.Name == "" || len([]rune(req.Name)) > maxNameLength {
		return util.BadRequest(
			fmt.Sprintf("申請には名前(%d文字以内)が必要です。", maxNameLength),
			errors.New("name is required for application"),
		)
	}

	var status string
	err := util.DB.QueryRow(query.UpsertApplication, lineUserID, req.StudentID, req.Name).Scan(&status)
	if errors.Is(err, sql.ErrNoRows) {
		// 承認済みなのにここに来る = 承認後の再ログインが必要な状態
		return util.Forbidden("既に承認されています。LINEでもう一度ログインしてください。", errors.New("application already approved"))
	}
	if err != nil {
		return util.Internal("申請に失敗しました。", err)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	return json.NewEncoder(w).Encode(map[string]string{
		"status":  status,
		"message": "入部を申請しました。部長・副部長の承認をお待ちください。",
	})
}

const maxNameLength = 50

// 名前は姓と名の間も含めて空白を入れない(半角・全角のどちらも取り除く)
func removeSpaces(s string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) {
			return -1
		}
		return r
	}, s)
}

// 学籍番号は半角英数字7文字(users.student_id が VARCHAR(7) のため)
func validStudentID(s string) bool {
	if len(s) != 7 {
		return false
	}
	for _, c := range s {
		if !(c >= '0' && c <= '9' || c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z') {
			return false
		}
	}
	return true
}

func randomState() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func exchangeLineCode(code string) (string, error) {
	form := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {lineRedirectURI()},
		"client_id":     {lineChannelID()},
		"client_secret": {lineChannelSecret()},
	}

	res, err := lineClient.PostForm(lineTokenURL, form)
	if err != nil {
		return "", fmt.Errorf("line token request: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 1024))
		return "", fmt.Errorf("line token request returned %d: %s", res.StatusCode, body)
	}

	var token struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(res.Body).Decode(&token); err != nil {
		return "", fmt.Errorf("decode line token: %w", err)
	}
	if token.AccessToken == "" {
		return "", errors.New("line token response has no access_token")
	}

	return token.AccessToken, nil
}

type lineProfile struct {
	UserID      string `json:"userId"`
	DisplayName string `json:"displayName"`
}

func fetchLineProfile(accessToken string) (*lineProfile, error) {
	req, err := http.NewRequest(http.MethodGet, lineProfileURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	res, err := lineClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("line profile request: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 1024))
		return nil, fmt.Errorf("line profile request returned %d: %s", res.StatusCode, body)
	}

	var profile lineProfile
	if err := json.NewDecoder(res.Body).Decode(&profile); err != nil {
		return nil, fmt.Errorf("decode line profile: %w", err)
	}
	if profile.UserID == "" {
		return nil, errors.New("line profile has no userId")
	}

	return &profile, nil
}
