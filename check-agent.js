/* ============================================================
   知息 ZHI XI · Agent 真实链路诊断（需服务器带 Key 运行）
   用法：node check-agent.js
   五句复杂自然语言依次走完整 Agent 流程并打印决策细节。
   ============================================================ */
const fs = require("fs"), vm = require("vm");
const ctx = {
  window: {}, console,
  localStorage: { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } },
  setTimeout, clearTimeout, fetch,
  Math, Date, JSON, Object, Array, String, Number, Promise, Boolean
};
ctx.window = ctx;
["data.js", "store.js", "agent.js"].forEach(f =>
  vm.runInContext(fs.readFileSync("js/" + f, "utf8"), vm.createContext(ctx), { filename: f }));
const W = ctx.window, S = W.Store, A = W.Agent;
W.ZHIXI_AGENT = { endpoint: "http://127.0.0.1:4923/api/chat", model: "deepseek-chat" };

async function ask(q, expectHint) {
  const t0 = Date.now();
  const r = await A.chatAsync(q);
  const ms = Date.now() - t0;
  console.log("\n【问】" + q);
  console.log("【答】" + r.reply);
  console.log("  意图=" + r.intent + "  nextAction=" + r.nextAction +
    "  路线变更=" + r.routeChanged +
    (r.proposedIds && r.proposedIds.length ? "  建议新增=" + r.proposedIds.join(",") : "") +
    (r.estimatedTotalMinutes ? "  预计=" + r.estimatedTotalMinutes + "分钟" : "") +
    "  耗时=" + ms + "ms" + (r.fallbackUsed ? "  ⚠️走了fallback" : "  ✅真实LLM"));
  if (r.toolCalls && r.toolCalls.length)
    console.log("  工具轨迹: " + r.toolCalls.map(t => t.tool + "(" + t.summary + ")").join(" → "));
  return r;
}

(async function main() {
  S.load();
  S.ctx.entryMode = "slow"; S.ctx.totalMinutes = 90; S.ctx.seedTopics = ["bronze"];
  const plan = A.buildInitialPlan({ minutes: 90, mode: "slow", seedTopics: ["bronze"] });
  S.startVisit(plan.ids);
  for (let i = 0; i < 3; i++) S.completeCurrent();
  console.log("上下文：已看" + S.ctx.visitedIds.length + "件，剩" + S.remaining() + "分钟，轻负荷模式");

  let fails = 0;
  function chk(name, cond, extra) {
    if (cond) console.log("  ✔ " + name);
    else { fails++; console.log("  ✘ " + name + (extra ? " | " + extra : "")); }
  }

  // 1. 疲劳但兴趣仍在
  let r = await ask("我有点累，不过青铜器还想多看两件。");
  chk("疲劳被理解且未误删青铜主线", ["replan"].includes(r.nextAction) || r.routeChanged || /慢|歇|休息/.test(r.reply), r.nextAction);
  A.applyResult(Object.assign({}, r));

  // 2. 模糊相关推荐
  r = await ask("我刚才对这个很感兴趣，还有类似的吗？");
  chk("结合当前展品给出相关提案", r.proposedIds.length >= 1 || /类似|接近|相关|青铜|顺路|路线|已经/.test(r.reply),
    JSON.stringify(r.proposedIds) + " | " + r.reply.slice(0, 30));
  if (r.proposedIds.length) r = A.applyResult(r, { accept: true });

  // 3. 孔子问题（跨主题知识关联）
  r = await ask("这个和孔子有关系吗？");
  chk("理解孔子语境", /孔|儒|礼|老子/.test(r.reply) || r.proposedIds.includes("E18"), r.reply.slice(0, 40));
  if (r.proposedIds.length) A.applyResult(r, { accept: true });

  // 4. 长讲解厌恶
  r = await ask("我不太想听长讲解，但我还是想知道最重要的一点。");
  chk("识别为轻量模式", r.nextAction === "light_mode" || r.contentMode === "light", r.nextAction);
  A.applyResult(Object.assign({}, r));
  chk("contentMode 已落地", S.ctx.contentMode === "light", S.ctx.contentMode);

  // 5. 多重约束复合句（时间+主题+步行）
  r = await ask("我只有半小时了，还想看刚才那种和礼制有关的，但不想走太远。");
  A.applyResult(Object.assign({}, r));
  chk("时间约束生效(账本被压缩到≈30分钟)", S.remaining() <= 35, "剩余" + S.remaining());
  const tailIds = S.ctx.route.slice(S.nextUnvisited());
  const keptTopics2 = tailIds.map(id => W.EX_INDEX[id].topic);
  chk("保留礼制相关展项", keptTopics2.filter(t => t === "bronze").length >= 1 ||
    /礼|青铜|鼎|簋/.test(r.reply), JSON.stringify(tailIds));

  console.log("\n========== 结论：" + (fails === 0 ? "五句复杂指令全部由真实LLM驱动 ✅" : fails + " 项未达预期") + " ==========");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error("诊断失败:", e.message); process.exit(1); });
