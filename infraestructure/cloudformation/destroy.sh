#!/usr/bin/env bash
# Borra el stack principal y automaticamente todos los stacks anidados (servidor -> seguridad -> red).
set -euo pipefail
PROYECTO=${PROYECTO:-asistencia}
AMBIENTE=${AMBIENTE:-dev}
REGION=${AWS_REGION:-us-east-1}
STACK_NAME="$PROYECTO-$AMBIENTE-main"

echo "==> Borrando stack principal y anidados: $STACK_NAME..."
aws cloudformation delete-stack --region "$REGION" --stack-name "$STACK_NAME"
echo "Esperando que se complete el borrado..."
aws cloudformation wait stack-delete-complete --region "$REGION" --stack-name "$STACK_NAME"
echo "Listo. Infraestructura eliminada con exito."
