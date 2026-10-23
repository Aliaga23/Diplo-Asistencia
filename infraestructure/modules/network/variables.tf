
variable "name_prefix" {
  description = "Prefijo para nombrar recursos."
  type        = string
}

variable "vpc_cidr" {
  description = "Rango IPv4 de la VPC."
  type        = string
}

variable "public_subnet_cidr" {
  description = "Rango IPv4 de la subred."
  type        = string
}

variable "availability_zone" {
  description = "Zona de disponibilidad de AWS."
  type        = string
}
