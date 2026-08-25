/* ============================================================
   知息 ZHI XI · 视图层
   全部页面模板 + 极简博物馆空间地图 + 展品线描图鉴
   ============================================================ */
(function () {

  var V = window.Views = {};

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function topicName(t) { return MUSEUMS[Store.ctx.museumId].topics[t] ? MUSEUMS[Store.ctx.museumId].topics[t].name : t; }

  /* ================= 展品图鉴：线描器物 ================= */
  var GALLERY_BG = {
    g_bronze: ['#20241C', '#3A3620'],
    g_ceramic: ['#332720', '#5A4128'],
    g_han: ['#292521', '#4A443A'],
    g_buddha: ['#2B2D30', '#53565C'],
    g_arch: ['#221E19', '#40372C'],
    g_luwang: ['#2C1C19', '#512F26']
  };
  var ICONS = {
    yue: '<path d="M28 20 h44 v30 q0 26 -22 38 q-22 -12 -22 -38 z"/><circle cx="41" cy="42" r="4.5"/><circle cx="59" cy="42" r="4.5"/><path d="M37 58 q13 11 26 0"/>',
    ding: '<path d="M34 32 v-9 h9 v9"/><path d="M57 32 v-9 h9 v9"/><path d="M30 32 h40 v20 q0 15 -20 19 q-20 -4 -20 -19 z"/><path d="M38 71 l-4 13"/><path d="M50 73 v13"/><path d="M62 71 l4 13"/>',
    gui: '<path d="M27 40 h46 v10 q0 17 -23 19 q-23 -2 -23 -19 z"/><path d="M27 43 h-7"/><path d="M73 43 h7"/><path d="M39 71 h22 v8 h-22 z"/><path d="M34 50 h32" opacity=".55"/>',
    jue: '<path d="M36 54 h28"/><path d="M38 54 l-4 16 h32 l-4 -16"/><path d="M36 54 l-14 -7"/><path d="M64 54 l13 -5"/><path d="M40 74 l-3 12"/><path d="M50 76 v12"/><path d="M60 74 l3 12"/><path d="M42 47 h4 M54 47 h4" opacity=".6"/>',
    zun: '<path d="M34 38 h32 q7 18 -4 30 q-12 8 -24 0 q-11 -12 -4 -30 z"/><path d="M40 38 q10 -8 20 0"/><path d="M30 46 q-6 4 -4 10"/><path d="M70 46 q6 4 4 10"/>',
    bell: '<path d="M36 28 h28 q5 24 -2 36 q-12 7 -24 0 q-7 -12 -2 -36 z"/><path d="M46 28 v-7 h8 v7"/><path d="M38 70 v6 M62 70 v6"/><path d="M50 38 v16" opacity=".5"/>',
    hu: '<path d="M40 24 h20 v8"/><path d="M60 32 q12 8 10 22 q-2 18 -20 22 q-18 -4 -20 -22 q-2 -14 10 -22"/><path d="M40 24 h20" /><path d="M36 48 h28" opacity=".5"/>',
    mirror: '<circle cx="50" cy="50" r="30"/><circle cx="50" cy="50" r="8"/><path d="M50 20 v14 M50 66 v14 M20 50 h14 M66 50 h14" opacity=".55"/>',
    eggcup: '<path d="M38 28 h24 q3 12 -5 18 h-14 q-8 -6 -5 -18 z"/><path d="M47 46 h6 v24 h-6 z"/><path d="M36 74 h28 v5 h-28 z"/>',
    beast: '<ellipse cx="52" cy="52" rx="24" ry="17"/><circle cx="33" cy="46" r="9"/><path d="M26 44 l-6 -3 M26 50 l-6 2"/><path d="M40 68 v9 M62 68 v9"/><path d="M70 48 q6 -2 6 4" opacity=".6"/>',
    li: '<path d="M42 30 h16 v10"/><path d="M42 40 q-16 4 -14 20 q2 14 12 16 q6 -2 6 -12 q0 -10 -4 -14"/><path d="M58 40 q16 4 14 20 q-2 14 -12 16 q-6 -2 -6 -12 q0 -10 4 -14"/><path d="M50 40 q-6 16 0 30 q6 -14 0 -30"/>',
    pen: '<path d="M32 34 h36 q4 22 -4 34 q-14 8 -24 0 q-8 -12 -4 -34 z"/><path d="M30 48 q20 8 40 0" opacity=".6"/><path d="M31 58 q19 8 38 0" opacity=".4"/><path d="M40 34 v-6 h20 v6"/>',
    slips: '<path d="M34 22 v56 M44 20 v60 M54 20 v60 M64 22 v56"/><path d="M30 36 h40 M30 52 h40 M30 66 h40"/>',
    bone: '<path d="M30 26 q22 -6 40 4 q4 22 -6 44 q-20 4 -34 -6 q-4 -22 0 -42 z"/><path d="M50 30 v18 M50 48 l-8 14 M50 48 l9 12" opacity=".7"/><path d="M38 34 q10 -4 24 0" opacity=".45"/>',
    sword: '<path d="M24 76 L64 36"/><path d="M60 26 l14 14 -10 10 -14 -14 z"/><path d="M56 44 l-8 -8"/><path d="M28 72 l-6 10 10 -6" opacity=".7"/>',
    mural: '<rect x="24" y="22" width="52" height="56" rx="3"/><circle cx="40" cy="40" r="6"/><path d="M40 46 v18 M34 52 h12"/><circle cx="61" cy="42" r="6"/><path d="M61 48 v18 M55 54 h12"/><path d="M24 30 q26 -8 52 0" opacity=".4"/>',
    buddha: '<circle cx="50" cy="34" r="9"/><circle cx="50" cy="34" r="15" opacity=".4"/><path d="M38 78 q0 -26 12 -30 q12 4 12 30 z"/><path d="M38 56 l-8 8 M62 56 l8 8" opacity=".6"/>',
    crown: '<path d="M32 34 h36 v8 h-36 z"/><path d="M36 34 q14 -12 28 0"/><path d="M36 42 v6 M44 42 v6 M56 42 v6 M64 42 v6"/><circle cx="36" cy="51" r="2"/><circle cx="44" cy="51" r="2"/><circle cx="56" cy="51" r="2"/><circle cx="64" cy="51" r="2"/><path d="M40 66 h20 v8 h-20 z" opacity=".6"/>',
    box: '<rect x="26" y="38" width="48" height="34" rx="6"/><path d="M26 48 h48"/><rect x="44" y="44" width="12" height="8" rx="2"/><path d="M32 56 h10 M58 56 h10" opacity=".45"/>',
    cloth: '<path d="M28 34 q22 -10 44 0 q-22 8 -44 0z"/><path d="M28 46 q22 -10 44 0 q-22 8 -44 0z" opacity=".75"/><path d="M28 58 q22 -10 44 0 q-22 8 -44 0z" opacity=".5"/><path d="M28 70 q22 -10 44 0 q-22 8 -44 0z" opacity=".3"/>',
    bookmark: '<path d="M36 22 h28 v56 l-14 -12 -14 12 z"/><path d="M42 38 q8 -8 16 0" opacity=".6"/><path d="M42 48 q8 -8 16 0" opacity=".35"/>',
    notebook: '<rect x="30" y="22" width="40" height="56" rx="5"/><path d="M38 22 v56"/><path d="M46 38 h16 M46 48 h16" opacity=".55"/>',
    booklet: '<rect x="28" y="26" width="34" height="48" rx="4"/><rect x="38" y="32" width="34" height="48" rx="4"/><path d="M46 46 h18 M46 54 h18" opacity=".5"/>',
    cards: '<rect x="28" y="30" width="30" height="42" rx="4" transform="rotate(-8 43 51)"/><rect x="44" y="30" width="30" height="42" rx="4" transform="rotate(6 59 51)"/><circle cx="59" cy="48" r="8" opacity=".55"/>'
  };
  var _artSeq = 0;
  V.artSvg = function (ex, opts) {
    opts = opts || {};
    _artSeq++;
    var uid = 'a' + _artSeq;
    var bg = GALLERY_BG[ex.gallery] || ['#2A2620', '#463E30'];
    var icon = ICONS[ex.kind] || ICONS.ding;
    var h = opts.h || 300;
    return '' +
      '<svg class="art" viewBox="0 0 360 ' + h + '" preserveAspectRatio="xMidYMid slice">' +
      '<defs>' +
      '<radialGradient id="' + uid + 'g" cx="50%" cy="38%" r="85%">' +
      '<stop offset="0%" stop-color="' + bg[1] + '"/><stop offset="100%" stop-color="' + bg[0] + '"/></radialGradient>' +
      '<pattern id="' + uid + 'p" width="34" height="34" patternUnits="userSpaceOnUse">' +
      '<path d="M4 30 v-22 h10 v10 h-6 M17 30 h13 M30 17 v13" fill="none" stroke="rgba(214,183,122,.07)" stroke-width="1.4"/>' +
      '</pattern></defs>' +
      '<rect width="360" height="' + h + '" fill="url(#' + uid + 'g)"/>' +
      '<rect width="360" height="' + h + '" fill="url(#' + uid + 'p)"/>' +
      '<circle cx="180" cy="' + (h * 0.44) + '" r="96" fill="none" stroke="rgba(220,190,130,.14)" stroke-width="1"/>' +
      '<circle cx="180" cy="' + (h * 0.44) + '" r="108" fill="none" stroke="rgba(220,190,130,.07)" stroke-width="1"/>' +
      '<g transform="translate(105,' + (h * 0.44 - 75) + ') scale(1.5)" fill="none" stroke="#D9BE8C" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
      icon + '</g>' +
      '<text x="180" y="' + (h - 26) + '" text-anchor="middle" font-size="12" letter-spacing="6" fill="rgba(222,198,148,.55)">' + esc(ex.period.split('（')[0]) + '</text>' +
      '</svg>';
  };
  V.thumbSvg = function (ex) { return V.artSvg(ex, { h: 120 }); };

  /* ================= 地图 ================= */
  V.mapSvg = function () {
    var M = Store.museum(), c = Store.ctx;
    var s = [];
    s.push('<svg class="map-svg" viewBox="0 0 ' + M.map.w + ' ' + M.map.h + '">');
    // 展厅
    Object.keys(M.galleries).forEach(function (gid) {
      var g = M.galleries[gid], r = g.rect;
      s.push('<rect x="' + r[0] + '" y="' + r[1] + '" width="' + r[2] + '" height="' + r[3] + '" rx="15" class="g-rect"/>');
      s.push('<text x="' + (r[0] + 9) + '" y="' + (r[1] + 15) + '" class="g-label">' + esc(g.floor + '·' + g.name) + '</text>');
    });
    // 大厅
    s.push('<circle cx="' + M.lobby.x + '" cy="' + M.lobby.y + '" r="24" class="lobby-shape"/>');
    s.push('<text x="' + M.lobby.x + '" y="' + (M.lobby.y + 3) + '" text-anchor="middle" class="g-label">入口</text>');
    // 参观路线（当前位置 → 未看各站）
    var upcoming = c.route.filter(function (id) {
      return c.visitedIds.indexOf(id) < 0 && c.skippedIds.indexOf(id) < 0;
    });
    var pts = [], prevPos = Store.posOf(c.locationExhibitId ? Store.ex(c.locationExhibitId) : { lobby: true });
    pts.push(prevPos.x + ',' + prevPos.y);
    upcoming.forEach(function (id) { var p = Store.posOf(Store.ex(id)); pts.push(p.x + ',' + p.y); });
    if (pts.length > 1) {
      s.push('<polyline points="' + pts.join(' ') + '" class="route-path' + (window._redraw ? ' route-redraw' : '') + '"/>');
    }
    // 站点圆点
    var shown = 0;
    upcoming.forEach(function (id, i) {
      var e = Store.ex(id), p = Store.posOf(e);
      var cls = i === 0 ? 'dot-next' : 'dot-todo';
      var op = i > 2 ? '.32' : '1';
      s.push('<g class="ex-dot" data-a="open-ex" data-id="' + id + '" opacity="' + op + '">');
      if (i === 0) s.push('<circle cx="' + p.x + '" cy="' + p.y + '" r="6" class="pulse-ring"/>');
      s.push('<circle cx="' + p.x + '" cy="' + p.y + '" r="' + (i === 0 ? 6.5 : 5) + '" class="' + cls + '"/>');
      if (i < 3) s.push('<text x="' + p.x + '" y="' + (p.y - 10) + '" text-anchor="middle" class="ex-label">' + (shown + 1) + '·' + esc(e.title.length > 5 ? e.title.slice(0, 5) : e.title) + '</text>');
      s.push('</g>');
      shown++;
    });
    // 已看过的小点
    c.visitedIds.forEach(function (id) {
      var p = Store.posOf(Store.ex(id));
      s.push('<circle cx="' + p.x + '" cy="' + p.y + '" r="3.6" class="dot-done" opacity=".8"/>');
    });
    // 我在这里
    var me = Store.posOf(c.locationExhibitId ? Store.ex(c.locationExhibitId) : { lobby: true });
    s.push('<circle cx="' + me.x + '" cy="' + me.y + '" r="5.5" class="me-dot" stroke="#FAF7F1" stroke-width="2"/>');
    s.push('</svg>');
    return s.join('');
  };

  /* ================= 通用部件 ================= */
  function stars(score) {
    var full = Math.round(Math.min(5, score));
    return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full);
  }
  function intBars(list) {
    if (!list.length) return '<p class="tiny" style="padding:6px 2px">兴趣正在形成中，继续逛一逛。</p>';
    return list.map(function (it) {
      var pct = Math.min(100, it.score / 5 * 100);
      return '<div class="int-bar"><div class="ib-head"><b>' + topicName(it.id) + '</b><span class="int-stars">' + stars(it.score) + '</span></div>' +
        '<div class="int-track"><div class="int-fill" data-w="' + pct + '"></div></div></div>';
    }).join('');
  }
  function brandRow() {
    return '<div class="brand-row"><div class="brand-seal">知</div><span class="h-brand">知息 ZHI XI</span></div>';
  }
  function tabbar(active) {
    function t(name, label, path) {
      return '<button data-a="tab" data-v="' + name + '"' + (active === name ? ' class="on"' : '') + '>' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">' + path + '</svg>' + label + '</button>';
    }
    return '<nav class="tabbar">' +
      t('visit', '参观', '<circle cx="12" cy="10" r="7"/><path d="M9 10h6M12 7v6M5 21l7-4 7 4"/>') +
      t('discover', '发现', '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>') +
      t('mine', '我的', '<circle cx="12" cy="8" r="4"/><path d="M4 21q8-9 16 0"/>') +
      '</nav>';
  }
  function srcTag(ex) {
    return ex.source === 'public'
      ? '<span class="tag tag-sage">公开资料整理</span>'
      : '<span class="tag tag-orange">Demo模拟数据</span>';
  }

  /* ================= Welcome ================= */
  var W = { mode: null, time: null, interest: '' };
  V.welcome = function () {
    var mem = window.ZX_MEMORY || {};
    var modes = [
      { v: 'slow', ico: '🌿', b: '慢慢看', s: '不赶时间，想认真感受。' },
      { v: 'efficient', ico: '⚡', b: '高效一点', s: '时间有限，帮我挑最值得看的。' },
      { v: 'theme', ico: '🎯', b: '只看喜欢的', s: '我已经有明确主题。' },
      { v: 'family', ico: '👨‍👩‍👧', b: '一起轻松逛', s: '带家人，希望大家都舒服。' }
    ];
    var times = [30, 60, 90];
    var html = '<div class="screen welcome scroll">' +
      brandRow() +
      '<h1>今天，<em>想怎么逛？</em></h1>' +
      '<p class="slogan">不赶着逛，也不怕错过。</p>' +
      '<div class="mode-grid rise d1">' + modes.map(function (m) {
        return '<button class="mode-card' + (W.mode === m.v ? ' on' : '') + '" data-a="w-mode" data-v="' + m.v + '">' +
          '<span class="ico">' + m.ico + '</span><b>' + m.b + '</b><span>' + m.s + '</span></button>';
      }).join('') + '</div>';

    html += '<p class="q-label rise d2">今天有多少时间？</p>' +
      '<div class="pill-row rise d2">' + times.map(function (t) {
        return '<button class="pill' + (W.time === t ? ' on' : '') + '" data-a="w-time" data-v="' + t + '">' + t + '分钟</button>';
      }).join('') +
      '<button class="pill' + (W.time && times.indexOf(W.time) < 0 ? ' on' : '') + '" data-a="w-time-custom">自定义</button>' +
      '</div>';
    if (W.time === 'custom') {
      html += '<div class="input-wrap rise d2" style="margin-bottom:22px"><input id="w-custom-min" type="number" min="15" max="240" placeholder="输入分钟数，比如 45" value="' + (W.customMin || '') + '"></div>';
    }

    html += '<p class="q-label rise d3">今天更想看什么？</p>' +
      '<div class="input-wrap rise d3"><input id="w-interest" placeholder="比如：青铜器" value="' + esc(W.interest) + '">' +
      '<button class="chip' + (W.interest === '' ? ' on' : '') + '" data-a="w-none">暂时不知道</button></div>' +
      '<p class="tiny rise d3" style="margin:6px 2px 26px">不知道从哪里开始，也没关系。</p>' +
      '<button class="btn btn-primary rise d4" data-a="w-plan">开始规划</button>' +
      '<p class="demo-note rise d5">样板场景：山东博物馆 · Demo 模拟数据<br>自适应参观引擎 v2.1 · Agent LLM 已连接</p>';

    if (mem.pendingContinue && EX_INDEX[mem.pendingContinue]) {
      var pe = EX_INDEX[mem.pendingContinue];
      html += '<div class="resume-card rise d5"><b>未完待续</b>' +
        '<p class="sub" style="margin:6px 0 12px">上次留下的那件「' + esc(pe.title) + '」，还想继续吗？</p>' +
        '<div style="display:flex;gap:10px">' +
        '<button class="btn btn-primary" style="padding:11px;font-size:13.5px" data-a="resume-story">继续上次的故事</button>' +
        '<button class="btn btn-ghost" style="padding:11px;font-size:13.5px" data-a="dismiss-memory">今天换个主题</button>' +
        '</div></div>';
    }
    html += '</div>';
    return html;
  };

  /* ================= Planning ================= */
  V.planning = function () {
    var st = Store.routeStats(Store.ctx.route);
    var stops = Store.ctx.route.map(function (id, i) {
      var e = Store.ex(id);
      var walk = i === 0 ? Store.legWalk(null, id) : Store.legWalk(Store.ctx.route[i - 1], id);
      var row = '<div class="stop-row"><div class="stop-num">' + (i + 1) + '</div>' +
        '<div class="stop-info"><b>' + esc(e.title) + '</b><span>' + esc(e.period) + ' · 建议 ' + e.stay + ' 分钟</span></div></div>';
      if (i > 0 || walk >= 1) row += '<div class="walk-line">步行约 ' + walk + ' 分钟</div>';
      return row;
    }).join('');
    var galCount = {};
    Store.ctx.route.forEach(function (id) { galCount[Store.ex(id).gallery] = 1; });
    return '<div class="screen planning scroll">' +
      brandRow() +
      '<h1 class="h-serif" style="font-size:26px;margin-bottom:4px">我在为你安排今天的路线</h1>' +
      '<p class="sub">依据你的时间、节奏和兴趣来定。</p>' +
      '<div class="plan-steps" id="plan-steps">' +
      ['了解你的时间和偏好', '匹配青铜主题的核心展品', '按展厅位置排顺路', '核对每站的停留时长'].map(function (t, i) {
        return '<div class="plan-step" style="animation-delay:' + (i * 0.55 + 0.1) + 's"><span class="dot"></span>' + t + '</div>';
      }).join('') +
      '</div>' +
      '<div class="card plan-summary" id="plan-summary" style="display:none">' +
      '<p class="tag tag-gold">初始参观计划 · Demo模拟数据</p>' +
      '<p class="ps-title" style="margin-top:10px">青铜器主题线</p>' +
      '<p class="tiny">第一次来 · 慢慢看 · 不赶时间</p>' +
      '<div class="stat-grid">' +
      '<div><b>' + Store.ctx.route.length + '</b><span>核心展品</span></div>' +
      '<div><b>' + Object.keys(galCount).length + '</b><span>个展厅</span></div>' +
      '<div><b>' + st.km.toFixed(1) + '</b><span>公里步行</span></div>' +
      '<div><b>' + st.stayMin + '</b><span>分钟讲解</span></div>' +
      '</div>' +
      '<div class="divider"></div>' + stops +
      '<div style="margin-top:18px;display:flex;gap:10px">' +
      '<button class="btn btn-primary" data-a="start-visit">开始参观</button>' +
      '<button class="btn btn-ghost" style="flex:none;width:auto;padding:15px 18px" data-a="back-welcome">返回调整</button>' +
      '</div></div></div>';
  };

  /* ================= Visit 主页 ================= */
  V.visit = function () {
    var c = Store.ctx, rem = Store.remaining();
    var C = 2 * Math.PI * 23;
    var pct = Math.max(0, Math.min(1, rem / c.totalMinutes));
    var cur = Store.currentNext();
    var done = c.visitedIds.length;

    var html = '<div class="screen">' +
      /* 头部 HUD */
      '<div class="visit-head" data-pace="' + c.pace + '">' +
      '<div class="hud-time"><div class="ring">' +
      '<span class="breath"></span>' +
      '<svg viewBox="0 0 52 52"><circle class="arc-bg" cx="26" cy="26" r="23" stroke-width="2.5"/>' +
      '<circle class="arc" cx="26" cy="26" r="23" stroke-width="3" stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - pct)) + '"/></svg>' +
      '<div class="ring-inner"><b id="hud-min">' + rem + '</b><i>剩余分钟</i></div></div>' +
      '<div class="pace-chip"><em>当前节奏</em><b id="hud-pace">' + Store.paceLabel() + '</b></div></div>' +
      '<div class="spacer"></div>' +
      '<button class="end-btn" data-a="end-visit">结束参观</button>' +
      '</div>';

    /* 轻提示区 */
    if (c.pace === 'tight' && !c.tightNoticed) {
      html += '<div class="soft-banner orange">时间比想象中紧一些。<b>要不要只看剩下的重点？</b>点下面"调整一下"告诉我就好。</div>';
    }

    /* 地图 */
    html += '<div class="card map-card">' +
      '<div class="map-cap"><span>馆内平面示意 · 只显示你的路线</span>' +
      '<span class="legend"><span><i style="background:var(--gold)"></i>下一站</span><span><i style="background:var(--sage)"></i>已看</span></span></div>' +
      V.mapSvg() + '</div>';

    /* 下一站卡片 / 完成卡片 */
    if (cur) {
      html += '<div class="card next-card rise" data-a="open-current">' +
        '<p class="nc-cap">下一站</p>' +
        '<p class="nc-title">' + esc(cur.ex.title) + '</p>' +
        '<p class="nc-hint">' + esc(cur.ex.short) + '</p>' +
        '<div style="display:flex;gap:14px;margin-bottom:14px;font-size:12.5px;color:var(--ink-3)">' +
        '<span>建议停留 ' + cur.ex.stay + ' 分钟</span><span>·</span><span>步行约 ' + cur.walk + ' 分钟</span>' +
        (c.contentMode === 'light' ? '<span class="tag tag-sage">轻量模式</span>' : '') +
        '</div>' +
        '<div class="nc-actions">' +
        '<button class="btn btn-primary" data-a="start-looking">开始看</button>' +
        '<button class="btn btn-ghost" data-a="open-adjust">调整一下</button>' +
        '</div></div>';
    } else {
      html += '<div class="card next-card rise"><p class="nc-cap">参观完成</p>' +
        '<p class="nc-title">今天的故事，到这里。</p>' +
        '<p class="nc-hint">我为你准备了这次参观的回顾和一份小纪念。</p>' +
        '<div class="nc-actions"><button class="btn btn-primary" data-a="end-visit">去看今日回顾</button></div></div>';
    }

    /* 兴趣悄悄话 */
    var top = Store.topInterests(1)[0];
    if (top && top.score >= 3 && !c.whisperShown && cur) {
      html += '<div class="whisper"><p>我发现你今天越来越喜欢<b>"' + topicName(top.id) + '"</b>这个方向。</p>' +
        '<div style="display:flex;gap:9px"><button class="chip on" data-a="whisper-go">按这个方向继续</button>' +
        '<button class="chip" data-a="whisper-dismiss">先这样</button></div></div>';
    }

    /* 路线列表 */
    html += '<p class="sec-label"><span>今日路线</span><span>' + done + ' / ' + c.route.length + '</span></p>' +
      '<div class="card route-list">';
    c.route.forEach(function (id, i) {
      var e = Store.ex(id);
      var stCls = c.visitedIds.indexOf(id) >= 0 ? 'done' :
        (Store.nextUnvisited() === i ? 'next' : '');
      var num = c.visitedIds.indexOf(id) >= 0 ? '✓' : (i + 1);
      var meta = c.visitedIds.indexOf(id) >= 0 ? '已看完' :
        (c.skippedIds.indexOf(id) >= 0 ? '已跳过' : e.period);
      html += '<div class="stop-row" data-a="open-ex" data-id="' + id + '">' +
        '<div class="stop-num ' + stCls + '">' + num + '</div>' +
        '<div class="stop-info"><b>' + esc(e.title) + '</b><span>' + esc(meta) + ' · ' + topicName(e.topic) + '</span></div>' +
        '<span class="tiny">' + e.stay + 'min</span></div>';
      if (i < c.route.length - 1) {
        var wk = Store.legWalk(id, c.route[i + 1]);
        html += '<div class="walk-line">步行约 ' + wk + ' 分钟</div>';
      }
    });
    html += '</div><div style="height:20px"></div>' + tabbar('visit') + '</div>';
    return html;
  };

  /* ================= 展品详情 ================= */
  V.exhibit = function (exId) {
    var e = Store.ex(exId), c = Store.ctx;
    var inRoute = c.route.indexOf(exId) >= 0;
    var isCurrent = Store.currentNext() && Store.currentNext().ex.id === exId;
    var light = c.contentMode === 'light';
    var rels = (e.related || []).map(function (id) { return EX_INDEX[id]; }).filter(Boolean);

    var html = '<div class="screen" id="exhibit-screen">' +
      '<div class="ex-hero">' + V.artSvg(e, {}) + '<div class="veil"></div>' +
      '<button class="back-fab" data-a="back">‹</button>' +
      '<button class="light-toggle chip ' + (light ? 'on' : '') + '" data-a="toggle-light" style="font-size:11.5px">' + (light ? '☁️ 轻量模式' : '详细讲解') + '</button>' +
      '</div>' +
      '<div class="ex-body scroll">' +
      '<div class="ex-period-row">' + srcTag(e) +
      '<span class="tag tag-gray">' + esc(e.period.split('（')[0]) + '</span>' +
      '<span class="tag tag-gold">' + topicName(e.topic) + '</span></div>' +
      '<h1 class="ex-title">' + esc(e.title) + '</h1>' +
      '<p class="ex-gallery">📍 ' + esc(Store.galleryOf(e).floor + ' · ' + Store.galleryOf(e).name) + '</p>' +
      '<div class="stay-meta"><span>建议停留 <b>' + e.stay + ' 分钟</b></span><span>理解难度 <b>' + '●'.repeat(e.difficulty) + '○'.repeat(3 - e.difficulty) + '</b></span></div>' +

      '<div class="insight-card rise"><p>' + esc(light ? e.light.replace('最值得记住的是：', '') : e.insight) + '</p></div>';

    if (light) {
      html += '<div class="light-card"><b>轻量模式 · 20秒版本</b><p>' + esc(e.light) + '</p>' +
        '<button class="chip" data-a="expand-detail" style="margin-top:9px">展开讲解</button></div>';
    }

    html += '<div class="fold' + (light ? '' : ' open') + '" id="fold-detail"><button class="fold-head" data-a="fold" data-t="fold-detail">展开讲解<span class="arr">▾</span></button>' +
      '<div class="fold-body"><div class="fold-body-inner">' + esc(e.detail) +
      '<div class="src-line">资料来源：' + (e.source === 'public' ? '依据公开资料整理（Demo演示用途）' : 'Demo 模拟内容') + '</div>' +
      '</div></div></div>';

    html += '<div class="fold"><button class="fold-head" data-a="fold" data-t="fold-why">为什么值得看<span class="arr">▾</span></button>' +
      '<div class="fold-body"><div class="fold-body-inner">' +
      esc(topicName(e.topic) + '方向的核心展品。') + (e.priority >= 3 ? '很多观众专程为它而来，' : '') +
      '记住一句话就够了：<b>' + esc(light ? e.light : e.insight) + '</b></div></div></div>';

    html += '<div class="fold"><button class="fold-head" data-a="fold" data-t="fold-rel">相关文物<span class="arr">▾</span></button>' +
      '<div class="rel-chips">' + rels.map(function (r) {
        return '<button class="chip" data-a="open-ex" data-id="' + r.id + '">' + esc(r.title) + '</button>';
      }).join('') + '</div></div>';

    /* P1-5 资料来源（可审计） */
    var srcTagCls = e.sourceType === 'demo' ? 'tag-orange' : 'tag-sage';
    var srcLabel = e.sourceType === 'demo' ? 'Demo模拟内容' : '公开资料整理';
    html += '<div class="fold"><button class="fold-head" data-a="fold" data-t="fold-src">资料来源<span class="arr">▾</span></button>' +
      '<div class="fold-body"><div class="fold-body-inner">' +
      '<p style="margin-bottom:8px"><span class="tag ' + srcTagCls + '">' + srcLabel + '</span></p>' +
      '<p style="font-size:13px">' + esc(e.sourceTitle) + '</p>' +
      (e.sourceUrl ? '<p style="margin-top:6px"><a href="' + esc(e.sourceUrl) + '" target="_blank" rel="noopener" style="color:var(--gold-deep);font-size:12.5px">查看来源站点 ↗</a></p>' : '') +
      '<p class="tiny" style="margin-top:10px">知息未接入馆方内部系统。标注「Demo模拟内容」的条目仅用于产品演示，不冒充馆方官方讲解。</p>' +
      '</div></div></div>';

    if (!inRoute) {
      html += '<div style="margin-top:16px"><button class="btn btn-ghost" data-a="add-to-route" data-id="' + e.id + '">＋ 加入我的路线</button></div>';
    } else if (!isCurrent && c.visitedIds.indexOf(e.id) < 0) {
      html += '<p class="tiny" style="margin-top:16px;display:flex;align-items:center;gap:6px">✓ 已在你的路线里</p>';
    }
    html += '<div style="height:110px"></div></div>';

    /* 底部动作坞：仅当前站可完成/跳过；预览态显示回到参观 */
    var curNext = Store.currentNext();
    var isCurrentStop = curNext && curNext.ex.id === e.id;
    html += '<div class="action-dock"><div class="row">';
    if (isCurrentStop && !c.finished) {
      html += '<button class="btn btn-ghost" data-a="skip-this" style="flex:none;width:auto;padding:14px 16px;color:var(--ink-3)">跳过</button>' +
        '<button class="btn btn-primary" data-a="complete-this">我看完了</button>' +
        '<button class="btn btn-ghost" data-a="open-chat" style="flex:none;width:auto;padding:14px 16px">💬 想聊聊？</button>';
    } else {
      html += '<button class="btn btn-primary" data-a="back">回到参观</button>' +
        (!inRoute && !c.finished ? '<button class="btn btn-ghost" data-a="open-chat" style="flex:none;width:auto;padding:14px 16px">💬 想聊聊？</button>' : '');
    }
    html += '</div></div></div>';
    return html;
  };

  /* ================= Summary ================= */
  V.summary = function () {
    var c = Store.ctx;
    var mins = Math.round(Store.consumed());
    var topicsTouched = {};
    c.visitedIds.forEach(function (id) { topicsTouched[Store.ex(id).topic] = 1; });
    var tops = Store.topInterests(3);
    var left = Store.leftoverPick();
    var html = '<div class="screen center-page scroll">' + brandRow();
    html += '<h1 class="sum-hero">今天的故事，<br>到这<em>里。</em></h1>' +
      '<p class="sub">这不是结束——你留下了一条自己的兴趣线索。</p>' +
      '<div class="card sum-stats">' +
      '<div><b>' + mins + '</b><span>分钟</span></div>' +
      '<div><b>' + c.visitedIds.length + '</b><span>核心展品</span></div>' +
      '<div><b>' + Object.keys(topicsTouched).length + '</b><span>个主题</span></div>' +
      '<div><b>' + c.replanCount + '</b><span>次动态调整</span></div></div>';

    html += '<p class="q-label">我发现你今天最感兴趣的是</p>' + intBars(tops);
    if (left) {
      html += '<div class="card left-card rise">' +
        '<div class="left-thumb">' + V.thumbSvg(left) + '</div>' +
        '<div style="flex:1"><b style="font-family:var(--serif);font-size:15.5px">' + esc(left.title) + '</b>' +
        '<p class="tiny" style="margin-top:3px">还有一件你今天没来得及看。<br>我替你留着。</p></div></div>' +
        '<button class="btn btn-ghost" data-a="save-continue" style="margin-bottom:12px">下次继续</button>';
    }
    html += '<button class="btn btn-primary" data-a="to-culture">把这份兴趣带走</button>' +
      '<div style="height:26px"></div></div>';
    return html;
  };

  /* ================= CulturalExtension（P1-4：兴趣驱动推荐） ================= */
  V.culture = function () {
    var recs = window.Agent.tools.culture.recommend();
    var tops = Store.topInterests(2);
    var topName = tops.length ? topicName(tops[0].id) : '青铜礼制';
    var html = '<div class="screen center-page scroll">' + brandRow() +
      '<h1 class="sum-hero" style="font-size:25px">把这份兴趣带走？</h1>' +
      '<p class="sub">你今天对<b style="color:var(--gold-deep)">「' + esc(topName) + '」</b>印象最深。以下每一件都由你的真实参观轨迹选出，并说明与你有关的理由。</p>' +
      '<div style="height:18px"></div>';
    recs.forEach(function (p) {
      var wished = Store.ctx.wishedProducts.indexOf(p.productId) >= 0;
      var relChips = (p.relatedExhibits || []).map(function (t) {
        return '<span class="tag tag-gray" style="margin-right:5px">' + esc(t) + '</span>';
      }).join('');
      html += '<div class="card prod-card">' +
        '<div class="prod-thumb" style="background:linear-gradient(160deg,#2E2A22,#4A4030)">' +
        '<svg viewBox="0 0 100 100" fill="none" stroke="#D9BE8C" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[({ p1:'bookmark', p2:'notebook', p3:'booklet', p4:'cards' })[p.productId]] || ICONS.bookmark) + '</svg></div>' +
        '<div class="prod-info" style="flex:1"><b>' + esc(p.name) + '</b>' +
        '<div class="why">为什么与你有关：' + esc(p.reason) + '</div>' +
        (relChips ? '<div style="margin-top:7px">' + relChips + '</div>' : '') +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">' +
        '<span class="prod-price">' + esc(p.price) + '</span>' +
        '<button class="wish-btn' + (wished ? ' on' : '') + '" data-a="wish" data-id="' + p.productId + '">' + (wished ? '已收下 ✓' : '收下心意') + '</button>' +
        '</div></div>';
    });
    html += '<p class="tiny" style="margin:4px 2px 18px">文创信息为 Demo 模拟数据，仅作文化延伸演示，不涉及购买。推荐由你今日的兴趣、停留与提问记录驱动。</p>' +
      '<button class="btn btn-primary" data-a="finish-all">完成参观，期待下次</button>' +
      '<div style="height:26px"></div></div>';
    return html;
  };

  /* ================= 发现 ================= */
  V.discover = function () {
    var c = Store.ctx;
    var tops = Store.topInterests(3);
    var seen = c.visitedIds.concat(c.skippedIds);
    var recs = [];
    EXHIBITS.forEach(function (e) {
      if (seen.indexOf(e.id) < 0 && c.route.indexOf(e.id) < 0) {
        var sc = (c.interests[e.topic] || 0) + (e.priority || 1) * 0.6;
        if (sc > 1.4) recs.push({ e: e, sc: sc });
      }
    });
    recs.sort(function (a, b) { return b.sc - a.sc; });
    var html = '<div class="screen center-page scroll">' + brandRow() +
      '<h1 class="sum-hero" style="font-size:25px">今日兴趣</h1>' +
      '<p class="sub">随着参观自然形成的方向，不是问卷选出来的。</p>' +
      '<div style="margin-top:18px">' + intBars(tops) + '</div>' +
      '<div class="divider"></div>' +
      '<p class="q-label">和你兴趣相近、今天还没看的</p>';
    if (!recs.length) html += '<p class="tiny">暂时没有新的推荐，先把今天的路线走完吧。</p>';
    recs.slice(0, 5).forEach(function (o) {
      html += '<div class="stop-row" data-a="open-ex-preview" data-id="' + o.e.id + '">' +
        '<div class="stop-num">＋</div>' +
        '<div class="stop-info"><b>' + esc(o.e.title) + '</b><span>' + esc(o.e.period) + ' · ' + topicName(o.e.topic) + '</span></div>' +
        '<span class="int-stars" style="font-size:11px">' + stars((c.interests[o.e.topic] || 0)) + '</span></div>';
    });
    html += '<div style="height:20px"></div>' + tabbar('discover') + '</div>';
    return html;
  };

  /* ================= 我的 ================= */
  V.mine = function () {
    var c = Store.ctx;
    var mem = window.ZX_MEMORY || {};
    var html = '<div class="screen center-page scroll">' + brandRow() +
      '<h1 class="sum-hero" style="font-size:25px">我的</h1><div style="height:14px"></div>';
    html += '<div class="card mine-block"><h3>📊 本次参观</h3>' +
      '<div class="kv"><span>场馆</span><b>' + esc(Store.museum().name) + '</b></div>' +
      '<div class="kv"><span>主题线</span><b>青铜器主题线</b></div>' +
      '<div class="kv"><span>已看展品</span><b>' + c.visitedIds.length + ' / ' + c.originalRoute.length + '</b></div>' +
      '<div class="kv"><span>动态调整</span><b>' + c.replanCount + ' 次</b></div>' +
      '<div class="kv"><span>对话交流</span><b>' + c.chatCount + ' 次</b></div></div>';
    if (mem.pendingContinue && EX_INDEX[mem.pendingContinue]) {
      html += '<div class="card mine-block"><h3>🔖 未完待续</h3>' +
        '<p class="sub" style="font-size:13px">留着的展品：《' + esc(EX_INDEX[mem.pendingContinue].title) + '》</p></div>';
    }
    html += '<div class="card mine-block"><h3>🗂 数据与边界说明</h3>' +
      '<p class="tiny" style="line-height:1.9">本产品为可更换场馆的自适应参观引擎，当前样板场景为山东博物馆。<br>' +
      '<span class="tag tag-sage" style="margin-right:6px">公开资料整理</span>用于真实馆藏文物的基础信息。<br>' +
      '<span class="tag tag-orange" style="margin-right:6px">Demo模拟数据</span>用于演示讲解文案、文创与部分条目。<br>' +
      '未接入馆方内部系统，不含实时客流与票务数据。</p></div>' +
      '<div class="card mine-block"><h3>🤍 关于知息</h3>' +
      '<p class="sub" style="font-size:13px">知你当下，息息相伴。<br>让每一次参观，都刚刚好。</p></div>' +
      '<button class="reset-btn" data-a="reset-demo">清除记录，重新开始</button>' +
      '<div style="height:20px"></div>' + tabbar('mine') + '</div>';
    return html;
  };

  /* ================= Sheets & Overlay ================= */
  V.chatSheet = function () {
    return '<div class="sheet-mask" id="sheet-mask"></div>' +
      '<div class="sheet" id="chat-sheet" style="height:72%">' +
      '<div class="sheet-grab"></div>' +
      '<div class="sheet-head"><b>想聊聊？</b><span class="tiny" id="chat-ctx"></span><button class="sheet-close" data-a="close-sheet">✕</button></div>' +
      '<div class="sheet-body" id="chat-msgs"></div>' +
      '<div class="sugg-row" id="chat-sugg">' +
      ['这个和孔子有关系吗？', '我还想看看类似的', '我只剩20分钟了', '我有点累', '少讲一点'].map(function (s) {
        return '<button class="chip" data-a="chat-sugg">' + s + '</button>';
      }).join('') + '</div>' +
      '<div class="composer"><input id="chat-input" placeholder="说人话就好，比如：我有点累">' +
      '<button class="send" data-a="chat-send">↑</button></div></div>';
  };

  V.adjustSheet = function () {
    function opt(a, ico, b, s) {
      return '<button class="opt-item" data-a="' + a + '"><span class="oi-ico">' + ico + '</span><span style="flex:1"><b>' + b + '</b><span>' + s + '</span></span></button>';
    }
    return '<div class="sheet-mask" id="sheet-mask"></div>' +
      '<div class="sheet" id="adjust-sheet" style="max-height:82%">' +
      '<div class="sheet-grab"></div>' +
      '<div class="sheet-head"><b>调整一下</b><button class="sheet-close" data-a="close-sheet">✕</button></div>' +
      '<div class="opt-list">' +
      opt('adj-fatigue', '🌿', '有点累，慢一点', '缩短路线，保留重点，加一段休息') +
      opt('adj-light', '☁️', '少讲一点', '减少文字和语音，只讲最核心的') +
      opt('adj-highlight', '🎯', '只看重点', '删掉次要展品，直奔最值得看的') +
      opt('adj-keep', '🚶', '我还可以继续', '保持现在的节奏不变') +
      '</div>' +
      '<p class="sec-label" style="padding-left:22px"><span>时间有变化？</span></p>' +
      '<div class="opt-list" style="padding-top:0">' +
      opt('adj-time-20', '⏱️', '只剩 20 分钟', '进入收尾模式，只留最值得看的') +
      opt('adj-time-more', '🕐', '时间比想象的多', '我可以再帮你补充一两件') +
      '</div>' +
      '<div class="free-input"><input id="adjust-input" placeholder="或者直接说，比如：我还想看孔子相关的">' +
      '<button class="send" data-a="adj-send" style="width:42px;height:42px;border-radius:50%;background:var(--ink);color:#fff;flex:none">↑</button></div>' +
      '<div style="height:14px"></div></div>';
  };

  V.checkinSheet = function () {
    function opt(a, ico, b, s) {
      return '<button class="opt-item" data-a="' + a + '"><span class="oi-ico">' + ico + '</span><span style="flex:1"><b>' + b + '</b><span>' + s + '</span></span></button>';
    }
    return '<div class="sheet-mask" id="sheet-mask"></div>' +
      '<div class="sheet" id="checkin-sheet" style="max-height:60%">' +
      '<div class="sheet-grab"></div>' +
      '<div class="sheet-head"><div><b style="font-size:19px">我们逛了一阵子</b><p class="tiny" style="margin-top:3px">要不要轻松一点？随时可以改主意。</p></div>' +
      '<button class="sheet-close" data-a="close-sheet">✕</button></div>' +
      '<div class="opt-list">' +
      opt('adj-fatigue', '🌿', '慢一点', '缩短路线，保留重点') +
      opt('adj-light', '☁️', '少讲一点', '减少文字，只讲核心') +
      opt('adj-highlight', '🎯', '只看重点', '删除次要展品') +
      opt('adj-keep', '🚶', '我还可以继续', '保持现在的节奏') +
      '</div><div style="height:16px"></div></div>';
  };

  V.replanOverlay = function (r) {
    var b = r.diffBefore || {}, a = r.diffAfter || {};
    function col(label, val, isNew) {
      return '<div class="diff-col' + (isNew ? ' new' : '') + '"><small>' + label + '</small><b>' + val + '</b></div>';
    }
    return '<div class="replan-mask" id="replan-mask"><div class="replan-card">' +
      '<span class="rp-badge">✦ 重新规划</span>' +
      '<h2>我帮你重新安排了后半程</h2>' +
      '<p class="rp-reason">' + esc(r.reason || '') + ' · ' + esc(r.reply || '') + '</p>' +
      '<div class="diff-grid">' +
      col('后半程·原', (b.count || '–') + ' 件 / ' + Math.round(b.totalMin || 0) + ' 分', false) +
      '<span class="diff-arrow">→</span>' +
      col('新计划', (a.count || '–') + ' 件 / ' + Math.round(a.totalMin || 0) + ' 分', true) +
      '</div>' +
      (r.reasons && r.reasons.length ?
        '<ul class="reason-list">' + r.reasons.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
      '<button class="btn btn-primary" data-a="replan-ok" style="margin-bottom:10px">按新计划继续</button>' +
      '<button class="btn btn-quiet" data-a="replan-cancel">还是按原计划</button>' +
      '</div></div>';
  };

  V.stars = stars; V.esc = esc; V.topicName = topicName; V.intBars = intBars; V.srcTag = srcTag;
})();
