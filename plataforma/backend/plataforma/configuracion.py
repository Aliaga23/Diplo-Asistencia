"""Configuración posterior de los servidores del tenant con Ansible.

La plataforma tiene su propio par de claves SSH (en el volumen de datos). La clave pública se instala
en cada servidor al crearlo (aws_key_pair) y el puerto 22 solo se abre para la IP de la plataforma.
"""

import json
import subprocess
import tempfile
from pathlib import Path

from plataforma.config import get_settings
from plataforma.motores import Log, ejecutar, version_herramienta


def ruta_clave() -> Path:
    return get_settings().datos_dir / "ssh" / "plataforma"


def clave_publica() -> str:
    clave = ruta_clave()
    if not clave.exists():
        clave.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "presencia-plataforma", "-f", str(clave)],
            check=True,
        )
    return clave.with_suffix(".pub").read_text(encoding="utf-8").strip()


def version() -> str:
    lineas = version_herramienta(["ansible", "--version"]).splitlines()
    return lineas[0] if lineas else "no instalado"


def configurar(tenant: str, servidores: dict, plataforma_cidr: str, log: Log) -> None:
    playbook = get_settings().repo_dir / "infraestructure" / "ansible" / "tenant.yml"
    with tempfile.TemporaryDirectory() as tmp:
        inventario = Path(tmp) / "hosts.ini"
        lineas = []
        for rol, ip in servidores.items():
            if ip:
                lineas += [f"[{rol}]", f"{tenant}-{rol} ansible_host={ip} rol={rol}", ""]
        inventario.write_text("\n".join(lineas), encoding="utf-8")

        variables = Path(tmp) / "variables.json"
        variables.write_text(
            json.dumps(
                {"tenant": tenant, "plataforma_cidr": plataforma_cidr, "clave_publica": clave_publica()}
            ),
            encoding="utf-8",
        )
        ejecutar(
            [
                "ansible-playbook",
                "-i",
                str(inventario),
                str(playbook),
                "-u",
                "ubuntu",
                "--private-key",
                str(ruta_clave()),
                "-e",
                f"@{variables}",
            ],
            log,
            {
                "ANSIBLE_HOST_KEY_CHECKING": "False",
                "ANSIBLE_NOCOLOR": "1",
                "ANSIBLE_DEPRECATION_WARNINGS": "False",
                "ANSIBLE_PIPELINING": "True",
                "ANSIBLE_SSH_RETRIES": "5",
                "ANSIBLE_PYTHON_INTERPRETER": "auto_silent",
                "ANSIBLE_SSH_ARGS": "-o ControlMaster=auto -o ControlPersist=60s -o ConnectTimeout=20",
            },
        )
