param(
  [string]$ResourceGroup = 'menupick-lowcost-rg',
  [string]$ApiAppName = 'menupick-api-06280107907',
  [string]$WebAppName = 'menupick-web-06280107907'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = 'c:\Users\user\Desktop\vibe_coding_1'
$PackageRoot = Join-Path $RepoRoot 'infra\azure\artifacts'

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

function Assert-PathExists {
  param(
    [string]$Path,
    [string]$ErrorMessage
  )

  if (-not (Test-Path $Path)) {
    throw $ErrorMessage
  }
}

function Assert-ZipHasEntry {
  param(
    [string]$ZipPath,
    [string]$EntryPath
  )

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
  try {
    $matched = $zip.Entries | Where-Object { $_.FullName -eq $EntryPath }
    if (-not $matched) {
      throw "Required entry '$EntryPath' not found in zip '$ZipPath'"
    }
  } finally {
    $zip.Dispose()
  }
}

function Wait-LatestDeploymentSuccess {
  param(
    [string]$ResourceGroup,
    [string]$AppName,
    [int]$TimeoutSec = 900,
    [int]$PollSec = 10
  )

  $start = Get-Date
  while ($true) {
    $json = az webapp log deployment list --resource-group $ResourceGroup --name $AppName --query "[0].{status:status,id:id,end:end_time,statusText:status_text}" -o json
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to fetch latest deployment status for $AppName"
    }

    $latest = $json | ConvertFrom-Json
    if ($null -ne $latest -and $null -ne $latest.status) {
      if ($latest.status -eq 4) {
        Write-Host "Latest deployment for $AppName succeeded. id=$($latest.id)" -ForegroundColor Green
        return
      }

      if ($latest.status -eq 3) {
        throw "Latest deployment for $AppName failed/stopped. id=$($latest.id), statusText=$($latest.statusText)"
      }
    }

    $elapsed = ((Get-Date) - $start).TotalSeconds
    if ($elapsed -ge $TimeoutSec) {
      throw "Timed out waiting for deployment success for $AppName after $TimeoutSec seconds."
    }

    Start-Sleep -Seconds $PollSec
  }
}

function Wait-ApiHealthy {
  param(
    [string]$ApiHealthUrl,
    [int]$Attempts = 12,
    [int]$IntervalSec = 10
  )

  for ($i = 1; $i -le $Attempts; $i++) {
    try {
      $health = Invoke-RestMethod -Uri $ApiHealthUrl -Method Get -TimeoutSec 20
      if ($health.status -eq 'ok') {
        Write-Host "API health check passed on attempt $i." -ForegroundColor Green
        return
      }
    } catch {
      Write-Host "API health check attempt $i failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    Start-Sleep -Seconds $IntervalSec
  }

  throw "API health check did not pass after $Attempts attempts."
}

function Wait-WebHealthy {
  param(
    [string]$WebUrl,
    [int]$Attempts = 12,
    [int]$IntervalSec = 10
  )

  for ($i = 1; $i -le $Attempts; $i++) {
    try {
      $code = (Invoke-WebRequest -Uri $WebUrl -UseBasicParsing -TimeoutSec 20).StatusCode
      if ($code -eq 200) {
        Write-Host "Web health check passed on attempt $i." -ForegroundColor Green
        return
      }
    } catch {
      Write-Host "Web health check attempt $i failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    Start-Sleep -Seconds $IntervalSec
  }

  throw "Web health check did not pass after $Attempts attempts."
}

Write-Host '=== Preflight: Azure auth and target app existence ===' -ForegroundColor Cyan
Invoke-Az @('account', 'show', '--query', 'name', '-o', 'tsv') | Out-Null
Invoke-Az @('webapp', 'show', '--resource-group', $ResourceGroup, '--name', $ApiAppName, '--query', 'name', '-o', 'tsv') | Out-Null
Invoke-Az @('webapp', 'show', '--resource-group', $ResourceGroup, '--name', $WebAppName, '--query', 'name', '-o', 'tsv') | Out-Null

Write-Host '=== Step 1: Build API (TypeScript compile) ===' -ForegroundColor Cyan
Push-Location (Join-Path $RepoRoot 'apps\api')
try {
  npm install
  if ($LASTEXITCODE -ne 0) { throw 'API npm install failed' }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'API build failed' }
} finally {
  Pop-Location
}
Assert-PathExists -Path (Join-Path $RepoRoot 'apps\api\dist\main.js') -ErrorMessage 'API build output missing: apps\api\dist\main.js'

Write-Host '=== Step 2: Build Web (Next.js) ===' -ForegroundColor Cyan
Push-Location (Join-Path $RepoRoot 'apps\web')
try {
  npm install
  if ($LASTEXITCODE -ne 0) { throw 'Web npm install failed' }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Web build failed' }
} finally {
  Pop-Location
}
Assert-PathExists -Path (Join-Path $RepoRoot 'apps\web\.next\BUILD_ID') -ErrorMessage 'Web build output missing: apps\web\.next\BUILD_ID'

Write-Host '=== Step 3: Package API zip ===' -ForegroundColor Cyan
New-Item -ItemType Directory -Path $PackageRoot -Force | Out-Null
$ApiZipPath = Join-Path $PackageRoot 'api-deploy.zip'
$ApiStaging = Join-Path $PackageRoot 'api-staging'
if (Test-Path $ApiStaging) { Remove-Item $ApiStaging -Recurse -Force }
New-Item -ItemType Directory -Path $ApiStaging -Force | Out-Null

# Include compiled output, package files, and production node_modules.
Copy-Item -Path (Join-Path $RepoRoot 'apps\api\dist') -Destination (Join-Path $ApiStaging 'dist') -Recurse
Copy-Item -Path (Join-Path $RepoRoot 'apps\api\package.json') -Destination $ApiStaging
Copy-Item -Path (Join-Path $RepoRoot 'apps\api\package-lock.json') -Destination $ApiStaging -ErrorAction SilentlyContinue

# Install production deps only into staging before zipping.
Push-Location $ApiStaging
try {
  if (Test-Path (Join-Path $ApiStaging 'package-lock.json')) {
    npm ci --omit=dev --prefer-offline
    if ($LASTEXITCODE -ne 0) { throw 'API staging npm ci failed' }
  } else {
    Write-Host 'API package-lock.json not found. Falling back to npm install --omit=dev.' -ForegroundColor Yellow
    npm install --omit=dev --prefer-offline --no-audit
    if ($LASTEXITCODE -ne 0) { throw 'API staging npm install --omit=dev failed' }
  }
} finally {
  Pop-Location
}

if (Test-Path $ApiZipPath) { Remove-Item $ApiZipPath -Force }
Compress-Archive -Path (Join-Path $ApiStaging '*') -DestinationPath $ApiZipPath -Force
Write-Host "API zip: $ApiZipPath ($([math]::Round((Get-Item $ApiZipPath).Length/1MB,1)) MB)"
Assert-ZipHasEntry -ZipPath $ApiZipPath -EntryPath 'package.json'
Assert-ZipHasEntry -ZipPath $ApiZipPath -EntryPath 'dist/main.js'
Assert-ZipHasEntry -ZipPath $ApiZipPath -EntryPath 'node_modules/@nestjs/core/package.json'

Write-Host '=== Step 4: Package Web zip ===' -ForegroundColor Cyan
$WebZipPath = Join-Path $PackageRoot 'web-deploy.zip'
$WebStaging = Join-Path $PackageRoot 'web-staging'
if (Test-Path $WebStaging) { Remove-Item $WebStaging -Recurse -Force }
New-Item -ItemType Directory -Path $WebStaging -Force | Out-Null

# Include .next build output, public folder, and package files.
Copy-Item -Path (Join-Path $RepoRoot 'apps\web\.next') -Destination (Join-Path $WebStaging '.next') -Recurse
Copy-Item -Path (Join-Path $RepoRoot 'apps\web\public') -Destination (Join-Path $WebStaging 'public') -Recurse -ErrorAction SilentlyContinue
Copy-Item -Path (Join-Path $RepoRoot 'apps\web\package.json') -Destination $WebStaging
Copy-Item -Path (Join-Path $RepoRoot 'apps\web\package-lock.json') -Destination $WebStaging -ErrorAction SilentlyContinue
Copy-Item -Path (Join-Path $RepoRoot 'apps\web\next.config.*') -Destination $WebStaging -ErrorAction SilentlyContinue

# Install production deps only into staging before zipping.
Push-Location $WebStaging
try {
  if (Test-Path (Join-Path $WebStaging 'package-lock.json')) {
    npm ci --omit=dev --prefer-offline
    if ($LASTEXITCODE -ne 0) { throw 'Web staging npm ci failed' }
  } else {
    Write-Host 'Web package-lock.json not found. Falling back to npm install --omit=dev.' -ForegroundColor Yellow
    npm install --omit=dev --prefer-offline --no-audit
    if ($LASTEXITCODE -ne 0) { throw 'Web staging npm install --omit=dev failed' }
  }
} finally {
  Pop-Location
}

if (Test-Path $WebZipPath) { Remove-Item $WebZipPath -Force }
Compress-Archive -Path (Join-Path $WebStaging '*') -DestinationPath $WebZipPath -Force
Write-Host "Web zip: $WebZipPath ($([math]::Round((Get-Item $WebZipPath).Length/1MB,1)) MB)"
Assert-ZipHasEntry -ZipPath $WebZipPath -EntryPath 'package.json'
Assert-ZipHasEntry -ZipPath $WebZipPath -EntryPath '.next/BUILD_ID'
Assert-ZipHasEntry -ZipPath $WebZipPath -EntryPath 'node_modules/next/package.json'

Write-Host '=== Step 5: Update app settings ===' -ForegroundColor Cyan
$WebAppUrl = "https://$WebAppName.azurewebsites.net"
$ApiAppUrl = "https://$ApiAppName.azurewebsites.net"

Invoke-Az @('webapp', 'config', 'appsettings', 'set', '--resource-group', $ResourceGroup, '--name', $ApiAppName, '--settings', 'NODE_ENV=production', 'API_PORT=8080', "CORS_ORIGINS=$WebAppUrl", 'SCM_DO_BUILD_DURING_DEPLOYMENT=false', 'ENABLE_ORYX_BUILD=false') | Out-Null

Invoke-Az @('webapp', 'config', 'set', '--resource-group', $ResourceGroup, '--name', $ApiAppName, '--startup-file', 'node dist/main.js') | Out-Null

Invoke-Az @('webapp', 'config', 'appsettings', 'set', '--resource-group', $ResourceGroup, '--name', $WebAppName, '--settings', 'NODE_ENV=production', "NEXT_PUBLIC_API_URL=$ApiAppUrl", 'SCM_DO_BUILD_DURING_DEPLOYMENT=false', 'ENABLE_ORYX_BUILD=false') | Out-Null

Invoke-Az @('webapp', 'config', 'set', '--resource-group', $ResourceGroup, '--name', $WebAppName, '--startup-file', 'npm start') | Out-Null

Write-Host 'Waiting 30s after config changes to avoid SCM restart collisions...' -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host '=== Step 6: Deploy API ===' -ForegroundColor Cyan
Invoke-Az @('webapp', 'deploy', '--resource-group', $ResourceGroup, '--name', $ApiAppName, '--src-path', $ApiZipPath, '--type', 'zip', '--clean', 'true', '--restart', 'true', '--async', 'true') | Out-Null
Wait-LatestDeploymentSuccess -ResourceGroup $ResourceGroup -AppName $ApiAppName
Wait-ApiHealthy -ApiHealthUrl "$ApiAppUrl/api/v1/health"

Write-Host '=== Step 7: Deploy Web ===' -ForegroundColor Cyan
Invoke-Az @('webapp', 'deploy', '--resource-group', $ResourceGroup, '--name', $WebAppName, '--src-path', $WebZipPath, '--type', 'zip', '--clean', 'true', '--restart', 'true', '--async', 'true') | Out-Null
Wait-LatestDeploymentSuccess -ResourceGroup $ResourceGroup -AppName $WebAppName
Wait-WebHealthy -WebUrl $WebAppUrl

Write-Host ''
Write-Host '=== Deployment complete ===' -ForegroundColor Green
Write-Host "API URL: $ApiAppUrl/api/v1/health"
Write-Host "Web URL: $WebAppUrl"
