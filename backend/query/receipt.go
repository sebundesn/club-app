package query

const ReceiptImagesTable = `
	CREATE TABLE IF NOT EXISTS receipt_images (
		id SERIAL PRIMARY KEY,
		event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
		image_url TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
`

// 誰がアップロードしたかと、S3上のキー・サイズを持たせる。
// image_url は既存データのため残し、S3移行後は object_key を使う。
const AddReceiptColumns = `
	ALTER TABLE receipt_images
		ADD COLUMN IF NOT EXISTS uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
		ADD COLUMN IF NOT EXISTS object_key TEXT,
		ADD COLUMN IF NOT EXISTS size_bytes BIGINT;
`

const CreateReceiptImagesEventIndex = `
	CREATE INDEX IF NOT EXISTS receipt_images_event_idx ON receipt_images (event_id);
`

// To get recipt images for certain events
const GetReceiptsLog = `
	SELECT e.id, e.title, e.date, ri.image_url
	FROM events e
	LEFT JOIN receipt_images ri ON e.id = ri.event_id
	WHERE e.date BETWEEN (NOW() - CAST($1 || ' week' AS INTERVAL))
		AND (NOW() + INTERVAL '1 week')
	ORDER BY e.date DESC;
`

const InsertReceipts = `
	INSERT INTO receipt_images (event_id, image_url)
	VALUES ($1, $2);
`

const DeleteImgQuery = `
	DELETE FROM receipt_images
	WHERE event_id = $1 AND image_url = $2;
`