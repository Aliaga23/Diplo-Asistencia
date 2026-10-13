#!/usr/bin/env bash
# Prepara /opt/diplo-asistencia en el VPS «arturo» (se ejecuta UNA vez, en el servidor):
#
#   ssh arturo 'bash -s' < deploy/arturo/preparar.sh
#
# Crea el .env con secretos aleatorios generados aquí mismo: nunca pasan por GitHub.
# Es idempotente: si el .env ya existe, solo añade las claves que falten.
set -euo pipefail

APP=/opt/diplo-asistencia
DOMINIO=${DOMINIO:-diplo.jorgearturo.net}

if [ ! -d "$APP" ]; then
  echo "Falta $APP. Como root: install -d -o arturo -g arturo -m 750 $APP" >&2
  exit 1
fi
cd "$APP"
umask 077

aleatorio() { openssl rand -hex "$1"; }
asegurar() {
  local clave=$1 valor=$2
  if ! grep -q "^${clave}=" .env 2>/dev/null; then
    printf '%s=%s\n' "$clave" "$valor" >> .env
    echo "  + $clave"
  fi
}

touch .env
asegurar DOMINIO "$DOMINIO"
asegurar IMAGE_TAG latest
asegurar POSTGRES_PASSWORD "$(aleatorio 24)"
asegurar JWT_SECRET "$(aleatorio 48)"
asegurar DEFAULT_PASSWORD 'admin1234!'
asegurar ADMIN_REGISTRATION 218166141
asegurar SEED_DEMO true
chmod 600 .env

docker network inspect edge >/dev/null 2>&1 || {
  echo "No existe la red 'edge' del Traefik compartido (/opt/edge)." >&2
  exit 1
}
echo "Listo: $APP/.env preparado para https://$DOMINIO"
