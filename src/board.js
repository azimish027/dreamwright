// ===== v3 第 ③ 批：无限画布（board 页面类型） =====
// 无限平移缩放 + 块（文字/便签/图片/资产卡/章节卡/标签卡）+ 连线 + 一键导图布局 + 草稿转正
// 全程 Pointer Events，兼容鼠标 / 触屏 / 触控笔（三星平板为主力场景）
const IPBoard = (function () {
  let root = null, curId = null;
  let view = { x: 0, y: 0, k: 1 };          // 视口：偏移 + 缩放
  let mode = 'pick';                        // pick | link
  let linkFrom = null;                      // 连线模式起点块
  let selId = null;                         // 当前选中块
  let gridEl = null, vpEl = null, svgEl = null, zoomLabel = null;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function countWords(s) { return String(s || '').replace(/\s/g, '').length; }

  // ---------- 对外入口 ----------
  function open(host, pageId) {
    curId = pageId;
    const p = IP2.page(pageId);
    if (!p) { host.innerHTML = ''; return; }
    if (!p.board) p.board = { x: 40, y: 20, k: 1 };
    view = Object.assign({ x: 40, y: 20, k: 1 }, p.board || {});
    root = host;
    host.innerHTML = '';
    const wrap = el('div', 'boardwrap');
    wrap.appendChild(buildBar(p));
    vpEl = el('div', 'bviewport');
    gridEl = el('div', 'bgrid');
    svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.setAttribute('class', 'bedges');
    gridEl.appendChild(svgEl);
    vpEl.appendChild(gridEl);
    wrap.appendChild(vpEl);
    host.appendChild(wrap);
    renderBlocks();
    applyView();
    bindViewport();
  }

  function saveView() {
    const p = IP2.page(curId); if (!p) return;
    p.board = { x: Math.round(view.x), y: Math.round(view.y), k: +view.k.toFixed(3) };
    p.updated = Date.now();
    IP2.save(true);
  }

  // ---------- 工具条 ----------
  function buildBar(p) {
    const bar = el('div', 'bbar');
    const t = el('span', 'pgtitle'); t.textContent = p.name;
    bar.appendChild(t);
    if (p.isDraft) bar.appendChild(el('span', 'draftpill', '草稿'));

    const mk = (icn, label, tip, fn, id) => {
      const b = el('button', 'toolbtn');
      b.title = tip; if (id) b.id = id;
      b.innerHTML = (icn ? IPUI.ic(icn) : '') + (label ? '<span class="tb-lb">' + label + '</span>' : '');
      b.addEventListener('click', fn); return b;
    };
    bar.appendChild(mk('type', '文字', '添加文字块', () => addBlockCenter('text')));
    bar.appendChild(mk('sticky', '便签', '添加便签', () => addBlockCenter('sticky')));
    bar.appendChild(mk('pen', '手写', '添加手写块（触控笔直接在上面写）', () => addBlockCenter('sketch', { w: 340, h: 220 })));
    bar.appendChild(mk('image', '图片', '插入图片', pickImage));
    bar.appendChild(mk('card', '卡片', '从资产/章节/标签生成卡片', pickCard));
    const lk = mk('link', '连线', '连线模式：先点起点块，再点终点块', () => {
      mode = (mode === 'link') ? 'pick' : 'link'; linkFrom = null;
      refreshMode();
    }, 'b-link');
    bar.appendChild(lk);
    bar.appendChild(mk('mind', '导图', '按连线自动排成思维导图', mindLayout));
    const sp = el('span', 'seg'); bar.appendChild(sp);

    bar.appendChild(mk('minus', '', '缩小', () => zoomAt(0.8)));
    zoomLabel = el('span', 'bzoom'); zoomLabel.textContent = '100%'; bar.appendChild(zoomLabel);
    bar.appendChild(mk('add', '', '放大', () => zoomAt(1.25)));
    bar.appendChild(mk('fit', '', '回到原点', () => { view = { x: 40, y: 20, k: 1 }; applyView(); saveView(); }));
    refreshMode();
    return bar;
  }

  function refreshMode() {
    if (!root) return;
    const b = root.querySelector('#b-link');
    if (b) b.classList.toggle('on', mode === 'link');
    vpEl && vpEl.classList.toggle('linking', mode === 'link');
    if (mode !== 'link') linkFrom = null;
  }

  // ---------- 视口：平移 / 缩放 ----------
  function applyView() {
    gridEl.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.k + ')';
    if (zoomLabel) zoomLabel.textContent = Math.round(view.k * 100) + '%';
  }
  function zoomAt(f, cx, cy) {
    const r = vpEl.getBoundingClientRect();
    if (cx === undefined) { cx = r.width / 2; cy = r.height / 2; }
    const k2 = Math.min(3, Math.max(0.2, view.k * f));
    const fReal = k2 / view.k;
    view.x = cx - (cx - view.x) * fReal;
    view.y = cy - (cy - view.y) * fReal;
    view.k = k2;
    applyView(); saveView();
  }
  function toBoard(cx, cy) {
    const r = vpEl.getBoundingClientRect();
    return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k };
  }

  function bindViewport() {
    // 滚轮：ctrl+滚轮（或触控板捏合）缩放，普通滚轮平移
    vpEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(e.deltaY < 0 ? 1.08 : 0.93, e.clientX - vpEl.getBoundingClientRect().left, e.clientY - vpEl.getBoundingClientRect().top);
      } else {
        view.x -= e.deltaX; view.y -= e.deltaY;
        applyView(); saveView();
      }
    }, { passive: false });

    // 指针：空白拖拽 = 平移；双指捏合 = 缩放（平板）
    const pts = new Map();
    let panP = null, pinch = null;
    vpEl.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.bblock')) return;   // 块上交给块自己处理
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) panP = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
      if (pts.size === 2) {
        const [a, b] = Array.from(pts.values());
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k };
        panP = null;
      }
      vpEl.setPointerCapture(e.pointerId);
      if (mode === 'link') { linkFrom = null; markLink(); }   // 点空白取消连线起点
      e.preventDefault();
    });
    vpEl.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && pinch) {
        const [a, b] = Array.from(pts.values());
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const k2 = Math.min(3, Math.max(0.2, pinch.k * (d / pinch.d)));
        const r = vpEl.getBoundingClientRect();
        const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
        const fReal = k2 / view.k;
        view.x = mx - (mx - view.x) * fReal;
        view.y = my - (my - view.y) * fReal;
        view.k = k2; applyView();
      } else if (panP) {
        view.x = panP.vx + (e.clientX - panP.x);
        view.y = panP.vy + (e.clientY - panP.y);
        applyView();
      }
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0) panP = null;
      if (pts.size === 1) { const [a] = Array.from(pts.values()); panP = { x: a.x, y: a.y, vx: view.x, vy: view.y }; }
      try { vpEl.releasePointerCapture(e.pointerId); } catch (_) { }
    };
    vpEl.addEventListener('pointerup', up);
    vpEl.addEventListener('pointercancel', up);
  }

  // ---------- 块渲染 ----------
  function blockTitle(b) {
    if (b.type === 'card') {
      const a = IP2.asset ? (IP2.get().assets.find(x => x.id === b.ref)) : null;
      if (a) return a.name;
      const c = IP2.chapter(b.ref); if (c) return c.name;
      const t = IP2.tag(b.ref); if (t) return '#' + t.name;
      return '（卡片已失效）';
    }
    if (b.type === 'sticky') return '';
    if (b.type === 'sketch') return '手写块';
    if (b.type === 'image') return '图片块';
    return (b.text || '').split('\n')[0].slice(0, 20) || '文字块';
  }

  function renderBlocks() {
    gridEl.querySelectorAll('.bblock').forEach(x => x.remove());
    const blocks = IP2.blocksOf(curId);
    blocks.forEach(b => gridEl.appendChild(buildBlockEl(b)));
    if (selId && !IP2.block(selId)) selId = null;
    drawEdges();
  }

  function buildBlockEl(b) {
    const d = el('div', 'bblock b-' + b.type + (b.color ? ' ' + b.color : '') + (selId === b.id ? ' sel' : ''));
    d.style.left = b.x + 'px'; d.style.top = b.y + 'px';
    d.style.width = b.w + 'px'; d.style.height = b.h + 'px';
    d.style.zIndex = b.z || 1;
    d.dataset.bid = b.id;

    if (b.type === 'card') {
      const a = IP2.get().assets.find(x => x.id === b.ref);
      const c = a ? null : IP2.chapter(b.ref);
      const t = (a || c) ? null : IP2.tag(b.ref);
      if (a) {
        d.innerHTML = '<div class="bb-hd"><i>资产</i><span>' + esc(a.name) + '</span></div>' +
          '<div class="bb-bd">' + esc((a.body || '').slice(0, 90)) + '</div>' +
          '<div class="bb-ft">' + esc(a.kind || '') + '</div>';
      } else if (c) {
        const st = IP2.chStatus ? IP2.chStatus(c.status) : null;
        d.innerHTML = '<div class="bb-hd"><i>章节</i><span>' + esc(c.name) + '</span></div>' +
          '<div class="bb-bd">' + esc(c.summary || '') + '</div>' +
          '<div class="bb-ft">' + (st ? '<b class="chst" style="color:' + st.c + ';border-color:' + st.c + '">' + st.n + '</b>' : '') + '<span>' + (c.words || 0) + ' 字</span></div>';
      } else if (t) {
        d.innerHTML = '<div class="bb-hd"><i style="background:' + (t.color || '#888780') + '">标</i><span>#' + esc(t.name) + '</span></div>' +
          '<div class="bb-bd">' + esc((t.desc || '')) + '</div>';
      } else {
        d.innerHTML = '<div class="bb-hd"><i>卡</i><span>已失效</span></div>';
      }
      // 卡片点击 → 浮窗打开
      d.addEventListener('dblclick', () => {
        if (a) IPFloat.open('asset', a.id, a.name);
        else if (c) IPFloat.open('chapter', c.id, c.name);
        else if (t) IPFloat.open('tag', t.id, t.name);
      });
    } else if (b.type === 'image') {
      d.innerHTML = '<img src="' + esc(b.src) + '" draggable="false">';
    } else if (b.type === 'sketch') {
      // 手写块：头部是拖动手柄，画布收笔时以块 id 为命名空间存笔画
      d.appendChild(el('div', 'bb-hd bb-sketchhd', '<i>✎ 手写</i><span>按住此条拖动</span>'));
      const cv = document.createElement('canvas');
      cv.className = 'bb-sketch';
      cv.dataset.pageId = b.id;          // IInk.redraw 靠这个找笔画
      d.appendChild(cv);
      requestAnimationFrame(() => paintSketch(cv, b.id));
      // 手写引擎是单例：指针进入哪块，就激活哪块
      cv.addEventListener('pointerenter', () => {
        IInk.setup(cv, {
          conf: { color: '#e8e4da', size: 2.5, pen: 'pen' },
          onAdd: (st) => { st.pageId = b.id; st.id = 's' + Date.now().toString(36) + Math.floor(Math.random() * 99); IP2.addStroke(st); }
        });
      });
    } else if (b.type === 'sticky') {
      const ta = el('textarea', 'bb-ta'); ta.value = b.text || '';
      ta.addEventListener('input', () => { IP2.updBlock(b.id, { text: ta.value }); autoGrow(ta, b); });
      d.appendChild(ta);
    } else { // text
      const ta = el('textarea', 'bb-ta'); ta.value = b.text || '';
      ta.placeholder = '双击此处写草稿…';
      ta.addEventListener('input', () => { IP2.updBlock(b.id, { text: ta.value }); autoGrow(ta, b); });
      d.appendChild(ta);
    }

    // 操作条（选中时显示）
    const ops = el('div', 'bb-ops');
    if (b.type === 'text' || b.type === 'sticky') {
      const cv2 = el('button', '', '✓ 转正'); cv2.title = '转成正式条目 / 登记为新章节';
      cv2.addEventListener('pointerdown', e => e.stopPropagation());
      cv2.addEventListener('click', (e) => { e.stopPropagation(); promoteDlg(b); });
      ops.appendChild(cv2);
    }
    if (b.type === 'sketch') {
      const cl = el('button', '', '⌫ 清空'); cl.title = '清空这块的手写笔迹';
      cl.addEventListener('pointerdown', e => e.stopPropagation());
      cl.addEventListener('click', (e) => {
        e.stopPropagation();
        IPVN.ask('要清空这块的手写笔迹吗？', () => {
          IP2.get().strokes = IP2.get().strokes.filter(s => s.pageId !== b.id);
          IP2.save(true);
          const cv = d.querySelector('.bb-sketch'); if (cv) paintSketch(cv, b.id);
        }, { danger: true, yes: '清空它' });
      });
      ops.appendChild(cl);
    }
    const fl = el('button', '', '⧉'); fl.title = '在浮窗中打开';
    fl.addEventListener('pointerdown', e => e.stopPropagation());
    fl.addEventListener('click', (e) => { e.stopPropagation(); IPFloat.open(b.type === 'card' ? guessCardKind(b) : 'block', b.id, blockTitle(b)); });
    ops.appendChild(fl);
    const rm = el('button', '', '×'); rm.title = '删除块（连带删连线）';
    rm.addEventListener('pointerdown', e => e.stopPropagation());
    rm.addEventListener('click', (e) => { e.stopPropagation(); IP2.delBlock(b.id); if (selId === b.id) selId = null; renderBlocks(); });
    ops.appendChild(rm);
    d.appendChild(ops);

    // 缩放手柄
    const rs = el('div', 'bb-rs'); rs.title = '调整大小';
    d.appendChild(rs);

    bindBlock(d, b, rs);
    return d;
  }

  // 本地重绘手写块（不动 IInk 单例状态）
  function paintSketch(cv, blockId) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth || 300, h = cv.clientHeight || 180;
    if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    IP2.strokesOf(blockId).forEach(s => {
      if (!s.pts || !s.pts.length) return;
      ctx.strokeStyle = s.color; ctx.lineWidth = s.size;
      ctx.globalAlpha = s.pen === 'hl' ? 0.32 : 1;
      ctx.beginPath();
      ctx.moveTo(s.pts[0].x, s.pts[0].y);
      for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i].x, s.pts[i].y);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  function guessCardKind(b) {
    if (IP2.get().assets.find(x => x.id === b.ref)) return 'asset';
    if (IP2.chapter(b.ref)) return 'chapter';
    if (IP2.tag(b.ref)) return 'tag';
    return 'block';
  }
  function autoGrow(ta, b) {
    ta.style.height = 'auto';
    const h = Math.max(40, ta.scrollHeight + 6);
    ta.style.height = h + 'px';
    if (Math.abs(h - b.h) > 4) IP2.updBlock(b.id, { h });
    const elb = gridEl.querySelector('.bblock[data-bid="' + b.id + '"]');
    if (elb) elb.style.height = h + 'px';
  }

  // ---------- 块交互：拖动 / 缩放 / 选中 / 连线 ----------
  function bindBlock(d, b, rs) {
    let drag = null, resize = null;
    d.addEventListener('pointerdown', (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'CANVAS' || e.target.closest('.bb-ops')) return;
      e.stopPropagation();
      if (mode === 'link') {
        if (!linkFrom) { linkFrom = b.id; markLink(); }
        else if (linkFrom !== b.id) {
          const edge = IP2.addEdge(curId, linkFrom, b.id);
          if (edge) { linkFrom = null; markLink(); drawEdges(); }
        }
        return;
      }
      selId = b.id;
      // 提到最上层
      const maxZ = Math.max(0, ...IP2.blocksOf(curId).map(x => x.z || 0));
      IP2.updBlock(b.id, { z: maxZ + 1 });
      gridEl.querySelectorAll('.bblock').forEach(x => x.classList.remove('sel'));
      d.classList.add('sel');
      const pt = toBoard(e.clientX, e.clientY);
      drag = { bx: pt.x, by: pt.y, ox: b.x, oy: b.y, moved: false };
      d.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    d.addEventListener('pointermove', (e) => {
      if (drag) {
        const pt = toBoard(e.clientX, e.clientY);
        b.x = Math.round(drag.ox + pt.x - drag.bx);
        b.y = Math.round(drag.oy + pt.y - drag.by);
        d.style.left = b.x + 'px'; d.style.top = b.y + 'px';
        drag.moved = true;
        drawEdges();
      }
    });
    const end = () => {
      if (drag && drag.moved) IP2.updBlock(b.id, { x: b.x, y: b.y });
      drag = null;
    };
    d.addEventListener('pointerup', end);
    d.addEventListener('pointercancel', end);

    // 缩放手柄
    rs.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      const pt0 = toBoard(e.clientX, e.clientY);
      resize = { x: pt0.x, y: pt0.y, w: b.w, h: b.h };
      rs.setPointerCapture(e.pointerId);
    });
    rs.addEventListener('pointermove', (e) => {
      if (!resize) return;
      const pt = toBoard(e.clientX, e.clientY);
      b.w = Math.max(120, Math.round(resize.w + pt.x - resize.x));
      b.h = Math.max(60, Math.round(resize.h + pt.y - resize.y));
      d.style.width = b.w + 'px'; d.style.height = b.h + 'px';
      drawEdges();
    });
    const endR = () => {
      if (resize) {
        IP2.updBlock(b.id, { w: b.w, h: b.h });
        const cv = d.querySelector('.bb-sketch');
        if (cv) requestAnimationFrame(() => paintSketch(cv, b.id));   // 手写块重设尺寸后重绘
      }
      resize = null;
    };
    rs.addEventListener('pointerup', endR);
    rs.addEventListener('pointercancel', endR);
  }

  function markLink() {
    gridEl.querySelectorAll('.bblock').forEach(x => x.classList.remove('linkfrom'));
    if (linkFrom) {
      const e2 = gridEl.querySelector('.bblock[data-bid="' + linkFrom + '"]');
      if (e2) e2.classList.add('linkfrom');
    }
  }

  // ---------- 连线绘制 ----------
  function drawEdges() {
    if (!svgEl) return;
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
    const bs = {};
    IP2.blocksOf(curId).forEach(b => bs[b.id] = b);
    IP2.edgesOf(curId).forEach(ed => {
      const a = bs[ed.from], c = bs[ed.to];
      if (!a || !c) return;
      const x1 = a.x + a.w / 2, y1 = a.y + a.h / 2;
      const x2 = c.x + c.w / 2, y2 = c.y + c.h / 2;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M' + x1 + ' ' + y1 + ' Q' + mx + ' ' + my + ' ' + x2 + ' ' + y2);
      path.setAttribute('stroke', ed.color || '#888780');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('class', 'bedge');
      path.dataset.eid = ed.id;
      const r1 = Math.hypot(x2 - x1, y2 - y1) || 1;
      const ux = (x2 - x1) / r1, uy = (y2 - y1) / r1;
      const ax = x2 - ux * (c.w / 4 + 14), ay = y2 - uy * (c.h / 4 + 14); // 箭头近似收在块边附近
      const arr = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arr.setAttribute('d', 'M' + x2 + ' ' + y2 + ' L' + (ax - uy * 6) + ' ' + (ay + ux * 6) + ' L' + (ax + uy * 6) + ' ' + (ay - ux * 6) + ' Z');
      arr.setAttribute('fill', ed.color || '#888780');
      arr.dataset.eid = ed.id;
      svgEl.appendChild(path); svgEl.appendChild(arr);
      if (ed.label) {
        const tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tx.setAttribute('x', mx); tx.setAttribute('y', my - 6);
        tx.setAttribute('text-anchor', 'middle');
        tx.setAttribute('class', 'bedgelbl');
        tx.textContent = ed.label;
        tx.dataset.eid = ed.id;
        svgEl.appendChild(tx);
      }
      // 点击连线删除（选择模式下）
      const kill = (ev) => {
        ev.stopPropagation();
        if (mode === 'link') return;
        IPVN.ask('要删除这条连线吗？', () => { IP2.delEdge(ed.id); drawEdges(); }, { danger: true });
      };
      path.addEventListener('pointerdown', kill);
      arr.addEventListener('pointerdown', kill);
    });
  }

  // ---------- 新建块 ----------
  function addBlockCenter(type, extra) {
    const r = vpEl.getBoundingClientRect();
    const pt = toBoard(r.left + r.width / 2, r.top + r.height / 2);
    const b = IP2.addBlock(Object.assign({
      pageId: curId, type,
      x: Math.round(pt.x - 110), y: Math.round(pt.y - 50),
      w: type === 'sticky' ? 180 : 220, h: type === 'sticky' ? 110 : 100,
      color: type === 'sticky' ? 'n-y' : ''
    }, extra || {}));
    selId = b.id;
    renderBlocks();
    if (type === 'text') {
      const elb = gridEl.querySelector('.bblock[data-bid="' + b.id + '"] .bb-ta');
      if (elb) elb.focus();
    }
    return b;
  }

  function pickImage() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.addEventListener('change', () => {
      const f = inp.files[0]; if (!f) return;
      if (f.size > 900 * 1024) { alert('图片太大了（' + Math.round(f.size / 1024) + 'KB）。为了云同步流畅，请压缩到 900KB 以内。'); return; }
      const rd = new FileReader();
      rd.onload = () => {
        const img = new Image();
        img.onload = () => {
          const w = Math.min(280, img.width);
          const h = Math.round(img.height * w / img.width);
          addBlockCenter('image', { src: rd.result, w, h: Math.max(60, h) });
        };
        img.src = rd.result;
      };
      rd.readAsDataURL(f);
    });
    inp.click();
  }

  function pickCard() {
    const p = IP2.page(curId);
    const pid = p ? p.pid : null;
    const ov = el('div', 'overlay');
    ov.addEventListener('mousedown', e => { if (e.target === ov) ov.remove(); });
    const dlg = el('div', 'dlg');
    const assets = IP2.get().assets.filter(a => !a.pid || a.pid === pid);
    const chapters = pid ? IP2.chaptersOf(pid).filter(c => c.kind === 'chapter') : [];
    const tags = IP2.get().tags;
    let html = '<h3>生成卡片</h3><div class="field"><label>选择对象</label><select id="bc_sel">' +
      '<option value="">— 选择 —</option>';
    assets.forEach(a => html += '<option value="as:' + a.id + '">资产 · ' + esc(a.name) + '</option>');
    chapters.forEach(c => html += '<option value="ch:' + c.id + '">章节 · ' + esc(c.name) + '</option>');
    tags.forEach(t => html += '<option value="tg:' + t.id + '">标签 · #' + esc(t.name) + '</option>');
    html += '</select></div>' +
      '<div class="btns"><button class="no" id="bc_c">取消</button><button class="ok" id="bc_ok">放到画布中央</button></div>';
    dlg.innerHTML = html;
    ov.appendChild(dlg); document.body.appendChild(ov);
    document.getElementById('bc_c').addEventListener('click', () => ov.remove());
    document.getElementById('bc_ok').addEventListener('click', () => {
      const v = document.getElementById('bc_sel').value;
      if (!v) return;
      ov.remove();
      addBlockCenter('card', { ref: v.slice(3), w: 220, h: 110 });
    });
  }

  // ---------- 草稿转正 ----------
  function promoteDlg(b) {
    const p = IP2.page(curId);
    if (!p) return;
    const words = countWords(b.text);
    const nodes = IP2.nodesOf(p.pid);
    const ov = el('div', 'overlay');
    ov.addEventListener('mousedown', e => { if (e.target === ov) ov.remove(); });
    const dlg = el('div', 'dlg');
    let html = '<h3>草稿转正 · ' + words + ' 字</h3>' +
      '<div class="field"><label>转成什么？</label><select id="pm_kind">' +
      '<option value="entry">内容条目（放进某个分支）</option>' +
      '<option value="chapter">新章节（登记字数 ' + words + '）</option>' +
      '</select></div>' +
      '<div class="field"><label>标题</label><input id="pm_title" value="' + esc((b.text || '').split('\n')[0].slice(0, 24) || '新内容') + '"></div>' +
      '<div class="field"><label>放进哪个分支（转条目时）</label><select id="pm_node">' +
      '<option value="">（不挂分支）</option>';
    nodes.forEach(n => html += '<option value="' + n.id + '">' + esc('　'.repeat(depthOf(nodes, n)) + n.name) + '</option>');
    html += '</select></div>' +
      '<div class="ckline"><label><input type="checkbox" id="pm_del" checked style="width:auto"> 转正后删除画布上的这个草稿块</label></div>' +
      '<div class="btns"><button class="no" id="pm_c">取消</button><button class="ok" id="pm_ok">转正</button></div>';
    dlg.innerHTML = html;
    ov.appendChild(dlg); document.body.appendChild(ov);
    document.getElementById('pm_c').addEventListener('click', () => ov.remove());
    document.getElementById('pm_ok').addEventListener('click', () => {
      const kind = document.getElementById('pm_kind').value;
      const title = document.getElementById('pm_title').value.trim() || '新内容';
      const nodeId = document.getElementById('pm_node').value;
      const del = document.getElementById('pm_del').checked;
      if (kind === 'entry') {
        const e = IP2.addEntry(p.pid, nodeId, title);
        IP2.updEntry(e.id, { body: b.text || '' });
      } else {
        const c = IP2.addChapter(p.pid, '', title, 'chapter');
        IP2.updChapter(c.id, { words, text: b.text || '', status: 'draft' });
      }
      if (del) IP2.delBlock(b.id);
      ov.remove();
      renderBlocks();
      window.IPApp && IPApp.reload && setTimeout(() => {
        // 不强制刷新主界面，避免打断画布操作；仅提示
      }, 0);
    });
  }
  function depthOf(nodes, n) {
    let d = 0, cur = n;
    const byId = {}; nodes.forEach(x => byId[x.id] = x);
    while (cur && cur.parent && byId[cur.parent] && d < 10) { cur = byId[cur.parent]; d++; }
    return d;
  }

  // ---------- 一键导图布局 ----------
  function mindLayout() {
    const blocks = IP2.blocksOf(curId);
    if (!blocks.length) return;
    const edges = IP2.edgesOf(curId);
    const byId = {}; blocks.forEach(b => byId[b.id] = b);
    const children = {}, hasParent = {};
    edges.forEach(e => {
      if (!byId[e.from] || !byId[e.to]) return;
      if (hasParent[e.to]) return;            // 已有父节点 → 跳过，保证是树
      (children[e.from] = children[e.from] || []).push(e.to);
      hasParent[e.to] = true;
    });
    const roots = blocks.filter(b => !hasParent[b.id]).map(b => b.id);
    // 树布局：叶子计 1 高度，逐层排 y
    const H = {};                              // 块高（含间距）
    blocks.forEach(b => H[b.id] = Math.max(60, b.h || 100) + 36);
    let nextY = 0;
    const placed = {};
    const GX = 320, GAP = 30;
    function subtree(id, depth) {
      const kids = children[id] || [];
      if (!kids.length) {
        const y = nextY;
        nextY += H[id];
        placed[id] = { x: depth * GX, y };
        return H[id];
      }
      let y0 = nextY, sum = 0;
      kids.forEach(k => { sum += subtree(k, depth + 1); });
      const selfH = H[id];
      const cy = y0 + (sum - selfH) / 2;       // 垂直居中于子树
      placed[id] = { x: depth * GX, y: cy };
      return sum;
    }
    roots.forEach(r => { if (!placed[r]) subtree(r, 0); });
    // 孤立块（未入树但被引用异常等）排在最右列
    let orphY = 0;
    blocks.forEach(b => {
      if (!placed[b.id]) { placed[b.id] = { x: -GX, y: orphY }; orphY += H[b.id]; }
    });
    blocks.forEach(b => {
      const pos = placed[b.id];
      IP2.updBlock(b.id, { x: Math.round(pos.x), y: Math.round(pos.y) });
    });
    renderBlocks();
    // 视口回到能看到全部内容
    fitView();
  }

  function fitView() {
    const blocks = IP2.blocksOf(curId);
    if (!blocks.length || !vpEl) return;
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    blocks.forEach(b => {
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    });
    const r = vpEl.getBoundingClientRect();
    const k = Math.min(1.4, Math.max(0.2, Math.min(r.width / (maxX - minX + 120), r.height / (maxY - minY + 120))));
    view.k = k;
    view.x = (r.width - (maxX - minX) * k) / 2 - minX * k;
    view.y = (r.height - (maxY - minY) * k) / 2 - minY * k;
    applyView(); saveView();
  }

  // ---------- 暴露（冒烟测试用） ----------
  return {
    open,
    addBlockCenter, mindLayout, fitView, drawEdges,
    view: () => Object.assign({}, view),
    mode: () => mode,
    setMode: (m) => { mode = m; refreshMode(); },
    count: () => IP2.blocksOf(curId).length,
    edgesCount: () => IP2.edgesOf(curId).length
  };
})();
