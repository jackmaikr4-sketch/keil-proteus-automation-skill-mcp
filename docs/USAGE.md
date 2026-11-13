# 调用流程与工具参数

所有文件参数使用白名单内的绝对路径。以下对象是 MCP 工具调用参数，不是直接在 PowerShell 中执行的命令。应由同一组持续连接的 MCP 客户端按顺序调用；示例中的 SHA256、buildId 必须替换为实际返回值。

## 从源码到仿真

1. `keil_read_project`：`{"file":"C:/Projects/My8051/blink.uvproj"}`。读取实际目标名称，不能假定叫 Target 1。
2. `keil_read_source`：`{"file":"C:/Projects/My8051/main.c"}`。非 UTF 文件增加 `"encoding":"gbk"` 等参数。
3. `keil_replace_source`：传入 `file`、仅匹配一次的 `oldText`、`newText` 和上一步 `sha256` 对应的 `expectedSha256`。非 UTF 文件继续传入编码。程序自动备份；内容已变化时拒绝修改。
4. `keil_build`：`{"file":"C:/Projects/My8051/blink.uvproj","target":"实际目标名称","rebuild":true}`。必须检查 `success` 和 `artifactVerified`，保存 `buildId`。工程应启用 HEX 输出。
5. `proteus_open_project`：`{"file":"C:/Projects/My8051/blink.pdsprj"}`。
6. `proteus_simulation`：`{"action":"stop"}`。
7. `proteus_set_firmware`：`{"projectFile":"C:/Projects/My8051/blink.pdsprj","reference":"U1","buildId":"本次构建返回的 UUID","clockHz":12000000}`。晶振频率必须匹配实际电路；不需要修改时可省略 `clockHz`。多个窗口时传入正确的 `pid`。
8. `proteus_simulation`：`{"action":"start"}`，检查状态、verified 及截图；需要时调用 `proteus_screenshot`。
9. 完成观察后 `proteus_simulation`：`{"action":"stop"}`，再 `proteus_save_project`：`{"file":"C:/Projects/My8051/blink.pdsprj"}`。

`buildId` 指向该安装目录 `artifacts` 中的构建记录；不是任意 HEX 路径。加载前再次校验 HEX 哈希。清空记录、构建失败或手动修改 HEX 后，应重新构建。

## 完整工具表

| 工具 | 必填参数 / 主要可选参数 |
| --- | --- |
| keil_installation_check | 无 |
| keil_read_project | file |
| keil_open_project | file |
| keil_read_source | file / encoding |
| keil_replace_source | file, oldText, newText, expectedSha256 / encoding |
| keil_build | file, target / rebuild（默认 false） |
| keil_build_result | buildId |
| proteus_installation_check | 无 |
| proteus_open_project | file |
| proteus_inspect | 可选 pid |
| proteus_screenshot | 可选 pid, maximize |
| proteus_click | snapshotId, x, y / button: left 或 right, double |
| proteus_keys | key / pid |
| proteus_type | text / pid |
| proteus_control | action: invoke 或 set_value；至少提供 name 或 automationId / class, value, pid |
| proteus_open_component | reference / pid |
| proteus_set_firmware | projectFile, reference, buildId / clockHz, pid |
| proteus_simulation | action: start、pause、stop、status / pid |
| proteus_read_logs | 可选 pid |
| proteus_save_project | file / pid |

`proteus_keys.key` 支持 escape、enter、tab、select_all、find_component、save。优先使用高层工具，避免依赖坐标。`proteus_control` 的定位字段从 inspect 取得，并且必须匹配唯一控件。

`proteus_click` 的坐标相对于截图，要求同一服务会话内生成、未使用且不超过 60 秒的 snapshotId；窗口位置或尺寸变化会拒绝点击。一次性的 `scripts/call.mjs` 每次都会建立新服务会话，因此不能跨两次脚本命令复用截图 ID 或已打开工程状态。

## 错误与结果

工具错误通过 MCP `isError: true` 返回，文本 JSON 带有 `error`，不得继续当作成功结果使用。源码备份、工程备份及截图路径均为本地文件。低层输入返回 `verified: false` 时，继续 inspect 或截图确认；发现陌生弹窗应先读取内容，不盲目确认。

仿真状态根据原生菜单状态识别，unknown 不代表成功；日志只覆盖可访问文本。要确认数码管内容、LED 节奏或电路功能，需要实际查看画面及必要的时序观察。
