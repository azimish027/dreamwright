/* tags.js —— 标签聚合视图：同标签标记片段自动聚卡 */
const IPTags = (function () {
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; };

  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function render(host) {
    host.innerHTML = '';
    const head = el('div', 'sidehead');
    head.innerHTML = '<h3>标签 · 聚合卡</h3>';
    const hb = el('button', 'mini', '说明');
    hb.addEventListener('click', () => window.IPApp.toast('给正文高亮或下划线并挂上标签后，同标签的片段会自动聚到一张卡里；点片段跳回原文。'));
    head.appendChild(hb);
    host.appendChild(head);

    const tags = IP2.tags().filter(t => IP2.annosOfTag(t.id).length);
    if (!tags.length) {
      const e2 = el('div', 'emptyhint', '还没有带标签的标记。<br>去正文里选中一句，按 <b>荧光</b> 或 <b>下划线</b>，<br>然后输入标签名（如「地点 · 青石巷」）。');
      host.appendChild(e2);
      return;
    }
    tags.forEach(t => {
      const hits = IP2.annosOfTagMerged(t.id);
      const card = el('div', 'tagcard');
      const hd = el('div', 'hd');
      hd.innerHTML = `<span class="tagdot" style="background:${t.color}"></span><b>${esc(t.name)}</b><span class="cnt">${hits.length} 处</span>`;
      const act = el('span', 'op');
      const fl = el('button', 'mini', '⧉');
      fl.title = '在浮窗中打开';
      fl.addEventListener('click', (e) => { e.stopPropagation(); IPFloat.open('tag', t.id, t.name); });
      const rn = el('button', 'mini', '改名');
      rn.addEventListener('click', (e) => { e.stopPropagation();
        const name = prompt('标签新名称：', t.name);
        if (name && name.trim()) { IP2.renameTag(t.id, name.trim()); window.IPApp.reloadTab(); }
      });
      const dt = el('button', 'mini danger', '删除');
      dt.addEventListener('click', (e) => { e.stopPropagation();
        IPVN.ask('要删除标签「' + t.name + '」吗？\n其下所有标记也会被移除。', () => { IP2.delTag(t.id); window.IPApp.reloadTab(); window.IPApp.refreshContent(); }, { danger: true });
      });
      act.appendChild(fl); act.appendChild(rn); act.appendChild(dt);
      hd.appendChild(act);
      card.appendChild(hd);
      const body = el('div', 'taghits');
      hits.forEach(h => {
        const row = el('div', 'hit');
        row.innerHTML = `<div class="src">${esc(h.pageName)} · 段${h.a.seg + 1}</div>`;
        const txt = el('div', 'txt');
        txt.innerHTML = snippetHtml(h);
        row.appendChild(txt);
        const delb = el('button', 'mini danger', '×');
        delb.style.cssText = 'margin-left:auto;flex:none';
        delb.title = '删除这条标记';
        delb.addEventListener('click', (e) => { e.stopPropagation(); IP2.delAnno(h.a.id); window.IPApp.reloadTab(); window.IPApp.refreshContent(); });
        row.appendChild(delb);
        row.addEventListener('click', () => window.IPApp.jumpAnno(h.a));
        body.appendChild(row);
      });
      card.appendChild(body);
      host.appendChild(card);
    });
  }

  function snippetHtml(h) {
    const seg = h.page ? (h.page.segments[h.a.seg] || '') : '';
    const before = seg.slice(Math.max(0, h.a.start - 14), h.a.start);
    const mid = seg.slice(h.a.start, h.a.end);
    const after = seg.slice(h.a.end, Math.min(seg.length, h.a.end + 24));
    return esc(before) + '<em>' + esc(mid) + '</em>' + esc(after);
  }

  return { render, snippetHtml };
})();
