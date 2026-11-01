# 流光渐变描边（Gradient Border）制作教学

> 目标：让一圈渐变描边随时间旋转，并比较两种把渐变挖成环的做法。
> 产出文件：[`widgets/material/gradient-border.html`](../../widgets/material/gradient-border.html)
> 难度：进阶 · 约 28 分钟

---

## 0. 先想清楚：`--angle` 从 0 动画到 360deg 为什么不转

最常见的写法是这样：

```css
@keyframes spin { to { --angle: 360deg; } }
.glow { animation: spin 6s linear infinite; }
```

它在语法上合法，在浏览器里也"正在运行"，你在开发者工具里能看到动画在跑，描边就是一动不动。三个原因：自定义属性没有类型，浏览器不知道 `--angle` 是长度、颜色还是一段任意 token 串；插值规则因此退化成离散处理，也就是整段动画里要么保持起始值、要么在某一刻换成结束值，中间没有任何过渡；而 `0deg` 和 `360deg` 画出来一模一样，你连那一次换位都看不见。

组件里那枚 `steps(2, jump-none)` 的离散对照元素就是把换位做成了可见的：它让 `0deg → 90deg` 在一个周期里只跳一次，方向是"啪"地换位而不是滑过去。看它一眼就知道漏写 `@property` 是什么效果。

---

## 1. `@property` 是唯一的注册办法

```css
@property --angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: true;
}
```

`syntax` 写成 `'<angle>'`，浏览器就有了插值规则：两个角度之间按数值线性插值。这条规则必须在样式表顶层声明，写在媒体查询或 `@supports` 里面会被忽略。

`inherits` 这个字段在这套实现里是功能性的，不是风格选择。方案 B 的锥形渐变画在 `.t-b::before` 上，而动画挂在 `.t-b` 上；伪元素要能读到父元素正在动画的值，属性必须可继承。把它改成 `false`，伪元素拿到的永远是 `initial-value`，描边立刻静止。

> 坑：症状是加了 `@property` 之后有的浏览器仍然不转。原因有两个方向。其一，`syntax: '<angle'` 少一个尖括号，整条注册失败，属性退回未注册状态；其二，同一份样式里又写了 `--angle: 0deg` 的行内样式或更高层规则，把动画值锁死。修法是先确认注册生效（第 5 节那段检测），再检查有没有别的地方在给这个属性赋静态值。

---

## 2. 挖空方案 A：双层背景加 `background-clip`

```css
.t-a {
  border: var(--w) solid transparent;
  border-radius: var(--rr, var(--radius));
  background:
    linear-gradient(var(--fill), var(--fill)) padding-box,
    conic-gradient(from var(--angle), var(--stops)) border-box;
}
```

原理是把一个元素的背景写成两层，各剪不同的盒：底色层只铺到 `padding-box`，渐变层铺到 `border-box`，于是露出来的那一圈正好是透明边框的位置。`border: ... solid transparent` 里的 `transparent` 是关键，写成任何实色都会盖住下面那层。

它便宜，两行搞定，也不用伪元素。代价是这一圈的内外边界都由 `border-width` 与盒模型决定，你只能整体调，不能单独控制内侧圆角；渐变层的坐标原点也在 border-box 上，圆角一大，内侧那圈的过渡就不干净。

---

## 3. 挖空方案 B：`mask-composite: exclude`

```css
.t-b::before {
  content: ""; position: absolute; inset: 0;
  border-radius: inherit;
  padding: var(--w);
  background: conic-gradient(from var(--angle), var(--stops));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
}
```

两层遮罩：外面那层是整块，里面那层被 `content-box` 收窄成一个内矩形（内缩的量就是 `padding`）。`exclude` 取差集，只留两层的不同部分，也就留出一圈环。

两个必须记住的细节。第一个是顺序：`mask` 是简写属性，它会重置 `mask-composite`，所以合成方式一定写在简写之后，反过来写就等于没写。第二个是前缀名不同：旧 WebKit 只认 `-webkit-mask-composite: xor`，标准名是 `exclude`，两条都要留。`exclude` 从哪一版 Safari 开始可用，本站没有逐版本复测，所以按"两条都写、不做特性分支"处理最省事。

这套方案的优点是环厚完全由 `padding` 控制，内侧边界由 `content-box` 精确给出，圆角怎么改都不会露缝。代价是每个元素多一个伪元素，以及 `mask` 会让元素走一层额外的离屏合成。

---

## 4. 圆角与描边宽度不能任意组合

方案 A 里那一圈的内外两条边界共用同一个 `border-radius` 声明，浏览器折算内侧时会减去边框宽度：

> 内圆角 = 外圆角 − 边框宽度

组件把这条公式做成实时读数，拖滑块能直接看到结果。外圆角 18、描边 3，内圆角 15，仍然圆。外圆角 44、描边 1，内圈接近 43，看起来正常。反过来把描边推到 10、外圆角拉到 6，公式给出负数，浏览器按 0 处理，于是外边圆、内边方，一眼能看出"这圈是个直角框套在圆角框里"。想避免就守一条下限：`border-radius` 至少等于 `border-width`。

圆角是百分比的时候另一回事：`--rr: 50%` 那个圆形头像框，内外圆角都是 50%，减不减宽度都同形，所以圆形反而是最不容易出问题的场景。演示里让 A 负责圆形、B 负责胶囊按钮，就是想看这个分布。

---

## 5. 特性检测：`@supports` 测不了 at-rule

`@supports at-property(--angle)` 不存在，这样的语法会被整条丢弃。`@supports` 只接受 `<declaration>`，也就是判断"某条声明我认不认识"。注册属性是 at-rule，不在这个判断范围里。

可行的做法是反过来问计算值：

```js
var ok = getComputedStyle(root).getPropertyValue('--angle').trim() !== '';
document.getElementById('propOk').innerHTML =
  ok ? '<b>已注册</b>' : '<i>未注册 → 跳变</i>';
```

注册过的属性带着 `initial-value` 出现在计算值里，取到 `0deg`；没注册时这条声明不存在，`getPropertyValue` 返回空串。这一招对其他注册属性同样有效，比检测浏览器版本号可靠。

另外组件对 `conic-gradient` 本身也留了 `@supports not` 分支：换回线性渐变，描边还在，只是不再有旋转。

---

## 6. 控制与暂停

转速滑块拖到 0 时写的是 `animationPlayState = 'paused'`，而不是把 `animation` 去掉。差别在于：暂停保留当前帧的 `--angle`，描边停在任意角度；移除动画则回到 `initial-value` 的 0deg，视觉上像"跳回起点"。做"暂停"这类交互请走时间轴控制。

四个参数里只有 `--w` 和 `--radius` 是自定义属性，圆角那个胶囊形态用 `--rr: calc(var(--radius) + 15px)` 做偏移。`--rr` 不注册也没关系：它没参与动画，只在计算时求值一次。

---

## 7. 接进真实项目

最小包是 3 行：`@property` 注册、`@keyframes`、以及 `conic-gradient(from var(--angle), ...)` 加上你选的挖空方式。封装时用 `data-border="a|b"` 决定挖空分支，颜色和转速从 CSS 变量传入，一份样式能同时喂卡片、按钮、头像框。

适合：定价卡、活动入口、头像框、主按钮。一屏最多两处，两处以上时注意力会被平均掉，效果反而消失。

不适合：长列表和密集网格。每个实例都持有一条持续运行的时间轴，浏览器要不断重绘渐变；同时带遮罩或渐变背景的层也不易被当作普通合成层处理。后台标签页里动画会自己停，但别指望这条规则省多少电：真要收，就在不可见时用 `animation-play-state: paused`。

`prefers-reduced-motion` 下演示只做了一件事：把周期拉到 20s。这条旋转属于装饰性动效，产品里更合适的做法是直接归零，静止的渐变描边仍然完整可读。

---

## 8. 自查清单

- [ ] `@property` 里 `syntax: '<angle>'` 的尖括号成对，声明在样式表顶层
- [ ] `inherits: true`，且渐变所在的那一层能继承到 `--angle`
- [ ] 方案 B 里 `mask-composite` 写在 `mask` 简写之后
- [ ] 同时写了 `-webkit-mask-composite: xor` 与 `mask-composite: exclude`
- [ ] `border-radius` 不小于 `border-width`，或已确认内角退化可以接受
- [ ] 特性检测走计算值，没有用不存在的 `@supports at-property(...)`
- [ ] 暂停用 `animation-play-state`，不是移除 `animation`
- [ ] 一屏内旋转描边不超过 2 处

## 相关组件

- [鼠标追随光斑卡片](#/spotlight-card)：同样用遮罩挖出一圈边缘，那边用指针位置驱动高光，这边用时间驱动角度。
- [环形进度仪表](#/pie-gauge)：`conic-gradient` 加遮罩挖空的另一用法，进度是静态数值。
- [玻璃拟态卡片](#/glass-card)：描边之外的另一种"边缘有方向"的写法，可以对照反射与旋转的差异。
