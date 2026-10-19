package feature

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	schema "club-app/model"
	SQLquery "club-app/query"
	"club-app/storage"
	utility "club-app/util"

	"github.com/google/uuid"
)

const (
	maxPhotosPerEvent = 150
	maxVideosPerEvent = 10

	maxPhotosPerRequest = 10
	maxPhotoBytes       = 20 << 20  // 変換前の1枚あたり
	maxVideoBytes       = 200 << 20 // 変換前の1本あたり(スマホの1分動画が収まる大きさ)
	maxMediaRequest     = maxVideoBytes + (1 << 20)
	maxMediaMemory      = 10 << 20

	// 変換前のファイルでディスクを埋められないよう、同時に受け付ける数を絞る
	maxConcurrentUploads = 4
)

var uploadSlots = make(chan struct{}, maxConcurrentUploads)

// Store はアルバム・レシートの実体の保存先。main で storage.New の結果を入れる。
var Store storage.Storage

func InitMedia(ctx context.Context) error {
	s, err := storage.New(ctx)
	if err != nil {
		return err
	}
	Store = s
	return nil
}

func mediaLimit(kind string) int {
	if kind == "video" {
		return maxVideosPerEvent
	}
	return maxPhotosPerEvent
}

func kindLabel(kind string) string {
	if kind == "video" {
		return "動画"
	}
	return "写真"
}

// UploadMedia は写真(複数可)または動画(1本)をアルバムに追加する。
func UploadMedia(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return utility.MethodNotAllowed(r.Method)
	}
	user, err := utility.RequireLogin(r)
	if err != nil {
		return err
	}

	select {
	case uploadSlots <- struct{}{}:
		defer func() { <-uploadSlots }()
	default:
		return utility.NewAppError(http.StatusServiceUnavailable,
			"アップロードが混み合っています。少し待ってからもう一度お試しください。", errors.New("too many concurrent uploads"))
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxMediaRequest)
	if err := r.ParseMultipartForm(maxMediaMemory); err != nil {
		return utility.BadRequest("ファイルが大きすぎるか、形式が不正です。", err)
	}
	defer r.MultipartForm.RemoveAll()

	eventID, err := strconv.Atoi(r.FormValue("eventID"))
	if err != nil {
		return utility.BadRequest("イベントが指定されていません。", err)
	}
	kind := r.FormValue("kind")
	if kind != "photo" && kind != "video" {
		return utility.BadRequest("写真か動画かを指定してください。", errors.New("invalid kind"))
	}

	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		return utility.BadRequest("ファイルが選択されていません。", errors.New("no files"))
	}
	if kind == "video" && len(files) != 1 {
		return utility.BadRequest("動画は1本ずつアップロードしてください。", errors.New("multiple videos"))
	}
	if kind == "photo" && len(files) > maxPhotosPerRequest {
		return utility.BadRequest(
			fmt.Sprintf("一度にアップロードできるのは%d枚までです。", maxPhotosPerRequest),
			fmt.Errorf("too many files: %d", len(files)))
	}

	// 変換の前に、枠が足りるかを軽く確認する(確定は登録時のトランザクション)
	if err := checkQuota(r.Context(), eventID, kind, len(files)); err != nil {
		return err
	}

	tmpDir, err := os.MkdirTemp("", "club-media-")
	if err != nil {
		return utility.Internal("アップロードに失敗しました。", err)
	}
	// 動画は変換をバックグラウンドで続けるので、後始末はそちら側で行う
	cleanupTmp := true
	defer func() {
		if cleanupTmp {
			os.RemoveAll(tmpDir)
		}
	}()

	if kind == "video" {
		if err := acceptVideo(r.Context(), tmpDir, eventID, user.ID, files[0]); err != nil {
			return err
		}
		cleanupTmp = false
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		return json.NewEncoder(w).Encode(map[string]string{"message": "変換中です。完了するとアルバムに表示されます。"})
	}

	if err := acceptPhotos(r.Context(), tmpDir, eventID, user.ID, files); err != nil {
		return err
	}
	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(map[string]string{"message": "upload successful"})
}

// checkQuota は追加しても上限を超えないかを確認する(ロックなしの事前確認)。
func checkQuota(ctx context.Context, eventID int, kind string, adding int) error {
	var n int
	if err := utility.DB.QueryRowContext(ctx, SQLquery.CountEventMedia, eventID, kind).Scan(&n); err != nil {
		return utility.Internal("アップロードに失敗しました。", err)
	}
	return quotaError(kind, n, adding)
}

func quotaError(kind string, current, adding int) error {
	limit := mediaLimit(kind)
	if current+adding <= limit {
		return nil
	}
	left := limit - current
	if left < 0 {
		left = 0
	}
	return utility.NewAppError(http.StatusConflict,
		fmt.Sprintf("このイベントの%sは上限(%d)に達しています。残り%d。不要な%sを削除すると枠が空きます。",
			kindLabel(kind), limit, left, kindLabel(kind)),
		fmt.Errorf("%s quota exceeded: %d+%d>%d", kind, current, adding, limit))
}

type storedMedia struct {
	mainKey, thumbKey string
	size              int64
}

func newKeys(eventID int, ext string) (mainKey, thumbKey string) {
	id := uuid.New().String()
	base := fmt.Sprintf("media/%d/%s", eventID, id)
	return base + ext, base + "_t.jpg"
}

func acceptPhotos(ctx context.Context, tmpDir string, eventID, userID int, files []*multipart.FileHeader) error {
	var stored []storedMedia
	rollback := func() {
		for _, s := range stored {
			deleteObjects(s.mainKey, s.thumbKey)
		}
	}

	for i, fh := range files {
		if fh.Size > maxPhotoBytes {
			rollback()
			return utility.BadRequest("写真は1枚20MBまでです。", fmt.Errorf("photo too large: %d", fh.Size))
		}
		in := filepath.Join(tmpDir, fmt.Sprintf("in_%d", i))
		if err := saveUpload(fh, in, func(head []byte) error {
			switch contentTypeOf(head) {
			case "image/jpeg", "image/png":
				return nil
			}
			return errors.New("not jpeg/png")
		}); err != nil {
			rollback()
			return utility.BadRequest("JPEGまたはPNGの写真のみアップロードできます。", err)
		}

		outMain := filepath.Join(tmpDir, fmt.Sprintf("out_%d.jpg", i))
		outThumb := filepath.Join(tmpDir, fmt.Sprintf("thumb_%d.jpg", i))
		if err := withTranscodeSlot(ctx, func() error { return processPhoto(ctx, in, outMain, outThumb) }); err != nil {
			rollback()
			return utility.Internal("写真の変換に失敗しました。", err)
		}

		mainKey, thumbKey := newKeys(eventID, ".jpg")
		size, err := putFile(ctx, mainKey, outMain, "image/jpeg")
		if err != nil {
			rollback()
			return utility.Internal("アップロードに失敗しました。", err)
		}
		stored = append(stored, storedMedia{mainKey: mainKey, thumbKey: thumbKey, size: size})
		if _, err := putFile(ctx, thumbKey, outThumb, "image/jpeg"); err != nil {
			rollback()
			return utility.Internal("アップロードに失敗しました。", err)
		}
	}

	if err := insertMediaBatch(ctx, eventID, userID, "photo", stored); err != nil {
		rollback()
		return err
	}
	return nil
}

// insertMediaBatch は枠の確認と登録を1つのトランザクションで行う。
// イベントの行を先にロックするので、同時アップロードでも上限を超えない。
func insertMediaBatch(ctx context.Context, eventID, userID int, kind string, items []storedMedia) error {
	tx, err := utility.DB.BeginTx(ctx, nil)
	if err != nil {
		return utility.Internal("アップロードに失敗しました。", err)
	}
	defer tx.Rollback()

	var lockedID int
	if err := tx.QueryRowContext(ctx, SQLquery.LockEventForUpload, eventID).Scan(&lockedID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return utility.NotFound("イベントが見つかりません。", err)
		}
		return utility.Internal("アップロードに失敗しました。", err)
	}

	var n int
	if err := tx.QueryRowContext(ctx, SQLquery.CountEventMedia, eventID, kind).Scan(&n); err != nil {
		return utility.Internal("アップロードに失敗しました。", err)
	}
	if err := quotaError(kind, n, len(items)); err != nil {
		return err
	}

	for _, it := range items {
		var id int
		if err := tx.QueryRowContext(ctx, SQLquery.InsertEventMedia,
			eventID, userID, kind, it.mainKey, it.thumbKey, it.size, nil, "ready").Scan(&id); err != nil {
			return utility.Internal("アップロードに失敗しました。", err)
		}
	}
	if err := tx.Commit(); err != nil {
		return utility.Internal("アップロードに失敗しました。", err)
	}
	return nil
}

// acceptVideo は長さを確認して「変換中」として登録し、変換は裏で進める。
func acceptVideo(ctx context.Context, tmpDir string, eventID, userID int, fh *multipart.FileHeader) error {
	if fh.Size > maxVideoBytes {
		return utility.BadRequest("動画が大きすぎます。", fmt.Errorf("video too large: %d", fh.Size))
	}
	in := filepath.Join(tmpDir, "in_video")
	if err := saveUpload(fh, in, func([]byte) error { return nil }); err != nil {
		return utility.Internal("アップロードに失敗しました。", err)
	}

	dur, err := probeVideoDuration(ctx, in)
	if err != nil {
		return utility.BadRequest("動画として読み込めませんでした。", err)
	}
	// 端数やコンテナ差で60.0x秒になることがあるので少しだけ余裕を持たせる
	if dur > videoMaxSec+1 {
		return utility.BadRequest(
			fmt.Sprintf("動画は%d秒以内にしてください。", videoMaxSec),
			fmt.Errorf("video too long: %.1fs", dur))
	}

	mainKey, thumbKey := newKeys(eventID, ".mp4")
	// 枠は「変換中」の行でも確保する
	tx, err := utility.DB.BeginTx(ctx, nil)
	if err != nil {
		return utility.Internal("アップロードに失敗しました。", err)
	}
	defer tx.Rollback()

	var locked int
	if err := tx.QueryRowContext(ctx, SQLquery.LockEventForUpload, eventID).Scan(&locked); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return utility.NotFound("イベントが見つかりません。", err)
		}
		return utility.Internal("アップロードに失敗しました。", err)
	}
	var n int
	if err := tx.QueryRowContext(ctx, SQLquery.CountEventMedia, eventID, "video").Scan(&n); err != nil {
		return utility.Internal("アップロードに失敗しました。", err)
	}
	if err := quotaError("video", n, 1); err != nil {
		return err
	}
	var id int
	if err := tx.QueryRowContext(ctx, SQLquery.InsertEventMedia,
		eventID, userID, "video", mainKey, thumbKey, 0, int(dur), "processing").Scan(&id); err != nil {
		return utility.Internal("アップロードに失敗しました。", err)
	}
	if err := tx.Commit(); err != nil {
		return utility.Internal("アップロードに失敗しました。", err)
	}

	go finishVideo(tmpDir, in, id, mainKey, thumbKey)
	return nil
}

// finishVideo は裏で変換して保存し、行を「完了」にする。失敗したら行を消して枠を戻す。
func finishVideo(tmpDir, in string, id int, mainKey, thumbKey string) {
	defer os.RemoveAll(tmpDir)
	// リクエストが終わっても続けたいので、リクエストのcontextは使わない
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	fail := func(err error) {
		log.Printf("video %d failed: %v", id, err)
		deleteObjects(mainKey, thumbKey)
		if _, err := utility.DB.Exec(SQLquery.DeleteEventMediaByID, id); err != nil {
			log.Printf("video %d: could not remove row: %v", id, err)
		}
	}

	outMain := filepath.Join(tmpDir, "out.mp4")
	outThumb := filepath.Join(tmpDir, "thumb.jpg")
	if err := withTranscodeSlot(ctx, func() error { return processVideo(ctx, in, outMain, outThumb) }); err != nil {
		fail(err)
		return
	}
	size, err := putFile(ctx, mainKey, outMain, "video/mp4")
	if err != nil {
		fail(err)
		return
	}
	if _, err := putFile(ctx, thumbKey, outThumb, "image/jpeg"); err != nil {
		fail(err)
		return
	}
	if _, err := utility.DB.Exec(SQLquery.MarkEventMediaReady, id, thumbKey, size); err != nil {
		fail(err)
	}
}

// CleanupStaleMedia は再起動で変換が途切れた「変換中」の行を消す(一時ファイルも失われているため)。
func CleanupStaleMedia() {
	rows, err := utility.DB.Query(SQLquery.DeleteProcessingMedia)
	if err != nil {
		log.Printf("cleanup stale media: %v", err)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var k string
		var t sql.NullString
		if rows.Scan(&k, &t) == nil {
			deleteObjects(k, t.String)
		}
	}
}

func withTranscodeSlot(ctx context.Context, fn func() error) error {
	select {
	case transcodeSlot <- struct{}{}:
		defer func() { <-transcodeSlot }()
	case <-ctx.Done():
		return ctx.Err()
	}
	return fn()
}

// saveUpload は検証用に先頭を読んでから、ファイルをディスクに書き出す。
func saveUpload(fh *multipart.FileHeader, dst string, check func(head []byte) error) error {
	src, err := fh.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	head := make([]byte, 512)
	n, err := io.ReadFull(src, head)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) && !errors.Is(err, io.EOF) {
		return err
	}
	if err := check(head[:n]); err != nil {
		return err
	}
	if _, err := src.Seek(0, io.SeekStart); err != nil {
		return err
	}

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, src); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

func putFile(ctx context.Context, key, path, contentType string) (int64, error) {
	f, err := os.Open(path)
	if err != nil {
		return 0, err
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		return 0, err
	}
	if err := Store.Put(ctx, key, f, contentType); err != nil {
		return 0, err
	}
	return st.Size(), nil
}

func deleteObjects(keys ...string) {
	for _, k := range keys {
		if k == "" {
			continue
		}
		if err := Store.Delete(context.Background(), k); err != nil {
			log.Printf("delete object %s: %v", k, err)
		}
	}
}

// GetAlbum はイベントのアルバムと残り枠を返す。
func GetAlbum(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return utility.MethodNotAllowed(r.Method)
	}
	user, err := utility.RequireLogin(r)
	if err != nil {
		return err
	}
	eventID, err := strconv.Atoi(r.URL.Query().Get("eventID"))
	if err != nil {
		return utility.BadRequest("イベントが指定されていません。", err)
	}

	rows, err := utility.DB.QueryContext(r.Context(), SQLquery.SelectEventMedia, eventID)
	if err != nil {
		return utility.Internal("アルバムの取得に失敗しました。", err)
	}
	defer rows.Close()

	album := schema.MediaAlbum{
		EventID:    eventID,
		Items:      []schema.MediaItem{},
		PhotoLimit: maxPhotosPerEvent,
		VideoLimit: maxVideosPerEvent,
	}
	privileged := user.HasRole(utility.RoleChief, utility.RoleViceChief, utility.RoleTreasurer)

	for rows.Next() {
		var (
			id       int
			kind     string
			key      string
			thumb    sql.NullString
			status   string
			uploader sql.NullInt64
			created  time.Time
		)
		if err := rows.Scan(&id, &kind, &key, &thumb, &status, &uploader, &created); err != nil {
			return utility.Internal("アルバムの取得に失敗しました。", err)
		}
		mine := uploader.Valid && int(uploader.Int64) == user.ID
		item := schema.MediaItem{
			ID: id, Kind: kind, Status: status,
			Mine: mine, CanDelete: mine || privileged,
		}
		if kind == "video" {
			album.VideoCount++
		} else {
			album.PhotoCount++
		}
		// 変換中はまだ実体が無いのでURLを渡さない
		if status == "ready" {
			item.URL = Store.URL(key)
			if thumb.Valid {
				item.ThumbURL = Store.URL(thumb.String)
			}
		}
		album.Items = append(album.Items, item)
	}
	if err := rows.Err(); err != nil {
		return utility.Internal("アルバムの取得に失敗しました。", err)
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(album)
}

// DeleteMedia は写真・動画を削除する。アップロードした本人か、役員だけができる。
func DeleteMedia(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return utility.MethodNotAllowed(r.Method)
	}
	user, err := utility.RequireLogin(r)
	if err != nil {
		return err
	}

	var req schema.DeleteMediaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return utility.BadRequest("入力内容を確認してください。", err)
	}
	defer r.Body.Close()
	if req.ID == 0 {
		return utility.BadRequest("削除する対象が指定されていません。", errors.New("id required"))
	}

	// 権限の確認と削除を1文で行い、他人のものを消せないようにする
	var key string
	var thumb sql.NullString
	err = utility.DB.QueryRowContext(r.Context(), SQLquery.DeleteEventMediaIfAllowed,
		req.ID, user.ID, user.HasRole(utility.RoleChief, utility.RoleViceChief, utility.RoleTreasurer),
	).Scan(&key, &thumb)
	if errors.Is(err, sql.ErrNoRows) {
		return utility.Forbidden("削除できるのはアップロードした本人か役員のみです。", fmt.Errorf("media %d not deletable by user %d", req.ID, user.ID))
	}
	if err != nil {
		return utility.Internal("削除に失敗しました。", err)
	}

	deleteObjects(key, thumb.String)
	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(map[string]string{"message": "deleted"})
}
