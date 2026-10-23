#!/usr/bin/env bash
# Despliega Presencia en AWS con CloudFormation (Linux / macOS / Git Bash).
#
#   ADMIN_CIDR=200.87.10.20/32 ./deploy.sh          # crea / actualiza los 3 stacks
#   ADMIN_CIDR=200.87.10.20/32 PLAN=1 ./deploy.sh   # solo change sets (equivale a terraform plan)
set -euo pipefail
cd "$(dirname "$0")"

: "${ADMIN_CIDR:?Indica ADMIN_CIDR, por ejemplo tu IP publica /32}"
PROYECTO=${PROYECTO:-presencia}
AMBIENTE=${AMBIENTE:-dev}
REGION=${AWS_REGION:-us-east-1}
SSH_PUB=${SSH_PUB:-$HOME/.ssh/presencia-aws.pub}
EXTRA=()
[ "${PLAN:-0}" = "1" ] && EXTRA+=(--no-execute-changeset)

desplegar() {
  local nombre=$1 plantilla=$2; shift 2
  echo -e "\n==> $PROYECTO-$AMBIENTE-$nombre"
  aws cloudformation deploy \
    --region "$REGION" \
    --stack-name "$PROYECTO-$AMBIENTE-$nombre" \
    --template-file "$plantilla" \
    --capabilities CAPABILITY_IAM \
    --no-fail-on-empty-changeset \
    --tags Proyecto="$PROYECTO" Ambiente="$AMBIENTE" Herramienta=CloudFormation \
    --parameter-overrides Proyecto="$PROYECTO" Ambiente="$AMBIENTE" "$@" \
    "${EXTRA[@]}"
}

for t in templates/*.yaml; do
  aws cloudformation validate-template --region "$REGION" --template-body "file://$t" >/dev/null
done

desplegar network  templates/01-network.yaml
desplegar security templates/02-security.yaml AdminCidr="$ADMIN_CIDR"
desplegar compute  templates/03-compute.yaml  SshPublicKey="$(tr -d '\r\n' < "$SSH_PUB")"

if [ "${PLAN:-0}" != "1" ]; then
  aws cloudformation describe-stacks --region "$REGION" --stack-name "$PROYECTO-$AMBIENTE-compute" \
    --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" --output table
fi
