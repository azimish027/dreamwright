/* main.js —— 启动：载入数据；全新用户先进「欢迎屏」，老用户直接进工作台 */
(function () {
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
})();
