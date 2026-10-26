# Borra el stack principal y automaticamente todos los stacks anidados (servidor -> seguridad -> red).
param(
  [string]$Proyecto = "asistencia",
  [string]$Ambiente = "dev",
  [string]$Region = "us-east-1"
)
$ErrorActionPreference = "Stop"
$stackName = "$Proyecto-$Ambiente-main"

Write-Host "==> Borrando stack principal y anidados: $stackName..." -ForegroundColor Yellow
aws cloudformation delete-stack --region $Region --stack-name $stackName
Write-Host "Esperando que se complete el borrado en AWS..." -ForegroundColor Cyan
aws cloudformation wait stack-delete-complete --region $Region --stack-name $stackName
Write-Host "Listo. Infraestructura eliminada con exito." -ForegroundColor Green
