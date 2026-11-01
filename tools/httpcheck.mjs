/* 一次性验证：用 http 起服务，确认详情页四段（尤其 ③ 源码 / ④ 教学）真的填充 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawnSync, spawn } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const regSrc = fs.readFileSync(path.join(ROOT, 'data', 'widgets.js'), 'utf8');
const win = {}; const R = new Function('window', regSrc + '\nreturn window.WIDGET_REGISTRY;')(win);

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, path.normalize(p).replace(/^([/\\])+/, ''));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(8912, '127.0.0.1', r));

const ids = process.argv.slice(2);
/* 默认检查所有"三件套齐全"的组件，跳过还在做的 */
const complete = R.widgets.filter(w =>
  fs.existsSync(path.join(ROOT, w.file)) &&
  fs.existsSync(path.join(ROOT, w.doc)) &&
  fs.existsSync(path.join(ROOT, 'data', 'fragments', w.id + '.json')));
const list = ids.length ? R.widgets.filter(w => ids.includes(w.id)) : complete;

/* 用 Chrome 的 --dump-dom 拿到 JS 执行后的 DOM，再检查各段是否填充
   注意：必须用异步 spawn —— spawnSync 会阻塞事件循环，
   导致本脚本自己的 http server 无法响应 Chrome 的请求而死锁 */
function dumpDom(url) {
  return new Promise((resolve) => {
    const chunks = [];
    const p = spawn(CHROME, ['--headless', '--disable-gpu', '--no-sandbox',
      '--virtual-time-budget=6000', '--user-data-dir=' + path.join(ROOT, '.tmp', 'dom-probe'),
      '--dump-dom', url], { stdio: ['ignore', 'pipe', 'ignore'] });
    p.stdout.on('data', c => chunks.push(c));
    const killer = setTimeout(() => { try { p.kill(); } catch {} }, 45000);
    p.on('close', () => { clearTimeout(killer); resolve(Buffer.concat(chunks).toString('utf8')); });
  });
}

let bad = 0;
for (const w of list) {
  const dom = await dumpDom(`http://127.0.0.1:8912/widget.html#${w.id}`);
  const checks = {
    '①iframe src': dom.includes(`src="${w.file}"`),
    '②描述已填': /关键技术点|上手试试|<strong>容易踩的坑/.test(dom),
    '③源码行': (dom.match(/class="code-line"/g) || []).length > 20,
    '③GitHub链接': dom.includes(`blob/main/${w.file}`),
    '④教学标题': /<h2[^>]*>[\s\S]*?[\u4e00-\u9fff]/.test(dom.split('id="docBody"')[1] || ''),
    '④教学字数': ((dom.split('id="docBody"')[1] || '').match(/[一-鿿]/g) || []).length > 400,
    '④GitHub链接': dom.includes(`blob/main/${w.doc}`)
  };
  const fail = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  if (fail.length) { bad++; console.log(`✗ ${w.id.padEnd(20)} 缺：${fail.join(' / ')}`); }
  else console.log(`✓ ${w.id.padEnd(20)} 四段齐全（源码 ${(dom.match(/class="code-line"/g) || []).length} 行）`);
}
server.close();
console.log(bad ? `\n✗ ${bad} 个详情页不完整` : '\n✓ 全部详情页四段完整');
process.exit(bad ? 1 : 0);
