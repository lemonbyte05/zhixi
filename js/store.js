/* ============================================================
   知息 ZHI XI · 状态中枢
   Agent Context 单例：时间 / 节奏 / 信息负荷 / 兴趣 / 路线
   ============================================================ */
(function () {
  var LS_KEY = 'zhixi_ctx_v1';
  var AMBIENT_SEC_PER_MIN = 16;   // 演示时钟：环境流逝 16 秒 ≈ 1 分钟（仅作轻微推进）

  function nowMin() { return Date.now() / 1000 / 60; }

  var Store = {
    ctx: null,
    _subs: [],

    defaults: function () {
      return {
        v: 1,
        museumId: 'sdm',
        view: 'welcome',
        /* 入口选择 */
        entryMode: null,          // slow | efficient | theme | family
        totalMinutes: 90,
        interestSeed: '',         // 用户输入的自然语言
        seedTopics: [],
        /* 时间账本：所有扣减都记入 ledger，剩余时间=total-已消耗 */
        ledger: [],               // [{t:'walk'|'stay'|'rest'|'ambient', m:min, at}]
        ambientAcc: 0,            // 环境秒累计
        startedAt: null,
        finished: false,
        /* 参观现场 */
        route: [],                // 展品 id 有序列表
        originalRoute: [],
        cursorIdx: -1,            // 当前进行中的站
        visitedIds: [],           // 已完成
        skippedIds: [],
        expandedIds: [],          // 展开"深入讲解"过的展品
        locationExhibitId: null,
        /* 状态模型（三维度） */
        pace: 'calm',             // calm 舒缓 | focus 专注 | tight 紧凑
        infoLoad: 'normal',       // light 轻 | normal 正常 | high 偏高
        contentMode: 'normal',    // normal | light （轻量模式）
        timePressure: 'ample',    // ample | limited | urgent
        fatigueSignals: 0,
        restMinutes: 0,           // 重规划加入的休息
        checkinDone: false,       // 自然节点关怀已出现过
        /* 兴趣 */
        interests: {},            // topicId -> score
        chatTopics: [],           // 对话中出现过的主题（文创/推荐依据）
        walkKm: 0,                // 累计步行公里（行为信号）
        /* Agent 行为记录 */
        replanCount: 0,
        adjustments: [],          // [{at, kind, note}]
        chatCount: 0,
        /* 未完待续 & 文创 */
        pendingContinue: null,    // 展品id
        wishedProducts: [],
        summarySeen: false
      };
    },

    load: function () {
      try {
        var raw = localStorage.getItem(LS_KEY);
        if (raw) {
          this.ctx = Object.assign(this.defaults(), JSON.parse(raw));
          if (!this.ctx || this.ctx.v !== 1) throw 0;
          return;
        }
      } catch (e) { /* fallthrough */ }
      this.ctx = this.defaults();
    },
    save: function () {
      try { localStorage.setItem(LS_KEY, JSON.stringify(this.ctx)); } catch (e) {}
    },
    reset: function () {
      try { localStorage.removeItem(LS_KEY); } catch (e) {}
      this.ctx = this.defaults();
      this.emit();
    },

    sub: function (fn) { this._subs.push(fn); },
    emit: function () {
      this.save();
      this._subs.forEach(function (fn) { fn(); });
    },
    patch: function (obj) {
      Object.assign(this.ctx, obj);
      this.emit();
    },

    /* ---------- 派生量 ---------- */
    museum: function () { return MUSEUMS[this.ctx.museumId]; },

    consumed: function () {
      var s = 0;
      this.ctx.ledger.forEach(function (l) { s += l.m; });
      return Math.round(s * 10) / 10;
    },
    remaining: function () {
      var r = this.ctx.totalMinutes - this.consumed();
      return Math.max(0, Math.round(r));
    },

    refreshStates: function () {
      var c = this.ctx;
      var rem = this.remaining();
      c.timePressure = rem > 45 ? 'ample' : (rem >= 18 ? 'limited' : 'urgent');
      // 信息负荷：由游客反馈驱动（少讲一点→light；继续深入→偏高），不对外展示数字
      // 节奏：疲劳信号与时间压力共同估计
      if (c.fatigueSignals >= 2 || c.timePressure === 'urgent') c.pace = 'tight';
      else if (c.fatigueSignals === 1 || c.timePressure === 'limited') c.pace = 'focus';
      else c.pace = 'calm';
    },

    paceLabel: function () {
      return { calm: '舒缓', focus: '专注', tight: '紧凑' }[this.ctx.pace] || '舒缓';
    },

    /* ---------- 路线工具 ---------- */
    ex: function (id) { return EX_INDEX[id]; },
    galleryOf: function (ex) { return this.museum().galleries[ex.gallery]; },

    distUnits: function (a, b) {
      var ax = a.x !== undefined ? a.x : a.cx, ay = a.y !== undefined ? a.y : a.cy;
      var bx = b.x !== undefined ? b.x : b.cx, by = b.y !== undefined ? b.y : b.cy;
      return Math.hypot(ax - bx, ay - by);
    },
    posOf: function (exOrLobby) {
      if (!exOrLobby || exOrLobby.lobby) { var L = this.museum().lobby; return { x: L.x, y: L.y }; }
      return { x: exOrLobby.x, y: exOrLobby.y };
    },
    walkMin: function (fromPos, toEx) {
      var m = this.museum();
      var km = this.distUnits(fromPos, toEx) * m.kmPerUnit;
      return Math.max(1, Math.round(km * m.walkMinPerKm));
    },
    legWalk: function (fromId, toId) {
      var from = fromId ? this.ex(fromId) : { lobby: true };
      return this.walkMin(this.posOf(from), this.ex(toId));
    },
    routeStats: function (ids, fromLocationId) {
      var S = this;
      var stay = 0, walk = 0, prev = fromLocationId || null;
      ids.forEach(function (id) {
        var e = S.ex(id);
        stay += e.stay;
        walk += S.legWalk(prev, id);
        prev = id;
      });
      var prevPos = prev ? S.posOf(S.ex(prev)) : S.posOf({ lobby: true });
      var backKm = 0; // 不计返程，保持直观
      var km = 0, p2 = fromLocationId ? S.posOf(S.ex(fromLocationId)) : S.posOf({ lobby: true });
      ids.forEach(function (id) {
        var np = S.posOf(S.ex(id));
        km += S.distUnits(p2, np);
        p2 = np;
      });
      return {
        count: ids.length,
        stayMin: stay,
        walkMin: walk,
        km: Math.round(km * S.museum().kmPerUnit * 10) / 10,
        totalMin: stay + walk + (this.ctx.restMinutes || 0)
      };
    },

    /* ---------- 参观动作 ---------- */
    startVisit: function (routeIds) {
      var c = this.ctx;
      c.route = routeIds.slice();
      c.originalRoute = routeIds.slice();
      c.cursorIdx = 0;
      c.startedAt = Date.now();
      c.locationExhibitId = null;
      c.visitedIds = []; c.skippedIds = []; c.expandedIds = [];
      c.ledger = [{ t: 'enter', m: 2, at: Date.now(), note: '入馆安检' }];
      if (c.seedTopics.length) {
        var self = this;
        c.seedTopics.forEach(function (t) { self.addInterest(t, 3); });
      }
      this.refreshStates();
      this.emit();
    },
    nextUnvisited: function () {
      var c = this.ctx;
      for (var i = 0; i < c.route.length; i++) {
        if (c.visitedIds.indexOf(c.route[i]) < 0 && c.skippedIds.indexOf(c.route[i]) < 0) return i;
      }
      return -1;
    },
    currentNext: function () {
      var c = this.ctx, i = this.nextUnvisited();
      if (i < 0) return null;
      return { idx: i, ex: this.ex(c.route[i]), walk: this.legWalk(c.locationExhibitId, c.route[i]) };
    },
    completeCurrent: function (opts) {
      opts = opts || {};
      var c = this.ctx, cur = this.currentNext();
      if (!cur) return;
      var e = cur.ex;
      if (opts.skip) { c.skippedIds.push(e.id); }
      else {
        c.visitedIds.push(e.id);
        this.addInterest(e.topic, 1);
        if (c.expandedIds.indexOf(e.id) >= 0) this.addInterest(e.topic, 1);
      }
      var walk = cur.walk, stay = opts.skip ? 1 : e.stay + (c.expandedIds.indexOf(e.id) >= 0 ? 2 : 0);
      c.ledger.push({ t: 'visit', m: walk + stay, at: Date.now(), id: e.id });
      // P1-2 行为信号：累计步行距离
      var m2 = this.museum();
      c.walkKm = Math.round(((c.walkKm || 0) + this.distUnits(this.posOf(c.locationExhibitId || { lobby: true }), e) * m2.kmPerUnit) * 100) / 100;
      c.locationExhibitId = e.id;
      c.cursorIdx = cur.idx + 1;
      this.refreshStates();
      this.emit();
    },
    addRest: function (min, note) {
      this.ctx.ledger.push({ t: 'rest', m: min, at: Date.now(), note: note || '休息' });
      this.ctx.restMinutes += min;
    },
    tickAmbient: function (sec) {
      var c = this.ctx;
      if (c.finished || !c.startedAt) return;
      c.ambientAcc += sec;
      while (c.ambientAcc >= AMBIENT_SEC_PER_MIN) {
        c.ambientAcc -= AMBIENT_SEC_PER_MIN;
        c.ledger.push({ t: 'ambient', m: 1, at: Date.now() });
      }
      this.refreshStates();
    },

    /* ---------- 兴趣 ---------- */
    addInterest: function (topicId, delta) {
      if (!topicId || !this.museum().topics[topicId]) return;
      var it = this.ctx.interests;
      it[topicId] = Math.min(5, Math.max(0, (it[topicId] || 0) + delta));
    },
    /* ---------- P1-2 行为信号（轻量规则，非机器学习） ---------- */
    behaviorSignals: function () {
      var c = this.ctx, S = this;
      // 连续同主题展品数（从最近往前数）
      var run = 0, lastTopic = null;
      for (var i = c.visitedIds.length - 1; i >= 0; i--) {
        var t = S.ex(c.visitedIds[i]).topic;
        if (lastTopic === null || t === lastTopic) { run++; lastTopic = t; } else break;
      }
      return {
        visitMinutes: Math.round(S.consumed()),
        walkKm: Math.round((c.walkKm || 0) * 10) / 10,
        longContentSkipped: c.skippedIds.length,
        contentExpanded: c.expandedIds.length,
        consecutiveSimilarExhibits: run,
        explicitFeedback: c.adjustments.length
      };
    },
    addChatTopic: function (topicId) {
      if (!topicId) return;
      var arr = this.ctx.chatTopics || (this.ctx.chatTopics = []);
      if (arr.indexOf(topicId) < 0) arr.push(topicId);
    },

    topInterests: function (n) {
      n = n || 3;
      var arr = Object.keys(this.ctx.interests).map(function (k) {
        return { id: k, score: Math.round(Math.min(5, this[k]) * 10) / 10 };
      }, this.ctx.interests);
      arr.sort(function (a, b) { return b.score - a.score; });
      return arr.slice(0, n).filter(function (a) { return a.score > 0; });
    },
    markExpanded: function (id) {
      var c = this.ctx;
      if (c.expandedIds.indexOf(id) < 0) {
        c.expandedIds.push(id);
        this.addInterest(this.ex(id).topic, 1);
        this.refreshStates(); this.emit();
      }
    },

    /* ---------- 结束 ---------- */
    finishVisit: function () {
      this.ctx.finished = true;
      this.ctx.view = 'summary';
      this.refreshStates();
      this.emit();
    },
    leftoverPick: function () {
      // 从原路线中挑一件没看过、优先级最高、且与今日兴趣最相关的
      var S = this, best = null, bestScore = -1;
      this.ctx.originalRoute.concat(['E07','E17','E21']).forEach(function (id) {
        if (S.ctx.visitedIds.indexOf(id) >= 0) return;
        var e = S.ex(id);
        var sc = (e.priority || 1) * 2 + (S.ctx.interests[e.topic] || 0);
        if (sc > bestScore) { bestScore = sc; best = e; }
      });
      return best;
    }
  };

  window.Store = Store;
})();
