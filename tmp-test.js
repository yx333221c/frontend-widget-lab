/* 临时测试（交付前删除）v3 */
const fs = require('fs');
const M = require('./tmp-mini-dom.js');
const { fire, fireDoc, DOC, WIN, findIn } = M;
let fails = 0;
function t(cond, msg, extra) {
  if (cond) console.log('  pass · ' + msg);
  else { fails++; console.log('  FAIL · ' + msg + (extra !== undefined ? '  >>> ' + JSON.stringify(extra) : '')); }
}
/* 浏览器里 change 之前 checked 已被点选改掉，测试台要显式模拟 */
const check = (el, v) => { el.checked = v; };

/* ============================= 1. otp-input ============================= */
(function () {
  console.log('\n=== otp-input ===');
  const h = M.run('widgets/controls/otp-input.html');
  const otp = DOC.getElementById('otp');
  const input = DOC.getElementById('code');
  const cellsEl = DOC.getElementById('cells');
  const live = DOC.getElementById('live');
  const cellText = () => Array.from(cellsEl.children).map(c => c.textContent).join('|');

  t(cellsEl.children.length === 6, 'build 出 6 格', cellsEl.children.length);
  t(input.attrs.autocomplete === 'one-time-code', 'autocomplete=one-time-code');
  t(input.attrs.inputmode === 'numeric', 'inputmode=numeric');
  t(input.attrs['aria-label'] === '6 位验证码', 'aria-label 说明位数', input.attrs['aria-label']);
  t(cellsEl.attrs['aria-hidden'] === 'true', '视觉层 aria-hidden');

  input.value = '12'; input.setSelectionRange(2, 2);
  fire(input, 'input', {});
  /* 6 格、value="12" → 前两位有字，后四位空，join 出 5 个分隔符 */
  t(cellText() === ['1', '2', '', '', '', ''].join('|'), '格子文本跟随 value', cellText());

  input.value = '1a2';
  fire(input, 'input', {});
  t(input.value === '12', '非数字被过滤并回写', input.value);

  input.value = '123456'; input.setSelectionRange(6, 6);
  fire(input, 'input', {}); h.drain(1);
  Array.from(cellsEl.children).forEach((c, i) => { c._l = i * 42; c._w = 42; });
  DOC.activeElement = input;
  fire(otp, 'click', { target: input, clientX: 3 * 42 + 5 });
  t(input.selectionStart === 3, '点第3格 → 光标落在第3位', input.selectionStart);

  input.value = '12'; input.setSelectionRange(2, 2);
  fire(otp, 'click', { target: input, clientX: 5 * 42 + 5 });
  t(input.selectionStart === 2, '点空格时夹到 value 末尾', input.selectionStart);

  input.value = '12345'; input.setSelectionRange(3, 3);
  const eb = fire(input, 'keydown', { key: 'Backspace' });
  t(eb._pd, 'Backspace 被接管');
  t(input.value === '1245', '删的是光标左边那格，其余左移', input.value);
  t(input.selectionStart === 2, '光标退一位', input.selectionStart);

  input.value = '1245'; input.setSelectionRange(0, 0);
  fire(input, 'keydown', { key: 'Delete' });
  t(input.value === '245', 'Delete 删光标右边', input.value);
  ['ArrowLeft', 'ArrowRight', 'Home', 'End'].forEach(k => {
    t(!fire(input, 'keydown', { key: k })._pd, k + ' 未 preventDefault');
  });

  /* 校验通过 */
  fire(input, 'keydown', { key: 'Escape' });
  input.value = '123456'; input.setSelectionRange(6, 6);
  fire(input, 'input', {});
  t(h.pending() > 0, '满位触发校验定时器', h.pending());
  h.drain(1);
  t(otp.className.includes('ok'), '正确码进 ok', otp.className);

  /* 错误 → 抖动 → 自动清空 */
  fire(input, 'keydown', { key: 'Escape' });
  input.value = '999999'; input.setSelectionRange(6, 6); fire(input, 'input', {});
  h.drain(1);
  t(otp.className.includes('bad'), '错误码进 bad', otp.className);
  t(input.value === '999999', 'bad 时还没清空', input.value);
  h.drain(1);
  t(input.value === '', '抖动结束自动清空', input.value);

  /* 抖动未完就重新输入：t2 必须被 stop() 撤掉 */
  input.value = '999999'; input.setSelectionRange(6, 6); fire(input, 'input', {});
  h.drain(1);
  t(h.pending() === 1, 'bad 后有一个待执行的清空', h.pending());
  input.value = '12'; input.setSelectionRange(2, 2); fire(input, 'input', {});
  t(h.pending() === 0, '重新输入后旧清空定时器被 clearTimeout', h.pending());
  t(input.value === '12', '新输入没有被上一次的清空抹掉', input.value);

  /* 粘贴 */
  input.value = ''; input.setSelectionRange(0, 0);
  const ep = fire(input, 'paste', { clipboardData: { getData: () => 'a12 34-56' } });
  t(ep._pd, 'paste 被接管');
  t(input.value === '123456', '粘贴一次填满并过滤', input.value);
  t(input.selectionStart === 6, '粘贴后光标到末尾', input.selectionStart);
  h.drain(1);
  t(otp.className.includes('ok'), '粘贴满位后校验通过', otp.className);

  fire(input, 'paste', { clipboardData: { getData: () => 'abc' } });
  t(live.textContent.includes('没有数字'), '无数字剪贴板有播报', live.textContent);

  /* 位数切换 */
  fire(input, 'keydown', { key: 'Escape' });
  const L4 = DOC.getElementById('L4'); L4.value = '4'; check(L4, true);
  fire(L4, 'change', {});
  t(cellsEl.children.length === 4, '切成 4 格', cellsEl.children.length);
  t(input.attrs['aria-label'] === '4 位验证码', 'aria-label 跟随位数', input.attrs['aria-label']);
  input.value = '1234'; input.setSelectionRange(4, 4);
  fire(input, 'input', {}); h.drain(1);
  t(otp.className.includes('ok'), '4 位正确码通过', otp.className);

  const L8 = DOC.getElementById('L8'); L8.value = '8'; check(L8, true);
  fire(L8, 'change', {});
  t(cellsEl.children.length === 8, '切成 8 格', cellsEl.children.length);
  const L6 = DOC.getElementById('L6'); L6.value = '6'; check(L6, true);
  fire(L6, 'change', {});
  t(input.value.length <= 6, '位数变小时 value 被截断', input.value);

  /* 掩码 + 错误演示 */
  const cMask = DOC.getElementById('cMask'); check(cMask, true);
  fire(cMask, 'change', {});
  t(otp.className.includes('masked'), '掩码类加上');
  t(input.attrs.type !== 'password', '掩码没改成 type=password', input.attrs.type);
  const cMaskOff = DOC.getElementById('cMask'); check(cMaskOff, false);
  fire(cMaskOff, 'change', {});
  t(!otp.className.includes('masked'), '取消掩码');
  fire(DOC.getElementById('badBtn'), 'click', {});
  h.drain(1);
  t(otp.className.includes('bad'), '演示错误态进 bad', otp.className);
})();

/* ============================= 2. range-slider ============================= */
(function () {
  console.log('\n=== range-slider ===');
  const h = M.run('widgets/controls/range-slider.html');
  const rSingle = DOC.getElementById('rSingle'), bub = DOC.getElementById('bSingle');
  const sSingle = DOC.getElementById('sSingle'), sPair = DOC.getElementById('sPair');
  const oRead = DOC.getElementById('oRead');
  const rLo = DOC.getElementById('rLo'), rHi = DOC.getElementById('rHi');
  const paint = () => h.runFrames();

  paint();
  t(rSingle.style.props['--p'] === '32%', '初始 --p=32%', rSingle.style.props);
  t(bub.style.props['--f'] === '0.32', '气泡 --f 是无单位比例', bub.style.props);
  t(bub.textContent === '320', '气泡文本', bub.textContent);
  t(rSingle.attrs['aria-valuetext'] === '320', 'aria-valuetext 初始', rSingle.attrs['aria-valuetext']);
  t(bub.attrs['aria-hidden'] === 'true', '气泡对读屏器隐藏');
  t(oRead.textContent === '320', 'output 初始', oRead.textContent);

  rSingle.value = '760'; fire(rSingle, 'input', {}); paint();
  t(rSingle.style.props['--p'] === '76%', '拖动后 --p 更新', rSingle.style.props['--p']);
  t(rSingle.attrs['aria-valuetext'] === '760', 'valuetext 跟随');
  t(oRead.textContent === '760', 'output 跟随', oRead.textContent);

  rSingle.value = '500'; fire(rSingle, 'input', {}); paint();
  t(rSingle.style.props['--p'] === '50%', '中点 = 50%（frac 减了 MIN）', rSingle.style.props['--p']);

  const before = WIN._q.length;
  rSingle.value = '10'; fire(rSingle, 'input', {});
  rSingle.value = '20'; fire(rSingle, 'input', {});
  rSingle.value = '30'; fire(rSingle, 'input', {});
  t(WIN._q.length - before === 1, '三次 input 只排一帧', WIN._q.length - before);
  paint();
  t(WIN._q.length === 0, '画完即停，空闲无待处理帧', WIN._q.length);

  fire(rSingle, 'pointerdown', {});
  t(sSingle.className.includes('drag'), '按下时 host 加 drag', sSingle.className);
  fireDoc('pointerup', {});
  t(!sSingle.className.includes('drag'), 'window pointerup 清 drag', sSingle.className);

  const cYuan = DOC.getElementById('cYuan'); check(cYuan, true);
  fire(cYuan, 'change', {});
  rSingle.value = '760'; fire(rSingle, 'input', {}); paint();
  t(oRead.textContent === '¥760', '¥ 进 output', oRead.textContent);
  t(rSingle.attrs['aria-valuetext'] === '¥760', '¥ 进 valuetext', rSingle.attrs['aria-valuetext']);
  t(bub.textContent === '¥760', '¥ 进气泡', bub.textContent);

  /* 双滑块 */
  const mPair = DOC.getElementById('mPair'); check(mPair, true);
  fire(mPair, 'change', {}); paint();
  t(sPair.hidden === false && sSingle.hidden === true, '模式切换 hidden', [sPair.hidden, sSingle.hidden]);
  const band = sPair.querySelector('.band');
  t(band.style.props['--a'] === '18%' && band.style.props['--b'] === '76%', 'band 两个标记', band.style.props);
  t(oRead.textContent === '¥180 – ¥760', '区间读数', oRead.textContent);

  rLo.value = '900'; fire(rLo, 'input', {}); paint();
  t(+rLo.value === +rHi.value - 10, '下限让开一个 step', { lo: rLo.value, hi: rHi.value });
  t(String(rLo.style.zIndex) === '4', '过半中点后抬起下限', rLo.style.zIndex);
  t(String(rHi.style.zIndex) === '2', '上限沉到底', rHi.style.zIndex);
  rHi.value = '100'; fire(rHi, 'input', {}); paint();
  t(+rHi.value === +rLo.value + 10, '上限同样被让开', { lo: rLo.value, hi: rHi.value });

  const st50 = DOC.getElementById('st50'); st50.value = '50'; check(st50, true);
  fire(st50, 'change', {}); paint();
  t(rSingle.step === 50 && rLo.step === 50 && rHi.step === 50, 'step 写入三个 input', [rSingle.step, rLo.step, rHi.step]);
  const ticks = DOC.getElementById('tSingle');
  t(ticks.children.length === 11, '刻度上限 11 条', ticks.children.length);
  const st1 = DOC.getElementById('st1'); st1.value = '1'; check(st1, true);
  fire(st1, 'change', {}); paint();
  t(ticks.children.length === 11, 'step=1 时仍是 11 条而不是 1001', ticks.children.length);
  t(/left:calc\(/.test(ticks.children[0].attrs.style), '刻度用拇指中心换算', ticks.children[0].attrs.style);
  t(ticks.attrs['aria-hidden'] === 'true', '刻度装饰性、对读屏隐藏');

  const cTicks = DOC.getElementById('cTicks'); check(cTicks, true);
  fire(cTicks, 'change', {});
  t(ticks.style.display === 'block', '刻度开关：显示', ticks.style.display);
  check(cTicks, false); fire(cTicks, 'change', {});
  t(ticks.style.display === 'none', '刻度开关：隐藏', ticks.style.display);

  const mSingle = DOC.getElementById('mSingle'); check(mSingle, true);
  fire(mSingle, 'change', {}); paint();
  t(sSingle.hidden === false && sPair.hidden === true, '切回单滑块');
  t(oRead.attrs['for'] === 'rSingle', 'output for 跟着切', oRead.attrs['for']);
})();

/* ============================= 3. toggle-morph ============================= */
(function () {
  console.log('\n=== toggle-morph ===');
  const h = M.run('widgets/controls/toggle-morph.html');
  const sw = DOC.getElementById('sw'), rd = DOC.getElementById('rd'), rd2 = DOC.getElementById('rd2');
  const root = DOC.documentElement;

  t(sw.tagName === 'BUTTON', '用 button（白送可聚焦 + Space/Enter）');
  t(sw.attrs.role === 'switch', 'role=switch');
  t(sw.attrs['aria-checked'] === 'false', '初始 aria-checked=false');
  t(sw.attrs['aria-label'] === '夜间模式', '有可读名字');
  t(sw.querySelector('.knob').attrs['aria-hidden'] === 'true', '拇指 aria-hidden');
  t(sw.querySelector('.sky').attrs['aria-hidden'] === 'true', '夜空 aria-hidden');
  t(findIn(sw, '.star').length === 5, '5 颗星');
  t(findIn(sw, '.star').every(s => /--i:/.test(s.attrs.style)), '每颗星有 --i 序号');

  fire(sw, 'click', {});
  t(sw.attrs['aria-checked'] === 'true', 'click 翻 true');
  h.runFrames();
  t(rd.textContent === 'true' && rd2.textContent === '夜间', '状态文本同帧同步', [rd.textContent, rd2.textContent]);
  fire(sw, 'click', {}); h.runFrames();
  t(sw.attrs['aria-checked'] === 'false' && rd2.textContent === '白天', '再点回 false');
  h.runFrames();
  t(WIN._q.length === 0, '空闲时没有待处理帧', WIN._q.length);
  t(sw.className.includes('sw') && !/\bis-on\b/.test(sw.className), '状态没有第二份类名');

  const sc = DOC.getElementById('sScale'); sc.value = '1.3';
  fire(sc, 'input', {});
  t(sw.style.props['--scale'] === '1.3', '尺寸只写一个变量', sw.style.props);
  t(DOC.getElementById('oScale').textContent === '1.3×', '尺寸读数');

  const d6 = DOC.getElementById('d600'); d6.value = '600'; check(d6, true);
  fire(d6, 'change', {});
  t(root.style.props['--dur'] === '600ms', '时长写根元素', root.style.props);
  const d15 = DOC.getElementById('d150'); d15.value = '150'; check(d15, true);
  fire(d15, 'change', {});
  t(root.style.props['--dur'] === '150ms', '三档时长都生效');

  const cSt = DOC.getElementById('cSt'); check(cSt, true);
  fire(cSt, 'change', {});
  t(root.style.props['--st'] === '0', '禁用错峰 = --st:0', root.style.props);
  check(cSt, false); fire(cSt, 'change', {});
  t(root.style.props['--st'] === '1', '恢复错峰');

  const html = fs.readFileSync('widgets/controls/toggle-morph.html', 'utf8');
  t(!/localStorage|sessionStorage/.test(html), '组件内没有 storage');
  t(/prefers-reduced-motion/.test(html), 'CSS 里兜住 reduced-motion');
  t(!/clip-path:\s/.test(html), '月牙没有 clip-path 声明（只在注释里出现）');
  t(/\[aria-checked="true"\][\s\S]*?transition-delay/.test(html), '延迟写在 checked 那一侧');
  t(!/transition-delay/.test(/\.star\s*\{[\s\S]*?\}/.exec(html)[0]), '基类不带延迟（关灯方向不排队）');
})();

/* ============================= 4. searchable-select ============================= */
(function () {
  console.log('\n=== searchable-select ===');
  const h = M.run('widgets/controls/searchable-select.html');
  const q = DOC.getElementById('q'), pop = DOC.getElementById('pop'), btn = DOC.getElementById('btn');
  const none = DOC.getElementById('none'), live = DOC.getElementById('live'), combo = DOC.getElementById('combo');
  const tags = DOC.getElementById('tags');
  const rows = () => findIn(pop, '.opt');
  const flush = () => h.runFrames();
  const type = (v) => { q.value = v; q.selectionStart = q.selectionEnd = v.length; fire(q, 'input', {}); flush(); };
  const key = (k) => { const e = fire(q, 'keydown', { key: k }); flush(); return e; };
  const ad = () => q.attrs['aria-activedescendant'];
  /* pop 上的 pointerdown 在浏览器里会冒泡到 document 的"点外面"处理器，
     测试台要手动补这一跳，否则复现不出那个 handled 守卫 */
  const clickRow = (i) => {
    const r = rows()[i];
    fire(pop, 'pointerdown', { target: r });
    fireDoc('pointerdown', { target: r });
    flush();
  };

  t(q.attrs.role === 'combobox' && q.attrs['aria-controls'] === 'pop', 'combobox + aria-controls');
  t(q.attrs['aria-expanded'] === 'false', '初始收起');
  t(q.attrs['aria-autocomplete'] === 'list', 'aria-autocomplete=list');
  t(pop.attrs.role === 'listbox', '弹窗 role=listbox');
  t(btn.attrs['aria-haspopup'] === 'listbox' && btn.attrs.tabindex === '-1', '触发按钮 haspopup 且不在 Tab 序列');
  t(rows().length === 0, '收起时不生成 option');

  q.focus();
  t(DOC.activeElement === q, '输入框可聚焦');

  type('bl');
  t(pop.hidden === false && q.attrs['aria-expanded'] === 'true', '打字即展开');
  t(rows().length === 5, 'bl 命中 5 条', rows().length);
  t(pop.innerHTML.indexOf('<mark>b</mark><mark>l</mark>ur') >= 0, '命中字母被 mark 高亮（连续两位）', pop.innerHTML.slice(0, 160));
  t(rows()[0].attrs.id === 'o0' && rows()[0].attrs.role === 'option', 'role=option + 可被 id 引用');
  t(live.textContent.indexOf('匹配 5 项') >= 0, '计数播报', live.textContent);
  t(ad() === undefined, '未定向时没有 activedescendant');

  t(key('ArrowDown')._pd, 'ArrowDown 被接管');
  t(ad() === 'o0', 'activedescendant 指第一行', ad());
  t(rows()[0].attrs['aria-selected'] === 'true', '第一行 aria-selected');
  t(DOC.activeElement === q, '焦点仍留在输入框（没有把焦点搬进列表）');
  key('ArrowDown'); key('ArrowDown');
  t(ad() === 'o2', '连按到第三行', ad());
  const siv = rows()[2]._siv;
  t(siv && siv.block === 'nearest', 'scrollIntoView block:nearest', siv);
  t(rows().every((r, i) => (i === 2) === (r.attrs['aria-selected'] === 'true')), '同时只有一行 selected');
  key('ArrowUp'); t(ad() === 'o1', '↑ 回一行', ad());
  key('End'); t(ad() === 'o4', 'End 到最后一行', ad());
  key('ArrowDown'); t(ad() === 'o4', '末端不越界', ad());
  key('Home'); t(ad() === 'o0', 'Home 到第一行', ad());
  key('ArrowUp'); t(ad() === 'o0', '首端不越界', ad());
  t(key('a')._pd !== true, '字母键不拦截');
  t(key('Tab')._pd !== true, 'Tab 不拦截');
  t(pop.hidden === true, 'Tab 走时收起（不拦 Tab，但要把弹窗关掉）');

  /* Tab 关掉了弹窗，重新展开再测 Enter 选中 */
  type('bl');
  key('ArrowDown');
  key('Enter');
  t(q.value === 'blur', 'Enter 回填', q.value);
  t(pop.hidden === true && q.attrs['aria-expanded'] === 'false', '单选选中即收起');
  t(ad() === undefined, '收起后移除 activedescendant');
  t(live.textContent.indexOf('已选择 模糊') >= 0, '选中播报', live.textContent);

  fire(q, 'focus', {}); flush();
  t(pop.hidden === false, '重新聚焦展开');
  fire(combo, 'focusout', { relatedTarget: btn }); flush();
  t(pop.hidden === false, '焦点在控件内部不收起');
  fire(combo, 'focusout', { relatedTarget: DOC.getElementById('cMulti') }); flush();
  t(pop.hidden === true, '焦点离开控件才收起');
  t(q.value === 'blur', '收起时保留已选值', q.value);
  fire(combo, 'focusout', { relatedTarget: null }); flush();
  t(true, 'relatedTarget 为 null 时不抛错');

  type('filt');
  t(rows().length === 2, 'filt 命中 2 条', rows().length);
  clickRow(1);
  t(q.value === 'backdrop-filter', '点行选中', q.value);
  t(DOC.activeElement === q, '点行后焦点仍在输入框（pointerdown 阻止默认）');

  type('zzzqq');
  t(rows().length === 0, '无结果时没有 option');
t(none.hidden === false, '空态可见');
  t(pop.hidden === true, '空态时 listbox 不挂载');
  t(none.parentNode !== pop, '空态节点在 listbox 之外', none.parentNode.id);
  t(none.attrs['aria-hidden'] === 'true', '空态 aria-hidden，靠 live 播报');
  t(live.textContent.indexOf('没有匹配项') >= 0, '空态播报', live.textContent);

  const cEmpty = DOC.getElementById('cEmpty'); check(cEmpty, false);
  fire(cEmpty, 'change', {}); flush();
  t(none.hidden === true, '关掉空态开关后不显示');
  check(cEmpty, true); fire(cEmpty, 'change', {}); flush();
  t(none.hidden === false, '再打开空态');

  type('o');
  t(rows().length === 12, '默认上限 12', rows().length);
  t(live.textContent.indexOf('已达上限 12') >= 0, '播报说明被截断', live.textContent);
  const cap6 = DOC.getElementById('cap6'); cap6.value = '6'; check(cap6, true);
  fire(cap6, 'change', {}); flush();
  t(rows().length === 6, '上限切 6', rows().length);
  type('');
  t(rows().length === 24, '空输入时列出全部 24 条', rows().length);

  /* 输入法组合期不过滤 */
  q.value = 'zh';
  fire(q, 'compositionstart', {});
  const n1 = rows().length;
  fire(q, 'input', { isComposing: true }); flush();
  t(rows().length === n1, '组合期间不重新过滤', [n1, rows().length]);
  fire(q, 'compositionend', {}); flush();
  t(rows().length !== n1, '落词后才过滤', rows().length);

  /* 多选 */
  const cap12 = DOC.getElementById('cap12'); cap12.value = '12'; check(cap12, true);
  fire(cap12, 'change', {});
  const cMulti = DOC.getElementById('cMulti'); check(cMulti, true);
  fire(cMulti, 'change', {}); flush();
  t(tags.hidden === false, 'tag 容器出现');
  t(pop.attrs['aria-multiselectable'] === 'true', '多选标 aria-multiselectable');
  type('obs');
  t(rows().length === 3, 'obs 命中 3 条', rows().length);
  clickRow(0);
  t(tags.children.length === 1, '点击累加一颗 tag', tags.children.length);
  t(q.value === '', '多选选完清空输入继续搜', q.value);
  t(pop.hidden === false, '多选后弹窗仍开着');
  const x = tags.children[0].querySelector('button');
  t(x && x.tagName === 'BUTTON' && /^移除 /.test(x.attrs['aria-label'] || ''), 'tag 删除键是真 button + aria-label', x && x.attrs);

  type('obs');
  const dup = rows().filter(r => r.className.includes('picked'))[0];
  t(!!dup, '已选项在列表里标出 picked');
  const n = tags.children.length;
  fire(pop, 'pointerdown', { target: dup });
  fireDoc('pointerdown', { target: dup });      // 同一次点击也会冒泡到 document
  flush();
  t(tags.children.length === n, '重复项不生成第二颗 tag', tags.children.length);
  t(live.textContent.indexOf('已经在已选里') >= 0, '重复选择有播报', live.textContent);
  clickRow(1);
  t(tags.children.length === n + 1, '另一项正常累加', tags.children.length);

  q.value = '';
  t(fire(q, 'keydown', { key: 'Backspace' })._pd, '空输入退格被接管');
  t(tags.children.length === n, '退格删掉最后一颗', tags.children.length);
  DOC.activeElement = DOC.body;
  tags.children[0].querySelector('button').click(); flush();
  t(tags.children.length === 0, '点 × 移除', tags.children.length);
  t(DOC.activeElement === q, '移除后焦点交回输入框', DOC.activeElement.id);
  t(tags.hidden === true, '清空后 tag 容器收起');

  /* 单选/多选切换后 picked 复位 */
  check(cMulti, false); fire(cMulti, 'change', {}); flush();
  t(findIn(DOC.body, '.picked').length === 0, '切回单选清掉 picked 标记');

  /* 点外部 / 触发按钮 */
  fire(q, 'focus', {}); flush();
  t(pop.hidden === false, '聚焦展开');
  fireDoc('pointerdown', { target: DOC.body });
  t(pop.hidden === true, '点控件外收起');
  fire(btn, 'click', {}); flush();
  t(pop.hidden === false && btn.attrs['aria-expanded'] === 'true', '按钮展开并同步 expanded');
  fire(btn, 'click', {}); flush();
  t(btn.attrs['aria-expanded'] === 'false', '按钮再点收起');
  t(WIN._q.length === 0, '空闲无待处理帧', WIN._q.length);

  const html = fs.readFileSync('widgets/controls/searchable-select.html', 'utf8');
  t(/requestAnimationFrame/.test(html), '渲染合帧用 rAF');
  t(/content-visibility/.test(html), '长列表用 content-visibility');
  t(/compositionstart/.test(html) && /compositionend/.test(html), '组合输入两个事件都在');
  t(html.indexOf('https://') < 0 && !/fetch\(/.test(html), '无外链无 fetch');
  t(/:focus-visible/.test(html), '有可见焦点样式');

  console.log('\n' + (fails === 0 ? 'ALL PASS' : fails + ' 个 FAIL'));
  process.exitCode = fails ? 1 : 0;
})();
