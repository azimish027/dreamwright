// P2 竖切原型 build.js —— 把 src/*.js + style.css 合并成单文件 HTML
const fs = require('fs');
const path = require('path');
const SRC = __dirname;
const files = [
  'ui.js', 'fx.js', 'store.js', 'seed.js', 'drawing.js', 'editor.js',
  'tags.js', 'lines.js', 'search.js',
  'chapters.js', 'assets.js', 'float.js', 'board.js', 'ai.js',
  'projects.js', 'manage.js',
  'cloudbase.js', 'auth.js', 'sync.js', 'onboard.js', 'notice.js', 'vn13.js',
  'views.js', 'main.js'
];
const out = path.join(__dirname, '..', '..', 'IP创作工作台-正式版.html');

let css = fs.readFileSync(path.join(SRC, 'style.css'), 'utf8');
// 字体注入：读取 fonts/fonts_b64.js（window.__FONT_B64__={sans:"..."}），替换 CSS 占位
let faceCss = '';
try {
  const b64raw = fs.readFileSync(path.join(__dirname, '..', '..', 'fonts', 'fonts_b64.js'), 'utf8');
  const m = /sans:"([^"]+)"/.exec(b64raw);
  if (m && m[1]) {
    faceCss = '@font-face{font-family:"IP Sans";src:url(data:font/woff2;base64,' + m[1] + ') format("woff2");' +
      'font-weight:1 999;font-display:swap;font-style:normal}';
  }
} catch (e) { console.log('font inject skip:', e.message); }
// 梦梦字体系统：tools/fonts2.js（window.__FONTS2__={naipao,yuanqi,pixel}）
try {
  const f2 = fs.readFileSync(path.join(__dirname, '..', 'tools', 'fonts2.js'), 'utf8');
  const g = k => { const m = new RegExp(k + ':"([^"]+)"').exec(f2); return m ? m[1] : ''; };
  const np = g('naipao'), yq = g('yuanqi'), px = g('pixel'), kr = g('kuri');
  if (np) faceCss += '@font-face{font-family:"MM Soft";src:url(data:font/woff2;base64,' + np + ') format("woff2");font-display:swap}';
  if (yq) faceCss += '@font-face{font-family:"MM Cute";src:url(data:font/woff2;base64,' + yq + ') format("woff2");font-display:swap}';
  if (px) faceCss += '@font-face{font-family:"MM Pixel";src:url(data:font/woff2;base64,' + px + ') format("woff2");font-display:swap}';
  if (kr) faceCss += '@font-face{font-family:"Kuriyama";src:url(data:font/woff2;base64,' + kr + ') format("woff2");font-display:swap}';
  console.log('mm fonts inject ok' + (kr ? ' + kuriyama' : ' (kuriyama MISSING)'));
} catch (e) { console.log('mm fonts inject skip:', e.message); }
css = css.replace('/*__FONT_FACE__*/', faceCss);
// 梦幻层背景资产：站姿上半身(--mm-fig) + 坐姿弹窗背景(--mm-sit)
try {
  const figB64 = fs.readFileSync(path.join(__dirname, '..', 'tools', 'mascot-figtop.webp')).toString('base64');
  const sitB64 = fs.readFileSync(path.join(__dirname, '..', 'tools', 'mascot-sit.webp')).toString('base64');
  css = css.replace('/*__MMBG__*/', ':root{--mm-fig:url("data:image/webp;base64,' + figB64 + '");' +
    '--mm-sit:url("data:image/webp;base64,' + sitB64 + '")}');
  console.log('mascot bg inject ok');
} catch (e) { console.log('mascot bg inject skip:', e.message); }
// 内容区隐形品牌水印：tools/watermark.css（由 tools/mkwordmark.py 生成）
try {
  const wmCss = fs.readFileSync(path.join(__dirname, '..', 'tools', 'watermark.css'), 'utf8');
  css = css.replace('/*__WATERMARK__*/', wmCss);
  console.log('watermark inject ok');
} catch (e) { console.log('watermark inject skip:', e.message); }

// 品牌艺术字轮廓：tools/wordmark.js -> var WM
let wmJs = '';
try {
  wmJs = fs.readFileSync(path.join(__dirname, '..', 'tools', 'wordmark.js'), 'utf8') +
    '\nvar WM = WM_SET.serifLight || WM_SET[Object.keys(WM_SET)[0]];\n';
  console.log('wordmark inject ok');
} catch (e) { console.log('wordmark inject skip:', e.message); }

// 吉祥物「镜梦菱（梦梦）」内嵌资产：tools/mascot.js -> var MASCOT
try {
  wmJs += fs.readFileSync(path.join(__dirname, '..', 'tools', 'mascot.js'), 'utf8');
  console.log('mascot inject ok');
} catch (e) { console.log('mascot inject skip:', e.message); }

// 糖果系 UI 素材：tools/uicomps.js -> var UIC + CSS 变量 --uc-*
try {
  const ucJs = fs.readFileSync(path.join(__dirname, '..', 'tools', 'uicomps.js'), 'utf8');
  wmJs += ucJs + '\n';
  const vars = [];
  ucJs.replace(/([a-z0-9]+):"data:image\/webp;base64,([^"]+)"/g, (m, k, b64) => {
    vars.push('--uc-' + k + ':url("data:image/webp;base64,' + b64 + '")');
    return m;
  });
  css = css.replace('/*__UICOMP__*/', ':root{' + vars.join(';') + '}');
  console.log('uicomps inject ok (' + vars.length + ' assets)');
} catch (e) { console.log('uicomps inject skip:', e.message); }

let js = wmJs + files.map(f => {
  const code = fs.readFileSync(path.join(SRC, f), 'utf8');
  return '/* ===== ' + f + ' ===== */\n' + code;
}).join('\n\n');

// 个人 AI 配置注入：tools/myai.local.json（gitignore 不入库，含 baseURL/key/model）。
// --public 开源构建：跳过注入，产出 key 全空的公开版。
const PUBLIC = process.argv.includes('--public');
const PH = '/*__MY_AI__*/{ baseURL: \'\', key: \'\', model: \'\' }';
if (!PUBLIC) {
  try {
    const myai = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'myai.local.json'), 'utf8'));
    js = js.replace(PH, JSON.stringify(myai));
    console.log('myai inject ok (local build, key len ' + (myai.key || '').length + ')');
  } catch (e) { console.log('myai inject skip: ' + e.message + '（公开版配置，AI 需在设置页手填）'); }
} else {
  js = js.replace(PH, '{ baseURL: \'\', key: \'\', model: \'\' }');
  console.log('public build: no personal cfg');
}
// CloudBase 环境 ID 注入（非密，可公开；两种构建都注入，便于一键连接真实云端）
let cloudEnv = '';
try {
  const myai = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'myai.local.json'), 'utf8'));
  cloudEnv = myai.cloudEnv || '';
} catch (e) {}
js = js.split('/*__CLOUD_ENV__*/').join(JSON.stringify(cloudEnv));
console.log('cloudEnv inject: ' + (cloudEnv || '(empty → 用户需在弹窗填写)'));
const outPath = PUBLIC
  ? path.join(__dirname, '..', 'dist', 'IP创作工作台-开源版.html')
  : out;

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>筑梦之境 · Dreamwright</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2056%2056'%3E%3Crect%20width='56'%20height='56'%20rx='13'%20fill='%2313161D'/%3E%3Cdefs%3E%3ClinearGradient%20id='g'%20x1='0'%20y1='0'%20x2='1'%20y2='1'%3E%3Cstop%20offset='0'%20stop-color='%23CFD2FF'%20stop-opacity='.44'/%3E%3Cstop%20offset='.5'%20stop-color='%236E72FF'%20stop-opacity='.2'/%3E%3Cstop%20offset='1'%20stop-color='%237FD4FF'%20stop-opacity='.36'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath%20d='M28%204%20L52%2028%20L28%2052%20L4%2028%20Z'%20fill='url(%23g)'%20stroke='%23FFFFFF'%20stroke-opacity='.85'%20stroke-width='3'%20stroke-linejoin='round'/%3E%3Cpath%20d='M28%204%20L4%2028%20L28%2028%20Z'%20fill='%23FFFFFF'%20opacity='.3'/%3E%3Cpath%20d='M4%2028%20L28%2052%20L28%2028%20Z'%20fill='%236E72FF'%20opacity='.5'/%3E%3Cpath%20d='M28%204%20L28%2052%20M4%2028%20L52%2028'%20stroke='%23FFFFFF'%20stroke-opacity='.25'%20stroke-width='1.4'%20fill='none'/%3E%3Ccircle%20cx='28'%20cy='28'%20r='3.4'%20fill='%23FFFFFF'/%3E%3C/svg%3E">
<style>
${css}
</style>
</head>
<body>
<div id="app"></div>
<script>
"use strict";
${js}
</script>
</body>
</html>`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html, 'utf8');
console.log('built -> ' + outPath + ' ' + Math.round(fs.statSync(outPath).size / 1024) + 'KB' + (PUBLIC ? ' (PUBLIC)' : ''));
