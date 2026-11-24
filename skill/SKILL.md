---
name: keil-proteus-automation
description: Build existing Keil C51 projects and verify firmware in Proteus through the local keil-mcp and proteus-mcp servers. Use for source changes, builds and simulation checks.
---

# Keil and Proteus workflow

1. Check the two installations and read the requested project before changing anything. Keep work within configured allowedRoots. Do not infer board wiring or MCU type from a filename.
2. Read source with keil_read_source. Modify with keil_replace_source using the returned SHA256, preserving encoding and backups. Describe the requested logic change before applying it.
3. Build the exact target with keil_build. Read the result and saved receipt. Only a fresh verified HEX from a successful build may be loaded into Proteus; never pass off an old artifact as the new build.
4. Open the user's existing Proteus project. Inspect its title and dialogs, stop simulation before component-property changes, and identify the actual MCU reference.
5. Use proteus_set_firmware with the verified build. Re-read the component properties to verify firmware path and any requested clock setting. Do not overwrite an unrelated project.
6. Start simulation and read native state, logs and fresh screenshots. A button click alone is not proof of a successful circuit. Report electrical behavior only when observed.
7. UI clicks require a fresh screenshot identifier; refresh after a window moves. Stop on missing-model or unexpected dialogs rather than clicking through.
8. Save only the explicitly opened project after verifying the result. Deliver changed source, build receipt and real simulation evidence. Do not claim unit tests substitute for licensed Keil/Proteus execution.

These tools automate existing projects. They do not supply Keil/Proteus licenses, vendor libraries, or automatically synthesize arbitrary circuit layouts.
