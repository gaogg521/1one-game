# 样品 AI 修改链路验收

- 时间：2026-06-15T15:06:06.468Z
- 目标：http://43.163.105.71:6666/play/sample-grow-a-garden
- 指令：把起始金币改成200
- 结果：PASS · 12.6s

| 步骤 | 结果 | 耗时 | 说明 |
|------|------|------|------|
| health | ✅ | 0.2s | ok |
| load-project | ✅ | 0.1s | {"farming":57} |
| api-generate-patch | ✅ | 4.8s | {"coins":{"farming":200,"gameplay":200},"promptLen":36} |
| play-ui-patch | ✅ | 7.0s | patch prompt cleared, no error banner |
