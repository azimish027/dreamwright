/* store.js —— 数据层
   创作资产：projects / nodes / entries / goals / logs / ideas / templates / relations
   看稿标记：pages / tags / annos / lines / strokes / notes
   本地持久化 + 保存广播（同步引擎监听 ip2saved） */
const IP2 = (function () {
  const KEY = 'ipStudioP2:v1';
  const SAVE_KEY = 'ipStudioP2:meta';
  const COLORS = ['#f0b35c', '#f082b4', '#6ea8ff', '#9ad37c', '#c2a1ff'];
  const NOTE_COLS = ['n-y', 'n-blue', 'n-pink', 'n-green'];

  let state = null;
  let saveTimer = null;
  let saveCb = null;

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function empty() {
    return {
      version: 2,
      // —— 企划资产 ——
      projects: [],   // {id,name,desc,color,skel,created,updated}
      nodes: [],      // {id,pid,parent,name,order,created}
      entries: [],    // {id,pid,nodeId,title,body,fields:{},tags:[],created,updated}
      goals: [],      // {id,pid,title,cadence:'daily'|'weekly'|'monthly',mode:'count'|'amount',target,unit,created}
      logs: [],       // {id,goalId,date,value,note}
      ideas: [],      // {id,text,tags:[],created,history:[{at,note}]}
      templates: [],  // {id,name,scope:'entry'|'skeleton',fields:[{key,label,type}],color,builtin}
      relations: [],  // {id,pid,a,b,label,dir:'one'|'two',created}
      // —— 看稿标记 ——
      pages: [],      // {id,pid,name,kind:'doc'|'sheet',isDraft,segments:[],created,updated}
      tags: [],       // {id,name,color}
      annos: [],      // {id,pageId,seg,start,end,kind:'hl'|'ul',tagId,color,text,created}
      lines: [],      // {id,name,color,nodes:[{kind:'tag'|'anno',ref,label}]}
      strokes: [],    // {id,pageId,color,size,pen,pts:[]}
      notes: [],      // {id,pageId,x,y,w,h,text,color,active}
      // —— v3 新增（章节树 / 资产 / 画布 / 浮窗 / AI）——
      chapters: [],   // {id,pid,parent,kind:'act'|'chapter'|'scene',name,order,status,words,summary,chars:[],tags:[],created,updated}
      assets: [],     // {id,name,cat,kind,body,fields:{},tags:[],pid:null,created,updated}
      assetCats: [],  // {id,name,color,order}
      blocks: [],     // {id,pageId,type:'text'|'image'|'card'|'sticky',x,y,w,h,text,src,ref,color,z,created,updated}
      edges: [],      // {id,pageId,from,to,label,color,created}
      layouts: [],    // {id,key,payload,updated}  浮动视窗布局等界面态
      aiThreads: []   // {id,title,msgs:[{role,text,at,refs:[]}],created,updated}
    };
  }

  // 章节状态字典
  const CH_STATUS = [
    { k: 'idea', label: '灵感', color: '#888780' },
    { k: 'outline', label: '大纲', color: '#378ADD' },
    { k: 'draft', label: '初稿', color: '#EF9F27' },
    { k: 'revise', label: '修订', color: '#D85A30' },
    { k: 'done', label: '定稿', color: '#639922' }
  ];
  function chStatus(k) { return CH_STATUS.find(s => s.k === k) || CH_STATUS[0]; }

  // ---------- 版本迁移 ----------
  function migrate(s) {
    const e = empty();
    Object.keys(e).forEach(k => { if (!(k in s) || s[k] == null) s[k] = e[k]; });
    if (!s.version || s.version < 3) s.version = 3;
    // 章节补齐缺省字段
    (s.chapters || []).forEach(c => {
      if (!c.kind) c.kind = 'chapter';
      if (!c.status) c.status = 'idea';
      if (typeof c.words !== 'number') c.words = Number(c.words) || 0;
      if (!Array.isArray(c.tags)) c.tags = [];
      if (!Array.isArray(c.chars)) c.chars = [];
      if (typeof c.text !== 'string') c.text = '';
    });
    return s;
  }

  // ---------- 持久化 ----------
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        state = migrate(JSON.parse(raw));
        persist();
        return;
      }
    } catch (e) { console.warn('load err', e); }
    state = empty();
  }

  function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  function markSaved() {
    try { localStorage.setItem(SAVE_KEY, 'saved:' + Date.now()); } catch (e) {}
    if (saveCb) saveCb();
  }

  function doPersist() {
    persist(); markSaved();
    if (typeof window !== 'undefined') {
      try { window.dispatchEvent(new CustomEvent('ip2saved', { detail: { at: Date.now() } })); } catch (e) {}
    }
  }

  function save(immediate) {
    if (immediate) { doPersist(); return; }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(doPersist, 400);
  }

  function get() { return state; }
  function onSave(cb) { saveCb = cb; }

  // ---------- 日期工具 ----------
  function ymd(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function todayStr() { return ymd(new Date()); }
  function dateAdd(base, days) { const d = new Date(base + 'T00:00:00'); d.setDate(d.getDate() + days); return ymd(d); }
  function weekRange(base) {
    const d = new Date((base || todayStr()) + 'T00:00:00');
    const w = d.getDay(); const diff = (w === 0 ? -6 : 1 - w);
    const mon = new Date(d); mon.setDate(d.getDate() + diff);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: ymd(mon), to: ymd(sun) };
  }
  function monthRange(base) {
    const d = new Date((base || todayStr()) + 'T00:00:00');
    const f = new Date(d.getFullYear(), d.getMonth(), 1);
    const t = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { from: ymd(f), to: ymd(t) };
  }
  function rangeDates(from, to) { const out = []; let c = from; let guard = 0; while (c <= to && guard++ < 400) { out.push(c); c = dateAdd(c, 1); } return out; }
  function cnW(d) { return ['日', '一', '二', '三', '四', '五', '六'][new Date(d + 'T00:00:00').getDay()]; }

  // ================= 企划 =================
  function projects() { return state.projects.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0)); }
  function project(id) { return state.projects.find(p => p.id === id); }
  function addProject(name, desc, color, skel) {
    const p = { id: uid(), name: name || '未命名企划', desc: desc || '', color: color || COLORS[state.projects.length % COLORS.length], skel: skel || '', created: Date.now(), updated: Date.now() };
    state.projects.push(p); save(); return p;
  }
  function updProject(id, patch) { const p = project(id); if (!p) return; Object.assign(p, patch); p.updated = Date.now(); save(); }
  function delProject(id) {
    state.projects = state.projects.filter(p => p.id !== id);
    state.nodes = state.nodes.filter(n => n.pid !== id);
    state.entries = state.entries.filter(e => e.pid !== id);
    state.goals = state.goals.filter(g => g.pid !== id);
    state.relations = state.relations.filter(r => r.pid !== id);
    state.chapters = state.chapters.filter(c => c.pid !== id);
    state.assets.forEach(a => { if (a.pid === id) a.pid = null; });
    state.pages.forEach(p => { if (p.pid === id) p.pid = null; });
    save(true);
  }

  // ---------- 内容树 ----------
  function nodesOf(pid) { return state.nodes.filter(n => n.pid === pid).sort((a, b) => (a.order || 0) - (b.order || 0)); }
  function node(id) { return state.nodes.find(n => n.id === id); }
  function addNode(pid, parent, name) {
    const sibs = state.nodes.filter(n => n.pid === pid && (n.parent || '') === (parent || ''));
    const n = { id: uid(), pid, parent: parent || '', name: name || '新分支', order: sibs.length, created: Date.now() };
    state.nodes.push(n); save(); return n;
  }
  function updNode(id, patch) { const n = node(id); if (!n) return; Object.assign(n, patch || {}); save(); }
  function delNode(id) {
    // 连带子孙与条目
    const kill = [id]; let i = 0;
    while (i < kill.length) {
      state.nodes.forEach(n => { if (kill.indexOf(n.parent) >= 0 && kill.indexOf(n.id) < 0) kill.push(n.id); });
      i++;
    }
    state.nodes = state.nodes.filter(n => kill.indexOf(n.id) < 0);
    state.entries = state.entries.filter(e => kill.indexOf(e.nodeId) < 0);
    save(true);
  }
  function treeRows(pid) {
    // 深度优先，产出 [{node, depth}]
    const all = nodesOf(pid);
    const byParent = {};
    all.forEach(n => { (byParent[n.parent || ''] = byParent[n.parent || ''] || []).push(n); });
    const out = [];
    (function walk(parent, depth) {
      (byParent[parent] || []).forEach(n => { out.push({ node: n, depth }); walk(n.id, depth + 1); });
    })('', 0);
    return out;
  }

  // ---------- 条目 ----------
  function entriesOf(pid, nodeId) {
    return state.entries.filter(e => e.pid === pid && (nodeId === undefined || (e.nodeId || '') === nodeId))
      .sort((a, b) => (b.updated || 0) - (a.updated || 0));
  }
  function entry(id) { return state.entries.find(e => e.id === id); }
  function addEntry(pid, nodeId, title, tplId) {
    const tpl = tplId ? template(tplId) : null;
    const fields = {};
    if (tpl) (tpl.fields || []).forEach(f => { fields[f.key] = ''; });
    const e = { id: uid(), pid, nodeId: nodeId || '', title: title || '新条目', body: '', fields, tags: [], tplId: tplId || null, created: Date.now(), updated: Date.now() };
    state.entries.push(e); save(); return e;
  }
  function updEntry(id, patch) { const e = entry(id); if (!e) return; Object.assign(e, patch || {}); e.updated = Date.now(); save(); }
  function delEntry(id) {
    state.entries = state.entries.filter(e => e.id !== id);
    state.relations = state.relations.filter(r => r.a !== id && r.b !== id);
    save(true);
  }

  // ---------- 目标与打卡 ----------
  function goalsOf(pid) { return state.goals.filter(g => g.pid === pid); }
  function allGoals() { return state.goals.slice(); }
  function goal(id) { return state.goals.find(g => g.id === id); }
  function addGoal(o) {
    const g = { id: uid(), pid: o.pid || '', title: o.title || '新目标', cadence: o.cadence || 'daily', mode: o.mode || 'count', target: o.target || 1, unit: o.unit || '', created: Date.now() };
    state.goals.push(g); save(); return g;
  }
  function updGoal(id, patch) { const g = goal(id); if (!g) return; Object.assign(g, patch || {}); save(); }
  function delGoal(id) { state.goals = state.goals.filter(g => g.id !== id); state.logs = state.logs.filter(l => l.goalId !== id); save(true); }
  function logOf(goalId, date) { return state.logs.find(l => l.goalId === goalId && l.date === date); }
  function checkIn(goalId, date, value) {
    const g = goal(goalId); if (!g) return null;
    let l = logOf(goalId, date);
    if (l) { l.value = value; } else { l = { id: uid(), goalId, date, value: value == null ? 1 : value }; state.logs.push(l); }
    save(); return l;
  }
  function toggleCheck(goalId, date) {
    const g = goal(goalId);
    const l = logOf(goalId, date);
    if (l) { state.logs = state.logs.filter(x => x.id !== l.id); save(true); return false; }
    checkIn(goalId, date, g && g.mode === 'amount' ? (g.target || 1) : 1);
    return true;
  }
  function logSum(goalId, from, to) {
    return state.logs.filter(l => l.goalId === goalId && l.date >= from && l.date <= to)
      .reduce((s, l) => s + (Number(l.value) || 0), 0);
  }
  function goalProgress(g, ref) {
    ref = ref || todayStr();
    if (g.cadence === 'daily') { const l = logOf(g.id, ref); const v = l ? (Number(l.value) || 0) : 0; return { value: v, target: g.target || 0, done: g.mode === 'amount' ? v >= (g.target || 1) : v > 0 }; }
    if (g.cadence === 'weekly') { const r = weekRange(ref); const v = logSum(g.id, r.from, r.to); return { value: v, target: g.target || 0, done: g.mode === 'amount' ? v >= (g.target || 1) : v > 0 }; }
    const r2 = monthRange(ref); const v2 = logSum(g.id, r2.from, r2.to);
    return { value: v2, target: g.target || 0, done: g.mode === 'amount' ? v2 >= (g.target || 1) : v2 > 0 };
  }
  function projectRate(pid, ref) {
    const gs = pid ? goalsOf(pid) : allGoals();
    if (!gs.length) return null;
    let done = 0;
    gs.forEach(g => { if (goalProgress(g, ref).done) done++; });
    return { done, total: gs.length, pct: Math.round(done / gs.length * 100) };
  }

  // ---------- 灵感 ----------
  function ideas() { return state.ideas.slice().sort((a, b) => (b.created || 0) - (a.created || 0)); }
  function idea(id) { return state.ideas.find(i => i.id === id); }
  function addIdea(text, tags) {
    const i = { id: uid(), text: text || '', tags: tags || [], created: Date.now(), history: [] };
    state.ideas.push(i); save(); return i;
  }
  function updIdea(id, patch) {
    const i = idea(id); if (!i) return;
    if (patch && patch.text !== undefined && patch.text !== i.text) {
      i.history = i.history || [];
      i.history.push({ at: Date.now(), note: '改写前：' + i.text.slice(0, 80) });
    }
    Object.assign(i, patch || {}); save();
  }
  function delIdea(id) { state.ideas = state.ideas.filter(i => i.id !== id); save(true); }
  function mergeIdea(id, note) {
    const i = idea(id); if (!i) return;
    i.merged = true; i.mergedAt = Date.now();
    i.history = i.history || [];
    i.history.push({ at: Date.now(), note: note || '沉淀到企划' });
    save();
  }

  // ---------- 模板 ----------
  function templates(scope) { return state.templates.filter(t => !scope || t.scope === scope); }
  function template(id) { return state.templates.find(t => t.id === id); }
  function addTemplate(o) {
    const t = { id: uid(), name: o.name || '新模板', scope: o.scope || 'entry', fields: o.fields || [], color: o.color || COLORS[state.templates.length % COLORS.length], builtin: false, created: Date.now() };
    state.templates.push(t); save(); return t;
  }
  function updTemplate(id, patch) { const t = template(id); if (!t) return; Object.assign(t, patch || {}); save(); }
  function delTemplate(id) { state.templates = state.templates.filter(t => t.id !== id); save(true); }

  // ---------- 关系网 ----------
  function relsOf(pid) { return state.relations.filter(r => r.pid === pid); }
  function addRel(pid, a, b, label, dir) {
    const r = { id: uid(), pid, a, b, label: label || '', dir: dir || 'one', created: Date.now() };
    state.relations.push(r); save(); return r;
  }
  function delRel(id) { state.relations = state.relations.filter(r => r.id !== id); save(true); }

  // ================= 页面 / 标记 =================
  function page(id) { return state.pages.find(p => p.id === id); }
  function pages(pid) {
    return state.pages.filter(p => pid === undefined ? true : (p.pid || null) === pid)
      .sort((a, b) => a.updated - b.updated);
  }
  function addPage(o) {
    const p = { id: uid(), pid: o.pid || null, name: o.name || '未命名', kind: o.kind || 'doc', isDraft: !!o.isDraft,
      segments: o.text ? String(o.text).split('\n') : [''], created: Date.now(), updated: Date.now() };
    state.pages.push(p); save(); return p;
  }
  function touch(p) { p.updated = Date.now(); save(); }
  function delPage(id) {
    const blockIds = state.blocks.filter(b => b.pageId === id).map(b => b.id);
    state.pages = state.pages.filter(p => p.id !== id);
    state.annos = state.annos.filter(a => a.pageId !== id);
    state.strokes = state.strokes.filter(s => s.pageId !== id && blockIds.indexOf(s.pageId) < 0);
    state.notes = state.notes.filter(n => n.pageId !== id);
    state.blocks = state.blocks.filter(b => b.pageId !== id);
    state.edges = state.edges.filter(e => e.pageId !== id);
    save(true);
  }

  // ================= v3：章节树 =================
  function chaptersOf(pid) {
    return state.chapters.filter(c => c.pid === pid)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  function chapter(id) { return state.chapters.find(c => c.id === id); }
  function addChapter(pid, parent, name, kind) {
    const sibs = state.chapters.filter(c => c.pid === pid && (c.parent || '') === (parent || ''));
    const c = {
      id: uid(), pid, parent: parent || '', kind: kind || 'chapter', name: name || '新章节',
      order: sibs.length, status: 'idea', words: 0, summary: '', text: '',
      chars: [], tags: [], created: Date.now(), updated: Date.now()
    };
    state.chapters.push(c); save(); return c;
  }
  function updChapter(id, patch) {
    const c = chapter(id); if (!c) return;
    Object.assign(c, patch || {}); c.updated = Date.now(); save();
  }
  function delChapter(id) {
    const kill = [id]; let i = 0;
    while (i < kill.length) {
      state.chapters.forEach(c => { if (kill.indexOf(c.parent) >= 0 && kill.indexOf(c.id) < 0) kill.push(c.id); });
      i++;
    }
    state.chapters = state.chapters.filter(c => kill.indexOf(c.id) < 0);
    state.lines.forEach(l => { l.nodes = (l.nodes || []).filter(n => !(n.kind === 'chapter' && kill.indexOf(n.ref) >= 0)); });
    save(true);
  }
  function chapterRows(pid) {
    const all = chaptersOf(pid);
    const byParent = {};
    all.forEach(c => { (byParent[c.parent || ''] = byParent[c.parent || ''] || []).push(c); });
    const out = [];
    (function walk(parent, depth) {
      (byParent[parent] || []).forEach(c => { out.push({ ch: c, depth }); walk(c.id, depth + 1); });
    })('', 0);
    return out;
  }
  function chapterMove(id, dir) {
    const c = chapter(id); if (!c) return;
    const sibs = state.chapters.filter(x => x.pid === c.pid && (x.parent || '') === (c.parent || ''))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    const i = sibs.findIndex(x => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sibs.length) return;
    const t = sibs[i].order; sibs[i].order = sibs[j].order; sibs[j].order = t;
    save();
  }
  function chapterWordsTotal(pid) {
    return chaptersOf(pid).filter(c => c.kind !== 'act')
      .reduce((s, c) => s + (Number(c.words) || 0), 0);
  }
  function chapterStats(pid) {
    const list = chaptersOf(pid).filter(c => c.kind !== 'act');
    const by = {};
    CH_STATUS.forEach(s => { by[s.k] = 0; });
    list.forEach(c => { by[c.status] = (by[c.status] || 0) + 1; });
    return { total: list.length, words: chapterWordsTotal(pid), by };
  }

  // ================= v3：工具与资产 =================
  function assets(pid) {
    return state.assets.filter(a => pid === undefined ? true : (a.pid || null) === pid)
      .sort((a, b) => (b.updated || 0) - (a.updated || 0));
  }
  function asset(id) { return state.assets.find(a => a.id === id); }
  function addAsset(o) {
    o = o || {};
    const a = {
      id: uid(), name: o.name || '新资产', cat: o.cat || '', kind: o.kind || '资产',
      body: o.body || '', fields: o.fields || {}, tags: o.tags || [], pid: o.pid || null,
      created: Date.now(), updated: Date.now()
    };
    state.assets.push(a); save(); return a;
  }
  function updAsset(id, patch) {
    const a = asset(id); if (!a) return;
    Object.assign(a, patch || {}); a.updated = Date.now(); save();
  }
  function delAsset(id) { state.assets = state.assets.filter(a => a.id !== id); save(true); }
  function assetCats() {
    return state.assetCats.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  function addAssetCat(name, color) {
    const c = { id: uid(), name: name || '新分类', color: color || COLORS[state.assetCats.length % COLORS.length], order: state.assetCats.length };
    state.assetCats.push(c); save(); return c;
  }
  function updAssetCat(id, patch) { const c = state.assetCats.find(x => x.id === id); if (!c) return; Object.assign(c, patch || {}); save(); }
  function delAssetCat(id) {
    state.assetCats = state.assetCats.filter(c => c.id !== id);
    state.assets.forEach(a => { if (a.cat === id) a.cat = ''; });
    save(true);
  }

  // ================= v3：画布块与连线 =================
  function blocksOf(pageId) {
    return state.blocks.filter(b => b.pageId === pageId).sort((a, b) => (a.z || 0) - (b.z || 0));
  }
  function block(id) { return state.blocks.find(b => b.id === id); }
  function addBlock(o) {
    o = o || {};
    const b = {
      id: uid(), pageId: o.pageId, type: o.type || 'text',
      x: o.x || 0, y: o.y || 0, w: o.w || 220, h: o.h || 120,
      text: o.text || '', src: o.src || '', ref: o.ref || null,
      color: o.color || '', z: (Date.now() % 100000000), created: Date.now(), updated: Date.now()
    };
    state.blocks.push(b); save(); return b;
  }
  function updBlock(id, patch) {
    const b = block(id); if (!b) return;
    Object.assign(b, patch || {}); b.updated = Date.now(); save();
  }
  function delBlock(id) {
    state.blocks = state.blocks.filter(b => b.id !== id);
    state.edges = state.edges.filter(e => e.from !== id && e.to !== id);
    state.strokes = state.strokes.filter(s => s.pageId !== id);   // 手写块笔迹以块 id 命名
    save(true);
  }
  function edgesOf(pageId) { return state.edges.filter(e => e.pageId === pageId); }
  function addEdge(pageId, from, to, label, color) {
    if (from === to) return null;
    const dup = state.edges.find(e => e.pageId === pageId && e.from === from && e.to === to);
    if (dup) return dup;
    const e = { id: uid(), pageId, from, to, label: label || '', color: color || '#888780', created: Date.now() };
    state.edges.push(e); save(); return e;
  }
  function delEdge(id) { state.edges = state.edges.filter(e => e.id !== id); save(true); }

  // ================= v3：界面布局（浮动视窗等） =================
  function layout(key) { return state.layouts.find(l => l.key === key); }
  function setLayout(key, payload) {
    let l = layout(key);
    if (!l) { l = { id: uid(), key, payload: {}, updated: 0 }; state.layouts.push(l); }
    l.payload = payload || {}; l.updated = Date.now(); save(); return l;
  }
  function delLayout(key) { state.layouts = state.layouts.filter(l => l.key !== key); save(true); }

  // ================= v3：AI 会话 =================
  function aiThreads() { return state.aiThreads.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0)); }
  function aiThread(id) { return state.aiThreads.find(t => t.id === id); }
  function addAiThread(title) {
    const t = { id: uid(), title: title || '新对话', msgs: [], created: Date.now(), updated: Date.now() };
    state.aiThreads.push(t); save(); return t;
  }
  function aiPush(id, msg) {
    const t = aiThread(id); if (!t) return null;
    const m = { role: msg.role || 'user', text: msg.text || '', at: Date.now(), refs: msg.refs || [] };
    t.msgs.push(m); t.updated = Date.now();
    if (!t.title || t.title === '新对话') { if (m.role === 'user') t.title = m.text.slice(0, 18); }
    save(); return m;
  }
  function updAiThread(id, patch) { const t = aiThread(id); if (!t) return; Object.assign(t, patch || {}); t.updated = Date.now(); save(); }
  function delAiThread(id) { state.aiThreads = state.aiThreads.filter(t => t.id !== id); save(true); }

  // ---------- 标签 ----------
  function ensureTag(name) {
    name = (name || '').trim();
    if (!name) return null;
    let t = state.tags.find(t => t.name === name);
    if (!t) { t = { id: uid(), name, color: COLORS[state.tags.length % COLORS.length] }; state.tags.push(t); save(); }
    return t;
  }
  function tags() { return state.tags.slice().sort((a, b) => a.name.localeCompare(b.name, 'zh')); }
  function tag(id) { return state.tags.find(t => t.id === id); }
  function delTag(id) {
    state.tags = state.tags.filter(t => t.id !== id);
    state.annos = state.annos.filter(a => a.tagId !== id);
    state.lines.forEach(l => { l.nodes = l.nodes.filter(n => !(n.kind === 'tag' && n.ref === id)); });
    save(true);
  }
  function renameTag(id, name) { const t = tag(id); if (!t) return; t.name = name.trim(); save(); }

  // ---------- 标记 ----------
  function annosOf(pageId) { return state.annos.filter(a => a.pageId === pageId); }
  function annosOfTag(tagId) { return state.annos.filter(a => a.tagId === tagId); }
  function annosOfTagMerged(tagId) {
    return annosOfTag(tagId).map(a => {
      const p = page(a.pageId);
      const segText = p ? (p.segments[a.seg] || '') : '';
      const snip = p ? segText.slice(Math.max(0, a.start - 12), Math.min(segText.length, a.end + 18)) : '';
      return { a, page: p, snip, pageName: p ? p.name : '', label: p ? (p.name + ' · 段' + (a.seg + 1)) : '' };
    });
  }
  function addAnno(pageId, seg, start, end, kind, tagId) {
    const p = page(pageId); if (!p) return null;
    const segText = p.segments[seg] || '';
    const a = { id: uid(), pageId, seg, start, end, kind: kind || 'hl',
      tagId: tagId || null, color: tagId ? (tag(tagId) || {}).color : null,
      text: segText.slice(start, end), created: Date.now() };
    state.annos.push(a); touch(p); return a;
  }
  function delAnno(id) {
    state.annos = state.annos.filter(a => a.id !== id);
    state.lines.forEach(l => { l.nodes = l.nodes.filter(n => !(n.kind === 'anno' && n.ref === id)); });
    save(true);
  }
  function anno(id) { return state.annos.find(a => a.id === id); }
  function allAnnosWithMeta() {
    return state.annos.slice().sort((a, b) => a.created - b.created).map(a => {
      const p = page(a.pageId);
      const segText = p ? (p.segments[a.seg] || '') : '';
      const snip = p ? segText.slice(Math.max(0, a.start - 14), Math.min(segText.length, a.end + 24)) : '';
      return { a, page: p, pageName: p ? p.name : '', snip, pageLabel: p ? (p.name + ' · 段' + (a.seg + 1)) : '' };
    });
  }

  // ---------- 逻辑线 ----------
  function lines() { return state.lines.slice(); }
  function line(id) { return state.lines.find(l => l.id === id); }
  function addLine(name, color) {
    const l = { id: uid(), name: name || '新逻辑线', color: color || COLORS[state.lines.length % COLORS.length], nodes: [] };
    state.lines.push(l); save(); return l;
  }
  function updLine(id, patch) { const l = line(id); if (!l) return; Object.assign(l, patch || {}); save(); }
  function delLine(id) { state.lines = state.lines.filter(l => l.id !== id); save(true); }
  function linePush(l, kind, ref, label) {
    if (l.nodes.some(n => n.kind === kind && n.ref === ref)) return false;
    l.nodes.push({ kind, ref, label: label || '' }); save(); return true;
  }
  function lineMove(l, i, dir) {
    const j = i + dir;
    if (j < 0 || j >= l.nodes.length) return;
    const t = l.nodes[i]; l.nodes[i] = l.nodes[j]; l.nodes[j] = t; save();
  }
  function lineRemove(l, i) { l.nodes.splice(i, 1); save(); }

  // ---------- 笔迹 / 便签 ----------
  function strokesOf(pageId) { return state.strokes.filter(s => s.pageId === pageId); }
  function addStroke(s) { state.strokes.push(s); save(); }
  function clearStrokes(pageId) { state.strokes = state.strokes.filter(s => s.pageId !== pageId); save(true); }
  function notesOf(pageId) { return state.notes.filter(n => n.pageId === pageId); }
  function addNote(pageId, x, y) {
    const n = { id: uid(), pageId, x, y, w: 190, h: 74, text: '',
      color: NOTE_COLS[Math.floor(Math.random() * NOTE_COLS.length)], active: true };
    state.notes.push(n); save(); return n;
  }
  function updNote(id, patch) { const n = state.notes.find(v => v.id === id); if (!n) return; Object.assign(n, patch); save(); }
  function delNote(id) { state.notes = state.notes.filter(n => n.id !== id); save(true); }

  // ---------- 检索 ----------
  function searchAll(q) {
    q = (q || '').toLowerCase().trim();
    if (!q) return [];
    const out = [];
    state.pages.forEach(p => {
      p.segments.forEach((seg, i) => {
        const lower = seg.toLowerCase();
        let from = 0, k;
        while ((k = lower.indexOf(q, from)) !== -1) {
          out.push({ kind: 'page', pageId: p.id, pageName: p.name, seg: i, at: k,
            ctx: seg.slice(Math.max(0, k - 20), Math.min(seg.length, k + q.length + 30)) });
          from = k + q.length;
          if (out.length > 400) break;
        }
      });
    });
    // 条目与灵感也纳入检索
    state.entries.forEach(e => {
      const hay = (e.title + '\n' + (e.body || '')).toLowerCase();
      if (hay.indexOf(q) >= 0) out.push({ kind: 'entry', entryId: e.id, pageName: e.title, ctx: (e.body || e.title).slice(0, 60) });
    });
    state.ideas.forEach(i => {
      if ((i.text || '').toLowerCase().indexOf(q) >= 0) out.push({ kind: 'idea', ideaId: i.id, pageName: '灵感', ctx: i.text.slice(0, 60) });
    });
    // v3：章节 / 资产 / 画布块
    state.chapters.forEach(c => {
      const hay = (c.name + '\n' + (c.summary || '')).toLowerCase();
      if (hay.indexOf(q) >= 0) out.push({ kind: 'chapter', chapterId: c.id, pageName: '章节 · ' + c.name, ctx: (c.summary || c.name).slice(0, 60) });
    });
    state.assets.forEach(a => {
      const hay = (a.name + '\n' + (a.body || '')).toLowerCase();
      if (hay.indexOf(q) >= 0) out.push({ kind: 'asset', assetId: a.id, pageName: '资产 · ' + a.name, ctx: (a.body || a.name).slice(0, 60) });
    });
    state.blocks.forEach(b => {
      if (((b.text || '') + (b.src || '')).toLowerCase().indexOf(q) >= 0) {
        const p = page(b.pageId);
        out.push({ kind: 'block', blockId: b.id, pageId: b.pageId, pageName: (p ? p.name : '画布') + ' · 块', ctx: (b.text || '').slice(0, 60) });
      }
    });
    return out;
  }
  function searchTags(q) {
    q = (q || '').toLowerCase().trim();
    if (!q) return [];
    return state.tags.filter(t => t.name.toLowerCase().includes(q));
  }

  function resetAll(seed) {
    localStorage.removeItem(KEY);
    if (seed) { state = migrate(JSON.parse(JSON.stringify(seed))); }
    else { state = empty(); }
    doPersist();
  }

  return { load, save, get, onSave, resetAll, uid,
    ymd, todayStr, dateAdd, weekRange, monthRange, rangeDates, cnW,
    projects, project, addProject, updProject, delProject,
    nodesOf, node, addNode, updNode, delNode, treeRows,
    entriesOf, entry, addEntry, updEntry, delEntry,
    goalsOf, allGoals, goal, addGoal, updGoal, delGoal,
    logOf, checkIn, toggleCheck, logSum, goalProgress, projectRate,
    ideas, idea, addIdea, updIdea, delIdea, mergeIdea,
    templates, template, addTemplate, updTemplate, delTemplate,
    relsOf, addRel, delRel,
    page, pages, addPage, touch, delPage,
    ensureTag, tags, tag, delTag, renameTag,
    anno, annosOf, annosOfTag, annosOfTagMerged, addAnno, delAnno, allAnnosWithMeta,
    lines, line, addLine, updLine, delLine, linePush, lineMove, lineRemove,
    strokesOf, addStroke, clearStrokes,
    notesOf, addNote, updNote, delNote,
    chStatus, CH_STATUS,
    chaptersOf, chapter, addChapter, updChapter, delChapter, chapterRows, chapterMove,
    chapterWordsTotal, chapterStats,
    assets, asset, addAsset, updAsset, delAsset,
    assetCats, addAssetCat, updAssetCat, delAssetCat,
    blocksOf, block, addBlock, updBlock, delBlock,
    edgesOf, addEdge, delEdge,
    layout, setLayout, delLayout,
    aiThreads, aiThread, addAiThread, aiPush, updAiThread, delAiThread,
    searchAll, searchTags };
})();
