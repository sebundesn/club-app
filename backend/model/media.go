package model

// MediaItem はアルバムの1件。URL は配信用で、S3のキーそのものは返さない。
type MediaItem struct {
	ID        int    `json:"id"`
	Kind      string `json:"kind"` // photo / video
	URL       string `json:"url"`
	ThumbURL  string `json:"thumb_url"`
	Status    string `json:"status"` // processing / ready
	Mine      bool   `json:"mine"`
	CanDelete bool   `json:"can_delete"`
}

// MediaAlbum はイベントのアルバムと、残り枠の表示に必要な数。
type MediaAlbum struct {
	EventID    int         `json:"event_id"`
	Items      []MediaItem `json:"items"`
	PhotoCount int         `json:"photo_count"`
	PhotoLimit int         `json:"photo_limit"`
	VideoCount int         `json:"video_count"`
	VideoLimit int         `json:"video_limit"`
}

type DeleteMediaRequest struct {
	ID int `json:"id"`
}
