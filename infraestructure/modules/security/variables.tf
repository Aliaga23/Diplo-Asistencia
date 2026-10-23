
variable "name_prefix" {
  description = "Prefijo de los recursos."
  type        = string
}

variable "vpc_id" {
  description = "ID de la VPC."
  type        = string
}

variable "admin_cidrs" {
  description = "Direcciones autorizadas para SSH."
  type        = list(string)
}

variable "backend_api_port" {
  description = "Puerto interno del backend."
  type        = number
  default     = 8000
}
