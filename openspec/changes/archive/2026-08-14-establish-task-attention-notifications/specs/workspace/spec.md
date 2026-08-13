## MODIFIED Requirements

### Requirement: Floating assistant uses a low-interruption icon anchor

工作台悬浮入口 MUST 默认以贴近右下角的单一描边铃铛呈现，不得使用常驻的实心药丸底板、通用实心聊天气泡、品牌节点标记或厚重投影；入口 MUST 在浅色和深色主题中保持可识别。该入口定位为通知锚点：面板 MUST 展示任务待关注通知与快捷处理入口，MUST NOT 展示 Session「继续工作」恢复建议。状态红点与间歇动画 MUST 仅由通知态驱动；无通知时红点与动画 MUST 关闭。日志等次级快捷与纵向拖动 MUST 继续可用。

#### Scenario: Default workspace presentation

- **WHEN** 用户首次打开工作台或尚未保存悬浮入口位置
- **THEN** 悬浮铃铛 SHALL 显示在工作台右下角，且默认外边距不超过 8px
- **AND** 常态只显示轻量单色描边铃铛，不显示实心药丸容器、通用实心聊天气泡或品牌节点标记

#### Scenario: Panel hosts attention notifications

- **WHEN** 系统存在待关注任务通知
- **THEN** 面板 SHALL 列出通知条目（标题与摘要）
- **AND** 面板 MUST NOT 提供 Session「恢复这个 Session」主 CTA

#### Scenario: Theme and interaction visibility

- **WHEN** 用户切换浅色或深色系统主题
- **THEN** 铃铛 SHALL 使用与背景有足够区分的主题色
- **AND** 悬停、键盘焦点与处理中状态 SHALL 继续提供可感知但克制的反馈

#### Scenario: Existing assistant interactions remain available

- **WHEN** 用户点击或纵向拖动铃铛
- **THEN** 点击 SHALL 打开通知向快捷面板
- **AND** 纵向拖动 SHALL 更新并持久化入口位置
- **AND** 日志中心与日志目录快捷 SHALL 继续可用
