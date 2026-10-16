# Credenciales y región NO son variables: el provider usa la cadena estándar de AWS
# (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY, AWS_PROFILE con SSO, AWS_REGION...).
# infra.ps1 las prepara desde el .env de la raíz o desde un perfil de AWS CLI.

variable "name_prefix" {
  description = "Prefijo de nombres y etiqueta Stack. Otro entorno en la MISMA cuenta necesita uno distinto."
  type        = string
  default     = "presencia-clase2"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,23}$", var.name_prefix))
    error_message = "name_prefix: 3 a 24 caracteres, minúsculas, números o guiones, empezando por letra."
  }
}

variable "app_domain" {
  description = "Dominio de la app (p. ej. diplo.asistencia.ficct.com). Opcional: sin dominio se usa http://<IP elástica>."
  type        = string
  default     = null

  validation {
    condition     = var.app_domain == null || can(regex("^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,}$", var.app_domain))
    error_message = "app_domain debe ser un nombre de host en minúsculas, sin http:// ni barras."
  }
}

# ---------------------------------------------------------------------------
# Red
# ---------------------------------------------------------------------------

variable "vpc_cidr" {
  description = "Rango de la VPC propia del laboratorio (no se toca la VPC por defecto)."
  type        = string
  default     = "10.20.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "vpc_cidr debe ser un CIDR IPv4 válido, p. ej. 10.20.0.0/16."
  }
}

variable "public_subnet_cidr" {
  description = "Subred pública (dentro de vpc_cidr) donde viven ambas EC2."
  type        = string
  default     = "10.20.1.0/24"

  validation {
    condition     = can(cidrhost(var.public_subnet_cidr, 20))
    error_message = "public_subnet_cidr debe ser un CIDR IPv4 válido con al menos 32 direcciones."
  }
}

variable "availability_zone" {
  description = "Zona de disponibilidad. Si es null se elige la primera que ofrece ambos tipos de instancia."
  type        = string
  default     = null
}

variable "admin_cidrs" {
  description = "CIDR con acceso SSH. infra.ps1 usa tu IP pública /32 si no lo defines."
  type        = list(string)

  validation {
    condition     = length(var.admin_cidrs) > 0
    error_message = "Indica al menos un CIDR administrativo para SSH (p. ej. tu IP pública con /32)."
  }

  validation {
    condition = alltrue([
      for c in var.admin_cidrs :
      can(cidrhost(c, 0)) && can(regex("^[0-9.]+/[0-9]+$", c)) && tonumber(split("/", c)[1]) >= 16
    ])
    error_message = "Cada admin_cidrs debe ser IPv4 con prefijo /16 o más estrecho. Nunca 0.0.0.0/0 para SSH."
  }
}

variable "web_ingress_cidrs" {
  description = "Orígenes que pueden abrir la web (80/443 del frontend). Let's Encrypt necesita el 80 abierto a Internet."
  type        = list(string)
  default     = ["0.0.0.0/0"]

  validation {
    condition     = length(var.web_ingress_cidrs) > 0 && alltrue([for c in var.web_ingress_cidrs : can(cidrhost(c, 0))])
    error_message = "web_ingress_cidrs debe contener CIDR IPv4 válidos."
  }
}

# ---------------------------------------------------------------------------
# Instancias
# ---------------------------------------------------------------------------

variable "ssh_public_key_path" {
  description = "Clave PÚBLICA SSH (.pub). infra.ps1 la genera si no existe; la privada nunca entra en OpenTofu."
  type        = string
  default     = "~/.ssh/diplo-asistencia.pub"

  validation {
    condition     = can(regex("^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521)) ", file(pathexpand(var.ssh_public_key_path))))
    error_message = "ssh_public_key_path debe apuntar a una clave pública OpenSSH existente (.pub), nunca a la privada."
  }
}

variable "ami_id" {
  description = "AMI fija (opcional). Si es null se usa la Ubuntu 24.04 LTS oficial de Canonical más reciente de la región."
  type        = string
  default     = null

  validation {
    condition     = var.ami_id == null || can(regex("^ami-[0-9a-f]{8,17}$", var.ami_id))
    error_message = "ami_id debe tener el formato ami-xxxxxxxx."
  }
}

variable "frontend_instance_type" {
  description = "Tipo de la EC2 del frontend. t3.small (2 GiB): `next build` usa ~1,3 GiB de pico."
  type        = string
  default     = "t3.small"
}

variable "backend_instance_type" {
  description = "Tipo de la EC2 del backend (FastAPI + PostgreSQL)."
  type        = string
  default     = "t3.micro"
}

variable "cpu_credits" {
  description = "Créditos de CPU de las T3: unlimited (por defecto de AWS) o standard (sin cargos extra, pero lento al compilar)."
  type        = string
  default     = "unlimited"

  validation {
    condition     = contains(["standard", "unlimited"], var.cpu_credits)
    error_message = "cpu_credits debe ser standard o unlimited."
  }
}

variable "frontend_volume_size_gb" {
  description = "Disco raíz del frontend en GiB (Ubuntu + Node + node_modules + build + swap de 2 GiB)."
  type        = number
  default     = 12

  validation {
    condition     = var.frontend_volume_size_gb >= 8 && var.frontend_volume_size_gb <= 30
    error_message = "frontend_volume_size_gb debe estar entre 8 y 30 GiB."
  }
}

variable "backend_volume_size_gb" {
  description = "Disco raíz del backend en GiB (Ubuntu + Python + PostgreSQL + respaldos)."
  type        = number
  default     = 10

  validation {
    condition     = var.backend_volume_size_gb >= 8 && var.backend_volume_size_gb <= 30
    error_message = "backend_volume_size_gb debe estar entre 8 y 30 GiB."
  }
}
