/* vn13.js —— v13 galgame 交互语法：选项肢 / 章节过场 / 对话向导 / 存档槽 / 控制条 */
window.IPVN = (function () {
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; };
  const esc = s => { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; };
  const vprefs = () => { try { return JSON.parse(localStorage.getItem('ipStudioP2:prefs') || '{}'); } catch (e) { return {}; } };
  const fxOn = () => vprefs().fx !== false;

  /* ---------- 操作日志（控制条 LOG 用） ---------- */
  const _log = [];
  function log(label) {
    const d = new Date();
    const p2 = n => String(n).padStart(2, '0');
    _log.unshift({ t: p2(d.getHours()) + ':' + p2(d.getMinutes()), label });
    if (_log.length > 40) _log.pop();
  }
  function wrapStore() {
    if (typeof IP2 === 'undefined') return;
    const M = { delProject: '删除企划', delNode: '删除分支', delEntry: '删除条目', delPage: '删除页面',
      delChapter: '删除章节', delIdea: '删除灵感', delTemplate: '删除模板', delAsset: '删除资产',
      delEdge: '删除连线', delGoal: '删除目标', delTag: '删除标签',
      updIdea: '编辑灵感', resetAll: '载入数据', upProject: '更新企划', addProject: '新建企划' };
    Object.keys(M).forEach(k => {
      const f = IP2[k];
      if (typeof f !== 'function') return;
      IP2[k] = function () { log(M[k]); return f.apply(this, arguments); };
    });
  }

  /* ---------- ③ 选项肢弹窗 ---------- */
  function ask(msg, onOk, opts) {
    opts = opts || {};
    if (opts.danger && !opts.yes) opts.yes = '……删除它。';
    const ov = el('div', 'ov13');
    const q = el('div', 'ov13-q', esc(msg).replace(/\n/g, '<br>'));
    const opts13 = el('div', 'ov13-opts');
    const yes = el('div', 'opt13' + (opts.danger ? ' danger' : ''), esc(opts.yes || '就这样吧'));
    const no = el('div', 'opt13', '再想想');
    opts13.appendChild(yes); opts13.appendChild(no);
    const box = el('div', 'ov13-box'); box.appendChild(q); box.appendChild(opts13);
    ov.appendChild(box);
    document.body.appendChild(ov);
    const done = ok => { ov.remove(); document.removeEventListener('keydown', onKey); if (ok && onOk) onOk(); };
    const onKey = e => { if (e.key === 'Escape') done(false); };
    document.addEventListener('keydown', onKey);
    yes.addEventListener('click', () => done(true));
    no.addEventListener('click', () => done(false));
    ov.addEventListener('mousedown', e => { if (e.target === ov) done(false); });
  }

  /* ---------- ④ 章节标题卡过场 ---------- */
  let cutBusy = false;
  function cutin(name, idx) {
    if (cutBusy || !name) return;
    if (!cutOn()) return;
    cutBusy = true;
    const no = '— 第 ' + (idx || '✦') + ' 幕 —';
    const ov = el('div', 'cut13',
      '<div class="cut13-in"><div class="cut13-no">' + no + '</div>' +
      '<div class="cut13-nm">' + esc(name).split('').join(' ') + '</div>' +
      '<div class="cut13-ln"></div></div>');
    document.body.appendChild(ov);
    setTimeout(() => { ov.remove(); cutBusy = false; }, 950);
  }
  function cutOn() { const p = vprefs(); return p.fx !== false && p.cut !== false; }
  function cutSet(v) { try { const p = vprefs(); p.cut = v; localStorage.setItem('ipStudioP2:prefs', JSON.stringify(p)); } catch (e) {} }

  /* ---------- ② 今日页对话向导 ---------- */
  const LINES = {
    fresh: ['初次见面，我是梦梦。这里会替你记住每一个世界观、每一条逻辑线。', '先去「企划」立一个骨架吧，小说、游戏、OC 合集都可以哦。', '别担心做错——所有东西都能改，灵感本来就是这样长的。'],
    nogoal: ['今天也来看大家了。不过……还没有立打卡目标哦。', '去企划的「打卡」页立一个小目标吧，梦梦会每天替你数着。', '不用贪多，一天一页就很了不起了。'],
    zero: ['今天的字还一个都没落呢……要陪我一起开始吗？', '不用想结局，先写一句就好。梦梦在这里等着。', '深呼吸——打开那一页，写就完了。'],
    mid: ['有在好好推进哦，梦梦都看在眼里。', '歇一歇也可以，回来的时候我还在。', '今天的进度又长了一点，世界又圆了一点。'],
    done: ['今天的目标全部达成了！梦梦有好好记住哦♥', '连续的积累会让世界长大——今天就是证明。', '去休息吧，剩下的交给明天的你。']
  };
  function wizard(host, state) {
    const pool = LINES[state] || LINES.zero;
    let li = 0, timer = null;
    const w = el('div', 'vn13');
    const ch = (typeof MASCOT !== 'undefined' && MASCOT.figure)
      ? '<div class="vn13-ch"><img src="' + MASCOT.figure + '" alt="" draggable="false"><i class="vn13-h">♥</i></div>' : '';
    w.innerHTML = ch +
      '<div class="vn13-box"><div class="vn13-name">梦梦</div>' +
      '<div class="vn13-auto"><span class="vn13-a">AUTO</span><span class="vn13-s">SKIP</span></div>' +
      '<div class="vn13-txt"></div><div class="vn13-next">▼</div></div>';
    const txt = w.querySelector('.vn13-txt');
    const next = w.querySelector('.vn13-next');
    function show(i) {
      const s = pool[i % pool.length];
      clearInterval(timer);
      if (!fxOn()) { txt.textContent = s; return; }
      txt.textContent = ''; let p = 0;
      timer = setInterval(() => {
        p += 1; txt.textContent = s.slice(0, p);
        if (p >= s.length) clearInterval(timer);
      }, 38);
      txt.dataset.full = s;
    }
    next.addEventListener('click', () => { li++; show(li); });
    w.querySelector('.vn13-s').addEventListener('click', () => { clearInterval(timer); txt.textContent = txt.dataset.full || ''; });
    w.querySelector('.vn13-a').addEventListener('click', e => { e.target.classList.toggle('on'); });
    host.appendChild(w);
    show(0);
  }

  /* ---------- ⑤ 存档槽 ---------- */
  function summary() {
    try {
      const s = IP2.get();
      return (s.projects || []).length + ' 企划 · ' + (s.entries || []).length + ' 条目 · ' +
        (s.pages || []).length + ' 页 · ' + (s.chapters || []).length + ' 章';
    } catch (e) { return '--'; }
  }
  function slots(host) {
    const wrap = el('div', 'saverow13');
    for (let n = 1; n <= 3; n++) {
      let rec = null;
      try { rec = JSON.parse(localStorage.getItem('v13:slot' + n) || 'null'); } catch (e) {}
      const c = el('div', 'slot13' + (rec ? '' : ' empty'));
      c.innerHTML = '<div class="s13-tag"><b>SAVE 0' + n + '</b><span class="no">' + (rec ? '手动' : '--') + '</span></div>' +
        '<div class="s13-thumb">' + (rec ? esc(rec.summary) : '── 空 ──') + '</div>' +
        '<div class="s13-meta">' + (rec ? esc(rec.ts) : '--') + '</div>';
      const ops = el('div', 's13-ops');
      const bSave = el('button', 'mini', rec ? '覆盖保存' : '保存');
      bSave.addEventListener('click', () => {
        const doSave = () => {
          try {
            IP2.save(true);
            localStorage.setItem('v13:slot' + n, JSON.stringify({ ts: new Date().toLocaleString('zh-CN', { hour12: false }), summary: summary(), data: IP2.get() }));
            if (window.IPApp) { IPApp.toast('SAVE 0' + n + ' 已保存 ✦'); IPApp.reload(); }
          } catch (e) { if (window.IPApp) IPApp.toast('保存失败：' + e.message); }
        };
        if (rec) ask('SAVE 0' + n + ' 里已有存档（' + rec.ts + '），覆盖它？', doSave, { danger: false, yes: '覆盖它' });
        else doSave();
      });
      ops.appendChild(bSave);
      if (rec) {
        const bLoad = el('button', 'mini', '读取');
        bLoad.addEventListener('click', () => {
          ask('读取 SAVE 0' + n + '（' + rec.ts + '）？\n当前内容会被存档里的内容覆盖。建议先「下载备份文件」。', () => {
            IP2.resetAll(rec.data);
            if (window.IPApp) { IPApp.reload(); IPApp.toast('已读取 SAVE 0' + n); }
          }, { danger: false, yes: '读取它' });
        });
        ops.appendChild(bLoad);
      }
      c.appendChild(ops);
      wrap.appendChild(c);
    }
    host.appendChild(wrap);
  }

  /* ---------- ⑥ 右下角控制条 ---------- */
  let lastSave = '';
  function fab() {
    wrapStore();
    const bar = el('div', 'fabs13');
    const fA = el('div', 'fab13', '<i>⟳</i>AUTO');
    const fL = el('div', 'fab13', '<i>♡</i>LOG');
    const fJ = el('div', 'fab13', '<i>⇥</i>JUMP');
    bar.appendChild(fA); bar.appendChild(fL); bar.appendChild(fJ);
    document.body.appendChild(bar);
    fA.addEventListener('click', () => { fA.classList.add('on'); setTimeout(() => fA.classList.remove('on'), 900); if (window.IPApp) IPApp.toast('自动保存：一直开着呢，放心写♥'); });
    fL.addEventListener('click', () => panel('最近动了什么', _log.map(l => '<div class="log13-r"><span>' + l.t + '</span>' + esc(l.label) + '</div>').join('') || '<div class="log13-r">这一会儿还没动作哦</div>'));
    fJ.addEventListener('click', () => {
      const g = el('div', 'jump13');
      [['today', '今日'], ['projects', '企划'], ['marks', '标记'], ['idea', '灵感'], ['assets', '资产'], ['tpl', '模板库'], ['stats', '统计'], ['data', '数据'], ['settings', '设置']].forEach(([k, n], i) => {
        const it = el('div', 'jump13-i', '<b>0' + (i + 1) + '</b>' + n);
        it.addEventListener('click', () => { g.remove(); if (window.IPApp) IPApp.go(k); });
        g.appendChild(it);
      });
      const ov = el('div', 'ov13'); const box = el('div', 'jump13-box');
      box.appendChild(el('div', 'ov13-q', '要跳去哪一幕？')); box.appendChild(g);
      ov.appendChild(box); document.body.appendChild(ov);
      ov.addEventListener('mousedown', e => { if (e.target === ov) ov.remove(); });
    });
    setInterval(() => {
      try {
        const v = localStorage.getItem('ipStudioP2:saveAt') || '';
        if (lastSave && v && v !== lastSave) { fA.classList.add('pulse'); setTimeout(() => fA.classList.remove('pulse'), 1100); }
        if (v) lastSave = v;
      } catch (e) {}
    }, 1600);
  }
  function panel(title, html) {
    const old = document.querySelector('.log13'); if (old) { old.remove(); return; }
    const p = el('div', 'log13', '<div class="log13-t">' + esc(title) + '</div>' + html);
    document.body.appendChild(p);
    setTimeout(() => {
      const off = e => { if (!p.contains(e.target) && !e.target.closest('.fab13')) { p.remove(); document.removeEventListener('mousedown', off); } };
      document.addEventListener('mousedown', off);
    }, 10);
  }

  return { ask, cutin, cutOn, cutSet, wizard, slots, fab, log };
})();
