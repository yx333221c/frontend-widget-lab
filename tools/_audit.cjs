const fs = require('fs');
const ids = ['glass-card', 'neumorphic-keys', 'gradient-border', 'metal-plate'];
const BACKTICK = String.fromCharCode(96);
const FENCE = BACKTICK.repeat(3);
const INLINE = new RegExp(BACKTICK + '[^' + BACKTICK + '\n]*' + BACKTICK, 'g');
const FENCE_RE = new RegExp(FENCE + '[\\s\\S]*?' + FENCE, 'g');

for (const f of ids) {
  const doc = fs.readFileSync('docs/material/' + f + '.md', 'utf8');
  const html = fs.readFileSync('widgets/material/' + f + '.html', 'utf8');
  const corpus = doc + html;
  console.log('=========', f);
  let inFence = false;
  doc.split('\n').forEach((l, n) => {
    if (l.trim().startsWith(FENCE)) { inFence = !inFence; return; }
    if (inFence) return;
    const stripped = l.replace(INLINE, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    // every number token with a unit in prose
    const nums = stripped.match(/(\d+(?:\.\d+)?)(%|fps|FPS|ms|像素|倍|px|deg)/g) || [];
    const bare = stripped.match(/(?<![\w.])\d+(?:\.\d+)?/g) || [];
    const bad = nums.filter(seg => {
      const m = seg.match(/(\d+(?:\.\d+)?)/)[1];
      return !new RegExp(m.replace('.', '\\.')).test(corpus);
    });
    if (bad.length) console.log('  ORPHAN L' + (n + 1) + ' [' + bad.join(',') + ']  ||  ' + l.trim().slice(0, 100));
    // list prose numbers that appear ONLY in prose (not in html) for manual review
    const suspicious = bare.filter(x => !html.includes(x));
    if (suspicious.length) console.log('  NOT-IN-HTML L' + (n + 1) + ' [' + [...new Set(suspicious)].join(',') + '] || ' + l.trim().slice(0, 90));
  });
}
