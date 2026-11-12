locals {
  prefijo = "plataforma-presencia"
  bucket  = "presencia-tfstate-aliaga23"
  cuenta  = data.aws_caller_identity.actual.account_id
}

data "aws_caller_identity" "actual" {}

data "aws_vpc" "defecto" {
  default = true
}

data "aws_subnets" "defecto" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.defecto.id]
  }

  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

resource "aws_security_group" "plataforma" {
  name        = local.prefijo
  description = "Consola de la plataforma y Grafana"
  vpc_id      = data.aws_vpc.defecto.id

  tags = {
    Name = local.prefijo
  }
}

resource "aws_vpc_security_group_ingress_rule" "http" {
  for_each = toset(var.consola_cidrs)

  security_group_id = aws_security_group.plataforma.id
  cidr_ipv4         = each.value
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  description       = "Consola y Grafana"
}

resource "aws_vpc_security_group_egress_rule" "salida" {
  security_group_id = aws_security_group.plataforma.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
  description       = "AWS, GitHub, imagenes Docker y metricas de los tenants"
}

resource "random_password" "secretos" {
  for_each = toset(["jwt_secret", "bd_password", "pulumi_passphrase", "grafana_password"])

  length  = each.key == "jwt_secret" ? 64 : 32
  special = false
}

resource "aws_ssm_parameter" "secretos" {
  for_each = merge(
    { for clave, valor in random_password.secretos : clave => valor.result },
    { password = var.plataforma_password }
  )

  name  = "/presencia/plataforma/${each.key}"
  type  = "SecureString"
  value = each.value
}

data "aws_iam_policy_document" "asumir_ec2" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "plataforma" {
  statement {
    sid       = "Infraestructura"
    actions   = ["ec2:*", "rds:*", "tag:GetResources"]
    resources = ["*"]
  }

  statement {
    sid = "SecretosDeTenants"
    actions = [
      "ssm:PutParameter",
      "ssm:GetParameter",
      "ssm:GetParameters",
      "ssm:DeleteParameter",
      "ssm:AddTagsToResource",
      "ssm:RemoveTagsFromResource",
      "ssm:ListTagsForResource",
    ]
    resources = ["arn:aws:ssm:${var.aws_region}:${local.cuenta}:parameter/presencia/*"]
  }

  statement {
    sid       = "ConsultasSsm"
    actions   = ["ssm:DescribeParameters", "ssm:SendCommand", "ssm:GetCommandInvocation"]
    resources = ["*"]
  }

  statement {
    sid = "RolesDeTenants"
    actions = [
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:GetRole",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:PassRole",
      "iam:PutRolePolicy",
      "iam:GetRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:ListInstanceProfilesForRole",
      "iam:CreateInstanceProfile",
      "iam:DeleteInstanceProfile",
      "iam:GetInstanceProfile",
      "iam:TagInstanceProfile",
      "iam:UntagInstanceProfile",
      "iam:AddRoleToInstanceProfile",
      "iam:RemoveRoleFromInstanceProfile",
    ]
    resources = [
      "arn:aws:iam::${local.cuenta}:role/presencia-*",
      "arn:aws:iam::${local.cuenta}:instance-profile/presencia-*",
    ]
  }

  statement {
    sid       = "RolEnlazadoDeRds"
    actions   = ["iam:CreateServiceLinkedRole"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "iam:AWSServiceName"
      values   = ["rds.amazonaws.com"]
    }
  }

  statement {
    sid       = "EstadoDeLosMotores"
    actions   = ["s3:ListBucket", "s3:GetBucketLocation", "s3:GetBucketVersioning"]
    resources = ["arn:aws:s3:::${local.bucket}"]
  }

  statement {
    sid       = "ObjetosDeEstado"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["arn:aws:s3:::${local.bucket}/*"]
  }
}

resource "aws_iam_role" "plataforma" {
  name               = "${local.prefijo}-ec2"
  assume_role_policy = data.aws_iam_policy_document.asumir_ec2.json
}

resource "aws_iam_role_policy" "plataforma" {
  name   = "aprovisionar-tenants"
  role   = aws_iam_role.plataforma.id
  policy = data.aws_iam_policy_document.plataforma.json
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.plataforma.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "plataforma" {
  name = "${local.prefijo}-ec2"
  role = aws_iam_role.plataforma.name
}

resource "aws_instance" "plataforma" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnets.defecto.ids[0]
  vpc_security_group_ids = [aws_security_group.plataforma.id]
  iam_instance_profile   = aws_iam_instance_profile.plataforma.name

  user_data = templatefile("${path.module}/cloud-init.yaml.tftpl", {
    region      = var.aws_region
    cuenta      = local.cuenta
    repo_url    = var.repo_url
    repo_branch = var.repo_branch
  })

  credit_specification {
    cpu_credits = "standard"
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.volume_size
    encrypted             = true
    delete_on_termination = true
  }

  tags = {
    Name = local.prefijo
  }

  depends_on = [aws_ssm_parameter.secretos, aws_iam_role_policy.plataforma]

  lifecycle {
    ignore_changes = [ami]
  }
}

resource "aws_eip" "plataforma" {
  domain   = "vpc"
  instance = aws_instance.plataforma.id

  tags = {
    Name = local.prefijo
  }
}
