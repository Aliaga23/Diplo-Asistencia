"""Genera docs/Documentacion-Plataforma-Presencia.pdf con ReportLab.

Uso (desde la raíz del repositorio):
    uv run --project backend --with pyyaml python docs/build_pdf_plataforma.py

Formato formal, igual que la documentación de Presencia: Arial 12, texto negro, interlineado 1,5,
márgenes de 2,5 cm, títulos numerados y tablas y figuras con leyenda. El catálogo de planes se lee
de plataforma/planes.yaml, el mismo archivo que usan Terraform, Pulumi y la plataforma.
"""

from __future__ import annotations

import os
from datetime import date
from pathlib import Path

import yaml
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
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
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "docs" / "screenshots"
DIAGRAMAS = ROOT / "docs" / "diagrams" / "png"
SALIDA = ROOT / "docs" / "Documentacion-Plataforma-Presencia.pdf"
PLANES = yaml.safe_load((ROOT / "plataforma" / "planes.yaml").read_text(encoding="utf-8"))
URL_PLATAFORMA = os.environ.get("URL_PLATAFORMA", "http://3.235.12.162")
FONT_DIR = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"


def fuentes() -> dict[str, str]:
    archivos = {
        "Arial": "arial.ttf",
        "Arial-Bold": "arialbd.ttf",
        "Arial-Italic": "ariali.ttf",
        "Arial-BoldItalic": "arialbi.ttf",
        "Mono": "consola.ttf",
    }
    try:
        for nombre, archivo in archivos.items():
            pdfmetrics.registerFont(TTFont(nombre, str(FONT_DIR / archivo)))
        pdfmetrics.registerFontFamily(
            "Arial", normal="Arial", bold="Arial-Bold", italic="Arial-Italic", boldItalic="Arial-BoldItalic"
        )
        return {"regular": "Arial", "bold": "Arial-Bold", "italic": "Arial-Italic", "mono": "Mono"}
    except Exception:
        return {"regular": "Helvetica", "bold": "Helvetica-Bold", "italic": "Helvetica-Oblique", "mono": "Courier"}


F = fuentes()
NEGRO = colors.black
GRIS = colors.HexColor("#E6E6E6")
S = {
    "body": ParagraphStyle("body", fontName=F["regular"], fontSize=12, leading=18, alignment=TA_JUSTIFY, spaceAfter=8),
    "h1": ParagraphStyle("h1", fontName=F["bold"], fontSize=14, leading=20, spaceBefore=6, spaceAfter=12),
    "h2": ParagraphStyle("h2", fontName=F["bold"], fontSize=12, leading=18, spaceBefore=12, spaceAfter=6),
    "indice": ParagraphStyle("indice", fontName=F["bold"], fontSize=14, leading=20, spaceAfter=12),
    "leyenda": ParagraphStyle(
        "leyenda", fontName=F["italic"], fontSize=10, leading=14, alignment=TA_CENTER, spaceBefore=4, spaceAfter=14
    ),
    "titulo_tabla": ParagraphStyle(
        "titulo_tabla", fontName=F["bold"], fontSize=10, leading=14, spaceBefore=6, spaceAfter=4
    ),
    "celda": ParagraphStyle("celda", fontName=F["regular"], fontSize=10, leading=13),
    "celda_titulo": ParagraphStyle("celda_titulo", fontName=F["bold"], fontSize=10, leading=13),
    "codigo": ParagraphStyle("codigo", fontName=F["mono"], fontSize=9, leading=12, leftIndent=12, spaceAfter=8),
    "portada": ParagraphStyle("portada", fontName=F["regular"], fontSize=12, leading=18, alignment=TA_CENTER),
    "portada_titulo": ParagraphStyle(
        "portada_titulo", fontName=F["bold"], fontSize=18, leading=26, alignment=TA_CENTER
    ),
    "toc1": ParagraphStyle("toc1", fontName=F["bold"], fontSize=12, leading=20),
    "toc2": ParagraphStyle("toc2", fontName=F["regular"], fontSize=12, leading=18, leftIndent=18),
}
PAGE_W, PAGE_H = A4
MARGEN = 2.5 * cm
ANCHO = PAGE_W - 2 * MARGEN
contador = {"tabla": 0, "figura": 0}


def p(texto: str, estilo: str = "body") -> Paragraph:
    return Paragraph(texto, S[estilo])


def mono(texto: str) -> str:
    return f'<font name="{F["mono"]}" size="10">{texto}</font>'


def vinetas(items: list[str], numerada: bool = False) -> ListFlowable:
    return ListFlowable(
        [ListItem(Paragraph(i, S["body"]), leftIndent=18) for i in items],
        bulletType="1" if numerada else "bullet",
        bulletFormat="%s." if numerada else None,
        start=None if numerada else "•",
        leftIndent=18,
        bulletFontName=F["regular"],
        bulletFontSize=12,
    )


def tabla(titulo: str, filas: list[list[str]], anchos: list[float]) -> KeepTogether:
    contador["tabla"] += 1
    datos = [
        [Paragraph(c, S["celda_titulo" if i == 0 else "celda"]) for c in fila] for i, fila in enumerate(filas)
    ]
    t = Table(datos, colWidths=[a * ANCHO for a in anchos], repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, NEGRO),
                ("BACKGROUND", (0, 0), (-1, 0), GRIS),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return KeepTogether([p(f"Tabla {contador['tabla']}. {titulo}", "titulo_tabla"), t, Spacer(1, 0.35 * cm)])


def figura(archivo: Path, pie: str, ancho: float = 1.0, alto_max: float = 15 * cm) -> KeepTogether:
    contador["figura"] += 1
    w, h = ImageReader(str(archivo)).getSize()
    ancho_pt = ANCHO * ancho
    alto = ancho_pt * h / w
    if alto > alto_max:
        ancho_pt, alto = ancho_pt * alto_max / alto, alto_max
    imagen = Image(str(archivo), width=ancho_pt, height=alto)
    imagen.hAlign = "CENTER"
    return KeepTogether([imagen, p(f"Figura {contador['figura']}. {pie}", "leyenda")])


class Documento(BaseDocTemplate):
    def __init__(self, ruta: str):
        super().__init__(
            ruta,
            pagesize=A4,
            leftMargin=MARGEN,
            rightMargin=MARGEN,
            topMargin=MARGEN,
            bottomMargin=MARGEN,
            title="Documentación técnica — Plataforma de tenants «Presencia Cloud»",
            author="Grupo GPT-6 AURA",
        )
        marco = Frame(MARGEN, MARGEN, ANCHO, PAGE_H - 2 * MARGEN, id="marco")
        self.addPageTemplates(
            [
                PageTemplate(id="portada", frames=[marco]),
                PageTemplate(id="contenido", frames=[marco], onPage=self.encabezado),
            ]
        )

    @staticmethod
    def encabezado(canvas, doc) -> None:
        canvas.saveState()
        canvas.setFont(F["regular"], 9)
        canvas.drawString(MARGEN, PAGE_H - 1.5 * cm, "Plataforma de tenants «Presencia Cloud»")
        canvas.drawRightString(PAGE_W - MARGEN, PAGE_H - 1.5 * cm, "Documentación técnica y manual de usuario")
        canvas.setLineWidth(0.5)
        canvas.line(MARGEN, PAGE_H - 1.65 * cm, PAGE_W - MARGEN, PAGE_H - 1.65 * cm)
        canvas.line(MARGEN, 1.75 * cm, PAGE_W - MARGEN, 1.75 * cm)
        canvas.drawString(MARGEN, 1.3 * cm, "Grupo GPT-6 AURA · Diplomado DevOps")
        canvas.drawRightString(PAGE_W - MARGEN, 1.3 * cm, f"Página {doc.page}")
        canvas.restoreState()

    def afterFlowable(self, flowable) -> None:
        if isinstance(flowable, Paragraph) and flowable.style.name in ("h1", "h2"):
            nivel = 0 if flowable.style.name == "h1" else 1
            clave = f"s{id(flowable)}"
            self.canv.bookmarkPage(clave)
            self.notify("TOCEntry", (nivel, flowable.getPlainText(), self.page, clave))


def bd_plan(plan: dict) -> str:
    bd = plan["bd"]
    if bd["modo"] == "local":
        return f"PostgreSQL en el mismo servidor, dentro de sus {bd['almacenamiento_gb']} GB"
    if bd["modo"] == "ec2":
        return (
            f"Servidor EC2 {bd['tipo']} propio ({bd['vcpu']} vCPU, {bd['memoria_gib']} GiB), "
            f"{bd['almacenamiento_gb']} GB, accesible solo desde la aplicación"
        )
    return (
        f"Amazon RDS {bd['clase']}, PostgreSQL {bd['version']}, {bd['almacenamiento_gb']} GB, "
        f"respaldo automático de {bd['respaldo_dias']} día"
    )


def dinero(valor: float) -> str:
    return f"US$ {valor:.2f}".replace(".", ",")


def contenido() -> list:
    hoy = date.today()
    meses = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
        "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ]
    fecha = f"{hoy.day} de {meses[hoy.month - 1]} de {hoy.year}"
    h: list = [
        Spacer(1, 4 * cm),
        p("DOCUMENTACIÓN TÉCNICA Y MANUAL DE USUARIO", "portada_titulo"),
        Spacer(1, 0.8 * cm),
        p("PLATAFORMA DE TENANTS «PRESENCIA CLOUD»", "portada_titulo"),
        Spacer(1, 0.6 * cm),
        p("Aprovisionamiento automatizado del sistema de asistencia para múltiples instituciones", "portada"),
        Spacer(1, 3 * cm),
        p("Proyecto final del módulo de DevOps e infraestructura como código", "portada"),
        Spacer(1, 2.2 * cm),
        p("<b>Elaborado por:</b> Grupo GPT-6 AURA", "portada"),
        Spacer(1, 0.3 * cm),
        p("<b>Versión:</b> 2.0", "portada"),
        Spacer(1, 0.3 * cm),
        p(f"<b>Fecha:</b> {fecha}", "portada"),
        NextPageTemplate("contenido"),
        PageBreak(),
    ]
    indice = TableOfContents()
    indice.levelStyles = [S["toc1"], S["toc2"]]
    h += [p("ÍNDICE", "indice"), indice, PageBreak()]

    # 1. Introducción
    h += [
        p("1. INTRODUCCIÓN", "h1"),
        p("1.1. Antecedentes", "h2"),
        p(
            "Presencia es un sistema web de registro de asistencia desarrollado por el grupo para una "
            "institución. Cuando otras instituciones quieren usar el mismo sistema, instalarlo a mano para "
            "cada una es lento, propenso a errores y difícil de mantener. Este proyecto convierte Presencia "
            "en un servicio: una plataforma de administración crea, para cada institución, una copia "
            "independiente del sistema, llamada <b>tenant</b>, con su propia infraestructura en la nube."
        ),
        p("1.2. Objetivo general", "h2"),
        p(
            "Construir una plataforma que aprovisione, configure, administre y monitoree tenants aislados de "
            "Presencia en Amazon Web Services, aplicando infraestructura como código de punta a punta."
        ),
        p("1.3. Objetivos específicos", "h2"),
        vinetas(
            [
                "Ofrecer un catálogo de planes con recursos definidos y elegir el plan al crear un tenant.",
                "Aprovisionar la red, los servidores y la base de datos con dos motores intercambiables: "
                "Terraform y Pulumi.",
                "Desplegar la aplicación desde una imagen preparada con Packer y Ansible, y configurarla con "
                "cloud-init y su conexión a la base de datos.",
                "Mostrar el progreso y los errores de forma comprensible, y permitir reintentar sin duplicar "
                "recursos.",
                "Suspender, reanudar y eliminar tenants manteniendo el control de costos.",
                "Monitorear la salud de cada tenant con Prometheus y Grafana, con alertas.",
                "Garantizar el aislamiento entre tenants y la protección de credenciales.",
            ]
        ),
        p("1.4. Alcance", "h2"),
        p(
            "Incluye la plataforma (consola web, API, procesamiento en segundo plano y monitoreo), los tres "
            "planes, los dos motores de aprovisionamiento, el ciclo de vida completo de los tenants, el "
            "escaneo de seguridad previo y el despliegue de la propia plataforma en AWS. Según lo acordado con "
            "el docente, quedan fuera la edición del catálogo desde la interfaz, la imposición de límites "
            "por plan, la migración entre planes y los respaldos o restauraciones manuales."
        ),
        PageBreak(),
    ]

    # 2. Descripción general
    h += [
        p("2. DESCRIPCIÓN GENERAL DE LA SOLUCIÓN", "h1"),
        p("2.1. Concepto de tenant", "h2"),
        p(
            "Un tenant es la instalación de Presencia de una institución. Cada uno tiene su propia red privada "
            "(VPC), su firewall, sus servidores, su base de datos, sus credenciales y su dirección web fija. "
            "Los usuarios de una institución no pueden acceder a los datos de otra. Al ingresar, el sistema "
            "se presenta con el nombre y la sigla de la institución."
        ),
        p("2.2. Actores", "h2"),
        tabla(
            "Actores del sistema",
            [
                ["Actor", "Descripción"],
                [
                    "Administrador de la plataforma",
                    "Crea y administra los tenants de todas las instituciones desde la consola.",
                ],
                [
                    "Administrador del tenant",
                    "Persona de la institución que gestiona estudiantes, horarios y asistencia en su Presencia.",
                ],
                ["Estudiante", "Registra su asistencia en el tenant de su institución."],
            ],
            [0.32, 0.68],
        ),
        p("2.3. Casos de uso", "h2"),
        tabla(
            "Casos de uso del administrador de la plataforma",
            [
                ["Código", "Caso de uso", "Descripción"],
                ["CU-01", "Consultar el catálogo de planes", "Ver Básico, Estándar y Avanzado con sus recursos."],
                ["CU-02", "Crear tenant", "Registrar la institución, elegir plan y motor."],
                ["CU-03", "Seguir el aprovisionamiento", "Ver el log en vivo, el resultado y los errores."],
                ["CU-04", "Consultar y buscar tenants", "Filtrar por nombre, estado, plan y entorno; editar el nombre."],
                ["CU-05", "Suspender tenant", "Apagar los recursos y conservar los datos."],
                ["CU-06", "Reanudar tenant", "Volver a encender en la misma dirección."],
                ["CU-07", "Eliminar tenant", "Mostrar qué se borra y pedir confirmación."],
                ["CU-08", "Consultar la salud en Grafana", "Tablero por tenant y por entorno."],
                ["CU-09", "Ver alertas y eventos", "Alerta con el tenant afectado y la hora."],
                ["CU-10", "Reintentar una operación fallida", "Continuar sin duplicar recursos."],
                ["CU-14", "Verificar el aislamiento", "Comprobar que un tenant no accede a otro."],
            ],
            [0.13, 0.32, 0.55],
        ),
        p("2.4. Glosario", "h2"),
        tabla(
            "Términos utilizados",
            [
                ["Término", "Significado"],
                ["Tenant", "Instalación independiente de Presencia para una institución."],
                ["Plan", "Tamaño del tenant: capacidad de cómputo, almacenamiento y base de datos."],
                ["Motor", "Herramienta de infraestructura como código que crea los recursos: Terraform o Pulumi."],
                ["AMI", "Imagen de servidor de AWS; la «imagen dorada» trae Presencia ya instalada."],
                ["VPC", "Red privada virtual de AWS; cada tenant tiene la suya."],
                ["SSM Parameter Store", "Almacén cifrado de AWS donde se guardan las contraseñas."],
                ["Operación", "Tarea sobre un tenant: crear, suspender, reanudar o eliminar."],
            ],
            [0.28, 0.72],
        ),
        PageBreak(),
    ]

    # 3. Arquitectura
    h += [
        p("3. ARQUITECTURA", "h1"),
        p("3.1. Vista general", "h2"),
        p(
            "La plataforma se ejecuta en una instancia EC2 propia y crea los tenants en la misma cuenta de "
            "AWS. Sus componentes corren en contenedores Docker orquestados con Docker Compose. El estado de "
            "Terraform y de Pulumi se guarda en S3 y los secretos en SSM Parameter Store."
        ),
        figura(DIAGRAMAS / "plataforma-arquitectura.png", "Arquitectura de la plataforma y de los tenants."),
        p("3.2. Componentes", "h2"),
        tabla(
            "Componentes de la plataforma",
            [
                ["Componente", "Tecnología", "Responsabilidad"],
                ["Consola web", "Next.js 16, React 19, shadcn/ui", "Landing con planes, panel, gestión de tenants."],
                ["API", "FastAPI, SQLAlchemy", "Catálogo, tenants, operaciones, log, alertas y eventos."],
                ["Worker", "Python, Terraform, Pulumi", "Ejecuta las operaciones en segundo plano."],
                ["Base de la plataforma", "PostgreSQL 18", "Tenants, operaciones y su log."],
                ["Escáneres", "gitleaks, checkov", "Secretos y buenas prácticas antes de aprovisionar."],
                ["Monitoreo", "Prometheus, Grafana", "Métricas, tablero y alertas por tenant."],
                ["Imagen dorada", "Packer, Ansible", "AMI con Presencia, Nginx, PostgreSQL y node_exporter."],
                ["Configuración inicial", "cloud-init", "Datos del tenant y llamada al script de arranque."],
            ],
            [0.24, 0.3, 0.46],
        ),
        CondPageBreak(12 * cm),
        p("3.3. Flujo de creación de un tenant", "h2"),
        p(
            "Al confirmar el formulario, la API registra el tenant y encola la operación. El worker la toma, "
            "busca la última imagen dorada, ejecuta los escáneres y luego el motor elegido. Cuando los "
            "servidores arrancan, cloud-init invoca el script que lee los secretos, prepara la base de datos, "
            "aplica las migraciones, crea el administrador y enciende la aplicación. El worker espera a que la "
            "aplicación responda y marca el tenant como activo."
        ),
        figura(DIAGRAMAS / "plataforma-secuencia-crear.png", "Secuencia de creación de un tenant.", alto_max=17 * cm),
        PageBreak(),
    ]

    # 4. Catálogo de planes
    filas = [["Plan", "Servidor de la aplicación", "Base de datos", "Estudiantes", "Costo por día"]]
    for plan in PLANES.values():
        app = plan["app"]
        filas.append(
            [
                f"<b>{plan['nombre']}</b>",
                f"{app['tipo']}: {app['vcpu']} vCPU, {app['memoria_gib']} GiB, disco {app['disco_gb']} GB",
                bd_plan(plan),
                f"Hasta {plan['estudiantes']:,}".replace(",", "."),
                dinero(plan["costo_dia_usd"]),
            ]
        )
    h += [
        p("4. CATÁLOGO DE PLANES", "h1"),
        p(
            "El catálogo se define en un único archivo (plataforma/planes.yaml) que leen la consola, la API, "
            "Terraform y Pulumi, de modo que lo que se ofrece es exactamente lo que se aprovisiona. Los costos "
            "son aproximados en la región us-east-1 con los servidores encendidos."
        ),
        tabla("Catálogo de planes", filas, [0.13, 0.25, 0.32, 0.14, 0.16]),
        tabla(
            "Elementos incluidos en todos los planes",
            [
                ["Elemento", "Detalle"],
                ["Red", "VPC propia, subred, puerta a internet y tabla de rutas."],
                ["Firewall", "Web pública en el puerto 80; métricas solo para la plataforma; sin SSH."],
                ["Dirección fija", "IP elástica: la URL no cambia al suspender y reanudar."],
                ["Credenciales", "Contraseña de base y clave JWT únicas, cifradas en SSM Parameter Store."],
                ["Monitoreo", "node_exporter y métricas de la API, visibles en Grafana."],
                ["Acceso de soporte", "AWS Systems Manager Session Manager, sin puertos abiertos."],
            ],
            [0.25, 0.75],
        ),
        p(
            "Un tenant suspendido solo paga sus discos, la IP elástica y, en el plan Avanzado, el "
            "almacenamiento de la base de datos. La plataforma, en una instancia t3.small, cuesta "
            "aproximadamente US$ 0,70 por día."
        ),
        PageBreak(),
    ]

    # 5. Infraestructura como código
    h += [
        p("5. INFRAESTRUCTURA COMO CÓDIGO", "h1"),
        p("5.1. Imagen dorada con Packer y Ansible", "h2"),
        p(
            f"Packer ({mono('infraestructure/packer')}) levanta una instancia temporal de Ubuntu 24.04 y la "
            f"configura con el playbook de Ansible {mono('imagen.yml')}: instala PostgreSQL, Nginx, "
            "node_exporter, la CLI de AWS, uv y Node.js, copia el código, instala dependencias y compila el "
            "frontend. El resultado es una AMI cifrada y etiquetada con la versión del código, de la cual "
            "arrancan todos los tenants en pocos minutos."
        ),
        p("5.2. Tenant con Terraform", "h2"),
        p(
            f"El módulo raíz {mono('infraestructure/tenant/terraform')} reutiliza los módulos de red y de EC2 "
            "del proyecto. Según el plan crea la base local, un servidor de base o una instancia RDS, y guarda "
            "el estado en S3 con bloqueo nativo, una clave por tenant."
        ),
        p("5.3. Tenant con Pulumi", "h2"),
        p(
            f"El programa en Python {mono('infraestructure/tenant/pulumi')} crea exactamente los mismos "
            "recursos, nombres y etiquetas. Cada institución es un stack y el estado se guarda también en S3."
        ),
        p("5.4. Configuración con cloud-init", "h2"),
        p(
            "La misma plantilla de cloud-init sirve a ambos motores. Solo escribe datos no secretos y ejecuta "
            "el script de arranque, que lee las contraseñas desde SSM con el rol IAM del servidor; ninguna "
            "credencial viaja en los datos de usuario."
        ),
        p("5.5. Despliegue de la plataforma", "h2"),
        p(
            f"El ambiente {mono('infraestructure/environments/plataforma')} crea con Terraform la instancia de "
            "la plataforma, su firewall (solo puerto 80), su IP elástica, sus secretos y un rol IAM con los "
            "permisos mínimos para aprovisionar tenants. Su cloud-init instala Docker, clona el repositorio y "
            "levanta todos los servicios."
        ),
        tabla(
            "Comandos principales",
            [
                ["Acción", "Comando"],
                ["Construir la imagen", mono("packer build -var version_app=$(git describe) .")],
                ["Desplegar la plataforma", mono("terraform apply  (environments/plataforma)")],
                ["Levantar en una PC", mono("docker compose up -d --build  (plataforma)")],
                ["Bajar la plataforma", mono("terraform destroy  (environments/plataforma)")],
            ],
            [0.32, 0.68],
        ),
        PageBreak(),
    ]

    # 6. Seguridad
    h += [
        p("6. SEGURIDAD Y AISLAMIENTO", "h1"),
        tabla(
            "Controles de seguridad",
            [
                ["Control", "Implementación"],
                ["Aislamiento de red", "Una VPC por tenant; sin conexión entre VPC."],
                ["Acceso a la base", "Puerto 5432 solo desde el grupo de seguridad de la aplicación del mismo tenant."],
                ["Sesiones", "Cada tenant firma sus sesiones con su propia clave JWT."],
                ["Secretos", "Generados por el motor y guardados cifrados en SSM; nunca en el repositorio."],
                ["Permisos", "Rol IAM por tenant que solo lee sus propios parámetros."],
                ["Escaneo previo", "gitleaks detiene el despliegue si encuentra secretos; checkov advierte."],
                ["Repositorio", "gitleaks revisa todo el historial en cada push y pull request."],
                ["Servidores", "IMDSv2 obligatorio, discos cifrados y acceso solo por Session Manager."],
            ],
            [0.25, 0.75],
        ),
        p(
            "El aislamiento se verifica con un script automático que intenta, desde un tenant, entrar al otro "
            "con sus credenciales y con su token de sesión, alcanzar la base de datos y la API interna desde "
            "internet y conectarse desde su servidor a los puertos del otro tenant. En la ejecución registrada "
            "se aprobaron las 21 comprobaciones."
        ),
        PageBreak(),
    ]

    # 7. Monitoreo
    h += [
        p("7. MONITOREO Y ALERTAS", "h1"),
        p(
            "Prometheus descubre los servidores encendidos por sus etiquetas de AWS, de modo que los tenants "
            "nuevos aparecen solos y los suspendidos no generan falsas alarmas. Grafana muestra el tablero "
            "«Salud de los tenants», con filtros por entorno y por tenant, y está publicado en "
            f"{mono(URL_PLATAFORMA + '/grafana/d/salud-tenants')}."
        ),
        tabla(
            "Reglas de alerta",
            [
                ["Alerta", "Condición"],
                ["Tenant caído", "Un servidor no responde durante 2 minutos."],
                ["CPU alta", "Uso de procesador mayor a 85 % durante 5 minutos."],
                ["Disco casi lleno", "Uso de disco mayor a 85 % durante 5 minutos."],
                ["Errores 5xx", "Más del 5 % de las peticiones terminan en error durante 5 minutos."],
            ],
            [0.3, 0.7],
        ),
        figura(SHOTS / "plataforma-grafana.png", "Tablero de salud de los tenants en Grafana.", alto_max=17 * cm),
        PageBreak(),
    ]

    # 8. Manual de usuario
    h += [
        p("8. MANUAL DE USUARIO", "h1"),
        p("8.1. Página de inicio y catálogo", "h2"),
        p(
            f"La dirección {mono(URL_PLATAFORMA)} muestra la página de inicio con el catálogo de planes, sus "
            "recursos y su costo. El botón <b>Ingresar a la consola</b> lleva al inicio de sesión."
        ),
        figura(SHOTS / "plataforma-landing.png", "Página de inicio de la plataforma."),
        figura(SHOTS / "plataforma-planes.png", "Catálogo de planes en la página de inicio."),
        p("8.2. Ingreso", "h2"),
        p(
            "Se ingresa con el usuario <b>admin</b> y la contraseña <b>admin1234!</b>. La sesión dura 12 horas "
            "y se cierra desde el menú del usuario, abajo a la izquierda."
        ),
        figura(SHOTS / "plataforma-login.png", "Inicio de sesión de la consola."),
        p("8.3. Panel", "h2"),
        p(
            "El panel resume los tenants activos, suspendidos y con error, el costo estimado por día, las "
            "instituciones, las alertas activas y la actividad reciente. El menú lateral da acceso a todas las "
            "secciones y puede contraerse."
        ),
        figura(SHOTS / "plataforma-panel.png", "Panel de la plataforma."),
        p("8.4. Crear un tenant", "h2"),
        vinetas(
            [
                "Abrir <b>Nuevo tenant</b> y hacer clic en la tarjeta del plan.",
                "Completar el nombre de la institución; el identificador se sugiere solo y no se puede cambiar "
                "después. Indicar el correo, el registro y el nombre del administrador del tenant.",
                "Elegir región, entorno y motor (Terraform o Pulumi) y, si se desea, los datos de ejemplo.",
                "Revisar el resumen con el costo y presionar <b>Crear tenant</b>.",
            ],
            numerada=True,
        ),
        figura(SHOTS / "plataforma-nuevo.png", "Formulario de un nuevo tenant.", alto_max=19 * cm),
        p("8.5. Seguimiento del aprovisionamiento", "h2"),
        p(
            "La creación se ejecuta en segundo plano. La pantalla del tenant muestra el log en vivo con el "
            "escaneo de seguridad, cada recurso creado y la espera hasta que la aplicación responde. Un tenant "
            "Básico o Estándar tarda entre 4 y 6 minutos; uno Avanzado, entre 15 y 20 por la base RDS."
        ),
        figura(SHOTS / "plataforma-progreso.png", "Registro de creación de un tenant con base RDS."),
        tabla(
            "Estados de un tenant",
            [
                ["Estado", "Significado"],
                ["Creando", "Se están creando sus recursos."],
                ["Activo", "Funciona y su dirección se puede usar."],
                ["Suspendiendo / Suspendido", "Se apagan / están apagados sus servidores; los datos se conservan."],
                ["Reanudando", "Se encienden de nuevo."],
                ["Eliminando / Eliminado", "Se borra / se borró su infraestructura."],
                ["Error", "La última operación falló; se puede reintentar."],
            ],
            [0.35, 0.65],
        ),
        p("8.6. Uso del tenant", "h2"),
        p(
            "Cuando el estado es <b>Activo</b> se entrega a la institución su dirección, el registro de su "
            "administrador y la contraseña común <b>admin1234!</b>, que también reciben los estudiantes "
            "importados. La pantalla registra además las versiones usadas en el despliegue."
        ),
        figura(SHOTS / "plataforma-detalle.png", "Detalle de un tenant activo."),
        figura(SHOTS / "tenant-login.png", "Inicio de sesión del tenant con la marca de su institución."),
        p("8.7. Búsqueda y edición", "h2"),
        p(
            "<b>Instituciones</b> lista todos los tenants con búsqueda por nombre o identificador y filtros por "
            "estado, plan y entorno. El lápiz de cada fila permite corregir el nombre de la institución."
        ),
        figura(SHOTS / "plataforma-lista.png", "Lista de instituciones."),
        p("8.8. Suspender, reanudar y eliminar", "h2"),
        p(
            "<b>Suspender</b> apaga los servidores para no pagar por ellos; <b>Reanudar</b> los enciende en la "
            "misma dirección y con todos los datos. <b>Eliminar</b> muestra la lista de recursos que se "
            "borrarán y exige escribir el identificador; la acción no se puede deshacer."
        ),
        figura(SHOTS / "plataforma-eliminar.png", "Confirmación de eliminación con los recursos afectados."),
        p("8.9. Reintentar una operación fallida", "h2"),
        p(
            "Si una operación falla, el tenant queda en estado <b>Error</b> y se muestra la causa en lenguaje "
            "sencillo. Tras corregirla, <b>Reintentar</b> continúa desde el estado guardado sin duplicar lo ya "
            "creado."
        ),
        figura(SHOTS / "plataforma-fallo.png", "Operación fallida con su explicación y su reintento."),
        tabla(
            "Mensajes de error frecuentes",
            [
                ["Mensaje", "Acción"],
                ["Credenciales de AWS no válidas", "Revisar el rol o las credenciales de la plataforma."],
                ["Ya existe un recurso con ese nombre", "Eliminar el recurso ajeno o usar otro identificador."],
                ["Límite de VPC, IP elásticas o vCPU", "Eliminar o suspender tenants que no se usen."],
                ["AWS sin capacidad o tardó demasiado", "Esperar unos minutos y reintentar."],
                ["Secretos escritos en la configuración", "Quitarlos y guardarlos en SSM."],
            ],
            [0.45, 0.55],
        ),
        p("8.10. Alertas y eventos", "h2"),
        p(
            "La sección <b>Alertas y eventos</b> reúne las alertas activas de Grafana, con el tenant y la hora, "
            "y el historial de operaciones de todas las instituciones."
        ),
        figura(SHOTS / "plataforma-eventos.png", "Alertas y eventos recientes."),
        PageBreak(),
    ]

    # 9. Pruebas
    h += [
        p("9. PRUEBAS Y RESULTADOS", "h1"),
        p("Las pruebas se ejecutaron en la cuenta de AWS del proyecto, región us-east-1."),
        tabla(
            "Criterios de aceptación y resultados",
            [
                ["Criterio", "Prueba", "Resultado"],
                ["Crear tenants con distintos planes", "Básico con Terraform, Estándar con Pulumi y Avanzado con RDS", "Aprobado"],
                ["Desplegar frontend, backend y base", "Ingreso del administrador y lista de estudiantes por tenant", "Aprobado"],
                ["Suspender y reanudar", "Servidores detenidos; vuelve en la misma URL con sus datos", "Aprobado"],
                ["Salud en Grafana por tenant", "Métricas de CPU, memoria, disco, peticiones y latencia", "Aprobado"],
                ["Alertas", "Backend detenido: alerta «Tenant caído» con tenant y hora", "Aprobado"],
                ["Aislamiento entre tenants", "Script de 21 comprobaciones", "21 de 21"],
                ["Reintento sin duplicar", "Falla provocada y reintento: solo 6 recursos faltantes, misma VPC", "Aprobado"],
                ["Eliminar tenant", "23 a 30 recursos destruidos y estado borrado", "Aprobado"],
                ["Escaneo de secretos", "gitleaks sobre plantillas, configuración e historial", "Sin hallazgos"],
            ],
            [0.3, 0.52, 0.18],
        ),
        p("10. CONCLUSIONES", "h1"),
        vinetas(
            [
                "La plataforma automatiza de punta a punta la entrega de Presencia a nuevas instituciones: una "
                "institución queda operativa en minutos y con su propia marca.",
                "Definir el catálogo y la infraestructura como código permite que dos motores distintos, "
                "Terraform y Pulumi, produzcan exactamente la misma infraestructura.",
                "La imagen dorada separa la instalación, que se hace una vez, de la configuración de cada "
                "tenant, lo que reduce el tiempo de despliegue.",
                "El aislamiento por VPC, credenciales y claves propias, junto con el escaneo previo, protege los "
                "datos de cada institución.",
                "El monitoreo con descubrimiento automático y las alertas permiten operar varios tenants sin "
                "revisarlos uno por uno.",
            ]
        ),
    ]
    return h


def sin_titulos_huerfanos(historia: list) -> list:
    """Mantiene cada subtítulo en la misma página que el bloque que lo sigue."""
    resultado = []
    i = 0
    while i < len(historia):
        elemento = historia[i]
        es_titulo = isinstance(elemento, Paragraph) and elemento.style.name in ("h1", "h2")
        if es_titulo and i + 1 < len(historia):
            siguiente = historia[i + 1]
            if isinstance(siguiente, Paragraph) and siguiente.style.name == "h2" and i + 2 < len(historia):
                resultado.append(KeepTogether([elemento, siguiente, historia[i + 2]]))
                i += 3
                continue
            resultado.append(KeepTogether([elemento, siguiente]))
            i += 2
            continue
        resultado.append(elemento)
        i += 1
    return resultado


def main() -> None:
    Documento(str(SALIDA)).multiBuild(sin_titulos_huerfanos(contenido()))
    print(f"Generado {SALIDA.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
