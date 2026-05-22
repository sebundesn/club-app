package SQLquery

const GeneratePDFPath_Q = `
	INSERT events (date, pdf_path)
	VALUES ($1, pdf_path)
	ON CONFLICT(date)
	DO UPDATE SET
		pdf_path = EXCLUDED.pdf_path
`

const UpSertDateContent = `
	INSERT INTO events (date, title, subtitle, content, pdf_path)
	VALUES ($1, $2, $3, $4, $5)
	ON CONFLICT(date)
	DO UPDATE SET
		title = EXCLUDED.title,
		subtitle = EXCLUDED.subtitle,
		content = EXCLUDED.content;
`

const SelectMonthNotes = `
	SELECT date, title FROM events WHERE CAST(date as TEXT) LIKE $1;
`

const GetDateEvent = `
	SELECT title, subtitle, content, pdf_path
	FROM events WHERE date = $1;
`

const FetchTodos = `
	SELECT id, title amount, due_date, is_completed FROM todos
	WHERE user_id = $1
		AND due_date >= CURRENT_DATE
		AND is_completed = FALSE
	ORDER BY due_date ASC;
`

const Updatetodos = `
	INSERT INTO todos (user_id, title, amount, due_date)
	VALUES ($1, $2, $3, $4);
`
