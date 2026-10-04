package util

import (
	"net/http"
	"testing"
)

func TestSessionUserHasRole(t *testing.T) {
	tests := []struct {
		name     string
		userRole string
		allowed  []string
		want     bool
	}{
		{"部長は管理権限を持つ", RoleChief, ManagementRoles, true},
		{"副部長は管理権限を持つ", RoleViceChief, ManagementRoles, true},
		{"会計は管理権限を持たない", RoleTreasurer, ManagementRoles, false},
		{"一般部員は管理権限を持たない", "", ManagementRoles, false},
		{"役職なしの文字列は管理権限を持たない", "なし", ManagementRoles, false},
		{"会計は会計権限を持つ", RoleTreasurer, []string{RoleTreasurer}, true},
		{"部長は会計権限を持たない", RoleChief, []string{RoleTreasurer}, false},
		{"許可ロールが空なら誰も通らない", RoleChief, nil, false},
		{"空ロール指定で役職なしが通ってしまわない", "", []string{""}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			user := &SessionUser{ID: 1, Name: "テスト", Role: tt.userRole}

			if got := user.HasRole(tt.allowed...); got != tt.want {
				t.Errorf("HasRole(%v) = %v, want %v", tt.allowed, got, tt.want)
			}
		})
	}
}

func TestCookieSecure(t *testing.T) {
	tests := []struct {
		name         string
		cookieSecure string
		appEnv       string
		want         bool
	}{
		{"未設定のローカルでは Secure を付けない", "", "", false},
		{"development でも Secure を付けない", "", "development", false},
		{"production では Secure を付ける", "", "production", true},
		{"COOKIE_SECURE=true が優先される", "true", "development", true},
		{"COOKIE_SECURE=false が優先される", "false", "production", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("COOKIE_SECURE", tt.cookieSecure)
			t.Setenv("APP_ENV", tt.appEnv)

			if got := cookieSecure(); got != tt.want {
				t.Errorf("cookieSecure() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestCookieSameSite(t *testing.T) {
	tests := []struct {
		name         string
		sameSite     string
		cookieSecure string
		want         http.SameSite
	}{
		{"既定は Lax", "", "", http.SameSiteLaxMode},
		{"strict 指定", "strict", "", http.SameSiteStrictMode},
		{"none は Secure と併用できる", "none", "true", http.SameSiteNoneMode},
		{"Secure でない none は Lax に落とす", "none", "false", http.SameSiteLaxMode},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("COOKIE_SAMESITE", tt.sameSite)
			t.Setenv("COOKIE_SECURE", tt.cookieSecure)
			t.Setenv("APP_ENV", "")

			if got := cookieSameSite(); got != tt.want {
				t.Errorf("cookieSameSite() = %v, want %v", got, tt.want)
			}
		})
	}
}
