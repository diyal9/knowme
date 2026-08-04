# Retro: feishu-scope-confirm-and-resume

## 学到什么

1. 权限判定表的 prefix 必须能被申请列表覆盖，否则 UI 永远卡在「补充扩展权限」。
2. 飞书对 `--scope` 列表整体校验：一个非法名字毒化整轮；runtime 发现的 scope 必须净化并有降级阶梯。
3. `knowme://` 是应用内动作，不能进 `open-external`，否则用户只看到「不允许的协议」。

## 是否升格

≥3 次同类问题后再 `/evolve`；本次已落单测不变量。
