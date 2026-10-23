# Presencia · Infraestructura con CloudFormation

La misma infraestructura de `infraestructure/` (Terraform), ahora con la IaC nativa de AWS:
**2 EC2 Ubuntu 24.04**, una para el **frontend** (Next.js + Nginx) y otra para el **backend**
(FastAPI + PostgreSQL), con sus **security groups** de mínimo privilegio.

## Estructura (un stack por grupo, igual que los módulos de Terraform)

```
cloudformation/
├── templates/
│   ├── 01-network.yaml    → modules/network   VPC, IGW, subred pública, rutas, VPC Flow Logs (KMS)
│   ├── 02-security.yaml   → modules/security  SG frontend, SG backend, rol IAM SSM  (+ iam.tf)
│   └── 03-compute.yaml    → modules/ec2       Key pair, 2 EC2, IP elástica, UserData (+ main.tf)
├── deploy.ps1 / deploy.sh  despliegue en orden (red → seguridad → cómputo)
├── destroy.sh              borrado en orden inverso
├── scan.sh                 cfn-lint + 3 escáneres de seguridad (Docker)
└── reportes/
    ├── 1-antes/            primera pasada de los escáneres
    └── 2-despues/          después de corregir
```

Los stacks se conectan con **Export / Fn::ImportValue** (el equivalente a `terraform_remote_state`):

| Stack | Exporta | Lo usa |
|---|---|---|
| `presencia-dev-network` | `VpcId`, `PublicSubnetId` | security, compute |
| `presencia-dev-security` | `FrontendSgId`, `BackendSgId`, `InstanceProfile` | compute |
| `presencia-dev-compute` | — (outputs: IPs, URL, comandos SSH) | — |

## Security groups

| SG | Entrada | Salida |
|---|---|---|
| **frontend** | 80 y 443 desde `0.0.0.0/0` · 22 solo desde `AdminCidr` | 80, 443, 123/udp a internet · **8000 solo al SG backend** |
| **backend** | **8000 solo desde el SG frontend** · 22 solo desde `AdminCidr` | 80, 443, 123/udp a internet |

- La API (FastAPI :8000) nunca se expone a internet: la regla referencia al SG del frontend, no a una IP.
- Las salidas se declaran en línea para **reemplazar** la regla por defecto de AWS (todo el tráfico a todos lados).
- Las reglas frontend ↔ backend van como recursos separados (`SecurityGroupIngress` / `SecurityGroupEgress`) para evitar la dependencia circular entre los dos grupos.

## Instancias

| | Frontend | Backend |
|---|---|---|
| Tipo | t3.small | t3.micro |
| IP privada | 10.20.1.10 | 10.20.1.20 |
| IP pública | Elástica (fija) | Automática (parámetro `AsignarIpPublicaBackend`) |
| Disco | 20 GiB gp3 cifrado | 20 GiB gp3 cifrado |
| UserData | Nginx + Node.js 24 + pnpm | PostgreSQL + uv (Python 3.14) |

Las dos usan **IMDSv2 obligatorio** (vía Launch Template), créditos T3 `standard`, rol IAM con
`AmazonSSMManagedInstanceCore` (acceso por Session Manager) y la AMI oficial de Canonical
resuelta por SSM (equivale al `data "aws_ami"` de Terraform).

> Node 24 y Python 3.14 son las versiones que piden `frontend/.node-version` y
> `backend/.python-version`. El `frontend.sh` de Terraform instala Node 22.

## Desplegar

Requisitos: AWS CLI v2 configurado (`aws configure`) y la clave `~/.ssh/presencia-aws.pub`.

```powershell
# Ver los cambios sin aplicarlos (change set = terraform plan)
.\deploy.ps1 -AdminCidr "TU.IP.PUBLICA/32" -Plan

# Aplicar
.\deploy.ps1 -AdminCidr "TU.IP.PUBLICA/32"
```

```bash
ADMIN_CIDR=TU.IP.PUBLICA/32 ./deploy.sh
./destroy.sh
```

Tu IP pública: `curl ifconfig.me`. Los nombres llevan `cfn` (key pair, launch template) para no
chocar con lo que crea Terraform si conviven en la misma cuenta.

| Terraform | CloudFormation |
|---|---|
| `terraform validate` | `aws cloudformation validate-template` |
| `terraform plan` | `deploy --no-execute-changeset` |
| `terraform apply` | `deploy` |
| `terraform output` | `describe-stacks --query Stacks[0].Outputs` |
| `terraform destroy` | `delete-stack` (`destroy.sh`) |

## Escaneos de seguridad

```bash
./scan.sh            # con Docker
```

o sin Docker:

```bash
pip install cfn-lint checkov
cfn-lint templates/*.yaml
checkov -d templates --framework cloudformation --compact
trivy config --exit-code 1 templates
cfn_nag_scan --input-path templates --fail-on-warnings      # gem install cfn-nag
```

También corren en cada PR con GitHub Actions: copia `ci/cfn-security.yml` a `.github/workflows/`.

### Resultados

| Herramienta | Antes | Después |
|---|---|---|
| cfn-lint (validación) | 0 errores | 0 errores |
| **1. Checkov** | 23 ok · **3 fallos** | 36 ok · 0 fallos · 3 excepciones justificadas |
| **2. Trivy** | **7 fallos** (6 CRITICAL, 1 MEDIUM) | 0 fallos · 6 excepciones justificadas |
| **3. cfn-nag** | **8 warnings** | 0 warnings · 4 excepciones justificadas |

### Hallazgos corregidos

| Hallazgo | Escáner | Corrección |
|---|---|---|
| VPC sin Flow Logs | Trivy AWS-0178 · cfn-nag W60 | `AWS::EC2::FlowLog` a CloudWatch Logs, retención 30 días |
| Log group sin cifrar (apareció al añadir los Flow Logs) | Trivy AWS-0017 · cfn-nag W84 | Clave KMS propia con rotación anual |
| Recursos con nombre fijo (impide reemplazos) | cfn-nag W28 | Se quitó `GroupName` / `RoleName`; el nombre queda en el tag `Name` |
| Backend siempre con IP pública | Checkov CKV_AWS_88 | Ahora es parámetro (`AsignarIpPublicaBackend`) |

### Excepciones aceptadas (documentadas en el `Metadata` de cada recurso)

| Hallazgo | Por qué se acepta |
|---|---|
| Frontend con 80/443 abiertos a `0.0.0.0/0` (CKV_AWS_260, W2, W9) | Es el servidor web público; no hay ALB delante |
| Salida a internet en 80/443/123 (AWS-0104, W5) | apt, NodeSource, GitHub, PyPI y SSM; sin NAT Gateway ni VPC endpoints no hay otra ruta. Ya se limitó a esos 3 puertos |
| EC2 con IP pública (CKV_AWS_88) | Frontend: es la web. Backend: sin NAT (≈ USD 32/mes) necesita IP para salir; su API solo acepta al SG del frontend |

Para cerrar también las dos últimas en producción: ALB con certificado ACM delante del
frontend, backend en subred privada con NAT Gateway o VPC endpoints, y quitar el puerto 22
usando solo Session Manager.
