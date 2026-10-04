package feature

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
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
	maxUploadSize = 20 << 20 // 20MB
	// メモリに載せる上限。超えた分はテンポラリファイルに落ちる。
	maxUploadMemory = 10 << 20 // 10MB
	maxUploadFiles  = 10
)

// 保存を許可する画像形式。拡張子はここの値だけを使い、
// ユーザーが送ってきたファイル名は一切使わない。
var allowedImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
}

func GetMonthReceipts(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return utility.MethodNotAllowed(r.Method)
	}

	howLongWeek := r.URL.Query().Get("howLongWeek")
	if howLongWeek == "" {
		howLongWeek = "2"
	}
	if _, err := strconv.Atoi(howLongWeek); err != nil {
		return utility.BadRequest("期間の指定が不正です。", err)
	}

	rows, err := utility.DB.Query(SQLquery.GetReceiptsLog, howLongWeek)
	if err != nil {
		return utility.Internal("レシートの取得に失敗しました。", err)
	}
	defer rows.Close()

	eventsMap := make(map[int]*schema.EventReceipts)
	var order []int

	for rows.Next() {
		var id int
		var title sql.NullString
		var date string
		var imgURL sql.NullString

		err := rows.Scan(&id, &title, &date, &imgURL)
		if err != nil {
			return utility.Internal("レシートの取得に失敗しました。", err)
		}

		if _, ok := eventsMap[id]; !ok {
			eventsMap[id] = &schema.EventReceipts{
				ID:     id,
				Title:  title.String,
				Date:   date,
				Images: []string{},
			}
			order = append(order, id)
		}

		if imgURL.Valid {
			eventsMap[id].Images = append(eventsMap[id].Images, imgURL.String)
		}
	}
	if err := rows.Err(); err != nil {
		return utility.Internal("レシートの取得に失敗しました。", fmt.Errorf("error during rows iteration: %w", err))
	}

	receipts := []schema.EventReceipts{}
	for _, id := range order {
		receipts = append(receipts, *eventsMap[id])
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(receipts)
}

func UploadReceipt(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return utility.MethodNotAllowed(r.Method)
	}

	if _, err := utility.RequireLogin(r); err != nil {
		return err
	}

	// ParseMultipartForm より先に包むことで、巨大なボディを読み切る前に打ち切れる
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(maxUploadMemory); err != nil {
		return utility.BadRequest("ファイルが大きすぎるか、形式が不正です。", err)
	}
	defer r.MultipartForm.RemoveAll()

	//to check if the uploads file exists
	uploadDir := "./uploads"
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		return utility.Internal("アップロードに失敗しました。", err)
	}

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

	for _, fileHeader := range files {
		if err := saveReceiptFile(uploadDir, eventID, fileHeader); err != nil {
			return err
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, err = w.Write([]byte(`{"message": "upload successful"}`))
	return err
}

// saveReceiptFile は1枚分の検証と保存を行う。
// ループ内で defer を積むと全ファイル処理後までクローズされないため関数に切り出した。
func saveReceiptFile(uploadDir string, eventID int, fileHeader *multipart.FileHeader) error {
	file, err := fileHeader.Open()
	if err != nil {
		return utility.Internal("アップロードに失敗しました。", fmt.Errorf("failed to open file: %w", err))
	}
	defer file.Close()

	// ファイル名の拡張子は信用できないので、中身の先頭512バイトから形式を判定する
	head := make([]byte, 512)
	n, err := io.ReadFull(file, head)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) && !errors.Is(err, io.EOF) {
		return utility.Internal("アップロードに失敗しました。", err)
	}

	ext, ok := allowedImageTypes[contentTypeOf(head[:n])]
	if !ok {
		return utility.BadRequest("JPEGまたはPNGの画像のみアップロードできます。", errors.New("disallowed content type"))
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return utility.Internal("アップロードに失敗しました。", err)
	}

	// 保存名はサーバー生成の値だけで作る（ユーザー由来のファイル名は使わない）
	filename := time.Now().Format("20060102_150405") + uuid.New().String()[:8] + ext
	savePath := filepath.Join(uploadDir, filename)

	out, err := os.Create(savePath)
	if err != nil {
		return utility.Internal("アップロードに失敗しました。", fmt.Errorf("failed to create local file: %w", err))
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		return utility.Internal("アップロードに失敗しました。", fmt.Errorf("failed to save file: %w", err))
	}

	imageURL := fmt.Sprintf(`/uploads/%s`, filename)

	if _, err := utility.DB.Exec(SQLquery.InsertReceipts, eventID, imageURL); err != nil {
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

	if _, err := utility.RequireRole(r, utility.RoleTreasurer); err != nil {
		return err
	}

	var res schema.DeleteImageRequest
	if err := json.NewDecoder(r.Body).Decode(&res); err != nil {
		return utility.BadRequest("入力内容を確認してください。", err)
	}
	defer r.Body.Close()

	if res.EventID == 0 || res.URL == "" {
		return utility.BadRequest("削除する画像が指定されていません。", errors.New("event_id and url are required"))
	}

	if _, err := utility.DB.Exec(SQLquery.DeleteImgQuery, res.EventID, res.URL); err != nil {
		return utility.Internal("削除に失敗しました。", fmt.Errorf("failed to delete url %s: %w", res.URL, err))
	}

	return nil
}
