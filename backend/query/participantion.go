package query

const CreateEventMembers = `CREATE TABLE IF NOT EXISTS event_members (
	event_id INT NOT NULL,
	user_id INT NOT NULL,
	amount INT DEFAULT 0,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (event_id, user_id),

	FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);`

const GetEventMembers = `
	SELECT em.event_id, em.user_id, u.name AS user_name, em.amount
	FROM event_members em
	INNER JOIN users u ON em.user_id = u.id
	WHERE em.event_id = $1;
`