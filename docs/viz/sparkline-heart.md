# 心跳迷你折线（Sparkline Heart Monitor）制作教学

> 目标：一条逐帧推进的心电波形，扫过处最亮、尾部渐隐，暂停时真的不再耗 CPU。
> 产出文件：[`widgets/viz/sparkline-heart.html`](../../widgets/viz/sparkline-heart.html)
> 难度：入门 · 约 24 分钟

---

## 0. 先想清楚：用 setInterval 画折线为什么不对

常见起手式（这段反面写法不在组件里）：

```js
setInterval(function () {
  data.push(next()); data.shift();
  ctx.clearRect(0, 0, w, h);
  // 重画整条线
}, 33);
```

三个问题：33ms 和屏幕刷新率不对齐，画面会周期性地"两帧画一次"或"一帧不画"，看着发黏；后台标签页里它仍被调度（只是被节流），你没在看它还在算；最隐蔽的是它按时间推进、步长却不固定，主线程一卡，这一拍画出来的宽度就和上一拍不一样。

换成 rAF 加累积器，每帧按真实经过的时间决定推进几个样本：

```js
var dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
acc += dt * samplesPerSec();
var n = Math.floor(acc); acc -= n;
for (var i = 0; i < n; i++) stepSample();
```

`Math.min(0.05, ...)` 是必需的：切回前台那一帧 `dt` 可能是好几秒，不夹住就会一次灌进几百个样本，波形"啪"地跳一大段。`acc` 留下不足一个样本的小数，否则每帧都丢一点，长期看扫描速度会偏慢。

---

## 1. devicePixelRatio：不缩放就在 Retina 上糊成一片

```js
var dpr = Math.min(window.devicePixelRatio || 1, 2);
W = cv.clientWidth; H = cv.clientHeight;
cv.width = Math.round(W * dpr);
cv.height = Math.round(H * dpr);
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
```

canvas 有两个尺寸：`width` / `height` 属性是位图的像素数，CSS 的 `width` / `height` 是它显示出来的大小。只设 CSS 尺寸时位图还是默认的 300×150，被拉伸到显示尺寸，2x 屏上一个位图像素要填四个物理像素，线条边缘全是糊的。

`setTransform(dpr, 0, 0, dpr, 0, 0)` 之后所有绘制都用 CSS 像素坐标，代码里不必到处乘 `dpr`。它必须写在改 `cv.width` 之后：给 `width` 赋值会重置整个绘图状态，transform、`lineWidth`、`strokeStyle` 全回到初始值。`resize()` 里的顺序就是这个。

`Math.min(..., 2)` 是封顶：3x 屏上位图面积按平方增长，观感提升不明显。

> 坑：症状是拖动窗口大小后线条变粗、画面被拉伸。原因是 resize 时忘了重设位图尺寸——canvas 没有 `viewBox` 这种自动缩放机制，位图必须跟着重算。

---

## 2. 波形：分段函数，不是一个 sin

```js
function bump(t, c, w) {             // 以 c 为中心、半宽 w 的半正弦
  var x = Math.abs(t - c) / w;
  return x >= 1 ? 0 : Math.sin((1 - x) * Math.PI / 2);
}
function sinWave(t) {                // 正常 PQRST，t ∈ [0,1)
  var v = 0.16 * bump(t, 0.160, 0.070);      // P 波
  v -= 0.13 * bump(t, 0.262, 0.016);         // Q
  v += 1.00 * bump(t, 0.285, 0.014);         // R：尖峰
  v -= 0.26 * bump(t, 0.310, 0.022);         // S
  v += 0.30 * bump(t, 0.500, 0.085);         // T 波
  return v;
}
```

一条正弦谁都认得出是假的。真实心电的 R 峰极窄（半宽 `0.014`，一拍的 1.4%），后面跟着宽而缓的 T 波（半宽 `0.085`）。用"几个 bump 相加"来拼，形状参数就是每个波的位置、半宽、幅度，改一个数字换一个形态，比调贝塞尔控制点直观得多。

早搏是另一套波形：

```js
function pvcWave(t) {                // 早搏：宽大且方向相反的畸形 QRS + 继发性 T 波
  return -0.72 * bump(t, 0.34, 0.20) + 0.42 * bump(t, 0.66, 0.24);
}
```

`beat.len` 表示这一拍占正常周期的几分之一（`0.42` 就是提前跳出来），紧跟一拍 `pause`（长度 `0.85` 的平线），"早搏之后有一段代偿间歇"的观感就来自这两句。BPM 用两次正常拍之间的真实时间差算：`targetBpm = 60 / Math.max(0.2, lastBeatT - prevBeatT)`。

---

## 3. 尾迹：别用半透明矩形叠加

流传最广的写法（同样不在组件里）：

```js
ctx.fillStyle = 'rgba(14,17,25,.1)';
ctx.fillRect(0, 0, W, H);   // 每帧盖一层，旧的自己变淡
```

两个致命处。一是残留：alpha 合成是渐近地靠近底色，永远到不了，最老的点会留下一条极淡但确实存在的鬼影，换个底色它就露出来。二是它把淡出和背景绑死了：本组件背景是 CSS 画的半透明面板叠两层径向渐变，`fillRect` 只能盖纯色，一盖就把背景糊成一块不透明矩形。

正确做法是保留数据窗口，每个点按年龄自己算 alpha：

```js
var age = (visible - 1 - i) / visible;          // 0 = 最新
var a = Math.pow(1 - age, fadeK);
var b = Math.min(B - 1, Math.floor(a * B));
if (b !== prevB) {
  if (prevB >= 0) ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(px(i - 1), py(at(start + i - 1)));  // 与上一桶共用一个点，接缝不断
  ctx.strokeStyle = 'rgba(255,95,158,' + ((b + .5) / B).toFixed(2) + ')';
  ctx.lineWidth = 1 + 1.2 * ((b + .5) / B);
  prevB = b;
}
ctx.lineTo(px(i), py(at(start + i)));
```

`fadeK` 就是面板上那个"尾迹"，取值 `0.6 ~ 3.5`，默认 `1.8`。它是衰减指数：1 是线性变淡，大于 1 时前段保持得久、尾巴收得快，3.5 时只剩扫描头附近一小截。

逐点 `stroke` 会产生几百次 `beginPath`。这里把 alpha 切成 `B = 14` 个桶，同桶的点连成一条折线一次画完。代价是淡出变成 14 级台阶，桶边界处能看出一条深浅分界；要更平滑就加大 `B`，那是线性代价。

`moveTo` 取上一个点是关键一句：相邻两桶共用端点，接缝才不断。少了它，折线会在每个桶边界缺一个小口，动起来像有锯齿在线上跑。

---

## 4. lineJoin 与 lineWidth 对尖峰的影响

```js
ctx.lineJoin = 'round';
ctx.lineCap = 'round';
```

默认 `miter` 会在尖角处向外伸出一个尖。R 峰这种又窄又陡的折角最容易暴露：两条边方向差得越大，延伸越长，超过默认 `miterLimit`（10）就被截成斜切面，峰顶于是变成一个奇怪的斜面。`round` 把峰顶画成圆弧，看着像被削过，这正是监护仪上那种形状。`lineCap: round` 让线端是圆的，扫描头那截亮线不会露出方头。

`lineWidth` 跟着尾迹强度走（`1 + 1.2 * a`），越新越粗。深色底上纯细线几乎看不见，把亮度和粗细叠在一起变化，"这条线刚扫过"这件事才读得出来。

---

## 5. 环形缓冲：和 shift/push 差在哪

```js
var buf = new Float32Array(CAP);
var head = 0, count = 0;
function push(v, f) {
  buf[head] = v; flag[head] = f;
  head = (head + 1) % CAP;
  if (count < CAP) count++;
}
function slot(i) { return (head - count + i + CAP * 2) % CAP; }
```

`CAP` 是 1400 个样本，`visible` 只画最近 `W / STEP` 个（520px 宽、`STEP` 1.4 时约 371 个）。数组版 `shift()` 每次要把后面所有元素往前挪一格，`Float32Array` 也一样，等于每帧搬上千个数。环形缓冲只写一个槽位、改一个指针，是常数时间。

`+ CAP * 2` 是为了取模前一定非负：JS 的 `%` 保留负号，`-3 % 5` 得 `-3` 而不是 `2`，直接拿去索引就是 `undefined`。加两倍容量是最省事的写法。

容量比可视窗口大一截是有意的：`visible` 依赖 `W`，resize 后可能变大，缓冲刚好等于窗口时就会读到上一轮的旧数据。

---

## 6. 暂停时 rAF 要真的停

```js
raf = (playing && !document.hidden) ? requestAnimationFrame(loop) : null;
```

`playing` 是按钮状态，`document.hidden` 是标签页可见性，两个都不满足就不排下一帧。`kick()` 里判 `if (!raf)` 才排，否则多个事件同时唤醒会排出一串并行循环，速度直接翻倍。回到前台时 `last = 0` 重新计时，不然第一帧的 `dt` 是整个后台时长，波形会突然跳一格。

暂停状态下点"注入早搏"也要有反馈，所以那个按钮在 `!playing` 时手动推进 40 个样本再画一帧。

---

## 7. 接进真实项目

- 换真实数据时只改 `stepSample()`：把"生成一个样本"换成"读一个样本"，其余不动。
- 每帧做的事：一次 `clearRect`、一批网格与刻度线段、尾迹最多 14 次 `stroke`、扫描头一次 `stroke` 加两个圆。默认 `120 * speed` 的采样率配 60fps，每帧推进 2 个样本。
- 不适合：要精确读数的场合（线一直在动），以及采样率远高于像素密度的场合。后者应该降采样，每个像素列取该列的 min 和 max 画两条线，而不是硬画几千个点。
- 无障碍：`prefers-reduced-motion` 下不自动播放，进页面就是一屏静态波形，按钮照常可点；canvas 上的 `aria-label` 说明它在表达什么。

---

## 8. 自查清单

- [ ] 位图尺寸 = CSS 尺寸 × dpr，且 `setTransform` 写在改 `width` 之后
- [ ] 推进量按真实 `dt` 累积，`dt` 有上限夹持
- [ ] 尾迹由数据窗口算 alpha，没有用半透明矩形叠加淡出
- [ ] 相邻亮度桶共用端点，接缝不断
- [ ] `lineJoin` / `lineCap` 显式设置，尖峰不被 miter 拉长
- [ ] 环形缓冲索引取模前保证非负
- [ ] 暂停与切后台都停止排帧，唤醒时不跳帧

## 相关组件

- [3D 翻牌计数器](#/flip-counter)：同样要处理"数字缓动"，那里逐位翻转，这里一阶趋近。
- [动态条形竞赛图](#/bar-chart-race)：也是每帧重画，但位置变化交给 FLIP，思路互补。
- [环形进度仪表](#/pie-gauge)：单值看它，看趋势用这个。
