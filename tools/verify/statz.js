const { chromium } = require('C:/Users/13458/.workbuddy/binaries/node/workspace/node_modules/playwright');
const URL = 'file:///D:/WorkBuddy/2026-09-05-03-13-43/outputs/IP%E5%88%9B%E4%BD%9C%E5%B7%A5%E4%BD%9C%E5%8F%B0-%E6%AD%A3%E5%BC%8F%E7%89%88.html';
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Users/13458/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2600);
  await page.evaluate(() => { const b = document.getElementById('wel_seed'); if (b) b.click(); });
  await page.waitForTimeout(1600);
  const go = (k) => page.evaluate((n) => { const it = Array.from(document.querySelectorAll('.navitem')).find(x => (x.textContent || '').trim() === n); if (it) it.click(); }, k);
  await go('统计');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 's-stats.png', clip: { x: 250, y: 110, width: 800, height: 130 } });
  const style = await page.evaluate(() => {
    const s = document.querySelector('.stat .sv'), k = document.querySelector('.stat .sk');
    if (!s) return 'no .stat';
    const cs = getComputedStyle(s), ck = getComputedStyle(k);
    const r = s.getBoundingClientRect();
    return `sv color=${cs.color} font=${cs.fontSize}\nsk color=${ck.color} font=${ck.fontSize}\nstat box y=${Math.round(r.top)} h=${Math.round(r.height)}`;
  });
  console.log(style);
  await go('数据');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 's-data.png', clip: { x: 250, y: 95, width: 900, height: 130 } });
  await browser.close();
  console.log('stat shots done');
})();
