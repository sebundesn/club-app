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

const AccountLogTable = `
	CREATE TABLE IF NOT EXISTS accountLog (
		id SERIAL PRIMARY KEY,
		date DATE NOT NULL,
		content TEXT NOT NULL,
		amount INTEGER NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
	);
`

const ReceiptImagesTable = `
	CREATE TABLE IF NOT EXISTS receipt_images (
		id SERIAL PRIMARY KEY,
		event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
		image_url TEXT NOT NULL
	);
`

const UserTable = `
	CREATE TABLE IF NOT EXISTS users  (
		id SERIAL PRAIMARY KEY
		user_name TEXT NOT NULL
		password_hash TEXT NOT NULL
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	); 
`
