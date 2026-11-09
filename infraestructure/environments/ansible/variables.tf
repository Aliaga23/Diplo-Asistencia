
# ==========================
# PROYECTO
# ==========================

variable "project_name" {
  description = "Nombre del proyecto."
  type        = string
  default     = "presencia"
}

variable "environment" {
  description = "Ambiente de despliegue."
  type        = string
  default     = "ansible"
}

variable "aws_region" {
  description = "Region AWS."
  type        = string
  default     = "us-east-1"
}

variable "expected_account_id" {
  description = "ID de 12 digitos de la cuenta AWS."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.expected_account_id))
    error_message = "Indica el ID de cuenta AWS de 12 digitos."
  }
}

# ==========================
# RED
# ==========================

variable "vpc_cidr" {
  description = "CIDR de la VPC."
  type        = string
  default     = "10.30.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR de la subred publica."
  type        = string
  default     = "10.30.1.0/24"
}

# ==========================
# SEGURIDAD
# ==========================

variable "admin_cidrs" {
  description = "Direcciones IPv4 desde las que Ansible entra por SSH."
  type        = list(string)

  validation {
    condition = (
      length(var.admin_cidrs) > 0 &&
      alltrue([
        for c in var.admin_cidrs :
        can(cidrhost(c, 0)) &&
        can(regex("^[0-9.]+/[0-9]+$", c)) &&
        try(tonumber(split("/", c)[1]), 0) >= 24
      ])
    )

    error_message = "Indica CIDR IPv4 /24 o mas restrictivos. Preferiblemente tu IP /32."
  }
}

variable "ssh_public_key_path" {
  description = "Ruta a la clave SSH publica."
  type        = string
  default     = "~/.ssh/presencia-aws.pub"
}

# ==========================
# INSTANCIAS
# ==========================

variable "frontend_instance_type" {
  description = "Tipo EC2 del frontend."
  type        = string
  default     = "t3.small"
}

variable "backend_instance_type" {
  description = "Tipo EC2 del backend."
  type        = string
  default     = "t3.micro"
}

variable "database_instance_type" {
  description = "Tipo EC2 de la base de datos."
  type        = string
  default     = "t3.micro"
}

variable "volume_size" {
  description = "Disco de cada servidor en GiB."
  type        = number
  default     = 20
}

variable "cpu_credits" {
  description = "Creditos CPU de instancias T3."
  type        = string
  default     = "standard"

  validation {
    condition     = contains(["standard", "unlimited"], var.cpu_credits)
    error_message = "Usa standard o unlimited."
  }
}
