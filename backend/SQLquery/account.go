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
