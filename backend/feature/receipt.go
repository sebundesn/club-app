package feature

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
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

func GetMonthReceipts(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodGet {
		return fmt.Errorf("Method not allowed: %s", r.Method)
	}

	howLongWeek := r.URL.Query().Get("howLongWeek")
	if howLongWeek == "" {
		howLongWeek = "2"
	}

	rows, err := utility.DB.Query(SQLquery.GetReceiptsLog, howLongWeek)
	if err != nil {
		return fmt.Errorf("Failed to get rows: %w", err)
	}
	defer rows.Close()

	eventsMap := make(map[int]*schema.EventReceipts)
	var order []int

	for rows.Next() {
		var id int
		var title, date string
		var imgURL sql.NullString

		err := rows.Scan(&id, &title, &date, &imgURL)
		if err != nil {
			return err
		}

		if _, ok := eventsMap[id]; !ok {
			eventsMap[id] = &schema.EventReceipts{
				ID:     id,
				Title:  title,
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
		return fmt.Errorf("error during rows iteration: %w", err)
	}

	var receipts []schema.EventReceipts
	for _, id := range order {
		receipts = append(receipts, *eventsMap[id])
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(receipts)
}

func UploadReceipt(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return fmt.Errorf("Method not allowed: %s", r.Method)
	}

	//to check if the uploads file exists
	uploadDir := "./uploads"
	if _, err := os.Stat(uploadDir); os.IsNotExist(err) {
		os.Mkdir(uploadDir, os.ModePerm)
	}

	eventID, err := strconv.Atoi(r.FormValue("eventID"))
	if err != nil {
		return fmt.Errorf("failed to convert string to integer: %w\n", err)
	}

	files := r.MultipartForm.File["images"]

	for _, fileHeader := range files {

		file, err := fileHeader.Open()
		if err != nil {
			return fmt.Errorf("failed to open file: %w\n", err)
		}
		defer file.Close()

		timestamp := time.Now().Format("20060102_150405")
		shortUUID := uuid.New().String()[:8]
		ext := filepath.Ext(fileHeader.Filename)
		filename := timestamp + shortUUID + ext
		savePath := filepath.Join(uploadDir, filename)

		out, err := os.Create(savePath)
		if err != nil {
			return fmt.Errorf("failed to create local file: %w\n", err)
		}
		defer out.Close()

		_, err = io.Copy(out, file)
		if err != nil {
			return fmt.Errorf("failed to save file: %w\n", err)
		}

		imageURL := fmt.Sprintf(`/uploads/%s`, filename)

		_, err = utility.DB.Exec(SQLquery.InsertReceipts, eventID, imageURL)
		if err != nil {
			return fmt.Errorf("failed to execute query: %w\n", err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "upload successful"}`))

	return nil
}

func DeleteImg(w http.ResponseWriter, r *http.Request) error {
	if r.Method != http.MethodPost {
		return fmt.Errorf("Method not allowed: %s", r.Method)
	}

	var res schema.DeleteImageRequest
	err := json.NewDecoder(r.Body).Decode(&res)
	if err != nil {
		return fmt.Errorf("Failed to decode: %s", err)
	}
	defer r.Body.Close()

	_, err = utility.DB.Exec(SQLquery.DeleteImgQuery, res.Date, res.URL)
	if err != nil {
		return fmt.Errorf("Failed to delete url: %s", res.URL)
	}

	return nil
}
