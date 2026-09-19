# Skill Benchmark: RQA15 paired diagnostic subset

**Model**: qwen3.8-flash
**Date**: 2026-09-06T01:06:18Z
**Evals**: SE-N01, UR-N01 (1 run each per configuration)

仅纳入两个可评分的新旧配对（12次调用中的4次）；所有N/A及不可配对留出题排除。不同专家、整包非盲、各一次，不是总体通过率、重复试验或Skill因果提升证明。所有可评分输出均未通过专业资格。

## Summary

| Metric | Old Skill | With Skill | Delta (old − candidate) |
|--------|------------|---------------|-------|
| Pass Rate | 20% ± 28% | 40% ± 28% | -0.20 |
| Time | 27.7s ± 37.1s | 35.3s ± 16.5s | -7.5s |
| Tokens | 13138 ± 5960 | 9564 ± 3744 | +3574 |

官方aggregate_benchmark生成数值；修正模板默认的3次及模型占位符。聚合输入副本清空grading内timing，让工具统一读取同run的timing.json真实总时长和provider总tokens，避免其“已有时长就不读token文件”的路径漏计。原始评分未改变；未测值没有补0。时间/成本包括各run已有修复轮次，不是评分耗时。±为这两个不同case的样本标准差，不是方法重复稳定性。
