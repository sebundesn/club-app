package feature

import (
	"context"
	"database/sql"
	"os"
	"sync"
	"testing"

	"club-app/storage"
	utility "club-app/util"

	_ "github.com/lib/pq"
)

// 実DBが要るテスト。TEST_DATABASE_URL が無ければ飛ばす(本番や開発のDBを触らないよう専用DBを指定する)。
func setupTestDB(t *testing.T) int {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}
	db, err := sql.Open("postgres", url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	utility.DB = db
	if err := utility.Migrate(); err != nil {
		t.Fatal(err)
	}
	Store = &storage.Local{Dir: t.TempDir()}

	var eventID, userID int
	if err := db.QueryRow(`INSERT INTO events (date, title) VALUES (CURRENT_DATE, 't') RETURNING id`).Scan(&eventID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Exec(`DELETE FROM events WHERE id = $1`, eventID) })
	if err := db.QueryRow(`INSERT INTO users (student_id, name) VALUES ($1, 'u') RETURNING id`, "T"+t.Name()[:5]).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Exec(`DELETE FROM users WHERE id = $1`, userID) })
	return eventID*100000 + userID // 呼び出し側で分解せずに済むよう1つにまとめる
}

func split(v int) (eventID, userID int) { return v / 100000, v % 100000 }

func fakeItems(n int) []storedMedia {
	items := make([]storedMedia, n)
	for i := range items {
		items[i] = storedMedia{mainKey: "k", thumbKey: "t", size: 1}
	}
	return items
}

func TestInsertMediaBatchRespectsLimitUnderConcurrency(t *testing.T) {
	eventID, userID := split(setupTestDB(t))
	ctx := context.Background()

	// 150枠に対して10枚ずつ20人が同時に入れようとする → ちょうど15人だけ成功するはず
	var wg sync.WaitGroup
	var mu sync.Mutex
	ok := 0
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := insertMediaBatch(ctx, eventID, userID, "photo", fakeItems(10)); err == nil {
				mu.Lock()
				ok++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	var n int
	utility.DB.QueryRow(`SELECT COUNT(*) FROM event_media WHERE event_id = $1`, eventID).Scan(&n)
	if ok != 15 || n != 150 {
		t.Fatalf("ok=%d rows=%d, want 15 / 150", ok, n)
	}
}

func TestDeleteFreesQuota(t *testing.T) {
	eventID, userID := split(setupTestDB(t))
	ctx := context.Background()

	if err := insertMediaBatch(ctx, eventID, userID, "video", fakeItems(maxVideosPerEvent)); err != nil {
		t.Fatal(err)
	}
	if err := insertMediaBatch(ctx, eventID, userID, "video", fakeItems(1)); err == nil {
		t.Fatal("expected quota error when full")
	}

	var id int
	utility.DB.QueryRow(`SELECT id FROM event_media WHERE event_id = $1 LIMIT 1`, eventID).Scan(&id)
	utility.DB.Exec(`DELETE FROM event_media WHERE id = $1`, id)

	if err := insertMediaBatch(ctx, eventID, userID, "video", fakeItems(1)); err != nil {
		t.Fatalf("expected success after delete: %v", err)
	}
}
