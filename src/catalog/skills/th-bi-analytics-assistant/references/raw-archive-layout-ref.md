# raw 归档规范（技能内摘要）

**Canonical（强制全文）**：[info/conventions/raw-archive-layout.md](../../../../info/conventions/raw-archive-layout.md)

OKF 入口：[kb/okf/references/raw-archive-layout.md](../../../../kb/okf/references/raw-archive-layout.md)

## 顶层分区（10～80）

| 编号 | 目录 |
|------|------|
| 10 | 数据分析基础常识 |
| 20 | 核心业务分析 |
| 30 | 全局公共素材 |
| 40 | 分析师团队规范 |
| 50 | 培训素材 |
| 60 | 分析报告成品 |
| 70 | 跨部门协作 |
| 80 | 历史归档封存 |

## Agent 必遵

1. 读 raw 前确认路径在规范树内
2. **不得**改写 raw 正文；**可写** `raw/sources-index.md`
3. ingest 按 Canonical §4 映射到 OKF
4. 下线资料 → `80-data-history-archive/` + Wiki `deprecated`

## 人工归档

新文件 → 规范目录 → 更新 `sources-index.md` → 触发 ingest
