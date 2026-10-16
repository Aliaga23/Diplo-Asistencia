# Sin perfil, región ni claves en el código: el provider usa la cadena estándar de AWS
# (variables de entorno, AWS_PROFILE con IAM o SSO, ~/.aws/config). Así funciona con la
# cuenta de cualquier integrante sin editar estos archivos. infra.ps1 prepara ese entorno.
provider "aws" {
  default_tags {
    tags = local.common_tags
  }
}
