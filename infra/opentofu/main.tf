# Infraestructura del práctico de la clase 2 (IaC):
#
#   Navegador ──HTTPS/HTTP──▶ IP elástica ▶ EC2 frontend (Nginx ▶ Next.js :3000)
#                                  │  API_URL = http://<IP privada backend>:8000 (servidor a servidor)
#                                  ▼
#                              EC2 backend (FastAPI :8000 ▶ PostgreSQL 18 en 127.0.0.1:5432)
#
# OpenTofu solo crea la red y los dos servidores. La aplicación se instala A MANO siguiendo
# docs/despliegue-clase2.md: aquí no hay user_data, cloud-init ni provisioners.

locals {
  name = var.name_prefix

  common_tags = {
    Project     = "diplo-asistencia"
    Environment = "lab-clase2"
    Stack       = var.name_prefix
    ManagedBy   = "OpenTofu"
  }

  # IP privadas fijas: el frontend apunta al backend sin depender de valores aleatorios.
  frontend_private_ip = cidrhost(var.public_subnet_cidr, 10)
  backend_private_ip  = cidrhost(var.public_subnet_cidr, 20)
  backend_api_port    = 8000

  # Zonas donde existen ambos tipos de instancia (no todas las AZ ofrecen todos los tipos).
  candidate_azs = sort(tolist(setintersection(
    toset(data.aws_ec2_instance_type_offerings.frontend.locations),
    toset(data.aws_ec2_instance_type_offerings.backend.locations),
  )))
  availability_zone = coalesce(var.availability_zone, try(local.candidate_azs[0], null))

  ami_id = coalesce(var.ami_id, data.aws_ami.ubuntu.id)

  # La clave privada se deduce solo para imprimir el comando SSH; nunca se lee.
  ssh_private_key_hint = trimsuffix(var.ssh_public_key_path, ".pub")
}

# ---------------------------------------------------------------------------
# Consultas de solo lectura (ec2:Describe*)
# ---------------------------------------------------------------------------

data "aws_region" "current" {}

# Ubuntu Server 24.04 LTS oficial de Canonical (cuenta 099720109477), x86_64, disco gp3.
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

  filter {
    name   = "state"
    values = ["available"]
  }
}

data "aws_ec2_instance_type" "frontend" {
  instance_type = var.frontend_instance_type
}

data "aws_ec2_instance_type" "backend" {
  instance_type = var.backend_instance_type
}

data "aws_ec2_instance_type_offerings" "frontend" {
  location_type = "availability-zone"

  filter {
    name   = "instance-type"
    values = [var.frontend_instance_type]
  }
}

data "aws_ec2_instance_type_offerings" "backend" {
  location_type = "availability-zone"

  filter {
    name   = "instance-type"
    values = [var.backend_instance_type]
  }
}

# ---------------------------------------------------------------------------
# Red: VPC propia, una subred pública, Internet Gateway y ruta explícita
# ---------------------------------------------------------------------------

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${local.name}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "${local.name}-igw" }
}

resource "aws_subnet" "public" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.public_subnet_cidr
  availability_zone = local.availability_zone

  # La IP pública se pide explícitamente en cada instancia, no por defecto en la subred.
  map_public_ip_on_launch = false

  tags = { Name = "${local.name}-public" }

  lifecycle {
    precondition {
      condition     = local.availability_zone != null
      error_message = "Ninguna zona de la región ofrece a la vez ${var.frontend_instance_type} y ${var.backend_instance_type}."
    }
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${local.name}-public" }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# ---------------------------------------------------------------------------
# Grupos de seguridad (las reglas van aparte, una por recurso)
# ---------------------------------------------------------------------------

resource "aws_security_group" "frontend" {
  name        = "${local.name}-frontend"
  description = "Frontend Presencia: HTTP publico y SSH administrativo"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.name}-frontend" }
}

resource "aws_security_group" "backend" {
  name        = "${local.name}-backend"
  description = "Backend Presencia: API solo desde el frontend y SSH administrativo"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.name}-backend" }
}

# --- Frontend: entrada ---

resource "aws_vpc_security_group_ingress_rule" "frontend_http" {
  for_each = toset(var.web_ingress_cidrs)

  security_group_id = aws_security_group.frontend.id
  description       = "HTTP hacia Nginx (redirige a HTTPS y valida Lets Encrypt)"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv4         = each.value
}

resource "aws_vpc_security_group_ingress_rule" "frontend_https" {
  for_each = toset(var.web_ingress_cidrs)

  security_group_id = aws_security_group.frontend.id
  description       = "HTTPS hacia Nginx"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = each.value
}

resource "aws_vpc_security_group_ingress_rule" "frontend_ssh" {
  for_each = toset(var.admin_cidrs)

  security_group_id = aws_security_group.frontend.id
  description       = "SSH administrativo"
  ip_protocol       = "tcp"
  from_port         = 22
  to_port           = 22
  cidr_ipv4         = each.value
}

# --- Backend: entrada ---

resource "aws_vpc_security_group_ingress_rule" "backend_api_from_frontend" {
  security_group_id            = aws_security_group.backend.id
  description                  = "API FastAPI solo desde el grupo del frontend"
  ip_protocol                  = "tcp"
  from_port                    = local.backend_api_port
  to_port                      = local.backend_api_port
  referenced_security_group_id = aws_security_group.frontend.id
}

resource "aws_vpc_security_group_ingress_rule" "backend_ssh" {
  for_each = toset(var.admin_cidrs)

  security_group_id = aws_security_group.backend.id
  description       = "SSH administrativo"
  ip_protocol       = "tcp"
  from_port         = 22
  to_port           = 22
  cidr_ipv4         = each.value
}

# --- Salida: solo lo necesario para instalar paquetes y hablar entre servidores ---
# HTTP/HTTPS: repositorios de Ubuntu, PostgreSQL (PGDG), Node.js, npm, uv y PyPI.
# NTP (UDP 123): sincronizar la hora, clave para las asistencias y la expiración del JWT.
# El DNS de Amazon y el servicio de hora de Amazon no pasan por los grupos de seguridad.

locals {
  egress_internet = {
    http  = { protocol = "tcp", port = 80, description = "HTTP saliente (apt)" }
    https = { protocol = "tcp", port = 443, description = "HTTPS saliente (paquetes y dependencias)" }
    ntp   = { protocol = "udp", port = 123, description = "NTP saliente" }
  }
}

resource "aws_vpc_security_group_egress_rule" "frontend_internet" {
  for_each = local.egress_internet

  security_group_id = aws_security_group.frontend.id
  description       = each.value.description
  ip_protocol       = each.value.protocol
  from_port         = each.value.port
  to_port           = each.value.port
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "frontend_to_backend_api" {
  security_group_id            = aws_security_group.frontend.id
  description                  = "Next.js hacia la API del backend"
  ip_protocol                  = "tcp"
  from_port                    = local.backend_api_port
  to_port                      = local.backend_api_port
  referenced_security_group_id = aws_security_group.backend.id
}

resource "aws_vpc_security_group_egress_rule" "backend_internet" {
  for_each = local.egress_internet

  security_group_id = aws_security_group.backend.id
  description       = each.value.description
  ip_protocol       = each.value.protocol
  from_port         = each.value.port
  to_port           = each.value.port
  cidr_ipv4         = "0.0.0.0/0"
}

# ---------------------------------------------------------------------------
# Acceso SSH: solo se sube la clave PÚBLICA
# ---------------------------------------------------------------------------

resource "aws_key_pair" "admin" {
  key_name   = "${local.name}-admin"
  public_key = trimspace(file(pathexpand(var.ssh_public_key_path)))

  tags = { Name = "${local.name}-admin" }
}

# ---------------------------------------------------------------------------
# Servidores
# ---------------------------------------------------------------------------

resource "aws_instance" "frontend" {
  ami                         = local.ami_id
  instance_type               = var.frontend_instance_type
  subnet_id                   = aws_subnet.public.id
  private_ip                  = local.frontend_private_ip
  associate_public_ip_address = false # su IP pública es la elástica (aws_eip.frontend)
  vpc_security_group_ids      = [aws_security_group.frontend.id]
  key_name                    = aws_key_pair.admin.key_name

  dynamic "credit_specification" {
    for_each = data.aws_ec2_instance_type.frontend.burstable_performance_supported ? [1] : []
    content {
      cpu_credits = var.cpu_credits
    }
  }

  # IMDSv2 obligatorio. Las instancias no tienen rol IAM: no llaman a AWS.
  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  # Cifrado con la clave administrada por AWS (aws/ebs): no hace falta una clave KMS propia.
  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.frontend_volume_size_gb
    encrypted             = true
    delete_on_termination = true

    tags = { Name = "${local.name}-frontend-root" }
  }

  tags = { Name = "${local.name}-frontend", Role = "frontend" }

  lifecycle {
    # Una AMI nueva de Canonical NO debe reemplazar el servidor (se perdería lo instalado).
    ignore_changes = [ami]

    precondition {
      condition     = data.aws_ec2_instance_type.frontend.free_tier_eligible
      error_message = "${var.frontend_instance_type} no es elegible para la capa gratuita en esta cuenta/región."
    }

    precondition {
      condition     = contains(data.aws_ec2_instance_type.frontend.supported_architectures, "x86_64")
      error_message = "${var.frontend_instance_type} no es x86_64; la AMI elegida es amd64."
    }
  }
}

resource "aws_instance" "backend" {
  ami                         = local.ami_id
  instance_type               = var.backend_instance_type
  subnet_id                   = aws_subnet.public.id
  private_ip                  = local.backend_private_ip
  associate_public_ip_address = true # solo para SSH y salida a Internet sin NAT Gateway
  vpc_security_group_ids      = [aws_security_group.backend.id]
  key_name                    = aws_key_pair.admin.key_name

  dynamic "credit_specification" {
    for_each = data.aws_ec2_instance_type.backend.burstable_performance_supported ? [1] : []
    content {
      cpu_credits = var.cpu_credits
    }
  }

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  # Aquí viven los datos de PostgreSQL: se borran al destruir la instancia (respaldar antes).
  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.backend_volume_size_gb
    encrypted             = true
    delete_on_termination = true

    tags = { Name = "${local.name}-backend-root" }
  }

  tags = { Name = "${local.name}-backend", Role = "backend" }

  lifecycle {
    ignore_changes = [ami]

    precondition {
      condition     = data.aws_ec2_instance_type.backend.free_tier_eligible
      error_message = "${var.backend_instance_type} no es elegible para la capa gratuita en esta cuenta/región."
    }

    precondition {
      condition     = contains(data.aws_ec2_instance_type.backend.supported_architectures, "x86_64")
      error_message = "${var.backend_instance_type} no es x86_64; la AMI elegida es amd64."
    }
  }
}

# ---------------------------------------------------------------------------
# IP elástica del frontend: estable para el registro DNS (no cambia al detener/arrancar).
# Se factura como cualquier IPv4 pública, también mientras la instancia está detenida.
# ---------------------------------------------------------------------------

resource "aws_eip" "frontend" {
  domain   = "vpc"
  instance = aws_instance.frontend.id

  tags = { Name = "${local.name}-frontend" }

  depends_on = [aws_internet_gateway.main]
}
