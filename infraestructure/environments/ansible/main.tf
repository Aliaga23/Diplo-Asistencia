# Tres servidores vacios (base de datos, backend y frontend). No llevan user data:
# los configura Ansible desde infraestructure/ansible con el inventario que se genera abajo.

# ==========================
# DATOS DE AWS
# ==========================

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name = "name"
    values = [
      "ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"
    ]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  frontend_private_ip = cidrhost(var.public_subnet_cidr, 10)
  backend_private_ip  = cidrhost(var.public_subnet_cidr, 20)
  database_private_ip = cidrhost(var.public_subnet_cidr, 30)

  backend_api_port = 8000
  postgres_port    = 5432
}

# ==========================
# RED
# ==========================

module "network" {
  source = "../../modules/network"

  name_prefix        = local.name_prefix
  vpc_cidr           = var.vpc_cidr
  public_subnet_cidr = var.public_subnet_cidr
  availability_zone  = data.aws_availability_zones.available.names[0]
}

# ==========================
# SEGURIDAD
# ==========================

# Frontend y backend: mismas reglas que environments/dev.
module "security" {
  source = "../../modules/security"

  name_prefix      = local.name_prefix
  vpc_id           = module.network.vpc_id
  admin_cidrs      = var.admin_cidrs
  backend_api_port = local.backend_api_port
}

resource "aws_security_group" "database" {
  name        = "${local.name_prefix}-database-sg"
  description = "Security Group de la base de datos"
  vpc_id      = module.network.vpc_id

  tags = {
    Name = "${local.name_prefix}-database-sg"
  }
}

resource "aws_vpc_security_group_ingress_rule" "database_postgres" {
  security_group_id = aws_security_group.database.id

  ip_protocol = "tcp"
  from_port   = local.postgres_port
  to_port     = local.postgres_port

  referenced_security_group_id = module.security.backend_security_group_id

  description = "PostgreSQL solo desde el backend"
}

resource "aws_vpc_security_group_ingress_rule" "database_ssh" {
  for_each = toset(var.admin_cidrs)

  security_group_id = aws_security_group.database.id

  ip_protocol = "tcp"
  from_port   = 22
  to_port     = 22
  cidr_ipv4   = each.value

  description = "SSH administrativo"
}

# Salida a internet para apt (no hay NAT Gateway).
resource "aws_vpc_security_group_egress_rule" "database_internet" {
  for_each = {
    http  = { protocol = "tcp", port = 80 }
    https = { protocol = "tcp", port = 443 }
    ntp   = { protocol = "udp", port = 123 }
  }

  security_group_id = aws_security_group.database.id

  ip_protocol = each.value.protocol
  from_port   = each.value.port
  to_port     = each.value.port
  cidr_ipv4   = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "backend_database" {
  security_group_id = module.security.backend_security_group_id

  ip_protocol = "tcp"
  from_port   = local.postgres_port
  to_port     = local.postgres_port

  referenced_security_group_id = aws_security_group.database.id

  description = "Conexion privada con PostgreSQL"
}

# ==========================
# IAM (SSM)
# ==========================

data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ssm_ec2" {
  name               = "${local.name_prefix}-ssm-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.ssm_ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ssm_ec2" {
  name = "${local.name_prefix}-ssm-profile"
  role = aws_iam_role.ssm_ec2.name
}

# ==========================
# SERVIDORES
# ==========================

resource "aws_key_pair" "admin" {
  key_name   = "${local.name_prefix}-admin"
  public_key = trimspace(file(pathexpand(var.ssh_public_key_path)))
}

locals {
  servers = {
    database = {
      instance_type      = var.database_instance_type
      private_ip         = local.database_private_ip
      security_group_ids = [aws_security_group.database.id]
    }
    backend = {
      instance_type      = var.backend_instance_type
      private_ip         = local.backend_private_ip
      security_group_ids = [module.security.backend_security_group_id]
    }
    frontend = {
      instance_type      = var.frontend_instance_type
      private_ip         = local.frontend_private_ip
      security_group_ids = [module.security.frontend_security_group_id]
    }
  }
}

module "server" {
  source   = "../../modules/ec2"
  for_each = local.servers

  name = "${local.name_prefix}-${each.key}"
  role = each.key

  ami_id        = data.aws_ami.ubuntu.id
  instance_type = each.value.instance_type

  subnet_id          = module.network.public_subnet_id
  private_ip         = each.value.private_ip
  security_group_ids = each.value.security_group_ids

  key_name             = aws_key_pair.admin.key_name
  iam_instance_profile = aws_iam_instance_profile.ssm_ec2.name

  volume_size = var.volume_size
  cpu_credits = var.cpu_credits

  # Sin NAT Gateway, los tres necesitan IP publica para que Ansible entre y apt descargue.
  associate_public_ip = true
}

resource "aws_eip" "frontend" {
  domain   = "vpc"
  instance = module.server["frontend"].instance_id

  tags = {
    Name = "${local.name_prefix}-frontend-eip"
  }

  depends_on = [module.network]
}

# ==========================
# INVENTARIO DE ANSIBLE
# ==========================

resource "local_file" "ansible_inventory" {
  filename        = "${path.module}/../../ansible/inventory/hosts.ini"
  file_permission = "0644"

  content = templatefile("${path.module}/hosts.ini.tftpl", {
    database_public_ip  = module.server["database"].public_ip
    database_private_ip = module.server["database"].private_ip
    backend_public_ip   = module.server["backend"].public_ip
    backend_private_ip  = module.server["backend"].private_ip
    frontend_public_ip  = aws_eip.frontend.public_ip
    frontend_private_ip = module.server["frontend"].private_ip
  })
}
