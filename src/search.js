/* search.js —— 全局检索（本地、免 API）：跨页搜词 + 标签匹配 */
const IPSearch = (function () {
  let input = null, panel = null;
  let timer = null;
  let lastQ = '';

  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function hl(s, q) {
    const out = esc(s);
    const qq = esc(q);
    if (!qq) return out;
    const re = new RegExp('(' + qq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return out.replace(re, '<em>$1</em>');
  }

  function init(inputEl, panelEl) {
    input = inputEl; panel = panelEl;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(run, 180);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') run();
      if (e.key === 'Escape') close();
    });
    input.addEventListener('focus', () => { if (lastQ && lastQ.length) open(); });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.searchwrap')) close();
    });
  }

  function q() { return (input.value || '').trim(); }

  function run() {
    const query = q();
    lastQ = query;
    if (!query) { close(); return; }
    panel.innerHTML = '';
    panel.classList.add('on');
    const head = document.createElement('div');
    head.className = 'srhead';
    head.textContent = '检索：' + query;
    panel.appendChild(head);

    const wordHits = IP2.searchAll(query);
    // 标签名匹配
    const tagHits = IP2.searchTags(query).filter(t => IP2.annosOfTag(t.id).length);

    if (!wordHits.length && !tagHits.length) {
      const e2 = document.createElement('div');
      e2.className = 'srempty mm-empty';
      e2.innerHTML = (window.IPUI ? IPUI.mascot('think') : '') +
        '<div class="mm-empty-t" style="padding:0 12px">没有找到包含「' + esc(query) + '」的内容<br><span style="font-size:11px;color:var(--tx-3)">换个关键字试试？梦梦帮你翻了全文都没找到</span></div>';
      panel.appendChild(e2);
      return;
    }

    tagHits.slice(0, 6).forEach(t => {
      const c = IP2.annosOfTag(t.id).length;
      const it = document.createElement('div');
      it.className = 'sritem';
      it.innerHTML = `<div class="t">标签 · ${esc(t.name)}（${c} 处标记）</div><div class="c">点开查看所有标过此标签的片段</div>`;
      it.addEventListener('click', () => {
        const first = IP2.annosOfTag(t.id)[0];
        close(); clearInput();
        window.IPApp.showTags();
        if (first) window.IPApp.jumpAnno(first);
      });
      panel.appendChild(it);
    });

    wordHits.slice(0, 14).forEach(h => {
      const it = document.createElement('div');
      it.className = 'sritem';
      if (h.kind === 'entry') {
        it.innerHTML = `<div class="t">条目 · ${esc(h.pageName)}</div><div class="c">…${hl(h.ctx, query)}…</div>`;
        it.addEventListener('click', () => {
          close(); clearInput();
          window.IPApp.jumpEntry(h.entryId);
        });
      } else if (h.kind === 'idea') {
        it.innerHTML = `<div class="t">灵感 · ${esc(h.pageName)}</div><div class="c">…${hl(h.ctx, query)}…</div>`;
        it.addEventListener('click', () => {
          close(); clearInput();
          window.IPApp.go('idea');
        });
      } else {
        it.innerHTML = `<div class="t">${esc(h.pageName)} · 段${h.seg + 1} · 第 ${h.at + 1} 字</div><div class="c">…${hl(h.ctx, query)}…</div>`;
        it.addEventListener('click', () => {
          close(); clearInput();
          window.IPApp.jumpWord(h.pageId, h.seg, h.at, query.length);
        });
      }
      panel.appendChild(it);
    });
    open();
  }

  function open() { panel.classList.add('on'); }
  function close() { panel.classList.remove('on'); }
  function clearInput() { if (input) { input.value = ''; } lastQ = ''; }

  return { init, close };
})();
