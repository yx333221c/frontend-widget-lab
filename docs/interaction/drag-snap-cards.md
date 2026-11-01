# 拖拽甩卡堆（Drag & Snap Cards）制作教学

> 目标：用 Pointer Events 做一叠能拖着甩出去的卡片，速度或位移达标就飞走，否则回弹归位。
> 产出文件：[`widgets/interaction/drag-snap-cards.html`](../../widgets/interaction/drag-snap-cards.html)
> 难度：进阶 · 约 45 分钟

---

## 0. 先想清楚：`mousemove` + `left/top` 那套为什么不成立

老写法是监听 `mousedown` / `mousemove`，在回调里写 `style.left`。桌面勉强能跑，真机上三个问题一起爆：`left` 是布局属性，改一次重排一次；`mousemove` 没有"指针离开元素我还收得到"这回事，甩得快时指针一出卡片边界事件就断流；鼠标和手指要写两套，触屏上手势还被浏览器的滚动、下拉刷新、双击缩放抢走。

Pointer Events 一次解决三条：一个事件名覆盖鼠标、触屏、触控笔；`setPointerCapture` 让事件跟手不放；`touch-action` 用一个 CSS 声明关掉浏览器手势。剩下四件事，缺一件手感就散：拖动中每帧只写一次 `transform`、松手时算得出真实瞬时速度、用速度加位移判定甩出还是回弹、甩出和回弹都交给 CSS 过渡。

---

## 1. 起手：`pointerdown` 与指针捕获

```js
deck.addEventListener('pointerdown', function (e) {
  var el = e.target.closest ? e.target.closest('.card') : null;
  if (!el || !el.classList.contains('top')) return;
  /* 阻止文本选中与浏览器自带拖拽。代价是 pointerdown 的默认焦点行为也没了，
     所以手动 focus 牌堆，保证键盘还能用。 */
  e.preventDefault();
  deck.focus();
  ptr.id = e.pointerId; ptr.card = el;
  ptr.x0 = e.clientX; ptr.y0 = e.clientY; ptr.dx = 0; ptr.dy = 0;
  samples = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }];
  /* 捕获指针：指针移出卡片之后，move/up 仍然发给它。 */
  if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
  el.classList.add('dragging');
}, { passive: false });
```

捕获要理解成"事件改道"，不是"焦点转移"。默认 `pointermove` 发给指针正下方的元素，卡片很窄，甩得快时第二个事件就已经在卡片外面，`move` 断流、`up` 也收不到，界面停在你放手那一帧。`setPointerCapture` 把这条 `pointerId` 的后续事件强制投递给指定元素；忘了调 `releasePointerCapture` 也不会永久泄漏，浏览器在 `pointerup` / `pointercancel` 时自动释放。`pointercancel` 必须接：系统手势（边缘返回、浏览器判定这是滚动）会直接取消指针，不发 `pointerup`，"卡住的卡片"就是这么来的。

`add('dragging')` 只干一件事，关掉这张卡片的过渡：

```css
.card.dragging { transition: none; cursor: grabbing; }
```

拖动中每帧都在改 `transform`，留着过渡等于每帧重启动画，卡片会像在水里漂。

---

## 2. `touch-action: none` 与 `preventDefault` / `passive` 的关系

```css
.deck {
  touch-action: none;                 /* 关键：否则手指横拖会被当成滚动吃掉 */
  user-select: none; -webkit-user-select: none;
}
```

`touch-action` 是声明式的：浏览器在手势开始时读一次 CSS，就知道这块区域能不能参与横向滚动和双击缩放。写 `none` 之后横向拖动完全归 JS，不会出现"拖到一半变成滚页面"。判定在手势起点完成，不等主线程。`preventDefault()` 是运行时的，必须在事件还可取消时调用才有效，这里要它主要是阻止文本选中与浏览器自带拖拽。

两者的联系在 `passive` 上：`{ passive: true }` 是向浏览器承诺"这个回调绝不会 `preventDefault`"，浏览器据此不等 JS 返回就开始滚动。**承诺了 passive 之后再调 `preventDefault()` 无效**，控制台给一条 Violation，手指拖拽照样被滚动吃掉。所以只要打算 `preventDefault`，就得显式 `{ passive: false }`（或不写第三参，默认非 passive）。

---

## 3. 拖动中：事件只记账，写入收进一帧

```js
deck.addEventListener('pointermove', function (e) {
  if (ptr.card === null || e.pointerId !== ptr.id) return;
  ptr.dx = e.clientX - ptr.x0;
  ptr.dy = e.clientY - ptr.y0;
  pushSample(e.clientX, e.clientY, e.timeStamp);
  schedulePaint();
});
```

回调里只更新数据与采样队列，写入放到 rAF；面板调的两个参数都在 `CFG`：

```js
var CFG = {
  th: 520,      // 判定甩出的速度阈值，px/s
  k: 0.02,      // 旋转系数：每 px/s 转多少度
  maxRot: 20,   // 拖动时旋转角上限，度
  win: 120      // 速度采样窗，毫秒
};
function schedulePaint() {
  if (rafId === null) rafId = requestAnimationFrame(paint);
}
var rot = clamp(v.vx * CFG.k + ptr.dx * 0.05, CFG.maxRot);
ptr.card.style.transform =
  'translate3d(' + ptr.dx.toFixed(1) + 'px,' + (ptr.dy * 0.35).toFixed(1) + 'px,0) ' +
  'rotate(' + rot.toFixed(2) + 'deg)';
```

指针事件频率高于屏幕刷新率，一帧内可能挤进两次以上移动。合到帧里之后每帧最多写一次 `transform`，写的是最后一次位置，中间值本来就没人看得见。

旋转角这行最讨巧：只按位移转，卡片转得慢吞吞；加上 `v.vx * CFG.k` 这一项，甩出去那一下才"有劲"。上限 `CFG.maxRot` 一定要有，否则阈值调低后卡片会转得像螺旋桨。牌堆里只有最上面那张能拖（`.card:not(.top) { pointer-events: none; }`），其余靠 `--i` 做层间错位，`render()` 只改这一个变量，位移、缩放、`z-index` 全由 CSS 派生。

---

## 4. 瞬时速度：为什么不能用最后两帧

```js
function pushSample(x, y, t) {
  samples.push({ x: x, y: y, t: t });
  /* 只留最近 5 个点，并丢掉超出时间窗的旧点。
     末帧停顿会让"最后两帧"的速度掉到接近 0，窗口平均才不会被骗。 */
  while (samples.length > 5) samples.shift();
  while (samples.length > 2 && t - samples[0].t > CFG.win) samples.shift();
}
function velocity() {
  if (samples.length < 2) return { vx: 0, vy: 0 };
  var a = samples[0], b = samples[samples.length - 1];
  var dt = Math.max(1, b.t - a.t);
  return { vx: (b.x - a.x) / dt * 1000, vy: (b.y - a.y) / dt * 1000 };
}
```

取最后两个事件点相减是最直接的写法，也是错的。人甩完手之后的几十毫秒里指针往往已经慢下来甚至停住，然后才抬指。最后两帧正好抓到这段停顿，速度接近 0，于是"用力甩但松手前有个停顿"这个最自然的操作被判成没甩动，卡片回弹，用户只觉得界面在拒收他的动作。

改法是把速度定义成"最近一小段窗口内的平均速度"：最多留 5 个点，同时丢掉跨度超过 `CFG.win` 的旧点。两个上限都要，点数上限防高频下窗口过窄，时间上限防低频下窗口过长。勾上「显示速度数值」能验证：慢速拖到一半停住再松手，读数掉到接近 0，卡片回弹。

---

## 5. 判定与回弹：把动画交给 CSS

```js
var fast = Math.abs(v.vx) > CFG.th;
var far = Math.abs(ptr.dx) > halfW;
el.classList.remove('dragging', 'armed', 'neg');
if (fast || far) fly(el, (fast ? v.vx : ptr.dx) > 0 ? 1 : -1, v.vx);
else el.style.transform = '';   /* 回弹：清空内层，让基础规则的 transition 接管 */
```

判定是两条或的关系：`|vx|` 过阈值算甩出，`|dx|` 超过半宽也算。只留一条的话，"慢但很远"和"快但很短"都会被误杀。方向优先看速度符号，速度不足时看位移符号。面板把阈值拉到最大 `1400`，基本只能靠位移翻卡；拉到最小 `120`，一碰就飞。

回弹只有一句赋值：`el.style.transform = ''`。清掉内联样式后元素回到 `.card` 基础规则那条由 `--i` 决定的 `transform`，而它带着 `transition: transform .4s cubic-bezier(.2, .8, .25, 1)`，动画由浏览器补完。

为什么不自己写 rAF 弹簧？回弹是目标明确、只走一趟的运动：从当前位置到原点，CSS 过渡不用维护速度、摩擦、终止阈值，也不留空转帧。磁吸那种目标每帧都在变的运动才需要 JS 插值，因为过渡会被不停重置。判断标准一句话：**目标是常量用 transition，目标是变量用 rAF。**

飞行目标点用 `Math.max(320, deck.offsetWidth * 0.75)` 兜底，窄容器下只按容器宽算可能只飞出一小截，看着像卡在半路。收尾要防一件事：

```js
el.addEventListener('transitionend', settle);
setTimeout(settle, 900);   /* 过渡没能真正跑起来就没有 transitionend，定时器兜底 */
```

`transitionend` 不能当保险栓：它只在过渡真正完成时派发，元素在过渡开始前就被 `display: none` 或移出文档，事件根本不会发生。所以收尾逻辑要写成可重入的：`settled` 布尔量加一次定时器兜底，两条路径收敛到同一次执行。

---

## 6. 计数、键盘与重置

```js
function render() {
  order.forEach(function (el, i) {
    el.style.setProperty('--i', i);
    el.classList.toggle('top', i === 0);
  });
  counterEl.textContent = '剩 ' + order.length + ' 张';
  doneEl.classList.toggle('on', order.length === 0);
}
```

状态只有 `order` 一个数组。计数元素带 `role="status"` 和 `aria-live="polite"`，屏幕阅读器会播报剩余张数；刷完时 `.done` 层浮起，重置按钮把 `gone` / `flying` / 内联样式一次清干净。

键盘路径有两处要想清楚：`pointerdown` 里的 `preventDefault()` 顺手取消了默认聚焦行为，必须补 `deck.focus()`，否则拖完再按方向键没反应；方向键监听挂在 `document` 上，但要对 `INPUT` / `BUTTON` 放行，不然会抢走滑块的左右调参。

`armed` / `neg` 是方向预告：速度一过阈值，对应那侧的图章就亮起，判定发生在松手之前。

---

## 7. 接进真实项目

剥掉控制面板，骨架是：`touch-action: none` + 一次 `setPointerCapture` + 一个记账的 `move` + 一个判定的 `up` + 两条 CSS 过渡。想复用建议拆成 `useDrag({ onMove, onEnd })`，把判定和动画留在业务侧，不同产品对"甩出"的定义差别很大。

- 适合：是/否类卡片选择、可丢弃浮层、底部抽屉横滑关闭。
- 不适合：需要精确落点的排序拖拽（那要命中检测而不是速度判定）、以及必须与页面滚动共存的手势，后者别写 `none`，用 `pan-y` 只让出一个方向。
- 长列表里每项都绑 pointer 事件是浪费，容器上一次委托即可。

> 坑：症状是手指在卡片上横拖，卡片不动，整页跟着横向滚；或者拖到一半卡片悬在原地不回弹也拖不动。原因是没写 `touch-action: none`（手势被浏览器抢走），以及没接 `pointercancel`（系统取消手势时没走收尾）。修法是 `touch-action: none` 加一条 `release` 同时绑 `pointerup` 与 `pointercancel`。

---

## 8. 自查清单

- [ ] 拖拽容器写了 `touch-action: none`，没把 `preventDefault` 当主力
- [ ] 需要 `preventDefault` 的监听显式 `{ passive: false }`
- [ ] `setPointerCapture` / `releasePointerCapture` 成对，`pointercancel` 有收尾
- [ ] 拖动中的那张卡片 `transition: none`
- [ ] `pointermove` 不写样式，写入集中在 `requestAnimationFrame`
- [ ] 速度用窗口平均，不是最后两帧相减
- [ ] 甩出判定同时看速度与位移，回弹交给 CSS 过渡
- [ ] `transitionend` 有定时器兜底，状态不会卡住
- [ ] 有按钮或键盘等价路径，剩余数量对屏幕阅读器可见

## 相关组件

- [橡皮筋回弹列表](#/rubber-band-list)：同样要判定"该不该接管手势"，方向相反，它要主动让给原生滚动。
- [长按进度菜单](#/long-press-menu)：和拖拽抢同一批 `pointerdown`，两者共存时靠容差和时长区分。
- [鼠标追随光斑卡片](#/spotlight-card)：可以叠在最上层卡片上，拖动时高光跟着走，成本几乎为零。
