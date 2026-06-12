package query

const UserTable = `
	CREATE TABLE IF NOT EXISTS users  (
		id SERIAL PRIMARY KEY,
		student_id VARCHAR(7) UNIQUE NOT NULL,
		username TEXT DEFAULT NULL,
		realname TEXT DEFAULT NULL,
		role TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
`
