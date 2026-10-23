
# ==========================
# VARIABLES
# ==========================

variable "aws_region" {
  description = "Region AWS."
  type        = string
  default     = "us-east-1"
}

variable "expected_account_id" {
  description = "ID de la cuenta AWS nueva."
  type        = string
}

variable "state_bucket_name" {
  description = "Nombre globalmente unico del bucket."
  type        = string
}

# ==========================
# PROVIDER
# ==========================

provider "aws" {
  region = var.aws_region

  allowed_account_ids = [
    var.expected_account_id
  ]
}

# ==========================
# BUCKET S3
# ==========================

resource "aws_s3_bucket" "state" {
  bucket = var.state_bucket_name

  tags = {
    Name      = var.state_bucket_name
    Purpose   = "OpenTofu State"
    ManagedBy = "OpenTofu"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# ==========================
# VERSIONADO
# ==========================

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

# ==========================
# CIFRADO
# ==========================

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ==========================
# BLOQUEO DE ACCESO PUBLICO
# ==========================

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ==========================
# PROPIEDAD DE OBJETOS
# ==========================

resource "aws_s3_bucket_ownership_controls" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# ==========================
# OUTPUTS
# ==========================

output "bucket_name" {
  description = "Nombre del bucket."
  value       = aws_s3_bucket.state.bucket
}

output "bucket_arn" {
  description = "ARN del bucket."
  value       = aws_s3_bucket.state.arn
}
