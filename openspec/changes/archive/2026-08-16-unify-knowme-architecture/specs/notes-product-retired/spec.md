# notes-product-retired

## Purpose

KnowMe 不再提供独立便签产品面（多窗卡片、总览、备份、托盘关便签）。

## Requirements

### Requirement: Note product surfaces are unreachable

用户无法从工作台打开独立便签窗口或便签总览窗。

#### Scenario: No new-note affordance in workspace chrome

- **WHEN** 用户打开主工作台
- **THEN** 界面不提供「新建便签」或打开便签总览的入口

#### Scenario: Note IPC is not registered

- **WHEN** 渲染层调用已删除的便签 IPC
- **THEN** 桥上不存在创建便签窗口的 API

### Requirement: File mentions use content sources

助理引用文件只来自已绑定内容源。

#### Scenario: At-menu catalog is source files

- **WHEN** 用户在助理输入 `@`
- **THEN** 候选来自内容源文件树，而不是便签卡片库
