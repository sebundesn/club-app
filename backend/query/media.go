package query

// イベントのアルバム(写真・動画)。実体はS3に置き、ここにはキーとメタデータだけを持つ。
// 枠の判定は専用のカウンタを持たず、この表の行数で数える。
// 削除すれば行が消えて枠が戻るので、カウンタとずれることがない。
const CreateEventMediaTable = `
	CREATE TABLE IF NOT EXISTS event_media (
		id SERIAL PRIMARY KEY,
		event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
		uploader_id INT REFERENCES users(id) ON DELETE SET NULL,
		kind TEXT NOT NULL CHECK (kind IN ('photo', 'video')),
		object_key TEXT NOT NULL,
		thumb_key TEXT,
		size_bytes BIGINT NOT NULL DEFAULT 0,
		duration_sec INT,
		status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('processing', 'ready', 'failed')),
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
`

const CreateEventMediaIndex = `
	CREATE INDEX IF NOT EXISTS event_media_event_idx ON event_media (event_id, kind, created_at);
`

const CreateEventMediaUploaderIndex = `
	CREATE INDEX IF NOT EXISTS event_media_uploader_idx ON event_media (uploader_id);
`

// 枠の判定と登録は同じトランザクションで行う。
// 先にイベントの行をロックして、同時アップロードで上限を超えないようにする。
const LockEventForUpload = `
	SELECT id FROM events WHERE id = $1 FOR UPDATE;
`

// 変換中(processing)も枠に数える。失敗した行は残さず削除する前提。
const CountEventMedia = `
	SELECT COUNT(*) FROM event_media
	WHERE event_id = $1 AND kind = $2;
`

const InsertEventMedia = `
	INSERT INTO event_media (event_id, uploader_id, kind, object_key, thumb_key, size_bytes, duration_sec, status)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	RETURNING id;
`

const MarkEventMediaReady = `
	UPDATE event_media
	SET status = 'ready', thumb_key = $2, size_bytes = $3
	WHERE id = $1;
`

const SelectEventMedia = `
	SELECT id, kind, object_key, thumb_key, status, uploader_id, created_at
	FROM event_media
	WHERE event_id = $1 AND status <> 'failed'
	ORDER BY created_at, id;
`

// S3のファイルも消すので、消した行のキーを返してもらう。
const DeleteEventMedia = `
	DELETE FROM event_media
	WHERE id = $1
	RETURNING object_key, thumb_key;
`
