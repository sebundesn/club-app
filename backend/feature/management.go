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
)

// FetchMembers は部員一覧を返す。
// 学籍番号・氏名・役職という個人情報なのでログイン必須。
func FetchMembers(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return util.MethodNotAllowed(r.Method)
	}

	if _, err := util.RequireLogin(r); err != nil {
		return err
	}

	rows, err := util.DB.Query(query.SelectMembers)
	if err != nil {
		return util.Internal("部員の取得に失敗しました。", err)
	}
	defer rows.Close()

	members := []model.Member{}
	for rows.Next() {
		var row model.Member
		var name, role sql.NullString

		if err := rows.Scan(&row.StudentID, &name, &role); err != nil {
			return util.Internal("部員の取得に失敗しました。", err)
		}
		row.Name = name.String
		row.Role = role.String

		members = append(members, row)
	}

	if err := rows.Err(); err != nil {
		return util.Internal("部員の取得に失敗しました。", err)
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(members)
}

// UpdateMembers は部員情報を一括で upsert する。
// role を書き換えられる＝権限を付け替えられる操作なので、管理権限に限定する。
func UpdateMembers(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return util.MethodNotAllowed(r.Method)
	}

	if _, err := util.RequireRole(r, util.ManagementRoles...); err != nil {
		return err
	}

	var members []model.Member
	if err := json.NewDecoder(r.Body).Decode(&members); err != nil {
		return util.BadRequest("入力内容を確認してください。", err)
	}
	defer r.Body.Close()

	tx, err := util.DB.Begin()
	if err != nil {
		return util.Internal("更新に失敗しました。", err)
	}
	// Commit 済みなら Rollback は何もしないので、失敗時の巻き戻しとして常に予約しておく
	defer tx.Rollback()

	for _, m := range members {
		if m.StudentID == "" {
			return util.BadRequest("学籍番号が空の行があります。", errors.New("student_id is empty"))
		}

		if _, err := tx.Exec(query.UpsertMembersQuery, m.StudentID, m.Name, m.Role); err != nil {
			return util.Internal("更新に失敗しました。", fmt.Errorf("failed to update member ID %s: %w", m.StudentID, err))
		}
	}

	if err := tx.Commit(); err != nil {
		return util.Internal("更新に失敗しました。", err)
	}

	return nil
}
