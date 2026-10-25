package feature

import (
	"context"
	"testing"

	SQLquery "club-app/query"
	utility "club-app/util"
)

// 一覧の無限スクロール。画像の枚数に関係なくイベント単位で limit 件ずつ取れて、
// カーソルの前後で抜けも重複もないことを確認する。
func TestReceiptsCursorPaging(t *testing.T) {
	setupTestDB(t)
	ctx := context.Background()

	// 他のデータと混ざらないよう、遠い未来の日付だけを使う。同じ日のイベントも入れておく
	dates := []string{"2999-01-01", "2999-01-02", "2999-01-02", "2999-01-03", "2999-01-05"}
	var ids []int
	for _, d := range dates {
		var id int
		if err := utility.DB.QueryRow(`INSERT INTO events (date, title) VALUES ($1, 'p') RETURNING id`, d).Scan(&id); err != nil {
			t.Fatal(err)
		}
		ids = append(ids, id)
		t.Cleanup(func() { utility.DB.Exec(`DELETE FROM events WHERE id = $1`, id) })
	}
	// 1件目に画像を3枚。JOIN で行が増えても件数がずれないこと
	for i := 0; i < 3; i++ {
		if _, err := utility.DB.Exec(`INSERT INTO receipt_images (event_id, image_url) VALUES ($1, '/uploads/x.jpg')`, ids[0]); err != nil {
			t.Fatal(err)
		}
	}

	fetch := func(query, date string, id, limit int) []int {
		t.Helper()
		rows, err := utility.DB.QueryContext(ctx, query, date, id, limit)
		if err != nil {
			t.Fatal(err)
		}
		defer rows.Close()
		events, err := scanEventReceipts(ctx, rows)
		if err != nil {
			t.Fatal(err)
		}
		var got []int
		for _, e := range events {
			got = append(got, e.ID)
		}
		return got
	}
	equal := func(got, want []int) bool {
		if len(got) != len(want) {
			return false
		}
		for i := range got {
			if got[i] != want[i] {
				return false
			}
		}
		return true
	}

	// 未来側: 2999-01-01 の手前から2件ずつ、古い順に
	if got := fetch(SQLquery.GetReceiptsAfter, "2999-01-01", 0, 2); !equal(got, ids[0:2]) {
		t.Fatalf("future page1 = %v, want %v", got, ids[0:2])
	}
	if got := fetch(SQLquery.GetReceiptsAfter, "2999-01-02", ids[1], 2); !equal(got, ids[2:4]) {
		t.Fatalf("future page2 = %v, want %v", got, ids[2:4])
	}

	// 過去側: 2999-01-06 より前を新しい順に
	if got := fetch(SQLquery.GetReceiptsBefore, "2999-01-06", 0, 3); !equal(got, []int{ids[4], ids[3], ids[2]}) {
		t.Fatalf("past page1 = %v, want %v", got, []int{ids[4], ids[3], ids[2]})
	}
	if got := fetch(SQLquery.GetReceiptsBefore, "2999-01-02", ids[2], 3); !equal(got, []int{ids[1], ids[0]}) {
		t.Fatalf("past page2 = %v, want %v", got, []int{ids[1], ids[0]})
	}

	// 1イベント指定では画像も全部つく
	rows, err := utility.DB.QueryContext(ctx, SQLquery.GetReceiptsOfEvent, ids[0])
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	events, err := scanEventReceipts(ctx, rows)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 1 || len(events[0].Images) != 3 {
		t.Fatalf("event = %+v, want 1 event with 3 images", events)
	}
}
