
#!/bin/bash
set -euo pipefail

exec > >(tee -a /var/log/setup-frontend.log) 2>&1

echo "Iniciando configuracion del frontend..."

export DEBIAN_FRONTEND=noninteractive

# Actualizar repositorios
apt-get update

# Instalar paquetes necesarios
apt-get install -y \
  curl \
  ca-certificates \
  gnupg \
  git \
  nginx

# Instalar Node.js 22 LTS desde NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource.sh
bash /tmp/nodesource.sh
apt-get install -y nodejs

# Preparar directorio
mkdir -p /opt/presencia/frontend

# Habilitar Nginx
systemctl enable nginx
systemctl start nginx

# Comprobar versiones
node --version
npm --version
nginx -v

echo "Frontend preparado correctamente."
