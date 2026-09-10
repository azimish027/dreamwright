// ===== v3 第 ④ 批：AI 检索与问答（VS Code Copilot 式） =====
// 右侧常驻面板：问我的作品（本地检索拼上下文 + 可插拔 OpenAI 兼容接口）/ 逻辑体检（本地规则 + 可选 AI 解读）
// 没填 key 时全自动降级为本地模式，功能照用。
const IPAI = (function () {
  const CFG_KEY = 'ipStudioAI:cfg';
  let panel = null, curTab = 'chat', curThread = null, checking = false;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ---------- 配置（只存本机，不上云——密钥不该跟着数据同步） ----------
  // 默认配置为空；本地自用版由 build.js 注入 tools/myai.local.json（不入库）。
  // 公开版使用者：在「AI 面板 → 设置」填 OpenAI 兼容接口即可。
  const DEFAULT_CFG = /*__MY_AI__*/{ baseURL: '', key: '', model: '' };
  function cfg() {
    let c = {};
    try { c = JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch (_) {}
    return Object.assign({}, DEFAULT_CFG, c);
  }
  function saveCfg(c) { localStorage.setItem(CFG_KEY, JSON.stringify(c)); }
  function hasKey() {
    const c = cfg();
    if (c._off) return false;
    return !!(c.baseURL && c.key && c.model);
  }

  // ---------- 面板 ----------
  function init() {
    if (panel) return;
    panel = el('div', 'aipanel');
    panel.id = 'aipanel';
    document.body.appendChild(panel);
    render();
  }
  function toggle() { init(); panel.classList.toggle('on'); if (panel.classList.contains('on')) render(); }
  function close() { panel && panel.classList.remove('on'); }

  function render() {
    if (!panel) return;
    panel.innerHTML = '';
    const hd = el('div', 'aihd');
    [['chat', '问答'], ['check', '体检'], ['cfg', '设置']].forEach(([k, n]) => {
      const b = el('button', 'aitab' + (curTab === k ? ' on' : ''), n);
      b.addEventListener('click', () => { curTab = k; render(); });
      hd.appendChild(b);
    });
    const x = el('button', 'aix'); x.innerHTML = IPUI.ic('close'); x.title = '关闭';
    x.addEventListener('click', close);
    hd.appendChild(x);
    panel.appendChild(hd);
    const body = el('div', 'aibody');
    panel.appendChild(body);
    if (curTab === 'chat') renderChat(body);
    else if (curTab === 'check') renderCheck(body);
    else renderCfg(body);
  }

  // ---------- 问答 ----------
  function renderChat(body) {
    // 会话选择行
    const top = el('div', 'aitop');
    const nw = el('button', 'aibtn', '＋ 新对话');
    nw.addEventListener('click', () => { curThread = null; render(); });
    top.appendChild(nw);
    const sel = el('select', 'aisel');
    sel.innerHTML = '<option value="">（新对话）</option>' +
      IP2.aiThreads().map(t => '<option value="' + t.id + '"' + (curThread === t.id ? ' selected' : '') + '>' + esc(t.title) + '</option>').join('');
    sel.addEventListener('change', () => { curThread = sel.value || null; render(); });
    top.appendChild(sel);
    body.appendChild(top);

    const msgs = el('div', 'aimsgs');
    const t = curThread ? IP2.aiThread(curThread) : null;
    if (t && t.msgs.length) {
      t.msgs.forEach(m => msgs.appendChild(msgEl(m)));
      body.appendChild(msgs);
      requestAnimationFrame(() => { msgs.scrollTop = msgs.scrollHeight; });
    } else {
      msgs.appendChild(el('div', 'aihint',
        '<b>问我的作品</b><br>直接用自然语言问，比如：<br>' +
        '· 灯的伏笔埋在哪里了？<br>· 沈既明的弧光是怎么设计的？<br>· 青石巷出现过几次？<br><br>' +
        (hasKey() ? '已接 AI（' + esc(cfg().model) + '），回答基于你作品里的真实内容。' :
          '<i>当前为本地模式：只列出你作品中的相关片段。到「设置」填入 API Key 可解锁 AI 回答。</i>')));
      body.appendChild(msgs);
    }

    const inputWrap = el('div', 'aiinput');
    const ta = el('textarea', 'aiq');
    ta.placeholder = '问点什么…（Enter 发送）';
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(ta.value); }
    });
    const send = el('button', 'aiok', '发送');
    send.addEventListener('click', () => ask(ta.value));
    inputWrap.appendChild(ta); inputWrap.appendChild(send);
    body.appendChild(inputWrap);
    ta.focus();
  }

  function msgEl(m) {
    // v13.6：外层 .aimrow 纵向排「气泡 + 表情包」，表情包独立在气泡下方，不再挤变形
    const w = el('div', 'aimrow ' + (m.role === 'user' ? 'me' : 'bot'));
    const d = el('div', 'aim ' + (m.role === 'user' ? 'me' : 'bot'));
    d.appendChild(el('div', 'aimtxt', esc(m.text).replace(/\n/g, '<br>')));
    if (m.refs && m.refs.length) {
      const rf = el('div', 'airefs');
      m.refs.forEach((r, i) => {
        const b = el('button', 'airef', '[' + (i + 1) + '] ' + esc(r.label));
        b.addEventListener('click', () => jumpRef(r));
        rf.appendChild(b);
      });
      d.appendChild(rf);
    }
    w.appendChild(d);
    // 梦梦表情包：每条 AI 回答末尾带一张（按文本哈希取，同一条消息永远同一张）
    if (m.role !== 'user' && typeof MASCOT !== 'undefined') {
      const kinds = ['heart', 'jump', 'think', 'like'];
      let hh = 0;
      for (let i = 0; i < m.text.length; i++) hh = (hh * 31 + m.text.charCodeAt(i)) >>> 0;
      const st = el('img', 'ai-sticker');
      st.src = MASCOT[kinds[hh % kinds.length]];
      st.alt = ''; st.draggable = false;
      w.appendChild(st);
    }
    return w;
  }

  function jumpRef(r) {
    if (!r || !r.kind) return;
    if (r.kind === 'page') IPApp.jumpWord(r.pageId, r.seg, r.at, (r.len || 4));
    else if (r.kind === 'entry') IPApp.jumpEntry(r.entryId);
    else if (r.kind === 'idea') IPApp.go('idea');
    else if (r.kind === 'chapter') { IPCh.chapterDlg(r.ref); }
    else if (r.kind === 'asset') { const a = IP2.asset(r.ref); IPFloat.open('asset', r.ref, a ? a.name : ''); }
    else if (r.kind === 'block') IPFloat.open('block', r.ref, '');
  }

  // 分词：去掉常见疑问词后按非字符切
  const STOP = ['的', '了', '吗', '呢', '吧', '在', '是', '有', '我', '你', '他', '她', '它', '什么', '怎么', '为什么', '哪儿', '哪里', '如何', '哪个', '哪些', '这个', '那个', '几个', '多少', '还有', '以及', '一下', '出现', '设计', '哪些'];
  function terms(q) {
    const raw = String(q || '').split(/[\s，。？！、,.?!；;：:"'（）()《》【】]+/).map(s => s.trim()).filter(s => s.length >= 2);
    return raw.filter(s => !STOP.includes(s)).slice(0, 5);
  }

  // 本地检索：把问题拆词，逐词 searchAll，按命中次数排序
  function retrieve(q) {
    const ts = terms(q);
    const list = ts.length ? ts : [q.trim()].filter(x => x);
    const hits = {};   // key -> hit 对象 + score
    list.forEach((term, ti) => {
      IP2.searchAll(term).slice(0, 30).forEach(h => {
        const key = (h.pageId || '') + '|' + (h.entryId || '') + '|' + (h.chapterId || '') + '|' + (h.ideaId || '') + '|' + (h.blockId || '') + '|' + (h.at || 0);
        if (!hits[key]) hits[key] = { h, score: 0 };
        hits[key].score += (10 - ti) + (h.kind === 'chapter' || h.kind === 'entry' ? 2 : 0);
      });
    });
    return Object.values(hits).sort((a, b) => b.score - a.score).slice(0, 8).map(x => x.h);
  }

  function ask(qRaw) {
    const q = (qRaw || '').trim();
    if (!q) return;
    if (!curThread) { const t = IP2.addAiThread(q.slice(0, 18)); curThread = t.id; }
    IP2.aiPush(curThread, { role: 'user', text: q });
    const hits = retrieve(q);
    const refs = hits.map(h => ({
      kind: h.kind, pageId: h.pageId, seg: h.seg, at: h.at, entryId: h.entryId,
      ref: h.chapterId || h.assetId || h.blockId || h.ideaId,
      label: (h.pageName || '') + (h.ctx ? '：' + h.ctx.slice(0, 26) : ''), len: (q.match(/^[\u4e00-\u9fa5]{2}/) || [''])[0].length || 2
    }));

    if (!hasKey()) {
      // 本地模式：给片段清单
      const lines = hits.length
        ? '我在你的作品里找到 ' + hits.length + ' 处相关内容：\n\n' +
          hits.map((h, i) => '[' + (i + 1) + '] ' + h.pageName + (h.ctx ? ' —— ' + h.ctx : '')).join('\n')
        : '你的作品里暂时没找到直接相关的内容。换个说法（比如只用关键词「铜灯」「伏笔」）再试试？';
      IP2.aiPush(curThread, { role: 'ai', text: lines + '\n\n（本地模式：填 API Key 后我可以直接给出分析和回答）', refs });
      render();
      return;
    }

    // AI 模式：拼上下文提问（v13.5：SSE 流式，逐字出现）
    IP2.aiPush(curThread, { role: 'ai', text: '', refs: [] });
    render();
    const c = cfg();
    const ctx = hits.length
      ? '以下是创作者作品中的相关片段（编号即引用来源）：\n' +
        hits.map((h, i) => '[' + (i + 1) + '] 《' + h.pageName + '》' + (h.ctx || '')).join('\n')
      : '（未在作品中检索到直接相关片段）';
    const SYS = '你是「梦梦」（镜梦菱），IP创作工作台「筑梦之境」的看板娘兼创作顾问。说话温柔可爱、偶尔用「～」和「♥」，但内容要干货、不啰嗦，不堆客套话。创作者会向你提问 TA 自己的作品：帮 TA 理清设定、检查矛盾、给具体的写作建议。回答必须优先依据下面给出的作品检索片段；片段没有的信息可以合理推理但要注明「推测」；引用片段时标注 [编号]。用简体中文回答。';
    fetch(c.baseURL.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.key },
      body: JSON.stringify({
        model: c.model,
        messages: [
          { role: 'system', content: SYS },
          { role: 'user', content: ctx + '\n\n创作者的问题：' + q }
        ],
        temperature: 0.5,
        stream: true
      })
    }).then(r => {
      if (!r.ok) {
        return r.json().catch(() => ({})).then(j => {
          let m = (j && (j.message || j.code)) ? ((j.code ? j.code + ' · ' : '') + (j.message || '')) : ('HTTP ' + r.status);
          if (r.status === 401 || /INVALID_CREDENTIALS/i.test(m)) m += '\n→ Key 无效或已过期：到 AI 面板「设置」页签换一个有效的 Key。';
          throw new Error(m);
        });
      }
      const ct = (r.headers.get('content-type') || '');
      const msgsEl = panel.querySelector('.aimsgs');
      const sink = msgsEl ? msgsEl.querySelector('.aimrow.bot:last-child .aimtxt') : null;
      const paint = s => {
        if (sink) sink.innerHTML = esc(s) + '<span class="aicur"></span>';
        if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
      };
      const t2 = IP2.aiThread(curThread);
      const aiMsg = t2.msgs[t2.msgs.length - 1];
      const finish = txt => {
        aiMsg.text = txt || '（AI 没有返回内容，检查设置里的地址/模型是否正确）';
        aiMsg.at = Date.now(); t2.updated = Date.now();
        IP2.save(true); render();
      };
      if (ct.indexOf('text/event-stream') < 0) {
        // 服务端不支持流式：整体解析
        return r.json().then(j => {
          finish((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '');
        });
      }
      const reader = r.body.getReader(); const dec = new TextDecoder();
      let buf = '', acc = '';
      const step = () => reader.read().then(({ done, value }) => {
        if (done) { finish(acc); return; }
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop();
        for (const ln of lines) {
          const s = ln.trim();
          if (s.indexOf('data:') !== 0) continue;
          const d = s.slice(5).trim();
          if (d === '[DONE]') continue;
          try {
            const j = JSON.parse(d);
            const dt = (j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content) || '';
            if (dt) { acc += dt; paint(acc); }
          } catch (_) {}
        }
        return step();
      });
      return step();
    }).catch(err => {
      let m = (err && err.message) || String(err);
      if (/failed to fetch|networkerror|load failed/i.test(m)) {
        m = '无法连接接口（网络不通，或服务不允许浏览器跨域直连）。\n→ 用本地静态服务器打开本页再试，或换一个支持 CORS 的接口。';
      }
      const t3 = IP2.aiThread(curThread);
      t3.msgs[t3.msgs.length - 1] = { role: 'ai', text: '调用失败：' + m + '\n可到「设置」页签检查接口配置。', refs: [], at: Date.now() };
      IP2.save(true);
      render();
    });
  }

  // ---------- 逻辑体检 ----------
  function renderCheck(body) {
    body.appendChild(el('div', 'aihint', '<b>逻辑体检</b><br>用固定规则扫一遍选中企划：未回收伏笔、零出场人物、定稿零字、长期搁置、断头逻辑线、孤儿标签。结果可点击跳转。'));
    const bar = el('div', 'aibar');
    const sel = el('select', 'aisel');
    sel.id = 'ai_ck_proj';
    sel.innerHTML = IP2.get().projects.map((p, i) => '<option value="' + p.id + '">' + esc(p.name) + '</option>').join('');
    bar.appendChild(sel);
    const run = el('button', 'aibtn ok', checking ? '体检中…' : '开始体检');
    run.addEventListener('click', () => { if (!checking) doCheck(sel.value); });
    bar.appendChild(run);
    body.appendChild(bar);
    const out = el('div', 'aikout');
    out.id = 'ai_ck_out';
    out.innerHTML = '<div class="aihint">点「开始体检」出结果。</div>';
    body.appendChild(out);
    // AI 解读按钮（有 key 才显示）
    if (hasKey()) {
      const ai = el('button', 'aibtn aiadv', '✦ 让 AI 解读体检结果');
      ai.addEventListener('click', aiReadCheck);
      body.appendChild(ai);
    }
  }

  function doCheck(pid) {
    checking = true;
    const out = document.getElementById('ai_ck_out');
    if (out) out.innerHTML = '<div class="aihint">扫描中…</div>';
    setTimeout(() => {
      const finds = checkRules(pid);
      checking = false;
      renderCheckOut(finds);
    }, 30);
  }

  function checkRules(pid) {
    const s = IP2.get();
    const finds = [];
    const chapters = s.chapters.filter(c => c.pid === pid);
    const pages = s.pages.filter(p => p.pid === pid);
    const pageIds = pages.map(p => p.id);
    const entries = s.entries.filter(e => e.pid === pid);

    // 1. 未回收伏笔线：名字带「伏笔」的线，线上没有任何挂在「已定稿」章节上的点
    s.lines.forEach(l => {
      if ((l.name || '').indexOf('伏笔') < 0) return;
      const onDone = (l.nodes || []).some(n => {
        if (n.kind !== 'chapter') return false;
        const c = IP2.chapter(n.ref);
        return c && c.status === 'done';
      });
      if (!onDone) {
        finds.push({ lv: 'warn', txt: '伏笔线《' + l.name + '》还没有在任何<b>已定稿</b>的章节里回收。', jump: () => IPApp.showTags() });
      }
    });

    // 2. 零出场人物：人物类资产，既不在任何章节的出场人物里，也没在文稿/条目里被提名
    const charCat = s.assetCats.find(c => (c.name || '').indexOf('人物') >= 0);
    if (charCat) {
      s.assets.filter(a => a.cat === charCat.id).forEach(a => {
        const inCh = chapters.some(c => (c.chars || []).includes(a.id));
        const mentioned = pages.some(p => p.segments.some(seg => seg.indexOf(a.name) >= 0)) ||
          entries.some(e => ((e.title || '') + (e.body || '')).indexOf(a.name) >= 0);
        if (!inCh && !mentioned) {
          finds.push({ lv: 'warn', txt: '人物「' + esc(a.name) + '」还没在任何章节出场、也没在任何文稿里被提到——是忘了，还是可以删掉？', jump: () => IPFloat.open('asset', a.id, a.name) });
        }
      });
    }

    // 3. 定稿但零字
    chapters.filter(c => c.kind === 'chapter' && c.status === 'done' && !(c.words > 0)).forEach(c => {
      finds.push({ lv: 'bad', txt: '《' + esc(c.name) + '》状态是「定稿」但字数是 0，二者矛盾。', jump: () => IPCh.chapterDlg(c.id) });
    });

    // 4. 长期搁置：灵感/大纲状态超过 14 天没动过
    const DEAD = 14 * 24 * 3600 * 1000;
    chapters.filter(c => ['idea', 'outline'].includes(c.status) && c.kind === 'chapter' &&
      Date.now() - (c.updated || c.created || 0) > DEAD).forEach(c => {
        finds.push({ lv: 'info', txt: '《' + esc(c.name) + '》在' + (c.status === 'idea' ? '灵感' : '大纲') + '状态放了很久了，要不要推进一下？', jump: () => IPCh.chapterDlg(c.id) });
      });

    // 5. 断头逻辑线：线上不到 2 个点
    s.lines.filter(l => (l.nodes || []).length < 2).forEach(l => {
      finds.push({ lv: 'info', txt: '逻辑线《' + l.name + '》只有 ' + (l.nodes || []).length + ' 个点，还串不成线。', jump: () => IPApp.showTags() });
    });

    // 6. 孤儿标签：没有任何标记、也没挂任何章节
    s.tags.forEach(t => {
      const used = s.annos.some(a => a.tagId === t.id) || chapters.some(c => (c.tags || []).includes(t.id));
      if (!used) finds.push({ lv: 'info', txt: '标签「' + esc(t.name) + '」没有被任何标记或章节使用。', jump: () => IPApp.showTags() });
    });

    // 7. 时间线撞日：同一天有多个条目标了相同日期且章节都非草稿 → 提醒核对
    const byDate = {};
    entries.forEach(e => {
      if (!e.date) return;
      (byDate[e.date] = byDate[e.date] || []).push(e);
    });
    Object.keys(byDate).forEach(d => {
      if (byDate[d].length >= 3) {
        finds.push({ lv: 'info', txt: d + ' 这天挂了 ' + byDate[d].length + ' 个条目，核对一下时间线有没有冲突。', jump: () => IPApp.jumpEntry(byDate[d][0].id) });
      }
    });

    return finds;
  }

  function renderCheckOut(finds) {
    const out = document.getElementById('ai_ck_out');
    if (!out) return;
    out.innerHTML = '';
    if (!finds.length) {
      const good = el('div', 'aigood');
      good.appendChild(el('div', '', '<b>✓ 体检通过：没发现明显问题。</b>'));
      if (typeof MASCOT !== 'undefined' && MASCOT.like) {
        const st = el('img', 'ai-sticker'); st.src = MASCOT.like; st.alt = ''; st.draggable = false;
        good.appendChild(st);
      }
      out.appendChild(good);
      return;
    }
    out.appendChild(el('div', 'aihint', '发现 ' + finds.length + ' 处需要注意：'));
    finds.forEach(f => {
      const it = el('div', 'ckitem ' + f.lv);
      it.appendChild(el('div', 'cktxt', f.txt));
      if (f.jump) {
        const b = el('button', 'ckjump', '去看 →');
        b.addEventListener('click', f.jump);
        it.appendChild(b);
      }
      out.appendChild(it);
    });
    // 末尾附一张思考中的梦梦：问题不可怕，一起想办法
    if (typeof MASCOT !== 'undefined' && MASCOT.think) {
      const st = el('img', 'ai-sticker'); st.src = MASCOT.think; st.alt = ''; st.draggable = false;
      out.appendChild(st);
    }
  }

  function aiReadCheck() {
    // 把体检结果发给 AI 解读（切到问答页，作为一条提问）
    const out = document.getElementById('ai_ck_out');
    if (!out || !out.querySelectorAll('.ckitem').length) { alert('先跑一次体检，有结果才能解读。'); return; }
    const items = Array.from(out.querySelectorAll('.ckitem')).map((it, i) => '[' + (i + 1) + '] ' + it.querySelector('.cktxt').textContent).join('\n');
    curTab = 'chat'; render();
    ask('请帮我解读这些体检结果，按严重程度排序，给出下一步的处理建议：\n' + items);
  }

  // ---------- 设置 ----------
  const PRESETS = [
    { n: '腾讯混元', baseURL: 'https://api.hunyuan.cloud.tencent.com/v1', model: 'hunyuan-turbos-latest' },
    { n: 'DeepSeek', baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    { n: 'Kimi', baseURL: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
    { n: '腾讯云开发 CloudBase AI', baseURL: 'https://你的环境ID.api.tcloudbasegateway.com/v1/ai/cloudbase', model: 'hy3-preview' }
  ];

  function renderCfg(body) {
    const c = cfg();
    body.appendChild(el('div', 'aihint',
      '<b>AI 接口设置</b><br>已预填「筑梦之境·云开发」网关（OpenAI 兼容）——只需要把你的 <b>API Key</b> 粘贴进来并保存。也可以换成其它 OpenAI 兼容接口（baseURL + Key + 模型名）。<br><i>Key 只存在这台设备上，不进云同步、不进源码。</i>'));
    const box = el('div', 'aicfg');
    box.innerHTML =
      '<div class="field"><label>快捷预设</label><div class="chips" id="ai_pre"></div></div>' +
      '<div class="field"><label>接口地址 baseURL</label><input id="ai_url" placeholder="https://api.deepseek.com/v1" value="' + esc(c.baseURL || '') + '"></div>' +
      '<div class="field"><label>API Key</label><input id="ai_key" type="password" placeholder="sk-…" value="' + esc(c.key || '') + '"></div>' +
      '<div class="field"><label>模型名</label><input id="ai_model" placeholder="deepseek-chat" value="' + esc(c.model || '') + '"></div>' +
      '<div class="btns"><button class="no" id="ai_clr">清空（回到本地模式）</button><button class="ok" id="ai_save">保存</button></div>' +
      '<div class="aihint" id="ai_st"></div>';
    body.appendChild(box);

    const pre = box.querySelector('#ai_pre');
    PRESETS.forEach(p => {
      const b = el('button', 'chip', p.n);
      b.addEventListener('click', () => {
        box.querySelector('#ai_url').value = p.baseURL;
        box.querySelector('#ai_model').value = p.model;
        box.querySelector('#ai_key').focus();
      });
      pre.appendChild(b);
    });
    const st = box.querySelector('#ai_st');
    st.innerHTML = hasKey() ? '当前：<b style="color:var(--ok)">AI 模式 · ' + esc(c.model) + '</b>' : '当前：<b>本地模式</b>（无 Key）';

    box.querySelector('#ai_save').addEventListener('click', () => {
      const nc = {
        baseURL: box.querySelector('#ai_url').value.trim(),
        key: box.querySelector('#ai_key').value.trim(),
        model: box.querySelector('#ai_model').value.trim()
      };
      if (nc.baseURL && nc.key && nc.model) saveCfg(nc);
      else saveCfg({ _off: true });          // 显式关闭：不再回落到预填默认值
      render();
    });
    box.querySelector('#ai_clr').addEventListener('click', () => { saveCfg({ _off: true }); render(); });
  }

  function tab(k) {                       // 供设置页跳转到 AI 面板的指定页签
    init();
    curTab = k || 'chat';
    panel.classList.add('on');
    render();
  }
  return { init, toggle, close, hasKey, cfg, saveCfg, retrieve, checkRules, ask, tab };
})();
