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

variable "instance_type" {
  description = "Tipo de instancia de la plataforma (compila las imagenes Docker)."
  type        = string
  default     = "t3.medium"
}

variable "volume_size" {
  description = "Disco de la plataforma en GiB."
  type        = number
  default     = 30
}

variable "repo_url" {
  description = "Repositorio que clona la plataforma."
  type        = string
  default     = "https://github.com/Aliaga23/Diplo-Asistencia.git"
}

variable "repo_branch" {
  description = "Rama del repositorio."
  type        = string
  default     = "main"
}

variable "consola_cidrs" {
  description = "Rangos que pueden abrir la consola y Grafana."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "plataforma_password" {
  description = "Contrasena del administrador de la plataforma."
  type        = string
  default     = "admin1234!"
  sensitive   = true
}
