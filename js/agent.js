/* ============================================================
   知息 ZHI XI · VisitPlannerAgent v2（真·工具调用型 Agent）
   ------------------------------------------------------------
   架构：
     用户自然语言
       → LLM（经服务端 /api/chat 代理，Key 永不进浏览器）
           理解目标与约束 → 选择并调用工具 → 组合结果 → 行动决策
       → 本地确定性工具：KnowledgeTool / RouteTool / StateTool /
                          PlanningTool / CultureExtensionTool
       → 结构化 AgentAction JSON
       → 前端真实执行 Action

   分工边界（硬性）：
     - LLM 只负责：复杂语言理解、约束提取、工具选择、行动决策、措辞
     - LLM 禁止：编造展品ID、计算距离/时间、虚构事实
       （所有数字由本地工具计算，normalize 阶段强制复核覆盖）
     - LLM 失败/未配置 → 完整回落本地规则引擎（黄金路径永不中断）

   安全（P0-2）：
     - 浏览器只请求同源 /api/chat；API Key 仅存在于服务端环境变量
       DEEPSEEK_API_KEY。前端代码中不存在任何 Key。
   ============================================================ */
(function () {

  /* ================= 常量 ================= */
  var NEXT_ACTIONS = ['continue', 'replan', 'show_exhibits', 'light_mode', 'wrap_up', 'rest'];
  var STOP_BIGRAMS = ['这个','那个','什么','怎么','还有','想看','看看','有关','关系','类似','一个','一下','可以','就是','为什么','怎么'];
  var CONCEPT_ALIASES = {
    '礼制': ['礼', '礼器', '礼乐', '册命', '鼎簋', '等级', '身份'],
    '礼': ['礼制', '礼器', '礼乐'],
    '儒家': ['孔子', '老子', '问礼', '论语'],
    '权力': ['王权', '军权', '钺', '鼎', '等级'],
    '生活': ['宴饮', '庖厨', '车马', '出行', '日常'],
    '战争': ['兵器', '兵法', '戈', '剑', '兵书'],
    '文字': ['甲骨', '简牍', '金文', '隶书', '书写'],
    '工艺': ['错金银', '戗金', '织金', '快轮', '渗碳']
  };

  /* ================= StateTool ================= */
  var StateTool = {
    snapshot: function () {
      var c = Store.ctx;
      return {
        museum: c.museumId,
        timeRemaining: Store.remaining(),
        currentLocation: c.locationExhibitId,
        currentExhibit: c.locationExhibitId ? Store.ex(c.locationExhibitId).title : null,
        visitedExhibits: c.visitedIds.slice(),
        currentRoute: c.route.slice(),
        userPreference: c.entryMode,
        currentInterest: Store.topInterests(1)[0] || null,
        interests: Store.topInterests(3),
        state: { pace: c.pace, informationLoad: c.infoLoad, timePressure: c.timePressure },
        contentMode: c.contentMode,
        chatTopics: (c.chatTopics || []).slice(),
        behaviorSignals: Store.behaviorSignals()
      };
    }
  };

  /* ================= RouteTool ================= */
  var RouteTool = {
    walkBetween: function (fromId, toId) { return Store.legWalk(fromId, toId); },
    stats: function (ids) { return Store.routeStats(ids, Store.ctx.locationExhibitId); },
    reorderNearest: function (ids, fromId) {
      var S = Store, pool = ids.slice(), out = [], cur = fromId || null;
      while (pool.length) {
        var bi = 0, bd = Infinity;
        pool.forEach(function (id, i) {
          var d = S.distUnits(S.posOf(cur ? S.ex(cur) : { lobby: true }), S.ex(id));
          if (d < bd) { bd = d; bi = i; }
        });
        cur = pool.splice(bi, 1)[0]; out.push(cur);
      }
      return out;
    }
  };

  /* ================= KnowledgeTool（P1-1 组合检索） ================= */
  var TITLE_BIGRAMS = (function () {
    var m = {};
    EXHIBITS.forEach(function (e) {
      var t = e.title.replace(/[《》（）\s]/g, '');
      for (var i = 0; i < t.length - 1; i++) {
        var g = t.substr(i, 2);
        if (STOP_BIGRAMS.indexOf(g) >= 0) continue;
        (m[g] = m[g] || []).push(e.id);
      }
    });
    return m;
  })();
  function expandQuery(t) {
    var terms = [t];
    Object.keys(CONCEPT_ALIASES).forEach(function (k) {
      if (t.indexOf(k) >= 0) terms = terms.concat(CONCEPT_ALIASES[k]);
    });
    // 关键词级别的反向扩展：查询包含某展品关键词
    EXHIBITS.forEach(function (e) {
      (e.keywords || []).forEach(function (kw) {
        if (kw.length >= 2 && t.indexOf(kw) >= 0 && terms.indexOf(kw) < 0) terms.push(kw);
      });
    });
    return terms;
  }
  var KnowledgeTool = {
    search: function (text) {
      var t = (text || '').trim();
      if (!t) return [];
      var scores = {};
      function add(id, s) { scores[id] = (scores[id] || 0) + s; }
      var terms = expandQuery(t);
      EXHIBITS.forEach(function (e) {
        var hay = e.title + e.short + (e.detail || '');
        var kb = (e.keywords || []).join('|') + '|' + (e.themes || []).join('|') + '|' +
                 (e.people || []).join('|') + '|' + (e.concepts || []).join('|');
        terms.forEach(function (term) {
          if (!term || term.length < 1) return;
          if (e.title.indexOf(term) >= 0) add(e.id, 6);
          else if ((e.keywords || []).some(function (k) { return k.indexOf(term) >= 0 || term.indexOf(k) >= 0 && k.length >= 2; })) add(e.id, 5);
          else if ((e.people || []).some(function (p) { return p.indexOf(term) >= 0 || term.indexOf(p.split('（')[0]) >= 0 && p.length >= 2; })) add(e.id, 5);
          else if ((e.concepts || []).concat(e.themes || []).some(function (f) { return f.indexOf(term) >= 0 || term.indexOf(f) >= 0 && f.length >= 2; })) add(e.id, 4);
          else if (hay.indexOf(term) >= 0 && term.length >= 2) add(e.id, 2);
          void kb;
        });
        // 标题双字实体强命中
        for (var i = 0; i < t.length - 1; i++) {
          var g = t.substr(i, 2);
          if (TITLE_BIGRAMS[g] && TITLE_BIGRAMS[g].indexOf(e.id) >= 0) add(e.id, 6);
        }
        // 用户上下文加成：当前展品的关联清单
        var cur = Store.ctx.locationExhibitId;
        if (cur && (EX_INDEX[cur].related || []).indexOf(e.id) >= 0) add(e.id, 2);
      });
      return Object.keys(scores)
        .filter(function (id) { return scores[id] >= 3; })
        .sort(function (a, b) { return scores[b] - scores[a]; })
        .map(function (id) { return EX_INDEX[id]; });
    },
    relatedOf: function (ex, extraText) {
      var seen = {}, out = [];
      function push(e, s) {
        if (!e || seen[e.id]) return;
        seen[e.id] = 1; out.push({ ex: e, score: s });
      }
      (ex.related || []).forEach(function (id) { push(EX_INDEX[id], 5); });
      this.search((extraText || '') + ' ' + MUSEUMS[Store.ctx.museumId].topics[ex.topic].name)
        .forEach(function (e) { push(e, 3); });
      EXHIBITS.forEach(function (e) { if (e.topic === ex.topic && e.id !== ex.id) push(e, 2); });
      out.sort(function (a, b) { return b.score - a.score; });
      return out.map(function (o) { return o.ex; }).filter(function (e) { return e.id !== ex.id; });
    },
    explainLink: function (fromEx, toEx) {
      if ((fromEx.related || []).indexOf(toEx.id) >= 0)
        return '它和你刚看的《' + fromEx.title + '》在展线上是直接相关的。';
      if (fromEx.topic === toEx.topic)
        return '它和《' + fromEx.title + '》同属「' + MUSEUMS[Store.ctx.museumId].topics[toEx.topic].name + '」这条线索。';
      return '它从另一个侧面呼应你刚才的兴趣。';
    },
    /* 供 LLM 工具调用的紧凑结果 */
    compact: function (list, n) {
      return (list || []).slice(0, n || 5).map(function (e) {
        return { id: e.id, title: e.title, period: e.period, gallery: e.gallery, topic: e.topic,
                 stay: e.stay, priority: e.priority, why: e.short };
      });
    }
  };

  /* ================= PlanningTool（确定性算法） ================= */
  var PlanningTool = {
    /* 权重随入口模式变化 */
    _weights: function (mode) {
      return {
        slow:      { interest: 2.2, priority: 1.7, walk: 0.10, maxDiff: 9, maxStay: 9 },
        efficient: { interest: 1.5, priority: 3.0, walk: 0.18, maxDiff: 9, maxStay: 9 },
        theme:     { interest: 4.0, priority: 1.2, walk: 0.12, maxDiff: 9, maxStay: 9 },
        family:    { interest: 1.8, priority: 1.8, walk: 0.14, maxDiff: 3, maxStay: 4 }
      }[mode || 'slow'] || { interest: 2.2, priority: 1.7, walk: 0.10, maxDiff: 9, maxStay: 9 };
    },
    /* P1-3 初始规划：知识检索候选池 → 加权贪心构建 */
    initialPlan: function (opts) {
      opts = opts || {};
      var minutes = Math.max(20, opts.minutes || 90);
      var mode = opts.mode || 'slow';
      var W = this._weights(mode);
      var budget = minutes * 0.62;
      var seeds = opts.seedTopics || [];
      var S = Store;

      // 候选池：种子主题优先，不足则以高优先级补齐
      var pool = [];
      if (seeds.length) {
        EXHIBITS.forEach(function (e) { if (seeds.indexOf(e.topic) >= 0) pool.push(e.id); });
      }
      if (pool.length < 6) {
        EXHIBITS.slice().sort(function (a, b) { return b.priority - a.priority; }).forEach(function (e) {
          if (pool.indexOf(e.id) < 0 && pool.length < 10) pool.push(e.id);
        });
      }

      var out = [], remainBudget = budget, prev = null, guard = 0;
      while (pool.length && guard++ < 30) {
        var bestId = null, bestSc = -Infinity, bestCost = 0;
        pool.forEach(function (id) {
          var e = S.ex(id);
          if (e.stay > W.maxStay || e.difficulty > W.maxDiff) {
            if (!(W.maxDiff >= 9)) return; // 家庭模式过滤高难度
            if (e.stay > W.maxStay) return;
          }
          var cst = e.stay + S.legWalk(prev, id);
          var sc = (S.ctx.interests[e.topic] || 0) * W.interest + (e.priority || 1) * W.priority
                 + (seeds.indexOf(e.topic) >= 0 ? 3 : 0) - cst * W.walk;
          if (cst <= remainBudget && sc > bestSc) { bestSc = sc; bestId = id; bestCost = cst; }
        });
        if (!bestId) break;
        out.push(bestId); pool.splice(pool.indexOf(bestId), 1);
        remainBudget -= bestCost; prev = bestId;
      }
      // 兜底：规划结果太少时退回默认主题线裁剪
      if (out.length < 4) {
        out = DEFAULT_ROUTE.slice();
        var st = S.routeStats(out, null), g2 = 0;
        while (st.totalMin > budget && out.length > 3 && g2++ < 12) {
          var wi = -1, ws = Infinity;
          out.forEach(function (id, i) {
            var e = S.ex(id);
            var sc = (e.priority || 1) * 2 - i * 0.01;
            if (sc < ws) { ws = sc; wi = i; }
          });
          out.splice(wi, 1);
          st = S.routeStats(out, null);
        }
        return { ids: out, source: 'default_fallback', stats: st };
      }
      // 慢逛/家庭模式：主题为主之外，补 1-2 件跨主题代表作，让参观更有层次
      if (seeds.length) {
        var fillers = EXHIBITS.filter(function (e) {
          return seeds.indexOf(e.topic) < 0 && out.indexOf(e.id) < 0;
        }).sort(function (a, b) { return b.priority - a.priority; });
        var addedF = 0, prevId = out[out.length - 1];
        for (var fi = 0; fi < fillers.length && addedF < 2; fi++) {
          var fe = fillers[fi];
          var fc = fe.stay + S.legWalk(prevId, fe.id);
          if (fc <= Math.max(8, budget - S.routeStats(out, null).totalMin)) {
            out.push(fe.id); remainBudget -= fc; prevId = fe.id; addedF++;
          }
        }
      }
      out = RouteTool.reorderNearest(out, null);
      return { ids: out, source: 'planner', stats: S.routeStats(out, null) };
    },

    build: function (opts) {
      opts = opts || {};
      var c = Store.ctx;
      var fromId = opts.fromId !== undefined ? opts.fromId : c.locationExhibitId;
      var budget = opts.budgetMin != null ? opts.budgetMin : Math.max(10, Store.remaining() - 8);
      var mustInclude = (opts.includeIds || []).filter(function (id) { return !!EX_INDEX[id]; });
      var exclude = opts.excludeIds || [];
      var visited = c.visitedIds.concat(c.skippedIds);
      var pool = (opts.pool || EXHIBITS.map(function (e) { return e.id; })).filter(function (id) {
        return visited.indexOf(id) < 0 && exclude.indexOf(id) < 0;
      });
      function cost(id) {
        var prev = out.length ? out[out.length - 1] : fromId;
        return Store.ex(id).stay + Store.legWalk(prev, id);
      }
      var out = [];
      mustInclude.forEach(function (id) {
        if (out.indexOf(id) < 0 && pool.indexOf(id) >= 0) { out.push(id); pool.splice(pool.indexOf(id), 1); }
      });
      var remainBudget = budget - mustInclude.reduce(function (s, id) {
        var prev = out.length > 1 ? out[out.indexOf(id) - 1] : fromId;
        return s + Store.ex(id).stay + Store.legWalk(prev, id);
      }, 0);
      while (pool.length) {
        var bestId = null, bestSc = -Infinity, bestCost = 0;
        pool.forEach(function (id) {
          var e = Store.ex(id);
          var cst = cost(id);
          var sc = (Store.ctx.interests[e.topic] || 0) * 2.2 + (e.priority || 1) * 1.7 - cst * 0.10 - cst * 0.05 * 2;
          if (cst <= remainBudget && sc > bestSc) { bestSc = sc; bestId = id; bestCost = cst; }
        });
        if (!bestId) break;
        out.push(bestId); pool.splice(pool.indexOf(bestId), 1);
        remainBudget -= bestCost;
      }
      return out;
    },

    lighter: function (targetReduceMin) {
      var c = Store.ctx, S = Store;
      var idx = Store.nextUnvisited();
      var tail = c.route.slice(idx);
      var need = Math.min(targetReduceMin || 14, Math.max(8, RouteTool.stats(tail).totalMin - 18));
      var cand = tail.filter(function (id) {
        var ee = S.ex(id);
        return !(ee.priority >= 3 || (Store.ctx.interests[ee.topic] || 0) >= 2.5);
      });
      cand.sort(function (a, b) {
        var ea = S.ex(a), eb = S.ex(b);
        return (ea.priority * 2 + (c.interests[ea.topic] || 0)) - (eb.priority * 2 + (c.interests[eb.topic] || 0));
      });
      var keep = tail.slice(), dropped = [], saved = 0;
      while (saved < need && cand.length && keep.length > 2) {
        var id = cand.shift();
        if (keep.indexOf(id) < 0) continue;
        keep.splice(keep.indexOf(id), 1);
        saved += S.ex(id).stay + 3;
        dropped.push(id);
      }
      var rest = saved < need ? 5 : 0;
      return { newTail: RouteTool.reorderNearest(keep, c.locationExhibitId), dropped: dropped, rest: rest };
    },

    wrapUp: function () {
      var c = Store.ctx, S = Store;
      var idx = Store.nextUnvisited();
      var tail = c.route.slice(idx);
      var budget = Math.max(8, Store.remaining() - 5);
      var scored = tail.map(function (id) {
        var e = S.ex(id);
        return { id: id, sc: (e.priority || 1) * 2 + (c.interests[e.topic] || 0) * 2 };
      }).sort(function (a, b) { return b.sc - a.sc; });
      var keep = [], used = 0, prev = c.locationExhibitId;
      scored.forEach(function (o) {
        var cst = S.ex(o.id).stay + S.legWalk(prev, o.id);
        if (used + cst <= budget && keep.length < 4) { keep.push(o.id); used += cst; prev = o.id; }
      });
      if (!keep.length && tail.length) keep = [scored[0].id];
      while (keep.length > 1 && RouteTool.stats(keep, c.locationExhibitId).totalMin > budget + 3) keep.pop();
      keep = RouteTool.reorderNearest(keep, c.locationExhibitId);
      return { keep: keep, dropped: tail.filter(function (id) { return keep.indexOf(id) < 0; }) };
    },

    insertAhead: function (ids) {
      var c = Store.ctx, S = Store;
      var idx = Store.nextUnvisited();
      var tail = c.route.slice(idx);
      var added = ids.filter(function (id) { return EX_INDEX[id] && c.visitedIds.indexOf(id) < 0 && tail.indexOf(id) < 0; });
      if (!added.length) return { tail: tail, added: [], removed: [] };
      var merged = added.concat(tail);
      var budget = Math.max(10, Store.remaining() - 6);
      var stats = RouteTool.stats(merged);
      var removed = [];
      while (stats.totalMin > budget && merged.length > 2) {
        var worst = -1, ws = Infinity;
        merged.forEach(function (id, i) {
          if (added.indexOf(id) >= 0) return;
          var e = S.ex(id);
          var s = (e.priority || 1) * 2 + (c.interests[e.topic] || 0);
          if (s < ws) { ws = s; worst = i; }
        });
        if (worst < 0) break;
        removed.push(merged.splice(worst, 1)[0]);
        stats = RouteTool.stats(merged);
      }
      return { tail: RouteTool.reorderNearest(merged, c.locationExhibitId), added: added, removed: removed };
    }
  };

  /* ================= CultureExtensionTool（P1-4） ================= */
  var CultureExtensionTool = {
    recommend: function () {
      var c = Store.ctx, M = MUSEUMS[c.museumId];
      var visitedTitles = c.visitedIds.map(function (id) { return Store.ex(id).title; });
      var out = M.products.map(function (p) {
        var sc = 0, relEx = [], reasons = [];
        p.topics.forEach(function (t) {
          var iv = c.interests[t] || 0;
          if (iv > 0) { sc += iv * 2; reasons.push('你对「' + M.topics[t].name + '」的兴趣已达 ' + Math.min(5, Math.round(iv * 10) / 10) + ' 星'); }
          if ((c.chatTopics || []).indexOf(t) >= 0) { sc += 1.8; reasons.push('你主动聊到过「' + M.topics[t].name + '」'); }
          c.visitedIds.forEach(function (id) {
            if (Store.ex(id).topic === t && relEx.length < 2) { relEx.push(Store.ex(id).title); }
          });
        });
        if (c.pendingContinue) {
          var pe = Store.ex(c.pendingContinue);
          if (p.topics.indexOf(pe.topic) >= 0) { sc += 2; reasons.push('你还留着没看完的《' + pe.title + '》'); }
        }
        if (!relEx.length && visitedTitles.length) relEx = visitedTitles.slice(-1);
        var reason;
        if (reasons.length) reason = reasons[0] + (relEx.length ? '，比如刚看过的《' + relEx[0] + '》。' : '。');
        else if (relEx.length) reason = '与你今天看过的《' + relEx[0] + '》同一脉络。';
        else reason = '与本馆青铜主线相关，适合作为第一次参观的纪念。';
        return {
          productId: p.id, name: p.name, price: p.price, score: Math.round(sc * 10) / 10,
          reason: reason, relatedExhibits: relEx, relatedTopics: (p.relatedTopicNames || []).slice()
        };
      }).sort(function (a, b) { return b.score - a.score; });
      return out;
    }
  };

  /* ================= 语言生成辅助 ================= */
  function names(ids) { return ids.map(function (id) { return Store.ex(id).title; }); }
  function joinNames(arr) {
    if (!arr.length) return '';
    if (arr.length === 1) return '《' + arr[0] + '》';
    return arr.map(function (n) { return '《' + n + '》'; }).join('和');
  }

  /* ================= 意图识别（fallback 规则引擎） ================= */
  var RULES = [
    { k: ['少讲', '信息有点多', '信息多', '简单点', '太长', '别讲这么', '不想听', '长讲解'], intent: 'less_info' },
    { k: ['累', '慢一点', '轻松一点', '歇', '休息', '走不动', '有点赶'], intent: 'fatigue' },
    { k: ['重点', '精华', '最值得', '挑最好', '只看最好'], intent: 'highlights' },
    { k: ['继续', '还可以', '没问题', '保持', '状态不错', '不用调'], intent: 'keep' },
    { k: ['只剩', '只有', '没多少时间', '来不及', '快闭馆', '得走了', '半小时'], intent: 'time_change' },
    { k: ['类似', '相近', '差不多', '还想看', '再看看', '相关', '有关系', '有关吗', '关联', '刚才那种'], intent: 'explore_related' },
    { k: ['孔子', '老子', '儒家', '论语', '礼乐', '礼制'], intent: 'explore_topic' },
    { k: ['谢谢', '好的', '嗯'], intent: 'ack' }
  ];
  var TOPIC_HINTS = {
    '孔子': ['E18', 'E13', 'E02'], '老子': ['E18', 'E13'],
    '儒家': ['E18', 'E02', 'E06'], '论语': ['E18', 'E13'],
    '礼乐': ['E06', 'E02', 'E01'], '礼制': ['E01', 'E02', 'E04']
  };
  var INTENT_ACTION = {
    reroute: 'replan', content_mode: 'light_mode', wrap_up: 'wrap_up',
    propose_add: 'show_exhibits', rest: 'rest'
  };
  function detectIntent(text) {
    var t = (text || '').toLowerCase();
    var m = t.match(/(\d+(?:\.5|个半)?)\s*分钟/) || t.match(/(\d+)\s*min/);
    var halfHour = /半小时|半个钟/.test(t);
    var hasTimeWord = /剩|只有|还有不到|来得及/.test(t);
    if ((m && hasTimeWord) || halfHour) {
      var mins = halfHour && !m ? 30 : parseInt(m[1].replace('个半', '.5'), 10);
      return { intent: 'time_change', minutes: mins };
    }
    if (/没时间|来不及|要走了|快闭馆/.test(t)) return { intent: 'time_change', minutes: 15 };
    for (var i = 0; i < RULES.length; i++) {
      var r = RULES[i];
      for (var j = 0; j < r.k.length; j++) {
        if (t.indexOf(r.k[j]) >= 0) return { intent: r.intent };
      }
    }
    return { intent: 'unknown' };
  }

  /* ================= VisitPlannerAgent ================= */
  var Agent = {
    tools: {
      knowledge: KnowledgeTool, route: RouteTool, state: StateTool,
      planning: PlanningTool, culture: CultureExtensionTool
    },

    /* ---------- 统一输出骨架（P0-3） ---------- */
    _out: function (o) {
      var base = {
        intent: 'chat',
        action: o.intent || 'chat',
        reply: '',
        reason: '',
        toolCalls: [],
        routeChanged: false,
        newRoute: null,
        addedExhibits: [],
        removedExhibits: [],
        proposedIds: [],
        contentMode: Store.ctx.contentMode,
        estimatedTotalMinutes: null,
        nextAction: 'continue',
        diffBefore: null, diffAfter: null, reasons: null, restMinutes: 0
      };
      var outp = Object.assign(base, o);
      if (o.intent && !o.nextAction) outp.nextAction = INTENT_ACTION[o.intent] || 'continue';
      return outp;
    },

    /* ========== LLM 编排层（真·工具调用） ========== */
    _toolDefs: [
      { name: 'state_snapshot', desc: '读取游客当前上下文：剩余时间/位置/已看/兴趣/行为信号', params: { type: 'object', properties: {} } },
      { name: 'knowledge_search', desc: '按关键词/主题/人物/概念检索展品，返回候选列表', params: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
      { name: 'route_stats', desc: '给定展品id列表，返回件数/步行公里/预计总分钟等真实数字', params: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } } } },
      { name: 'plan_route', desc: '在时间预算内重新组合路线。参数：budgetMin(分钟)、preferTopics(主题数组)、includeIds(必含)、excludeIds(排除)', params: { type: 'object', properties: { budgetMin: { type: 'number' }, preferTopics: { type: 'array', items: { type: 'string' } }, includeIds: { type: 'array', items: { type: 'string' } }, excludeIds: { type: 'array', items: { type: 'string' } } } } },
      { name: 'adjust_route_lighter', desc: '把后半程收窄：删次级展项、可加休息。参数 targetReduceMin', params: { type: 'object', properties: { targetReduceMin: { type: 'number' } } } },
      { name: 'wrap_up_route', desc: '收尾模式：只留最值得看的塞进剩余时间', params: { type: 'object', properties: {} } },
      { name: 'insert_exhibits_preview', desc: '试算把若干展品插入后半程后的路线与代价', params: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'] } },
      { name: 'recommend_products', desc: '基于今日兴趣/已看/提问记录推荐文创并给出理由', params: { type: 'object', properties: {} } }
    ],
    _execTool: function (name, args, toolLog) {
      var res = null;
      try {
        args = args || {};
        switch (name) {
          case 'state_snapshot': res = StateTool.snapshot(); break;
          case 'knowledge_search':
            res = { query: String(args.query || ''), results: KnowledgeTool.compact(KnowledgeTool.search(args.query), 5) };
            break;
          case 'route_stats': {
            var ids = (args.ids || Store.ctx.route).filter(function (id) { return !!EX_INDEX[id]; });
            res = RouteTool.stats(ids); res.ids = ids; break;
          }
          case 'plan_route': {
            var inc = (args.includeIds || []).filter(function (id) { return !!EX_INDEX[id]; });
            var exc = (args.excludeIds || []).filter(function (id) { return !!EX_INDEX[id]; });
            var pref = (args.preferTopics || []).filter(function (t) { return !!MUSEUMS[Store.ctx.museumId].topics[t]; });
            var built = PlanningTool.build({
              budgetMin: typeof args.budgetMin === 'number' ? Math.max(8, Math.min(240, args.budgetMin)) : undefined,
              includeIds: inc, excludeIds: exc, pool: pref.length ?
                EXHIBITS.filter(function (e) { return pref.indexOf(e.topic) >= 0; }).map(function (e) { return e.id; })
                  .concat(EXHIBITS.filter(function (e) { return pref.indexOf(e.topic) < 0 && e.priority >= 2; }).map(function (e) { return e.id; }))
                : undefined
            });
            res = { route: built, stats: RouteTool.stats(built) }; break;
          }
          case 'adjust_route_lighter':
            res = PlanningTool.lighter(typeof args.targetReduceMin === 'number' ? args.targetReduceMin : 14); break;
          case 'wrap_up_route': res = PlanningTool.wrapUp(); break;
          case 'insert_exhibits_preview': {
            var ins = PlanningTool.insertAhead((args.ids || []).filter(function (id) { return !!EX_INDEX[id]; }));
            res = { tailRoute: ins.tail, wouldAdd: ins.added, wouldRemove: ins.removed, stats: RouteTool.stats(ins.tail) }; break;
          }
          case 'recommend_products': res = CultureExtensionTool.recommend(); break;
          default: res = { error: 'unknown_tool' };
        }
      } catch (e) { res = { error: 'tool_exception', detail: String(e && e.message || e) }; }
      toolLog.push({ tool: name, args: args, summary: summarize(name, res) });
      return res;
    },

    _systemPrompt: function () {
      var snap = StateTool.snapshot();
      return '你是博物馆智能伴游「知息」的 VisitPlannerAgent。游客说话很随意，你要理解真实意图。\n' +
        '【当前上下文】' + JSON.stringify(snap) + '\n' +
        '【规则】\n' +
        '1. 先判断是否需要调用工具获取事实；涉及时间/距离/路线的数字必须来自工具结果，禁止自己计算或编造展品ID。\n' +
        '2. 可用工具：' + this._toolDefs.map(function (t) { return t.name + '(' + t.desc + ')'; }).join('；') + '\n' +
        '3. 信息收集完成后，最终回复必须是唯一一个JSON对象（不要markdown围栏），字段：\n' +
        '{intent:"reroute|content_mode|wrap_up|propose_add|chat",reply:"≤80字温柔中文",reason:"简短决策原因",' +
        'nextAction:"continue|replan|show_exhibits|light_mode|wrap_up|rest",' +
        'newRoute:["展品id"]或null,addedExhibits:[],removedExhibits:[],proposedIds:[建议新增的展品id],' +
        'contentMode:"normal|light",restMinutes:number}\n' +
        '4. newRoute 只能来自 plan_route/wrap_up_route/adjust_route_lighter 的返回值。\n' +
        '5. 游客表达疲劳→考虑 adjust_route_lighter；时间紧张→wrap_up_route；新兴趣→knowledge_search后propose_add；嫌讲解长→nextAction=light_mode。';
    },
    _extractJson: function (text) {
      if (!text) return null;
      var m = text.match(/\{[\s\S]*\}/);
      if (!m) return null;
      try { return JSON.parse(m[0]); } catch (e) { return null; }
    },
    _callChat: function (ep, model, messages) {
      return fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model || 'deepseek-chat', messages: messages, temperature: 0.4, max_tokens: 700 })
      }).then(function (rp) {
        if (!rp.ok) throw new Error('http_' + rp.status);
        return rp.json();
      }).then(function (data) {
        var msg = data && data.choices && data.choices[0] && data.choices[0].message;
        if (!msg) throw new Error('bad_response');
        return msg;
      });
    },
    llmLoop: function (text, ep, model) {
      var self = this;
      var messages = [{ role: 'system', content: this._systemPrompt() }, { role: 'user', content: text }];
      var toolLog = [];
      var rounds = 0;
      function step() {
        if (rounds++ >= 3) throw new Error('round_limit');
        return self._callChat(ep, model, messages).then(function (msg) {
          if (msg.tool_calls && msg.tool_calls.length) {
            messages.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls });
            msg.tool_calls.forEach(function (tc) {
              var fn = tc.function && tc.function.name;
              var args = {};
              try { args = JSON.parse(tc.function.arguments || '{}'); } catch (e) {}
              var result = self._execTool(fn, args, toolLog);
              messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result).slice(0, 2600) });
            });
            return step();
          }
          var action = self._extractJson(msg.content);
          if (!action) throw new Error('no_json_action');
          return { action: action, toolCalls: toolLog };
        });
      }
      return step();
    },

    /** 主入口：自然语言 → AgentAction（LLM优先，失败回落规则） */
    chatAsync: function (text) {
      var self = this;
      var cfg = window.ZHIXI_AGENT || {};
      var ep = cfg.endpoint || '/api/chat';
      var canTry = typeof fetch === 'function' && ep;
      if (!canTry) {
        return new Promise(function (res) { setTimeout(function () { res(self.think(text)); }, 420 + Math.random() * 380); });
      }
      return this.llmLoop(text, ep, cfg.model).then(function (r) {
        return self.normalize(r.action, r.toolCalls);
      }).catch(function () {
        // P0-1 fallback：LLM 失败 → 本地规则引擎完整接管
        var fb = self.think(text);
        fb.fallbackUsed = true;
        return fb;
      });
    },

    /** 归一化 LLM 决策：数字/路线强制以本地工具复核为准 */
    normalize: function (action, toolCalls) {
      var c = Store.ctx;
      action = action || {};
      var outp = this._out({
        intent: ['reroute', 'content_mode', 'wrap_up', 'propose_add'].indexOf(action.intent) >= 0 ? action.intent : 'chat',
        reply: String(action.reply || '好，我来安排。').slice(0, 160),
        reason: String(action.reason || ''),
        toolCalls: toolCalls || []
      });
      if (NEXT_ACTIONS.indexOf(action.nextAction) >= 0) outp.nextAction = action.nextAction;
      if (action.contentMode === 'light' || action.contentMode === 'normal') outp.contentMode = action.contentMode;
      // 路线复核：只接受全部合法且非空的 newRoute；自动补齐已看前缀；时长一律本地重算
      if (Array.isArray(action.newRoute) && action.newRoute.length &&
          action.newRoute.every(function (id) { return !!EX_INDEX[id]; })) {
        var headLen0 = Store.nextUnvisited();
        var head = c.route.slice(0, headLen0);
        var seen = {}, body = [];
        action.newRoute.forEach(function (id) {
          if (!seen[id] && head.indexOf(id) < 0) { seen[id] = 1; body.push(id); }
        });
        if (body.length >= 2) {
          outp.newRoute = head.concat(RouteTool.reorderNearest(body, c.locationExhibitId));
          outp.routeChanged = true;
          outp.diffBefore = RouteTool.stats(c.route.slice(headLen0));
          outp.diffAfter = RouteTool.stats(outp.newRoute.slice(headLen0));
          outp.estimatedTotalMinutes = outp.diffAfter.totalMin;
        }
      }
      outp.proposedIds = (action.proposedIds || []).filter(function (id) { return !!EX_INDEX[id]; }).slice(0, 3);
      outp.addedExhibits = (action.addedExhibits || []).filter(function (id) { return !!EX_INDEX[id]; });
      outp.removedExhibits = (action.removedExhibits || []).filter(function (id) { return !!EX_INDEX[id]; });
      if (typeof action.restMinutes === 'number' && action.restMinutes > 0) outp.restMinutes = Math.min(15, action.restMinutes);
      if (outp.intent === 'propose_add' && outp.proposedIds.length) outp.nextAction = 'show_exhibits';
      return outp;
    },

    /* ========== Fallback 规则引擎（原 think()，输出统一为 AgentAction） ========== */
    think: function (text) {
      try {
        var d = detectIntent(text);
        switch (d.intent) {
          case 'fatigue': return this._fatigue(text);
          case 'less_info': return this._lessInfo();
          case 'highlights': return this._highlights();
          case 'keep': return this._keep();
          case 'time_change': return this._timeChange(d.minutes);
          case 'explore_related': return this._explore(text);
          case 'explore_topic': return this._explore(text);
          case 'ack': return this._out({ reply: '好，那我们按现在的节奏慢慢来。有任何想调整的，随时告诉我。' });
          default: return this._fallbackChat(text);
        }
      } catch (e) { return this._hardFallback(text); }
    },
    _fatigue: function () {
      var res = PlanningTool.lighter(14);
      var c = Store.ctx;
      var headLen = Store.nextUnvisited();
      var oldTail = c.route.slice(headLen);
      var newRoute = c.route.slice(0, headLen).concat(res.newTail);
      var before = RouteTool.stats(oldTail), after = RouteTool.stats(res.newTail);
      if (res.rest) after.totalMin += res.rest;
      return this._out({
        intent: 'reroute',
        reply: '我们逛了一阵子了。我把后半程收窄了一些——' +
          (res.dropped.length ? '去掉了' + joinNames(names(res.dropped)) : '留的都是更值得看的') +
          (res.rest ? '，另外给你安排了五分钟休息' : '') + '。',
        reason: '疲劳信号（游客反馈+行为信号' + JSON.stringify(Store.behaviorSignals()) + '），降低节奏',
        routeChanged: true, newRoute: newRoute,
        removedExhibits: res.dropped, restMinutes: res.rest,
        diffBefore: before, diffAfter: after,
        toolCalls: [
          { tool: 'state_snapshot', args: {}, summary: '剩余' + Store.remaining() + '分钟/已看' + c.visitedIds.length + '件' },
          { tool: 'adjust_route_lighter', args: { targetReduceMin: 14 }, summary: '删' + res.dropped.length + '件' + (res.rest ? '+休息' + res.rest + '分' : '') }
        ],
        reasons: ['保留你停留最久的青铜器专题', res.dropped.length ? '删除次级展项：' + names(res.dropped).join('、') : '核心展项全保留', '缩短一段步行', res.rest ? '增加 5 分钟休息' : '减少讲解量'],
        estimatedTotalMinutes: after.totalMin
      });
    },
    _lessInfo: function () {
      Store.ctx.infoLoad = 'light';
      return this._out({
        intent: 'content_mode', nextAction: 'light_mode',
        reply: '好，接下来我只讲最核心的一句话，想深入随时展开。',
        reason: '信息负荷偏高，切换轻量模式', routeChanged: false, contentMode: 'light'
      });
    },
    _highlights: function () {
      var res = PlanningTool.wrapUp();
      var c = Store.ctx;
      var headLen = Store.nextUnvisited();
      var oldTail = c.route.slice(headLen);
      var newRoute = c.route.slice(0, headLen).concat(res.keep);
      var before = RouteTool.stats(oldTail), after = RouteTool.stats(res.keep);
      return this._out({
        intent: 'reroute', nextAction: 'replan',
        reply: '那我帮你只留重点：' + joinNames(names(res.keep)) + '，其余的这次先放过它们。',
        reason: '只看重点，压缩至核心展项',
        routeChanged: true, newRoute: newRoute, removedExhibits: res.dropped,
        diffBefore: before, diffAfter: after,
        toolCalls: [
          { tool: 'state_snapshot', args: {}, summary: '读取兴趣与时间' },
          { tool: 'wrap_up_route', args: {}, summary: '保留最高分' + res.keep.length + '件' }
        ],
        reasons: ['保留评分最高的 ' + res.keep.length + ' 件', '剔除次要 ' + res.dropped.length + ' 件', '按顺路重排'],
        estimatedTotalMinutes: after.totalMin
      });
    },
    _keep: function () {
      Store.ctx.fatigueSignals = Math.max(0, Store.ctx.fatigueSignals - 1);
      Store.refreshStates();
      return this._out({ reply: '好，那我们保持现在的节奏。前面还有几件不错的，我陪你慢慢看。' });
    },
    _timeChange: function (minutes) {
      var c = Store.ctx;
      if (minutes && minutes < Store.remaining()) {
        c.totalMinutes = Math.round(Store.consumed() + minutes);
      }
      Store.refreshStates();
      var res = PlanningTool.wrapUp();
      var headLen = Store.nextUnvisited();
      var oldTail = c.route.slice(headLen);
      var newRoute = c.route.slice(0, headLen).concat(res.keep);
      var after = RouteTool.stats(res.keep);
      var keptNames = names(res.keep);
      return this._out({
        intent: 'wrap_up', nextAction: 'wrap_up',
        reply: '明白，进入收尾模式。我保留了你最感兴趣的' + (keptNames.length > 1 ? '两件' : '一件') +
          (keptNames.length ? '——' + joinNames(keptNames) : '') +
          (res.dropped.length ? '，其余的下次再看，我替你记着。' : '。'),
        reason: '剩余时间不足，切换收尾模式',
        routeChanged: true, newRoute: newRoute, removedExhibits: res.dropped,
        diffBefore: RouteTool.stats(oldTail), diffAfter: after,
        toolCalls: [
          { tool: 'state_snapshot', args: {}, summary: '按剩余' + Store.remaining() + '分钟重算' },
          { tool: 'wrap_up_route', args: {}, summary: '保留最值得的' + res.keep.length + '件' }
        ],
        reasons: ['按剩余 ' + Store.remaining() + ' 分钟重算', '保留最贴近今日兴趣的 ' + res.keep.length + ' 件', '剔除绕路展项'],
        estimatedTotalMinutes: after.totalMin
      });
    },
    _explore: function (text) {
      var cur = Store.ctx.locationExhibitId ? Store.ex(Store.ctx.locationExhibitId) : null;
      var cands = [];
      Object.keys(TOPIC_HINTS).forEach(function (k) {
        if (text.indexOf(k) >= 0) TOPIC_HINTS[k].forEach(function (id) {
          if (EX_INDEX[id] && !cands.some(function (cc) { return cc.id === id; })) cands.push(EX_INDEX[id]);
        });
      });
      if (!cands.length && cur) cands = KnowledgeTool.relatedOf(cur, text);
      if (!cands.length) cands = KnowledgeTool.search(text);
      var seenIds = Store.ctx.visitedIds.concat(Store.ctx.skippedIds);
      var inRoute = Store.ctx.route;
      var rawCount = cands.length;
      cands = cands.filter(function (e) { return seenIds.indexOf(e.id) < 0 && inRoute.indexOf(e.id) < 0; });
      var rem = Store.remaining();
      var picked = [], used = 0, prev = Store.ctx.locationExhibitId;
      cands.forEach(function (e) {
        if (picked.length >= 2) return;
        var cst = e.stay + Store.legWalk(prev, e.id);
        if (used + cst <= rem - 6) { picked.push(e); used += cst; prev = e.id; }
      });
      if (!cur) return this._out({ reply: '你现在还在大厅。想从哪一类开始？青铜器、汉代画像还是佛教造像，说一个方向就好。' });
      if (!picked.length) {
        return this._out({ reply: '有更接近这个方向的文物，不过按你剩下的时间（约 ' + rem + ' 分钟），走过去会太赶。不如把它留给下一次——我会在离馆时替你记着。' });
      }
      var linkNote = KnowledgeTool.explainLink(cur, picked[0]);
      var pnames = joinNames(names(picked.map(function (e) { return e.id; })));
      return this._out({
        intent: 'propose_add', nextAction: 'show_exhibits',
        reply: linkNote + '\n如果你感兴趣，我找到' + (picked.length > 1 ? '两件' : '一件') +
          '很接近这个方向的：' + pnames + '。你还剩 ' + rem + ' 分钟，我建议看其中' +
          (picked.length > 1 ? ' 2 件' : '这件') + '，时间正好。',
        reason: '游客产生新的兴趣方向（检索自知识库并评估时间可行性）',
        proposedIds: picked.map(function (e) { return e.id; }), routeChanged: false,
        toolCalls: [{ tool: 'knowledge_search', args: { query: text }, summary: '命中' + rawCount + '件候选，可行' + picked.length + '件' }]
      });
    },
    _fallbackChat: function (text) {
      var hits = KnowledgeTool.search(text);
      if (hits.length) {
        var e = hits[0];
        return this._out({
          intent: 'propose_add', nextAction: 'show_exhibits', proposedIds: [e.id],
          reply: '说到这个，《' + e.title + '》（' + e.period + '）可能有答案——' + e.short + ' 要不要我把它加进你的路线？'
        });
      }
      return this._out({ reply: '这个问题我先记下了，离馆前我会尽量帮你找到线索。现在也可以问我某件文物的事，或者直接说"我有点累"。' });
    },
    _hardFallback: function (text) {
      var t = text || '';
      if (/累|休息/.test(t)) return this._out({ intent: 'reroute', nextAction: 'replan', reply: '好，那我们把脚步放慢些，少看一两件，多歇一会儿。' });
      if (/少讲|信息|长讲解/.test(t)) return this._out({ intent: 'content_mode', nextAction: 'light_mode', contentMode: 'light', reply: '好，接下来每件只讲一句话。' });
      if (/分钟|时间|小时/.test(t)) return this._out({ intent: 'wrap_up', nextAction: 'wrap_up', reply: '明白，我马上按你剩下的时间收紧路线。' });
      if (/孔子|类似|相关/.test(t)) return this._out({ reply: '展厅里有更接近这个方向的文物，稍后我帮你指出来。' });
      return this._out({ reply: '我在的。你可以告诉我：想慢一点、少讲一点、只看重点，或者聊聊眼前这件。' });
    },

    /* ---------- 决策落地：前端 Action 执行器 ---------- */
    applyResult: function (r, opts) {
      opts = opts || {};
      var c = Store.ctx;
      var na = r.nextAction;
      // 内容深度
      if ((r.contentMode === 'light' && c.contentMode !== 'light') ||
          (na === 'light_mode' && c.contentMode !== 'light')) {
        c.contentMode = 'light'; c.infoLoad = 'light';
        c.adjustments.push({ at: Date.now(), kind: 'content', note: '切换轻量模式' });
      } else if (r.contentMode === 'normal' && c.contentMode !== 'normal' && na !== 'light_mode') {
        c.contentMode = 'normal'; c.infoLoad = 'normal';
      }
      // 休息
      if (r.restMinutes) { Store.addRest(r.restMinutes, '动态休息'); }
      // 接受新增提案
      if (na === 'show_exhibits' && opts.accept && (r.proposedIds || []).length) {
        var ins = PlanningTool.insertAhead(r.proposedIds);
        if (ins.added.length) {
          c.route = c.route.slice(0, Store.nextUnvisited()).concat(ins.tail);
          r.routeChanged = true; r.addedExhibits = ins.added; r.removedExhibits = ins.removed;
          var headLen = Store.nextUnvisited();
          r.diffAfter = RouteTool.stats(c.route.slice(headLen));
          r.reasons = ['新增与你兴趣相关的 ' + joinNames(names(ins.added)),
            ins.removed.length ? '为保证时间替换较低价值一站：' + names(ins.removed).join('、') : '其余展项全部保留'];
          r.reply = '带你去。新路线已经排好了，下一站就是它。';
          c.replanCount++;
          c.adjustments.push({ at: Date.now(), kind: 'route', note: '因兴趣新增 ' + ins.added.join(',') });
        }
      } else if ((r.routeChanged && r.newRoute) || na === 'replan' || na === 'wrap_up') {
        var newRoute = r.newRoute;
        if ((!newRoute || !newRoute.length) && na === 'replan') { var li = PlanningTool.lighter(14); newRoute = c.route.slice(0, Store.nextUnvisited()).concat(li.newTail); if (li.rest) r.restMinutes = r.restMinutes || li.rest; }
        if ((!newRoute || !newRoute.length) && na === 'wrap_up') { newRoute = c.route.slice(0, Store.nextUnvisited()).concat(PlanningTool.wrapUp().keep); }
        if (newRoute && newRoute.length) {
          var hLen = Store.nextUnvisited();
          r.diffBefore = r.diffBefore || RouteTool.stats(c.route.slice(hLen));
          r.routeChanged = true;
          c.replanCount++;
          c.adjustments.push({ at: Date.now(), kind: 'route', note: r.reason || '重新规划' });
          c.route = newRoute;
          r.diffAfter = r.diffAfter || RouteTool.stats(newRoute.slice(Store.nextUnvisited()));
          r.estimatedTotalMinutes = r.diffAfter.totalMin;
          if (r.intent === 'fatigue') c.fatigueSignals = Math.min(2, c.fatigueSignals + 1);
        }
      }
      Store.refreshStates();
      Store.emit();
      return r;
    },

    /* ---------- P1-3 初始规划入口 ---------- */
    buildInitialPlan: function (opts) {
      var plan = PlanningTool.initialPlan(opts);
      (plan.ids || []).forEach(function (id) { void id; });
      return plan;
    }
  };

  /* 工具结果摘要（进入 toolCalls 日志，避免超长） */
  function summarize(name, res) {
    try {
      if (!res) return '空';
      switch (name) {
        case 'state_snapshot': return '剩余' + res.timeRemaining + '分钟/已看' + res.visitedExhibits.length + '件';
        case 'knowledge_search': return '命中' + (res.results || []).length + '件：' + (res.results || []).map(function (x) { return x.title; }).join('、');
        case 'route_stats': return res.count + '件/' + res.km + 'km/' + res.totalMin + '分钟';
        case 'plan_route': return '规划' + res.route.length + '件/' + res.stats.totalMin + '分钟';
        case 'adjust_route_lighter': return '删' + (res.dropped || []).length + '件' + (res.rest ? '+休息' + res.rest + '分' : '');
        case 'wrap_up_route': return '留' + res.keep.length + '件';
        case 'insert_exhibits_preview': return '将增' + (res.wouldAdd || []).length + '件';
        case 'recommend_products': return '推荐' + res.length + '件文创';
        default: return 'ok';
      }
    } catch (e) { return 'ok'; }
  }

  window.Agent = Agent;
})();
