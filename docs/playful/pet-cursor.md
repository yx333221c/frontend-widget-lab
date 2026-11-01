# 跟随的小宠物（Pet Cursor）制作教学

> 目标：一只纯 CSS 拼出来的小猫追随指针，走快了两条腿倒频、尾巴滞后摆，停下会坐下眨眼，而且空闲时完全不占 CPU。
> 产出文件：[`widgets/playful/pet-cursor.html`](../../widgets/playful/pet-cursor.html)
> 难度：进阶 · 约 38 分钟

---

## 0. 先想清楚：把条件散写在 `mousemove` 里为什么不对

最短能跑的版本（反例，不是本组件代码）：

```js
// 反例：条件散在各处
stage.addEventListener('pointermove', function (e) {
  pet.style.left = e.clientX + 'px';              // 直接写 left
  if (dist(e, pet) > 150) pet.classList.add('run');
  if (Math.random() < 0.01) blink();              // 随机眨眼
});
function blink() {
  eye.style.transform = 'scaleY(0.06)';
  setTimeout(function () { eye.style.transform = 'scaleY(1)'; }, 130);
}
```

三处会坏。写 `left` 每帧触发布局重排，比 `transform` 贵得多，而且拿不到平滑插值。`add('run')` 只有加没有减，跑起来就再也停不下来。最麻烦的是眨眼：随机触发加上 `setTimeout` 恢复，两个定时器会重叠——前一次的恢复回调把刚闭上的眼睛提前打开；而任何一段"跑步时眼睛要眯"的代码只要最后写了一次闭眼值、又没人给它配恢复，眼睛就从此卡在闭着的那一侧。散写条件的通病是：谁最后写谁赢，但没有任何地方保证一定会有一次复位。

正确的结构是把"现在是什么状态"变成一个变量，样式的唯一写入者就是它。

---

## 1. 纯 CSS 造型：斜杠语法才是关键

猫由 12 个 div 拼成，没有图片。能做出有机形状靠的是 `border-radius` 的斜杠语法：

```css
  .head {
    position: absolute; left: -23px; top: -46px; width: 46px; height: 40px;
    border-radius: 50% 50% 42% 42% / 58% 58% 42% 42%;
    background: linear-gradient(160deg, var(--fur) 0%, var(--fur-dk) 100%);
    z-index: 3;
  }
```

斜杠前面是四个角的**水平**半径，后面是对应的**垂直**半径。两者独立之后，一个角可以同时"横向很圆、纵向很扁"，四个角各自不同，轮廓就从胶囊变成了有下巴的头骨。只写 `border-radius: 50%` 时水平和垂直永远相等，形状只能落在"矩形→椭圆"这条线上，怎么调都像药丸。

同理，脚掌用 `50% 50% 42% 42% / 76% 76% 24% 24%`：上半圆、下半平，就是踩在地面上的样子。尾巴用 `clip-path` 加 `transform-origin: 0% 50%`（绕根部转）：

```css
  .tail {
    position: absolute; left: 16px; top: -18px; width: 30px; height: 7px; z-index: 1;
    border-radius: 4px 8px 8px 4px / 4px 7px 7px 4px;
    background: linear-gradient(90deg, var(--fur-dk), var(--fur));
    transform-origin: 0% 50%;            /* 绕根部转，见教学 §3 */
    will-change: transform;
  }
```

> 坑：症状是"坐下"时猫抽搐。原因是在 `.sitting` 里改了 `.body` 的 `height`：动画每帧读一次样式，改尺寸触发 layout，而 `transform` 不会。修法是把所有姿态差异都写成 `transform` 和 `border-radius`：

```css
  .pet.sitting .body { transform: translateY(-4px) scale(1.02, 1.18); }
  .pet.sitting .head { transform: translateY(-6px); }
```

`scale` 出来的"变高"在描边和渐变上会有轻微拉伸，但猫的尺寸小、形变只有 1.18 倍，看不出来。

朝向用 `scaleX(±1)` 镜像整只猫，只在真的横向移动超过 6 像素时才翻，否则指针原地抖动会让它每帧掉头。

---

## 2. 状态机：`enter` / `exit` 成对，临时态优先

状态表只有一个：

```js
  var STATES = {
    sit:  { enter: function () { pet.classList.add('sitting'); },
            exit:  function () { pet.classList.remove('sitting'); } },
    idle: { enter: noop, exit: noop },
    walk: { enter: noop, exit: noop },
    run:  { enter: noop, exit: noop }
  };
```

眨眼和吃鱼不是状态，是**带时限的临时态**：它们不改变身体姿态，只在期间冻结状态切换。

```js
  function set(next) {
    if (transient) return;              // 临时态期间禁止切换：眨眼中途不会被换成 run
    swap(next);
  }
```

这就回答了开头那个竞争：眨眼的 130 毫秒里指针怎么动都不会触发 `set`，所以不会有第二段代码去碰眼皮；`leaveTransient()` 到点必然把 `lid` 写回 1。而吃鱼时确实需要站起来，所以给它一条显式的路，绕过保护但说明意图：

```js
  function enterEat(now) {
    transient = 'eat';
    until = now + 1100;
    swap('idle');                       // 进餐时主动切到站姿，绕过 set 的保护
  }
```

`swap` 与 `set` 的区别就是"要不要临时态说了算"。两个函数分开写，读代码时不会混淆。

眨眼不看状态、只看时间，是一个独立的到点检查：

```js
    if (transient === 'blink' && t >= until) leaveTransient();
    if (!transient && (state === 'sit' || state === 'idle') && t >= blinkNext) enterBlink(t);
```

间隔写成 `2600 + Math.random() * 2400`，规律性眨眼像机器人，随机间隔才像活的。

---

## 3. 次级运动：尾巴比身体慢 0.4 个相位

走路用一个 `phase` 驱动全身：

```js
    var gait = Math.min(1, speed / 200);
    if (speed > 4) phase += dtN * (0.24 + 0.5 * gait);
```

`gait` 同时当幅度（静止时归零，走路不摆），`dtN` 是"折算成 60fps 帧数"，所以步频与刷新率无关。

```js
    var bobY = Math.sin(phase) * 2.6 * gait;
    var bodyAng = Math.sin(phase) * 4 * gait;
    var tailPhase = CFG.second ? phase - 0.4 : phase;
    var tailSwing = Math.sin(tailPhase) * 16 * (0.35 + gait) + bodyAng * 0.3;
```

尾巴与身体**永远同相**的话，一眼就假：真实的尾巴是被身体带动的，它的运动需要时间从根部传到尖端，所以总是滞后。物理上这就是阻尼摆的相位差；动画里用一个常数偏移 `- 0.4` 就抄到了近道。动画行业的名字叫 secondary motion，规则是"越靠末梢的部件，滞后越多、幅度越大"，所以尾巴（16 度）比躯干（4 度）摆得猛。

演示面板里"关掉次级运动"就是那行三元表达式的另一侧。看左上角面板更直接：关闭时 `body φ` 与 `tail φ` 两个数完全相等，打开时差固定 0.40。同一个道理用在脚掌上：两条腿用 `sin(phase)` 与 `-sin(phase)` 反相，抬落用 `cos(phase * 2)`，频率翻倍才像交替迈步。

---

## 4. 追指针：lerp 必须有速度上限

最省事的写法是纯指数趋近：

```js
    var want = 0;
    if (target.has && dist > CFG.arrive && transient !== 'eat') {
      want = Math.min(dist * CFG.follow, CFG.maxSpeed);
    }
```

`dist * CFG.follow` 就是"距离越大越快"，手感比固定速度好，因为远处赶路、近处减速收尾。但它**没有上限**：距离 600 像素时速度会变成几百倍于近处，一帧跨上百像素，画面上一只猫在瞬移，指针稍微抖一下它也跟着抖。`Math.min(..., CFG.maxSpeed)` 把远处钳成匀速直线跑，近处（`dist * 4.5 < 180`）仍然由距离决定速度，退让感就留在该出现的那一段。

`CFG.arrive` 是"到位半径"：低于 9 像素直接把速度归零。少了这一条，纯 lerp 永远在追、永远追不完，残余位移是亚像素的，而方向随指针噪声来回翻，看起来就是原地发抖。

> 坑：症状是"停下之后 rAF 还在跑，风扇开始转"。原因是 `settled` 只判断了速度，而眨眼是 `setTimeout` 驱动的独立时钟，速度常年为 0 但眼皮还需要更新。组件的处理是：停排 rAF，改用 `setTimeout` 约下一次眨眼，到点再 `kick()` 唤醒一帧。

```js
    var settled = speed < 2 && !transient && (!target.has || dist <= CFG.arrive + 1);
    if (!still && !settled) raf = requestAnimationFrame(frame);
    else { raf = null; lastT = 0; sleep(); }
```

面板右下角那行 `state` 就是给这个判断做示教的：静止时它写 `still`，你能看见循环真的停了。「静止（停 rAF）」开关再兜一层，`prefers-reduced-motion` 命中时默认就打勾——一只自己在页面角落跑来跑去的猫，对阅读是干扰。

---

## 5. 触屏：没有 hover，就把落点当目标

```js
  stage.addEventListener('pointerdown', function (e) {
    var b = stage.getBoundingClientRect();
    target.x = e.clientX - b.left; target.y = e.clientY - b.top;
    target.has = true;
    if (e.pointerType === 'touch') target.pin = true;
    kick();
  });
```

`pin` 是触屏专用的：手指抬起后不再有新坐标，若不清目标，猫会停在半路；`pin = true` 让它把最后那个点当承诺，一路走过去。「喂干鱼」也复用它：扔鱼时把目标钉在鱼上，猫走到就进 `eat`，吃完由 `leaveTransient()` 解除。

坐标一律减掉 `getBoundingClientRect()` 的 `left/top`，因为 `clientX` 是视口坐标、而 `pos` 是容器内坐标。详情页里 iframe 有 padding，直接用 `clientX` 会让猫偏出一截，而且窗口一滚就错位。

---

## 6. 实时状态面板是文档，不是装饰

```js
    probe.innerHTML = 'state <b class="st">' + (transient || state) + '</b>' +
      '<br>speed <b>' + Math.round(speed) + '</b>' +
      '<br>dist <b>' + Math.round(dist) + '</b>' +
      '<br>body φ <b>' + phase.toFixed(2) + '</b>' +
      '<br>tail φ <b>' + tailPhase.toFixed(2) + '</b>';
```

`state` 打印的是 `transient || state`，所以眨眼的瞬间你会看到 `blink` 盖住 `sit`，这正是临时态的语义。`speed` 和 `dist` 让人亲眼确认"上限在远处生效"：把速度滑杆拉到 420，猫一路狂奔，`state` 从 `walk` 变 `run`，到达后归零坐回 `sit`。

面板每秒写 `innerHTML`，成本比动画本体高，因此它只在循环活着时更新；静止后那行直接改成 `still`，不再刷新。真接进项目时这块应当删掉，或者只在 `?debug=1` 下渲染。

---

## 7. 接进真实项目

- 适合：品牌页的角落陪伴、空状态的"活物"、儿童向产品、彩蛋。一只就够，两只以上要共享同一个 `phase` 时钟，否则各自跑会散。
- 不适合：表单页（猫会追着光标跑，干扰输入）、任何需要长期驻留主视野的位置、以及正文密集的落地页——它是注意力的黑洞。
- 首屏规则：默认坐 + 眨眼，不要一进页面就乱跑；用户先读内容，指针一动它才醒。
- 尺寸控制：容器给 128 像素高已经够小，猫本身 46 像素宽。放大到 2 倍以上，`clip-path` 的耳朵和胡须（1 像素直线）会出现明显锯齿，那时应该改 SVG。
- 无障碍：整只猫 `aria-hidden="true"`，它对读屏没有任何意义；喂鱼这类可操作动作要留在真 `<button>` 上。

---

## 8. 自查清单

- [ ] 形状靠 `border-radius: A B C D / E F G H` 的斜杠语法，不是只有 `50%`
- [ ] 姿态差异只写 `transform` 与 `border-radius`，没有改宽高的动画
- [ ] 状态切换集中在一处，`enter` / `exit` 成对
- [ ] 临时态期间冻结切换，眼皮值必然被复位
- [ ] 追随速度是 `min(dist * k, maxSpeed)`，并有到达半径
- [ ] 尾巴相位滞后于身体，且面板能量出这个差值
- [ ] 每帧只写 `transform`，`getBoundingClientRect` 不在循环里
- [ ] 静止时停排 `rAF`，眨眼改由 `setTimeout` 约醒
- [ ] 触屏走"点落点 + pin"，默认坐姿不抢注意力

## 相关组件

- [磁吸光标](#/magnetic-cursor)：同样用帧间隔归一的指数趋近，那边的目标点由指针位置实时决定。
- [倾斜滚球迷宫](#/tilt-maze)：那边是「加速度 + 摩擦」的积分，这边是「按距离算速度」的 lerp，两种追随写法可以对照读。
- [点击撒花](#/confetti-burst)：喂鱼成功时接一次小爆发，比猫自己摇头晃脑更像一个"奖励"。
