# Keil / Proteus MCP

让 AI 在 Windows 上修改 C51 源码、调用 Keil 构建、把经过校验的 HEX 加载到 Proteus，并运行、暂停、停止仿真。

一个仓库，两个独立的 **本地 stdio MCP 服务**：`keil-mcp` 和 `proteus-mcp`。不需要 Python，不监听网络端口。支持能够启动本地 stdio MCP 的 AI 客户端；下文提供 Codex 配置和通用 JSON 配置。

本项目以 MIT 许可证开源。Keil、Proteus 及其编译器、器件库和官方示例不包含在仓库中，需要使用者自行安装并取得适用授权。本项目与 Arm/Keil、Labcenter 无隶属关系。

## 能做什么

| 服务 | 功能 |
| --- | --- |
| Keil | 检查安装、读取工程目标、打开工程、读取源码、带 SHA256 校验与备份的文本修改、编译/重编译、查看构建记录 |
| Proteus | 打开已有工程、检查窗口、截图、定位元件、加载已验证固件、控制仿真、读取可访问日志、备份并保存工程 |

当前主要面向 **8051 / Keil C51** 工作流。原开发环境使用 Keil 5.29、Proteus 8.13；其他版本的菜单、语言、属性窗口可能不同，需要实际验证。暂不提供从零绘制电路、PCB 布线、硬件烧录或断点调试。

## 1. 准备环境

- Windows 交互桌面（需保持登录、解锁）。
- Node.js 22 或更高版本，包含 npm；下载：[Node.js](https://nodejs.org/)。
- 可正常打开和编译 C51 工程的 Keil，及可正常运行目标电路的 Proteus。
- 一个支持本地 stdio MCP 的 AI 客户端。自动注册 Codex 还要求终端中能运行 `codex`。
- Git，或直接使用本仓库的 **Code → Download ZIP**，解压后进入目录。

安装软件后，先手动确认一个现有 Keil 工程能编译、Proteus 电路能仿真。MCP 无法替代缺失的编译器、器件模型或软件授权。

## 2. 下载与安装

在 PowerShell 中运行：

```powershell
git clone https://github.com/jackmaikr4-sketch/keil-proteus-automation-skill-mcp.git
cd keil-proteus-automation-skill-mcp
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install.ps1
```

脚本会创建本地 `config.json`（已有文件不覆盖）、安装锁定版本依赖、编译 TypeScript，并运行基础测试。手动安装等价于：

```powershell
npm.cmd ci
npm.cmd run configure
npm.cmd test
```

基础测试使用隔离的临时目录和占位可执行文件，检查程序逻辑与真实 MCP 握手，**通过不代表 Keil 编译和 Proteus 仿真已经可用**。

## 3. 修改本机配置

打开安装目录下的 `config.json`，把软件路径和工程白名单改为你自己的路径。以下只是示例：

```json
{
  "keilExe": "C:\\Keil_v5\\UV4\\UV4.exe",
  "proteusExe": "C:\\Program Files (x86)\\Labcenter Electronics\\Proteus 8 Professional\\BIN\\PDS.EXE",
  "allowedRoots": ["C:\\Projects\\My8051"],
  "buildTimeoutMs": 120000,
  "desktopTimeoutMs": 30000
}
```

`keilExe` 指向 **UV4.exe**，`proteusExe` 指向 **PDS.EXE**。`allowedRoots` 中的每个目录都必须已存在；把源码、Keil 工程、HEX 输出和 Proteus 工程所在目录全部包含在白名单内。JSON 路径使用双反斜杠，也可使用 `/`。不要加注释或尾逗号。

默认白名单是本仓库的 `examples` 目录。`config.json` 被 Git 忽略，不会随提交上传。也可用环境变量 `EDA_MCP_CONFIG` 指定另一份配置的绝对路径；两个服务应使用同一份配置和同一个安装目录，以共享构建记录。修改后重启 MCP 服务。

## 4. 接入 AI 客户端

### Codex 自动注册

在本仓库目录运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-codex.ps1
```

脚本自动使用当前 Node 和仓库的绝对路径，先备份 Codex 配置，再注册 `keil-mcp` 和 `proteus-mcp`。如果已有同名条目，会更新它们；其他条目保留。随后重新加载 MCP 连接或重启 Codex。

没有 `codex` 命令时，可手动将 [codex-config.example.toml](codex-config.example.toml) 中的条目合并到 Codex 配置中，并替换路径。不要用示例覆盖整个配置文件。

### 其他支持 stdio 的客户端

参考 [mcp-config.example.json](mcp-config.example.json)，把其中条目合并到客户端的 MCP 配置。不同客户端的设置文件位置和外层结构可能不同。`command` 是 Node 的绝对路径，`args` 第一个参数是编译后的 `dist/src/server.js`，第二个参数分别是 `keil`、`proteus`。客户端的工具调用超时建议不少于 180 秒。

两个服务需要在本机 Windows 桌面运行。仅支持远程 HTTP MCP 的客户端无法直接使用此 stdio 配置。

## 5. 首次检查

```powershell
npm.cmd run doctor
node scripts/call.mjs keil keil_installation_check
node scripts/call.mjs proteus proteus_installation_check
```

安装检查返回 `exists: true` 只表示可执行文件存在。`doctor` 会报告软件路径及桌面探测结果；尚未打开 Proteus 时出现桌面探测错误并不代表 Node 安装失败。

然后向 AI 发送下面这段话，把路径和元件位号换成你的实际工程：

> 使用 keil-mcp 和 proteus-mcp。先检查安装，读取 C:/Projects/My8051/blink.uvproj 的目标，并读取 main.c。说明当前程序的行为，然后把 LED 闪烁间隔改为 500 毫秒。使用读取到的 SHA256 修改源码，重编译，确认 success 和 artifactVerified 都为 true 后，将这次 buildId 对应的固件加载到 C:/Projects/My8051/blink.pdsprj 的 U1。加载前停止仿真，核对晶振频率，运行后截图检查。最后停止仿真并保存工程。

AI 应按 **读取 → 修改 → 重编译 → 检查新 HEX → 打开电路 → 停止仿真 → 加载固件 → 运行和查看截图 → 停止并保存** 的顺序操作。详细调用参数见 [使用指南](docs/USAGE.md)。

## 示例工程

仓库不分发第三方 Proteus 电路、Keil 模板或器件库。最容易开始的方式是使用你自己的、已手动验证的 `.uvproj` 和 `.pdsprj` 工程，并把它们加入白名单。

可选的 `node scripts/setup-example.mjs` 会从你本机 Keil 安装中的 `C51/Examples/HELLO/Hello.uvproj` 创建一个四位数码管 C51 示例，输出到 `examples/c51-display`。也可传入模板路径：

```powershell
node scripts/setup-example.mjs 'C:\Keil_v5\C51\Examples\HELLO\Hello.uvproj'
```

脚本拒绝覆盖已有输出。不同安装版本可能没有该模板或使用不同 XML 字段，应在 Keil 中核对生成工程。对应电路需自行准备：AT89C51RD2、12 MHz，P1.0–7 接段线 A–DP（经 74HC541），P0.0–3 为低电平位选，P2.7 保持低电平关闭报警；这段程序不能直接套用到接线不同的电路。

## 常见问题

| 现象 | 处理方法 |
| --- | --- |
| 提示找不到 config.json | 在仓库运行 `npm.cmd run configure` 后编辑配置 |
| 提示找不到 dist/src/server.js | 执行 `npm.cmd run build`，检查客户端中填写的绝对路径 |
| 软件不存在 / ENOENT | 检查 `keilExe`、`proteusExe`，以及白名单目录是否存在 |
| Path is outside allowedRoots | 将实际工程、源码和输出所在目录加入白名单后重启服务；符号链接按真实路径检查 |
| 编译成功但没有可加载固件 | 在 Keil 开启 Create HEX File，使用 `rebuild: true`；检查 `artifactVerified` |
| HEX 已改变 / buildId 无效 | 重新构建并使用新的 buildId；勿手动替换已验证 HEX |
| Screenshot expired | 重新截图并使用新 snapshotId；截图仅在同一服务会话内有效，60 秒过期且单次使用 |
| 窗口操作失败 / 仿真状态 unknown | 解锁桌面，让 MCP 和应用运行于同一用户会话，检查弹窗、菜单语言及窗口状态 |
| 中文源码无法解码 | 在读取和修改时显式指定 `encoding: "gbk"` 等正确编码；程序不会猜测非 UTF 编码 |
| busy / 遗留 lock | 先确认对应进程已退出，再删除 artifacts 下对应锁文件；运行中不能删锁 |
| npm.ps1 被系统阻止 | 使用本文的 `npm.cmd`；安装脚本的执行策略只作用于本次 PowerShell 进程 |

## 使用边界与开发

桌面自动化期间不要同时拖动目标窗口或用其他桌面代理操作同一应用。MCP 会修改源码和工程，建议先使用工程副本。源码与保存工程的备份位于同目录 `.bak.*`；构建日志、截图和固件记录位于 `artifacts`，均不上传 Git。

点击、输入返回的 `verified: false` 仅代表输入已发送，需要继续观察；菜单识别的仿真运行状态也不能证明电路功能正确。自绘日志和示波器数据可能只能通过截图查看。

开发检查：`npm.cmd ci` 后运行 `npm.cmd test`。GitHub Actions 在 Windows / Node 22 上运行同一套基础测试；真实编译与桌面仿真需要本地软件和人工/AI 检查，未纳入 CI。贡献说明见 [CONTRIBUTING.md](CONTRIBUTING.md)，英文快速入门见 [README.en.md](README.en.md)。

## 实现参考

- [Keil 命令行文档](https://www.keil.com/support/man/docs/uv4cl/uv4cl_commandline.htm)
- [Proteus 编译器与固件支持](https://www.labcenter.com/compilers/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

桌面桥接采用 Windows UI Automation、原生控件消息和限定目标窗口的输入，不修改 Proteus 私有二进制工程格式。
