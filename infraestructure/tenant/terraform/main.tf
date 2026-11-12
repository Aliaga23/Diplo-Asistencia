locals {
  catalogo = yamldecode(file("${path.module}/../../../plataforma/planes.yaml"))
  plan     = local.catalogo[var.plan]
  bd_modo  = local.plan.bd.modo
  prefijo  = "presencia-${var.tenant}"

  vpc_cidr     = "10.0.0.0/16"
  subred_app   = "10.0.1.0/24"
  subredes_rds = ["10.0.11.0/24", "10.0.12.0/24"]
  ip_app       = "10.0.1.10"
  ip_bd        = "10.0.1.30"

  ami_id = var.ami_id != "" ? var.ami_id : data.aws_ami.presencia.id

  bd_host = {
    local = "127.0.0.1"
    ec2   = local.ip_bd
    rds   = local.bd_modo == "rds" ? aws_db_instance.bd[0].address : ""
  }[local.bd_modo]

  cloud_init = {
    tenant         = var.tenant
    institucion    = var.institucion
    region         = var.region
    vpc_cidr       = local.vpc_cidr
    admin_registro = var.admin_registro
    admin_nombre   = var.admin_nombre
    admin_correo   = var.admin_correo
    datos_demo     = tostring(var.datos_demo)
    bd_modo        = local.bd_modo
  }

  puertos_salida = {
    http  = { puerto = 80, protocolo = "tcp" }
    https = { puerto = 443, protocolo = "tcp" }
    ntp   = { puerto = 123, protocolo = "udp" }
  }
}

data "aws_availability_zones" "disponibles" {
  state = "available"
}

data "aws_ami" "presencia" {
  most_recent = true
  owners      = ["self"]

  filter {
    name   = "tag:Imagen"
    values = ["presencia"]
  }
}

data "aws_caller_identity" "actual" {}

module "network" {
  source = "../../modules/network"

  name_prefix        = local.prefijo
  vpc_cidr           = local.vpc_cidr
  public_subnet_cidr = local.subred_app
  availability_zone  = data.aws_availability_zones.disponibles.names[0]
}

resource "aws_subnet" "rds" {
  count = local.bd_modo == "rds" ? 2 : 0

  vpc_id            = module.network.vpc_id
  cidr_block        = local.subredes_rds[count.index]
  availability_zone = data.aws_availability_zones.disponibles.names[count.index]

  tags = {
    Name = "${local.prefijo}-rds-${count.index + 1}"
  }
}

resource "aws_security_group" "app" {
  name        = "${local.prefijo}-app"
  description = "App de ${var.tenant}: web publica y metricas para la plataforma"
  vpc_id      = module.network.vpc_id

  tags = {
    Name = "${local.prefijo}-app"
  }
}

resource "aws_vpc_security_group_ingress_rule" "app_http" {
  security_group_id = aws_security_group.app.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  description       = "Aplicacion web"
}

resource "aws_vpc_security_group_ingress_rule" "app_metricas" {
  for_each = toset(var.admin_cidrs)

  security_group_id = aws_security_group.app.id
  cidr_ipv4         = each.value
  ip_protocol       = "tcp"
  from_port         = 9100
  to_port           = 9101
  description       = "node_exporter y metricas de la API"
}

resource "aws_vpc_security_group_egress_rule" "app_internet" {
  for_each = local.puertos_salida

  security_group_id = aws_security_group.app.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = each.value.protocolo
  from_port         = each.value.puerto
  to_port           = each.value.puerto
  description       = "Salida ${each.key}"
}

resource "aws_vpc_security_group_egress_rule" "app_bd" {
  count = local.bd_modo == "local" ? 0 : 1

  security_group_id            = aws_security_group.app.id
  referenced_security_group_id = aws_security_group.bd[0].id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  description                  = "PostgreSQL del tenant"
}

resource "aws_security_group" "bd" {
  count = local.bd_modo == "local" ? 0 : 1

  name        = "${local.prefijo}-bd"
  description = "Base de datos de ${var.tenant}: solo desde la app"
  vpc_id      = module.network.vpc_id

  tags = {
    Name = "${local.prefijo}-bd"
  }
}

resource "aws_vpc_security_group_ingress_rule" "bd_postgres" {
  count = local.bd_modo == "local" ? 0 : 1

  security_group_id            = aws_security_group.bd[0].id
  referenced_security_group_id = aws_security_group.app.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  description                  = "PostgreSQL desde la app"
}

resource "aws_vpc_security_group_ingress_rule" "bd_metricas" {
  for_each = local.bd_modo == "ec2" ? toset(var.admin_cidrs) : toset([])

  security_group_id = aws_security_group.bd[0].id
  cidr_ipv4         = each.value
  ip_protocol       = "tcp"
  from_port         = 9100
  to_port           = 9100
  description       = "node_exporter"
}

resource "aws_vpc_security_group_egress_rule" "bd_internet" {
  for_each = local.bd_modo == "ec2" ? local.puertos_salida : {}

  security_group_id = aws_security_group.bd[0].id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = each.value.protocolo
  from_port         = each.value.puerto
  to_port           = each.value.puerto
  description       = "Salida ${each.key}"
}

resource "random_password" "bd" {
  length  = 32
  special = false
}

resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "aws_ssm_parameter" "secretos" {
  for_each = {
    bd_password    = random_password.bd.result
    jwt_secret     = random_password.jwt.result
    admin_password = var.contrasena_inicial
  }

  name  = "/presencia/tenants/${var.tenant}/${each.key}"
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

data "aws_iam_policy_document" "leer_secretos" {
  statement {
    actions   = ["ssm:GetParameter"]
    resources = ["arn:aws:ssm:${var.region}:${data.aws_caller_identity.actual.account_id}:parameter/presencia/tenants/${var.tenant}/*"]
  }
}

resource "aws_iam_role" "servidor" {
  name               = "${local.prefijo}-servidor"
  assume_role_policy = data.aws_iam_policy_document.asumir_ec2.json
}

resource "aws_iam_role_policy" "leer_secretos" {
  name   = "leer-secretos-del-tenant"
  role   = aws_iam_role.servidor.id
  policy = data.aws_iam_policy_document.leer_secretos.json
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.servidor.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "servidor" {
  name = "${local.prefijo}-servidor"
  role = aws_iam_role.servidor.name
}

resource "aws_db_subnet_group" "bd" {
  count = local.bd_modo == "rds" ? 1 : 0

  name       = "${local.prefijo}-bd"
  subnet_ids = aws_subnet.rds[*].id
}

resource "aws_db_instance" "bd" {
  count = local.bd_modo == "rds" ? 1 : 0

  identifier              = local.prefijo
  engine                  = "postgres"
  engine_version          = local.plan.bd.version
  instance_class          = local.plan.bd.clase
  allocated_storage       = local.plan.bd.almacenamiento_gb
  storage_type            = "gp3"
  storage_encrypted       = true
  db_name                 = "asistencia"
  username                = "asistencia"
  password                = random_password.bd.result
  db_subnet_group_name    = aws_db_subnet_group.bd[0].name
  vpc_security_group_ids  = [aws_security_group.bd[0].id]
  publicly_accessible     = false
  backup_retention_period = local.plan.bd.respaldo_dias
  skip_final_snapshot     = true
  deletion_protection     = false
  apply_immediately       = true
}

module "bd" {
  source   = "../../modules/ec2"
  for_each = local.bd_modo == "ec2" ? toset(["bd"]) : toset([])

  name                 = "${local.prefijo}-bd"
  role                 = "bd"
  ami_id               = local.ami_id
  instance_type        = local.plan.bd.tipo
  subnet_id            = module.network.public_subnet_id
  private_ip           = local.ip_bd
  security_group_ids   = [aws_security_group.bd[0].id]
  key_name             = null
  volume_size          = local.plan.bd.almacenamiento_gb
  associate_public_ip  = true
  iam_instance_profile = aws_iam_instance_profile.servidor.name
  user_data = templatefile("${path.module}/../cloud-init/servidor.yaml.tftpl", merge(local.cloud_init, {
    rol     = "bd"
    bd_host = ""
  }))

  depends_on = [aws_ssm_parameter.secretos]
}

module "app" {
  source = "../../modules/ec2"

  name                 = "${local.prefijo}-app"
  role                 = "app"
  ami_id               = local.ami_id
  instance_type        = local.plan.app.tipo
  subnet_id            = module.network.public_subnet_id
  private_ip           = local.ip_app
  security_group_ids   = [aws_security_group.app.id]
  key_name             = null
  volume_size          = local.plan.app.disco_gb
  associate_public_ip  = true
  iam_instance_profile = aws_iam_instance_profile.servidor.name
  user_data = templatefile("${path.module}/../cloud-init/servidor.yaml.tftpl", merge(local.cloud_init, {
    rol     = "app"
    bd_host = local.bd_host
  }))

  depends_on = [aws_ssm_parameter.secretos, aws_iam_role_policy.leer_secretos]
}

resource "aws_eip" "app" {
  domain   = "vpc"
  instance = module.app.instance_id

  tags = {
    Name = "${local.prefijo}-app"
  }
}
