/* ============================================================
   组件注册表 —— 主页目录与详情页都读这份数据。
   file:  组件源码路径（GitHub 相对路径，也是本地 iframe 路径）
   doc:   教学文档路径（Markdown）
   ============================================================ */
window.WIDGET_REGISTRY = {
  siteName: "Widget Lab · 前端交互组件实验室",
  updated: "2026-10-31",
  categories: [
    {
      id: "motion",
      title: "动效与过渡",
      glyph: "✨",
      blurb: "让元素以「有重量」的方式登场与退场：缓动曲线、错峰、3D 变换与滚动驱动动画。"
    },
    {
      id: "interaction",
      title: "交互手感",
      glyph: "🖱️",
      blurb: "指针、拖拽、惯性这些「摸得着」的细节，决定一个界面高级还是廉价。"
    },
    {
      id: "controls",
      title: "表单控件",
      glyph: "🎛️",
      blurb: "把浏览器默认控件换成可用、可键盘操作、可访问的自制版本。"
    },
    {
      id: "viz",
      title: "数据可视化",
      glyph: "📊",
      blurb: "不依赖图表库，用 SVG / Canvas 手绘出会动的数据表达。"
    },
    {
      id: "material",
      title: "质感与光影",
      glyph: "💎",
      blurb: "玻璃、金属、软阴影：纯 CSS 滤镜与混合模式堆出来的物理质感。"
    },
    {
      id: "playful",
      title: "趣味与彩蛋",
      glyph: "🎈",
      blurb: "那些「没什么用但让人会心一笑」的部分，往往是产品记忆点。"
    }
  ],
  widgets: [
    /* ---------------- motion ---------------- */
    {
      id: "magnetic-cursor", cat: "motion", title: "磁吸光标",
      summary: "按钮像有引力一样被指针吸过来，离开时以弹簧回弹，而不是生硬地静止不动。",
      tags: ["transform", "spring", "pointer"], difficulty: "进阶", minutes: 25,
      file: "widgets/motion/magnetic-cursor.html", doc: "docs/motion/magnetic-cursor.md",
      viewport: 240, accent: "#7c5cff"
    },
    {
      id: "stagger-reveal", cat: "motion", title: "滚动错峰入场",
      summary: "卡片随滚动依次浮现，每张延迟 60ms，配合 IntersectionObserver 只触发一次。",
      tags: ["IntersectionObserver", "animation-delay", "mask"], difficulty: "入门", minutes: 18,
      file: "widgets/motion/stagger-reveal.html", doc: "docs/motion/stagger-reveal.md",
      viewport: 320, accent: "#24d3ee"
    },
    {
      id: "flip-counter", cat: "motion", title: "3D 翻牌计数器",
      summary: "机场航班牌风格的数字翻滚：每一位独立做 rotateX 翻转，可正可负可滚动到目标值。",
      tags: ["backface-visibility", "3D", "requestAnimationFrame"], difficulty: "进阶", minutes: 35,
      file: "widgets/motion/flip-counter.html", doc: "docs/motion/flip-counter.md",
      viewport: 260, accent: "#f7b955"
    },
    {
      id: "gooey-menu", cat: "motion", title: "液态黏粘菜单",
      summary: "点击 FAB 展开子项时，圆形之间被「拉丝」黏开再断开——全靠一层 SVG 模糊 + 对比度滤镜。",
      tags: ["SVG filter", "feGaussianBlur", "feColorMatrix"], difficulty: "高级", minutes: 40,
      file: "widgets/motion/gooey-menu.html", doc: "docs/motion/gooey-menu.md",
      viewport: 400, accent: "#ff5f9e"
    },

    /* ---------------- interaction ---------------- */
    {
      id: "spotlight-card", cat: "interaction", title: "鼠标追随光斑卡片",
      summary: "指针滑过卡片时高光跟着走，边缘还有一圈随位置流动的渐变描边。",
      tags: ["CSS变量", "radial-gradient", "mask-composite"], difficulty: "入门", minutes: 15,
      file: "widgets/interaction/spotlight-card.html", doc: "docs/interaction/spotlight-card.md",
      viewport: 300, accent: "#24d3ee"
    },
    {
      id: "drag-snap-cards", cat: "interaction", title: "拖拽甩卡堆",
      summary: "Pointer Events 拖动卡片，松手时按速度和角度判定往哪甩出去，没达标就回弹归位。",
      tags: ["Pointer Events", "inertia", "snap-back"], difficulty: "进阶", minutes: 45,
      file: "widgets/interaction/drag-snap-cards.html", doc: "docs/interaction/drag-snap-cards.md",
      viewport: 420, accent: "#7c5cff"
    },
    {
      id: "rubber-band-list", cat: "interaction", title: "橡皮筋回弹列表",
      summary: "列表拖过边界时越拉越沉（阻尼 0.6 的幂函数），松手弹回，模仿 iOS 的 overscroll。",
      tags: ["damping", "transform-origin", "overflow"], difficulty: "进阶", minutes: 30,
      file: "widgets/interaction/rubber-band-list.html", doc: "docs/interaction/rubber-band-list.md",
      viewport: 380, accent: "#35d18e"
    },
    {
      id: "long-press-menu", cat: "interaction", title: "长按进度菜单",
      summary: "按住不放走满一圈进度环才触发右键菜单，中途松开就取消——把「误触」挡在交互层。",
      tags: ["conic-gradient", "pointerdown", "cancel"], difficulty: "进阶", minutes: 28,
      file: "widgets/interaction/long-press-menu.html", doc: "docs/interaction/long-press-menu.md",
      viewport: 340, accent: "#f7b955"
    },

    /* ---------------- controls ---------------- */
    {
      id: "otp-input", cat: "controls", title: "验证码分格输入",
      summary: "六个格子只用一个真 input，粘贴、退格、自动跳格全部自己接管，还能读 WebAuthn。",
      tags: ["单input", "paste", "caret"], difficulty: "入门", minutes: 20,
      file: "widgets/controls/otp-input.html", doc: "docs/controls/otp-input.md",
      viewport: 240, accent: "#7c5cff"
    },
    {
      id: "range-slider", cat: "controls", title: "双色滑块 + 数值气泡",
      summary: "轨道左侧填充、拇指悬浮显示气泡，支持键盘方向键与 ARIA，比原生 range 好用得多。",
      tags: ["input-range", "ARIA", "keyboard"], difficulty: "入门", minutes: 22,
      file: "widgets/controls/range-slider.html", doc: "docs/controls/range-slider.md",
      viewport: 220, accent: "#24d3ee"
    },
    {
      id: "toggle-morph", cat: "controls", title: "形变开关（日 / 夜）",
      summary: "拨动时太阳被遮成月牙、星星淡入，靠一个圆形遮罩位移完成整套天气过渡。",
      tags: ["clip-path", "transition", "role=switch"], difficulty: "进阶", minutes: 26,
      file: "widgets/controls/toggle-morph.html", doc: "docs/controls/toggle-morph.md",
      viewport: 220, accent: "#f7b955"
    },
    {
      id: "searchable-select", cat: "controls", title: "可搜索下拉",
      summary: "Combobox 模式：输入即过滤、上下键移动、回车选中、Esc 关闭，焦点锁定在弹窗里。",
      tags: ["combobox", "focus-trap", "keyboard"], difficulty: "高级", minutes: 40,
      file: "widgets/controls/searchable-select.html", doc: "docs/controls/searchable-select.md",
      viewport: 380, accent: "#35d18e"
    },

    /* ---------------- viz ---------------- */
    {
      id: "bar-chart-race", cat: "viz", title: "动态条形竞赛图",
      summary: "每帧重新排序并用 FLIP 让柱子互相穿过换位，数字缓动跟随，纯 SVG 无图表库。",
      tags: ["FLIP", "SVG", "sort-transition"], difficulty: "进阶", minutes: 35,
      file: "widgets/viz/bar-chart-race.html", doc: "docs/viz/bar-chart-race.md",
      viewport: 380, accent: "#7c5cff"
    },
    {
      id: "radar-chart", cat: "viz", title: "手绘风雷达图",
      summary: "极坐标算点、SVG 路径成面，虚线描边加抖动滤镜，做出「纸上手绘」的图表质感。",
      tags: ["极坐标", "path", "feTurbulence"], difficulty: "进阶", minutes: 32,
      file: "widgets/viz/radar-chart.html", doc: "docs/viz/radar-chart.md",
      viewport: 380, accent: "#24d3ee"
    },
    {
      id: "sparkline-heart", cat: "viz", title: "心跳迷你折线",
      summary: "Canvas 逐帧推进的心电图，波形扫过处最亮、尾部渐隐，一条 dashOffset 就够。",
      tags: ["Canvas", "lineDashOffset", "requestAnimationFrame"], difficulty: "入门", minutes: 24,
      file: "widgets/viz/sparkline-heart.html", doc: "docs/viz/sparkline-heart.md",
      viewport: 240, accent: "#ff5f9e"
    },
    {
      id: "pie-gauge", cat: "viz", title: "环形进度仪表",
      summary: "conic-gradient 画环 + mask 挖空，进度数字缓动，指针经过时还能高亮当前分段。",
      tags: ["conic-gradient", "mask", "count-up"], difficulty: "入门", minutes: 18,
      file: "widgets/viz/pie-gauge.html", doc: "docs/viz/pie-gauge.md",
      viewport: 300, accent: "#35d18e"
    },

    /* ---------------- material ---------------- */
    {
      id: "glass-card", cat: "material", title: "玻璃拟态卡片",
      summary: "backdrop-filter 之外还要加高光边、噪点与色偏，玻璃才不透底、不像一块灰板。",
      tags: ["backdrop-filter", "noise", "border-gradient"], difficulty: "入门", minutes: 20,
      file: "widgets/material/glass-card.html", doc: "docs/material/glass-card.md",
      viewport: 340, accent: "#7c5cff"
    },
    {
      id: "neumorphic-keys", cat: "material", title: "新拟态按键面板",
      summary: "同色双向阴影（一深一浅）伪造凸起，按下时内外阴影互换，做出软胶键盘的手感。",
      tags: ["box-shadow", "inset", "active-state"], difficulty: "入门", minutes: 22,
      file: "widgets/material/neumorphic-keys.html", doc: "docs/material/neumorphic-keys.md",
      viewport: 320, accent: "#9aa6c0"
    },
    {
      id: "gradient-border", cat: "material", title: "流光渐变描边",
      summary: "用 conic-gradient + @property 让描边角度可动画，两种挖空方案对比：padding-box 与 mask。",
      tags: ["@property", "conic-gradient", "mask"], difficulty: "进阶", minutes: 28,
      file: "widgets/material/gradient-border.html", doc: "docs/material/gradient-border.md",
      viewport: 340, accent: "#ff5f9e"
    },
    {
      id: "metal-plate", cat: "material", title: "拉丝金属铭牌",
      summary: "重复线性渐变做拉丝纹理，叠加斜向高光和凹凸刻字阴影，一块纯 CSS 铝板。",
      tags: ["repeating-linear-gradient", "text-shadow", "blend-mode"], difficulty: "进阶", minutes: 30,
      file: "widgets/material/metal-plate.html", doc: "docs/material/metal-plate.md",
      viewport: 320, accent: "#c9d3e6"
    },

    /* ---------------- playful ---------------- */
    {
      id: "confetti-burst", cat: "playful", title: "点击撒花",
      summary: "Canvas 粒子 + 重力阻尼 + 矩形旋转，300 个碎片还能保持 60fps 的要点都在这里。",
      tags: ["Canvas", "particle", "gravity"], difficulty: "进阶", minutes: 30,
      file: "widgets/playful/confetti-burst.html", doc: "docs/playful/confetti-burst.md",
      viewport: 340, accent: "#f7b955"
    },
    {
      id: "tilt-maze", cat: "playful", title: "倾斜滚球迷宫",
      summary: "指针位置当「重力倾角」，小球带速度与摩擦地滚动，撞上墙会沿法线弹开。",
      tags: ["物理", "collision", "requestAnimationFrame"], difficulty: "高级", minutes: 50,
      file: "widgets/playful/tilt-maze.html", doc: "docs/playful/tilt-maze.md",
      viewport: 420, accent: "#35d18e"
    },
    {
      id: "noise-glitch", cat: "playful", title: "故障风文字抖动",
      summary: "两层伪元素错色 + 随机 clip-path 切片，配合 steps() 时序，还原 CRT 信号断裂。",
      tags: ["clip-path", "steps()", "mix-blend-mode"], difficulty: "进阶", minutes: 26,
      file: "widgets/playful/noise-glitch.html", doc: "docs/playful/noise-glitch.md",
      viewport: 260, accent: "#24d3ee"
    },
    {
      id: "pet-cursor", cat: "playful", title: "跟随的小宠物",
      summary: "一只用 CSS 拼的小猫跟着指针走，走快了会「跑」，停下会坐下眨眼——状态机 + 缓动。",
      tags: ["state-machine", "lerp", "CSS-art"], difficulty: "进阶", minutes: 38,
      file: "widgets/playful/pet-cursor.html", doc: "docs/playful/pet-cursor.md",
      viewport: 340, accent: "#ff5f9e"
    }
  ]
};
