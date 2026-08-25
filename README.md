# 知息 ZHI XI · 博物馆自适应参观智能伴游

> 知你当下，息息相伴。
> 不赶着逛，也不怕错过。

样板场景：山东博物馆 · 青铜器主题参观线（Demo 模拟数据 + 公开资料整理，未接入馆方系统）

## 运行方式

```bash
# 方式一：本地服务（推荐，可启用 Agent LLM 代理）
node server.js                                    # fallback 模式：无 Key，纯本地规则引擎
DEEPSEEK_API_KEY=sk-xxx node server.js            # Agent 完整模式：LLM 理解+工具调用

# 方式二：双击 index.html（file:// 下 /api/chat 不可用，自动 fallback，功能完整）
```

浏览器打开 http://127.0.0.1:4923 ；建议 F12 切换手机视口（390×844）。

## 架构（v2：真·工具调用型 Agent）

```
用户自然语言
  → VisitPlannerAgent（js/agent.js）
      → LLM（经同源 /api/chat 代理，Key 只在服务端环境变量）
          理解目标与约束 → 选择工具 → 组合结果 → 行动决策 → 措辞
      → 本地确定性工具（LLM 无权编造数字/ID）：
          KnowledgeTool   关键词+主题+人物+概念+时代组合检索（含别名扩展）
          RouteTool       距离/步行时间/路线统计
          StateTool       剩余时间·节奏·信息负荷·behaviorSignals 行为信号
          PlanningTool    初始规划/收窄/收尾/插展品试算（加权贪心+顺路重排）
          CultureExtensionTool 文创与兴趣轨迹绑定推荐
      → 结构化 AgentAction JSON
          { intent, reply, reason, toolCalls, routeChanged, newRoute,
            addedExhibits, removedExhibits, contentMode,
            estimatedTotalMinutes, nextAction }
      → 前端按 nextAction 真实执行：
          continue | replan | show_exhibits | light_mode | wrap_up | rest
```

**分工边界**：LLM 只负责理解、约束提取、工具选择、行动决策与措辞；
所有距离、时间、件数、路线由本地工具计算。normalize 阶段强制复核——
LLM 给出的 estimatedTotalMinutes 一律被本地 RouteTool 重算覆盖，
newRoute 自动补齐已看前缀、去重、顺路重排后才允许落地。

**Fallback**：`window.ZHIXI_AGENT.endpoint` 不可达 / 服务端无 Key / LLM 超时或输出不合法
→ 自动回落本地规则引擎（`Agent.think()`）。黄金路径在纯离线环境完整可演示。

## API Key 安全（P0-2）

- 前端代码中不存在任何 Key（`test-scenario.js 场景C` 静态扫描保证）。
- 浏览器只 POST 同源 `/api/chat`；server.js 从环境变量 `DEEPSEEK_API_KEY` 读取并转发 DeepSeek。
- 未配置 Key 时 `/api/chat` 返回 `{fallback:true}`，前端静默降级。

## 黄金路径演示脚本

1. 首页「🌿 慢慢看」→「90分钟」→ 输入"青铜器"→ 开始规划（初始路线由 PlanningTool 实时算出）
2. 参观 → 连看 3 件 → 「要不要轻松一点？」→ 慢一点 → 后半程真实缩短
3. 「调整一下」→ 少讲一点 → 轻量模式
4. 展品页「想聊聊？」→"这个和孔子有关系吗？"→ 带我去看看 → 路线再次真实改变
5. 结束参观 → 今日兴趣 → 未完待续 → 文创（理由绑定你的参观轨迹）→ 回首页续上一次

## 测试

```bash
node test-golden.js     # 32项：Agent规则引擎黄金路径
node test-views.js      # 20项：全页面多状态渲染
node test-scenario.js   # 46项：完整业务流 + LLM工具编排仿真(伪transport) + Key安全扫描
```

## 数据边界（P1-5 可审计）

每件展品标注 `sourceType`：
- `public_site` —— 亚醜钺、颂簋、蛋壳黑陶杯、银雀山汉简《孙子兵法》、东平汉墓壁画、
  孔子见老子画像石、蝉冠菩萨像、九旒冕等，依据公开资料整理，详情页附来源链接。
- `demo` —— 其余条目及讲解文案为 Demo 模拟内容，详情页明确标注，不冒充馆方官方内容。
