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
	WHERE em.event_id = $1
	ORDER BY u.name;
`

// react-select の選択肢に使う部員一覧。名前未設定の部員は選びようがないので除く。
const SelectClubMembers = `
	SELECT id, name FROM users
	WHERE name IS NOT NULL AND name <> ''
	ORDER BY name;
`

// 参加者リストの保存は「送られてきた集合に合わせる」形にする。
// 全削除→全挿入にすると既存の amount が消えるので、
// 外れた人だけ削除し、残る人は ON CONFLICT DO NOTHING で amount を保持する。
const DeleteEventMembersNotIn = `
	DELETE FROM event_members
	WHERE event_id = $1 AND NOT (user_id = ANY($2));
`

const InsertEventMember = `
	INSERT INTO event_members (event_id, user_id)
	VALUES ($1, $2)
	ON CONFLICT (event_id, user_id) DO NOTHING;
`
