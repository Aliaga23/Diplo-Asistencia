"""Un tenant de Presencia con Pulumi: los mismos recursos, nombres y etiquetas que tenant/terraform.

El plan sale de plataforma/planes.yaml y los servidores se configuran con la misma plantilla
cloud-init (tenant/cloud-init/servidor.yaml.tftpl) que usa Terraform.
"""

import json
import re
from pathlib import Path

import pulumi
import pulumi_aws as aws
import pulumi_random as random
import yaml

RAIZ = Path(__file__).resolve().parents[3]
CATALOGO = yaml.safe_load((RAIZ / "plataforma" / "planes.yaml").read_text(encoding="utf-8"))
PLANTILLA = (RAIZ / "infraestructure" / "tenant" / "cloud-init" / "servidor.yaml.tftpl").read_text(
    encoding="utf-8"
)

VPC_CIDR = "10.0.0.0/16"
SUBRED_APP = "10.0.1.0/24"
SUBREDES_RDS = ["10.0.11.0/24", "10.0.12.0/24"]
IP_APP = "10.0.1.10"
IP_BD = "10.0.1.30"
PUERTOS_SALIDA = {"http": (80, "tcp"), "https": (443, "tcp"), "ntp": (123, "udp")}

config = pulumi.Config()
tenant = config.require("tenant")
if not re.fullmatch(r"[a-z][a-z0-9-]{2,19}", tenant):
    raise ValueError("El identificador usa de 3 a 20 letras minusculas, numeros o guiones.")
institucion = config.require("institucion")
plan_id = config.require("plan")
if plan_id not in CATALOGO:
    raise ValueError("El plan debe ser basico, estandar o avanzado.")
entorno = config.get("entorno") or "produccion"
region = aws.config.region or "us-east-1"
admin_cidrs = config.require_object("adminCidrs")
admin_registro = config.require("adminRegistro")
admin_nombre = config.require("adminNombre")
admin_correo = config.require("adminCorreo")
datos_demo = config.get_bool("datosDemo") or False
ami_config = config.get("amiId") or ""

plan = CATALOGO[plan_id]
bd_modo = plan["bd"]["modo"]
prefijo = f"presencia-{tenant}"

proveedor = aws.Provider(
    "aws",
    region=region,
    allowed_account_ids=[config.require("cuentaAws")],
    default_tags=aws.ProviderDefaultTagsArgs(
        tags={
            "Proyecto": "presencia-plataforma",
            "Tenant": tenant,
            "Plan": plan_id,
            "Entorno": entorno,
            "ManagedBy": "Pulumi",
        }
    ),
)
opts = pulumi.ResourceOptions(provider=proveedor)
invoke = pulumi.InvokeOptions(provider=proveedor)


def nombre(sufijo: str) -> dict[str, str]:
    return {"Name": f"{prefijo}-{sufijo}"}


def cloud_init(rol: str, bd_host: str) -> str:
    valores = {
        "tenant": tenant,
        "institucion": institucion,
        "region": region,
        "vpc_cidr": VPC_CIDR,
        "admin_registro": admin_registro,
        "admin_nombre": admin_nombre,
        "admin_correo": admin_correo,
        "datos_demo": "true" if datos_demo else "false",
        "bd_modo": bd_modo,
        "rol": rol,
        "bd_host": bd_host,
    }
    texto = PLANTILLA
    for clave, valor in valores.items():
        texto = texto.replace(f"${{{clave}}}", valor)
    return texto


zonas = aws.get_availability_zones(state="available", opts=invoke).names
cuenta = aws.get_caller_identity(opts=invoke).account_id
ami_id = (
    ami_config
    or aws.ec2.get_ami(
        most_recent=True,
        owners=["self"],
        filters=[aws.ec2.GetAmiFilterArgs(name="tag:Imagen", values=["presencia"])],
        opts=invoke,
    ).id
)

# Red: los mismos recursos que modules/network
vpc = aws.ec2.Vpc(
    "vpc",
    cidr_block=VPC_CIDR,
    enable_dns_support=True,
    enable_dns_hostnames=True,
    tags=nombre("vpc"),
    opts=opts,
)
igw = aws.ec2.InternetGateway("igw", vpc_id=vpc.id, tags=nombre("igw"), opts=opts)
subred = aws.ec2.Subnet(
    "public-subnet",
    vpc_id=vpc.id,
    cidr_block=SUBRED_APP,
    availability_zone=zonas[0],
    map_public_ip_on_launch=False,
    tags=nombre("public-subnet"),
    opts=opts,
)
rutas = aws.ec2.RouteTable(
    "public-rt",
    vpc_id=vpc.id,
    routes=[aws.ec2.RouteTableRouteArgs(cidr_block="0.0.0.0/0", gateway_id=igw.id)],
    tags=nombre("public-rt"),
    opts=opts,
)
aws.ec2.RouteTableAssociation("public-rt-assoc", subnet_id=subred.id, route_table_id=rutas.id, opts=opts)

# Grupos de seguridad
sg_app = aws.ec2.SecurityGroup(
    "app-sg",
    name=f"{prefijo}-app",
    description=f"App de {tenant}: web publica y metricas para la plataforma",
    vpc_id=vpc.id,
    tags=nombre("app"),
    opts=opts,
)
aws.vpc.SecurityGroupIngressRule(
    "app-http",
    security_group_id=sg_app.id,
    cidr_ipv4="0.0.0.0/0",
    ip_protocol="tcp",
    from_port=80,
    to_port=80,
    description="Aplicacion web",
    opts=opts,
)
for cidr in admin_cidrs:
    aws.vpc.SecurityGroupIngressRule(
        f"app-metricas-{cidr}",
        security_group_id=sg_app.id,
        cidr_ipv4=cidr,
        ip_protocol="tcp",
        from_port=9100,
        to_port=9101,
        description="node_exporter y metricas de la API",
        opts=opts,
    )
for clave, (puerto, protocolo) in PUERTOS_SALIDA.items():
    aws.vpc.SecurityGroupEgressRule(
        f"app-internet-{clave}",
        security_group_id=sg_app.id,
        cidr_ipv4="0.0.0.0/0",
        ip_protocol=protocolo,
        from_port=puerto,
        to_port=puerto,
        description=f"Salida {clave}",
        opts=opts,
    )

sg_bd = None
if bd_modo != "local":
    sg_bd = aws.ec2.SecurityGroup(
        "bd-sg",
        name=f"{prefijo}-bd",
        description=f"Base de datos de {tenant}: solo desde la app",
        vpc_id=vpc.id,
        tags=nombre("bd"),
        opts=opts,
    )
    aws.vpc.SecurityGroupEgressRule(
        "app-bd",
        security_group_id=sg_app.id,
        referenced_security_group_id=sg_bd.id,
        ip_protocol="tcp",
        from_port=5432,
        to_port=5432,
        description="PostgreSQL del tenant",
        opts=opts,
    )
    aws.vpc.SecurityGroupIngressRule(
        "bd-postgres",
        security_group_id=sg_bd.id,
        referenced_security_group_id=sg_app.id,
        ip_protocol="tcp",
        from_port=5432,
        to_port=5432,
        description="PostgreSQL desde la app",
        opts=opts,
    )
if bd_modo == "ec2":
    for cidr in admin_cidrs:
        aws.vpc.SecurityGroupIngressRule(
            f"bd-metricas-{cidr}",
            security_group_id=sg_bd.id,
            cidr_ipv4=cidr,
            ip_protocol="tcp",
            from_port=9100,
            to_port=9100,
            description="node_exporter",
            opts=opts,
        )
    for clave, (puerto, protocolo) in PUERTOS_SALIDA.items():
        aws.vpc.SecurityGroupEgressRule(
            f"bd-internet-{clave}",
            security_group_id=sg_bd.id,
            cidr_ipv4="0.0.0.0/0",
            ip_protocol=protocolo,
            from_port=puerto,
            to_port=puerto,
            description=f"Salida {clave}",
            opts=opts,
        )

# Secretos del tenant en SSM: los servidores los leen al arrancar
pw_bd = random.RandomPassword("bd", length=32, special=False)
pw_jwt = random.RandomPassword("jwt", length=64, special=False)
pw_admin = random.RandomPassword("admin", length=16, special=False)
secretos = [
    aws.ssm.Parameter(
        clave,
        name=f"/presencia/tenants/{tenant}/{clave}",
        type="SecureString",
        value=valor.result,
        opts=opts,
    )
    for clave, valor in {"bd_password": pw_bd, "jwt_secret": pw_jwt, "admin_password": pw_admin}.items()
]

rol = aws.iam.Role(
    "servidor-role",
    name=f"{prefijo}-servidor",
    assume_role_policy=json.dumps(
        {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"Service": "ec2.amazonaws.com"},
                    "Action": "sts:AssumeRole",
                }
            ],
        }
    ),
    opts=opts,
)
politica = aws.iam.RolePolicy(
    "leer-secretos",
    name="leer-secretos-del-tenant",
    role=rol.id,
    policy=json.dumps(
        {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": "ssm:GetParameter",
                    "Resource": f"arn:aws:ssm:{region}:{cuenta}:parameter/presencia/tenants/{tenant}/*",
                }
            ],
        }
    ),
    opts=opts,
)
aws.iam.RolePolicyAttachment(
    "ssm-core",
    role=rol.name,
    policy_arn="arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
    opts=opts,
)
perfil = aws.iam.InstanceProfile("servidor-profile", name=f"{prefijo}-servidor", role=rol.name, opts=opts)


def servidor(rol_servidor: str, tipo: str, ip: str, disco: int, sgs, user_data, depende) -> aws.ec2.Instance:
    """Igual que modules/ec2: IMDSv2, disco gp3 cifrado y creditos T3 estandar."""
    return aws.ec2.Instance(
        rol_servidor,
        ami=ami_id,
        instance_type=tipo,
        subnet_id=subred.id,
        private_ip=ip,
        associate_public_ip_address=True,
        vpc_security_group_ids=sgs,
        iam_instance_profile=perfil.name,
        user_data=user_data,
        credit_specification=aws.ec2.InstanceCreditSpecificationArgs(cpu_credits="standard"),
        metadata_options=aws.ec2.InstanceMetadataOptionsArgs(http_endpoint="enabled", http_tokens="required"),
        root_block_device=aws.ec2.InstanceRootBlockDeviceArgs(
            volume_type="gp3", volume_size=disco, encrypted=True, delete_on_termination=True
        ),
        tags={"Name": f"{prefijo}-{rol_servidor}", "Role": rol_servidor},
        opts=pulumi.ResourceOptions(provider=proveedor, depends_on=depende, ignore_changes=["ami"]),
    )


instancias = []
rds = None
bd_host: pulumi.Input[str] = "127.0.0.1"

if bd_modo == "ec2":
    bd = servidor(
        "bd",
        plan["bd"]["tipo"],
        IP_BD,
        plan["bd"]["almacenamiento_gb"],
        [sg_bd.id],
        cloud_init("bd", ""),
        secretos,
    )
    instancias.append(bd.id)
    bd_host = IP_BD

if bd_modo == "rds":
    subredes_rds = [
        aws.ec2.Subnet(
            f"rds-{i + 1}",
            vpc_id=vpc.id,
            cidr_block=cidr,
            availability_zone=zonas[i],
            tags=nombre(f"rds-{i + 1}"),
            opts=opts,
        )
        for i, cidr in enumerate(SUBREDES_RDS)
    ]
    grupo = aws.rds.SubnetGroup(
        "bd-subnets", name=f"{prefijo}-bd", subnet_ids=[s.id for s in subredes_rds], opts=opts
    )
    rds = aws.rds.Instance(
        "bd",
        identifier=prefijo,
        engine="postgres",
        engine_version=str(plan["bd"]["version"]),
        instance_class=plan["bd"]["clase"],
        allocated_storage=plan["bd"]["almacenamiento_gb"],
        storage_type="gp3",
        storage_encrypted=True,
        db_name="asistencia",
        username="asistencia",
        password=pw_bd.result,
        db_subnet_group_name=grupo.name,
        vpc_security_group_ids=[sg_bd.id],
        publicly_accessible=False,
        backup_retention_period=plan["bd"]["respaldo_dias"],
        skip_final_snapshot=True,
        deletion_protection=False,
        apply_immediately=True,
        opts=opts,
    )
    bd_host = rds.address

app = servidor(
    "app",
    plan["app"]["tipo"],
    IP_APP,
    plan["app"]["disco_gb"],
    [sg_app.id],
    pulumi.Output.from_input(bd_host).apply(lambda host: cloud_init("app", host)),
    [*secretos, politica],
)
instancias.insert(0, app.id)

ip = aws.ec2.Eip("app-eip", domain="vpc", instance=app.id, tags=nombre("app"), opts=opts)

pulumi.export("url", ip.public_ip.apply(lambda x: f"http://{x}"))
pulumi.export("ip_publica", ip.public_ip)
pulumi.export("instancias", instancias)
pulumi.export("rds", rds.identifier if rds else "")
pulumi.export("ami", ami_id)
pulumi.export("admin_registro", admin_registro)
