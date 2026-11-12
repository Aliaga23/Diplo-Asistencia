from functools import lru_cache

import yaml

from plataforma.config import get_settings

MOTORES = {
    "terraform": "Terraform",
    "pulumi": "Pulumi",
}


@lru_cache
def catalogo() -> dict[str, dict]:
    datos = yaml.safe_load(get_settings().planes_path.read_text(encoding="utf-8"))
    return {clave: {"id": clave, **plan} for clave, plan in datos.items()}
