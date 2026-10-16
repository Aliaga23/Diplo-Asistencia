# Salidas sin secretos: IDs, IP y datos para el despliegue manual y el DNS.

locals {
  frontend_ip = aws_eip.frontend.public_ip
}

output "region" {
  description = "Región donde se creó el laboratorio."
  value       = data.aws_region.current.region
}

output "vpc_id" {
  description = "VPC propia del laboratorio."
  value       = aws_vpc.main.id
}

output "ami" {
  description = "AMI con la que se crearon los servidores."
  value       = { id = local.ami_id, name = var.ami_id == null ? data.aws_ami.ubuntu.name : "fijada por ami_id" }
}

output "frontend" {
  description = "EC2 del frontend (Nginx + Next.js)."
  value = {
    instance_id    = aws_instance.frontend.id
    instance_type  = aws_instance.frontend.instance_type
    public_ip      = local.frontend_ip
    private_ip     = aws_instance.frontend.private_ip
    security_group = aws_security_group.frontend.id
  }
}

output "backend" {
  description = "EC2 del backend (FastAPI + PostgreSQL). Su IP pública cambia si se detiene y arranca."
  value = {
    instance_id    = aws_instance.backend.id
    instance_type  = aws_instance.backend.instance_type
    public_ip      = aws_instance.backend.public_ip
    private_ip     = aws_instance.backend.private_ip
    security_group = aws_security_group.backend.id
  }
}

output "ssh_frontend" {
  description = "Comando SSH al frontend (usuario ubuntu)."
  value       = "ssh -i \"${local.ssh_private_key_hint}\" ubuntu@${local.frontend_ip}"
}

output "ssh_backend" {
  description = "Comando SSH al backend (usuario ubuntu)."
  value       = "ssh -i \"${local.ssh_private_key_hint}\" ubuntu@${aws_instance.backend.public_ip}"
}

output "api_url_interna" {
  description = "Valor de API_URL en el frontend (IP privada: solo servidor a servidor, nunca el navegador)."
  value       = "http://${aws_instance.backend.private_ip}:${local.backend_api_port}"
}

output "dns_registro" {
  description = "Registro a crear en el proveedor DNS (null si no se definió app_domain)."
  value = var.app_domain == null ? null : {
    tipo      = "A"
    nombre    = var.app_domain
    contenido = local.frontend_ip
    proxy     = "Solo DNS (nube gris en Cloudflare)"
    ttl       = "Auto"
  }
}

output "url_aplicacion" {
  description = "URL CALCULADA. Solo responde tras el despliegue manual (y, con dominio, tras emitir el certificado)."
  value       = var.app_domain == null ? "http://${local.frontend_ip}" : "https://${var.app_domain}"
}
