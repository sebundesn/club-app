package feature

import (
	"fmt"
	"net/url"
	"strconv"
	"time"

	utility "club-app/util"
)

const (
	defaultPageLimit = 10
	maxPageLimit     = 50
)

// eventCursor は一覧の無限スクロールの1回分の指定。(Date, ID) より後(future)/前(past)のイベントを Limit 件。
// 一覧の最初は Date に今日、ID に 0 を渡すと、future は今日以降、past は昨日以前になる。
// 今日の日付はブラウザ側で決める(サーバーのタイムゾーンに左右されないように)。
type eventCursor struct {
	Future bool
	Date   string
	ID     int
	Limit  int
}

// parseEventCursor は ?dir=future|past&date=YYYY-MM-DD&id=N&limit=N を読む。
func parseEventCursor(q url.Values) (eventCursor, error) {
	c := eventCursor{Limit: defaultPageLimit}

	switch q.Get("dir") {
	case "future":
		c.Future = true
	case "past":
	default:
		return c, utility.BadRequest("向きの指定が不正です。", fmt.Errorf("invalid dir %q", q.Get("dir")))
	}

	date, err := time.Parse(time.DateOnly, q.Get("date"))
	if err != nil {
		return c, utility.BadRequest("日付の指定が不正です。", err)
	}
	c.Date = date.Format(time.DateOnly)

	if v := q.Get("id"); v != "" {
		if c.ID, err = strconv.Atoi(v); err != nil {
			return c, utility.BadRequest("イベントの指定が不正です。", err)
		}
	}
	if v := q.Get("limit"); v != "" {
		if c.Limit, err = strconv.Atoi(v); err != nil || c.Limit < 1 || c.Limit > maxPageLimit {
			return c, utility.BadRequest("件数の指定が不正です。", fmt.Errorf("invalid limit %q", v))
		}
	}
	return c, nil
}

// pick は向きに合ったクエリを返す。
func (c eventCursor) pick(after, before string) string {
	if c.Future {
		return after
	}
	return before
}

// args はクエリに渡す値。続きがあるか判定するため1件多く取る。
func (c eventCursor) args() []any { return []any{c.Date, c.ID, c.Limit + 1} }
