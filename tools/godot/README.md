# Godot 便携工具链（本地，不提交 zip/wasm）

由 `npm run godot:install` 填充：

- `Godot_v4.4.1-stable_win64_console.exe` — CI / headless
- `Godot_v4.4.1-stable_win64.exe` — 编辑器 GUI

导出模板（约 1.1GB）在首次 `npm run godot:export:mother` 时下载到：

`%APPDATA%\Godot\export_templates\4.4.1.stable\`

Web 构建输出：`public/godot-builds/mother-platformer/`（已 gitignore）
