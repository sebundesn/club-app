package schema

type EventDetail struct {
	Title    string `json:"title"`
	Subtitle string `json:"subtitle"`
	Content  string `json:"content"`
	PDFPath  string `json:"pdf_path"`
}