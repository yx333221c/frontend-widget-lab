/* ============================================================
   tools/check.mjs —— 交付前一致性校验（零依赖，node 直接跑）
   用法：node tools/check.mjs [--fix-hint]
   检查项：
     1. 注册表每个 widget 的三个文件都存在
     2. json 合法且字段齐全、id 一致
     3. 教学文档骨架齐全（## 0. / ## 7 / ## 8 / 相关组件）
     4. 组件 html：DOCTYPE、charset、viewport meta、IIFE、无外部依赖
     5. 无重复 id / 无未注册的文件 / 分类计数
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const P = (...s) => path.join(ROOT, ...s);

/* ---------- 载入注册表 ---------- */
const regSrc = fs.readFileSync(P('data', 'widgets.js'), 'utf8');
const win = {};
new Function('window', regSrc + '\nreturn window.WIDGET_REGISTRY;')(win);
const R = win.WIDGET_REGISTRY;

const errors = [];
const warns = [];
const fail = (f, m) => errors.push(`${f} :: ${m}`);
const soft = (f, m) => warns.push(`${f} :: ${m}`);

const cats = new Set(R.categories.map(c => c.id));
const ids = new Map();

/* ---------- 注册表自身 ---------- */
R.widgets.forEach(w => {
  if (ids.has(w.id)) fail('data/widgets.js', `重复 id: ${w.id}`);
  ids.set(w.id, w);
  if (!cats.has(w.cat)) fail(w.id, `cat "${w.cat}" 不在分类表里`);
  ['id', 'cat', 'title', 'summary', 'tags', 'difficulty', 'minutes', 'file', 'doc', 'viewport', 'accent']
    .forEach(k => { if (w[k] === undefined || w[k] === null || w[k] === '') fail(w.id, `注册表缺字段 ${k}`); });
  if (!['入门', '进阶', '高级'].includes(w.difficulty)) fail(w.id, `difficulty 非法: ${w.difficulty}`);
  if (!(w.viewport >= 180 && w.viewport <= 620)) soft(w.id, `viewport=${w.viewport} 偏离 180~620`);
  if (w.file !== `widgets/${w.cat}/${w.id}.html`) fail(w.id, `file 路径应为 widgets/${w.cat}/${w.id}.html，实际 ${w.file}`);
  if (w.doc !== `docs/${w.cat}/${w.id}.md`) fail(w.id, `doc 路径应为 docs/${w.cat}/${w.id}.md，实际 ${w.doc}`);
  if (w.summary.length < 20) soft(w.id, `summary 过短(${w.summary.length})`);
  if (w.tags.length < 2) soft(w.id, 'tags 少于 2 个');
});

/* ---------- 教学文档语言规范（CONTRIBUTING.md §3.1）---------- */
const DOC_SECTIONS = ['## 0.', '## 7.', '## 8.', '## 相关组件'];
/* 只检查散文：先剥掉代码块、行内代码、链接目标与表格分隔 */
function proseOnly(md) {
  return md.replace(/```[\s\S]*?```/g, '')
          .replace(/`[^`\n]*`/g, '')
          .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
          .replace(/^\s*[-*+] /gm, '')
          .replace(/^\s*\d+[.)] /gm, '');
}
const SLOP = ['赋能', '至关重要', '深入探讨', '无缝', '极致', '完美', '强大', '闭环',
  '彰显', '标志着', '综上所述', '总而言之', '拭目以待', '希望这能', '希望能帮',
  '值得注意的是', '需要注意的是', '让我们', '不只是', '不仅仅是', '在当今',
  '随着.{0,12}的发展', '随着.{0,12}的进步', '进行了'];
const SLOP_RE = SLOP.map(w => new RegExp(w, 'g'));
R.widgets.forEach(w => {
  const f = P(...w.file.split('/'));
  const d = P(...w.doc.split('/'));
  const j = P('data', 'fragments', w.id + '.json');

  [['html', f], ['doc', d], ['json', j]].forEach(([kind, p]) => {
    if (!fs.existsSync(p)) errors.push(`${w.id} :: 缺少${kind}文件 ${path.relative(ROOT, p)}`);
  });
  if (!fs.existsSync(f) || !fs.existsSync(d) || !fs.existsSync(j)) return;

  /* --- html --- */
  const html = fs.readFileSync(f, 'utf8');
  const low = html.toLowerCase();
  if (!/<!doctype html>/i.test(html)) fail(w.id, 'html: 缺 DOCTYPE');
  if (!/charset=["']?utf-8/i.test(html)) fail(w.id, 'html: 缺 meta charset');
  if (!/name=["']viewport["']/.test(html)) fail(w.id, 'html: 缺 viewport meta');
  if (!new RegExp(`<title>[^<]*${w.title}`).test(html) && !html.includes(w.title)) fail(w.id, 'html: title/正文未包含组件名');
  if (!/<h2[^>]*>[\s\S]{0,40}/.test(html)) fail(w.id, 'html: 缺 <h2> 标题结构');
  if (!/class=["']note["']/.test(html)) soft(w.id, 'html: 缺 .note 操作提示');
  if (/\bfetch\s*\(/.test(low)) fail(w.id, 'html: 用了 fetch(');
  if (/localStorage|sessionStorage/.test(low)) fail(w.id, 'html: 用了 storage');
  if (/https?:\/\/(?!www\.w3\.org)/.test(low.replace(/<!--[\s\S]*?-->/g, ''))) fail(w.id, 'html: 含外部 URL（仅允许 w3.org 的 SVG 命名空间）');
  if (/<script[^>]+src=/i.test(low)) fail(w.id, 'html: 外链 script');
  if (/<link[^>]+stylesheet/i.test(low)) fail(w.id, 'html: 外链 stylesheet');
  if (/<img[^>]+src=["'](?!data:)/i.test(low)) fail(w.id, 'html: 引用了图片文件');
  if (/@import|url\(["']?(?:https?:|\.\/|\/)/i.test(low)) fail(w.id, 'html: CSS 里有外部/本地资源引用');
  if (!/requestAnimationFrame/.test(html) && /animation|transition/i.test(html)) soft(w.id, 'html: 有动画但无 rAF（确认不活动时会停）');
  if (!/prefers-reduced-motion/.test(html) && !/reduced-motion/.test(fs.readFileSync(d, 'utf8')))
    soft(w.id, 'html 与文档都没提 prefers-reduced-motion');
  if (/console\.(log|warn|error)/.test(html)) soft(w.id, 'html: 残留 console 输出');
  if (/debugger/.test(html)) fail(w.id, 'html: 残留 debugger');
  const lines = html.split('\n').length;
  if (lines < 90) soft(w.id, `html 只有 ${lines} 行，可能太单薄`);
  if (lines > 900) soft(w.id, `html ${lines} 行，偏长`);
  const ctrl = (html.match(/<input/gi) || []).length + (html.match(/<button/gi) || []).length;
  if (ctrl < 2) fail(w.id, `html: 只有 ${ctrl} 个可交互控件，规范要求 2~4`);

  /* --- doc --- */
  const doc = fs.readFileSync(d, 'utf8');
  DOC_SECTIONS.forEach(s => { if (!doc.includes(s)) fail(w.id, `doc: 缺骨架段落 ${s}`); });
  if (!/产出文件/.test(doc) || !doc.includes(w.file)) fail(w.id, 'doc: 未回链到组件文件路径');
  const zh = (doc.match(/[\u4e00-\u9fff]/g) || []).length;
  if (zh < 1100) fail(w.id, `doc: 正文只有 ${zh} 个汉字，要求 1200~2200`);
  if (zh > 2600) soft(w.id, `doc: ${zh} 汉字，偏长`);
  const fenced = (doc.match(/```/g) || []).length;
  if (fenced < 6) fail(w.id, `doc: 只有 ${fenced / 2 | 0} 个代码块，至少 3 个`);
  if (!/~~~/.test(doc) && fenced % 2 !== 0) fail(w.id, 'doc: 代码围栏未闭合');
  if (!/- \[ \]/.test(doc)) fail(w.id, 'doc: 缺自查清单 checkbox');

  /* --- 语言规范：AI 味 --- */
  const prose = proseOnly(doc);
  const dashes = (prose.match(/——/g) || []).length;
  if (dashes > 10) fail(w.id, `doc: 破折号 ${dashes} 处（上限 10），改句式而不是加悬念`);
  SLOP_RE.forEach((re, k) => {
    const hits = prose.match(re);
    if (hits) fail(w.id, `doc: AI 味用语「${SLOP[k]}」×${hits.length} —— 按 CONTRIBUTING §3.1 换成平实说法`);
  });
  /* 段内多破折号：一行里出现 2 个以上 */
  doc.split('\n').forEach((l, n) => {
    if (/^\s*[`|>]/.test(l)) return;
    const d = (l.match(/——/g) || []).length;
    if (d > 1) soft(w.id, `doc:${n + 1} 一行内 ${d} 处破折号`);
  });
  /* 无来源的夸饰 */
  const boast = prose.match(/(堪称|公认|业界|无一例外|绝对|史上|最优化)/g);
  if (boast) [...new Set(boast)].forEach(b => soft(w.id, `doc: 夸饰词「${b}」，除非有依据否则删`));
  /* 散文里的数字要在代码里找得到，防止编造指标 */
  const corpus = doc + html;
  const nums = prose.match(/(?<![\w.`-])(\d+(?:\.\d+)?)\s*(%|fps|FPS|ms|毫秒|倍)/g) || [];
  nums.forEach(seg => {
    const n = seg.match(/(\d+(?:\.\d+)?)/)[1];
    if (!new RegExp(n.replace('.', '\\.')).test(corpus)) soft(w.id, `doc: 数字「${seg.trim()}」在代码里找不到出处，别编指标`);
  });
  const rel = (doc.match(/\]\(#\/[a-z0-9-]+\)/g) || []).map(s => s.slice(4, -1));
  if (rel.length < 2) fail(w.id, 'doc: 相关组件少于 2 个');
  rel.forEach(r => { if (!ids.has(r)) fail(w.id, `doc: 相关组件链接 #/${r} 不存在`); });

  /* --- json --- */
  let obj;
  try { obj = JSON.parse(fs.readFileSync(j, 'utf8')); }
  catch (e) { fail(w.id, `json: 解析失败 ${e.message}`); return; }
  ['id', 'what', 'points', 'tryIt', 'trap', 'suite'].forEach(k => { if (!(k in obj)) fail(w.id, `json: 缺字段 ${k}`); });
  if (obj.id !== w.id) fail(w.id, `json: id 应为 ${w.id}，实际 ${obj.id}`);
  if (!Array.isArray(obj.points) || obj.points.length < 3) fail(w.id, 'json: points 至少 3 条');
  if (Array.isArray(obj.points) && obj.points.some(p => !p.k || !p.v)) fail(w.id, 'json: points 每项需有 k/v');
  if (!Array.isArray(obj.tryIt) || obj.tryIt.length < 3) fail(w.id, 'json: tryIt 至少 3 条');
  if (typeof obj.trap === 'string' && obj.trap.length < 25) fail(w.id, 'json: trap 太短');
});

/* ---------- 孤儿文件 ---------- */
const walk = (dir, acc = []) => {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc); else acc.push(p);
  }
  return acc;
};
const known = new Set(R.widgets.map(w => P(...w.file.split('/'))));
walk(P('widgets')).forEach(p => {
  const rel = path.relative(ROOT, p).replace(/\\/g, '/');
  if (!known.has(p)) errors.push(`孤儿 :: ${rel} 未在注册表中`);
});
const knownDocs = new Set(R.widgets.map(w => P(...w.doc.split('/'))));
walk(P('docs')).forEach(p => {
  if (path.basename(p) === 'README.md') return;
  const rel = path.relative(ROOT, p).replace(/\\/g, '/');
  if (!knownDocs.has(p)) errors.push(`孤儿 :: ${rel} 未在注册表中`);
});
const knownFrags = new Set(R.widgets.map(w => w.id + '.json'));
walk(P('data', 'fragments')).forEach(p => {
  const b = path.basename(p);
  if (b === 'README.md') return;
  if (!knownFrags.has(b)) errors.push(`孤儿 :: data/fragments/${b} 未在注册表中`);
});

/* ---------- 分类计数 ---------- */
const perCat = {};
R.widgets.forEach(w => { perCat[w.cat] = (perCat[w.cat] || 0) + 1; });
R.categories.forEach(c => {
  if (!perCat[c.id]) errors.push(`分类 ${c.id} 下没有任何组件`);
});

/* ---------- 报告 ---------- */
/* 支持只检查指定 id：node tools/check.mjs spot-light-card drag-snap-cards */
const filter = process.argv.slice(2).filter(a => !a.startsWith('--'));
let errs = errors, wrns = warns;
if (filter.length) {
  const keep = s => filter.some(id => s.startsWith(id + ' ::'));
  errs = errors.filter(keep); wrns = warns.filter(keep);
  console.log(`\n只看：${filter.join(' / ')}（命中 ${errs.length} 个错误）`);
}

const total = R.widgets.length;
console.log(`\n注册表：${total} 个组件 / ${R.categories.length} 个分类`);
console.log(Object.entries(perCat).map(([k, v]) => `  ${k}: ${v}`).join('\n'));
console.log(`文档字数中位数：${median(R.widgets.map(w => {
  const d = P(...w.doc.split('/'));
  return fs.existsSync(d) ? (fs.readFileSync(d, 'utf8').match(/[\u4e00-\u9fff]/g) || []).length : 0;
}).sort((a, b) => a - b))}`);
if (wrns.length) console.log(`\n提示 ${wrns.length} 条：\n  ` + wrns.join('\n  '));
if (errs.length) {
  console.log(`\n✗ 错误 ${errs.length} 条：\n  ` + errs.join('\n  '));
  process.exit(1);
} else {
  console.log(filter.length ? '\n✓ 指定组件检查通过' : '\n✓ 全部检查通过');
}
function median(a) { return a.length ? a[Math.floor(a.length / 2)] : 0; }
