package util

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAppHandlerStatusCodes(t *testing.T) {
	t.Setenv("FRONTEND_URL", "http://localhost:3000")

	tests := []struct {
		name     string
		err      error
		wantCode int
		wantMsg  string
	}{
		{"エラーなしなら200", nil, http.StatusOK, ""},
		{"未ログインは401", Unauthorized("ログインしてください。", nil), http.StatusUnauthorized, "ログインしてください。"},
		{"権限不足は403", Forbidden("権限がありません。", nil), http.StatusForbidden, "権限がありません。"},
		{"リクエスト不正は400", BadRequest("入力内容を確認してください。", nil), http.StatusBadRequest, "入力内容を確認してください。"},
		{"メソッド不正は405", MethodNotAllowed("PUT"), http.StatusMethodNotAllowed, "許可されていないメソッドです。"},
		{"見つからないは404", NotFound("ありません。", nil), http.StatusNotFound, "ありません。"},
		{"素のエラーは500", errors.New("boom"), http.StatusInternalServerError, "失敗しました。"},
		{"ラップされたAppErrorもコードを保つ", fmt.Errorf("wrapped: %w", Forbidden("だめです。", nil)), http.StatusForbidden, "だめです。"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := AppHandler(func(w http.ResponseWriter, r *http.Request) error {
				return tt.err
			})

			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

			if rec.Code != tt.wantCode {
				t.Errorf("status = %d, want %d", rec.Code, tt.wantCode)
			}

			if tt.wantMsg == "" {
				return
			}

			var body map[string]string
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("response is not JSON: %v (%s)", err, rec.Body.String())
			}
			if body["message"] != tt.wantMsg {
				t.Errorf("message = %q, want %q", body["message"], tt.wantMsg)
			}
		})
	}
}

// ハンドラ内の panic でプロセスが落ちないこと
func TestAppHandlerRecoversFromPanic(t *testing.T) {
	t.Setenv("FRONTEND_URL", "http://localhost:3000")

	handler := AppHandler(func(w http.ResponseWriter, r *http.Request) error {
		// ログアウト後に session.Values["id"] が文字列になっている状況を模している
		var value interface{} = ""
		_ = value.(int)
		return nil
	})

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestAppHandlerPreflight(t *testing.T) {
	t.Setenv("FRONTEND_URL", "http://localhost:3000")

	called := false
	handler := AppHandler(func(w http.ResponseWriter, r *http.Request) error {
		called = true
		return nil
	})

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodOptions, "/", nil))

	if called {
		t.Error("OPTIONS でハンドラ本体が呼ばれている")
	}
	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Errorf("Access-Control-Allow-Origin = %q", got)
	}
}
