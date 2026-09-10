/* lines.js —— 逻辑线：把标签/标记按序串成线，沿线巡检跳转 */
const IPLines = (function () {
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; };
  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function render(host) {
    host.innerHTML = '';
    const head = el('div', 'sidehead');
    head.innerHTML = '<h3>逻辑线 · 伏笔/弧光</h3>';
    const ab = el('button', 'mini', '+ 新线');
    ab.addEventListener('click', () => {
      const name = prompt('逻辑线名称（如：女主身世伏笔线）：', '');
      if (name === null) return;
      const l = IP2.addLine(name.trim() || '未命名线');
      window.IPApp.reloadTab();
      window.IPApp.toast('已建线「' + l.name + '」，点开它在下方把标签/标记加进来。');
    });
    head.appendChild(ab);
    host.appendChild(head);

    const lines = IP2.lines();
    if (!lines.length) {
      host.appendChild(el('div', 'emptyhint', '还没有逻辑线。<br>它用来把散在全书各处的<b>伏笔点、弧光点、地点</b>串起来，<br>沿线走一遍就能查出有没有断线。'));
      return;
    }
    lines.forEach(l => {
      const card = el('div', 'lineitem');
      card.style.borderLeft = '3px solid ' + l.color;
      const hd = el('div', 'hd');
      hd.innerHTML = `<span class="tagdot" style="background:${l.color}"></span><b>${esc(l.name)}</b><span class="cnt">${l.nodes.length} 个点</span>`;
      const rn = el('button', 'mini', '改名');
      rn.addEventListener('click', () => {
        const name = prompt('线名称：', l.name);
        if (name && name.trim()) { l.name = name.trim(); IP2.save(true); window.IPApp.reloadTab(); }
      });
      const fl = el('button', 'mini', '⧉');
      fl.title = '在浮窗中打开';
      fl.addEventListener('click', (e) => { e.stopPropagation(); IPFloat.open('line', l.id, l.name); });
      const dt = el('button', 'mini', '删除线');
      dt.addEventListener('click', () => {
        IPVN.ask('要删除逻辑线「' + l.name + '」吗？\n线上的点不会被删除。', () => {
          IP2.get().lines = IP2.get().lines.filter(x => x.id !== l.id);
          IP2.save(true); window.IPApp.reloadTab();
        }, { danger: true });
      });
      hd.appendChild(rn); hd.appendChild(fl); hd.appendChild(dt);
      card.appendChild(hd);

      const nodes = el('div', 'linenodes');
      l.nodes.forEach((n, i) => {
        const meta = describeNode(n);
        const row = el('div', 'lnode');
        row.innerHTML = `<span class="idx" style="color:${l.color}">${i + 1}</span>`;
        const tt = el('div', 'tt', esc(meta.title));
        const sub = el('small', '', esc(meta.sub));
        tt.appendChild(sub);
        row.appendChild(tt);
        const ops = el('div', 'op');
        const up = el('button', '↑');
        up.title = '上移';
        up.addEventListener('click', (e) => { e.stopPropagation(); IP2.lineMove(l, i, -1); window.IPApp.reloadTab(); });
        const dn = el('button', '↓');
        dn.title = '下移';
        dn.addEventListener('click', (e) => { e.stopPropagation(); IP2.lineMove(l, i, 1); window.IPApp.reloadTab(); });
        const rm = el('button', '×');
        rm.title = '移出此线';
        rm.addEventListener('click', (e) => { e.stopPropagation(); IP2.lineRemove(l, i); window.IPApp.reloadTab(); });
        ops.appendChild(up); ops.appendChild(dn); ops.appendChild(rm);
        row.appendChild(ops);
        row.addEventListener('click', () => { if (meta.jump) meta.jump(); });
        nodes.appendChild(row);
      });
      card.appendChild(nodes);

      // 添加行
      const addrow = el('div', 'lnadd');
      const sel = document.createElement('select');
      const optPh = el('option', '', '—— 把标签/标记加进这条线 ——');
      optPh.disabled = true; optPh.selected = true;
      sel.appendChild(optPh);
      // 先标签
      IP2.tags().forEach(t => {
        const n = IP2.annosOfTag(t.id).length;
        if (!n) return;
        const o = el('option', '', '标签：' + t.name + '（' + n + ' 处）');
        o.value = 'tag:' + t.id;
        sel.appendChild(o);
      });
      // 章节
      IP2.get().chapters.filter(c => c.kind !== 'act').forEach(c => {
        if (l.nodes.some(n => n.kind === 'chapter' && n.ref === c.id)) return;
        const pj = IP2.project(c.pid);
        const o = el('option', '', '章节：' + (pj ? pj.name + ' · ' : '') + c.name);
        o.value = 'chapter:' + c.id;
        sel.appendChild(o);
      });
      // 再未入线的具体标记
      IP2.allAnnosWithMeta().forEach(h => {
        if (l.nodes.some(n => n.kind === 'anno' && n.ref === h.a.id)) return;
        const o = el('option', '', (h.a.tagId ? '·' : '○') + ' ' + h.pageName + '：' + (h.a.text || '').slice(0, 16));
        o.value = 'anno:' + h.a.id;
        sel.appendChild(o);
      });
      const add = el('button', '', '加入');
      add.addEventListener('click', () => {
        const v = sel.value;
        if (!v) return;
        const [k, ref] = v.split(':');
        if (k === 'tag') {
          const t = IP2.tag(ref);
          if (t) { IP2.linePush(l, 'tag', ref, t.name); }
        } else if (k === 'chapter') {
          const c = IP2.chapter(ref);
          if (c) IP2.linePush(l, 'chapter', ref, c.name);
        } else {
          const a = IP2.anno(ref);
          const p = IP2.page(a ? a.pageId : '');
          if (a) IP2.linePush(l, 'anno', ref, (p ? p.name : '') + ' 片段');
        }
        window.IPApp.reloadTab();
      });
      addrow.appendChild(sel); addrow.appendChild(add);
      card.appendChild(addrow);
      host.appendChild(card);
    });
  }

  function describeNode(n) {
    if (n.kind === 'chapter') {
      const c = IP2.chapter(n.ref);
      if (c) {
        const st = IP2.chStatus(c.status);
        return { title: '章节：' + c.name, sub: st.label + ' · ' + (Number(c.words) || 0) + ' 字 → 点开编辑', jump: () => window.IPCh.chapterDlg(c.id) };
      }
      return { title: '（已删除的章节）', sub: '' };
    }
    if (n.kind === 'tag') {
      const t = IP2.tag(n.ref);
      if (t) {
        const c = IP2.annosOfTag(t.id).length;
        return { title: '标签：' + t.name, sub: c + ' 处标记 → 点击跳第一处', jump: () => {
            const hits = IP2.annosOfTag(t.id);
            if (hits.length) window.IPApp.jumpAnno(hits[0]);
            else window.IPApp.toast('该标签暂无标记');
        } };
      }
      return { title: '（已删除的标签）', sub: '' };
    }
    const a = IP2.anno(n.ref);
    if (a) {
      const p = IP2.page(a.pageId);
      const txt = (a.text || '').slice(0, 26);
      return { title: (p ? p.name : '') + ' · ' + txt, sub: '点开跳回原文该标记处', jump: () => window.IPApp.jumpAnno(a) };
    }
    return { title: '（已删除的标记）', sub: '' };
  }

  return { render };
})();
