#!/usr/bin/env bash
# Borra los stacks en orden inverso (computo -> seguridad -> red).
# Los Exports en uso impiden borrar la red antes que las instancias.
set -euo pipefail
PROYECTO=${PROYECTO:-presencia}
AMBIENTE=${AMBIENTE:-dev}
REGION=${AWS_REGION:-us-east-1}

for s in compute security network; do
  echo "==> borrando $PROYECTO-$AMBIENTE-$s"
  aws cloudformation delete-stack --region "$REGION" --stack-name "$PROYECTO-$AMBIENTE-$s"
  aws cloudformation wait stack-delete-complete --region "$REGION" --stack-name "$PROYECTO-$AMBIENTE-$s"
done
echo "Listo."
