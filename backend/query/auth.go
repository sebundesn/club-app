package query

const UserTable = `
	CREATE TABLE IF NOT EXISTS users  (
		id SERIAL PRIMARY KEY,
		student_id VARCHAR(7) UNIQUE NOT NULL,
		name TEXT DEFAULT NULL,
		role TEXT,
		line_user_id TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`

// CREATE TABLE IF NOT EXISTS は既存テーブルを変更しないので、
// 既に users がある環境向けに列とユニーク制約を個別に追加する。
const AddLineUserIDColumn = `
	ALTER TABLE users ADD COLUMN IF NOT EXISTS line_user_id TEXT;
`

const AddLineUserIDIndex = `
	CREATE UNIQUE INDEX IF NOT EXISTS users_line_user_id_key ON users (line_user_id);
`

// LINEアカウントで既に紐づけ済みの部員を引く
const SelectUserByLineID = `
	SELECT id, name, role FROM users
	WHERE line_user_id = $1;
`

// 初回ログイン時に学籍番号でLINEアカウントを紐づける。
// line_user_id が既に入っている行は更新されないので、
// 他人の学籍番号を入力しても乗っ取れない。
const LinkLineAccount = `
	UPDATE users
	SET line_user_id = $2,
		name = COALESCE(NULLIF(name, ''), $3)
	WHERE student_id = $1 AND line_user_id IS NULL
	RETURNING id, name, role;
`
