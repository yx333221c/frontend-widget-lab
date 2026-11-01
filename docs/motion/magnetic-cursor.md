# 磁吸光标（Magnetic Cursor）制作教学

> 目标：让按钮像有引力一样被指针吸过来，离开时用弹簧回弹。
> 产出文件：[`widgets/motion/magnetic-cursor.html`](../../widgets/motion/magnetic-cursor.html)
> 难度：进阶 · 约 25 分钟

---

## 0. 先想清楚：它为什么不"廉价"

把 CSS 写成这样就叫"廉价"（下面是假想的反面写法，不在组件文件里）：

```css
.btn:hover { transform: translate(8px, 4px); }
```

问题有三个：位移是**固定值**（指针在左边 5px 和左边 80px，按钮反应一样）、方向**与指针无关**、并且**瞬间到位**。人眼对"物理一致性"很敏感，一旦位移和指针位置脱钩，就会读出来"这是特效"。

所以磁吸要做的是：**位移由指针位置实时决定，且变化过程经过一个阻尼弹簧。** 这两点比数值大小重要：系数即使小到 0.15，只要实时性和弹簧都在，效果就还是"被吸住"，而不是"动了"。

所以我们只需要做三件事：

1. 持续知道指针在哪、元素中心在哪。
2. 算出"应该吸到哪里"（目标位移）。
3. 让当前位移平滑地追赶目标位移（弹簧）。

---

## 1. 位移计算：距离越远吸得越弱

拿到元素中心后，算指针相对中心的偏移：

```js
var dx = pointer.x - it.bx, dy = pointer.y - it.by;
var dist = Math.hypot(dx, dy);
```

直接 `dx * 0.35` 会有一个刺眼的问题：**指针跨过生效半径边界的那一帧，位移从 27px 突然跳到 0**。用衰减因子解决：

```js
var falloff = 1 - dist / it.r;
falloff = falloff * falloff;         // 平方衰减更柔和
it.tx = dx * CFG.strength * falloff;
it.ty = dy * CFG.strength * falloff;
```

平方衰减（ease-out quadratic）让曲线在边界处**趋近于 0 而非撞向 0**，跳变就看不见了。

> 系数取值：`strength` 在 `0.25 ~ 0.4` 之间最稳。超过 `0.5` 后元素会追着指针跑出布局，挤到邻居；演示里调到 `0.7` 就是故意给你看这个副作用。

---

## 2. 中心坐标从哪来（以及什么时候会失效）

`getBoundingClientRect()` 给的是**视口坐标**，和 `e.clientX` 同一坐标系，可以直接相减——这是最省事的做法。但它是同步布局读取（forced layout），**不能每帧对每个元素都调用**。

方案：把 rect 缓存起来，只在"会失效"的时候重算。

```js
var dirty = true;
window.addEventListener('scroll', function () { dirty = true; }, { passive: true });
window.addEventListener('resize', function () { dirty = true; });
// 动画帧里：if (dirty) { items.forEach(measure); dirty = false; }
```

还有一个坑：**元素本身在被位移**，所以 rect 中心也随位移变化——把"含位移的 rect"当中心就成正反馈，元素会追着指针跑飞。我们的做法是：只在位移为 0 时采样基准中心（演示里靠 `measure()` 的调用时机控制），并且衰减系数小于 1，让整体仍是收敛的负反馈。

更稳的写法是缓存**未 transform 的布局中心**：把元素外层再包一层不做动画的容器，只对容器取 rect。

---

## 3. 弹簧：为什么不用 CSS transition

写成 `transform` + `transition: .3s` 理论上也能插值，但磁吸每帧都在改目标值，CSS transition 会被**不断重置**，结果变成"每帧都从头开始 0.3s 动画"，手感发糊。

自己做一阶指数趋近，代码短，也没有额外状态要维护：

```js
var ease = 1 - Math.pow(1 - CFG.spring, k);
it.cx += (it.tx - it.cx) * ease;
```

`spring = 0.14` 意思是"每帧补齐剩余距离的 14%"。这种插值只会向目标靠近、不会超过，所以不过冲、不来回晃；代价是起步那一下偏软。想要"先冲后稳"就得换成带速度项的弹簧，代价是多两个变量。

`k = dt / 16.6667` 这行别省。120Hz 屏幕上每帧只有 8.3ms，直接用固定的 0.14，动画速度会快一倍。归一之后，同一套参数在 60 / 90 / 120Hz 下手感一致。

---

## 4. 只在一个 rAF 里动，且静止时关掉

不要在 `pointermove` 回调里写 `transform`：指针移动事件的频率高于屏幕刷新率，每个多余的事件都算了一次没人看的帧，还会和合成器抢主线程。

正确结构：事件里**只记坐标**，动画统一在一个 `requestAnimationFrame` 循环里跑。再加一个省电细节：

```js
if (moving || pointer.active) raf = requestAnimationFrame(loop);
else raf = null;                 // 静止即停循环
// pointermove / pointerdown 里 kick() 唤醒
```

`moving` 的判定用阈值（剩余距离 > 0.05px），避免"永远在追、永远追不完"的空转。

---

## 5. 内层反向位移

外层元素被吸向指针，**里面的文字再往同方向多走一小截**：

```js
it.inner.style.transform = 'translate3d(' +
  (it.cx * CFG.innerRatio).toFixed(2) + 'px,' + (it.cy * CFG.innerRatio).toFixed(2) + 'px,0)';
```

视觉上像内容有重量、被惯性拖在后面（`CFG.innerRatio` 在演示里是 `0.35`）。代价是一次乘法。演示面板里可以把它关掉再打开对比。

用 `translate3d` 而不是 `translate`：前者强制元素进 GPU 合成层，`will-change: transform` 同理。**元素多时别滥用**，每个合成层都吃显存。

---

## 6. 触屏与可访问性

- `e.pointerType === 'touch'` 时**直接 return**：手指没有"悬停"状态，磁吸只会让元素躲开指尖，反人类。改成按下时短暂吸附一次、松手回弹（演示里就是这么做的）。
- 尊重 `prefers-reduced-motion`：位移属于装饰性动效，应在该模式下完全跳过（把 `strength` 置 0 即可，元素照常响应点击）。
- 位移后元素的**命中区域也跟着动了**。如果吸附半径大于元素本身，用户点击时可能"以为点在按钮上、实际点空"。所以生效半径不要明显大于元素，或只在 `:hover` 时启用位移、`pointerdown` 后立刻归零目标值。

---

## 7. 接进真实项目

剥掉控制面板和调试环，核心就是「记坐标 → 算目标 → 弹簧追赶」三步。抽成属性挂到既有元素上更好用 —— 下面两段是建议的封装写法，不在本组件文件里：

```html
<button data-magnet="120">订阅</button>
```

```js
document.querySelectorAll('[data-magnet]').forEach(enhance);
```

- **适合**：CTA 按钮、图标按钮、导航项、卡片里的"查看详情"。
- **不适合**：表单输入框（抢焦点会干扰光标定位）、密集列表项（互相挤）、以及任何需要精确点击的小目标。
- 一个页面里**最多给 1 ~ 2 个元素**开磁吸。全都吸，等于没有重点，磁吸也就失去了"突出重点"这个唯一作用。

---

## 8. 自查清单

- [ ] 半径边界处有衰减，没有位移跳变
- [ ] 用帧间隔归一插值系数（高刷屏手感一致）
- [ ] 事件里只记坐标，`transform` 只在 rAF 里写
- [ ] 静止时 `cancelAnimationFrame` / 停止排帧
- [ ] 触屏分支与 `prefers-reduced-motion` 已处理
- [ ] `pointerdown` 后目标位移归零，避免点击落空
- [ ] 全站磁吸元素 ≤ 2 个

## 相关组件

- [鼠标追随光斑卡片](#/spotlight-card)：同样依赖"指针相对元素中心"的计算，可以复用这里的测量逻辑。
- [倾斜滚球迷宫](#/tilt-maze)：把指针位置当"重力倾角"，是磁吸思路的反向应用。
- [液态黏粘菜单](#/gooey-menu)：FAB 展开时配合磁吸，黏连效果更明显。
