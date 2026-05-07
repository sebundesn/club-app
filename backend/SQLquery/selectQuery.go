package SQLquery

const SelectMonthNotes = `
	SELECT date, title FROM events WHERE CAST(date as TEXT) LIKE $1;
`

const GetDateEvent = `
	SELECT subtitle, content, pdf_path
	FROM events WHERE date = $1;
`