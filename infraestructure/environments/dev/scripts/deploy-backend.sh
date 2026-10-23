
#!/usr/bin/env bash
set -euo pipefail

echo "================================="
echo " DESPLIEGUE BACKEND - PRESENCIA"
echo "================================="

APP_DIR="/opt/presencia/app"
BACKEND_DIR="$APP_DIR/backend"

cd "$APP_DIR"

echo "Actualizando repositorio..."
git fetch origin main
git checkout main
git reset --hard origin/main

cd "$BACKEND_DIR"

export PATH="$HOME/.local/bin:$PATH"

echo "Instalando dependencias Python..."
uv sync --locked --no-dev

echo "Ejecutando migraciones Alembic..."
uv run --no-dev alembic upgrade head

echo "Reiniciando servicio FastAPI..."
sudo systemctl restart presencia-backend

echo "Verificando servicio..."
sudo systemctl is-active --quiet presencia-backend

echo "Comprobando API..."
curl --fail --silent --show-error \
  --retry 10 \
  --retry-delay 2 \
  --retry-connrefused \
  http://10.20.1.20:8000/health

echo
echo "BACKEND DESPLEGADO CORRECTAMENTE"
git rev-parse HEAD
