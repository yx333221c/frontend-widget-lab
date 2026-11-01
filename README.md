# Widget Lab · 前端交互组件实验室

**24 个手写前端组件**，每个都是一个独立可运行的 HTML 文件：零依赖、零构建、复制即用。
每个组件配四段内容：实时演示、组件描述、完整源码、制作教学。

> 在线预览：**https://yx333221c.github.io/frontend-widget-lab/**

## 目录

| 分类 | 组件 |
|---|---|
| **✨ 动效与过渡**<br><sub>让元素以「有重量」的方式登场与退场：缓动曲线、错峰、3D 变换与滚动驱动动画。</sub> | [磁吸光标](widgets/motion/magnetic-cursor.html) · [教学](docs/motion/magnetic-cursor.md)<br>[滚动错峰入场](widgets/motion/stagger-reveal.html) · [教学](docs/motion/stagger-reveal.md)<br>[3D 翻牌计数器](widgets/motion/flip-counter.html) · [教学](docs/motion/flip-counter.md)<br>[液态黏粘菜单](widgets/motion/gooey-menu.html) · [教学](docs/motion/gooey-menu.md) |
| **🖱️ 交互手感**<br><sub>指针、拖拽、惯性这些「摸得着」的细节，决定一个界面高级还是廉价。</sub> | [鼠标追随光斑卡片](widgets/interaction/spotlight-card.html) · [教学](docs/interaction/spotlight-card.md)<br>[拖拽甩卡堆](widgets/interaction/drag-snap-cards.html) · [教学](docs/interaction/drag-snap-cards.md)<br>[橡皮筋回弹列表](widgets/interaction/rubber-band-list.html) · [教学](docs/interaction/rubber-band-list.md)<br>[长按进度菜单](widgets/interaction/long-press-menu.html) · [教学](docs/interaction/long-press-menu.md) |
| **🎛️ 表单控件**<br><sub>把浏览器默认控件换成可用、可键盘操作、可访问的自制版本。</sub> | [验证码分格输入](widgets/controls/otp-input.html) · [教学](docs/controls/otp-input.md)<br>[双色滑块 + 数值气泡](widgets/controls/range-slider.html) · [教学](docs/controls/range-slider.md)<br>[形变开关（日 / 夜）](widgets/controls/toggle-morph.html) · [教学](docs/controls/toggle-morph.md)<br>[可搜索下拉](widgets/controls/searchable-select.html) · [教学](docs/controls/searchable-select.md) |
| **📊 数据可视化**<br><sub>不依赖图表库，用 SVG / Canvas 手绘出会动的数据表达。</sub> | [动态条形竞赛图](widgets/viz/bar-chart-race.html) · [教学](docs/viz/bar-chart-race.md)<br>[手绘风雷达图](widgets/viz/radar-chart.html) · [教学](docs/viz/radar-chart.md)<br>[心跳迷你折线](widgets/viz/sparkline-heart.html) · [教学](docs/viz/sparkline-heart.md)<br>[环形进度仪表](widgets/viz/pie-gauge.html) · [教学](docs/viz/pie-gauge.md) |
| **💎 质感与光影**<br><sub>玻璃、金属、软阴影：纯 CSS 滤镜与混合模式堆出来的物理质感。</sub> | [玻璃拟态卡片](widgets/material/glass-card.html) · [教学](docs/material/glass-card.md)<br>[新拟态按键面板](widgets/material/neumorphic-keys.html) · [教学](docs/material/neumorphic-keys.md)<br>[流光渐变描边](widgets/material/gradient-border.html) · [教学](docs/material/gradient-border.md)<br>[拉丝金属铭牌](widgets/material/metal-plate.html) · [教学](docs/material/metal-plate.md) |
| **🎈 趣味与彩蛋**<br><sub>那些「没什么用但让人会心一笑」的部分，往往是产品记忆点。</sub> | [点击撒花](widgets/playful/confetti-burst.html) · [教学](docs/playful/confetti-burst.md)<br>[倾斜滚球迷宫](widgets/playful/tilt-maze.html) · [教学](docs/playful/tilt-maze.md)<br>[故障风文字抖动](widgets/playful/noise-glitch.html) · [教学](docs/playful/noise-glitch.md)<br>[跟随的小宠物](widgets/playful/pet-cursor.html) · [教学](docs/playful/pet-cursor.md) |

## 怎么用

- **看效果**：打开 <a href="https://yx333221c.github.io/frontend-widget-lab/" target="_blank">https://yx333221c.github.io/frontend-widget-lab/</a>，每个组件详情页第一段就是运行中的 iframe，可以直接操作。
- **抄代码**：详情页第三段是带行号和语法高亮的完整源码，右上角有「GitHub 打开该文件」和「复制全部」。
- **学原理**：第四段是制作教学，讲这一步为什么这么写、参数怎么调、坑在哪。
- **本地跑**：clone 后直接用浏览器打开 `index.html` 能看目录；详情页的源码/教学两段要靠 fetch 读文件，本地请用静态服务器，例如 `npx serve .`。
- 组件文件本身完全自包含，双击 `widgets/<分类>/<组件>.html` 就能运行。

## 仓库结构

```
index.html            主页目录（分类 / 搜索 / 难度筛选）
widget.html           组件详情页（演示 / 描述 / 源码 / 教学 四段）
data/widgets.js       组件注册表，主页与详情页都读它
data/fragments/       每个组件的描述数据（JSON）
widgets/<分类>/       24 个组件源码，单文件自包含
docs/<分类>/          24 篇制作教学（Markdown）
assets/               站点样式与脚本、卡片缩略图
tools/                校验与截图脚本（见下）
CONTRIBUTING.md       新增组件的硬性规范
```

## 组件的共同约束

1. **零依赖**：不引 CDN、不 import 库、不用外部字体和图片。图形全部由 CSS / 内联 SVG / Canvas 绘制。
2. **单文件**：一个组件 = 一个 `.html`，CSS 在 `<style>`，JS 在 IIFE 里。
3. **可交互**：每个组件带 2~4 个参数控件，亲手拖动才算学会。
4. **性能自觉**：动画只用 `transform` / `opacity`；rAF 空闲时停止排帧；粒子类上限 400。
5. **可访问性**：可交互元素用原生标签，键盘可达，动效尊重 `prefers-reduced-motion`。

## 开发工具

```powershell
node tools/check.mjs        # 结构校验：文件齐全 / json 合法 / 文档骨架 / 语言规范（AI 味词表、破折号密度）
node tools/audit.mjs        # 深度语言审计：抓"高级感/通透感"这类玄学词，以及代码里找不到出处的数字
node tools/shoot.mjs        # headless Chrome 给全部组件拍缩略图 -> assets/shots/
node tools/httpcheck.mjs    # 起本地服务验证详情页四段是否真的填充
node tools/mkreadme.mjs     # 从注册表重新生成本文件
```

## 许可

代码与文档以学习为目的开放，MIT。

---
*当前状态：24/24 个组件已完成源码与教学。*
