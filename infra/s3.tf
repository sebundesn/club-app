# --- フロント(Next.js 静的ファイル) ---
resource "aws_s3_bucket" "site" {
  bucket_prefix = "club-app-site-"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.site.arn}/*"
      Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.main.arn } }
    }]
  })
}

# --- デプロイ成果物(Goバイナリ)とバックアップ ---
resource "aws_s3_bucket" "artifacts" {
  bucket_prefix = "club-app-artifacts-"
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket                  = aws_s3_bucket.artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    id     = "expire-backups"
    status = "Enabled"
    filter { prefix = "backups/" }
    expiration { days = 30 }
  }

  rule {
    id     = "expire-old-releases"
    status = "Enabled"
    filter { prefix = "releases/" }
    expiration { days = 30 }
  }
}

# --- アルバム(写真・動画)とレシート ---
# media/*   : アルバム。キーはランダムなUUIDで、CloudFront の /media/* 経由でだけ配信する
# receipts/ : レシート。配信設定は作らず、バックエンドが発行する有効期限付きURLでだけ読ませる
resource "aws_s3_bucket" "media" {
  bucket_prefix = "club-app-media-"
  # 部員の写真が入るので、terraform destroy で誤って消えないようにする
  force_destroy = false
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "media" {
  bucket = aws_s3_bucket.media.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.media.arn}/media/*"
      Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.main.arn } }
    }]
  })
}
