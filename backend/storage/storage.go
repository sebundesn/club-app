// Package storage はアルバム・レシートの実体の置き場所を隠す。
// 本番は S3、ローカル開発は ./uploads 配下のディスクを使う。
package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type Storage interface {
	// Put は body をそのまま key に保存する。
	Put(ctx context.Context, key string, body io.Reader, contentType string) error
	Delete(ctx context.Context, key string) error
	// URL はブラウザから読むためのURLを返す。
	// アルバムは推測できないキーを使い、CloudFront の /media/* 経由で配信する。
	URL(key string) string
	// SignedURL は有効期限付きのURLを返す。レシートのように見せる相手を絞る物に使う。
	SignedURL(ctx context.Context, key string, ttl time.Duration) (string, error)
}

// New は環境変数 MEDIA_BUCKET があれば S3、なければローカルディスクを返す。
func New(ctx context.Context) (Storage, error) {
	bucket := os.Getenv("MEDIA_BUCKET")
	if bucket == "" {
		return &Local{Dir: "./uploads"}, nil
	}

	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}
	client := s3.NewFromConfig(cfg)
	return &S3{
		client:  client,
		presign: s3.NewPresignClient(client),
		bucket:  bucket,
	}, nil
}

// ---- S3 ----

type S3 struct {
	client  *s3.Client
	presign *s3.PresignClient
	bucket  string
}

func (s *S3) Put(ctx context.Context, key string, body io.Reader, contentType string) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        body,
		ContentType: aws.String(contentType),
		// キーは一度付けたら中身が変わらないので、長くキャッシュさせる
		CacheControl: aws.String("public, max-age=31536000, immutable"),
	})
	return err
}

func (s *S3) Delete(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	return err
}

func (s *S3) URL(key string) string { return "/" + key }

func (s *S3) SignedURL(ctx context.Context, key string, ttl time.Duration) (string, error) {
	req, err := s.presign.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", err
	}
	return req.URL, nil
}

// ---- ローカルディスク(開発用) ----

type Local struct{ Dir string }

func (l *Local) path(key string) (string, error) {
	// key は自前で組み立てた値だけを渡す前提だが、念のため外に出られないようにする
	clean := filepath.Clean(key)
	if strings.HasPrefix(clean, "..") || filepath.IsAbs(clean) {
		return "", fmt.Errorf("invalid key: %q", key)
	}
	return filepath.Join(l.Dir, clean), nil
}

func (l *Local) Put(_ context.Context, key string, body io.Reader, _ string) error {
	p, err := l.path(key)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	f, err := os.Create(p)
	if err != nil {
		return err
	}
	if _, err := io.Copy(f, body); err != nil {
		f.Close()
		return err
	}
	return f.Close()
}

func (l *Local) Delete(_ context.Context, key string) error {
	p, err := l.path(key)
	if err != nil {
		return err
	}
	if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (l *Local) URL(key string) string { return "/uploads/" + key }

func (l *Local) SignedURL(_ context.Context, key string, _ time.Duration) (string, error) {
	return l.URL(key), nil
}
