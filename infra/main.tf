terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # state にはDBパスワード等が入る。個人運用ならローカルのままでもよいが、
  # 共同運用するなら S3 backend に切り替えること。
}

provider "aws" {
  region = var.region

  default_tags {
    tags = { Project = "club-app" }
  }
}

# CloudFront用の証明書やWAFは使わないので us-east-1 のproviderは不要。

data "aws_caller_identity" "current" {}
