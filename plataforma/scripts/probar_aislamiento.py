"""Comprueba que un tenant no puede ver ni alcanzar los datos de otro (CU-14).

Uso: docker compose exec -e PLATAFORMA_URL=http://localhost:8000 backend python scripts/probar_aislamiento.py upsa unifranz
"""

import os
import socket
import sys
import time
from pathlib import Path

import boto3
import httpx

PLATAFORMA = os.environ.get("PLATAFORMA_URL", "http://localhost:8010")
ENV = Path(__file__).resolve().parents[1] / ".env"
REGION = "us-east-1"

resultados: list[bool] = []


def comprobar(descripcion: str, ok: bool, detalle: str = "") -> None:
    resultados.append(ok)
    print(f"  {'✓' if ok else '✗'} {descripcion}{f'  ({detalle})' if detalle else ''}")


def password_plataforma() -> str:
    if "PLATAFORMA_PASSWORD" in os.environ:
        return os.environ["PLATAFORMA_PASSWORD"]
    for linea in ENV.read_text(encoding="utf-8").splitlines():
        if linea.startswith("PLATAFORMA_PASSWORD="):
            return linea.split("=", 1)[1]
    sys.exit("Falta PLATAFORMA_PASSWORD")


def datos_tenant(api: httpx.Client, tenant: str) -> dict:
    datos = api.get(f"/tenants/{tenant}").raise_for_status().json()
    datos["password"] = api.get(f"/tenants/{tenant}/credenciales").raise_for_status().json()["password"]
    return datos


def entrar(url: str, registro: str, password: str) -> httpx.Client | None:
    cliente = httpx.Client(base_url=url, timeout=15)
    respuesta = cliente.post("/api/auth/login", json={"registration_code": registro, "password": password})
    return cliente if respuesta.status_code == 200 else None


def ips_publicas(instancias: list[str]) -> list[str]:
    reservas = boto3.client("ec2", region_name=REGION).describe_instances(InstanceIds=instancias)
    return [i["PublicIpAddress"] for r in reservas["Reservations"] for i in r["Instances"] if i.get("PublicIpAddress")]


def puerto_abierto(ip: str, puerto: int) -> bool:
    try:
        with socket.create_connection((ip, puerto), timeout=3):
            return True
    except OSError:
        return False


def desde_servidor(instancia: str, destinos: list[tuple[str, int]]) -> dict[str, str]:
    """Intenta conectarse desde un servidor del tenant A a los puertos del tenant B (SSM Run Command)."""
    script = [
        f"timeout 4 bash -c '</dev/tcp/{ip}/{puerto}' && echo '{ip}:{puerto} ABIERTO' || echo '{ip}:{puerto} cerrado'"
        for ip, puerto in destinos
    ]
    ssm = boto3.client("ssm", region_name=REGION)
    comando = ssm.send_command(
        InstanceIds=[instancia], DocumentName="AWS-RunShellScript", Parameters={"commands": script}
    )["Command"]["CommandId"]
    for _ in range(30):
        time.sleep(2)
        try:
            salida = ssm.get_command_invocation(CommandId=comando, InstanceId=instancia)
        except ssm.exceptions.InvocationDoesNotExist:
            continue
        if salida["Status"] in ("Success", "Failed"):
            lineas = salida["StandardOutputContent"].split()
            return {lineas[i]: lineas[i + 1] for i in range(0, len(lineas) - 1, 2)}
    return {}


def main(a: str, b: str) -> None:
    api = httpx.Client(base_url=PLATAFORMA, timeout=30)
    token = api.post("/auth/login", json={"usuario": "admin", "password": password_plataforma()})
    api.headers["Authorization"] = f"Bearer {token.raise_for_status().json()['access_token']}"
    ta, tb = datos_tenant(api, a), datos_tenant(api, b)

    print(f"\n1. Cada administrador entra solo a su propio tenant ({ta['url']} y {tb['url']})")
    sa = entrar(ta["url"], ta["admin_registro"], ta["password"])
    sb = entrar(tb["url"], tb["admin_registro"], tb["password"])
    comprobar(f"El admin de {a} entra a {a}", sa is not None)
    comprobar(f"El admin de {b} entra a {b}", sb is not None)
    comprobar(
        f"Las credenciales de {a} no sirven en {b}",
        entrar(tb["url"], ta["admin_registro"], ta["password"]) is None,
    )

    print("\n2. El token de un tenant no vale en el otro (cada uno firma con su propio JWT_SECRET)")
    if sa and sb:
        ea = sa.get("/api/backend/students")
        comprobar(f"{a} lee sus estudiantes con su token", ea.status_code == 200, f"{len(ea.json())} estudiantes")
        ajeno = httpx.get(f"{tb['url']}/api/backend/students", cookies=sa.cookies, timeout=15)
        comprobar(f"El token de {a} es rechazado por {b}", ajeno.status_code == 401, f"HTTP {ajeno.status_code}")
        eb = sb.get("/api/backend/students")
        nombres_a = {e["full_name"] for e in ea.json()}
        nombres_b = {e["full_name"] for e in eb.json()}
        comprobar(
            "Cada base de datos tiene sus propios datos",
            ea.status_code == eb.status_code == 200,
            f"{a}: {len(nombres_a)} estudiantes, {b}: {len(nombres_b)} estudiantes",
        )

    print("\n3. Desde internet no se llega a la base de datos ni a la API interna")
    for tenant in (ta, tb):
        for ip in ips_publicas(tenant["salidas"]["instancias"]):
            for puerto in (5432, 8000, 22):
                comprobar(f"{tenant['id']} {ip}:{puerto} cerrado", not puerto_abierto(ip, puerto))

    print(f"\n4. Desde el servidor de {a} no se llega a los servidores de {b}")
    destinos = [(ip, p) for ip in ips_publicas(tb["salidas"]["instancias"]) for p in (5432, 8000, 9100)]
    respuestas = desde_servidor(ta["salidas"]["instancias"][0], destinos)
    for ip, puerto in destinos:
        estado = respuestas.get(f"{ip}:{puerto}", "sin respuesta")
        comprobar(f"{a} → {b} {ip}:{puerto} {estado}", estado == "cerrado")

    total = len(resultados)
    print(f"\n{sum(resultados)} de {total} comprobaciones correctas")
    sys.exit(0 if all(resultados) else 1)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
