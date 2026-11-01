# 玻璃拟态卡片（Glass Card）制作教学

> 目标：做一张压在动态背景上的磨砂玻璃卡片，噪点与高光各有一个开关，叠加度与模糊半径各有一个滑块。
> 产出文件：[`widgets/material/glass-card.html`](../../widgets/material/glass-card.html)
> 难度：入门 · 约 20 分钟

---

## 0. 先想清楚：只写 `backdrop-filter` 为什么做不出玻璃

最常见的写法是这样：

```css
.glass { background: rgba(255, 255, 255, var(--tint)); backdrop-filter: blur(var(--blur)); }
```

它有三个问题。第一，`rgba(255,255,255,.4)` 这种叠加度已经把折射结果盖住了：折射出来的是背景的一团糊色，被更亮的白压过去，屏幕上只剩一块板。第二，卡片下面如果没有东西可折射（页面背景是纯色，或者祖先层把它和背景隔开），开不开 `backdrop-filter` 的像素结果相同。第三，均匀的一层白四边一样亮，除了透明度以外没有任何方向信息，和一张半透明纯色矩形在像素上没有区别。

所以要拆成四层：折射、叠加度、噪点、有方向的高光。后两层做成了开关，叠加度和模糊半径做成了滑块，四项都能单独观察。

---

## 1. 卡片下面必须真的画着东西

`backdrop-filter` 处理的是"卡片背后已经画好的像素"。两个前提：背后有像素，且那些像素没被祖先裁掉。背景层是三颗缓慢位移的渐变球加一张细网格：

```css
.grid {
  position: absolute; inset: 0; opacity: .55;
  background-image:
    repeating-linear-gradient(90deg, rgba(226, 236, 255, .26) 0 1px, transparent 1px 23px),
    repeating-linear-gradient(0deg, rgba(226, 236, 255, .16) 0 1px, transparent 1px 23px);
}
```

网格是模糊半径的读数：滑块从 `0` 拖到 `26px`，卡片外的线仍是一像素宽，卡片内的线摊开变糊，这个差别只有线条显示得出来。纯色背景上做同样的操作，前后像素没有差异。

色球靠 `transform` 位移，作用相同：背景静止时折射结果也静止，一次糊完就看不出变化，证明不了折射真的在读取下层内容。

> 坑：把背景挂在 `body` 上、卡片放进另一个带 `overflow: hidden` 的滚动容器。症状是加了 `backdrop-filter` 之后卡片变成纯黑或纯灰。原因是折射源和卡片不在同一个裁剪盒里，浏览器拿不到那部分画布。修法是让背景层和卡片处在同一个裁剪盒内（演示把两者都放进 `.scene`），并确认祖先没有 `contain: paint` 之类把绘制范围切开的声明。

---

## 2. 白色叠加度决定它是磨砂还是灰板

```css
.glass {
  border: 1px solid rgba(255, 255, 255, .18);
  background: rgba(255, 255, 255, var(--tint));
  -webkit-backdrop-filter: blur(var(--blur)) saturate(1.55);
  backdrop-filter: blur(var(--blur)) saturate(1.55);
}
```

`--tint` 从 `0` 到 `0.4` 可拖。`0.10` 附近还能看出背景色，`0.30` 就只剩一道模糊边和一层白。写成 `rgba(255, 255, 255, var(--tint))` 是为了让 JS 只改一个数字，不必重写整条 `background`。

`saturate(1.55)` 是第二个容易被忽略的项。模糊做的事是平均相邻像素，色相不同的像素一平均，颜色就变淡；这一项把饱和度乘回去，卡片内的色球才和卡片外的色球接近。系数还能往上调多少、调到哪儿开始出问题，本站没有实测，演示也没给它做滑块。

正文要压得住背景的不确定性。组件给正文一层很淡的 `text-shadow`，并把 `.glass > *` 的 `z-index` 抬到两层光泽伪元素之上，否则高光带扫过文字时会糊。

---

## 3. 高光与边缘：一道描边只够一部分反射

`border: 1px solid rgba(255, 255, 255, .18)` 是四边等亮的一圈。斜面反射的亮度沿边缘并不均：顶边受光最多，底边几乎只剩暗边。组件补了两层：

```css
.glass::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit;
  background: linear-gradient(135deg,
    rgba(255, 255, 255, .40) 0%,
    rgba(255, 255, 255, .10) 22%,
    rgba(255, 255, 255, 0) 46%,
    rgba(255, 255, 255, 0) 76%,
    rgba(255, 255, 255, .12) 100%);
}
.glass::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .58),
    inset 0 -1px 0 rgba(9, 12, 24, .38);
}
```

上亮下暗这件事值得单独说。光源在上方时，玻璃上沿的高光最亮、下沿偏暗；把两道 `inset` 的符号反过来写（上暗下亮），边缘就读不出厚度，像一块从内部发光的贴纸。`::after` 那两道 `inset` 阴影正是这个分工：上沿 `+1px` 亮、下沿 `-1px` 暗，边框本身只提供中间调。

`135deg` 的斜向渐变提供第二层信息：反射面有朝向，左上最亮（`.40`）、到 `46%` 归零、右下再留一点回光（`.12`）。面板里"关掉高光边"这个开关同时把 `border-color` 降到 `.14`、把两个伪元素 `opacity: 0`，剩下的就只有一层均匀的半透明白。

---

## 4. 噪点为什么必需

磨砂面的微观颗粒会把光散射成一层高频噪点。`blur()` 做的事正好相反：它抹掉高频，只留平滑的色阶过渡，所以模糊结果里没有一点颗粒，和一块均匀的半透明纯色难以区分。这一层颗粒浏览器算不出来，要自己补。

组件用的是内联 SVG 的 `feTurbulence`：

```html
<filter id="grain" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="2" stitchTiles="stitch" result="t"/>
  <feColorMatrix in="t" type="saturate" values="0"/>
  <feComponentTransfer><feFuncA type="linear" slope="0.6" intercept="0.1"/></feComponentTransfer>
</filter>
```

`saturate 0` 是把彩色噪声去色，否则颗粒会带红绿边。`baseFrequency` 在 `0.8` 附近是细砂，降到 `0.3` 就变成云雾。`stitchTiles` 让噪声在平铺接缝处连续，不然 `rect` 一平铺就会露出格子线。这一层只栅格化一次，之后只是参与混合，用 `mix-blend-mode: overlay` 压到背景上，并用舞台的 `isolation: isolate` 把混合范围收在舞台内。

不用 SVG 的话，还有两条纯 CSS 路子。第一条是上面已经用到的 `repeating-linear-gradient` 交叉线网（就是那层网格）：代价是它周期性太强，是规律纹理，不是噪声。第二条是把 `repeating-conic-gradient` 的色标切成很多段再叠一层 `repeating-linear-gradient` 打散：色标一多，每一帧的渐变计算量都涨，圆角处还容易出摩尔纹。三种写法都不要拿图片顶替，站点要求零图片。

---

## 5. 前缀与降级

Safari 需要带前缀的那一行，两条都要写，顺序无要求。真正需要决策的是不支持的时候怎么办：

```css
@supports not ((backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px))) {
  .glass { background: rgba(24, 30, 52, .88); }
  .glass::before { opacity: .35; }
}
```

关键是不能只删掉 `backdrop-filter` 而把半透明白留着：没有折射的半透明白落在深色背景上，文字与所在像素的亮度差随背景内容变化，压在色球上就糊。降级换成一层接近不透明的深色底（组件里用 `rgba(24, 30, 52, .88)`），高光压到 `.35`。舞台右下角常驻一个降级样例卡片，与玻璃卡片放在一起对比。

---

## 6. 性能边界：不能放在滚动的长列表上

`backdrop-filter` 的输入是"元素背后已经画好的像素"。背后内容只要重绘一次（背景球在动、列表在滚、文字在闪），这块区域的模糊就得重新栅格化。这是它和 `filter: blur()` 的区别：后者的输入是自己的子树，前者是整张画布。

三条边界：一屏之内少放玻璃层；玻璃层下面不要放持续运动的元素（组件里的色球只动 `transform`，尺寸也压得很小）；不要指望 `will-change: backdrop-filter` 来省，本站没有实测过它对这条模糊路径有什么改善，而模糊区该重算的还是得重算。代价的量级大致随模糊面积和背后重绘频率增长，具体掉多少帧未测。

滑块的写入也按这个思路收敛：

```js
function apply() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(function () {
    queued = false;
    root.style.setProperty('--blur', parseFloat(sBlur.value) + 'px');
    root.style.setProperty('--tint', parseFloat(sTint.value).toFixed(2));
  });
}
```

`input` 事件的触发频率高于屏幕刷新率，一次拖动会产生若干浏览器根本不会显示的中间值。推迟到下一帧就只写一次，模糊区的重复栅格化次数跟着降下来。

---

## 7. 接进真实项目

导航条、登录卡、弹窗遮罩是玻璃拟态能稳定成立的位置：数量少、位置固定、下面顶多是一张静态图或缓慢运动的背景。

不适合长列表卡片、图表区，以及任何背后持续重绘的位置。这些地方要用它就得让背景静止（把色球 `animation: none` 就是这种场景），或者用 §5 的降级纯色。

抽成组件时把 `--blur` 和 `--tint` 留在实例上，别写成全局 `:root`，因为一个页面里不同层级的玻璃通常要用不同的叠加度（弹窗比导航条更实）。`prefers-reduced-motion` 下要关掉的是色球的 `animation`，不是模糊本身：模糊不是动效。

---

## 8. 自查清单

- [ ] 卡片下面画着持续运动的色球和网格，拖模糊半径能看出网格变糊
- [ ] `--tint` 默认值在 `0.10` 附近，卡片没有退化成一块灰板
- [ ] 同时写了 `-webkit-backdrop-filter` 和 `backdrop-filter`
- [ ] 高光有方向：上沿亮、下沿暗，斜向渐变至少两段
- [ ] 有噪点层，且混合范围被 `isolation` 收住
- [ ] `@supports not` 分支换成了接近不透明的纯色，而不是留着半透明白
- [ ] 滑块写入合并进 `requestAnimationFrame`
- [ ] 玻璃层没有挂在滚动长列表上

## 相关组件

- [鼠标追随光斑卡片](#/spotlight-card)：同样是"卡片下面垫一层随参数移动的反射"，那边用指针位置驱动，这里用固定的斜向渐变。
- [故障风文字抖动](#/noise-glitch)：另一处用到 `mix-blend-mode` 的地方，可以对照混合范围隔离的写法。
- [新拟态按键面板](#/neumorphic-keys)：同一个方向的光源假设，玻璃走上亮下暗的反射，新拟态走双向阴影。
