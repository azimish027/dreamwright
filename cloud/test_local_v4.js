/* v4 云函数本地逻辑测试：拦截 fetch 模拟平台 PostgREST 数据库 */
const path = require('path');

process.env.ENV_ID = 'testenv';
process.env.API_KEY = 'test-api-key';
process.env.ACCESS_KEY = 'ak-9527';

// ---------- 假数据库 ----------
const DB = {
  ip_users: new Map(),   // username -> row
  ip_tokens: new Map(),  // token -> row
  ip_recs: new Map()     // "uid|rid" -> row
};

function fakeFetch(url, opts = {}) {
  const u = new URL(url);
  const method = opts.method || 'GET';
  const body = opts.body ? JSON.parse(opts.body) : null;
  const auth = (opts.headers || {}).Authorization || '';
  if (auth !== 'Bearer test-api-key') {
    return Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve('{"message":"invalid api key"}') });
  }
  const seg = u.pathname.split('/'); // ['', 'v1','rdb','rest'|'rpc', table|fn]
  const kind = seg[2] === 'rdb' ? seg[3] : null; // rest | rpc
  const name = seg[4] || '';
  const qs = {};
  u.searchParams.forEach((v, k) => { qs[k] = v; });
  const valOf = (k) => { const v = qs[k]; if (typeof v === 'string' && v.startsWith('eq.')) return decodeURIComponent(v.slice(3)); return undefined; };
  const ltOf = (k) => { const v = qs[k]; if (typeof v === 'string' && v.startsWith('lt.')) return Number(v.slice(3)); return undefined; };

  const reply = (obj, status = 200) => Promise.resolve({
    ok: status < 400, status,
    text: () => Promise.resolve(JSON.stringify(obj))
  });

  try {
    if (kind === 'rest') {
      if (name === 'ip_users') {
        if (method === 'GET') {
          const v = valOf('username');
          const all = [...DB.ip_users.values()].filter(r => v === undefined || r.username === v);
          return reply(all);
        }
        if (method === 'POST') {
          DB.ip_users.set(body.username, { ...body });
          return reply([]);
        }
      }
      if (name === 'ip_tokens') {
        if (method === 'GET') {
          const v = valOf('token');
          const all = [...DB.ip_tokens.values()].filter(r => v === undefined || r.token === v);
          return reply(all);
        }
        if (method === 'POST') { DB.ip_tokens.set(body.token, { ...body }); return reply([]); }
        if (method === 'DELETE') {
          const t = ltOf('exp');
          if (t !== undefined) for (const [k, r] of DB.ip_tokens) if (Number(r.exp) < t) DB.ip_tokens.delete(k);
          return reply([]);
        }
      }
      if (name === 'ip_recs') {
        if (method === 'GET') {
          const v = valOf('uid');
          const all = [...DB.ip_recs.values()].filter(r => v === undefined || r.uid === v);
          return reply(all);
        }
      }
    }
    if (kind === 'rpc' && name === 'upsert_rec') {
      const k = body.p_uid + '|' + body.p_rid;
      const old = DB.ip_recs.get(k);
      if (!old || Number(old.updatedat) < Number(body.p_updatedat)) {
        DB.ip_recs.set(k, {
          uid: body.p_uid, rid: body.p_rid, cat: body.p_cat,
          obj: body.p_obj, updatedat: Number(body.p_updatedat), deleted: !!body.p_deleted
        });
      }
      return reply({});
    }
  } catch (e) { return reply({ message: String(e) }, 500); }
  return reply({ message: 'no mock for ' + url }, 404);
}

global.fetch = fakeFetch;

// ---------- 跑测试 ----------
const fn = require('./ipstudio/index.js');
const call = (payload) => fn.main({ body: JSON.stringify({ secret: 'ak-9527', ...payload }), headers: {} });

let pass = 0, fail = 0;
function assert(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  ← ' + JSON.stringify(extra) : '')); }
}

(async () => {
  console.log('=== 密钥校验 ===');
  let r = await call({ fn: 'auth', action: 'register', user: 'w1', pass: 'p1234', secret: 'wrong' });
  assert('密钥错被拒', r.err && r.err.indexOf('密钥不对') >= 0, r);

  console.log('=== 注册 / 登录 ===');
  r = await call({ fn: 'auth', action: 'register', user: 'writer01', pass: 'pass1234' });
  assert('注册成功拿 token', r.ok && r.user === 'writer01' && !!r.token, r);
  const token = r.token;

  r = await call({ fn: 'auth', action: 'register', user: 'writer01', pass: 'pass1234' });
  assert('重复注册被拒', r.err === '该用户名已被注册', r);

  r = await call({ fn: 'auth', action: 'login', user: 'writer01', pass: 'wrong!!' });
  assert('错密码登录被拒', r.err === '用户名或密码不对', r);

  r = await call({ fn: 'auth', action: 'login', user: 'writer01', pass: 'pass1234' });
  assert('正确登录成功', r.ok && r.user === 'writer01' && !!r.token, r);

  console.log('=== 推送 / 拉取 ===');
  r = await call({ fn: 'sync', action: 'push', token, ops: [
    { op: 'put', cat: 'pages', rid: 'p1', obj: { id: 'p1', name: '章一' }, ts: 1000 },
    { op: 'put', cat: 'notes', rid: 'n1', obj: { id: 'n1', text: '笔记' }, ts: 2000 },
    { op: 'del', cat: 'pages', rid: 'pOld', obj: null, ts: 3000 }
  ]});
  assert('批量推送成功', r.ok, r);

  r = await call({ fn: 'sync', action: 'pull', token });
  assert('拉回 2 活 1 墓碑', r.ok && r.recs.length === 3, r.recs && r.recs.length);
  const live = r.recs.filter(x => !x.deleted);
  const dead = r.recs.filter(x => x.deleted);
  assert('活数据 obj 完整', live.length === 2 && live.find(x => x.rid === 'p1').obj.name === '章一');
  assert('墓碑正确标记', dead.length === 1 && dead[0].rid === 'pOld' && dead[0].obj === null);

  console.log('=== 多设备防覆盖（LWW） ===');
  // 设备 B 更旧的时间戳想覆盖设备 A 的新数据 → 应被忽略
  r = await call({ fn: 'sync', action: 'push', token, ops: [
    { op: 'put', cat: 'pages', rid: 'p1', obj: { id: 'p1', name: '旧内容' }, ts: 500 }
  ]});
  assert('旧时间戳不覆盖', r.ok);
  r = await call({ fn: 'sync', action: 'pull', token });
  const p1 = r.recs.find(x => x.rid === 'p1');
  assert('保留较新内容', p1.obj.name === '章一', p1 && p1.obj);

  console.log('=== 异常路径 ===');
  r = await call({ fn: 'sync', action: 'pull', token: 'bad-token' });
  assert('无效 token 被拒', r.err === '会话失效，请重新登录', r);

  r = await call({ fn: 'whatever', action: 'x' });
  assert('缺 fn 报错', r.err && r.err.indexOf('fn') >= 0, r);

  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试崩溃', e); process.exit(1); });
