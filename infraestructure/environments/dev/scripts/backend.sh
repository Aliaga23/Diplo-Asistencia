
#!/bin/bash
set -euo pipefail

exec > >(tee -a /var/log/setup-backend.log) 2>&1

echo "Iniciando configuracion del backend..."

export DEBIAN_FRONTEND=noninteractive

# Actualizar repositorios
apt-get update

# Instalar dependencias
apt-get install -y \
  python3 \
  python3-pip \
  python3-venv \
  python3-dev \
  build-essential \
  git \
  curl \
  ca-certificates \
  libpq-dev \
  postgresql \
  postgresql-contrib

# Crear directorio de aplicacion
mkdir -p /opt/presencia/backend

# Crear entorno virtual
python3 -m venv /opt/presencia/backend/.venv

# Habilitar PostgreSQL
systemctl enable postgresql
systemctl start postgresql

# Comprobar instalacion
python3 --version
psql --version

echo "Backend preparado correctamente."
