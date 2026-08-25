// 黄金路径逻辑仿真：Store + Agent 无浏览器测试
const fs = require("fs");
const vm = require("vm");
const ctx = {
  window: {}, console,
  localStorage: { _s:{}, getItem(k){return this._s[k]||null;}, setItem(k,v){this._s[k]=String(v);}, removeItem(k){delete this._s[k];} },
  setTimeout, clearTimeout, fetch: undefined, AbortController: undefined, Math, Date, JSON, Object, Promise
};
ctx.window = ctx;
for (const f of ["data.js","store.js","agent.js"]) {
  vm.runInContext(fs.readFileSync("js/"+f,"utf8"), vm.createContext(ctx), {filename:f});
}
const W = ctx.window, S = W.Store, A = W.Agent;
let pass=0, fail=0;
function ok(cond, name, extra){ if(cond){pass++;console.log("PASS",name);} else {fail++;console.log("FAIL",name,extra??"");} }

// 1. 初始状态
S.load();
S.ctx.entryMode="slow"; S.ctx.totalMinutes=90; S.ctx.seedTopics=["bronze"];
S.startVisit(W.DEFAULT_ROUTE);
const cur = S.currentNext();
ok(cur && cur.ex.id==="E01","初始下一站=E01",cur&&cur.ex.id);
const st0 = S.routeStats(S.ctx.route,null);
ok(st0.count===8,"初始8件",st0.count);
ok(st0.km>=1.5 && st0.km<=1.9,"初始里程约1.7km 实际="+st0.km);
ok(st0.stayMin===35,"初始讲解35分钟 实际="+st0.stayMin);

// 模拟看完3件
for(let i=0;i<3;i++){ S.completeCurrent(); }
ok(S.ctx.visitedIds.length===3,"看完3件");

// 2. 疲劳 → 重规划
let r = A.think("我有点累，慢一点");
ok(r.intent==="reroute" && r.routeChanged,"疲劳意图触发重规划",r.intent);
ok(r.newRoute && r.newRoute.length < S.ctx.route.length,"路线变短 "+(r.newRoute&&r.newRoute.length)+" vs "+S.ctx.route.length);
ok(r.diffAfter.totalMin < r.diffBefore.totalMin,"后半程用时变短 "+r.diffBefore.totalMin+"→"+r.diffAfter.totalMin);
ok(r.reasons && r.reasons.length>=3,"调整理由>=3条");
const before=S.ctx.route.slice();
A.applyResult(Object.assign({},r));
ok(S.ctx.route.length<before.length,"apply后真实生效 "+before.length+"→"+S.ctx.route.length);
ok(S.ctx.replanCount===1,"replanCount=1");

// 3. 少讲一点 → 轻量模式
r = A.think("信息有点多，少讲一点");
ok(r.contentMode==="light","轻量模式意图");
A.applyResult(r);
ok(S.ctx.contentMode==="light","contentMode已切换");

// 4. 孔子对话
r = A.think("这个和孔子有关系吗？");
ok(r.intent==="propose_add","孔子→propose_add",r.intent);
ok(r.proposedIds && r.proposedIds.includes("E18"),"推荐含孔子见老子画像石",JSON.stringify(r.proposedIds));
ok(/还剩|分钟/.test(r.reply),"回复包含剩余时间语境:",r.reply);

// 5. 带我去看看 → 路线真变
const rBefore=S.ctx.route.slice();
r = A.applyResult(Object.assign({},A.lastOut||r,{intent:"propose_add"}),{accept:true});
ok(r.routeChanged===true,"accept后routeChanged");
ok(S.ctx.route.includes("E18"),"E18已入路线");
ok(S.ctx.replanCount===2,"replanCount=2");
ok(!S.ctx.route.every((v,i)=>v===rBefore[i]),"路线顺序发生变化");

// 6. 只剩20分钟 → 收尾
S.refreshStates();
r = A.think("我只剩20分钟了");
ok(r.intent==="wrap_up","收尾模式意图",r.intent);
ok(r.diffAfter.count<=4,"收尾后半程<=4件",r.diffAfter.count);
ok(r.diffAfter.totalMin<=28,"收尾用时可控="+r.diffAfter.totalMin);
A.applyResult(Object.assign({},r));
ok(S.remaining()<=20,"剩余时间被压缩至声明值 rem="+S.remaining());

// 7. fallback 稳定性
for(const t of ["随便说点什么xyz","这个和孔子有关系吗","我有点累","只剩10分钟了","少讲一点"]){
  const rr = A.think(t);
  ok(rr && typeof rr.reply==="string" && rr.reply.length>0,"fallback回复:"+t);
}

// 8. 兴趣演化
S.addInterest("bronze",1); S.addInterest("life",1);
ok(S.topInterests(1)[0].id==="bronze","兴趣排序正确");

// 9. leftover
ok(S.leftoverPick(),"能选出未完待续展品:"+ (S.leftoverPick()||{}).id);

// 10. 时间账本守恒
const consumed = S.consumed();
ok(consumed>0 && consumed < 90,"时间账本合理 consumed="+consumed);

console.log("\\nRESULT:", pass+" passed,", fail+" failed");
process.exit(fail?1:0);

