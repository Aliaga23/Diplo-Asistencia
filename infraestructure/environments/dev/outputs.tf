
output "region" {
  description = "Region AWS."
  value       = var.aws_region
}

output "vpc_id" {
  description = "Identificador de la VPC."
  value       = module.network.vpc_id
}

output "frontend" {
  description = "Datos de EC2 frontend."

  value = {
    instance_id   = module.frontend.instance_id
    instance_type = module.frontend.instance_type
    public_ip     = aws_eip.frontend.public_ip
    private_ip    = module.frontend.private_ip
    security_group = (
      module.security.frontend_security_group_id
    )
  }
}

output "backend" {
  description = "Datos de EC2 backend."

  value = {
    instance_id   = module.backend.instance_id
    instance_type = module.backend.instance_type
    public_ip     = module.backend.public_ip
    private_ip    = module.backend.private_ip
    security_group = (
      module.security.backend_security_group_id
    )
  }
}

output "ssh_frontend" {
  description = "Comando SSH al frontend."

  value = format(
    "ssh -i \"%s\" ubuntu@%s",
    trimsuffix(var.ssh_public_key_path, ".pub"),
    aws_eip.frontend.public_ip
  )
}

output "ssh_backend" {
  description = "Comando SSH al backend."

  value = format(
    "ssh -i \"%s\" ubuntu@%s",
    trimsuffix(var.ssh_public_key_path, ".pub"),
    module.backend.public_ip
  )
}

output "api_url_interna" {
  description = "URL privada de FastAPI."

  value = format(
    "http://%s:%d",
    module.backend.private_ip,
    local.backend_api_port
  )
}

output "dns_registro" {
  description = "Registro DNS sugerido."

  value = var.app_domain == null ? null : {
    tipo      = "A"
    nombre    = var.app_domain
    contenido = aws_eip.frontend.public_ip
  }
}

output "url_aplicacion" {
  description = "URL prevista tras instalar el software."

  value = var.app_domain == null ? (
    "http://${aws_eip.frontend.public_ip}"
    ) : (
    "https://${var.app_domain}"
  )
}
