package query

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

const UpSertDateContent = `
	INSERT INTO events (date, title, subtitle, content, pdf_path)
	VALUES ($1, $2, $3, $4, $5)
	ON CONFLICT(date)
	DO UPDATE SET
		title = EXCLUDED.title,
		subtitle = EXCLUDED.subtitle,
		content = EXCLUDED.content;
`

const SelectMonthNotes = `
	SELECT date, title FROM events WHERE CAST(date as TEXT) LIKE $1;
`

const GetDateEvent = `
	SELECT title, subtitle, content, pdf_path
	FROM events WHERE date = $1;
`

//notificate section
const CreateNotificateTable = `
	CREATE TABLE IF NOT EXISTS notificate (
		id SERIAL PRIMARY KEY,
		user_id INT NOT NULL,
		title TEXT NOT NULL,
		is_completed BOOLEAN DEFAULT FALSE,
		due_date DATE,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);
`

const FetchNotificates = `
	SELECT id, title, due_date FROM notificate
	WHERE user_id = $1
		AND (due_date >= CURRENT_DATE OR due_date IS NULL)
		AND is_completed = FALSE
	ORDER BY created_at ASC;
` 