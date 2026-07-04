param(
  [string]$ResourceGroup = 'menupick-swa-rg',
  [string]$Location = 'koreacentral',
  [string]$ApiSku = 'B1'
)

$ErrorActionPreference = 'Stop'

$RepoRoot = 'c:\Users\user\Desktop\vibe_coding_1'
$ApiSourcePath = Join-Path $RepoRoot 'apps\api'
$PackageRoot = Join-Path $RepoRoot 'infra\azure\artifacts'
$ApiStartupScript = Join-Path $ApiSourcePath 'startup.sh'

$suffix = (Get-Date -Format 'MMddHHmm') + (Get-Random -Minimum 100 -Maximum 999)
$ApiAppName = "menupick-api-$suffix"
$SwaName    = "menupick-web-$suffix"
$PlanName   = 'menupick-swa-plan'
$ApiAppUrl  = "https://$ApiAppName.azurewebsites.net"
$ApiZipPath = Join-Path $PackageRoot "$ApiAppName.zip"
$LinuxRuntime = 'NODE:22-lts'

function Invoke-Az {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & az @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Azure CLI command failed: az $($Arguments -join ' ')" }
}

function Invoke-LocalCommand {
  param([string]$WorkingDirectory, [string]$Command, [string[]]$Arguments)
  Push-Location $WorkingDirectory
  try {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Local command failed: $Command $($Arguments -join ' ')" }
  }
  finally { Pop-Location }
}

function Reset-StagingPath {
  param([string]$Path)
  if (Test-Path $Path) { Remove-Item $Path -Recurse -Force }
  New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

function New-ApiDeploymentZip {
  param([string]$OutputZipPath)
  if (Test-Path $OutputZipPath) { Remove-Item $OutputZipPath -Force }

  $stagingPath = Join-Path $PackageRoot ([System.IO.Path]::GetFileNameWithoutExtension($OutputZipPath))
  Reset-StagingPath -Path $stagingPath

  Write-Host '[1/2] API 빌드 중...'
  Invoke-LocalCommand -WorkingDirectory $ApiSourcePath -Command 'npm' -Arguments @('run', 'build')

  Copy-Item -Path (Join-Path $ApiSourcePath 'package.json') -Destination $stagingPath -Force
  Copy-Item -Path $ApiStartupScript -Destination $stagingPath -Force
  Copy-Item -Path (Join-Path $ApiSourcePath 'dist') -Destination (Join-Path $stagingPath 'dist') -Recurse -Force
  Invoke-LocalCommand -WorkingDirectory $stagingPath -Command 'npm.cmd' -Arguments @('install', '--omit=dev')

  Compress-Archive -Path (Join-Path $stagingPath '*') -DestinationPath $OutputZipPath -Force
  Write-Host "API 패키지 생성 완료: $OutputZipPath"
}

# ----- 시작 -----
Write-Host "리소스 그룹: $ResourceGroup"
Write-Host "지역: $Location"
Write-Host "API App Service: $ApiAppName"
Write-Host "Static Web App: $SwaName"
Write-Host ''

New-Item -ItemType Directory -Path $PackageRoot -Force | Out-Null
New-ApiDeploymentZip -OutputZipPath $ApiZipPath

Write-Host '[2/2] Azure 리소스 생성 중...'
Invoke-Az group create --name $ResourceGroup --location $Location | Out-Null

# App Service (API용)
Invoke-Az appservice plan create --name $PlanName --resource-group $ResourceGroup --sku $ApiSku --is-linux | Out-Null
Invoke-Az webapp create --resource-group $ResourceGroup --plan $PlanName --name $ApiAppName --runtime $LinuxRuntime | Out-Null
Invoke-Az webapp update --resource-group $ResourceGroup --name $ApiAppName --https-only true | Out-Null
Invoke-Az webapp config set --resource-group $ResourceGroup --name $ApiAppName --startup-file 'bash startup.sh' | Out-Null
Invoke-Az webapp config appsettings set --resource-group $ResourceGroup --name $ApiAppName --settings `
  NODE_ENV=production `
  PORT=8080 `
  API_PORT=8080 `
  SCM_DO_BUILD_DURING_DEPLOYMENT=false `
  ENABLE_ORYX_BUILD=false | Out-Null

# API 배포
Write-Host 'API 앱 배포 중...'
Invoke-Az webapp deploy --resource-group $ResourceGroup --name $ApiAppName --src-path $ApiZipPath --type zip --track-status false --async true | Out-Null

# Static Web App 생성 (빈 앱, GitHub Actions로 실제 배포)
Write-Host 'Azure Static Web App 생성 중...'
Invoke-Az staticwebapp create --name $SwaName --resource-group $ResourceGroup --location $Location --sku Free | Out-Null

# SWA 배포 토큰 가져오기
$swaToken = (Invoke-Az staticwebapp secrets list --name $SwaName --resource-group $ResourceGroup --query 'properties.apiKey' --output tsv 2>&1)

# CORS 설정 업데이트 (SWA URL은 생성 후 알 수 있음)
$swaHostname = (Invoke-Az staticwebapp show --name $SwaName --resource-group $ResourceGroup --query 'defaultHostname' --output tsv 2>&1)
$SwaUrl = "https://$swaHostname"

Invoke-Az webapp config appsettings set --resource-group $ResourceGroup --name $ApiAppName --settings `
  CORS_ORIGINS=$SwaUrl | Out-Null

Write-Host ''
Write-Host '========================================'
Write-Host '배포 완료!'
Write-Host "API URL: $ApiAppUrl/api/v1/health"
Write-Host "SWA URL: $SwaUrl"
Write-Host ''
Write-Host 'GitHub Actions에 다음 Secret을 추가하세요:'
Write-Host "  AZURE_STATIC_WEB_APPS_API_TOKEN = $swaToken"
Write-Host "  NEXT_PUBLIC_API_URL = $ApiAppUrl"
Write-Host '========================================'
