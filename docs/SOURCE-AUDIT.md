# Keil / Proteus 源码公开性与可复现检查

检查日期：2026-11-24。审查对象是 GitHub main 的文件清单及匹配 Git blob 哈希的源码副本。

## 结论与修复

核心实现已在源码中公开；没有发现通过加密载荷、动态解码代码或仅提供闭源执行文件来替代核心实现的方案。但原代码存在大量多语句压在一行的问题，可读性不足。本次将源码展开为正常缩进与分行，并提供格式配置和持续检查命令。

这份报告不把“公开仓库”等同“完整可用”，也不把格式化等同功能验收。下面单独列出构建、测试及未完成的环境验证。

## 从哪里阅读实现

| 入口 | 内容 |
|---|---|
| [`src/server.ts`](../src/server.ts) | MCP 工具注册与调用入口 |
| [`src/keil.ts`](../src/keil.ts) | 读取工程、修改源文件、调用 Keil 编译并验证 HEX |
| [`src/proteus.ts`](../src/proteus.ts) | 固件设置、仿真状态检查和保存 |
| [`src/desktop.ts`](../src/desktop.ts) | 桌面请求封装 |
| [`scripts/desktop.ps1`](../scripts/desktop.ps1) | UI Automation 与窗口操作 |
| [`scripts/DesktopNative.cs`](../scripts/DesktopNative.cs) | 可直接编译的 Win32 桌面桥接源码 |
| [`src/common.ts`](../src/common.ts) | 配置、路径限制、日志和进程管理 |

## 如何从源码复现

按照 README 配置本机软件路径后执行 `npm ci`、`npm test`；源码风格检查执行 `npm run format:check`，格式化执行 `npm run format`。C# 采用可读源码直接编译，不要求下载作者预编译的工作进程。

JavaScript/TypeScript 格式化前已使用 Prettier debug-check 核对语法等价；C# 用 Roslyn 对比格式化前后非空白 token，保持一致。对缺少 Python 的启动错误、配置检测及 Skill 安装的功能修改另有说明，不冒充纯排版修改。

## 本轮测试结果与限制

9 项测试通过，包含两个服务的真实 STDIO 握手。C51 示例通过本机 Keil 实际重新编译，0 错误、0 警告，生成的 HEX 通过新鲜度与 SHA256 检查。桌面原生桥接源码通过 Add-Type 编译；本轮没有重新完成 Proteus 电路仿真，不把编译成功当成仿真成功。

## 开源范围

仓库自有代码采用 MIT 许可证，见 [LICENSE](../LICENSE)。Keil、Proteus、TIA Portal、PLCSIM、AutoCAD 及厂商 SDK 的安装包、DLL 和许可证不属于本仓库的授权范围，需要用户合法安装。排除厂商二进制不等于隐藏本项目源码。

生成的 dist/bin、日志、个人配置和工程备份不会提交；对应构建源码和脚本均可查看。MCP 的图片 Base64、Keil 桌面请求的 JSON Base64 是传输编码，不是被编码后执行的源代码。
