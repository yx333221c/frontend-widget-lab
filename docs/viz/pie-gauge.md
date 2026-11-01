# 环形进度仪表（Pie Gauge）制作教学

> 目标：一个从 0 转到目标值的圆环，中心数字同步缓动，外圈还能按阈值分段并响应指针。
> 产出文件：[`widgets/viz/pie-gauge.html`](../../widgets/viz/pie-gauge.html)
> 难度：入门 · 约 18 分钟

---

## 0. 先想清楚：用 SVG 画这个环要写多少行

同一个环，SVG 路线长这样（下面这段是对比用的等价实现，不在本组件文件里）：

```html
<circle r="50" cx="60" cy="60" fill="none" stroke="#35d18e" stroke-width="14"
        stroke-dasharray="314.16" stroke-dashoffset="88" pathLength="100"/>
```

难点不在写出来，在维护：`stroke-dasharray` 要的是周长，得算 `2πr`，改了半径就得重算；不想算就把 `pathLength` 设成 100，让 dash 的单位直接变成"百分比"，但那是 SVG 特有的把戏，换个属性就没了；`transform: rotate(-90deg)` 还得配 `transform-origin`，忘了写就从 3 点开始转。

conic 路线把这些全消掉了：

```css
.ring {
  inset: 10px;
  background: conic-gradient(from -90deg, var(--c) 0 var(--p),
                             rgba(255, 255, 255, .07) var(--p) 100%);
}
```

没有周长、没有 `pathLength`、没有 `transform-origin`，`--p` 就是百分比本身。代价也很实在：conic 的段与段之间是硬边界，**没有圆头端点**。想要端点是圆弧，只能回 SVG 用 `stroke-linecap="round"`，或者在 conic 之上再叠两个小圆点冒充端点（本组件没做，它是单值仪表，硬边界反而更像刻度）。

选型的分水岭是"有没有间隙"：连续一根进度条，conic 更短；**多段之间要留空隙**（比如甜甜圈图分块），SVG 更好，因为每段是独立元素，能各自 hover、各自动画、能加 `stroke-linecap`。

---

## 1. mask 挖空中心，而不是盖一个实心圆

```css
.ring {
  -webkit-mask: radial-gradient(closest-side, transparent 76%, #000 77%);
          mask: radial-gradient(closest-side, transparent 76%, #000 77%);
}
```

`mask` 按亮度决定可见度：`#000` 处不透明、`transparent` 处完全透明，中心 76% 半径以内被擦掉，环就出来了。`closest-side` 让渐变的 100% 对应到最近的边，环宽随元素尺寸等比缩放，不用改数字。76% 到 77% 之间那 1% 是抗锯齿过渡带，写成同值也能用，但边缘会带一圈硬锯齿。

和"盖一个实心圆"的差别有两处。一是透明：实心圆会挡住底下的东西，本组件的 `.gauge` 坐在带渐变的深色背景上，盖一层就得挑一层和背景一致的颜色，主题一变就穿帮。二是少一层元素，也就少一层可能拦截事件的方框。

第二点有个反直觉的地方值得实测。我在 headless Chrome 里对挖空的中心点调 `document.elementFromPoint`，返回的仍然是 `.ring`：**mask 只影响绘制，不影响命中区域**，元素整个方框照样吃事件。所以"mask 更利于点击"要打折：它省掉的是多出来的那一层，被 mask 掉的区域本身仍然可点。本组件的 hover 判定因此完全靠手算。

---

## 2. @property：让 conic 能动画的唯一办法

环的动画全靠这一句：

```css
    transition: --p var(--dur) var(--ease), background-color 400ms linear;
```

它默认不生效。CSS 自定义属性没有类型，浏览器只知道 `--p` 的值是字符串 `"72%"`；补间需要知道"两个值之间怎么算中间值"，字符串没有中间值，于是走离散插值：整个时长里保持旧值，最后一帧整体换成新值。表现就是环**啪地跳过去**。

注册之后才有解法：

```css
/* 关键一行：不注册这条规则，--p 就只是字符串，transition 拿它没办法 */
@property --p {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 0%;
}
```

`syntax` 声明类型，浏览器于是知道 `<percentage>` 可以按数值补间。`initial-value` 对 `<percentage>` 这类基础类型是必填的（不写就变成一条无效规则，静默失败，最难查）。`inherits: false` 表示不往下继承：这个环的进度不该渗到子元素里去。

这条对比在本组件里可以亲手开关。勾掉"注册 @property"，CSS 换用一个没注册的 `--q`：

```css
body.unreg .ring {
  background: conic-gradient(from -90deg, var(--c) 0 var(--q),
                             rgba(255, 255, 255, .07) var(--q) 100%);
  transition: --q var(--dur) var(--ease);
}
```

实测两种状态的补间采样（连续读 `getComputedStyle`）：注册时 `--p` 依次是 `72%`、`72.9441%`、`73.885%`、`74.8149%`、`75.723%`，确实在动；未注册时 `--q` 五个采样点全是 `90%`，第一帧就到终点。

严格说"唯一办法"要加个限定：在 CSS 内部让自定义属性参与补间，只有注册这一条路。绕开的办法都不在 CSS 里，比如用 JS 每帧写 `setProperty`，本组件中心数字就是这么做的。

---

## 3. 中心数字：easeOutCubic，时长必须和环一致

```js
var raf = null, shown = 0, from = 0, to = 0, t0 = -1;
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function countUp(target) {
  from = shown; to = target; t0 = -1;          // -1 = "等下一帧的时间戳再定基准"
  if (DUR === 0) { shown = target; num.textContent = target; return; }
  if (!raf) raf = requestAnimationFrame(tick);
}
function tick(t) {
  /* 基准必须取 rAF 传进来的时间戳。用 performance.now() 会拿到比它更晚的值，
     第一帧的 k 就成了负数，easeOutCubic(负数) 也是负数，数字会先倒着走。 */
  if (t0 < 0) t0 = t;
  var k = Math.min(1, (t - t0) / DUR);
  shown = from + (to - from) * easeOutCubic(k);
  num.textContent = Math.round(shown);
  raf = k < 1 ? requestAnimationFrame(tick) : null;   // 跑完就停，不常驻
}
```

为什么是 `easeOutCubic`：`--dur` 用的 `cubic-bezier(.215, .61, .355, 1)` 就是它的贝塞尔形式，两边同一条曲线，数字和环才同步减速。换成 `easeOutQuad` 或 `easeOutExpo`，中段就会看到数字跑在环前面或落在后面。

时长不一致是最容易犯的错。环 `900ms`、数字若用 `600ms`，读起来就是"数字先到 72，环还在慢慢转"，像两个组件各演各的。所以 `DUR` 和 CSS 的 `--dur` 是同一个数，改一处要改两处。

`t0 = -1` 那句是我自己踩出来的。第一版写 `t0 = performance.now()`，结果数字先往下掉再冲上去：rAF 回调收到的 `t` 是这一帧 vsync 的时间戳，可能早于你在上一帧事件里调 `performance.now()` 的时刻，于是 `k` 是负数，`1 - (1-k)³` 也是负数，`shown` 直接减到负值，屏幕上出现 `-38`。基准取 rAF 给的时间戳就没这个问题。

`if (!raf)` 防的是重复排帧：连着拖滑块会调很多次 `countUp`，每次都排一个新循环，几个循环同时写同一个 `textContent`，数字会抖。

---

## 4. 多段 conic：阈值带一次画完

数据分三段写死：

```js
var ZONES = [
  { a: 0,  b: 50,  name: '危险', c: '#ff5f9e' },
  { a: 50, b: 80,  name: '观察', c: '#f7b955' },
  { a: 80, b: 100, name: '良好', c: '#35d18e' }
];
```

当前值落在哪段，就取那段颜色写进 `--c`，环和图例一起变。外圈则把三段拼进一个 `conic-gradient`：

```js
function bandCss(on) {
  var stops = ZONES.map(function (z, i) {
    return (i === on ? z.c : z.c + '40') + ' ' + z.a + '% ' + z.b + '%';
  });
  return 'conic-gradient(from -90deg,' + stops.join(',') + ')';
}
```

非高亮的段拼一个 `40` 透明度后缀，比再算一层颜色省事。一个颜色后面跟两个位置（`c 0 50%`）表示这段颜色从 0 一直保持到 50%，下一段从 50% 接上，边界因此是硬边；只写一个位置的话，每段两端要拆开重复写，字符串长一倍。

要留间隙就在两段之间插一段 `transparent`：`... c 0 40%, transparent 40% 42%, ...`。间隙一多，第 0 节说的"SVG 更合适"就开始成立，因为那时你多半还想给每段单独挂 hover。

---

## 5. hover 高亮：反算扇区

conic 渐变里没有 DOM 可挂 `:hover`，命中区域又只是那个方框（第 1 节验证过），所以只能自己算角度：

```js
var dx = e.clientX - (r.left + r.width / 2);
var dy = e.clientY - (r.top + r.height / 2);
var rad = Math.hypot(dx, dy) / (r.width / 2);
if (rad < 0.84 || rad > 1.04) { setActive(-1); return; }   // 不在环带上
var deg = Math.atan2(dy, dx) * 180 / Math.PI + 90;         // 0 = 正上方，顺时针
if (deg < 0) deg += 360;
setActive(zoneAt(deg / 3.6));
```

三个细节。先筛半径：不筛的话指针在圆心附近晃也能算出一个扇区，而那里根本没有环带。`+ 90` 是因为 `atan2` 的 0 在正右方，而 `conic-gradient` 从 `from -90deg` 起算，两个零点差 90°，不校正会整体错一段。`deg / 3.6` 是 360 度对 100 个百分点的换算。

`setActive` 里我踩过一个静默 bug：初值写成 `var active = -1`，第一句 `if (i === active) return;` 就把启动时的 `setActive(-1)` 挡掉了，外圈背景从没被设过，整条带子是 `none`（透明）。初值改成 `null` 才对：`-1` 既是合法的"无高亮"，就不能同时当"未初始化"。

---

## 6. 参数取值范围与副作用

- `--dur`：演示用 `900ms`。这个数本身不重要，重要的是它必须等于 count-up 的 `DUR`。明显偏短会让环还没看清就停了，偏长则变成"等它转完"。
- mask 的 `76% / 77%`：决定环宽。第一个数调小环变粗，中心数字要跟着缩；调大环细到像刻度线，此时硬边界端点会显得毛糙。
- `inset: 10px`：内圈和外圈的间距。设成 0 两层会重叠出一条脏边。
- 段数：演示是 3 段。再多一段颜色就难分辨，而且每段弧变短，hover 命中的角度小到容易漏。

---

## 7. 接进真实项目

- 真实数据往往不是百分比。先归一化再写 `--p`，阈值也按同一套归一后的值定义，别一边用原始值一边用百分比。
- 首屏从 0 转到目标值这个动作，只适合"值本身不敏感"的场合（仪表、达成率）。如果是刷新后的数字，动画会让人误读成"数值在涨"，直接写终值更好。
- `prefers-reduced-motion`：本组件把 `DUR` 设成 0，`--dur` 也改成 `0ms`，环和数字都直接落终值，交互全部保留。
- 兼容性：`@property` 需要较新的浏览器，我未在旧版本上实测过降级细节；能确认的是不支持时环仍然正确显示，只是没有补间。`mask` 保留了 `-webkit-` 前缀写法。
- 别给 `.band` 也加 `transition: --p`：外圈是静态阈值，跟着进度动会让人以为它也在表达进度。

---

## 8. 自查清单

- [ ] `@property` 的 `syntax` 与 `initial-value` 都写了，缺一个就静默失效
- [ ] 环的 `transition` 时长与 count-up 的 `DUR` 是同一个值
- [ ] 缓动曲线与环一致（`easeOutCubic` 对 `cubic-bezier(.215,.61,.355,1)`）
- [ ] count-up 的基准时间取自 rAF 参数，不是 `performance.now()`
- [ ] 中心用 `mask` 挖空，没有盖实心圆挡背景
- [ ] hover 判定先筛半径再算角度，角度零点与 `from -90deg` 对齐
- [ ] 状态缓存的"未初始化"值不与合法值冲突（`null` 而非 `-1`）
- [ ] `prefers-reduced-motion` 下动画为 0 但交互可用

## 相关组件

- [流光渐变描边](#/gradient-border)：同样依赖 `@property` 才能让 conic 的角度动起来，那里还对比了两种挖空方案。
- [长按进度菜单](#/long-press-menu)：用 conic 画交互反馈环，进度由指针按住时长驱动，不是数据。
- [心跳迷你折线](#/sparkline-heart)：Canvas 路线的对应做法，能画连续波形，也意味着要自己管 DPR 和循环启停。
