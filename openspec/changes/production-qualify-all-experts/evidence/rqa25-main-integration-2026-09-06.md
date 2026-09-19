# RQA25｜图片事实回执、共享预览与方法缺口
日期：2026-09-06。阶段性工程修复完成；全部24专家生产资格目标仍 ACTIVE，不能以此放行生图专家。

## 本轮落实
- 新增 `knowme.image-metadata/v1`：完整解码并保存原字节后，记录显示画布宽高、帧数、MIME、字节数和完整 SHA256。EXIF方向和GIF逻辑画布得到处理，原文件不旋转、不缩放、不裁剪。
- 同一信息进入 artifact.meta.image、receipt.images、工具正文和媒体观察。非视觉模型也能取得尺寸，但明确不能将文件事实当成画面验收。服务原始说明单独标为未核验，不覆盖本地事实。
- 修正独立复审发现的P2：MIME/hash/资源ID先验字符串，不对对象、数组隐式转换；视觉加载失败时也不会因坏ID再次抛错。
- 删除专家页180×120的高优先级缩略图覆盖，复用共享比例与420px最长边。图片独立、无图片内标题/验收操作/hover文字。正文和主输入框保留；修正窄竖图只有左侧圆角的问题。
- 文档：docs/agent-image-artifacts.md 定义事实、信任和验收边界；README明确新的真实Chromium布局回归需要预先安装测试浏览器。未自动下载或静默跳过测试，未修改发布CI。

## 实际与受控证据分开
1. **真实既有任务UI**：task-mtphk5gg-jinbr 的v2，natural1088×1440。新缩略图317.328125×420，object-fit:contain，无图片内header/footer，唯一textarea。点击原图后容器818×573.390625，在1280×820视口内完整contain；主线目视全图可见。图片仍是上一轮错误把杯盖改黑的产物，不是新生成合格样例。
2. **刷新与冷重开**：原图片、用户“只改杯身”的反馈保留；退回修改仅聚焦原textarea。未提交新修改、未点击接受。最终四角10px，冷启动后仍317.328125×420、一个输入框。
3. **隔离实例**：主进程27096、专用Temp QA profile确认后关闭；无running任务。新主进程6788，仍为knowme-expert-qualification-e3808573825e42908aef0a0f2d0f20de；已检查实际加载的工具/媒体函数含新元数据代码。没有重启日常实例或操作日常APPDATA。早期Playwright launcher process()曾报告42744，不将它混作实际主进程PID。
4. **受控原图重放**：rqa25-image-replay.cjs 经现有生产适配器处理RQA24两份原始图字节，准确回执896×1200与1088×1440。输出及原文件hash一致；没有调用真实生图服务或真实模型，也不改历史task/session回执。详见rqa25-image-replay.json。重放结果不等于新模型已经理解这些事实。
5. **集成回归**：新增runtime.execute→AgentRunExecutor→buildProductionRunPorts→真实图片解码/保存→专家新artifact晋升→session JSON重开及task store重开测试。只有模型与服务传输是离线fixture；最终请求含实际像素，保存后metadata/receipt/引用均相等。不是一次真实专业模型评测。

截图：rqa25-real-thumbnail.png（圆角修正前）、rqa25-real-thumbnail-final.png、rqa25-real-preview.png、rqa25-cold-reopen.png。主线已实际查看缩略图及大图截图；几何数据来自真实DOM，不是凭图片猜尺寸。

## 红绿、复审与最终门禁
- 最初metadata新增10项：9失败/1通过；修复后相关36通过。
- P2反例追加后：10通过/1失败；严格类型修复后相关37通过（数组/对象/坏ID覆盖视觉和非视觉路径）。
- UI新增真实Chromium几何8项初始红，修复后绿；圆角再追加1项先红后绿。5种比例、2种载入顺序、2种容器、宽/窄视口；素材是自包含SVG布局夹具，不声称生产生图支持SVG。交互仍由既有组件测试及上述真实任务UI验证补足。
- 首次完整check85858 exit0：backend3304pass/51skip；renderer86文件605pass。它早于P2、圆角和完整runtime回归，非最终锚点。
- **最终主线 npm run check，session81257，exit0**：backend3357总、3306pass、51skip、0fail；renderer86文件606pass；lint、typecheck:renderer通过。含P2、圆角、runtime落库新增回归。
- 最终限定文件 git diff --check exit0。新增源码多数在原共享工作树中已属untracked，不能拿空git diff当未修改。
- 独立报告：rqa25-metadata-review.md、rqa25-thumbnail-review.md、rqa25-image-method-gap.md。其历史版本锚点/失败保留，以各自追加复核及本节最终check为准。

## 影响与边界
GitNexus saveValidatedImage为HIGH：直接persistImageBlocks/persistImageUrls；buildImageTools为LOW，直接buildRunToolSurface；buildMediaObservation为HIGH，直接buildProductionRunPorts；decodeImage为LOW，直接validateImageBytes。已提前告知共享执行路径高风险并逐项查看调用者，不改权限或原有错误门禁。generate_image对象handler及新增describeImageMetadata索引未解析，UNKNOWN不能当安全零调用；手查buildImageTools的handler注册和formatter两处调用补足。FTS查询降级，采用源码追踪，未声称图谱穷尽。

最终全共享树detect_changes：322文件、703符号、172受影响、CRITICAL。这个数包含大量历史/并行修改，不是本轮全部改动或全审通过。没有提交、重置、覆盖外部Skill、改安装包/manifest或扩展工具权限。

本轮源码与测试范围：
- src/lib/agent-image-tools.ts、image-validation.ts、agent-media-resources.ts、新image-artifact-metadata.ts
- src/renderer/features/artifact/artifact-preview.css、features/expert/expert-workbench.css
- tests/image-artifact-metadata.test.js、新增至tests/expert-task-runtime.test.js的一项回归
- src/renderer/features/artifact/artifact-thumbnail-layout.spec.tsx
- README、通用协议文档及本阶段证据

## 专业判断与后续
独立方法审查确认：实际旧SOP已有保留条件原则，但v2最终Prompt主动扩大为整只杯子和杯盖变黑。应补对象/属性级“可改/保留”划分、编辑基准、最终参数冲突检查及三类证据分离，而不是默认增加第四个Skill。详细提案见方法报告。

**这些方法尚未写入或升级专家包，也没有新的同条件旧/新专业评测**。实际安装3.2、源码E/L3.3、canonical3.2、catalog3.1漂移仍待处理；外链th-art来源未改。下一阶段先对齐自有包与实际装配，再用受限编辑留出题验证；通用元数据和美观不会自动修复错误编辑指令。

原图尺寸仍不符合1080×1440请求，未擅自修图；两版模型当次视觉输入仍N/E。其余24专家专业方法、工具/知识库/飞书、异常/重试/修订/恢复完整资格继续推进，不以此次小范围修复重新定义总目标。
