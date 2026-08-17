# src-comments Specification

## Purpose
TBD - created by archiving change require-src-comments. Update Purpose after archive.
## Requirements
### Requirement: 源码必须有必要且简短的注释

`src/` 下新增或实质性修改的 `.ts`/`.tsx`/`.js` 模块 MUST 包含三类必要注释，且 MUST NOT 用废话或复述代码充数。

#### Scenario: 文件头说明职责

- **WHEN** 新增或实质性修改一个 `src/` 模块
- **THEN** 文件顶部 MUST 有简短文件头：模块职责、不负责什么（若边界易混）、关键调用方或依赖（可选，一行）

#### Scenario: 导出函数说明契约

- **WHEN** 模块导出有产品/安全/编排语义的函数
- **THEN** 该函数 MUST 有简短注释：做什么、关键约束或失败语义；内部琐碎 helper MUST NOT 堆注释

#### Scenario: 常量说明为什么

- **WHEN** 模块存在非字面自明的常量、魔法数或依赖清单
- **THEN** MUST 用一行注释说明含义或改动后果；`0`/`1`/`true` 等自明值不必注释

#### Scenario: 禁止废话

- **WHEN** 编写注释
- **THEN** MUST NOT 复述下一行代码；MUST NOT 为过 checkJs 堆无信息 `@param`

### Requirement: 生成主链路作为注释示范

下列模块 MUST 同时具备文件头、导出函数注释，以及其中非显而易见常量/清单的注释：`src/ipc/ai-generate.ts`、`src/lib/agent-generate-libs.ts`、`src/lib/agent-generate-prepare.ts`、`src/lib/agent-generate-tool-surface.ts`、`src/lib/agent-generate-execute.ts`、`src/lib/agent-generate-child-ports.ts`、`src/lib/agent-context-orchestrator.ts`。

#### Scenario: 打开生成 IPC 即可知道壳与内核边界

- **WHEN** 阅读 `src/ipc/ai-generate.ts`
- **THEN** 文件头 MUST 写明本文件只注册 IPC / abort / stream，生成在 `executeAgentGenerate`

#### Scenario: 记忆策略函数可读

- **WHEN** 阅读 `buildMemoryPolicy`
- **THEN** 注释 MUST 写明 chat 档不注入工作记忆、work 档才启用

