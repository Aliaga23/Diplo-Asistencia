
# ==========================
# PROYECTO
# ==========================

variable "project_name" {
  description = "Nombre del proyecto."
  type        = string
  default     = "presencia"

  validation {
    condition = can(
      regex("^[a-z][a-z0-9-]{2,23}$", var.project_name)
    )
    error_message = "Usa entre 3 y 24 caracteres minusculos, numeros o guiones."
  }
}

variable "environment" {
  description = "Ambiente de despliegue."
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "Region AWS."
  type        = string
  default     = "us-east-1"
}

variable "expected_account_id" {
  description = "ID de 12 digitos de la cuenta AWS nueva."
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
  default     = "10.20.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR de la subred publica."
  type        = string
  default     = "10.20.1.0/24"
}

variable "availability_zone" {
  description = "AZ opcional. Null selecciona una disponible."
  type        = string
  default     = null
}

# ==========================
# SEGURIDAD
# ==========================

variable "admin_cidrs" {
  description = "Direcciones IPv4 autorizadas para SSH."
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

variable "ami_id" {
  description = "AMI opcional. Null usa Ubuntu oficial."
  type        = string
  default     = null
}

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

variable "frontend_volume_size" {
  description = "Disco frontend en GiB."
  type        = number
  default     = 20
}

variable "backend_volume_size" {
  description = "Disco backend en GiB."
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

# ==========================
# APLICACION
# ==========================

variable "app_domain" {
  description = "Dominio opcional, sin https://."
  type        = string
  default     = null
}


variable "github_owner_id" {
  description = "ID numerico del propietario de GitHub."
  type        = string
}

variable "github_repo_id" {
  description = "ID numerico del repositorio GitHub."
  type        = string
}
