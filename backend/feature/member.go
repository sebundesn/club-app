package feature

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"club-app/model"
	"club-app/query"
	"club-app/util"

	"github.com/lib/pq"
)

// 1つの役職に就ける人数。代わりの人を立てられるよう2人まで、空席は作らない。
const (
	minPerRole = 1
	maxPerRole = 2
)

// AssignableRoles は役職ページで付け替える役職。
var AssignableRoles = []string{util.RoleChief, util.RoleViceChief, util.RoleTreasurer}

// GetMembers は部員の一覧(役職つき)を返す。部長・副部長だけが見られる。
func GetMembers(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return util.MethodNotAllowed(r.Method)
	}
	if _, err := util.RequireRole(r, util.ManagementRoles...); err != nil {
		return err
	}

	rows, err := util.DB.QueryContext(r.Context(), query.SelectMembers)
	if err != nil {
		return util.Internal("部員の取得に失敗しました。", err)
	}
	defer rows.Close()

	members := []model.Member{}
	for rows.Next() {
		var m model.Member
		if err := rows.Scan(&m.ID, &m.StudentID, &m.Name, &m.Role, &m.Linked); err != nil {
			return util.Internal("部員の取得に失敗しました。", fmt.Errorf("scan error: %w", err))
		}
		members = append(members, m)
	}
	if err := rows.Err(); err != nil {
		return util.Internal("部員の取得に失敗しました。", err)
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(members)
}

// SetRoles は部長・副部長・会計をまとめて付け替える。部長・副部長だけができる。
func SetRoles(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return util.MethodNotAllowed(r.Method)
	}
	if _, err := util.RequireRole(r, util.ManagementRoles...); err != nil {
		return err
	}

	var req model.SetRolesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return util.BadRequest("入力内容を確認してください。", err)
	}
	defer r.Body.Close()

	if err := validateRoles(req.Roles); err != nil {
		return err
	}
	if err := setRoles(r.Context(), req.Roles); err != nil {
		return err
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(map[string]string{"message": "updated"})
}

// validateRoles は各役職が1〜2人で、同じ人が2つの役職を持っていないかを確かめる。
func validateRoles(roles map[string][]int) error {
	if len(roles) != len(AssignableRoles) {
		return util.BadRequest("部長・副部長・会計をすべて指定してください。", fmt.Errorf("got %d roles", len(roles)))
	}
	seen := map[int]string{}
	for _, role := range AssignableRoles {
		ids, ok := roles[role]
		if !ok {
			return util.BadRequest("部長・副部長・会計をすべて指定してください。", errors.New("missing role: "+role))
		}
		if len(ids) < minPerRole || len(ids) > maxPerRole {
			return util.BadRequest(
				fmt.Sprintf("%sは%d〜%d人で選んでください。", role, minPerRole, maxPerRole),
				fmt.Errorf("%s: %d members", role, len(ids)),
			)
		}
		for _, id := range ids {
			if prev, dup := seen[id]; dup {
				msg := "同じ人を2つの役職に選ぶことはできません。"
				if prev == role {
					msg = role + "に同じ人が2回選ばれています。"
				}
				return util.BadRequest(msg, fmt.Errorf("user %d in %s and %s", id, prev, role))
			}
			seen[id] = role
		}
	}
	return nil
}

func setRoles(ctx context.Context, roles map[string][]int) error {
	tx, err := util.DB.BeginTx(ctx, nil)
	if err != nil {
		return util.Internal("役職の保存に失敗しました。", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, query.ClearRoles, pq.Array(AssignableRoles)); err != nil {
		return util.Internal("役職の保存に失敗しました。", err)
	}
	for _, role := range AssignableRoles {
		ids := roles[role]
		res, err := tx.ExecContext(ctx, query.AssignRole, role, pq.Array(ids))
		if err != nil {
			return util.Internal("役職の保存に失敗しました。", err)
		}
		// 存在しない部員が混ざっていたら、空席ができるので保存しない
		if n, err := res.RowsAffected(); err != nil || n != int64(len(ids)) {
			return util.BadRequest("選ばれた部員が見つかりません。画面を開き直してください。",
				fmt.Errorf("%s: assigned %d of %d", role, n, len(ids)))
		}
	}

	if err := tx.Commit(); err != nil {
		return util.Internal("役職の保存に失敗しました。", err)
	}
	return nil
}
