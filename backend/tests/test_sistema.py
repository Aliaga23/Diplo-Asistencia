from tests.conftest import login


def test_estado_de_los_servicios(client, admin):
    r = client.get("/api/v1/sistema/estado", headers=login(client, admin.registration_code))
    assert r.status_code == 200
    datos = r.json()
    assert datos["api"] is True
    assert datos["base_datos"] is True
    assert datos["latencia_bd_ms"] is not None


def test_estado_requiere_administrador(client):
    assert client.get("/api/v1/sistema/estado").status_code == 401


def test_metrica_de_la_base_de_datos(client):
    lineas = client.get("/metrics").text.splitlines()
    assert "presencia_base_datos_arriba 1.0" in lineas
