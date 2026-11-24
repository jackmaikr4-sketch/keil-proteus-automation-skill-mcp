param([switch]$Register)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
    & node (Join-Path $PSScriptRoot 'configure.mjs')
    if ($LASTEXITCODE) { throw 'Configuration setup failed' }
    & npm.cmd ci --cache (Join-Path $root '.npm-cache') --no-audit --no-fund
    if ($LASTEXITCODE) { throw 'Dependency installation failed' }
    & npm.cmd run build
    if ($LASTEXITCODE) { throw 'Build failed' }
    & npm.cmd test
    if ($LASTEXITCODE) { throw 'Tests failed' }
    if ($Register) { & (Join-Path $PSScriptRoot 'register-codex.ps1') }
}
finally { Pop-Location }
