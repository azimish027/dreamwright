/* sync.js —— 同步引擎：变更队列 → 推送 / 拉取合并（最后写入者胜，简化版） */
const IPSync = (function () {
  const CATS = ['projects', 'nodes', 'entries', 'goals', 'logs', 'ideas', 'templates', 'relations',
    'pages', 'tags', 'annos', 'lines', 'strokes', 'notes',
    // v3
    'chapters', 'assets', 'assetCats', 'blocks', 'edges', 'layouts', 'aiThreads'];
  const META_KEY = 'ip2sync:meta'; // {lastSnap: {cat:{rid:ts}}, lastPull: ts|null, queueOnDisk}
  const QUEUE_KEY = 'ip2sync:queue';

  let meta = null;
  let queue = [];
  let listeners = [];
  let timerSync = null, timerFlush = null;
  let status = { in: 'idle', pending: 0, lastSync: null, err: null, mode: 'demo' };

  function jget(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function jset(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  function on(ev, val) { /* noop kept for parity */ }

  function emit() { listeners.forEach(f => { try { f({ status: statusView() }); } catch (e) {} }); }
  function onChange(fn) { listeners.push(fn); }
  function statusView() {
    return { mode: status.mode, in: status.in, pending: queue.length, lastSync: status.lastSync, err: status.err };
  }

  // ---------- 快照与 diff ----------
  function snapshotNow() {
    const s = IP2.get();
    const snap = {};
    CATS.forEach(c => { const m = {}; (s[c] || []).forEach(o => { m[o.id] = o; }); snap[c] = m; });
    return snap;
  }
  function snapOfIds(snap) {
    const out = {};
    CATS.forEach(c => { const m = {}; Object.keys(snap[c] || {}).forEach(id => { m[id] = snap[c][id]; }); out[c] = m; });
    return out;
  }

  // 对比当前 vs lastKnown，产出增量 ops（id 为键）
  function diffOps(lastKnown) {
    const now = snapshotNow();
    const ops = [];
    CATS.forEach(c => {
      const cur = now[c] || {}, last = (lastKnown && lastKnown[c]) || {};
      const ids = new Set([...Object.keys(cur), ...Object.keys(last)]);
      ids.forEach(id => {
        const a = cur[id], b = last[id];
        if (a && !b) ops.push({ op: 'put', cat: c, rid: id, obj: a, ts: Date.now() });
        else if (a && b && JSON.stringify(a) !== JSON.stringify(b)) ops.push({ op: 'put', cat: c, rid: id, obj: a, ts: Date.now() });
        else if (!a && b) ops.push({ op: 'del', cat: c, rid: id, ts: Date.now() });
      });
    });
    return { ops, now };
  }

  function idsOnly(snap) {
    const out = {};
    CATS.forEach(c => { const m = {}; Object.keys(snap[c] || {}).forEach(id => { m[id] = 1; }); out[c] = m; });
    return out;
  }

  // ---------- 初始化 / 登录接管 ----------
  function init() {
    meta = jget(META_KEY, { lastKnown: null, lastPull: null });
    queue = jget(QUEUE_KEY, []);
    // 未登录时静默；登录取代时机
    window.addEventListener('ip2saved', () => {
      if (!IPAuth.user()) return;
      scheduleFlush();
    });
    window.addEventListener('online', () => { if (IPAuth.user()) { pullNow(); } });
    // 周期心跳
    timerSync = setInterval(() => {
      if (IPAuth.user()) { if (queue.length) flush(); else if (meta.lastPull) pullNow(); }
    }, 20000);
  }

  function boot() {
    init();
    if (IPAuth.user()) {
      // 已有会话：若本地从未首传 → 先把本地上传为种子
      if (!meta.lastPull) return uploadAllSeed();
      pullNow();
    }
  }

  function afterLogin() {
    // 新登录：首次把本地全部作为种子上传，再拉取
    return uploadAllSeed().then(() => { meta.lastPull = Date.now(); jset(META_KEY, meta); emit(); });
  }
  function afterLogout() {
    queue = []; jset(QUEUE_KEY, queue);
    meta = { lastKnown: null, lastPull: null }; jset(META_KEY, meta);
    status.lastSync = null; emit();
  }

  function uploadAllSeed() {
    const ops = [];
    const now = snapshotNow();
    CATS.forEach(c => { Object.values(now[c] || {}).forEach(o => ops.push({ op: 'put', cat: c, rid: o.id, obj: o, ts: Date.now() })); });
    if (!ops.length) return Promise.resolve();
    status.in = 'push';
    return pushOps(ops).then(res => {
      if (res && res.ok) {
        queue = queue.filter(q => !ops.some(o => o.rid === q.rid && o.op === q.op && o.cat === q.cat));
        jset(QUEUE_KEY, queue);
        meta.lastKnown = snapOfIds(snapshotNow()); meta.lastPull = Date.now(); jset(META_KEY, meta);
        status.lastSync = Date.now(); status.in = 'idle'; emit();
      } else { status.in = 'idle'; status.err = (res && res.err) || '上传失败'; emit(); }
      return res;
    });
  }

  function scheduleFlush() {
    clearTimeout(timerFlush);
    timerFlush = setTimeout(flush, 1200);
  }

  function flush() {
    const u = IPAuth.user();
    if (!u) return Promise.resolve({ ok: true });
    status.mode = (window.IPAuth && IPAuth.isCloud()) ? 'cloud' : 'demo';
    // 防并发
    if (status.in === 'push' || status.in === 'pull') return Promise.resolve({ ok: true, busy: true });
    const { ops } = diffOps(meta.lastKnown);
    if (!ops.length) { emit(); return Promise.resolve({ ok: true }); }
    status.in = 'push';
    queue = ops; // 队列即本次待发（简化：一次性清空模型）
    return pushOps(ops).then(res => {
      if (res && res.ok) {
        queue = [];
        jset(QUEUE_KEY, queue);
        meta.lastKnown = snapOfIds(snapshotNow());
        meta.lastPull = Date.now();
        jset(META_KEY, meta);
        status.lastSync = Date.now(); status.in = 'idle'; status.err = null;
      } else {
        status.in = 'idle';
        status.err = (res && res.err) || '推送失败';
        jset(QUEUE_KEY, queue); // 保留待重试
      }
      emit();
      return res;
    });
  }

  function pushOps(ops) {
    const u = IPAuth.user();
    if (!u) return Promise.resolve({ err: '未登录' });
    return IPAuth.apiPush(u.token, ops);
  }

  // ---------- 拉取合并 ----------
  function pullNow() {
    const u = IPAuth.user();
    if (!u) return Promise.resolve({ err: '未登录' });
    status.mode = (window.IPAuth && IPAuth.isCloud()) ? 'cloud' : 'demo';
    if (status.in === 'push' || status.in === 'pull') return Promise.resolve({ ok: true, busy: true });
    // 推送本地 → 再拉（保证已是最新）
    status.in = 'pull';
    return IPAuth.apiPull(u.token).then(res => {
      if (!res || !res.ok) {
        status.in = 'idle'; status.err = (res && res.err) || '拉取失败'; emit();
        return res;
      }
      applyRemote(res.recs || []);
      meta.lastPull = Date.now();
      jset(META_KEY, meta);
      status.lastSync = Date.now(); status.in = 'idle'; status.err = null; emit();
      return res;
    });
  }

  function applyRemote(recs) {
    const s = IP2.get();
    // 本地“自上次拉取后有本地改动”判定
    const localDirty = {};
    if (meta.lastKnown) {
      const now = snapshotNow();
      CATS.forEach(c => {
        const cur = now[c] || {}, last = meta.lastKnown[c] || {};
        const ids = new Set([...Object.keys(cur), ...Object.keys(last)]);
        ids.forEach(id => {
          const a = cur[id], b = last[id];
          if ((a && b && JSON.stringify(a) !== JSON.stringify(b)) || (a && !b) || (!a && b)) {
            (localDirty[c] = localDirty[c] || {})[id] = true;
          }
        });
      });
    }
    recs.forEach(r => {
      const cat = r.cat || guessCat(r.rid);
      if (!cat) return;
      const cur = s[cat] || (s[cat] = []);
      if (r.deleted) {
        if (!(localDirty[cat] && localDirty[cat][r.rid])) {
          s[cat] = cur.filter(x => x.id !== r.rid);
        }
      } else if (r.obj) {
        const local = cur.find(x => x.id === r.rid);
        if (!local) cur.push(JSON.parse(JSON.stringify(r.obj)));
        else if (!(localDirty[cat] && localDirty[cat][r.rid])) {
          const idx = cur.indexOf(local);
          cur[idx] = JSON.parse(JSON.stringify(r.obj));
        }
      }
    });
    IP2.save(true);
    meta.lastKnown = snapOfIds(snapshotNow());
  }

  function guessCat(rid) {
    const s = IP2.get();
    for (const c of CATS) if (s[c].some(x => x.id === rid)) return c;
    return null;
  }

  // 手动触发（UI 按钮）
  function syncNow() { if (queue.length) return flush(); return pullNow(); }

  return { init, boot, afterLogin, afterLogout, flush, pullNow, syncNow, onChange, status: statusView, diffOps, applyRemote };
})();
