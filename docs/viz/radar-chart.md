# 手绘风雷达图（Radar Chart）制作教学

> 目标：不引图表库，用极坐标算点、一条 path 成面，再加一层噪声位移滤镜，做出"纸上手绘"的图表质感。
> 产出文件：[`widgets/viz/radar-chart.html`](../../widgets/viz/radar-chart.html)
> 难度：进阶 · 约 32 分钟

---

## 0. 先想清楚：给 SVG 加个滤镜为什么不像手绘

常见的偷懒做法是给线条加抖动动画（下面这段反面写法不在组件里）：

```css
.poly { animation: wobble .2s steps(2) infinite; }
@keyframes wobble { to { transform: translate(1px, -1px); } }
```

它有三个问题：整条线一起平移，笔画本身还是笔直均匀的，读出来是信号不稳不是手画；真正的铅笔痕迹是每条边弯曲程度不同、拐角不闭合，平移给不了这种局部形变；而且它一直在动，看数据时很干扰。

手绘感要的是**空间上的不规则**，不是时间上的抖动。所以这里用一张噪声贴图去位移像素：图静止，笔画本身是歪的。

---

## 1. 极坐标算点：起始角那一行最容易写错

6 个轴均分一圈，第 `i` 根轴的角度是 `i * 2π / n`。直接这么写，第 0 根轴会指向 3 点。

```js
function pt(r, i, n) {
  var a = -Math.PI / 2 + i * (Math.PI * 2 / n);   // 第 0 根轴指向 12 点
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}
```

要理解的是**屏幕 y 轴朝下**。数学里的极坐标假设 y 朝上，`cos` 给 x、`sin` 给 y，`a = 0` 在右、`a = π/2` 在上；SVG 里 `a = π/2` 的 `sin` 是正的，加到 `CY` 上就跑到下面去了，整个图形相当于绕水平轴翻了个面。所以"第一个轴朝上"要减 `π/2`：此时 `cos = 0`、`sin = -1`，点落在圆心正上方。少写它，图形整体旋转 90°，标签和数据错位，但形状看着仍然正常，很难一眼发现。角度还顺时针增长，于是轴顺序变成顺时针，第 6 节会说这为什么会改变结论。

成面只要把点串起来：

```js
function ringPath(vals) {                  // 一条闭合折线：数据多边形或网格圈
  var n = vals.length, d = '';
  for (var i = 0; i < n; i++) {
    var p = pt(R * vals[i] / MAX, i, n);
    d += (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
  }
  return d + 'Z';
}
```

`Z` 不能省：少了它首尾之间没有连线，位移之后那段缺口会被抖得特别明显。

---

## 2. feTurbulence + feDisplacementMap：抖动的笔迹从哪来

整套手绘效果只有两个滤镜原语：

```html
<filter id="sketch" filterUnits="objectBoundingBox"
        x="-20%" y="-20%" width="140%" height="140%">
  <feTurbulence id="turb" type="fractalNoise" baseFrequency="0.045"
                numOctaves="2" seed="7" result="noise"/>
  <feDisplacementMap id="disp" in="SourceGraphic" in2="noise"
                     scale="3.5" xChannelSelector="R" yChannelSelector="G"/>
</filter>
```

`feTurbulence` 生成一张噪声图，RGBA 四通道各自独立，取值 0 到 1。`feDisplacementMap` 拿它当"位移场"：对源图每个像素，读 R 通道决定 x 挪多少、G 通道决定 y 挪多少，再乘 `scale`。

```text
新位置.x = 原位置.x + scale × (noise.R - 0.5)
新位置.y = 原位置.y + scale × (noise.G - 0.5)
```

这就是它像手画的原因：**位移量随位置连续变化**，同一条直线上不同点被挪去的距离不同，直线于是变成曲线；噪声是低频的，小范围内挪动量相近，所以弯得平缓，不会碎。

两个参数各管一头。`baseFrequency` 是噪声的空间频率，越大纹理越密：`0.02` 是大幅缓慢起伏，`0.2` 细碎到像磨砂，这里用 `0.045`。`scale` 是位移的像素幅度：`2 ~ 4` 像签字笔，`6` 开始像抖着手画的，`8` 以上糊成一团，拐角两条边挤到一起，填充边缘锯齿化到看不出原形。

`numOctaves="2"` 是叠几层不同频率的噪声：1 层太规则像正弦波，2 层有粗细两级起伏，接近真实笔压。`seed` 固定为 7 让每次截图一致，想笔迹随机就随机它。

演示里 ③ 这个 range 同时改了两个值，因为 `scale` 和 `baseFrequency` 并不独立：

```js
disp.setAttribute('scale', v);
/* scale 越大，同一张噪声图被拉得越开，笔画会碎成噪点；
   所以顺手把噪声频率调高一点，让抖动变细。两个参数得配着调。 */
turb.setAttribute('baseFrequency', (0.06 - v * 0.003).toFixed(3));
```

> 坑：改 `scale` 或 `baseFrequency` 之后画面没反应。原因是这两个属性是**呈现属性**，用 `element.style.baseFrequency` 这种 CSS 风格去写不会触发滤镜重算。必须用 `setAttribute()`，本演示就是这么写的。

---

## 3. 滤镜区域会裁掉笔画：症状是图形边缘缺一块

`<filter>` 的默认作用范围是包围盒外扩 10%，**输出会被硬裁到这个矩形里**，超出部分直接丢弃。

位移后像素会往包围盒外跑，那 10% 常常不够，症状是多边形某条边忽然断一截，或者靠近 viewBox 边缘那侧笔画被齐齐切掉。看到"直边切口"就该确认是滤镜在裁，不是路径画错了。修法就是扩边：

```html
<filter id="sketch" filterUnits="objectBoundingBox"
        x="-20%" y="-20%" width="140%" height="140%">
```

留多少取决于 `scale`：到 10 时 20% 可能还不够；区域越大滤镜算的像素越多，别一上来写 300%。

挂法也值得说一句：网格整组挂一个 `<g>` 就够，数据多边形却要每条 path 单独挂。

```js
var area = el('path', { class: 'area ' + d.id, fill: d.color, 'fill-opacity': .34,
                        filter: 'url(#sketch)' });
```

因为滤镜会把元素变成一张离屏图，`mix-blend-mode` 拿这张结果去和 backdrop 混；挂在父 `<g>` 上则整组被合成一个隔离层，子元素的混合模式就找不到底下那块不透明底了。刻度和轴标签**故意放在滤镜外**：它们要被读，不需要跟着抖。

---

## 4. 虚线流动：让它像"正在被描出来"

```css
.poly {
  fill: none; stroke-width: 1.8; stroke-linejoin: round;
  stroke-dasharray: 7 5;
}
```

```js
function flowLoop() {
  sOff -= 0.22;                        // 每帧 0.22px：12px 的虚线周期约 55 帧走完
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].d.on) nodes[i].line.setAttribute('stroke-dashoffset', sOff.toFixed(1));
  }
  raf = (flowOn && !document.hidden) ? requestAnimationFrame(flowLoop) : null;
}
```

`stroke-dasharray: 7 5` 是"画 7 空 5"，offset 每帧减小，虚线就沿路径流动；位移滤镜作用在这条断续的线上，缺口也跟着抖，笔触感更强。offset 一直往负方向累加即可，虚线本身是周期 `7 + 5 = 12` 的，不需要取模；`0.22` 故意很慢，快到能看清流动就在抢数据的注意力。

用 rAF 而不是 CSS `animation`，差别在能不能停：CSS 动画只能靠 `display:none` 隐藏，本身还在跑；offset 由 JS 掌握之后，暂停、切后台、按数据集开关都能立刻生效。`stroke-linejoin: round` 是给位移擦屁股的：拐角几条边被抖向不同方向会戳出毛刺，圆角化后看不出来。`prefers-reduced-motion` 下初值就是关，用户仍可手动勾开。

---

## 5. 混合模式：三种填充各用一种

```css
.area.a { mix-blend-mode: screen; }       /* 深底上越叠越亮，适合暗色主题 */
.area.b { mix-blend-mode: normal; }
.area.c { mix-blend-mode: multiply; }     /* 深底上把形状吃掉，故意留给你看 */
```

`multiply` 是相乘：底色 `#121724` 很暗，乘任何颜色都接近黑，勾上方案 C 几乎看不到填充、只剩描边。这不是 bug，是深色主题下的必然结果；`screen` 相反，所以暗色主题用 `screen` 或 `lighten`，亮色主题才用 `multiply`。前提是得有个不透明的底可混，所以 SVG 里先铺了一块 `#121724` 的 `rect`，根元素加 `isolation: isolate`。

---

## 6. 诚实一点：雷达图为什么容易骗人

演示顶部那句"面积比是雷达图的陷阱"是算出来的：
```js
function areaOf(vals) {
  var s = 0, n = vals.length, k = Math.PI * 2 / n;
  for (var i = 0; i < n; i++) {
    s += 0.5 * (R * vals[i] / MAX) * (R * vals[(i + 1) % n] / MAX) * Math.sin(k);
  }
  return s;
}
```

相邻两根轴和圆心构成一个三角形，两边长乘夹角正弦再除 2，六块加起来就是多边形面积。由此能看出两件事。

**面积和数值不是线性关系。** 面积随半径平方增长：每项都 50 分的方案，围出的面积只有满分的四分之一（`5029.9` 对 `20119.5`）。人读雷达图读的是"这块大不大"，于是 50 分被感知成"差得远"。

**轴顺序会改变面积。** 公式里是 `vals[i] × vals[i+1]`，也就是**相邻两项相乘**。两个高分轴摆一起乘积大、图形鼓；高分低分交替排乘积小、图形瘪。演示 ④ 就是干这个的：方案 A 的面积在三种排列下从 `8689.6` 变到 `9184.6`，而 A、B 六项总和只差 1（401 对 402），谁"看着更大"却随排列翻了。

所以什么时候该改用条形图：要别人判断"谁高谁低"、要精确读数、或者轴超过 6 个。条形用长度编码，人判长度比判面积准得多，也没有"顺序影响观感"这个坑。雷达图适合的是**形状本身有意义**的场合：能力画像、两个时间快照重叠对比，价值在"轮廓像不像"，不在"哪根长"。

真要用，几条底线：轴按语义顺序排（从易到难、从早到晚）；所有轴同一套量程和起点；每根轴标出刻度值；超过 3 组数据别叠，重叠一多就成色块汤。

---

## 7. 接进真实项目

- 抽成 `render(data, axes)`，数据变化时重算 `d` 即可：6 轴 3 组，一次 `setAttribute` 的开销可以忽略。
- 想在轴上加数据点小圆点，记得也挂同一个滤镜，否则点会浮在抖动的线之上。
- 本演示 6 个元素共享一个 `<filter>`，每次 `render()` 都要重跑位移计算；轴数上到 20、组数上到 8 就能感到掉帧，那时把滤镜退到只挂描边。
- 无障碍：SVG 上有 `role="img"` 和一句 `aria-label`；真正给读屏用的应该是旁边那张表。

---

## 8. 自查清单

- [ ] 起始角写了 `-Math.PI / 2`，第一个轴在 12 点方向
- [ ] 路径以 `Z` 闭合，位移后拐角没有缺口
- [ ] 滤镜区域扩到 `x="-20%" width="140%"`，边缘笔画没有被直切
- [ ] `scale` 在 2~6 之间，`baseFrequency` 与它配着调
- [ ] 刻度数字和轴标签在滤镜外，保持清晰可读
- [ ] `mix-blend-mode` 有不透明 backdrop 可混，深色主题用 `screen`
- [ ] 虚线流动走 rAF，取消勾选与切后台都能停止排帧
- [ ] `prefers-reduced-motion` 下默认不开流动动画

## 相关组件

- [液态黏粘菜单](#/gooey-menu)：同样靠 SVG 滤镜改变形状，那里是模糊加对比度，这里是噪声位移。
- [动态条形竞赛图](#/bar-chart-race)：需要精确比大小就换它，第 6 节说的正是这个取舍。
- [环形进度仪表](#/pie-gauge)：单指标用环比用雷达省事，两者常在同一块看板里搭配。
