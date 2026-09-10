/* views.js —— 应用外壳：顶栏（检索/同步/账号）+ 侧栏导航 + 内容区路由 */
window.IPApp = (function () {
  let cur = { view: 'today', param: null };
  let markTab = 'tags';
  let saveTimer = null;

  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; };
  function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }

  /* 统一线稿 SVG 图标（24×24，1.5 stroke，round cap） */
  const ICONS = {
    today:    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/></svg>',
    projects: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="11" rx="2"/><path d="M7 6V4h6a1 1 0 0 1 1 1v1" fill="currentColor" fill-opacity=".15" stroke="none"/><path d="M6 3h6l5 5v10a2 2 0 0 1-2 2H6"/></svg>',
    marks:    '<svg viewBox="0 0 24 24"><path d="M4 13V5a1 1 0 0 1 1-1h8l7 7-9 9-7-7z"/><circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none"/></svg>',
    idea:     '<svg viewBox="0 0 24 24"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg>',
    assets:   '<svg viewBox="0 0 24 24"><path d="M12 3l9 5v8l-9 5-9-5V8z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v10"/></svg>',
    tpl:      '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    stats:    '<svg viewBox="0 0 24 24"><path d="M4 20V8"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>',
    data:     '<svg viewBox="0 0 24 24"><path d="M7 4l-4 4 4 4"/><path d="M3 8h14"/><path d="M17 20l4-4-4-4"/><path d="M21 16H7"/></svg>'
  };
  const NAV = [
    ['today',    '今日',   'today'],
    ['projects', '企划',   'projects'],
    ['marks',    '标记',   'marks'],
    ['idea',     '灵感',   'idea'],
    ['assets',   '资产',   'assets'],
    ['tpl',      '模板库', 'tpl'],
    ['stats',    '统计',   'stats'],
    ['data',     '数据',   'data'],
    ['settings', '设置',   'gear']
  ];

  /* 品牌图形 · 筑梦镜片（菱形玻璃：半透折射切面 + 高光斜带 + 中心筑梦光点）
     每次调用生成独立 id，避免同页多实例渐变互相污染 */
  let _gseq = 0;
  function logoSVG() {
    const u = 'lg' + (++_gseq);
    return '<svg viewBox="0 0 56 56" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="' + u + 'g" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#CFD2FF" stop-opacity=".44"/>' +
          '<stop offset=".48" stop-color="#6E72FF" stop-opacity=".18"/>' +
          '<stop offset="1" stop-color="#7FD4FF" stop-opacity=".36"/>' +
        '</linearGradient>' +
        '<linearGradient id="' + u + 's" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#FFFFFF" stop-opacity=".88"/>' +
          '<stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>' +
        '</linearGradient>' +
        '<radialGradient id="' + u + 'r">' +
          '<stop offset="0" stop-color="#6E72FF" stop-opacity=".5"/>' +
          '<stop offset="1" stop-color="#6E72FF" stop-opacity="0"/>' +
        '</radialGradient>' +
      '</defs>' +
      '<circle cx="28" cy="28" r="26" fill="url(#' + u + 'r)"/>' +
      '<path d="M28 3 L53 28 L28 53 L3 28 Z" fill="url(#' + u + 'g)" stroke="#FFFFFF" stroke-opacity=".85" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M28 3 L3 28 L28 28 Z" fill="#FFFFFF" opacity=".30"/>' +
      '<path d="M28 3 L53 28 L28 28 Z" fill="#FFFFFF" opacity=".13"/>' +
      '<path d="M3 28 L28 53 L28 28 Z" fill="#6E72FF" opacity=".28"/>' +
      '<path d="M53 28 L28 53 L28 28 Z" fill="#7FD4FF" opacity=".17"/>' +
      '<path d="M28 3 L28 53 M3 28 L53 28" fill="none" stroke="#FFFFFF" stroke-opacity=".26" stroke-width=".9"/>' +
      '<path d="M15.5 20.5 L29 7 L34.5 7 L21 20.5 Z" fill="url(#' + u + 's)"/>' +
      '<circle cx="28" cy="28" r="7" fill="#6E72FF" opacity=".32"/>' +
      '<circle cx="28" cy="28" r="2.8" fill="#FFFFFF"/>' +
      '</svg>';
  }

  /* 品牌艺术字 · 筑梦之境（思源宋体轮廓 + 竖向梦幻渐变；WM 由 tools/wordmark.js 注入） */
  /* dark=true 时用深紫渐变（浅色糖果底上用，如关于弹窗） */
  function wordmarkSVG(cls, dark) {
    if (typeof WM === 'undefined' || !WM || !WM.d) {
      return '<span class="wm-fb">筑梦之境</span>';
    }
    const u = 'wm' + (++_gseq);
    const c1 = dark ? '#43458A' : '#FFFFFF';
    const c2 = dark ? '#6E72FF' : '#D3D6FF';
    const c3 = dark ? '#38A0FF' : '#8ECCFF';
    return '<svg class="wm ' + (cls || '') + '" viewBox="0 0 ' + WM.w + ' ' + WM.h + '"' +
      ' preserveAspectRatio="xMidYMid meet" role="img" aria-label="筑梦之境">' +
      '<defs><linearGradient id="' + u + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="' + c1 + '"/>' +
        '<stop offset=".52" stop-color="' + c2 + '"/>' +
        '<stop offset="1" stop-color="' + c3 + '"/>' +
      '</linearGradient></defs>' +
      '<path d="' + WM.d + '" fill="url(#' + u + ')"/>' +
      '</svg>';
  }
  const LOGO = logoSVG();
  const BRAND = '筑梦之境';
  const BRAND_EN = 'Dreamwright';
  const SLOGAN = '构筑你的每一个世界';
  const X = {
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20.5 20.5l-4-4"/></svg>',
    ai: '<svg viewBox="0 0 24 24"><path d="M12 3.5l1.9 5.6L19.5 11l-5.6 1.9L12 18.5l-1.9-5.6L4.5 11l5.6-1.9z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>',
    split: '<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="7.6" height="6.8" rx="1.5"/><rect x="13.4" y="4.5" width="7.6" height="6.8" rx="1.5"/><rect x="3" y="14" width="7.6" height="6.5" rx="1.5"/><rect x="13.4" y="14" width="7.6" height="6.5" rx="1.5"/></svg>',
    user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.8"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>',
    out: '<svg viewBox="0 0 24 24"><path d="M9 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3H9"/><path d="M15.5 16.5L20 12l-4.5-4.5"/><path d="M20 12H9.5"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M18 8.6a6 6 0 1 0-12 0c0 4.8-2 6.4-2 6.4h16s-2-1.6-2-6.4"/><path d="M10.3 19a2 2 0 0 0 3.4 0"/></svg>',
    help: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.7 9.5a2.4 2.4 0 1 1 3.3 2.2c-.7.3-1 .9-1 1.6v.3"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.1"/><path d="M12 4.2v2M12 17.8v2M4.2 12h2M17.8 12h2M6.5 6.5l1.4 1.4M16.1 16.1l1.4 1.4M17.5 6.5l-1.4 1.4M7.9 16.1l-1.4 1.4"/></svg>'
  };

  function init() {
    const app = document.getElementById('app');
    app.innerHTML = '';

    // ---------- 顶栏 ----------
    const top = el('div', 'topbar');
    top.innerHTML =
      '<div class="brand"><span class="brand-logo">' + logoSVG() + '</span>' + wordmarkSVG('brand-wm') + '</div>' +
      '<div class="searchwrap">' +
        '<span class="si">' + X.search + '</span>' +
        '<input id="gsearch" placeholder="全局检索：查一个字、一个词…" autocomplete="off">' +
        '<span class="sk">Esc</span>' +
        '<div class="srpanel" id="srpanel"></div>' +
      '</div>' +
      '<div class="topstat">' +
        '<button class="acctbtn" id="aibtn" title="AI 问答与逻辑体检（无 Key 也可用本地模式）"><span class="ic16">' + X.ai + '</span><span>AI</span></button>' +
        '<button class="acctbtn" id="splitbtn" title="分屏并排阅读 1/2/4 块"><span class="ic16">' + X.split + '</span><span>分屏</span></button>' +
        '<button class="acctbtn iconbtn" id="noticebtn" title="消息中心"><span class="ic16">' + X.bell + '</span><i class="ndot" id="noticedot"></i></button>' +
        '<button class="acctbtn iconbtn" id="helpbtn" title="新手引导 · 更新日志 · 关于"><span class="ic16">' + X.help + '</span></button>' +
        '<button class="acctbtn" id="setbtn" title="设置：外观 / 字体 / AI / 云端 / 数据"><span class="ic16">' + X.gear + '</span><span>设置</span></button>' +
        '<span class="syncchip" id="syncchip" title="云同步状态 · 点此立即同步">· 未连接</span>' +
        '<span id="accwrap"></span>' +
        '<span class="saved" id="savedflash">已保存</span>' +
      '</div>';
    app.appendChild(top);

    IPSync.onChange(() => renderSyncChip());
    document.getElementById('syncchip').addEventListener('click', () => IPSync.syncNow());

    // ---------- 主体 ----------
    const main = el('div', 'main');
    const side = el('div', 'side');
    const nav = el('div', 'navlist');
    nav.id = 'navlist';
    NAV.forEach(([k, label, ico]) => {
      const b = el('div', 'navitem');
      b.dataset.k = k;
      b.dataset.tip = {
        today: '今天也要元气满满地打卡哦～',
        projects: '你的每一个世界，梦梦都帮你看着呢',
        marks: '荧光笔划过的句子，梦梦都记住了',
        idea: '灵感来的时候，要抓紧梦梦的手哦',
        assets: '这里收着你的宝贝们～',
        tpl: '好模板会带来好梦的',
        stats: '梦梦偷偷统计了你努力的痕迹',
        data: '放心，数据由梦梦好好看着'
      }[k] || '';
      b.innerHTML = '<span class="icon-svg">' + (ICONS[ico] || '') + '</span>' + label;
      b.addEventListener('click', () => go(k));
      nav.appendChild(b);
    });
    side.appendChild(nav);

    const sideFoot = el('div', 'sidefoot');
    sideFoot.id = 'sidefoot';
    side.appendChild(sideFoot);

    const content = el('div', 'content');
    content.id = 'content';
    main.appendChild(side); main.appendChild(content);
    app.appendChild(main);

    // 梦幻层视差：鼠标轻移，背景梦梦跟着呼吸（±5px，rAF 节流）
    let mmRAF = 0;
    document.addEventListener('mousemove', (e) => {
      if (mmRAF) return;
      mmRAF = requestAnimationFrame(() => {
        mmRAF = 0;
        const de = document.documentElement.style;
        de.setProperty('--mmx', ((e.clientX / window.innerWidth - .5) * 10).toFixed(1) + 'px');
        de.setProperty('--mmy', ((e.clientY / window.innerHeight - .5) * 8).toFixed(1) + 'px');
      });
    }, { passive: true });

    IPSearch.init(document.getElementById('gsearch'), document.getElementById('srpanel'));
    IP2.onSave(() => flashSaved());
    IPEd.setRoot(content);
    document.getElementById('splitbtn').addEventListener('click', (e) => IPFloat.menu(e.currentTarget));
    document.getElementById('aibtn').addEventListener('click', () => IPAI.toggle());
    document.getElementById('noticebtn').addEventListener('click', (e) => IPNotice.panel(e.currentTarget));
    document.getElementById('helpbtn').addEventListener('click', (e) => helpMenu(e.currentTarget));
    document.getElementById('setbtn').addEventListener('click', () => go('settings'));

    renderAccount();
    renderSyncChip();
    IPNotice.refresh();
    IPFloat.init();
    applyPrefs();
    go('today');
    IPOnboard.maybeAuto();
    IPOnboard.requireIfFresh(); // 新人第一次进入：强制走完新手引导
  }

  // ---------- 帮助下拉：引导 / 更新日志 / 关于 ----------
  function helpMenu(anchor) {
    const old = document.getElementById('helpmenu');
    if (old) { old.remove(); return; }
    const r = anchor.getBoundingClientRect();
    const m = el('div', 'popmenu');
    m.id = 'helpmenu';
    m.style.cssText = 'position:fixed;top:' + (r.bottom + 6) + 'px;right:' + (window.innerWidth - r.right) + 'px;z-index:200';
    const items = [
      ['gear', '设置', '外观 / AI / 云端 / 数据 全在这一页', () => go('settings')],
      ['tour', '新手引导', '分几步带你走一遍核心功能', () => IPOnboard.start()],
      ['log', '更新日志', '看看这个版本多了什么', () => IPOnboard.changelog()],
      ['about', '关于 ' + BRAND, SLOGAN, showAbout],
      ['cursor', '星光光标：开 / 关', '换个梦幻光标，不喜欢随时关掉', () => {
        const on = window.IPFX && IPFX.cursor ? IPFX.cursor() : false;
        toast(on ? '星光光标已开启 ✦' : '已换回普通光标');
      }]
    ];
    items.forEach(([k, t, d, fn]) => {
      const b = el('button', 'popmenu-item');
      b.innerHTML = '<b>' + esc(t) + '</b><span>' + esc(d) + '</span>';
      b.addEventListener('click', () => { m.remove(); fn(); });
      m.appendChild(b);
    });
    document.body.appendChild(m);
    setTimeout(() => document.addEventListener('mousedown', function h(e) {
      if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', h); }
    }), 0);
  }

  function showAbout() {
    const old = document.getElementById('aboutdlg');
    if (old) old.remove();
    const ov = el('div', 'overlay'); ov.id = 'aboutdlg';
    const d = el('div', 'dlg dlg-narrow');
    d.innerHTML =
      '<div class="about-wing"></div>' +
      '<div class="about-hd"><div class="about-logo">' + logoSVG() + '</div>' +
      '<div class="about-name">' + wordmarkSVG('about-wm', true) + '</div>' +
      '<div class="about-en">' + BRAND_EN + '</div></div>' +
      '<p class="about-sl">' + SLOGAN + '</p>' +
      '<div class="about-div"></div>' +
      '<div class="about-tx">一个给多形态创作者用的工作台：小说、游戏企划、OC 合集各占一棵树，' +
      '世界观、人物、章节、灵感、标记、逻辑线互相打通，写的时候侧栏常驻，想到就记。</div>' +
      '<div class="about-kv"><span>版本</span><b>' + IPOnboard.version() + '</b></div>' +
      '<div class="about-kv"><span>数据</span><b>本机浏览器 + 可选云端</b></div>' +
      '<div class="about-kv"><span>AI</span><b>可插拔，填 Key 即用</b></div>' +
      '<div class="btns"><button class="no" id="ab_log">更新日志</button><button class="no" id="ab_tour">新手引导</button><button class="ok" id="ab_x">知道了</button></div>';
    ov.appendChild(d); document.body.appendChild(ov);
    document.getElementById('ab_x').addEventListener('click', () => ov.remove());
    document.getElementById('ab_log').addEventListener('click', () => { ov.remove(); IPOnboard.changelog(); });
    document.getElementById('ab_tour').addEventListener('click', () => { ov.remove(); IPOnboard.start(); });
    ov.addEventListener('mousedown', e => { if (e.target === ov) ov.remove(); });
  }

  // ---------- 设置页（外观 / AI / 云端 / 数据 / 关于） ----------
  const PREFS_KEY = 'ipStudioP2:prefs';
  const THEMES = [
    ['purple', '紫夜', '#b49eff', '#7158d8'],
    ['sakura', '樱粉', '#ffb0d8', '#d4689f'],
    ['sky',    '天青', '#8ed0ff', '#4a8fd8'],
    ['mint',   '薄荷', '#9ce8d0', '#3fae8e']
  ];
  function prefs() {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (e) { return {}; }
  }
  function savePrefs(o) {
    const p = Object.assign(prefs(), o);
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch (e) {}
    applyPrefs();
    return p;
  }
  /* 偏好落地：主题色 / 正文字号 / 动效开关 / 星光光标（默认值即"不设置"，老用户行为不变） */
  function applyPrefs() {
    const p = prefs(), de = document.documentElement;
    de.dataset.theme = p.theme || 'purple';
    de.style.setProperty('--ed-fs', (p.edFs || 16) + 'px');
    de.classList.toggle('nofx', p.fx === false);
    if (window.IPFX && IPFX.cursor && document.body.classList.contains('mm-cursor') !== !!p.cursor) {
      IPFX.cursor(!!p.cursor);
    }
  }

  function settings(host) {
    const p = prefs();
    const head = el('div', 'phead');
    head.innerHTML = '<h2>设置</h2>';
    head.appendChild(el('span', 'tip', '外观、AI 接口、云端同步、数据与关于都收在这里'));
    host.appendChild(head);

    /* L1 品牌横幅（糖果横幅素材 + 梦梦） */
    const hero = el('div', 'set-hero');
    hero.innerHTML =
      '<div class="set-hero-tx">' +
        '<div class="set-hero-b">' + wordmarkSVG('set-wm', true) + '</div>' +
        '<div class="set-hero-s">' + esc(SLOGAN) + '</div>' +
        '<div class="set-hero-v">' + esc(IPOnboard.version()) + ' · ' +
          esc(IPAuth.user() ? ('已登录 ' + IPAuth.user().user) : '未登录（本机模式）') + '</div>' +
      '</div>' +
      '<div class="set-hero-mm">' + IPUI.mascot('think') + '</div>';
    host.appendChild(hero);

    const wrap = el('div', 'setwrap');
    host.appendChild(wrap);

    /* 分组卡：糖果方卡边框（与统计页的 cardsq2 区分使用） */
    const sec = (icn, title, desc) => {
      const c = el('div', 'setcard');
      const h = el('div', 'set-h');
      h.innerHTML = '<span class="set-ic">' + IPUI.ic(icn) + '</span>' +
        '<div class="set-ht"><b>' + esc(title) + '</b><span>' + esc(desc || '') + '</span></div>';
      c.appendChild(h);
      const body = el('div', 'set-b');
      c.appendChild(body);
      wrap.appendChild(c);
      return body;
    };
    const rowOf = (body, label, hint) => {
      const r = el('div', 'set-row set-rowcol');
      r.innerHTML = '<div class="set-lb"><b>' + esc(label) + '</b><span>' + esc(hint || '') + '</span></div>';
      body.appendChild(r);
      return r;
    };
    const swRow = (body, label, hint, get, set) => {
      const r = el('div', 'set-row');
      r.innerHTML = '<div class="set-lb"><b>' + esc(label) + '</b><span>' + esc(hint || '') + '</span></div>';
      const s = el('button', 'sw' + (get() ? ' on' : ''));
      s.setAttribute('role', 'switch');
      s.setAttribute('aria-checked', get() ? 'true' : 'false');
      s.innerHTML = '<i></i>';
      s.addEventListener('click', () => {
        const nv = !s.classList.contains('on');
        set(nv);
        s.classList.toggle('on', nv);
        s.setAttribute('aria-checked', nv ? 'true' : 'false');
      });
      r.appendChild(s);
      body.appendChild(r);
    };
    const rangeRow = (body, label, hint, min, max, step, get, set, fmt) => {
      const r = rowOf(body, label, hint);
      const box = el('div', 'set-range');
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = get();
      const val = el('b', 'set-rangev', fmt ? fmt(get()) : String(get()));
      inp.addEventListener('input', () => { set(+inp.value); val.textContent = fmt ? fmt(+inp.value) : inp.value; });
      box.appendChild(inp); box.appendChild(val);
      r.appendChild(box);
    };
    const tapRow = (body, label, hint, btns) => {
      const r = rowOf(body, label, hint);
      const g = el('div', 'set-taps');
      btns.forEach(([t, cls, fn]) => {
        const b = el('button', 'btn ' + (cls || ''), t);
        b.addEventListener('click', fn);
        g.appendChild(b);
      });
      r.appendChild(g);
    };

    /* ① 外观 */
    const a1 = sec('palette', '外观', '主题色 / 正文字号 / 动效 / 光标');
    const thr = rowOf(a1, '主题色', '按钮、选中态、高亮会跟着换一整套强调色');
    const sw = el('div', 'themesw');
    THEMES.forEach(([k, n, c1, c2]) => {
      const b = el('button', 'thsw' + ((p.theme || 'purple') === k ? ' on' : ''));
      b.style.setProperty('--sw1', c1); b.style.setProperty('--sw2', c2);
      b.innerHTML = '<i></i><span>' + esc(n) + '</span>';
      b.addEventListener('click', () => {
        savePrefs({ theme: k });
        sw.querySelectorAll('.thsw').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        toast('主题色已切换：' + n);
      });
      sw.appendChild(b);
    });
    thr.appendChild(sw);

    rangeRow(a1, '正文字号', '调的是「正文 / 草稿」里的字，界面字号不受影响', 14, 22, 1,
      () => p.edFs || 16, v => savePrefs({ edFs: v }), v => v + ' px');

    swRow(a1, '梦幻动效', '背景粒子、打字机、页面切换过渡；平板嫌卡可以关掉',
      () => p.fx !== false, v => { savePrefs({ fx: v }); toast(v ? '动效已开启 ✦' : '动效已关闭（更省电）'); });

    swRow(a1, '星光光标', '把鼠标指针换成小星光，不习惯随时关',
      () => document.body.classList.contains('mm-cursor'),
      v => { if (window.IPFX && IPFX.cursor) IPFX.cursor(v); savePrefs({ cursor: v }); });

    swRow(a1, '章节过场', '切换页面时插一张 galgame 式的章节标题卡（约 1 秒）',
      () => (window.IPVN ? IPVN.cutOn() : false),
      v => { if (window.IPVN) IPVN.cutSet(v); toast(v ? '章节过场已开启 ✦' : '章节过场已关闭'); });

    tapRow(a1, '标题画面', '回到 galgame 式的开机画面（CONTINUE 回到工作台）', [
      ['回到标题画面', '', () => showWelcome()]
    ]);

    /* ② AI 接口 */
    const a2 = sec('spark', 'AI 接口', '已预填「筑梦之境·云开发」网关，粘贴 API Key 即可启用');
    const c0 = (typeof IPAI.cfg === 'function') ? IPAI.cfg() : {};
    const f = el('div', 'set-form');
    f.innerHTML =
      '<label class="set-f"><span>接口地址 baseURL</span><input id="st_base" placeholder="https://api.deepseek.com/v1" value="' + esc(c0.baseURL || '') + '"></label>' +
      '<label class="set-f"><span>API Key</span><input id="st_key" type="password" placeholder="粘贴你的 CloudBase API Key" value="' + esc(c0.key || '') + '"></label>' +
      '<label class="set-f"><span>模型名</span><input id="st_model" placeholder="hy3-preview" value="' + esc(c0.model || '') + '"></label>';
    a2.appendChild(f);
    const note = el('div', 'set-note', 'Key 只留在这台设备上，不会进云同步、不进源码。没填 Key 也能用：问答会列出作品里的相关片段，「逻辑体检」照常跑本地规则。注意：AI 联网调用需要经 http 打开本页（本地服务器或在线链接），直接双击文件打开会被浏览器拦截。');
    a2.appendChild(note);
    const g2 = el('div', 'set-taps set-taps-left');
    const bSave = el('button', 'btn primary', '保存接口设置');
    bSave.addEventListener('click', () => {
      IPAI.saveCfg(Object.assign(IPAI.cfg(), {
        baseURL: document.getElementById('st_base').value.trim(),
        key: document.getElementById('st_key').value.trim(),
        model: document.getElementById('st_model').value.trim()
      }));
      toast(IPAI.hasKey() ? '接口设置已保存 ✓ 可以去试试问答了' : '已保存（Key 没填全，仍是本地模式）');
    });
    const bGo = el('button', 'btn', '打开 AI 面板');
    bGo.addEventListener('click', () => IPAI.tab('cfg'));
    g2.appendChild(bSave); g2.appendChild(bGo);
    a2.appendChild(g2);

    /* ③ 云端同步 */
    const a3 = sec('cloud', '云端同步', '登录后可多设备同步；单机用完全不受影响');
    const st = IPSync.status(), mode = IPAuth.mode(), u = IPAuth.user();
    const stx = !u ? (mode === 'cloud' ? '未登录 · 已配置云端地址' : '本地模式 · 未接入云端')
      : (st.err ? '同步异常：' + st.err
        : (st.in ? '同步中…' : (st.pending > 0 ? '有 ' + st.pending + ' 条待上传' : (st.lastSync ? '已同步' : '已登录，等待首次同步'))));
    const inf = el('div', 'set-info');
    inf.innerHTML = '<div class="set-info-l"><span class="cdot"></span><b>' + esc(u ? u.user : '未登录') + '</b></div>' +
      '<span class="set-info-s">' + esc(stx) + '</span>';
    a3.appendChild(inf);
    tapRow(a3, '账号与云端', '注册 / 登录、填云函数地址、手动同步', [
      ['打开账号面板', 'primary', () => {
        const b = document.getElementById('acc_open') || document.getElementById('acc_login');
        if (b) b.click(); else toast('顶部右侧「账号」按钮也能打开');
      }],
      ['立即同步', '', () => { if (!IPAuth.user()) { toast('先登录才能同步'); return; } IPSync.syncNow(); toast('已请求同步'); }]
    ]);

    /* ④ 数据与隐私 */
    const a4 = sec('shield', '数据与隐私', '内容归你所有，存在本机浏览器 + 你选的云端');
    tapRow(a4, '备份与恢复', '导出 JSON 备份 / 从备份还原 / 载入示例', [
      ['打开数据页', 'primary', () => go('data')]
    ]);
    tapRow(a4, '隐私说明', '我们只在你主动登录时存账号；不采集手机号、位置、通讯录', [
      ['查看隐私政策', '', () => { if (window.IPLegal) IPLegal.open('privacy'); else toast('隐私政策文档在 outputs/legal/'); }]
    ]);

    /* ⑤ 关于 */
    const a5 = sec('info', '关于', BRAND + ' · ' + BRAND_EN);
    const kv = el('div', 'set-kv');
    kv.innerHTML =
      '<div><span>版本</span><b>' + esc(IPOnboard.version()) + '</b></div>' +
      '<div><span>数据</span><b>本机浏览器 + 可选云端</b></div>' +
      '<div><span>AI</span><b>' + esc(IPAI.hasKey() ? ('已接 ' + IPAI.cfg().model) : '本地模式（未填 Key）') + '</b></div>' +
      '<div><span>吉祥物</span><b>镜梦菱 · 梦梦</b></div>';
    a5.appendChild(kv);
    tapRow(a5, '帮助', '入门引导 / 更新日志 / 品牌信息', [
      ['新手引导', '', () => IPOnboard.start()],
      ['更新日志', '', () => IPOnboard.changelog()],
      ['关于本站', '', showAbout]
    ]);
  }

  // ---------- 路由 ----------
  function go(view, param) {
    if (cur.view !== view && window.IPVN) {
      const NAV13 = { today: ['今日', '一'], projects: ['企划', '二'], project: ['企划', '二'], marks: ['标记', '三'], idea: ['灵感', '四'], assets: ['资产', '五'], tpl: ['模板库', '六'], stats: ['统计', '七'], data: ['数据', '八'], settings: ['设置', '九'] };
      const nn = NAV13[view];
      if (nn) { IPVN.log('前往 · ' + nn[0]); IPVN.cutin(nn[0], nn[1]); }
    }
    cur = { view, param: param || null };
    document.querySelectorAll('#navlist .navitem').forEach(b => {
      const on = b.dataset.k === view || (view === 'project' && b.dataset.k === 'projects');
      b.classList.toggle('on', on);
    });
    render();
  }

  function render() {
    const host = document.getElementById('content');
    if (!host) return;
    host.innerHTML = '';
    host.className = 'content';
    IPEd.setRoot(host);
    renderSideFoot();
    const v = cur.view;
    if (v === 'today') IPManage.today(host);
    else if (v === 'projects') IPProj.list(host);
    else if (v === 'project') IPProj.work(host, cur.param);
    else if (v === 'marks') marks(host);
    else if (v === 'idea') IPManage.ideas(host);
    else if (v === 'assets') IPAssets.render(host);
    else if (v === 'tpl') IPManage.templates(host);
    else if (v === 'stats') IPManage.stats(host);
    else if (v === 'data') IPManage.data(host);
    else if (v === 'settings') settings(host);
    /* ③④ 页面切换过渡 + 卡片 stagger：重放动画类（只影响视觉，不动逻辑） */
    host.classList.remove('pagein');
    void host.offsetWidth;
    host.classList.add('pagein');
  }

  function reload() { render(); }
  function reloadTab() { render(); }
  function refreshContent() { try { IPEd.refreshText(); } catch (e) {} }

  function renderSideFoot() {
    const f = document.getElementById('sidefoot');
    if (!f) return;
    f.innerHTML = '';
    const ps = IP2.projects().slice(0, 6);
    if (!ps.length) return;
    f.appendChild(el('div', 'sfh', '企划'));
    ps.forEach(p => {
      const it = el('div', 'sfitem' + (cur.param === p.id ? ' on' : ''));
      it.innerHTML = '<span class="cdot" style="background:' + p.color + '"></span><span class="nm"></span>';
      it.querySelector('.nm').textContent = p.name;
      it.addEventListener('click', () => go('project', p.id));
      f.appendChild(it);
    });
  }

  // ---------- 标记页（标签聚卡 / 逻辑线） ----------
  function marks(host) {
    const head = el('div', 'phead');
    head.innerHTML = '<h2>标记</h2>';
    head.appendChild(el('span', 'tip', '给正文划线挂标签 → 同标签自动聚卡 → 再串成逻辑线'));
    host.appendChild(head);

    const tabs = el('div', 'pjtabs');
    [['tags', '标签聚卡'], ['lines', '逻辑线']].forEach(([k, n]) => {
      const b = el('button', 'pjtab' + (k === markTab ? ' on' : ''), n);
      b.addEventListener('click', () => { markTab = k; render(); });
      tabs.appendChild(b);
    });
    host.appendChild(tabs);

    const body = el('div', 'pjbody');
    host.appendChild(body);
    if (markTab === 'tags') IPTags.render(body);
    else IPLines.render(body);
  }

  function showTags() { markTab = 'tags'; go('marks'); }

  // ---------- 跳转（供检索 / 标签聚合调用） ----------
  function jumpAnno(a) {
    if (!a) return;
    IPProj.openPageGlobal(a.pageId);
    setTimeout(() => {
      try { IPEd.flash(a.pageId, a.seg, a.start, Math.max(1, (a.end || a.start + 1) - a.start)); } catch (e) {}
    }, 120);
  }
  function jumpWord(pageId, seg, at, len) {
    IPProj.openPageGlobal(pageId);
    setTimeout(() => {
      try { IPEd.flash(pageId, seg, at, Math.max(1, len || 1)); } catch (e) {}
    }, 120);
  }
  function jumpEntry(id) {
    const e = IP2.entry(id);
    if (!e) return;
    go('project', e.pid);
    setTimeout(() => IPProj.entryDlg(id), 60);
  }

  // ---------- 小工具 ----------
  function toast(msg) {
    let t = document.getElementById('iptoast');
    if (!t) {
      t = el('div'); t.id = 'iptoast';
      t.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:500;'
        + 'background:var(--uc-rectp) center/100% 100% no-repeat;'
        + 'padding:13px 26px;font-size:14px;font-weight:600;color:#4A4C86;'
        + 'text-shadow:0 1px 0 rgba(255,255,255,.5);'
        + 'box-shadow:0 8px 24px rgba(4,4,26,.45);max-width:80vw';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    clearTimeout(t._h);
    t._h = setTimeout(() => t.remove(), 2400);
  }
  function flashSaved() {
    const s = document.getElementById('savedflash');
    if (!s) return;
    s.classList.add('on');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => s.classList.remove('on'), 900);
  }

  // ================= 账号与云同步 UI =================
  function renderSyncChip() {
    const chip = document.getElementById('syncchip');
    if (!chip) return;
    const st = IPSync.status();
    const mode = IPAuth.mode();
    if (!IPAuth.user()) { chip.textContent = mode === 'cloud' ? '● 云 未登录' : '· 本地'; chip.style.color = 'var(--tx3)'; return; }
    let dot, txt;
    if (st.in === 'push' || st.in === 'pull') { dot = '⟳'; txt = '同步中…'; chip.style.color = 'var(--ac)'; }
    else if (st.pending > 0) { dot = '⇡'; txt = '待传 ' + st.pending; chip.style.color = 'var(--warn)'; }
    else if (st.err) { dot = '!'; txt = '同步异常'; chip.style.color = 'var(--err)'; chip.title = '同步异常：' + st.err; }
    else { dot = '✓'; txt = st.lastSync ? '已同步' : '未同步'; chip.style.color = 'var(--ok)'; }
    chip.textContent = dot + ' ' + txt + (mode === 'cloud' ? ' · 云' : '');
  }

  function renderAccount() {
    const wrap = document.getElementById('accwrap');
    if (!wrap) return;
    const u = IPAuth.user();
    if (!u) {
      wrap.innerHTML = '<button class="acctbtn" id="acc_login" title="登录后多端自动同步"><span class="ic16">' + X.user + '</span><span>登录 / 注册</span></button>';
      document.getElementById('acc_login').addEventListener('click', openAccountDlg);
      return;
    }
    const ini = u.anon ? '匿' : esc((u.user || '?').slice(0, 1).toUpperCase());
    const disp = u.anon ? ('匿名 #' + (u.user || '').replace('anon_', '')) : u.user;
    wrap.innerHTML = '<button class="acctbtn accon" id="acc_open" title="账号与云端设置"><span class="avatar">' + ini + '</span><span>' + esc(disp) + '</span></button>' +
      '<button class="acctbtn avabtn" id="acc_out" title="登出（数据保留在本机）"><span class="ic16">' + X.out + '</span></button>';
    document.getElementById('acc_open').addEventListener('click', openAccountDlg);
    document.getElementById('acc_out').addEventListener('click', () => {
      IPAuth.logout(); IPSync.afterLogout(); renderAccount(); renderSyncChip();
      toast('已登出。数据仍保留在本机（本地模式可继续用）。');
    });
  }

  function refreshCloudStat(statId, quotaId) {
    const statEl = statId && document.getElementById(statId);
    const quotaEl = quotaId && document.getElementById(quotaId);
    if (statEl) {
      if (!(window.IPCloud && IPCloud.available())) statEl.innerHTML = '<span style="color:var(--tx3)">未连接云端（演示模式，数据存本机）</span>';
      else { const s = IPCloud.readyState(); statEl.innerHTML = '<span style="color:var(--ok)">✓ 已连 CloudBase · ' + esc(s.envId || '') + ' · uid…' + esc((s.uid || '').slice(-6)) + '</span>'; }
    }
    if (quotaEl) {
      if (!(window.IPCloud && IPCloud.available())) { quotaEl.textContent = IPAuth.aiQuota().used + ' / ' + IPAuth.aiQuota().total; return; }
      IPAuth.aiQuotaAsync().then(q => { quotaEl.textContent = q.used + ' / ' + q.total; }).catch(() => { quotaEl.textContent = IPAuth.aiQuota().used + ' / ' + IPAuth.aiQuota().total; });
    }
  }
  function cfConnect(env, statId) {
    const id = (env || '').trim();
    const e = statId && document.getElementById(statId);
    if (!id) { if (e) e.innerHTML = '<span style="color:var(--err)">请先填环境 ID</span>'; return; }
    IPAuth.setCloudEnv(id);
    if (e) e.textContent = '连接中…';
    (window.IPCloud ? IPCloud.init(id) : Promise.reject(new Error('CloudBase 未加载'))).then(() => {
      refreshCloudStat(statId);
      if (IPAuth.user() && IPAuth.user().anon) IPSync.afterLogin().then(() => renderSyncChip());
      toast('已连接 CloudBase 云端');
    }).catch(err => { if (e) e.innerHTML = '<span style="color:var(--err)">连接失败：' + esc((err && err.message) || err) + '</span>'; });
  }
  function openAccountDlg() {
    const u = IPAuth.user();
    const old = document.getElementById('accdlg');
    if (old) old.remove();
    const ov = el('div', 'overlay');
    ov.id = 'accdlg';
    const dlg = el('div', 'dlg');
    const authed = !!u;
    const c = IPAuth.cfg();
    dlg.innerHTML = authed
      ? '<h3>账号 · ' + esc(u.user) + '</h3>' +
        '<div class="field" style="font-size:12px;color:var(--tx2)">当前账号：<b>' + esc(u.anon ? ('匿名 #' + (u.user || '').replace('anon_', '')) : u.user) + '</b>　模式：' + (IPAuth.isCloud() ? '云' : '演示（本地）') +
        '<div style="color:var(--tx3);margin-top:4px">登出后可继续用，数据保留在本机。</div>' +
        '<div style="color:var(--tx3);margin-top:6px">AI 额度：今日已用 <b style="color:var(--ac)">' + IPAuth.aiQuota().used + '</b> / ' + IPAuth.aiQuota().total + ' 次</div></div>' +
        '<div class="field" style="background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:8px 10px" id="cf_syncbox">' +
        '<div style="font-size:11px;color:var(--tx3);margin-bottom:4px">同步状态（点「立即同步」查看最新结果）：</div>' +
        '<div id="cf_syncmsg" style="font-size:12px;line-height:1.6;word-break:break-all"></div></div>' +
        '<div class="field" style="background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:8px 10px">' +
        '<div style="font-size:11px;color:var(--tx3);margin-bottom:4px">CloudBase 云端：匿名登录已自动连接；也可手动填环境 ID 连接。</div>' +
        '<div style="display:flex;gap:6px;align-items:center"><input id="cf_env" placeholder="CloudBase 环境 ID，如 wml2007-xxxx" value="' + esc(IPAuth.cloudEnv() || '') + '" style="flex:1"><button class="no" id="cf_connect" style="white-space:nowrap">连接云端</button></div>' +
        '<div id="cf_cloudstat" style="font-size:12px;margin-top:4px"></div>' +
        '<div style="color:var(--tx3);margin-top:6px">AI 额度：今日已用 <b style="color:var(--ac)" id="cf_quota">…</b> 次</div></div>' +
        '<details class="field"><summary style="cursor:pointer;color:var(--tx2);font-size:12px">高级 · 旧版 HTTP 网关配置</summary>' +
        '<div class="field"><label>云端配置（按 cloud/DEPLOY.md 部署后填写；留空则使用演示后端）</label>' +
        '<input id="cf_base" placeholder="云函数访问地址（部署完成后显示的那条 URL）" value="' + esc(c.fnUrl || c.httpBase || '') + '">' +
        '<input id="cf_sec" placeholder="访问密钥 ACCESS_KEY（部署时自己设的那串）" value="' + esc(c.secret || '') + '" style="margin-top:6px"></div></details>' +
        '<div class="btns"><button class="no" id="cf_syncnow">立即同步</button><button class="no" id="cf_save">保存配置</button><button class="no" id="acc_logout">登出</button><button class="ok" id="acc_close">完成</button></div>'
      : '<h3>登录 / 注册</h3>' +
        '<button class="anonbtn" id="au_anon">✦ 一键匿名体验（免注册，立即解锁 AI 额度 + 云端同步）</button>' +
        '<div class="field" style="background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:8px 10px">' +
        '<div style="font-size:11px;color:var(--tx3);margin-bottom:4px">已有 CloudBase？先填环境 ID 连接（匿名登录后数据直接进云）：</div>' +
        '<div style="display:flex;gap:6px;align-items:center"><input id="cf_env2" placeholder="CloudBase 环境 ID" style="flex:1"><button class="no" id="cf_connect2" style="white-space:nowrap">连接</button></div>' +
        '<div id="cf_cloudstat2" style="font-size:12px;margin-top:4px"></div></div>' +
        '<div class="autabs"><button class="autab on" id="tab_code">邮箱验证码</button><button class="autab" id="tab_pass">用户名密码</button></div>' +
        '<div id="m_code">' +
          '<div class="field"><label>邮箱</label><input id="au_email" placeholder="you@example.com" autocomplete="email"></div>' +
          '<div class="field"><label>验证码</label><div class="coderow">' +
            '<input id="au_code" placeholder="6 位数字" maxlength="6" inputmode="numeric">' +
            '<button class="no codebtn" id="au_send">获取验证码</button></div></div>' +
        '</div>' +
        '<div id="m_pass" style="display:none">' +
          '<div class="field"><label>用户名</label><input id="au_user" placeholder="2 个字符以上"></div>' +
          '<div class="field"><label>密码</label><input id="au_pass" type="password" placeholder="4 位以上"></div>' +
          '<div class="field" id="au_pass2row"><label>确认密码</label><input id="au_pass2" type="password"></div>' +
        '</div>' +
        '<div class="field" id="au_invrow"><label>邀请码</label><input id="au_inv" placeholder="注册时需要，登录不用"></div>' +
        '<div class="autip" id="au_tip">登录后，企划、条目、页面、标记、打卡会自动同步到云端，换设备打开同一账号即可继续。不登录也一切照常用（数据存本机）。</div>' +
        '<div class="field"><label>云端配置（可选，演示模式可留空）</label>' +
        '<input id="cf_base" placeholder="云函数访问地址（部署完成后显示的那条 URL）" value="' + esc(c.fnUrl || c.httpBase || '') + '">' +
        '<input id="cf_sec" placeholder="访问密钥 ACCESS_KEY（部署时自己设的那串）" value="' + esc(c.secret || '') + '" style="margin-top:6px"></div>' +
        '<div class="btns"><button class="no" id="au_gologin">已有账号？去登录</button><button class="no" id="au_cancel">取消</button><button class="ok" id="au_do">注册并登录</button></div>';
    ov.appendChild(dlg);
    document.body.appendChild(ov);

    const cfgFromForm = () => ({
      fnUrl: (document.getElementById('cf_base').value || '').trim(),
      httpBase: '',
      envId: '',
      secret: (document.getElementById('cf_sec').value || '').trim()
    });

    if (!authed) {
      let mode2 = 'reg';      // reg | login
      let authMode = 'code';  // code | pass
      const pass2row = document.getElementById('au_pass2row');
      const invRow = document.getElementById('au_invrow');
      const doBtn = document.getElementById('au_do');
      const gologin = document.getElementById('au_gologin');
      const tip = document.getElementById('au_tip');
      const sendBtn = document.getElementById('au_send');
      const tabCode = document.getElementById('tab_code');
      const tabPass = document.getElementById('tab_pass');

      const setTip = (t, kind) => { tip.className = 'autip' + (kind ? ' ' + kind : ''); tip.innerHTML = t; };
      const syncUI = () => {
        tabCode.classList.toggle('on', authMode === 'code');
        tabPass.classList.toggle('on', authMode === 'pass');
        document.getElementById('m_code').style.display = authMode === 'code' ? '' : 'none';
        document.getElementById('m_pass').style.display = authMode === 'pass' ? '' : 'none';
        invRow.style.display = mode2 === 'reg' ? '' : 'none';
        pass2row.style.display = (authMode === 'pass' && mode2 === 'reg') ? '' : 'none';
        doBtn.textContent = mode2 === 'reg' ? '注册并登录' : '登录';
        gologin.textContent = mode2 === 'reg' ? '已有账号？去登录' : '没有账号？去注册';
      };

      let cool = 0, timer = null;
      const tick = () => {
        if (cool <= 0) { sendBtn.disabled = false; sendBtn.textContent = '重新获取'; clearInterval(timer); timer = null; return; }
        sendBtn.textContent = cool + ' 秒'; cool--;
      };
      sendBtn.addEventListener('click', () => {
        IPAuth.setCfg(cfgFromForm());
        const email = document.getElementById('au_email').value.trim();
        if (!email) { setTip('先填邮箱，再获取验证码', 'bad'); return; }
        sendBtn.disabled = true; sendBtn.textContent = '发送中…';
        IPAuth.sendCode(email).then(r => {
          sendBtn.disabled = false;
          if (r.err) { setTip(r.err, 'bad'); sendBtn.textContent = '获取验证码'; return; }
          if (r.demo) setTip('验证码已生成：<b class="bigcode">' + r.demo + '</b><br>' + (r.note || '演示模式直接显示，真实云端会发到邮箱。'), 'code');
          else setTip('验证码已发送到 <b>' + esc(email) + '</b>，10 分钟内有效。' + (r.note || ''), 'ok');
          cool = 60; sendBtn.disabled = true; tick(); timer = setInterval(tick, 1000);
          document.getElementById('au_code').focus();
        });
      });

      const afterLogin = () => {
        ov.remove();
        renderAccount(); renderSyncChip();
        IPSync.afterLogin().then(() => {
          renderSyncChip(); IPNotice.refresh();
          toast('登录成功，已连接' + (IPAuth.isCloud() ? '云端' : '演示同步'));
          IPUI.burst('heart', '欢迎回来～');
        });
      };

      const exec = () => {
        IPAuth.setCfg(cfgFromForm());
        if (mode2 === 'reg') {
          const iv = IPAuth.checkInvite(document.getElementById('au_inv').value);
          if (iv.err) { setTip(iv.err + '（这是内测期的门槛，找作者要一个即可）', 'bad'); document.getElementById('au_inv').focus(); return; }
        }
        if (authMode === 'code') {
          const email = document.getElementById('au_email').value.trim();
          const code = document.getElementById('au_code').value.trim();
          if (!email || !code) { setTip('邮箱和验证码都要填', 'bad'); return; }
          doBtn.disabled = true; doBtn.textContent = '验证中…';
          const p = IPAuth.loginCode(email, code);
          p.then(r => {
            doBtn.disabled = false; doBtn.textContent = mode2 === 'reg' ? '注册并登录' : '登录';
            if (r.err) { setTip(r.err, 'bad'); return; }
            afterLogin();
          });
          return;
        }
        const user = document.getElementById('au_user').value;
        const pass = document.getElementById('au_pass').value;
        const pass2 = document.getElementById('au_pass2').value;
        if (mode2 === 'reg' && pass !== pass2) { setTip('两次密码不一致', 'bad'); return; }
        const r = mode2 === 'reg' ? IPAuth.register(user, pass) : IPAuth.login(user, pass);
        if (r.err) { setTip(r.err, 'bad'); return; }
        afterLogin();
      };

      document.getElementById('au_anon').addEventListener('click', async () => {
        const r = await IPAuth.anonLogin();
        ov.remove();
        renderAccount(); renderSyncChip();
        IPSync.afterLogin().then(() => { renderSyncChip(); IPNotice.refresh(); });
        if (r && r.cloud) toast('已连 CloudBase 云端（匿名）～ 数据自动同步，每日 20 次 AI 额度已解锁');
        else toast('已匿名登录～ 每天 20 次 AI 对话额度已解锁（未连云端，数据存本机）');
        if (window.IPUI) IPUI.burst('heart', '欢迎来到筑梦之境');
      });
      const cfEnv2 = document.getElementById('cf_env2');
      const cfConn2 = document.getElementById('cf_connect2');
      if (cfConn2) cfConn2.addEventListener('click', () => cfConnect(cfEnv2 && cfEnv2.value, 'cf_cloudstat2'));
      refreshCloudStat('cf_cloudstat2');
      doBtn.addEventListener('click', exec);
      gologin.addEventListener('click', () => { mode2 = mode2 === 'reg' ? 'login' : 'reg'; syncUI(); });
      tabCode.addEventListener('click', () => { authMode = 'code'; syncUI(); });
      tabPass.addEventListener('click', () => { authMode = 'pass'; syncUI(); });
      document.getElementById('au_cancel').addEventListener('click', () => ov.remove());
      ov.addEventListener('mousedown', e => { if (e.target === ov) ov.remove(); });
      ['au_email', 'au_code', 'au_inv', 'au_user', 'au_pass'].forEach(id => {
        const n = document.getElementById(id);
        if (n) n.addEventListener('keydown', e => { if (e.key === 'Enter') exec(); });
      });
      syncUI();
      document.getElementById('au_email').focus();
    } else {
      const syncMsg = document.getElementById('cf_syncmsg');
      const showSync = () => {
        const st2 = IPSync.status();
        if (st2.err) syncMsg.innerHTML = '<span style="color:var(--err)">✖ ' + esc(st2.err) + '</span>';
        else if (st2.lastSync) syncMsg.textContent = '✓ 已同步 · ' + new Date(st2.lastSync).toLocaleTimeString() + (st2.pending ? '（还有 ' + st2.pending + ' 条待传）' : '');
        else syncMsg.textContent = '尚未成功同步过。点「立即同步」重试。';
      };
      showSync();
      refreshCloudStat('cf_cloudstat', 'cf_quota');
      const cfConn = document.getElementById('cf_connect');
      if (cfConn) cfConn.addEventListener('click', () => cfConnect(document.getElementById('cf_env') && document.getElementById('cf_env').value, 'cf_cloudstat'));
      document.getElementById('cf_syncnow').addEventListener('click', () => {
        syncMsg.textContent = '⟳ 同步中…';
        IPSync.syncNow().then(() => {
          showSync(); renderSyncChip();
          if (!IPSync.status().err) IPUI.burst('like', '同步成功！');
        });
      });
      document.getElementById('cf_save').addEventListener('click', () => {
        IPAuth.setCfg(cfgFromForm());
        ov.remove(); renderAccount(); renderSyncChip();
        toast('配置已保存' + (IPAuth.isCloud() ? '，将使用云端模式' : '，仍为演示模式'));
      });
      document.getElementById('acc_close').addEventListener('click', () => ov.remove());
      document.getElementById('acc_logout').addEventListener('click', () => {
        IPAuth.logout(); IPSync.afterLogout(); renderAccount(); renderSyncChip(); ov.remove();
        toast('已登出。数据保留在本机。');
      });
      ov.addEventListener('mousedown', e => { if (e.target === ov) ov.remove(); });
    }
  }

  // ================= 启动欢迎屏（首次使用引导） =================
  const WEL_ICONS = {
    book: '<svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 5.5V21a2.5 2.5 0 0 1 2.5-2.5H20"/><path d="M8.5 7.5h7"/></svg>',
    pen: '<svg viewBox="0 0 24 24"><path d="M3 17.5L17.2 3.3a2.4 2.4 0 0 1 3.4 3.4L6.4 21 3 21z"/><path d="M14.5 6l3.5 3.5"/><path d="M6 21v-2"/></svg>'
  };
  const WEL_FEATS = [
    ['projects', '多企划并行', '小说 / 游戏 / OC 各占一棵树，互不打扰'],
    ['book', '卷章与字数', '卷 / 章两级大纲树，粘贴正文自动统计字数'],
    ['pen', '无限画布', '文字、手写、图片随意摆，可连线、一键导图'],
    ['idea', '灵感箱', '想到就记一句，随时沉淀成正式条目'],
    ['marks', '标记与逻辑线', '荧光划重点，沿线走一遍就能查出伏笔疏漏'],
    ['ai', 'AI 与云端', '问答你的作品、逻辑体检，登录后多端同步']
  ];
  function showWelcome() {
    const old = document.getElementById('welcomex');
    if (old) old.remove();
    /* v13：欢迎屏 → galgame 标题画面 */
    const ov = el('div', 'tscr');
    ov.id = 'welcomex';
    const hasData = IP2.projects().length > 0;
    const fig = (typeof MASCOT !== 'undefined' && MASCOT.full)
      ? '<div class="tscr-fig"><img class="tscr-full" src="' + MASCOT.full + '" alt="镜梦菱 · 梦梦" draggable="false"><div class="tscr-figname">镜梦菱 · 梦梦</div></div>'
      : (typeof MASCOT !== 'undefined' && MASCOT.figure
        ? '<div class="tscr-fig"><div class="tscr-frame"><img src="' + MASCOT.figure + '" alt="镜梦菱 · 梦梦" draggable="false"><i>♥</i></div><div class="tscr-figname">镜梦菱 · 梦梦</div></div>' : '');
    ov.innerHTML =
      '<div class="tscr-bg"></div>' + fig +
      '<div class="tscr-logo">' + logoSVG() +
        '<div class="tscr-jp">' + wordmarkSVG('tscr-wm') + '</div>' +
        '<div class="tscr-en">' + BRAND_EN + '</div></div>' +
      '<div class="tscr-menu">' +
        '<div class="tmi' + (hasData ? '' : ' dim') + '" data-a="cont">CONTINUE<span>继续创作</span></div>' +
        '<div class="tmi" data-a="new">NEW GAME<span>新的开始</span></div>' +
        (hasData ? '' : '<div class="tmi" data-a="seed">EXTRA<span>先逛逛示例</span></div>') +
        '<div class="tmi" data-a="tour">TUTORIAL<span>跟着引导走</span></div>' +
        '<div class="tmi" data-a="sys">SYSTEM<span>设置与数据</span></div>' +
      '</div>' +
      '<div class="tscr-press">— PRESS TO START —</div>' +
      '<div class="tscr-ver">筑梦之境 · 内容只保存在这台设备</div>';
    document.body.appendChild(ov);
    const close = (after) => { ov.remove(); go('projects'); if (after) setTimeout(after, 380); };
    // 新人必读：任何一条进入主界面的路径，落地后都强制补一次引导
    const guide = () => setTimeout(() => IPOnboard.requireIfFresh(), 420);
    ov.querySelectorAll('.tmi').forEach(m => m.addEventListener('click', () => {
      const a = m.dataset.a;
      if (a === 'cont') close(guide);
      else if (a === 'new') close(() => {
        setTimeout(guide, 250); // 先看引导，第 2 步正好教「+ 新建企划」
      });
      else if (a === 'seed') {
        IP2.resetAll(IP2SEED.build());
        ov.remove(); go('projects'); render();
        toast('已载入一套示例：一个企划 + 三页文稿。随便逛，随时可在「数据」页清掉。');
        guide();
      }
      else if (a === 'tour') { ov.remove(); go('today'); setTimeout(() => IPOnboard.start(), 260); }
      else if (a === 'sys') { ov.remove(); go('settings'); guide(); }
    }));
    ov.querySelector('.tscr-bg').addEventListener('click', () => close(guide));
  }

  return { init, go, reload, reloadTab, refreshContent, showTags, jumpAnno, jumpWord, jumpEntry, toast, renderAccount, renderSyncChip, showWelcome };
})();
