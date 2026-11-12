output "url" {
  description = "Consola de la plataforma."
  value       = "http://${aws_eip.plataforma.public_ip}"
}

output "grafana" {
  description = "Tablero de salud de los tenants."
  value       = "http://${aws_eip.plataforma.public_ip}/grafana/d/salud-tenants"
}

output "instancia" {
  value = aws_instance.plataforma.id
}
