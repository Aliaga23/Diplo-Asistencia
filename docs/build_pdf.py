"""Genera docs/Documentacion-Presencia.pdf con ReportLab (sin LaTeX ni navegador).

Uso (desde la raíz del repositorio):
    uv run --project backend python docs/build_pdf.py

Formato formal: Arial 12, texto negro, interlineado 1,5 y márgenes de 2,5 cm.
El diccionario de datos y la lista de endpoints se leen del modelo SQLAlchemy y del
esquema OpenAPI de FastAPI, de modo que el documento coincide con el código.
"""

from __future__ import annotations

import os
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
SHOTS = DOCS / "screenshots"
DIAGRAMS = DOCS / "diagrams" / "png"
OUTPUT = DOCS / "Documentacion-Presencia.pdf"

sys.path.insert(0, str(ROOT / "backend"))
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "documentacion-sin-secreto-0123456789abcdef")

from reportlab.lib import colors  # noqa: E402
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY  # noqa: E402
from reportlab.lib.pagesizes import A4, landscape  # noqa: E402
from reportlab.lib.styles import ParagraphStyle  # noqa: E402
from reportlab.lib.units import cm  # noqa: E402
from reportlab.lib.utils import ImageReader  # noqa: E402
from reportlab.pdfbase import pdfmetrics  # noqa: E402
from reportlab.pdfbase.ttfonts import TTFont  # noqa: E402
from reportlab.platypus import (  # noqa: E402
    BaseDocTemplate,
    CondPageBreak,
    Frame,
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents  # noqa: E402
from sqlalchemy import CheckConstraint, UniqueConstraint  # noqa: E402
from sqlalchemy.dialects import postgresql  # noqa: E402

import app.models  # noqa: E402,F401
from app.db.base import Base  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402

# --------------------------------------------------------------------------- formato

BLACK = colors.black
GRID = colors.HexColor("#000000")
HEAD = colors.HexColor("#E6E6E6")
FONT_DIR = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"


def register_fonts() -> dict[str, str]:
    files = {"Arial": "arial.ttf", "Arial-Bold": "arialbd.ttf",
             "Arial-Italic": "ariali.ttf", "Arial-BoldItalic": "arialbi.ttf",
             "Mono": "consola.ttf"}
    try:
        for name, file in files.items():
            pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / file)))
        pdfmetrics.registerFontFamily("Arial", normal="Arial", bold="Arial-Bold",
                                      italic="Arial-Italic", boldItalic="Arial-BoldItalic")
        return {"regular": "Arial", "bold": "Arial-Bold", "italic": "Arial-Italic", "mono": "Mono"}
    except Exception:  # fuera de Windows: Helvetica es métricamente equivalente a Arial
        return {"regular": "Helvetica", "bold": "Helvetica-Bold",
                "italic": "Helvetica-Oblique", "mono": "Courier"}


F = register_fonts()

S = {
    "body": ParagraphStyle("body", fontName=F["regular"], fontSize=12, leading=18,
                           alignment=TA_JUSTIFY, textColor=BLACK, spaceAfter=8),
    "h1": ParagraphStyle("h1", fontName=F["bold"], fontSize=14, leading=20, textColor=BLACK,
                         spaceBefore=6, spaceAfter=12),
    "h2": ParagraphStyle("h2", fontName=F["bold"], fontSize=12, leading=18, textColor=BLACK,
                         spaceBefore=12, spaceAfter=6),
    "h3": ParagraphStyle("h3", fontName=F["bold"], fontSize=11, leading=16, textColor=BLACK,
                         spaceBefore=10, spaceAfter=4),
    "caption": ParagraphStyle("caption", fontName=F["italic"], fontSize=10, leading=14,
                              alignment=TA_CENTER, textColor=BLACK, spaceBefore=4,
                              spaceAfter=14),
    "table_title": ParagraphStyle("table_title", fontName=F["bold"], fontSize=10, leading=14,
                                  textColor=BLACK, spaceBefore=6, spaceAfter=4),
    "cell": ParagraphStyle("cell", fontName=F["regular"], fontSize=10, leading=13,
                           textColor=BLACK),
    "cell_head": ParagraphStyle("cell_head", fontName=F["bold"], fontSize=10, leading=13,
                                textColor=BLACK),
    "cell_mono": ParagraphStyle("cell_mono", fontName=F["mono"], fontSize=9, leading=12,
                                textColor=BLACK),
    "note": ParagraphStyle("note", fontName=F["regular"], fontSize=10, leading=14,
                           textColor=BLACK, alignment=TA_JUSTIFY),
    "cover": ParagraphStyle("cover", fontName=F["regular"], fontSize=12, leading=18,
                            alignment=TA_CENTER, textColor=BLACK),
    "cover_title": ParagraphStyle("cover_title", fontName=F["bold"], fontSize=18, leading=26,
                                  alignment=TA_CENTER, textColor=BLACK),
    "toc1": ParagraphStyle("toc1", fontName=F["bold"], fontSize=12, leading=20),
    "toc2": ParagraphStyle("toc2", fontName=F["regular"], fontSize=12, leading=18,
                           leftIndent=18),
}

PAGE_W, PAGE_H = A4
MARGIN = 2.5 * cm
PW = PAGE_W - 2 * MARGIN
LAND_W, LAND_H = landscape(A4)
LW = LAND_W - 2 * MARGIN


def esc(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def p(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text, S[style])


def code(text: str) -> str:
    return f'<font name="{F["mono"]}" size="10">{esc(text)}</font>'


def bullets(items: list[str]) -> ListFlowable:
    return ListFlowable(
        [ListItem(Paragraph(i, S["body"]), leftIndent=18) for i in items],
        bulletType="bullet", start="•", leftIndent=18, bulletFontName=F["regular"],
        bulletFontSize=12,
    )


class Counter:
    figure = 0
    table = 0


def fig_caption(text: str) -> Paragraph:
    Counter.figure += 1
    return p(f"Figura {Counter.figure}. {text}", "caption")


def tbl_title(text: str) -> Paragraph:
    Counter.table += 1
    return p(f"Tabla {Counter.table}. {text}", "table_title")


def table(rows: list[list], widths: list[float], mono_cols: tuple[int, ...] = ()) -> Table:
    data = []
    for r, row in enumerate(rows):
        cells = []
        for c, value in enumerate(row):
            if r == 0:
                cells.append(Paragraph(esc(str(value)), S["cell_head"]))
            elif c in mono_cols:
                cells.append(Paragraph(esc(str(value)), S["cell_mono"]))
            else:
                cells.append(Paragraph(str(value), S["cell"]))
        data.append(cells)
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, GRID),
        ("BACKGROUND", (0, 0), (-1, 0), HEAD),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def figure(path: Path, caption: str, max_w: float, max_h: float, border: bool = True):
    iw, ih = ImageReader(str(path)).getSize()
    scale = min(max_w / iw, max_h / ih)
    img = Image(str(path), width=iw * scale, height=ih * scale)
    box = Table([[img]], colWidths=[iw * scale])
    box.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5 if border else 0, GRID if border else colors.white),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return KeepTogether([box, fig_caption(caption)])


class Heading(Paragraph):
    """Encabezado numerado que se registra en el índice y en los marcadores del PDF."""

    def __init__(self, text: str, level: int, number: str = ""):
        self.toc_text = f"{number} {text}".strip()
        self.toc_level = level
        shown = esc(text).upper() if level == 0 else esc(text)
        label = f"{number}&nbsp;&nbsp;{shown}" if number else shown
        super().__init__(label, S["h1"] if level == 0 else S["h2"])


# --------------------------------------------------------------------------- páginas

def draw_page(canvas, doc, width=PAGE_W):
    canvas.saveState()
    canvas.setFont(F["regular"], 10)
    canvas.setFillColor(BLACK)
    canvas.drawCentredString(width / 2, 1.5 * cm, str(doc.page))
    canvas.restoreState()


def draw_landscape(canvas, doc):
    draw_page(canvas, doc, LAND_W)


def draw_cover(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(BLACK)
    canvas.setLineWidth(1)
    canvas.rect(1.8 * cm, 1.8 * cm, PAGE_W - 3.6 * cm, PAGE_H - 3.6 * cm)
    canvas.restoreState()


class Doc(BaseDocTemplate):
    def __init__(self, filename: str):
        super().__init__(filename, pagesize=A4, title="Documentación técnica — Presencia",
                         author="Grupo GPT-6 AURA", subject="Sistema de registro de asistencia",
                         creator="ReportLab")
        content = Frame(MARGIN, MARGIN, PW, PAGE_H - 2 * MARGIN, id="content",
                        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        land = Frame(MARGIN, MARGIN, LW, LAND_H - 2 * MARGIN, id="land",
                     leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates([
            PageTemplate(id="cover", frames=[content], onPage=draw_cover),
            PageTemplate(id="content", frames=[content], onPage=draw_page),
            PageTemplate(id="landscape", frames=[land], onPage=draw_landscape,
                         pagesize=landscape(A4)),
        ])
        self._bookmark = 0

    def beforeDocument(self):
        # multiBuild hace varias pasadas: las claves deben repetirse igual en cada una.
        self._bookmark = 0
        Counter.figure = 0
        Counter.table = 0

    def afterFlowable(self, flowable):
        if isinstance(flowable, Heading):
            self._bookmark += 1
            key = f"h{self._bookmark}"
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(flowable.toc_text, key, level=flowable.toc_level,
                                      closed=False)
            self.notify("TOCEntry", (flowable.toc_level, flowable.toc_text, self.page, key))


# --------------------------------------------------------------------------- datos

COLUMN_DOCS: dict[str, dict[str, str]] = {
    "users": {
        "id": "Identificador único (UUID).",
        "registration_code": "Número de registro institucional; identificador de ingreso.",
        "email": "Correo institucional (opcional).",
        "password_hash": "Hash Argon2 de la contraseña.",
        "full_name": "Nombre completo.",
        "role": "Rol: admin o student.",
        "is_active": "Indica si la cuenta está habilitada.",
        "must_change_password": "Obliga a cambiar la contraseña en el próximo ingreso.",
        "created_at": "Fecha de creación.",
        "updated_at": "Fecha de la última modificación.",
    },
    "students": {"id": "Identificador del perfil académico.",
                 "user_id": "Cuenta asociada (relación 1:1).",
                 "career": "Carrera o especialidad."},
    "courses": {"id": "Identificador del programa.", "code": "Código único del programa.",
                "name": "Nombre del programa.", "period": "Gestión o periodo académico."},
    "enrollments": {"id": "Identificador de la inscripción.", "student_id": "Estudiante.",
                    "course_id": "Programa."},
    "class_sessions": {"id": "Identificador de la sesión.", "course_id": "Programa.",
                       "session_date": "Fecha de la clase.", "start_time": "Hora de inicio.",
                       "end_time": "Hora de finalización.", "topic": "Tema de la sesión."},
    "attendance_records": {"id": "Identificador del registro.", "session_id": "Sesión.",
                           "student_id": "Estudiante.",
                           "status": "present, late, absent o excused.",
                           "source": "Origen: self, admin o import.",
                           "marked_at": "Fecha y hora del registro.",
                           "marked_by": "Usuario que registró.",
                           "note": "Observación opcional."},
    "import_batches": {"id": "Identificador del lote.", "kind": "students o sessions.",
                       "filename": "Nombre del archivo.", "course_id": "Programa destino.",
                       "uploaded_by": "Administrador que importó.",
                       "rows_total": "Filas leídas.", "rows_ok": "Filas correctas.",
                       "rows_failed": "Filas rechazadas.",
                       "errors": "Detalle de errores por fila (JSON)."},
}

TABLE_DOCS = {
    "users": "Cuentas de acceso: credenciales y rol.",
    "students": "Perfil académico del estudiante (especialización 1:1 de users).",
    "courses": "Programas académicos con control de asistencia propio.",
    "enrollments": "Inscripción de estudiantes en programas (relación N:M).",
    "class_sessions": "Fechas y horarios de clase de cada programa.",
    "attendance_records": "Asistencia de un estudiante en una sesión.",
    "import_batches": "Registro de auditoría de las importaciones desde Excel.",
}

SCREENS = [
    ("01-login.png", "Inicio de sesión",
     "El usuario ingresa con su número de registro y su contraseña. La sesión se mantiene "
     "en una cookie protegida que el navegador no puede leer."),
    ("16-intro-aura.png", "Animación de bienvenida",
     "Tras el ingreso se muestra una animación breve con el texto «App hecha por el grupo» y "
     "«GPT-6 AURA», que finaliza desintegrándose y da paso al panel correspondiente. Puede "
     "omitirse con el botón «Saltar» o con la tecla Escape."),
    ("02-admin-panel.png", "Panel del administrador",
     "Presenta los indicadores del programa activo: asistencia promedio, estudiantes "
     "inscritos, sesiones dictadas y registros del día, junto con la asistencia por sesión y "
     "los estudiantes con asistencia inferior al 80 %."),
    ("03-admin-programas.png", "Programas",
     "Permite crear, editar y seleccionar programas. Cada programa tiene sus propios "
     "estudiantes, horarios e indicadores."),
    ("04-admin-estudiantes.png", "Estudiantes",
     "Lista los estudiantes del programa activo con su asistencia acumulada, con búsqueda y "
     "filtro. Desde aquí se importan estudiantes o se registran manualmente."),
    ("05-admin-ficha-estudiante.png", "Ficha del estudiante",
     "Página propia de cada estudiante, con sus datos, sus indicadores en el programa activo "
     "y su historial. El administrador puede modificar el estado de las sesiones dictadas y "
     "del día, restablecer la contraseña y habilitar o deshabilitar la cuenta."),
    ("06-admin-sesiones.png", "Sesiones",
     "Muestra las sesiones próximas y dictadas del programa, con la distribución de la "
     "asistencia. Permite importar horarios y crear sesiones."),
    ("07-admin-control-asistencia.png", "Control de asistencia por sesión",
     "Lista a los estudiantes de una sesión con la hora de registro, el origen y el estado, "
     "que el administrador puede modificar y complementar con una nota. Si la sesión aún no "
     "se dicta, la lista se muestra en modo de solo lectura."),
    ("09-admin-modal-importar.png", "Importación desde Excel",
     "Proceso en dos pasos: descarga del modelo de archivo y carga del archivo completado. "
     "El resultado se informa fila por fila."),
    ("11-estudiante-hoy.png", "Registro de asistencia del estudiante",
     "Muestra las clases del día con un único botón para registrar la asistencia. El "
     "estudiante solo puede registrar o anular su asistencia durante el día de la clase."),
    ("12-estudiante-historial.png", "Historial del estudiante",
     "Detalle de la asistencia en cada sesión. Las fechas anteriores no pueden ser "
     "modificadas por el estudiante."),
    ("13-movil-estudiante.png", "Vista en dispositivos móviles",
     "La interfaz se adapta a pantallas pequeñas para registrar la asistencia desde el "
     "teléfono."),
]


def dictionary_section() -> list:
    flow: list = []
    for tbl in Base.metadata.sorted_tables:
        uniques = {tuple(c.name for c in con.columns) for con in tbl.constraints
                   if isinstance(con, UniqueConstraint)}
        rows = [["Columna", "Tipo", "Restricciones", "Descripción"]]
        ordered = sorted(tbl.columns, key=lambda c: (not c.primary_key,
                                                    c.name in ('created_at', 'updated_at')))
        for col in ordered:
            flags = []
            if col.primary_key:
                flags.append("PK")
            for fk in col.foreign_keys:
                flags.append(f"FK {fk.column.table.name}")
            if col.unique or (col.name,) in uniques:
                flags.append("UNIQUE")
            flags.append("NULL" if col.nullable and not col.primary_key else "NOT NULL")
            desc = COLUMN_DOCS.get(tbl.name, {}).get(col.name) or \
                COLUMN_DOCS["users"].get(col.name, "")
            rows.append([col.name, col.type.compile(dialect=postgresql.dialect()).lower(),
                         ", ".join(flags), desc])
        extra = [f"UNIQUE ({', '.join(u)})" for u in uniques if len(u) > 1]
        extra += [f"CHECK ({c.sqltext})" for c in tbl.constraints
                  if isinstance(c, CheckConstraint)]
        block = [tbl_title(f"{tbl.name}: {TABLE_DOCS.get(tbl.name, '')}"),
                 table(rows, [3.6 * cm, 3.0 * cm, 3.6 * cm, PW - 10.2 * cm], mono_cols=(0, 1))]
        if extra:
            block.append(p("Restricciones adicionales: " + "; ".join(code(e) for e in extra),
                           "note"))
        block.append(Spacer(1, 10))
        flow.append(KeepTogether(block))
    return flow


def endpoint_rows() -> list[list[str]]:
    rows = [["Método", "Ruta", "Descripción"]]
    for path, ops in fastapi_app.openapi()["paths"].items():
        for method, op in ops.items():
            rows.append([method.upper(), path, op.get("summary", "")])
    return rows


# --------------------------------------------------------------------------- documento

def build() -> None:
    today = date.today()
    meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
             "septiembre", "octubre", "noviembre", "diciembre"]
    fecha = f"{today.day} de {meses[today.month - 1]} de {today.year}"

    story: list = [
        Spacer(1, 4.2 * cm),
        p("DOCUMENTACIÓN TÉCNICA", "cover_title"),
        Spacer(1, 0.8 * cm),
        p("SISTEMA DE REGISTRO DE ASISTENCIA «PRESENCIA»", "cover_title"),
        Spacer(1, 3.2 * cm),
        p("Proyecto práctico del diplomado", "cover"),
        Spacer(1, 2.4 * cm),
        p("<b>Elaborado por:</b> Grupo GPT-6 AURA", "cover"),
        Spacer(1, 0.3 * cm),
        p("<b>Versión:</b> 1.0", "cover"),
        Spacer(1, 0.3 * cm),
        p(f"<b>Fecha:</b> {fecha}", "cover"),
        NextPageTemplate("content"),
        PageBreak(),
    ]

    toc = TableOfContents()
    toc.levelStyles = [S["toc1"], S["toc2"]]
    story += [p("ÍNDICE", "h1"), toc, PageBreak()]

    # 1. Introducción
    story += [
        Heading("Introducción", 0, "1."),
        p("El presente documento describe el sistema web «Presencia», desarrollado para el "
          "registro y control de la asistencia de estudiantes en programas académicos. El "
          "sistema permite a los administradores cargar estudiantes, horarios y fechas desde "
          "archivos Excel, consultar la asistencia de todos los estudiantes y corregirla cuando "
          "corresponda; y permite a cada estudiante registrar su propia asistencia el día de la "
          "clase."),
        p("Se documentan el alcance funcional, el stack tecnológico, la arquitectura y el "
          "funcionamiento general, el diseño de la base de datos y su normalización, las "
          "pantallas del sistema y el proceso de despliegue."),
    ]

    # 2. Objetivos
    story += [
        Heading("Objetivos", 0, "2."),
        Heading("Objetivo general", 1, "2.1"),
        p("Desarrollar una aplicación web funcional para el registro de asistencia que "
          "distinga entre administradores y estudiantes, admita la carga de datos desde Excel "
          "y garantice que cada estudiante solo pueda registrar su asistencia del día."),
        Heading("Objetivos específicos", 1, "2.2"),
        bullets([
            "Diseñar una base de datos relacional normalizada hasta la tercera forma normal.",
            "Implementar una API REST con control de acceso por rol.",
            "Implementar la importación de estudiantes y de horarios desde archivos Excel.",
            "Construir una interfaz web clara y adaptable a dispositivos móviles.",
            "Automatizar las pruebas y el despliegue mediante integración continua.",
        ]),
    ]

    # 3. Alcance y requerimientos
    story += [
        Heading("Alcance y requerimientos", 0, "3."),
        p("La Tabla 1 resume los requerimientos funcionales planteados y la forma en que el "
          "sistema los atiende."),
        tbl_title("Requerimientos funcionales"),
        table([
            ["Código", "Requerimiento", "Implementación"],
            ["RF-01", "Tipos de usuario: administrador y estudiante.",
             "Rol almacenado en la cuenta; la API valida el rol en cada operación."],
            ["RF-02", "Importar estudiantes desde Excel.",
             "Carga de archivo con modelo descargable y validación fila por fila."],
            ["RF-03", "Importar horarios y fechas desde Excel.",
             "Carga de sesiones de clase por programa; las existentes se actualizan."],
            ["RF-04", "El administrador consulta a todos los estudiantes y modifica su "
                      "asistencia.",
             "Pantallas de estudiantes, ficha de cada estudiante y control por sesión, para "
             "las sesiones dictadas y las del día."],
            ["RF-05", "Cada estudiante registra su asistencia.",
             "Registro con un botón; el servidor determina si es presente o tarde."],
            ["RF-06", "El estudiante solo modifica su asistencia del día.",
             "El servidor compara la fecha de la sesión con la fecha actual (America/La_Paz)."],
        ], [2.0 * cm, 6.2 * cm, PW - 8.2 * cm]),
        Spacer(1, 6),
        p("Como requerimientos no funcionales se consideraron la seguridad (contraseñas con "
          "hash Argon2, sesión en cookie protegida y control de acceso en el servidor), la "
          "integridad de los datos mediante restricciones en la base de datos, la "
          "disponibilidad de la aplicación en dispositivos móviles y la posibilidad de "
          "gestionar varios programas académicos."),
    ]

    # 4. Stack
    story += [
        Heading("Stack tecnológico", 0, "4."),
        p("La Tabla 2 detalla las tecnologías utilizadas en cada capa del sistema, en sus "
          "versiones estables vigentes al momento del desarrollo."),
        tbl_title("Stack tecnológico"),
        table([
            ["Capa", "Tecnología", "Versión", "Uso"],
            ["Backend", "Python", "3.14", "Lenguaje del servidor."],
            ["Backend", "FastAPI", "0.143", "API REST y documentación OpenAPI."],
            ["Backend", "SQLAlchemy / Alembic", "2.1 / 1.20", "Acceso a datos y migraciones."],
            ["Backend", "Pydantic", "2.14", "Validación de datos."],
            ["Backend", "PyJWT / pwdlib (Argon2)", "2.15 / 0.3", "Tokens y contraseñas."],
            ["Backend", "openpyxl", "3.1", "Lectura y generación de archivos Excel."],
            ["Base de datos", "PostgreSQL", "18.6", "Almacenamiento relacional."],
            ["Frontend", "Next.js / React", "16.4 / 19.3", "Interfaz web y servidor intermedio."],
            ["Frontend", "TypeScript", "5.9", "Tipado estático."],
            ["Frontend", "Tailwind CSS / shadcn/ui", "4.3 / 4.21", "Estilos y componentes."],
            ["Frontend", "TanStack Query", "5.104", "Consulta y caché de datos."],
            ["Infraestructura", "Docker Compose", "—", "Contenedores de la aplicación."],
            ["Infraestructura", "GitHub Actions / GHCR", "—", "Integración y entrega continua."],
            ["Infraestructura", "Traefik", "3.6", "Proxy inverso y HTTPS en el servidor."],
        ], [3.0 * cm, 4.8 * cm, 2.4 * cm, PW - 10.2 * cm]),
    ]

    # 5. Arquitectura y funcionamiento
    story += [
        PageBreak(),
        Heading("Arquitectura y funcionamiento", 0, "5."),
        Heading("Arquitectura general", 1, "5.1"),
        p("El sistema sigue una arquitectura de tres capas: la interfaz web en Next.js, la API "
          "en FastAPI y la base de datos PostgreSQL. El servidor de Next.js actúa además como "
          "intermediario (backend for frontend): recibe las solicitudes del navegador y las "
          "reenvía a la API agregando el token de sesión, de modo que el token nunca queda "
          "expuesto en el navegador."),
        figure(DIAGRAMS / "arquitectura.png", "Arquitectura del sistema.", PW, 6 * cm),
        Heading("Autenticación y roles", 1, "5.2"),
        p("Los usuarios ingresan con su número de registro y su contraseña. La API valida las "
          "credenciales y emite un token JWT firmado, que el servidor de Next.js guarda en una "
          "cookie con atributo httpOnly. En cada solicitud la API identifica al usuario y "
          "verifica su rol; el administrador accede a la gestión completa y el estudiante "
          "únicamente a su propia asistencia."),
        Heading("Registro de asistencia", 1, "5.3"),
        p("El estudiante visualiza las sesiones del día de los programas en los que está "
          "inscrito y registra su asistencia con un botón. El servidor determina la fecha "
          "actual en la zona horaria America/La_Paz y rechaza cualquier registro sobre sesiones "
          "de otra fecha. Si el registro se realiza antes de la hora de inicio más una "
          "tolerancia de quince minutos, queda como «presente»; en caso contrario, como "
          "«tarde». El estudiante puede anular su propio registro durante el mismo día, "
          "mientras que el administrador puede asignar cualquier estado (presente, tarde, falta "
          "o justificado) en las sesiones ya dictadas y en las del día. Las sesiones futuras "
          "son de solo lectura: ni el estudiante ni el administrador pueden registrar una "
          "asistencia que todavía no ocurrió."),
        Heading("Importación desde Excel", 1, "5.4"),
        p("El administrador descarga un modelo de archivo Excel con los encabezados esperados, "
          "lo completa y lo carga en el sistema. Cada fila se valida de forma independiente: "
          "las filas correctas se registran y las que presentan errores se informan con su "
          "número y el motivo. Cada importación queda registrada para auditoría."),
        Heading("Gestión de programas", 1, "5.5"),
        p("El sistema admite varios programas académicos. Cada programa tiene sus propios "
          "estudiantes inscritos, sesiones e indicadores, y un mismo estudiante puede estar "
          "inscrito en más de un programa."),
    ]

    # 6. Base de datos
    story += [
        PageBreak(),
        Heading("Base de datos", 0, "6."),
        p("La base de datos se implementó en PostgreSQL 18 y se crea mediante migraciones "
          "versionadas con Alembic. Utiliza claves primarias de tipo UUID, tipos enumerados "
          "nativos, claves foráneas y restricciones de unicidad y de verificación."),
        tbl_title("Entidades del modelo"),
        table([["Tabla", "Descripción"]] + [[k, v] for k, v in TABLE_DOCS.items()],
              [4.2 * cm, PW - 4.2 * cm], mono_cols=(0,)),
        NextPageTemplate("landscape"),
        PageBreak(),
        Heading("Modelo entidad-relación", 1, "6.1"),
        figure(DIAGRAMS / "er.png", "Modelo entidad-relación.", LW, LAND_H - 2 * MARGIN - 3 * cm),
        NextPageTemplate("content"),
        PageBreak(),
        Heading("Normalización", 1, "6.2"),
        p("El modelo cumple la tercera forma normal (3FN):"),
        bullets([
            "<b>Primera forma normal.</b> Todos los atributos son atómicos y no existen grupos "
            "repetidos. La inscripción de un estudiante en varios programas se representa con "
            "una fila por programa en la tabla " + code("enrollments") + ".",
            "<b>Segunda forma normal.</b> No existen dependencias parciales. En "
            + code("attendance_records") + ", el estado, el origen, la hora y la nota dependen "
            "de la combinación completa de sesión y estudiante.",
            "<b>Tercera forma normal.</b> No existen dependencias transitivas. El nombre del "
            "programa se almacena únicamente en " + code("courses") + " y el nombre del "
            "estudiante únicamente en " + code("users") + "; el número de registro se almacena "
            "una sola vez en " + code("users.registration_code") + ".",
        ]),
        Heading("Integridad y decisiones de diseño", 1, "6.3"),
        bullets([
            "Los datos de acceso (" + code("users") + ") se separan de los datos académicos ("
            + code("students") + ").",
            "Las faltas no se almacenan por defecto: la ausencia de registro en una sesión ya "
            "concluida se interpreta como falta, lo que evita guardar datos derivados.",
            "La restricción " + code("UNIQUE (session_id, student_id)") + " impide registros "
            "duplicados de asistencia.",
            "La restricción " + code("UNIQUE (course_id, session_date, start_time)") +
            " impide sesiones repetidas, y " + code("CHECK (end_time > start_time)") +
            " impide horarios inválidos.",
            "Cada registro guarda su origen, el usuario que lo realizó y la fecha y hora, y "
            "cada importación queda registrada en " + code("import_batches") + ".",
        ]),
        Heading("Diccionario de datos", 1, "6.4"),
        p("Las tablas siguientes describen cada entidad. Se generan a partir del modelo de "
          "datos de la aplicación."),
    ]
    story += dictionary_section()

    # 7. Pantallas
    story += [PageBreak(), Heading("Pantallas del sistema", 0, "7.")]
    for i, (file, title, text) in enumerate(SCREENS, start=1):
        path = SHOTS / file
        if not path.exists():
            continue
        mobile = file.startswith("13-")
        story += [
            CondPageBreak(11 * cm),
            Heading(title, 1, f"7.{i}"),
            p(text),
            figure(path, title + ".", PW * (0.4 if mobile else 1), 12 * cm if mobile else 8.6 * cm),
        ]

    # 8. Diagramas complementarios
    story += [
        PageBreak(),
        Heading("Diagramas complementarios", 0, "8."),
        Heading("Casos de uso", 1, "8.1"),
        figure(DIAGRAMS / "casos-uso.png", "Diagrama de casos de uso.", PW, 15 * cm),
        NextPageTemplate("landscape"),
        PageBreak(),
        Heading("Secuencia del registro de asistencia", 1, "8.2"),
        figure(DIAGRAMS / "secuencia-registro.png", "Secuencia del registro de asistencia.",
               LW, LAND_H - 2 * MARGIN - 3 * cm),
        PageBreak(),
        Heading("Secuencia de la importación de estudiantes", 1, "8.3"),
        figure(DIAGRAMS / "secuencia-importacion.png",
               "Secuencia de la importación de estudiantes.", LW, LAND_H - 2 * MARGIN - 3 * cm),
        NextPageTemplate("content"),
        PageBreak(),
    ]

    # 9. Despliegue
    story += [
        Heading("Despliegue e integración continua", 0, "9."),
        p("La aplicación se ejecuta en contenedores Docker: base de datos, API y frontend. En "
          "producción se aloja en un servidor virtual detrás del proxy inverso Traefik, en la "
          "dirección https://diplo.jorgearturo.net. Solo el frontend se publica; la API y la "
          "base de datos se comunican por una red interna sin acceso desde internet."),
        p("Cada cambio en la rama principal del repositorio ejecuta un flujo de GitHub Actions "
          "con tres etapas: pruebas del backend y del frontend, construcción de las imágenes "
          "Docker y publicación en GitHub Container Registry, y despliegue en el servidor "
          "mediante SSH. El despliegue valida la configuración, descarga las imágenes, aplica "
          "las migraciones de la base de datos y verifica que todos los servicios queden en "
          "funcionamiento."),
        Heading("Pruebas", 1, "9.1"),
        p("El backend cuenta con 26 pruebas automatizadas que verifican la autenticación, las "
          "reglas de registro de asistencia (registro del día, tardanza, anulación, rechazo de "
          "otras fechas y bloqueo de sesiones futuras), la gestión de varios programas, la importación desde Excel y la "
          "exportación de reportes. El frontend se valida con análisis estático y verificación "
          "de tipos."),
    ]

    # 10. Conclusiones
    story += [
        Heading("Conclusiones", 0, "10."),
        p("Se desarrolló un sistema funcional que cumple los requerimientos planteados: "
          "distingue entre administradores y estudiantes, importa estudiantes y horarios desde "
          "Excel, permite al administrador consultar y corregir la asistencia de todos los "
          "estudiantes y restringe al estudiante al registro de su asistencia del día."),
        p("La base de datos normalizada y las restricciones definidas en el propio motor "
          "garantizan la integridad de la información, mientras que la integración continua "
          "asegura que cada versión publicada haya superado las pruebas automatizadas."),
    ]

    # Anexos
    story += [
        PageBreak(),
        Heading("Anexo A. Acceso de demostración", 0),
        tbl_title("Cuentas de demostración"),
        table([
            ["Rol", "Número de registro", "Contraseña"],
            ["Administrador", "218166141", "admin1234!"],
            ["Estudiante", "219034521", "admin1234!"],
        ], [5 * cm, 5 * cm, PW - 10 * cm]),
        Spacer(1, 8),
        p("Todas las cuentas creadas por el sistema utilizan la contraseña común indicada, que "
          "cada usuario puede cambiar desde su menú."),
        Heading("Anexo B. Endpoints de la API", 0),
        tbl_title("Endpoints de la API REST"),
        table(endpoint_rows(), [2.0 * cm, 7.4 * cm, PW - 9.4 * cm], mono_cols=(0, 1)),
    ]

    Doc(str(OUTPUT)).multiBuild(story)
    print(f"PDF generado: {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    build()
