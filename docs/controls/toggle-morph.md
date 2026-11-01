# 形变开关（日 / 夜 Toggle Morph）制作教学

> 目标：一个开关拨过去之后，轨道换色、星星依次亮起、太阳被遮成月牙，三件事排成一段有先后的动画。
> 产出文件：[`widgets/controls/toggle-morph.html`](../../widgets/controls/toggle-morph.html)
> 难度：进阶 · 约 26 分钟

---

## 0. 先想清楚：为什么不用 clip-path 挖月牙

最直觉的做法是把太阳裁成月牙：

```css
.knob { clip-path: circle(50%); }
.knob { clip-path: inset(0 0 0 40%); }   /* 想挖出缺口 */
```

三个问题。第一，`clip-path` 的边界按元素像素栅格切，圆弧上会看到锯齿，放大之后更明显；阴影、`filter: drop-shadow` 这些外溢效果会被整条裁掉，太阳的光晕直接没了。第二，`clip-path` 在两个不同形状之间插值（圆变 inset）浏览器会退化成淡入淡出，你看到的不是"被吃掉一块"，而是"闪一下换个图"。第三，形状一变，命中区域和 `box-shadow` 都不再是那个圆。

所以这里用**叠加一个偏移的圆**： `.knob` 是 `overflow:hidden` 的容器，`::after` 是与夜空同色的实心圆，白天它在容器右侧外面（被裁光），夜间它移进来压住太阳左上一块，露出来的就是月牙。形状是两条真实的圆弧，边缘由抗锯齿处理，光晕在容器外，一行都不用改。

进阶写法是 `mask`，两圆相减，边缘更干净：

```css
.knob {
  -webkit-mask: radial-gradient(circle at 50% 50%, transparent 0 42%, #000 43%);
          mask: radial-gradient(circle at 50% 50%, transparent 0 42%, #000 43%);
}
```

代价是 `mask` 会把 `.knob` 的 `box-shadow` 一起挖掉（遮罩作用在元素绘制结果上），而且这里的缺口要跟着状态动，就得把位置写成变量再插值。我试过三种写法，只有"偏移圆 + overflow:hidden"能同时保住光晕和边缘质量，所以组件里用它，`mask` 留给你按需要换。

---

## 1. 状态只有一个来源：`aria-checked`

```css
  .sw[aria-checked="true"] .sky { opacity: 1; }
```

星星、拇指、遮罩圆都跟着这个套路，见第 3 节的完整规则。

JS 里只改一个属性，剩下的都是 CSS 的事：

```js
sw.addEventListener('click', function () {
  var on = sw.getAttribute('aria-checked') === 'true';
  sw.setAttribute('aria-checked', String(!on));   // 状态由 aria-checked 单向决定，CSS 只认它
  schedule();
});
```

不要同时维护 `.is-on` 类名和 `aria-checked`，两份状态一定会飘。也别把 `aria-checked` 当样式钩子之外的事实来源，它只是语义；视觉上真的动起来的都是 `[aria-checked="true"]` 选择器。

尺寸全用 `em`，外层只改 `font-size`：

```css
  .sw {
    position: relative; flex: none;
    font-size: calc(44px * var(--scale, 1));
    width: 2.2em; height: 1em;
```

```css
  .knob {
    position: absolute; top: 50%; left: .08em; margin-top: -.42em;
    width: .84em; height: .84em; border-radius: 50%; overflow: hidden;
```

这样控制面板里的尺寸滑杆推一个变量就够，拇指位移、星星大小、光晕半径按比例一起走，不会缩放后走形。

## 2. 轨道换色只能靠交叉淡入

`linear-gradient` 之间不能插值，写 `transition: background` 换来的是瞬间跳色。所以夜空是一层独立的纯色板，靠 `opacity` 叠上去：

```css
  .sky {
    position: absolute; inset: 0; border-radius: inherit;
    background: var(--night);
    opacity: 0; transition: opacity var(--dur) linear;
  }
```

```css
  .sw[aria-checked="true"] .sky { opacity: 1; }
```

`--night` 必须是纯色，而且月亮停进去那一侧的底色要和它完全一致，否则遮罩圆会露出一个亮边的方块。这就是 `.sky::before` 的蓝色光晕只铺左半边、`width: 62%` 的原因：右侧留给纯色。

> 坑：现象是"夜间时月牙外面套了一圈深蓝色的圆角方框"。原因是遮罩圆的颜色取自 `body` 的渐变背景，而拇指停在轨道右上角那块的光晕区，两者不同色。修法是把夜空定成一个变量 `--night`，轨道底色和 `::after` 都读它，别写死。

## 3. 分向不对称：延迟只写在"开"这一侧

这是整个组件最有用的一招。想要的编排是：开灯→关灯时星星先灭、月亮再退；关灯→开灯时轨道先暗、星星依次出、月亮最后到。两种方向的节奏不一样，所以延迟不能写在基类上。

```css
  .sw[aria-checked="true"] .star {
    opacity: .92; transform: none;
    /* 分向不对称的关键：延迟只写在"开"这一侧，关的时候基类生效，星星立刻消失 */
    transition-delay: calc(var(--st) * var(--i, 0) * var(--dur) * .1);
  }
```

`transition-delay` 生效的是**目标状态**那一侧的规则。关到 `opacity:0` 时读的是基类（没有延迟），所以星星是齐刷刷灭掉；开到 `opacity:.92` 时读的是属性选择器那条，五颗星按各自的 `--i` 依次亮起。写成基类延迟的话，关灯也要等一颗星，看着像卡住。

`--i` 直接写在 HTML 里：`<span class="star" style="left:49%; top:34%; --i:2">`。它是无单位数字，配合 `calc` 乘出延迟。`--i` 从 0 排到 4，系数取 `.1`，于是最后一颗星比第一颗晚 `0.4` 个 `--dur` 起步。

月亮和遮罩圆的延迟同理，都挂在"开"这一侧，让它排在星星之后：

```css
  .sw[aria-checked="true"] .knob {
    transform: translate3d(1.2em, 0, 0);
    box-shadow: 0 0 .14em rgba(160, 190, 255, .28), inset 0 0 .1em rgba(255, 255, 255, .1);
    transition-delay: calc(var(--st) * var(--dur) * .5);   /* 月亮后进：星星已经全部起步 */
  }
  .sw[aria-checked="true"] .knob::after {
    transform: translate3d(0, 0, 0);
    transition-delay: calc(var(--st) * var(--dur) * .5);
  }
```

`0.5` 比 `0.4` 大，所以月亮在最后一颗星之后才起步——"星星先出、月亮后进"的顺序是靠这两个系数撑住的。一开始这里写的是 `.34`，月亮会赶在第三、四颗星之前动，编排就散了；三个档位的时长（150 / 300 / 600）都会等比例放大这个错位。

控制面板里的"禁用错峰"就是把 `--st` 设成 0：所有延迟归零，编排塌成一次同时的跳变。这个对比开关建议你亲手拨一下，它比任何描述都直观：动效"高级"与否，多数时候来自错峰，而不是时长。

## 4. 为什么用 `button[role=switch]` 而不是 checkbox

```html
<button class="sw" type="button" role="switch" aria-checked="false" aria-label="夜间模式">
  <span class="sky" aria-hidden="true">…</span>
  <span class="knob" aria-hidden="true"></span>
</button>
```

`<input type="checkbox">` 是替换元素，往里塞子节点不生效，光晕、星星、月牙全都要落在别的元素上，等于绕开它自己画一套。`button` 能装任意内容，还白送三件事：可以聚焦、Space 触发 click、Enter 也触发 click。注释里那句"不用 addEventListener('keydown') 补"就是这个意思：换成 `div` 你要自己写键盘，而且多数人只写 Space，漏掉 Enter；`role="switch"` 也不会被读屏器自动念出状态，`aria-checked` 得自己同步。

`aria-hidden="true"` 给两个装饰层，读屏器于是只念"夜间模式，开关，已关闭"，不会念星星的数量。状态文本 `aria-checked = false` 与"白天 / 夜间"两块是给人眼看的演示读数，不是给辅助技术的。

读屏器拿到新状态的时机是 `aria-checked` 变化本身，不需要额外 live region；但如果你在状态变化时还会更新旁边一句提示文字，那就把两者合并到一帧里写，省一次重排：

```js
var raf = null;
function schedule() {
  if (raf) return;
  raf = requestAnimationFrame(function () { raf = null; sync(); });
}
```

`sync()` 画完就把 `raf` 交出去，循环不常驻，空闲时页面上没有待处理的帧。

## 5. 时长与 `prefers-reduced-motion`

`--dur` 是唯一的时长来源，所有 `transition` 都用 `calc(var(--dur) * …)` 从它推导，所以 150 / 300 / 600ms 三档切换只要改根元素一个变量。取值上 150ms 会感觉"编排没了、只剩结果"，600ms 已经慢到让人觉得开关失灵；300ms 上下是最舒服的一档。

降级要在 CSS 里兜住，JS 不用判断：

```css
@media (prefers-reduced-motion: reduce) {
  .sky, .star, .knob, .knob::after, .seg label { transition-duration: 1ms; transition-delay: 0ms; }
}
```

用 `1ms` 而不是 `none`：保留一次真实的 transition 事件，任何依赖 `transitionend` 的逻辑不会被破坏，同时人眼看不出动画。开关功能本身照常。

## 6. 主题联动：这里为什么不用 localStorage

规范要求组件内不许出现 `localStorage`，所以演示里只读了一次系统偏好、不做任何持久化：

```js
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  sw.setAttribute('aria-checked', 'true');        // 首屏跟随系统，不做多余的入场动画
}
```

真实项目里这三行要补上，顺序很关键：**首屏样式必须由服务端或 `<head>` 里的一段内联脚本决定**，而不是等这个开关的 JS 跑完再改：

```js
var on = sw.getAttribute('aria-checked') === 'true';
try { localStorage.setItem('wl-theme', on ? 'dark' : 'light'); } catch (e) {}
document.documentElement.setAttribute('data-theme', on ? 'dark' : 'light');
```

对应地，`<head>` 里放一段读回来的脚本（在首帧之前设好 `data-theme`），否则会闪一下白再变黑。`try/catch` 不是保险写法而是必须：隐私模式与某些内嵌 webview 里 `setItem` 会直接抛异常，不吞掉的话整段开关逻辑断在中途，用户点了没反应。最后别忘了 CSS 侧要真的响应那个属性，比如把 `--night` 换成主题变量，否则存了也没用。

## 7. 接进真实项目

封装成组件时对外只要三样：`checked`、`onChange`、`disabled`。`disabled` 要用 `button` 的真属性（同时 CSS 里 `.sw[disabled] { cursor: not-allowed; }`），别只加个类名，那样 Tab 还能聚焦上去、Space 还能触发。

适合：主题切换、通知开关、深色模式这类"一个布尔值 + 需要即时反馈"的地方。不适合：需要三态或更多选项的（那是 radio 组）、需要提交后端并显示保存中状态的（视觉动效会让"是否已保存"变得含糊，那种该配一个明确的 spinner 和失败回滚）。性能上这个组件只有五层合成，全程 `transform` / `opacity`，成本可以忽略；真正要注意的是别在页面里放十几个这样的开关，错峰动画同时跑会有轻微的掉帧感。

## 8. 自查清单

- [ ] 月牙是叠加偏移圆，不是 `clip-path`，光晕没被裁掉
- [ ] 夜空底色与遮罩圆同色，夜间看不到方框边
- [ ] 状态只有 `aria-checked` 一份，没有再挂 `.is-on` 类名
- [ ] `transition-delay` 写在 `[aria-checked=true]` 侧，关灯方向没有延迟
- [ ] 尺寸走 `em`，缩放后拇指位移与星星比例一起变
- [ ] Tab 聚焦有可见焦点环，Space 与 Enter 都能切换
- [ ] `prefers-reduced-motion` 下动画塌成瞬间但功能不变
- [ ] 持久化写在 `<head>` 早段并包了 `try/catch`

## 相关组件

- [双色滑块 + 数值气泡](#/range-slider)：同一类"原生控件打底"，那边值与键盘都是现成的，这里才要自己补 ARIA。
- [可搜索下拉](#/searchable-select)：从单个布尔值换成一堆候选项，焦点与 `aria-activedescendant` 的活儿更重。
- [滚动错峰入场](#/stagger-reveal)：`--i` 乘延迟的错峰写法，那边是整页入场，这里是五颗星。
