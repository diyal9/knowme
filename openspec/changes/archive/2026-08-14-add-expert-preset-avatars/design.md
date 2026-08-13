## Context

专家身份呈现由 `agent-identity.js` 统一：界面禁止直出 emoji，只用语义 SVG。用户需要更强的拟人辨识，但不接受工种图鉴（花、包体大）。已生成 8 张 KnowMe 扁平矢量头像并压到 256px。

## Goals / Non-Goals

**Goals**
- 8 张预设作为分类锚点：game×4、office×3、other×1
- 解析优先级：显式 `avatar` 角色键 → 语义 match → `other/partner`
- 会话身份区可显示图片；无图时回退图标

**Non-Goals**
- 上传、生图、Hub 编辑器选头像 UI
- 替换助理 FAB 品牌 SVG

## Decisions

1. **资源路径**：运行时用 `assets/avatars/<domain>/<role>.png`（相对 `src/` 页面）。品牌源在 `assets/brand-src/avatars/`，便于以后重导出。
2. **avatar 字段兼容**：支持 `office/writer`、`writer`、旧值 `office`/`game`；未知值不崩溃，走语义或 fallback。
3. **解析放在 AgentIdentity**：新增 `identityAvatarSrc(agent)`，返回相对 URL 或空；渲染层决定 img vs ico。
4. **不改 EXPERT.md schema 形状**：仍是字符串 avatar，不引入对象结构（避免破坏现有 parser）。

## Risks / Trade-offs

- 图片在小尺寸（32–42px）细节弱 → 道具已做大符号，可接受。
- 语义误匹配 → fallback + 精选专家显式键降低风险。

## Migration

- 旧专家无合法键：行为与现在一致（图标），或偶然匹配到图片（增强，非破坏）。
