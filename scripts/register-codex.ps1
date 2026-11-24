$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$node = (Get-Command node.exe).Source
$server = Join-Path $root 'dist\src\server.js'
if (!(Test-Path -LiteralPath $server)) { throw 'Build the project first' }
$codexDir = if ($env:CODEX_HOME) { $env:CODEX_HOME }else { Join-Path $env:USERPROFILE '.codex' }
$cfg = Join-Path $codexDir 'config.toml'
if (Test-Path -LiteralPath $cfg) { Copy-Item -LiteralPath $cfg -Destination ($cfg + '.backup-keil-proteus-' + (Get-Date -Format 'yyyyMMddHHmmss')) }
foreach ($app in @('keil', 'proteus')) {
    & codex mcp add ($app + '-mcp') -- $node $server $app
    if ($LASTEXITCODE) { throw "Codex registration failed: $app" }
}
$text = [IO.File]::ReadAllText($cfg)
foreach ($app in @('keil', 'proteus')) {
    $pattern = '(?ms)(^\[mcp_servers\.' + [regex]::Escape($app + '-mcp') + '\]\r?\n)(.*?)(?=^\[|\z)'
    $text = [regex]::Replace($text, $pattern, [Text.RegularExpressions.MatchEvaluator] { param($m)
            $body = [regex]::Replace($m.Groups[2].Value, '(?m)^(startup_timeout_sec|tool_timeout_sec)\s*=.*\r?\n?', '').TrimEnd()
            $m.Groups[1].Value + $body + "`nstartup_timeout_sec = 30`ntool_timeout_sec = 180`n`n"
        })
}
[IO.File]::WriteAllText($cfg, $text, [Text.UTF8Encoding]::new($false))
Write-Output 'Registered keil-mcp and proteus-mcp. Reload Codex MCP connections or restart Codex.'

$skillDirectory = Join-Path $codexDir 'skills/keil-proteus-automation'
New-Item -ItemType Directory -Force -Path $skillDirectory | Out-Null
Copy-Item -LiteralPath (Join-Path $root 'skill/SKILL.md') -Destination (Join-Path $skillDirectory 'SKILL.md') -Force
