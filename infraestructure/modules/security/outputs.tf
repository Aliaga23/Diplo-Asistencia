
output "frontend_security_group_id" {
  description = "Security Group del frontend."
  value       = aws_security_group.frontend.id
}

output "backend_security_group_id" {
  description = "Security Group del backend."
  value       = aws_security_group.backend.id
}
