/* projects.js —— 企划列表 + 企划工作台（内容树/条目/页面/打卡/时间线/关系网） */
window.IPProj = (function () {
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; };
  function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }

  const SKELS = [{ id: 'sk-novel', n: '小说企划' }, { id: 'sk-game', n: '游戏企划' }, { id: 'sk-oc', n: 'OC 合集' }, { id: '', n: '空白企划' }];

  // ================= 企划列表 =================
  function list(host) {
    host.innerHTML = '';
    const head = el('div', 'phead');
    head.innerHTML = '<h2>企划</h2>';
    const add = el('button', 'btn primary', '+ 新建企划');
    add.addEventListener('click', newProjectDlg);
    head.appendChild(add);
    host.appendChild(head);

    const hint = el('div', 'hintline', '企划是一个容器：世界观、人物、主线、大纲、草稿页，全都长在它下面。每个企划一棵自由生长的树。');
    host.appendChild(hint);

    const ps = IP2.projects();
    if (!ps.length) {
      host.appendChild(el('div', 'emptybox mm-empty', IPUI.mascot('jump') +
        '<div class="mm-empty-t"><b>还没有企划哦～</b>点右上「新建企划」，选个骨架（小说 / 游戏 / OC 合集），分支会自动长好。</div>'));
      return;
    }

    const grid = el('div', 'pgrid');
    ps.forEach(p => {
      const c = el('div', 'pcard');
      c.style.borderTop = '3px solid ' + p.color;
      const t = el('div', 'pcard-t');
      t.innerHTML = '<b>' + esc(p.name) + '</b>';
      c.appendChild(t);
      if (p.desc) c.appendChild(el('div', 'pcard-d', esc(p.desc)));

      const rate = IP2.projectRate(p.id);
      const bar = el('div', 'bar');
      const fill = el('div', 'bar-in');
      fill.style.width = (rate ? rate.pct : 0) + '%';
      fill.style.background = p.color;
      bar.appendChild(fill);
      c.appendChild(bar);

      const st = el('div', 'pcard-s');
      const ec = IP2.entriesOf(p.id).length;
      const pgc = IP2.pages(p.id).length;
      const gc = IP2.goalsOf(p.id).length;
      const chc = IP2.chaptersOf(p.id).filter(c => c.kind !== 'act').length;
      st.innerHTML = '<span>' + chc + ' 章</span><span>' + ec + ' 条目</span><span>' + pgc + ' 页</span>' +
        (rate ? '<span class="ok">今日 ' + rate.pct + '%</span>' : '<span>无目标</span>');
      c.appendChild(st);

      c.addEventListener('click', () => IPApp.go('project', p.id));
      const del = el('button', 'cardx', '×');
      del.title = '删除企划';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        IPVN.ask('要删除企划「' + p.name + '」吗？\n其全部分支与条目会一起删除，页面会保留但解除归属。', () => {
          IP2.delProject(p.id); IPApp.go('projects');
        }, { danger: true });
      });
      c.appendChild(del);
      grid.appendChild(c);
    });
    host.appendChild(grid);
  }

  function newProjectDlg() {
    const ov = el('div', 'overlay');
    ov.addEventListener('mousedown', e => { if (e.target === ov) ov.remove(); });
    const dlg = el('div', 'dlg');
    dlg.innerHTML = '<h3>新建企划</h3>' +
      '<div class="field"><label>企划名</label><input id="pj_name" placeholder="如：长歌行 / 雾隐城设定集"></div>' +
      '<div class="field"><label>一句话简介</label><input id="pj_desc" placeholder="如：仙侠长篇 · 修行与执念"></div>' +
      '<div class="field"><label>骨架（自动长出初始分支，之后随便改）</label><div id="pj_skels" class="skelrow"></div></div>' +
      '<div class="btns"><button class="no" id="pj_cancel">取消</button><button class="ok" id="pj_ok">创建</button></div>';
    ov.appendChild(dlg); document.body.appendChild(ov);

    const row = document.getElementById('pj_skels');
    let skel = 'sk-novel';
    SKELS.forEach(k => {
      const b = el('button', 'skelbtn' + (k.id === skel ? ' on' : ''), k.n);
      b.addEventListener('click', () => {
        skel = k.id;
        row.querySelectorAll('.skelbtn').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
      });
      row.appendChild(b);
    });

    document.getElementById('pj_cancel').addEventListener('click', () => ov.remove());
    document.getElementById('pj_ok').addEventListener('click', () => {
      const name = document.getElementById('pj_name').value.trim();
      if (!name) { IPApp.toast('给企划起个名字吧'); return; }
      const p = IP2.addProject(name, document.getElementById('pj_desc').value.trim(), null, skel);
      const tpl = skel ? IP2.template(skel) : null;
      if (tpl) (tpl.fields || []).forEach((f, i) => IP2.addNode(p.id, '', f.label, i));
      ov.remove();
      IPApp.toast('企划已创建，分支已按骨架长好');
      IPApp.go('project', p.id);
    });
    document.getElementById('pj_name').focus();
  }

  // ================= 企划工作台 =================
  let curPid = null, curTab = 'over', curNode = '', curPageId = null;

  function work(host, pid, tab) {
    const p = IP2.project(pid);
    if (!p) { IPApp.go('projects'); return; }
    curPid = pid; curTab = tab || curTab || 'over';
    host.innerHTML = '';

    // 头部
    const head = el('div', 'pjhead');
    const back = el('button', 'btn ghost', '← 全部企划');
    back.addEventListener('click', () => IPApp.go('projects'));
    head.appendChild(back);
    const dot = el('span', 'pjdot'); dot.style.background = p.color; head.appendChild(dot);
    const nm = el('input', 'pjname');
    nm.value = p.name;
    nm.addEventListener('change', () => { IP2.updProject(p.id, { name: nm.value.trim() || p.name }); IPApp.reload(); });
    head.appendChild(nm);
    const desc = el('input', 'pjdesc');
    desc.value = p.desc || '';
    desc.placeholder = '一句话简介…';
    desc.addEventListener('change', () => IP2.updProject(p.id, { desc: desc.value.trim() }));
    head.appendChild(desc);
    const rate = IP2.projectRate(p.id);
    if (rate) { const r = el('span', 'pjrate', '今日目标 ' + rate.done + '/' + rate.total); head.appendChild(r); }
    host.appendChild(head);

    // Tab
    const tabs = el('div', 'pjtabs');
    [['over', '总览'], ['tree', '内容'], ['chapters', '章节'], ['pages', '页面'], ['checkin', '打卡'], ['timeline', '时间线'], ['graph', '关系网']].forEach(([k, n]) => {
      const b = el('button', 'pjtab' + (k === curTab ? ' on' : ''), n);
      b.addEventListener('click', () => { curTab = k; work(host, pid, k); });
      tabs.appendChild(b);
    });
    host.appendChild(tabs);

    const body = el('div', 'pjbody');
    body.id = 'pjbody';
    host.appendChild(body);

    if (curTab === 'over') renderOver(body, p);
    else if (curTab === 'tree') renderTree(body, p);
    else if (curTab === 'chapters') IPCh.render(body, p);
    else if (curTab === 'pages') renderPages(body, p);
    else if (curTab === 'checkin') renderCheckin(body, p);
    else if (curTab === 'timeline') renderTimeline(body, p);
    else if (curTab === 'graph') renderGraph(body, p);
  }

  // ---------- 总览 ----------
  function renderOver(host, p) {
    const stats = [['卷', IP2.chaptersOf(p.id).filter(c => c.kind === 'act').length],
      ['章', IP2.chaptersOf(p.id).filter(c => c.kind !== 'act').length],
      ['字数', IP2.chapterWordsTotal(p.id)],
      ['条目', IP2.entriesOf(p.id).length],
      ['页面', IP2.pages(p.id).length], ['标记', IP2.get().annos.filter(a => { const pg = IP2.page(a.pageId); return pg && pg.pid === p.id; }).length],
      ['逻辑线', IP2.lines().length], ['灵感', IP2.ideas().filter(i => !i.merged).length]];
    const g = el('div', 'statgrid');
    stats.forEach(([k, v]) => { const c = el('div', 'stat'); c.innerHTML = '<div class="sv">' + v + '</div><div class="sk">' + k + '</div>'; g.appendChild(c); });
    host.appendChild(g);

    // 打卡摘要
    const gs = IP2.goalsOf(p.id);
    if (gs.length) {
      host.appendChild(el('div', 'sech', '今日目标'));
      const w = el('div', 'goalwrap');
      gs.forEach(gg => {
        const pr = IP2.goalProgress(gg);
        const r = el('div', 'goalrow');
        const chk = el('button', 'chkbtn' + (pr.done ? ' on' : ''), pr.done ? '✓' : '');
        chk.addEventListener('click', () => { IP2.toggleCheck(gg.id, IP2.todayStr()); work(document.getElementById('content'), curPid, 'over'); });
        r.appendChild(chk);
        r.appendChild(el('div', 'gt', esc(gg.title)));
        r.appendChild(el('div', 'gv', gg.mode === 'amount' ? (pr.value + ' / ' + gg.target + ' ' + (gg.unit || '')) : (pr.done ? '已完成' : '未完成')));
        w.appendChild(r);
      });
      host.appendChild(w);
    }

    // 最近条目
    const es = IP2.entriesOf(p.id).slice(0, 6);
    host.appendChild(el('div', 'sech', '最近条目'));
    if (!es.length) host.appendChild(el('div', 'emptybox', '还没有条目。去「内容」页，在分支下新建。'));
    const grid = el('div', 'egrid');
    es.forEach(e => grid.appendChild(entryCard(e)));
    host.appendChild(grid);
  }

  function entryCard(e) {
    const c = el('div', 'ecard');
    c.innerHTML = '<b>' + esc(e.title) + '</b>';
    const body = (e.body || '').slice(0, 80);
    if (body) c.appendChild(el('div', 'ecard-b', esc(body)));
    const fk = Object.keys(e.fields || {}).filter(k => (e.fields[k] || '').trim());
    if (fk.length) {
      const fs = el('div', 'efields');
      fk.slice(0, 3).forEach(k => { fs.appendChild(el('span', 'efield', '<i>' + esc(k) + '</i>' + esc(String(e.fields[k]).slice(0, 24)))); });
      c.appendChild(fs);
    }
    const fl = el('button', 'cardf', '⧉');
    fl.title = '在浮窗中打开';
    fl.addEventListener('click', (ev) => { ev.stopPropagation(); IPFloat.open('entry', e.id, e.title); });
    c.appendChild(fl);
    c.addEventListener('click', () => entryDlg(e.id));
    return c;
  }

  // ---------- 内容树 ----------
  function renderTree(host, p) {
    host.innerHTML = '';
    const wrap = el('div', 'treewrap');
    const left = el('div', 'treeleft');
    const right = el('div', 'treeright');
    wrap.appendChild(left); wrap.appendChild(right);
    host.appendChild(wrap);

    // 分支树
    const lh = el('div', 'sidehead2');
    lh.innerHTML = '<b>内容树</b>';
    const addRoot = el('button', 'mini', '+ 分支');
    addRoot.addEventListener('click', () => {
      const n = prompt('新分支名字（如：势力设定 / 第二卷大纲）');
      if (!n) return;
      IP2.addNode(p.id, '', n.trim()); IPApp.reload();
    });
    lh.appendChild(addRoot);
    left.appendChild(lh);

    const rows = IP2.treeRows(p.id);
    if (!rows.length) left.appendChild(el('div', 'emptyhint', '还没有分支。点「+ 分支」随便建，想建几层都行。'));
    rows.forEach(({ node, depth }) => {
      const r = el('div', 'trow' + (node.id === curNode ? ' on' : ''));
      r.style.paddingLeft = (8 + depth * 14) + 'px';
      r.appendChild(el('span', 'tic', depth ? '└' : '▸'));
      const nm = el('span', 'tname'); nm.textContent = node.name; r.appendChild(nm);
      r.appendChild(el('span', 'tnum', String(IP2.entriesOf(p.id, node.id).length)));
      const ops = el('span', 'tops');
      const bAdd = el('button', 'tx', '+'); bAdd.title = '建子分支';
      bAdd.addEventListener('click', (e) => {
        e.stopPropagation();
        const n = prompt('「' + node.name + '」下的子分支名字');
        if (n) { IP2.addNode(p.id, node.id, n.trim()); IPApp.reload(); }
      });
      const bRen = el('button', 'tx', '✎'); bRen.title = '改名';
      bRen.addEventListener('click', (e) => {
        e.stopPropagation();
        const n = prompt('改名为', node.name);
        if (n) { IP2.updNode(node.id, { name: n.trim() }); IPApp.reload(); }
      });
      const bDel = el('button', 'tx', '×'); bDel.title = '删除分支及其条目';
      bDel.addEventListener('click', (e) => {
        e.stopPropagation();
        IPVN.ask('要删除分支「' + node.name + '」吗？\n其下所有条目会一起删除。', () => {
          IP2.delNode(node.id); curNode = ''; IPApp.reload();
        }, { danger: true });
      });
      ops.appendChild(bAdd); ops.appendChild(bRen); ops.appendChild(bDel);
      r.appendChild(ops);
      r.addEventListener('click', () => { curNode = node.id; work(document.getElementById('content'), curPid, 'tree'); });
      left.appendChild(r);
    });

    // 条目区
    const rh = el('div', 'sidehead2');
    const node = curNode ? IP2.node(curNode) : null;
    rh.innerHTML = '<b>' + esc(node ? node.name : '全部条目') + '</b>';
    const ops = el('span', 'tops');
    const bNew = el('button', 'mini', '+ 条目');
    bNew.addEventListener('click', () => newEntryDlg(p, curNode));
    ops.appendChild(bNew);
    if (curNode) {
      const bAll = el('button', 'mini', '看全部');
      bAll.addEventListener('click', () => { curNode = ''; work(document.getElementById('content'), curPid, 'tree'); });
      ops.appendChild(bAll);
    }
    rh.appendChild(ops);
    right.appendChild(rh);

    const es = IP2.entriesOf(p.id, curNode || undefined);
    if (!es.length) right.appendChild(el('div', 'emptyhint', '这个分支下还没有条目。'));
    const grid = el('div', 'egrid');
    es.forEach(e => grid.appendChild(entryCard(e)));
    right.appendChild(grid);
  }

  function newEntryDlg(p, nodeId) {
    const ov = el('div', 'overlay');
    ov.addEventListener('mousedown', e => { if (e.target === ov) ov.remove(); });
    const dlg = el('div', 'dlg');
    const tps = IP2.templates('entry');
    dlg.innerHTML = '<h3>新建条目</h3>' +
      '<div class="field"><label>标题</label><input id="ne_t" placeholder="如：沈既明 / 青石巷 / 卷一转折"></div>' +
      '<div class="field"><label>用哪个模板（决定有哪些字段，之后可加）</label><select id="ne_tpl">' +
      '<option value="">不套模板</option>' + tps.map(t => '<option value="' + t.id + '">' + esc(t.name) + '</option>').join('') +
      '</select></div>' +
      '<div class="btns"><button class="no" id="ne_c">取消</button><button class="ok" id="ne_ok">创建并编辑</button></div>';
    ov.appendChild(dlg); document.body.appendChild(ov);
    document.getElementById('ne_c').addEventListener('click', () => ov.remove());
    document.getElementById('ne_ok').addEventListener('click', () => {
      const t = document.getElementById('ne_t').value.trim() || '新条目';
      const tpl = document.getElementById('ne_tpl').value;
      const e = IP2.addEntry(p.id, nodeId || '', t, tpl);
      ov.remove(); entryDlg(e.id);
    });
    document.getElementById('ne_t').focus();
  }

  function entryDlg(id) {
    const e = IP2.entry(id);
    if (!e) return;
    const ov = el('div', 'overlay');
    ov.addEventListener('mousedown', ev => { if (ev.target === ov) { IP2.save(true); ov.remove(); IPApp.reload(); } });
    const dlg = el('div', 'dlg wide');
    const tpl = e.tplId ? IP2.template(e.tplId) : null;
    dlg.innerHTML = '<h3>条目 · ' + esc(e.title) + '</h3>' +
      '<div class="field"><label>标题</label><input id="ed_t" value="' + esc(e.title) + '"></div>' +
      '<div class="field" id="ed_fields"></div>' +
      '<div class="field"><label>正文 / 备注</label><textarea id="ed_b" rows="6" placeholder="想写什么写什么">' + esc(e.body || '') + '</textarea></div>' +
      '<div class="fldrow"><div class="field"><label>标签（逗号分隔）</label><input id="ed_tags" value="' + esc((e.tags || []).join('，')) + '"></div>' +
      '<div class="field"><label>进时间线的日期（可空）</label><input id="ed_date" type="date" value="' + esc(e.date || '') + '"></div></div>' +
      '<div class="btns"><button class="no" id="ed_del">删除</button><button class="no" id="ed_c">关闭</button><button class="ok" id="ed_ok">保存</button></div>';
    ov.appendChild(dlg); document.body.appendChild(ov);

    const fh = document.getElementById('ed_fields');
    const keys = [];
    if (tpl) (tpl.fields || []).forEach(f => { keys.push(f); });
    Object.keys(e.fields || {}).forEach(k => { if (!keys.some(f => f.key === k)) keys.push({ key: k, label: k }); });
    keys.forEach(f => {
      const row = el('div', 'field');
      row.innerHTML = '<label>' + esc(f.label) + '</label>';
      const ta = el('textarea');
      ta.rows = 2; ta.dataset.k = f.key; ta.value = (e.fields || {})[f.key] || '';
      row.appendChild(ta);
      fh.appendChild(row);
    });
    const addF = el('button', 'mini', '+ 加一个自定义字段');
    addF.addEventListener('click', () => {
      const k = prompt('字段名（如：口头禅）');
      if (!k) return;
      const fields = Object.assign({}, e.fields); fields[k.trim()] = '';
      IP2.updEntry(e.id, { fields });
      ov.remove(); entryDlg(e.id);
    });
    fh.appendChild(addF);

    const save = () => {
      const fields = {};
      fh.querySelectorAll('textarea[data-k]').forEach(t => { fields[t.dataset.k] = t.value; });
      const tags = document.getElementById('ed_tags').value.split(/[,，]/).map(x => x.trim()).filter(Boolean);
      IP2.updEntry(e.id, {
        title: document.getElementById('ed_t').value.trim() || e.title,
        body: document.getElementById('ed_b').value,
        date: document.getElementById('ed_date').value || '',
        fields, tags
      });
      ov.remove(); IPApp.reload();
      IPApp.toast('已保存');
    };
    document.getElementById('ed_ok').addEventListener('click', save);
    document.getElementById('ed_c').addEventListener('click', () => { ov.remove(); IPApp.reload(); });
    document.getElementById('ed_del').addEventListener('click', () => {
      IPVN.ask('要删除条目「' + e.title + '」吗？', () => {
        IP2.delEntry(e.id); ov.remove(); IPApp.reload();
      }, { danger: true });
    });
  }

  // ---------- 页面（看稿 / 草稿） ----------
  function renderPages(host, p) {
    host.innerHTML = '';
    const wrap = el('div', 'treewrap');
    const left = el('div', 'treeleft');
    const right = el('div', 'treeright pad0');
    wrap.appendChild(left); wrap.appendChild(right);
    host.appendChild(wrap);

    const lh = el('div', 'sidehead2'); lh.innerHTML = '<b>页面</b>';
    const b0 = el('button', 'mini', '+ 画布');
    b0.title = '无限画布：自由摆放文字块 / 图片 / 卡片 / 便签，可连线、一键导图布局';
    b0.addEventListener('click', () => {
      const pg = IP2.addPage({ pid: p.id, name: '画布 ' + (IP2.pages(p.id).filter(x => x.kind === 'board').length + 1), kind: 'board', isDraft: true });
      renderPages(host, p); openIn(right, pg.id);
    });
    const b1 = el('button', 'mini', '+ 正文页');
    b1.addEventListener('click', () => newPageDlg(p, right, left));
    const b2 = el('button', 'mini', '+ 草稿纸');
    b2.addEventListener('click', () => {
      const pg = IP2.addPage({ pid: p.id, name: '草稿纸 ' + (IP2.pages(p.id).filter(x => x.kind === 'sheet').length + 1), kind: 'sheet', isDraft: true });
      renderPages(host, p); openIn(right, pg.id);
    });
    lh.appendChild(b2); lh.appendChild(b0); lh.appendChild(b1);
    left.appendChild(lh);

    const pgs = IP2.pages(p.id);
    if (!pgs.length) left.appendChild(el('div', 'emptyhint', '还没有页面。「+ 正文页」把写好的章节粘进来，「+ 草稿纸」随手写画。'));
    pgs.forEach(pg => {
      const it = el('div', 'pgitem' + (pg.id === curPageId ? ' on' : ''));
      const b = el('b'); b.textContent = pg.name; it.appendChild(b);
      it.appendChild(el('span', '', pg.kind === 'sheet' ? '草稿纸' : (pg.isDraft ? '草稿 · ' : '') + pg.segments.length + ' 段'));
      const x = el('button', 'mini', '×');
      x.style.cssText = 'padding:0 5px;opacity:.5;margin-left:auto';
      x.addEventListener('click', (ev) => {
        ev.stopPropagation();
        IPVN.ask('要删除页面「' + pg.name + '」吗？\n其标记与笔迹会一起删除。', () => {
          IP2.delPage(pg.id); if (curPageId === pg.id) curPageId = null;
          renderPages(host, p);
        }, { danger: true });
      });
      it.appendChild(x);
      const fl = el('button', 'mini', '⧉');
      fl.title = '在浮窗中打开';
      fl.addEventListener('click', (ev) => { ev.stopPropagation(); IPFloat.open('page', pg.id, pg.name); });
      it.appendChild(fl);
      it.addEventListener('click', () => openIn(right, pg.id));
      left.appendChild(it);
    });

    if (pgs.length) openIn(right, (curPageId && IP2.page(curPageId) && IP2.page(curPageId).pid === p.id) ? curPageId : pgs[0].id);
    else { right.innerHTML = ''; IPEd.setRoot(right); IPEd.emptyState(); }
  }

  function openIn(right, id) {
    curPageId = id;
    right.innerHTML = '';
    const pg = IP2.page(id);
    if (pg && pg.kind === 'board') {
      IPBoard.open(right, id);          // 无限画布走专属模块
    } else {
      IPEd.setRoot(right);
      IPEd.open(id);
      IPEd.afterMount();
    }
    document.querySelectorAll('.pgitem').forEach(x => x.classList.remove('on'));
    const cur = Array.from(document.querySelectorAll('.pgitem')).find(x => x.__id === id);
    if (cur) cur.classList.add('on');
  }

  function newPageDlg(p, right, left) {
    const ov = el('div', 'overlay');
    ov.addEventListener('mousedown', e => { if (e.target === ov) ov.remove(); });
    const dlg = el('div', 'dlg');
    dlg.innerHTML = '<h3>新建正文页</h3>' +
      '<div class="field"><label>页面名称</label><input id="np_name" placeholder="如：第 4 章 / 大结局大纲"></div>' +
      '<div class="field"><label>粘贴正文或大纲（空行分段）</label><textarea id="np_text" rows="8"></textarea></div>' +
      '<div class="field"><label><input type="checkbox" id="np_draft" style="width:auto"> 这只是草稿</label></div>' +
      '<div class="btns"><button class="no" id="np_c">取消</button><button class="ok" id="np_ok">创建并打开</button></div>';
    ov.appendChild(dlg); document.body.appendChild(ov);
    document.getElementById('np_c').addEventListener('click', () => ov.remove());
    document.getElementById('np_ok').addEventListener('click', () => {
      const name = document.getElementById('np_name').value.trim() || '未命名正文页';
      const text = document.getElementById('np_text').value.replace(/\r\n/g, '\n').trim();
      const pg = IP2.addPage({ pid: p.id, name, kind: 'doc', isDraft: document.getElementById('np_draft').checked, text });
      ov.remove();
      renderPages(document.getElementById('pjbody'), p);
      openIn(document.querySelector('.treeright'), pg.id);
    });
    document.getElementById('np_name').focus();
  }

  // ---------- 打卡 ----------
  function renderCheckin(host, p) {
    host.innerHTML = '';
    host.appendChild(el('div', 'sech', '目标'));
    const gs = IP2.goalsOf(p.id);
    const w = el('div', 'goalwrap');
    gs.forEach(g => {
      const r = el('div', 'goalrow');
      const pr = IP2.goalProgress(g);
      const chk = el('button', 'chkbtn' + (pr.done ? ' on' : ''), pr.done ? '✓' : '');
      chk.addEventListener('click', () => { IP2.toggleCheck(g.id, IP2.todayStr()); work(document.getElementById('content'), curPid, 'checkin'); });
      r.appendChild(chk);
      r.appendChild(el('div', 'gt', esc(g.title)));
      r.appendChild(el('div', 'gv', g.mode === 'amount' ? (pr.value + ' / ' + g.target + ' ' + (g.unit || '')) : (pr.done ? '已完成' : '未完成')));
      const x = el('button', 'mini', '×');
      x.addEventListener('click', () => { IPVN.ask('要删除目标「' + g.title + '」吗？\n其打卡记录会一起删除。', () => { IP2.delGoal(g.id); IPApp.reload(); }, { danger: true }); });
      r.appendChild(x);
      w.appendChild(r);
    });
    host.appendChild(w);

    const add = el('button', 'btn ghost', '+ 新目标');
    add.addEventListener('click', () => goalDlg(p));
    host.appendChild(add);

    host.appendChild(el('div', 'sech', '最近 14 天'));
    const today = IP2.todayStr();
    const days = [];
    for (let i = 13; i >= 0; i--) days.push(IP2.dateAdd(today, -i));
    const cal = el('div', 'cal14');
    days.forEach(d => {
      const c = el('div', 'cday' + (d === today ? ' today' : ''));
      const dt = new Date(d + 'T00:00:00');
      c.appendChild(el('div', 'cdt', String(dt.getDate())));
      let n = 0;
      gs.forEach(g => { if (IP2.goalProgress(g, d).done) n++; });
      c.appendChild(el('div', 'cdn', gs.length ? n + '/' + gs.length : '·'));
      if (n && gs.length) c.classList.add('has');
      cal.appendChild(c);
    });
    host.appendChild(cal);
  }

  function goalDlg(p) {
    const ov = el('div', 'overlay');
    ov.addEventListener('mousedown', e => { if (e.target === ov) ov.remove(); });
    const dlg = el('div', 'dlg');
    dlg.innerHTML = '<h3>新目标</h3>' +
      '<div class="field"><label>目标名</label><input id="gt_t" placeholder="如：每日码字 / 每周整理设定"></div>' +
      '<div class="fldrow"><div class="field"><label>周期</label><select id="gt_c"><option value="daily">每天</option><option value="weekly">每周</option><option value="monthly">每月</option></select></div>' +
      '<div class="field"><label>计法</label><select id="gt_m"><option value="count">完成就好</option><option value="amount">累计数量</option></select></div></div>' +
      '<div class="fldrow"><div class="field"><label>目标量</label><input id="gt_n" type="number" value="1"></div>' +
      '<div class="field"><label>单位（可空）</label><input id="gt_u" placeholder="字 / 条 / 章"></div></div>' +
      '<div class="btns"><button class="no" id="gt_c2">取消</button><button class="ok" id="gt_ok">创建</button></div>';
    ov.appendChild(dlg); document.body.appendChild(ov);
    document.getElementById('gt_c2').addEventListener('click', () => ov.remove());
    document.getElementById('gt_ok').addEventListener('click', () => {
      IP2.addGoal({ pid: p.id, title: document.getElementById('gt_t').value.trim() || '新目标',
        cadence: document.getElementById('gt_c').value, mode: document.getElementById('gt_m').value,
        target: Number(document.getElementById('gt_n').value) || 1, unit: document.getElementById('gt_u').value.trim() });
      ov.remove(); IPApp.reload();
    });
    document.getElementById('gt_t').focus();
  }

  // ---------- 时间线 ----------
  function renderTimeline(host, p) {
    host.innerHTML = '';
    host.appendChild(el('div', 'hintline', '给条目填上「进时间线的日期」，它们会自动排成轴。适合排剧情年表、人物履历。'));
    const es = IP2.entriesOf(p.id).filter(e => e.date).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    if (!es.length) { host.appendChild(el('div', 'emptybox', '还没有带日期的条目。在「内容」页打开任一条目，填「进时间线的日期」即可。')); return; }
    const tl = el('div', 'tl');
    es.forEach(e => {
      const it = el('div', 'tlitem');
      it.appendChild(el('div', 'tldate', esc(e.date)));
      const box = el('div', 'tlbox');
      box.innerHTML = '<b>' + esc(e.title) + '</b>';
      if (e.body) box.appendChild(el('div', 'tlbody', esc(e.body.slice(0, 140))));
      box.addEventListener('click', () => entryDlg(e.id));
      it.appendChild(box);
      tl.appendChild(it);
    });
    host.appendChild(tl);
  }

  // ---------- 关系网 ----------
  function renderGraph(host, p) {
    host.innerHTML = '';
    const es = IP2.entriesOf(p.id);
    const rs = IP2.relsOf(p.id);
    if (es.length < 2) { host.appendChild(el('div', 'emptybox', '至少两个条目才能连关系。先去「内容」页建几条。')); return; }

    const tool = el('div', 'graphtool');
    const selA = el('select', 'sel'); selA.innerHTML = es.map(e => '<option value="' + e.id + '">' + esc(e.title) + '</option>').join('');
    const selB = el('select', 'sel'); selB.innerHTML = es.map(e => '<option value="' + e.id + '">' + esc(e.title) + '</option>').join('');
    if (es[1]) selB.value = es[1].id;
    const lab = el('input', 'sel'); lab.placeholder = '关系名（如：同门 / 暗恋 / 宿敌）';
    const dir = el('select', 'sel'); dir.innerHTML = '<option value="one">单向</option><option value="two">双向</option>';
    const add = el('button', 'btn primary', '连线');
    add.addEventListener('click', () => {
      IP2.addRel(p.id, selA.value, selB.value, lab.value.trim(), dir.value);
      IPApp.reload();
    });
    tool.appendChild(selA); tool.appendChild(el('span', 'garrow', '→'));
    tool.appendChild(selB); tool.appendChild(lab); tool.appendChild(dir); tool.appendChild(add);
    host.appendChild(tool);

    // 环形布局
    const used = {};
    rs.forEach(r => { used[r.a] = 1; used[r.b] = 1; });
    const nodes = es.filter(e => used[e.id]) ;
    if (!nodes.length) { host.appendChild(el('div', 'emptybox', '还没有连线。用上面那排建一条。')); return; }
    const W = Math.max(680, nodes.length * 100), H = Math.max(360, nodes.length * 58);
    const cx = W / 2, cy = H / 2, R = Math.min(cx, cy) - 70;
    const pos = {};
    nodes.forEach((n, i) => { const ang = 2 * Math.PI * i / nodes.length - Math.PI / 2; pos[n.id] = { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) }; });

    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:' + H + 'px">';
    svg += '<defs><marker id="ar" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#8b8a9a"/></marker></defs>';
    rs.forEach(r => {
      const a = pos[r.a], b = pos[r.b];
      if (!a || !b) return;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      svg += '<path d="M' + a.x + ',' + a.y + ' Q' + mx + ',' + (my - 26) + ' ' + b.x + ',' + b.y + '" fill="none" stroke="#8b8a9a" stroke-width="1.4" marker-end="url(#ar)"/>';
      svg += '<text x="' + mx + '" y="' + (my - 30) + '" fill="#a9a8b8" font-size="12" text-anchor="middle">' + esc(r.label || '') + '</text>';
    });
    nodes.forEach(n => {
      const q = pos[n.id];
      svg += '<circle cx="' + q.x + '" cy="' + q.y + '" r="26" fill="#2a2933" stroke="' + p.color + '" stroke-width="2"/>';
      svg += '<text x="' + q.x + '" y="' + (q.y + 4) + '" fill="#e8e7ee" font-size="12" text-anchor="middle">' + esc(n.title.slice(0, 5)) + '</text>';
    });
    svg += '</svg>';
    const box = el('div', 'graphbox'); box.innerHTML = svg;
    host.appendChild(box);

    if (rs.length) {
      host.appendChild(el('div', 'sech', '关系清单'));
      const w = el('div', 'relwrap');
      rs.forEach(r => {
        const row = el('div', 'relrow');
        const ea = IP2.entry(r.a), eb = IP2.entry(r.b);
        row.innerHTML = '<b>' + esc(ea ? ea.title : '?') + '</b><span class="rl">' + esc(r.label || '关联') + (r.dir === 'two' ? ' ↔' : ' →') + '</span><b>' + esc(eb ? eb.title : '?') + '</b>';
        const x = el('button', 'mini', '×');
        x.addEventListener('click', () => { IP2.delRel(r.id); IPApp.reload(); });
        row.appendChild(x);
        w.appendChild(row);
      });
      host.appendChild(w);
    }
  }

  // 供全局调用：从检索/标签聚合跳到某页并打开
  function openPageGlobal(pageId) {
    const pg = IP2.page(pageId);
    if (!pg) return;
    curPageId = pageId; curTab = 'pages';
    const pid = pg.pid || (IP2.projects()[0] || {}).id;
    if (!pid) return;
    curPid = pid;
    window.IPApp.go('project', pid);
  }

  return { list, work, entryDlg, openPageGlobal };
})();
