package feature

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"club-app/model"
	"club-app/query"
	"club-app/util"
)

func GetMonthNotes(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return util.MethodNotAllowed(r.Method)
	}

	month := r.URL.Query().Get("month")

	rows, err := util.DB.Query(query.SelectMonthNotes, month+"%")
	if err != nil {
		return util.Internal("イベントの取得に失敗しました。", err)
	}
	defer rows.Close()

	events := []model.EventSummary{}
	for rows.Next() {
		var e model.EventSummary
		var t time.Time
		var title sql.NullString

		if err := rows.Scan(&e.ID, &t, &title); err != nil {
			return util.Internal("イベントの取得に失敗しました。", err)
		}
		e.Date = t.Format("2006-01-02")
		e.Title = title.String

		events = append(events, e)
	}
	if err := rows.Err(); err != nil {
		return util.Internal("イベントの取得に失敗しました。", fmt.Errorf("failed to iterate rows: %w", err))
	}

	//      func (enc *Encoder) Encode(v any) error
	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(events)
}

// GetDateEvents は指定日のイベントを全件返す。
// 1日に複数イベントを持てるようになったので配列を返す。
func GetDateEvents(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return util.MethodNotAllowed(r.Method)
	}

	date := r.URL.Query().Get("date")
	if date == "" {
		return util.BadRequest("日付が指定されていません。", errors.New("date is required"))
	}

	rows, err := util.DB.Query(query.GetDateEvents, date)
	if err != nil {
		return util.Internal("イベントの取得に失敗しました。", err)
	}
	defer rows.Close()

	events := []model.EventDetail{}
	for rows.Next() {
		var e model.EventDetail
		// title / subtitle / content / pdf_path は NULL 可なので直接 string には読めない
		var title, subtitle, content, pdfPath sql.NullString

		if err := rows.Scan(&e.ID, &title, &subtitle, &content, &pdfPath); err != nil {
			return util.Internal("イベントの取得に失敗しました。", err)
		}
		e.Title = title.String
		e.Subtitle = subtitle.String
		e.Content = content.String
		e.PDFPath = pdfPath.String

		events = append(events, e)
	}
	if err := rows.Err(); err != nil {
		return util.Internal("イベントの取得に失敗しました。", err)
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(events)
}

// SaveNote はイベントを保存する。ID が 0 なら新規作成、それ以外は更新。
// 以前は日付をキーにした upsert だったため、同じ日の2件目が既存を上書きして消していた。
func SaveNote(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return util.MethodNotAllowed(r.Method)
	}

	if _, err := util.RequireRole(r, util.ManagementRoles...); err != nil {
		return err
	}

	var e model.SaveEventRequest
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		return util.BadRequest("入力内容を確認してください。", err)
	}
	defer r.Body.Close()

	if e.ID == 0 {
		if e.Date == "" {
			return util.BadRequest("日付が指定されていません。", errors.New("date is required"))
		}

		var id int
		err := util.DB.QueryRow(query.InsertEvent, e.Date, e.Title, e.Subtitle, e.Content, e.PDFPath).Scan(&id)
		if err != nil {
			return util.Internal("保存に失敗しました。", err)
		}

		w.Header().Set("Content-Type", "application/json")
		return json.NewEncoder(w).Encode(model.EventSummary{ID: id, Date: e.Date, Title: e.Title})
	}

	res, err := util.DB.Exec(query.UpdateEvent, e.ID, e.Title, e.Subtitle, e.Content, e.PDFPath)
	if err != nil {
		return util.Internal("保存に失敗しました。", err)
	}
	if affected, err := res.RowsAffected(); err == nil && affected == 0 {
		return util.NotFound("イベントが見つかりませんでした。", errors.New("event not found"))
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(model.EventSummary{ID: e.ID, Date: e.Date, Title: e.Title})
}

// 自分の通知を取得する関数
func GetNotificate(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return util.MethodNotAllowed(r.Method)
	}

	user, err := util.RequireLogin(r)
	if err != nil {
		return err
	}

	rows, err := util.DB.Query(query.FetchNotificates, user.ID)
	if err != nil {
		return util.Internal("通知の取得に失敗しました。", err)
	}
	defer rows.Close()

	notificates := []model.Notificate{}
	for rows.Next() {
		var n model.Notificate

		if err := rows.Scan(&n.ID, &n.Title, &n.DueDate); err != nil {
			return util.Internal("通知の取得に失敗しました。", err)
		}

		notificates = append(notificates, n)
	}

	if err = rows.Err(); err != nil {
		return util.Internal("通知の取得に失敗しました。", err)
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(notificates)
}
