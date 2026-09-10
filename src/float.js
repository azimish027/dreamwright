/* float.js —— 浮动视窗：任意对象开小窗对照 + 1 / 2 / 4 分屏并排阅读 */
window.IPFloat = (function () {
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; };
  function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }

  const KINDS = { chapter: '章节', entry: '条目', page: '页面', asset: '资产', tag: '标签', line: '逻辑线' };

  let wins = [];
  let seq = 1, zTop = 1000;
  let layer = null;
  let split = null;   // {n, panes:[{kind,ref,title}|null]}

  function ensureLayer() {
    if (layer && layer.parentNode) return layer;
    layer = el('div', 'floatlayer');
    layer.id = 'floatlayer';
    document.body.appendChild(layer);
    return layer;
  }

  // ---------- 持久化 ----------
  function save() {
    IP2.setLayout('floatwin', {
      wins: wins.map(w => ({ id: w.id, kind: w.kind, ref: w.ref, title: w.title, x: w.x, y: w.y, w: w.w, h: w.h, min: !!w.min }))
    });
  }
  function saveSplit() { IP2.setLayout('split', split ? { n: split.n, panes: split.panes } : { n: 0, panes: [] }); }

  function init() {
    const lw = IP2.layout('floatwin');
    if (lw && lw.payload && Array.isArray(lw.payload.wins)) {
      wins = lw.payload.wins.filter(w => w && w.kind && w.ref);
      wins.forEach(w => { const m = /^w(\d+)$/.exec(w.id || ''); if (m) seq = Math.max(seq, (+m[1]) + 1); });
      wins.forEach(w => { w.z = ++zTop; });
    }
    const ls = IP2.layout('split');
    if (ls && ls.payload && ls.payload.n) split = { n: ls.payload.n, panes: ls.payload.panes || [] };
    ensureLayer();
    renderWins();
    renderSplit();
  }

  function label(kind, ref) {
    if (kind === 'chapter') { const c = IP2.chapter(ref); return c ? c.name : '章节'; }
    if (kind === 'entry') { const e = IP2.entry(ref); return e ? e.title : '条目'; }
    if (kind === 'page') { const p = IP2.page(ref); return p ? p.name : '页面'; }
    if (kind === 'asset') { const a = IP2.asset(ref); return a ? a.name : '资产'; }
    if (kind === 'tag') { const t = IP2.tag(ref); return t ? t.name : '标签'; }
    if (kind === 'line') { const l = IP2.line(ref); return l ? l.name : '逻辑线'; }
    if (kind === 'block') { const b = IP2.block(ref); return b ? ((b.text || '').split('\n')[0].slice(0, 14) || '草稿块') : '草稿块'; }
    return '窗口';
  }

  // ================= 浮窗 =================
  function open(kind, ref, title) {
    ensureLayer();
    const ex = wins.find(w => w.kind === kind && w.ref === ref);
    if (ex) { ex.min = false; bring(ex); renderWins(); return; }
    const n = wins.filter(w => !w.min).length;
    const w = {
      id: 'w' + (seq++), kind, ref, title: title || label(kind, ref),
      x: Math.min(56 + n * 34, Math.max(16, window.innerWidth - 500)),
      y: Math.min(78 + n * 30, Math.max(16, window.innerHeight - 360)),
      w: 460, h: 340, min: false, z: ++zTop
    };
    wins.push(w); save(); renderWins();
  }

  function bring(w) {
    w.z = ++zTop;
    const n = layer && layer.querySelector('.fwin[data-id="' + w.id + '"]');
    if (n) n.style.zIndex = w.z;
    save();
  }

  function renderWins() {
    ensureLayer();
    layer.innerHTML = '';
    if (!wins.length) { layer.style.display = 'none'; return; }
    layer.style.display = 'block';

    const tb = el('div', 'floatbar');
    tb.appendChild(el('span', '', '浮窗 ' + wins.length));
    const bm = el('button', '', '全部收起');
    bm.addEventListener('click', () => { wins.forEach(w => { w.min = true; }); save(); renderWins(); });
    const bx = el('button', '', '全部关闭');
    bx.addEventListener('click', () => { wins = []; save(); renderWins(); });
    tb.appendChild(bm); tb.appendChild(bx);
    layer.appendChild(tb);

    let mi = 0;
    wins.forEach(w => { layer.appendChild(w.min ? minBar(w, mi++) : winEl(w)); });
  }

  function winEl(w) {
    const n = el('div', 'fwin');
    n.dataset.id = w.id;
    n.style.left = w.x + 'px'; n.style.top = w.y + 'px';
    n.style.width = w.w + 'px'; n.style.height = w.h + 'px';
    n.style.zIndex = w.z || 1000;

    const hd = el('div', 'fwin-hd');
    hd.innerHTML = '<span class="fwin-t"><i>' + (KINDS[w.kind] || '') + '</i>' + esc(w.title) + '</span>';
    const ops = el('span', 'fwin-op');
    const bMin = el('button'); bMin.innerHTML = IPUI.ic('minus'); bMin.className = 'op';
    bMin.title = '收起';
    bMin.addEventListener('click', () => { w.min = true; save(); renderWins(); });
    const bSp = el('button'); bSp.innerHTML = IPUI.ic('split'); bSp.className = 'op';
    bSp.title = '送进分屏';
    bSp.addEventListener('click', () => addToSplit(w.kind, w.ref, w.title));
    const bX = el('button'); bX.innerHTML = IPUI.ic('close'); bX.className = 'op';
    bX.title = '关闭';
    bX.addEventListener('click', () => { wins = wins.filter(x => x.id !== w.id); save(); renderWins(); });
    ops.appendChild(bMin); ops.appendChild(bSp); ops.appendChild(bX);
    hd.appendChild(ops);
    n.appendChild(hd);

    const bd = el('div', 'fwin-b');
    bd.appendChild(content(w.kind, w.ref));
    n.appendChild(bd);

    const rs = el('div', 'fwin-rs');
    n.appendChild(rs);

    n.addEventListener('pointerdown', () => bring(w));
    drag(n, hd, w); resize(n, rs, w);
    return n;
  }

  function minBar(w, i) {
    const n = el('div', 'fwin min');
    n.style.left = (12 + i * 190) + 'px';
    n.style.bottom = '12px';
    n.appendChild(el('span', 'fmin-t', esc(w.title)));
    const b = el('button'); b.innerHTML = IPUI.ic('restore'); b.title = '展开';
    b.addEventListener('click', () => { w.min = false; bring(w); renderWins(); });
    const x = el('button'); x.innerHTML = IPUI.ic('close'); x.title = '关闭';
    x.addEventListener('click', () => { wins = wins.filter(a => a.id !== w.id); save(); renderWins(); });
    n.appendChild(b); n.appendChild(x);
    return n;
  }

  function drag(node, handle, w) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      const sx = e.clientX, sy = e.clientY, ox = w.x, oy = w.y;
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      const mv = (ev) => {
        w.x = Math.max(0, Math.min(window.innerWidth - 90, ox + ev.clientX - sx));
        w.y = Math.max(0, Math.min(window.innerHeight - 42, oy + ev.clientY - sy));
        node.style.left = w.x + 'px'; node.style.top = w.y + 'px';
      };
      const up = () => { handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); save(); };
      handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', up);
      e.preventDefault();
    });
  }

  function resize(node, handle, w) {
    handle.addEventListener('pointerdown', (e) => {
      const sx = e.clientX, sy = e.clientY, ow = w.w, oh = w.h;
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      const mv = (ev) => {
        w.w = Math.max(260, Math.min(window.innerWidth - 40, ow + ev.clientX - sx));
        w.h = Math.max(160, Math.min(window.innerHeight - 60, oh + ev.clientY - sy));
        node.style.width = w.w + 'px'; node.style.height = w.h + 'px';
      };
      const up = () => { handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); save(); };
      handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', up);
      e.stopPropagation(); e.preventDefault();
    });
  }

  // ================= 内容渲染 =================
  function content(kind, ref) {
    const box = el('div', 'fcont');
    if (kind === 'chapter') return chContent(box, ref);
    if (kind === 'entry') return enContent(box, ref);
    if (kind === 'page') return pgContent(box, ref);
    if (kind === 'asset') return asContent(box, ref);
    if (kind === 'tag') return tgContent(box, ref);
    if (kind === 'line') return lnContent(box, ref);
    box.appendChild(el('div', 'fhint', '未知内容类型'));
    return box;
  }

  function miss(box, txt) { box.appendChild(el('div', 'fhint', txt || '这个内容已经被删掉了。')); return box; }
  function pills(arr) {
    return el('div', 'ftags', (arr || []).map(t => '<span class="tagpill">' + esc(t) + '</span>').join(''));
  }

  function chContent(box, ref) {
    const c = IP2.chapter(ref);
    if (!c) return miss(box);
    const st = IP2.chStatus(c.status);
    box.innerHTML = '<h4>' + esc(c.name) + '</h4>';
    const meta = el('div', 'fmeta');
    meta.innerHTML = '<span class="chst" style="color:' + st.color + ';border-color:' + st.color + '">' + st.label + '</span>' +
      '<span>' + (Number(c.words) || 0) + ' 字</span>';
    box.appendChild(meta);
    if (c.summary) box.appendChild(el('div', 'ftxt', esc(c.summary)));
    if ((c.tags || []).length) box.appendChild(pills(c.tags));
    const chars = (c.chars || []).map(id => { const a = IP2.asset(id); return a ? a.name : ''; }).filter(Boolean);
    if (chars.length) box.appendChild(el('div', 'ftags', '<b>出场：</b>' + chars.map(esc).join('、')));
    if (c.text) box.appendChild(el('div', 'fbody', esc(c.text.slice(0, 3000))));
    const b = el('button', 'fbtn', '打开完整编辑');
    b.addEventListener('click', () => IPCh.chapterDlg(ref));
    box.appendChild(b);
    return box;
  }

  function enContent(box, ref) {
    const e = IP2.entry(ref);
    if (!e) return miss(box);
    box.innerHTML = '<h4>' + esc(e.title) + '</h4>';
    const fk = Object.keys(e.fields || {}).filter(k => (e.fields[k] || '').trim());
    fk.forEach(k => {
      const r = el('div', 'frow');
      r.innerHTML = '<i>' + esc(k) + '</i>' + esc(String(e.fields[k]));
      box.appendChild(r);
    });
    if (e.body) box.appendChild(el('div', 'fbody', esc(e.body)));
    if ((e.tags || []).length) box.appendChild(pills(e.tags));
    const b = el('button', 'fbtn', '打开完整编辑');
    b.addEventListener('click', () => IPProj.entryDlg(ref));
    box.appendChild(b);
    return box;
  }

  function pgContent(box, ref) {
    const p = IP2.page(ref);
    if (!p) return miss(box);
    box.innerHTML = '<h4>' + esc(p.name) + '</h4>';
    const txt = (p.segments || []).join('\n');
    if (txt.trim()) box.appendChild(el('div', 'fbody', esc(txt)));
    else box.appendChild(el('div', 'fhint', '这一页还没有文字。'));
    const b = el('button', 'fbtn', '跳到原页面');
    b.addEventListener('click', () => IPProj.openPageGlobal(ref));
    box.appendChild(b);
    return box;
  }

  function asContent(box, ref) {
    const a = IP2.asset(ref);
    if (!a) return miss(box);
    const dot = el('span', 'tagdot'); dot.style.background = IPAssets.catColor(a.cat);
    const h = el('h4', 'fh4');
    h.appendChild(dot);
    h.appendChild(el('span', '', ' ' + esc(a.name)));
    box.appendChild(h);
    const meta = el('div', 'fmeta');
    meta.innerHTML = '<span>' + esc(IPAssets.catName(a.cat)) + '</span>' + (a.kind ? '<span>' + esc(a.kind) + '</span>' : '');
    box.appendChild(meta);
    if (a.body) box.appendChild(el('div', 'fbody', esc(a.body)));
    const b = el('button', 'fbtn', '打开完整编辑');
    b.addEventListener('click', () => IPAssets.assetDlg(ref));
    box.appendChild(b);
    return box;
  }

  function tgContent(box, ref) {
    const t = IP2.tag(ref);
    if (!t) return miss(box);
    box.innerHTML = '<h4>标签 · ' + esc(t.name) + '</h4>';
    const hits = IP2.annosOfTagMerged(t.id);
    box.appendChild(el('div', 'fhint', '文稿标记 ' + hits.length + ' 处'));
    hits.slice(0, 12).forEach(h => {
      const r = el('div', 'fhrow');
      r.innerHTML = '<i>' + esc(h.pageName) + '</i>' + esc(h.snip || h.a.text || '');
      r.addEventListener('click', () => IPApp.jumpAnno(h.a));
      box.appendChild(r);
    });
    const chs = IP2.get().chapters.filter(c => (c.tags || []).indexOf(t.name) >= 0);
    if (chs.length) {
      box.appendChild(el('div', 'fhint', '关联章节 ' + chs.length + ' 章'));
      chs.forEach(c => {
        const r = el('div', 'fhrow');
        r.innerHTML = '<i>章节</i>' + esc(c.name);
        r.addEventListener('click', () => IPCh.chapterDlg(c.id));
        box.appendChild(r);
      });
    }
    return box;
  }

  function lnContent(box, ref) {
    const l = IP2.line(ref);
    if (!l) return miss(box);
    box.innerHTML = '<h4>' + esc(l.name) + '</h4>';
    (l.nodes || []).forEach((n, i) => {
      const r = el('div', 'fhrow');
      let txt = '', jump = null;
      if (n.kind === 'chapter') { const c = IP2.chapter(n.ref); txt = c ? c.name : '（已删除）'; jump = c ? () => IPCh.chapterDlg(c.id) : null; }
      else if (n.kind === 'tag') { const t = IP2.tag(n.ref); txt = t ? '标签 · ' + t.name : '（已删除）'; jump = t ? () => open('tag', t.id, t.name) : null; }
      else { const a = IP2.anno(n.ref); txt = a ? (a.text || '标记') : '（已删除）'; jump = a ? () => IPApp.jumpAnno(a) : null; }
      r.innerHTML = '<b>' + (i + 1) + '</b>' + esc(txt);
      if (jump) r.addEventListener('click', jump);
      box.appendChild(r);
    });
    if (!(l.nodes || []).length) box.appendChild(el('div', 'fhint', '这条线上还没有点。'));
    return box;
  }

  // ================= 分屏 =================
  function openSplit(n) {
    const old = split ? split.panes : [];
    split = { n, panes: [] };
    for (let i = 0; i < n; i++) split.panes.push(old[i] || null);
    saveSplit(); renderSplit();
  }
  function closeSplit() { split = null; saveSplit(); renderSplit(); }

  function addToSplit(kind, ref, title) {
    if (!split) openSplit(2);
    const pane = { kind, ref, title: title || label(kind, ref) };
    const i = split.panes.findIndex(p => !p);
    if (i >= 0) split.panes[i] = pane; else split.panes[0] = pane;
    saveSplit(); renderSplit();
  }

  function renderSplit() {
    let host = document.getElementById('splitview');
    if (!split) { if (host) host.remove(); return; }
    if (!host) { host = el('div'); host.id = 'splitview'; document.body.appendChild(host); }
    host.className = 'splitview n' + split.n;
    host.innerHTML = '';
    const top = el('div', 'svtop');
    top.appendChild(el('b', '', '多视窗分屏'));
    [['单屏', 1], ['双屏', 2], ['四屏', 4]].forEach(([t, n]) => {
      const b = el('button', 'chip' + (split.n === n ? ' on' : ''), t);
      b.addEventListener('click', () => openSplit(n));
      top.appendChild(b);
    });
    const cx = el('button', 'chip', '关闭分屏');
    cx.addEventListener('click', closeSplit);
    top.appendChild(cx);
    host.appendChild(top);

    const grid = el('div', 'svgrid');
    split.panes.forEach((p, i) => grid.appendChild(paneEl(p, i)));
    host.appendChild(grid);
  }

  function paneEl(p, i) {
    const n = el('div', 'svpane');
    if (!p) {
      n.appendChild(el('div', 'svempty', '这一格还是空的～<b>选个内容放进来吧</b>'));
      const b = el('button', 'fbtn', '＋ 选择内容');
      b.addEventListener('click', () => pick(v => { split.panes[i] = v; saveSplit(); renderSplit(); }));
      n.appendChild(b);
      return n;
    }
    const hd = el('div', 'svhd');
    hd.appendChild(el('span', '', esc(p.title)));
    const ch = el('button'); ch.innerHTML = IPUI.ic('swap'); ch.title = '换一个内容';
    ch.addEventListener('click', () => pick(v => { split.panes[i] = v; saveSplit(); renderSplit(); }));
    const fl = el('button'); fl.innerHTML = IPUI.ic('split'); fl.title = '转成浮窗';
    fl.addEventListener('click', () => open(p.kind, p.ref, p.title));
    const cl = el('button'); cl.innerHTML = IPUI.ic('close'); cl.title = '清空这一格';
    cl.addEventListener('click', () => { split.panes[i] = null; saveSplit(); renderSplit(); });
    hd.appendChild(ch); hd.appendChild(fl); hd.appendChild(cl);
    n.appendChild(hd);
    const bd = el('div', 'svbody');
    bd.appendChild(content(p.kind, p.ref));
    n.appendChild(bd);
    return n;
  }

  function pick(cb) {
    const ov = el('div', 'overlay');
    ov.addEventListener('mousedown', e => { if (e.target === ov) ov.remove(); });
    const d = el('div', 'dlg');
    const groups = [];
    const push = (g, list, kind, f) => {
      if (!list.length) return;
      groups.push('<optgroup label="' + g + '">' + list.map(o => '<option value="' + kind + ':' + o.id + '">' + esc(f(o)) + '</option>').join('') + '</optgroup>');
    };
    push('章节', IP2.get().chapters, 'chapter', c => c.name);
    push('条目', IP2.get().entries, 'entry', e => e.title);
    push('页面', IP2.get().pages, 'page', p => p.name);
    push('资产', IP2.get().assets, 'asset', a => a.name);
    push('标签', IP2.tags(), 'tag', t => t.name);
    push('逻辑线', IP2.lines(), 'line', l => l.name);
    d.innerHTML = '<h3>选一个内容放进这一格</h3>' +
      '<div class="field"><select id="fp_sel">' + (groups.join('') || '<option>（还没有可选内容）</option>') + '</select></div>' +
      '<div class="btns"><button class="no" id="fp_c">取消</button><button class="ok" id="fp_ok">放进去</button></div>';
    ov.appendChild(d); document.body.appendChild(ov);
    document.getElementById('fp_c').addEventListener('click', () => ov.remove());
    document.getElementById('fp_ok').addEventListener('click', () => {
      const v = document.getElementById('fp_sel').value;
      if (!v || v.indexOf(':') < 0) return;
      const parts = v.split(':');
      const kind = parts[0], ref = parts.slice(1).join(':');
      ov.remove(); cb({ kind, ref, title: label(kind, ref) });
    });
  }

  // 顶栏菜单
  function menu(anchor) {
    let m = document.getElementById('floatmenu');
    if (m) { m.remove(); return; }
    m = el('div', 'floatmenu');
    m.id = 'floatmenu';
    [['单屏', 1], ['双屏', 2], ['四屏', 4]].forEach(([t, n]) => {
      const b = el('button', '', t + '（' + n + ' 格）');
      b.addEventListener('click', () => { m.remove(); openSplit(n); });
      m.appendChild(b);
    });
    if (split) {
      const b = el('button', '', '关闭分屏');
      b.addEventListener('click', () => { m.remove(); closeSplit(); });
      m.appendChild(b);
    }
    const r = anchor.getBoundingClientRect();
    m.style.top = (r.bottom + 6) + 'px';
    m.style.left = Math.max(8, r.right - 160) + 'px';
    document.body.appendChild(m);
    setTimeout(() => {
      const off = (e) => { if (!m.contains(e.target) && e.target !== anchor) { m.remove(); document.removeEventListener('mousedown', off); } };
      document.addEventListener('mousedown', off);
    }, 0);
  }

  return { init, open, openSplit, closeSplit, addToSplit, menu, count: () => wins.length };
})();
