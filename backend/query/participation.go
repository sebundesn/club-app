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

// amount は請求額、paid_at は支払い済みになった時刻(NULL なら未払い)。
// 一部払いは扱わず、支払い済みか未払いかの2値にしている。
const AddEventMemberPaidAtColumn = `
	ALTER TABLE event_members ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
`

// 未払い一覧(自分の分・会計用の全員分)を引くためのインデックス
const CreateEventMembersUnpaidIndex = `
	CREATE INDEX IF NOT EXISTS event_members_unpaid_idx ON event_members (user_id) WHERE paid_at IS NULL;
`

// 会計が支払いを確認したとき、または取り消すときに使う。
const SetEventMemberPaid = `
	UPDATE event_members
	SET paid_at = CASE WHEN $3 THEN CURRENT_TIMESTAMP ELSE NULL END
	WHERE event_id = $1 AND user_id = $2;
`

// イベントごとの徴収額。参加者を追加したときの請求額の初期値になる。
const AddEventFeeColumn = `
	ALTER TABLE events ADD COLUMN IF NOT EXISTS fee INT NOT NULL DEFAULT 0;
`

const SetEventFee = `
	UPDATE events SET fee = $2 WHERE id = $1;
`

// 徴収額を変えても、支払い済みの人の請求額は書き換えない(払った額の記録を保つため)。
const ApplyEventFeeToUnpaid = `
	UPDATE event_members SET amount = $2
	WHERE event_id = $1 AND paid_at IS NULL;
`

// 自分の未払い。請求額が0の行は払うものがないので除く。
const SelectUnpaidByUser = `
	SELECT e.id, e.title, e.date, em.amount
	FROM event_members em
	INNER JOIN events e ON e.id = em.event_id
	WHERE em.user_id = $1 AND em.paid_at IS NULL AND em.amount > 0
	ORDER BY e.date;
`

// 会計用: 全員分の未払い
const SelectUnpaidAll = `
	SELECT e.id, e.title, e.date, u.id, u.name, em.amount
	FROM event_members em
	INNER JOIN events e ON e.id = em.event_id
	INNER JOIN users u ON u.id = em.user_id
	WHERE em.paid_at IS NULL AND em.amount > 0
	ORDER BY e.date, u.name;
`

// 人によって金額が違うとき(学年・グループ別など)に、選んだ未払いの人の請求額だけを変える。
const ApplyFeeToUnpaidMembers = `
	UPDATE event_members SET amount = $2
	WHERE event_id = $1 AND user_id = ANY($3) AND paid_at IS NULL;
`

const GetEventMembers = `
	SELECT em.event_id, em.user_id, u.name AS user_name, em.amount, em.paid_at IS NOT NULL
	FROM event_members em
	INNER JOIN users u ON em.user_id = u.id
	WHERE em.event_id = $1
	ORDER BY u.name;
`

// 参加者を選ぶときの部員一覧。名前未設定の部員は選びようがないので除く。
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
	INSERT INTO event_members (event_id, user_id, amount)
	VALUES ($1, $2, (SELECT fee FROM events WHERE id = $1))
	ON CONFLICT (event_id, user_id) DO NOTHING;
`

// 会計用: 全員分の支払い状況(支払い済みも含む)。請求額が0の行は払うものがないので除く。
const SelectPaymentsAll = `
	SELECT e.id, e.title, e.date, u.id, u.name, em.amount, em.paid_at IS NOT NULL
	FROM event_members em
	INNER JOIN events e ON e.id = em.event_id
	INNER JOIN users u ON u.id = em.user_id
	WHERE em.amount > 0
	ORDER BY u.name, e.date DESC;
`
