#!/usr/bin/env bash
# Configura un servidor del tenant en su primer arranque. Lo llama cloud-init.
# Los datos no secretos vienen de /etc/presencia/tenant.env; los secretos, de SSM Parameter Store.
set -euo pipefail

source /etc/presencia/tenant.env

APP_DIR=/opt/presencia/app
BD_NOMBRE=asistencia
BD_USUARIO=asistencia

log() { echo "[presencia-arranque] $*"; }

secreto() {
  aws ssm get-parameter --region "$REGION" --with-decryption \
    --name "/presencia/tenants/${TENANT}/$1" --query Parameter.Value --output text
}

preparar_postgres() {
  local acepta_red=$1
  local conf
  conf=$(ls -d /etc/postgresql/*/main | sort -V | tail -1)

  if [[ $acepta_red == si ]]; then
    echo "listen_addresses = '*'" > "$conf/conf.d/presencia.conf"
    local regla="host ${BD_NOMBRE} ${BD_USUARIO} ${VPC_CIDR} scram-sha-256"
    grep -qxF "$regla" "$conf/pg_hba.conf" || echo "$regla" >> "$conf/pg_hba.conf"
  fi

  systemctl enable postgresql
  systemctl restart postgresql

  sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${BD_USUARIO}') THEN
    CREATE ROLE ${BD_USUARIO} LOGIN;
  END IF;
END \$\$;
ALTER ROLE ${BD_USUARIO} PASSWORD '${BD_PASSWORD}';
SELECT 'CREATE DATABASE ${BD_NOMBRE} OWNER ${BD_USUARIO}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${BD_NOMBRE}')\gexec
SQL
}

esperar_bd() {
  local host=$1
  for _ in $(seq 1 120); do
    pg_isready -q -h "$host" -p 5432 && return 0
    sleep 5
  done
  log "la base de datos ${host}:5432 no respondio en 10 minutos"
  return 1
}

configurar_app() {
  local bd_host
  case "$BD_MODO" in
    local)
      preparar_postgres no
      bd_host=127.0.0.1
      ;;
    ec2 | rds)
      bd_host=$BD_HOST
      esperar_bd "$bd_host"
      ;;
    *)
      log "modo de base de datos desconocido: $BD_MODO"
      exit 1
      ;;
  esac

  install -m 600 -o ubuntu -g ubuntu /dev/null "$APP_DIR/backend/.env"
  cat > "$APP_DIR/backend/.env" <<ENV
ENVIRONMENT=production
APP_NAME=Presencia ${INSTITUCION}
DATABASE_URL=postgresql+psycopg://${BD_USUARIO}:${BD_PASSWORD}@${bd_host}:5432/${BD_NOMBRE}?connect_timeout=3
JWT_SECRET=$(secreto jwt_secret)
DEFAULT_PASSWORD=$(secreto admin_password)
ADMIN_REGISTRATION=${ADMIN_REGISTRO}
ADMIN_EMAIL=${ADMIN_CORREO}
ADMIN_NAME=${ADMIN_NOMBRE}
TIMEZONE=America/La_Paz
ENV

  local demo=""
  [[ $DATOS_DEMO == true ]] && demo="--demo"
  sudo -u ubuntu -H bash -c "cd '$APP_DIR/backend' && .venv/bin/alembic upgrade head && .venv/bin/python -m app.seed $demo"

  sed -i '/^INSTITUCION/d' /etc/presencia-frontend.env
  {
    echo "INSTITUCION=${INSTITUCION}"
    echo "INSTITUCION_SIGLA=${TENANT^^}"
  } >> /etc/presencia-frontend.env

  systemctl enable --now presencia-backend presencia-frontend
  systemctl reload nginx
}

configurar_bd() {
  preparar_postgres si
  systemctl disable --now nginx
}

log "tenant ${TENANT}, rol ${ROL}, base de datos ${BD_MODO}"
BD_PASSWORD=$(secreto bd_password)

case "$ROL" in
  app) configurar_app ;;
  bd) configurar_bd ;;
  *)
    log "rol desconocido: $ROL"
    exit 1
    ;;
esac

log "listo"
