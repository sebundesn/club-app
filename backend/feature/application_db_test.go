package feature

import (
	"context"
	"database/sql"
	"testing"

	utility "club-app/util"
)

func newApplication(t *testing.T, lineID, studentID string) int {
	t.Helper()
	var status string
	if err := utility.DB.QueryRow(`INSERT INTO member_applications (line_user_id, student_id, name) VALUES ($1,$2,'n') RETURNING status`, lineID, studentID).Scan(&status); err != nil {
		t.Fatal(err)
	}
	var id int
	utility.DB.QueryRow(`SELECT id FROM member_applications WHERE line_user_id = $1`, lineID).Scan(&id)
	t.Cleanup(func() {
		utility.DB.Exec(`DELETE FROM member_applications WHERE line_user_id = $1`, lineID)
		utility.DB.Exec(`DELETE FROM users WHERE student_id = $1`, studentID)
	})
	return id
}

func TestApproveCreatesLinkedUserAndCannotRepeat(t *testing.T) {
	_, adminID := split(setupTestDB(t))
	ctx := context.Background()
	id := newApplication(t, "Uapprove1", "AP00001")

	if err := decideApplication(ctx, id, true, adminID); err != nil {
		t.Fatal(err)
	}
	var linked string
	if err := utility.DB.QueryRow(`SELECT line_user_id FROM users WHERE student_id = 'AP00001'`).Scan(&linked); err != nil || linked != "Uapprove1" {
		t.Fatalf("user not linked: %v %q", err, linked)
	}
	// 2回目の処理は通らない
	if err := decideApplication(ctx, id, true, adminID); err == nil {
		t.Fatal("expected error on second decision")
	}
}

func TestApproveRefusedWhenStudentIDAlreadyLinked(t *testing.T) {
	_, adminID := split(setupTestDB(t))
	ctx := context.Background()
	utility.DB.Exec(`INSERT INTO users (student_id, name, line_user_id) VALUES ('AP00002','x','Uother')`)
	id := newApplication(t, "Uapprove2", "AP00002")

	if err := decideApplication(ctx, id, true, adminID); err == nil {
		t.Fatal("expected conflict")
	}
	// 失敗したら申請は pending のまま残る(トランザクションが戻っている)
	var status string
	utility.DB.QueryRow(`SELECT status FROM member_applications WHERE id = $1`, id).Scan(&status)
	if status != "pending" {
		t.Fatalf("status = %q, want pending", status)
	}
	var other string
	utility.DB.QueryRow(`SELECT line_user_id FROM users WHERE student_id = 'AP00002'`).Scan(&other)
	if other != "Uother" {
		t.Fatalf("existing link was overwritten: %q", other)
	}
}

func TestRejectDoesNotCreateUser(t *testing.T) {
	_, adminID := split(setupTestDB(t))
	id := newApplication(t, "Ureject1", "RJ00001")
	if err := decideApplication(context.Background(), id, false, adminID); err != nil {
		t.Fatal(err)
	}
	var n int
	utility.DB.QueryRow(`SELECT COUNT(*) FROM users WHERE student_id = 'RJ00001'`).Scan(&n)
	if n != 0 {
		t.Fatalf("user created on reject: %d", n)
	}
	// 却下後は同じLINEから出し直せる
	var status string
	err := utility.DB.QueryRow(`INSERT INTO member_applications (line_user_id, student_id, name) VALUES ('Ureject1','RJ00001','n2')
		ON CONFLICT (line_user_id) DO UPDATE SET status='pending' WHERE member_applications.status <> 'approved' RETURNING status`).Scan(&status)
	if err == sql.ErrNoRows || status != "pending" {
		t.Fatalf("reapply failed: %v %q", err, status)
	}
}

func TestValidStudentID(t *testing.T) {
	for in, want := range map[string]bool{"1234567": true, "ab12345": true, "123456": false, "12345678": false, "12 4567": false, "１２３４５６７": false} {
		if got := validStudentID(in); got != want {
			t.Errorf("validStudentID(%q) = %v, want %v", in, got, want)
		}
	}
}

func TestRemoveSpaces(t *testing.T) {
	for in, want := range map[string]string{"山田 太郎": "山田太郎", "山田　太郎": "山田太郎", " 山田太郎 ": "山田太郎", "山田太郎": "山田太郎", "": ""} {
		if got := removeSpaces(in); got != want {
			t.Errorf("removeSpaces(%q) = %q, want %q", in, got, want)
		}
	}
}
