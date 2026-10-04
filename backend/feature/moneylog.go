package feature

import (
	"encoding/json"
	"errors"
	"net/http"

	"club-app/model"
	"club-app/query"
	"club-app/util"
)

func SaveMoneyLog(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return util.MethodNotAllowed(r.Method)
	}

	if _, err := util.RequireRole(r, util.RoleTreasurer); err != nil {
		return err
	}

	var l model.MoneyLogStruct
	if err := json.NewDecoder(r.Body).Decode(&l); err != nil {
		return util.BadRequest("入力内容を確認してください。", err)
	}
	defer r.Body.Close()

	if l.Date == "" || l.Content == "" {
		return util.BadRequest("日付と内容を入力してください。", errors.New("date and content are required"))
	}

	if _, err := util.DB.Exec(query.AddLog, l.Date, l.Content, l.Amount); err != nil {
		return util.Internal("保存に失敗しました。", err)
	}

	return nil
}

func GetAccountInfo(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return util.MethodNotAllowed(r.Method)
	}

	year := r.URL.Query().Get("year")
	rows, err := util.DB.Query(query.MoneyInfo, year+"%")
	if err != nil {
		return util.Internal("会計情報の取得に失敗しました。", err)
	}
	defer rows.Close()

	moneyLogs := []model.MoneyLogStruct{}
	for rows.Next() {
		var log model.MoneyLogStruct
		if err := rows.Scan(&log.ID, &log.Date, &log.Content, &log.Amount); err != nil {
			return util.Internal("会計情報の取得に失敗しました。", err)
		}
		moneyLogs = append(moneyLogs, log)
	}

	if err = rows.Err(); err != nil {
		return util.Internal("会計情報の取得に失敗しました。", err)
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(moneyLogs)
}

func GetMoneyTotal(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return util.MethodNotAllowed(r.Method)
	}

	var sum int
	if err := util.DB.QueryRow(query.MoneySum).Scan(&sum); err != nil {
		return util.Internal("残高の取得に失敗しました。", err)
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(sum)
}

// DeleteMoneyLog は主キーで1件だけ削除する。
// 以前は日付・内容・金額の一致で消していたため、
// 同日に同額・同内容のログが2件あると両方消えていた。
func DeleteMoneyLog(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return util.MethodNotAllowed(r.Method)
	}

	if _, err := util.RequireRole(r, util.RoleTreasurer); err != nil {
		return err
	}

	var req model.DeleteMoneyLogRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return util.BadRequest("入力内容を確認してください。", err)
	}
	defer r.Body.Close()

	if req.ID == 0 {
		return util.BadRequest("削除する履歴が指定されていません。", errors.New("id is required"))
	}

	res, err := util.DB.Exec(query.DelMoneyLog, req.ID)
	if err != nil {
		return util.Internal("削除に失敗しました。", err)
	}
	if affected, err := res.RowsAffected(); err == nil && affected == 0 {
		return util.NotFound("履歴が見つかりませんでした。", errors.New("money log not found"))
	}

	return nil
}
