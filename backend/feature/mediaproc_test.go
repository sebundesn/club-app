package feature

import (
	"strings"
	"testing"
)

func TestParseProbe(t *testing.T) {
	cases := []struct {
		name    string
		in      string
		want    float64
		wantErr bool
	}{
		{"ok", "codec_type=video\nduration=12.5\n", 12.5, false},
		{"no video stream", "duration=3.0\n", 0, true},
		{"no duration", "codec_type=video\n", 0, true},
		{"empty", "", 0, true},
	}
	for _, c := range cases {
		got, err := parseProbe(c.in)
		if (err != nil) != c.wantErr || got != c.want {
			t.Errorf("%s: got (%v, %v), want (%v, err=%v)", c.name, got, err, c.want, c.wantErr)
		}
	}
}

func TestPhotoArgsDoesNotUpscale(t *testing.T) {
	args := photoArgs("in.jpg", "out.jpg", 1600)
	joined := strings.Join(args, " ")
	if !strings.Contains(joined, "min(1600,iw)") || !strings.Contains(joined, "-frames:v 1") {
		t.Errorf("unexpected args: %s", joined)
	}
}
