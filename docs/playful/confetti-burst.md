# 点击撒花（Confetti Burst）制作教学

> 目标：用一层 Canvas 粒子做出「像真纸片」的庆祝爆发，几百个碎片还能保持流畅，并且空闲时完全不占 CPU。
> 产出文件：[`widgets/playful/confetti-burst.html`](../../widgets/playful/confetti-burst.html)
> 难度：进阶 · 约 30 分钟

---

## 0. 先想清楚：用 200 个 DOM 节点做粒子为什么不对

最直觉的做法是循环 `appendChild` 一堆小 `<i>`，每个挂一条 CSS 动画（下面是反例，不是本组件代码）：

```js
// 反例：DOM 粒子
for (var i = 0; i < 200; i++) {
  var el = document.createElement('i');
  el.style.setProperty('--dx', (Math.random() * 400 - 200) + 'px');
  el.style.animation = 'fly 1.2s ease-out forwards';
  wrap.appendChild(el);
  setTimeout(function () { el.remove(); }, 1300);   // 靠定时器清理
}
```

看起来能跑，但三处很廉价。第一，200 个元素就是 200 次样式重算，滚动时掉帧明显。第二，轨迹是写死的 `ease-out`，所有粒子同时减速、同时消失，人眼立刻读出"这是特效"。第三，中途改不了重力，也加不了墙壁碰撞，因为时间线烧在 CSS 里。

粒子的本质是一个每帧重新积分的物理系统。只要参数需要实时可调，就只能上 Canvas。

---

## 1. 粒子模型与 Canvas 尺寸

一个粒子就是一条普通对象，字段全是"可积分"的量：

```js
function make(x, y, soft) {
  var a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
  var sp = (soft ? 60 + Math.random() * 90 : 280 + Math.random() * 430);
  return {
    x: x + (Math.random() - 0.5) * 12, y: y + (Math.random() - 0.5) * 12,
    vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
    rot: Math.random() * 6.2832, vr: (Math.random() - 0.5) * 12,
    w: 6 + Math.random() * 8, h: 4 + Math.random() * 5,
    tilt: Math.random() * 6.2832,               // 纸片「绕自身长轴翻转」的相位
    ts: 4 + Math.random() * 6,                  // 翻转角速度 rad/s
    color: PALETTE[(Math.random() * PALETTE.length) | 0],
    age: 0
  };
}
```

`rot` 和 `tilt` 是两个独立的角度：前者是纸片在屏幕平面里打转，后者是绕自身长轴翻面。把它们混成一个，就只剩下"会转的色块"。

Canvas 要跟随容器，并处理高 DPI：

```js
function resize() {
  var r = stage.getBoundingClientRect();
  W = Math.max(1, r.width); H = Math.max(1, r.height);
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(W * DPR);               // 位图尺寸 = CSS 尺寸 × DPR
  cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px';
  cv.style.height = H + 'px';
}
```

DPR 夹在 2 是刻意的：3 倍屏上位图像素多一倍，而 `fillRect` 的成本跟位图像素数成正比，视觉收益却看不出来。给 canvas 的 `width` 赋值会清空位图并重置变换矩阵，所以这件事只在 resize 时做，绝不放进循环。

---

## 2. 积分：重力用「每秒」，阻力用 `Math.pow`

```js
var dragF = Math.pow(CFG.drag, dtN);          // 帧率无关的阻力：0.985^dtN
for (var i = parts.length - 1; i >= 0; i--) {
  var p = parts[i];
  p.vy += CFG.g * dtS;                        // 重力：加速度 × 秒
  p.vx *= dragF;                              // 空气阻力（只作用水平，纸片会「飘」）
  p.x += p.vx * dtS;
  p.y += p.vy * dtS;
```

`dtS` 是秒，`dtN` 是"折算成多少帧 60fps"。重力写成 `1400 px/s²` 而不是 `vy += 0.35`，因为后者把加速度偷换成了每帧速度增量，120Hz 屏幕上一秒内被加 120 次而不是 60 次，纸片掉得明显更快。

阻力同理。`vx *= 0.985` 在 60Hz 下每秒衰减到 `0.985^60`，在 144Hz 下衰减到 `0.985^144`，差着一大截；同一行代码，两种手感。`Math.pow(0.985, dtN)` 把它拉回"每秒"这个量纲。

阻力只作用在水平方向，竖直方向不加，是纸片"飘"的来源：下落速度一路涨、横向速度一路泄，轨迹于是变成甩尾而不是抛物线。

```js
var ms = last ? t - last : 16.7;
ms = Math.min(ms, 40);                        // 夹住一帧：切后台回来不能瞬移
```

浏览器节流后台标签页时 `dt` 可能是几秒。不夹住，所有粒子会在一帧里集体飞出色界，用户看到的是"庆祝突然被抹掉"。40 毫秒相当于允许掉到 25fps，再低就宁可让动画变慢一点。

---

## 3. 像纸片的关键一行：宽度乘 `cos(tilt)`

```js
var pw = p.w * Math.cos(p.tilt);
var c = Math.cos(p.rot), s = Math.sin(p.rot);
ctx.setTransform(DPR * c, DPR * s, -DPR * s, DPR * c, DPR * p.x, DPR * p.y);
ctx.fillRect(-pw / 2, -p.h / 2, pw, p.h);  // pw 为负时矩形反向延伸 = 翻到背面
```

纸片是三维的，Canvas 是二维的。一张绕自身长轴翻转的矩形，投影到屏幕上的宽度就是 `w * cos(θ)`：正面满宽，转到 90° 缩成一条线，过了 90° 又"重新变宽"，因为那已经是背面。`fillRect` 接受负宽度（朝反方向延伸），所以背面不用分支也能画。

不做这一步会怎样？每个粒子都是恒定大小的彩色矩形，屏幕上是一片彩色雨：有旋转、有下落，但没有翻转时那种一闪一闪。人眼识别"纸片"靠的正是面积忽大忽小。成本是一次 `Math.cos`，是所有增强里最划算的一处。想再进一步，可以让同一个 `|cos|` 去调亮度，正面亮背面暗，翻面感更强。

---

## 4. 变换：手写矩阵，别用 `save/restore` + `translate/rotate`

教科书写法是（反例，本组件没这么写）：

```js
// 反例：每粒子 save/restore
ctx.save();
ctx.translate(p.x, p.y);
ctx.rotate(p.rot);
ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
ctx.restore();
```

几十个粒子无所谓，几百个就有差别了。`save()` 要把整份绘图状态（变换矩阵、`fillStyle`、`globalAlpha`、剪裁区域等）压进状态栈，`restore()` 再弹回来；`translate` 和 `rotate` 各自还要做一遍矩阵乘法。手写一条 `setTransform` 把缩放、旋转、平移合成进同一个矩阵，一次调用顶替四步：

```js
ctx.setTransform(DPR * c, DPR * s, -DPR * s, DPR * c, DPR * p.x, DPR * p.y);
```

平移分量也要乘 DPR：矩阵作用在位图像素上，不是 CSS 像素。每帧开头那句 `ctx.setTransform(DPR, 0, 0, DPR, 0, 0)` 把矩阵恢复成基准缩放，之后所有坐标都可以按 CSS 像素写。

顺带澄清一个高频误用：`getContext('2d', { willReadFrequently: true })` 和粒子系统无关。它是给"每帧 `getImageData` 读回像素"的场景用的，提示浏览器用 CPU 后端，省掉 GPU 到 CPU 的往返。撒花只写不读，开了反而丢掉加速。判断依据只有一个：代码里有没有 `getImageData`。

---

## 5. 回收：越界就 swap 到末尾再 `pop`

```js
if (p.age > 6 || p.y > H + 40 || p.x < -60 || p.x > W + 60) {
  parts[i] = parts[parts.length - 1];       // swap-and-pop：不 splice、不 filter
  parts.pop();
}
```

`splice(i, 1)` 要把 i 之后的元素整体前移，一次删除平均搬一半的引用；一帧里同时过期几十个，就是几十次移动。`filter` 更糟：每帧新建一个数组，GC 一到就掉帧，症状是"每隔几秒卡一下"。倒序遍历加 swap-and-pop 是 O(1) 删除，代价只是打乱顺序，而粒子本来就不需要稳定顺序。

配合硬上限（`burst()` 的开头两行）：

```js
function burst(x, y, n, soft) {
  if (CFG.still) return 0;
  var room = CAP - parts.length;                // 上限保护：不扩容、不排队
  n = Math.max(0, Math.min(n, room));
```

连续拖动洒粒子很容易撞到 400。装不下时丢弃新粒子比截断老粒子更好：老的正在落地，画面收得干净，最坏情况的绘制量也恒定，不会被手速打爆。

---

## 6. 循环的启停：结束后 `rAF` 必须停

```js
    if (parts.length && !CFG.still) raf = requestAnimationFrame(frame);
    else { raf = null; last = 0; fps = 0; showMeter(); }   // 粒子清空 -> rAF 停，读数归零
```

`requestAnimationFrame` 是自我续命的：只要排了下一帧，浏览器就得一直唤醒你，哪怕画面上什么都没有。本站的组件常驻在详情页 iframe 里，一个空转的循环会让页面一直不安静。规则是：`wake()` 在有事件时唤醒，循环发现没粒子就断掉。同理，自动爆发用 `setTimeout` 排，而不是让 rAF 空转等下一波，定时器不会唤醒渲染管线。

「静止（停 rAF）」开关把 `parts` 清空、清画布并禁用爆发按钮，这是这类组件的必备项：长期嵌在页面里也不能干扰阅读。系统命中 `prefers-reduced-motion` 时直接把开关默认打开，用户仍然可以手动取消。

交互层还有两个细节。canvas 上叠了 `pointer-events: none`，粒子层永远不吃点击。拖尾按距离节流而不是按时间：

```js
  stage.addEventListener('pointermove', function (e) {
    var r = stage.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    if (hasLast) {
      trail += Math.hypot(x - lx, y - ly);
      /* 按「距离」而不是按「时间」节流：鼠标快慢都能洒出等间距的一串 */
      while (trail > 9) { trail -= 9; burst(x, y, 1, true); }
    }
```

划得快就洒得密、划得慢就洒得疏，两种都自然。按时间节流的话，快速划动只会留下一串稀疏的点，慢速反而糊成一片。

> 坑：粒子堆在画布底部不消失，fps 一路下滑，计数卡在 400 封顶。原因是 culling 用了 canvas 的位图高度（乘过 DPR），粒子在 CSS 坐标下永远飞不到那么远。修法是物理坐标全程用 CSS 像素，DPR 只在 `setTransform` 里出现一次。

---

## 7. 接进真实项目

可以抽成一个函数：`confetti(hostEl, { count, gravity, shape, palette })`，返回 Promise，在粒子清零时 resolve，方便"撒完再跳转"。

- 适合：下单成功、签到抽奖、成就解锁、表单校验通过的瞬间。一次一两百个足够，别做成常驻。
- 不适合：列表项点击（每行都在飞粒子就是噪声）、任何需要读文本的时刻（粒子压在内容上）、以及讲究克制的场合。
- 粒子层必须是独立 canvas 且 `pointer-events:none`，不要盖住输入框。
- 无障碍：canvas 标 `aria-hidden="true"`。爆发这件事对读屏用户要用 `role="status"` 的文字告知，动画本身没有意义。

---

## 8. 自查清单

- [ ] 粒子字段齐全：`{x,y,vx,vy,rot,vr,w,h,color,tilt}`
- [ ] 纸片宽度乘了 `Math.cos(tilt)`，肉眼能看到翻面闪烁
- [ ] 重力是 `加速度 × dt秒`，阻力是 `Math.pow(k, dt帧)`
- [ ] `dt` 有上限，切回标签页不会集体消失
- [ ] 每粒子一次 `setTransform`，没有 `save/restore`
- [ ] 删除用 swap-and-pop，文件里搜不到 `splice` / `filter`
- [ ] 粒子数硬上限 400，超出丢弃新粒子
- [ ] 粒子清空后 rAF 停排，且有「静止」开关与 `prefers-reduced-motion` 分支

## 相关组件

- [倾斜滚球迷宫](#/tilt-maze)：同一套 `dt` 归一积分，加上分轴碰撞与子步进，是这里的物理进阶版。
- [跟随的小宠物](#/pet-cursor)：同样每帧更新位置，但只有一个实体，可以对比"粒子池"与"状态机"两种写法。
- [磁吸光标](#/magnetic-cursor)：撒花通常挂在按钮点击上，按钮本身用磁吸能更"值得点"。
