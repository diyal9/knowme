## ADDED Requirements

### Requirement: Surface switch paints target tabs before async load

从工作台切到助理（或反向）时，Session Tab 栏 MUST 在用户可感知的首帧展示**目标 surface** 的打开集合，MUST NOT 在异步 Session 加载完成前继续展示上一 surface 的打开签页。

#### Scenario: Workbench to assistant does not flash workbench tabs

- **WHEN** 用户在工作台已打开多个任务 Session，并点击侧栏进入助理
- **THEN** 助理顶栏 Tab 列表立即为目标助理打开集合（例如仅「通用」）
- **AND** MUST NOT 出现工作台多签页短暂铺满再消失的闪现

#### Scenario: Assistant to workbench restores workbench tabs without agent flash

- **WHEN** 用户从助理切回工作台且工作台面已有打开集合
- **THEN** Tab 栏立即展示工作台打开集合
- **AND** MUST NOT 先闪现助理签页再换成工作台签页
