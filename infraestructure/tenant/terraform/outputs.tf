output "url" {
  description = "Direccion de la aplicacion del tenant."
  value       = "http://${aws_eip.app.public_ip}"
}

output "ip_publica" {
  value = aws_eip.app.public_ip
}

output "instancias" {
  description = "Instancias EC2 del tenant."
  value       = concat([module.app.instance_id], [for s in module.bd : s.instance_id])
}

output "rds" {
  description = "Identificador de la base RDS, si el plan la usa."
  value       = local.bd_modo == "rds" ? aws_db_instance.bd[0].identifier : ""
}

output "ami" {
  value = local.ami_id
}

output "admin_registro" {
  value = var.admin_registro
}
