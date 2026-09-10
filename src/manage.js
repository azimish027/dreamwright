/* manage.js —— 今日打卡 / 灵感箱 / 模板库 / 统计 / 数据 */
window.IPManage = (function () {
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; };
  function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }

  let curDate = null;

  // ================= 今日 =================
  function today(host) {
    curDate = curDate || IP2.todayStr();
    host.innerHTML = '';
    const head = el('div', 'phead');
    head.innerHTML = '<h2>今日</h2>';
    const d = new Date(curDate + 'T00:00:00');
    head.appendChild(el('span', 'todaydate', curDate + ' 周' + IP2.cnW(curDate)));
    if (curDate !== IP2.todayStr()) {
      const b = el('button', 'btn ghost', '回到今天');
      b.addEventListener('click', () => { curDate = IP2.todayStr(); today(host); });
      head.appendChild(b);
    }
    host.appendChild(head);

    // v13 梦梦对话向导（文案随今日进度变化）
    if (window.IPVN) {
      let wstate = 'fresh';
      try {
        const gl = IP2.allGoals();
        if (IP2.projects().length || gl.length) {
          if (!gl.length) wstate = 'nogoal';
          else {
            const r0 = IP2.projectRate('', curDate);
            wstate = (!r0 || !r0.pct) ? 'zero' : (r0.pct >= 100 ? 'done' : 'mid');
          }
        }
      } catch (e) {}
      IPVN.wizard(host, wstate);
    }

    // 周历
    const wr = IP2.weekRange(curDate);
    const cal = el('div', 'cal7');
    IP2.rangeDates(wr.from, wr.to).forEach(dt => {
      const c = el('div', 'd' + (dt === curDate ? ' cur' : '') + (dt === IP2.todayStr() ? ' today' : ''));
      c.appendChild(el('div', 'dw', '周' + IP2.cnW(dt)));
      c.appendChild(el('div', 'dn', String(new Date(dt + 'T00:00:00').getDate())));
      const rate = IP2.projectRate('', dt);
      c.appendChild(el('div', 'cnt', rate ? rate.pct + '%' : '·'));
      if (rate && rate.pct > 0) c.classList.add('has');
      c.addEventListener('click', () => { curDate = dt; today(host); });
      cal.appendChild(c);
    });
    host.appendChild(cal);

    // 全局习惯（pid 为空的目标）
    const globals = IP2.allGoals().filter(g => !g.pid);
    const pjs = IP2.projects();

    host.appendChild(el('div', 'sech', '今日打卡'));
    const w = el('div', 'goalwrap');
    globals.forEach(g => w.appendChild(goalRow(g, host)));
    if (!globals.length && !pjs.length) w.appendChild(el('div', 'emptyhint', '还没有目标。去某个企划的「打卡」页建一个。'));
    host.appendChild(w);

    // 各企划并排
    if (pjs.length) {
      host.appendChild(el('div', 'sech', '各企划今日'));
      const grid = el('div', 'todaygrid');
      pjs.forEach(p => {
        const c = el('div', 'todaycard');
        c.style.borderTop = '3px solid ' + p.color;
        c.innerHTML = '<b>' + esc(p.name) + '</b>';
        const gs = IP2.goalsOf(p.id);
        if (!gs.length) { c.appendChild(el('div', 'tip', '未设目标')); }
        else {
          gs.forEach(g => c.appendChild(goalRow(g, host, true)));
          const rate = IP2.projectRate(p.id, curDate);
          const bar = el('div', 'bar');
          const f = el('div', 'bar-in'); f.style.width = rate.pct + '%'; f.style.background = p.color;
          bar.appendChild(f); c.appendChild(bar);
          c.appendChild(el('div', 'tip', '达标 ' + rate.done + '/' + rate.total + '（' + rate.pct + '%）'));
        }
        c.addEventListener('click', (e) => { if (e.target.closest('button')) return; IPApp.go('project', p.id); });
        grid.appendChild(c);
      });
      host.appendChild(grid);
    }
  }

  function goalRow(g, host, compact) {
    const r = el('div', 'goalrow' + (compact ? ' mini' : ''));
    const pr = IP2.goalProgress(g, curDate || IP2.todayStr());
    const chk = el('button', 'chkbtn' + (pr.done ? ' on' : ''), pr.done ? '✓' : '');
    chk.addEventListener('click', (e) => {
      e.stopPropagation();
      IP2.toggleCheck(g.id, curDate || IP2.todayStr());
      today(host);
    });
    r.appendChild(chk);
    const t = el('div', 'gt', esc(g.title));
    const pj = g.pid ? IP2.project(g.pid) : null;
    if (pj && !compact) t.appendChild(el('span', 'gpj', esc(pj.name)));
    r.appendChild(t);
    r.appendChild(el('div', 'gv', g.mode === 'amount'
      ? (pr.value + ' / ' + g.target + ' ' + (g.unit || ''))
      : (pr.done ? '已完成' : '未完成')));
    return r;
  }

  // ================= 灵感箱 =================
  function ideas(host) {
    host.innerHTML = '';
    const head = el('div', 'phead');
    head.innerHTML = '<h2>灵感箱</h2>';
    head.appendChild(el('span', 'tip', '想到就记，之后可以沉淀到某个企划里变成正式条目'));
    host.appendChild(head);

    const box = el('div', 'ideabox');
    const ta = el('textarea', 'ideain');
    ta.placeholder = '随手一句：一个画面、一句台词、一个还没成形的设定…';
    ta.rows = 2;
    const tin = el('input', 'ideatag'); tin.placeholder = '标签（逗号分隔，可空）';
    const btn = el('button', 'btn primary', '记下来');
    btn.addEventListener('click', () => {
      const t = ta.value.trim();
      if (!t) { IPApp.toast('先写点什么'); return; }
      IP2.addIdea(t, tin.value.split(/[,，]/).map(x => x.trim()).filter(Boolean));
      ta.value = ''; tin.value = ''; ideas(host); IPApp.toast('已记下');
    });
    box.appendChild(ta); box.appendChild(tin); box.appendChild(btn);
    host.appendChild(box);

    const ps = IP2.projects();
    const list = IP2.ideas();
    const filt = el('div', 'filterrow');
    let showMerged = false;
    const fbtn = el('button', 'mini', '显示已沉淀');
    fbtn.addEventListener('click', () => { showMerged = !showMerged; fbtn.textContent = showMerged ? '隐藏已沉淀' : '显示已沉淀'; ideas(host); });
    filt.appendChild(fbtn);
    host.appendChild(filt);

    const shown = list.filter(i => showMerged ? true : !i.merged);
    if (!shown.length) host.appendChild(el('div', 'emptybox', '灵感箱是空的。'));
    const grid = el('div', 'ideagrid');
    shown.forEach(i => {
      const c = el('div', 'ideacard' + (i.merged ? ' done' : ''));
      c.appendChild(el('div', 'itx', esc(i.text)));
      if ((i.tags || []).length) {
        const tg = el('div', 'itags');
        i.tags.forEach(t => tg.appendChild(el('span', 'itag', esc(t))));
        c.appendChild(tg);
      }
      if ((i.history || []).length) {
        c.appendChild(el('div', 'ihis', (i.history.length) + ' 次演变'));
      }
      const ops = el('div', 'iops');
      const bM = el('button', 'mini', i.merged ? '已沉淀' : '沉淀到企划');
      if (!i.merged) bM.addEventListener('click', () => mergeDlg(i, ps));
      const bE = el('button', 'mini', '改写');
      bE.addEventListener('click', () => {
        const n = prompt('改写这条灵感（旧版本会留在演变记录里）', i.text);
        if (n == null) return;
        IP2.updIdea(i.id, { text: n.trim() || i.text });
        IPApp.reload();
      });
      const bD = el('button', 'mini danger', '×');
      bD.addEventListener('click', () => { IPVN.ask('要把这条灵感删掉吗？', () => { IP2.delIdea(i.id); ideas(host); }, { danger: true }); });
      ops.appendChild(bM); ops.appendChild(bE); ops.appendChild(bD);
      c.appendChild(ops);
      grid.appendChild(c);
    });
    host.appendChild(grid);
  }

  function mergeDlg(i, ps) {
    if (!ps.length) { IPApp.toast('先建一个企划，才能把灵感沉淀过去'); return; }
    const ov = el('div', 'overlay');
    ov.addEventListener('mousedown', e => { if (e.target === ov) ov.remove(); });
    const dlg = el('div', 'dlg');
    dlg.innerHTML = '<h3>沉淀到企划</h3>' +
      '<div class="field"><label>选企划</label><select id="mg_p">' + ps.map(p => '<option value="' + p.id + '">' + esc(p.name) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>放进哪个分支</label><select id="mg_n"></select></div>' +
      '<div class="field"><label>作为条目的标题</label><input id="mg_t" value="' + esc(i.text.slice(0, 20)) + '"></div>' +
      '<div class="btns"><button class="no" id="mg_c">取消</button><button class="ok" id="mg_ok">沉淀</button></div>';
    ov.appendChild(dlg); document.body.appendChild(ov);

    const selP = document.getElementById('mg_p'), selN = document.getElementById('mg_n');
    function fillNodes() {
      const rows = IP2.treeRows(selP.value);
      selN.innerHTML = '<option value="">（不挂分支）</option>' +
        rows.map(r => '<option value="' + r.node.id + '">' + '　'.repeat(r.depth) + esc(r.node.name) + '</option>').join('');
    }
    selP.addEventListener('change', fillNodes);
    fillNodes();

    document.getElementById('mg_c').addEventListener('click', () => ov.remove());
    document.getElementById('mg_ok').addEventListener('click', () => {
      const pid = selP.value, nid = selN.value;
      const e = IP2.addEntry(pid, nid, document.getElementById('mg_t').value.trim() || i.text.slice(0, 20));
      IP2.updEntry(e.id, { body: i.text, tags: i.tags || [] });
      IP2.mergeIdea(i.id, '沉淀为条目：' + e.title);
      ov.remove(); IPApp.reload();
      IPApp.toast('已沉淀为条目「' + e.title + '」');
    });
  }

  // ================= 模板库 =================
  function templates(host) {
    host.innerHTML = '';
    const head = el('div', 'phead');
    head.innerHTML = '<h2>模板库</h2>';
    const add = el('button', 'btn primary', '+ 新建模板');
    add.addEventListener('click', () => tplDlg(null));
    head.appendChild(add);
    host.appendChild(head);
    host.appendChild(el('div', 'hintline', '模板决定「条目有哪些字段」。内置的可以直接复制一份改造成自己的，改模板不会影响已经建好的条目。'));

    host.appendChild(el('div', 'sech', '条目模板'));
    const grid = el('div', 'tplgrid');
    IP2.templates('entry').forEach(t => grid.appendChild(tplCard(t)));
    host.appendChild(grid);

    host.appendChild(el('div', 'sech', '企划骨架（新建企划时自动长出分支）'));
    const g2 = el('div', 'tplgrid');
    IP2.templates('skeleton').forEach(t => g2.appendChild(tplCard(t)));
    host.appendChild(g2);
  }

  function tplCard(t) {
    const c = el('div', 'tplcard');
    c.style.borderLeft = '3px solid ' + (t.color || '#8f86e6');
    const h = el('div', 'tplh');
    h.innerHTML = '<b>' + esc(t.name) + '</b>' + (t.builtin ? '<span class="tagpill">内置</span>' : '');
    c.appendChild(h);
    const fl = el('div', 'tplfields');
    (t.fields || []).forEach(f => fl.appendChild(el('span', 'tf', esc(f.label))));
    if (!(t.fields || []).length) fl.appendChild(el('span', 'tf dim', '暂无字段'));
    c.appendChild(fl);
    const ops = el('div', 'tplops');
    const bUse = el('button', 'mini', '编辑');
    bUse.addEventListener('click', () => tplDlg(t.id));
    const bCopy = el('button', 'mini', '复制一份改');
    bCopy.addEventListener('click', () => {
      const n = IP2.addTemplate({ name: t.name + ' · 我的', scope: t.scope, fields: JSON.parse(JSON.stringify(t.fields || [])), color: t.color });
      IPApp.reload(); tplDlg(n.id);
    });
    ops.appendChild(bUse); ops.appendChild(bCopy);
    if (!t.builtin) {
      const bD = el('button', 'mini danger', '×');
      bD.addEventListener('click', () => { IPVN.ask('要删除模板「' + t.name + '」吗？', () => { IP2.delTemplate(t.id); IPApp.reload(); }, { danger: true }); });
      ops.appendChild(bD);
    }
    c.appendChild(ops);
    return c;
  }

  function tplDlg(id) {
    const t = id ? IP2.template(id) : null;
    const ov = el('div', 'overlay');
    ov.addEventListener('mousedown', e => { if (e.target === ov) ov.remove(); });
    const dlg = el('div', 'dlg');
    dlg.innerHTML = '<h3>' + (t ? '编辑模板' : '新建模板') + '</h3>' +
      '<div class="field"><label>模板名</label><input id="tt_n" value="' + esc(t ? t.name : '') + '" placeholder="如：门派档案 / 能力设定"></div>' +
      '<div class="field"><label>类型</label><select id="tt_s">' +
      '<option value="entry"' + (t && t.scope === 'entry' ? ' selected' : '') + '>条目模板</option>' +
      '<option value="skeleton"' + (t && t.scope === 'skeleton' ? ' selected' : '') + '>企划骨架（每个字段 = 一个初始分支）</option></select></div>' +
      '<div class="field"><label>字段（每行一个）</label><textarea id="tt_f" rows="7" placeholder="身份&#10;外貌&#10;想要什么"></textarea></div>' +
      '<div class="btns"><button class="no" id="tt_c">取消</button><button class="ok" id="tt_ok">保存</button></div>';
    ov.appendChild(dlg); document.body.appendChild(ov);
    const ta = document.getElementById('tt_f');
    ta.value = t ? (t.fields || []).map(f => f.label).join('\n') : '';

    document.getElementById('tt_c').addEventListener('click', () => ov.remove());
    document.getElementById('tt_ok').addEventListener('click', () => {
      const name = document.getElementById('tt_n').value.trim();
      if (!name) { IPApp.toast('模板要有名字'); return; }
      const labels = ta.value.split('\n').map(x => x.trim()).filter(Boolean);
      const fields = labels.map((l, i) => ({ key: 'f' + i + '_' + Math.random().toString(36).slice(2, 5), label: l }));
      if (t) IP2.updTemplate(t.id, { name, fields, scope: document.getElementById('tt_s').value });
      else IP2.addTemplate({ name, scope: document.getElementById('tt_s').value, fields });
      ov.remove(); IPApp.reload();
      IPApp.toast('模板已保存');
    });
    document.getElementById('tt_n').focus();
  }

  // ================= 统计 =================
  function stats(host) {
    host.innerHTML = '';
    host.appendChild(el('div', 'phead', '<h2>统计</h2>'));

    const s = IP2.get();
    const cards = [['企划', s.projects.length], ['分支', s.nodes.length], ['条目', s.entries.length],
      ['页面', s.pages.length], ['标记', s.annos.length], ['标签', s.tags.length],
      ['逻辑线', s.lines.length], ['灵感', s.ideas.filter(i => !i.merged).length]];
    const g = el('div', 'statgrid');
    cards.forEach(([k, v]) => { const c = el('div', 'stat'); c.innerHTML = '<div class="sv">' + v + '</div><div class="sk">' + k + '</div>'; g.appendChild(c); });
    host.appendChild(g);

    // 近 14 天创作量
    host.appendChild(el('div', 'sech', '近 14 天累计（按数量型目标求和）'));
    const today = IP2.todayStr();
    const days = [];
    for (let i = 13; i >= 0; i--) days.push(IP2.dateAdd(today, -i));
    const amountGoals = IP2.allGoals().filter(x => x.mode === 'amount');
    const vals = days.map(d => amountGoals.reduce((sum, gg) => sum + (IP2.logOf(gg.id, d) ? Number(IP2.logOf(gg.id, d).value) || 0 : 0), 0));
    const max = Math.max(1, ...vals);
    const bars = el('div', 'bars');
    days.forEach((d, i) => {
      const col = el('div', 'bcol' + (d === today ? ' today' : ''));
      const b = el('div', 'bbar');
      b.style.height = Math.max(2, Math.round(vals[i] / max * 100)) + '%';
      b.title = d + '：' + vals[i];
      col.appendChild(b);
      col.appendChild(el('div', 'bd', String(new Date(d + 'T00:00:00').getDate())));
      bars.appendChild(col);
    });
    host.appendChild(bars);

    // 企划对比
    host.appendChild(el('div', 'sech', '企划对比'));
    const tb = el('div', 'tablewrap');
    let html = '<table class="tbl"><thead><tr><th>企划</th><th>分支</th><th>条目</th><th>页面</th><th>目标</th><th>今日</th></tr></thead><tbody>';
    IP2.projects().forEach(p => {
      const rate = IP2.projectRate(p.id);
      html += '<tr><td><span class="cdot" style="background:' + p.color + '"></span>' + esc(p.name) + '</td>' +
        '<td>' + IP2.nodesOf(p.id).length + '</td><td>' + IP2.entriesOf(p.id).length + '</td><td>' + IP2.pages(p.id).length + '</td>' +
        '<td>' + IP2.goalsOf(p.id).length + '</td><td>' + (rate ? rate.pct + '%' : '—') + '</td></tr>';
    });
    html += '</tbody></table>';
    tb.innerHTML = html;
    host.appendChild(tb);
  }

  // ================= 数据 =================
  function data(host) {
    host.innerHTML = '';
    host.appendChild(el('div', 'phead', '<h2>数据</h2>'));
    host.appendChild(el('div', 'hintline', '所有内容都保存在这台设备的浏览器里，<b>自动保存、无需手动存</b>。习惯上建议每周导出一次备份；接了云同步后这里仍可用来搬内容或兜底。'));

    // 数据概况条
    const s = IP2.get();
    const snap = [['企划', s.projects.length], ['条目', s.entries.length], ['页面', s.pages.length],
      ['标记', s.annos.length], ['章节', s.chapters.length], ['灵感', s.ideas.length]];
    const g = el('div', 'statgrid');
    g.style.gridTemplateColumns = 'repeat(auto-fit,minmax(92px,1fr))';
    g.style.margin = '6px 22px 4px';
    snap.forEach(([k, v]) => { const c = el('div', 'stat'); c.innerHTML = '<div class="sv">' + v + '</div><div class="sk">' + k + '</div>'; g.appendChild(c); });
    host.appendChild(g);

    // v13 存档槽 SAVE
    if (window.IPVN) {
      host.appendChild(el('div', 'sech', '存档槽 SAVE'));
      host.appendChild(el('div', 'hintline', '像游戏一样存档：把当前全部内容快照进一个槽，随时读档回到这个时刻。大改动前先存一个，玩得才安心。'));
      IPVN.slots(host);
    }

    const card = (title, desc, btnText, fn, danger) => {
      const c = el('div', 'datacard');
      c.innerHTML = '<b>' + esc(title) + '</b><p>' + desc + '</p>';
      const b = el('button', 'btn ' + (danger ? 'ghost' : 'primary'), btnText);
      b.addEventListener('click', fn);
      c.appendChild(b);
      return c;
    };

    const grid = el('div', 'datagrid');
    grid.appendChild(card('一键备份', '把全部内容（企划、条目、页面、章节、画布、打卡记录…）打包成一个 JSON 文件下载，收好即可随时还原。不含账号与云端配置。', '下载备份文件', doExport));
    grid.appendChild(card('从备份恢复', '选择之前导出的 JSON 文件，覆盖当前数据。会先弹窗确认，旧版本导出的备份也能自动补齐结构。', '选择文件恢复', () => document.getElementById('impfile').click(), true));
    grid.appendChild(card('粘贴文稿', '把写好的章节/大纲粘进来，按空行分段，选好归属后变成一页正文。', '打开粘贴框', pasteDlg));
    grid.appendChild(card('载入示例数据', '用一套内置示例（一个企划 + 三页文稿）覆盖当前内容，方便重头体验一遍。', '载入示例', () => {
      IPVN.ask('要用示例数据覆盖当前所有内容吗？\n当前数据会被清掉，建议先「下载备份文件」留一份。', () => {
        IP2.resetAll(IP2SEED.build()); IPApp.reload(); IPApp.toast('示例数据已载入');
      }, { danger: true, yes: '覆盖它' });
    }, true));
    host.appendChild(grid);

    const f = el('input');
    f.type = 'file'; f.accept = '.json,application/json'; f.style.display = 'none'; f.id = 'impfile';
    f.addEventListener('change', () => {
      const file = f.files[0]; if (!file) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const obj = JSON.parse(rd.result);
          if (!obj || typeof obj !== 'object') throw new Error('不是有效的 JSON');
          if (!Array.isArray(obj.projects)) throw new Error('这不是筑梦之境的备份文件（缺少 projects 数据）');
          IPVN.ask('导入将覆盖当前全部数据，确定吗？\n建议导入前先「下载备份文件」留一份。', () => {
            IP2.resetAll(obj);
            IPApp.reload();
            IPApp.toast('导入成功：' + obj.projects.length + ' 个企划，' + (obj.entries || []).length + ' 条条目');
          }, { danger: true, yes: '覆盖它' });
        } catch (e) { IPApp.toast('导入失败：' + e.message); }
      };
      rd.readAsText(file);
      f.value = '';
    });
    host.appendChild(f);
  }

  function doExport() {
    IP2.save(true);   // 先把最新改动落盘再导出
    const st = IP2.get();
    const d = new Date();
    const p2 = n => String(n).padStart(2, '0');
    const ts = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + p2(d.getMinutes());
    const blob = new Blob([JSON.stringify(st, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '筑梦之境-备份-' + ts + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    try { localStorage.setItem('ipStudioP2:lastBackup', String(Date.now())); } catch (e) { }
    if (window.IPNotice) IPNotice.refresh();
    IPApp.toast('已导出 · ' + st.projects.length + ' 个企划 · 文件已开始下载');
  }

  function pasteDlg() {
    const pjs = IP2.projects();
    const ov = el('div', 'overlay');
    ov.addEventListener('mousedown', e => { if (e.target === ov) ov.remove(); });
    const dlg = el('div', 'dlg wide');
    dlg.innerHTML = '<h3>粘贴文稿</h3>' +
      '<div class="field"><label>页面名称</label><input id="ps_n" placeholder="如：第 5 章"></div>' +
      '<div class="field"><label>粘贴内容（空行分段）</label><textarea id="ps_t" rows="10"></textarea></div>' +
      '<div class="fldrow"><div class="field"><label>归属企划</label><select id="ps_p">' +
      '<option value="">（不挂企划）</option>' + pjs.map(p => '<option value="' + p.id + '">' + esc(p.name) + '</option>').join('') +
      '</select></div><div class="field"><label><input type="checkbox" id="ps_d" style="width:auto"> 是草稿</label></div></div>' +
      '<div class="btns"><button class="no" id="ps_c">取消</button><button class="ok" id="ps_ok">建页面</button></div>';
    ov.appendChild(dlg); document.body.appendChild(ov);
    document.getElementById('ps_c').addEventListener('click', () => ov.remove());
    document.getElementById('ps_ok').addEventListener('click', () => {
      const t = document.getElementById('ps_t').value.replace(/\r\n/g, '\n').trim();
      if (!t) { IPApp.toast('先粘贴点内容'); return; }
      const pid = document.getElementById('ps_p').value || null;
      IP2.addPage({ pid, name: document.getElementById('ps_n').value.trim() || '粘贴页', kind: 'doc', isDraft: document.getElementById('ps_d').checked, text: t });
      ov.remove(); IPApp.reload(); IPApp.toast('页面已建成，去企划的「页面」页可看');
    });
  }

  return { today, ideas, templates, stats, data };
})();
