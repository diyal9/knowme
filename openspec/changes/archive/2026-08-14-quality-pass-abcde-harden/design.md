# Design: quality-pass-abcde-harden

## Security

- `open-external`: http/https/mailto 仍走 `shell.openExternal`；`file:` 转 `fileURLToPath` + `shell.openPath`
- webview: 仅 http(s)；`will-attach-webview` 关 nodeIntegration、禁非 http(s)
- settings: `publicSettings(s, { includeSecrets })`；get-settings 仅 settingsWin 含密钥
- sources: `MAX_READ_BYTES = 2_000_000`

## UX close loops

- 缺 API 时禁用/改文案，不弹「暂不支持」死路
- openArtifact：无 review 时尝试展示正文或外链

## Tokens / naming

- Hub accent → `#2f6f5e`；layout 高频 `#2f7461`/`#34312d` primary → wb tokens
- provenance: personal/forked=我的，official=官方，else=共享
