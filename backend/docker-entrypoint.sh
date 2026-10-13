#!/bin/sh
set -e
echo "→ Aplicando migraciones"
alembic upgrade head
if [ "${SEED_DEMO:-false}" = "true" ]; then
  echo "→ Cargando datos de demostración"
  python -m app.seed --demo
else
  echo "→ Cargando datos iniciales"
  python -m app.seed
fi
echo "→ Iniciando API"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers
