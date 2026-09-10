const { chromium } = require('C:/Users/13458/.workbuddy/binaries/node/workspace/node_modules/playwright');
const fs = require('fs');
const URL = 'file:///D:/WorkBuddy/2026-09-05-03-13-43/outputs/IP%E5%88%9B%E4%BD%9C%E5%B7%A5%E4%BD%9C%E5%8F%B0-%E6%AD%A3%E5%BC%8F%E7%89%88.html';

const COLLECT = () => {
  const path = el => {
    const parts = []; let n = el, d = 0;
    while (n && n.nodeType === 1 && d < 6) {
      let s = n.tagName.toLowerCase();
      if (n.id) s += '#' + n.id;
      else if (n.className && typeof n.className === 'string') {
        const c = n.className.trim().split(/\s+/).slice(0, 2).join('.');
        if (c) s += '.' + c;
      }
      parts.unshift(s); n = n.parentElement; d++;
    }
    return parts.join('>');
  };
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    let txt = '';
    for (const n of el.childNodes) if (n.nodeType === 3) txt += n.textContent;
    txt = txt.trim();
    if (!txt || txt.length > 40) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    if (r.width > 1100 || r.height > 200) continue;
    if (r.bottom < 4 || r.top > innerHeight - 4 || r.right < 4 || r.left > innerWidth - 4) continue;
    out.push({
      p: path(el), t: txt, fs: parseFloat(cs.fontSize),
      fw: parseInt(cs.fontWeight) || 400,
      x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height)
    });
  }
  return out;
};

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Users/13458/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  page.on('pageerror', e => console.log('JS-ERR:', String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2600);
  await page.evaluate(() => { const b = document.getElementById('wel_seed'); if (b) b.click(); });
  await page.waitForTimeout(1600);
  const keys = await page.evaluate(() => Array.from(document.querySelectorAll('.navitem')).map(n => (n.textContent || '').trim()));
  const all = [];
  for (let i = 0; i < keys.length; i++) {
    const name = keys[i];
    if (/设置/.test(name)) continue;
    await page.evaluate(k => {
      const it = Array.from(document.querySelectorAll('.navitem')).find(n => (n.textContent || '').trim() === k);
      if (it) it.click();
    }, name);
    await page.waitForTimeout(900);
    const maxScroll = await page.evaluate(() => {
      const sc = document.querySelector('#content') || document.scrollingElement;
      return Math.max(0, sc.scrollHeight - sc.clientHeight);
    });
    const steps = Math.min(4, Math.ceil(maxScroll / 700) + 1);
    for (let s = 0; s < steps; s++) {
      await page.evaluate((y) => {
        const sc = document.querySelector('#content') || document.scrollingElement;
        sc.scrollTop = y;
      }, s * 700);
      await page.waitForTimeout(500);
      const rows = await page.evaluate(COLLECT);
      const f = `aud-${i}-${s}.png`;
      await page.screenshot({ path: f });
      for (const r of rows) all.push({ ...r, img: f });
      console.log('shot', name, 'step', s, 'items', rows.length, '->', f);
    }
  }
  fs.writeFileSync('audit.json', JSON.stringify(all, null, 0));
  console.log('TOTAL', all.length);
  await browser.close();
})();
