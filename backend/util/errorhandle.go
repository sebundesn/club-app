package util

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"runtime/debug"
)

// AppError はHTTPステータスコードとユーザー向けメッセージを持つエラー。
// ハンドラがこれを返すと、ServeHTTP がそのコードでレスポンスを返す。
type AppError struct {
	Code int    // HTTPステータスコード
	Msg  string // ユーザーに見せるメッセージ（日本語）
	Err  error  // ログにだけ出す内部エラー
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return e.Msg + ": " + e.Err.Error()
	}
	return e.Msg
}

func (e *AppError) Unwrap() error { return e.Err }

func NewAppError(code int, msg string, err error) *AppError {
	return &AppError{Code: code, Msg: msg, Err: err}
}

func BadRequest(msg string, err error) *AppError {
	return NewAppError(http.StatusBadRequest, msg, err)
}

func Unauthorized(msg string, err error) *AppError {
	return NewAppError(http.StatusUnauthorized, msg, err)
}

func Forbidden(msg string, err error) *AppError {
	return NewAppError(http.StatusForbidden, msg, err)
}

func NotFound(msg string, err error) *AppError {
	return NewAppError(http.StatusNotFound, msg, err)
}

func MethodNotAllowed(method string) *AppError {
	return NewAppError(http.StatusMethodNotAllowed, "許可されていないメソッドです。", errors.New("method not allowed: "+method))
}

func Internal(msg string, err error) *AppError {
	return NewAppError(http.StatusInternalServerError, msg, err)
}

// the handler that returns back error
type AppHandler func(http.ResponseWriter, *http.Request) error

func (fn AppHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	SetCorsHeader(w)

	// 1リクエストのpanicでプロセス全体が落ちないようにする
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("panic: %v\n%s", rec, debug.Stack())
			writeError(w, http.StatusInternalServerError, "失敗しました。")
		}
	}()

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if err := fn(w, r); err != nil {
		log.Printf("Error: %v", err)

		var appErr *AppError
		if errors.As(err, &appErr) {
			writeError(w, appErr.Code, appErr.Msg)
			return
		}

		writeError(w, http.StatusInternalServerError, "失敗しました。")
	}
}

func writeError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	// エラー書き込み自体が失敗しても、もうクライアントに返せることはない
	_ = json.NewEncoder(w).Encode(map[string]string{"message": msg})
}
