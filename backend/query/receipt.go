package query

const ReceiptImagesTable = `
	CREATE TABLE IF NOT EXISTS receipt_images (
		id SERIAL PRIMARY KEY,
		event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
		image_url TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
`

// 誰がアップロードしたかと、S3上のキー・サイズを持たせる。
// image_url は既存データのため残し、S3移行後は object_key を使う。
const AddReceiptColumns = `
	ALTER TABLE receipt_images
		ADD COLUMN IF NOT EXISTS uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
		ADD COLUMN IF NOT EXISTS object_key TEXT,
		ADD COLUMN IF NOT EXISTS size_bytes BIGINT;
`

const CreateReceiptImagesEventIndex = `
	CREATE INDEX IF NOT EXISTS receipt_images_event_idx ON receipt_images (event_id);
`

// レシート一覧の無限スクロール用。(date, id) をカーソルにして、イベントを limit 件ずつ取る。
// 先にイベントだけを絞ってから画像をつなぐので、画像の枚数で件数がずれない。
// 未来側: カーソルより後を古い順に。
const GetReceiptsAfter = `
	WITH ev AS (
		SELECT id, title, date FROM events
		WHERE (date, id) > ($1::date, $2)
		ORDER BY date, id
		LIMIT $3
	)
	SELECT ev.id, ev.title, ev.date, ri.id, ri.image_url, ri.object_key
	FROM ev
	LEFT JOIN receipt_images ri ON ev.id = ri.event_id
	ORDER BY ev.date, ev.id, ri.id;
`

// 過去側: カーソルより前を新しい順に。
const GetReceiptsBefore = `
	WITH ev AS (
		SELECT id, title, date FROM events
		WHERE (date, id) < ($1::date, $2)
		ORDER BY date DESC, id DESC
		LIMIT $3
	)
	SELECT ev.id, ev.title, ev.date, ri.id, ri.image_url, ri.object_key
	FROM ev
	LEFT JOIN receipt_images ri ON ev.id = ri.event_id
	ORDER BY ev.date DESC, ev.id DESC, ri.id;
`

// 1つのイベントのレシート。詳細ページは日付に関係なく開けるようにする。
const GetReceiptsOfEvent = `
	SELECT e.id, e.title, e.date, ri.id, ri.image_url, ri.object_key
	FROM events e
	LEFT JOIN receipt_images ri ON e.id = ri.event_id
	WHERE e.id = $1
	ORDER BY ri.id;
`

const CountReceipts = `
	SELECT COUNT(*) FROM receipt_images WHERE event_id = $1;
`

// image_url は旧データ(サーバーのディスク)用。S3に置く分は object_key だけを使う。
const InsertReceipts = `
	INSERT INTO receipt_images (event_id, image_url, uploaded_by, object_key, size_bytes)
	VALUES ($1, '', $2, $3, $4);
`

// 消した行のキーを返してもらい、S3のファイルも消す
const DeleteImgQuery = `
	DELETE FROM receipt_images
	WHERE id = $1 AND event_id = $2
	RETURNING image_url, object_key;
`
