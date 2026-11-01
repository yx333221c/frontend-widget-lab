# 故障风文字抖动（Noise Glitch）制作教学

> 目标：让一段标题文字出现 RGB 错位与横条撕裂，看起来像信号断了，而不是像文字糊了。
> 产出文件：[`widgets/playful/noise-glitch.html`](../../widgets/playful/noise-glitch.html)
> 难度：进阶 · 约 26 分钟

---

## 0. 先想清楚：`text-shadow` + 平滑来回为什么不对

最常见的两行写法（反例，不是本组件代码）：

```css
/* 反例 */
.bad:hover { text-shadow: 2px 0 #24d3ee, -2px 0 #ff5f9e; transform: translateX(2px); }
```

三处不对。两个阴影是按书写顺序叠放的，不会相加发光，看着是"字后面拖了两片色块"；`transform` 用平滑曲线来回，人眼看到的是抖动而不是断裂；错位和位移绑在同一个元素上，没法让青色和品红各自跳不同的时机。故障感的来源是**离散**与**分层**，这两条它都不占。

所以结构要拆成三层：一份真文字，两份伪元素副本，再加一层噪点。

---

## 1. 三层文字与 `attr()`

```css
  .glitch::before,
  .glitch::after {
    content: attr(data-text);      /* attr() 只在 content 里有效 */
    position: absolute; left: 0; top: 0;
    white-space: nowrap;
    pointer-events: none;
    mix-blend-mode: screen;        /* 叠加混色，而不是盖住主体 */
    opacity: 0;                    /* 静止态：错位层完全不参与 */
  }
```

副本的定位是 `left:0; top:0` 相对 `.glitch`，也就是和真文字完全同位，只做位移不做排版，字宽、字距天然对齐。

`attr()` 只有 `content` 认。写成 `clip-path: inset(attr(data-x) 0 0 0)` 的结果不是"取不到值"，而是整条声明在解析期就被丢掉，属性回落到初始值，症状是"裁剪完全不生效，还不报错"。要把数值喂给别的属性，只能走 CSS 变量：JS 里 `setProperty('--amp', v)`，属性里写 `calc(var(--amp) * 1px)`。本组件的强度滑杆就是这么接的：

```css
    0%   { transform: translate3d(calc(var(--amp) * -1px), 0, 0); }
    25%  { transform: translate3d(calc(var(--amp) * 1px), calc(var(--amp) * .25px), 0); }
```

因为 `content` 只认 `data-text`，改文字必须同时改两处：

```js
  function sync() {
    var v = box.value || ' ';
    g.textContent = v;
    g.setAttribute('data-text', v);   // 伪元素 content 从这份取
  }
```

漏掉第二行的症状很直白：主字变了，两层错色还是旧文字。

---

## 2. `steps()`：故障感的全部秘密在时序函数

```css
  .glitch.run::before { animation: gl-shift 1.4s steps(4, end) infinite alternate; }
  .glitch.run::after {
    animation: gl-shift 1.1s steps(3, end) infinite alternate-reverse,
               gl-tear 2s linear infinite;
  }
```

把 `steps(4)` 换成 `ease`，同样的关键帧会立刻变成"重影"。原因不是审美问题而是采样问题：平滑曲线每帧都在给出新位置，运动被抹成连续轨迹，人眼把它读作模糊；`steps(n, end)` 让插值器在两个关键帧之间只输出 `n` 个离散取值，每次跳变都发生在某一张画面里，跳变之间的所有帧完全静止。闪烁感来自"静止—跳—静止"这个节奏，不来自位移大小。

两个通道用 `1.4s` / `1.1s` 加 `alternate` / `alternate-reverse`，是因为周期互质时青色和品红的错位不会周期性重合，画面不会露出"每 14 秒同步一次"的规律。

`steps(n)` 的 `n` 也不宜大：`steps(12)` 已经接近连续，糊影感又回来了。本组件用 3 和 4，强度滑杆改的是位移量而不是步数，这一点值得抄。

---

## 3. 撕裂横条：为什么每个状态要写两个关键帧

```css
  @keyframes gl-tear {
    0%, 6%      { clip-path: inset(10% 0 calc(100% - 10% - var(--band)) 0); }
    6.6%, 16%   { clip-path: inset(64% 0 calc(100% - 64% - var(--band)) 0); }
```

每条横条的位置都写成一前一后两个相同值。这不是笔误。如果只写 `0%` 和 `16%` 两个点，浏览器会在中间补出一个从 10% 滑到 64% 的动画，横条变成"扫过的光带"，那是加载进度条，不是信号故障。写成 `0%, 6%` 同值，这 6% 里两端点数值一样，插值结果恒等于该值，画面钉住不动；真正的跳变被挤进 `6%` 到 `6.6%` 这不到 1% 的时间里（整个动画 `2s`，即约 12ms），落到画面上就是"上一帧还在 10%，这一帧已经在 64%"。

`inset()` 的四个值是上、右、下、左，所以 `inset(10% 0 calc(100% - 10% - var(--band)) 0)` 表示"上边留 10%，下边留到只剩 `--band` 高的一条"。用 `calc` 而不是直接写下边百分比，是为了让横条厚度能跟着强度滑杆变：

```js
    root.style.setProperty('--band', (34 - v) + '%');   // 越强横条越薄，看起来切片更多
```

> 坑：症状是"横条偶尔整行消失，或者一直不见切片"。原因是 `clip-path` 只认百分比和长度，`inset()` 里写了 `attr()` 或者带单位的混合表达式写错了（比如 `calc(100% - 10% - var(--band))` 里 `--band` 没带 `%`）。变量没值时整条声明无效，浏览器不报错也不裁剪。修法：给 `--band` 一个带单位的初值写在 `:root`，别指望 JS 第一次赋值之前它是对的。

---

## 4. `mix-blend-mode: screen` 而不是 `text-shadow`

错色要"像光"就得相加。`text-shadow` 的多条阴影按书写顺序层叠，后画的压在先画的下面，两束光重叠处仍然是其中一种颜色；`screen` 是逐通道相加取亮，青色叠品红会得到接近白的亮色，这正是 CRT 磷光叠在一起的样子。

用了混合就必须管住它的范围：

```css
  .glitch {
    position: relative;
    isolation: isolate;            /* 把 screen 混合限制在这一块内，见教学 §4 */
```

`mix-blend-mode` 默认会和元素所属层叠上下文里的一切相混合。不隔离时，副本会把整个舞台背景（包括深色底和扫描线）一起提亮，字周围浮起一层灰白。`isolation: isolate` 给 `.glitch` 单独建一个层叠上下文，混合只在它内部发生。这一条经常被漏，症状是"背景在文字后面变亮了一大块"。

---

## 5. 噪点层：`feTurbulence` 的 `seed` 离散推进

噪点用内联 SVG 滤镜现算，不引任何图片：

```html
        <feTurbulence id="turb" type="fractalNoise" baseFrequency="0.92" numOctaves="2" seed="0" stitchTiles="stitch"/>
```

让它"闪"的做法是改 `seed`，而且只在时钟里改：

```js
    var ms = last ? Math.min(t - last, 40) : 16.7;   // 夹住一帧：切后台回来不跳一大步
    last = t;
    acc += ms;
    while (acc > 70) { acc -= 70; seed = (seed + 1) % 1000; turb.setAttribute('seed', seed); }
```

每帧换一次 `seed` 会让整片噪点每帧完全重画，`feTurbulence` 又是相对昂贵的滤镜，肉眼也只是看到"雪花"而没有颗粒跳动；按时间隔采样（这里是每 70 毫秒一次）既能看清离散抖动，也把滤镜重算频率压下来。用 `while` 而不是 `if`，是为了让补帧时次数正确。

SMIL 的 `<animate attributeName="seed" calcMode="discrete">` 也能做，但它不受本组件那个循环管：暂停时得另写一套 `pauseAnimations()`。共用一个时钟的好处是"静止"开关一拨，三层一起停。

---

## 6. 触发模式：常驻很吵

默认 `hover` 是有意的。常驻抖动的文字会持续抢注意力，嵌在真实页面里等于自我 DoS；而且动画一直跑，合成器不会空闲。组件把"该不该动"收进一个函数，DOM 类名是它的结果而不是它的输入：

```js
  function active() {
    if (still) return false;
    if (MODE === 'always') return true;
    if (MODE === 'click') return performance.now() < burstUntil;
    return hovering;
  }
```

`click` 模式记一个到期时间，900 毫秒后自己熄灭并停掉 rAF；`hover` 模式在桌面上靠进出事件，触屏没有 `hover`，就把按下当命中、抬起结束。静止开关等价于 `prefers-reduced-motion` 的降级路径：摘掉 `run` 类、停掉循环，再加一条 CSS 把伪元素的 `opacity` 归零，保证即使类名被别的脚本加回来也不会有动画。系统偏好命中时组件默认就打勾，用户仍可取消。

---

## 7. 接进真实项目

三个机制（离散时序、相邻同值关键帧、隔离的 screen 混合）加起来才是"信号断了"，缺任何一个都会退回"字在抖"。

- 适合：404 / 500 页标题、加载失败的错误提示、游戏或终端风界面的标题、一次性庆祝之外的"警示"时刻。
- 不适合：正文段落（每行都在闪会读不下去）、需要朗读或复制的文本（伪元素副本会被读屏读出来，建议给真文字加 `aria-hidden` 之外的处理，或直接只在纯展示标题上用）、以及任何有 `prefers-reduced-motion` 用户占比高的地方。
- 性能：三层里只有伪元素在动，动的属性是 `transform` 和 `clip-path`。`clip-path` 走不到 GPU 的位移合成，代价高于 `transform`，所以只挂在一个通道上。文字超过两三行时把噪点层的 `--grain` 调低，全屏雪花比错位更耗注意力。

---

## 8. 自查清单

- [ ] 两层副本用 `content: attr(data-text)`，且与真文字同位
- [ ] 时序是 `steps()`，不是 `ease` / `linear`
- [ ] 两个通道的周期互不相同，避免规律性重合
- [ ] 每个撕裂状态都有相邻的两个同值关键帧
- [ ] `clip-path` 里没有出现 `attr()`
- [ ] `.glitch` 上有 `isolation: isolate`，背景不被提亮
- [ ] 默认 `hover` 触发；静止开关能停掉 rAF
- [ ] `prefers-reduced-motion` 下完全静止

## 相关组件

- [手绘风雷达图](#/radar-chart)：同样用 `feTurbulence`，但它是静态抖动，可以对比离散与连续的差别。
- [流光渐变描边](#/gradient-border)：`@property` 让自定义属性能被插值，正好是本文 `steps()` 一节的前置知识。
- [点击撒花](#/confetti-burst)：庆祝型动效，故障风适合报错，两者常挂在同一个交互的两端。
