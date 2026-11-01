# 可搜索下拉（Searchable Select）制作教学

> 目标：做一个输入即过滤、上下键选行、回车确认的下拉，鼠标键盘都走得通，读屏器也念得对。
> 产出文件：[`widgets/controls/searchable-select.html`](../../widgets/controls/searchable-select.html)
> 难度：高级 · 约 40 分钟

---

## 0. 先想清楚：把当前行写成"DOM 焦点"为什么不对

最常见的写法是给每行一个 `tabindex="-1"`，然后移动焦点：

```js
function highlight(i) {
  rows.forEach(r => r.setAttribute('tabindex', '-1'));
  rows[i].setAttribute('tabindex', '0');
  rows[i].focus();                 // ← 灾难从这里开始
}
```

三个后果：

1. **输入被打断**。焦点从 `<input>` 移到 `<li>`，正在打的字没有归宿；想接着打字得先 Tab 回来。
2. **中文输入法的候选窗关闭**。焦点一动，`composition` 会话结束，正在拼的拼音被丢掉或落地成半截字符。
3. **读屏器念两遍**。焦点移动本身就是一次播报；它还把"焦点所在"当成选择结果，用户按 ↓ 只是看一眼，却被当成已经选了。

正确做法是焦点始终钉在输入框上，用 `aria-activedescendant` 指认当前行。至于 `<select>` 为什么不够用：它的选项文案是纯文本，做不到命中高亮、双列排版和输入即过滤，要这些就得自己画，代价是键盘与 ARIA 全部补齐。

---

## 1. 骨架：三个角色和六个属性

```html
<div class="combo" id="combo">
  <input id="q" type="text" role="combobox" autocomplete="off" spellcheck="false"
         aria-controls="pop" aria-expanded="false" aria-autocomplete="list"
         aria-label="搜索前端技术">
  <button id="btn" type="button" tabindex="-1"
          aria-haspopup="listbox" aria-expanded="false" aria-controls="pop"
          aria-label="展开候选列表">▾</button>
  <ul id="pop" role="listbox" aria-label="候选列表" hidden></ul>
</div>
```

`autocomplete="off"` 必须写，否则浏览器自己的下拉建议会和弹窗叠在一起，两套建议同时抢 `↓`。触发按钮 `tabindex="-1"`：整套控件对外只有一个 Tab 停靠点，就是输入框；`aria-haspopup="listbox"` 告诉读屏器这里能展开列表。行在渲染时生成：

```js
html += '<li class="opt' + (it.picked ? ' picked' : '') + '" role="option" id="o' + k + '"' +
        ' aria-selected="' + (k === act ? 'true' : 'false') + '">' +
        '<span class="nm">' + nm + '</span><span class="cn">' + cn + '</span>' +
        '<span class="py" aria-hidden="true">' + esc(it.py) + '</span></li>';
```

每行必须有 `id`，因为 `aria-activedescendant` 只能按 id 引用。`aria-selected` 跟着内部索引 `act` 走，同一时刻只有一行是 `true`。拼音列 `aria-hidden`：那是给人眼看的提示，读屏器念出 `mh` 没有意义。

---

## 2. 匹配：子序列打分，连续和首位各加分

数据是 `[技术名, 中文别名, 别名拼音首字母]` 三元组，共 24 条。三个字段各跑一次子序列匹配，取分高的那个作为高亮目标：

```js
function subseq(hay, needle) {
  var pos = [], j = 0, i = 0, bonus = 0, run = 0;
  while (i < hay.length && j < needle.length) {
    if (hay.charAt(i) === needle.charAt(j)) {
      /* 紧挨着上一个命中就续上连击，否则重开 */
      run = (j > 0 && pos[j - 1] === i - 1) ? run + 1 : 1;
      bonus += run;
      pos.push(i); j++;
    } else { run = 0; }
    i++;
  }
  if (j < needle.length) return null;              // 连子序列都凑不齐
  return { score: needle.length + bonus + (pos[0] === 0 ? needle.length * 2 : 0), pos: pos };
}
```

三点说明：

- **返回 `pos` 而不是布尔**。高亮要知道命中在哪几个下标，打分顺手带出来，不必二次扫描。
- **`bonus += run` 让连续命中权重递增**。`blu` 命中 `blur` 前缀拿到 `1+2+3`，零散命中只拿到 `1+1+1`。这条决定了输入 `bl` 时 blur 排在 mix-blend-mode 前面。
- **首字符命中额外加 `needle.length * 2`**。整词前缀是最常见的意图。

实测顺序（取自演示）：`bl` → blur、backdrop-filter、mix-blend-mode；`mh` → 只有 blur。`bl` 命中 `mix-blend-mode` 不是 bug，`b` 在 blend、`l` 在 visible，确实是子序列。

---

## 3. 高亮与转义

```js
function markUp(text, pos) {
  var set = {}, i;
  for (i = 0; i < pos.length; i++) set[pos[i]] = 1;
  var out = '';
  for (i = 0; i < text.length; i++) {
    out += set[i] ? '<mark>' + esc(text.charAt(i)) + '</mark>' : esc(text.charAt(i));
  }
  return out;
}
```

逐字符拼，命中位裹 `<mark>`，每个字符都过 `esc()`，因为这段字符串最后进了 `innerHTML`。空态回显用户输入同理：

```js
none.innerHTML = '<b>没有匹配「' + esc(q.value) + '」的项</b>，换个说法或清空重来。';
```

`mark` 默认自带黄底，演示里改成透明底、只换强调色，才不像贴了荧光笔。空态是 listbox 的兄弟节点，不是它的子节点：

```html
<ul id="pop" role="listbox" aria-label="候选列表" hidden></ul>
<!-- 空态是 listbox 的兄弟节点：listbox 的子节点只能是 option -->
<div class="empty" id="none" aria-hidden="true" hidden></div>
```

`role="listbox"` 里塞一个没有 `role` 的 `div`，读屏器会把它当成一个无名选项念出来，总数也多一项。所以空态挂 `aria-hidden`，改由 `role="status"` 播报。

---

## 4. `aria-activedescendant`：焦点不动，当前行照变

```js
function move(d) {
  if (!hits.length) return;
  open = true;
  act = d > 0
    ? Math.min(hits.length - 1, act + 1)
    : Math.max(0, (act < 0 ? hits.length : act) - 1);
  render();
  var el = pop.children[act];
  if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
}
```

`render()` 末尾写属性：

```js
if (act >= 0 && hits.length) q.setAttribute('aria-activedescendant', 'o' + act);
else q.removeAttribute('aria-activedescendant');
```

第一次按 ↓ 之前没有"当前行"，所以 `act = -1` 且属性被移除，而不是指向第 0 行；属性一直挂着，读屏器会以为已经选定了第一项。`act < 0` 时按 ↑ 从列表尾开始、按 ↓ 从第 0 行开始，两个方向都夹在 `[0, hits.length-1]`，到末尾再按 ↓ 会停住而不绕圈。

键盘分支集中在一个 `keydown` 里，只在必须接管时 `preventDefault`：

```js
if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
  e.preventDefault(); move(e.key === 'ArrowDown' ? 1 : -1);      // 没开时也先开
} else if (e.key === 'Home' || e.key === 'End') {
  if (open && hits.length) {
    e.preventDefault();                                          // 否则 Home/End 归输入框光标
    jump(e.key === 'Home');
  }
} else if (e.key === 'Enter') {
  if (open && hits.length) { e.preventDefault(); pick(act < 0 ? 0 : act); }
} else if (e.key === 'Escape') {
  if (open) { e.preventDefault(); closePop(); }
  else if (q.value) { e.preventDefault(); q.value = ''; act = -1; render(); }
}
```

`Home` / `End` 只在弹窗展开且有结果时接管，否则属于输入框的光标移动。**字母数字键一个都不拦**，输入法组合、退格删字、全选都交回浏览器——拦了键，中文输入就废了。另外两条：`Backspace` 在多选且输入框为空时删最后一颗 chip；`Tab` 不拦（焦点本来就该走）但要关掉弹窗。`Escape` 分两段：开着只关列表，已关才清空输入。

---

## 5. 开合判定：`focusout` + `relatedTarget`

不要自己写焦点陷阱。浏览器已经在事件里告诉你焦点要去哪：

```js
combo.addEventListener('focusout', function (e) {
  if (!open) return;
  if (e.relatedTarget && !combo.contains(e.relatedTarget)) closePop();
});
```

三个分支要记：`relatedTarget` 还在 `combo` 内就不收（焦点只是挪到触发按钮）；在 `combo` 外才收；为 `null` 时不判，交给 `pointerdown`——点页面空白时部分浏览器给出的就是 `null`，这时也收就会和点击处理抢同一次操作。

鼠标那条链：

```js
/* 点行选中。用 pointerdown 是因为 blur 会先于 click 到来，等到 click 时弹窗已经关了 */
pop.addEventListener('pointerdown', function (e) {
  var row = e.target.closest ? e.target.closest('.opt') : null;
  if (!row) return;
  e.preventDefault();                               // 保住输入框的焦点
  handled = true;                                   // 交给下面的 document 处理器跳过
  act = parseInt(row.id.slice(1), 10);
  pick(act);
});

document.addEventListener('pointerdown', function (e) {
  if (handled) { handled = false; return; }
  if (open && !combo.contains(e.target)) closePop();
});
```

> 坑：现象是"多选模式下点一行，chip 加上了，但弹窗同时被关掉，没法连续选"。原因是这次 `pointerdown` 先跑 `pop` 的处理器（选中并重建了 `pop.innerHTML`），再冒泡到 `document` 的"点外面"处理器；那一刻 `e.target` 是刚被替换掉、已脱离文档树的旧节点，`combo.contains()` 返回 `false`，于是被误判成点了外部。修法是 `handled` 一次性标志。别用 `setTimeout` 错峰，那会引入一帧的竞态。

另一个错法是 `e.stopPropagation()`：挡住了 document 处理器，也挡住了以后要加的监听。`pointerdown` + `preventDefault()` 才是保住输入框焦点的正解。

---

## 6. 性能与滚动定位

**合帧。** `input` 在一次快速输入里触发很多次，每次都重建列表就是浪费：

```js
var raf = null;
function schedule() {
  if (raf) return;
  /* 一次 input 事件可能连着触发过滤、滚动、计数播报；合到一帧里只写一次 DOM */
  raf = requestAnimationFrame(function () { raf = null; render(); });
}
```

`if (raf) return` 是去重，画完立刻把句柄置空，空闲时没有待处理帧。24 条候选时这点开销无所谓，换成上千条就是决定性的差别。

**条数上限。** 一次性把几百条写进 `innerHTML` 是掉帧主因：解析、建节点、排版全在同一帧里。

```js
var lim = n ? CAP : DATA.length;
var capped = list.length > lim;
hits = list.slice(0, lim);
if (act >= hits.length) act = hits.length - 1;     // 上限调小之后旧的高亮位会越界
```

上限做成三档（6 / 12 / 20）。两个细节：空输入时不设上限，让用户靠浏览看完全部 24 条；被截断时把总命中数写进播报（`匹配 6 项（已达上限 6，共 14 项）`），否则用户以为自己搜到的就只有这么多。

**`content-visibility`。** 这是第二道省刀，但别指望它替代上限：

```css
.opt {
  content-visibility: auto; contain-intrinsic-size: 28px;
}
```

它跳过屏幕外行的渲染，节点仍然全部存在，`aria-activedescendant` 引用的 id 照常有效。真要处理几千条得自己写虚拟化：只渲染可视窗口附近的行，用占位元素撑住总高度，滚动时按 `scrollTop / 行高` 算窗口起点。麻烦在于当前行必须始终被渲染，否则属性会指向不存在的 id。

**滚动定位。**

```js
if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
```

`nearest` 是"这一行已在可视区内就不滚，否则只挪到刚好贴边"。`center` 则每按一次都把当前行搬到中间，哪怕它本来就看得见：连按五次 ↓，前者前四下不动、第五下才挪一点，后者每下都滚一段。弹窗另配 `overscroll-behavior: contain`，避免列表滚到头带动外层页面。

---

## 7. 接进真实项目

封装时对外只需要 `options`、`value`、`placeholder`、`onSelect` 四样，打分函数不依赖 DOM，可原样搬走。可访问性核对（逐条可验证）：

- Tab 只停一次，落在输入框，焦点环可见（`.box:focus-within` 换边框色）。
- 进入时读屏器念"搜索前端技术，组合框"；按 ↓ 念出当前行的 `nm + cn`，即"blur 模糊"。
- 计数播报"匹配 5 项，上下键选择，回车确认。"，截断时带上总数；选中播报"已选择 模糊（blur）。"，多选播报"已加入 模糊，还能继续搜。"，重复项播报"模糊 已经在已选里了。"
- 展开时 `aria-expanded="true"` 同时写在输入框和触发按钮上，收起时改回 `false` 并移除 `aria-activedescendant`。
- 多选补 `aria-multiselectable="true"`；chip 的删除键是真 `<button>`，带 `aria-label="移除 blur"`，Tab 可达，移除后焦点回输入框。

不适合：选项少于 6 个（原生 `<select>` 更好）、带分组层级的树形选择、移动端主屏（原生选择器更顺手，可按 `pointer: coarse` 退回）。

布局：弹窗是 `position:absolute`，不留白就盖住控制面板，所以 `.slot` 预留了与弹窗等高的一段，多选长出 chip 时再用 `.tagging` 把两者一起收矮。

## 8. 自查清单

- [ ] 焦点始终在输入框，没有任何一处 `.focus()` 落在选项上
- [ ] `aria-activedescendant` 指向的 id 在本次渲染里真的存在
- [ ] `autocomplete="off"` 写了，触发按钮 `tabindex="-1"`
- [ ] `Home` / `End` 只在列表展开时接管，字母键一律不拦
- [ ] 中文输入法候选窗不会被过滤打断（`compositionstart/end`）
- [ ] `focusout` 用 `relatedTarget` 判断，`null` 分支交给 `pointerdown`
- [ ] 空态节点不是 `listbox` 的子节点
- [ ] 渲染合帧且 `raf` 画完置空；有条数上限，截断会被播报

## 相关组件

- [验证码分格输入](#/otp-input)：同为接管输入，那边靠 `selectionStart` 定位光标，这边靠 `aria-activedescendant` 定位当前行。
- [形变开关（日 / 夜）](#/toggle-morph)：布尔值的正确容器是 `button[role=switch]`，不是 combobox，对比着看角色分工。
- [双色滑块 + 数值气泡](#/range-slider)：原生控件打底，连 ARIA 都不用补；本组件是自绘控件，ARIA 要自己搭齐。
