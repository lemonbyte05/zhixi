/* ============================================================
   知息 ZHI XI · 控制器
   路由 / 事件 / 对话流 / 重规划确认 / 演示时钟 / 记忆
   ============================================================ */
(function () {
  var $ = function (sel) { return document.querySelector(sel); };

  var App = {
    prevView: 'visit',
    pendingReplan: null,
    lastPropose: null,
    chatMsgs: [],
    _lastPace: null,
    W: { mode: null, time: null, customMin: null, interest: '' },

    boot: function () {
      Store.load();
      this.loadMemory();
      this.wire();
      setInterval(this.tick.bind(this), 1000);
      this.render();
    },

    /* ---------- 记忆（跨参观持久化，独立于单次 Context） ---------- */
    loadMemory: function () {
      try { window.ZX_MEMORY = JSON.parse(localStorage.getItem('zhixi_memory') || '{}'); } catch (e) { window.ZX_MEMORY = {}; }
    },
    saveMemory: function () {
      try { localStorage.setItem('zhixi_memory', JSON.stringify(window.ZX_MEMORY)); } catch (e) {}
    },

    /* ---------- 渲染 ---------- */
    render: function () {
      var v = Store.ctx.view, html = '';
      try {
        if (v === 'welcome') html = Views.welcome();
        else if (v === 'planning') html = Views.planning();
        else if (v === 'visit') html = Views.visit();
        else if (v === 'exhibit') html = Views.exhibit(this._exId || (Store.currentNext() ? Store.currentNext().ex.id : Store.ctx.locationExhibitId));
        else if (v === 'summary') html = Views.summary();
        else if (v === 'culture') html = Views.culture();
        else if (v === 'discover') html = Views.discover();
        else html = Views.mine();
      } catch (err) {
        console.error(err);
        html = '<div class="screen center-page"><h1 class="sum-hero">出了点小状况</h1><p class="sub">已经为你恢复，请继续。</p>' +
          '<button class="btn btn-primary" style="margin-top:18px" onclick="location.reload()">重新进入</button></div>';
      }
      $('#app').innerHTML = html;
      $('#app').firstChild && $('#app').firstChild.classList.add('fade-swap');
      // 兴趣条动画
      requestAnimationFrame(function () {
        document.querySelectorAll('.int-fill').forEach(function (el) { el.style.width = el.getAttribute('data-w') + '%'; });
      });
      this._lastPace = Store.ctx.pace;
      if (v === 'visit') {
        var c = Store.ctx;
        if (c.pace === 'tight' && !c.tightNoticed) { c.tightNoticed = true; Store.save(); }
        var top = Store.topInterests(1)[0];
        if (top && top.score >= 3 && !c.whisperShown) { c.whisperShown = true; Store.save(); }
      }
      if (v === 'visit') window._redraw = false;
    },
    go: function (view, params) {
      params = params || {};
      this._exId = params.exId || this._exId;
      Store.ctx.view = view;
      Store.emit();
    },

    /* ---------- Toast ---------- */
    toast: function (msg) {
      var t = $('#toast');
      t.innerHTML = '<div class="toast-pill">' + msg + '</div>';
      clearTimeout(this._tt);
      requestAnimationFrame(function () { t.firstChild.classList.add('show'); });
      this._tt = setTimeout(function () {
        var p = t.firstChild; if (p) p.classList.remove('show');
      }, 2200);
    },

    /* ---------- Sheet / Overlay ---------- */
    openSheet: function (html) {
      this.closeSheet(true);
      $('#sheet-layer').innerHTML = html;
      requestAnimationFrame(function () {
        var m = $('#sheet-mask'), s = $('.sheet');
        m && m.classList.add('show'); s && s.classList.add('show');
      });
      if ($('#chat-sheet')) this.initChat();
    },
    closeSheet: function (instant) {
      var m = $('#sheet-mask'), s = $('.sheet');
      if (!s) return;
      if (instant) { $('#sheet-layer').innerHTML = ''; return; }
      m && m.classList.remove('show'); s.classList.remove('show');
      setTimeout(function () { $('#sheet-layer').innerHTML = ''; }, 420);
    },
    showReplan: function (r) {
      this.pendingReplan = r;
      $('#overlay-layer').innerHTML = Views.replanOverlay(r);
      requestAnimationFrame(function () { $('#replan-mask').classList.add('show'); });
    },
    closeReplan: function () {
      var m = $('#replan-mask');
      if (!m) return;
      m.classList.remove('show');
      var self = this;
      setTimeout(function () { $('#overlay-layer').innerHTML = ''; self.pendingReplan = null; }, 400);
    },

    /* ---------- 对话 ---------- */
    initChat: function () {
      if (!this.chatMsgs.length) {
        var cur = Store.currentNext();
        var locName = Store.ctx.locationExhibitId ? '《' + Store.ex(Store.ctx.locationExhibitId).title + '》' : '大厅';
        this.chatMsgs.push({
          role: 'ai',
          text: '我在呢。你现在在' + locName + '附近，还剩 ' + Store.remaining() + ' 分钟。可以问我眼前这件文物的事，也可以直接告诉我你想怎么逛。'
        });
      }
      this.renderChat();
      var inp = $('#chat-input');
      inp && inp.focus();
    },
    renderChat: function (typing) {
      var box = $('#chat-msgs');
      if (!box) return;
      var self = this;
      box.innerHTML = this.chatMsgs.map(function (m) {
        if (m.role === 'user') return '<div class="msg user">' + Views.esc(m.text) + '</div>';
        var acts = '';
        if (m.actions) {
          acts = '<div class="chat-actions">' + m.actions.map(function (a) {
            return '<button class="' + a.cls + '" data-a="' + a.a + '">' + a.label + '</button>';
          }).join('') + '</div>';
        }
        var note = m.toolsNote ? '<div class="tiny" style="margin:-6px 0 10px 4px;opacity:.75">✦ ' + Views.esc(m.toolsNote) + '</div>' : '';
        return '<div class="msg ai"><div class="bubble">' + Views.esc(m.text).replace(/\n/g, '<br>') + '</div>' + note + acts + '</div>';
      }).join('') +
        (typing ? '<div class="msg ai"><span class="typing"><i></i><i></i><i></i></span></div>' : '');
      box.scrollTop = box.scrollHeight;
      var ctxEl = $('#chat-ctx');
      if (ctxEl) ctxEl.textContent = '还剩 ' + Store.remaining() + ' 分钟';
    },
    chatSend: function (text) {
      text = (text || '').trim();
      if (!text) return;
      var self = this;
      Store.ctx.chatCount++; Store.save();
      // P1-2/P1-4：对话中提到的主题进入兴趣上下文（供文创推荐与Agent使用）
      Object.keys(INTEREST_SEEDS).forEach(function (k) {
        if (text.indexOf(k) >= 0) { Store.addChatTopic(INTEREST_SEEDS[k]); Store.addInterest(INTEREST_SEEDS[k], 0.5); }
      });
      Store.save();
      this.chatMsgs.push({ role: 'user', text: text });
      this.chatMsgs.forEach(function (m) { delete m.actions; }); // 新消息后旧按钮失效
      this.renderChat(true);
      var inp = $('#chat-input'); if (inp) inp.value = '';

      Agent.chatAsync(text).then(function (r) {
        var m = { role: 'ai', text: r.reply };
        // 工具调用透明化：让"系统真的做了事"可感知，但不暴露技术细节
        if (r.toolCalls && r.toolCalls.length) {
          m.toolsNote = r.toolCalls.map(function (t) { return t.summary; }).slice(0, 3).join(' · ');
        }
        if (r.fallbackUsed) m.toolsNote = (m.toolsNote ? m.toolsNote + ' · ' : '') + '本地引擎';
        var na = r.nextAction;
        if ((na === 'show_exhibits') && r.proposedIds && r.proposedIds.length) {
          self.lastPropose = r;
          m.actions = [
            { label: '带我去看看', cls: 'ca-go', a: 'chat-go' },
            { label: '先继续这里', cls: 'ca-stay', a: 'chat-stay' }
          ];
        } else if (r.routeChanged && r.newRoute || na === 'replan' || na === 'wrap_up') {
          self.chatMsgs.push(m); self.renderChat(false);
          Agent.applyResult(Object.assign({}, r)); // 应用休息/内容模式等即时副作用
          setTimeout(function () { self.showReplan(r); }, 500);
          return;
        } else {
          Agent.applyResult(r);
          if (na === 'light_mode' || r.intent === 'content_mode') self.toast('已为你切换：轻量模式 ☁️');
        }
        self.chatMsgs.push(m);
        self.renderChat(false);
      });
    },

    /* ---------- 统一意图入口（调整面板/自然语言） ---------- */
    runIntent: function (text) {
      var self = this;
      var r = Agent.think(text);
      if (r.routeChanged && r.newRoute) {
        this.closeSheet();
        setTimeout(function () { self.showReplan(r); }, 200);
        return;
      }
      Agent.applyResult(r);
      if (r.intent === 'content_mode') {
        this.toast('已切换：少讲一点 ☁️');
        this.closeSheet(); this.render();
      } else {
        this.toast('好，保持现在的节奏');
        this.closeSheet();
      }
    },

    /* ---------- 规划入口 ---------- */
    planFromWelcome: function () {
      var W = this.W;
      var c = Store.ctx;
      var minutes = W.time === 'custom' ? (parseInt(W.customMin, 10) || 60) : (W.time || 90);
      var mode = W.mode || 'slow';
      var interest = (W.interest || '').trim();

      // 兴趣种子
      var seeds = [];
      Object.keys(INTEREST_SEEDS).forEach(function (k) {
        if (interest.indexOf(k) >= 0 && seeds.indexOf(INTEREST_SEEDS[k]) < 0) seeds.push(INTEREST_SEEDS[k]);
      });

      // P1-3 初始路线：走 Agent/PlanningTool 真实规划（知识候选池 + 加权贪心 + 顺路重排）
      var plan = Agent.buildInitialPlan({ minutes: minutes, mode: mode, seedTopics: seeds });
      var route = plan.ids.slice();

      Object.assign(c, {
        entryMode: mode, totalMinutes: minutes,
        interestSeed: interest, seedTopics: seeds,
        route: route, view: 'planning'
      });
      Store.refreshStates();
      Store.save();
      this.render();
      // 阶段化展示
      var self = this;
      setTimeout(function () {
        var el = $('#plan-summary');
        if (el) { el.style.display = 'block'; el.classList.add('rise'); el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      }, 2400);
    },

    startVisitRoute: function (extraFirstId) {
      var route = Store.ctx.route.slice();
      if (extraFirstId && route.indexOf(extraFirstId) < 0) route.unshift(extraFirstId);
      Store.startVisit(route);
      Store.ctx.view = 'visit';
      Store.save();
      this.chatMsgs = [];
      this.render();
      this.toast('路线开始了，跟着下一站走就好');
    },

    /* ---------- HUD 增量更新 ---------- */
    updateHud: function () {
      var el = $('#hud-min');
      if (!el) return;
      var rem = Store.remaining(), C = 2 * Math.PI * 23;
      el.textContent = rem;
      var arc = document.querySelector('.ring .arc');
      if (arc) arc.setAttribute('stroke-dashoffset', C * Math.max(0, 1 - rem / Store.ctx.totalMinutes));
      var pl = $('#hud-pace');
      if (pl) pl.textContent = Store.paceLabel();
      var head = document.querySelector('.visit-head');
      if (head) head.setAttribute('data-pace', Store.ctx.pace);
    },

    tick: function () {
      var c = Store.ctx;
      if (!c.startedAt || c.finished) return;
      Store.tickAmbient(1);
      if (Store.remaining() <= 0) {
        this.toast('时间到了，我帮你收尾');
        Store.finishVisit();
        this.render();
        return;
      }
      this.updateHud();
      if ((c.view === 'visit') && c.pace !== this._lastPace) this.render();
    },

    /* ---------- 事件绑定 ---------- */
    wire: function () {
      var self = this;
      document.getElementById('phone').addEventListener('click', function (ev) {
        var el = ev.target.closest('[data-a]');
        if (!el) return;
        self.action(el.getAttribute('data-a'), el);
      });
      document.getElementById('phone').addEventListener('input', function (ev) {
        var id = ev.target.id;
        if (id === 'w-interest') self.W.interest = ev.target.value;
        if (id === 'w-custom-min') self.W.customMin = ev.target.value;
      });
      document.getElementById('phone').addEventListener('keydown', function (ev) {
        if (ev.key !== 'Enter') return;
        if (ev.target.id === 'chat-input') { self.chatSend(ev.target.value); }
        else if (ev.target.id === 'adjust-input') { self.runIntent(ev.target.value); }
        else if (ev.target.id === 'w-interest') { ev.target.blur(); }
        else if (ev.target.id === 'w-custom-min') { ev.target.blur(); }
      });
      window.addEventListener('error', function () { /* 保底不白屏 */ });
    },

    action: function (a, el) {
      var c = Store.ctx, self = this;
      switch (a) {
        /* ----- Welcome ----- */
        case 'w-mode': this.W.mode = el.getAttribute('data-v'); this.render(); break;
        case 'w-time': this.W.time = parseInt(el.getAttribute('data-v'), 10); this.render(); break;
        case 'w-time-custom': this.W.time = 'custom'; this.render(); break;
        case 'w-none':
          this.W.interest = ''; this.render();
          setTimeout(function () { var i = $('#w-interest'); i && i.blur(); }, 0);
          break;
        case 'w-plan': this.planFromWelcome(); break;
        case 'resume-story': {
          var pid = window.ZX_MEMORY.pendingContinue;
          window.ZX_MEMORY.pendingContinue = null; this.saveMemory();
          this.W.mode = 'slow'; this.W.time = Store.ctx.totalMinutes || 90; this.W.interest = '';
          var c2 = Store.ctx;
          c2.entryMode = 'slow'; c2.seedTopics = ['bronze']; c2.interestSeed = '';
          c2.route = DEFAULT_ROUTE.filter(function (id) { return id !== pid; });
          Store.ctx.view = 'planning';
          Store.save(); this.render();
          this._resumePid = pid;
          setTimeout(function () {
            var s = $('#plan-summary');
            if (s) { s.style.display = 'block'; s.classList.add('rise'); }
          }, 1400);
          break;
        }
        case 'dismiss-memory': window.ZX_MEMORY.pendingContinue = null; this.saveMemory(); this.render(); break;

        /* ----- Planning ----- */
        case 'start-visit': this.startVisitRoute(this._resumePid); this._resumePid = null; break;
        case 'back-welcome': Store.patch({ view: 'welcome' }); break;

        /* ----- Visit ----- */
        case 'tab': Store.patch({ view: el.getAttribute('data-v') }); break;
        case 'open-current': {
          var cu = Store.currentNext();
          if (cu) { this.prevView = 'visit'; this.go('exhibit', { exId: cu.ex.id }); }
          break;
        }
        case 'start-looking': {
          var cu2 = Store.currentNext();
          if (cu2) { this.prevView = 'visit'; this.go('exhibit', { exId: cu2.ex.id }); }
          break;
        }
        case 'open-ex': {
          this.prevView = (c.view === 'visit') ? 'visit' : this.prevView;
          this.go('exhibit', { exId: el.getAttribute('data-id') });
          break;
        }
        case 'open-ex-preview': this.prevView = 'discover'; this.go('exhibit', { exId: el.getAttribute('data-id') }); break;
        case 'back': this.go(['welcome', 'summary', 'culture'].indexOf(c.view) >= 0 ? 'visit' : (this.prevView === 'discover' && c.visitedIds.length ? 'discover' : (c.startedAt && !c.finished ? 'visit' : 'welcome'))); break;

        case 'end-visit': Store.finishVisit(); this.render(); break;
        case 'open-adjust': this.openSheet(Views.adjustSheet()); break;

        case 'whisper-go': {
          var r = Agent.think('我还想看看类似的');
          if (r.proposedIds && r.proposedIds.length) {
            var rr = Agent.applyResult(Object.assign({}, r, { intent: 'propose_add' }), { accept: true });
            window._redraw = true; this.toast('已把相关展品排进后半程'); this.render();
            if (rr.routeChanged) {} // 已应用
          } else { this.toast('后面的路线已经覆盖这个方向啦'); }
          c.whisperShown = true; Store.save(); this.render();
          break;
        }
        case 'whisper-dismiss': c.whisperShown = true; Store.save(); this.render(); break;

        /* ----- Exhibit ----- */
        case 'fold': {
          var f = document.getElementById(el.getAttribute('data-t'));
          if (f) {
            f.classList.toggle('open');
            if (f.classList.contains('open')) {
              var exId = this._exId || (Store.currentNext() && Store.currentNext().ex.id);
              if (exId) Store.markExpanded(exId);
              f.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }
          break;
        }
        case 'expand-detail': {
          var fd = document.getElementById('fold-detail');
          if (fd && !fd.classList.contains('open')) fd.classList.add('open');
          if (this._exId) Store.markExpanded(this._exId);
          break;
        }
        case 'toggle-light': {
          var toLight = c.contentMode !== 'light';
          c.contentMode = toLight ? 'light' : 'normal';
          c.infoLoad = toLight ? 'light' : 'normal';
          c.adjustments.push({ at: Date.now(), kind: 'content', note: toLight ? '切换轻量模式' : '恢复完整讲解' });
          Store.refreshStates(); Store.emit();
          this.toast(toLight ? '轻量模式：每件只讲一句 ☁️' : '已恢复完整讲解');
          break;
        }
        case 'add-to-route': {
          var id = el.getAttribute('data-id');
          if (c.route.indexOf(id) < 0) { c.route.push(id); Store.save(); }
          this.toast('已加入你的路线'); this.render();
          break;
        }
        case 'skip-this': {
          var cuS = Store.currentNext();
          if (!cuS || this._exId === cuS.ex.id) { Store.completeCurrent({ skip: true }); this.go('visit'); this.autoCheckin(); }
          else this.go('visit');
          break;
        }
        case 'complete-this': {
          var cuC = Store.currentNext();
          if (!cuC || this._exId === cuC.ex.id) { Store.completeCurrent(); this.go('visit'); this.autoCheckin(); }
          else this.go('visit');
          break;
        }

        case 'open-chat': {
          this.openSheet(Views.chatSheet());
          break;
        }
        case 'close-sheet': this.closeSheet(); break;
        case 'chat-sugg': this.chatSend(el.textContent); break;
        case 'chat-send': { var ci = $('#chat-input'); this.chatSend(ci ? ci.value : ''); break; }
        case 'chat-go': {
          if (this.lastPropose) {
            var applied = Agent.applyResult(this.lastPropose, { accept: true });
            this.lastPropose = null;
            this.closeSheet();
            if (applied.routeChanged) {
              window._redraw = true;
              this.prevView = 'visit';
              this.go('visit');
              this.toast('新路线已排好，下一站就是它 ✦');
            } else { this.toast('它已经在你的路线上啦'); }
          }
          break;
        }
        case 'chat-stay': {
          this.chatMsgs.push({ role: 'ai', text: '好，那先把这件看完。想看的时候随时叫我。' });
          this.renderChat(false);
          break;
        }

        /* ----- 调整面板 ----- */
        case 'adj-fatigue': this.runIntent('我有点累，慢一点'); break;
        case 'adj-light': this.runIntent('信息有点多，少讲一点'); break;
        case 'adj-highlight': this.runIntent('只看重点'); break;
        case 'adj-keep': this.runIntent('我还可以继续'); break;
        case 'adj-time-20': this.runIntent('我只剩20分钟了'); break;
        case 'adj-time-more': {
          c.totalMinutes += 30; Store.refreshStates();
          this.closeSheet();
          this.toast('好，我多留了 30 分钟，要不要再加一两件？');
          var sug = Agent.think('我还想看看类似的');
          if (sug.proposedIds && sug.proposedIds.length) {
            this.lastPropose = sug;
            this.openSheet(Views.chatSheet());
            this.chatMsgs.push({ role: 'ai', text: sug.reply, actions: [
              { label: '带我去看看', cls: 'ca-go', a: 'chat-go' },
              { label: '先继续这里', cls: 'ca-stay', a: 'chat-stay' }] });
            this.renderChat(false);
          }
          break;
        }
        case 'adj-send': { var ai2 = $('#adjust-input'); this.runIntent(ai2 ? ai2.value : ''); break; }

        /* ----- Replan ----- */
        case 'replan-ok': {
          var p = this.pendingReplan;
          if (p) {
            Agent.applyResult(Object.assign({}, p, { newRoute: p.newRoute }), {});
            window._redraw = true;
          }
          this.closeReplan(); this.closeSheet();
          this.render();
          this.toast('已按新计划继续 ✦');
          break;
        }
        case 'replan-cancel': {
          this.closeReplan();
          this.toast('好，还是按原计划走');
          break;
        }

        /* ----- Summary / Culture ----- */
        case 'save-continue': {
          var left = Store.leftoverPick();
          if (left) { window.ZX_MEMORY.pendingContinue = left.id; this.saveMemory(); }
          this.go('culture'); break;
        }
        case 'to-culture': this.go('culture'); break;
        case 'wish': {
          var wid = el.getAttribute('data-id');
          var arr = c.wishedProducts, ix = arr.indexOf(wid);
          if (ix < 0) arr.push(wid); else arr.splice(ix, 1);
          Store.save(); this.render();
          if (ix < 0) this.toast('已收下这份心意 ♥');
          break;
        }
        case 'finish-all': {
          window.ZX_MEMORY.lastInterests = Store.topInterests(3);
          window.ZX_MEMORY.lastProducts = c.wishedProducts.slice();
          this.saveMemory();
          var keptPending = window.ZX_MEMORY.pendingContinue;
          var keptWish = c.wishedProducts.slice();
          Store.reset();
          c.wishedProducts = keptWish;
          window.ZX_MEMORY.pendingContinue = keptPending;
          this.saveMemory();
          this.render();
          this.toast('期待下次，你的兴趣线索已保存');
          break;
        }

        /* ----- Mine ----- */
        case 'reset-demo':
          try { localStorage.removeItem('zhixi_ctx_v1'); localStorage.removeItem('zhixi_memory'); } catch (e) {}
          window.ZX_MEMORY = {};
          this.chatMsgs = []; this.W = { mode: null, time: null, customMin: null, interest: '' };
          Store.load(); this.render();
          this.toast('已重置为初次体验');
          break;
      }
    },

    /* 参观到第3件后的自然节点关怀 */
    autoCheckin: function () {
      var c = Store.ctx;
      if (c.visitedIds.length === 3 && !c.checkinDone && Store.remaining() > 8) {
        c.checkinDone = true; Store.save();
        var self = this;
        setTimeout(function () { if (!c.finished) self.openSheet(Views.checkinSheet()); }, 700);
      }
    }
  };

  window.App = App;
  document.addEventListener('DOMContentLoaded', function () { App.boot(); });
})();
