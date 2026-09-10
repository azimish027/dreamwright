/* cloudbase.js —— 真实云端后端（CloudBase JS SDK v2，匿名登录 + 云数据库同步 + 服务端 AI 额度）
 * 设计原则：所有调用都做优雅降级。若 SDK 加载失败 / 离线 / 未初始化，available() 返回 false，
 * 上层 auth / sync / ai 会自动回落到本地演示模式，绝不抛错中断界面。
 */
const IPCloud = (function () {
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@cloudbase/js-sdk@2.32.0/+esm';
  const COLL_DATA = 'ipstudio_data';     // {_cat,_rid,_uid,_deleted,_ts, ...obj}
  const COLL_QUOTA = 'ipstudio_quota';   // {_uid, date, count}

  let tcb = null;          // SDK 的 init 函数（default export）
  let app = null;
  let db = null;
  let authInst = null;
  let envId = '';
  let uid = '';

  let ready = false;       // SDK 已初始化可调用
  let failed = false;      // SDK 加载彻底失败
  let sdkErr = '';        // 最近一次错误说明

  // ---- SDK 加载：优先用已注入的全局，否则动态 import ESM（jsdelivr +esm 能在浏览器跑）----
  function loadSdk() {
    return new Promise((resolve) => {
      if (tcb) return resolve(true);
      if (typeof window !== 'undefined' && (window.cloudbase || window.tcb)) {
        tcb = window.cloudbase || window.tcb;
        return resolve(true);
      }
      // 轮询 6s，等待可能的异步脚本注入
      let waited = 0;
      const poll = setInterval(() => {
        if (typeof window !== 'undefined' && (window.cloudbase || window.tcb)) {
          clearInterval(poll); tcb = window.cloudbase || window.tcb; return resolve(true);
        }
        waited += 200;
        if (waited >= 6000) {
          clearInterval(poll);
          // 最后尝试 import()
          import(SDK_URL).then(mod => {
            tcb = mod.default || mod.tcb || (mod && mod.cloudbase) || null;
            if (tcb) resolve(true); else { failed = true; resolve(false); }
          }).catch(e => { failed = true; sdkErr = (e && e.message) || String(e); resolve(false); });
        }
      }, 200);
    });
  }

  async function init(id) {
    envId = (id || '').trim();
    if (!envId) { failed = true; sdkErr = '环境 ID 为空'; return false; }
    const ok = await loadSdk();
    if (!ok || !tcb) { failed = true; sdkErr = sdkErr || 'CloudBase SDK 未加载'; return false; }
    try {
      app = tcb.init({ env: envId });
      db = app.database();
      ready = true; failed = false; sdkErr = '';
      return true;
    } catch (e) {
      failed = true; sdkErr = (e && e.message) || String(e);
      return false;
    }
  }

  function auth() {
    if (!app) throw new Error('未初始化');
    if (!authInst) authInst = app.auth({ persistence: 'local' });
    return authInst;
  }

  async function anonLogin() {
    if (!ready) throw new Error('CloudBase 未初始化');
    const a = auth();
    await a.signInAnonymously();
    let u = null;
    try { u = await a.getUser(); } catch (e) {}
    if (!u && a.currentUser) u = a.currentUser;
    if (!u || !u.uid) throw new Error('无法获取匿名 uid');
    uid = u.uid;
    return uid;
  }

  function getUid() { return uid; }
  function setUid(v) { uid = v || ''; }

  function stripMeta(d) {
    const o = {};
    Object.keys(d).forEach(k => { if (k[0] !== '_') o[k] = d[k]; });
    return o;
  }

  // 写入一条记录（upsert）。obj 为业务对象（含 id）；deleted=true 为软删
  async function dataPut(cat, rid, obj, deleted) {
    if (!ready) throw new Error('未初始化');
    const docId = cat + ':' + rid;
    const payload = Object.assign({}, obj, {
      _cat: cat, _rid: rid, _uid: uid, _deleted: !!deleted, _ts: Date.now()
    });
    await db.collection(COLL_DATA).doc(docId).set(payload);
    return { ok: true };
  }

  async function dataDelete(cat, rid) {
    return dataPut(cat, rid, { id: rid }, true);
  }

  // 拉取当前用户全部数据
  async function dataPull() {
    if (!ready) throw new Error('未初始化');
    const res = await db.collection(COLL_DATA).where({ _uid: uid }).get();
    const arr = (res && res.data) || [];
    return arr.map(d => ({ cat: d._cat, rid: d._rid, obj: stripMeta(d), deleted: !!d._deleted }));
  }

  async function quotaGet(date) {
    if (!ready) return null;
    const docId = uid + ':' + date;
    const res = await db.collection(COLL_QUOTA).doc(docId).get();
    const d = (res && res.data && res.data[0]) || null;
    return d ? (typeof d.count === 'number' ? d.count : 0) : null;
  }

  async function quotaSet(date, count) {
    if (!ready) return null;
    const docId = uid + ':' + date;
    await db.collection(COLL_QUOTA).doc(docId).set({ _uid: uid, date: date, count: count });
    return count;
  }

  async function signOut() {
    try { if (authInst) await authInst.signOut(); } catch (e) {}
    uid = '';
  }

  function available() { return ready && !failed && !!tcb; }
  function sdkAvailable() { return !!tcb && !failed; }
  function readyState() {
    return { ready, failed, sdkErr, envId, uid, available: available() };
  }

  return {
    init, anonLogin, getUid, setUid,
    dataPut, dataDelete, dataPull,
    quotaGet, quotaSet, signOut,
    available, sdkAvailable, readyState
  };
})();
if (typeof window !== 'undefined') window.IPCloud = IPCloud;
