/* chapters.js —— 正式章节树：卷 / 章 两级，状态流转 + 字数登记（粘贴即自动统计） */
window.IPCh = (function () {
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; };
  function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }

  // 字数统计：总字数（不含空白）+ 中文数 + 英文词数
  function countText(s) {
    s = String(s || '');
    const total = s.replace(/\s/g, '').length;
    const cjk = (s.match(/[\u4e00-\u9fa5]/g) || []).length;
    const enWords = (s.match(/[A-Za-z]+/g) || []).length;
    return { total, cjk, enWords };
  }
  function fmt(n) { n = Number(n) || 0; return n >= 10000 ? (n / 10000).toFixed(1) + 'w' : String(n); }

  // 卷的汇总（章数 / 字数 / 定稿数）
  function actSum(pid, actId) {
    const kids = IP2.chaptersOf(pid).filter(c => (c.parent || '') === actId && c.kind !== 'act');
    return {
      count: kids.length,
      words: kids.reduce((s, c) => s + (Number(c.words) || 0), 0),
      done: kids.filter(c => c.status === 'done').length
    };
  }

  // 出场人物候选：优先「人物」类资产
  function charAssets() {
    const all = IP2.assets();
    const cats = IP2.assetCats();
    const cname = id => ((cats.find(c => c.id === id) || {}).name || '');
    let list = all.filter(a => a.kind === '人物' || cname(a.cat).indexOf('人物') >= 0);
    if (!list.length) list = all;
    return list;
  }

  let curAct = ''; // 当前展开/选中的卷

  // ================= 章节树主界面 =================
  function render(host, p) {
    host.innerHTML = '';
    const all = IP2.chaptersOf(p.id);
    const acts = all.filter(c => c.kind === 'act');
    const st = IP2.chapterStats(p.id);
    const inProgress = st.total - (st.by.done || 0);

    // 顶部汇总
    const g = el('div', 'statgrid');
    [['卷', acts.length], ['章', st.total], ['总字数', fmt(st.words)],
     ['已定稿', st.by.done || 0], ['进行中', inProgress]].forEach(([k, v]) => {
      const c = el('div', 'stat');
      c.innerHTML = '<div class="sv">' + v + '</div><div class="sk">' + k + '</div>';
      g.appendChild(c);
    });
    host.appendChild(g);

    // 状态分布条
    if (st.total) {
      const dist = el('div', 'chdist');
      IP2.CH_STATUS.forEach(s => {
        const n = st.by[s.k] || 0;
        if (!n) return;
        const seg = el('div', 'chseg', n > 0 ? String(n) : '');
        seg.style.background = s.color;
        seg.style.flex = String(n);
        seg.title = s.label + ' ' + n + ' 章';
        dist.appendChild(seg);
      });
      host.appendChild(dist);
    }

    // 工具条
    const bar = el('div', 'chbar');
    const bAct = el('button', 'btn primary', '+ 新卷');
    bAct.addEventListener('click', () => {
      const n = prompt('卷名（如：第一卷 · 渡口）');
      if (!n) return;
      IP2.addChapter(p.id, '', n.trim(), 'act');
      IPApp.reload(); IPApp.toast('已建卷');
    });
    bar.appendChild(bAct);
    const bCh = el('button', 'btn ghost', '+ 新章');
    bCh.addEventListener('click', () => {
      const target = curAct || (acts[0] ? acts[0].id : '');
      const c = IP2.addChapter(p.id, target, '新章节', 'chapter');
      IPApp.reload(); chapterDlg(c.id);
    });
    bar.appendChild(bCh);
    if (acts.length) {
      const bBatch = el('button', 'btn ghost', '批量建章');
      bBatch.addEventListener('click', () => batchDlg(p, curAct || acts[0].id));
      bar.appendChild(bBatch);
    }
    bar.appendChild(el('span', 'chhint', '字数不用手填 —— 点开章节，把正文粘进下面的框，自动算好。'));
    host.appendChild(bar);

    if (!all.length) {
      host.appendChild(el('div', 'emptybox', '还没有章节。先建一卷，再往里加章。<br>章节树和「内容」树是分开的：内容树放设定素材，章节树只放作品本体。'));
      return;
    }

    // 列表
    const list = el('div', 'chlist');
    IP2.chapterRows(p.id).forEach(({ ch, depth }) => {
      if (ch.kind === 'act') {
        list.appendChild(actRow(p, ch));
      } else {
        list.appendChild(chRow(p, ch, depth));
      }
    });
    host.appendChild(list);
  }

  function actRow(p, ch) {
    const s = actSum(p.id, ch.id);
    const r = el('div', 'chrow act' + (curAct === ch.id ? ' sel' : ''));
    r.appendChild(el('span', 'kic', '▤'));
    const nm = el('div', 'cnm');
    nm.innerHTML = '<b>' + esc(ch.name) + '</b>';
    r.appendChild(nm);
    if (s.count) {
      const pr = el('div', 'chprog');
      const fill = el('i');
      fill.style.width = Math.round(s.done / s.count * 100) + '%';
      pr.appendChild(fill);
      pr.title = s.done + '/' + s.count + ' 章已定稿';
      r.appendChild(pr);
      r.appendChild(el('span', 'chwd', s.count + ' 章 · ' + fmt(s.words) + ' 字'));
    } else {
      r.appendChild(el('span', 'chwd', '空卷'));
    }
    const ops = el('div', 'ops');
    const bAdd = el('button', '＋'); bAdd.title = '在这卷下加一章';
    bAdd.addEventListener('click', (e) => {
      e.stopPropagation();
      const c = IP2.addChapter(p.id, ch.id, '新章节', 'chapter');
      curAct = ch.id; IPApp.reload(); chapterDlg(c.id);
    });
    const bRen = el('button', '✎'); bRen.title = '编辑本卷';
    bRen.addEventListener('click', (e) => { e.stopPropagation(); chapterDlg(ch.id); });
    const bDel = el('button', '×'); bDel.title = '删除本卷及其下所有章';
    bDel.addEventListener('click', (e) => {
      e.stopPropagation();
      IPVN.ask('要删除「' + ch.name + '」吗？\n卷下的 ' + s.count + ' 章会一起删除。', () => {
        IP2.delChapter(ch.id); curAct = ''; IPApp.reload();
      }, { danger: true });
    });
    ops.appendChild(bAdd); ops.appendChild(bRen); ops.appendChild(bDel);
    r.appendChild(ops);
    r.addEventListener('click', () => { curAct = curAct === ch.id ? '' : ch.id; IPApp.reload(); });
    return r;
  }

  function chRow(p, ch, depth) {
    const stt = IP2.chStatus(ch.status);
    const r = el('div', 'chrow');
    r.style.paddingLeft = (10 + depth * 16) + 'px';
    r.appendChild(el('span', 'kic', '▸'));
    const nm = el('div', 'cnm', esc(ch.name));
    if (ch.summary) nm.innerHTML += '<i>' + esc(ch.summary.slice(0, 24)) + '</i>';
    r.appendChild(nm);
    const pill = el('span', 'chst', stt.label);
    pill.style.color = stt.color; pill.style.borderColor = stt.color;
    r.appendChild(pill);
    if (ch.tags && ch.tags.length) r.appendChild(el('span', 'tagpill', ch.tags.slice(0, 2).join('·')));
    r.appendChild(el('span', 'chwd', (Number(ch.words) || 0) + ' 字'));
    const ops = el('div', 'ops');
    const up = el('button', '↑'); up.title = '上移';
    up.addEventListener('click', (e) => { e.stopPropagation(); IP2.chapterMove(ch.id, -1); IPApp.reload(); });
    const dn = el('button', '↓'); dn.title = '下移';
    dn.addEventListener('click', (e) => { e.stopPropagation(); IP2.chapterMove(ch.id, 1); IPApp.reload(); });
    const fl = el('button', '⧉'); fl.title = '在浮窗中打开';
    fl.addEventListener('click', (e) => { e.stopPropagation(); IPFloat.open('chapter', ch.id, ch.name); });
    const rm = el('button', '×'); rm.title = '删除本章';
    rm.addEventListener('click', (e) => {
      e.stopPropagation();
      IPVN.ask('要删除「' + ch.name + '」吗？', () => {
        IP2.delChapter(ch.id); IPApp.reload();
      }, { danger: true });
    });
    ops.appendChild(up); ops.appendChild(dn); ops.appendChild(fl); ops.appendChild(rm);
    r.appendChild(ops);
    r.addEventListener('click', () => chapterDlg(ch.id));
    return r;
  }

  // ---------- 批量建章 ----------
  function batchDlg(p, actId) {
    const n = parseInt(prompt('一次建多少章？（新章排在已有章后面）', '10'), 10);
    if (!n || n < 1 || n > 200) return;
    const prefix = prompt('章名前缀（留空用「第 N 章」）', '第 ');
    const sibs = IP2.chaptersOf(p.id).filter(c => (c.parent || '') === (actId || ''));
    let base = sibs.length;
    for (let i = 0; i < n; i++) {
      const nm = (prefix === null || prefix === undefined || prefix === '第 ')
        ? ('第 ' + (base + i + 1) + ' 章')
        : (prefix + (base + i + 1));
      IP2.addChapter(p.id, actId || '', nm, 'chapter');
    }
    curAct = actId; IPApp.reload();
    IPApp.toast('已建 ' + n + ' 章');
  }

  // ================= 章节编辑对话框 =================
  function chapterDlg(id) {
    const c = IP2.chapter(id);
    if (!c) return;
    const isAct = c.kind === 'act';
    const ov = el('div', 'overlay');
    ov.addEventListener('mousedown', ev => { if (ev.target === ov) { ov.remove(); IPApp.reload(); } });
    const dlg = el('div', 'dlg wide');

    // 已保存的正文（默认不存，用户勾选才存）
    const savedText = c.text || '';

    const head = el('div', 'dlghd');
    head.innerHTML = '<h3>' + (isAct ? '卷' : '章') + ' · ' + esc(c.name) + '</h3>';
    const flb = el('button', 'dlgfl', '⧉ 浮窗');
    flb.title = '在浮窗中打开（不关此对话框也能边看边对照）';
    flb.addEventListener('click', () => { IPFloat.open('chapter', c.id, c.name); });
    head.appendChild(flb);
    const closeX = el('button', 'dlgx', '×');
    closeX.addEventListener('click', () => { ov.remove(); IPApp.reload(); });
    head.appendChild(closeX);
    dlg.appendChild(head);
    dlg.innerHTML += '<div class="field"><label>标题</label><input id="cd_t" value="' + esc(c.name) + '"></div>' +
      '<div class="fldrow">' +
        '<div class="field"><label>类型</label><select id="cd_kind">' +
          '<option value="chapter"' + (isAct ? '' : ' selected') + '>章</option>' +
          '<option value="act"' + (isAct ? ' selected' : '') + '>卷</option>' +
        '</select></div>' +
        '<div class="field"><label>状态</label><select id="cd_st">' +
          IP2.CH_STATUS.map(s => '<option value="' + s.k + '"' + (c.status === s.k ? ' selected' : '') + '>' + s.label + '</option>').join('') +
        '</select></div>' +
      '</div>' +
      '<div class="field"><label>一句话摘要（写给自己看的备忘）</label><textarea id="cd_s" rows="2" placeholder="这章发生了什么，为什么写它">' + esc(c.summary || '') + '</textarea></div>' +
      (isAct ? '' :
      '<div class="field"><label>字数</label><input id="cd_w" type="number" min="0" value="' + (Number(c.words) || 0) + '">' +
        '<div class="pastebox"><textarea id="cd_p" rows="5" placeholder="把写好的正文粘到这里 —— 字数会自动算好填进上面，粘完可以直接关掉，正文默认不会存进来。">' + esc(savedText) + '</textarea>' +
        '<div class="cnthint" id="cd_cnt"></div>' +
        '<label class="ckline"><input type="checkbox" id="cd_keep"' + (savedText ? ' checked' : '') + '> 同时保存这段正文（方便以后检索，会占用同步空间）</label></div>' +
      '</div>') +
      (isAct ? '' : '<div class="field"><label>出场人物</label><div class="chips" id="cd_chars"></div></div>') +
      '<div class="field"><label>标签（逗号分隔，和文稿标记共用一套）</label><input id="cd_tags" value="' + esc((c.tags || []).join('，')) + '"></div>' +
      '<div class="field"><label>挂到逻辑线（伏笔线 / 弧光线）</label><div class="chips" id="cd_lines"></div></div>' +
      '<div class="btns"><button class="no" id="cd_del">删除</button><button class="no" id="cd_c">关闭</button><button class="ok" id="cd_ok">保存</button></div>';

    ov.appendChild(dlg); document.body.appendChild(ov);

    // —— 粘贴自动计字 ——
    const wIn = document.getElementById('cd_w');
    const pIn = document.getElementById('cd_p');
    const cnt = document.getElementById('cd_cnt');
    if (pIn) {
      const recalc = () => {
        const t = pIn.value;
        if (!t.trim()) { cnt.innerHTML = '把正文粘进来，字数会自动填到上面的框里。'; return; }
        const r = countText(t);
        wIn.value = r.total;
        cnt.innerHTML = '算好了：<b>' + r.total + '</b> 字（中文 ' + r.cjk + ' 字，英文 ' + r.enWords + ' 词）';
      };
      pIn.addEventListener('input', recalc);
      pIn.addEventListener('paste', () => setTimeout(recalc, 0));
      recalc();
    }

    // —— 出场人物 ——
    const charsHost = document.getElementById('cd_chars');
    if (charsHost) {
      const list = charAssets();
      if (!list.length) {
        charsHost.appendChild(el('div', 'cnthint', '还没有资产。去「工具与资产」里加几个，就能在这里勾选了。'));
      } else {
        list.forEach(a => {
          const b = el('button', 'chip' + (((c.chars || []).indexOf(a.id) >= 0) ? ' on' : ''), esc(a.name));
          b.dataset.aid = a.id;
          b.addEventListener('click', () => b.classList.toggle('on'));
          charsHost.appendChild(b);
        });
      }
    }

    // —— 逻辑线 ——
    const linesHost = document.getElementById('cd_lines');
    const lines = IP2.lines();
    if (!lines.length) {
      linesHost.appendChild(el('div', 'cnthint', '还没有逻辑线。在「标记 → 逻辑线」里建。'));
    } else {
      lines.forEach(l => {
        const on = (l.nodes || []).some(n => n.kind === 'chapter' && n.ref === c.id);
        const b = el('button', 'chip' + (on ? ' on' : ''), esc(l.name));
        b.style.borderColor = on ? l.color : '';
        b.addEventListener('click', () => { b.classList.toggle('on'); b.style.borderColor = b.classList.contains('on') ? l.color : ''; });
        b.dataset.lid = l.id;
        linesHost.appendChild(b);
      });
    }

    const save = () => {
      const patch = {
        name: document.getElementById('cd_t').value.trim() || c.name,
        kind: document.getElementById('cd_kind').value,
        status: document.getElementById('cd_st').value,
        summary: document.getElementById('cd_s').value,
        tags: document.getElementById('cd_tags').value.split(/[,，]/).map(x => x.trim()).filter(Boolean)
      };
      if (wIn) patch.words = Number(wIn.value) || 0;
      if (pIn) patch.text = document.getElementById('cd_keep').checked ? pIn.value : '';
      if (charsHost) {
        patch.chars = Array.from(charsHost.querySelectorAll('.chip.on')).map(b => b.dataset.aid);
      }
      IP2.updChapter(c.id, patch);

      // 逻辑线挂载状态
      lines.forEach(l => {
        const chip = linesHost.querySelector('.chip[data-lid="' + l.id + '"]');
        if (!chip) return;
        const want = chip.classList.contains('on');
        const has = (l.nodes || []).some(n => n.kind === 'chapter' && n.ref === c.id);
        if (want && !has) IP2.linePush(l, 'chapter', c.id, patch.name);
        else if (!want && has) {
          l.nodes = l.nodes.filter(n => !(n.kind === 'chapter' && n.ref === c.id));
          IP2.save(true);
        }
      });

      ov.remove(); IPApp.reload(); IPApp.toast('已保存');
    };

    document.getElementById('cd_ok').addEventListener('click', save);
    document.getElementById('cd_c').addEventListener('click', () => { ov.remove(); IPApp.reload(); });
    document.getElementById('cd_del').addEventListener('click', () => {
      IPVN.ask('要删除「' + c.name + '」吗？' + (isAct ? '\n卷下所有章会一起删掉。' : ''), () => {
        IP2.delChapter(c.id); ov.remove(); IPApp.reload();
      }, { danger: true });
    });
    document.getElementById('cd_t').focus();
  }

  return { render, chapterDlg, batchDlg, countText, charAssets };
})();
