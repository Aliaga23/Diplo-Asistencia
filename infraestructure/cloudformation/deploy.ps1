# Despliega Presencia en AWS con CloudFormation Stacks Anidados (Windows / PowerShell).
#
#   .\deploy.ps1 -AdminCidr "189.28.74.200/32"
#   .\deploy.ps1 -AdminCidr "189.28.74.200/32" -Plan  # solo change sets (ver cambios sin aplicar)
#
# Todo se empaqueta y despliega desde anidados/main.yaml (red -> seguridad -> servidor).
param(
  [Parameter(Mandatory = $true)][string]$AdminCidr,
  [string]$RepoUrl = "https://github.com/JuanaBP/presencia-aws.git",
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

if (-not (Test-Path $SshPublicKeyPath)) {
  throw "No se encontro la clave publica SSH en $SshPublicKeyPath. Crea una con: ssh-keygen -t ed25519 -f $HOME\.ssh\presencia-aws"
}

$llave = (Get-Content $SshPublicKeyPath -Raw).Trim()
$tags = @("Proyecto=$Proyecto", "Ambiente=$Ambiente", "Herramienta=CloudFormation")
$stackName = "$Proyecto-$Ambiente-main"

# Determinar o crear el bucket S3 para empaquetar las plantillas anidadas
if ([string]::IsNullOrWhiteSpace($S3Bucket)) {
  Write-Host "Obteniendo ID de cuenta AWS para el bucket de empaquetado..." -ForegroundColor Cyan
  $accountId = (aws sts get-caller-identity --query "Account" --output text).Trim()
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($accountId)) {
    throw "No se pudo obtener el AccountId de AWS. Asegurate de tener configurado 'aws configure'."
  }
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
