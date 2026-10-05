resource "random_password" "db" {
  length  = 32
  special = false
}

resource "random_password" "session" {
  length  = 48
  special = false
}

locals {
  site_url = "https://${aws_cloudfront_distribution.main.domain_name}"
}

resource "aws_ssm_parameter" "db_password" {
  name  = "/club-app/DB_PASSWORD"
  type  = "SecureString"
  value = random_password.db.result
}

# バックエンドの環境変数。起動時に /club-app/ 配下を全部読んで env ファイルにする。
resource "aws_ssm_parameter" "env" {
  for_each = {
    DATABASE_URL       = "postgres://club_app:${random_password.db.result}@localhost:5432/club_db?sslmode=disable"
    SESSION_SECRET_KEY = random_password.session.result
    PORT               = "8080"
    APP_ENV            = "production"
    COOKIE_SECURE      = "true"
    COOKIE_SAMESITE    = "lax" # CloudFrontで同一オリジンにしているので lax でよい
    FRONTEND_URL       = local.site_url
    LINE_REDIRECT_URI  = "${local.site_url}/api/auth/line/callback"
  }

  name  = "/club-app/${each.key}"
  type  = contains(["DATABASE_URL", "SESSION_SECRET_KEY"], each.key) ? "SecureString" : "String"
  value = each.value
}

# LINEの値は apply 後に自分で入れる(コンソール or aws ssm put-parameter --overwrite)。
resource "aws_ssm_parameter" "line" {
  for_each = toset(["LINE_CHANNEL_ID", "LINE_CHANNEL_SECRET"])

  name  = "/club-app/${each.key}"
  type  = "SecureString"
  value = "CHANGE_ME"

  lifecycle {
    ignore_changes = [value]
  }
}
