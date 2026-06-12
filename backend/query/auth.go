package query

const UserTable = `
	CREATE TABLE IF NOT EXISTS users  (
		id SERIAL PRIMARY KEY,
		student_id VARCHAR(7) UNIQUE NOT NULL,
		name TEXT NOT NULL,
		role TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`
