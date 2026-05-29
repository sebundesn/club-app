package SQLquery

const MoneyInfo = `
	SELECT TO_CHAR(date, 'YYYY-MM-DD'), content, amount FROM accountLog WHERE CAST(date as TEXT) LIKE $1;
`

const MoneySum = `
	SELECT SUM(amount) FROM accountLog;
`

const AddLog = `
	INSERT INTO accountLog (date, content, amount)
	VALUES ($1, $2, $3);
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

const DelMoneyLog = `
	DELETE FROM accountLog
	WHERE date = $1 AND content = $2 AND amount = $3
`