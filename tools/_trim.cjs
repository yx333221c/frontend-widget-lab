const fs = require('fs');
const p = 'docs/material/neumorphic-keys.md';
let t = fs.readFileSync(p, 'utf8');
const cuts = [
  ['WCAG 2.1 给正文的门槛是 4.5:1，这是标准里的公开要求；这套配色', 'WCAG 2.1 给正文的门槛是 4.5:1；这套配色'],
  ['`filter: drop-shadow()`、按下走 `box-shadow`，两个属性各走各的过渡。它能走，但要多付两笔账：',
   '`filter: drop-shadow()`、按下走 `box-shadow`。它能走，但要多付两笔账：'],
  ['拆成组件只需要三个变量：', '组件只需要三个变量：'],
  ['阴影方向不该每个键各写一遍。演示把光源角读成极坐标，再换算成偏移：', '阴影方向不该每个键各写一遍。把光源角读成极坐标再换算成偏移：'],
  ['偏移量、模糊、颜色全部照抄，只加 `inset`：同一个光源下，物体从凸出变成凹进，光影像跟着翻进坑里。这条规则里没有一处需要 JS。',
   '偏移量、模糊、颜色全部照抄，只加 `inset`：同一光源下物体从凸出变成凹进，光影像跟着翻进坑里。这条规则里没有一处需要 JS。'],
  ['模糊半径约等于投射距离的 1.8 倍（`--blur: PROJ * 1.8`）。系数压到 1 以下阴影边缘太硬，像描边不像投影；推到 3 以上阴影发散，键和面板之间失去附着感。',
   '模糊半径约为投射距离的 1.8 倍（`--blur: PROJ * 1.8`）。系数压到 1 以下阴影边缘太硬，像描边不像投影；推到 3 以上阴影发散，键与面板失去附着感。'],
];
for (const [a, b] of cuts) {
  if (!t.includes(a)) { console.log('MISS:', a.slice(0, 26)); continue; }
  t = t.replace(a, b);
}
fs.writeFileSync(p, t, 'utf8');
console.log('zh', (t.match(/[\u4e00-\u9fff]/g) || []).length);
