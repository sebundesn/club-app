package feature

import (
	"strings"
	"testing"
	"unicode/utf8"
)

// 一覧に出すファイル名は、パスを落として長さを抑える
func TestDisplayName(t *testing.T) {
	tests := []struct{ in, want string }{
		{"案内.pdf", "案内.pdf"},
		{"  poster.png ", "poster.png"},
		{"../../etc/passwd", "passwd"},
		{`C:\Users\me\合宿のしおり.pdf`, "合宿のしおり.pdf"},
		{"", ""},
		{"/", ""},
	}
	for _, tt := range tests {
		if got := displayName(tt.in); got != tt.want {
			t.Errorf("displayName(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}

	long := strings.Repeat("あ", maxFileNameRunes+20) + ".pdf"
	if got := displayName(long); utf8.RuneCountInString(got) != maxFileNameRunes {
		t.Errorf("long name has %d runes, want %d", utf8.RuneCountInString(got), maxFileNameRunes)
	}
}

func TestPDFIsDetected(t *testing.T) {
	if got := contentTypeOf([]byte("%PDF-1.7\n%âãÏÓ\n")); got != "application/pdf" {
		t.Errorf("contentTypeOf(pdf) = %q, want application/pdf", got)
	}
}
