/* ============================================================
   tools/shoot.mjs —— 用 headless Chrome 逐张截图 + 抓 JS 报错
   零依赖。走 --headless --screenshot（本机 Chrome 155 实测稳定，
   CDP 长连接在这台机器上会卡住，所以不用）。

   用法：
     node tools/shoot.mjs                 # 全部组件
     node tools/shoot.mjs gooey-menu ...  # 指定 id
     node tools/shoot.mjs --home          # 额外截主页与 4 个详情页
     node tools/shoot.mjs --full          # 用注册表 viewport 高度截图

   产出：assets/shots/<id>.png（主页卡片缩略图）
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'assets', 'shots');
const argv = process.argv.slice(2);
const WANT_HOME = argv.includes('--home');
const FULL = argv.includes('--full');
const only = argv.filter(a => !a.startsWith('--'));

const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe']
  .find(p => fs.existsSync(p));
if (!CHROME) { console.error('找不到 Chrome/Edge'); process.exit(2); }

const regSrc = fs.readFileSync(path.join(ROOT, 'data', 'widgets.js'), 'utf8');
const win = {};
const R = new Function('window', regSrc + '\nreturn window.WIDGET_REGISTRY;')(win);
const targets = (only.length ? R.widgets.filter(w => only.includes(w.id)) : R.widgets);

fs.mkdirSync(OUT, { recursive: true });
const profile = path.join(ROOT, '.tmp', 'chrome-shot');

/* 入场动画类组件的截图陷阱：--virtual-time-budget 只推进定时器和 rAF，
   不推进 CSS 动画的时间线，所以"默认 opacity:0、滚动进来才点亮"的组件
   会被拍成空白。这类组件都写了 prefers-reduced-motion 降级分支
   （不隐藏、直接可见），加 --force-prefers-reduced-motion 就能拍到终态。
   只对确实需要的项目开：noise-glitch 的降级分支会把错色层整个隐藏，
   全局加这个 flag 反而拍出不像它自己的图。 */
const SETTLED = new Set(['stagger-reveal']);

/* 组件是单文件自包含的，直接用 file:// 截；
   index.html 要 fetch data/fragments/*.json，file:// 下会被 CORS 拦，
   所以主页/详情页用 --allow-file-access-from-files。 */
function shoot(fileUrl, outPng, w, h, extra = []) {
  const args = ['--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--force-device-scale-factor=2', '--allow-file-access-from-files',
    `--user-data-dir=${profile}`, `--window-size=${w},${h}`,
    `--virtual-time-budget=${extra.length ? 4000 : 2500}`,
    `--screenshot=${outPng}`, ...extra, fileUrl];
  const r = spawnSync(CHROME, args, { encoding: 'utf8', timeout: 45000 });
  const err = (r.stderr || '') + (r.stdout || '');
  const bytes = fs.existsSync(outPng) ? fs.statSync(outPng).size : 0;
  /* console 报错与未捕获异常会进 stderr：--enable-logging=stderr 时更细，
     但新版 Chrome 只在 UNCAUGHT 时打印，所以两条都查 */
  const bad = err.split(/\r?\n/).filter(l =>
    /Uncaught|ERROR:.*console|TypeError|ReferenceError|SyntaxError|net::ERR/.test(l) &&
    !/ERROR:gpu|ERROR:angle|ERROR:viz|ERROR:device|ERROR:swiftshader|ERROR:command_buffer/.test(l));
  return { bytes, bad, err };
}

const problems = [];
const CARD_W = 560, CARD_H = 300;
console.log(`截图 ${targets.length} 个组件（${CARD_W}px 宽）`);

for (const w of targets) {
  const f = path.join(ROOT, w.file);
  if (!fs.existsSync(f)) { problems.push({ id: w.id, msg: '文件不存在' }); console.log(`  ✗ ${w.id.padEnd(20)} 缺文件`); continue; }
  const h = FULL ? Math.max(320, w.viewport || 320) : CARD_H;
  const png = path.join(OUT, w.id + '.png');
  const { bytes, bad } = shoot('file:///' + f.replace(/\\/g, '/'), png, CARD_W, h,
    SETTLED.has(w.id) ? ['--force-prefers-reduced-motion'] : []);
  if (bytes < 3000) problems.push({ id: w.id, msg: `截图只有 ${bytes} 字节，可能白屏` });
  bad.slice(0, 3).forEach(l => problems.push({ id: w.id, msg: l.trim().slice(0, 220) }));
  const flag = bytes >= 3000 && !bad.length ? '✓' : '✗';
  console.log(`  ${flag} ${w.id.padEnd(20)} ${bytes ? (bytes / 1024).toFixed(0) + 'KB' : '0'}${bad.length ? '  ⚠ ' + bad.length + ' 条报错' : ''}`);
}

if (WANT_HOME) {
  const shots = [['index', 'index.html', 1280, 900]];
  for (const w of targets.slice(0, 4)) shots.push(['detail_' + w.id, 'widget.html#' + w.id, 1280, 1200]);
  for (const [name, rel, W, H] of shots) {
    const png = path.join(OUT, '_' + name + '.png');
    const { bytes, bad } = shoot('file:///' + path.join(ROOT, rel).replace(/\\/g, '/'), png, W, H, ['--no-sandbox']);
    if (bytes < 5000) problems.push({ id: name, msg: `站点截图只有 ${bytes} 字节` });
    bad.slice(0, 3).forEach(l => problems.push({ id: name, msg: l.trim().slice(0, 220) }));
    console.log(`  ${bytes >= 5000 && !bad.length ? '✓' : '✗'} ${name.padEnd(20)} ${(bytes / 1024).toFixed(0)}KB`);
  }
}

if (problems.length) {
  console.log(`\n✗ ${problems.length} 个问题：`);
  problems.forEach(p => console.log(`  [${p.id}] ${p.msg}`));
  process.exit(1);
}
console.log(`\n✓ 完成 -> assets/shots/`);
