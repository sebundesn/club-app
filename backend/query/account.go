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
	SELECT id, TO_CHAR(date, 'YYYY-MM-DD'), content, amount FROM accountLog WHERE CAST(date as TEXT) LIKE $1;
`

const MoneySum = `
	SELECT COALESCE(SUM(amount), 0) FROM accountLog;
`

const AddLog = `
	INSERT INTO accountLog (date, content, amount)
	VALUES ($1, $2, $3);
`

// 日付・内容・金額での削除は、同日同額同内容の行が2件あると
// まとめて消えてしまうので主キーで消す。
const DelMoneyLog = `
	DELETE FROM accountLog
	WHERE id = $1;
`
