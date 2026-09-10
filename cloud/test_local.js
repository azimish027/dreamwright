/* 云函数本地逻辑测试：用内存假 pg 跑通 register/login/push/pull 全流程 */
const fs = require('fs');
const path = require('path');

// ---- 假 pg：只处理本函数用到的固定 SQL 模板 ----
const TABLES = {
  ip_users: [], ip_tokens: [], ip_recs: []
};
function rows(sql, params) {
  const p = params || [];
  // CREATE TABLE / INDEX
  if (/CREATE (TABLE|INDEX)/.test(sql)) return { rows: [] };
  // INSERT users
  let m = sql.match(/INSERT INTO ip_users \(username, salt, hash, created\) VALUES \(\$1,\$2,\$3,\$4\)/);
  if (m) { TABLES.ip_users.push({ username: p[0], salt: p[1], hash: p[2], created: p[3] }); return { rows: [] }; }
  // SELECT user
  m = sql.match(/SELECT username FROM ip_users WHERE username = \$1/);
  if (m) return { rows: TABLES.ip_users.filter(r => r.username === p[0]) };
  m = sql.match(/SELECT salt, hash FROM ip_users WHERE username = \$1/);
  if (m) { const r = TABLES.ip_users.find(r => r.username === p[0]); return { rows: r ? [{ salt: r.salt, hash: r.hash }] : [] }; }
  // tokens
  m = sql.match(/INSERT INTO ip_tokens \(token, username, exp\) VALUES \(\$1,\$2,\$3\)/);
  if (m) { TABLES.ip_tokens.push({ token: p[0], username: p[1], exp: Number(p[2]) }); return { rows: [] }; }
  m = sql.match(/SELECT username, exp FROM ip_tokens WHERE token = \$1/);
  if (m) { const r = TABLES.ip_tokens.find(r => r.token === p[0]); return { rows: r ? [{ username: r.username, exp: r.exp }] : [] }; }
  m = sql.match(/DELETE FROM ip_tokens WHERE exp < \$1/);
  if (m) { TABLES.ip_tokens = TABLES.ip_tokens.filter(r => r.exp >= Number(p[0])); return { rows: [] }; }
  // recs upsert
  m = sql.match(/INSERT INTO ip_recs \(uid, rid, cat, obj, updatedat, deleted\)/);
  if (m && /DO UPDATE SET[\s\S]*cat = EXCLUDED.cat, obj = EXCLUDED.obj/.test(sql)) {
    const idx = TABLES.ip_recs.findIndex(r => r.uid === p[0] && r.rid === p[1]);
    if (idx >= 0) { if (TABLES.ip_recs[idx].updatedat < Number(p[4])) { TABLES.ip_recs[idx] = { uid: p[0], rid: p[1], cat: p[2], obj: JSON.parse(p[3]), updatedat: Number(p[4]), deleted: false }; } }
    else TABLES.ip_recs.push({ uid: p[0], rid: p[1], cat: p[2], obj: JSON.parse(p[3]), updatedat: Number(p[4]), deleted: false });
    return { rows: [] };
  }
  m = sql.match(/INSERT INTO ip_recs \(uid, rid, cat, obj, updatedat, deleted\)/);
  if (m) {
    const idx = TABLES.ip_recs.findIndex(r => r.uid === p[0] && r.rid === p[1]);
    if (idx >= 0) { if (TABLES.ip_recs[idx].updatedat < Number(p[3])) { TABLES.ip_recs[idx] = { uid: p[0], rid: p[1], cat: p[2], obj: null, updatedat: Number(p[3]), deleted: true }; } }
    else TABLES.ip_recs.push({ uid: p[0], rid: p[1], cat: p[2], obj: null, updatedat: Number(p[3]), deleted: true });
    return { rows: [] };
  }
  m = sql.match(/SELECT rid, cat, obj, updatedat, deleted FROM ip_recs WHERE uid = \$1/);
  if (m) return { rows: TABLES.ip_recs.filter(r => r.uid === p[0]).map(r => ({ rid: r.rid, cat: r.cat, obj: r.obj, updatedat: r.updatedat, deleted: r.deleted })) };
  throw new Error('未匹配 SQL: ' + sql);
}
const FakePool = class { constructor() {} query(sql, params) { return Promise.resolve(rows(sql, params)); } };

// ---- 装载云函数（替换 pg 依赖）----
const srcDir = path.join(__dirname, 'ipstudio');
const origCode = fs.readFileSync(path.join(srcDir, 'index.js'), 'utf8');
// 用 loader 让 require('pg') 返回假池
const Module = require('module');
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'pg') return { Pool: FakePool };
  return origLoad.apply(this, arguments);
};
process.env.PGHOST = 'fake'; process.env.PGPORT = '5432'; process.env.PGDATABASE = 'postgres';
process.env.PGUSER = 'u'; process.env.PGPASSWORD = 'p'; process.env.ACCESS_KEY = 'test-key';
delete require.cache[require.resolve(path.join(srcDir, 'index.js'))];
const fn = require(path.join(srcDir, 'index.js')).main;

function assert(cond, msg) { if (!cond) { console.error('FAIL: ' + msg); process.exit(1); } console.log('ok - ' + msg); }

(async () => {
  // 密钥错误
  let r = await fn({ body: JSON.stringify({ fn: 'auth', action: 'register', user: 'ab', pass: '1234' }) });
  assert(r.err && r.err.indexOf('密钥') >= 0, '密钥不对时拒绝');

  const call = (body) => fn({ body: JSON.stringify(Object.assign({ secret: 'test-key' }, body)) });

  // 注册
  let token;
  r = await call({ fn: 'auth', action: 'register', user: 'writer01', pass: 'pass1234' });
  assert(r.ok && r.user === 'writer01' && r.token, '注册成功并拿到 token');
  // 重复注册
  r = await call({ fn: 'auth', action: 'register', user: 'writer01', pass: 'pass1234' });
  assert(r.err === '该用户名已被注册', '重复注册被拒');
  // 登录拿有效 token
  r = await call({ fn: 'auth', action: 'login', user: 'writer01', pass: 'pass1234' });
  assert(r.ok && r.user === 'writer01', '登录成功');
  token = r.token;
  r = await call({ fn: 'auth', action: 'login', user: 'writer01', pass: 'wrong' });
  assert(r.err === '用户名或密码不对', '错误密码被拒');

  // push：put 一条 + del 一条
  r = await call({ fn: 'sync', action: 'push', token, ops: [
    { op: 'put', cat: 'pages', rid: 'pg1', obj: { id: 'pg1', name: '测试页', segments: ['hi'] }, ts: 1000 },
    { op: 'del', cat: 'pages', rid: 'pg2', ts: 1000 }
  ]});
  assert(r.ok, 'push 成功');

  // pull：应该看到 pg1 活着 + pg2 墓碑
  r = await call({ fn: 'sync', action: 'pull', token });
  assert(r.ok && Array.isArray(r.recs), 'pull 成功');
  const pg1 = r.recs.find(x => x.rid === 'pg1');
  const pg2 = r.recs.find(x => x.rid === 'pg2');
  assert(pg1 && !pg1.deleted && pg1.obj.name === '测试页', 'pg1 拉取为存活数据');
  assert(pg2 && pg2.deleted && pg2.obj === null, 'pg2 拉取为墓碑');

  // 时间戳回退不覆盖（LWW）：旧 ts put 不应覆盖新数据
  r = await call({ fn: 'sync', action: 'push', token, ops: [
    { op: 'put', cat: 'pages', rid: 'pg1', obj: { id: 'pg1', name: '旧数据' }, ts: 500 }
  ]});
  r = await call({ fn: 'sync', action: 'pull', token });
  const pg1b = r.recs.find(x => x.rid === 'pg1');
  assert(pg1b.obj.name === '测试页', '旧时间戳写入被忽略（LWW 正确）');

  // 无效 token
  r = await call({ fn: 'sync', action: 'pull', token: 'nope' });
  assert(r.err && r.err.indexOf('会话失效') >= 0, '无效 token 被拒');

  // 缺 fn
  r = await call({ action: 'pull' });
  assert(r.err && r.err.indexOf('fn') >= 0, '缺 fn 报错提示');
  // 未知 action
  r = await call({ fn: 'auth', action: 'hack' });
  assert(r.err, '未知 action 报错');

  console.log('\n全部通过：云函数逻辑（假库模拟）OK');
  process.exit(0);
})().catch(e => { console.error('EXCEPTION', e); process.exit(1); });
