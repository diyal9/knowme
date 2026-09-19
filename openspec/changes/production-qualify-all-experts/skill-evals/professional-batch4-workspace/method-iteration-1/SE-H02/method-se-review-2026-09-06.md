# RQA15 SE-H02 留出样本作者评审

2026-09-06。使用skill-creator grader/schema；评分员是候选方法作者，非盲、非作者独立评审。未参与按候选正文构造本题，但知道通用方向；本次看到输出后不修改方法。官方viewer由主线维护。

## 结论

新版 **4/5**：前四项通过，原测试设计缺“重复区间”及“抛错后输入不变”两类明确案例，第五项不通过。修正代码经审查者纯函数probe **11/11组通过**。额外问题：末尾“100k通常<50ms”未经专家测量且不能从O(N log N)推出。无冻结代码/越权硬失败，但不代表专业资格通过。

绑定新版 task `task-mtp2lh9n-n8ya7` / run `expert_task-mtp2lh9n-n8ya7_mtp2lhpo`，版本2.1.0、agentHash `d462213cce58a01b`。完整正文4262字符，0 tools，MODEL length→FINALIZE stop。评分不惩罚该修复，不给丢弃草稿补分。

旧版 task `task-mtp2gfw1-60boy` / run `expert_task-mtp2gfw1-60boy_mtp2gg2i`：ERROR，MODEL length及FINALIZE length，没有assistant正文/交付，专业评分 **N/A而非0**，不能计算新旧专业分差。旧capture.metrics.toolCalls=1但保存的task没有具名tool回执，不能猜工具名称或把它说成零工具；其执行边界另记，不能用无正文评价代码能力。

## 五项证据

| 断言 | 结果 | 原文与复核 |
| --- | --- | --- |
| 1 完整输入契约 | 通过 | 外层/子行数组及长度、Number.isSafeInteger、非负且start<end；统一INVALID_RANGE，空输入新result。probe覆盖23类非法及稀疏数组。 |
| 2 严格重叠与夹具 | 通过 | 数值排序、严格<、Math.max；X/Y/Z结果(74–76)正确，Z桥接闭包不被端点接触阻断。 |
| 3 不变性及引用隔离 | 通过 | 只排序外层副本、结果push新行；I1前后内容检查，I2/I3返回修改与引用不共享。代码失败前也无输入写入。 |
| 4 独立缺陷与复杂度 | 通过 | 原地sort、接触误并、子数组别名和校验缺失均解释；O(N log N)/O(N)与排序扫描相符。没有完整列出原嵌套缩短时序，但B2和Math.max覆盖，断言只要求至少两个缺陷。 |
| 5 完整定向设计 | 不通过 | V/I/B表没有重复输入测试，也没有非法输入抛错后的不变性断言。专家已说明未执行、不虚构旧覆盖；审查者补测不补原设计分。 |

## 全文claim审计

- 116行“100k通常<50ms”没有环境、分布、样本或专家回执。审查者单次两类数据分别 **43.959ms / 54.833ms**；一个超过50ms不证明普遍慢，但两次更不能建立“通常”性能保证。复杂度合理和绝对时延已验证是两回事。
- 同行Math.max内联优化不佳只是条件建议，不是实测瓶颈；没有profile证据，不应优先据此微优化。
- 64行O(N)额外空间事实成立；题面并未单独指定线性硬上限，措辞“满足约束”不应升级为新用户要求。
- 原实现默认排序错误并非对所有输入“必然失效”，某些输入恰已按字典/数值同序；作为存在反例的缺陷判断成立，不扩大为每次必错。
- 浅拷贝足够保护外层sort，因修改的合并行均为新result数组，并不需要深拷贝所有输入行。不因出现“浅拷贝”误判别名漏洞。
- 115行原型/迭代器风险明确置于契约排除范围，不为追求覆盖元编程引入题外要求。113行静态/零工具声明与记录相符，审查者后续probe不是专家运行。

## 审查者纯函数probe（非expert receipt）

直接从冻结answer.md抽取唯一javascript代码块，在无require/process注入的vm上下文编译，调用其纯函数。未修改原代码或使用替代实现。Node v24.14.0；断言在本机Node执行，未访问QA/API。编译有1s界限；函数调用为本次已审查的同步有界输入，未声称vm提供整个执行硬超时/隔离安全保证。

覆盖：X/Y/Z；23类非法普通值；稀疏外层/子行；新空数组/MAX_SAFE边界；深冻结及共享输入行/结果修改；晚到非法行失败不变性；重复、嵌套、接触、桥接；十万段逆序不相交与重叠输入。两种100k输出分别100000段、1段。不是所有JS引擎/所有输入的性能基准，不计入专家工具数或断言5。

可复跑：仓库根启动Node，将以下JavaScript送入Node执行（例如node -e传入该脚本）。仅文件读取、纯函数与内存断言，无写文件或网络：

```javascript
const fs=require("fs"),vm=require("vm"),assert=require("assert/strict"),{performance}=require("perf_hooks"),crypto=require("crypto");
const p="openspec/changes/production-qualify-all-experts/skill-evals/professional-batch4-workspace/method-iteration-1/SE-H02/with_skill/outputs/answer.md";
const answer=fs.readFileSync(p,"utf8"),code=answer.match(/```javascript\r?\n([\s\S]*?)```/)[1];
const normalize=vm.runInNewContext(code+"\nnormalizeRanges",Object.create(null),{timeout:1000});
const plain=x=>JSON.parse(JSON.stringify(x)),rows=[];
function check(name,fn){fn();rows.push({name,passed:true})}
const fixtures=[
["X",[[10,14],[2,7],[6,9],[9,10]],[[2,9],[9,10],[10,14]]],
["Y",[[1,8],[2,3],[7,10],[10,12]],[[1,10],[10,12]]],
["Z",[[2,5],[5,8],[4,6]],[[2,8]]]];
for(const [name,input,expected]of fixtures)check(name,()=>assert.deepEqual(plain(normalize(input)),expected));
const invalid=[null,undefined,{},true,1,"x",[null],[1],[[]],[[1]],[[1,2,3]],[[-1,2]],[[0,-1]],[[1,1]],[[2,1]],[[0.5,2]],[[0,2.5]],[[NaN,2]],[[0,Infinity]],[[0,Number.MAX_SAFE_INTEGER+1]],[["0",2]],[[false,2]],[[0,2n]]];
check("invalid ordinary values: "+invalid.length,()=>{for(const input of invalid)assert.throws(()=>normalize(input),e=>e.name==="Error"&&e.message==="INVALID_RANGE")});
check("sparse outer and sparse rows",()=>{for(const input of [Array(1),[[0,,]],[[,2]],[[0,1],,]])assert.throws(()=>normalize(input),e=>e.message==="INVALID_RANGE")});
check("empty new outer and MAX_SAFE endpoints",()=>{const input=[];const out=normalize(input);assert.notEqual(out,input);assert.deepEqual(plain(out),[]);assert.deepEqual(plain(normalize([[Number.MAX_SAFE_INTEGER-1,Number.MAX_SAFE_INTEGER]])),[[Number.MAX_SAFE_INTEGER-1,Number.MAX_SAFE_INTEGER]])});
check("deep freeze + aliases + result mutation",()=>{const shared=Object.freeze([1,8]);const input=Object.freeze([Object.freeze([7,10]),shared,shared,Object.freeze([10,12])]);const before=structuredClone(input),out=normalize(input);assert.deepEqual(input,before);assert.notEqual(out,input);for(const row of out)assert.ok(!input.includes(row));assert.deepEqual(plain(out),[[1,10],[10,12]]);out[0][1]=99;assert.deepEqual(input,before)});
check("late invalid row leaves successful-prefix input unchanged",()=>{const input=Object.freeze([Object.freeze([7,9]),Object.freeze([1,8]),Object.freeze([2,2])]);const before=structuredClone(input);assert.throws(()=>normalize(input),e=>e.message==="INVALID_RANGE");assert.deepEqual(input,before)});
check("duplicates, nesting, touch and bridge",()=>{assert.deepEqual(plain(normalize([[2,5],[2,5]])),[[2,5]]);assert.deepEqual(plain(normalize([[1,10],[2,3]])),[[1,10]]);assert.deepEqual(plain(normalize([[1,2],[2,3]])),[[1,2],[2,3]]);assert.deepEqual(plain(normalize([[2,5],[5,8],[4,6]])),[[2,8]])});
const timings=[];
for(const kind of ["disjoint-reverse","overlap-reverse"]){check("100000 "+kind,()=>{const input=Array.from({length:100000},(_,i)=>{const k=99999-i;return kind==="disjoint-reverse"?[3*k,3*k+1]:[k,k+2]});const start=performance.now(),out=normalize(input),elapsedMs=performance.now()-start;assert.equal(input[0][0],kind==="disjoint-reverse"?299997:99999);if(kind==="disjoint-reverse"){assert.equal(out.length,100000);for(let i=0;i<out.length;i++){assert.equal(out[i][0],3*i);assert.equal(out[i][1],3*i+1);assert.notEqual(out[i],input[99999-i])}}else assert.deepEqual(plain(out),[[0,100001]]);timings.push({kind,elapsedMs:Number(elapsedMs.toFixed(3)),inputCount:input.length,outputCount:out.length})})}
console.log(JSON.stringify({reviewerProbe:true,expertReceipt:false,node:process.version,answerSha256:crypto.createHash("sha256").update(answer).digest("hex"),passed:rows.length,total:rows.length,rows,timings,performanceClaim:"two local samples, not evidence of generally <50ms"},null,2));
```

实测输出：

```json
{
  "reviewerProbe": true,
  "expertReceipt": false,
  "node": "v24.14.0",
  "answerSha256": "73e474b2b3ff979996309513b9e30d7d30b9f3d60181decd021d28181f3b8bc7",
  "passed": 11,
  "total": 11,
  "rows": [
    {
      "name": "X",
      "passed": true
    },
    {
      "name": "Y",
      "passed": true
    },
    {
      "name": "Z",
      "passed": true
    },
    {
      "name": "invalid ordinary values: 23",
      "passed": true
    },
    {
      "name": "sparse outer and sparse rows",
      "passed": true
    },
    {
      "name": "empty new outer and MAX_SAFE endpoints",
      "passed": true
    },
    {
      "name": "deep freeze + aliases + result mutation",
      "passed": true
    },
    {
      "name": "late invalid row leaves successful-prefix input unchanged",
      "passed": true
    },
    {
      "name": "duplicates, nesting, touch and bridge",
      "passed": true
    },
    {
      "name": "100000 disjoint-reverse",
      "passed": true
    },
    {
      "name": "100000 overlap-reverse",
      "passed": true
    }
  ],
  "timings": [
    {
      "kind": "disjoint-reverse",
      "elapsedMs": 43.959,
      "inputCount": 100000,
      "outputCount": 100000
    },
    {
      "kind": "overlap-reverse",
      "elapsedMs": 54.833,
      "inputCount": 100000,
      "outputCount": 1
    }
  ],
  "performanceClaim": "two local samples, not evidence of generally <50ms"
}
```

逐项评分、task/run和三个输入SHA256见 `with_skill/grading.json`。原文与transcript.capture、同run assistant完全一致；metadata.prompt与task材料一致。只新增评分及本报告，不修改Skill、冻结原文、旧失败记录或runtime。

