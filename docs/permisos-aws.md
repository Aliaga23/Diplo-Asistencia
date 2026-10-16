# Permisos de AWS — práctico clase 2

Solo una **política administrada por AWS**. No se crean políticas propias, inline, roles ni
instance profiles.

| Política | ARN | Necesidad |
|---|---|---|
| `AmazonEC2FullAccess` | `arn:aws:iam::aws:policy/AmazonEC2FullAccess` | Imprescindible (única) |
| `AmazonEC2ReadOnlyAccess` | `arn:aws:iam::aws:policy/AmazonEC2ReadOnlyAccess` | Opcional: solo `Plan`, para revisar antes de dar permisos de escritura. No la combines con la anterior |

Verificadas el 2026-10-16 en la [referencia de políticas administradas](https://docs.aws.amazon.com/aws-managed-policy/latest/reference/AmazonEC2FullAccess.html)
(`AmazonEC2FullAccess` v5: `ec2:*`, `elasticloadbalancing:*`, `cloudwatch:*`, `autoscaling:*` e
`iam:CreateServiceLinkedRole` para 6 servicios).

## Qué la necesita

Todo lo que hace OpenTofu está en el espacio `ec2:` (la VPC también).

| Recurso / consulta | Acciones |
|---|---|
| `data.aws_ami` (Ubuntu oficial de Canonical) | `ec2:DescribeImages` |
| `data.aws_ec2_instance_type` (elegibilidad Free Tier, arquitectura) | `ec2:DescribeInstanceTypes` |
| `data.aws_ec2_instance_type_offerings` (AZ válida) | `ec2:DescribeInstanceTypeOfferings` |
| VPC, subred, Internet Gateway, tabla de rutas | `ec2:CreateVpc`, `ModifyVpcAttribute`, `CreateSubnet`, `CreateInternetGateway`, `AttachInternetGateway`, `CreateRouteTable`, `CreateRoute`, `AssociateRouteTable` y sus `Describe*`/`Delete*` |
| Grupos de seguridad y reglas | `ec2:CreateSecurityGroup`, `AuthorizeSecurityGroupIngress/Egress`, `RevokeSecurityGroupEgress`, `DescribeSecurityGroupRules` |
| `aws_key_pair` (solo clave pública) | `ec2:ImportKeyPair`, `DeleteKeyPair` |
| 2 × `aws_instance` (gp3 cifrado, IMDSv2) | `ec2:RunInstances`, `TerminateInstances`, `DescribeInstances`, `DescribeVolumes`, `Describe/ModifyInstanceCreditSpecification` |
| `aws_eip` (IP elástica del frontend) | `ec2:AllocateAddress`, `AssociateAddress`, `DisassociateAddress`, `ReleaseAddress` |
| Etiquetas (`default_tags`) | `ec2:CreateTags`, `DeleteTags` |
| `infra.ps1 -Accion Identidad` | `sts:GetCallerIdentity` (no requiere permisos) |
| `infra.ps1 -Accion Restantes` | `ec2:Describe*` |

Lo que **no** hace falta:

- `AmazonVPCFullAccess`: redundante.
- `ResourceGroupsandTagEditorFullAccess`: las etiquetas se ponen con `ec2:CreateTags`.
- SSM: la AMI sale de `DescribeImages`.
- `iam:PassRole`: las EC2 no llevan rol.
- S3 o DynamoDB: el estado es local.
- Una clave KMS propia: se usa `aws/ebs`.
- Route 53: el DNS se gestiona fuera de AWS.

**Alcance excesivo** que otorga:

- `ec2:*` sobre toda la cuenta y todas las regiones. Puede borrar instancias o VPC ajenas, o
  crear NAT Gateways, IP elásticas o instancias grandes.
- Además ELB, Auto Scaling y CloudWatch completos, que el práctico no usa.

No existe una política administrada más estrecha que permita crear VPC e instancias. Para acotar
el riesgo sin políticas propias:

1. Usa una cuenta dedicada al laboratorio.
2. Adjunta la política solo mientras trabajas.
3. Desactiva la access key al terminar.

Restringir por región o por etiqueta exigiría una política propia o una SCP, y queda fuera del
alcance.

**No verificado en documentación oficial:** la política de la clave `aws/ebs`. La documentación
de KMS indica que solo la usan identidades de la misma cuenta a través de EBS, sin permisos KMS en
IAM, pero no publica su texto. Si la cuenta tiene **cifrado EBS por defecto con una clave propia**
(customer managed), `RunInstances` necesitaría permisos KMS sobre esa clave.

## Preparar la identidad (la hace una administradora o un administrador)

El usuario que despliega no se crea ni se da permisos a sí mismo.

**Opción A — usuario IAM con access key**

1. IAM → Users → Create user, p. ej. `diplo-asistencia-tofu`, **sin** acceso a la consola.
2. Permissions → Attach policies directly → `AmazonEC2FullAccess`.
3. Security credentials → Create access key → *Command Line Interface (CLI)*.
4. La persona que despliega copia las claves **solo** en su `.env`, como `AWS_ACCESS_KEY_ID` y
   `AWS_SECRET_ACCESS_KEY` (ver `.env.example`). Nunca en archivos `.tf`/`.tfvars`, en el chat
   ni en las EC2.

**Opción B — IAM Identity Center (SSO)**

1. Crea un *permission set* con la política administrada `AmazonEC2FullAccess` y asígnalo al
   usuario en la cuenta del laboratorio.
2. En su equipo: `aws configure sso` (crea el perfil) y `AWS_PROFILE=<perfil>` en `.env`, o
   `infra.ps1 -Perfil <perfil>`.

Comprobación: `.\infra\opentofu\infra.ps1 -Accion Identidad`. Prueba que la credencial es
válida, **no** que tenga todos los permisos: eso lo confirma `Plan` (lecturas) y, del todo,
`Aplicar`.

## Si algo se deniega

Un `UnauthorizedOperation` o `AccessDenied` no siempre significa que falte una política.
Revisa en este orden:

1. El perfil o la cuenta equivocados (`-Accion Identidad`).
2. Otra región.
3. Una sesión SSO expirada.
4. Un *permissions boundary*.
5. Una SCP de la organización.
6. El cifrado EBS por defecto con clave propia.

El mensaje de error indica la acción y el recurso denegados.

## No confundir

| Credencial | Para qué | Dónde vive |
|---|---|---|
| Access key o SSO | Que OpenTofu cree la infraestructura | `.env` o `~/.aws/` del operador |
| Clave SSH `~/.ssh/diplo-asistencia` | Entrar a las EC2 como `ubuntu` | Equipo del operador; a AWS solo va la `.pub` |
| `DATABASE_URL`, `JWT_SECRET`, `DEFAULT_PASSWORD` | Ejecutar la app | `/opt/presencia/backend/.env` en la EC2 backend; se generan allí |
| Rol IAM de las EC2 | — | No existe: la app no llama a AWS |
