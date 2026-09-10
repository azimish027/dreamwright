/* main.js —— 启动：界面立即起来；真实云端（CloudBase）在后台异步初始化，连上后自动接管匿名会话 */
(function () {
  function boot2() {
    IP2.load();
    if (window.IPVN) IPVN.fab();   // v13 右下角控制条（标题画面时由 CSS 隐藏）
    const s = IP2.get();
    const fresh = !(s.projects && s.projects.length) && !(s.pages && s.pages.length);

    if (fresh) {
      let welcomed = false;
      try { welcomed = localStorage.getItem('ipStudioP2:welcome') === '1'; } catch (e) {}
      if (!welcomed) {
        try { localStorage.setItem('ipStudioP2:welcome', '1'); } catch (e) {}
        window.IPApp.init();
        window.IPApp.showWelcome();
        IPSync.boot();
        return;
      }
      // 看过欢迎屏且还没有任何内容：直接进「企划」页的空状态（那里有新建引导）
      window.IPApp.init();
      window.IPApp.go('projects');
      IPSync.boot();
      if (window.IPNotice) IPNotice.companion();
      return;
    }

    window.IPApp.init();
    IPSync.boot();
    if (window.IPNotice) IPNotice.companion();
  }

  function safeBoot() {
    try { boot2(); } catch (e) { console.error('[boot] error', e); }
  }

  // 界面立刻起来（不阻塞等待云端），保证任何网络情况下都能用
  safeBoot();

  // 后台初始化真实云端：连上后，若已是匿名会话则自动恢复云端 uid，同步立即转入云端模式
  if (window.IPCloud && window.IPAuth) {
    IPCloud.init(IPAuth.cloudEnv()).then(ok => {
      if (!ok) return;
      const u = IPAuth.user();
      if (u && u.anon) {
        IPAuth.refreshAnon().then(() => { if (window.renderSyncChip) renderSyncChip(); });
      }
    }).catch(() => {});
  }
})();
