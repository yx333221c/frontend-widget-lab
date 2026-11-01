# 鼠标追随光斑卡片（Spotlight Card）制作教学

> 目标：卡片内的高光和边缘描边实时跟着指针走，指针离开后干净淡出，一排卡片互不干扰。
> 产出文件：[`widgets/interaction/spotlight-card.html`](../../widgets/interaction/spotlight-card.html)
> 难度：入门 · 约 15 分钟

---

## 0. 先想清楚：给卡片加个 `:hover` 渐变为什么不够

最常见的写法是把渐变写死在 hover 状态上：

```css
.card:hover { background: radial-gradient(circle 150px at 50% 50%, rgba(36,211,238,.18), transparent); }
```

三个问题。光斑位置固定，指针在左上角和在右下角亮的是同一个地方，"追随"没有发生；从 `background: none` 切到带 `background-image` 的状态无法插值，进入时是硬闪；渐变只作用在背景层，描边拿不到指针信息，卡片整体仍然像"一块变色"。

追随只有一条路：把指针坐标交给 CSS，让渐变自己重新求值。维护两个变量 `--mx/--my`，渐变写成 `at var(--mx) var(--my)`，JS 的工作退化成一句：把视口坐标换算成卡片局部坐标。剩下三处容易写错：变量声明在哪、描边怎么挖空、样式什么时候写。

---

## 1. 变量写在元素自己身上，而不是 `:root`

```css
.card {
  --mx: 50%; --my: -20%;
  --r: var(--spot-r, 150px);
  --a: var(--spot-a, .18);
}
```

```js
p.el.style.setProperty('--mx', (p.x - b.left).toFixed(1) + 'px');
p.el.style.setProperty('--my', (p.y - b.top).toFixed(1) + 'px');
```

网上大量教程写的是 `document.documentElement.style.setProperty('--mx', x)`。单卡片看不出问题，一排卡片立刻崩：所有卡片引用同一组数，指针移到第三张，第一张的光斑跑到卡片外面，因为对第一张来说那个坐标越界了。自定义属性的继承方向是父传子，要让每张卡片有独立一份，就得写在卡片自己身上，覆盖它自己的默认值。

默认值 `-20%` 也有用。CSS 变量没有初始值，未设置时引用它的那条声明整体失效；把默认圆心放在卡片上方外面，未悬停的卡片天然没有高光，不需要清理代码。

半径和亮度走另一条路：面板改根元素上的 `--spot-r/--spot-a`，卡片里用 `--r: var(--spot-r, 150px)` 中转。全局参数和每元素状态分开命名，两套写法才不会互相踩。

---

## 2. 高光层：只有 `opacity` 参与过渡

```css
.card > .glow {
  position: absolute; inset: 0; z-index: 0;
  border-radius: inherit;
  pointer-events: none;
  background: radial-gradient(circle var(--r) at var(--mx) var(--my),
    rgba(36, 211, 238, var(--a)) 0%,
    rgba(124, 92, 255, calc(var(--a) * .55)) 40%,
    transparent 72%);
  opacity: 0;
  transition: opacity .35s ease;
}
```

`circle <长度> at <位置>` 是显式尺寸写法。默认的 `farthest-corner` 让半径跟着卡片宽高走，滑块上的数字没有物理含义；显式给长度之后，`--r` 就是屏幕上真实的像素半径。

要紧的是只给 `opacity` 设过渡，不给位置设过渡。位置一旦被插值（用 `@property` 注册后过渡，或 JS 里 lerp），快速划过时光斑会拖在后面，看着发糊。追随类效果的基本要求是跟手，需要"黏"的手感是磁吸那类组件的事。

高光用真实元素 `.glow`，描边用伪元素 `::before`，两者都要 `pointer-events: none`，否则覆盖层吃掉文本选中和点击。

---

## 3. 双层遮罩挖出流动描边

```css
.card::before {
  content: ""; position: absolute; inset: 0; z-index: 1;
  border-radius: inherit;
  padding: 1px;
  background:
    radial-gradient(circle var(--r) at var(--mx) var(--my),
      rgba(36, 211, 238, .95) 0%, rgba(124, 92, 255, .5) 36%,
      rgba(255, 255, 255, .10) 74%),
    linear-gradient(140deg, rgba(255, 255, 255, .22), rgba(255, 255, 255, .04));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}
```

分三步读。第一，渐变铺满整块，写 `padding-box`（默认）或 `border-box` 都覆盖得到，这里没有真实 border，两者一样。第二，两层遮罩：`linear-gradient(#000 0 0)` 是纯不透明色图，本身没形状，形状来自 `background-origin` 关键字。第一层写 `content-box`，只覆盖扣掉 padding 之后的中间；第二层不写关键字，沿 `inset: 0` 覆盖整块。第三，`mask-composite: exclude` 对两层取差集，留下的只有 padding 那 1px 的环。渐变满铺，环上每一点颜色随位置变化，指针一动亮部跟着走，就是流光。

描边厚度就是 `padding: 1px`，改成 `2px` 环更粗。不能用真 border 代替：border 挤占内容盒，而 padding 在这里只用来划分 content-box 边界。

前缀现实有三条：

1. 标准属性 `mask-composite` 的取值是 `add | subtract | intersect | exclude`；`-webkit-mask-composite` 用另一套枚举，`exclude` 在那里是非法值会被丢掉，对应写法是 `xor`。两个都得写。
2. `mask` 和 `-webkit-mask` 简写都会重置 `mask-composite`。把 composite 写在 mask 之前等于没写，这段 CSS 失效基本都是这个原因。本站顺序固定：两个 shorthand，再 `-webkit-mask-composite: xor`，再 `mask-composite: exclude`。
3. 要照顾不支持遮罩的浏览器，就补一条 `border: 1px solid rgba(255,255,255,.12)` 兜底，遮罩生效后两者各画各的。

---

## 4. 为什么 `pointermove` 里不该每帧调 `getBoundingClientRect()`

```js
var dirty = true;
function mark() { dirty = true; }
window.addEventListener('scroll', mark, { passive: true });
window.addEventListener('resize', mark);

function flushRects() {
  if (!dirty) return;
  for (var i = 0; i < cards.length; i++) {
    cards[i].__r = cards[i].getBoundingClientRect();
  }
  dirty = false;
}
```

`getBoundingClientRect()` 是同步布局读取：浏览器必须先算完前面排着的样式失效和布局，才能返回数字。指针移动事件的频率高于屏幕刷新率，每次移动都读一次 rect 就是每帧强制一次 layout；如果读取还发生在"本帧已改过样式"之后，读写交错，掉帧很明显。

所以 rect 只在可能失效的事件之后重算一次：滚动、缩放、会改变布局的键盘操作。缓存挂在 `el.__r` 上，省一个 Map。

另一半是把写入收进一帧：

```js
var pending = null, rafId = null;
function schedule(el, x, y) {
  pending = { el: el, x: x, y: y };
  if (rafId === null) rafId = requestAnimationFrame(write);
}
```

回调里只记坐标，`setProperty` 统一在 rAF 里做。一帧内多次移动只保留最后一次，写样式的次数从"每次移动一次"降到"每帧最多一次"。`pending` 只有一份、`rafId` 排完就置回 `null`，鼠标停下之后没有任何待执行排帧，不需要额外的停循环代码。监听挂在容器上做委托，用 `closest('.card')` 兜住标题、标签这些子元素。

`{ passive: true }` 也别漏：回调不打算 `preventDefault()`，声明 passive 后浏览器不必等 JS 返回就能开始滚动合成。

---

## 5. "跟随越界"与它的修法

指针离开卡片后，`--mx/--my` 停在最后写入的局部坐标上，变量不会自己复位。如果高光常驻可见，你会看到一团亮斑卡在角落。演示里取消「第三张 hover 才淡入」就是这个症状。

修法是把可见时机和坐标更新解耦：

```css
.card:hover > .glow, .card:focus-visible > .glow, .card.on > .glow { opacity: 1; }
.card:hover::before, .card:focus-visible::before, .card.on::before { opacity: 1; }
```

坐标一直在写，但只在悬停、键盘聚焦或触屏按住时不透明，离开后由 `transition: opacity .35s` 淡掉。另一种思路是 `pointerleave` 里把变量复位，但那样会看到光斑滑动着离开，反而更怪。

`.on` 类是触屏兜底：

```js
el.addEventListener('pointerenter', function (e) {
  dirty = true;
  flushRects();
  el.classList.add('on');
  var b = el.__r;
  el.style.setProperty('--mx', (e.clientX - b.left).toFixed(1) + 'px');
  el.style.setProperty('--my', (e.clientY - b.top).toFixed(1) + 'px');
});
el.addEventListener('pointerleave', function () { el.classList.remove('on'); });
```

触屏没有可靠的 `:hover`，靠 enter/leave 加类，按住时亮、抬起淡出。`pointerenter` 里顺手播一次坐标，是为了避免第一帧从上一张卡片的位置瞬移过来。

这个对照是给鼠标环境设计的：触屏上第三张会一直亮着（`.raw` 直接写死 `opacity: 1`，与 `.on` 无关），看到的是"常驻"而不是"离开后残留"。

---

## 6. 可访问性与降级

卡片带 `tabindex="0"`，`:focus-visible` 与 `:hover` 走同一组规则，Tab 也能看到光斑；聚焦时把坐标定在 `50% / 100%`。覆盖层全部 `pointer-events: none`。

`prefers-reduced-motion: reduce` 时关掉 `transition`：光斑仍然跟随，因为它是指针位置的直接反馈而不是自发动画，只是没有淡入淡出。描边只做装饰，关掉「流动描边」后内容完全可读，换亮色主题时也要成立。

> 坑：症状是移开鼠标后别的卡片还亮着一块，或一排卡片高光全在同一处。原因是把 `--mx/--my` 写到 `:root`，多元素共用一组变量。修法是在元素自己的规则里声明默认值，JS 只 `element.style.setProperty()` 当前那块卡片。

---

## 7. 接进真实项目

剥掉控制面板，核心是一层高光、一层遮罩描边、一个委托的 `pointermove`，不改业务 DOM：

```html
<div class="spotlight-grid">…卡片…</div>
```

- 适合定价页、功能网格、文档卡片墙、导航项。导航项要把 `--r` 调小，看起来像一道扫过的高光。
- 不适合长列表（每行两个额外图层，合成开销要实测再决定保留哪些）、正文阅读区（高光干扰文字）、以及已有复杂多层 `background` 的卡片（伪元素与遮罩的 z 序要重排）。
- 遮罩加渐变在部分移动 GPU 上不便宜。移动端建议调小半径和亮度，或者用 `@media (hover: none)` 关掉描边层；省多少本站没测。
- 想要跟随后带一点延迟，不要用 CSS transition 插值位置，改成 JS 每帧 lerp 再写回变量，并且只在指针活跃时排帧。

---

## 8. 自查清单

- [ ] `--mx/--my` 声明在元素自身，不是 `:root`
- [ ] 变量有默认值，未悬停的卡片没有残留高光
- [ ] 描边是 `padding` + 双层 `mask` + `exclude`，`mask-composite` 写在 `mask` 之后
- [ ] 同时给了 `-webkit-mask-composite: xor` 和 `mask-composite: exclude`
- [ ] `getBoundingClientRect()` 不在 `pointermove` 里每帧调用，有 dirty 标脏
- [ ] 样式写入收进 `requestAnimationFrame`，一帧最多一次，静止即无排帧
- [ ] 位置不做过渡，只有 `opacity` 过渡
- [ ] 覆盖层 `pointer-events: none`，键盘 `:focus-visible` 表现一致

## 相关组件

- [磁吸光标](#/magnetic-cursor)：同样要算指针相对元素中心，可复用它的惰性 rect 与衰减思路。
- [拖拽甩卡堆](#/drag-snap-cards)：光斑只读坐标，拖拽要接管坐标，两者对 `touch-action` 的取舍正好相反。
- [长按进度菜单](#/long-press-menu)：在同一批卡片上做长按出菜单，这层高光可当按压反馈复用。
