output "servidores" {
  description = "IP publica e IP privada de cada servidor."

  value = {
    database = {
      public_ip  = module.server["database"].public_ip
      private_ip = module.server["database"].private_ip
    }
    backend = {
      public_ip  = module.server["backend"].public_ip
      private_ip = module.server["backend"].private_ip
    }
    frontend = {
      public_ip  = aws_eip.frontend.public_ip
      private_ip = module.server["frontend"].private_ip
    }
  }
}

output "inventario_ansible" {
  description = "Inventario generado para Ansible."
  value       = abspath(local_file.ansible_inventory.filename)
}

output "url_aplicacion" {
  description = "URL de la app cuando Ansible termina."
  value       = "http://${aws_eip.frontend.public_ip}"
}
