## ADDED Requirements

### Requirement: Official shelf card blurb is a short value proposition

官方参考工作流出现在货架时，卡片第二行简介（包 `description`）MUST 为一句短价值主张，说明该流程帮助用户完成什么。MUST NOT 把逐步协作链路（含 `→` / `->` 串联的步骤复述）作为简介正文；步骤顺序 MUST 由「简要流程」与输入/产出摘要表达。

#### Scenario: Brief review card blurb stays short

- **WHEN** 用户在工作流首页查看「Brief 出图审阅」官方卡
- **THEN** 第二行是一句话价值主张，且不含 Brief→文案→提示词→门禁式逐步链路

#### Scenario: Other official cards follow the same rule

- **WHEN** 用户查看「会议闭环」或「三角色协作交付」官方卡
- **THEN** 各自第二行同样为一句短价值主张，且不含逐步箭头协作链路
