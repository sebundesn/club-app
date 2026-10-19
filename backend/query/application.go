package query

// 入部申請。未登録の学籍番号でLINEログインした人が、部長・副部長の承認を待つための表。
// LINEアカウント1つにつき1件だけ持つ(再申請は同じ行を上書きする)。
const CreateApplicationsTable = `
	CREATE TABLE IF NOT EXISTS member_applications (
		id SERIAL PRIMARY KEY,
		line_user_id TEXT NOT NULL UNIQUE,
		student_id VARCHAR(7) NOT NULL,
		name TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		decided_at TIMESTAMP,
		decided_by INT REFERENCES users(id) ON DELETE SET NULL
	);
`

// 申請済みの人が学籍番号や名前を直して出し直せる。承認済みは上書きしない。
const UpsertApplication = `
	INSERT INTO member_applications (line_user_id, student_id, name)
	VALUES ($1, $2, $3)
	ON CONFLICT (line_user_id) DO UPDATE
		SET student_id = EXCLUDED.student_id,
			name = EXCLUDED.name,
			status = 'pending',
			created_at = CURRENT_TIMESTAMP,
			decided_at = NULL,
			decided_by = NULL
		WHERE member_applications.status <> 'approved'
	RETURNING status;
`

const SelectApplicationStatus = `
	SELECT status FROM member_applications WHERE line_user_id = $1;
`

const StudentIDExists = `
	SELECT EXISTS (SELECT 1 FROM users WHERE student_id = $1);
`

const SelectPendingApplications = `
	SELECT id, student_id, name, created_at
	FROM member_applications
	WHERE status = 'pending'
	ORDER BY created_at, id;
`

// 判定は pending のものにだけ効かせる。同時に2人が押しても、先の1件だけが通る。
const DecideApplication = `
	UPDATE member_applications
	SET status = $2, decided_at = CURRENT_TIMESTAMP, decided_by = $3
	WHERE id = $1 AND status = 'pending'
	RETURNING line_user_id, student_id, name;
`

// 承認: 部員として登録する。既に登録済みで未連携の学籍番号なら、その行にLINEを紐づける。
// 別のLINEと連携済みの学籍番号は更新されず、0行になる。
const ApproveApplicationUser = `
	INSERT INTO users (student_id, name, line_user_id)
	VALUES ($1, $2, $3)
	ON CONFLICT (student_id) DO UPDATE
		SET line_user_id = EXCLUDED.line_user_id,
			name = COALESCE(NULLIF(users.name, ''), EXCLUDED.name)
		WHERE users.line_user_id IS NULL
	RETURNING id;
`
