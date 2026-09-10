/* drawing.js —— 手写笔画引擎：Canvas + Pointer Events，笔/荧光笔/橡皮 */
const IInk = (function () {
  let layer = null;      // canvas element (inset 0)
  let ctx = null;
  let cur = null;        // 当前笔画 pts
  let drawing = false;
  let lastPt = null;
  let conf = { color: '#e8eaf0', size: 2.5, pen: 'pen' }; // pen | hl
  let onAdd = null;      // 收笔回调(strokeObj) 由编辑器保存
  let dpr = 1;

  function cssToLayer(e, canvas) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, p: (e.pressure || 0.5) };
  }

  function setup(canvas, opts) {
    layer = canvas;
    ctx = canvas.getContext('2d');
    if (opts) {
      if (opts.onAdd) onAdd = opts.onAdd;
      if (opts.conf) conf = Object.assign({}, conf, opts.conf);
    }
    resize(canvas);
    bind(canvas);
    redraw(canvas);
  }

  function resize(canvas) {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr; canvas.height = h * dpr;
    }
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setConf(c) { conf = Object.assign({}, conf, c); }

  function bind(canvas) {
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      const pt = cssToLayer(e, canvas);
      drawing = true;
      cur = { color: conf.color, size: conf.size, pen: conf.pen, pts: [pt] };
      lastPt = pt;
      if (conf.pen === 'hl') {
        ctx.globalAlpha = 0.32; ctx.globalCompositeOperation = 'source-over';
      }
      strokeTo(pt);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const pt = cssToLayer(e, canvas);
      const sp = smooth(lastPt, pt);
      cur.pts.push(pt);
      strokeTo(sp);
      lastPt = pt;
    });
    const end = (e) => {
      if (!drawing) return;
      drawing = false;
      ctx.globalAlpha = 1;
      if (cur) {
        if (cur.pts.length >= 2 && onAdd) onAdd(cur);
        else if (cur.pts.length === 1 && onAdd) onAdd(cur); // 点也要（极小）
      }
      cur = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  function smooth(a, b) {
    return { x: a.x + (b.x - a.x) * 0.72, y: a.y + (b.y - a.y) * 0.72 };
  }

  function strokeTo(pt) {
    ctx.strokeStyle = cur.color;
    ctx.lineWidth = cur.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (cur.pen === 'hl') ctx.globalAlpha = 0.32;
    ctx.beginPath();
    ctx.moveTo(lastPt.x, lastPt.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 重绘全部笔画（页面切换/清空后/层开关）
  function redraw(canvas) {
    if (!canvas) return;
    resize(canvas);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    const strokes = (window.IP2StrokesOf) ? IP2StrokesOf(canvas.dataset.pageId) : [];
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const s of strokes) {
      if (!s.pts || s.pts.length < 1) continue;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.globalAlpha = s.pen === 'hl' ? 0.32 : 1;
      ctx.beginPath();
      ctx.moveTo(s.pts[0].x, s.pts[0].y);
      for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i].x, s.pts[i].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // 橡皮：点命中判定（距任意笔画折线 < thresh）
  function eraseAt(canvas, x, y, strokes) {
    const thresh = 14;
    let hit = -1;
    for (let i = 0; i < strokes.length; i++) {
      const s = strokes[i];
      if (!s.pts || !s.pts.length) continue;
      for (let j = 0; j < s.pts.length - 1; j++) {
        if (distToSeg(x, y, s.pts[j], s.pts[j + 1]) < thresh) { hit = i; break; }
      }
      if (hit >= 0) break;
    }
    if (hit >= 0) { strokes.splice(hit, 1); return true; }
    return false;
  }

  function distToSeg(px, py, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - a.x, py - a.y);
    let t = ((px - a.x) * dx + (py - a.y) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
  }

  return { setup, redraw, eraseAt, setConf, resize };
})();
