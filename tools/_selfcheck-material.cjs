const fs = require('fs');
const ids = ['glass-card', 'neumorphic-keys', 'gradient-border', 'metal-plate'];
for (const f of ids) {
  const h = fs.readFileSync('widgets/material/' + f + '.html', 'utf8');
  const low = h.toLowerCase();
  const noComment = low.replace(/<!--[\s\S]*?-->/g, '');
  console.log('---', f);
  console.log('  lines', h.split('\n').length);
  console.log('  externalURL', (noComment.match(/https?:\/\/(?!www\.w3\.org)/g) || []).length);
  console.log('  fetch(', (low.match(/fetch[ \t]*\(/g) || []).length);
  console.log('  storage', (low.match(/localstorage|sessionstorage/g) || []).length);
  console.log('  imgSrc', (low.match(/<img[^>]+src/g) || []).length);
  console.log('  cssRemoteUrl', (low.match(/url\(["']?(https?:|\.\/|\/)/g) || []).length);
  console.log('  console', (h.match(/console\.(log|warn|error)/g) || []).length);
  console.log('  inputs', (h.match(/<input/gi) || []).length, 'buttons', (h.match(/<button/gi) || []).length);
  console.log('  doctype', /<!DOCTYPE html>/i.test(h), 'charset', /charset="UTF-8"/i.test(h), 'vpMeta', /name="viewport"/.test(h));
  console.log('  h2', /<h2/.test(h), 'note', /class="note"/.test(h), 'IIFE', /\(function \(\) \{/.test(h));
  console.log('  reducedMotion', /prefers-reduced-motion/.test(h));
  const m = h.match(/<script>([\s\S]*?)<\/script>/);
  try { new Function(m[1]); console.log('  jsSyntax OK'); } catch (e) { console.log('  jsSyntax FAIL', e.message); }
}
console.log('\n=== docs ===');
for (const f of ids) {
  const d = fs.readFileSync('docs/material/' + f + '.md', 'utf8');
  const zh = (d.match(/[\u4e00-\u9fff]/g) || []).length;
  const sec = ['## 0.', '## 1.', '## 7.', '## 8.', '## 相关组件'].every(s => d.includes(s));
  const fence = (d.match(/```/g) || []).length;
  const rel = (d.match(/\]\(#\/[a-z0-9-]+\)/g) || []);
  const trap = /坑：|踩坑/.test(d);
  console.log(f, 'zh', zh, 'skeleton', sec, 'fencesEven', fence % 2 === 0, 'relLinks', rel.length, 'trapPara', trap, 'lines', d.split('\n').length);
}
