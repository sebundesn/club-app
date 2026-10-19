package feature

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	schema "club-app/model"
	SQLquery "club-app/query"
	utility "club-app/util"
)

// GetApplications は承認待ちの入部申請を返す。部長・副部長だけが見られる。
func GetApplications(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return utility.MethodNotAllowed(r.Method)
	}
	if _, err := utility.RequireRole(r, utility.ManagementRoles...); err != nil {
		return err
	}

	rows, err := utility.DB.QueryContext(r.Context(), SQLquery.SelectPendingApplications)
	if err != nil {
		return utility.Internal("申請の取得に失敗しました。", err)
	}
	defer rows.Close()

	apps := []schema.Application{}
	for rows.Next() {
		var a schema.Application
		if err := rows.Scan(&a.ID, &a.StudentID, &a.Name, &a.CreatedAt); err != nil {
			return utility.Internal("申請の取得に失敗しました。", err)
		}
		apps = append(apps, a)
	}
	if err := rows.Err(); err != nil {
		return utility.Internal("申請の取得に失敗しました。", err)
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(apps)
}

// DecideApplication は申請を承認または却下する。部長・副部長だけができる。
// 承認すると部員として登録され、本人は次のLINEログインから使えるようになる。
func DecideApplication(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return utility.MethodNotAllowed(r.Method)
	}
	admin, err := utility.RequireRole(r, utility.ManagementRoles...)
	if err != nil {
		return err
	}

	var req schema.DecideApplicationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return utility.BadRequest("入力内容を確認してください。", err)
	}
	defer r.Body.Close()
	if req.ID == 0 {
		return utility.BadRequest("申請が指定されていません。", errors.New("id is required"))
	}

	if err := decideApplication(r.Context(), req.ID, req.Approve, admin.ID); err != nil {
		return err
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(map[string]string{"message": "updated"})
}

func decideApplication(ctx context.Context, id int, approve bool, adminID int) error {
	status := "rejected"
	if approve {
		status = "approved"
	}

	// 判定と部員登録は1つのトランザクションにして、片方だけ反映される状態を避ける
	tx, err := utility.DB.BeginTx(ctx, nil)
	if err != nil {
		return utility.Internal("処理に失敗しました。", err)
	}
	defer tx.Rollback()

	var lineID, studentID, name string
	err = tx.QueryRowContext(ctx, SQLquery.DecideApplication, id, status, adminID).
		Scan(&lineID, &studentID, &name)
	if errors.Is(err, sql.ErrNoRows) {
		return utility.NotFound("申請が見つからないか、既に処理されています。", err)
	}
	if err != nil {
		return utility.Internal("処理に失敗しました。", err)
	}

	if approve {
		var userID int
		err := tx.QueryRowContext(ctx, SQLquery.ApproveApplicationUser, studentID, name, lineID).Scan(&userID)
		if errors.Is(err, sql.ErrNoRows) {
			return utility.NewAppError(http.StatusConflict,
				"この学籍番号は既に別のLINEアカウントと連携済みのため承認できません。却下してください。",
				errors.New("student_id already linked"))
		}
		if err != nil {
			return utility.Internal("処理に失敗しました。", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return utility.Internal("処理に失敗しました。", err)
	}
	return nil
}
