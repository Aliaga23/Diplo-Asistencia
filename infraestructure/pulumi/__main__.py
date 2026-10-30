"""Presencia en AWS con Pulumi: red, security groups, rol SSM y los dos servidores EC2.

Equivale a environments/dev (Terraform) y a cloudformation/anidados. Los servidores
se configuran con los mismos cloud-config de infraestructure/cloud-init/.
"""

import ipaddress
import json
from pathlib import Path

import pulumi
import pulumi_aws as aws

CLOUD_INIT_DIR = Path(__file__).resolve().parent.parent / "cloud-init"
API_PORT = 8000

config = pulumi.Config()
proyecto = config.get("proyecto") or "presencia"
ambiente = pulumi.get_stack()
prefijo = f"{proyecto}-{ambiente}"

admin_cidr = config.require("adminCidr")
ssh_public_key_path = config.get("sshPublicKeyPath") or "~/.ssh/presencia-aws.pub"
repo_url = config.get("repoUrl") or "https://github.com/Aliaga23/Diplo-Asistencia.git"
repo_branch = config.get("repoBranch") or "main"
datos_demo = config.get_bool("datosDemo")
vpc_cidr = config.get("vpcCidr") or "10.20.0.0/16"
public_subnet_cidr = config.get("publicSubnetCidr") or "10.20.1.0/24"
frontend_instance_type = config.get("frontendInstanceType") or "t3.small"
backend_instance_type = config.get("backendInstanceType") or "t3.micro"

if ipaddress.ip_network(admin_cidr).prefixlen < 24:
    raise ValueError("adminCidr debe ser /24 o mas restrictivo; preferiblemente tu IP /32.")

# Mismas IP fijas que Terraform (cidrhost 10 y 20): el frontend se compila apuntando al backend.
subred = ipaddress.ip_network(public_subnet_cidr)
frontend_private_ip = str(subred[10])
backend_private_ip = str(subred[20])


def cloud_init(nombre: str, **valores: str) -> str:
    """Rellena los ${...} de la plantilla, como templatefile() en Terraform y !Sub en CloudFormation."""
    texto = (CLOUD_INIT_DIR / f"{nombre}.yaml").read_text(encoding="utf-8")
    for clave, valor in valores.items():
        texto = texto.replace(f"${{{clave}}}", valor)
    if "${" in texto:
        raise ValueError(f"cloud-init/{nombre}.yaml tiene marcadores sin valor")
    return texto


def nombre(sufijo: str) -> dict[str, str]:
    return {"Name": f"{prefijo}-{sufijo}"}


# ==========================
# RED
# ==========================

zona = aws.get_availability_zones(state="available").names[0]

vpc = aws.ec2.Vpc(
    "vpc",
    cidr_block=vpc_cidr,
    enable_dns_support=True,
    enable_dns_hostnames=True,
    tags=nombre("vpc"),
)

igw = aws.ec2.InternetGateway("igw", vpc_id=vpc.id, tags=nombre("igw"))

subnet = aws.ec2.Subnet(
    "public-subnet",
    vpc_id=vpc.id,
    cidr_block=public_subnet_cidr,
    availability_zone=zona,
    tags=nombre("public-subnet"),
)

rutas = aws.ec2.RouteTable(
    "public-rt",
    vpc_id=vpc.id,
    routes=[{"cidr_block": "0.0.0.0/0", "gateway_id": igw.id}],
    tags=nombre("public-rt"),
)

asociacion = aws.ec2.RouteTableAssociation("public-rt-assoc", subnet_id=subnet.id, route_table_id=rutas.id)

# ==========================
# SECURITY GROUPS
# ==========================

frontend_sg = aws.ec2.SecurityGroup(
    "frontend-sg", vpc_id=vpc.id, description="Security Group del frontend", tags=nombre("frontend-sg")
)
backend_sg = aws.ec2.SecurityGroup(
    "backend-sg", vpc_id=vpc.id, description="Security Group del backend", tags=nombre("backend-sg")
)

for puerto in (80, 443):
    aws.vpc.SecurityGroupIngressRule(
        f"frontend-in-{puerto}",
        security_group_id=frontend_sg.id,
        ip_protocol="tcp",
        from_port=puerto,
        to_port=puerto,
        cidr_ipv4="0.0.0.0/0",
        description="Web publica",
    )

aws.vpc.SecurityGroupIngressRule(
    "backend-in-api",
    security_group_id=backend_sg.id,
    ip_protocol="tcp",
    from_port=API_PORT,
    to_port=API_PORT,
    referenced_security_group_id=frontend_sg.id,
    description="API desde el frontend",
)

aws.vpc.SecurityGroupEgressRule(
    "frontend-out-api",
    security_group_id=frontend_sg.id,
    ip_protocol="tcp",
    from_port=API_PORT,
    to_port=API_PORT,
    referenced_security_group_id=backend_sg.id,
    description="Comunicacion privada con FastAPI",
)

for rol, sg in (("frontend", frontend_sg), ("backend", backend_sg)):
    aws.vpc.SecurityGroupIngressRule(
        f"{rol}-in-ssh",
        security_group_id=sg.id,
        ip_protocol="tcp",
        from_port=22,
        to_port=22,
        cidr_ipv4=admin_cidr,
        description="SSH administrativo",
    )
    # Salida a internet para apt, NodeSource, uv y git (no hay NAT Gateway).
    for protocolo, puerto in (("tcp", 80), ("tcp", 443), ("udp", 123)):
        aws.vpc.SecurityGroupEgressRule(
            f"{rol}-out-{protocolo}-{puerto}",
            security_group_id=sg.id,
            ip_protocol=protocolo,
            from_port=puerto,
            to_port=puerto,
            cidr_ipv4="0.0.0.0/0",
        )

# ==========================
# IAM (SSM)
# ==========================

rol_ssm = aws.iam.Role(
    "ssm-role",
    name=f"{prefijo}-pulumi-ssm-role",
    assume_role_policy=json.dumps(
        {
            "Version": "2012-10-17",
            "Statement": [
                {"Effect": "Allow", "Principal": {"Service": "ec2.amazonaws.com"}, "Action": "sts:AssumeRole"}
            ],
        }
    ),
    tags=nombre("pulumi-ssm-role"),
)

aws.iam.RolePolicyAttachment(
    "ssm-core", role=rol_ssm.name, policy_arn="arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
)

perfil = aws.iam.InstanceProfile("ssm-profile", name=f"{prefijo}-pulumi-ssm-profile", role=rol_ssm.name)

# ==========================
# SERVIDORES
# ==========================

ubuntu = aws.ec2.get_ami(
    most_recent=True,
    owners=["099720109477"],
    filters=[
        {"name": "name", "values": ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]},
        {"name": "architecture", "values": ["x86_64"]},
    ],
)

clave = aws.ec2.KeyPair(
    "admin-key",
    key_name=f"{prefijo}-pulumi-admin",
    public_key=Path(ssh_public_key_path).expanduser().read_text(encoding="utf-8").strip(),
)


def servidor(rol: str, tipo: str, ip: str, sg: aws.ec2.SecurityGroup, user_data: str) -> aws.ec2.Instance:
    return aws.ec2.Instance(
        rol,
        ami=ubuntu.id,
        instance_type=tipo,
        subnet_id=subnet.id,
        private_ip=ip,
        # Sin NAT Gateway, las dos necesitan IP publica para que cloud-init descargue paquetes.
        associate_public_ip_address=True,
        vpc_security_group_ids=[sg.id],
        key_name=clave.key_name,
        iam_instance_profile=perfil.name,
        user_data=user_data,
        credit_specification={"cpu_credits": "standard"},
        metadata_options={"http_endpoint": "enabled", "http_tokens": "required"},
        root_block_device={"volume_type": "gp3", "volume_size": 20, "encrypted": True, "delete_on_termination": True},
        tags={**nombre(rol), "Role": rol},
        # La ruta a internet tiene que existir antes del primer arranque, que es cuando corre cloud-init.
        opts=pulumi.ResourceOptions(depends_on=[asociacion], ignore_changes=["ami"]),
    )


backend = servidor(
    "backend",
    backend_instance_type,
    backend_private_ip,
    backend_sg,
    cloud_init(
        "backend",
        repo_url=repo_url,
        repo_branch=repo_branch,
        seed_args="" if datos_demo is False else "--demo",
    ),
)

frontend = servidor(
    "frontend",
    frontend_instance_type,
    frontend_private_ip,
    frontend_sg,
    cloud_init("frontend", backend_private_ip=backend_private_ip, repo_url=repo_url, repo_branch=repo_branch),
)

frontend_eip = aws.ec2.Eip("frontend-eip", domain="vpc", instance=frontend.id, tags=nombre("frontend-eip"))

ssh_key = ssh_public_key_path.removesuffix(".pub")

pulumi.export("url_aplicacion", frontend_eip.public_ip.apply(lambda ip: f"http://{ip}"))
pulumi.export("frontend_public_ip", frontend_eip.public_ip)
pulumi.export("backend_public_ip", backend.public_ip)
pulumi.export("api_url_interna", f"http://{backend_private_ip}:{API_PORT}")
pulumi.export("ssh_frontend", frontend_eip.public_ip.apply(lambda ip: f"ssh -i {ssh_key} ubuntu@{ip}"))
pulumi.export("ssh_backend", backend.public_ip.apply(lambda ip: f"ssh -i {ssh_key} ubuntu@{ip}"))
