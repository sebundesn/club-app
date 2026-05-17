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
	WHERE e.date >= (now() - CAST($1 || ' month' AS INTERVAL))
	ORDER BY e.date DESC;
`

const InsertReceipts = `
	INSERT INTO receipt_images (event_id, image_url)
	VALUES ($1, $2);
`;
