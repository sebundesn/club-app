package query

// イベントに付けるPDF・画像(案内やポスターなど)。カレンダーから誰でも見られる。
// 実体は S3 の media/events/ 以下で、キーはランダムなUUID(アルバムと同じく CloudFront の /media/* で配信)。
const CreateEventFilesTable = `
	CREATE TABLE IF NOT EXISTS event_files (
		id SERIAL PRIMARY KEY,
		event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
		kind TEXT NOT NULL CHECK (kind IN ('pdf', 'image')),
		name TEXT NOT NULL DEFAULT '',
		object_key TEXT NOT NULL,
		size_bytes BIGINT NOT NULL DEFAULT 0,
		uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
`

const CreateEventFilesIndex = `
	CREATE INDEX IF NOT EXISTS event_files_event_idx ON event_files (event_id);
`

const EventExists = `
	SELECT EXISTS (SELECT 1 FROM events WHERE id = $1);
`

const CountEventFiles = `
	SELECT COUNT(*) FROM event_files WHERE event_id = $1;
`

const InsertEventFile = `
	INSERT INTO event_files (event_id, kind, name, object_key, size_bytes, uploaded_by)
	VALUES ($1, $2, $3, $4, $5, $6)
	RETURNING id;
`

// その日のイベントに付いたファイルをまとめて取る
const SelectDateEventFiles = `
	SELECT f.id, f.event_id, f.kind, f.name, f.object_key
	FROM event_files f
	JOIN events e ON e.id = f.event_id
	WHERE e.date = $1
	ORDER BY f.id;
`

// 消した行のキーを返してもらい、S3のファイルも消す
const DeleteEventFile = `
	DELETE FROM event_files
	WHERE id = $1 AND event_id = $2
	RETURNING object_key;
`
