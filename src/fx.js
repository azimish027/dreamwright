/* fx.js —— Galgame 梦境特效：星光爱心粒子 / Loading 唤醒屏 / 打字机 */
window.IPFX = (function () {

  /* ① 星光 + 爱心粒子：垫在 #app 之后、透明区域可见，pointer-events 不挡操作 */
  function particles() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = document.createElement('canvas');
    cv.id = 'fx-canvas';
    document.body.insertBefore(cv, document.getElementById('app'));
    const ctx = cv.getContext('2d');
    let W = 0, H = 0;
    function size() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
    size(); addEventListener('resize', size);
    const COLORS = ['255,143,184', '111,195,255', '176,179,255', '255,196,107', '139,142,255'];
    const P = [];
    for (let i = 0; i < 32; i++) {
      P.push({
        x: Math.random(), y: Math.random(),
        s: 4 + Math.random() * 7,                  // 尺寸
        v: 0.02 + Math.random() * 0.05,            // 上飘速度
        c: COLORS[i % COLORS.length],
        a: 0.38 + Math.random() * 0.34,            // 基础透明度
        ph: Math.random() * Math.PI * 2,           // 闪烁相位
        heart: Math.random() < 0.3                  // 三成是爱心，其余是星星
      });
    }
    /* ⑪ 鼠标移动 → 粒子整体轻微跟随（±15px 内，慢柔） */
    let mdx = 0, mdy = 0, cdx = 0, cdy = 0;
    addEventListener('mousemove', e => {
      mdx = (e.clientX / innerWidth - 0.5) * 2;
      mdy = (e.clientY / innerHeight - 0.5) * 2;
    }, { passive: true });

    function heart(x, y, s) {
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.35);
      ctx.bezierCurveTo(x, y - s * 0.25, x - s, y - s * 0.25, x - s, y + s * 0.2);
      ctx.bezierCurveTo(x - s, y + s * 0.7, x, y + s * 0.95, x, y + s * 1.25);
      ctx.bezierCurveTo(x, y + s * 0.95, x + s, y + s * 0.7, x + s, y + s * 0.2);
      ctx.bezierCurveTo(x + s, y - s * 0.25, x, y - s * 0.25, x, y + s * 0.35);
      ctx.closePath(); ctx.fill();
    }
    function star(x, y, s) {
      // 四芒星光
      ctx.beginPath();
      ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y);
      ctx.quadraticCurveTo(x, y, x, y + s);
      ctx.quadraticCurveTo(x, y, x - s, y);
      ctx.quadraticCurveTo(x, y, x, y - s);
      ctx.closePath(); ctx.fill();
    }
    function glow(x, y, r, c, a) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.8);
      g.addColorStop(0, 'rgba(' + c + ',' + (a * 0.5).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + c + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * 2.8, 0, 6.2832); ctx.fill();
    }
    let t = 0;
    function frame() {
      if (!document.hidden) {
        t += 0.016;
        cdx += (mdx - cdx) * 0.045; cdy += (mdy - cdy) * 0.045;
        const ox = cdx * 15, oy = cdy * 15;
        ctx.clearRect(0, 0, W, H);
        for (const p of P) {
          p.y -= p.v / H * 60;
          if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
          const tw = p.a * (0.65 + 0.35 * Math.sin(t * 1.8 + p.ph));
          ctx.fillStyle = 'rgba(' + p.c + ',' + tw.toFixed(3) + ')';
          const x = p.x * W + ox, y = p.y * H + oy;
          glow(x, y, p.s * 1.6, p.c, tw);
          ctx.fillStyle = 'rgba(' + p.c + ',' + Math.min(1, tw * 1.5).toFixed(3) + ')';
          if (p.heart) heart(x, y, p.s); else star(x, y, p.s * 1.4);
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ② Loading 唤醒屏：菱形镜片旋转 + 「正在唤醒梦梦…」 */
  function boot() {
    const d = document.createElement('div');
    d.id = 'mmload';
    d.innerHTML =
      '<div class="mml-box">' +
        '<img class="mml-dia" src="' + (typeof UIC !== 'undefined' ? UIC.sky : '') + '" alt="" draggable="false">' +
        '<div class="mml-txt">正在唤醒梦梦<span class="mml-dots"><i>·</i><i>·</i><i>·</i></span></div>' +
      '</div>';
    document.body.appendChild(d);
    let closed = false;
    const done = () => {
      if (closed) return; closed = true;
      d.classList.add('bye');
      setTimeout(() => d.remove(), 700);
    };
    if (document.readyState === 'complete') setTimeout(done, 950);
    else addEventListener('load', () => setTimeout(done, 950));
    setTimeout(done, 3800); // 兜底：资源卡住也保证进得去
  }

  /* ③ 打字机：逐字显现 el 里的文本（保留子元素结构与换行），重复调用自动接续 */
  function type(el, speed) {
    if (!el) return;
    speed = speed || 26;
    if (el._typing) { el._typing = false; return; } // 二次调用 = 立即放完
    const nodes = [];
    (function walk(n) {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) nodes.push(c);
        else walk(c);
      }
    })(el);
    const full = nodes.map(n => n.textContent);
    const total = full.reduce((a, s) => a + s.length, 0);
    if (!total) return;
    el._typing = true;
    let i = 0, ni = 0, acc = 0;
    (function step() {
      if (!el._typing || !el.isConnected) { // 中断/被重建：全部放完
        nodes.forEach((n, k) => { n.textContent = full[k]; });
        el._typing = false; return;
      }
      acc += 1;
      while (ni < nodes.length && acc > full[ni].length) {
        acc -= full[ni].length; ni++;
      }
      if (ni >= nodes.length) { el._typing = false; return; }
      nodes[ni].textContent = full[ni].slice(0, acc);
      i++;
      setTimeout(step, /\s/.test(full[ni][acc - 1] || '') ? 40 : speed);
    })();
  }

  boot();
  particles();

  /* ④ Tooltip 梦梦台词气泡：悬停带 data-tip 的元素 350ms 后冒出 */
  function tips() {
    let tip = null, tmr = null;
    function hide() { if (tip) { tip.remove(); tip = null; } if (tmr) { clearTimeout(tmr); tmr = null; } }
    function show(el) {
      hide();
      tip = document.createElement('div');
      tip.id = 'mmtip';
      tip.textContent = el.dataset.tip;
      document.body.appendChild(tip);
      const r = el.getBoundingClientRect(), tr = tip.getBoundingClientRect();
      let x = r.left + r.width / 2 - tr.width / 2, y = r.bottom + 10;
      x = Math.max(8, Math.min(x, innerWidth - tr.width - 8));
      if (y + tr.height > innerHeight - 8) y = r.top - tr.height - 10;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
      requestAnimationFrame(() => { if (tip) tip.classList.add('on'); });
    }
    document.addEventListener('mouseover', e => {
      const t = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
      if (t) { if (tmr) clearTimeout(tmr); tmr = setTimeout(() => show(t), 350); }
      else hide();
    });
    document.addEventListener('mousedown', hide, true);
    document.addEventListener('scroll', hide, true);
  }
  tips();

  /* ⑦ 按钮点击波纹：从点击位置扩散淡白圆波（结束后自动移除，不累积） */
  function ripple() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.addEventListener('click', e => {
      const b = e.target && e.target.closest ? e.target.closest('button,.btn,.mini,.pjtab') : null;
      if (!b || b.disabled) return;
      const cs = getComputedStyle(b);
      if (cs.position === 'static') b.style.position = 'relative';
      if (cs.overflow === 'visible') b.style.overflow = 'hidden';
      const r = b.getBoundingClientRect();
      const d = Math.max(r.width, r.height) * 2.2;
      const s = document.createElement('span');
      s.className = 'fx-ripple';
      s.style.width = s.style.height = d + 'px';
      s.style.left = (e.clientX - r.left - d / 2) + 'px';
      s.style.top = (e.clientY - r.top - d / 2) + 'px';
      b.appendChild(s);
      setTimeout(() => s.remove(), 620);
    }, true);
  }
  ripple();

  /* ⑩ 自定义星光光标：默认关，可随时开关并记住偏好 */
  function cursor(on) {
    const next = (on === undefined) ? !document.body.classList.contains('mm-cursor') : !!on;
    document.body.classList.toggle('mm-cursor', next);
    try { localStorage.setItem('ipStudioP2:cursor', next ? '1' : '0'); } catch (e) {}
    return next;
  }
  try { if (localStorage.getItem('ipStudioP2:cursor') === '1') document.body.classList.add('mm-cursor'); } catch (e) {}

  return { boot: boot, type: type, cursor: cursor };
})();
