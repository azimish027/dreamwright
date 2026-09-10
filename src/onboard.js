/* onboard.js —— 交互式新手引导 + 更新日志 */
const IPOnboard = (function () {
  const TOUR_KEY = 'ipStudioP2:tour';
  const LOG_KEY = 'ipStudioP2:logseen';
  const VERSION = 'v9';

  const LOGS = [
    {
      v: 'v6', d: '2026-09-10', tag: '本次',
      items: [
        '全局排版层级化：标题 / 正文 / 数字三套字体分层，字号全部抬到可读线以上',
        '剩余组件补完：标记子条目容器、小按钮、搜索框与下拉、切换标签全部统一梦幻风',
        '侧栏与顶栏加装饰：毛玻璃、渐变描边、选中竖线、底部云朵与糖果分割线',
        '设置入口提到顶栏（齿轮按钮），一页管住外观 / 字体 / AI / 云端 / 数据',
        '空状态换成贴纸云朵 + 引导语，全站内容边距统一到 26px'
      ]
    },
    {
      v: 'v4f', d: '2026-09-09',
      items: [
        '产品正式定名「筑梦之境 Dreamwright」，品牌棱镜加入中心光点',
        '新增交互式新手引导：分 6 步带你认全核心入口',
        '新增更新日志面板与「关于」页（右上角 ? 进入）',
        '账号支持邮箱验证码登录，未接云端时演示模式直接回显验证码',
        '新增邀请码机制，注册时需要填写',
        '新增消息中心：打卡、备份、搁置企划等自动提醒'
      ]
    },
    {
      v: 'v4e', d: '2026-09-07',
      items: [
        '浮窗 / 分屏 / 无限画布 / AI 面板统一到新设计语言',
        '全站字符按钮换成统一线稿 SVG 图标',
        '画布工具条改为「图标 + 文字标签」分段式'
      ]
    },
    {
      v: 'v4d', d: '2026-09-07',
      items: [
        '内容呈现层全面 token 化：卡片、表格、日历、关系网、弹窗',
        '新增启动欢迎屏',
        '数据页升级为备份中心（6 项概况 + 4 张功能卡）',
        '新增 README 产品文档'
      ]
    },
    {
      v: 'v4c', d: '2026-09-07',
      items: [
        '顶栏与侧栏重做，电光蓝紫定为品牌色',
        '内嵌思源黑体子集，跨平台字体表现一致'
      ]
    },
    {
      v: 'v3', d: '2026-09-07',
      items: [
        '章节树：卷 / 章两级，粘贴正文自动统计字数',
        '工具与资产库、浮动视窗与分屏阅读',
        '无限画布：手写、连线、一键导图布局',
        'AI 检索与逻辑体检'
      ]
    }
  ];

  const STEPS = [
    {
      title: '欢迎来到筑梦之境',
      body: '接下来 6 步带你认全核心入口，十几秒就够。随时可跳过，之后在右上角 ? 里能重看。'
    },
    {
      sel: '.navitem[data-k="projects"]', goto: 'projects',
      title: '企划：你的每个 IP 一棵树',
      body: '小说、游戏企划、OC 合集各占一个企划，互不打扰。从这里进企划列表，点「+ 新建企划」就开始。'
    },
    {
      sel: '.searchwrap',
      title: '全局检索：找一个字就到',
      body: '像在编辑器里全局搜索一样。输入一个人名或地名，跨全部内容列出上下文，点一下直接跳到原文位置。'
    },
    {
      sel: '#aibtn',
      title: 'AI：问你的作品，也查逻辑漏洞',
      body: '可以问「某某在哪几章出现过」，也能跑一次逻辑体检，把没回收的伏笔、零出场的人物列出来。不填 Key 也能用本地检索。'
    },
    {
      sel: '.navitem[data-k="data"]', goto: 'data',
      title: '数据：一键备份带走',
      body: '所有数据都在本机浏览器里。这里能导出成 JSON 文件，也能从文件恢复。换设备、清缓存前记得先导出一次。'
    },
    {
      title: '就这些，开始吧',
      body: '剩下的边用边摸索。右上角 ? 里随时能重看这份引导、查看更新日志。祝你写得顺手。'
    }
  ];

  let idx = 0, ov = null;

  function version() { return VERSION; }

  // ---------------- 新手引导 ----------------
  function start() {
    idx = 0;
    build();
    show();
  }

  function build() {
    finish(true);
    ov = document.createElement('div');
    ov.className = 'tourov';
    ov.id = 'tourov';
    ov.innerHTML =
      '<div class="tour-hole" id="tourhole"></div>' +
      '<div class="tour-card" id="tourcard">' +
        (typeof MASCOT !== 'undefined' && MASCOT.heart ? '<img class="tour-mascot" src="' + MASCOT.heart + '" alt="" draggable="false">' : '') +
        '<div class="tour-step" id="tourstep"></div>' +
        '<div class="tour-t" id="tourt"></div>' +
        '<div class="tour-b" id="tourb"></div>' +
        '<div class="tour-ft"><span class="tour-dots" id="tourdots"></span>' +
        '<span class="tour-act">' +
          '<button class="tour-skip" id="tour_skip">跳过</button>' +
          '<button class="no" id="tour_prev">上一步</button>' +
          '<button class="ok" id="tour_next">下一步</button>' +
        '</span></div>' +
      '</div>';
    document.body.appendChild(ov);
    document.getElementById('tour_skip').addEventListener('click', () => finish());
    document.getElementById('tour_prev').addEventListener('click', () => { if (idx > 0) { idx--; show(); } });
    document.getElementById('tour_next').addEventListener('click', () => {
      if (idx >= STEPS.length - 1) finish(); else { idx++; show(); }
    });
  }

  function show() {
    if (!ov) return;
    const s = STEPS[idx];
    if (s.goto) { try { IPApp.go(s.goto); } catch (e) { } }
    setTimeout(() => {
      if (!ov) return;
      const t = s.sel ? document.querySelector(s.sel) : null;
      const hole = document.getElementById('tourhole');
      const card = document.getElementById('tourcard');
      if (t) {
        t.scrollIntoView({ block: 'center', behavior: 'smooth' });
        const r = t.getBoundingClientRect();
        hole.style.display = 'block';
        hole.style.left = (r.left - 6) + 'px';
        hole.style.top = (r.top - 6) + 'px';
        hole.style.width = (r.width + 12) + 'px';
        hole.style.height = (r.height + 12) + 'px';
        place(card, r);
      } else {
        hole.style.display = 'none';
        place(card, null);
      }
      document.getElementById('tourstep').textContent = '第 ' + (idx + 1) + ' / ' + STEPS.length + ' 步';
      document.getElementById('tourt').textContent = s.title;
      document.getElementById('tourb').textContent = s.body;
      document.getElementById('tourdots').innerHTML = STEPS.map((_, i) =>
        '<i class="' + (i === idx ? 'on' : (i < idx ? 'done' : '')) + '"></i>').join('');
      const prev = document.getElementById('tour_prev');
      prev.style.visibility = idx === 0 ? 'hidden' : 'visible';
      document.getElementById('tour_next').textContent = idx >= STEPS.length - 1 ? '开始使用' : '下一步';
    }, s.goto ? 240 : 40);
  }

  function place(card, r) {
    const cw = Math.min(340, window.innerWidth - 32);
    card.style.width = cw + 'px';
    if (!r) {
      card.style.left = '50%';
      card.style.top = '50%';
      card.style.transform = 'translate(-50%,-50%)';
      return;
    }
    card.style.transform = 'none';
    const ch = card.offsetHeight || 190;
    let left = r.left + r.width / 2 - cw / 2;
    left = Math.max(16, Math.min(left, window.innerWidth - cw - 16));
    let top = r.bottom + 14;
    if (top + ch > window.innerHeight - 16) top = r.top - ch - 14;
    if (top < 16) top = Math.max(16, (window.innerHeight - ch) / 2);
    card.style.left = left + 'px';
    card.style.top = top + 'px';
  }

  function finish(silent) {
    if (ov) { ov.remove(); ov = null; }
    if (silent) return;
    try { localStorage.setItem(TOUR_KEY, VERSION); } catch (e) { }
    try { IPApp.go('today'); } catch (e) { }
    if (window.IPNotice) {
      IPNotice.push({
        id: 'tour-done', type: 'sys',
        title: '引导看完了',
        body: '想再看一遍，点右上角 ? →「新手引导」。',
        action: 'tour'
      });
      IPNotice.refresh();
    }
  }

  function seenTour() {
    try { return localStorage.getItem(TOUR_KEY) === VERSION; } catch (e) { return false; }
  }

  // ---------------- 更新日志 ----------------
  function changelog() {
    const old = document.getElementById('logdlg');
    if (old) old.remove();
    const ovl = document.createElement('div');
    ovl.className = 'overlay';
    ovl.id = 'logdlg';
    const d = document.createElement('div');
    d.className = 'dlg dlg-log';
    const body = LOGS.map(g =>
      '<div class="log-g' + (g.tag ? ' now' : '') + '">' +
        '<div class="log-hd"><b>' + g.v + (g.tag ? '<i>' + g.tag + '</i>' : '') + '</b><span>' + g.d + '</span></div>' +
        '<ul class="log-ul">' + g.items.map(t => '<li>' + t + '</li>').join('') + '</ul>' +
      '</div>').join('');
    d.innerHTML = '<h3>更新日志</h3>' +
      '<div class="log-note">当前版本 ' + VERSION + ' · 每次更新后这里会多一条</div>' +
      '<div class="log-body">' + body + '</div>' +
      '<div class="btns"><button class="no" id="log_tour">重看新手引导</button><button class="ok" id="log_x">知道了</button></div>';
    ovl.appendChild(d);
    document.body.appendChild(ovl);
    document.getElementById('log_x').addEventListener('click', () => ovl.remove());
    document.getElementById('log_tour').addEventListener('click', () => { ovl.remove(); start(); });
    ovl.addEventListener('mousedown', e => { if (e.target === ovl) ovl.remove(); });
    try { localStorage.setItem(LOG_KEY, VERSION); } catch (e) { }
  }

  // 版本变化时，往消息中心推一条（不强制弹窗，避免打扰）
  function maybeAuto() {
    let seen = '';
    try { seen = localStorage.getItem(LOG_KEY) || ''; } catch (e) { }
    if (seen === VERSION) return;
    try { localStorage.setItem(LOG_KEY, VERSION); } catch (e) { }
    if (seen === '') return; // 全新安装：不推旧版本消息
    setTimeout(() => {
      if (document.getElementById('welcomex')) return;
      if (window.IPNotice) {
        IPNotice.push({
          id: 'log-' + VERSION, type: 'sys',
          title: '筑梦之境 更新到 ' + VERSION,
          body: '这一版加入了新手引导、更新日志、消息中心，以及验证码登录与邀请码。',
          action: 'changelog'
        });
        IPNotice.refresh();
      }
    }, 900);
  }

  return { start, changelog, maybeAuto, version, seenTour };
})();
