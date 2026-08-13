# Dev self-test — flatten-pipeline-run-review-chrome

Date: 2026-08-12

## Commands

```text
npm test  → pass
npm run lint → pass
```

## Checks

- [x] 运行壳去掉米色渐变，改白底细边
- [x] daemon 审阅态隐藏 runner head；移除「审阅 制品」大标题
- [x] 顶栏副行避免与标题同文重复
- [x] 「代码工作区」删 stub toast；无本地路径时隐藏，有路径则 artifact-open

## Notes

与图2「项目配置」侧栏对齐：扁平白卡、紧凑字阶、少嵌套。
