/* auth.js —— 账号层：用户名+密码（演示后端 / 真实云 HTTP 双路） */
const IPAuth = (function () {
  const CFG_KEY = 'ip2auth:cfg';
  const USER_KEY = 'ip2auth:user';
  const CLOUD_ENV_KEY = 'ip2auth:cloudenv';
  // CloudBase 环境 ID：构建时由 build.js 注入（/*__CLOUD_ENV__*/）；运行期可在登录弹窗里改，存 localStorage 覆盖。
  const CLOUD_ENV = '/*__CLOUD_ENV__*/';
  function cloudEnv() { try { const v = localStorage.getItem(CLOUD_ENV_KEY); if (v) return v; } catch (e) {} return CLOUD_ENV; }
  function setCloudEnv(id) { try { if (id) localStorage.setItem(CLOUD_ENV_KEY, id); else localStorage.removeItem(CLOUD_ENV_KEY); } catch (e) {} }

  // ---- 演示后端（localStorage 模拟远端，无网可跑通全流程）----
  const DEMO_USERS = 'ip2demo:users';   // [{user, salt, hash}]
  const DEMO_TOKENS = 'ip2demo:tokens'; // {token: {user, exp}}
  const DEMO_RECS = 'ip2demo:recs';     // {[userId]: {rid: {obj, updatedAt, deleted}}}

  function jget(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function jset(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  function hash(salt, pass) { let h = salt + '::' + pass; let r = 0x811c9dc5; for (let i = 0; i < h.length; i++) { r ^= h.charCodeAt(i); r = Math.imul(r, 0x01000193); } return (r >>> 0).toString(16); }

  function demoRegister(user, pass) {
    user = (user || '').trim();
    if (user.length < 2) return { err: '用户名至少 2 个字符' };
    if ((pass || '').length < 4) return { err: '密码至少 4 位' };
    const users = jget(DEMO_USERS, []);
    if (users.some(u => u.user === user)) return { err: '该用户名已被注册' };
    const salt = Math.random().toString(36).slice(2, 8);
    users.push({ user, salt, hash: hash(salt, pass) });
    jset(DEMO_USERS, users);
    return demoIssue(user);
  }
  function demoLogin(user, pass) {
    user = (user || '').trim();
    const users = jget(DEMO_USERS, []);
    const u = users.find(x => x.user === user);
    if (!u || u.hash !== hash(u.salt, pass || '')) return { err: '用户名或密码不对' };
    return demoIssue(user);
  }
  function demoIssue(user) {
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const tokens = jget(DEMO_TOKENS, {});
    tokens[token] = { user, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 };
    jset(DEMO_TOKENS, tokens);
    return { user, token };
  }
  function demoAuthed(token) {
    if (!token) return null;
    const tokens = jget(DEMO_TOKENS, {});
    const s = tokens[token];
    if (!s || s.exp < Date.now()) return null;
    return s.user;
  }
  function demoRecs(userId) {
    const all = jget(DEMO_RECS, {});
    return all[userId] || {};
  }
  // 模拟远端写入（同步引擎经由此落远端池）
  function demoUpsert(userId, rid, obj, cat, updatedAt) {
    const all = jget(DEMO_RECS, {});
    const mine = all[userId] || (all[userId] = {});
    mine[rid] = { obj: JSON.parse(JSON.stringify(obj)), cat: cat || '', updatedAt, deleted: false };
    jset(DEMO_RECS, all);
  }
  function demoDelete(userId, rid, cat, updatedAt) {
    const all = jget(DEMO_RECS, {});
    const mine = all[userId] || (all[userId] = {});
    if (!mine[rid]) { mine[rid] = { obj: null, cat: cat || '', updatedAt, deleted: true }; }
    else { mine[rid].deleted = true; mine[rid].updatedAt = updatedAt; mine[rid].cat = cat || mine[rid].cat || ''; }
    jset(DEMO_RECS, all);
  }
  // 演示多端模拟：可切“另一台设备”池？（保持简单：仅单池）

  // ---- 邀请码（本地软校验：防君子不防小人；云端模式交由服务端校验）----
  const INVITES = ['DREAM2026', 'ZHUMENG2026', 'FACET2026', '筑梦之境'];
  function normCode(s) { return String(s || '').trim().toUpperCase().replace(/[\s-]/g, ''); }
  function checkInvite(code) {
    const c = normCode(code);
    if (!c) return { err: '请填写邀请码' };
    if (INVITES.map(normCode).indexOf(c) < 0) return { err: '邀请码不对，请找作者要一个' };
    return { ok: true };
  }

  // ---- 邮箱验证码（演示模式直接回显；云端模式交给云函数）----
  const CODE_STORE = 'ip2demo:codes';
  function isEmail(s) { return /^\S+@\S+\.\S+$/.test(String(s || '').trim()); }

  function sendCode(email) {
    email = String(email || '').trim();
    if (!isEmail(email)) return Promise.resolve({ err: '邮箱格式不对' });
    if (isCloud()) {
      return cloudCall('auth', { action: 'sendcode', email }).then(r => {
        if (r.err) return r;
        return { ok: true, email, demo: r.demo || '', note: r.note || '' };
      });
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const all = jget(CODE_STORE, {});
    all[email] = { code, exp: Date.now() + 10 * 60 * 1000 };
    jset(CODE_STORE, all);
    return Promise.resolve({ ok: true, email, demo: code, note: '演示模式：真实云端会发到你的邮箱，这里先直接显示。' });
  }

  function verifyCode(email, code) {
    const all = jget(CODE_STORE, {});
    const it = all[email];
    if (!it) return { err: '请先点「获取验证码」' };
    if (it.exp < Date.now()) return { err: '验证码已过期，请重新获取' };
    if (it.code !== String(code || '').trim()) return { err: '验证码不对' };
    delete all[email]; jset(CODE_STORE, all);
    return { ok: true };
  }

  function demoEnsureUser(user) {
    const users = jget(DEMO_USERS, []);
    if (!users.some(u => u.user === user)) {
      const salt = Math.random().toString(36).slice(2, 8);
      users.push({ user, salt, hash: hash(salt, 'email-login-' + user) });
      jset(DEMO_USERS, users);
    }
    return demoIssue(user);
  }

  function loginCode(email, code) {
    email = String(email || '').trim();
    if (isCloud()) {
      return cloudCall('auth', { action: 'logincode', email, code }).then(r => {
        if (r.err) return r;
        saveSession({ user: r.user || email, token: r.token });
        return { ok: true, user: r.user || email };
      });
    }
    const v = verifyCode(email, code);
    if (v.err) return Promise.resolve(v);
    const s = demoEnsureUser(email);
    saveSession({ user: s.user, token: s.token });
    return Promise.resolve({ ok: true, user: s.user });
  }

  function registerCode(email, code, invite) {
    const iv = checkInvite(invite);
    if (iv.err) return Promise.resolve(iv);
    return loginCode(email, code);
  }

  // ---- 云配置 ----
  // fnUrl：云函数完整访问地址（新部署方式，一个函数搞定 auth+sync）
  // httpBase/envId：旧版双函数方式（保留兼容）
  function cfg() { return jget(CFG_KEY, { fnUrl: '', httpBase: '', envId: '', secret: '' }); }
  function setCfg(c) {
    const cur = cfg();
    Object.assign(cur, c || {});
    jset(CFG_KEY, cur);
    return cur;
  }
  function isCloud() {
    if (window.IPCloud && IPCloud.available()) return true;     // 真实 CloudBase 已连
    const c = cfg(); return !!(c.fnUrl || c.httpBase || (c.envId && c.secret)); // 旧版 HTTP 网关
  }
  function mode() { return isCloud() ? 'cloud' : 'demo'; }

  // ---- 当前会话 ----
  let session = null; // {user, token}

  function load() {
    const u = jget(USER_KEY, null);
    if (u) {
      if (u.anon) { session = u; return session; } // 匿名用户：本地生成、本地信任，免 token 校验
      // demo 校验 token
      if (!isCloud()) {
        if (demoAuthed(u.token) === u.user) session = u;
        else { localStorage.removeItem(USER_KEY); session = null; }
      } else session = u;
    }
    return session;
  }
  function user() { return session; }
  function saveSession(u) { session = u; if (u) jset(USER_KEY, u); else localStorage.removeItem(USER_KEY); }

  function register(user, pass) {
    let r;
    if (isCloud()) r = cloudCall('auth', { action: 'register', user, pass });
    else r = demoRegister(user, pass);
    if (r.err) return r;
    saveSession({ user: r.user, token: r.token });
    return { ok: true, user: r.user };
  }
  function login(user, pass) {
    let r;
    if (isCloud()) r = cloudCall('auth', { action: 'login', user, pass });
    else r = demoLogin(user, pass);
    if (r.err) return r;
    saveSession({ user: r.user, token: r.token });
    return { ok: true, user: r.user };
  }
  function logout() {
    if (window.IPCloud && IPCloud.available()) { try { IPCloud.signOut(); } catch (e) {} }
    saveSession(null);
  }

  // ---- 匿名登录（v14.1：优先连真实 CloudBase；连不上则本地匿名，仍可继续用）----
  async function anonLogin() {
    if (window.IPCloud && IPCloud.available()) {
      try {
        const cuid = await IPCloud.anonLogin();
        const id = 'anon_' + cuid.slice(-6);
        const token = cuid; // 云端 uid 即 token
        saveSession({ user: id, token, anon: true, uid: cuid, cloud: true });
        return { ok: true, user: id, cloud: true, uid: cuid };
      } catch (e) {
        const id = 'anon_' + Math.random().toString(36).slice(2, 8);
        saveSession({ user: id, token: 'anon_' + Math.random().toString(36).slice(2) + Date.now().toString(36), anon: true, cloud: false });
        return { ok: true, user: id, cloud: false };
      }
    }
    const id = 'anon_' + Math.random().toString(36).slice(2, 8);
    const token = 'anon_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    saveSession({ user: id, token, anon: true, cloud: false });
    return { ok: true, user: id, cloud: false };
  }
  // 已存在匿名会话：若云端可用，尝试恢复 uid（刷新后 token 仍在 localStorage，但 IPCloud 需重新登录）
  async function refreshAnon() {
    const u = session;
    if (!u || !u.anon) return false;
    if (!(window.IPCloud && IPCloud.available())) return false;
    try {
      const cuid = await IPCloud.anonLogin();
      u.uid = cuid; u.cloud = true; u.token = cuid;
      saveSession(u);
      return true;
    } catch (e) { return false; }
  }

  // ---- AI 每日额度（v14：本地计数原型；接 CloudBase 后由服务端下发）----
  const AI_KEY = 'ip2auth:aiused';
  const AI_QUOTA = { guest: 0, anon: 20, user: 50 }; // 每日调用上限（次）
  function todayStr() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function aiRead() {
    const v = jget(AI_KEY, null);
    if (!v || v.date !== todayStr()) { const nw = { date: todayStr(), count: 0 }; jset(AI_KEY, nw); return nw; }
    return v;
  }
  function aiPlan() { const u = session; if (!u) return 'guest'; return u.anon ? 'anon' : 'user'; }
  function aiQuota() {
    const plan = aiPlan();
    const total = AI_QUOTA[plan] || 0;
    const used = aiRead().count;
    return { plan, total, used, left: Math.max(0, total - used) };
  }
  function canUseAI() { return aiQuota().left > 0; }
  function incrAI() { const v = aiRead(); v.count++; jset(AI_KEY, v); return v.count; }

  // v14.1：服务端额度（CloudBase）——云端优先，否则本地计数
  async function aiQuotaAsync() {
    const plan = aiPlan();
    const total = AI_QUOTA[plan] || 0;
    if (window.IPCloud && IPCloud.available() && session && session.uid) {
      const today = todayStr();
      let used = 0;
      try { const q = await IPCloud.quotaGet(today); used = (typeof q === 'number') ? q : 0; } catch (e) {}
      return { plan, total, used, left: Math.max(0, total - used) };
    }
    const used = aiRead().count;
    return { plan, total, used, left: Math.max(0, total - used) };
  }
  async function canUseAIAsync() {
    const q = await aiQuotaAsync();
    return q.left > 0;
  }
  async function incrAIAsync() {
    const q = await aiQuotaAsync();
    if (window.IPCloud && IPCloud.available() && session && session.uid) {
      try { await IPCloud.quotaSet(todayStr(), q.used + 1); return q.used + 1; } catch (e) {}
    }
    const v = aiRead(); v.count++; jset(AI_KEY, v); return v.count;
  }

  // ---- 真实云调用（HTTP 云函数）----
  async function cloudCall(fn, payload) {
    const c = cfg();
    let url, body;
    if (c.fnUrl) {
      // 新方式：单个云函数，fn 放进请求体
      url = c.fnUrl;
      body = Object.assign({}, payload, { fn: fn, secret: c.secret || undefined });
    } else {
      // 旧方式：httpBase + /auth 或 /sync
      const base = c.httpBase || 'https://' + c.envId + '.service.tcloudbase.com';
      url = base + '/' + fn;
      body = payload;
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-TCB-Env': c.envId || '', 'X-TCB-Secret': c.secret || '' },
        body: JSON.stringify(body)
      });
      let data = await res.json();
      // 兼容网关把返回包一层的格式 {statusCode, body: "..."}
      if (data && typeof data.body === 'string') { try { data = JSON.parse(data.body); } catch (e) {} }
      // 401/403：网关层拒绝（云函数代码根本没跑到——代码里所有失败都返回中文，不会给裸 HTTP 码）
      if (res.status === 401 || res.status === 403) {
        return { err: '网关拒绝访问（HTTP ' + res.status + '）：这条地址通了，但云函数的 HTTP 访问还开着「需要鉴权」，请求在到达云函数前就被拦下了。请到云开发控制台 → 「HTTP 网关 / 访问服务」→ 编辑你那条 /api 路由，把「鉴权」改成「公开访问 / 无需鉴权」（安全性不用担心，云函数里的 ACCESS_KEY 已挡一层），保存后重试。' };
      }
      if (!res.ok || data.err) return { err: (data && data.err) || ('HTTP ' + res.status) };
      return data;
    } catch (e) {
      const m = (e && e.message) || String(e);
      let hint = '';
      if (/Failed to fetch|NetworkError|Load failed|ERR_/i.test(m)) {
        hint = '　→ 请求没到达云函数。两种可能：① 跨域被拦（最常见）：请到云开发控制台「HTTP 网关 → 跨域设置 / CORS」把你访问工作台的来源域名加入白名单（本地调试可加 http://localhost:*）；② 访问地址不通：请把填的这条地址复制到浏览器地址栏直接打开——能显示一屏 JSON 文字说明链路通、只是跨域问题；显示 404/打不开则是地址填错或网关路径没生效。原始报错：' + m;
      } else if (/Unexpected token|JSON|Body/.test(m)) {
        hint = '　→ 地址通但返回的不是云函数内容（可能指到了网页而不是函数）。请确认填的地址是「HTTP 网关里那条 /api 触发路径」而不是网站首页地址。原始报错：' + m;
      } else {
        hint = '　原始报错：' + m;
      }
      return { err: '无法连接云端：' + hint };
    }
  }

  // 同步数据接口（供 sync.js 使用）：统一返回 Promise
  function apiPull(token) {
    if (window.IPCloud && IPCloud.available() && session && session.uid) {
      return IPCloud.dataPull().then(recs => {
        const arr = (recs || []).map(r => ({ rid: r.rid, cat: r.cat, obj: r.deleted ? null : r.obj, updatedAt: Date.now(), deleted: !!r.deleted }));
        return { ok: true, user: session.user, recs: arr, serverTime: Date.now() };
      }).catch(e => ({ err: (e && e.message) || String(e) }));
    }
    if (isCloud()) return cloudCall('sync', { action: 'pull', token });
    const user = demoAuthed(token);
    if (!user) return Promise.resolve({ err: '会话失效' });
    const mine = demoRecs(user);
    const arr = [];
    Object.keys(mine).forEach(rid => {
      const it = mine[rid];
      arr.push({ rid, cat: it.cat || '', obj: it.deleted ? null : it.obj, updatedAt: it.updatedAt, deleted: !!it.deleted });
    });
    return Promise.resolve({ ok: true, user, recs: arr, serverTime: Date.now() });
  }
  function apiPush(token, ops) {
    if (window.IPCloud && IPCloud.available() && session && session.uid) {
      const jobs = (ops || []).map(op => op.op === 'del'
        ? IPCloud.dataDelete(op.cat, op.rid)
        : IPCloud.dataPut(op.cat, op.rid, op.obj, false));
      return Promise.all(jobs).then(() => ({ ok: true, serverTime: Date.now() }))
        .catch(e => ({ err: (e && e.message) || String(e) }));
    }
    if (isCloud()) return cloudCall('sync', { action: 'push', token, ops });
    const userId = demoAuthed(token);
    if (!userId) return Promise.resolve({ err: '会话失效' });
    ops.forEach(op => {
      if (op.op === 'put') demoUpsert(userId, op.rid, op.obj, op.cat, op.ts);
      else if (op.op === 'del') demoDelete(userId, op.rid, op.cat, op.ts);
    });
    return Promise.resolve({ ok: true, serverTime: Date.now() });
  }

  return {
    load, user, register, login, logout, anonLogin, refreshAnon,
    sendCode, loginCode, registerCode, checkInvite,
    cfg, setCfg, isCloud, mode, saveSession, cloudEnv, setCloudEnv,
    apiPull, apiPush,
    aiQuota, canUseAI, incrAI, aiPlan,
    aiQuotaAsync, canUseAIAsync, incrAIAsync
  };
})();
