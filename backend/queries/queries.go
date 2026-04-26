package queries

const CreateEventsTable_Q = `
	CREATE TABLE IF NOT EXISTS events (
		id SERIAL PRIMARY KEY,
		date DATE UNIQUE NOT NULL,
		title TEXT,
		subtitle TEXT,
		content TEXT,
		pdf_path TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
`

const GeneratePDFPath_Q = `
	UPDATE events SET pdf_path = $1 WHERE date = $2
`