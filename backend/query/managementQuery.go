package query

const NameChangeFirst = `
	UPDATE users 
	SET name = $2 
	WHERE id = $1;
`
