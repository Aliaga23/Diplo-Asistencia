
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

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  selected_ami = (
    var.ami_id != null
    ? var.ami_id
    : data.aws_ami.ubuntu.id
  )

  selected_az = (
    var.availability_zone != null
    ? var.availability_zone
    : data.aws_availability_zones.available.names[0]
  )

  frontend_private_ip = cidrhost(
    var.public_subnet_cidr, 10
  )

  backend_private_ip = cidrhost(
    var.public_subnet_cidr, 20
  )

  backend_api_port = 8000

  # Plantillas cloud-init compartidas con CloudFormation y Pulumi.
  cloud_init_dir = "${path.module}/../../cloud-init"
}

# ==========================
# RED
# ==========================

module "network" {
  source = "../../modules/network"

  name_prefix        = local.name_prefix
  vpc_cidr           = var.vpc_cidr
  public_subnet_cidr = var.public_subnet_cidr
  availability_zone  = local.selected_az
}

# ==========================
# SEGURIDAD
# ==========================

module "security" {
  source = "../../modules/security"

  name_prefix      = local.name_prefix
  vpc_id           = module.network.vpc_id
  admin_cidrs      = var.admin_cidrs
  backend_api_port = local.backend_api_port
}

# ==========================
# CLAVE SSH PUBLICA
# ==========================

resource "aws_key_pair" "admin" {
  key_name = "${local.name_prefix}-admin"

  public_key = trimspace(
    file(pathexpand(var.ssh_public_key_path))
  )

  tags = {
    Name = "${local.name_prefix}-admin"
  }
}

# ==========================
# FRONTEND EC2
# ==========================

module "frontend" {

  source = "../../modules/ec2"

  # Mismo cloud-config que usan CloudFormation y Pulumi.
  user_data = templatefile("${local.cloud_init_dir}/frontend.yaml", {
    backend_private_ip = local.backend_private_ip
    repo_url           = var.repo_url
    repo_branch        = var.repo_branch
  })

  name = "${local.name_prefix}-frontend"
  role = "frontend"


  iam_instance_profile = aws_iam_instance_profile.ssm_ec2.name

  ami_id        = local.selected_ami
  instance_type = var.frontend_instance_type

  subnet_id  = module.network.public_subnet_id
  private_ip = local.frontend_private_ip

  security_group_ids = [
    module.security.frontend_security_group_id
  ]

  key_name = aws_key_pair.admin.key_name

  volume_size = var.frontend_volume_size

  associate_public_ip = true
  cpu_credits         = var.cpu_credits
}

# ==========================
# BACKEND EC2
# ==========================

module "backend" {


  source = "../../modules/ec2"

  user_data = templatefile("${local.cloud_init_dir}/backend.yaml", {
    repo_url    = var.repo_url
    repo_branch = var.repo_branch
    seed_args   = var.load_demo_data ? "--demo" : ""
  })

  name = "${local.name_prefix}-backend"
  role = "backend"

  iam_instance_profile = aws_iam_instance_profile.ssm_ec2.name

  ami_id        = local.selected_ami
  instance_type = var.backend_instance_type

  subnet_id  = module.network.public_subnet_id
  private_ip = local.backend_private_ip

  security_group_ids = [
    module.security.backend_security_group_id
  ]

  key_name = aws_key_pair.admin.key_name

  volume_size = var.backend_volume_size

  associate_public_ip = true
  cpu_credits         = var.cpu_credits
}

# ==========================
# IP ELASTICA FRONTEND
# ==========================

resource "aws_eip" "frontend" {
  domain = "vpc"

  instance = module.frontend.instance_id

  tags = {
    Name = "${local.name_prefix}-frontend-eip"
  }

  depends_on = [module.network]
}
