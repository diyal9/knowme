# 商业洞察方法对照

本目录是开发验收证据，不是产品可安装 Skill，因此保存在 OpenSpec 而非运行时 catalog 下。skill-snapshot 保存修改前 1.0.0，候选为 src/catalog/skills/business-insight-report 1.1.0；两份声明均已保存或可由源码核对。

三题均为虚构数据。每题分别由独立 Codex 子代理读取一个版本并生成回答；不是手写理想输出，也不是 KnowMe 内真实模型任务。子代理继承本任务模型；没有切换成用户在 KnowMe 中配置的模型，因此不能据此替代产品内专业资格验收。第三题是包含历史摘要的一次独立请求，不证明实际多轮记忆和持久化。

运行目录中 answer.md 是对话交付，transcript.md 是简短过程记录，不包含隐藏思维链。每题 eval_metadata.json 保存同一组客观判据。每版本每题仅运行一次；不能估计稳定性。并发上限使第三题在前两题完成释放槽位后成对运行。完成通知没有提供 token/duration，故这些成本数据不可用，不能当作 0 消耗。

Skill 改善必须由实际对照证明；新旧持平也应照实记录。不得以更多章节、更多字数或新版本身份加分。功能运行和专业能力的完整资格标准见 ../../expert-rubrics.md 第 8 节（最终以 change 根目录同名文档为准）。

review.html 由 skill-creator 的 generate_review.py 生成，供查看输出与评测。最终评分和完整结果以 iteration-1/benchmark.json 及各 run/grading.json 为准，文件尚未生成时表示评分未完成。
