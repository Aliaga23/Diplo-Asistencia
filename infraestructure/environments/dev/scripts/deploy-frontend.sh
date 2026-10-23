
#!/usr/bin/env bash
set -euo pipefail

echo "================================="
echo " DESPLIEGUE FRONTEND - PRESENCIA"
echo "================================="

APP_DIR="/opt/presencia/app"
FRONTEND_DIR="$APP_DIR/frontend"

cd "$APP_DIR"

echo "Actualizando repositorio..."
git fetch origin main
git checkout main
git reset --hard origin/main

cd "$FRONTEND_DIR"

export PATH="$HOME/.local/bin:$PATH"

echo "Instalando dependencias..."
pnpm install --frozen-lockfile

echo "Compilando Next.js..."
pnpm build

echo "Preparando archivos standalone..."

if [ -d "public" ]; then
  cp -r public .next/standalone/
fi

mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/

echo "Reiniciando servicio Next.js..."
sudo systemctl restart presencia-frontend

echo "Verificando servicio..."
sudo systemctl is-active --quiet presencia-frontend

echo "Comprobando aplicación..."
curl --fail --silent --show-error \
  --output /dev/null \
  --retry 10 \
  --retry-delay 2 \
  --retry-connrefused \
  http://127.0.0.1:3000/

echo "FRONTEND DESPLEGADO CORRECTAMENTE"
git rev-parse HEAD
