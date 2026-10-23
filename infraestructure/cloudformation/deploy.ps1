# Despliega Presencia en AWS con CloudFormation (Windows / PowerShell).
#
#   .\deploy.ps1 -AdminCidr "189.28.74.200/32" -RepoUrl "https://github.com/USUARIO/presencia-aws.git"
#   .\deploy.ps1 -AdminCidr "189.28.74.200/32" -RepoUrl "https://github.com/USUARIO/presencia-aws.git" -Plan  # solo change sets
#
# Orden: red -> seguridad -> computo (cada stack importa los Exports del anterior).
param(
  [Parameter(Mandatory = $true)][string]$AdminCidr,
  [Parameter(Mandatory = $true)][string]$RepoUrl,
  [string]$RepoBranch = "main",
  [string]$Proyecto = "presencia",
  [string]$Ambiente = "dev",
  [string]$Region = "us-east-1",
  [string]$SshPublicKeyPath = "$HOME\.ssh\presencia-aws.pub",
  [switch]$Plan
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$llave = (Get-Content $SshPublicKeyPath -Raw).Trim()
$tags = @("Proyecto=$Proyecto", "Ambiente=$Ambiente", "Herramienta=CloudFormation")
$extra = @()
if ($Plan) { $extra += "--no-execute-changeset" }

function Desplegar($nombre, $plantilla, [string[]]$parametros) {
  Write-Host "`n==> $Proyecto-$Ambiente-$nombre" -ForegroundColor Cyan
  aws cloudformation deploy `
    --region $Region `
    --stack-name "$Proyecto-$Ambiente-$nombre" `
    --template-file $plantilla `
    --capabilities CAPABILITY_IAM `
    --no-fail-on-empty-changeset `
    --tags $tags `
    --parameter-overrides $parametros `
    @extra
  if ($LASTEXITCODE -ne 0) { throw "Fallo el stack $nombre" }
}

aws cloudformation validate-template --region $Region --template-body file://templates/01-network.yaml  | Out-Null
aws cloudformation validate-template --region $Region --template-body file://templates/02-security.yaml | Out-Null
aws cloudformation validate-template --region $Region --template-body file://templates/03-compute.yaml  | Out-Null

Desplegar "network"  "templates/01-network.yaml"  @("Proyecto=$Proyecto", "Ambiente=$Ambiente")
Desplegar "security" "templates/02-security.yaml" @("Proyecto=$Proyecto", "Ambiente=$Ambiente", "AdminCidr=$AdminCidr")
Desplegar "compute"  "templates/03-compute.yaml"  @("Proyecto=$Proyecto", "Ambiente=$Ambiente", "SshPublicKey=$llave", "RepoUrl=$RepoUrl", "RepoBranch=$RepoBranch")

if (-not $Plan) {
  aws cloudformation describe-stacks --region $Region --stack-name "$Proyecto-$Ambiente-compute" `
    --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" --output table
}
