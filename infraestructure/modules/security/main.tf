
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.0"
    }
  }
}

# ==========================
# SECURITY GROUPS
# ==========================

resource "aws_security_group" "frontend" {
  name        = "${var.name_prefix}-frontend-sg"
  description = "Security Group del frontend"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.name_prefix}-frontend-sg"
  }
}

resource "aws_security_group" "backend" {
  name        = "${var.name_prefix}-backend-sg"
  description = "Security Group del backend"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.name_prefix}-backend-sg"
  }
}

# ==========================
# ENTRADA FRONTEND
# ==========================

resource "aws_vpc_security_group_ingress_rule" "frontend_http" {
  security_group_id = aws_security_group.frontend.id

  ip_protocol = "tcp"
  from_port   = 80
  to_port     = 80
  cidr_ipv4   = "0.0.0.0/0"

  description = "HTTP publico"
}

resource "aws_vpc_security_group_ingress_rule" "frontend_https" {
  security_group_id = aws_security_group.frontend.id

  ip_protocol = "tcp"
  from_port   = 443
  to_port     = 443
  cidr_ipv4   = "0.0.0.0/0"

  description = "HTTPS publico"
}

resource "aws_vpc_security_group_ingress_rule" "frontend_ssh" {
  for_each = toset(var.admin_cidrs)

  security_group_id = aws_security_group.frontend.id

  ip_protocol = "tcp"
  from_port   = 22
  to_port     = 22
  cidr_ipv4   = each.value

  description = "SSH administrativo"
}

# ==========================
# ENTRADA BACKEND
# ==========================

resource "aws_vpc_security_group_ingress_rule" "backend_api" {
  security_group_id = aws_security_group.backend.id

  ip_protocol = "tcp"
  from_port   = var.backend_api_port
  to_port     = var.backend_api_port

  referenced_security_group_id = aws_security_group.frontend.id

  description = "API desde el frontend"
}

resource "aws_vpc_security_group_ingress_rule" "backend_ssh" {
  for_each = toset(var.admin_cidrs)

  security_group_id = aws_security_group.backend.id

  ip_protocol = "tcp"
  from_port   = 22
  to_port     = 22
  cidr_ipv4   = each.value

  description = "SSH administrativo"
}

# ==========================
# SALIDAS A INTERNET
# ==========================

locals {
  internet_egress = {
    http = {
      protocol = "tcp"
      port     = 80
    }

    https = {
      protocol = "tcp"
      port     = 443
    }

    ntp = {
      protocol = "udp"
      port     = 123
    }
  }
}

resource "aws_vpc_security_group_egress_rule" "frontend_internet" {
  for_each = local.internet_egress

  security_group_id = aws_security_group.frontend.id

  ip_protocol = each.value.protocol
  from_port   = each.value.port
  to_port     = each.value.port

  cidr_ipv4 = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "backend_internet" {
  for_each = local.internet_egress

  security_group_id = aws_security_group.backend.id

  ip_protocol = each.value.protocol
  from_port   = each.value.port
  to_port     = each.value.port

  cidr_ipv4 = "0.0.0.0/0"
}

# ==========================
# FRONTEND HACIA BACKEND
# ==========================

resource "aws_vpc_security_group_egress_rule" "frontend_api" {
  security_group_id = aws_security_group.frontend.id

  ip_protocol = "tcp"
  from_port   = var.backend_api_port
  to_port     = var.backend_api_port

  referenced_security_group_id = aws_security_group.backend.id

  description = "Comunicacion privada con FastAPI"
}
