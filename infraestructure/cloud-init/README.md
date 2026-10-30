# cloud-init de Presencia

Cada servidor se configura solo en su primer arranque con un `#cloud-config`:

| Archivo | Servidor | Qué deja funcionando |
|---|---|---|
| `frontend.yaml` | Frontend (t3.small) | Swap de 2 GB, Nginx en el 80, Node.js 24 y Next.js compilado como servicio `presencia-frontend` |
| `backend.yaml` | Backend (t3.micro) | PostgreSQL con credenciales aleatorias, uv, migraciones, datos demo y FastAPI como servicio `presencia-backend` en el 8000 |

cloud-init viene instalado en la AMI de Ubuntu. Lee el *user data* de la instancia y ejecuta sus módulos en orden:

1. `swap`
2. `write_files` (env, unidades systemd)
3. `packages`
4. `write_files` con `defer` (sitio de Nginx)
5. `runcmd` (clonar, compilar, levantar)

## Las tres herramientas usan los mismos archivos

Los valores que cambian van como marcadores `${repo_url}`, `${repo_branch}`, `${backend_private_ip}` y `${seed_args}`. Las tres herramientas usan esa misma sintaxis para rellenarlos. Dentro del shell se escribe `$VAR`, sin llaves, para que ninguna herramienta lo confunda con un marcador.

| Herramienta | Dónde | Cómo entrega el cloud-config |
|---|---|---|
| CloudFormation | `../cloudformation/anidados/servidor.yaml` | `Fn::Base64: !Sub [ <cloud-config>, {variables} ]` |
| Terraform | `../environments/dev/main.tf` | `user_data = templatefile(".../frontend.yaml", {...})` |
| Pulumi | `../pulumi/__main__.py` | `user_data=cloud_init("frontend", ...)` (reemplaza los marcadores en Python) |

CloudFormation no puede leer archivos externos, así que lleva una **copia literal** embebida. Si cambias un `.yaml` de esta carpeta, copia el mismo texto en `servidor.yaml`.

## Desplegar

Los tres usan las credenciales de `aws configure`.

```bash
# CloudFormation (AWS CLI): primero subir los hijos, porque main.yaml los lee desde S3
aws s3 cp infraestructure/cloudformation/anidados/ s3://cfn-presencia-aliaga23/ \
  --recursive --exclude "*" --include "red.yaml" --include "seguridad.yaml" --include "servidor.yaml"
./infraestructure/cloudformation/deploy.sh

# Terraform / OpenTofu
cd infraestructure/environments/dev
cp terraform.tfvars.example terraform.tfvars   # completar cuenta, IP /32 e IDs de GitHub
terraform init && terraform apply

# Pulumi (Python con uv)
cd infraestructure/pulumi
pulumi login --local                           # estado en la máquina, sin cuenta de Pulumi
pulumi stack init dev
pulumi config set adminCidr "$(curl -s https://checkip.amazonaws.com)/32"
pulumi up
```

Las tres crean recursos con los mismos nombres de VPC y servidores. Despliega una a la vez en la misma cuenta, o cambia el proyecto o ambiente.

## Comprobar que corrió cloud-init

```bash
ssh -i ~/.ssh/presencia-aws ubuntu@<ip>
cloud-init status --wait --long        # status: done
tail -n 30 /var/log/cloud-init-output.log
sudo cloud-init schema --system        # valida el user data recibido
systemctl status presencia-frontend    # o presencia-backend
```

`final_message` escribe al final del log cuánto tardó: "Presencia frontend listo tras N s".

cloud-init corre **una sola vez por instancia**. Si cambias el user data de una máquina ya creada, el cambio no se aplica: hay que reemplazar la instancia.
