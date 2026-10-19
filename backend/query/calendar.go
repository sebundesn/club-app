package query

const CreateEventsTable_Q = `
	CREATE TABLE IF NOT EXISTS events (
		id SERIAL PRIMARY KEY,
		date DATE NOT NULL,
		title TEXT,
		subtitle TEXT,
		content TEXT,
		pdf_path TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
`

// date の UNIQUE は「同じ日に2件目を登録すると1件目が上書きされて消える」
// 原因だったので外す。既存DBにも効くよう個別のマイグレーションにしている。
const DropEventsDateUnique = `
	ALTER TABLE events DROP CONSTRAINT IF EXISTS events_date_key;
`

const CreateEventsDateIndex = `
	CREATE INDEX IF NOT EXISTS events_date_idx ON events (date);
`

const InsertEvent = `
	INSERT INTO events (date, title, subtitle, content, pdf_path)
	VALUES ($1, $2, $3, $4, $5)
	RETURNING id;
`

const UpdateEvent = `
	UPDATE events
	SET title = $2,
		subtitle = $3,
		content = $4,
		pdf_path = $5
	WHERE id = $1;
`

const SelectMonthNotes = `
	SELECT id, date, title FROM events
	WHERE CAST(date as TEXT) LIKE $1
	ORDER BY date, id;
`

const GetDateEvents = `
	SELECT id, title, subtitle, content, pdf_path
	FROM events WHERE date = $1
	ORDER BY id;
`
