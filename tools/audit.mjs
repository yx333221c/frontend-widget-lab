/* 深度语言审计：抓 check.mjs 词表之外的"玄学质感词"与无依据断言
   用法：node tools/audit.mjs            全部
         node tools/audit.mjs glass-card  指定  */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const regSrc = fs.readFileSync(path.join(ROOT, 'data', 'widgets.js'), 'utf8');
const win = {}; const R = new Function('window', regSrc + '\nreturn window.WIDGET_REGISTRY;')(win);
const only = process.argv.slice(2);

/* 剥掉代码块 / 行内代码 / 链接目标 / 表格分隔，只留散文 */
function prose(md) {
  return md.replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*\|[\s:|-]+\|\s*$/gm, '');
}

/* 无法验证的观感词：质感类最容易写，也最该换成机制描述 */
const VIBE = ['高级感', '通透感', '氛围感', '氛围拉满', '质感拉满', '更自然', '有质感', '视觉冲击',
  '视觉震撼', '沉浸感', '科技感', '精致感', '细腻', '丝滑', '流畅自然', '跃然', '栩栩如生',
  '呼之欲出', '浑然天成', '恰到好处', '令人', '让人眼前一亮', '耳目一新', '极具', '无比',
  '大幅提升', '显著提升', '极大改善', '完美解决', '彻底解决', '轻松实现', '优雅地',
  '强大', '灵活', '开箱即用', '一站式', '赋能', '打造', '助力', '拿捏', '拉满',
  '这波', '直接起飞', '绝了', '炸裂', '惊艳', '无可替代', '独一无二'];
/* 断言强度：没测过就不能这么写。
   "一定会"在技术文档里常用来讲确定性后果（"两份状态一定会飘"），
   "100%" 常是 CSS 百分比停靠点，都不算夸大，故不列入。 */
const STRONG = ['绝对不会', '永远不会', '所有浏览器都', '任何浏览器都',
  '业界通用', '行业标配', '唯一正确'];

const rows = [];
for (const w of (only.length ? R.widgets.filter(x => only.includes(x.id)) : R.widgets)) {
  if (!fs.existsSync(path.join(ROOT, w.doc))) continue;
  const md = fs.readFileSync(path.join(ROOT, w.doc), 'utf8');
  const p = prose(md);
  const hits = [];
  VIBE.forEach(v => { const n = (p.match(new RegExp(v, 'g')) || []).length; if (n) hits.push(`${v}×${n}`); });
  STRONG.forEach(v => { const n = (p.match(new RegExp(v, 'g')) || []).length; if (n) hits.push(`⚑${v}×${n}`); });
  const dashes = (p.match(/——/g) || []).length;
  /* 语料 = 本文档代码块 + 行内代码 + 组件源码，数字要能在里面找到 */
  const codeBlob = (md.match(/```[\s\S]*?```/g) || []).join('') + (md.match(/`[^`\n]*`/g) || []).join('');
  const src = fs.existsSync(path.join(ROOT, w.file)) ? fs.readFileSync(path.join(ROOT, w.file), 'utf8') : '';
  const corpus = codeBlob + src;
  /* 散文里的数字：单位类要在同篇代码/组件源码里出现，否则疑似编造。
     但"由代码里的值算出来的数"是合法的（1000/120=8.3ms、13×60=780ms），
     所以只要同一句里还有另一个数字能在语料里找到，就当作推导值放过。 */
  const orphanNums = [];
  const sentences = p.split(/(?<=[。；;：:！？\n])/);
  sentences.forEach(s => {
    (s.match(/(?<![\w.])(\d+(?:\.\d+)?)\s*(%|fps|FPS|ms|毫秒|倍|KB|kb)/g) || []).forEach(seg => {
      const n = seg.match(/(\d+(?:\.\d+)?)/)[1];
      if (corpus.includes(n)) return;
      const siblings = (s.match(/(?<![\w.])(\d+(?:\.\d+)?)(?![\w.])/g) || []).filter(x => x !== n);
      if (siblings.some(x => corpus.includes(x))) return;   /* 推导值 */
      orphanNums.push(seg.trim());
    });
  });
  /* 一行内多个破折号 */
  const multiDash = md.split('\n').filter(l => !/^\s*[`|>]/.test(l) && (l.match(/——/g) || []).length > 1).length;
  if (hits.length || orphanNums.length || dashes > 10 || multiDash) {
    rows.push({ id: w.id, hits, dashes, multiDash, orphanNums });
  }
}

if (!rows.length) { console.log('✓ 深度审计通过：没有玄学词、无出处数字或破折号过密'); process.exit(0); }
console.log(`\n深度审计：${rows.length} 篇需要处理\n`);
rows.forEach(r => {
  console.log(`── ${r.id}`);
  if (r.dashes > 10) console.log(`   破折号 ${r.dashes} 处（>10）`);
  if (r.multiDash) console.log(`   ${r.multiDash} 行出现一行多个破折号`);
  if (r.hits.length) console.log('   观感词/强断言：' + r.hits.join('、'));
  if (r.orphanNums.length) console.log('   代码里找不到出处的数字：' + [...new Set(r.orphanNums)].join('、'));
});
process.exit(1);
