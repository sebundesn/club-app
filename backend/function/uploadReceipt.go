package function

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"time"

	"club-app/SQLquery"
	"club-app/utility"
	"path/filepath"

	"github.com/google/uuid"
)

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

		database_url := os.Getenv("DATABASE_URL")
		imageURL := fmt.Sprintf(`%s/uploads/%s`, database_url, filename)

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
