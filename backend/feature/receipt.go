package feature

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	schema "club-app/model"
	SQLquery "club-app/query"
	utility "club-app/util"

	"github.com/google/uuid"
)

const (
	// 1リクエスト全体のサイズ上限。ディスクを埋められないよう必ず頭打ちにする。
	// スマホの写真は1枚が数MBあるので、数枚まとめて送れる大きさにしている(1枚あたりは maxPhotoBytes で別に制限)。
	maxUploadSize = 60 << 20 // 60MB
	// メモリに載せる上限。超えた分はテンポラリファイルに落ちる。
	maxUploadMemory = 10 << 20 // 10MB
	maxUploadFiles  = 10

	// 1イベントのレシートは5〜10枚ほどなので、余裕を見て20枚までにする
	maxReceiptsPerEvent = 20
	receiptURLTTL       = 15 * time.Minute
)

// 保存を許可する画像形式。拡張子はここの値だけを使い、
// ユーザーが送ってきたファイル名は一切使わない。
var allowedImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
}

// GetReceipts はレシートをイベントごとに返す。
//   - ?eventID=N: そのイベントだけ(詳細ページ用)
//   - ?dir=future|past&date=YYYY-MM-DD&id=N&limit=N: 一覧の無限スクロール用(parseEventCursor を参照)
func GetReceipts(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return utility.MethodNotAllowed(r.Method)
	}

	// 参加者・徴収額と一緒に部員全員が見られる(未ログインは不可)
	if _, err := utility.RequireLogin(r); err != nil {
		return err
	}

	q := r.URL.Query()
	var (
		rows  *sql.Rows
		err   error
		limit int
	)

	if v := q.Get("eventID"); v != "" {
		eventID, convErr := strconv.Atoi(v)
		if convErr != nil {
			return utility.BadRequest("イベントの指定が不正です。", convErr)
		}
		rows, err = utility.DB.QueryContext(r.Context(), SQLquery.GetReceiptsOfEvent, eventID)
	} else {
		c, cErr := parseEventCursor(q)
		if cErr != nil {
			return cErr
		}
		limit = c.Limit
		rows, err = utility.DB.QueryContext(r.Context(), c.pick(SQLquery.GetReceiptsAfter, SQLquery.GetReceiptsBefore), c.args()...)
	}
	if err != nil {
		return utility.Internal("レシートの取得に失敗しました。", err)
	}
	defer rows.Close()

	events, err := scanEventReceipts(r.Context(), rows)
	if err != nil {
		return err
	}

	page := schema.ReceiptsPage{Events: events}
	if limit > 0 && len(events) > limit {
		page.Events = events[:limit]
		page.HasMore = true
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(page)
}

// scanEventReceipts は「イベント × 画像」の行を、イベントごとにまとめる。並びは行の順のまま。
func scanEventReceipts(ctx context.Context, rows *sql.Rows) ([]schema.EventReceipts, error) {
	eventsMap := make(map[int]*schema.EventReceipts)
	var order []int

	for rows.Next() {
		var id int
		var title sql.NullString
		var date string
		var imgID sql.NullInt64
		var imgURL, objectKey sql.NullString

		if err := rows.Scan(&id, &title, &date, &imgID, &imgURL, &objectKey); err != nil {
			return nil, utility.Internal("レシートの取得に失敗しました。", err)
		}

		if _, ok := eventsMap[id]; !ok {
			eventsMap[id] = &schema.EventReceipts{
				ID:     id,
				Title:  title.String,
				Date:   date,
				Images: []schema.ReceiptImage{},
			}
			order = append(order, id)
		}

		if imgID.Valid {
			url := imgURL.String // 旧データはサーバーのディスクのパスのまま
			if objectKey.Valid && objectKey.String != "" {
				signed, err := Store.SignedURL(ctx, objectKey.String, receiptURLTTL)
				if err != nil {
					return nil, utility.Internal("レシートの取得に失敗しました。", err)
				}
				url = signed
			}
			eventsMap[id].Images = append(eventsMap[id].Images, schema.ReceiptImage{ID: int(imgID.Int64), URL: url})
		}
	}
	if err := rows.Err(); err != nil {
		return nil, utility.Internal("レシートの取得に失敗しました。", fmt.Errorf("error during rows iteration: %w", err))
	}

	events := []schema.EventReceipts{}
	for _, id := range order {
		events = append(events, *eventsMap[id])
	}
	return events, nil
}

func UploadReceipt(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return utility.MethodNotAllowed(r.Method)
	}

	user, err := utility.RequireLogin(r)
	if err != nil {
		return err
	}

	// 変換前のファイルでディスクを埋められないよう、同時に受け付ける数を絞る(アルバムと共通)
	select {
	case uploadSlots <- struct{}{}:
		defer func() { <-uploadSlots }()
	default:
		return utility.NewAppError(http.StatusServiceUnavailable,
			"アップロードが混み合っています。少し待ってからもう一度お試しください。", errors.New("too many concurrent uploads"))
	}

	// ParseMultipartForm より先に包むことで、巨大なボディを読み切る前に打ち切れる
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(maxUploadMemory); err != nil {
		return utility.BadRequest("ファイルが大きすぎるか、形式が不正です。", err)
	}
	defer r.MultipartForm.RemoveAll()

	eventID, err := strconv.Atoi(r.FormValue("eventID"))
	if err != nil {
		return utility.BadRequest("イベントが指定されていません。", err)
	}

	files := r.MultipartForm.File["images"]
	if len(files) == 0 {
		return utility.BadRequest("画像が選択されていません。", errors.New("no files"))
	}
	if len(files) > maxUploadFiles {
		return utility.BadRequest(
			fmt.Sprintf("一度にアップロードできるのは%d枚までです。", maxUploadFiles),
			fmt.Errorf("too many files: %d", len(files)),
		)
	}

	var n int
	if err := utility.DB.QueryRowContext(r.Context(), SQLquery.CountReceipts, eventID).Scan(&n); err != nil {
		return utility.Internal("アップロードに失敗しました。", err)
	}
	if n+len(files) > maxReceiptsPerEvent {
		return utility.NewAppError(http.StatusConflict,
			fmt.Sprintf("レシートは1イベント%d枚までです(現在%d枚)。", maxReceiptsPerEvent, n),
			fmt.Errorf("receipt quota exceeded: %d+%d", n, len(files)))
	}

	tmpDir, err := os.MkdirTemp("", "club-receipt-")
	if err != nil {
		return utility.Internal("アップロードに失敗しました。", err)
	}
	defer os.RemoveAll(tmpDir)

	for i, fileHeader := range files {
		if err := saveReceiptFile(r.Context(), tmpDir, i, eventID, user.ID, fileHeader); err != nil {
			return err
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, err = w.Write([]byte(`{"message": "upload successful"}`))
	return err
}

// saveReceiptFile は1枚分の検証・縮小・保存を行う。
// 領収書は文字が読めればよいので、写真と同じく長辺1600pxのJPEGにそろえる。
func saveReceiptFile(ctx context.Context, tmpDir string, idx, eventID, userID int, fileHeader *multipart.FileHeader) error {
	if fileHeader.Size > maxPhotoBytes {
		return utility.BadRequest("画像は1枚20MBまでです。", fmt.Errorf("receipt too large: %d", fileHeader.Size))
	}

	in := filepath.Join(tmpDir, fmt.Sprintf("in_%d", idx))
	// ファイル名の拡張子は信用できないので、中身の先頭512バイトから形式を判定する
	if err := saveUpload(fileHeader, in, func(head []byte) error {
		if _, ok := allowedImageTypes[contentTypeOf(head)]; !ok {
			return errors.New("disallowed content type")
		}
		return nil
	}); err != nil {
		return utility.BadRequest("JPEGまたはPNGの画像のみアップロードできます。", err)
	}

	out := filepath.Join(tmpDir, fmt.Sprintf("out_%d.jpg", idx))
	if err := withTranscodeSlot(ctx, func() error {
		return runFFmpeg(ctx, photoArgs(in, out, photoMaxSide)...)
	}); err != nil {
		return utility.Internal("画像の変換に失敗しました。", err)
	}

	// 保存名はサーバー生成の値だけで作る（ユーザー由来のファイル名は使わない）
	key := fmt.Sprintf("receipts/%d/%s.jpg", eventID, uuid.New().String())
	size, err := putFile(ctx, key, out, "image/jpeg")
	if err != nil {
		return utility.Internal("アップロードに失敗しました。", err)
	}

	if _, err := utility.DB.ExecContext(ctx, SQLquery.InsertReceipts, eventID, userID, key, size); err != nil {
		deleteObjects(key)
		return utility.Internal("アップロードに失敗しました。", fmt.Errorf("failed to execute query: %w", err))
	}
	return nil
}

func contentTypeOf(head []byte) string {
	detected := http.DetectContentType(head)
	// "image/jpeg; charset=..." のようにパラメータが付くことがあるので落とす
	for i := 0; i < len(detected); i++ {
		if detected[i] == ';' {
			return detected[:i]
		}
	}
	return detected
}

func DeleteImg(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return utility.MethodNotAllowed(r.Method)
	}

	// 間違えて上げたものを本人がすぐ消せるよう、部員なら誰でも消せる
	if _, err := utility.RequireLogin(r); err != nil {
		return err
	}

	var res schema.DeleteImageRequest
	if err := json.NewDecoder(r.Body).Decode(&res); err != nil {
		return utility.BadRequest("入力内容を確認してください。", err)
	}
	defer r.Body.Close()

	if res.EventID == 0 || res.ImageID == 0 {
		return utility.BadRequest("削除する画像が指定されていません。", errors.New("event_id and image_id are required"))
	}

	var oldURL string
	var objectKey sql.NullString
	err := utility.DB.QueryRowContext(r.Context(), SQLquery.DeleteImgQuery, res.ImageID, res.EventID).Scan(&oldURL, &objectKey)
	if errors.Is(err, sql.ErrNoRows) {
		return utility.NotFound("画像が見つかりません。", err)
	}
	if err != nil {
		return utility.Internal("削除に失敗しました。", fmt.Errorf("failed to delete image %d: %w", res.ImageID, err))
	}

	if objectKey.Valid {
		deleteObjects(objectKey.String)
	} else if oldURL != "" {
		// 旧データ: サーバーのディスクにあるファイル。uploads の外は消さない
		removeLegacyUpload(oldURL)
	}
	return nil
}

func removeLegacyUpload(url string) {
	name := filepath.Base(url)
	if name == "." || name == "/" || filepath.Join("/uploads", name) != url {
		return
	}
	if err := os.Remove(filepath.Join("./uploads", name)); err != nil && !os.IsNotExist(err) {
		log.Printf("remove legacy upload %s: %v", name, err)
	}
}
