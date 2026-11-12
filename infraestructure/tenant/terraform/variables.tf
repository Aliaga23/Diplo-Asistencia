variable "tenant" {
  description = "Identificador unico del tenant."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,19}$", var.tenant))
    error_message = "El identificador usa de 3 a 20 letras minusculas, numeros o guiones y empieza con letra."
  }
}

variable "institucion" {
  description = "Nombre de la institucion."
  type        = string
}

variable "plan" {
  description = "Plan del catalogo: basico, estandar o avanzado."
  type        = string

  validation {
    condition     = contains(["basico", "estandar", "avanzado"], var.plan)
    error_message = "El plan debe ser basico, estandar o avanzado."
  }
}

variable "entorno" {
  description = "Entorno del tenant."
  type        = string
  default     = "produccion"
}

variable "region" {
  description = "Region de AWS."
  type        = string
  default     = "us-east-1"
}

variable "cuenta_aws" {
  description = "Cuenta AWS donde se permite desplegar."
  type        = string
}

variable "admin_cidrs" {
  description = "Rangos que pueden leer las metricas (Prometheus de la plataforma)."
  type        = list(string)
}

variable "admin_registro" {
  description = "Numero de registro del administrador del tenant."
  type        = string
}

variable "admin_nombre" {
  description = "Nombre del administrador del tenant."
  type        = string
}

variable "admin_correo" {
  description = "Correo de contacto del tenant."
  type        = string
}

variable "contrasena_inicial" {
  description = "Contraseña común de las cuentas del tenant (DEFAULT_PASSWORD de Presencia)."
  type        = string
  default     = "admin1234!"
  sensitive   = true
}

variable "datos_demo" {
  description = "Carga estudiantes y asistencia de ejemplo."
  type        = bool
  default     = false
}

variable "ami_id" {
  description = "AMI de Presencia. Vacio usa la ultima construida con Packer."
  type        = string
  default     = ""
}
