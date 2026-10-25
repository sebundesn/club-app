package feature

import (
	"net/url"
	"testing"
)

func TestParseEventCursor(t *testing.T) {
	ok := []struct {
		query string
		want  eventCursor
	}{
		{"dir=future&date=2026-10-25", eventCursor{Future: true, Date: "2026-10-25", ID: 0, Limit: defaultPageLimit}},
		{"dir=past&date=2026-10-25&id=12&limit=5", eventCursor{Future: false, Date: "2026-10-25", ID: 12, Limit: 5}},
	}
	for _, tt := range ok {
		q, _ := url.ParseQuery(tt.query)
		got, err := parseEventCursor(q)
		if err != nil || got != tt.want {
			t.Errorf("parseEventCursor(%q) = %+v, %v; want %+v", tt.query, got, err, tt.want)
		}
	}

	bad := []string{
		"date=2026-10-25",                       // 向きがない
		"dir=sideways&date=2026-10-25",          // 向きが不正
		"dir=future",                            // 日付がない
		"dir=future&date=2026-13-01",            // 日付が不正
		"dir=future&date=2026-10-25' OR 1=1 --", // 日付として読めない値はそのままSQLに渡さない
		"dir=future&date=2026-10-25&id=x",
		"dir=future&date=2026-10-25&limit=0",
		"dir=future&date=2026-10-25&limit=51",
	}
	for _, query := range bad {
		q, _ := url.ParseQuery(query)
		if _, err := parseEventCursor(q); err == nil {
			t.Errorf("parseEventCursor(%q) should fail", query)
		}
	}
}
