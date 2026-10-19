data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

# 8080 は CloudFront からのみ許可する。
# SSH(22)は EC2 Instance Connect(ブラウザからの接続)の接続元レンジだけに絞って開けている。
# このレンジは最初コンソールで手動追加されていて、Terraform の管理外だったため取り込んだ。
# 通常の入り口は SSM Session Manager。
resource "aws_security_group" "app" {
  name        = "club-app"
  description = "club-app backend, CloudFront only"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront.id]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["3.112.23.0/29"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
