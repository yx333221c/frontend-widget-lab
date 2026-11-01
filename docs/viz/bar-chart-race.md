# 动态条形竞赛图（Bar Chart Race）制作教学

> 目标：让 8 根柱子每换一个年代就重新排名，交换位置时互相穿过去，而不是整屏闪烁重画。
> 产出文件：[`widgets/viz/bar-chart-race.html`](../../widgets/viz/bar-chart-race.html)
> 难度：进阶 · 约 35 分钟

---

## 0. 先想清楚：直接重排 DOM 为什么不行

最省事的写法是把数据排好序，清空容器，重新 `appendChild`（下面这段是反面写法，组件里没有）：

```js
rows.sort((a, b) => b.value - a.value);
plot.innerHTML = '';
rows.forEach(r => plot.appendChild(r.el));
```

它确实"对"，问题有三个。位置是瞬移的：上一帧 React 在第 5 行，这一帧在第 1 行，人眼追不到中间过程，只能重新读名字来确认发生了什么；条形长度的变化也一起消失，观感像幻灯片翻页；而一旦你想改成"每根柱子一个 `position:absolute` 加 `top`"，就会撞上布局重排和 `top` 进不了合成层这两个新问题，代码反而更长。

竞赛图的正确心智模型是：**位置变化是一次布局跳变，动画要"事后补"**。先让 DOM 跳到最终位置，再把元素反向推回起点，然后播放回零。这套做法叫 FLIP，它是这类组件唯一的难点。

---

## 1. 先把结构定下来：名次 = DOM 顺序

8 行都在普通流里，纵向位置完全由浏览器排。每行是三列 flex：名字、轨道、末端缓冲区。

```js
    el.innerHTML =
      '<span class="name">' + s.name + '</span>' +
      '<span class="track"><span class="fill"></span>' +
      '<span class="num"><b>0</b><i></i></span></span>' +
      '<span class="pad"></span>';
```

换帧时只做一件事，按新名次把行重新 append：

```js
var order = rows.slice().sort(function (a, b) {
  var d = b.v[tick] - a.v[tick];
  if (d) return d;
  return a.id < b.id ? -1 : 1;      // 稳定 tie-break：同分按 id，否则名次每帧抖动
});
order.forEach(function (r) { plot.appendChild(r.el); });
```

名次编号写在 CSS 里，用 `counter` 由 DOM 顺序自动算出，不需要 JS 改文本：

```css
.plot { position: relative; counter-reset: rank; }
.row::before {
  content: counter(rank);
  counter-increment: rank;
  position: absolute; left: 2px; top: 50%; transform: translateY(-50%);
  font: 10px ui-monospace, Consolas, monospace; color: #55627d;
}
```

这样 `appendChild` 之后编号自然就对了，少一次 DOM 写入。

数值轴用一条 1px 竖线的背景块平铺，和下方 `0 / 25 / 50 / 75 / 100` 的百分比刻度共用同一套数值，柱子末端和刻度线能对齐：

```css
.track {
  background-image: linear-gradient(90deg, rgba(255, 255, 255, .1) 0 1px, transparent 1px);
  background-size: 25% 100%;
}
```

轴那一行复用 `.row` 的三列结构（同样的 `.name` / `.cell` / `.pad`），所以它天然和轨道等宽，不用手算 `padding-left`。这是个容易做歪的地方：定位元素的百分比参照的是包含块的 padding box，不是内容盒，用魔法数字撑出来的刻度一定会偏。

---

## 2. FLIP：First、Invert、Play

完整代码就是 `setFrame()` 里这一段，顺序不能调。

```js
    /* ① First —— 先记下每行此刻在屏幕上的真实 top。
       必须用 getBoundingClientRect：它包含"上一段还没播完的过渡"，
       所以动画中途插进新一帧也不会跳回起点。 */
    rows.forEach(function (r) { r.first = r.el.getBoundingClientRect().top; });

    /* ② 改数据 + 重排 DOM。做完这一步，布局里才存在新的位置（Last）。 */
    order.forEach(function (r) { plot.appendChild(r.el); });

    /* ③ Last —— 再读一次 rect。这次读取本身就会触发 reflow，
       不读的话浏览器不会告诉你新位置，Invert 的量就算不出来。 */
    rows.forEach(function (r) { r.last = r.el.getBoundingClientRect().top; });

    /* ④ Invert —— 关掉过渡，把每行用 transform 反向推回 First 的位置。 */
    rows.forEach(function (r) {
      r.el.style.transition = 'none';
      r.el.style.transform = 'translateY(' + (r.first - r.last).toFixed(2) + 'px)';
    });

    /* ⑤ 强制一次布局：把上面这批 transform 提交掉，
       否则它会和下面"translateY(0)"被合并成一次样式更新，动画直接消失。
       读一个和样式无关的布局属性即可，offsetHeight 最便宜。 */
    void plot.offsetHeight;

    /* ⑥ Play —— 把 transform 收回 0，交还给 transition 播放。 */
    rows.forEach(function (r) {
      r.el.style.transition = tr;
      r.el.style.transform = 'translateY(0)';
    });
```

关键在第 ⑤ 步。**如果不在 Play 之前强制一次布局，Invert 和 Play 两次赋值会被合并成一次样式更新**：浏览器只看到"transform 从旧值变成 0"，中间那个反向位移根本不存在，动画直接消失，效果退化成瞬移。读 `offsetHeight`、`getBoundingClientRect()`、或者调 `getComputedStyle()` 都能触发这次提交，`offsetHeight` 最便宜，因为它不参与绘制。

第 ① 步和第 ③ 步的 `getBoundingClientRect()` 也不是装饰。它是同步布局读取：调用时浏览器必须先把待处理的样式和布局算完，才能返回真实像素位置。所以第 ③ 步那次读取本身就让重排后的新布局落了地，`Last` 才是可信的。跳过它去读"数据里认为的位置"，你就得自己算行高、间距、当前名次，一个都错不得。

> 坑：症状是柱子换位时先"闪回起点再冲出去"，或者整段动画时有时无。原因是漏了第 ⑤ 步的强制布局。修法就是把 `void plot.offsetHeight;` 放在 Invert 循环和 Play 循环之间，一行都不能挪。

---

## 3. 为什么用 transform 改位置，而不是 top 或 SVG 的 y

先看代价。`top` 是布局属性：每帧改它都要重算布局再重绘，8 行就是每帧 8 次重排，还会连带影响兄弟节点的位置。`transform` 是合成属性：元素被提升为独立合成层之后，后续每帧只改矩阵、交给合成线程，主线程与布局、绘制都无关。行上那句 `will-change: transform` 就是为它准备的。

SVG 的 `y` 属性更糟：它既不是布局属性也不是合成属性，改它要走属性解析加重绘整棵子树，叠上滤镜和 `clip-path` 更贵。所以本组件里所有会动的东西都只碰 `transform`：行用 `translateY` 换位，条长用 `scaleX`。

```css
.fill {
  position: absolute; left: 0; top: 0; bottom: 0; width: 100%;
  border-radius: 3px; transform-origin: left center; transform: scaleX(0);
}
```

```js
r.fill.style.transform = 'scaleX(' + (val / MAX) + ')';
```

`scaleX` 的副作用要提前知道：条的圆角和描边会被横向压扁，值很小时右端瘪下去。演示里圆角只有 3px 看不出来，换成 12px 大圆角就会明显变形，那种情况改用 `width` 加 `transition`，接受重排。合成层也不是白拿的：每层都要一块纹理显存，别在几百个条目的表格里给每行都挂 `will-change`。

---

## 4. 打断进行中的动画：这正是 FLIP 值钱的地方

演示里 FLIP 时长固定 520ms，帧间隔是 `1150 / 速度`。速度 1.0× 时间隔 1150ms，动画早播完了；拉到 2.5×，间隔 460ms，比动画还短，于是每一帧都在打断上一段还没结束的过渡。

这不会出问题，因为第 ① 步读的是 rect，不是数据。rect 反映的是**过渡当前播放到的瞬时位置**，所以 Invert 量算出来的是"从我此刻所在之处到新位置"，接得上。假如改成"用名次 × 行高"来推算 First，打断那一刻元素实际还在半路上，推算值就会让它从半路瞬移回起点，看起来就是抖动。

顺手一个好处：重排、缩放、滚动之后 FLIP 依然正确，因为它每次都实测。你要是写过"缓存坐标 + 手动失效"的动画，就知道省掉这套失效逻辑有多轻松。

---

## 5. 数值标签要缓动跟随，不能跟着瞬移

这是竞赛图最容易做错的一处。条子滑过去了，数字"啪"地跳到新值，人的注意力会被数字吸走，位置移动反而白做。数字得慢慢追上来。

标签不能用 CSS transition：要插值的除了位置还有文本内容本身，CSS 管不了 `textContent`。所以每帧手动 lerp：

```js
    var k = dt / 16.6667;                        // 归一到 60fps，高刷屏不加速
    var ease = 1 - Math.pow(1 - 0.16, k);        // 每帧补齐剩余距离的 16%
    r.x += (r.tx - r.x) * ease;                // lerp：位置
    r.disp += (r.tv - r.disp) * ease;          // lerp：数字本身
    r.num.style.transform = 'translate(' + r.x.toFixed(1) + 'px,-50%)';
    r.valEl.textContent = Math.round(r.disp);
```

```js
    if (playing || busy) raf = requestAnimationFrame(loop);
    else raf = null;
```

`0.16` 这个系数在 `0.10 ~ 0.22` 之间都能看。小了数字拖得太久，下一帧数据又来它还没追完，读数会一直落后一个年代；大了和条子同步，就退回瞬移。`k = dt / 16.6667` 这行别省：直接写 `r.x += (r.tx - r.x) * 0.16`，帧率翻倍补间就快一倍，同一份代码在两种屏上手感不一样。

循环的启停用阈值判定（剩余 > 0.3px 或差值 > 0.05），否则数字永远在"再补一点点"，rAF 空转。暂停且标签停稳就关掉排帧，再点播放会重新 `kick()`。

---

## 6. 同分抖动：稳定排序与 tie-break

最后一帧 Ember 和 jQuery 都是 10。若比较函数只写 `b.v[tick] - a.v[tick]`，这两行的先后就不由数据决定了。现代引擎的 `Array.prototype.sort` 是稳定的，看起来"不会乱"，但这里每帧都是新数组重排：上一帧的相对顺序只要变过一次，之后就被一直保留，肉眼看到的是并列两行来回穿插。

修法是把 tie 交给一个和数据无关的固定键：

```js
if (d) return d;
return a.id < b.id ? -1 : 1;
```

原则是**比较函数必须对同一份输入给出唯一确定的顺序**。真实项目里这个键通常是 id，也可以是首次上榜的时间。同样的道理适用于 `NaN`：数据缺失时 `b.v - a.v` 得到 `NaN`，整次排序变成引擎的即兴发挥，脏数据要在排序之前清掉。

---

## 7. 接进真实项目

- 颜色绑 id 不绑名次。演示里 `fill.style.background` 只在建表时设一次。按名次上色（第一名金、末位灰）会让注意力跟着颜色跑，等于暗示"排名比数据重要"。
- 帧数据预取完再播：每帧都要读两次 rect、写两次样式，边播边请求会在关键帧留下空档。
- 条目超过 20 个就只播前 10 名，其余淡出堆在底部。名次差 1 的两行在长列表里换位只有几 px 位移，动画只剩噪声。
- 无障碍：排序信息对屏幕阅读器是丢失的，给容器 `aria-live="polite"` 播报"React，第一名，94"，或提供一个静态表格版本。
- `prefers-reduced-motion: reduce` 时不自动播放，只留单步按钮，每次点击是一次无动画的瞬时重排。

---

## 8. 自查清单

- [ ] Invert 与 Play 之间有一次强制布局（`void el.offsetHeight` 或读 rect）
- [ ] First 读的是 rect，不是"名次 × 行高"的推算值
- [ ] 换位只用 `translateY`，条长只用 `scaleX`，动画中没有 `top` / `width` / SVG `y`
- [ ] 数值标签走 rAF 插值，文本内容也插值，不是瞬变
- [ ] 插值系数按帧间隔归一（`1 - Math.pow(1 - k, dt / 16.6667)`）
- [ ] 比较函数有确定的 tie-break，同分不抖
- [ ] 暂停且标签停稳后停止排帧，`prefers-reduced-motion` 分支已处理
- [ ] 有数值轴刻度和一句"这数据是什么"的说明

## 相关组件

- [3D 翻牌计数器](#/flip-counter)：同样是"数字必须缓动跟随"的问题，那里用逐位翻转，这里用 lerp。
- [滚动错峰入场](#/stagger-reveal)：FLIP 处理"位置变了要动"，错峰处理"入场时间变了要等"，两者常配在一起。
- [手绘风雷达图](#/radar-chart)：同为不用图表库的手绘可视化，一个用 FLIP 排位置，一个用极坐标算点。
