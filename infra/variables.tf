variable "region" {
  type    = string
  default = "ap-northeast-1"
}

variable "github_repo" {
  type        = string
  description = "デプロイを許可するGitHubリポジトリ。例: sebundesn/club-app"
}

variable "instance_type" {
  type        = string
  default     = "t4g.micro"
  description = "Go + Postgres を同居させるので 1GB メモリの t4g.micro を既定にしている"
}

variable "create_github_oidc_provider" {
  type        = bool
  default     = true
  description = "アカウントに GitHub OIDC プロバイダが既にある場合は false にする"
}
