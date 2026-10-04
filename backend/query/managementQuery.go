package query

const UpsertMembersQuery = `
	INSERT INTO users (student_id, name, role)
	VALUES ($1, $2, $3)
	ON CONFLICT (student_id)
	DO UPDATE SET
		name = EXCLUDED.name,
		role = EXCLUDED.role;
`

const SelectMembers = `
	SELECT student_id, name, role FROM users;
`
const NameChangeFirst = `
	UPDATE users 
	SET name = $2 
	WHERE id = $1;
`
