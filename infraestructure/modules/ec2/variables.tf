
variable "name" {
  description = "Nombre del servidor."
  type        = string
}

variable "role" {
  description = "Rol: frontend o backend."
  type        = string
}

variable "ami_id" {
  description = "AMI de Ubuntu."
  type        = string
}

variable "instance_type" {
  description = "Tipo de instancia."
  type        = string
}

variable "subnet_id" {
  description = "ID de la subred."
  type        = string
}

variable "private_ip" {
  description = "IP privada fija."
  type        = string
}

variable "security_group_ids" {
  description = "Grupos de seguridad."
  type        = list(string)
}

variable "key_name" {
  description = "Nombre del Key Pair de AWS."
  type        = string
}

variable "volume_size" {
  description = "Tamano del disco en GiB."
  type        = number
}

variable "associate_public_ip" {
  description = "Asigna IP publica automaticamente."
  type        = bool
  default     = false
}

variable "cpu_credits" {
  description = "Modo de creditos CPU T3."
  type        = string
  default     = "standard"
}


variable "user_data" {
  description = "Script de configuracion inicial de Ubuntu."
  type        = string
  default     = null
}


variable "iam_instance_profile" {
  description = "Nombre del perfil IAM asociado a la instancia EC2."
  type        = string
  default     = null
}
