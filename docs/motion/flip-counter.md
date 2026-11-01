# 3D 翻牌计数器（Flip Counter）制作教学

> 目标：做一个机场航班牌那种数字翻滚，改动的那几位各自翻着滚到新值。
> 产出文件：[`widgets/motion/flip-counter.html`](../../widgets/motion/flip-counter.html)
> 难度：进阶 · 约 35 分钟

---

## 0. 先想清楚：直接 rotateX 一整块牌为什么不行

最省事的写法是一位数字一个盒子，值变了就让整个盒子绕水平轴转一圈：

```css
.digit { transition: transform 300ms; }
.digit.flip { transform: rotateX(360deg); }
```

这条路一定失败，失败点很具体：**三维变换下盒子有背面**。转到 90° 之后看到的是背面，而背面是**镜像**的数字，正着翻过去的那半程里数字也是斜着压扁的。

三个补救方向里，只有"分裂"是对的：

- 转半圈停下、下次接着转：值换了但观众看不见换的瞬间，等于没有翻牌。
- `scaleY` 压扁再恢复：最常见的替代方案，便宜，但它没有轴，两片叶子之间的缝也无从谈起。
- 分成上下两半、各自绕中间的缝翻转：真实翻牌机的结构，也是本组件的做法。

真实翻牌机的一位是**一叠绕水平轴转动的叶片**，牌面上永远有两片可见：一片挂着当前值的上半，一片挂着下一个值的下半。我们把这个结构复制成四层 DOM。

---

## 1. 简易版：先让它五分钟能跑

先别分裂。一位一块牌，做上下两个半区，只让上半翻下去（下面把最终文件里的 `var(--dw)` / `var(--dh)` 换成字面值，其余一样）：

```css
.digit { position: relative; width: 38px; height: 52px; perspective: 220px; }
.half  { position: absolute; left: 0; right: 0; height: 50%; overflow: hidden; }
.half.t { top: 0; }
@keyframes flapTop {
  from { transform: rotateX(0deg); }
  to   { transform: rotateX(-90deg); }
}
```

```js
function flip(idx, to) {
  var c = cells[idx], from = digits[idx];
  face(c.st, to);          // 上半静牌先写新值，反正被叶片盖着
  face(c.ft, from);        // 叶片此刻还对着观众，显示旧值
  c.ftBox.classList.add('go');
  digits[idx] = to;
}
```

这个版本已经能看出翻牌的意思，缺点也直白：下半区从头到尾不动，所以只有"上半掀开"这一下，没有"另一片盖下来"那一下。真实翻牌是这两下连着的。补上第二片叶子就是最终版，中间不需要推翻任何一行。

---

## 2. `transform-origin` 设在底边，叶片才像叶片

```css
.flap { z-index: 3; }
.flap.t { transform-origin: bottom center; transform: rotateX(-90deg); }
.flap.b { transform-origin: top center;    transform: rotateX(90deg); }
```

`transform-origin` 默认是元素中心。中心旋转的话，上半牌翻下去时它的**上边缘会先翘起来往屏幕外走**，看起来像整张牌被风吹起来，而不是一片绕轴转的硬片。

把轴压到底边（也就是牌的中间缝），旋转才变成"绕缝往下倒"：底边钉在缝上不动，顶边划出一道弧。真实翻牌机的转轴本来就在那条缝上。对称地，下半牌的轴在它的 `top center`，两片叶子共用同一个轴，方向差 180°。

> 坑：症状是翻的时候数字"穿模"，像是两片牌互相插过去。原因是忘了 `backface-visibility: hidden`，或者两片叶子的 `transform-origin` 一个设成 `bottom` 一个设成 `top` 却搞反了上下。前者加 `-webkit-` 前缀（Safari 仍需要）；后者按"上叶片轴在下边、下叶片轴在上边"核对，两次的 `rotateX` 符号也要相反。

---

## 3. 为什么每张牌都必须 `overflow: hidden`

```css
.half { position: absolute; left: 0; right: 0; height: 50%; overflow: hidden; }
.num  { position: absolute; left: 0; right: 0; height: 200%; display: grid; place-items: center; }
.half.t .num { top: 0; }
.half.b .num { bottom: 0; }
```

关键在于：**半张牌里装的是整张字**。`.num` 高度是父级的 200%，也就是完整的一位高度，靠 `top: 0` / `bottom: 0` 对齐到位的顶边或底边，再由父级的 `overflow: hidden` 裁掉露出去那一半。上半牌于是显示数字的上半身、下半牌显示下半身，拼起来正好一个完整的字；少了裁切，每张半牌里都是一份完整数字，缝那里上下对不上，一眼就假。

字的中间那一横（比如 `8` 的交叉点）正好落在缝上，所以演示里把缝做成一条独立的覆盖线：

```css
.digit::after {
  content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 1.5px;
  margin-top: -.75px; z-index: 5; pointer-events: none;
  background: rgba(0, 0, 0, .62);
}
```

`z-index: 5` 高于叶片的 3，翻动时这条缝一直压在牌面上，视觉上就成了叶片之间的机械间隙。

---

## 4. 完整版：四层牌各干什么

一位的 DOM 是这样（`mk` 建的，JS 里拼）：

```js
var st = mk('t'), sb = mk('b'), ft = mk('t flap'), fb = mk('b flap');
d.appendChild(st); d.appendChild(sb); d.appendChild(ft); d.appendChild(fb);
```

四层：上静牌 `st`、下静牌 `sb`、上叶片 `ft`、下叶片 `fb`。每一下翻牌里只有三个写入动作：

```js
/* 上静牌立刻换成新值：它被叶片盖着，翻到一半时才露出来。
   下静牌必须留着旧值，等新叶片落下来盖住它之后再换。 */
face(c.st, to);
face(c.ft, from);
face(c.fb, to);
```

时序靠两个 animation 接力，各占一半：

```css
.flap.t.go { animation: flapTop var(--half) ease-in both; }
.flap.b.go { animation: flapBot var(--half) ease-out var(--half) both; }
```

上叶片带着旧数字从 `0deg` 往下倒，转到 `-90deg` 时它变成侧边、几乎看不见，被它盖住的上静牌（已经写好新值）整块露出来。紧接着下叶片展开：它挂着新数字的下半截，转轴在中间那条缝上，所以是从缝那里往下"摊开"，盖住的面积越来越大，直到 `0deg` 完全落平。两片是接力，中间不留空白帧。`ease-in` 配 `ease-out`，前一半越转越快、后一半越转越慢，接得上。

下静牌在这整段里必须保持旧值：下叶片还没盖全时，露出一角的正是它。换新值延到落平之后，第 6 步讲这条延迟。

`both` 在这里的作用和上一个组件不同：它让叶片在**延迟期间停在起始角度**，也就是下叶片在上叶片翻完之前不许提前落下来。少了它，两片同时动，翻牌变成"整块闪一下"。

---

## 5. 每位滚几趟，才是"机场味"的来源

每一位滚的趟数由它自己的差值决定。当前值是 `0000`、目标是 `427` 时，千位 0 趟、百位 4 趟、十位 2 趟、个位 7 趟。`9` 到 `0` 最能看出方向的影响：`dir = 1` 时是 1 趟，`dir = -1` 时要 9 趟。环形推进把它算对了：

```js
function roll(from, to, dir) {
  var out = [], v = from, guard = 0;
  while (v !== to && guard < 10) {
    v = (v + dir + 10) % 10;
    out.push(v);
    guard++;
  }
  return out;
}
```

`(v + dir + 10) % 10` 里的 `+ 10` 是为了让 `-1 % 10` 在 JS 里也落在 `[0, 10)` 区间。`guard < 10` 兜住输入异常，保证循环一定能退出。

排程用每位一份队列加一个下次可翻时间戳：

```js
if (queues[i].length && t >= nextAt[i]) {
  flip(i, queues[i].shift(), t);
  nextAt[i] = t + T;
  busy = true;
}
```

于是四位同时开始、个位停得最晚：高位先落定、低位还在滚，跟真牌一致。

勾上「全部同时翻」就换成一个共享节拍，每拍四位一起翻；队列已经空的位翻一张内容相同的牌，看着就是原地白翻一下。这是刻意做的对照，用它确认"错峰"是效果的一部分，而不是实现上的意外。

---

## 6. 提交下静牌，以及一个 rAF 都不多留

第 4 步留了一个问题：下静牌换新值要延到叶片落平之后，也就是"T 毫秒后写一次"。不用 `setTimeout`，改成把待办挂进队列，由同一个 rAF 处理：

```js
commits.push({ at: now + T, el: c.sb, v: to });
```

```js
for (var c = commits.length - 1; c >= 0; c--) {
  if (t >= commits[c].at) { face(commits[c].el, commits[c].v); commits.splice(c, 1); }
}
```

注意 `flip()` 里会先把这个格子旧的待办删掉再压新的：

```js
for (var p = commits.length - 1; p >= 0; p--) {
  if (commits[p].el === c.sb) commits.splice(p, 1);
}
```

连续翻的时候一位一秒内要翻好几趟，不去重的话两条待办抢着写同一个节点，处理到后面那条时把静牌又写回旧数字，出现"数字倒退"。

停止条件是整个循环不再忙：

```js
if (busy) raf = requestAnimationFrame(tick);
else raf = null;
```

翻完即停帧，空闲时不占 CPU。重启动画那一下需要跨帧（同一帧里 remove 再 add 同一个类，浏览器认为动画从没结束过），靠读一次 `offsetWidth` 强制重算解决：

```js
c.ftBox.classList.remove('go');
c.fbBox.classList.remove('go');
void c.ftBox.offsetWidth;
c.ftBox.classList.add('go');
c.fbBox.classList.add('go');
```

这里每次翻牌强制重算一次布局。一次跳转总共也就十来下，而且都发生在数值变化的瞬间，不是每帧都读，所以可以接受。真要挪到高频场景，就改用 `animationend` 重启动画，把这次读取省掉。

---

## 7. 接进真实项目

- **适合**：金额、库存、里程、播放次数这类"数字本身是主角"的展示位，以及倒计时、评分。收益是让人看见"它真的变了"，比一次 color flash 有效。
- **不适合**：高频更新的指标、表格里的每一行、位数不定的地方。位数一变整块要重建，写入次数和强制布局读取次数都随位数线性叠加。
- 长度控制：`digitsOf()` 把值左补零到固定 4 位，这是翻牌机的做法（牌位是死的）。业务里不想显示前导零，就在 CSS 里给高位加 `visibility: hidden`，别改 DOM 数量。
- 无障碍：这块 DOM 里全是装饰性字形，读屏拿到的是四个重复数字。所以 `.board` 上挂 `role="img"`，并在每次 `start()` 里刷新 `aria-label`。
- 降级：`prefers-reduced-motion` 下走 `start()` 里的分支，四位直接写终值、不建队列，CSS 里也有一条规则关掉 `animation`。

---

## 8. 自查清单

- [ ] 叶片停在终态（`-90deg` / `0deg`）而不是靠 `display` 切换，移除动画类不会闪
- [ ] 上叶片轴在底边、下叶片轴在顶边，两者共用中间那条缝
- [ ] 每张半牌都有 `overflow: hidden`，`.num` 高度是父级 200%
- [ ] 都写了 `backface-visibility: hidden` 和 `-webkit-` 前缀
- [ ] 每位独立排程，个位滚的趟数明显多于高位
- [ ] 下静牌的提交走 rAF 队列，且每位只留一条待办
- [ ] 翻完停止排帧；`role="img"` 的 `aria-label` 随数值刷新
- [ ] `prefers-reduced-motion` 分支实测过，不是只写了 CSS

## 相关组件

- [滚动错峰入场](#/stagger-reveal)：同样是"错峰"，那里错的是列表项，这里错的是数字的每一位。
- [环形进度仪表](#/pie-gauge)：也需要数字缓动，但它用 count-up，不需要三维结构，成本更低。
- [动态条形竞赛图](#/bar-chart-race)：FLIP 那套"先测再反向偏移"的思路，和这里靠 `transform-origin` 定转轴是同一类问题。
