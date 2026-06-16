# 用户 / PM 主路径 parity

生成时间：2026-06-16T16:55:07.107Z

## 用户故事（产品验收口径）

1. 用户复制样品 prompt → 创作/试玩与 demo 同款
2. 用户克隆样品 → 继承 polish，试玩一致
3. 用户自由 prompt → 不虚假承诺「同款」
4. 样品馆「用此 prompt 创作」→ 创作台 prefill 深链可还原

## 结果

- 同 prompt 创作：**17/17**
- 克隆 profile：抽检 5/5 结构
- 非样品不误标：**通过**

## 用户可见兑现

- 试玩页 / 创作预览：`SampleParityTrustBadge` 告知「与样品馆同款」
- 样品馆卡片 / 试玩页：`用此 prompt 创作` → `/create?prefill=`
- 创作台：识别样品 prompt 时显示同款预期 + 生成中文案
- 结果页：`ResultMomentBanner` 同款标题（同 prompt 路径）
- 引擎加载：`gamePlayer.loading` 遮罩至 `__PHASER_PLAY_READY__`，避免闪屏

## 状态

全部通过
