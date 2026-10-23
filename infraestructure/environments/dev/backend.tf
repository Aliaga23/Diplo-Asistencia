
terraform {
  backend "s3" {
    bucket       = "diplo-asistencia-state-359013545184"
    key          = "presencia/dev/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
