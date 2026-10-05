output "site_url" {
  value       = local.site_url
  description = "公開URL。LINE Developers のコールバックURLには「<このURL>/api/auth/line/callback」を登録する"
}

output "line_callback_url" {
  value = "${local.site_url}/api/auth/line/callback"
}

# GitHub の Secrets / Variables に登録する値
output "github_deploy_role_arn" {
  value = aws_iam_role.deploy.arn
}

output "site_bucket" {
  value = aws_s3_bucket.site.id
}

output "artifacts_bucket" {
  value = aws_s3_bucket.artifacts.id
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.main.id
}

output "instance_id" {
  value = aws_instance.app.id
}
