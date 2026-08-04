# Retro: knowme-agent-sources

## 做了什么

- KnowMe → **知我 KnowMe** 品牌与独立 userData
- 内容源抽象：本地文件夹 + GitLab clone/pull
- 工作台优先真实文件树；设置新增「内容源」页

## 学到什么

- 品牌与数据目录应同 Story 决策；裸改 productName 会丢用户数据，本轮刻意不迁移
- Token 必须与源索引分离；git remote 临时注入凭据后务必还原
- 大重构宜 Source 抽象先行，便签 JSON 可降级保留以免一次砍光

## 后续

- 实机 GitLab Token / 目录点选冒烟
- 清理便签遗留 UI/IPC
- Agent 工具链绑定当前 Source（读改文件、同步）
