/* IP创作工作台 · 云同步云函数（二合一：auth + sync）
 * —— v4 版：适配 2026 新一代 CloudBase（PostgreSQL / "Supabase 版"）——
 *
 * 与旧版最大的不同：不再用 pg 驱动直连数据库（个人版连不通，且要填
 * host/端口/密码一堆东西），改为调用平台自带的数据库 REST API
 * （PostgREST，路径 /v1/rdb/rest/*、/v1/rdb/rpc/*），服务端身份用
 * 平台签发的 API Key。Node 18+ 自带 fetch，本函数零外部依赖，
 * 上传 zip 时不需要安装任何依赖。
 *
 * —— 部署（详见 cloud/DEPLOY.md）——
 * 1. 先在控制台的 SQL 编辑器里执行一次 cloud/init.sql
 *    （建 3 张表 + 1 个 upsert 函数，本函数第一次被调用前必须执行）。
 * 2. 给云函数配 3 个环境变量：
 *      ENV_ID      ← 环境 ID（控制台概览页能抄到，形如 xxx-1a2b3c）
 *      API_KEY     ← 控制台「API Key / 密钥管理」里那把 service_role Key（一整串）
 *      ACCESS_KEY  ← 你自己编一串（工作台「云端配置」里要填同一个，可留空=不校验）
 * 3. 给云函数开 HTTP 访问路径（如 /api），把整条访问地址填进工作台。
 *
 * 请求格式（工作台前端自动发，前端无需改动）：
 *   POST { fn: 'auth', action: 'register'|'login', user, pass }
 *   POST { fn: 'sync', action: 'pull', token }
 *   POST { fn: 'sync', action: 'push', token, ops: [{op:'put'|'del', cat, rid, obj, ts}] }
 */

const crypto = require('crypto');

const ENV_ID = process.env.ENV_ID || '';
const API_KEY = process.env.API_KEY || '';
const AK = process.env.ACCESS_KEY || '';

const BASE = ENV_ID ? `https://${ENV_ID}.api.tcloudbasegateway.com` : '';

// ---------- 平台数据库 REST 封装 ----------
async function rest(path, opts = {}) {
  const url = BASE + path;
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: {
      Authorization: 'Bearer ' + API_KEY,
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
  });
  let data = null;
  const text = await res.text().catch(() => '');
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!res.ok) {
    const msg = (data && (data.message || data.error || data.details)) || ('HTTP ' + res.status);
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data;
}

// 查多行
async function rows(table, filterQs) {
  const r = await rest(`/v1/rdb/rest/${table}?select=*&${filterQs}`);
  return Array.isArray(r) ? r : [];
}
// 插入单行
async function insert(table, obj) {
  return rest(`/v1/rdb/rest/${table}`, { method: 'POST', body: obj });
}
// 调函数（做"只有时间戳更新的才覆盖"的合并）
async function rpc(fn, args) {
  return rest(`/v1/rdb/rpc/${fn}`, { method: 'POST', body: args });
}
// 删除
async function remove(table, filterQs) {
  return rest(`/v1/rdb/rest/${table}?${filterQs}`, { method: 'DELETE' });
}

function hash(salt, pass) {
  return crypto.createHash('sha256').update(salt + '::' + pass).digest('hex');
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
const eq = (v) => encodeURIComponent(v);

// ---------- auth ----------
async function doAuth(p) {
  const action = p.action;
  const user = String(p.user || '').trim();
  const pass = String(p.pass || '');

  if (action === 'register') {
    if (user.length < 2) return { err: '用户名至少 2 个字符' };
    if (pass.length < 4) return { err: '密码至少 4 位' };
    const ex = await rows('ip_users', `username=eq.${eq(user)}`);
    if (ex.length) return { err: '该用户名已被注册' };
    const salt = crypto.randomBytes(6).toString('hex');
    await insert('ip_users', { username: user, salt, hash: hash(salt, pass), created: Date.now() });
    return issueToken(user);
  }

  if (action === 'login') {
    const r = await rows('ip_users', `username=eq.${eq(user)}`);
    const row = r[0];
    if (!row || row.hash !== hash(row.salt, pass)) return { err: '用户名或密码不对' };
    return issueToken(user);
  }

  // 邮箱验证码：验证码暂存 ip_recs（user_id='__codes'），未接邮件服务前回显
  if (action === 'sendcode') {
    const email = String(p.email || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return { err: '邮箱格式不对' };
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await rpc('upsert_rec', {
      p_uid: '__codes',
      p_rid: 'code:' + email,
      p_cat: 'code',
      p_obj: { code, exp: Date.now() + 10 * 60 * 1000 },
      p_updatedat: Date.now(),
      p_deleted: false
    });
    // TODO: 接入邮件服务后，把 code 真正发到邮箱，并去掉 demo 回显
    return { ok: true, email, demo: code, note: '云函数还没接邮件服务，验证码暂回显；接入后自动变为真发。' };
  }

  if (action === 'logincode') {
    const email = String(p.email || '').trim();
    const code = String(p.code || '').trim();
    const r = await rows('ip_recs', `uid=eq.__codes&rid=eq.code:${eq(email)}`);
    const rec = r && r[0];
    const obj = rec && rec.obj;
    if (!obj || (obj.exp || 0) < Date.now()) return { err: '验证码已过期，请重新获取' };
    if (String(obj.code) !== code) return { err: '验证码不对' };
    const ex = await rows('ip_users', `username=eq.${eq(email)}`);
    if (!ex.length) {
      const salt = crypto.randomBytes(6).toString('hex');
      await insert('ip_users', { username: email, salt, hash: hash(salt, crypto.randomBytes(12).toString('hex')), created: Date.now() });
    }
    return issueToken(email);
  }

  return { err: '未知 auth action：' + action };
}

async function issueToken(user) {
  const token = crypto.randomBytes(24).toString('hex');
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 天
  await insert('ip_tokens', { token, username: user, exp });
  remove('ip_tokens', `exp=lt.${Date.now()}`).catch(() => {}); // 顺手清理过期 token
  return { ok: true, user, token, serverTime: Date.now() };
}

async function tokenUser(token) {
  if (!token) return null;
  const r = await rows('ip_tokens', `token=eq.${eq(token)}`);
  const t = r[0];
  if (!t || Number(t.exp) < Date.now()) return null;
  return t.username;
}

// ---------- sync ----------
async function doSync(p) {
  const action = p.action;
  const user = await tokenUser(p.token);
  if (!user) return { err: '会话失效，请重新登录' };

  if (action === 'pull') {
    const recs = await rows('ip_recs', `uid=eq.${eq(user)}`);
    return {
      ok: true, user,
      recs: recs.map(row => ({
        rid: row.rid,
        cat: row.cat || '',
        obj: row.deleted ? null : row.obj,
        updatedAt: Number(row.updatedat) || 0,
        deleted: !!row.deleted
      })),
      serverTime: Date.now()
    };
  }

  if (action === 'push') {
    const ops = Array.isArray(p.ops) ? p.ops : [];
    for (const op of ops) {
      if (!op || !op.rid) continue;
      const isDel = op.op === 'del';
      // LWW 合并逻辑在数据库函数 upsert_rec 里（只在时间戳更新时覆盖）
      await rpc('upsert_rec', {
        p_uid: user,
        p_rid: String(op.rid),
        p_cat: String(op.cat || ''),
        p_obj: isDel ? null : (op.obj || null),
        p_updatedat: Number(op.ts) || Date.now(),
        p_deleted: !!isDel
      });
    }
    return { ok: true, serverTime: Date.now() };
  }

  return { err: '未知 sync action：' + action };
}

// ---------- 入口 ----------
exports.main = async (event) => {
  try {
    if (!ENV_ID || !API_KEY) {
      return { err: '云函数缺少环境变量：请在函数配置里设置 ENV_ID（环境 ID）和 API_KEY（平台 API Key）' };
    }

    let p = event && event.body !== undefined ? event.body : event;
    if (typeof p === 'string') {
      try { p = JSON.parse(p); } catch (e) { p = {}; }
    }
    if (!p || typeof p !== 'object') p = {};

    // 共享密钥校验（工作台「云端配置」的访问密钥；未设 ACCESS_KEY 时跳过）
    if (AK) {
      const hs = (event && event.headers) || {};
      const got = p.secret || hs['x-tcb-secret'] || hs['X-TCB-Secret'] || '';
      if (got !== AK) return { err: '密钥不对：检查工作台「云端配置」里的访问密钥是否与云函数环境变量 ACCESS_KEY 一致' };
    }

    if (p.fn === 'auth') return await doAuth(p);
    if (p.fn === 'sync') return await doSync(p);
    return { err: '缺少 fn 参数（应为 auth 或 sync）' };
  } catch (e) {
    const m = (e && e.message) || String(e);
    // 常见问题给个中文提示
    if (/ip_users|ip_tokens|ip_recs|upsert_rec|does not exist|relation/i.test(m)) {
      return { err: '数据库还没准备好：请在控制台的 SQL 编辑器里执行一次 cloud/init.sql（见部署文档第 2 步）' };
    }
    if (/401|unauthorized|invalid api key/i.test(m)) {
      return { err: 'API_KEY 不对：检查云函数环境变量 API_KEY 是否与控制台里的 Key 完全一致（别带多余空格）' };
    }
    return { err: '云函数出错：' + m };
  }
};
