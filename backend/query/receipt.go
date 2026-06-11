package query

const ReceiptImagesTable = `
	CREATE TABLE IF NOT EXISTS receipt_images (
		id SERIAL PRIMARY KEY,
		event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
		image_url TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
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
	WHERE event_id = (SELECT id FROM events WHERE date = $1)
	AND image_url = $2;
`