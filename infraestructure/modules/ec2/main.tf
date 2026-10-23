
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.0"
    }
  }
}

resource "aws_instance" "this" {
  ami           = var.ami_id
  instance_type = var.instance_type

  user_data = var.user_data


  iam_instance_profile = var.iam_instance_profile

  subnet_id  = var.subnet_id
  private_ip = var.private_ip

  associate_public_ip_address = var.associate_public_ip

  vpc_security_group_ids = var.security_group_ids

  key_name = var.key_name

  # Instancias T3: evita cargos CPU excedentes
  credit_specification {
    cpu_credits = var.cpu_credits
  }

  # Exigir IMDSv2
  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  # Disco raiz cifrado
  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.volume_size
    encrypted             = true
    delete_on_termination = true
  }

  tags = {
    Name = var.name
    Role = var.role
  }

  # Evita reemplazos automáticos por nuevas AMI
  lifecycle {
    ignore_changes = [ami]
  }
}
