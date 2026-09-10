/* editor.js —— 页面编辑器：正文渲染、选区标记打标签、便签、图层、跳转高亮 */
const IPEd = (function () {
  const HL = [
    { id: 'y', label: '荧光黄', cls: 'hl-y', css: '#f0b35c' },
    { id: 'p', label: '荧光粉', cls: 'hl-p', css: '#f082b4' },
    { id: 'b', label: '荧光蓝', cls: 'hl-b', css: '#6ea8ff' }
  ];
  const UL = [
    { id: 'y', label: '下划线', cls: 'ul-y', css: '#f0b35c' },
    { id: 'p', label: '下划线', cls: 'ul-p', css: '#f082b4' },
    { id: 'b', label: '下划线', cls: 'ul-b', css: '#6ea8ff' }
  ];
  const INK_COLORS = ['#ffffff', '#f0b35c', '#f082b4', '#6ea8ff', '#9ad37c'];

  let root = null;         // .content
  let curId = null;
  let state = { tool: 'point', inkColor: '#ffffff', inkSize: 2.6, inkPen: 'pen',
    showHl: true, showInk: true, showNote: true, autoMark: null };
  let rangebarEl = null, tagpopEl = null, popEl = null;
  let pending = null;      // 待应用的选区信息
  let dragNote = null;

  // ================= 渲染外壳 =================
  function open(pageId) {
    curId = pageId;
    const p = IP2.page(pageId);
    if (!p) { emptyState(); return; }
    root.innerHTML = '';
    const wrap = el('div', 'edwrap');
    wrap.appendChild(buildToolbar(p));
    if (p.kind === 'sheet') {
      const hint = el('div', 'hintbar');
      hint.innerHTML = '这是一张<b>草稿纸</b>：随意书写、贴便签；想记录成正式内容请新建「正文页」。';
      wrap.appendChild(hint);
    }
    const scroll = el('div', 'edscroll');
    const paper = el('div', 'paper');
    paper.id = 'paper';
    const pad = el('div', 'pagepad');
    pad.id = 'pagepad';
    if (p.kind === 'doc') pad.appendChild(buildText(p));
    pad.appendChild(buildNotesLayer(p));
    // 手写画布要盖在便签下（便签可拖）→ 画布 z4 便签 z5（见css）
    paper.appendChild(pad);
    const inkCanvas = el('canvas', 'inklayer');
    inkCanvas.dataset.pageId = p.id;
    paper.appendChild(inkCanvas);
    scroll.appendChild(paper);
    wrap.appendChild(scroll);
    root.appendChild(wrap);

    // 手写画布挂载
    const ink = new InkWrap(inkCanvas, p.id);
    paper._ink = ink;

    renderLayers(p);
    applyToolsUI();
    // 等待布局后刷新画布尺寸
    requestAnimationFrame(() => IInk.redraw(inkCanvas));
    window.addEventListener('resize', () => { if (curId === p.id && inkCanvas.isConnected) IInk.redraw(inkCanvas); });
    bindTextSelection(p);
  }

  function emptyState() {
    if (!root) return;
    const mm = (window.IPUI && IPUI.mascot('think')) || '<div class="big">✎</div>';
    root.innerHTML = `<div class="empty-editor">
      ${mm}
      <div style="text-align:center;line-height:2">
        <div>从左侧选一个页面打开</div>
        <div style="font-size:12px">或新建「正文页」（贴入你的文稿）或「草稿纸」（随手画）</div>
      </div>
    </div>`;
  }

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  // ================= 工具条 =================
  function buildToolbar(p) {
    const bar = el('div', 'edbar');
    const title = el('span', 'pgtitle');
    title.textContent = p.name;
    bar.appendChild(title);
    if (p.isDraft) { const dp = el('span', 'draftpill'); dp.textContent = '草稿'; bar.appendChild(dp); }

    // —— 选择/标记段 ——
    bar.appendChild(segBtn('point', '🖱', '指针', '选择文字做标记'));
    bar.appendChild(segBtn('note', '🗒', '便签', '在页面贴便签'));
    bar.appendChild(el('span', 'sep'));
    // 荧光色板（点一下=开启自动荧光，划选文字即上色；再点取消）
    HL.forEach(c => {
      const b = el('button', 'toolbtn hlbtn');
      b.dataset.c = c.id;
      b.title = '自动荧光：' + c.label + '（划选即上色）';
      b.innerHTML = `<span class="swatch" style="background:${c.css}"></span>`;
      b.addEventListener('click', () => {
        if (state.autoMark && state.autoMark.color === c.id) state.autoMark = null;
        else state.autoMark = { kind: 'hl', color: c.id };
        refreshToolbar();
      });
      bar.appendChild(b);
    });

    // —— 笔段 ——
    bar.appendChild(el('span', 'sep'));
    bar.appendChild(penBtn('pen', '✏', '画笔'));
    bar.appendChild(penBtn('hlp', '🖍', '荧光笔'));
    bar.appendChild(penBtn('eraser', '◌', '橡皮'));
    // 笔颜色
    INK_COLORS.forEach(c => {
      const b = el('button', 'toolbtn sw');
      b.style.padding = '0 5px';
      b.innerHTML = `<span class="swatch" style="background:${c}"></span>`;
      b.addEventListener('click', () => { state.inkColor = c; IInk.setConf({ color: c }); refreshToolbar(); });
      bar.appendChild(b);
    });
    // 粗细
    const sz = el('span', 'seg');
    [2, 5, 9].forEach((s, i) => {
      const b = el('button', 'toolbtn szbtn', ['细', '中', '粗'][i]);
      b.dataset.sz = s;
      b.addEventListener('click', () => { state.inkSize = s; IInk.setConf({ size: s }); refreshToolbar(); });
      sz.appendChild(b);
    });
    bar.appendChild(sz);

    // —— 图层开关 ——
    bar.appendChild(el('span', 'sep'));
    const lay = el('span', 'laytoggle');
    lay.innerHTML = `
      <label><input type="checkbox" data-l="showHl" checked> 高亮</label>
      <label><input type="checkbox" data-l="showInk" checked> 手写</label>
      <label><input type="checkbox" data-l="showNote" checked> 便签</label>`;
    lay.querySelectorAll('input').forEach(inp => {
      inp.checked = state[inp.dataset.l];
      inp.addEventListener('change', () => {
        state[inp.dataset.l] = inp.checked;
        renderLayers(p);
      });
    });
    bar.appendChild(lay);
    return bar;
  }

  function segBtn(id, ico, label, tip) {
    const b = el('button', 'toolbtn');
    b.id = 't-' + id;
    b.innerHTML = `<span>${ico}</span><span>${label}</span>`;
    b.title = tip;
    b.addEventListener('click', () => { state.tool = id; refreshToolbar(); });
    return b;
  }
  function penBtn(id, ico, label) {
    const b = el('button', 'toolbtn');
    b.id = 't-' + id;
    b.textContent = ico + ' ' + label;
    b.addEventListener('click', () => {
      state.tool = (state.tool === id ? 'point' : id);
      refreshToolbar();
    });
    return b;
  }

  function refreshToolbar() {
    const rootBar = root.querySelector('.edbar');
    if (!rootBar) return;
    rootBar.querySelectorAll('.toolbtn').forEach(b => b.classList.remove('on'));
    const active = ['point', 'note', 'pen', 'hlp', 'eraser'].find(x => state.tool === x);
    if (active) { const tb = rootBar.querySelector('#t-' + active); if (tb) tb.classList.add('on'); }
    // 自动荧光高亮按钮高亮
    rootBar.querySelectorAll('.hlbtn').forEach(b => {
      b.classList.toggle('on', !!(state.autoMark && state.autoMark.color === b.dataset.c));
    });
    // 画笔相关按钮显示/隐藏
    const inkish = ['pen', 'hlp', 'eraser'].includes(state.tool);
    rootBar.querySelectorAll('.sw').forEach(b => {
      b.style.display = inkish || state.tool === 'point' ? '' : 'none';
    });
    rootBar.querySelectorAll('.szbtn').forEach(b => {
      const on = b.dataset.sz == state.inkSize;
      b.classList.toggle('on', on && ['pen', 'hlp'].includes(state.tool));
    });
  }

  // ================= 正文构建 =================
  function buildText(p) {
    const wrap = el('div', 'ptext');
    wrap.id = 'ptext';
    wrap.dataset.pageId = p.id;
    const annos = IP2.annosOf(p.id);
    const segAnnos = {};
    annos.forEach(a => { (segAnnos[a.seg] = segAnnos[a.seg] || []).push(a); });

    p.segments.forEach((seg, i) => {
      const pEl = el('p', 'segitem');
      pEl.dataset.seg = i;
      const list = (segAnnos[i] || []).slice().sort((a, b) => a.start - b.start);
      const t = document.createTextNode(seg);
      if (!list.length) { pEl.appendChild(t); }
      else {
        let pos = 0;
        list.forEach(a => {
          if (a.start > pos) pEl.appendChild(document.createTextNode(seg.slice(pos, a.start)));
          const mk = document.createElement('mark');
          mk.dataset.aid = a.id;
          mk.className = a.kind === 'ul' ? markUlCls(a.color) : markHlCls(a.color);
          if (a.tagId) { const tag = IP2.tag(a.tagId); if (tag) { mk.dataset.tag = tag.name; mk.style.outline = '1px solid ' + (tag.color || 'transparent'); mk.style.outlineOffset = '1px'; } }
          mk.appendChild(document.createTextNode(seg.slice(a.start, a.end)));
          pEl.appendChild(mk);
          pos = a.end;
        });
        if (pos < seg.length) pEl.appendChild(document.createTextNode(seg.slice(pos)));
      }
      wrap.appendChild(pEl);
    });
    return wrap;
  }

  function markHlCls(c) { return 'hl-' + (HL.find(x => x.id === c) ? c : 'y'); }
  function markUlCls(c) { return 'ul-' + (UL.find(x => x.id === c) ? c : 'y'); }

  // 重建正文区（保留滚动位置与便签）
  function rebuildText() {
    const p = curId ? IP2.page(curId) : null;
    if (!p || !root) return;
    const old = root.querySelector('#ptext');
    if (!old) return;
    const scroll = root.querySelector('.edscroll');
    const top = scroll ? scroll.scrollTop : 0;
    const fresh = buildText(p);
    old.parentNode.replaceChild(fresh, old);
    // 重新绑定选区
    bindTextSelection(p);
    if (scroll) scroll.scrollTop = top;
    // 若为 doc 模式需重画墨迹到新画布？画布在 #ptext 之外，无需
    requestAnimationFrame(() => { const c = root.querySelector('.inklayer'); if (c) IInk.redraw(c); });
  }

  // ================= 便签层 =================
  function buildNotesLayer(p) {
    const layer = el('div', 'notelayer');
    layer.id = 'notelayer';
    renderNotes(p, layer);
    return layer;
  }

  function renderNotes(p, layer) {
    layer.innerHTML = '';
    const notes = IP2.notesOf(p.id);
    notes.forEach(n => {
      const card = el('div', 'note ' + n.color);
      card.dataset.nid = n.id;
      card.style.left = n.x + 'px';
      card.style.top = n.y + 'px';
      card.style.width = n.w + 'px';
      // 拖拽把手
      const x = el('div', 'x', '×');
      x.addEventListener('click', (e) => { e.stopPropagation(); IP2.delNote(n.id); dirty(); });
      const ta = el('textarea', 'txt2');
      ta.placeholder = '写点备注…';
      ta.value = n.text;
      ta.addEventListener('input', () => autoNote(ta, n));
      ta.addEventListener('blur', () => IP2.updNote(n.id, { text: ta.value }));
      const foot = el('div', 'foot');
      foot.innerHTML = '<button type="button" data-y="y">黄</button><button type="button" data-y="blue">蓝</button><button type="button" data-y="pink">粉</button><button type="button" data-y="green">绿</button>';
      foot.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        card.className = 'note n-' + b.dataset.y;
        IP2.updNote(n.id, { color: 'n-' + b.dataset.y });
      }));
      card.appendChild(x); card.appendChild(ta); card.appendChild(foot);
      // 拖拽（把手=顶部整条）
      card.addEventListener('pointerdown', (e) => {
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON' || e.target.classList.contains('x')) return;
        e.preventDefault();
        dragNote = { n, sx: e.clientX - n.x, sy: e.clientY - n.y, id: n.id };
        card.setPointerCapture(e.pointerId);
      });
      card.addEventListener('pointermove', (e) => {
        if (!dragNote || dragNote.id !== n.id) return;
        const padR = layer.getBoundingClientRect();
        n.x = Math.max(0, Math.min(e.clientX - dragNote.sx, padR.width - 40));
        n.y = Math.max(0, Math.min(e.clientY - dragNote.sy, padR.height - 30));
        card.style.left = n.x + 'px'; card.style.top = n.y + 'px';
      });
      const up = () => { if (dragNote && dragNote.id === n.id) { IP2.updNote(n.id, { x: n.x, y: n.y }); dragNote = null; } };
      card.addEventListener('pointerup', up);
      card.addEventListener('pointercancel', up);
      layer.appendChild(card);
    });
  }

  function autoNote(ta, n) {
    n.text = ta.value;
    const save = n.text;
    // 防抖存
    clearTimeout(n._t); n._t = setTimeout(() => IP2.updNote(n.id, { text: save }), 500);
  }

  // ================= 文本选择与标记 =================
  let pendingSel = null;

  function bindTextSelection(p) {
    const ptext = root.querySelector('#ptext');
    if (!ptext) return;
    const finish = () => {
      if (state.tool !== 'point') return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) { closeRangebar(); return; }
      const r = sel.getRangeAt(0);
      const pEl = closestSeg(r.startContainer);
      if (!pEl) { closeRangebar(); return; }
      const segIdx = +pEl.dataset.seg;
      const seg = p.segments[segIdx] || '';
      // 计算相对段落偏移（单段限制）
      const calc = (node, off) => {
        let cnt = 0, found = false;
        const walk = (nd) => {
          if (found) return;
          if (nd === node) { found = true; return; }
          if (nd.nodeType === 3) { cnt += nd.nodeValue.length; }
          else if (nd.nodeType === 1) { for (const c of nd.childNodes) walk(c); }
        };
        walk(pEl);
        return cnt + off;
      };
      let start, end;
      try {
        const stNode = r.startContainer, enNode = r.endContainer;
        if (!pEl.contains(stNode) || !pEl.contains(enNode)) { closeRangebar(); return; }
        start = calc(stNode, r.startOffset);
        end = calc(enNode, r.endOffset);
        if (end < start) { const t = start; start = end; end = t; }
        end = Math.min(end, seg.length);
        if (end - start < 1) { closeRangebar(); return; }
      } catch (e) { closeRangebar(); return; }
      pendingSel = { seg: segIdx, start, end, text: seg.slice(start, end) };
      if (state.autoMark) { commitMark(state.autoMark, p); return; }
      showRangebar(r, p);
    };
    ptext.addEventListener('mouseup', finish);
    ptext.addEventListener('touchend', (e) => { setTimeout(finish, 60); }, { passive: true });
    // 点 mark 弹出标签操作
    ptext.addEventListener('click', (e) => {
      const mk = e.target.closest('mark');
      if (mk && state.tool === 'point' && !pendingSel) {
        e.preventDefault();
        openAnnoPop(mk);
      }
    });
  }

  function closestSeg(node) {
    let n = node;
    while (n && n !== document.body) {
      if (n.classList && n.classList.contains('segitem')) return n;
      if (n.nodeType === 1 && n.dataset && n.dataset.seg !== undefined && n.classList.contains('segitem')) return n;
      n = n.parentElement;
    }
    return null;
  }

  function showRangebar(r, p) {
    closeRangebar();
    const paper = root.querySelector('#paper');
    if (!paper) return;
    const rb = el('div', 'rangebar');
    rb.id = 'rangebar';
    const rect = r.getBoundingClientRect();
    const pr = paper.getBoundingClientRect();
    // 6 个小按钮：3 荧光 + 3 下划线
    HL.forEach(c => {
      const b = el('button', '', `<span class="swatch" style="background:${c.css}"></span>`);
      b.title = c.label;
      b.addEventListener('click', () => commitMark({ kind: 'hl', color: c.id }, p));
      rb.appendChild(b);
    });
    rb.appendChild(el('span', 'rbhl'));
    UL.forEach(c => {
      const b = el('button', '', `<span style="border-bottom:3px solid ${c.css};padding:0 3px;font-size:11px">U</span>`);
      b.title = c.label;
      b.addEventListener('click', () => commitMark({ kind: 'ul', color: c.id }, p));
      rb.appendChild(b);
    });
    paper.appendChild(rb);
    rb.style.left = Math.max(6, Math.min(rect.left - pr.left, pr.width - rb.offsetWidth - 6)) + 'px';
    rb.style.top = Math.max(rect.top - pr.top - 44, 6) + 'px';
    const done = () => { closeRangebar(); document.removeEventListener('mousedown', done); };
    setTimeout(() => document.addEventListener('mousedown', done), 30);
  }

  function commitMark(style, p) {
    if (!pendingSel) return;
    const { seg, start, end, text } = pendingSel;
    pendingSel = null;
    closeRangebar();
    window.getSelection() && window.getSelection().removeAllRanges();
    // 追加 anno（暂不打标签）
    const a = IP2.addAnno(p.id, seg, start, end, style.kind, null);
    a.color = style.color;
    dirty();
    rebuildText();
    // 打开标签对话框
    openTagPop(a);
  }

  function openTagPop(a) {
    closePop(); closeRangebar();
    const p = IP2.page(a.pageId);
    if (!p) return;
    const tags = IP2.tags();
    const pop = el('div', 'tagpop');
    pop.id = 'tagpop';
    const cur = a.tagId ? IP2.tag(a.tagId) : null;
    const shown = IP2.anno(a.id) ? p.segments[a.seg].slice(a.start, a.end) : '';
    pop.innerHTML = `<div class="tp-t">给这段打标签（可留空仅标记）：</div>`;
    const snippet = el('div', 'tp-t');
    snippet.style.cssText = 'font-size:11px;color:var(--tx2);background:var(--bg3);border-radius:6px;padding:5px 8px;line-height:1.5;margin-bottom:7px';
    snippet.textContent = shown.length > 40 ? shown.slice(0, 40) + '…' : shown;
    pop.appendChild(snippet);
    const inp = el('input');
    inp.placeholder = '输入标签名，如：伏笔·身世';
    if (cur) inp.value = cur.name;
    pop.appendChild(inp);
    const sug = el('div', 'sug');
    tags.filter(t => !cur || t.id !== cur.id).slice(0, 12).forEach(t => {
      const s = el('span', '', t.name);
      s.addEventListener('click', () => { saveTag(t.id); });
      sug.appendChild(s);
    });
    pop.appendChild(sug);
    const btns = el('div', 'btns');
    const ok = el('button', 'tp-ok', cur ? '保存' : '打上标签');
    ok.addEventListener('click', () => { const t = IP2.ensureTag(inp.value.trim()); saveTag(t ? t.id : null); });
    const no = el('button', 'tp-cancel', '先不打了');
    no.title = '保留高亮，不挂标签';
    no.addEventListener('click', () => { closePop(); dirty(); });
    const del = el('button', 'tp-cancel', '撤销标记');
    del.title = '删除这条高亮/下划线';
    del.addEventListener('click', () => { IP2.delAnno(a.id); closePop(); dirty(); rebuildText(); });
    btns.appendChild(ok); btns.appendChild(no); btns.appendChild(del);
    pop.appendChild(btns);
    const paper = root.querySelector('#paper');
    if (!paper) { return; }
    paper.appendChild(pop);
    pop.style.left = '50%'; pop.style.top = '120px';
    pop.style.transform = 'translateX(-50%)';
    inp.focus();
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok.click(); });
    function saveTag(tid) {
      const aa = IP2.anno(a.id);
      if (!aa) return;
      aa.tagId = tid;
      aa.color = tid ? (IP2.tag(tid) || {}).color : null;
      IP2.save(true); closePop(); dirty(); rebuildText();
    }
  }

  function openAnnoPop(mk) {
    closePop();
    const aid = mk.dataset.aid;
    const a = IP2.anno(aid);
    if (!a) return;
    const p = IP2.page(a.pageId);
    const pop = el('div', 'tagpop');
    pop.id = 'tagpop';
    const txt = el('div', 'tp-t', '已有标记：');
    pop.appendChild(txt);
    const seg2 = el('div', 'tp-t');
    seg2.style.cssText = 'font-size:11px;color:var(--tx2);background:var(--bg3);border-radius:6px;padding:5px 8px;line-height:1.5;margin-bottom:7px';
    seg2.textContent = (a.text || '').slice(0, 46);
    pop.appendChild(seg2);
    const lb = el('div', 'tp-t', '当前标签');
    pop.appendChild(lb);
    const sel2 = document.createElement('select');
    sel2.style.cssText = 'width:100%;margin-bottom:6px;background:var(--bg3);border:1px solid var(--line);border-radius:7px;height:30px;padding:0 6px;outline:none';
    const opt0 = el('option', '', '（无标签）'); opt0.value = ''; sel2.appendChild(opt0);
    IP2.tags().forEach(t => { const o = el('option', '', t.name); o.value = t.id; if (t.id === a.tagId) o.selected = true; sel2.appendChild(o); });
    pop.appendChild(sel2);
    const btns = el('div', 'btns');
    const ok = el('button', 'tp-ok', '保存');
    ok.addEventListener('click', () => {
      const aa = IP2.anno(aid);
      if (aa) { aa.tagId = sel2.value || null; aa.color = sel2.value ? (IP2.tag(sel2.value) || {}).color : null; IP2.save(true); }
      closePop(); dirty();
    });
    const del = el('button', 'tp-cancel', '解除标记');
    del.addEventListener('click', () => { IP2.delAnno(aid); closePop(); dirty(); rebuildText(); });
    btns.appendChild(ok); btns.appendChild(del);
    pop.appendChild(btns);
    const paper = root.querySelector('#paper');
    paper.appendChild(pop);
    const r = mk.getBoundingClientRect(), pr = paper.getBoundingClientRect();
    pop.style.left = Math.max(4, Math.min(r.left - pr.left, pr.width - pop.offsetWidth - 4)) + 'px';
    pop.style.top = Math.max(r.top - pr.top - pop.offsetHeight - 6, 4) + 'px';
  }

  function closeRangebar() { const e2 = root && root.querySelector('#rangebar'); if (e2) e2.remove(); }
  function closePop() { const e2 = root && root.querySelector('#tagpop'); if (e2) e2.remove(); }

  // ================= 手写 =================
  function InkWrap(canvas, pageId) {
    let strokes = [];
    function load() { strokes = IP2.strokesOf(pageId); }
    function saveStrokes() { /*strokes 由 store 保存*/ }
    load();
    IInk.setup(canvas, {
      conf: { color: state.inkColor, size: state.inkSize, pen: state.inkPen },
      onAdd: (st) => {
        if (state.tool === 'eraser') return; // 橡皮不进收笔
        st.pageId = pageId; st.id = 's' + Date.now().toString(36);
        IP2.addStroke(st);
      }
    });
    // 工具绑定：改写 canvas 行为
    canvas.addEventListener('pointerdown', (e) => {
      if (state.tool === 'eraser') {
        // 橡皮：用 store 原数组改
        const sts = IP2.get().strokes.filter(s => s.pageId === pageId);
        const r = canvas.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        const before = sts.length;
        // 从后往前找最近命中并删除
        const hitIdx = findHit(sts, x, y);
        if (hitIdx >= 0) {
          const real = IP2.get().strokes.findIndex(s => s === sts[hitIdx]);
          if (real >= 0) IP2.get().strokes.splice(real, 1);
          IP2.save(); IInk.redraw(canvas); dirty();
        }
        // 阻止普通笔画
        e.stopImmediatePropagation();
        e.preventDefault();
      } else if (state.tool === 'pen' || state.tool === 'hlp') {
        IInk.setConf({ color: state.inkColor, size: state.inkSize, pen: state.tool === 'hlp' ? 'hl' : 'pen' });
      } else {
        // point/note：该层不接管
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }, true);
    canvas.style.pointerEvents = state.showInk && ['pen', 'hlp', 'eraser'].includes(state.tool) ? 'auto' : 'none';
    // 保存层开关状态供切换工具时重设
    canvas._syncPointer = () => {
      canvas.style.pointerEvents = (state.tool === 'pen' || state.tool === 'hlp' || state.tool === 'eraser') ? 'auto' : 'none';
    };
  }

  function findHit(strokes, x, y) {
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i];
      if (!s.pts) continue;
      for (let j = 0; j < s.pts.length; j++) {
        if (Math.abs(s.pts[j].x - x) < 12 && Math.abs(s.pts[j].y - y) < 12) return i;
      }
      if (s.pts.length === 1) {
        const p0 = s.pts[0];
        if (Math.hypot(p0.x - x, p0.y - y) < 12) return i;
      }
    }
    return -1;
  }

  // ================= 图层 & 便签放置 =================
  function renderLayers(p) {
    const paper = root.querySelector('#paper');
    if (!paper) return;
    const hlLayer = paper.querySelector('#ptext');
    if (hlLayer) { hlLayer.style.opacity = state.showHl ? 1 : 0.25; hlLayer.style.pointerEvents = state.showHl ? 'auto' : 'none'; }
    const inkC = paper.querySelector('.inklayer');
    if (inkC) { inkC.style.display = state.showInk ? 'block' : 'none'; }
    const noteL = paper.querySelector('#notelayer');
    if (noteL) { noteL.classList.toggle('off', !state.showNote); }
    const inkCanvas = paper.querySelector('.inklayer');
    if (inkCanvas && inkCanvas._syncPointer) inkCanvas._syncPointer();
  }

  function applyToolsUI() {
    // 工具切换时刷新 pointer events
    requestAnimationFrame(() => {
      const paper = root.querySelector('#paper');
      if (!paper) return;
      const inkC = paper.querySelector('.inklayer');
      if (inkC && inkC._syncPointer) inkC._syncPointer();
      // note 工具提示
      const pad = paper.querySelector('#pagepad');
      pad.style.cursor = state.tool === 'note' ? 'copy' : 'default';
    });
  }

  // 便签点击放置（point/note 模式下空白点击）由 paper 统一处理
  function bindPaperClicks() {
    const paper = root.querySelector('#paper');
    if (!paper) return;
    paper.addEventListener('pointerdown', (e) => {
      if (state.tool !== 'note') return;
      const pad = root.querySelector('#pagepad');
      if (!pad) return;
      if (e.target.closest('.note')) return;
      const pr = pad.getBoundingClientRect();
      const x = Math.max(4, Math.min(e.clientX - pr.left - 20, pr.width - 200));
      const y = Math.max(4, Math.min(e.clientY - pr.top - 14, pr.height - 60));
      const p = IP2.page(curId);
      if (!p) return;
      const n = IP2.addNote(curId, x, y);
      dirty();
      state.tool = 'point';
      refreshToolbar();
      setTimeout(() => {
        const card = pad.querySelector('.note[data-nid="' + n.id + '"] textarea');
        if (card) card.focus();
      }, 50);
    }, true);
  }

  // ================= 跳转 & 闪烁 =================
  function flash(pageId, seg, at, len) {
    open(pageId);
    setTimeout(() => {
      const pEl = root.querySelector('.segitem[data-seg="' + seg + '"]');
      if (!pEl) return;
      const node = textNodeAtOffset(pEl, at, len);
      let markEl = null;
      if (node && node.nodeType === 1) markEl = node;
      if (node && node.nodeType === 3) {
        const mk = document.createElement('mark');
        mk.className = 'cur';
        const r = document.createRange();
        r.setStart(node, Math.max(0, at - offsetOfTextNode(pEl, node)));
        // 简单方案：包整个文本节点不行（会破坏原节点），用临时背景闪
        markEl = null;
        // 直接用 range 高亮字符并 scrollIntoView
        const range = document.createRange();
        range.setStart(node, 0);
        range.setEnd(node, Math.min(len, node.nodeValue.length));
        const wrapEl = document.createElement('span');
        wrapEl.style.cssText = 'background:rgba(240,179,92,.45);border-radius:2px';
        try {
          range.surroundContents(wrapEl);
          markEl = wrapEl;
        } catch (e) { markEl = null; }
      }
      if (markEl) {
        markEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        markEl.style.transition = 'none';
      } else {
        pEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 40);
  }

  function textNodeAtOffset(pEl, at, len) {
    // 遍历找出包含 at 的文本节点
    let cnt = 0;
    for (const nd of pEl.childNodes) {
      if (nd.nodeType === 3) {
        const s = nd.nodeValue.length;
        if (at < cnt + s) return nd;
        cnt += s;
      } else if (nd.nodeType === 1) {
        for (const c of nd.childNodes) {
          if (c.nodeType === 3) {
            const s = c.nodeValue.length;
            if (at < cnt + s) return c;
            cnt += s;
          }
        }
      }
    }
    return null;
  }
  function offsetOfTextNode(pEl, node) {
    let cnt = 0;
    for (const nd of pEl.childNodes) {
      if (nd === node) return cnt;
      if (nd.nodeType === 3) cnt += nd.nodeValue.length;
      else if (nd.nodeType === 1) for (const c of nd.childNodes) { if (c.nodeType === 3) { if (c === node) return cnt; cnt += c.nodeValue.length; } }
    }
    return cnt;
  }

  // ================= 杂项 =================
  function dirty() {
    window.dispatchEvent(new CustomEvent('ip2change'));
  }

  function current() { return curId; }
  function setRoot(r) { root = r; }
  function afterMount() {
    // 在挂载后绑定 paper 便签点击
    if (root) {
      root.addEventListener('pointerdown', (e) => {
        if (state.tool !== 'note') return;
        if (e.target.closest('.note') || e.target.closest('#rangebar') || e.target.closest('#tagpop')) return;
        const pad = root.querySelector('#pagepad');
        const paper = root.querySelector('#paper');
        if (!pad || !paper) return;
        if (!e.target.closest('#pagepad')) return;
        const pr = pad.getBoundingClientRect();
        const x = Math.max(4, Math.min(e.clientX - pr.left - 20, pr.width - 200));
        const y = Math.max(4, Math.min(e.clientY - pr.top - 10, pr.height - 50));
        const p = IP2.page(curId); if (!p) return;
        const n = IP2.addNote(curId, x, y);
        renderNotesLocal();
        state.tool = 'point'; refreshToolbar();
        e.preventDefault();
        setTimeout(() => { const ta2 = root.querySelector('.note[data-nid="' + n.id + '"] textarea'); if (ta2) ta2.focus(); }, 40);
      });
      root.addEventListener('pointermove', (e) => {
        if (state.tool === 'note') {
          const pad = root.querySelector('#pagepad');
          const legend = root.querySelector('.ink-legend');
          if (pad && pad.contains(e.target) && !e.target.closest('.note')) {
            const pr = pad.getBoundingClientRect();
            const x = Math.max(4, Math.min(e.clientX - pr.left - 20, pr.width - 200));
            const y = Math.max(4, Math.min(e.clientY - pr.top - 10, pr.height - 50));
            if (legend) { legend.style.left = x + 'px'; legend.style.top = y + 'px'; }
          }
        }
      });
    }
  }
  function renderNotesLocal() {
    const p = IP2.page(curId);
    if (!p) return;
    const layer = root.querySelector('#notelayer');
    if (layer) renderNotes(p, layer);
  }

  function tool() { return state; }

  return { setRoot, open, emptyState, current, flash, tool, afterMount, refreshToolbar, renderNotes: renderNotesLocal, refreshText: rebuildText };
})();
