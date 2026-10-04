package feature

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"club-app/model"
	"club-app/query"
	"club-app/util"

	"github.com/lib/pq"
)

// get students and their payment of specific event
func GetMembersWithPayment(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return util.MethodNotAllowed(r.Method)
	}

	if _, err := util.RequireLogin(r); err != nil {
		return err
	}

	id := r.URL.Query().Get("event_id")
	if id == "" {
		return util.BadRequest("イベントが指定されていません。", errors.New("event_id is required"))
	}

	rows, err := util.DB.Query(query.GetEventMembers, id)
	if err != nil {
		return util.Internal("参加者の取得に失敗しました。", err)
	}
	defer rows.Close()

	eventMembers := []model.EventMember{}
	for rows.Next() {
		var em model.EventMember
		var name sql.NullString

		if err := rows.Scan(&em.EventID, &em.UserID, &name, &em.Amount); err != nil {
			return util.Internal("参加者の取得に失敗しました。", fmt.Errorf("scan error: %w", err))
		}
		em.UserName = name.String
		eventMembers = append(eventMembers, em)
	}

	if err = rows.Err(); err != nil {
		return util.Internal("参加者の取得に失敗しました。", fmt.Errorf("rows loop error: %w", err))
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(eventMembers)
}

// GetAllClubMembers は参加者選択用の部員一覧を返す。
// react-select がそのまま使えるよう {value, label} 形式で返す。
func GetAllClubMembers(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return util.MethodNotAllowed(r.Method)
	}

	if _, err := util.RequireLogin(r); err != nil {
		return err
	}

	rows, err := util.DB.Query(query.SelectClubMembers)
	if err != nil {
		return util.Internal("部員の取得に失敗しました。", err)
	}
	defer rows.Close()

	members := []model.ClubMember{}
	for rows.Next() {
		var m model.ClubMember
		if err := rows.Scan(&m.Value, &m.Label); err != nil {
			return util.Internal("部員の取得に失敗しました。", fmt.Errorf("scan error: %w", err))
		}
		members = append(members, m)
	}

	if err = rows.Err(); err != nil {
		return util.Internal("部員の取得に失敗しました。", fmt.Errorf("rows loop error: %w", err))
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(members)
}

// TakePartIn はイベントの参加者リストを、送られてきた内容に揃える。
// 外れた人を削除してから追加するので、残った人の amount は保持される。
func TakePartIn(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return util.MethodNotAllowed(r.Method)
	}

	if _, err := util.RequireRole(r, util.RoleTreasurer, util.RoleChief, util.RoleViceChief); err != nil {
		return err
	}

	var req model.TakePartInRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return util.BadRequest("入力内容を確認してください。", err)
	}
	defer r.Body.Close()

	if req.EventID == 0 {
		return util.BadRequest("イベントが指定されていません。", errors.New("event_id is required"))
	}

	tx, err := util.DB.Begin()
	if err != nil {
		return util.Internal("参加者の保存に失敗しました。", err)
	}
	// Commit 済みなら Rollback は何もしないので、失敗時の巻き戻しとして常に予約しておく
	defer tx.Rollback()

	if _, err := tx.Exec(query.DeleteEventMembersNotIn, req.EventID, pq.Array(req.UserIDs)); err != nil {
		return util.Internal("参加者の保存に失敗しました。", err)
	}

	for _, userID := range req.UserIDs {
		if _, err := tx.Exec(query.InsertEventMember, req.EventID, userID); err != nil {
			return util.Internal("参加者の保存に失敗しました。", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return util.Internal("参加者の保存に失敗しました。", err)
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(map[string]string{"message": "success"})
}
