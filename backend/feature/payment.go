package feature

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	schema "club-app/model"
	SQLquery "club-app/query"
	utility "club-app/util"
)

const maxEventFee = 1_000_000

// GetMyUnpaid はログイン中の本人の未払いだけを返す。他人の分は見せない。
func GetMyUnpaid(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return utility.MethodNotAllowed(r.Method)
	}
	user, err := utility.RequireLogin(r)
	if err != nil {
		return err
	}

	rows, err := utility.DB.QueryContext(r.Context(), SQLquery.SelectUnpaidByUser, user.ID)
	if err != nil {
		return utility.Internal("未払いの取得に失敗しました。", err)
	}
	defer rows.Close()

	res := schema.UnpaidResponse{Items: []schema.UnpaidItem{}}
	for rows.Next() {
		var it schema.UnpaidItem
		var title sql.NullString
		if err := rows.Scan(&it.EventID, &title, &it.Date, &it.Amount); err != nil {
			return utility.Internal("未払いの取得に失敗しました。", err)
		}
		it.Title = title.String
		res.Total += it.Amount
		res.Items = append(res.Items, it)
	}
	if err := rows.Err(); err != nil {
		return utility.Internal("未払いの取得に失敗しました。", err)
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(res)
}

// GetAllUnpaid は全員分の未払いを返す。会計と部長・副部長だけが見られる。
func GetAllUnpaid(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return utility.MethodNotAllowed(r.Method)
	}
	if _, err := utility.RequireRole(r, utility.RoleTreasurer, utility.RoleChief, utility.RoleViceChief); err != nil {
		return err
	}

	rows, err := utility.DB.QueryContext(r.Context(), SQLquery.SelectUnpaidAll)
	if err != nil {
		return utility.Internal("未払いの取得に失敗しました。", err)
	}
	defer rows.Close()

	res := schema.UnpaidResponse{Items: []schema.UnpaidItem{}}
	for rows.Next() {
		var it schema.UnpaidItem
		var title, name sql.NullString
		if err := rows.Scan(&it.EventID, &title, &it.Date, &it.UserID, &name, &it.Amount); err != nil {
			return utility.Internal("未払いの取得に失敗しました。", err)
		}
		it.Title, it.UserName = title.String, name.String
		res.Total += it.Amount
		res.Items = append(res.Items, it)
	}
	if err := rows.Err(); err != nil {
		return utility.Internal("未払いの取得に失敗しました。", err)
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(res)
}

// SetPaid は支払いの確認・取り消しをする。会計だけができる。
func SetPaid(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return utility.MethodNotAllowed(r.Method)
	}
	if _, err := utility.RequireRole(r, utility.RoleTreasurer); err != nil {
		return err
	}

	var req schema.SetPaidRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return utility.BadRequest("入力内容を確認してください。", err)
	}
	defer r.Body.Close()
	if req.EventID == 0 || req.UserID == 0 {
		return utility.BadRequest("対象が指定されていません。", errors.New("event_id and user_id are required"))
	}

	res, err := utility.DB.ExecContext(r.Context(), SQLquery.SetEventMemberPaid, req.EventID, req.UserID, req.Paid)
	if err != nil {
		return utility.Internal("更新に失敗しました。", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return utility.NotFound("参加者が見つかりません。", errors.New("event member not found"))
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(map[string]string{"message": "updated"})
}

// SetEventFee はイベントの徴収額を決め、未払いの参加者の請求額に反映する。会計だけができる。
func SetEventFee(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return utility.MethodNotAllowed(r.Method)
	}
	if _, err := utility.RequireRole(r, utility.RoleTreasurer); err != nil {
		return err
	}

	var req schema.SetEventFeeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return utility.BadRequest("入力内容を確認してください。", err)
	}
	defer r.Body.Close()
	if req.EventID == 0 {
		return utility.BadRequest("イベントが指定されていません。", errors.New("event_id is required"))
	}
	if req.Fee < 0 || req.Fee > maxEventFee {
		return utility.BadRequest("金額が不正です。", errors.New("fee out of range"))
	}

	tx, err := utility.DB.BeginTx(r.Context(), nil)
	if err != nil {
		return utility.Internal("更新に失敗しました。", err)
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(r.Context(), SQLquery.SetEventFee, req.EventID, req.Fee)
	if err != nil {
		return utility.Internal("更新に失敗しました。", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return utility.NotFound("イベントが見つかりません。", errors.New("event not found"))
	}
	if _, err := tx.ExecContext(r.Context(), SQLquery.ApplyEventFeeToUnpaid, req.EventID, req.Fee); err != nil {
		return utility.Internal("更新に失敗しました。", err)
	}
	if err := tx.Commit(); err != nil {
		return utility.Internal("更新に失敗しました。", err)
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(map[string]string{"message": "updated"})
}
