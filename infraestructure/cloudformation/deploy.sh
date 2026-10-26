#!/usr/bin/env bash
# Despliega Presencia en AWS con CloudFormation Stacks Anidados (Linux / macOS / Git Bash).
#
#   ADMIN_CIDR=189.28.74.200/32 ./deploy.sh
#   ADMIN_CIDR=189.28.74.200/32 PLAN=1 ./deploy.sh   # solo change sets (ver cambios sin aplicar)
set -euo pipefail
cd "$(dirname "$0")"

: "${ADMIN_CIDR:?Indica ADMIN_CIDR, por ejemplo tu IP publica /32}"
PROYECTO=${PROYECTO:-asistencia}
AMBIENTE=${AMBIENTE:-dev}
REGION=${AWS_REGION:-us-east-1}
REPO_URL=${REPO_URL:-https://github.com/JuanaBP/presencia-aws.git}
REPO_BRANCH=${REPO_BRANCH:-main}
SSH_PUB=${SSH_PUB:-$HOME/.ssh/presencia-aws.pub}
STACK_NAME="$PROYECTO-$AMBIENTE-main"
EXTRA=()
[ "${PLAN:-0}" = "1" ] && EXTRA+=(--no-execute-changeset)

if [ ! -f "$SSH_PUB" ]; then
  echo "Error: No se encontro $SSH_PUB. Genera una con: ssh-keygen -t ed25519 -f ~/.ssh/presencia-aws" >&2
  exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text | tr -d '\r\n')
S3_BUCKET=${S3_BUCKET:-"cfn-packages-${ACCOUNT_ID}-${REGION}"}

echo "==> Verificando bucket S3: s3://${S3_BUCKET}..."
if ! aws s3api head-bucket --bucket "$S3_BUCKET" --region "$REGION" 2>/dev/null; then
  echo "Creando bucket S3 s3://${S3_BUCKET}..."
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$S3_BUCKET" --region "$REGION" >/dev/null
  else
    aws s3api create-bucket --bucket "$S3_BUCKET" --region "$REGION" --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
  fi
fi

echo -e "\n==> Validando plantillas..."
aws cloudformation validate-template --region "$REGION" --template-body "file://anidados/red.yaml" >/dev/null
aws cloudformation validate-template --region "$REGION" --template-body "file://anidados/seguridad.yaml" >/dev/null
aws cloudformation validate-template --region "$REGION" --template-body "file://anidados/servidor.yaml" >/dev/null

echo -e "\n==> Empaquetando y desplegando stack principal anidado ($STACK_NAME)..."
aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --template-file "anidados/main.yaml" \
  --s3-bucket "$S3_BUCKET" \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --no-fail-on-empty-changeset \
  --tags Proyecto="$PROYECTO" Ambiente="$AMBIENTE" Herramienta=CloudFormation \
  --parameter-overrides \
      Proyecto="$PROYECTO" \
      Ambiente="$AMBIENTE" \
      AdminCidr="$ADMIN_CIDR" \
      RepoUrl="$REPO_URL" \
      RepoBranch="$REPO_BRANCH" \
      SshPublicKey="$(tr -d '\r\n' < "$SSH_PUB")" \
  "${EXTRA[@]}"

if [ "${PLAN:-0}" != "1" ]; then
  echo -e "\n==> Despliegue completado con exito!"
  echo "Outputs de la pila principal:"
  aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" --output table
fi
