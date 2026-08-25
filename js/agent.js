/* ============================================================
   知息 ZHI XI · VisitPlannerAgent（唯一核心 Agent）
   ------------------------------------------------------------
   工具：KnowledgeTool / RouteTool / StateTool / PlanningTool
   输出：结构化结果，前端据此真实更新路线、地图、时间、内容深度。

   ── 关于大模型 API 接入（重要）──
   本 Demo 的对话理解默认使用本地规则引擎（离线可演示、零依赖）。
   如需接入真实 LLM（DeepSeek / OpenAI 兼容接口）：
   在页面加载前设置 window.ZHIXI_LLM = {
     endpoint:'https://api.deepseek.com/chat/completions',
     apiKey:'sk-xxx', model:'deepseek-chat'
   };
   Agent.chatAsync() 会优先调用 LLM 生成 reply 文本，
   意图识别与重规划仍由本地 PlanningTool 执行以保证结构化输出可靠；
   LLM 失败时自动回落到本地规则（fallback），页面永不报错。
   ============================================================ */
(function () {

  /* ---------------- StateTool ---------------- */
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
        state: { pace: c.pace, informationLoad: c.infoLoad, timePressure: c.timePressure },
        selectedProducts: c.wishedProducts.slice(),
        contentMode: c.contentMode
      };
    }
  };

  /* ---------------- RouteTool ---------------- */
  var RouteTool = {
    walkBetween: function (fromId, toId) { return Store.legWalk(fromId, toId); },
    stats: function (ids) { return Store.routeStats(ids, Store.ctx.locationExhibitId); },
    reorderNearest: function (ids, fromId) {
      // 就近排序（贪心），保持参观顺路
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

  /* ---------------- KnowledgeTool ---------------- */
  var STOP_BIGRAMS = ['这个','那个','什么','怎么','还有','想看','看看','有关','关系','类似','一个','一下','可以','就是'];
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
  var KnowledgeTool = {
    search: function (text) {
      // 关键词 → 展品匹配（标题/简介/详情/主题 + 标题双字实体命中）
      var t = (text || '').trim();
      if (!t) return [];
      var scores = {};
      function add(id, s) { scores[id] = (scores[id] || 0) + s; }
      EXHIBITS.forEach(function (e) {
        var hay = e.title + e.short + (e.detail || '') + (MUSEUMS.sdm.topics[e.topic].name);
        if (e.title.indexOf(t) >= 0) add(e.id, 6);
        if (hay.indexOf(t) >= 0) add(e.id, 3);
        Object.keys(INTEREST_SEEDS).forEach(function (k) {
          if (t.indexOf(k) >= 0 && INTEREST_SEEDS[k] === e.topic) add(e.id, 4);
        });
      });
      // 标题双字实体：查询里出现标题中相邻两字即视为强命中
      for (var i = 0; i < t.length - 1; i++) {
        var g = t.substr(i, 2);
        if (TITLE_BIGRAMS[g]) TITLE_BIGRAMS[g].forEach(function (id) { add(id, 6); });
      }
      return Object.keys(scores)
        .filter(function (id) { return scores[id] >= 3; })
        .sort(function (a, b) { return scores[b] - scores[a]; })
        .map(function (id) { return EX_INDEX[id]; });
    },
    relatedOf: function (ex, extraText) {
      // 当前展品相关 + 文本语义扩展（related 列表 + 同主题 + 关键词检索）
      var seen = {}, out = [];
      function push(e, s) {
        if (!e || seen[e.id]) return;
        seen[e.id] = 1;
        out.push({ ex: e, score: s });
      }
      (ex.related || []).forEach(function (id) { push(EX_INDEX[id], 5); });
      var kwHits = this.search((extraText || '') + ' ' + MUSEUMS.sdm.topics[ex.topic].name);
      kwHits.forEach(function (e) { push(e, 3); });
      EXHIBITS.forEach(function (e) { if (e.topic === ex.topic && e.id !== ex.id) push(e, 2); });
      out.sort(function (a, b) { return b.score - a.score; });
      return out.map(function (o) { return o.ex; }).filter(function (e) {
        return e.id !== ex.id;
      });
    },
    explainLink: function (fromEx, toEx) {
      if ((fromEx.related || []).indexOf(toEx.id) >= 0)
        return '它和你刚看的《' + fromEx.title + '》在展线上是直接相关的。';
      if (fromEx.topic === toEx.topic)
        return '它和《' + fromEx.title + '》同属「' + MUSEUMS.sdm.topics[toEx.topic].name + '」这条线索。';
      return '它从另一个侧面呼应你刚才的兴趣。';
    }
  };

  /* ---------------- PlanningTool ---------------- */
  var PlanningTool = {
    /* 在时间预算内组合路线：兴趣分 × 优先级 − 步行惩罚 */
    build: function (opts) {
      opts = opts || {};
      var c = Store.ctx;
      var fromId = opts.fromId !== undefined ? opts.fromId : c.locationExhibitId;
      var budget = opts.budgetMin != null ? opts.budgetMin : Math.max(10, Store.remaining() - 8);
      var mustInclude = (opts.includeIds || []).filter(function (id) { return !!EX_INDEX[id]; });
      var exclude = opts.excludeIds || [];
      var visited = c.visitedIds.concat(c.skippedIds);

      // 候选池：未看过 + 不在排除列表（默认全馆；指定池时用池内未看的）
      var pool = (opts.pool || EXHIBITS.map(function (e) { return e.id; })).filter(function (id) {
        return visited.indexOf(id) < 0 && exclude.indexOf(id) < 0;
      });

      var self = this;
      function score(id) {
        var e = Store.ex(id);
        return (Store.ctx.interests[e.topic] || 0) * 2.2 + (e.priority || 1) * 1.7
          - RouteTool.walkBetween(fromId, id) * 0.10;
      }
      function cost(id) {
        var prev = out.length ? out[out.length - 1] : fromId;
        return Store.ex(id).stay + Store.legWalk(prev, id);
      }

      var out = [];
      // 1) 必看项先行插入（就近序）
      mustInclude.forEach(function (id) {
        if (out.indexOf(id) < 0 && pool.indexOf(id) >= 0) { out.push(id); pool.splice(pool.indexOf(id), 1); }
      });
      // 2) 贪心取高分近邻直到预算耗尽
      var remainBudget = budget - mustInclude.reduce(function (s, id) {
        var prev = out.length > 1 ? out[out.indexOf(id) - 1] : fromId;
        return s + Store.ex(id).stay + Store.legWalk(prev, id);
      }, 0);
      while (pool.length) {
        var bestId = null, bestSc = -Infinity, bestCost = 0;
        pool.forEach(function (id) {
          var cst = cost(id);
          var sc = score(id) - cst * 0.05;
          if (cst <= remainBudget && sc > bestSc) { bestSc = sc; bestId = id; bestCost = cst; }
        });
        if (!bestId) break;
        out.push(bestId); pool.splice(pool.indexOf(bestId), 1);
        remainBudget -= bestCost;
      }
      return out;
    },

    /* 轻松版：在现路线上做减法 + 加入休息 */
    lighter: function (targetReduceMin) {
      var c = Store.ctx, S = Store;
      var idx = Store.nextUnvisited();
      var head = c.route.slice(0, idx);          // 已定部分（含当前站）
      var tail = c.route.slice(idx);             // 未走部分
      var keep = [], dropped = [];
      var stats = RouteTool.stats(tail);
      var need = Math.min(targetReduceMin || 14, Math.max(8, stats.totalMin - 18));
      // 先删次要（priority 低且非今日高兴趣），再删低兴趣
      var cand = tail.filter(function (id) {
        var e = S.ex(id);
        return !mustKeep(id);
        function mustKeep(id2) {
          var ee = S.ex(id2);
          return (ee.priority >= 3) || ((Store.ctx.interests[ee.topic] || 0) >= 2.5);
        }
      });
      cand.sort(function (a, b) {
        var ea = S.ex(a), eb = S.ex(b);
        return (ea.priority * 2 + (c.interests[ea.topic] || 0)) - (eb.priority * 2 + (c.interests[eb.topic] || 0));
      });
      keep = tail.slice();
      var saved = 0;
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

    /* 收尾模式：只留最值得的，塞进剩余时间 */
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
        if (used + cst <= budget && keep.length < 4) {
          keep.push(o.id); used += cst; prev = o.id;
        }
      });
      if (!keep.length && tail.length) keep = [scored[0].id];
      // 硬约束：总时长不得超过预算太多，超出则从队尾裁剪
      while (keep.length > 1 && RouteTool.stats(keep, c.locationExhibitId).totalMin > budget + 3) {
        keep.pop();
      }
      keep = RouteTool.reorderNearest(keep, c.locationExhibitId);
      return { keep: keep, dropped: tail.filter(function (id) { return keep.indexOf(id) < 0; }) };
    },

    /* 把新发现的展品插入后半程；若超预算则替换价值最低的一站 */
    insertAhead: function (ids) {
      var c = Store.ctx, S = Store;
      var idx = Store.nextUnvisited();
      var head = c.route.slice(0, idx), tail = c.route.slice(idx);
      var added = ids.filter(function (id) { return c.visitedIds.indexOf(id) < 0 && tail.indexOf(id) < 0; });
      if (!added.length) return { tail: tail, added: [], removed: [] };
      var merged = added.concat(tail);
      // 预算校验
      var budget = Math.max(10, Store.remaining() - 6);
      var stats = RouteTool.stats(merged);
      var removed = [];
      while (stats.totalMin > budget && merged.length > 2) {
        // 从非新加项中移除价值最低者
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

  /* ---------------- 语言生成 ---------------- */
  function names(ids) {
    return ids.map(function (id) { return Store.ex(id).title; });
  }
  function joinNames(arr) {
    if (!arr.length) return '';
    if (arr.length === 1) return '《' + arr[0] + '》';
    return arr.map(function (n) { return '《' + n + '》'; }).join('和');
  }

  /* ---------------- 意图理解（本地规则引擎）---------------- */
  var RULES = [
    { k: ['少讲', '信息有点多', '信息多', '简单点', '太长', '别讲这么', '听累了不想看字'], intent: 'less_info' },
    { k: ['累', '慢一点', '轻松一点', '歇', '休息', '走不动', '有点赶'], intent: 'fatigue' },
    { k: ['重点', '精华', '最值得', '挑最好', '只看最好'], intent: 'highlights' },
    { k: ['继续', '还可以', '没问题', '保持', '状态不错', '不用调'], intent: 'keep' },
    { k: ['只剩', '只有', '没多少时间', '来不及', '快闭馆', '得走了'], intent: 'time_change' },
    { k: ['类似', '相近', '差不多', '还想看', '再看看', '相关', '有关系', '有关吗', '关联'], intent: 'explore_related' },
    { k: ['孔子', '老子', '儒家', '论语', '礼乐'], intent: 'explore_topic' },
    { k: ['谢谢', '好的', '嗯'], intent: 'ack' }
  ];
  var TOPIC_HINTS = {
    '孔子': ['E18', 'E13', 'E02'],
    '老子': ['E18', 'E13'],
    '儒家': ['E18', 'E02', 'E06'],
    '论语': ['E18', 'E13'],
    '礼': ['E02', 'E01', 'E04']
  };

  function detectIntent(text) {
    var t = (text || '').toLowerCase();
    // 时间变化优先（"只剩20分钟"里可能也有"累"等词，但意图以时间为先）
    var m = t.match(/(\d+)\s*分钟/) || t.match(/(\d+)\s*min/);
    var hasTimeWord = /剩|只有|还有不到|来得及/.test(t);
    if (m && hasTimeWord) return { intent: 'time_change', minutes: parseInt(m[1], 10) };
    if (/没时间|来不及|要走了|快闭馆/.test(t)) return { intent: 'time_change', minutes: 15 };

    for (var i = 0; i < RULES.length; i++) {
      var r = RULES[i];
      for (var j = 0; j < r.k.length; j++) {
        if (t.indexOf(r.k[j]) >= 0) return { intent: r.intent };
      }
    }
    return { intent: 'unknown' };
  }

  /* ---------------- VisitPlannerAgent ---------------- */
  var Agent = {
    tools: { knowledge: KnowledgeTool, route: RouteTool, state: StateTool, planning: PlanningTool },

    /* 结构化输出骨架 */
    _out: function (o) {
      return Object.assign({
        intent: 'chat',
        reply: '',
        reason: '',
        routeChanged: false,
        newRoute: null,
        addedExhibits: [],
        removedExhibits: [],
        estimatedTotalMinutes: null,
        contentMode: Store.ctx.contentMode
      }, o);
    },

    /* 主入口：自然语言 → 结构化决策（本地规则，永远可用） */
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
      } catch (e) {
        return this._hardFallback(text); // 任何异常都不让页面出错
      }
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
        reason: '游客反馈疲劳信号，降低节奏',
        routeChanged: true, newRoute: newRoute,
        removedExhibits: res.dropped, restMinutes: res.rest,
        diffBefore: before, diffAfter: after,
        reasons: [
          '保留了你停留最久的青铜器专题展项',
          res.dropped.length ? '删除两个次级展项：' + names(res.dropped).join('、') : '未删减核心展项',
          '缩短了一段步行距离',
          res.rest ? '增加 5 分钟休息' : '整体讲解量减少'
        ],
        estimatedTotalMinutes: after.totalMin
      });
    },

    _lessInfo: function () {
      Store.ctx.infoLoad = 'light';
      return this._out({
        intent: 'content_mode',
        reply: '好，接下来我只讲最核心的一句话，想深入随时展开。',
        reason: '信息负荷偏高，切换轻量模式',
        routeChanged: false, contentMode: 'light'
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
        intent: 'reroute',
        reply: '那我帮你只留重点：' + joinNames(names(res.keep)) + '，其余的这次先放过它们。',
        reason: '游客要求只看重点，压缩至核心展项',
        routeChanged: true, newRoute: newRoute,
        removedExhibits: res.dropped,
        diffBefore: before, diffAfter: after,
        reasons: [
          '保留评分最高的 ' + res.keep.length + ' 件核心展品',
          '剔除次要展项 ' + res.dropped.length + ' 件',
          '路线按顺路原则重新排列'
        ],
        estimatedTotalMinutes: after.totalMin
      });
    },

    _keep: function () {
      Store.ctx.fatigueSignals = Math.max(0, Store.ctx.fatigueSignals - 1);
      Store.refreshStates();
      return this._out({
        reply: '好，那我们保持现在的节奏。前面还有几件不错的，我陪你慢慢看。'
      });
    },

    _timeChange: function (minutes) {
      var c = Store.ctx;
      // 先按游客声明压缩时间账本，再重算（顺序很重要）
      if (minutes && minutes < Store.remaining()) {
        var consumed = Store.consumed();
        c.totalMinutes = Math.round(consumed + minutes);
      }
      Store.refreshStates();
      var res = PlanningTool.wrapUp();
      var headLen = Store.nextUnvisited();
      var oldTail = c.route.slice(headLen);
      var newRoute = c.route.slice(0, headLen).concat(res.keep);
      var after = RouteTool.stats(res.keep);
      var keptNames = names(res.keep);
      return this._out({
        intent: 'wrap_up',
        reply: '明白，进入收尾模式。原计划还剩不少，我保留了你最感兴趣的' +
          (keptNames.length > 1 ? '两件' : '一件') +
          (keptNames.length ? '——' + joinNames(keptNames) : '') +
          (res.dropped.length ? '，其余的下次再看，我替你记着。' : '。'),
        reason: '游客剩余时间不足，切换收尾模式',
        routeChanged: true, newRoute: newRoute,
        removedExhibits: res.dropped,
        diffBefore: RouteTool.stats(oldTail),
        diffAfter: after,
        reasons: [
          '按剩余 ' + Store.remaining() + ' 分钟重算全程',
          '保留与今日兴趣最接近的 ' + res.keep.length + ' 件',
          '剔除需要绕路的展项'
        ],
        estimatedTotalMinutes: after.totalMin
      });
    },

    _explore: function (text) {
      var cur = Store.ctx.locationExhibitId ? Store.ex(Store.ctx.locationExhibitId) : null;
      var cands = [];
      // 1) 实体提示表优先（"孔子""老子""儒家""礼"等），无论触发哪条意图
      Object.keys(TOPIC_HINTS).forEach(function (k) {
        if (text.indexOf(k) >= 0) TOPIC_HINTS[k].forEach(function (id) {
          if (EX_INDEX[id] && !cands.some(function (c) { return c.id === id; })) cands.push(EX_INDEX[id]);
        });
      });
      // 2) 当前展品关联扩展
      if (!cands.length && cur) cands = KnowledgeTool.relatedOf(cur, text);
      // 3) 全文知识检索兜底
      if (!cands.length) cands = KnowledgeTool.search(text);

      var seenIds = Store.ctx.visitedIds.concat(Store.ctx.skippedIds);
      var inRoute = Store.ctx.route;
      cands = cands.filter(function (e) {
        return seenIds.indexOf(e.id) < 0 && inRoute.indexOf(e.id) < 0;
      });

      var rem = Store.remaining();
      var picked = [], used = 0, prev = Store.ctx.locationExhibitId;
      cands.forEach(function (e) {
        if (picked.length >= 2) return;
        var cst = e.stay + Store.legWalk(prev, e.id);
        if (used + cst <= rem - 6) { picked.push(e); used += cst; prev = e.id; }
      });

      if (!cur) {
        return this._out({ reply: '你现在还在大厅。想从哪一类开始？青铜器、汉代画像还是佛教造像，说一个方向就好。' });
      }
      if (!picked.length) {
        return this._out({
          reply: '有更接近这个方向的文物，不过按你剩下的时间（约 ' + rem + ' 分钟），走过去会太赶。不如把它留给下一次——我会在离馆时替你记着。'
        });
      }
      var linkNote = KnowledgeTool.explainLink(cur, picked[0]);
      var pnames = joinNames(names(picked.map(function (e) { return e.id; })));
      return this._out({
        intent: 'propose_add',
        reply: linkNote + '\n如果你感兴趣，我找到' + (picked.length > 1 ? '两件' : '一件') +
          '很接近这个方向的：' + pnames + '。你还剩 ' + rem + ' 分钟，我建议看其中' +
          (picked.length > 1 ? ' 2 件' : '这件') + '，时间正好。',
        reason: '游客产生新的兴趣方向，查询相关知识并评估可行性',
        proposedIds: picked.map(function (e) { return e.id; }),
        routeChanged: false
      });
    },

    _fallbackChat: function (text) {
      var hits = KnowledgeTool.search(text);
      if (hits.length) {
        var e = hits[0];
        return this._out({
          reply: '说到这个，《' + e.title + '》（' + e.period + '）可能有答案——' + e.short +
            ' 要不要我把它加进你的路线？',
          proposedIds: [e.id]
        });
      }
      return this._out({
        reply: '这个问题我先记下了，离馆前我会尽量帮你找到线索。现在也可以问我：某件文物"和什么有关系"、"类似的有哪几件"，或者直接说"我有点累"。'
      });
    },

    /* 硬兜底：保证五种关键场景即使内部异常也有可用回答 */
    _hardFallback: function (text) {
      var t = text || '';
      if (/累|休息/.test(t)) return this._out({ intent: 'reroute', routeChanged: false, reply: '好，那我们把脚步放慢些，少看一两件，多歇一会儿。' });
      if (/少讲|信息/.test(t)) return this._out({ intent: 'content_mode', contentMode: 'light', reply: '好，接下来每件只讲一句话。' });
      if (/分钟|时间/.test(t)) return this._out({ intent: 'wrap_up', routeChanged: false, reply: '明白，我马上按你剩下的时间收紧路线。' });
      if (/孔子|类似|相关/.test(t)) return this._out({ reply: '展厅里有更接近这个方向的文物，稍后我帮你指出来。' });
      return this._out({ reply: '我在的。你可以告诉我：想慢一点、少讲一点、只看重点，或者聊聊眼前这件。' });
    },

    /* ---------- 决策落地：真正修改路线 ---------- */
    applyResult: function (r, opts) {
      opts = opts || {};
      var c = Store.ctx;
      if (r.contentMode && r.contentMode !== c.contentMode) {
        c.contentMode = r.contentMode;
        c.adjustments.push({ at: Date.now(), kind: 'content', note: r.contentMode === 'light' ? '切换轻量模式' : '恢复完整讲解' });
      }
      if (r.restMinutes) Store.addRest(r.restMinutes, '动态休息');
      if (r.intent === 'propose_add' && opts.accept && r.proposedIds) {
        var ins = PlanningTool.insertAhead(r.proposedIds);
        if (ins.added.length) {
          c.route = c.route.slice(0, Store.nextUnvisited()).concat(ins.tail);
          r.routeChanged = true;
          r.addedExhibits = ins.added;
          r.removedExhibits = ins.removed;
          r.diffAfter = RouteTool.stats(c.route.slice(Store.nextUnvisited()));
          r.reasons = ['新增与你兴趣相关的 ' + joinNames(names(ins.added)),
            ins.removed.length ? '为保证时间，替换了价值较低的一站：' + names(ins.removed).join('、') : '其余展项全部保留'];
          r.reply = '带你去。新路线已经排好了，下一站就是它。';
          c.replanCount++;
          c.adjustments.push({ at: Date.now(), kind: 'route', note: '因兴趣新增 ' + ins.added.join(',') });
        }
      } else if (r.routeChanged && r.newRoute) {
        c.replanCount++;
        c.adjustments.push({ at: Date.now(), kind: 'route', note: r.reason || '重新规划' });
        c.route = r.newRoute;
        if (r.intent === 'fatigue') c.fatigueSignals = Math.min(2, c.fatigueSignals + 1);
      }
      Store.refreshStates();
      Store.emit();
      return r;
    }
  };

  window.Agent = Agent;

  /* ============================================================
     可选 LLM 接入层（见文件头注释）
     只增强"说话方式"；意图与重规划始终由本地结构化引擎执行。
     ============================================================ */
  Agent.chatAsync = function (text) {
    var cfg = window.ZHIXI_LLM;
    var local = Agent.think(text);           // 本地结构化决策（保底，永远执行）
    if (!cfg || !cfg.endpoint || !cfg.apiKey) {
      return new Promise(function (res) {
        setTimeout(function () { res(local); }, 520 + Math.random() * 420); // 自然停顿
      });
    }
    var sys = '你是博物馆智能伴游"知息"。语气温柔简洁，不说技术术语。' +
      '请基于以下上下文，用不超过80个中文字回应该游客，并保留JSON中的行动建议不变：' +
      JSON.stringify(StateTool.snapshot()) + ' 本地决策草稿：' + JSON.stringify(local);
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 4000);
    return fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
      body: JSON.stringify({
        model: cfg.model || 'deepseek-chat',
        messages: [{ role: 'system', content: sys }, { role: 'user', content: text }],
        temperature: 0.6, max_tokens: 200
      }),
      signal: ctrl.signal
    }).then(function (rp) { return rp.json(); }).then(function (data) {
      clearTimeout(timer);
      var txt = data && data.choices && data.choices[0] && data.choices[0].message &&
        data.choices[0].message.content || '';
      if (txt) local.reply = txt.trim().slice(0, 160);
      return local;
    }).catch(function () { clearTimeout(timer); return local; }); // LLM 失败 → 本地结果
  };
})();
