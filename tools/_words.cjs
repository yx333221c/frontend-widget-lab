const fs = require('fs');
const ids = ['glass-card', 'neumorphic-keys', 'gradient-border', 'metal-plate'];
const BACKTICK = String.fromCharCode(96);
const FENCE = BACKTICK.repeat(3);
const WORDS = process.argv[2]
  ? process.argv[2].split('|')
  : ['高级', '通透', '氛围', '自然', '质感', '视觉', '冲击', '优雅', '美感', '漂亮', '好看', '廉价', '脏', '发灰', '一眼', '像真', '真实', '明显', '干净', '粗糙', '细腻', '柔和', '硬朗', '看起来', '观感', '先验', '刺眼', '很稳', '最省', '更可靠', '可信'];
for (const f of ids) {
  const doc = fs.readFileSync('docs/material/' + f + '.md', 'utf8');
  console.log('=========', f);
  let inFence = false, idx = 0;
  doc.split('\n').forEach((l, n) => {
    if (l.trim().startsWith(FENCE)) { inFence = !inFence; return; }
    if (inFence || !l.trim()) return;
    idx++;
    const hit = WORDS.filter(w => l.includes(w));
    if (hit.length) console.log('  L' + (n + 1) + ' {' + hit.join(',') + '}\n     ' + l.trim());
  });
}
