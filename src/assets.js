/* assets.js —— 工具与资产：全局库 + 自定义分类，可挂企划，任意处可浮窗打开 */
window.IPAssets = (function () {
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; };
  function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }

  const KINDS = ['人物', '地点', '道具', '组织', '参考资料', '外部工具', '其他'];

  let curCat = '';   // '' = 全部
  let curPid = '';   // '' = 全部，'none' = 未挂企划
  let kw = '';

  function catName(id) { const c = IP2.assetCats().find(x => x.id === id); return c ? c.name : '未分类'; }
  function catColor(id) { const c = IP2.assetCats().find(x => x.id === id); return c ? c.color : '#888780'; }
  function pjName(id) { const p = IP2.project(id); return p ? p.name : ''; }

  function filtered() {
    let list = IP2.assets();
    if (curCat) list = list.filter(a => (a.cat || '') === curCat);
    if (curPid === 'none') list = list.filter(a => !a.pid);
    else if (curPid) list = list.filter(a => (a.pid || '') === curPid);
    if (kw) {
      const q = kw.toLowerCase();
      list = list.filter(a => ((a.name || '') + (a.body || '') + (a.kind || '')).toLowerCase().indexOf(q) >= 0);
    }
    return list;
  }

  // ================= 资产库页面 =================
  function render(host) {
    host.innerHTML = '';
    const head = el('div', 'phead');
    head.innerHTML = '<h2>工具与资产</h2>';
    const add = el('button', 'btn primary', '+ 新资产');
    add.addEventListener('click', () => newAssetDlg());
    head.appendChild(add);
    const addCat = el('button', 'btn ghost', '+ 分类');
    addCat.addEventListener('click', () => {
      const n = prompt('分类名（如：人物 / 地点 / 道具 / 参考资料）');
      if (!n) return;
      IP2.addAssetCat(n.trim()); IPApp.reload();
    });
    head.appendChild(addCat);
    host.appendChild(head);
    host.appendChild(el('div', 'hintline', '所有企划共用的库。可挂到某个企划，也可以全局通用；创作时在浮窗里打开它，边写边对照。'));

    // 筛选条
    const bar = el('div', 'abar');
    const chips = el('div', 'chips');
    const mk = (label, on, fn) => {
      const b = el('button', 'chip' + (on ? ' on' : ''), label);
      b.addEventListener('click', fn);
      chips.appendChild(b);
    };
    mk('全部', !curCat, () => { curCat = ''; IPApp.reload(); });
    IP2.assetCats().forEach(c => {
      mk(c.name + ' ' + IP2.assets().filter(a => a.cat === c.id).length, curCat === c.id, () => { curCat = c.id; IPApp.reload(); });
    });
    bar.appendChild(chips);

    const right = el('div', 'abar-r');
    const sel = document.createElement('select');
    sel.innerHTML = '<option value="">全部企划</option><option value="none">未挂企划（全局）</option>' +
      IP2.projects().map(p => '<option value="' + p.id + '"' + (curPid === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('');
    sel.value = curPid;
    sel.addEventListener('change', () => { curPid = sel.value; IPApp.reload(); });
    right.appendChild(sel);

    const inp = el('input', '');
    inp.placeholder = '搜资产…';
    inp.value = kw;
    inp.addEventListener('input', () => { kw = inp.value.trim(); IPApp.reload(); setTimeout(() => { const i = document.querySelector('.abar-r input'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 0); });
    right.appendChild(inp);
    bar.appendChild(right);
    host.appendChild(bar);

    const list = filtered();
    if (!list.length) {
      host.appendChild(el('div', 'emptybox', kw ? '没搜到。换个词试试。' : '还没有资产。<b>点「+ 新资产」加一条吧</b>～<br>比如人物、地点、道具、常去的参考网站。'));
      return;
    }

    const grid = el('div', 'egrid');
    list.forEach(a => grid.appendChild(card(a)));
    host.appendChild(grid);
  }

  function card(a) {
    const c = el('div', 'ecard acard');
    const dot = el('span', 'tagdot');
    dot.style.background = catColor(a.cat);
    const t = el('div', 'acard-t');
    t.appendChild(dot);
    t.appendChild(el('b', '', esc(a.name)));
    if (a.kind) t.appendChild(el('span', 'tagpill', esc(a.kind)));
    c.appendChild(t);

    if (a.body) c.appendChild(el('div', 'ecard-b', esc(String(a.body).slice(0, 90))));
    const meta = el('div', 'acard-m');
    meta.innerHTML = '<span>' + esc(catName(a.cat)) + '</span>' +
      (a.pid ? '<span>' + esc(pjName(a.pid)) + '</span>' : '<span class="glob">全局</span>') +
      ((a.tags || []).length ? '<span>' + esc(a.tags.join('·')) + '</span>' : '');
    c.appendChild(meta);

    const fl = el('button', 'cardf', '⧉');
    fl.title = '在浮窗中打开';
    fl.addEventListener('click', (e) => { e.stopPropagation(); IPFloat.open('asset', a.id, a.name); });
    c.appendChild(fl);

    c.addEventListener('click', () => assetDlg(a.id));
    return c;
  }

  // ================= 资产编辑 =================
  function newAssetDlg() {
    const a = IP2.addAsset({ name: '新资产', cat: curCat || '', pid: curPid && curPid !== 'none' ? curPid : null });
    IPApp.reload();
    assetDlg(a.id);
  }

  function assetDlg(id) {
    const a = IP2.asset(id);
    if (!a) return;
    const ov = el('div', 'overlay');
    ov.addEventListener('mousedown', e => { if (e.target === ov) { ov.remove(); IPApp.reload(); } });
    const dlg = el('div', 'dlg');
    dlg.innerHTML = '<h3>资产 · ' + esc(a.name) + '</h3>' +
      '<div class="field"><label>名称</label><input id="as_t" value="' + esc(a.name) + '"></div>' +
      '<div class="fldrow">' +
        '<div class="field"><label>分类</label><select id="as_cat"><option value="">未分类</option>' +
          IP2.assetCats().map(c => '<option value="' + c.id + '"' + (a.cat === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') +
        '</select></div>' +
        '<div class="field"><label>类型</label><select id="as_kind">' +
          KINDS.map(k => '<option value="' + k + '"' + (a.kind === k ? ' selected' : '') + '>' + k + '</option>').join('') +
        '</select></div>' +
      '</div>' +
      '<div class="field"><label>挂到企划（不挂=全局通用）</label><select id="as_pid"><option value="">全局</option>' +
        IP2.projects().map(p => '<option value="' + p.id + '"' + (a.pid === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('') +
      '</select></div>' +
      '<div class="field"><label>内容 / 说明 / 网址</label><textarea id="as_b" rows="6" placeholder="设定内容、考据笔记、网站地址…">' + esc(a.body || '') + '</textarea></div>' +
      '<div class="field"><label>标签（逗号分隔）</label><input id="as_tags" value="' + esc((a.tags || []).join('，')) + '"></div>' +
      '<div class="btns"><button class="no" id="as_del">删除</button><button class="no" id="as_fl">⧉ 浮窗</button><button class="no" id="as_c">关闭</button><button class="ok" id="as_ok">保存</button></div>';
    ov.appendChild(dlg); document.body.appendChild(ov);

    document.getElementById('as_ok').addEventListener('click', () => {
      IP2.updAsset(a.id, {
        name: document.getElementById('as_t').value.trim() || a.name,
        cat: document.getElementById('as_cat').value,
        kind: document.getElementById('as_kind').value,
        pid: document.getElementById('as_pid').value || null,
        body: document.getElementById('as_b').value,
        tags: document.getElementById('as_tags').value.split(/[,，]/).map(x => x.trim()).filter(Boolean)
      });
      ov.remove(); IPApp.reload(); IPApp.toast('已保存');
    });
    document.getElementById('as_c').addEventListener('click', () => { ov.remove(); IPApp.reload(); });
    document.getElementById('as_fl').addEventListener('click', () => { ov.remove(); IPFloat.open('asset', a.id, a.name); });
    document.getElementById('as_del').addEventListener('click', () => {
      IPVN.ask('要删除资产「' + a.name + '」吗？', () => {
        IP2.delAsset(a.id); ov.remove(); IPApp.reload();
      }, { danger: true });
    });
    document.getElementById('as_t').focus();
  }

  return { render, assetDlg, newAssetDlg, catName, catColor };
})();
