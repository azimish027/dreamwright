/* notice.js —— 产品内消息中心（本地规则生成 + 系统推送，不动数据模型） */
const IPNotice = (function () {
  const READ_KEY = 'ipStudioP2:msgs';
  const PUSH_KEY = 'ipStudioP2:pushed';
  const BACKUP_KEY = 'ipStudioP2:lastBackup';

  function jget(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }

  function readMap() { return jget(READ_KEY, {}); }
  function pushed() { return jget(PUSH_KEY, []); }

  // ---------- 推送一条系统消息（持久） ----------
  function push(m) {
    if (!m || !m.id) return;
    const arr = pushed();
    if (arr.some(x => x.id === m.id)) return;
    arr.unshift(Object.assign({ type: 'sys', at: Date.now() }, m));
    jset(PUSH_KEY, arr.slice(0, 30));
  }

  // ---------- 本地规则生成的提醒 ----------
  function rules() {
    const out = [];
    try {
      const today = IP2.todayStr();
      let total = 0, done = 0;
      IP2.projects().forEach(p => {
        IP2.goalsOf(p.id).forEach(g => {
          total++;
          const l = IP2.logOf(g.id, today);
          if (l && Number(l.value) > 0) done++;
        });
      });
      if (total > 0 && done < total) {
        out.push({
          id: 'todo-checkin-' + today, type: 'todo', at: Date.now(),
          title: '今天还有 ' + (total - done) + ' 个目标没打卡',
          body: '去「今日」把该做的勾上，连续天数才不会断。',
          action: 'goto:today'
        });
      }

      const last = Number(localStorage.getItem(BACKUP_KEY) || 0);
      const days = last ? Math.floor((Date.now() - last) / 86400000) : -1;
      if (days === -1 || days >= 7) {
        out.push({
          id: 'todo-backup', type: days >= 30 ? 'warn' : 'todo', at: Date.now(),
          title: days === -1 ? '还没备份过' : ('已 ' + days + ' 天没备份了'),
          body: '数据存在浏览器里，清缓存会丢。「数据」页一键导出成文件带走。',
          action: 'goto:data'
        });
      }

      const idle = [];
      IP2.projects().forEach(p => {
        if (!p.updated) return;
        const d = Math.floor((Date.now() - p.updated) / 86400000);
        if (d >= 14) idle.push({ p: p, d: d });
      });
      idle.sort((a, b) => b.d - a.d).slice(0, 3).forEach(x => {
        out.push({
          id: 'idle-' + x.p.id, type: 'todo', at: x.p.updated,
          title: '「' + x.p.name + '」已经 ' + x.d + ' 天没动了',
          body: '要不要回来添一笔？哪怕只是记一条灵感。',
          action: 'project:' + x.p.id
        });
      });

      if (!IPAuth.user()) {
        out.push({
          id: 'no-login', type: 'sys', at: 0,
          title: '登录后可多端同步',
          body: '现在数据只在这台设备。接上云端后，电脑 / 平板 / 手机自动同步。',
          action: 'login'
        });
      }
    } catch (e) { }
    return out;
  }

  function all() {
    const arr = pushed().concat(rules());
    const rm = readMap();
    return arr.map(m => Object.assign({}, m, { unread: !rm[m.id] }));
  }

  function unreadCount() { return all().filter(m => m.unread).length; }

  function markAll() {
    const rm = readMap();
    all().forEach(m => { rm[m.id] = 1; });
    jset(READ_KEY, rm);
    refresh();
  }

  function refresh() {
    const dot = document.getElementById('noticedot');
    if (!dot) return;
    const n = unreadCount();
    dot.style.display = n > 0 ? 'block' : 'none';
    dot.textContent = n > 9 ? '9+' : String(n);
    const btn = document.getElementById('noticebtn');
    if (btn) btn.title = n > 0 ? ('消息中心 · ' + n + ' 条未读') : '消息中心';
  }

  // ---------- 面板 ----------
  function panel(anchor) {
    const old = document.getElementById('noticedlg');
    if (old) { old.remove(); return; }
    const list = all().sort((a, b) => (Number(b.unread) - Number(a.unread)) || ((b.at || 0) - (a.at || 0)));
    const m = document.createElement('div');
    m.className = 'notipanel';
    m.id = 'noticedlg';
    const r = anchor.getBoundingClientRect();
    m.style.cssText = 'position:fixed;top:' + (r.bottom + 8) + 'px;right:' + Math.max(12, window.innerWidth - r.right) + 'px;z-index:220';

    const ICO = {
      todo: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>',
      warn: '<svg viewBox="0 0 24 24"><path d="M12 4.5L21 20H3z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.4" r=".9" fill="currentColor" stroke="none"/></svg>',
      sys: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v.6"/><path d="M12 11.5v5"/></svg>'
    };

    const rows = list.length ? list.map(x =>
      '<div class="nti' + (x.unread ? ' unread' : '') + '" data-act="' + (x.action || '') + '" data-id="' + x.id + '">' +
      '<span class="nti-ic ' + x.type + '"><span class="icon-svg">' + (ICO[x.type] || ICO.sys) + '</span></span>' +
      '<div class="nti-b"><b>' + esc(x.title) + '</b><span>' + esc(x.body || '') + '</span></div>' +
      (x.action ? '<span class="nti-go">›</span>' : '') +
      '</div>').join('')
      : '<div class="nti-empty">暂时没有新消息<div>打卡、备份、搁置的企划会在这里提醒你</div></div>';

    m.innerHTML =
      '<div class="nti-hd"><b>消息中心</b><button id="nti_read">全部已读</button></div>' +
      '<div class="nti-list">' + rows + '</div>';
    document.body.appendChild(m);

    document.getElementById('nti_read').addEventListener('click', () => { markAll(); });
    m.querySelectorAll('.nti[data-act]').forEach(el2 => {
      el2.addEventListener('click', () => {
        const rm = readMap(); rm[el2.dataset.id] = 1; jset(READ_KEY, rm);
        doAction(el2.dataset.act);
        m.remove(); refresh();
      });
    });
    setTimeout(() => document.addEventListener('mousedown', function h(e) {
      if (!m.contains(e.target) && e.target.id !== 'noticebtn' && !document.getElementById('noticebtn').contains(e.target)) {
        m.remove(); document.removeEventListener('mousedown', h);
      }
    }), 0);
  }

  function doAction(a) {
    if (!a) return;
    if (a.indexOf('goto:') === 0) { IPApp.go(a.slice(5)); return; }
    if (a.indexOf('project:') === 0) { IPApp.go('project', a.slice(8)); return; }
    if (a === 'login') { IPApp.renderAccount(); document.getElementById('acc_login') && document.getElementById('acc_login').click(); return; }
    if (a === 'changelog') { IPOnboard.changelog(); return; }
    if (a === 'tour') { IPOnboard.start(); return; }
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }

  // ---------- 陪伴式问候：梦梦像陪在身边一样 ----------
  // 每天最多一条；按「距上次来访天数 + 现在时段」挑一句，弹出小演出
  function companion() {
    try {
      const now = Date.now();
      const last = Number(localStorage.getItem('ipStudioP2:lastvisit') || 0);
      localStorage.setItem('ipStudioP2:lastvisit', String(now));
      if (!last) return; // 第一次见面：欢迎屏负责打招呼
      const days = Math.floor((now - last) / 86400000);
      const today = new Date().toDateString();
      if (localStorage.getItem('ipStudioP2:greeted') === today) return;
      localStorage.setItem('ipStudioP2:greeted', today);
      const h = new Date().getHours();
      let title, body, biu;
      if (days >= 14) {
        title = '好久不见！'; biu = 'heart';
        body = '整整 ' + days + ' 天没见，你的世界梦梦一直替你看着呢。回来先去「今日」逛逛？';
      } else if (days >= 3) {
        title = '欢迎回来～'; biu = 'jump';
        body = days + ' 天没见啦，梦梦每天都在等你。灵感不会跑掉，随时接着写。';
      } else if (h >= 0 && h < 5) {
        title = '还没睡呀？'; biu = 'think';
        body = '深夜赶稿辛苦了。记得保存进度，写完这一段就去休息，好吗？';
      } else if (h >= 5 && h < 11) {
        title = '早上好！'; biu = 'jump';
        body = '新的一天最适合写开头。今天的目标在「今日」等你打卡～';
      } else if (h >= 11 && h < 14) {
        title = '中午好～'; biu = 'heart';
        body = '写累了就歇会儿，灵感总在放空的时候冒出来。';
      } else if (h >= 22) {
        title = '夜深了'; biu = 'heart';
        body = '夜里创作记得护眼。别熬太晚，梦梦陪你到睡前最后一行。';
      } else {
        title = '欢迎回来～'; biu = 'jump';
        body = '继续构筑你的世界吧，有需要随时叫梦梦。';
      }
      push({ id: 'greet-' + today, type: 'sys', at: now, title: title, body: body, action: '' });
      refresh();
      setTimeout(() => { if (window.IPUI) IPUI.burst(biu, title); }, 900);
    } catch (e) { }
  }

  return { refresh, panel, push, unreadCount, markAll, companion };
})();
