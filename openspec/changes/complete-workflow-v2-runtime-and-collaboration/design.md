# Design
Team Runner 解析 Action Contract，低风险读取直接执行，可逆写入要求启动授权，高风险或不可逆写入进入 Gate。Human handler 等待角色输入；节点成功写检查点。Root Run store 有界保存状态、版本、事件、评论和偏离。

重跑已提交外部副作用的节点必须显式确认；上游更新可标记下游失效。普通评论不进入正式上下文，只有 input/change_request/intervention 被标注为执行上下文。
