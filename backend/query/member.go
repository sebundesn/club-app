package query

// 役職ページの部員一覧。役職のある人を先に、あとは学籍番号順。
// linked は LINE と連携済み(=ログインできる)かどうか。
const SelectMembers = `
	SELECT id, student_id, COALESCE(name, ''), COALESCE(role, ''), line_user_id IS NOT NULL
	FROM users
	ORDER BY
		CASE role WHEN '部長' THEN 0 WHEN '副部長' THEN 1 WHEN '会計' THEN 2 ELSE 3 END,
		student_id;
`

// 役職の付け替えは「全員の役職を外してから付け直す」を1つのトランザクションで行う。
const ClearRoles = `
	UPDATE users SET role = NULL WHERE role = ANY($1);
`

const AssignRole = `
	UPDATE users SET role = $1 WHERE id = ANY($2);
`
