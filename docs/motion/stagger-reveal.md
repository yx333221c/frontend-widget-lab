# 滚动错峰入场（Stagger Reveal）制作教学

> 目标：元素在滚进视口的那一刻才开始入场，同一批里每张比前一张晚几十毫秒。
> 产出文件：[`widgets/motion/stagger-reveal.html`](../../widgets/motion/stagger-reveal.html)
> 难度：入门 · 约 18 分钟

---

## 0. 先想清楚：用 setTimeout 排延迟为什么不对

最常见的写法是页面加载时就把整列排好：

```js
cards.forEach(function (el, i) {
  setTimeout(function () { el.classList.add('in'); }, i * 60);
});
```

它能把效果做出来，但有三个问题，都会在真实页面上暴露。

第一，**计时起点错了**。`setTimeout` 从"注册那一刻"倒计时，而不是从"元素进屏那一刻"。首屏之外的卡片在这段延迟里早就滚进来了，用户看到的是它们静止的成品状态。改成监听 scroll 再补延迟，就撞上第二个问题。

第二，**任务收不回来**。用户快速来回拖滚动条，同一批元素被反复判定为"刚进入"，每次都往事件循环里塞一个新的定时器。这些闭包引用着 DOM 节点，元素哪怕已经被框架卸载，回调照样执行。想回收就得自己存 timer id 并在离开时 clear，这部分管理成本比动画本身还高。

第三，**序号会带出抖动**。`i * 60` 里的 `i` 取的是整表序号，往上滚到第 5 张再退回来，回来的那张要等 240ms 才动，用户读成"这张卡反应慢"。

正确的分工是：**IntersectionObserver 负责"什么时候开始"，CSS `animation-delay` 负责"每等多久"**。计时器一个都不用建，元素离开视口时把类名去掉，动画状态自然归零。

---

## 1. 观察：把 root 指到滚动容器

不用 scroll 监听，不用 `getBoundingClientRect()`，一个 observer 解决：

```js
var io = new IntersectionObserver(function (entries) {
  /* 回调体见第 2 步 */
}, { root: stream, threshold: CFG.threshold });

targets.forEach(function (el) { io.observe(el); });
```

`scroll` 事件里读几何信息是同步布局读取，每帧都可能触发重排。IntersectionObserver 把判定交给浏览器，回调频率远低于 scroll。

`root` 在本例里值得单独说一句。它的默认值是浏览器视口，而判定用的相交区域先要经过祖先裁剪，所以在这个演示里（容器完整地待在视口内）不传 `root` 也能触发。仍然要传，理由有两个：一是这个组件搬到真实页面后，容器往往只有一部分在视口里，基准一漂，触发的时机就不再只由容器内的滚动决定；二是 `threshold` 比较的是"落进 root 且没被裁掉的那部分"占目标自身面积的比例，root 换掉之后，同一个 `0.2` 对应的实际露出量也跟着变，参数就不好推理了。判定基准和被裁的东西对齐，参数才是可预测的。

---

## 2. 延迟：`--i` 乘 `--step`

延迟写在 CSS 里，序号由 JS 给：

```css
.card.in {
  animation-duration: var(--dur);
  animation-timing-function: cubic-bezier(.2, .75, .25, 1);
  animation-fill-mode: both;
  animation-delay: calc(var(--i, 0) * var(--step));
}
```

```js
entering.sort(function (a, b) {
  return targets.indexOf(a.target) - targets.indexOf(b.target);
});
entering.forEach(function (en, k) {
  var el = en.target;
  if (el.classList.contains('in')) return;
  el.style.setProperty('--i', k);
  el.classList.add('in');
  if (CFG.once) io.unobserve(el);
});
```

三处细节要留意。

`calc(var(--i, 0) * var(--step))` 里的 `--step` 是 `60ms`，带单位的自定义属性直接参与乘法，不用在 JS 里拼字符串。改错峰强度只需要动一个变量，演示面板里"关闭错峰"就是把 `animation-delay` 覆盖成 `0ms`。

`sort` 是按文档顺序排。同一次回调里多条 entry 的顺序浏览器不保证，不排就会出现"第 8 张比第 3 张先出场"。

`k` 是**本批内的名次**，不是元素在整个列表里的序号。往下滚一次进 4 张，延迟是 0 / 60 / 120 / 180ms；如果写整表序号，滚到第 14 张时它要等 13 × 60 = 780ms，用户早就滚过去了。

---

## 3. `animation-fill-mode: both` 不是可选项

这一行去掉，卡片播完会凭空消失。要素自己的样式和动画是两个层次：`.card` 写着 `opacity: 0`，动画只在"正在播"的那段时间接管显示值，一结束又没有填充模式，元素立刻回落基础样式，重新变回透明。

`both` 把两个方向都盖住：

- `forwards`：结束后停在 `to`（`opacity: 1`），卡片留在屏上。这是本组件真正依赖的那一半。
- `backwards`：延迟期间就套用 `from`。本组件的 `from` 和基础样式都是透明，所以看不出差别；但换成"基础样式可见、只靠关键帧隐藏"的写法，缺了它就会看到整屏卡片先完整露一下、再跳回透明依次播，那个闪烁比错峰显眼得多。

写 `both` 是一层不依赖基础样式的保险：不用推理"我这份 CSS 到底 hide 在哪一层"。

> 坑：症状是"往下滚之后出现的卡片全是空白，从没播过"。原因是 `opacity: 0` 写在基础样式里，而 JS 因为某个报错压根没跑起来，元素永远停在隐藏态。修法是把两层拆开：基础样式默认可见，脚本初始化时再给容器加一个类把子项隐藏。这样脚本挂掉最多是"没有动效"，不会演变成"没有内容"。

---

## 4. `threshold` 与 `rootMargin` 的取舍

`threshold: 0.2` 的意思是卡片要有两成面积进入容器才开始播。

`threshold: 0` 最省事，但只探进来一个像素也算"进入"，卡片在容器边缘就把动画播完了，真正滚进来时只剩成品。调到 `0.5` 以上又过头：浏览器要等它过半才回调，快速滚动时会看到"卡片都滚过去了还没触发"。本站这种矮容器里 `0.2` 左右比较平衡。

`rootMargin` 是另一个方向的手段，它扩大或缩小判定框，跟"要露出多少"无关，只改"从哪条线开始算"：

```js
/* 本组件没用这一行，只作为对照写法列出 */
{ root: stream, rootMargin: '0px 0px -10% 0px', threshold: 0.2 }
```

底下那条边往里收，卡片必须越过容器下沿一截才算进入，效果和调高 threshold 类似但更可控。反过来给正数，卡片在还没进屏时就播完了，滚到位只剩成品，动效等于白做。

---

## 5. unobserve 只播一次，与来回都触发

两种模式各有道理，区别在离开视口时做不做清理：

```js
if (en.isIntersecting) {
  entering.push(en);
} else if (!CFG.once) {
  en.target.classList.remove('in');
  en.target.style.removeProperty('--i');
}
```

`once` 模式下入场后立刻 `io.unobserve(el)`，观察列表越来越短，成本一路下降。语义也对：内容已经登场过，再滚回来不该重演一遍。落地页、文章配图、表单分组都该用这个。

来回模式适合"内容每次出现都算新信息"的场景，比如列表项会变动、或者你希望滚动本身有节奏感。代价有两个：一是离开时必须把 `--i` 一起删掉，否则下次进场沿用旧名次，延迟链接不上；二是用户拖滚动条来回甩的时候，注意力会被动画本身抢走。

重播按钮用的是同一套清理，多一个跨帧的动作：

```js
io.disconnect();
requestAnimationFrame(function () {
  requestAnimationFrame(function () {
    targets.forEach(function (el) { io.observe(el); });
  });
});
```

同一帧里 `remove` 再 `add` 同一个类名，浏览器认为这个动画从未结束过，不会重放。跨两帧是让样式重算真正落地。

---

## 6. 变体：mask 擦出文字

把卡片换成一条标题，可以做成"被擦出来"的效果：

```css
.hero {
  background: linear-gradient(92deg, #24d3ee 0%, #eaf6ff 45%, #24d3ee 90%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
  -webkit-mask-image: linear-gradient(90deg, #000 0 40%, rgba(0,0,0,0) 55%);
  mask-image: linear-gradient(90deg, #000 0 40%, rgba(0,0,0,0) 55%);
  -webkit-mask-size: 250% 100%; mask-size: 250% 100%;
  -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
  -webkit-mask-position: 100% 0; mask-position: 100% 0;
}
@keyframes wipe {
  from { -webkit-mask-position: 100% 0; mask-position: 100% 0; }
  to   { -webkit-mask-position: 0 0;    mask-position: 0 0; }
}
```

三层叠起来才成立：`background-clip: text` 把渐变裁成字的形状，`-webkit-text-fill-color: transparent` 让字本身不填色、只透出背后那块渐变，`mask-image` 决定渐变里的哪一部分此刻可见。

遮罩画得比字宽（`250%`），黑色段占前四成、后面渐隐到透明。`mask-position` 从 `100%` 扫到 `0%`，黑色段自左向右压过去，透明度渐变那段就成了一支软笔刷。遮罩要是只画 `100%` 宽，扫起来是整块文字忽明忽暗，不像被擦开。

这个变体动画的是 `mask-position`，不属于 `transform` / `opacity`，走不了合成器。所以只用在一条标题上，别给整个列表套。

---

## 7. 接进真实项目

抽成属性最省事，一份 observer 服务全页：

```html
<div data-reveal>...</div>
```

```js
document.querySelectorAll('[data-reveal]').forEach(function (el) { io.observe(el); });
```

- **适合**：首屏以下的区块、卡片网格、图片墙、定价表、文章里的分组。
- **不适合**：长表格逐行错峰（一次进场几十行，名次排到 30 以后，延迟比内容还长），以及要求内容立刻可读的地方，比如搜索结果列表。
- 无障碍降级：`prefers-reduced-motion: reduce` 下改成常态可见、动画整体关掉，本组件里就是这段：

```css
@media (prefers-reduced-motion: reduce) {
  .card, .hero { opacity: 1; animation: none !important; }
}
```

- 虚拟列表（react-window 之类）要留意：节点被复用时会留着上一次的 `in` 类，新行进来直接是成品。回收行时把类和 `--i` 一起清掉，重新挂载时再 `io.observe`。

---

## 8. 自查清单

- [ ] 延迟由 `animation-delay` 承担，代码里没有为出场排的 `setTimeout`
- [ ] `animation-fill-mode: both` 在，动画结束后不回落到隐藏态
- [ ] `root` 指向真正的滚动容器（页面级滚动则不传）
- [ ] 延迟用本批名次，而不是整表序号
- [ ] 来回模式下离开视口时清掉类和 `--i`
- [ ] 首屏那批元素不需要滚动就能看到动效
- [ ] `prefers-reduced-motion` 降级分支实测过
- [ ] 脚本失效时内容仍然可见（默认可见 + JS 加类隐藏）

## 相关组件

- [3D 翻牌计数器](#/flip-counter)：同样是"错峰"，不过错的对象从列表项换成数字的每一位。
- [鼠标追随光斑卡片](#/spotlight-card)：入场之后卡片还要响应指针，两者共用一套 CSS 变量传参的写法。
- [动态条形竞赛图](#/bar-chart-race)：FLIP 处理的是"已经在屏上的元素换位"，这里的 observer 处理"还没上屏的元素进场"，互补。
