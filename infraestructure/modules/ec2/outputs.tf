
output "instance_id" {
  description = "ID de la instancia."
  value       = aws_instance.this.id
}

output "public_ip" {
  description = "IP publica de la instancia, si existe."
  value       = aws_instance.this.public_ip
}

output "private_ip" {
  description = "IP privada de la instancia."
  value       = aws_instance.this.private_ip
}

output "instance_type" {
  description = "Tipo de instancia utilizado."
  value       = aws_instance.this.instance_type
}
