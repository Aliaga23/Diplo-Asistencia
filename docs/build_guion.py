"""Genera docs/Guion-Presentacion-Plataforma.pdf: guion del video, dividido por integrante.

Uso (desde la raíz del repositorio):
    uv run --project backend --with pyyaml --with pygments python docs/build_guion.py

Cada parte tiene: requisitos que cubre, qué mostrar en pantalla, comandos, capturas de la plataforma,
fragmentos del código (generados como imagen desde los archivos reales, con su número de línea),
cómo funciona por detrás y un monólogo de hasta 2 minutos.
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

from pygments import highlight
from pygments.formatters import ImageFormatter
from pygments.lexers import get_lexer_by_name
from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    CondPageBreak,
    Frame,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_pdf_plataforma as base  # noqa: E402

ROOT = base.ROOT
SHOTS = base.SHOTS
DIAGRAMAS = base.DIAGRAMAS
SALIDAS = ROOT / "docs" / "guion" / "salidas"
SALIDA = ROOT / "docs" / "Guion-Presentacion-Plataforma.pdf"
URL = "http://3.235.12.162"
p, mono, vinetas, tabla, figura, S, F, ANCHO = (
    base.p,
    base.mono,
    base.vinetas,
    base.tabla,
    base.figura,
    base.S,
    base.F,
    base.ANCHO,
)
TMP = Path(tempfile.mkdtemp(prefix="guion-"))
S["note"] = ParagraphStyle(
    "note", fontName=F["italic"], fontSize=10, leading=14, alignment=TA_JUSTIFY, spaceAfter=4
)
LEXERS = {
    ".py": "python",
    ".tf": "terraform",
    ".hcl": "terraform",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".tftpl": "yaml",
    ".sh": "bash",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".txt": "text",
}
contador_codigo = {"n": 0}


def recortar(ruta: Path, desde: str, hasta: str | None = None, lineas: int | None = None) -> tuple[int, str]:
    texto = ruta.read_text(encoding="utf-8").splitlines()
    inicio = next(i for i, linea in enumerate(texto) if desde in linea)
    if lineas is not None:
        fin = inicio + lineas
    elif hasta is not None:
        fin = next(i for i in range(inicio + 1, len(texto)) if hasta in texto[i]) + 1
    else:
        fin = len(texto)
    return inicio + 1, "\n".join(texto[inicio:fin])


def codigo(
    archivo: str,
    explicacion: str,
    desde: str | None = None,
    hasta: str | None = None,
    lineas: int | None = None,
    ancho: float = 1.0,
) -> KeepTogether:
    """Imagen del fragmento real del archivo, con números de línea, y su explicación."""
    ruta = ROOT / archivo
    if desde is None:
        inicio, texto = 1, ruta.read_text(encoding="utf-8").rstrip("\n")
    else:
        inicio, texto = recortar(ruta, desde, hasta, lineas)
    contador_codigo["n"] += 1
    imagen = TMP / f"codigo-{contador_codigo['n']}.png"
    lexer = get_lexer_by_name(LEXERS.get(ruta.suffix, "text"))
    imagen.write_bytes(
        highlight(
            texto,
            lexer,
            ImageFormatter(
                style="bw",
                font_name="Consolas",
                font_size=26,
                line_numbers=True,
                line_number_start=inicio,
                line_number_bg="#efefef",
                line_number_fg="#555555",
                line_number_bold=False,
                line_number_chars=4,
                line_number_pad=10,
                image_pad=14,
                line_pad=5,
            ),
        )
    )
    return figura(imagen, f"{archivo}, líneas {inicio} a {inicio + texto.count(chr(10))}. {explicacion}", ancho, 13 * cm)


def salida(nombre: str, explicacion: str, primeras: int | None = None, ultimas: int = 0) -> KeepTogether:
    """Imagen de una salida real (log de la plataforma o resultado de un comando)."""
    lineas = (SALIDAS / f"{nombre}.txt").read_text(encoding="utf-8").splitlines()
    if primeras and len(lineas) > primeras + ultimas:
        lineas = lineas[:primeras] + (["…"] + lineas[-ultimas:] if ultimas else [])
    lineas = [linea.replace("✓", "OK").replace("✗", "NO") for linea in lineas]
    contador_codigo["n"] += 1
    imagen = TMP / f"salida-{contador_codigo['n']}.png"
    imagen.write_bytes(
        highlight(
            "\n".join(lineas),
            get_lexer_by_name("text"),
            ImageFormatter(
                style="bw",
                font_name="Consolas",
                font_size=24,
                line_numbers=False,
                image_pad=16,
                line_pad=4,
            ),
        )
    )
    return figura(imagen, explicacion, 1.0, 13 * cm)


def monologo(texto: str) -> list:
    """El monólogo va en un recuadro con borde, separado del resto de la guía."""
    parrafos = [Paragraph(t.strip(), S["body"]) for t in texto.strip().split("\n\n")]
    caja = Table([[parrafos]], colWidths=[ANCHO])
    caja.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.8, colors.black),
                ("LINEBEFORE", (0, 0), (0, -1), 3, colors.black),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    palabras = len(texto.split())
    minutos = f"{palabras / 140:.1f}".replace(".", ",")
    return [
        KeepTogether(
            [
                p("Monólogo", "h2"),
                p(
                    f"Lectura de aproximadamente {minutos} minutos ({palabras} palabras a un ritmo de "
                    "presentación de unas 140 palabras por minuto).",
                    "note",
                ),
                Spacer(1, 0.2 * cm),
                caja,
            ]
        )
    ]


def comandos(filas: list[list[str]]) -> KeepTogether:
    def seguro(texto: str) -> str:
        return texto.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    return tabla("Comandos", [["Para qué", "Comando"]] + [[a, mono(seguro(b))] for a, b in filas], [0.34, 0.66])


def pasos(items: list[str]) -> list:
    return [p("Qué mostrar en pantalla", "h2"), vinetas(items, numerada=True)]


class Guion(base.Documento):
    def __init__(self, ruta: str):
        super().__init__(ruta)
        self.title = "Guion de la presentación — Plataforma de tenants «Presencia Cloud»"
        marco = Frame(base.MARGEN, base.MARGEN, ANCHO, base.PAGE_H - 2 * base.MARGEN, id="marco")
        self.pageTemplates = []
        self.addPageTemplates(
            [
                PageTemplate(id="portada", frames=[marco]),
                PageTemplate(id="contenido", frames=[marco], onPage=self.encabezado_guion),
            ]
        )

    def afterFlowable(self, flowable) -> None:
        if isinstance(flowable, Paragraph) and flowable.style.name == "h1":
            clave = f"s{id(flowable)}"
            self.canv.bookmarkPage(clave)
            self.notify("TOCEntry", (0, flowable.getPlainText(), self.page, clave))

    @staticmethod
    def encabezado_guion(canvas, doc) -> None:
        canvas.saveState()
        canvas.setFont(F["regular"], 9)
        canvas.drawString(base.MARGEN, base.PAGE_H - 1.5 * cm, "Plataforma de tenants «Presencia Cloud»")
        canvas.drawRightString(base.PAGE_W - base.MARGEN, base.PAGE_H - 1.5 * cm, "Guion de la presentación")
        canvas.setLineWidth(0.5)
        canvas.line(base.MARGEN, base.PAGE_H - 1.65 * cm, base.PAGE_W - base.MARGEN, base.PAGE_H - 1.65 * cm)
        canvas.line(base.MARGEN, 1.75 * cm, base.PAGE_W - base.MARGEN, 1.75 * cm)
        canvas.drawString(base.MARGEN, 1.3 * cm, "Grupo GPT-6 AURA · Diplomado DevOps")
        canvas.drawRightString(base.PAGE_W - base.MARGEN, 1.3 * cm, f"Página {doc.page}")
        canvas.restoreState()


# --------------------------------------------------------------------------- contenido


def portada() -> list:
    from datetime import date

    hoy = date.today()
    meses = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
        "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ]
    indice = TableOfContents()
    indice.levelStyles = [S["toc1"], S["toc2"]]
    return [
        Spacer(1, 4 * cm),
        p("GUION DE LA PRESENTACIÓN", "portada_titulo"),
        Spacer(1, 0.8 * cm),
        p("PLATAFORMA DE TENANTS «PRESENCIA CLOUD»", "portada_titulo"),
        Spacer(1, 0.6 * cm),
        p("Demostración funcional y explicación del diseño, dividida por integrante", "portada"),
        Spacer(1, 3 * cm),
        p("Proyecto final del módulo de DevOps e infraestructura como código", "portada"),
        Spacer(1, 2.2 * cm),
        p("<b>Elaborado por:</b> Grupo GPT-6 AURA", "portada"),
        Spacer(1, 0.3 * cm),
        p(f"<b>Fecha:</b> {hoy.day} de {meses[hoy.month - 1]} de {hoy.year}", "portada"),
        NextPageTemplate("contenido"),
        PageBreak(),
        p("ÍNDICE", "indice"),
        indice,
        PageBreak(),
    ]


def introduccion() -> list:
    return [
        p("1. ORGANIZACIÓN DEL VIDEO", "h1"),
        p(
            "El docente pidió un video de no más de 15 minutos en el que cada integrante explique la parte que "
            "construyó, mostrando que funciona. Este guion divide la presentación en seis partes de hasta dos "
            "minutos, más una apertura y un cierre breves. Cada parte indica qué requisitos cubre, qué mostrar en "
            "pantalla, los comandos, las capturas y fragmentos de código de apoyo, cómo funciona por detrás y el "
            "monólogo sugerido."
        ),
        tabla(
            "Orden y tiempos",
            [
                ["Parte", "Integrante y tema", "Requisitos que demuestra", "Tiempo"],
                ["Apertura", "Integrante 1", "Qué es la plataforma y su arquitectura", "0:30"],
                ["2", "Integrante 1 · Plataforma", "RF-01 a RF-03, RF-07, RF-11, RF-14, CU-01, CU-03, CU-04", "2:00"],
                ["3", "Integrante 2 · Terraform", "RF-08, RF-09, RF-13; Terraform como motor principal", "2:00"],
                ["4", "Integrante 3 · Pulumi y ciclo de vida", "RF-08, RF-12, RF-16 a RF-18; CU-05 a CU-07", "2:00"],
                ["5", "Integrante 4 · Packer, cloud-init y Ansible", "RF-10; Packer, cloud-init y Ansible", "2:00"],
                ["6", "Integrante 5 · Grafana", "RF-25 a RF-29; CU-08, CU-09", "2:00"],
                ["7", "Integrante 6 · Seguridad y documentación", "Requisitos no funcionales, CU-14, entregables", "2:00"],
                ["Cierre", "Integrante 6", "Resumen y costos", "0:30"],
            ],
            [0.13, 0.32, 0.43, 0.12],
        ),
        p("1.1. Preparación antes de grabar", "h2"),
        vinetas(
            [
                f"Plataforma en AWS encendida: consola en {mono(URL)} (usuario admin, contraseña admin1234!).",
                "Tenants ya creados y activos: <b>upsa</b> (Básico, Terraform) y <b>unifranz</b> (Estándar, Pulumi).",
                f"Grafana abierto en {mono(URL + '/grafana/d/salud-tenants')}.",
                "El repositorio abierto en el editor, para mostrar los archivos que se citan.",
                "Consola de AWS abierta en EC2, para entrar a los servidores con Connect → Session Manager.",
                "Crear un tenant demora entre 4 y 6 minutos: se inicia en la parte 2 y se pausa la grabación "
                "mientras termina, como sugirió el docente.",
            ]
        ),
        p("1.2. Arquitectura que se presenta", "h2"),
        figura(DIAGRAMAS / "plataforma-arquitectura.png", "Arquitectura de la plataforma y de los tenants."),
        PageBreak(),
    ]


def parte_plataforma() -> list:
    return [
        p("2. INTEGRANTE 1 · PLATAFORMA", "h1"),
        p(
            "<b>Cubre:</b> catálogo de planes (RF-01 a RF-03), creación del tenant (RF-07), progreso y errores "
            "comprensibles (RF-11), consulta por nombre, estado, plan y entorno (RF-14) y la ejecución en segundo "
            "plano. Es la parte que une a todas las demás."
        ),
        *pasos(
            [
                f"Abrir {mono(URL)}: la página de inicio con los tres planes, todos a la misma altura, con precio, "
                "recursos e inclusiones.",
                "Ingresar a la consola y mostrar el Panel: tenants activos, costo estimado por día y actividad.",
                "Abrir Nuevo tenant, elegir el plan Básico y el motor Terraform, completar la institución "
                "(por ejemplo «Universidad Privada Domingo Savio», identificador upds) y presionar Crear tenant.",
                "Mostrar el log en vivo de la operación (escaneo, Terraform) y pausar la grabación hasta que termine.",
                "Mostrar Instituciones con los filtros y editar el nombre de una institución.",
                "En el editor, mostrar planes.yaml y la función que toma operaciones de la cola.",
            ]
        ),
        figura(SHOTS / "plataforma-landing.png", "Página de inicio con el catálogo de planes."),
        figura(SHOTS / "plataforma-nuevo.png", "Formulario de un nuevo tenant: plan, institución y despliegue.", alto_max=16 * cm),
        figura(SHOTS / "plataforma-detalle.png", "Detalle de un tenant con su log en vivo y las versiones registradas."),
        p("Cómo se construyó", "h2"),
        tabla(
            "Construcción de la plataforma",
            [
                ["Parte", "Cómo está hecha", "Qué se reutilizó de Presencia"],
                [
                    "Backend",
                    "FastAPI y SQLAlchemy sobre PostgreSQL: tenants, operaciones y su log. Endpoints para planes, "
                    "tenants, ciclo de vida, log, eventos y alertas.",
                    "La misma arquitectura y estilo que el backend de Presencia (FastAPI, Pydantic, JWT).",
                ],
                [
                    "Worker",
                    "Proceso aparte que toma operaciones pendientes con FOR UPDATE SKIP LOCKED y las ejecuta en "
                    "hilos: dos tenants pueden crearse a la vez, pero nunca dos operaciones del mismo tenant.",
                    "—",
                ],
                [
                    "Frontend",
                    "Next.js con landing pública, login y consola con menú lateral; consulta el log cada 2 segundos.",
                    "Componentes shadcn/ui, modal propio, KPI, encabezado, tema claro/oscuro y el proxy BFF con "
                    "cookie httpOnly, copiados de Presencia.",
                ],
                [
                    "Catálogo",
                    "plataforma/planes.yaml: un único archivo que leen la API, la consola, Terraform y Pulumi.",
                    "—",
                ],
                ["Despliegue", "Docker Compose: backend, worker, frontend, base, Prometheus y Grafana.", "—"],
            ],
            [0.15, 0.5, 0.35],
        ),
        codigo("plataforma/planes.yaml", "Un plan del catálogo: lo que ve el usuario es lo que se aprovisiona.", "basico:", lineas=15, ancho=0.75),
        codigo(
            "plataforma/backend/plataforma/worker.py",
            "El worker toma la próxima operación pendiente sin bloquear a otros hilos.",
            "def tomar_operacion",
            "return op.id",
        ),
        codigo(
            "plataforma/backend/plataforma/main.py",
            "Crear un tenant solo registra la operación: el trabajo pesado lo hace el worker en segundo plano.",
            '@app.post("/tenants", response_model',
            "return con_ultima(db, tenant)",
        ),
        p("Cómo funciona por detrás", "h2"),
        p(
            "La consola nunca habla directo con la API: pasa por el proxy de Next.js, que agrega el token guardado "
            "en una cookie httpOnly. Al crear un tenant, la API valida los datos, guarda el tenant como «creando» y "
            "encola una operación. El worker la toma, va guardando cada línea de salida en la base y la consola "
            "las muestra cada 2 segundos. Los errores de AWS, Terraform o Pulumi se traducen a mensajes en "
            "español; el detalle técnico sigue en el log."
        ),
        *monologo(
            """
            Yo me encargué de la plataforma, que es la pieza que une todo. Esta es la página de inicio: muestra
            el catálogo con los tres planes, Básico, Estándar y Avanzado, con sus recursos y su costo por día. Ese
            catálogo vive en un solo archivo, planes.yaml, que leen la consola, la API, Terraform y Pulumi; así lo
            que ofrecemos es exactamente lo que se aprovisiona.

            Entro a la consola. El panel resume los tenants activos, los suspendidos y el costo estimado. Ahora
            creo un tenant: escribo el nombre de la institución, el identificador se sugiere solo, elijo el plan
            Básico y el motor Terraform, y presiono Crear tenant.

            La creación no bloquea la pantalla: la API solo registra la operación en una cola en PostgreSQL. Un
            proceso aparte, el worker, la toma con FOR UPDATE SKIP LOCKED, que permite crear varios tenants a la
            vez sin que dos procesos tomen la misma tarea. Cada línea que imprimen las herramientas se guarda en
            la base, y la consola la muestra casi en tiempo real. Si algo falla, el error se traduce a un mensaje
            entendible.

            El backend está hecho con FastAPI y el frontend con Next.js, reutilizando los mismos componentes y el
            mismo proxy con cookie segura que ya teníamos en Presencia. En la lista de instituciones puedo buscar
            por nombre y filtrar por estado, plan y entorno.

            Todo corre con Docker Compose en una instancia EC2 de AWS. Mientras se crea este tenant, mi compañero
            explica cómo Terraform levanta su infraestructura.
            """
        ),
        PageBreak(),
    ]


def parte_terraform() -> list:
    return [
        p("3. INTEGRANTE 2 · TERRAFORM", "h1"),
        p(
            "<b>Cubre:</b> Terraform como motor principal (sección 4 de los requisitos), crear los recursos de "
            "frontend, backend y base de datos (RF-09) y el registro de versiones de cada despliegue (RF-13)."
        ),
        *pasos(
            [
                "En el log del tenant que se está creando, mostrar el escaneo y luego «Plan: 24 to add» y "
                "«Apply complete».",
                "En el editor, abrir infraestructure/tenant/terraform/main.tf: el catálogo leído con yamldecode y "
                "los recursos que dependen del plan.",
                "Mostrar versions.tf: el estado se guarda en S3, una clave por tenant.",
                "Mostrar en la consola de AWS (VPC y EC2) los recursos con la etiqueta Tenant.",
                "Mostrar en la pantalla del tenant el bloque «Versiones usadas en este despliegue».",
            ]
        ),
        salida("terraform", "Salida real de Terraform al crear el tenant upsa (plan Básico)."),
        codigo(
            "infraestructure/tenant/terraform/main.tf",
            "El plan elegido sale del catálogo; según su base de datos se crean distintos recursos.",
            "locals {",
            lineas=15,
        ),
        codigo(
            "infraestructure/tenant/terraform/main.tf",
            "El servidor de la app reutiliza el módulo ec2 del proyecto y recibe la plantilla de cloud-init.",
            'module "app" {',
            "depends_on",
        ),
        codigo("infraestructure/tenant/terraform/versions.tf", "El estado vive en S3 con bloqueo nativo.", 'backend "s3"', lineas=6, ancho=0.7),
        codigo(
            "plataforma/backend/plataforma/motores.py",
            "Cómo el worker ejecuta Terraform: init con la clave del tenant, apply y lectura de salidas.",
            "    def _preparar(self) -> Path:",
            'return {clave: valor["value"]',
        ),
        tabla(
            "Recursos que crea Terraform según el plan",
            [
                ["Plan", "Recursos principales"],
                ["Básico", "VPC, subred, grupos de seguridad, 1 EC2 con PostgreSQL local, IP elástica, rol IAM y secretos (24 recursos)."],
                ["Estándar", "Lo anterior más una EC2 de base de datos y su grupo de seguridad."],
                ["Avanzado", "VPC con dos subredes privadas, grupo de subredes y una instancia Amazon RDS (30 recursos)."],
            ],
            [0.18, 0.82],
        ),
        comandos(
            [
                ["Ver el estado de cada tenant en S3", "aws s3 ls s3://presencia-tfstate-aliaga23/tenants/"],
                ["Validar el módulo del tenant", "terraform -chdir=infraestructure/tenant/terraform validate"],
                ["Desplegar la plataforma", "terraform -chdir=infraestructure/environments/plataforma apply"],
            ]
        ),
        p("Cómo funciona por detrás", "h2"),
        p(
            "El worker escribe las variables del tenant en un archivo JSON, ejecuta terraform init indicando la "
            "clave de estado tenants/&lt;id&gt;/terraform.tfstate y luego apply. Como el estado registra lo que ya "
            "existe, repetir un apply nunca duplica recursos. Las salidas (URL, IP de cada servidor, instancias) "
            "se guardan en el tenant y las versiones usadas quedan en la operación."
        ),
        *monologo(
            """
            Yo trabajé con Terraform, que es nuestro motor principal. Mientras se crea el tenant, en el log se ve
            cómo Terraform calcula el plan: para un plan Básico son 24 recursos. Primero la red propia del tenant,
            con su VPC, subred y tabla de rutas; después los grupos de seguridad, el rol IAM, los secretos en SSM
            Parameter Store, el servidor y su IP elástica.

            El código está en infraestructure/tenant/terraform. Lo primero que hace es leer el catálogo con
            yamldecode, el mismo planes.yaml que usa la plataforma, así el tamaño de la máquina y el tipo de base
            salen del plan elegido. Con count y for_each decido qué crear: en el Básico, PostgreSQL va en el mismo
            servidor; en el Estándar se agrega un servidor de base de datos; y en el Avanzado se crea una base
            Amazon RDS con respaldo diario.

            No empezamos de cero: reutilizamos los módulos de red y de EC2 que ya teníamos de los prácticos, con
            IMDSv2 obligatorio y discos cifrados.

            El estado se guarda en un bucket S3, con una clave por tenant y bloqueo nativo. Eso permite tener
            muchos tenants sin que se mezclen, y que una operación se pueda repetir sin duplicar nada, porque
            Terraform compara contra el estado guardado.

            Al terminar, la plataforma guarda las salidas, como la URL y las IP, y registra las versiones de la
            aplicación, la imagen, Terraform y la huella de las plantillas. Con el mismo Terraform también
            desplegamos la propia plataforma en AWS.
            """
        ),
        PageBreak(),
    ]


def parte_pulumi() -> list:
    return [
        p("4. INTEGRANTE 3 · SEGUNDO MOTOR Y CICLO DE VIDA", "h1"),
        p(
            "<b>Cubre:</b> elegir el motor (RF-08) con Pulumi como segunda implementación, suspender y reanudar "
            "conservando los datos (RF-16, RF-17), eliminar mostrando lo que se borra (RF-18) y reintentar sin "
            "duplicar recursos (RF-12)."
        ),
        *pasos(
            [
                "Abrir el tenant unifranz (Estándar, creado con Pulumi) y mostrar su log de Pulumi.",
                "Mostrar en el editor infraestructure/tenant/pulumi/__main__.py junto al main.tf de Terraform.",
                "Presionar Suspender: el estado pasa a Suspendido y la app deja de responder.",
                "Presionar Reanudar: vuelve en la misma URL con sus datos.",
                "Presionar Eliminar sobre el tenant de prueba: mostrar la lista de recursos y la confirmación.",
                "Mostrar la captura de una operación fallida y su reintento.",
            ]
        ),
        salida("pulumi", "Salida real de Pulumi al crear el tenant unifranz (plan Estándar).", primeras=26),
        codigo(
            "infraestructure/tenant/pulumi/__main__.py",
            "Pulumi en Python crea el mismo servidor que el módulo ec2 de Terraform.",
            "def servidor(",
            'ignore_changes=["ami"]',
        ),
        codigo(
            "plataforma/backend/plataforma/nube.py",
            "Suspender apaga las instancias y, en el plan Avanzado, también la base RDS.",
            "def suspender(",
            "_esperar_rds(rds",
        ),
        codigo(
            "plataforma/backend/plataforma/main.py",
            "Reintentar vuelve a encolar la misma operación que falló.",
            '@app.post("/tenants/{tenant_id}/reintentar"',
            "return encolar(db, tenant, ultima.tipo",
        ),
        figura(SHOTS / "plataforma-eliminar.png", "Antes de eliminar se listan los recursos reales y se pide el identificador."),
        figura(SHOTS / "plataforma-fallo.png", "Operación fallida con su explicación; el reintento creó solo los 6 recursos que faltaban."),
        tabla(
            "Terraform y Pulumi comparados",
            [
                ["Aspecto", "Terraform", "Pulumi"],
                ["Lenguaje", "HCL declarativo", "Python"],
                ["Estado", "S3, tenants/&lt;id&gt;/", "S3, pulumi/, un stack por tenant"],
                ["Secretos en el estado", "Protegidos por el cifrado del bucket", "Cifrados además con frase de paso"],
                ["Resultado", "Mismos recursos, nombres y etiquetas", "Mismos recursos, nombres y etiquetas"],
            ],
            [0.28, 0.36, 0.36],
        ),
        p("Cómo funciona por detrás", "h2"),
        p(
            "Pulumi se ejecuta por línea de comandos con un stack tenant-&lt;id&gt;; su configuración, con la sal "
            "de cifrado, se guarda en el volumen de datos de la plataforma. Suspender y reanudar usan boto3 sobre "
            "las instancias del tenant; la IP elástica mantiene la URL. Eliminar ejecuta destroy en el motor con "
            "que se creó el tenant y borra su estado. Reintentar repite la operación: el motor compara con su "
            "estado y solo crea lo que falta."
        ),
        *monologo(
            """
            Yo hice el segundo motor y el ciclo de vida. El requisito pide poder elegir el motor, y nosotros
            ofrecemos Terraform y Pulumi. Este tenant, la Universidad Franz Tamayo, se creó con Pulumi en un plan
            Estándar: en el log se ve cómo Pulumi crea uno por uno los recursos.

            Aquí está el programa en Python. Si lo comparan con Terraform, crea exactamente los mismos recursos,
            con los mismos nombres y etiquetas, y lee el mismo catálogo. La diferencia es que en Pulumi la
            infraestructura es código Python con funciones y condiciones normales, y cada institución es un stack
            cuyo estado también va a S3, con los secretos cifrados.

            Ahora el ciclo de vida. Si una institución deja de usar el sistema, presiono Suspender: los servidores
            se apagan y dejamos de pagar el cómputo, pero los discos, los datos y la IP elástica se conservan. Al
            presionar Reanudar vuelve a la misma dirección y con todos sus estudiantes.

            Para eliminar, la plataforma consulta en AWS todos los recursos con la etiqueta del tenant y los
            muestra antes de borrar; hay que escribir el identificador para confirmar. Recién ahí ejecuta destroy
            con el motor que corresponda.

            Y si una operación falla, se puede reintentar. En esta prueba provocamos un error a mitad de la
            creación: al corregirlo y reintentar, el motor partió de su estado y creó solo los seis recursos que
            faltaban, sin duplicar la red.
            """
        ),
        PageBreak(),
    ]


def parte_imagen() -> list:
    return [
        p("5. INTEGRANTE 4 · PACKER, CLOUD-INIT Y ANSIBLE", "h1"),
        p(
            "<b>Cubre:</b> desplegar la aplicación y configurar su conexión con la base de datos (RF-10), y las "
            "tres herramientas de la sección 4: Packer para imágenes preconfiguradas, cloud-init para la "
            "configuración inicial y Ansible para la configuración posterior."
        ),
        *pasos(
            [
                "Mostrar presencia.pkr.hcl e imagen.yml: cómo se construye la imagen dorada.",
                "Mostrar la plantilla de cloud-init y el script de arranque.",
                "En el log de unifranz, bajar hasta «Configuración posterior con Ansible» y el PLAY RECAP con failed=0.",
                "Mostrar tenant.yml: firewall, SSH, usuario de operación y verificación.",
                "Abrir la URL del tenant upsa: el login con la marca de la institución.",
                "Entrar como su administrador (registro 100200300, admin1234!) y mostrar el estado de los servicios.",
            ]
        ),
        tabla(
            "Qué hace cada herramienta y cuándo",
            [
                ["Momento", "Herramienta", "Qué hace"],
                ["Una vez, antes de los tenants", "Packer + Ansible", "Construye la AMI con Presencia instalada y compilada (imagen.yml)."],
                ["Primer arranque del servidor", "cloud-init", "Deja los datos del tenant y ejecuta arranque.sh: secretos, base de datos y servicios."],
                ["Después de crear el tenant", "Ansible", "Configura cada servidor desde la plataforma (tenant.yml)."],
            ],
            [0.26, 0.2, 0.54],
        ),
        codigo("infraestructure/packer/presencia.pkr.hcl", "Packer parte de Ubuntu 24.04 y provisiona con Ansible.", 'build {', ancho=0.85),
        codigo("infraestructure/ansible/imagen.yml", "La compilación del frontend se hace una sola vez, en la imagen.", "    - name: Compilar Next.js", lineas=13),
        codigo("infraestructure/tenant/cloud-init/servidor.yaml.tftpl", "cloud-init solo recibe datos no secretos y llama al script.", ancho=0.8),
        codigo(
            "infraestructure/tenant/scripts/arranque.sh",
            "El script arma la conexión a la base con secretos leídos de SSM y aplica migraciones.",
            'install -m 600 -o ubuntu',
            "systemctl enable --now presencia-backend",
        ),
        codigo(
            "infraestructure/ansible/tenant.yml",
            "Ansible deja el firewall con lo mínimo: SSH y métricas solo para la plataforma.",
            "    - name: Firewall - SSH solo desde la plataforma",
            "direction: incoming",
        ),
        salida("ansible", "Salida real de Ansible sobre los dos servidores del tenant unifranz.", primeras=22, ultimas=5),
        figura(SHOTS / "tenant-login.png", "El tenant se presenta con el nombre de su institución."),
        figura(SHOTS / "tenant-panel.png", "El administrador del tenant ve el estado de sus servicios."),
        p("Cómo funciona por detrás", "h2"),
        p(
            "La AMI se construye desde WSL con packer build. Terraform o Pulumi lanzan los servidores desde esa "
            "imagen con la plantilla de cloud-init, que escribe /etc/presencia/tenant.env y ejecuta el script de "
            "arranque. El script obtiene las contraseñas con el rol IAM del servidor, configura PostgreSQL según "
            "el plan, escribe la marca de la institución y enciende los servicios. Cuando la app responde, el "
            "worker arma el inventario con las IP de salida y ejecuta ansible-playbook por SSH con la llave de la "
            "plataforma."
        ),
        comandos(
            [
                ["Construir la imagen dorada (WSL)", "cd infraestructure/packer && packer build -var version_app=$(git describe --always) ."],
                ["Ver el arranque en un servidor", "sudo tail -f /var/log/cloud-init-output.log"],
                ["Probar el playbook a mano", "ansible-playbook --syntax-check -i localhost, tenant.yml"],
            ]
        ),
        *monologo(
            """
            Yo trabajé con Packer, cloud-init y Ansible, que son las tres herramientas que preparan cada servidor,
            y cada una tiene un momento distinto.

            Primero Packer. En vez de instalar todo cada vez que se crea un tenant, Packer levanta una máquina
            temporal y la configura con un playbook de Ansible: instala PostgreSQL, Nginx y Node, copia Presencia y
            compila el frontend. El resultado es una imagen dorada. Gracias a eso un tenant está listo en unos cinco
            minutos.

            Segundo, cloud-init, la configuración inicial. Cuando el servidor arranca por primera vez, cloud-init
            deja los datos del tenant y ejecuta nuestro script de arranque. Ese script lee las contraseñas desde
            SSM Parameter Store con el rol del servidor, así ningún secreto viaja en la plantilla. Luego configura
            la base según el plan, aplica las migraciones, crea el administrador de la institución y enciende la
            aplicación con la marca de esa institución, como se ve en este login.

            Tercero, Ansible para la configuración posterior, que es lo que pide el requisito. Cuando la app ya
            responde, la plataforma ejecuta este playbook por SSH, con su propia llave y el puerto 22 abierto solo
            para su IP. Configura el firewall, endurece SSH, crea un usuario de operación con permisos mínimos,
            activa las actualizaciones de seguridad y verifica que los servicios estén corriendo. En el log se ve
            el resultado: failed igual a cero en los dos servidores.
            """
        ),
        PageBreak(),
    ]


def parte_grafana() -> list:
    return [
        p("6. INTEGRANTE 5 · GRAFANA", "h1"),
        p(
            "<b>Cubre:</b> integrar Grafana (RF-25), disponibilidad, CPU, memoria, latencia, errores del backend "
            "y estado de la base de datos (RF-26), métricas por tenant y por entorno (RF-27), alertas (RF-28) y "
            "alertas y eventos en la plataforma (RF-29)."
        ),
        *pasos(
            [
                f"Abrir {mono(URL + '/grafana/d/salud-tenants')} y explicar los filtros Entorno y Tenant.",
                "Recorrer los paneles: estado de cada servidor, estado de la base de datos, CPU, memoria, disco, "
                "peticiones, errores 5xx y latencia.",
                "Provocar una alerta: en Session Manager del servidor de un tenant ejecutar "
                f"{mono('sudo systemctl stop presencia-backend')} y pausar la grabación unos 3 minutos.",
                "Mostrar la alerta disparada en Grafana y en Alertas y eventos de la plataforma, con el tenant y la hora.",
                f"Restaurar con {mono('sudo systemctl start presencia-backend')}.",
            ]
        ),
        figura(SHOTS / "plataforma-grafana.png", "Tablero «Salud de los tenants».", alto_max=17 * cm),
        codigo("plataforma/monitoreo/prometheus.yml", "Prometheus descubre los servidores de AWS por etiqueta y copia sus etiquetas.", "  - job_name: nodo", lineas=26, ancho=0.8),
        codigo("backend/app/main.py", "Presencia expone sus métricas y si llega a su base de datos.", "BASE_DATOS_ARRIBA = Gauge(", lineas=4),
        codigo("plataforma/monitoreo/grafana/alerting/reglas.yml", "Una regla de alerta provisionada como código.", "  - uid: tenant-caido", lineas=30, ancho=0.85),
        figura(SHOTS / "plataforma-eventos.png", "Alertas y eventos recientes en la plataforma."),
        tabla(
            "Alertas configuradas",
            [
                ["Alerta", "Condición"],
                ["Tenant caído", "Un servidor no responde durante 2 minutos."],
                ["Base de datos caída", "La API del tenant no llega a su base durante 2 minutos."],
                ["CPU alta", "Más de 85 % durante 5 minutos."],
                ["Memoria alta", "Más de 90 % durante 5 minutos."],
                ["Disco casi lleno", "Más de 85 % durante 5 minutos."],
                ["Errores 5xx", "Más del 5 % de las peticiones durante 5 minutos."],
            ],
            [0.3, 0.7],
        ),
        p("Cómo funciona por detrás", "h2"),
        p(
            "Cada servidor trae node_exporter en la imagen (CPU, memoria y disco) y la API de Presencia expone "
            "/metrics con peticiones, códigos de respuesta, latencia y el estado de la base. Nginx publica esas "
            "métricas en el puerto 9101, abierto solo para la plataforma. Prometheus usa el rol IAM de la "
            "plataforma para listar las instancias encendidas con la etiqueta Proyecto=presencia-plataforma, así "
            "un tenant nuevo aparece solo y uno suspendido desaparece sin generar falsas alarmas. Grafana se "
            "configura completo desde archivos y se sirve bajo /grafana."
        ),
        *monologo(
            """
            Yo integré el monitoreo con Prometheus y Grafana. Aprovisionar no alcanza: hay que saber si cada
            institución está funcionando bien.

            Cada servidor sale de la imagen con node_exporter, que mide CPU, memoria y disco, y la API de
            Presencia publica sus propias métricas: cuántas peticiones recibe, cuántas fallan, cuánto tardan y si
            llega a su base de datos. Prometheus no necesita una lista de servidores: usa el rol de AWS de la
            plataforma para encontrar las instancias encendidas por su etiqueta, y convierte las etiquetas de AWS
            en etiquetas de las métricas. Por eso, cuando se crea un tenant, aparece solo en el tablero.

            Este es el tablero de Grafana. Arriba, el resumen por entorno; abajo, cada servidor con OK o CAÍDO, el
            estado de la base de datos, el uso de recursos, las peticiones, los errores del backend y la latencia.
            Con estos filtros veo un tenant o un entorno en particular.

            Las alertas también están definidas como código. Para probarlas, detengo el backend de un tenant
            desde Session Manager. A los dos minutos se dispara la alerta Tenant caído, con el nombre del tenant y
            la hora, y la misma alerta aparece en la plataforma, en Alertas y eventos, junto al historial de
            operaciones. Vuelvo a encender el servicio y la alerta se resuelve sola.

            Grafana se publica en la misma dirección de la plataforma, bajo la ruta grafana, para que se pueda
            consultar sin instalar nada.
            """
        ),
        PageBreak(),
    ]


def parte_seguridad() -> list:
    return [
        p("7. INTEGRANTE 6 · SEGURIDAD Y DOCUMENTACIÓN", "h1"),
        p(
            "<b>Cubre:</b> los requisitos no funcionales (aislamiento, secretos fuera del código, operaciones "
            "repetibles, estado protegido, errores sin secretos), la verificación de aislamiento (CU-14) y los "
            "entregables de documentación."
        ),
        *pasos(
            [
                "En el log de un tenant, mostrar el escaneo con gitleaks y checkov antes de aprovisionar.",
                "Mostrar en GitHub el workflow «Secretos · gitleaks» en verde.",
                "En la consola de AWS, mostrar los parámetros /presencia/tenants/ en SSM Parameter Store, cifrados.",
                "En Session Manager de la plataforma, ejecutar la prueba de aislamiento y mostrar «20 de 20».",
                "Mostrar el documento técnico, los diagramas y este guion.",
            ]
        ),
        salida("escaneo", "Salida real del escaneo de seguridad antes de crear el tenant upsa."),
        codigo(
            "plataforma/backend/plataforma/escaneo.py",
            "Si gitleaks encuentra un secreto, el aprovisionamiento se detiene con un mensaje claro.",
            "def escanear(",
            'log("Sin secretos',
        ),
        codigo(
            "infraestructure/tenant/terraform/main.tf",
            "Secretos generados por el motor, cifrados en SSM, y un rol que solo lee los de su propio tenant.",
            'resource "aws_ssm_parameter" "secretos"',
            lineas=11,
            ancho=0.9,
        ),
        codigo(".github/workflows/secretos.yml", "gitleaks revisa todo el historial en cada push y pull request.", ancho=0.85),
        salida("aislamiento", "Salida real de la prueba de aislamiento entre upsa y unifranz."),
        tabla(
            "Controles de seguridad",
            [
                ["Riesgo", "Control"],
                ["Un tenant accede a otro", "VPC propia, grupos de seguridad, firewall ufw y clave JWT distinta por tenant."],
                ["Secretos en el repositorio", "Generados por el motor, cifrados en SSM; gitleaks antes de cada despliegue y en CI."],
                ["Credenciales de AWS expuestas", "La plataforma usa un rol IAM, sin claves de acceso."],
                ["Estado del motor comprometido", "Bucket cifrado, versionado, sin acceso público y con bloqueo."],
                ["Errores que filtran datos", "Los motores ocultan valores sensibles y gitleaks enmascara lo que detecta."],
            ],
            [0.32, 0.68],
        ),
        comandos(
            [
                ["Prueba de aislamiento (en la plataforma)", "cd /opt/presencia/plataforma && sudo docker compose exec -e PLATAFORMA_URL=http://localhost:8000 backend python scripts/probar_aislamiento.py upsa unifranz"],
                ["Escanear el historial del repositorio", "gitleaks git . --redact"],
                ["Regenerar la documentación", "uv run --project backend --with pyyaml python docs/build_pdf_plataforma.py"],
            ]
        ),
        p("Cómo funciona por detrás", "h2"),
        p(
            "Antes de cada aprovisionamiento, el worker escanea las plantillas y la configuración del tenant con "
            "gitleaks y revisa el Terraform con checkov. Los secretos nunca se escriben: el motor los genera, los "
            "guarda cifrados en SSM y cada servidor los lee con su rol. La prueba de aislamiento entra a cada tenant "
            "con sus credenciales, intenta usar el token de uno en el otro, prueba los puertos desde afuera y, por "
            "Session Manager, desde el servidor de un tenant hacia los del otro."
        ),
        *monologo(
            """
            Yo me encargué de la seguridad y de la documentación. Lo primero es que ningún secreto esté en el
            código. Antes de aprovisionar, la plataforma escanea las plantillas y la configuración con gitleaks; si
            encuentra una contraseña escrita, se detiene y lo explica. También revisa el Terraform con checkov, que
            marca recomendaciones de buenas prácticas. Y en GitHub, cada push vuelve a revisar todo el historial.

            Las contraseñas de cada tenant las genera el propio motor y se guardan cifradas en SSM Parameter Store.
            Cada servidor tiene un rol IAM que solo puede leer los secretos de su propio tenant. La plataforma
            tampoco tiene claves de AWS: usa el rol de su instancia con los permisos mínimos.

            Para demostrar el aislamiento escribimos una prueba automática. Entra a cada tenant con su
            administrador, intenta usar las credenciales y el token de un tenant en el otro, verifica que la base
            de datos y la API interna no son accesibles desde afuera, y desde el servidor de un tenant intenta
            llegar a los puertos del otro, incluido SSH. El resultado es veinte de veinte: cada institución está
            aislada en su red, con su base y sus propias claves.

            El estado de los motores está en un bucket cifrado, versionado y sin acceso público. Finalmente,
            preparamos el documento técnico con la arquitectura, el catálogo de planes, el manual de uso y las
            pruebas, los diagramas en PlantUML y este guion. En resumen, la plataforma crea, opera y monitorea
            instituciones aisladas, todo definido como código.
            """
        ),
    ]


def main() -> None:
    historia = (
        portada()
        + introduccion()
        + parte_plataforma()
        + parte_terraform()
        + parte_pulumi()
        + parte_imagen()
        + parte_grafana()
        + parte_seguridad()
    )
    Guion(str(SALIDA)).multiBuild(base.sin_titulos_huerfanos(historia))
    print(f"Generado {SALIDA.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
