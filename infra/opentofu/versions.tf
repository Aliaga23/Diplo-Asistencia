# Versiones de OpenTofu y del provider de AWS.
#
# Estado LOCAL a propósito (práctico de la clase 2): no hay bloque `backend`, así que el estado
# queda en `terraform.tfstate` dentro de esta carpeta. Ver docs/despliegue-clase2.md, sección
# «Estado de OpenTofu», antes de compartir este directorio con el equipo.
terraform {
  required_version = ">= 1.8.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}
