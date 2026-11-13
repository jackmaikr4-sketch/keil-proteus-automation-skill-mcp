# Keil / Proteus MCP

Two local stdio MCP servers for Windows: edit C51 source, build with Keil, load a verified HEX into an existing Proteus schematic, and control simulation.

## Requirements

Windows with an unlocked interactive desktop, Node.js 22+, working Keil C51 and Proteus installations, and an AI client that supports local stdio MCP servers. The original development environment used Keil 5.29 and Proteus 8.13; other versions require validation. Commercial applications, libraries and vendor example projects are not distributed here.

## Quick start

```powershell
git clone https://github.com/jackmaikr4-sketch/keil-proteus-automation-skill-mcp.git
cd keil-proteus-automation-skill-mcp
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install.ps1
```

Edit the generated `config.json`: set `keilExe` to UV4.exe, `proteusExe` to PDS.EXE, and `allowedRoots` to existing directories containing your source, projects and HEX output. Paths must be absolute. The local config is ignored by Git. Restart the servers after changing it.

For Codex, run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-codex.ps1`, then reload MCP connections. This requires the `codex` CLI and updates existing entries with the same names after backing up the config. Alternatively merge [codex-config.example.toml](codex-config.example.toml) manually. Other clients can adapt [mcp-config.example.json](mcp-config.example.json); replace every example path. Set tool timeouts to at least 180 seconds.

Run `npm.cmd run doctor` and `node scripts/call.mjs keil keil_installation_check`. Installation checks only verify executable existence, not licenses or correct operation.

Ask your AI to read your Keil project and source, make a SHA256-guarded change, rebuild, verify `success` and `artifactVerified`, open your Proteus project, stop simulation, load the returned `buildId` into the correct MCU reference, start simulation, inspect the screenshot, then stop and save.

Both servers must use the same installation directory and configuration to share build receipts. Do not move application windows or operate them with another desktop agent while automation is running. Backups use `.bak.*`; receipts and screenshots are saved under `artifacts`.

## Tests and limitations

`npm.cmd test` builds the project and runs logic and stdio protocol tests with isolated fixture configuration. It does not verify licensed software, actual C51 compilation or simulation. Desktop operations require local validation. Low-level input does not imply a verified result, and a running simulation does not prove circuit correctness.

The focus is 8051/C51, not PCB layout, schematic creation, hardware flashing or breakpoint debugging. See the [Chinese guide](README.md) for full setup, troubleshooting and optional local example generation, and [tool usage](docs/USAGE.md) for parameters.

MIT licensed; see [LICENSE](LICENSE). This project is not affiliated with Arm/Keil or Labcenter.
