# Despliega Presencia en AWS con CloudFormation Stacks Anidados (Windows / PowerShell).
#
#   .\deploy.ps1                                     # Despliegue 100% automatico (auto-detecta IP y SSH)
#   .\deploy.ps1 -Plan                               # Solo ver cambios sin aplicar (change set)
#   .\deploy.ps1 -AdminCidr "TU.IP/32"               # Especificando IP manualmente
#
# Todo se empaqueta y despliega desde anidados/main.yaml (red -> seguridad -> servidor).
param(
  [string]$AdminCidr = "",
  [string]$RepoUrl = "https://github.com/sebastianmlz/presencia-aws.git",
  [string]$RepoBranch = "main",
  [string]$Proyecto = "asistencia",
  [string]$Ambiente = "dev",
  [string]$Region = "us-east-1",
  [string]$S3Bucket = "",
  [string]$SshPublicKeyPath = "$HOME\.ssh\presencia-aws.pub",
  [switch]$Plan
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# 1. Gestion de clave SSH: si no existe, la genera automaticamente
$llave = ""
if (-not (Test-Path $SshPublicKeyPath)) {
  Write-Host "Clave SSH no encontrada en $SshPublicKeyPath." -ForegroundColor Yellow
  Write-Host "Generando nueva clave SSH automatica..." -ForegroundColor Cyan
  $sshDir = [System.IO.Path]::GetDirectoryName($SshPublicKeyPath)
  if (-not (Test-Path $sshDir)) { New-Item -ItemType Directory -Path $sshDir -Force | Out-Null }
  $keyBase = $SshPublicKeyPath -replace '\.pub$', ''
  ssh-keygen -t ed25519 -f $keyBase -N '""' -C "presencia-aws-admin" 2>$null | Out-Null
}

if (Test-Path $SshPublicKeyPath) {
  $llave = (Get-Content $SshPublicKeyPath -Raw).Trim()
} else {
  $llave = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPqgE80/rJ98L5mP0zH+uB5k1C4vN3Zl7qL0yX1pW8r2 asistencia-dev"
}

# 2. Gestion de IP para SSH: auto-detectar si no se especifico
if ([string]::IsNullOrWhiteSpace($AdminCidr)) {
  try {
    $myIp = (Invoke-RestMethod -Uri "https://ifconfig.me/ip" -TimeoutSec 3).Trim()
    $AdminCidr = "$myIp/32"
    Write-Host "IP publica detectada automaticamente para SSH: $AdminCidr" -ForegroundColor Cyan
  } catch {
    $AdminCidr = "0.0.0.0/0"
    Write-Host "No se detecto IP publica, permitiendo acceso SSH desde: 0.0.0.0/0" -ForegroundColor Yellow
  }
}

$tags = @("Proyecto=$Proyecto", "Ambiente=$Ambiente", "Herramienta=CloudFormation")
$stackName = "$Proyecto-$Ambiente-main"

# 3. Determinar o crear el bucket S3 para empaquetar las plantillas anidadas
if ([string]::IsNullOrWhiteSpace($S3Bucket)) {
  Write-Host "Obteniendo ID de cuenta AWS para el bucket de empaquetado..." -ForegroundColor Cyan
  $accountId = (aws sts get-caller-identity --query "Account" --output text 2>$null)
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($accountId)) {
    throw "No se pudo conectar a AWS. Asegurate de haber configurado 'aws configure' con tus credenciales."
  }
  $accountId = $accountId.Trim()
  $S3Bucket = "cfn-packages-$accountId-$Region"
}

Write-Host "Verificando bucket S3: s3://$S3Bucket..." -ForegroundColor Cyan
aws s3api head-bucket --bucket $S3Bucket --region $Region 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Creando bucket S3 s3://$S3Bucket..." -ForegroundColor Yellow
  if ($Region -eq "us-east-1") {
    aws s3api create-bucket --bucket $S3Bucket --region $Region | Out-Null
  } else {
    aws s3api create-bucket --bucket $S3Bucket --region $Region --create-bucket-configuration LocationConstraint=$Region | Out-Null
  }
}

Write-Host "`n==> Validando sintaxis de plantillas..." -ForegroundColor Cyan
aws cloudformation validate-template --region $Region --template-body file://anidados/red.yaml       | Out-Null
aws cloudformation validate-template --region $Region --template-body file://anidados/seguridad.yaml | Out-Null
aws cloudformation validate-template --region $Region --template-body file://anidados/servidor.yaml  | Out-Null

$extra = @()
if ($Plan) { $extra += "--no-execute-changeset" }

Write-Host "`n==> Empaquetando y desplegando stack principal anidado ($stackName)..." -ForegroundColor Cyan
aws cloudformation deploy `
  --region $Region `
  --stack-name $stackName `
  --template-file "anidados/main.yaml" `
  --s3-bucket $S3Bucket `
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND `
  --no-fail-on-empty-changeset `
  --tags $tags `
  --parameter-overrides `
      Proyecto="$Proyecto" `
      Ambiente="$Ambiente" `
      AdminCidr="$AdminCidr" `
      RepoUrl="$RepoUrl" `
      RepoBranch="$RepoBranch" `
      SshPublicKey="$llave" `
  @extra

if ($LASTEXITCODE -ne 0) {
  throw "Fallo el despliegue del stack $stackName"
}

if (-not $Plan) {
  Write-Host "`n==> Despliegue completado con exito!" -ForegroundColor Green
  Write-Host "Outputs de la pila principal:" -ForegroundColor Cyan
  aws cloudformation describe-stacks --region $Region --stack-name $stackName `
    --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" --output table
}
