"""Ejecuta Terraform o Pulumi para un tenant y devuelve sus salidas."""

import json
import os
import re
import shutil
import subprocess
from collections import deque
from collections.abc import Callable
from pathlib import Path

import boto3
import yaml

from plataforma.config import get_settings
from plataforma.errores import ErrorOperacion, explicar

Log = Callable[[str], None]

BUCKET_ESTADO = "presencia-tfstate-aliaga23"
PROGRESO = re.compile(r"^@ \w+\.*$")


def ejecutar(cmd: list[str], log: Log, env: dict | None = None, mostrar: bool = True) -> str:
    """Corre un comando, manda cada línea al log y falla con un mensaje comprensible."""
    log(f"$ {' '.join(cmd)}")
    proceso = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        env={**os.environ, **(env or {})},
    )
    salida: list[str] = []
    ultimas: deque[str] = deque(maxlen=60)
    assert proceso.stdout is not None
    for linea in proceso.stdout:
        linea = linea.rstrip()
        salida.append(linea)
        ultimas.append(linea)
        if mostrar and not PROGRESO.match(linea):
            log(linea)
    if proceso.wait() != 0:
        texto = "\n".join(ultimas)
        if not mostrar:
            for linea in ultimas:
                log(linea)
        mensaje = explicar(texto) or f"Falló «{cmd[0]} {cmd[1]}». Revisa el log de la operación."
        raise ErrorOperacion(mensaje)
    return "\n".join(salida)


def version_herramienta(cmd: list[str]) -> str:
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=30).stdout.strip()
    except OSError:
        return "no instalado"


class Motor:
    nombre = ""

    def __init__(self, tenant: str, variables: dict, log: Log):
        self.tenant = tenant
        self.variables = variables
        self.log = log
        self.datos = get_settings().datos_dir / self.nombre / tenant
        self.datos.mkdir(parents=True, exist_ok=True)

    def aplicar(self) -> dict: ...
    def destruir(self) -> None: ...
    def version(self) -> str: ...


class Terraform(Motor):
    nombre = "terraform"

    @property
    def carpeta(self) -> Path:
        return get_settings().tenant_dir / "terraform"

    @property
    def env(self) -> dict:
        cache = get_settings().datos_dir / "terraform-plugins"
        cache.mkdir(parents=True, exist_ok=True)
        return {
            "TF_DATA_DIR": str(self.datos / ".terraform"),
            "TF_PLUGIN_CACHE_DIR": str(cache),
            "TF_IN_AUTOMATION": "1",
            "TF_INPUT": "0",
        }

    @property
    def clave_estado(self) -> str:
        return f"tenants/{self.tenant}/terraform.tfstate"

    def _tf(self, *args: str, mostrar: bool = True) -> str:
        cmd = ["terraform", f"-chdir={self.carpeta}", *args]
        return ejecutar(cmd, self.log, self.env, mostrar)

    def _preparar(self) -> Path:
        archivo = self.datos / "tenant.tfvars.json"
        archivo.write_text(json.dumps(self.variables, indent=2), encoding="utf-8")
        self._tf(
            "init",
            "-no-color",
            "-reconfigure",
            "-lockfile=readonly",
            f"-backend-config=key={self.clave_estado}",
        )
        return archivo

    def aplicar(self) -> dict:
        archivo = self._preparar()
        self._tf("apply", "-auto-approve", "-no-color", f"-var-file={archivo}")
        salidas = json.loads(self._tf("output", "-json", "-no-color", mostrar=False))
        return {clave: valor["value"] for clave, valor in salidas.items()}

    def destruir(self) -> None:
        archivo = self._preparar()
        self._tf("destroy", "-auto-approve", "-no-color", f"-var-file={archivo}")
        boto3.client("s3").delete_object(Bucket=BUCKET_ESTADO, Key=self.clave_estado)
        shutil.rmtree(self.datos, ignore_errors=True)

    def version(self) -> str:
        texto = version_herramienta(["terraform", "version", "-json"])
        try:
            return json.loads(texto)["terraform_version"]
        except ValueError, KeyError:
            return texto


class Pulumi(Motor):
    nombre = "pulumi"

    CLAVES = {
        "tenant": "tenant",
        "institucion": "institucion",
        "plan": "plan",
        "entorno": "entorno",
        "cuenta_aws": "cuentaAws",
        "admin_cidrs": "adminCidrs",
        "admin_registro": "adminRegistro",
        "admin_nombre": "adminNombre",
        "admin_correo": "adminCorreo",
        "datos_demo": "datosDemo",
        "ami_id": "amiId",
    }

    @property
    def carpeta(self) -> Path:
        return get_settings().tenant_dir / "pulumi"

    @property
    def stack(self) -> str:
        return f"tenant-{self.tenant}"

    @property
    def archivo_config(self) -> Path:
        return self.datos / f"Pulumi.{self.stack}.yaml"

    def _pulumi(self, *args: str, mostrar: bool = True) -> str:
        cmd = [
            "pulumi",
            *args,
            "--cwd",
            str(self.carpeta),
            "--stack",
            self.stack,
            "--non-interactive",
            "--color",
            "never",
        ]
        return ejecutar(cmd, self.log, {"PULUMI_SKIP_UPDATE_CHECK": "true"}, mostrar)

    def _preparar(self) -> None:
        existentes = ejecutar(
            ["pulumi", "stack", "ls", "--json", "--cwd", str(self.carpeta)], self.log, mostrar=False
        )
        if self.stack not in {s["name"].split("/")[-1] for s in json.loads(existentes or "[]")}:
            self._pulumi("stack", "init")
            creado = self.carpeta / f"Pulumi.{self.stack}.yaml"
            shutil.move(creado, self.archivo_config)

        actual = {}
        if self.archivo_config.exists():
            actual = yaml.safe_load(self.archivo_config.read_text(encoding="utf-8")) or {}
        config = {"aws:region": self.variables["region"]}
        for clave, nombre in self.CLAVES.items():
            config[f"presencia-tenant:{nombre}"] = self.variables[clave]
        actual["config"] = config
        self.archivo_config.write_text(yaml.safe_dump(actual, allow_unicode=True), encoding="utf-8")

    def aplicar(self) -> dict:
        self._preparar()
        self._pulumi("up", "--yes", "--skip-preview", "--config-file", str(self.archivo_config))
        return json.loads(self._pulumi("stack", "output", "--json", mostrar=False))

    def destruir(self) -> None:
        self._preparar()
        self._pulumi("destroy", "--yes", "--skip-preview", "--config-file", str(self.archivo_config))
        self._pulumi("stack", "rm", "--yes")
        shutil.rmtree(self.datos, ignore_errors=True)

    def version(self) -> str:
        return version_herramienta(["pulumi", "version"])


MOTORES: dict[str, type[Motor]] = {"terraform": Terraform, "pulumi": Pulumi}
