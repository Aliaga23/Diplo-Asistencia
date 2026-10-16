# Despliegue en AWS con OpenTofu — práctico clase 2

OpenTofu crea la red y **dos EC2** (frontend y backend). La aplicación se instala **a mano** por
SSH con esta guía: no hay `user_data`, cloud-init, provisioners, Docker ni CI/CD.

Cada bloque indica dónde se ejecuta:

| Marca | Dónde |
|---|---|
| **[PC]** | PowerShell en tu equipo, en la raíz del repositorio |
| **[BE]** | SSH en la EC2 backend (usuario `ubuntu`) |
| **[FE]** | SSH en la EC2 frontend (usuario `ubuntu`) |
| **[DNS]** | Panel DNS de tu dominio (p. ej. Cloudflare) |

## 1. Arquitectura

```text
Navegador ──HTTPS 443 / HTTP 80──▶ IP elástica ─▶ EC2 frontend  (t3.small, Ubuntu 24.04)
                                                  Nginx :80/:443 ─▶ Next.js 127.0.0.1:3000
                                                          │ API_URL = http://10.20.1.20:8000
                                                          ▼ (IP privada, servidor a servidor)
                                                  EC2 backend   (t3.micro, Ubuntu 24.04)
                                                  FastAPI 0.0.0.0:8000 ─▶ PostgreSQL 18 127.0.0.1:5432
```

| Grupo de seguridad | Entrada | Salida |
|---|---|---|
| frontend | 80 y 443 desde Internet; 22 desde tu IP | 80/443/123 a Internet; 8000 al grupo backend |
| backend | 8000 **solo desde el grupo frontend**; 22 desde tu IP | 80/443/123 a Internet |

- El navegador solo habla con Nginx. Next.js llama a FastAPI desde el servidor (BFF en
  `frontend/src/app/api/backend/[...path]/route.ts`); el navegador nunca ve la IP privada.
- PostgreSQL no tiene regla de entrada y solo escucha en `127.0.0.1`.
- El backend tiene IP pública solo para SSH y para descargar paquetes (evita un NAT Gateway,
  ~33 USD/mes). Su puerto 8000 sigue cerrado a Internet.
- Discos gp3 cifrados con la clave administrada `aws/ebs`. IMDSv2 obligatorio. Sin roles IAM.
- Frontend `t3.small` porque `next build` midió ~1,3 GiB de pico; con 1 GiB dependería del swap.

## 2. Requisitos (una vez por persona)

**[PC]**

```powershell
winget install --exact --id OpenTofu.Tofu
winget install --exact --id Amazon.AWSCLI
# Cierra y abre la terminal. OpenSSH y Git ya vienen con Windows 10/11 y Git para Windows.
```

Credenciales: usa **una** de estas opciones. Los permisos están en [`permisos-aws.md`](permisos-aws.md).

- **A. Usuario IAM con access key**: copia `.env.example` como `.env` en la raíz y completa
  `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY`. `.env` no se versiona.
- **B. Perfil de AWS CLI (SSO o IAM)**: `aws configure sso` (o `aws configure --profile X`). Luego
  pon `AWS_PROFILE=X` en `.env`, o pasa `-Perfil X` al script. Si la sesión SSO expiró, el script
  ejecuta `aws sso login`.

No hay que editar ningún `.tf`. Por defecto:

- la región es la de tu perfil o `us-east-1`;
- SSH queda abierto solo a tu IP pública actual;
- la clave SSH es `~/.ssh/diplo-asistencia`, y el script la crea si no existe.

Para cambiar algo, usa `TF_VAR_<variable>` en `.env` o `infra/opentofu/terraform.tfvars`
(hay un `terraform.tfvars.example` con todas las opciones).

Dominio (opcional): `TF_VAR_app_domain=diplo.asistencia.ficct.com` en `.env`. Sin dominio, la app
queda en `http://<IP elástica>`.

## 3. Infraestructura

**[PC]**

```powershell
.\infra\opentofu\infra.ps1                  # Plan: solo lectura, no crea nada
.\infra\opentofu\infra.ps1 -Accion Aplicar  # muestra el plan y pide escribir APLICAR
```

Antes de escribir `APLICAR`, revisa en el plan:

- que diga `23 to add, 0 to change, 0 to destroy`;
- que los tipos sean `t3.small` y `t3.micro`;
- que la regla SSH tenga tu IP.

Otras acciones:

| Acción | Para qué |
|---|---|
| `-Accion Salidas` | IP, comandos SSH, `api_url_interna` y `dns_registro` |
| `-Accion Identidad` | Con qué cuenta y usuario estás operando |
| `-Accion Restantes` | Qué recursos del laboratorio siguen existiendo |
| `-Accion Destruir` | Borra todo (pide escribir `DESTRUIR`) |
| `-Accion Validar` | `fmt -check` y `validate`, sin AWS |
| `-Accion Empaquetar` | Paquetes `.tar.gz` del código commiteado |

`url_aplicacion` es una URL **calculada**: responde solo cuando termines los pasos 5 a 7.

Variables para el resto de la guía:

**[PC]**

```powershell
$o   = tofu -chdir=infra/opentofu output -json | Out-String | ConvertFrom-Json
$FE  = $o.frontend.value.public_ip     # IP elástica del frontend
$BE  = $o.backend.value.public_ip
$KEY = "$HOME\.ssh\diplo-asistencia"
```

## 4. DNS (solo con dominio)

**[DNS]** En Cloudflare → tu zona (p. ej. `ficct.com`) → **DNS → Records → Add record**:

| Campo | Valor |
|---|---|
| Type | `A` |
| Name | `diplo.asistencia` (Cloudflare completa `.ficct.com`) |
| IPv4 address | la IP elástica (`$FE`, o `dns_registro.contenido` en las salidas) |
| Proxy status | **DNS only** (nube gris) |
| TTL | Auto |

- **Nube gris obligatoria.** El certificado gratuito de Cloudflare solo cubre `ficct.com` y
  `*.ficct.com` (un nivel). `diplo.asistencia.ficct.com` tiene dos niveles: con el proxy naranja,
  el navegador daría error TLS. El certificado lo emite Let's Encrypt en el servidor (paso 7).
- Si la zona tiene registros **CAA**, agrega `CAA 0 issue "letsencrypt.org"`. Sin registros CAA
  no hace falta nada.

Comprueba la resolución (suele tardar menos de 5 minutos):

**[PC]**

```powershell
Resolve-DnsName diplo.asistencia.ficct.com -Type A
```

## 5. Copiar el código a los servidores

`Empaquetar` usa **lo commiteado** (HEAD) y fuerza finales de línea LF. Haz commit antes.

**[PC]**

```powershell
.\infra\opentofu\infra.ps1 -Accion Empaquetar
$PKG = Join-Path ([IO.Path]::GetTempPath()) "presencia-paquetes"
scp -i $KEY "$PKG\presencia-backend.tar.gz"  "ubuntu@${BE}:/tmp/"
scp -i $KEY "$PKG\presencia-frontend.tar.gz" "ubuntu@${FE}:/tmp/"
```

La primera conexión pregunta si confías en el servidor: responde `yes`.

## 6. Backend

**[PC]** `ssh -i $KEY ubuntu@$BE`

**[BE]** Sistema, PostgreSQL 18 (repositorio oficial PGDG) y usuario de servicio:

```bash
sudo timedatectl set-timezone America/La_Paz
sudo apt-get update
sudo NEEDRESTART_MODE=a DEBIAN_FRONTEND=noninteractive apt-get -y upgrade
sudo apt-get install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
sudo apt-get install -y postgresql-18

sudo useradd --system --create-home --home-dir /opt/presencia --shell /usr/sbin/nologin presencia
sudo chmod 755 /opt/presencia    # Ubuntu crea el home con 750; los secretos van aparte (.env 600)
sudo tar -xzf /tmp/presencia-backend.tar.gz -C /opt/presencia --no-same-owner
sudo chown -R presencia:presencia /opt/presencia
```

**[BE]** Base de datos. La contraseña se genera aquí y no sale del servidor:

```bash
cd /tmp
DB_PASS=$(openssl rand -hex 24)
sudo -u postgres psql -v ON_ERROR_STOP=1 -v pass="$DB_PASS" <<'SQL'
CREATE ROLE asistencia LOGIN PASSWORD :'pass';
CREATE DATABASE asistencia OWNER asistencia;
ALTER DATABASE asistencia SET timezone TO 'America/La_Paz';
SQL
```

**[BE]** uv 0.12.18, la misma versión del `Dockerfile`, con checksum verificado. Instala
dependencias según `uv.lock`; uv descarga Python 3.14 según `backend/.python-version`:

```bash
cd /tmp
U=https://github.com/astral-sh/uv/releases/download/0.12.18/uv-x86_64-unknown-linux-gnu.tar.gz
curl -fsSLo uv.tgz "$U" && curl -fsSLo uv.sha256 "$U.sha256"
echo "$(cut -d' ' -f1 uv.sha256)  uv.tgz" | sha256sum -c -
sudo tar -xzf uv.tgz -C /usr/local/bin --strip-components=1 \
  uv-x86_64-unknown-linux-gnu/uv uv-x86_64-unknown-linux-gnu/uvx

cd /opt/presencia/backend
sudo -u presencia -H uv sync --frozen --no-dev
```

**[BE]** Configuración en `/opt/presencia/backend/.env` (permisos 600). Debe ejecutarse en la
**misma sesión** que creó `DB_PASS`:

```bash
ORIGEN=https://diplo.asistencia.ficct.com     # sin dominio: http://<IP elástica del frontend>
sudo -u presencia sh -c 'umask 077; cat > /opt/presencia/backend/.env' <<EOF
DATABASE_URL=postgresql+psycopg://asistencia:${DB_PASS}@127.0.0.1:5432/asistencia
JWT_SECRET=$(openssl rand -hex 32)
CORS_ORIGINS=["${ORIGEN}"]
TIMEZONE=America/La_Paz
DEFAULT_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=')
EOF
unset DB_PASS
```

`DEFAULT_PASSWORD` es la contraseña inicial de **todas** las cuentas. Es aleatoria porque la del
README (`admin1234!`) es pública. Para verla: `sudo grep ^DEFAULT_PASSWORD /opt/presencia/backend/.env`.

**[BE]** Migraciones, datos sintéticos de demostración y servicio:

```bash
cd /opt/presencia/backend
sudo -u presencia -H .venv/bin/alembic upgrade head
sudo -u presencia -H .venv/bin/python -m app.seed --demo

sudo cp /opt/presencia/deploy/aws-ec2/backend/presencia-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now presencia-backend

curl -s http://127.0.0.1:8000/health            # {"status":"ok",...,"timezone":"America/La_Paz"}
sudo ss -ltnp | grep -E ':8000|:5432'          # 0.0.0.0:8000 y 127.0.0.1:5432
```

## 7. Frontend

**[PC]** `ssh -i $KEY ubuntu@$FE`

**[FE]** Sistema, Nginx y 2 GiB de swap como margen para `next build`:

```bash
sudo timedatectl set-timezone America/La_Paz
sudo apt-get update
sudo NEEDRESTART_MODE=a DEBIAN_FRONTEND=noninteractive apt-get -y upgrade
sudo apt-get install -y nginx
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**[FE]** Node.js 24 (binario oficial, SHA-256 verificado) y pnpm 12.11.2, la versión de la CI:

```bash
cd /tmp
curl -fsSLO https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt
NODE_TAR=$(grep -oE 'node-v24\.[0-9]+\.[0-9]+-linux-x64\.tar\.xz' SHASUMS256.txt | head -1)
curl -fsSLO "https://nodejs.org/dist/latest-v24.x/$NODE_TAR"
grep " $NODE_TAR\$" SHASUMS256.txt | sha256sum -c -
sudo tar -xJf "$NODE_TAR" -C /usr/local --strip-components=1 --no-same-owner
sudo npm install -g pnpm@12.11.2
node --version && pnpm --version
```

**[FE]** Código y build **en la propia EC2**. El build `standalone` incluye binarios nativos de la
plataforma, así que no sirve compilar en Windows y copiar:

```bash
sudo useradd --system --create-home --home-dir /opt/presencia --shell /usr/sbin/nologin presencia
sudo chmod 755 /opt/presencia    # Ubuntu crea el home con 750; los secretos van aparte (640)
sudo tar -xzf /tmp/presencia-frontend.tar.gz -C /opt/presencia --no-same-owner
sudo chown -R presencia:presencia /opt/presencia

cd /opt/presencia/frontend
sudo -u presencia -H pnpm install --frozen-lockfile
sudo -u presencia -H env NEXT_TELEMETRY_DISABLED=1 pnpm build
sudo -u presencia cp -r .next/static .next/standalone/.next/static
sudo -u presencia cp -r public .next/standalone/public
```

**[FE]** Configuración y servicio. `API_URL` es la salida `api_url_interna`:

```bash
sudo install -d -m 750 -o root -g presencia /etc/presencia
echo "API_URL=http://10.20.1.20:8000" | sudo tee /etc/presencia/frontend.env
sudo chgrp presencia /etc/presencia/frontend.env && sudo chmod 640 /etc/presencia/frontend.env

sudo cp /opt/presencia/deploy/aws-ec2/frontend/presencia-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now presencia-frontend

curl -s http://10.20.1.20:8000/health            # prueba la regla frontend → backend
curl -sI http://127.0.0.1:3000/login | head -1   # HTTP/1.1 200 OK
```

**[FE]** Nginx:

```bash
DOMINIO=diplo.asistencia.ficct.com               # sin dominio: DOMINIO=_
sed "s/__SERVER_NAME__/${DOMINIO}/" /opt/presencia/deploy/aws-ec2/frontend/nginx-presencia.conf \
  | sudo tee /etc/nginx/sites-available/presencia >/dev/null
sudo ln -sf /etc/nginx/sites-available/presencia /etc/nginx/sites-enabled/presencia
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

**[FE]** HTTPS con Let's Encrypt (solo con dominio y con el DNS del paso 4 ya resolviendo):

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d diplo.asistencia.ficct.com --redirect \
  --agree-tos --register-unsafely-without-email --non-interactive
sudo certbot renew --dry-run                     # la renovación automática la hace certbot.timer
```

Sin correo porque Let's Encrypt ya no envía avisos de vencimiento: la renovación es automática.
Si lo prefieres, usa `-m tu-correo` en vez de `--register-unsafely-without-email`.

La cookie de sesión pasa a `Secure` sola: Nginx envía `X-Forwarded-Proto: https`
(`frontend/src/app/api/auth/login/route.ts:39`). No hace falta `COOKIE_SECURE`.

**Sin dominio**: la app queda en `http://<IP elástica>`. El JWT viaja sin cifrar, así que úsala
**solo con datos y contraseñas sintéticos**.

## 8. Pruebas

**[PC]** Red:

```powershell
curl.exe -sI https://diplo.asistencia.ficct.com/login | Select-Object -First 1   # 200
curl.exe -sI http://diplo.asistencia.ficct.com/       | Select-Object -First 1   # 301 → https
(Test-NetConnection $BE -Port 8000 -WarningAction SilentlyContinue).TcpTestSucceeded  # False
(Test-NetConnection $BE -Port 5432 -WarningAction SilentlyContinue).TcpTestSucceeded  # False
```

Navegador. La contraseña de todas las cuentas es `DEFAULT_PASSWORD` (paso 6):

1. **Administrador** `218166141`: el panel muestra indicadores y gráfico (datos de demo).
2. **Sesiones → Control de asistencia** de una sesión pasada: cambia un estado y agrega una nota;
   recarga y comprueba que se guardó. Una sesión futura debe ser de solo lectura.
3. **Importaciones**: descarga el modelo de estudiantes, agrega un estudiante ficticio, súbelo
   y revisa el resultado fila por fila.
4. Exporta el Excel desde el panel.
5. **Estudiante** `219034521` (inscrito en dos programas): en *Hoy* registra la asistencia (la
   demo siempre crea una sesión hoy), anúlala y vuelve a registrarla; revisa *Historial*.
6. Como administrador, verifica que ese registro aparece en el control de la sesión de hoy.
7. **Persistencia**: `sudo reboot` en ambas EC2. Pasado un minuto, todo vuelve solo (servicios
   `enabled`) y los datos siguen ahí. Para contarlos en **[BE]**:

   ```bash
   sudo -u postgres psql -d asistencia -c "select count(*) from attendance_records;"
   ```

## 9. Operación y diagnóstico

| Síntoma | Causa probable | Revisar |
|---|---|---|
| `502 Bad Gateway` | Next.js caído | **[FE]** `journalctl -u presencia-frontend -n 50` |
| Login: "El servidor de la API no está disponible" | Backend caído, `API_URL` mal o regla 8000 | **[FE]** `curl http://10.20.1.20:8000/health`; **[BE]** `journalctl -u presencia-backend -n 50` |
| Login correcto pero vuelve a `/login` | Cookie `Secure` sobre HTTP | Entra por `https://` del dominio |
| `certbot` falla | DNS sin propagar, nube naranja, puerto 80 cerrado o CAA | `Resolve-DnsName`, paso 4 |
| `pnpm build` termina con `Killed` | Sin memoria | `swapon --show` |
| `uv sync` o `apt` no descargan | Salida bloqueada o DNS | `curl -I https://pypi.org` |
| `alembic`: conexión rechazada o contraseña | PostgreSQL o `DATABASE_URL` | `systemctl status postgresql@18-main` |
| SSH sin respuesta | Cambió tu IP pública | `infra.ps1 -Accion Aplicar` actualiza la regla con tu IP actual |
| IP del backend distinta tras detener/arrancar | IP pública no elástica | `infra.ps1 -Accion Aplicar` (sin cambios) refresca las salidas |

Logs: `journalctl -u presencia-backend -f`, `journalctl -u presencia-frontend -f`,
`/var/log/nginx/error.log`, `journalctl -u postgresql@18-main`.

**Actualizar la app** tras un nuevo commit: repite el paso 5 y luego:

- **[BE]** `tar` igual que arriba, `chown`, `uv sync --frozen --no-dev`, `alembic upgrade head` y
  `sudo systemctl restart presencia-backend`. El `.env` se conserva.
- **[FE]** `tar`, `chown`, `pnpm install`, `pnpm build`, las dos copias de `cp -r` y
  `sudo systemctl restart presencia-frontend`.

## 10. Respaldo y restauración

Los datos viven en el disco de la EC2 backend: **se pierden al destruirla**.

**[BE]**

```bash
umask 077; sudo -u postgres pg_dump -Fc -d asistencia > ~/asistencia-$(date +%F_%H%M).dump
```

**[PC]**

```powershell
New-Item -ItemType Directory -Force "$HOME\presencia-respaldos" | Out-Null
scp -i $KEY "ubuntu@${BE}:~/asistencia-*.dump" "$HOME\presencia-respaldos\"
```

Para restaurar en un backend nuevo, primero completa el paso 6 hasta crear la base. Luego copia
el `.dump` y ejecuta en **[BE]**:

```bash
sudo systemctl stop presencia-backend
sudo -u postgres pg_restore --clean --if-exists --no-owner --role=asistencia -d asistencia < ~/ARCHIVO.dump
sudo systemctl start presencia-backend
```

## 11. Destrucción

1. Respalda la base (paso 10).
2. **[PC]** `.\infra\opentofu\infra.ps1 -Accion Destruir`, escribe `DESTRUIR`. Al terminar, el
   script lista lo que quede (`Restantes`): todas las tablas deben salir vacías.
3. **[DNS]** Borra el registro `A`. Si no, apuntará a una IP que AWS puede asignar a otra cuenta.
4. Si ya no se usará, desactiva la access key del usuario IAM.

**Detener las instancias no las vuelve gratuitas**: los discos y la IP elástica se siguen
cobrando. Solo `Destruir` lo elimina todo.

## 12. Estado de OpenTofu y trabajo en equipo

- El estado es **local**: `infra/opentofu/terraform.tfstate`. Contiene IDs, IP y la clave
  pública, no contraseñas. No se sube a Git (`.gitignore`) ni se borra mientras haya recursos:
  sin él, OpenTofu deja de administrarlos y hay que eliminarlos a mano (`-Accion Restantes`
  para encontrarlos).
- **Una sola persona** opera cada entorno. Nunca apliquen estados locales distintos sobre los
  mismos recursos. Para pasar la operación, entreguen `terraform.tfstate` por un canal privado.
- Para un entorno propio, cada persona usa **su cuenta** y no cambia nada. Si es en la misma
  cuenta, usa otro prefijo: `TF_VAR_name_prefix=presencia-ana` en `.env`.

## 13. Costos (us-east-1, consultados el 2026-10-16)

| Recurso | Precio | 24/7 (730 h) |
|---|---|---|
| EC2 `t3.small` (frontend) | 0,0208 USD/h | 15,18 USD |
| EC2 `t3.micro` (backend) | 0,0104 USD/h | 7,59 USD |
| IPv4 pública: elástica + backend | 0,005 USD/h cada una | 7,30 USD |
| EBS gp3, 22 GiB | ~0,08 USD/GB-mes | ~1,76 USD |
| **Total aproximado** | | **~31,80 USD/mes** |

- Ambos tipos de instancia figuran como elegibles para la capa gratuita en la cuenta que se probó.
  Para verificarlo en la tuya:
  `aws ec2 describe-instance-types --filters Name=free-tier-eligible,Values=true`.
- En el **plan Free** (cuentas desde el 15/07/2025) el consumo se descuenta de los créditos
  (100 USD + hasta 100 USD). La cuenta se cierra al agotarlos o a los 6 meses.
- En el **plan de pago** se cobra lo que exceda los créditos.
- La IP elástica se cobra también con la instancia detenida.
- Con `cpu_credits = "unlimited"`, un uso sostenido por encima de la línea base puede generar un
  cargo extra pequeño. `standard` lo evita, pero hace muy lenta la instalación inicial: las T3 no
  reciben créditos de arranque.
- Tráfico saliente: insignificante para este laboratorio.

Fuentes:
[precios EC2](https://aws.amazon.com/ec2/pricing/on-demand/) (datos publicados el 2026-10-15),
[IPv4 pública](https://aws.amazon.com/vpc/pricing/),
[EBS](https://aws.amazon.com/ebs/pricing/),
[planes Free Tier](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html),
[créditos T3](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/burstable-performance-instances-standard-mode-concepts.html).

## 14. Limitaciones

- Una zona de disponibilidad, sin alta disponibilidad ni respaldos automáticos.
- PostgreSQL en el disco del backend: destruir la instancia borra los datos.
- El acceso SSH sigue tu IP: si cambia, hay que volver a `Aplicar`.
- Estado local: no apto para que varias personas apliquen a la vez.
