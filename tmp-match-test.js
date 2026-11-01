/* 临时验证：把 searchable-select 里的纯函数抄出来跑一遍，确认匹配/打分/高亮符合预期 */
function esc(s) {
  return String(s).replace(/[&<>"]/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m];
  });
}
function subseq(hay, needle) {
  var pos = [], j = 0, i = 0, bonus = 0, run = 0;
  while (i < hay.length && j < needle.length) {
    if (hay.charAt(i) === needle.charAt(j)) {
      run = (j > 0 && pos[j - 1] === i - 1) ? run + 1 : 1;
      bonus += run;
      pos.push(i); j++;
    } else { run = 0; }
    i++;
  }
  if (j < needle.length) return null;
  return { score: needle.length + bonus + (pos[0] === 0 ? needle.length * 2 : 0), pos: pos };
}
function score(item, n) {
  if (!n) return { item: item, m: { score: 0, pos: [] }, field: 'key' };
  var a = subseq(item.key, n), b = subseq(item.cn, n), c = subseq(item.py, n);
  var best = { f: 'key', r: a }, x = b;
  if (x && (!best.r || x.score + 0.5 > best.r.score)) best = { f: 'cn', r: x };
  x = c;
  if (x && (!best.r || x.score > best.r.score)) best = { f: 'py', r: x };
  if (!best.r) return null;
  return { item: item, m: best.r, field: best.f };
}
function markUp(text, pos) {
  var set = {}, i;
  for (i = 0; i < pos.length; i++) set[pos[i]] = 1;
  var out = '';
  for (i = 0; i < text.length; i++) {
    out += set[i] ? '<mark>' + esc(text.charAt(i)) + '</mark>' : esc(text.charAt(i));
  }
  return out;
}

var DATA = [
  ['blur', '模糊', 'mh'], ['backdrop-filter', '背景滤镜', 'bjlj'], ['clip-path', '裁切路径', 'cqlj'],
  ['conic-gradient', '锥形渐变', 'zxjb'], ['content-visibility', '内容可见性', 'nrkjx'],
  ['will-change', '提层', 'tc'], ['requestAnimationFrame', '逐帧回调', 'zzhd'],
  ['IntersectionObserver', '交叉观察', 'jcgc'], ['MutationObserver', '变更观察', 'bggc'],
  ['ResizeObserver', '尺寸观察', 'ccgc'], ['pointer-events', '指针事件', 'zzsj'],
  ['scroll-snap', '滚动吸附', 'gdxf'], ['container-query', '容器查询', 'rqcx'],
  ['aspect-ratio', '宽高比', 'kgb'], ['mask-image', '遮罩图', 'zzt'],
  ['mix-blend-mode', '混合模式', 'hhms'], ['filter', '滤镜', 'lj'], ['transform', '变换', 'bh'],
  ['grid-template', '网格模板', 'wgmb'], [':focus-visible', '焦点可见', 'jdkj'],
  ['prefers-reduced-motion', '减少动效', 'jsdx'], ['aria-live', '实况区域', 'skqy'],
  ['autocomplete', '自动填充', 'zdtc'], ['web-share', '系统分享', 'xtfx']
].map(function (r) { return { name: r[0], cn: r[1], py: r[2], key: r[0].toLowerCase() }; });

function top(n, cap) {
  var list = [];
  for (var i = 0; i < DATA.length; i++) { var s = score(DATA[i], n); if (s) list.push(s); }
  list.sort(function (a, b) { return b.m.score - a.m.score; });
  return list.slice(0, cap || 12).map(function (x) { return x.item.name + '/' + x.field + '/' + x.m.score; });
}

var cases = [
  ['bl', '应命中 blur 优先（连续+首位）'],
  ['blur', '整词命中 blur'],
  ['模', '中文名'],
  ['mh', '拼音首字母 -> 模糊/blur'],
  ['obs', 'observer 三个'],
  ['gradient', '两个 gradient'],
  ['z', '大量 py 命中，看截断'],
  ['filt', 'filter / backdrop-filter'],
  ['fo', ':focus-visible'],
  ['xyz', '应为空'],
  ['co', '容器/clip/conic/content']
];
cases.forEach(function (c) {
  console.log('\nq="' + c[0] + '"  (' + c[1] + ')');
  console.log('  ' + top(c[0]).join('\n  '));
});
console.log('\nmarkUp blur <- bl :', markUp('blur', subseq('blur', 'bl').pos));
console.log('markUp 模糊 <- 模 :', markUp('模糊', subseq('模糊', '模').pos));
console.log('total DATA =', DATA.length);
