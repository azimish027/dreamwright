/* ui.js —— 全站统一 SVG 线稿图标库（24 viewBox，1.7 描边圆角端）
   供浮窗 / 分屏 / 画布 / AI 面板的窗口级按钮复用，替代字符/emoji 按钮。 */
window.IPUI = (function () {
  // 每个图标为自包含 innerSVG（自带描边属性，不依赖外层 CSS 继承）
  const paths = {
    minus: '<path d="M6 12h12"/>',
    close: '<path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6"/>',
    split: '<path d="M6.2 5.6h4.7v12.8H6.2z"/><path d="M13.1 5.6h4.7v12.8h-4.7z"/>',
    restore: '<path d="M9 5.8H5.8V9M15 5.8h3.2V9M15 18.2h3.2V15M9 18.2H5.8V15"/>',
    swap: '<path d="M6.4 8.6h10.6M14.6 6.4l2.4 2.2-2.4 2.2M17.6 15.4H7M9.4 13.2l-2.4 2.2 2.4 2.2"/>',
    type: '<path d="M9.2 6h5.6M12 6v12.4"/>',
    sticky: '<path d="M6.4 5.2h7.6l3.8 3.8v9.8H6.4z"/><path d="M14 5.2V9h3.8"/>',
    pen: '<path d="M5.2 18.8l.9-3.7 9.9-9.9a2.1 2.1 0 0 1 3 3L9.1 18.1 5.2 19z"/><path d="M13.8 7.6l3 3"/>',
    image: '<rect x="4" y="5.4" width="16" height="13.2" rx="2.2"/><circle cx="9.3" cy="10.1" r="1.5"/><path d="M6.4 16.3l3.5-3.5 2.5 2.5 2.5-2.5 3.1 3.1"/>',
    card: '<rect x="4.4" y="5.4" width="15.2" height="13.2" rx="2.2"/><path d="M8.6 9.5h6.8M8.6 13h4.4"/>',
    link: '<circle cx="6.8" cy="17.2" r="2.3"/><circle cx="17.2" cy="6.8" r="2.3"/><path d="M8.8 15.2l6.4-6.4"/>',
    mind: '<circle cx="6.4" cy="12" r="2.2"/><circle cx="17.4" cy="6" r="2.2"/><circle cx="17.4" cy="18" r="2.2"/><path d="M8.5 11l6.9-3.8M8.5 13l6.9 3.8"/>',
    add: '<path d="M12 6.6v10.8M6.6 12h10.8"/>',
    fit: '<path d="M8.6 5.6H5.6v3M15.4 5.6h3v3M15.4 18.4h3v-3M8.6 18.4h-3v-3"/><circle cx="12" cy="12" r="1.5"/>',
    spark: '<path d="M12 4.6l1.5 3.9 3.9 1.5-3.9 1.5-1.5 3.9-1.5-3.9-3.9-1.5 3.9-1.5z" fill="currentColor" stroke="none"/><path d="M18.6 4.4c.2.6.6 1 1.2 1.2-.6.2-1 .6-1.2 1.2-.2-.6-.6-1-1.2-1.2.6-.2 1-.6 1.2-1.2z" fill="currentColor" stroke="none"/>',
    send: '<path d="M5.2 18.8L18.8 5.2M18.8 5.2H9.6M18.8 5.2v9.2"/>',
    /* --- 设置页专用 --- */
    gear: '<circle cx="12" cy="12" r="3.1"/><path d="M12 4.2v2M12 17.8v2M4.2 12h2M17.8 12h2M6.5 6.5l1.4 1.4M16.1 16.1l1.4 1.4M17.5 6.5l-1.4 1.4M7.9 16.1l-1.4 1.4"/>',
    palette: '<path d="M12 4.4c-4.3 0-7.6 3.2-7.6 7.1 0 2.9 2.2 4.5 4.2 4.5h1.3c.9 0 1.4.6 1.4 1.4 0 .9-.7 1.2-.7 1.9 0 .9.8 1.5 1.8 1.5 4.2 0 7.4-3.3 7.4-7.2 0-4.5-3.5-9.2-7.8-9.2z"/><circle cx="9.1" cy="10.4" r="1"/><circle cx="13.3" cy="8.8" r="1"/><circle cx="16" cy="12.3" r="1"/>',
    cloud: '<path d="M7.5 18.4h9.1a3.6 3.6 0 0 0 .3-7.2 5.2 5.2 0 0 0-9.9-1.1 3.9 3.9 0 0 0 .5 8.3z"/>',
    shield: '<path d="M12 4.4l6.3 2.4v5c0 3.6-2.6 6.5-6.3 7.7-3.7-1.2-6.3-4.1-6.3-7.7V6.8z"/><path d="M9.4 12.2l1.9 1.9 3.4-3.6"/>',
    info: '<circle cx="12" cy="12" r="7.6"/><path d="M12 11.2v5M12 8h.01"/>',
    font: '<path d="M6 18.4L10.6 6h1.8L17 18.4M8.5 14.1h6.2"/>'
  };
  const COM = ' fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  function ic(name, cls) {
    const raw = paths[name] || '';
    // 给没有自带属性的元素统一描边样式（带 fill/stroke 覆盖的除外）
    const inner = raw.replace(/<([a-z]+)([^>]*?)(\/?)>/g, (m, tag, attrs, self) => {
      if (/fill=|stroke=/.test(attrs)) return m;
      return '<' + tag + attrs + COM + (self || '>');
    });
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + inner + '</svg>';
  }

  // ---- 吉祥物「镜梦菱（梦梦）」helper（资产在 MASCOT，build.js 注入） ----
  function mascot(name) {
    if (typeof MASCOT === 'undefined' || !MASCOT[name]) return '';
    return '<img class="mm-' + name + '" src="' + MASCOT[name] + '" alt="" draggable="false">';
  }
  // 庆祝小演出：右下角弹出点赞/比心小梦梦，1.8s 后淡出
  function burst(name, text) {
    if (typeof MASCOT === 'undefined' || !MASCOT[name]) return;
    const old = document.getElementById('mmburst');
    if (old) old.remove();
    const b = document.createElement('div');
    b.id = 'mmburst';
    b.innerHTML = '<img src="' + MASCOT[name] + '" alt="" draggable="false">' +
      (text ? '<span>' + text + '</span>' : '');
    document.body.appendChild(b);
    if (window.IPFX && text) setTimeout(() => IPFX.type(b.querySelector('span')), 240);
    setTimeout(() => { b.classList.add('bye'); }, 1400);
    setTimeout(() => { b.remove(); }, 2000);
  }
  return { ic: ic, mascot: mascot, burst: burst };
})();
