package SQLquery

const SelectMonthNotes = `
	SELECT date, title, subtitle FROM events WHERE CAST(date as TEXT) LIKE $1
`