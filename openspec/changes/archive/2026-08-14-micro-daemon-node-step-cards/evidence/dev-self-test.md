# Dev self-test: micro-daemon-node-step-cards

## Commands

- `npm test` → 1727/1727 pass
- `npm run lint` → ok

## Checks

1. 微卡：`stepCardTitles` → 中文 `meta` 在上，英文 `label` 在下
2. 布局：`is-zigzag` + `is-zig-left` / `is-zig-right` 中轴左右交替
3. 详情钻取与切 Tab 清空仍可用

## Notes

重启 Electron 后打开管线审阅「步骤」核对之字形与中英文顺序。
