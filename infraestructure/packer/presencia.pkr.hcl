packer {
  required_version = ">= 1.11.0"

  required_plugins {
    amazon = {
      source  = "github.com/hashicorp/amazon"
      version = ">= 1.3.0"
    }
    ansible = {
      source  = "github.com/hashicorp/ansible"
      version = ">= 1.1.0"
    }
  }
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "version_app" {
  type        = string
  description = "Version del repositorio (git describe) que queda en la imagen."
}

variable "instance_type" {
  type    = string
  default = "t3.medium"
}

locals {
  fecha = formatdate("YYYYMMDD-hhmm", timestamp())
}

source "amazon-ebs" "presencia" {
  region        = var.region
  instance_type = var.instance_type
  ssh_username  = "ubuntu"
  ami_name      = "presencia-${local.fecha}"

  ami_description = "Presencia ${var.version_app}: backend, frontend, PostgreSQL, Nginx y node_exporter"

  source_ami_filter {
    filters = {
      name                = "ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"
      virtualization-type = "hvm"
      root-device-type    = "ebs"
    }
    owners      = ["099720109477"]
    most_recent = true
  }

  launch_block_device_mappings {
    device_name           = "/dev/sda1"
    volume_size           = 10
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  temporary_key_pair_type                   = "ed25519"
  temporary_security_group_source_public_ip = true

  run_tags = {
    Name     = "packer-presencia"
    Proyecto = "presencia-imagen"
  }

  tags = {
    Name      = "presencia-${local.fecha}"
    Proyecto  = "presencia-plataforma"
    Imagen    = "presencia"
    Version   = var.version_app
    Base      = "{{ .SourceAMIName }}"
    ManagedBy = "Packer"
  }
}

build {
  sources = ["source.amazon-ebs.presencia"]

  provisioner "ansible" {
    playbook_file = "${path.root}/../ansible/imagen.yml"
    user          = "ubuntu"
    use_proxy     = false

    ansible_env_vars = [
      "ANSIBLE_HOST_KEY_CHECKING=False",
      "ANSIBLE_PIPELINING=True",
      "ANSIBLE_PYTHON_INTERPRETER=auto_silent",
      "ANSIBLE_CALLBACK_RESULT_FORMAT=yaml",
    ]
  }

  post-processor "manifest" {
    output     = "${path.root}/manifest.json"
    strip_path = true
  }
}
