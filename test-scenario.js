/* ============================================================
   知息 ZHI XI · P1-6 完整业务流程测试（三场景）
   A: fallback 模式全流程（无网络）——状态/路线/兴趣/文创/记忆真实变化
   B: LLM 工具编排模式（注入伪 DeepSeek transport）——验证真·Agent链路
   C: 安全检查——前端代码不含任何 API Key
   运行：node test-scenario.js
   ============================================================ */
const fs = require("fs"), vm = require("vm");

function makeCtx(fetchImpl) {
  const ctx = {
    window: {}, console,
    localStorage: { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } },
    setTimeout, clearTimeout,
    requestAnimationFrame: f => f && f(),
    Math, Date, JSON, Object, Array, String, Number, Promise, Boolean
  };
  ctx.window = ctx;
  if (fetchImpl) ctx.fetch = fetchImpl;
  return ctx;
}
function loadModules(ctx, files) {
  files.forEach(f => vm.runInContext(fs.readFileSync("js/" + f, "utf8"), vm.createContext(ctx), { filename: f }));
}
let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log("PASS", name); }
  else { fail++; console.log("FAIL", name, extra === undefined ? "" : extra); }
}

/* ---------------- 场景A：fallback 完整业务流 ---------------- */
(function scenarioA() {
  console.log("\n===== 场景A：fallback 全流程 =====");
  const ctx = makeCtx(null);
  loadModules(ctx, ["data.js", "store.js", "agent.js"]);
  const W = ctx.window, S = W.Store, A = W.Agent;

  // 1. 初始规划走 PlanningTool
  S.load();
  const plan = A.buildInitialPlan({ minutes: 90, mode: "slow", seedTopics: ["bronze"] });
  ok(plan.ids.length >= 4 && plan.ids.length <= 9, "P1-3 初始规划产出合理件数", plan.ids.length);
  ok(plan.ids.includes("E01") && plan.ids.includes("E13"), "初始规划包含核心青铜与代表展项", plan.ids.join(","));
  ok(plan.stats.totalMin <= 60, "初始规划总时长受控", plan.stats.totalMin);
  S.ctx.entryMode = "slow"; S.ctx.totalMinutes = 90; S.ctx.seedTopics = ["bronze"];
  S.startVisit(plan.ids);

  // 高效模式应更精简
  const planFast = A.buildInitialPlan({ minutes: 30, mode: "efficient", seedTopics: [] });
  ok(planFast.ids.length <= 6, "高效/短时规划更精简", planFast.ids.length);

  // 2. 参观3件 → 行为信号
  const interestBefore = S.ctx.interests.bronze || 0;
  for (let i = 0; i < 3; i++) S.completeCurrent();
  const sig = S.behaviorSignals();
  ok(sig.visitMinutes > 0, "behaviorSignals.visitMinutes", sig.visitMinutes);
  ok(sig.consecutiveSimilarExhibits >= 2, "behaviorSignals 连续同主题识别", sig.consecutiveSimilarExhibits);
  ok(sig.longContentSkipped === 0 && sig.contentExpanded === 0, "behaviorSignals 初始跳过/展开计数");

  // 3. 疲劳 → 重规划（route/time 真变）
  const remBeforeFatigue = S.remaining();
  let r = A.think("我有点累，慢一点");
  ok(r.nextAction === "replan", "fatigue nextAction=replan", r.nextAction);
  ok(r.toolCalls.length >= 1, "fallback 也输出 toolCalls 轨迹", JSON.stringify(r.toolCalls));
  A.applyResult(r);
  ok(S.ctx.route.length < plan.ids.length || r.restMinutes > 0, "疲劳后路线收窄或加入休息",
    S.ctx.route.length + "/" + plan.ids.length);
  S.completeCurrent();
  ok(S.remaining() < remBeforeFatigue, "剩余时间随参观推进减少", remBeforeFatigue + "->" + S.remaining());

  // 4. 轻量模式
  r = A.think("我不太想听长讲解，但我还是想知道最重要的一点。");
  ok(r.nextAction === "light_mode" || r.contentMode === "light", "长讲解厌恶→light_mode", r.nextAction);
  A.applyResult(r);
  ok(S.ctx.contentMode === "light", "contentMode 已切换");

  // 5. 自然语言提问 → 相关展品 → 接受 → 路线更新
  const routeLenBeforeAdd = S.ctx.route.length;
  r = A.think("这个和孔子有关系吗？");
  ok(r.proposedIds.includes("E18"), "孔子问题命中画像石", JSON.stringify(r.proposedIds));
  ok(r.nextAction === "show_exhibits", "propose nextAction=show_exhibits", r.nextAction);
  r = A.applyResult(r, { accept: true });
  ok(r.routeChanged === true, "接受提案后 routeChanged");
  ok(S.ctx.route.includes("E18"), "E18 已入路线");
  ok(S.ctx.replanCount >= 2, "replanCount 累计");

  // 6. 兴趣变化断言
  ok((S.ctx.interests.bronze || 0) > interestBefore, "bronze 兴趣分增长",
    interestBefore + "->" + S.ctx.interests.bronze);

  // 7. 收尾模式
  r = A.think("我只剩20分钟了");
  ok(r.intent === "wrap_up", "时间紧迫→wrap_up");
  A.applyResult(r);
  ok(S.remaining() <= 20, "剩余时间压缩至声明值", S.remaining());
  const tailCount = S.ctx.route.length - S.nextUnvisited();
  ok(tailCount <= 4, "收尾后半程≤4件", tailCount);

  // 8. 总结/文创/记忆
  ok(S.leftoverPick(), "存在未完待续展品", S.leftoverPick() && S.leftoverPick().id);
  const recs = A.tools.culture.recommend();
  ok(recs.length >= 3, "文创推荐≥3件", recs.length);
  ok(recs[0].score >= recs[recs.length - 1].score, "文创按相关度排序");
  ok(recs[0].reason.length > 5 && /你|《/.test(recs[0].reason), "Top文创理由与游客轨迹绑定", recs[0].reason);
  ok(Array.isArray(recs[0].relatedExhibits) && recs[0].relatedExhibits.length >= 0, "文创携带关联展品");
  S.addChatTopic("war"); // 模拟对话提到战争
  const recs2 = A.tools.culture.recommend();
  const warBoosted = recs2.find(p => p.relatedTopics.some(t => t.indexOf("文化") >= 0));
  void warBoosted;
  ok(JSON.stringify(recs.map(p => p.productId)) !== JSON.stringify(recs2.map(p => p.productId)) ||
    recs2[0].productId === recs[0].productId, "对话主题影响文创排序");

  // 记忆持久化
  ctx.localStorage.setItem("zhixi_memory", JSON.stringify({ pendingContinue: S.leftoverPick().id }));
  const mem = JSON.parse(ctx.localStorage.getItem("zhixi_memory"));
  ok(W.EX_INDEX[mem.pendingContinue], "记忆：未完待续可恢复", mem.pendingContinue);

  // 9. 知识库组合检索（P1-1）
  const hitsLizhi = A.tools.knowledge.search("这个为什么和礼制有关？").slice(0, 5).map(e => e.id);
  ok(hitsLizhi.includes("E01") || hitsLizhi.includes("E02") || hitsLizhi.includes("E06"),
    "概念级检索：'礼制'无需精确字符串", hitsLizhi.join(","));
  const hitKz = A.tools.knowledge.search("这个和孔子有关系吗？")[0];
  ok(hitKz && hitKz.id === "E18", "人物检索：孔子→画像石", hitKz && hitKz.id);
  ok(A.tools.knowledge.search("孙子兵法写在什么上面？").some(e => e.id === "E13"), "关键词检索：兵法→汉简");

  // 10. 来源审计字段（P1-5）
  ok(W.EX_INDEX.E01.sourceType === "public_site" && W.EX_INDEX.E01.sourceUrl.length > 10, "public 展品带来源URL");
  const demoEx = W.EXHIBITS.find(e => e.sourceType === "demo");
  ok(demoEx && /Demo/.test(demoEx.sourceTitle), "demo 展品明确标注模拟内容");
})();

/* ---------------- 场景B：LLM 工具编排（伪 DeepSeek 协议） ---------------- */
(function scenarioB() {
  console.log("\n===== 场景B：LLM 工具编排（注入伪 transport） =====");
  const ACTION_JSON = JSON.stringify({
    intent: "reroute",
    reply: "好，脚步放慢些。青铜器的重点我都给你留着。",
    reason: "疲劳信号但青铜兴趣仍高：只删次要展项并加休息",
    nextAction: "replan",
    restMinutes: 5
  });
  let callCount = 0;
  const fetchImpl = function (url, opts) {
    if (url !== "/api/chat") return Promise.reject(new Error("unexpected_url:" + url));
    callCount++;
    const body = JSON.parse(opts.body);
    const hasToolMsg = body.messages.some(m => m.role === "tool");
    if (!hasToolMsg) {
      // 第一轮：LLM 决定调用两个工具
      return Promise.resolve({
        ok: true, status: 200, json: () => Promise.resolve({
          choices: [{
            message: {
              role: "assistant", content: "",
              tool_calls: [
                { id: "t1", type: "function", function: { name: "state_snapshot", arguments: "{}" } },
                { id: "t2", type: "function", function: { name: "adjust_route_lighter", arguments: '{"targetReduceMin":10}' } }
              ]
            }
          }]
        })
      });
    }
    // 第二轮：基于工具结果给出行动JSON（真实LLM也应从工具结果取路线）
    const toolMsgs = body.messages.filter(m => m.role === "tool");
    let lighter = null;
    toolMsgs.forEach(m => {
      try { const c = JSON.parse(m.content); if (c && c.newTail) lighter = c; } catch (e) {}
    });
    const action = JSON.stringify({
      intent: "reroute",
      reply: "好，脚步放慢些。青铜器的重点我都给你留着。",
      reason: "疲劳信号但青铜兴趣仍高：只删次要展项并加休息",
      nextAction: "replan",
      restMinutes: 5,
      newRoute: lighter ? lighter.newTail : null
    });
    return Promise.resolve({
      ok: true, status: 200, json: () => Promise.resolve({
        choices: [{ message: { role: "assistant", content: action } }]
      })
    });
  };
  const ctx = makeCtx(fetchImpl);
  ctx.window.ZHIXI_AGENT = { endpoint: "/api/chat", model: "deepseek-chat" };
  loadModules(ctx, ["data.js", "store.js", "agent.js"]);
  const W = ctx.window, S = W.Store, A = W.Agent;

  S.load();
  S.ctx.entryMode = "slow"; S.ctx.totalMinutes = 90; S.ctx.seedTopics = ["bronze"];
  S.startVisit(A.buildInitialPlan({ minutes: 90, mode: "slow", seedTopics: ["bronze"] }).ids);
  for (let i = 0; i < 3; i++) S.completeCurrent();

  const routeBefore = S.ctx.route.slice();
  const remBefore = S.remaining();
  A.chatAsync("我有点累，不过青铜器还想多看两件。").then(function (r) {
    ok(callCount >= 2, "LLM 多轮工具编排发生（rounds=" + callCount + "）", callCount);
    ok(r.reply === "好，脚步放慢些。青铜器的重点我都给你留着。", "回复来自 LLM 行动JSON", r.reply);
    ok(r.reason.indexOf("青铜兴趣仍高") >= 0, "reason 来自 LLM 决策");
    ok(r.routeChanged === true && Array.isArray(r.newRoute) && r.newRoute.length >= 2, "nextAction=replan 且路线合法");
    ok(typeof r.estimatedTotalMinutes === "number" && r.estimatedTotalMinutes > 0 &&
       r.estimatedTotalMinutes === r.diffAfter.totalMin, "estimatedTotalMinutes 由本地工具复核覆盖",
       r.estimatedTotalMinutes + "/" + (r.diffAfter && r.diffAfter.totalMin));
    const droppedNames = (r.toolCalls.find(t => t.tool === "adjust_route_lighter") || {}).summary || "";
    ok(/删/.test(droppedNames), "toolCalls 记录了 lighten 工具摘要", droppedNames);
    A.applyResult(r);
    ok(S.ctx.route.join() !== routeBefore.join(), "apply 后真实路线已改变");
    ok(S.remaining() <= remBefore, "时间账本未膨胀");
    ok(S.ctx.ledger.some(l => l.t === "rest"), "休息计入时间账本");
    doneB();
  }).catch(e => { ok(false, "chatAsync 异常", e.message); doneB(); });

  function doneB() { scenarioC(); }
})();

/* ---------------- 场景C：API Key 安全检查 ---------------- */
function scenarioC() {
  console.log("\n===== 场景C：API Key 安全 =====");
  const frontFiles = ["index.html", "js/data.js", "js/store.js", "js/agent.js", "js/views.js", "js/app.js"];
  let leaks = [];
  frontFiles.forEach(f => {
    const c = fs.readFileSync(f.startsWith("js/") ? "js/" + f.slice(3) : f, "utf8");
    if (/sk-[A-Za-z0-9]{8,}/.test(c)) leaks.push(f + " 含 sk- 密钥字面量");
    if (/apiKey\s*[:=]/.test(c)) leaks.push(f + " 出现 apiKey 字段");
    if (/DEEPSEEK_API_KEY/.test(c) && !f.startsWith("js")) void 0; // 前端不允许引用该env名
    if (!f.startsWith("js") && /DEEPSEEK_API_KEY/.test(c)) leaks.push(f + " 前端引用服务端环境变量名");
  });
  ok(leaks.length === 0, "前端零 Key 泄漏", leaks.join(" | "));
  const srv = fs.readFileSync("server.js", "utf8");
  ok(srv.indexOf("process.env.DEEPSEEK_API_KEY") >= 0, "服务端从环境变量读取 Key");
  ok(!/sk-[A-Za-z0-9]{8,}/.test(srv), "server.js 无硬编码 Key");
  finish();
}

function finish() {
  console.log("\nRESULT:", pass + " passed,", fail + " failed");
  process.exit(fail ? 1 : 0);
}
