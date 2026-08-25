const fs=require("fs"),vm=require("vm");
const ctx={window:{},console,localStorage:{_s:{},getItem(k){return this._s[k]||null},setItem(k,v){this._s[k]=String(v)},removeItem(k){delete this._s[k]}},setTimeout,clearTimeout,requestAnimationFrame(f){f&&f()},Math,Date,JSON,Object,Array,String,Number};
ctx.window=ctx; ctx.requestAnimationFrame=f=>f&&f();
for(const f of ["data.js","store.js","agent.js","views.js"]) vm.runInContext(fs.readFileSync("js/"+f,"utf8"),vm.createContext(ctx),{filename:f});
const W=ctx.window,S=W.Store,V=W.Views;
let pass=0,fail=0;
function t(name,fn){try{const r=fn();if(typeof r==="string"&&r.length>50){pass++;console.log("PASS",name,"("+r.length+" chars)")}else{fail++;console.log("FAIL",name,"bad output")}}catch(e){fail++;console.log("FAIL",name,e.message)}}

S.load();
// welcome(含未完待续卡)
W.ZX_MEMORY={pendingContinue:"E07"};
t("welcome+resume",()=>V.welcome());
// planning
S.ctx.entryMode="slow";S.ctx.totalMinutes=90;S.ctx.seedTopics=["bronze"];
S.startVisit(W.DEFAULT_ROUTE);S.ctx.view="planning";
t("planning",()=>V.planning());
// visit
t("visit-initial",()=>V.visit());
// map svg
t("mapSvg",()=>V.mapSvg());
// exhibit 当前站
t("exhibit-E01",()=>V.exhibit("E01"));
// 展品不在路线(发现页预览)
t("exhibit-outsider",()=>V.exhibit("E21"));
// 轻量模式展品页
S.ctx.contentMode="light";
t("exhibit-light",()=>V.exhibit("E02"));
S.ctx.contentMode="normal";
// sheets
t("chatSheet",()=>V.chatSheet());
t("adjustSheet",()=>V.adjustSheet());
t("checkinSheet",()=>V.checkinSheet());
// replan overlay 样本
t("replanOverlay",()=>V.replanOverlay({reason:"测试",reply:"测试回复",diffBefore:{count:4,totalMin:50},diffAfter:{count:3,totalMin:41},reasons:["a","b"]}));
// 看完3件后的visit + tight banner
for(let i=0;i<3;i++)S.completeCurrent();
S.ctx.pace="tight";
t("visit-tight-3done",()=>V.visit());
// 兴趣whisper
S.addInterest("bronze",3);S.ctx.whisperShown=false;
t("visit-whisper",()=>V.visit());
S.ctx.whisperShown=true;
// 展开过讲解的展品页
S.markExpanded(S.currentNext().ex.id);
t("exhibit-expanded",()=>V.exhibit(S.currentNext().ex.id));
// 完成全部 → visit完成卡
while(S.currentNext()){S.completeCurrent();}
t("visit-done",()=>V.visit());
// summary / culture / discover / mine
t("summary",()=>V.summary());
t("culture",()=>V.culture());
t("discover",()=>V.discover());
t("mine",()=>V.mine());
// artSvg 全kind覆盖
let arts=[];W.EXHIBITS.forEach(e=>arts.push(V.artSvg(e,{h:120})));
ok2 = arts.every(a=>a.length>200&&!a.includes("undefined"));
if(ok2){pass++;console.log("PASS artSvg-all-kinds ("+arts.length+"件)")}else{fail++;console.log("FAIL artSvg-all-kinds")}
function ok2(){}
console.log("\\nRESULT:",pass+" passed,",fail+" failed");
process.exit(fail?1:0);
