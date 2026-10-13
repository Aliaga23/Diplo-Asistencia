# Presencia · Sistema de registro de asistencia

Aplicación web para registrar y controlar la asistencia de estudiantes en uno o varios
programas académicos. Desarrollada por el **grupo GPT-6 AURA**.

- **Producción:** https://diplo.jorgearturo.net
- **Documentación técnica (PDF):** [`docs/Documentacion-Presencia.pdf`](docs/Documentacion-Presencia.pdf)

## Funcionalidades

- Dos tipos de usuario: **administrador** y **estudiante**. Todos ingresan con su número de
  registro.
- Importación de **estudiantes** y de **horarios y fechas** desde Excel, con modelo
  descargable y validación fila por fila.
- El administrador ve a todos los estudiantes, cada uno con su propia ficha, y **modifica la
  asistencia** de las sesiones dictadas y del día, con notas. Las sesiones futuras son de solo
  lectura.
- Cada estudiante **registra su asistencia del día** con un toque; solo puede registrar o
  anular la asistencia del día actual (zona horaria America/La_Paz, calculada en el servidor).
- Varios **programas** con sus propios estudiantes, horarios e indicadores.
- Panel con indicadores, gráfico por sesión, estudiantes en riesgo y exportación a Excel.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Phosphor Icons, TanStack Query |
| Backend | FastAPI, Pydantic 2, SQLAlchemy 2, Alembic, PyJWT, Argon2, openpyxl · Python 3.14 |
| Base de datos | PostgreSQL 18 |
| Infraestructura | Docker Compose, GitHub Actions, GHCR, Traefik |

## Diagramas (PlantUML)

Fuentes en [`docs/diagrams`](docs/diagrams); imágenes en `docs/diagrams/png`.

| | |
|---|---|
| ![Modelo entidad-relación](docs/diagrams/png/er.png) | ![Arquitectura](docs/diagrams/png/arquitectura.png) |
| ![Casos de uso](docs/diagrams/png/casos-uso.png) | ![Secuencia de registro](docs/diagrams/png/secuencia-registro.png) |

Para regenerarlos:

```bash
docker run --rm -v "$PWD/docs/diagrams:/data" -w /data plantuml/plantuml \
  -tpng -Sdpi=170 -charset UTF-8 -o png er.puml arquitectura.puml casos-uso.puml \
  secuencia-registro.puml secuencia-importacion.puml
```

## Ejecutar

### Con Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:3001
- API: http://localhost:8000/docs

### Desarrollo local

```bash
docker compose up -d db

cd backend
uv sync
uv run alembic upgrade head
uv run python -m app.seed --demo
uv run uvicorn app.main:app --reload

cd ../frontend
pnpm install
pnpm dev --port 3001
```

### Acceso de demostración

| Rol | Registro | Contraseña |
|---|---|---|
| Administrador | `218166141` | `admin1234!` |
| Estudiante (en dos programas) | `219034521` | `admin1234!` |

Todas las cuentas nuevas usan la contraseña común `admin1234!` (variable `DEFAULT_PASSWORD`).

## Calidad

```bash
cd backend && uv run ruff check . && uv run pytest     # 26 pruebas
cd frontend && pnpm lint && pnpm build
```

## Estructura

```text
backend/    API FastAPI: modelos, servicios (reglas de negocio), routers, migraciones, pruebas
frontend/   Next.js: pantallas, BFF (/api/auth, /api/backend), componentes y proxy por rol
deploy/     Compose de producción y preparación del servidor
docs/       Documentación PDF, diagramas PlantUML, capturas y archivos Excel de ejemplo
.github/    CI, publicación de imágenes y despliegue
```

## Despliegue

Producción en el VPS «arturo» (13.140.40.2), detrás del Traefik compartido, en
`/opt/diplo-asistencia`. Un solo flujo, `.github/workflows/ci-cd.yml`, en cada push a `main`:

1. **Pruebas**: Ruff y pytest del backend; lint y tipos del frontend.
2. **Imágenes**: backend y frontend en `ghcr.io/aliaga23/diplo-asistencia`, etiquetadas con el
   commit.
3. **Despliegue por SSH**: valida el compose, baja las imágenes con un token efímero y levanta
   con `docker compose up --wait` (el backend migra al arrancar). Si un servicio no queda
   sano, el flujo falla y muestra los registros.

Solo el frontend se publica en Traefik; la API y PostgreSQL viven en una red interna sin
salida a internet. Los secretos (`.env`) los genera `deploy/arturo/preparar.sh` en el propio
servidor y nunca pasan por GitHub.
