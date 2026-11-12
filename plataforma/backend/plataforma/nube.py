"""Operaciones directas en AWS: imagen, suspender, reanudar, recursos y salud del tenant."""

import time
import urllib.request

import boto3
import httpx

from plataforma.errores import ErrorOperacion
from plataforma.motores import Log


def ultima_imagen(region: str) -> dict:
    imagenes = boto3.client("ec2", region_name=region).describe_images(
        Owners=["self"], Filters=[{"Name": "tag:Imagen", "Values": ["presencia"]}]
    )["Images"]
    if not imagenes:
        raise ErrorOperacion(
            f"No hay imagen de Presencia en {region}. Construye la AMI con Packer en esa región."
        )
    imagen = max(imagenes, key=lambda i: i["CreationDate"])
    etiquetas = {t["Key"]: t["Value"] for t in imagen.get("Tags", [])}
    return {"id": imagen["ImageId"], "nombre": imagen["Name"], "version": etiquetas.get("Version")}


def mi_ip() -> str:
    with urllib.request.urlopen("https://checkip.amazonaws.com", timeout=10) as respuesta:
        return respuesta.read().decode().strip()


def esperar_app(url: str, log: Log, minutos: int = 25) -> None:
    log(f"Esperando a que {url}/login responda...")
    limite = time.monotonic() + minutos * 60
    ultimo_aviso = 0.0
    while time.monotonic() < limite:
        try:
            if httpx.get(f"{url}/login", timeout=5).status_code == 200:
                log(f"La aplicación responde en {url}")
                return
        except httpx.HTTPError:
            pass
        if time.monotonic() - ultimo_aviso > 30:
            log("  todavía configurándose...")
            ultimo_aviso = time.monotonic()
        time.sleep(10)
    raise ErrorOperacion(
        f"La aplicación no respondió en {minutos} minutos. Los servidores existen; revisa "
        "/var/log/cloud-init-output.log con Session Manager y reintenta."
    )


def suspender(region: str, salidas: dict, log: Log) -> None:
    ec2 = boto3.client("ec2", region_name=region)
    instancias = salidas.get("instancias") or []
    log(f"Apagando servidores: {', '.join(instancias)}")
    ec2.stop_instances(InstanceIds=instancias)
    ec2.get_waiter("instance_stopped").wait(InstanceIds=instancias)
    log("Servidores apagados. Los discos y los datos se conservan.")
    if salidas.get("rds"):
        rds = boto3.client("rds", region_name=region)
        log(f"Deteniendo la base RDS {salidas['rds']}")
        rds.stop_db_instance(DBInstanceIdentifier=salidas["rds"])
        _esperar_rds(rds, salidas["rds"], "stopped", log)


def reanudar(region: str, salidas: dict, log: Log) -> None:
    if salidas.get("rds"):
        rds = boto3.client("rds", region_name=region)
        log(f"Encendiendo la base RDS {salidas['rds']} (tarda unos minutos)")
        rds.start_db_instance(DBInstanceIdentifier=salidas["rds"])
        _esperar_rds(rds, salidas["rds"], "available", log)
    ec2 = boto3.client("ec2", region_name=region)
    instancias = salidas.get("instancias") or []
    log(f"Encendiendo servidores: {', '.join(instancias)}")
    ec2.start_instances(InstanceIds=instancias)
    ec2.get_waiter("instance_running").wait(InstanceIds=instancias)
    log("Servidores encendidos.")


def _esperar_rds(rds, identificador: str, estado: str, log: Log) -> None:
    for _ in range(120):
        actual = rds.describe_db_instances(DBInstanceIdentifier=identificador)["DBInstances"][0][
            "DBInstanceStatus"
        ]
        if actual == estado:
            log(f"RDS {identificador}: {estado}")
            return
        time.sleep(15)
    raise ErrorOperacion(f"La base RDS no llegó al estado «{estado}» en 30 minutos.")


TIPOS = {
    "ec2:instance": "Servidor EC2",
    "ec2:volume": "Disco",
    "ec2:elastic-ip": "IP elástica",
    "ec2:vpc": "Red (VPC)",
    "ec2:subnet": "Subred",
    "ec2:security-group": "Grupo de seguridad",
    "ec2:security-group-rule": "Regla de firewall",
    "iam:instance-profile": "Perfil IAM del servidor",
    "ec2:internet-gateway": "Puerta a internet",
    "ec2:route-table": "Tabla de rutas",
    "rds:db": "Base de datos RDS",
    "rds:subgrp": "Grupo de subredes RDS",
    "ssm:parameter": "Secreto (SSM)",
}


def recursos(region: str, tenant: str) -> list[dict]:
    cliente = boto3.client("resourcegroupstaggingapi", region_name=region)
    resultado = []
    for pagina in cliente.get_paginator("get_resources").paginate(
        TagFilters=[
            {"Key": "Tenant", "Values": [tenant]},
            {"Key": "Proyecto", "Values": ["presencia-plataforma"]},
        ]
    ):
        for recurso in pagina["ResourceTagMappingList"]:
            arn = recurso["ResourceARN"]
            servicio, resto = arn.split(":")[2], arn.split(":", 5)[5]
            tipo = resto.split("/")[0].split(":")[0]
            etiquetas = {t["Key"]: t["Value"] for t in recurso.get("Tags", [])}
            resultado.append(
                {
                    "tipo": TIPOS.get(f"{servicio}:{tipo}", f"{servicio}:{tipo}"),
                    "nombre": etiquetas.get("Name") or resto.split("/")[-1],
                    "arn": arn,
                }
            )
    return sorted(resultado, key=lambda r: (r["tipo"], r["nombre"]))
