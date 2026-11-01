# 橡皮筋回弹列表（Rubber-band List）制作教学

> 目标：列表滚到边界后还能继续拉，越拉越沉，松手弹回，模仿 iOS 的 overscroll 手感。
> 产出文件：[`widgets/interaction/rubber-band-list.html`](../../widgets/interaction/rubber-band-list.html)
> 难度：进阶 · 约 30 分钟

---

## 0. 先想清楚：为什么直接把 `overflow` 改成 `hidden` 就废了

最省事的想法是：既然要自己控制位移，那就别用原生滚动，`overflow: hidden`，`pointermove` 里改 `transform` 好了。

这么做会把列表做成一个很难用的东西。原生滚动白送的东西全丢了：惯性滑动、滚动条、鼠标滚轮、键盘方向键与空格翻页、无障碍树里的滚动区域语义，还有合成器线程独立滚动（主线程卡住时照样能滑）。补齐这些的成本远高于实现一个橡皮筋。

正确结构是：**保留原生滚动，只在"真正越界"的那一小段区间里接管**。位移有两种来源，`scrollTop` 负责范围内的正常滚动，`transform: translateY()` 只负责超出边界的那部分，同一时刻只有一个在动。做好了用户只觉得列表有弹性，做不好就是列表在跟用户抢手势。

---

## 1. 阻尼函数：越拉越沉，且有极限

```js
function damp(x) {
  var t = Math.abs(x) / CFG.c;
  var v = (CFG.dim * t) / (t + CFG.dim);
  return x < 0 ? -v : v;
}
```

这是双曲线（rectangular hyperbola）形式，把它当函数读三件事：

- **单调递增**：拉得越多位移越大，方向永远跟手。
- **有上界**：`t` 很大时 `dim·t / (t + dim)` 趋近 `dim` 但取不到，`dim` 就是"最多能拉出多少像素"。
- **起始斜率是 `1/c`**：`x` 很小时分母接近 `dim`，函数约等于 `x / c`。所以 `c` 管"起步有多沉"，`dim` 管"最多沉到哪"，两个参数管曲线的两段，互不干扰。

本站演示里 `c` 从 0.55 到 5、`dim` 从 60 到 260，默认 `c = 1.2`、`dim = 150`。`c` 拉到 5 时起步斜率只剩 0.2，拖一大截才走一点，硬得像钢板；`c` 小于 1 会反过来把小位移放大，起步很滑但容易失控，只在需要"松垮"手感时才用。

> 坑：`c` 千万不要写 0。`t = |x| / 0` 得到 `Infinity`，`dim·Infinity / (Infinity + dim)` 是 `NaN`，`translateY(NaN)` 整条声明失效，列表瞬间弹回原点。参数面板的下限设成 0.55 就是为了挡这个。

---

## 2. 为什么不能写 `x * 0.5`

线性阻尼最直观，也最错。`x * 0.5` 的问题是**没有上界**：手指拖得越远，位移就等比例跟着远，列表能被拉出屏幕，后面的空白区全露出来；而且拉得越远手感越"空"，因为阻力始终不变。

真实的橡皮筋越拉越沉，恒定系数模拟不了这种变化率。双曲线同时给了起步顺滑和终点有墙，代价只是一个除法。

顺带说一句，`pow` 形式（比如 `x^0.7`）也能做出"越拉越沉"，但它没有天然上界，还得额外 `Math.min` 夹一下；夹完之后曲线在夹点处有个折角，观感生硬。双曲线渐近地贴住上界，没有折角。

---

## 3. 回弹用 transition，不用 rAF 弹簧

```js
function settle() {
  raw = 0; ob = 0;
  track.classList.add('settle');
  schedule();
}
```

```css
.track.settle { transition: transform .45s cubic-bezier(.2, .9, .2, 1); }
.track.dragging { transition: none; }
```

回弹是一次目标明确、只走一趟的运动：从当前 `ob` 回到 0。CSS transition 天生处理"改一个值，浏览器补中间帧"，不用维护速度、阻尼、终止阈值，也不会在收尾后留空转帧。两个类必须成对：拖动中 `transition: none`（否则每帧重启动画，拖起来发糊），松手时加 `settle`。

判断标准是**目标是常量就用 transition，目标是变量就用 rAF**。磁吸那种每帧都在追移动目标的情况用 transition 会被不停重置，只能自己插值；这里目标永远是 0（或者刷新时那个固定停留位），所以白捡一条过渡。

`cubic-bezier(.2, .9, .2, 1)` 是刻意的：第一个控制点靠得很左，位移在一开始就走掉大半，尾段慢，弹回来的第一下有力、落位安静。换成 `linear`，整段速度平均，看着就像"被程序挪回去"，没有任何回弹的味道。

---

## 4. 什么时候必须把手势让给原生滚动

这是整个组件真正的难点，前面都是铺垫。规则只有一句：**已经贴着边界、而且还要继续往外拉，才接管。**

```js
var dy = e.clientY - drag.y0;          // 正 = 手指往下，想看更早的内容
/* 核心判断：贴着边界且还要往外拉，才由我们接管成橡皮筋；
   否则一律当普通滚动处理，把 scrollTop 推进，别让用户觉得列表在抢手势。 */
if (dy > 0 && atTop()) {
  scroller.scrollTop = 0;
  raw = dy;
} else if (dy < 0 && atBottom()) {
  scroller.scrollTop = maxScroll();
  raw = dy;
} else {
  raw = 0;
  scroller.scrollTop = Math.min(maxScroll(), Math.max(0, drag.top0 - dy));
}
ob = damp(raw);
```

注意符号：`dy` 是手指位移，往下拖是想看更早的内容，对应 `scrollTop` 减小，所以 else 分支里是 `drag.top0 - dy`。这个符号写反，列表就跟着手倒着走，是这段逻辑最容易出错的一处。

`raw` 存**未阻尼的越界意图**，`ob = damp(raw)` 才是写进 `transform` 的位移。这个区分很重要：直接把阻尼后的值累加进状态，回弹时手里就没有"原始拖了多少"这个量，阈值判定也要跟着绕。意图保持线性、显示才做阻尼，两边都干净。

边界判断要读 `scrollTop` / `scrollHeight` / `clientHeight`，都是同步布局读取，缓存成 `metrics` 并在 `resize`、刷新结束时作废：

```js
function maxScroll() {
  if (metrics === null) {
    metrics = { max: Math.max(0, scroller.scrollHeight - scroller.clientHeight) };
  }
  return metrics.max;
}
```

`atBottom()` 直接写 `>= maxScroll()`，不加 1px 容差：滚到底时浏览器本来就会把 `scrollTop` 夹在这个值上，判定自然成立；反过来加容差会在"还能滚最后 1px"时提前误判成到底，把那 1px 的正常滚动抢成橡皮筋。

---

## 5. 滚轮：另一条入口，规则要一致

只处理拖动不够，桌面用户第一下是滚滚轮，而 `touch-action` 管不到滚轮，必须单独接 `wheel`：

```js
var d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;   // 行单位换算成像素
if (d < 0 && atTop()) {
  e.preventDefault();
  raw = Math.min(0, raw + d);
} else if (d > 0 && atBottom()) {
  e.preventDefault();
  raw = Math.max(0, raw + d);
} else {
  return;
}
```

三条要点。第一，**`preventDefault()` 只在真要接管时调**，能滚的时候直接 `return`，事件整个还给浏览器，范围内仍是原生加速曲线。第二，`deltaMode === 1` 表示 `deltaY` 的单位是"行"，各浏览器给一行的像素数不一样，这里按 16px 折算，只求量级对。第三，滚轮没有"松手"事件，只能用停顿判定结束：一段时间没有新输入就 `settle()`。

`wheel` 监听必须显式 `{ passive: false }`。浏览器默认把滚轮当可跳过的输入来优化，一旦承诺 passive 又去 `preventDefault`，那次调用会被忽略并在控制台报 Violation，橡皮筋完全不出现。

`Math.min(0, raw + d)` / `Math.max(0, raw + d)` 是防串边界的：向上越界时 `raw` 必须是负数，滚轮突然反向也不能让状态从负直接跳成正。

---

## 6. 提示区、进度与刷新

顶部提示区常驻 46px 高度，靠负 margin 平时藏在列表上方外面，越界位移把它带进视野：

```css
.pull {
  height: 46px; margin-top: -46px;
  opacity: calc(.12 + var(--p) * .88);
}
.pull .arrow {
  transform: rotate(calc(45deg + var(--p) * 180deg));
}
```

`--p` 是 JS 每帧写的进度：`Math.max(0, Math.min(1, ob / CFG.need))`。它写在 `.track` 上，`.pull` 和 `.arrow` 靠继承读到。用 `--p` 驱动透明度和箭头角度，比在 JS 里逐个 `style.opacity` 便宜，也保证两者严格同步。箭头从 45 度转到 225 度，正好是"下拉 → 松手"的语义；`--p` 到 1 时加 `.ready` 类换文案颜色。

刷新是一段有起止的固定运动，不是弹簧：

```js
function startRefresh() {
  track.classList.add('refreshing', 'settle');
  raw = 0;
  ob = CFG.need;             // 停在触发位：提示区刚好全部露出
  schedule();
  ...
}
```

spinner 用 `@keyframes spin` 转，`prefers-reduced-motion` 下把周期拉长而不是关掉：完全静止的 spinner 会让人以为卡住了。回弹时长在该模式下调到 0.1s，保留位移但去掉过程。

演示面板里的「原生滚动对照」把 `touch-action` 在 `none` 和 `pan-y` 之间切换：

```js
scroller.style.touchAction = next === 'custom' ? 'none' : 'pan-y';
```

这是"让手势"的总闸，切过去之后橡皮筋彻底不出现，用户直接体会到原生边界就是硬停。`custom` 写 `none` 的代价也要说清楚：它同时关掉了这个元素上的惯性滚动，所以回弹必须由 JS 负责（我们已经做了），并且 `overscroll-behavior: contain` 要留着，防止滚动链传到外层页面。

---

## 7. 接进真实项目

结构固定成三层就够：外层裁剪，中间 `.scroller` 是唯一带 `overflow` 的元素，内层 `.track` 只写 `transform`。业务上可以做成自定义元素，把 `c`、`dim`、`need` 暴露成属性，刷新时派发事件让父层去取数据。

- 适合：移动端消息流、动态列表、需要"下拉刷新"语义的容器。桌面端也走得通，前提是接了 `wheel`，否则用户滚到边界只会看到硬停。
- 不适合：内容比屏幕短、根本滚不动的容器（`atTop()` 和 `atBottom()` 同时为真，判定乱套，要提前 `return` 完全不接管）、虚拟列表（`scrollHeight` 由占位撑起，边界判定不可靠）、横向轮播（要另写一套 `pan-x`）。
- 触屏上越界位移建议比桌面小一半，手指行程短，`dim` 给到 100 左右就够。
- 主线程被长任务卡住时，JS 驱动的这段橡皮筋会一起卡，而范围内那部分原生滚动仍在合成器线程上跑。这是"只接管一小段"带来的好处，别把它整个换成纯 JS 滚动。

---

## 8. 自查清单

- [ ] 范围内滚动仍走原生 `scrollTop`，只有贴边且继续外拉才接管
- [ ] 阻尼函数有上界，`dim` 是"最多拉出多少"而不是"当前拉了多少"
- [ ] `c` 有下限保护，不会出现除零得到 `NaN`
- [ ] 符号检查：`dy` 为正对应 `scrollTop` 减小
- [ ] 拖动中 `transition: none`，松手时 `settle` 过渡，两类成对切换
- [ ] `scrollHeight` / `clientHeight` 有缓存，`resize` 时作废
- [ ] `wheel` 用 `{ passive: false }`，且只在接管时 `preventDefault`
- [ ] 有停顿定时器负责滚轮回弹，`pointercancel` 也走 `settle`
- [ ] `prefers-reduced-motion` 下缩短回弹而不是删除反馈

## 相关组件

- [拖拽甩卡堆](#/drag-snap-cards)：那里用 `touch-action: none` 抢手势，这里刻意让出手势，正好对照。
- [滚动错峰入场](#/stagger-reveal)：同样和原生滚动打交道，条目入场时机要看 `scrollTop`。
- [长按进度菜单](#/long-press-menu)：`--p` 这种"一个进度变量驱动一片视觉"的写法两边通用。
