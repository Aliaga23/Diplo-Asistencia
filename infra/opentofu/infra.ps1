<#
.SYNOPSIS
    Opera la infraestructura OpenTofu del practico de la clase 2 (Presencia en 2 EC2).

.DESCRIPTION
    Funciona con la cuenta AWS de cualquier integrante sin editar archivos:

      Credenciales (en este orden):
        1. -Perfil <nombre>          perfil de AWS CLI (IAM o SSO; si la sesion SSO expiro,
                                     ejecuta `aws sso login`).
        2. .env en la raiz del repo  AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY, o AWS_PROFILE.
        3. Cadena estandar de AWS    variables de entorno o perfil default.
      Region: AWS_REGION/AWS_DEFAULT_REGION, la del perfil o us-east-1.
      SSH: tu IP publica actual /32 y la clave ~/.ssh/diplo-asistencia (se crea si no existe).

    Del .env solo se leen AWS_* y TF_VAR_*, solo para este proceso; al terminar se restaura
    el entorno de la terminal. Nunca se imprimen las claves.

    Acciones:
      Plan        (por defecto) muestra que cambiaria, sin crear nada.
      Validar     tofu fmt -check y tofu validate (no necesita AWS).
      Aplicar     crea o actualiza los recursos tras confirmar con APLICAR.
      Salidas     IP, IDs, comandos SSH y registro DNS.
      Destruir    elimina TODOS los recursos del estado tras confirmar con DESTRUIR.
      Restantes   lista recursos del laboratorio que siguen existiendo en AWS.
      Identidad   muestra con que cuenta y usuario se esta operando.
      Empaquetar  genera backend/frontend .tar.gz (finales LF) desde el commit actual.

.EXAMPLE
    .\infra\opentofu\infra.ps1
    .\infra\opentofu\infra.ps1 -Accion Aplicar
    .\infra\opentofu\infra.ps1 -Accion Plan -Perfil mi-perfil-sso
#>
[CmdletBinding()]
param(
    [ValidateSet("Plan", "Validar", "Aplicar", "Salidas", "Destruir", "Restantes", "Identidad", "Empaquetar")]
    [string]$Accion = "Plan",

    [string]$Perfil,

    # Solo para Empaquetar; por defecto <temp>/presencia-paquetes.
    [string]$Salida
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$TofuDir  = $PSScriptRoot
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$PlanFile = "clase2.tfplan"
$DefaultKey = Join-Path (Join-Path $HOME ".ssh") "diplo-asistencia"

$script:EnvBackup = @{}
$script:Tofu = $null
$script:Aws  = $null

function Write-Step([string]$Text) { Write-Host ""; Write-Host "==> $Text" -ForegroundColor Cyan }

function Get-Tool([string]$Name, [string]$Hint) {
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    if ($Name -eq "tofu" -and $env:LOCALAPPDATA) {
        # winget agrega el alias aqui; una terminal abierta antes de instalar aun no lo ve.
        $link = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\tofu.exe"
        if (Test-Path $link) { return $link }
    }
    throw "No se encontro '$Name'. $Hint"
}

function Invoke-Native([string]$File, [string[]]$Arguments) {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Fallo '$(Split-Path $File -Leaf) $($Arguments -join ' ')' (codigo $LASTEXITCODE)."
    }
}

# --- Entorno del proceso (se restaura al final) ------------------------------

function Set-ProcessEnv([string]$Name, $Value) {
    if (-not $script:EnvBackup.ContainsKey($Name)) {
        $script:EnvBackup[$Name] = [Environment]::GetEnvironmentVariable($Name, "Process")
    }
    [Environment]::SetEnvironmentVariable($Name, $Value, "Process")  # $null elimina la variable
}

function Restore-ProcessEnv {
    foreach ($name in $script:EnvBackup.Keys) {
        [Environment]::SetEnvironmentVariable($name, $script:EnvBackup[$name], "Process")
    }
}

function Read-DotEnv {
    $values = @{}
    $file = Join-Path $RepoRoot ".env"
    if (-not (Test-Path -LiteralPath $file)) { return $values }
    foreach ($line in Get-Content -LiteralPath $file) {
        $l = $line.Trim()
        if (-not $l -or $l.StartsWith("#")) { continue }
        if ($l -notmatch '^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') { continue }
        $name = $Matches[1]
        $value = $Matches[2].Trim()
        if ($value.Length -ge 2 -and $value[0] -eq $value[-1] -and ($value[0] -eq '"' -or $value[0] -eq "'")) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        if ($value -and $name -match '^(AWS_|TF_VAR_)') { $values[$name] = $value }
    }
    # Alias no estandar que AWS CLI no reconoce.
    foreach ($pair in @(@("AWS_ACCESS_KEY", "AWS_ACCESS_KEY_ID"), @("AWS_SECRET_KEY", "AWS_SECRET_ACCESS_KEY"))) {
        if ($values.ContainsKey($pair[0])) {
            if (-not $values.ContainsKey($pair[1])) { $values[$pair[1]] = $values[$pair[0]] }
            $values.Remove($pair[0])
        }
    }
    return $values
}

function Initialize-AwsEnv {
    $dot = Read-DotEnv
    foreach ($name in $dot.Keys) { Set-ProcessEnv $name $dot[$name] }

    $keyVars = @("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN")
    if ($Perfil) {
        foreach ($v in $keyVars) { Set-ProcessEnv $v $null }
        Set-ProcessEnv "AWS_PROFILE" $Perfil
        $mode = "perfil '$Perfil' (parametro -Perfil)"
    }
    elseif ($dot.ContainsKey("AWS_ACCESS_KEY_ID") -and $dot.ContainsKey("AWS_SECRET_ACCESS_KEY")) {
        # Claves del .env: sin perfil ni token ajenos que las contradigan.
        Set-ProcessEnv "AWS_PROFILE" $null
        if (-not $dot.ContainsKey("AWS_SESSION_TOKEN")) { Set-ProcessEnv "AWS_SESSION_TOKEN" $null }
        $mode = "access key del .env"
    }
    elseif ($dot.ContainsKey("AWS_PROFILE")) {
        foreach ($v in $keyVars) { Set-ProcessEnv $v $null }
        $mode = "perfil '$($dot["AWS_PROFILE"])' (AWS_PROFILE del .env)"
    }
    elseif ($env:AWS_ACCESS_KEY_ID) { $mode = "variables de entorno de la terminal" }
    elseif ($env:AWS_PROFILE) { $mode = "perfil '$env:AWS_PROFILE' (AWS_PROFILE de la terminal)" }
    else { $mode = "perfil default de AWS CLI" }

    if ($env:AWS_PROFILE) {
        $known = @(& $script:Aws configure list-profiles)
        if ($known -notcontains $env:AWS_PROFILE) {
            throw ("El perfil '$env:AWS_PROFILE' no existe en AWS CLI. Crealo con 'aws configure --profile " +
                   "$env:AWS_PROFILE' (IAM) o 'aws configure sso' (SSO), o pon las claves en .env.")
        }
    }

    if (-not $env:AWS_REGION) {
        $region = $env:AWS_DEFAULT_REGION
        if (-not $region) {
            $fromProfile = & $script:Aws configure get region
            if ($LASTEXITCODE -eq 0 -and $fromProfile) { $region = ($fromProfile | Out-String).Trim() }
        }
        if (-not $region) { $region = "us-east-1" }
        Set-ProcessEnv "AWS_REGION" $region
    }
    Write-Host ("Credenciales: {0} | Region: {1}" -f $mode, $env:AWS_REGION) -ForegroundColor DarkGray
}

function Test-SsoProfile([string]$Name) {
    foreach ($key in @("sso_session", "sso_start_url")) {
        $v = & $script:Aws configure get $key --profile $Name
        if ($LASTEXITCODE -eq 0 -and $v) { return $true }
    }
    return $false
}

function Assert-Identity {
    Write-Step "Identidad AWS"
    $raw = & $script:Aws sts get-caller-identity --output json
    if ($LASTEXITCODE -ne 0 -and $env:AWS_PROFILE -and (Test-SsoProfile $env:AWS_PROFILE)) {
        Write-Host "La sesion SSO no es valida; abriendo aws sso login..." -ForegroundColor Yellow
        & $script:Aws sso login --profile $env:AWS_PROFILE
        if ($LASTEXITCODE -eq 0) { $raw = & $script:Aws sts get-caller-identity --output json }
    }
    if ($LASTEXITCODE -ne 0) {
        throw ("No hay credenciales AWS validas. Revisa: .env (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY " +
               "o AWS_PROFILE), el nombre del perfil, si la access key esta activa y la hora del equipo.")
    }
    $id = ($raw -join "`n") | ConvertFrom-Json
    Write-Host ("    Cuenta: {0}" -f $id.Account)
    Write-Host ("    ARN:    {0}" -f $id.Arn)
    Write-Host "    (Prueba que la credencial es valida, no que tenga todos los permisos.)" -ForegroundColor DarkGray
}

function Assert-SshKey {
    if ($env:TF_VAR_ssh_public_key_path) { return }
    if (Test-Path "$DefaultKey.pub") { return }
    $keygen = Get-Tool "ssh-keygen" "Instala el cliente OpenSSH (en Windows viene como caracteristica opcional)."
    New-Item -ItemType Directory -Force -Path (Split-Path $DefaultKey) | Out-Null
    if (Test-Path $DefaultKey) {
        Write-Step "Regenerando $DefaultKey.pub desde la clave privada existente"
        $pub = & $keygen -y -f $DefaultKey
        if ($LASTEXITCODE -ne 0) { throw "No se pudo leer $DefaultKey." }
        Set-Content -LiteralPath "$DefaultKey.pub" -Value $pub -Encoding Ascii
        return
    }
    Write-Step "Creando la clave SSH dedicada $DefaultKey (la privada no sale de tu equipo)"
    Write-Host "    ssh-keygen pedira una frase de paso: escribe una o deja vacio con Enter."
    Invoke-Native $keygen @("-t", "ed25519", "-C", "diplo-asistencia", "-f", $DefaultKey)
}

function Set-AdminCidrFallback {
    if ($env:TF_VAR_admin_cidrs) { return }
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    try { $ip = ([string](Invoke-RestMethod -Uri "https://checkip.amazonaws.com" -TimeoutSec 15)).Trim() }
    catch { throw "No se pudo detectar tu IP publica. Define TF_VAR_admin_cidrs en .env, p. ej. [`"203.0.113.10/32`"]." }
    if ($ip -notmatch '^\d{1,3}(\.\d{1,3}){3}$') { throw "Respuesta inesperada al detectar la IP publica: '$ip'." }
    Set-ProcessEnv "TF_VAR_admin_cidrs" ('["{0}/32"]' -f $ip)
    Write-Host "SSH permitido desde tu IP actual $ip/32 (terraform.tfvars o TF_VAR_admin_cidrs lo reemplazan)." -ForegroundColor DarkGray
}

function Initialize-Tofu {
    Write-Step "tofu init"
    Invoke-Native $script:Tofu @("init", "-input=false")
}

function Confirm-Word([string]$Word, [string]$Message) {
    Write-Host ""
    Write-Host $Message -ForegroundColor Yellow
    $answer = Read-Host "Escribe $Word para continuar (cualquier otra cosa cancela)"
    return ($answer -ceq $Word)
}

function Show-Remaining {
    Write-Step "Recursos con Project=diplo-asistencia y ManagedBy=OpenTofu en $env:AWS_REGION"
    $common = @("--output", "table", "--filters",
                "Name=tag:Project,Values=diplo-asistencia", "Name=tag:ManagedBy,Values=OpenTofu")
    $checks = [ordered]@{
        "Instancias (no terminadas)" = @("ec2", "describe-instances") + $common + @(
            "Name=instance-state-name,Values=pending,running,stopping,stopped,shutting-down",
            "--query", "Reservations[].Instances[].[InstanceId,State.Name,PublicIpAddress]")
        "Volumenes EBS"       = @("ec2", "describe-volumes") + $common + @("--query", "Volumes[].[VolumeId,State,Size]")
        "IP elasticas"        = @("ec2", "describe-addresses") + $common + @("--query", "Addresses[].[PublicIp,AllocationId]")
        "VPC"                 = @("ec2", "describe-vpcs") + $common + @("--query", "Vpcs[].[VpcId,CidrBlock]")
        "Grupos de seguridad" = @("ec2", "describe-security-groups") + $common + @("--query", "SecurityGroups[].[GroupId,GroupName]")
        "Pares de claves"     = @("ec2", "describe-key-pairs") + $common + @("--query", "KeyPairs[].[KeyPairId,KeyName]")
    }
    foreach ($name in $checks.Keys) {
        Write-Host "--- $name"
        Invoke-Native $script:Aws $checks[$name]
    }
    Write-Host "Si todas las tablas estan vacias, no queda nada del laboratorio en $env:AWS_REGION." -ForegroundColor DarkGray
}

function New-Packages {
    $git = Get-Tool "git" "Instala Git."
    $out = $Salida
    if (-not $out) { $out = Join-Path ([IO.Path]::GetTempPath()) "presencia-paquetes" }
    New-Item -ItemType Directory -Force -Path $out | Out-Null

    foreach ($p in @("backend", "frontend", "deploy/aws-ec2")) {
        $tracked = & $git -C $RepoRoot ls-tree --name-only HEAD $p
        if ($LASTEXITCODE -ne 0 -or -not $tracked) {
            throw "'$p' no esta en el commit actual (HEAD). Haz commit antes de empaquetar."
        }
    }
    $dirty = & $git -C $RepoRoot status --porcelain -- backend frontend deploy/aws-ec2
    if ($dirty) {
        Write-Warning "Hay cambios sin commit en backend/, frontend/ o deploy/aws-ec2/: el paquete usa SOLO lo commiteado."
    }
    $commit = ((& $git -C $RepoRoot rev-parse --short HEAD) | Out-String).Trim()

    # core.autocrlf=false + core.eol=lf: finales LF aunque Git en Windows convierta a CRLF.
    $sets = [ordered]@{
        "presencia-backend.tar.gz"  = @("backend", "deploy/aws-ec2/backend")
        "presencia-frontend.tar.gz" = @("frontend", "deploy/aws-ec2/frontend")
    }
    foreach ($name in $sets.Keys) {
        $file = Join-Path $out $name
        Invoke-Native $git (@("-C", $RepoRoot, "-c", "core.autocrlf=false", "-c", "core.eol=lf",
                              "archive", "--format=tar.gz", "-o", $file, "HEAD") + $sets[$name])
        Write-Host ("    {0}  ({1:N0} KB)" -f $file, ((Get-Item $file).Length / 1KB))
    }
    Write-Host "Paquetes del commit $commit listos en: $out" -ForegroundColor Green
}

# -----------------------------------------------------------------------------

$needsAws = @("Plan", "Aplicar", "Destruir", "Restantes", "Identidad") -contains $Accion
if ($Accion -ne "Empaquetar") {
    $script:Tofu = Get-Tool "tofu" "Instalalo con: winget install --exact --id OpenTofu.Tofu (y abre otra terminal)."
}
if ($needsAws) {
    $script:Aws = Get-Tool "aws" "Instala AWS CLI v2: winget install --exact --id Amazon.AWSCLI"
}

Push-Location $TofuDir
try {
    if ($needsAws) {
        Initialize-AwsEnv
        Assert-Identity
    }
    if (@("Plan", "Aplicar", "Destruir") -contains $Accion) {
        Assert-SshKey
        Set-AdminCidrFallback
        Initialize-Tofu
    }

    switch ($Accion) {
        "Validar" {
            Write-Step "tofu fmt -check"
            Invoke-Native $script:Tofu @("fmt", "-check", "-recursive")
            Initialize-Tofu
            Write-Step "tofu validate"
            Invoke-Native $script:Tofu @("validate")
        }

        "Identidad" { }

        "Plan" {
            Write-Step "tofu plan (solo lectura, no crea nada)"
            Invoke-Native $script:Tofu @("plan", "-input=false")
        }

        "Aplicar" {
            Write-Step "tofu plan -out=$PlanFile"
            Invoke-Native $script:Tofu @("plan", "-input=false", "-out=$PlanFile")
            $ok = Confirm-Word "APLICAR" ("Revisa el plan: recursos, tipos de instancia y '0 to destroy'. " +
                                          "Las EC2, los discos y las IPv4 publicas consumen creditos o se facturan.")
            if (-not $ok) { Write-Host "Cancelado: no se aplico nada."; break }
            Write-Step "tofu apply $PlanFile"
            Invoke-Native $script:Tofu @("apply", "-input=false", $PlanFile)
            Write-Step "Salidas"
            Invoke-Native $script:Tofu @("output")
            Write-Host "Infraestructura creada; la aplicacion NO esta desplegada. Sigue docs/despliegue-clase2.md." -ForegroundColor Green
        }

        "Salidas" { Invoke-Native $script:Tofu @("output") }

        "Destruir" {
            Write-Host ""
            Write-Host "ATENCION: se borran las EC2, sus discos (incluida la base PostgreSQL) y la IP elastica." -ForegroundColor Red
            Write-Host "Respalda antes la base: docs/despliegue-clase2.md, seccion 'Respaldo'." -ForegroundColor Red
            Write-Step "tofu plan -destroy -out=$PlanFile"
            Invoke-Native $script:Tofu @("plan", "-destroy", "-input=false", "-out=$PlanFile")
            $ok = Confirm-Word "DESTRUIR" "Esto elimina TODOS los recursos de este estado y no se puede deshacer."
            if (-not $ok) { Write-Host "Cancelado: no se destruyo nada."; break }
            Write-Step "tofu apply $PlanFile (destruccion)"
            Invoke-Native $script:Tofu @("apply", "-input=false", $PlanFile)
            Show-Remaining
        }

        "Restantes" { Show-Remaining }

        "Empaquetar" { New-Packages }
    }
}
finally {
    if (Test-Path $PlanFile) { Remove-Item $PlanFile -Force }
    Pop-Location
    Restore-ProcessEnv
}
