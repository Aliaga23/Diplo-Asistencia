#!/usr/bin/env bash
# Corre los escaneos de seguridad sobre templates/ y guarda los reportes en reportes/2-despues/.
#   - cfn-lint   : validacion de sintaxis y propiedades (no es escaner de seguridad)
#   - Checkov    : escaner de seguridad 1
#   - Trivy      : escaner de seguridad 2
#   - cfn-nag    : escaner de seguridad 3
#
# Requiere Docker (las imagenes traen cada herramienta). En Windows: Git Bash o WSL.
set -uo pipefail
cd "$(dirname "$0")"
OUT=reportes/2-despues
mkdir -p "$OUT"
RC=0

echo "== cfn-lint";  docker run --rm -v "$PWD:/data" -w /data ghcr.io/aws-cloudformation/cfn-lint:latest templates/*.yaml \
  | tee "$OUT/cfn-lint.txt" || RC=1

echo "== Checkov";   docker run --rm -v "$PWD:/data" -w /data bridgecrew/checkov:3 \
  -d templates --framework cloudformation --compact \
  | tee "$OUT/checkov.txt" || RC=1

echo "== Trivy";     docker run --rm -v "$PWD:/data" -w /data aquasec/trivy:0.69.3 \
  config --exit-code 1 templates \
  | tee "$OUT/trivy.txt" || RC=1

echo "== cfn-nag";   docker run --rm --entrypoint cfn_nag_scan -v "$PWD:/data" -w /data stelligent/cfn_nag \
  --input-path templates --fail-on-warnings \
  | tee "$OUT/cfn-nag.txt" || RC=1

[ $RC -eq 0 ] && echo "Todos los escaneos pasaron." || echo "Hay hallazgos: revisa $OUT/"
exit $RC
