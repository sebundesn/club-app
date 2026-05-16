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

//To get recipt images for certain events
const GetReciptLog = `
	SELECT e.id e.title, e.date, ri.image_url
	FROM events e
	LEFT JSON recipt_images ri ON e.id = ri.event_id
	WHERE e.date >= (now() - interval "1 month" * $1)
	ORDER BY e.date DESC;
`
