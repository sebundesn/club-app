package query

const AccountLogTable = `
	CREATE TABLE IF NOT EXISTS accountLog (
		id SERIAL PRIMARY KEY,
		date DATE NOT NULL,
		content TEXT NOT NULL,
		amount INTEGER NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
	);
`

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

const DelMoneyLog = `
	DELETE FROM accountLog
	WHERE date = $1 AND content = $2 AND amount = $3
`