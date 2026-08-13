# QA Plan

## Smoke Scope

- 启动 KnowMe，打开助手空会话。
- 确认无「游戏工作室」kicker。
- 确认四卡为：查文档/知识库、会议总结、相关聊天、需求梳理。
- 点击查文档 / 会议 / 聊天，确认走飞书授权或快捷处理（未授权时给出连接提示）。
- 点击需求梳理，确认发送 intake 导向提示，并可关联工作流下一步。
- 确认左侧 Rail / 工作台流程目录不受影响。

## Regression Scope

- 关键词「策划需求案 / daemon 工作流」仍解析到游戏角色场景。
- legacy writing → game-design 映射仍成立。
- 禁用 game-studio 后回退通用空状态。

## Automated Checks

- `node --test tests/game-studio-scenes.test.js`
- `npm test`
- `npm run lint`
- `openspec validate feishu-connection-empty-state --strict`
