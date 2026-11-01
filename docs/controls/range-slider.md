# 双色滑块 + 数值气泡（Range Slider）制作教学

> 目标：要一条左半边填充、拇指上方挂数值气泡的滑条，同时不丢原生 range 的键盘和拖动。
> 产出文件：[`widgets/controls/range-slider.html`](../../widgets/controls/range-slider.html)
> 难度：入门 · 约 22 分钟

---

## 0. 先想清楚：从零做 div 滑块要还多少债

看起来最自由的写法是一个 `div` 轨道加一个 `div` 拇指，`pointerdown` 里算比例：

```js
track.addEventListener('pointermove', function (e) {
  var f = (e.clientX - rect.left) / rect.width;
  thumb.style.left = f * 100 + '%';      // 然后自己 round 到 step
});
```

这三行之后你至少要补：

1. `setPointerCapture` 与 `lostpointercapture`，否则拇指拖到轨道外就断手；
2. 点击轨道空白处把值跳到该位置、拖动过程中不允许选中文本、双击不归零；
3. 键盘全套：← → 一个 step，↑ ↓ 同向（很多人只写横向），PageUp / PageDown 大步，Home / End 到端点；
4. `role="slider"` 加 `aria-valuenow` / `aria-valuemin` / `aria-valuemax` / `aria-labelledby`，少一个读屏器就只念"滑块"不念数值；
5. `touch-action:none`，否则移动端横拖被浏览器当成页面滚动。

这些全是能测出来的债。而 `input[type=range]` 五条都自带。所以这个组件的取向是：**原生 input 打底，只自绘外观。** 要改的是颜色、厚度、拇指和气泡，值、边界、步进、键盘都不碰。

顺带说清另一条路：`accent-color` 一行就能给原生 range 换双色，代价是轨道厚度、拇指样式全部听浏览器的。要设计稿里的圆角气泡，就只能自绘。

---

## 1. 清 UA 样式，两条内核分开写

```css
.rng {
  position: absolute; left: 0; top: 28px; z-index: 2;
  width: 100%; height: var(--thumb); margin: 0;
  -webkit-appearance: none; appearance: none;
  background: transparent; outline: none; cursor: ew-resize;
}
.rng::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: var(--thumb); height: var(--thumb);
  margin-top: -7px;                    /* (6 - 20) / 2：runnable-track 不会自动居中 */
}
.rng::-moz-range-thumb {
  appearance: none;
```

三处必须同时写、少一处就出问题的地方：

- **两个 thumb 伪元素都要 `appearance:none`。** 只在 `-webkit-` 那份上写，Firefox 会忽略它，拇指继续画自己的系统样式：白色圆形带一条内阴影，尺寸也不听 `width`/`height`。`::-moz-range-thumb` 那份要单独写一遍。
- **`::-webkit-slider-runnable-track` 的高度必须显式给。** 不写时它有 UA 默认高度，拇指按 track 高度居中，你看到的轨道就偏下、拇指偏上，两者对不齐。把 `--th` 定成 6px，轨道和拇指就在同一水平线上了。
- **拇指要 `margin-top: -7px`。** 算法是 `(track高 - thumb高) / 2`，即 `(6 - 20) / 2`。WebKit 的 thumb 不像 Firefox 会自动居中，忘了这行拇指会挂在轨道下沿。Firefox 那边不需要 margin，写了也没用。

---

## 2. 左侧填充：一个 CSS 变量当渐变硬标

```css
.rng::-webkit-slider-runnable-track {
  height: var(--th); border-radius: 999px;
  background: linear-gradient(90deg, var(--accent) var(--p, 0%), var(--track) var(--p, 0%));
}
```

同一个位置写两次就是一道硬边，不需要 `color-stop` 的第二个值。`--p` 由 JS 按 `(v - min) / (max - min)` 写入：

```js
function pos(el, bubble) {
  var f = frac(+el.value);
  el.style.setProperty('--p', (f * 100) + '%');   // runnable-track 渐变的硬标
  bubble.style.setProperty('--f', f);             // 无单位比例，留给 calc 去乘
  bubble.textContent = fmt(el.value);
  el.setAttribute('aria-valuetext', fmt(el.value));
  return f;
}
function frac(v) { return (v - MIN) / (MAX - MIN); }     // 0 ~ 1
```

注意两个变量的单位不一样：`--p` 是带 `%` 的字符串，`--f` 是无单位数字，因为气泡那边要拿它去乘一个长度。写反了 `calc()` 整条失效，气泡就贴在最左边不动了。

Firefox 有专门的 `::-moz-range-progress`，不用算：

```css
.rng::-moz-range-progress { height: var(--th); border-radius: 999px; background: var(--accent); }
```

> 坑：现象是"拖到一半时拇指比填充多走一截"。原因是把 `--p` 按 `value / max` 算，忽略了 `min`。`min` 不为 0 时（比如音量 20~100）必须减去 `MIN`，也就是上面 `frac()` 里那一行。

---

## 3. 气泡定位：clamp 挡住边界

拇指中心不是轨道宽度，而是 `f * (W - 拇指宽) + 半个拇指`。原生存放拇指时两端各留了半个 thumb，气泡要用同一个换算，不然走到端点会差半个拇指。

```css
.bubble {
  position: absolute; top: 0; z-index: 3;
  left: clamp(var(--bw), calc(var(--f, 0) * (100% - var(--thumb)) + var(--thumb) / 2), calc(100% - var(--bw)));
  transform: translateX(-50%);
}
```

`clamp` 的下限是气泡半宽 `--bw`，上限是 `100% - --bw`，于是气泡在两端只会停止跟随拇指、不会跑出容器。这站组件在 iframe 里被 `overflow:hidden` 裁掉的那一类事故，多半就是缺了这个 clamp。小提醒：clamp 生效后气泡和拇指会有最多几像素的错位，这是把气泡整个留在容器内的代价；不能接受就用 `translateX(-50%)` 加 `margin-left` 微调，或者让气泡在端点改挂到拇指内侧。

显示时机要挑：

```css
.slider.drag .bubble, .slider:focus-within .bubble {
  opacity: 1; transform: translateX(-50%) translateY(-2px);
}
```

默认半透明常亮当刻度用，聚焦或拖动时才实心并上浮。`hover` 也点亮的话，鼠标扫过去整排滑块一起闪，比不加还吵。`.drag` 类挂在 `window` 的 `pointerup` 上清掉，挂在 input 上会漏：拖出滑块再松手，input 收不到这个事件。

---

## 4. `output` 和 `aria-valuetext` 各管一件事

`aria-valuetext` 是读屏器播报的内容。原生 range 默认只念 `aria-valuenow` 那个裸数字，也就是"320"，听的人不知道单位。写 `aria-valuetext="¥320"` 之后就念"¥320"。这条必须在值变化时同步，代码里放在 `pos()` 里。

`<output>` 是**给人眼看的当前读数**，不参与读屏器的值播报，所以演示里给它 `aria-hidden="true"`，免得同一数字被念两遍。它按 `for` 关联到对应的 input，切模式时改一次：

```js
oRead.setAttribute('for', pair ? 'rLo rHi' : 'rSingle');
```

真实表单里反过来：`output` 不加 `aria-hidden`，但也不要给它 `role=status`，否则每拖一步都打断正在念的话。

`label` 也别省。这里用 `aria-label="金额"` 而不是包一个可见 `label`，因为可见标签会占掉一行高度，iframe 的 220px 预算放不下。

---

## 5. 刻度，以及合帧

刻度条要能开关，还要跟着步长变。步长选 1 时理论上有 1001 个刻度，全建出来既糊成一团又白造上千节点，所以取一个上限：

```js
var n = Math.min(11, Math.floor((MAX - MIN) / STEP) + 1);
```

定位复用拇指中心那套换算，刻度才对得齐：

```js
html += '<span style="left:calc(' + f + ' * (100% - var(--thumb)) + var(--thumb) / 2)"></span>';
```

绘制统一走一帧一次：

```js
var raf = null;
function schedule() {
  if (raf) return;
  raf = requestAnimationFrame(function () { raf = null; paint(); });
}
```

拖动时 `input` 事件比刷新率密，直接 paint 会把同一帧的样式写好几遍。排完帧 `raf` 归 null，循环不常驻，空闲时没有任何待处理帧。

## 6. 双滑块变体：两个 input 叠在一条轨道上

DOM 顺序是 `band` → `rLo` → 气泡 → `rHi` → 气泡。区间色带单独一个 `div`，靠两个自定义变量画三段：

```css
.pair .band {
  background: linear-gradient(90deg,
    var(--track) 0 var(--a, 0%), var(--accent) var(--a, 0%) var(--b, 0%), var(--track) var(--b, 0%) 100%);
}
```

同时把 input 自己的填充关掉（`-webkit` 的 track 改回单色，`-moz-range-progress` 设 `transparent`），否则两条填充会打架。

重叠之后有个必须处理的问题：**默认情况下上面那条 input 会吃掉整条轨道的指针，下面那条永远拖不动。** 解法是把 input 整条设为不接收指针，只让拇指恢复：

```css
.pair .rng { pointer-events: none; }
.pair .rng::-webkit-slider-thumb { pointer-events: auto; cursor: grab; }
.pair .rng::-moz-range-thumb { pointer-events: auto; cursor: grab; }
```

代价是"点轨道空白跳到那个值"在双滑块下没了，因为已经没有元素接收那次点击。单滑块模式不受影响。

两个拇指重叠时还要决定谁压着。区间做了不许交叉，谁动谁让开一个 step：

```js
if (+rLo.value > +rHi.value - STEP) rLo.value = Math.max(MIN, +rHi.value - STEP);
if (+rHi.value < +rLo.value + STEP) rHi.value = Math.min(MAX, +rLo.value + STEP);
```

夹到相等会让两个拇指完全重合、抓哪个都分不清，所以留一个 step 的缝。z-index 按"越过中点的那一个抬起来"分配，这样靠近端点时不会一直被另一条压住。

## 7. 接进真实项目

要封装的话，接口就是 `min` / `max` / `step` / `value` / `format`，其余全是样式。适合价格筛选、音量、亮度、进度拖拽这类"0 到 100 的连续值"。不适合的地方：可选值只有几个离散档位（该用 radio 组），以及需要精确输入的数字（旁边一定要留个 `type=number` 入口，滑块对精确值本来就不友好）。

性能上有两点：`--p` 与 `--f` 用 `setProperty` 写在元素行内，改自定义属性会重算渐变与 calc，但不会重排；`transition` 只挂在拇指的 `transform` 和气泡的 `opacity` 上，别给 `width`/`left` 加过渡，那会每帧重排。

可访问性核对：Tab 能聚焦到两个拇指（双滑块下是两次 Tab），← → 按 step 走，Home / End 到端点，PageUp / PageDown 走大步，读屏器念出"价格下限，¥180"。`prefers-reduced-motion` 下关掉拇指缩放和气泡上浮，其余行为不变。

## 8. 自查清单

- [ ] `::-webkit-slider-thumb` 与 `::-moz-range-thumb` 都写了 `appearance:none`
- [ ] `::-webkit-slider-runnable-track` 显式给了高度，拇指带 `margin-top` 居中
- [ ] `frac()` 减了 `MIN`，`min` 不为 0 时填充和拇指对齐
- [ ] 气泡用 `clamp`，两端不出容器
- [ ] `aria-valuetext` 随值更新，单位能被念出来
- [ ] 双滑块只让拇指吃指针，区间不交叉并留一个 step
- [ ] 绘制合帧，`raf` 画完就置空，空闲无待处理帧
- [ ] 键盘：Tab / ← → / PageUp / Home / End 都能改值且有可见焦点环

## 相关组件

- [验证码分格输入](#/otp-input)：同样是"原生 input 打底、外观自己画"，那边接管的是光标而不是填充。
- [形变开关（日 / 夜）](#/toggle-morph)：布尔值不该用滑块，但那里要自己补 ARIA，对比着看更清楚分工。
- [环形进度仪表](#/pie-gauge)：把同一个 `--p` 比例换成 `conic-gradient` 的角度，就是环形读数。
