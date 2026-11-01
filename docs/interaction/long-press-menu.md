# 长按进度菜单（Long-press Menu）制作教学

> 目标：把右键菜单搬到触屏上——按住走满一圈进度才触发，中途移动或提前松手都算取消。
> 产出文件：[`widgets/interaction/long-press-menu.html`](../../widgets/interaction/long-press-menu.html)
> 难度：进阶 · 约 28 分钟

---

## 0. 先想清楚：`setTimeout` + 一条 CSS 转圈为什么不够

直觉实现很短：`pointerdown` 起一个 `setTimeout`，到点弹菜单，同时给一个 `animation: spin .6s linear` 让它转。这段能跑，但有三处说不通。

动画和计时是两条独立时钟：`animation` 从样式生效那一帧开始计时，`setTimeout` 从你调用它的时刻开始，起点不同，中途被浏览器处理的方式也不一定相同，对不齐时就会出现"环只转了半圈，菜单却已经弹了"。取消要做的事比"清定时器"多：环要从当前位置退回 0，而进度存在 CSS 动画里、不在你的状态里，得先把它取回来（`getAnimations()` 或读 computed style），再换一条过渡接上，两套时序对接很容易出跳变。最关键的是，这里要表达的是"进度"这个语义：一圈中任意位置都能读出来、还能反向插值的数，而不是一个只能从头播到尾的动画。

所以正确做法是：**用 `requestAnimationFrame` 按真实时间算出进度 `p`，写成注册的自定义属性 `--p`，让环的弧长、透明度、退场全部从这一个数派生。**

---

## 1. `conic-gradient` 画环，比 SVG 少一层

```css
.tile::after {
  content: ""; position: absolute; left: 50%; top: 50%;
  width: 30px; height: 30px; margin: -15px 0 0 -15px;
  border-radius: 50%; pointer-events: none;
  background: conic-gradient(from -90deg,
    var(--accent) calc(var(--p) * 1turn),
    rgba(255, 255, 255, .12) 0);
  -webkit-mask: radial-gradient(circle closest-side, transparent 0 62%, #000 68%);
  mask: radial-gradient(circle closest-side, transparent 0 62%, #000 68%);
  opacity: calc(var(--p) * 2);
}
```

为什么不用 SVG 的 `stroke-dasharray`？那要在 DOM 里放一个 `<circle>`，算周长 `2πr` 再写 `stroke-dashoffset`，还得旋转让起点落在十二点。这里一个伪元素就够：不多一个节点、JS 不读几何、尺寸改一个 `width` 全跟着变。

第二个色标写成 `rgba(...) 0` 是刻意的：位置比第一个小，浏览器会把它抬到第一个的位置，于是剩下整圈全是底色。换成 `100%` 就不是这个效果，两个色标之间隔着整圈，会拉出一条从强调色渐变到底色的过渡带，进度没走到的区域也在慢慢变色。环心靠径向遮罩挖空，`62%` 到 `68%` 之间留一段斜坡而不是硬切，免得内圈边缘出现看得见台阶。

代价要认下来：`conic-gradient` **做不到圆头端点**。SVG 加一句 `stroke-linecap: round` 就有两颗圆头，渐变是色标切换，两端都是硬切。想要圆头只能再叠伪元素按 `--p` 算圆周坐标，多一段三角函数换一个几乎看不见的细节，本站没做。同一原因，`--p` 很小时弧长不够，环几乎看不见。

`opacity: calc(var(--p) * 2)` 让显隐完全由进度推导：空闲时 `--p` 是 0，环不存在，不需要额外的显示类。

---

## 2. `@property`：让 `--p` 能被插值

```css
@property --p {
  syntax: "<number>";
  inherits: true;
  initial-value: 0;
}
```

未注册的自定义属性在浏览器眼里是一串未解析的 token，**不参与插值**，给它做过渡只会从旧值瞬间跳到新值。注册之后 `--p` 有了类型，基础规则里的 `transition: --p .16s ease-out` 才生效，取消时那一圈退回去的动画全靠它：

```js
el.classList.remove('pressing');
el.style.removeProperty('--p');   // 回到 initial-value: 0，过渡负责淡出
```

`inherits` 必须是 `true`，因为消费 `--p` 的是 `.tile::after`。伪元素不是 DOM 子节点，但继承来源是对应元素；注册成 `false` 的话伪元素只读到 `initial-value`，环永远不亮。现象是"代码看着全对但环不动"。

反过来，**按住期间这条过渡必须关掉**，否则每帧写 `--p` 都被插值拖慢半拍，环转起来像在水里：

```css
.tile.pressing { transition: none; transform: scale(.97); background: rgba(255,255,255,.075); }
```

不支持 `@property` 的老浏览器不会报错，只是取消时没有平滑退场，每帧写值仍然显示，所以不必写特性检测。

---

## 3. 计时：进度由时间戳算出来

```js
function tick(t) {
  if (!press) return;
  var p = (t - press.t0) / durationOf(press.type);
  if (p >= 1) { press.p = 1; setP(press.el, 1); fire(); return; }
  press.p = p < 0 ? 0 : p;
  setP(press.el, press.p);
  press.raf = requestAnimationFrame(tick);
}
function durationOf(type) {
  return type === 'touch' ? Math.round(CFG.hold * 0.75) : CFG.hold;
}
```

`t` 是 rAF 给的时间戳，起点 `t0` 在 `pointerdown` 里用 `performance.now()` 取。这样算出的 `p` 与刷新率无关：60Hz 和 120Hz 走满的时间一样，只是中间帧更密。`fire()` 和 `cancel()` 两条路径都要 `cancelAnimationFrame`，循环只在按住期间存在，松手即止。

时长按 `pointerType` 折算，不把三种输入都当鼠标：`touch` 取 `hold × 0.75`，`mouse` 和 `pen` 用满值。手指按住不动比鼠标难稳定，容错该高一点；笔在实践中通常直接映射成右键语义，所以跟鼠标同档。

---

## 4. 必须监听 `pointermove` 来取消

```js
grid.addEventListener('pointermove', function (e) {
  if (!press || e.pointerId !== press.id) return;
  /* 必须监听 move 并取消：不监听的话，手指滑到别的图块上
     还会把菜单弹在原来那一块，"按住不动"和"按住后拖"也分不开。 */
  if (Math.abs(e.clientX - press.x0) > CFG.tol || Math.abs(e.clientY - press.y0) > CFG.tol) {
    cancel();
  }
});
```

这不是体验优化，是防误触的硬要求。人按住之后手指会自然漂移，不判位移会有两种事故：本意按隔壁那块却弹出当前这块的菜单，以及"按住不动"和"按住后拖"两种手势分不开。判据跟按下那一刻的 `x0/y0` 比，比的是累计距离而非速度，所以慢慢移动也照样取消。

`CFG.tol` 演示范围 3 到 24，默认 8。太小（3~4）手抖就取消，用户会觉得这功能根本按不出来；太大（20 以上）就和拖拽抢手势。真实项目常给触屏单独的更大容差，本站用统一值。

`pointerup` 时进度没走满也当取消，不是"部分触发"：

```js
function end(e) {
  if (!press || (e && e.pointerId !== press.id)) return;
  cancel();        // 没走满就松手 = 取消，不是"部分触发"
}
```

`cancel()` 里还加了个播报门槛：进度没走出一小截就不提示。少了它，每次普通点击都会冒一句"已取消"。

---

## 5. `contextmenu` 与 `user-select`

```css
.tile {
  touch-action: none;                 /* 触屏：别让长按变成滚动或文本选中 */
  -webkit-touch-callout: none;        /* iOS：关掉系统那套长按气泡 */
  user-select: none; -webkit-user-select: none;
}
```

`contextmenu` 要 `preventDefault()` 有两个理由。触屏上系统在长按结束时派发它并弹出原生菜单，和自绘菜单叠在一起，用户不知道该看哪个；iOS Safari 还会走 `-webkit-touch-callout` 那条路（存图、拷贝整块），必须用上面那条 CSS 拦掉。桌面上反过来利用它：右键直接进菜单，不必强求长按。

`user-select: none` 拦的是长按拖出选区、文字变成高亮蓝块。写了 `touch-action: none` 就没有原生滚动手势，长按菜单不需要滚动，这个取舍可以接受。

---

## 6. 菜单：焦点、方向键与 Esc

结构用 `<ul role="menu">` 加 `<li role="none">` 包 `<button role="menuitem">`。`li` 要显式写 `role="none"`：默认的 `listitem` 在 `menu` 里非法，屏幕阅读器读出的层级会和实际交互不一致。

打开时焦点直接进第一项：

```js
el.setAttribute('aria-expanded', 'true');
items[0].focus();          // 焦点直接进菜单，Esc 才有人接得住
```

不这么做，焦点还留在图块上，而 `Escape` 的监听挂在菜单里，事件收不到。方向键首尾相接，`Home` / `End` 跳两端，`Tab` 视作离开即关闭：

```js
if (e.key === 'Escape') { closeMenu(true); return; }
if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
  e.preventDefault();
  var step = e.key === 'ArrowDown' ? 1 : -1;
  items[(i < 0 ? 0 : (i + step + items.length) % items.length)].focus();
}
```

关闭时要区分谁触发的：键盘激活菜单项产生的 `click`，`e.detail` 是 0，鼠标点的是正数。

```js
var byKeyboard = e.detail === 0;
apply(b.dataset.act, owner);
closeMenu(byKeyboard);
```

只有键盘路径才把焦点还给图块，鼠标操作时抢焦点会让用户下一次点击的位置突变。菜单外部点击用捕获阶段的 `pointerdown` 关：图块的 `begin()` 在冒泡阶段，捕获阶段先关，就不会出现"菜单还开着又开始了新的长按"。`blur` 与 `scroll` 同样绑关闭，后者是因为菜单用 `position: fixed` 定位，页面一滚锚点就偏。

定位时量一次尺寸把菜单夹在视口内：

```js
menu.style.left = Math.max(8, Math.min(x, window.innerWidth - w - 8)) + 'px';
menu.style.top = Math.max(8, Math.min(y, window.innerHeight - h - 8)) + 'px';
```

这里用 `left/top` 没问题：打开是一次性动作，不是逐帧跟随。真要跟随指针就换成 `transform: translate3d()` 配合 `top:0; left:0`。

---

## 7. 接进真实项目

抽成属性最省事：给容器 `data-longpress`，`hold` / `tol` 做成参数，触发时派发一个带 `pointerType` 和落点的事件。

- 适合：图块网格、画布元素、文件列表项、消息气泡。
- 不适合：可滚动容器内部（长按时手指必然漂移，容差判定会取消掉大多数操作，那种场景该用"松手后显示菜单"）、比容差还小的小控件。
- 必须留非长按的等价入口。本站给了三个：右键、键盘 `Enter` / `Space` / `ArrowDown`、图块本身仍可点击。
- 菜单项要真的改状态：演示里三项分别落在 `data-copied`、`data-fav`、`.empty` 上，删除后的空位不再响应长按，并带 `aria-disabled`。
- `prefers-reduced-motion` 下不能整条过渡一关了之，那样环完全不动，用户失去"还要多久"的唯一线索。本站只去掉 `--p` 的插值、保留颜色过渡。

> 坑：症状是环不动，或卡在半圈不回退。原因是 `--p` 没注册（未注册的自定义属性不参与插值），或注册成 `inherits: false` 而消费它的是伪元素。修法是注册 `@property` 为 `<number>` 且 `inherits: true`，把 `transition: --p` 写在基础规则、在 `.pressing` 里关掉。

---

## 8. 自查清单

- [ ] `--p` 用 `@property` 注册，`inherits` 与消费它的元素匹配
- [ ] 按住时 `transition: none`，取消时靠 `removeProperty` 让过渡插值回 0
- [ ] 进度由 rAF 时间戳算，不用 `setTimeout` 对齐动画
- [ ] `fire` / `cancel` 两条路径都 `cancelAnimationFrame`
- [ ] 监听 `pointermove` 并按累计位移取消
- [ ] `pointerup` 未达标一律取消，不部分触发
- [ ] `contextmenu` 已 `preventDefault`，配 `user-select: none` 与 `-webkit-touch-callout: none`
- [ ] 打开菜单即聚焦第一项，Esc / 方向键 / Home / End / Tab 都有行为
- [ ] `prefers-reduced-motion` 下保留进度反馈，只去掉插值

## 相关组件

- [拖拽甩卡堆](#/drag-snap-cards)：和长按抢同一批 `pointerdown`，靠容差与时长把两者分开。
- [鼠标追随光斑卡片](#/spotlight-card)：那层光斑可以当长按的按压反馈，`--p` 的思路通用。
- [环形进度仪表](#/pie-gauge)：同样用 `conic-gradient` 加遮罩挖环，那边进度可动画性更需要 `@property`。
