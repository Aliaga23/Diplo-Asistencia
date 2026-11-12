"""Escaneo de seguridad antes de aprovisionar: secretos con gitleaks y configuración con checkov."""

import json
import re
import tempfile
from pathlib import Path

from plataforma.config import get_settings
from plataforma.errores import ErrorOperacion
from plataforma.motores import Log, ejecutar


def escanear(variables: dict, log: Log) -> None:
    carpeta = get_settings().tenant_dir
    with tempfile.TemporaryDirectory() as tmp:
        config = Path(tmp) / "tenant.json"
        config.write_text(json.dumps(variables, indent=2), encoding="utf-8")

        log("== Escaneo de secretos (gitleaks) ==")
        for objetivo in (carpeta, config):
            try:
                ejecutar(
                    ["gitleaks", "dir", str(objetivo), "--no-banner", "--no-color", "--redact", "--verbose"],
                    log,
                )
            except ErrorOperacion as error:
                raise ErrorOperacion(
                    f"Se encontraron credenciales o secretos escritos en {objetivo}. Bórralos y "
                    "guárdalos en SSM Parameter Store antes de aprovisionar."
                ) from error
        log("Sin secretos en las plantillas ni en la configuración del tenant.")

    log("== Escaneo de configuración (checkov) ==")
    salida = ejecutar(
        [
            "checkov",
            "-d",
            str(carpeta / "terraform"),
            "--framework",
            "terraform",
            "--compact",
            "--quiet",
            "--soft-fail",
            "--skip-download",
        ],
        log,
    )
    fallas = re.search(r"Failed checks: (\d+)", salida)
    if fallas and int(fallas.group(1)) > 0:
        log(f"Advertencia: checkov marcó {fallas.group(1)} recomendaciones (no bloquean).")
