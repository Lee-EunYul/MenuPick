param(
  [string]$ResourceGroup = 'menupick-lowcost-rg',
  [string]$Location = 'koreacentral',
  [string]$Sku = 'B1'
)

$ErrorActionPreference = 'Stop'

$RepoRoot = 'c:\Users\user\Desktop\vibe_coding_1'
$ApiSourcePath = Join-Path $RepoRoot 'apps\api'
$WebSourcePath = Join-Path $RepoRoot 'apps\web'
$PackageRoot = Join-Path $RepoRoot 'infra\azure\artifacts'
$ApiStartupScript = Join-Path $ApiSourcePath 'startup.sh'
$WebStartupScript = Join-Path $WebSourcePath 'startup.sh'

# Keep app names short, unique, and easy to identify in Azure.
$suffix = (Get-Date -Format 'MMddHHmm') + (Get-Random -Minimum 100 -Maximum 999)
$ApiAppName = "menupick-api-$suffix"
$WebAppName = "menupick-web-$suffix"
$PlanName = 'menupick-lowcost-plan'
$WebAppUrl = "https://$WebAppName.azurewebsites.net"
$ApiAppUrl = "https://$ApiAppName.azurewebsites.net"
$ApiZipPath = Join-Path $PackageRoot "$ApiAppName.zip"
$WebZipPath = Join-Path $PackageRoot "$WebAppName.zip"
$LinuxRuntime = 'NODE:22-lts'

function Invoke-Az {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
  )

  & az @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Azure CLI command failed: az $($Arguments -join ' ')"
  }
}

function Wait-ForHostnameResolution {
  param(
    [string]$Hostname,
    [int]$MaxAttempts = 30
  )

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    try {
      Resolve-DnsName -Name $Hostname -ErrorAction Stop | Out-Null
      return
    }
    catch {
      if ($attempt -eq $MaxAttempts) {
        throw "Hostname did not resolve in time: $Hostname"
      }

      Start-Sleep -Seconds 10
    }
  }
}

function Invoke-LocalCommand {
  param(
    [string]$WorkingDirectory,
    [string]$Command,
    [string[]]$Arguments
  )

  Push-Location $WorkingDirectory
  try {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "Local command failed: $Command $($Arguments -join ' ')"
    }
  }
  finally {
    Pop-Location
  }
}

function Reset-StagingPath {
  param(
    [string]$Path
  )

  if (Test-Path $Path) {
    Remove-Item $Path -Recurse -Force
  }

  New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

function New-ApiDeploymentZip {
  param(
    [string]$OutputZipPath
  )

  if (Test-Path $OutputZipPath) {
    Remove-Item $OutputZipPath -Force
  }

  $stagingPath = Join-Path $PackageRoot ([System.IO.Path]::GetFileNameWithoutExtension($OutputZipPath))
  Reset-StagingPath -Path $stagingPath

  Invoke-LocalCommand -WorkingDirectory $ApiSourcePath -Command 'npm' -Arguments @('run', 'build')

  Copy-Item -Path (Join-Path $ApiSourcePath 'package.json') -Destination $stagingPath -Force
  Copy-Item -Path $ApiStartupScript -Destination $stagingPath -Force
  Copy-Item -Path (Join-Path $ApiSourcePath 'dist') -Destination (Join-Path $stagingPath 'dist') -Recurse -Force
  Invoke-LocalCommand -WorkingDirectory $stagingPath -Command 'npm.cmd' -Arguments @('install', '--omit=dev')

  Compress-Archive -Path (Join-Path $stagingPath '*') -DestinationPath $OutputZipPath -Force
}

function New-WebDeploymentZip {
  param(
    [string]$OutputZipPath
  )

  if (Test-Path $OutputZipPath) {
    Remove-Item $OutputZipPath -Force
  }

  $stagingPath = Join-Path $PackageRoot ([System.IO.Path]::GetFileNameWithoutExtension($OutputZipPath))
  Reset-StagingPath -Path $stagingPath

  Invoke-LocalCommand -WorkingDirectory $WebSourcePath -Command 'npm' -Arguments @('run', 'build')

  Copy-Item -Path $WebStartupScript -Destination $stagingPath -Force
  Copy-Item -Path (Join-Path $WebSourcePath '.next\standalone\*') -Destination $stagingPath -Recurse -Force
  New-Item -ItemType Directory -Path (Join-Path $stagingPath 'apps\web\.next') -Force | Out-Null
  Copy-Item -Path (Join-Path $WebSourcePath '.next\static') -Destination (Join-Path $stagingPath 'apps\web\.next\static') -Recurse -Force

  $publicPath = Join-Path $WebSourcePath 'public'
  if (Test-Path $publicPath) {
    New-Item -ItemType Directory -Path (Join-Path $stagingPath 'apps\web') -Force | Out-Null
    Copy-Item -Path $publicPath -Destination (Join-Path $stagingPath 'apps\web\public') -Recurse -Force
  }

  Compress-Archive -Path (Join-Path $stagingPath '*') -DestinationPath $OutputZipPath -Force
}

Write-Host "Resource group: $ResourceGroup"
Write-Host "Region: $Location"
Write-Host "App Service plan: $PlanName ($Sku)"
Write-Host "API app: $ApiAppName"
Write-Host "Web app: $WebAppName"

New-Item -ItemType Directory -Path $PackageRoot -Force | Out-Null
New-ApiDeploymentZip -OutputZipPath $ApiZipPath
New-WebDeploymentZip -OutputZipPath $WebZipPath

# Resource group and shared plan keep the cost lower than separate plans.
Invoke-Az group create --name $ResourceGroup --location $Location | Out-Null
Invoke-Az appservice plan create --name $PlanName --resource-group $ResourceGroup --sku $Sku --is-linux | Out-Null

# API app: NestJS listens on API_PORT, so we pin it to the App Service port.
Invoke-Az webapp create --resource-group $ResourceGroup --plan $PlanName --name $ApiAppName --runtime $LinuxRuntime | Out-Null
Invoke-Az webapp update --resource-group $ResourceGroup --name $ApiAppName --https-only true | Out-Null
Invoke-Az webapp config set --resource-group $ResourceGroup --name $ApiAppName --startup-file "bash startup.sh" | Out-Null
Invoke-Az webapp config appsettings set --resource-group $ResourceGroup --name $ApiAppName --settings `
  NODE_ENV=production `
  PORT=8080 `
  API_PORT=8080 `
  CORS_ORIGINS=$WebAppUrl `
  SCM_DO_BUILD_DURING_DEPLOYMENT=false `
  ENABLE_ORYX_BUILD=false | Out-Null
Wait-ForHostnameResolution -Hostname "$ApiAppName.scm.azurewebsites.net"

# Web app: Next.js reads the runtime PORT provided by App Service.
Invoke-Az webapp create --resource-group $ResourceGroup --plan $PlanName --name $WebAppName --runtime $LinuxRuntime | Out-Null
Invoke-Az webapp update --resource-group $ResourceGroup --name $WebAppName --https-only true | Out-Null
Invoke-Az webapp config set --resource-group $ResourceGroup --name $WebAppName --startup-file "bash startup.sh" | Out-Null
Invoke-Az webapp config appsettings set --resource-group $ResourceGroup --name $WebAppName --settings `
  NODE_ENV=production `
  PORT=8080 `
  NEXT_PUBLIC_API_URL=$ApiAppUrl `
  SCM_DO_BUILD_DURING_DEPLOYMENT=false `
  ENABLE_ORYX_BUILD=false | Out-Null
Wait-ForHostnameResolution -Hostname "$WebAppName.scm.azurewebsites.net"

# Deploy prebuilt folders. App Service only needs to unzip files and start the app.
Invoke-Az webapp deployment source config-zip --resource-group $ResourceGroup --name $ApiAppName --src $ApiZipPath --track-status false --timeout 1200 | Out-Null
Invoke-Az webapp deployment source config-zip --resource-group $ResourceGroup --name $WebAppName --src $WebZipPath --track-status false --timeout 1200 | Out-Null

Write-Host ''
Write-Host 'Deployment started.'
Write-Host "API URL: $ApiAppUrl/api/v1/health"
Write-Host "Web URL: $WebAppUrl"
Write-Host 'Zip packages were uploaded asynchronously, so App Service may need a few more minutes to finish building and starting each app.'
Write-Host "Set API CORS_ORIGINS after deployment to include the web URL if browser requests need it: $WebAppUrl"
