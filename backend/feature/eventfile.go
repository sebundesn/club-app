package feature

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"unicode/utf8"

	"club-app/model"
	SQLquery "club-app/query"
	utility "club-app/util"

	"github.com/google/uuid"
)

const (
	// 案内のPDFやポスターを数枚付けられれば足りる
	maxFilesPerEvent  = 10
	maxEventFileBytes = 20 << 20 // 20MB
	maxFileNameRunes  = 100
)

// UploadEventFile はイベントにPDF・画像を付ける。部長・副部長のみ。
// 画像は写真と同じく長辺1600pxのJPEGにそろえ、PDFはそのまま置く。
func UploadEventFile(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return utility.MethodNotAllowed(r.Method)
	}
	user, err := utility.RequireRole(r, utility.ManagementRoles...)
	if err != nil {
		return err
	}

	// 変換前のファイルでディスクを埋められないよう、同時に受け付ける数を絞る(アルバム・レシートと共通)
	select {
	case uploadSlots <- struct{}{}:
		defer func() { <-uploadSlots }()
	default:
		return utility.NewAppError(http.StatusServiceUnavailable,
			"アップロードが混み合っています。少し待ってからもう一度お試しください。", errors.New("too many concurrent uploads"))
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(maxUploadMemory); err != nil {
		return utility.BadRequest("ファイルが大きすぎるか、形式が不正です。", err)
	}
	defer r.MultipartForm.RemoveAll()

	eventID, err := strconv.Atoi(r.FormValue("eventID"))
	if err != nil {
		return utility.BadRequest("イベントが指定されていません。", err)
	}
	var exists bool
	if err := utility.DB.QueryRowContext(r.Context(), SQLquery.EventExists, eventID).Scan(&exists); err != nil {
		return utility.Internal("アップロードに失敗しました。", err)
	}
	if !exists {
		return utility.NotFound("イベントが見つかりません。", fmt.Errorf("event %d not found", eventID))
	}

	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		return utility.BadRequest("ファイルが選択されていません。", errors.New("no files"))
	}
	if len(files) > maxUploadFiles {
		return utility.BadRequest(
			fmt.Sprintf("一度にアップロードできるのは%d個までです。", maxUploadFiles),
			fmt.Errorf("too many files: %d", len(files)),
		)
	}

	var n int
	if err := utility.DB.QueryRowContext(r.Context(), SQLquery.CountEventFiles, eventID).Scan(&n); err != nil {
		return utility.Internal("アップロードに失敗しました。", err)
	}
	if n+len(files) > maxFilesPerEvent {
		return utility.NewAppError(http.StatusConflict,
			fmt.Sprintf("PDF・画像は1イベント%d個までです(現在%d個)。", maxFilesPerEvent, n),
			fmt.Errorf("event file quota exceeded: %d+%d", n, len(files)))
	}

	tmpDir, err := os.MkdirTemp("", "club-eventfile-")
	if err != nil {
		return utility.Internal("アップロードに失敗しました。", err)
	}
	defer os.RemoveAll(tmpDir)

	for i, fh := range files {
		if err := saveEventFile(r.Context(), tmpDir, i, eventID, user.ID, fh); err != nil {
			return err
		}
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(map[string]string{"message": "upload successful"})
}

func saveEventFile(ctx context.Context, tmpDir string, idx, eventID, userID int, fh *multipart.FileHeader) error {
	if fh.Size > maxEventFileBytes {
		return utility.BadRequest("ファイルは1つ20MBまでです。", fmt.Errorf("event file too large: %d", fh.Size))
	}

	// ファイル名の拡張子は信用できないので、中身の先頭512バイトから形式を判定する
	var detected string
	in := filepath.Join(tmpDir, fmt.Sprintf("in_%d", idx))
	if err := saveUpload(fh, in, func(head []byte) error {
		detected = contentTypeOf(head)
		switch detected {
		case "application/pdf", "image/jpeg", "image/png":
			return nil
		}
		return errors.New("disallowed content type: " + detected)
	}); err != nil {
		return utility.BadRequest("PDF・JPEG・PNGのファイルのみアップロードできます。", err)
	}

	// 保存名はサーバー生成の値だけで作る（ユーザー由来のファイル名は表示用にDBへ入れるだけ）
	base := fmt.Sprintf("media/events/%d/%s", eventID, uuid.New().String())
	kind, key, src, contentType := "pdf", base+".pdf", in, "application/pdf"
	if detected != "application/pdf" {
		kind, key, contentType = "image", base+".jpg", "image/jpeg"
		src = filepath.Join(tmpDir, fmt.Sprintf("out_%d.jpg", idx))
		if err := withTranscodeSlot(ctx, func() error {
			return runFFmpeg(ctx, photoArgs(in, src, photoMaxSide)...)
		}); err != nil {
			return utility.Internal("画像の変換に失敗しました。", err)
		}
	}

	size, err := putFile(ctx, key, src, contentType)
	if err != nil {
		return utility.Internal("アップロードに失敗しました。", err)
	}
	var id int
	if err := utility.DB.QueryRowContext(ctx, SQLquery.InsertEventFile,
		eventID, kind, displayName(fh.Filename), key, size, userID).Scan(&id); err != nil {
		deleteObjects(key)
		return utility.Internal("アップロードに失敗しました。", err)
	}
	return nil
}

// displayName は一覧に出すファイル名。パスを落とし、長すぎれば切る。
func displayName(name string) string {
	name = strings.TrimSpace(filepath.Base(strings.ReplaceAll(name, `\`, "/")))
	if name == "." || name == "/" {
		return ""
	}
	if utf8.RuneCountInString(name) > maxFileNameRunes {
		name = string([]rune(name)[:maxFileNameRunes])
	}
	return name
}

// DeleteEventFile はイベントのPDF・画像を消す。部長・副部長のみ。
func DeleteEventFile(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return utility.MethodNotAllowed(r.Method)
	}
	if _, err := utility.RequireRole(r, utility.ManagementRoles...); err != nil {
		return err
	}

	var req model.DeleteEventFileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return utility.BadRequest("入力内容を確認してください。", err)
	}
	defer r.Body.Close()
	if req.EventID == 0 || req.FileID == 0 {
		return utility.BadRequest("削除するファイルが指定されていません。", errors.New("event_id and file_id are required"))
	}

	var key string
	err := utility.DB.QueryRowContext(r.Context(), SQLquery.DeleteEventFile, req.FileID, req.EventID).Scan(&key)
	if errors.Is(err, sql.ErrNoRows) {
		return utility.NotFound("ファイルが見つかりません。", err)
	}
	if err != nil {
		return utility.Internal("削除に失敗しました。", err)
	}
	deleteObjects(key)

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(map[string]string{"message": "deleted"})
}

// dateEventFiles はその日のイベントごとのファイル。
func dateEventFiles(ctx context.Context, date string) (map[int][]model.EventFile, error) {
	rows, err := utility.DB.QueryContext(ctx, SQLquery.SelectDateEventFiles, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byEvent := map[int][]model.EventFile{}
	for rows.Next() {
		var f model.EventFile
		var eventID int
		var key string
		if err := rows.Scan(&f.ID, &eventID, &f.Kind, &f.Name, &key); err != nil {
			return nil, err
		}
		f.URL = Store.URL(key)
		byEvent[eventID] = append(byEvent[eventID], f)
	}
	return byEvent, rows.Err()
}
