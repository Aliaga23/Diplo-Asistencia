"""Genera docs/Documentacion-Presencia.pdf con ReportLab (sin LaTeX ni navegador).

Uso (desde la raíz del repositorio):
    uv run --project backend python docs/build_pdf.py

El diccionario de datos, las restricciones y la referencia de la API se leen
directamente del modelo SQLAlchemy y del esquema OpenAPI de FastAPI, de modo que
el documento siempre coincide con el código.
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
from reportlab.lib.enums import TA_CENTER, TA_LEFT  # noqa: E402
from reportlab.lib.pagesizes import A4, landscape  # noqa: E402
from reportlab.lib.styles import ParagraphStyle  # noqa: E402
from reportlab.lib.units import mm  # noqa: E402
from reportlab.lib.utils import ImageReader  # noqa: E402
from reportlab.pdfbase import pdfmetrics  # noqa: E402
from reportlab.pdfbase.ttfonts import TTFont  # noqa: E402
from reportlab.platypus import (  # noqa: E402
    BaseDocTemplate,
    CondPageBreak,
    Flowable,
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

# --------------------------------------------------------------------------- tema

NAVY = colors.HexColor("#0B1220")
INK = colors.HexColor("#0F172A")
BLUE = colors.HexColor("#1D4ED8")
BLUE_MID = colors.HexColor("#3B82F6")
BLUE_LIGHT = colors.HexColor("#DBEAFE")
BLUE_SOFT = colors.HexColor("#EFF6FF")
GRAY = colors.HexColor("#64748B")
BORDER = colors.HexColor("#E2E8F0")
ZEBRA = colors.HexColor("#F8FAFC")
WHITE = colors.white

FONT_DIR = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"


def register_fonts() -> dict[str, str]:
    files = {
        "UI": "segoeui.ttf",
        "UI-Bold": "segoeuib.ttf",
        "UI-Semibold": "seguisb.ttf",
        "UI-Light": "segoeuil.ttf",
        "UI-Italic": "segoeuii.ttf",
        "Mono": "consola.ttf",
    }
    try:
        for name, file in files.items():
            pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / file)))
        pdfmetrics.registerFontFamily(
            "UI", normal="UI", bold="UI-Bold", italic="UI-Italic", boldItalic="UI-Bold"
        )
        return {"regular": "UI", "bold": "UI-Bold", "semibold": "UI-Semibold",
                "light": "UI-Light", "italic": "UI-Italic", "mono": "Mono"}
    except Exception:  # fuera de Windows: fuentes base de PDF
        return {"regular": "Helvetica", "bold": "Helvetica-Bold", "semibold": "Helvetica-Bold",
                "light": "Helvetica", "italic": "Helvetica-Oblique", "mono": "Courier"}


F = register_fonts()

S = {
    "body": ParagraphStyle("body", fontName=F["regular"], fontSize=10, leading=15.5,
                           textColor=INK, spaceAfter=6),
    "lead": ParagraphStyle("lead", fontName=F["light"], fontSize=12, leading=18,
                           textColor=INK, spaceAfter=10),
    "small": ParagraphStyle("small", fontName=F["regular"], fontSize=8.5, leading=12,
                            textColor=GRAY),
    "caption": ParagraphStyle("caption", fontName=F["italic"], fontSize=8.5, leading=12,
                              textColor=GRAY, alignment=TA_CENTER, spaceBefore=4, spaceAfter=12),
    "h1": ParagraphStyle("h1", fontName=F["bold"], fontSize=21, leading=26, textColor=NAVY,
                         spaceBefore=4, spaceAfter=10),
    "h2": ParagraphStyle("h2", fontName=F["semibold"], fontSize=13.5, leading=18, textColor=NAVY,
                         spaceBefore=14, spaceAfter=6),
    "h3": ParagraphStyle("h3", fontName=F["semibold"], fontSize=11, leading=15, textColor=BLUE,
                         spaceBefore=10, spaceAfter=4),
    "cell": ParagraphStyle("cell", fontName=F["regular"], fontSize=8.6, leading=11.5,
                           textColor=INK),
    "cell_mono": ParagraphStyle("cell_mono", fontName=F["mono"], fontSize=8.2, leading=11.5,
                                textColor=NAVY),
    "cell_head": ParagraphStyle("cell_head", fontName=F["semibold"], fontSize=8.6, leading=11.5,
                                textColor=WHITE),
    "code": ParagraphStyle("code", fontName=F["mono"], fontSize=8.6, leading=12.5,
                           textColor=NAVY, backColor=BLUE_SOFT, borderColor=BLUE_LIGHT,
                           borderWidth=0.6, borderPadding=(7, 9, 7, 9), spaceBefore=6,
                           spaceAfter=12),
    "toc1": ParagraphStyle("toc1", fontName=F["semibold"], fontSize=10.5, leading=20,
                           textColor=NAVY, leftIndent=0),
    "toc2": ParagraphStyle("toc2", fontName=F["regular"], fontSize=9.5, leading=16,
                           textColor=INK, leftIndent=16),
}


def esc(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def p(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text, S[style])


def mono(text: str) -> str:
    return f'<font name="{F["mono"]}" color="#1D4ED8">{esc(text)}</font>'


def bullets(items: list[str], style: str = "body") -> ListFlowable:
    return ListFlowable(
        [ListItem(Paragraph(i, S[style]), leftIndent=12, value="•") for i in items],
        bulletType="bullet",
        start="•",
        bulletColor=BLUE,
        bulletFontName=F["bold"],
        leftIndent=12,
        bulletOffsetY=0,
    )


class Heading(Paragraph):
    """Encabezado que se registra en el índice y en los marcadores del PDF."""

    def __init__(self, text: str, level: int, number: str | None = None):
        self.toc_text = f"{number}  {text}" if number else text
        self.toc_level = level
        label = (
            f'<font color="#1D4ED8">{number}</font>&nbsp;&nbsp;{esc(text)}' if number else esc(text)
        )
        super().__init__(label, S["h1"] if level == 0 else S["h2"])


def table(rows: list[list], widths: list[float], mono_cols: tuple[int, ...] = (),
          head: bool = True) -> Table:
    data = []
    for r, row in enumerate(rows):
        cells = []
        for c, value in enumerate(row):
            if isinstance(value, Flowable):
                cells.append(value)
                continue
            if r == 0 and head:
                cells.append(Paragraph(esc(str(value)), S["cell_head"]))
            elif c in mono_cols:
                cells.append(Paragraph(esc(str(value)), S["cell_mono"]))
            else:
                cells.append(Paragraph(str(value), S["cell"]))
        data.append(cells)
    t = Table(data, colWidths=widths, repeatRows=1 if head else 0)
    style = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, BORDER),
        ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
    ]
    if head:
        style += [("BACKGROUND", (0, 0), (-1, 0), NAVY), ("LINEBELOW", (0, 0), (-1, 0), 1.2, BLUE)]
    for i in range(1 if head else 0, len(data)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), ZEBRA))
    t.setStyle(TableStyle(style))
    return t


def figure(path: Path, caption: str, max_w: float, max_h: float) -> KeepTogether:
    reader = ImageReader(str(path))
    iw, ih = reader.getSize()
    scale = min(max_w / iw, max_h / ih)
    img = Image(str(path), width=iw * scale, height=ih * scale)
    img.hAlign = "CENTER"
    frame = Table([[img]], colWidths=[iw * scale + 2])
    frame.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return KeepTogether([frame, Paragraph(caption, S["caption"])])


def callout(title: str, text: str) -> Table:
    t = Table([[Paragraph(f"<b>{esc(title)}</b><br/>{text}", S["cell"])]], colWidths=[PW])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BLUE_SOFT),
        ("LINEBEFORE", (0, 0), (0, -1), 3, BLUE),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return t


# --------------------------------------------------------------------------- páginas

PAGE_W, PAGE_H = A4
MARGIN_X = 22 * mm
PW = PAGE_W - 2 * MARGIN_X
LAND_W, LAND_H = landscape(A4)
LW = LAND_W - 2 * 16 * mm
DOC_TITLE = "Presencia · Documentación técnica"


def draw_cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    # retícula sutil
    canvas.setStrokeColor(colors.Color(1, 1, 1, alpha=0.05))
    canvas.setLineWidth(0.5)
    step = 14 * mm
    x = 0.0
    while x < PAGE_W:
        canvas.line(x, 0, x, PAGE_H)
        x += step
    y = 0.0
    while y < PAGE_H:
        canvas.line(0, y, PAGE_W, y)
        y += step
    # marca
    canvas.setFillColor(BLUE)
    canvas.roundRect(MARGIN_X, PAGE_H - 52 * mm, 16 * mm, 16 * mm, 3.5 * mm, stroke=0, fill=1)
    canvas.setStrokeColor(WHITE)
    canvas.setLineWidth(2.6)
    canvas.setLineCap(1)
    canvas.setLineJoin(1)
    bx, by = MARGIN_X, PAGE_H - 52 * mm
    path = canvas.beginPath()
    path.moveTo(bx + 4.5 * mm, by + 8.2 * mm)
    path.lineTo(bx + 6.9 * mm, by + 5.6 * mm)
    path.lineTo(bx + 11.6 * mm, by + 10.6 * mm)
    canvas.drawPath(path, stroke=1, fill=0)
    canvas.setFillColor(WHITE)
    canvas.setFont(F["semibold"], 15)
    canvas.drawString(MARGIN_X + 20 * mm, PAGE_H - 43 * mm, "Presencia")
    canvas.setFillColor(colors.Color(1, 1, 1, alpha=0.55))
    canvas.setFont(F["regular"], 8.5)
    canvas.drawString(MARGIN_X + 20 * mm, PAGE_H - 48.5 * mm, "CONTROL DE ASISTENCIA")
    # título
    canvas.setFillColor(colors.HexColor("#93C5FD"))
    canvas.setFont(F["semibold"], 10)
    canvas.drawString(MARGIN_X, PAGE_H / 2 + 46 * mm, "DOCUMENTACIÓN TÉCNICA · VERSIÓN 1.0")
    canvas.setFillColor(WHITE)
    canvas.setFont(F["bold"], 36)
    canvas.drawString(MARGIN_X, PAGE_H / 2 + 26 * mm, "Sistema de registro")
    canvas.drawString(MARGIN_X, PAGE_H / 2 + 11 * mm, "de asistencia")
    canvas.setFillColor(colors.Color(1, 1, 1, alpha=0.7))
    canvas.setFont(F["light"], 13)
    canvas.drawString(MARGIN_X, PAGE_H / 2 - 4 * mm,
                      "Base de datos normalizada, arquitectura, reglas de negocio y pantallas")
    canvas.setStrokeColor(BLUE)
    canvas.setLineWidth(3)
    canvas.line(MARGIN_X, PAGE_H / 2 - 14 * mm, MARGIN_X + 34 * mm, PAGE_H / 2 - 14 * mm)
    # pie
    canvas.setFillColor(colors.Color(1, 1, 1, alpha=0.5))
    canvas.setFont(F["regular"], 9)
    canvas.drawString(MARGIN_X, 40 * mm, "Elaborado por")
    canvas.setFillColor(WHITE)
    canvas.setFont(F["bold"], 18)
    canvas.drawString(MARGIN_X, 31 * mm, "Grupo GPT-6 AURA")
    canvas.setFillColor(colors.Color(1, 1, 1, alpha=0.6))
    canvas.setFont(F["regular"], 9.5)
    today = date.today()
    meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
             "septiembre", "octubre", "noviembre", "diciembre"]
    canvas.drawString(MARGIN_X, 24 * mm,
                      f"Diplomado · {today.day} de {meses[today.month - 1]} de {today.year}")
    canvas.drawRightString(PAGE_W - MARGIN_X, 24 * mm, "FastAPI · Next.js 16 · PostgreSQL 16")
    canvas.restoreState()


def draw_page(canvas, doc, width=PAGE_W, height=PAGE_H, margin=MARGIN_X):
    canvas.saveState()
    canvas.setFillColor(BLUE)
    canvas.rect(margin, height - 14 * mm, 7 * mm, 1.4, stroke=0, fill=1)
    canvas.setFillColor(GRAY)
    canvas.setFont(F["semibold"], 8)
    canvas.drawString(margin + 9 * mm, height - 14.6 * mm, DOC_TITLE.upper())
    canvas.setFont(F["regular"], 8)
    canvas.drawRightString(width - margin, height - 14.6 * mm, "Grupo GPT-6 AURA")
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.6)
    canvas.line(margin, 14 * mm, width - margin, 14 * mm)
    canvas.setFillColor(GRAY)
    canvas.drawString(margin, 9.5 * mm, "Sistema de registro de asistencia")
    canvas.setFillColor(NAVY)
    canvas.setFont(F["semibold"], 8.5)
    canvas.drawRightString(width - margin, 9.5 * mm, f"{doc.page}")
    canvas.restoreState()


def draw_landscape(canvas, doc):
    draw_page(canvas, doc, LAND_W, LAND_H, 16 * mm)


class Doc(BaseDocTemplate):
    def __init__(self, filename: str):
        super().__init__(
            filename,
            pagesize=A4,
            title="Presencia — Documentación técnica",
            author="Grupo GPT-6 AURA",
            subject="Sistema de registro de asistencia",
            creator="ReportLab",
        )
        content = Frame(MARGIN_X, 20 * mm, PW, PAGE_H - 42 * mm, id="content",
                        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        cover = Frame(0, 0, PAGE_W, PAGE_H, id="cover")
        land = Frame(16 * mm, 18 * mm, LW, LAND_H - 38 * mm, id="land",
                     leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates([
            PageTemplate(id="cover", frames=[cover], onPage=draw_cover),
            PageTemplate(id="content", frames=[content], onPage=draw_page),
            PageTemplate(id="landscape", frames=[land], onPage=draw_landscape,
                         pagesize=landscape(A4)),
        ])
        self._bookmark = 0

    def beforeDocument(self):
        # multiBuild compone varias pasadas: las claves deben repetirse igual en cada una.
        self._bookmark = 0

    def afterFlowable(self, flowable):
        if isinstance(flowable, Heading):
            self._bookmark += 1
            key = f"h{self._bookmark}"
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(flowable.toc_text, key, level=flowable.toc_level,
                                      closed=False)
            self.notify("TOCEntry", (flowable.toc_level, flowable.toc_text, self.page, key))


# --------------------------------------------------------------------------- contenido

COLUMN_DOCS: dict[str, dict[str, str]] = {
    "users": {
        "id": "Identificador único (UUID v4).",
        "registration_code": "Número de registro institucional. Es el usuario de ingreso de todos.",
        "email": "Correo institucional (opcional, único si existe).",
        "password_hash": "Hash Argon2 de la contraseña. Nunca se guarda la contraseña en texto.",
        "full_name": "Nombre completo.",
        "role": "Rol del usuario: admin o student.",
        "is_active": "Permite desactivar una cuenta sin borrar su historial.",
        "must_change_password": "Obliga a cambiar la contraseña en el próximo ingreso.",
        "created_at": "Fecha de creación (auditoría).",
        "updated_at": "Fecha de la última modificación (auditoría).",
    },
    "students": {
        "id": "Identificador del perfil académico.",
        "user_id": "Cuenta asociada. Relación 1:1 con users.",
        "career": "Carrera o especialidad del estudiante.",
    },
    "courses": {
        "id": "Identificador del programa.",
        "code": "Código corto y único del programa (p. ej. DIP-FS-2026).",
        "name": "Nombre del programa.",
        "period": "Gestión o periodo académico.",
    },
    "enrollments": {
        "id": "Identificador de la inscripción.",
        "student_id": "Estudiante inscrito.",
        "course_id": "Programa en el que se inscribe.",
    },
    "class_sessions": {
        "id": "Identificador de la sesión.",
        "course_id": "Programa al que pertenece la sesión.",
        "session_date": "Fecha de la clase.",
        "start_time": "Hora de inicio (base del cálculo de tardanza).",
        "end_time": "Hora de fin; debe ser posterior al inicio.",
        "topic": "Tema o contenido de la sesión.",
    },
    "attendance_records": {
        "id": "Identificador del registro.",
        "session_id": "Sesión de clase.",
        "student_id": "Estudiante.",
        "status": "Estado: present, late, absent o excused.",
        "source": "Origen del registro: self (estudiante), admin o import.",
        "marked_at": "Momento exacto del registro (con zona horaria).",
        "marked_by": "Usuario que hizo el registro (estudiante o administrador).",
        "note": "Observación opcional (p. ej. motivo de una justificación).",
    },
    "import_batches": {
        "id": "Identificador del lote de importación.",
        "kind": "Tipo de importación: students o sessions.",
        "filename": "Nombre del archivo Excel procesado.",
        "course_id": "Programa destino de la importación.",
        "uploaded_by": "Administrador que subió el archivo.",
        "rows_total": "Filas leídas del archivo.",
        "rows_ok": "Filas procesadas correctamente.",
        "rows_failed": "Filas rechazadas.",
        "errors": "Detalle de errores por fila en formato JSON.",
    },
}

TABLE_DOCS = {
    "users": "Cuentas de acceso. Concentra solo datos de autenticación y rol.",
    "students": "Perfil académico del estudiante, especialización 1:1 de users.",
    "courses": "Programas académicos (cursos o diplomados) con control de asistencia propio.",
    "enrollments": "Tabla asociativa N:M entre estudiantes y programas.",
    "class_sessions": "Horarios y fechas de clase de cada programa.",
    "attendance_records": "Un registro de asistencia por estudiante y sesión.",
    "import_batches": "Auditoría de cada archivo Excel importado.",
}

ENUM_DOCS = [
    ("user_role", "admin, student", "Rol de la cuenta."),
    ("attendance_status", "present, late, absent, excused",
     "Presente, tarde, falta y justificado."),
    ("attendance_source", "self, admin, import",
     "Quién originó el registro: el estudiante, un administrador o una importación."),
    ("import_kind", "students, sessions", "Tipo de archivo importado."),
]

SCREENS = [
    ("01-login.png", "Inicio de sesión",
     "Pantalla dividida: a la izquierda la propuesta de valor del sistema y a la derecha el "
     "formulario. El ingreso es con <b>número de registro</b> y contraseña; la sesión se guarda "
     "en una cookie httpOnly que el navegador no puede leer."),
    ("15-intro-grupo.png", "Animación de bienvenida · «App hecha por el grupo»",
     "Tras un ingreso correcto aparece una pantalla negra con destellos. Las partículas se "
     "ensamblan en el texto «App hecha por el grupo». Se puede saltar con el botón, Escape o Enter, "
     "y respeta la preferencia de movimiento reducido del sistema operativo."),
    ("16-intro-aura.png", "Animación de bienvenida · «GPT-6 AURA»",
     "Segundo ensamblaje con el nombre del grupo en blanco y azul, con un barrido de luz."),
    ("17-intro-cenizas.png", "Animación de bienvenida · cenizas",
     "Todo se desintegra en cenizas de izquierda a derecha y revela el panel de destino, que se "
     "cargó por detrás durante la animación."),
    ("02-admin-panel.png", "Panel del administrador",
     "Indicadores del programa activo: asistencia promedio, estudiantes inscritos, sesiones "
     "dictadas y registros del día. Incluye el gráfico de barras apiladas por sesión, el control "
     "de la sesión de hoy y la lista de estudiantes con asistencia menor al 80%."),
    ("03-admin-programas.png", "Programas",
     "El control de asistencia funciona para cualquier número de programas. Cada tarjeta muestra "
     "estudiantes, sesiones y asistencia promedio; desde aquí se crea, edita o activa un programa."),
    ("04-admin-estudiantes.png", "Estudiantes",
     "Listado del programa activo con búsqueda por nombre, registro o correo, filtro de riesgo y "
     "asistencia acumulada. Se puede importar desde Excel o registrar un estudiante manualmente."),
    ("05-admin-ficha-estudiante.png", "Ficha del estudiante (modal)",
     "Resumen de asistencia, historial del programa con pestañas Dictadas/Programadas y edición "
     "del estado de cualquier fecha. Permite restablecer la contraseña y activar o desactivar la "
     "cuenta. Todas las ventanas emergentes son modales propios, sin paneles laterales."),
    ("06-admin-sesiones.png", "Sesiones y asistencia",
     "Agenda de sesiones con pestañas Próximas/Dictadas, distribución de la asistencia por sesión "
     "y acceso al control. Se pueden importar horarios desde Excel o crear sesiones a mano."),
    ("07-admin-control-asistencia.png", "Control de asistencia de una sesión",
     "Matriz de estudiantes de la sesión con hora de marcado, origen del registro, nota y estado "
     "editable. Los contadores superiores funcionan también como filtros."),
    ("08-admin-importaciones.png", "Importaciones",
     "Acceso a los modelos de Excel y a la importación. El historial de lotes queda como registro "
     "de auditoría con filas correctas y con error."),
    ("09-admin-modal-importar.png", "Modal de importación en dos pasos",
     "Paso 1: descargar el modelo (incluye ejemplos e instrucciones). Paso 2: subir el archivo "
     "completado. El resultado muestra el detalle fila por fila."),
    ("10-admin-panel-oscuro.png", "Modo oscuro",
     "Toda la interfaz tiene tema claro y oscuro con la misma paleta azul, negro y blanco."),
    ("11-estudiante-hoy.png", "Estudiante · registrar hoy",
     "Tarjeta por cada clase del día (de todos sus programas) con un único botón para registrar. "
     "Indica hasta qué hora cuenta como presente. El estudiante puede anular su propio registro "
     "solo durante el día; si el administrador lo confirmó, queda bloqueado."),
    ("12-estudiante-historial.png", "Estudiante · historial",
     "Historial por programa con estado, hora y origen de cada registro. Las fechas anteriores "
     "aparecen bloqueadas: solo el administrador puede modificarlas."),
    ("13-movil-estudiante.png", "Vista móvil",
     "Diseño adaptable: el estudiante registra su asistencia desde el celular con un toque."),
    ("14-movil-menu.png", "Menú móvil en modal",
     "En pantallas pequeñas la navegación se abre en un modal centrado, nunca desde un lateral."),
]

ROLE_BY_PREFIX = [
    ("/api/v1/auth", "Todos"),
    ("/api/v1/me", "Estudiante"),
    ("/health", "Público"),
]


def endpoint_rows() -> list[list[str]]:
    spec = fastapi_app.openapi()
    rows = [["Método", "Ruta", "Rol", "Descripción"]]
    for path, ops in spec["paths"].items():
        for method, op in ops.items():
            role = "Administrador"
            for prefix, r in ROLE_BY_PREFIX:
                if path.startswith(prefix):
                    role = r
            if path == "/api/v1/courses" and method == "get":
                role = "Todos"
            rows.append([method.upper(), path.replace("/api/v1", ""), role, op.get("summary", "")])
    return rows


def dictionary_section() -> list:
    flow: list = []
    for tbl in Base.metadata.sorted_tables:
        uniques = {
            tuple(c.name for c in con.columns)
            for con in tbl.constraints
            if isinstance(con, UniqueConstraint)
        }
        rows = [["Columna", "Tipo", "Restricciones", "Descripción"]]
        for col in tbl.columns:
            flags = []
            if col.primary_key:
                flags.append("PK")
            for fk in col.foreign_keys:
                rule = f" · ON DELETE {fk.ondelete}" if fk.ondelete else ""
                flags.append(f"FK → {fk.column.table.name}.{fk.column.name}{rule}")
            if col.unique or (col.name,) in uniques:
                flags.append("UNIQUE")
            flags.append("NULL" if col.nullable and not col.primary_key else "NOT NULL")
            if col.server_default is not None:
                flags.append("DEFAULT now()")
            ctype = col.type.compile(dialect=postgresql.dialect())
            desc = COLUMN_DOCS.get(tbl.name, {}).get(col.name)
            if desc is None and col.name in ("created_at", "updated_at"):
                desc = COLUMN_DOCS["users"][col.name]
            rows.append([col.name, ctype.lower(), "<br/>".join(esc(f) for f in flags), desc or ""])
        composite = [", ".join(u) for u in uniques if len(u) > 1]
        checks = [str(c.sqltext) for c in tbl.constraints if isinstance(c, CheckConstraint)]
        indexes = [", ".join(c.name for c in ix.columns) for ix in tbl.indexes]
        extra = []
        if composite:
            extra.append("Unicidad compuesta: " + "; ".join(mono(f"({c})") for c in composite))
        if checks:
            extra.append("Verificación: " + "; ".join(mono(c) for c in checks))
        if indexes:
            extra.append("Índices: " + ", ".join(mono(i) for i in indexes))
        block = [
            p(f'<font name="{F["mono"]}" color="#0B1220"><b>{tbl.name}</b></font>'
              f'&nbsp;&nbsp;<font color="#64748B">— {esc(TABLE_DOCS.get(tbl.name, ""))}</font>',
              "h3"),
            table(rows, [34 * mm, 30 * mm, 46 * mm, PW - 110 * mm], mono_cols=(0, 1)),
        ]
        if extra:
            block.append(Spacer(1, 4))
            block.append(p(" · ".join(extra), "small"))
        flow.append(KeepTogether(block[:2]))
        flow.extend(block[2:])
        flow.append(Spacer(1, 8))
    return flow


def build() -> None:
    doc = Doc(str(OUTPUT))
    story: list = []

    # Portada
    story += [NextPageTemplate("content"), PageBreak()]

    # Índice
    toc = TableOfContents()
    toc.levelStyles = [S["toc1"], S["toc2"]]
    toc.dotsMinLevel = 0
    story += [p("Contenido", "h1"), Spacer(1, 6), toc, PageBreak()]

    # 1. Introducción
    story += [
        Heading("Introducción", 0, "1"),
        p("<b>Presencia</b> es un sistema web para registrar y controlar la asistencia de los "
          "estudiantes en uno o varios programas académicos. Los administradores importan "
          "estudiantes, horarios y fechas desde Excel, revisan la asistencia de todos y la "
          "corrigen cuando hace falta. Cada estudiante registra su propia asistencia del día con "
          "un solo toque.", "lead"),
        p("Este documento describe la base de datos normalizada, la arquitectura, las reglas de "
          "negocio y cada una de las pantallas del sistema."),
        Heading("Cumplimiento de los requisitos", 1, "1.1"),
        table([
            ["Requisito del docente", "Cómo lo resuelve Presencia"],
            ["Registro de asistencia funcional",
             "Aplicación completa (FastAPI + Next.js + PostgreSQL) que se levanta con "
             f"{mono('docker compose up')}. 25 pruebas automatizadas cubren las reglas."],
            ["Diagramas",
             "Diagramas en PlantUML: entidad-relación, arquitectura, casos de uso y dos "
             "diagramas de secuencia (carpeta " + mono("docs/diagrams") + ")."],
            ["GitHub", "Repositorio privado " + mono("github.com/Aliaga23/diplo-asistencia") +
             " con integración continua."],
            ["Tipos de usuario (admin, estudiante)",
             "Columna " + mono("users.role") + " con enum nativo. El backend valida el rol en "
             "cada endpoint y el frontend redirige por rol."],
            ["Importar datos desde Excel",
             "Importación de estudiantes con modelo descargable, validación fila por fila e "
             "inscripción automática al programa."],
            ["Importar horarios y fechas desde Excel",
             "Importación de sesiones con varios formatos de fecha y hora; si la sesión ya "
             "existe, se actualiza."],
            ["El admin ve a todos y modifica su asistencia",
             "Pantallas de Estudiantes, ficha del estudiante y Control de asistencia por sesión, "
             "con edición de cualquier fecha y notas."],
            ["Cada estudiante registra su asistencia",
             "Botón «Registrar mi asistencia»; el estado (presente o tarde) lo calcula el "
             "servidor según la hora de inicio y la tolerancia."],
            ["El estudiante solo modifica su asistencia del día",
             "El servidor compara la fecha de la sesión con la fecha actual en America/La_Paz. "
             "Registrar o anular otra fecha responde 403."],
        ], [62 * mm, PW - 62 * mm]),
        Spacer(1, 10),
        callout("Acceso de demostración",
                "Todas las cuentas usan la contraseña común " + mono("admin1234!") + ". "
                "Administrador: registro " + mono("218166141") + ". Estudiante de ejemplo: "
                "registro " + mono("219034521") + " (inscrito en dos programas)."),
        PageBreak(),
    ]

    # 2. Arquitectura
    story += [
        Heading("Arquitectura", 0, "2"),
        p("El sistema sigue una arquitectura de tres capas con un <b>backend-for-frontend</b> "
          "(BFF) en Next.js. El navegador nunca recibe el token: el servidor de Next.js lo guarda "
          "en una cookie httpOnly y lo adjunta en cada llamada a la API."),
        figure(DIAGRAMS / "arquitectura.png", "Figura 1. Arquitectura de Presencia.", PW, 70 * mm),
        Heading("Tecnologías", 1, "2.1"),
        table([
            ["Capa", "Tecnología", "Motivo"],
            ["Interfaz", "Next.js 16 (App Router, Cache Components), React 19, TypeScript",
             "Renderizado híbrido, rutas por carpeta y tipado estricto."],
            ["Componentes", "shadcn/ui (CLI), Tailwind CSS v4, Phosphor Icons",
             "Componentes accesibles y personalizables; íconos Phosphor en lugar de Lucide."],
            ["Datos en cliente", "TanStack Query, React Hook Form, Zod",
             "Caché, reintentos y validación de formularios."],
            ["API", "FastAPI, Pydantic v2, PyJWT, pwdlib (Argon2)",
             "API REST tipada con documentación OpenAPI automática."],
            ["Persistencia", "PostgreSQL 16, SQLAlchemy 2.0, Alembic",
             "Integridad referencial, enums nativos y migraciones versionadas."],
            ["Excel", "openpyxl", "Lectura de importaciones y generación de modelos y reportes."],
            ["Calidad", "pytest, Ruff, ESLint, GitHub Actions", "Pruebas y análisis en cada cambio."],
            ["Despliegue", "Docker Compose (db, backend, frontend)", "Un solo comando para levantar todo."],
        ], [28 * mm, 66 * mm, PW - 94 * mm]),
        Heading("Decisiones relevantes", 1, "2.2"),
        bullets([
            "<b>Hora oficial en el servidor.</b> «Hoy» se calcula siempre en el backend con la zona "
            "America/La_Paz; nunca se confía en el reloj del navegador.",
            "<b>Sesión segura.</b> JWT firmado (HS256) en cookie httpOnly y SameSite=Lax. El proxy de "
            "Next.js solo hace redirecciones optimistas; la autorización real está en la API.",
            "<b>Contraseñas.</b> Hash Argon2. Todas las cuentas nuevas reciben la contraseña común "
            "configurable " + mono("DEFAULT_PASSWORD") + " y pueden cambiarla desde su menú.",
            "<b>Multiprograma.</b> Toda la información (estudiantes, sesiones, indicadores, "
            "importaciones) se filtra por el programa activo.",
        ]),
        PageBreak(),
    ]

    # 3. Base de datos
    story += [
        Heading("Base de datos", 0, "3"),
        p("La base de datos está en PostgreSQL 16 y se crea con migraciones de Alembic. Usa "
          "claves primarias UUID, enums nativos, claves foráneas con reglas de borrado explícitas "
          "y restricciones de unicidad y verificación que protegen las reglas de negocio desde el "
          "propio motor."),
        table([
            ["Tabla", "Propósito", "Relación principal"],
            ["users", TABLE_DOCS["users"], "1:1 con students"],
            ["students", TABLE_DOCS["students"], "N:M con courses mediante enrollments"],
            ["courses", TABLE_DOCS["courses"], "1:N con class_sessions"],
            ["enrollments", TABLE_DOCS["enrollments"], "students ↔ courses"],
            ["class_sessions", TABLE_DOCS["class_sessions"], "1:N con attendance_records"],
            ["attendance_records", TABLE_DOCS["attendance_records"], "class_sessions ↔ students"],
            ["import_batches", TABLE_DOCS["import_batches"], "N:1 con courses y users"],
        ], [38 * mm, PW - 88 * mm, 50 * mm], mono_cols=(0,)),
        NextPageTemplate("landscape"),
        PageBreak(),
        Heading("Modelo entidad-relación", 1, "3.1"),
        figure(DIAGRAMS / "er.png",
               "Figura 2. Modelo entidad-relación (PlantUML). PK: clave primaria · FK: clave "
               "foránea · UK: clave única.", LW, LAND_H - 70 * mm),
        NextPageTemplate("content"),
        PageBreak(),
        Heading("Normalización", 1, "3.2"),
        p("El modelo cumple la <b>tercera forma normal (3FN)</b> y, en la práctica, la forma normal "
          "de Boyce-Codd: cada determinante es una clave candidata."),
        p("<b>Primera forma normal (1FN).</b> Todos los atributos son atómicos y no hay grupos "
          "repetidos. Un estudiante inscrito en dos programas genera dos filas en "
          + mono("enrollments") + ", nunca una lista dentro de una columna. Cada sesión es una fila "
          "propia en " + mono("class_sessions") + "."),
        p("<b>Segunda forma normal (2FN).</b> No hay dependencias parciales de una clave compuesta. "
          "En " + mono("attendance_records") + " la combinación (session_id, student_id) es única y "
          "todos los atributos (estado, origen, hora, nota) dependen de esa combinación completa: "
          "describen la asistencia de <i>ese</i> estudiante en <i>esa</i> sesión."),
        p("<b>Tercera forma normal (3FN).</b> No hay dependencias transitivas. El nombre del "
          "programa vive solo en " + mono("courses") + " y no se copia en las sesiones; el nombre "
          "del estudiante vive solo en " + mono("users") + " y no se repite en los registros de "
          "asistencia. El número de registro se guarda una única vez, en "
          + mono("users.registration_code") + ", porque identifica a cualquier usuario al ingresar."),
        Heading("Decisiones de diseño", 1, "3.3"),
        bullets([
            "<b>Autenticación separada del perfil académico.</b> " + mono("users") + " guarda "
            "credenciales y rol; " + mono("students") + " guarda los datos académicos. Un "
            "administrador no tiene filas vacías de datos de estudiante.",
            "<b>Las faltas no se almacenan por defecto.</b> Si un estudiante no tiene registro en "
            "una sesión ya dictada, se calcula como falta. Así no se guardan datos derivados ni se "
            "crean miles de filas vacías; el administrador puede fijar una falta explícita con nota.",
            "<b>Sesión «dictada».</b> Una sesión cuenta para los porcentajes solo cuando su fecha "
            "pasó o terminó su horario de hoy; así nadie aparece con falta antes de que acabe la clase.",
            "<b>Trazabilidad.</b> Cada registro guarda " + mono("source") + ", " + mono("marked_by")
            + " y " + mono("marked_at") + "; cada importación queda en " + mono("import_batches")
            + " con el detalle de errores.",
            "<b>Integridad en el motor.</b> " + mono("UNIQUE(session_id, student_id)") + " impide "
            "registros duplicados, " + mono("UNIQUE(course_id, session_date, start_time)") +
            " impide sesiones repetidas y " + mono("CHECK(end_time > start_time)") +
            " impide horarios inválidos.",
        ]),
        Heading("Tipos enumerados", 1, "3.4"),
        table([["Enum", "Valores", "Significado"]] + [list(e) for e in ENUM_DOCS],
              [40 * mm, 58 * mm, PW - 98 * mm], mono_cols=(0, 1)),
        PageBreak(),
        Heading("Diccionario de datos", 1, "3.5"),
        p("Generado automáticamente a partir del modelo SQLAlchemy, por lo que coincide con la "
          "migración aplicada en PostgreSQL.", "small"),
        Spacer(1, 4),
    ]
    story += dictionary_section()

    # 4. Reglas de negocio
    story += [
        PageBreak(),
        Heading("Reglas de negocio", 0, "4"),
        bullets([
            "<b>Solo el día de hoy.</b> El estudiante solo puede registrar o anular su asistencia en "
            "sesiones cuya fecha es la fecha actual en America/La_Paz. Otras fechas responden 403.",
            "<b>Presente o tarde.</b> Si registra antes de la hora de inicio más la tolerancia "
            "(15 minutos, configurable) queda «presente»; después, «tarde».",
            "<b>Registro idempotente.</b> Volver a pulsar el botón no cambia el registro, así nadie "
            "pasa de presente a tarde por error.",
            "<b>Anulación.</b> El estudiante puede anular su propio registro durante el día. Un "
            "registro hecho o confirmado por el administrador no puede ser modificado por el "
            "estudiante.",
            "<b>Administrador.</b> Puede asignar cualquier estado (presente, tarde, falta, "
            "justificado) en cualquier fecha y agregar una nota.",
            "<b>Inscripción.</b> El estudiante solo ve y registra sesiones de los programas en los "
            "que está inscrito.",
            "<b>Importación idempotente.</b> Reimportar el mismo archivo no duplica estudiantes, "
            "inscripciones ni sesiones.",
        ]),
        Spacer(1, 6),
        figure(DIAGRAMS / "casos-uso.png", "Figura 3. Casos de uso.", PW, 120 * mm),
        NextPageTemplate("landscape"),
        PageBreak(),
        Heading("Registro de asistencia", 1, "4.1"),
        figure(DIAGRAMS / "secuencia-registro.png",
               "Figura 4. Secuencia del registro de asistencia del estudiante.", LW, LAND_H - 70 * mm),
        PageBreak(),
        Heading("Importación desde Excel", 1, "4.2"),
        figure(DIAGRAMS / "secuencia-importacion.png",
               "Figura 5. Secuencia de la importación de estudiantes.", LW, LAND_H - 70 * mm),
        NextPageTemplate("content"),
        PageBreak(),
    ]

    # 5. Pantallas
    story += [
        Heading("Pantallas", 0, "5"),
        p("La interfaz usa una paleta azul, negro y blanco, tipografía Geist, íconos Phosphor y "
          "componentes shadcn/ui. Las ventanas emergentes son modales propios, las notificaciones "
          "aparecen abajo a la derecha y todo funciona en tema claro, oscuro y en celulares."),
    ]
    for i, (file, title, text) in enumerate(SCREENS, start=1):
        path = SHOTS / file
        if not path.exists():
            continue
        mobile = file.startswith("13-") or file.startswith("14-")
        story += [
            CondPageBreak(120 * mm),
            Heading(title, 1, f"5.{i}"),
            p(text),
            figure(path, f"Figura {5 + i}. {title}.", PW * (0.45 if mobile else 1),
                   150 * mm if mobile else 118 * mm),
        ]

    # 6. API
    story += [
        PageBreak(),
        Heading("Referencia de la API", 0, "6"),
        p("Prefijo " + mono("/api/v1") + ". La documentación interactiva está en "
          + mono("http://localhost:8000/docs") + ". Todas las rutas, salvo el login, requieren el "
          "encabezado " + mono("Authorization: Bearer <token>") + "."),
        table(endpoint_rows(), [17 * mm, 68 * mm, 24 * mm, PW - 109 * mm], mono_cols=(0, 1)),
    ]

    # 7. Importación
    story += [
        PageBreak(),
        Heading("Modelos de importación Excel", 0, "7"),
        p("Cada importación ofrece un <b>modelo descargable</b> con encabezados, filas de ejemplo, "
          "formatos de celda y una hoja de instrucciones. Los encabezados aceptan sinónimos "
          "comunes (por ejemplo «correo» por «email» o «programa» por «carrera»)."),
        Heading("Estudiantes · modelo_estudiantes.xlsx", 1, "7.1"),
        table([
            ["Columna", "Obligatoria", "Contenido"],
            ["registro", "Sí", "Número de registro único; es el usuario de ingreso."],
            ["nombre", "Sí", "Nombre completo."],
            ["email", "No", "Correo institucional válido."],
            ["carrera", "No", "Carrera o especialidad."],
        ], [32 * mm, 24 * mm, PW - 56 * mm], mono_cols=(0,)),
        Heading("Horarios · modelo_horarios.xlsx", 1, "7.2"),
        table([
            ["Columna", "Obligatoria", "Contenido"],
            ["fecha", "Sí", "AAAA-MM-DD, DD/MM/AAAA o celda de fecha."],
            ["hora_inicio", "Sí", "HH:MM en formato de 24 horas o celda de hora."],
            ["hora_fin", "Sí", "Posterior a la hora de inicio."],
            ["tema", "No", "Tema o contenido de la sesión."],
        ], [32 * mm, 24 * mm, PW - 56 * mm], mono_cols=(0,)),
        Spacer(1, 8),
        callout("Validación fila por fila",
                "Las filas con errores (registro vacío, correo inválido, fecha o rango horario "
                "incorrecto, duplicados) se rechazan con su número de fila y el motivo; el resto "
                "se importa. Cada lote queda en el historial de importaciones."),
    ]

    # 8. Instalación
    story += [
        PageBreak(),
        Heading("Instalación y ejecución", 0, "8"),
        Heading("Con Docker (recomendado)", 1, "8.1"),
        p("Levanta PostgreSQL, la API (aplica migraciones y carga datos de demostración) y el "
          "frontend:"),
        p("docker compose up --build", "code"),
        bullets([
            "Frontend: " + mono("http://localhost:3001"),
            "API y documentación OpenAPI: " + mono("http://localhost:8000/docs"),
        ]),
        Heading("Desarrollo local", 1, "8.2"),
        p("docker compose up -d db<br/>"
          "cd backend<br/>"
          "uv sync<br/>"
          "uv run alembic upgrade head<br/>"
          "uv run python -m app.seed --demo<br/>"
          "uv run uvicorn app.main:app --reload<br/><br/>"
          "cd frontend<br/>"
          "pnpm install<br/>"
          "pnpm dev --port 3001", "code"),
        Heading("Variables de entorno principales", 1, "8.3"),
        table([
            ["Variable", "Valor por defecto", "Uso"],
            ["DATABASE_URL", "postgresql+psycopg://…:5433/asistencia", "Conexión a PostgreSQL."],
            ["JWT_SECRET", "(cambiar en producción)", "Firma de los tokens."],
            ["DEFAULT_PASSWORD", "admin1234!", "Contraseña común de las cuentas nuevas."],
            ["ADMIN_REGISTRATION", "218166141", "Registro del administrador inicial."],
            ["LATE_TOLERANCE_MINUTES", "15", "Minutos de tolerancia antes de «tarde»."],
            ["TIMEZONE", "America/La_Paz", "Zona horaria oficial del sistema."],
            ["API_URL (frontend)", "http://localhost:8000", "URL interna de la API para el BFF."],
        ], [46 * mm, 62 * mm, PW - 108 * mm], mono_cols=(0, 1)),
        Heading("Calidad", 1, "8.4"),
        bullets([
            "25 pruebas con pytest sobre autenticación, reglas de asistencia, multiprograma, "
            "importación y reportes: " + mono("uv run pytest"),
            "Análisis estático: " + mono("uv run ruff check") + " y " + mono("pnpm lint"),
            "Integración continua en GitHub Actions para backend y frontend.",
        ]),
    ]

    doc.multiBuild(story)
    print(f"PDF generado: {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    build()
