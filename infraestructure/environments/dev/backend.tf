
terraform {
  backend "s3" {
    bucket       = "presencia-tfstate-aliaga23"
    key          = "presencia/dev/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
