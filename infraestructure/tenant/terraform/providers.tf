provider "aws" {
  region = var.region

  allowed_account_ids = [var.cuenta_aws]

  default_tags {
    tags = {
      Proyecto  = "presencia-plataforma"
      Tenant    = var.tenant
      Plan      = var.plan
      Entorno   = var.entorno
      ManagedBy = "Terraform"
    }
  }
}
