package SQLquery

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

const accountLogTable = `
	CREATE TABLE IF NOT EXISTS accountLog (
		id SERIAL PRIMARY KEY,
		date DATE NOT NULL,
		content TEXT NOT NULL
		amount INTEGER NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
	);
`