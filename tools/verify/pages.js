const { chromium } = require('C:/Users/13458/.workbuddy/binaries/node/workspace/node_modules/playwright');
const URL = 'file:///D:/WorkBuddy/2026-09-05-03-13-43/outputs/IP%E5%88%9B%E4%BD%9C%E5%B7%A5%E4%BD%9C%E5%8F%B0-%E6%AD%A3%E5%BC%8F%E7%89%88.html';
const PAGES = [['today', '今日'], ['projects', '企划'], ['marks', '标记'], ['ideas', '灵感'], ['assets', '资产'], ['templates', '模板库'], ['stats', '统计'], ['data', '数据']];
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Users/13458/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => console.log('JS-ERR:', String(e).slice(0, 200)));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2600);
  await page.evaluate(() => { const b = document.getElementById('wel_seed'); if (b) b.click(); });
  await page.waitForTimeout(1600);
  const keys = await page.evaluate(() => Array.from(document.querySelectorAll('.navitem')).map(n => (n.textContent || '').trim()));
  console.log('NAV:', JSON.stringify(keys));
  for (let i = 0; i < keys.length; i++) {
    const name = keys[i];
    if (/设置/.test(name)) continue;
    await page.evaluate((k) => {
      const it = Array.from(document.querySelectorAll('.navitem')).find(n => (n.textContent || '').trim() === k);
      if (it) it.click();
    }, name);
    await page.waitForTimeout(1000);
    const f = 'pg-' + i + '.png';
    await page.screenshot({ path: f, clip: { x: 240, y: 56, width: 1200, height: 700 } });
    console.log('shot', i, name, '->', f);
  }
  await browser.close();
})();
