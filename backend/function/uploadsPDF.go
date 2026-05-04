package function

import (
	"club-app/utility"
	"club-app/SQLquery"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

func uploadHandler(w http.ResponseWriter, r *http.Request) error {
	file, _, err := r.FormFile("pdf")
	if err != nil {
		return fmt.Errorf("Failed to get pdf: %w", err)
	}
	defer file.Close()

	date := r.FormValue("date")
	TimeStamp := time.Now().UnixMilli()
	fileName := fmt.Sprintf("%s_%d.pdf", date, TimeStamp)
	filePath := "./uploads/" + fileName

	out, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("Failed to create file: %w", err)
	}
	defer out.Close()
	io.Copy(out, file)

	_, err = utility.DB.Exec(SQLquery.GeneratePDFPath_Q, date, fileName)
	if err != nil {
		return fmt.Errorf("Failed for sql execution: %w", err)
	}

	fmt.Fprintf(w, "PDFupload success: %s", fileName)

	return nil
}
