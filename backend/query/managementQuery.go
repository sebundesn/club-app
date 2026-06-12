package query

const UpsertMembersQuery = `
	INSERT INTO users (student_id, name, role)
	VALUES ($1, $2, $3)
	ON CONFLICT (student_id)
	DO UPDATE SET
		name = EXCLUDED.name,
		role = EXCLUDED.role;
`
const AuthenticatingQuery = `
	SELECT id, name, role FROM users
	WHERE student_id = $1;
`

const SelectMembers = `
	SELECT student_id, name, role FROM users;
`
const NameChangeFirst = `
	UPDATE users
	SET realname = $2, username = $3
	WHERE id = $1;
`
