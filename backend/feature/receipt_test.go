package feature

import (
	"testing"
)

// アップロードを許可する形式の判定。
// ファイル名の拡張子ではなく中身で判断していることを確認する。
func TestAllowedImageTypes(t *testing.T) {
	pngHeader := []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}
	jpegHeader := []byte{0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 'J', 'F', 'I', 'F'}
	gifHeader := []byte("GIF89a")
	scriptBody := []byte("<?php system($_GET['c']); ?>")

	tests := []struct {
		name    string
		head    []byte
		wantOK  bool
		wantExt string
	}{
		{"PNGは許可", pngHeader, true, ".png"},
		{"JPEGは許可", jpegHeader, true, ".jpg"},
		{"GIFは拒否", gifHeader, false, ""},
		{"スクリプトは拒否", scriptBody, false, ""},
		{"空ファイルは拒否", []byte{}, false, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ext, ok := allowedImageTypes[contentTypeOf(tt.head)]

			if ok != tt.wantOK {
				t.Fatalf("allowed = %v, want %v (detected %q)", ok, tt.wantOK, contentTypeOf(tt.head))
			}
			if ext != tt.wantExt {
				t.Errorf("ext = %q, want %q", ext, tt.wantExt)
			}
		})
	}
}

func TestContentTypeOfStripsParameters(t *testing.T) {
	// text/plain は charset 付きで返るので、パラメータが落ちることを確認する
	if got := contentTypeOf([]byte("hello")); got != "text/plain" {
		t.Errorf("contentTypeOf = %q, want %q", got, "text/plain")
	}
}
