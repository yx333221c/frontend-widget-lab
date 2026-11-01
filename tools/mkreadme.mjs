/* 从 data/widgets.js 生成 README.md —— 注册表改了，README 跟着重新生成即可
   用法：node tools/mkreadme.mjs  */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const regSrc = fs.readFileSync(path.join(ROOT, 'data', 'widgets.js'), 'utf8');
const win = {};
const R = new Function('window', regSrc + '\nreturn window.WIDGET_REGISTRY;')(win);
const REPO = 'yx333221c/frontend-widget-lab';
const SITE = `https://${REPO.split('/')[0]}.github.io/${REPO.split('/')[1]}/`;

const exists = p => fs.existsSync(path.join(ROOT, p));
const nDone = R.widgets.filter(w => exists(w.file) && exists(w.doc)).length;

let md = `# Widget Lab · 前端交互组件实验室

**${R.widgets.length} 个手写前端组件**，每个都是一个独立可运行的 HTML 文件：零依赖、零构建、复制即用。
每个组件配四段内容：实时演示、组件描述、完整源码、制作教学。

> 在线预览：**${SITE}**

## 目录

| 分类 | 组件 |
|---|---|
`;
for (const c of R.categories) {
  const ws = R.widgets.filter(w => w.cat === c.id);
  const links = ws.map(w =>
    `[${w.title}](widgets/${w.cat}/${w.id}.html) · [教学](docs/${w.cat}/${w.id}.md)`).join('<br>');
  md += `| **${c.glyph} ${c.title}**<br><sub>${c.blurb}</sub> | ${links} |\n`;
}

md += `
## 怎么用

- **看效果**：打开 <a href="${SITE}" target="_blank">${SITE}</a>，每个组件详情页第一段就是运行中的 iframe，可以直接操作。
- **抄代码**：详情页第三段是带行号和语法高亮的完整源码，右上角有「GitHub 打开该文件」和「复制全部」。
- **学原理**：第四段是制作教学，讲这一步为什么这么写、参数怎么调、坑在哪。
- **本地跑**：clone 后直接用浏览器打开 \`index.html\` 能看目录；详情页的源码/教学两段要靠 fetch 读文件，本地请用静态服务器，例如 \`npx serve .\`。
- 组件文件本身完全自包含，双击 \`widgets/<分类>/<组件>.html\` 就能运行。

## 仓库结构

\`\`\`
index.html            主页目录（分类 / 搜索 / 难度筛选）
widget.html           组件详情页（演示 / 描述 / 源码 / 教学 四段）
data/widgets.js       组件注册表，主页与详情页都读它
data/fragments/       每个组件的描述数据（JSON）
widgets/<分类>/       ${R.widgets.length} 个组件源码，单文件自包含
docs/<分类>/          ${R.widgets.length} 篇制作教学（Markdown）
assets/               站点样式与脚本、卡片缩略图
tools/                校验与截图脚本（见下）
CONTRIBUTING.md       新增组件的硬性规范
\`\`\`

## 组件的共同约束

1. **零依赖**：不引 CDN、不 import 库、不用外部字体和图片。图形全部由 CSS / 内联 SVG / Canvas 绘制。
2. **单文件**：一个组件 = 一个 \`.html\`，CSS 在 \`<style>\`，JS 在 IIFE 里。
3. **可交互**：每个组件带 2~4 个参数控件，亲手拖动才算学会。
4. **性能自觉**：动画只用 \`transform\` / \`opacity\`；rAF 空闲时停止排帧；粒子类上限 400。
5. **可访问性**：可交互元素用原生标签，键盘可达，动效尊重 \`prefers-reduced-motion\`。

## 开发工具

\`\`\`powershell
node tools/check.mjs        # 结构校验：文件齐全 / json 合法 / 文档骨架 / 语言规范（AI 味词表、破折号密度）
node tools/shoot.mjs        # headless Chrome 给全部组件拍缩略图 -> assets/shots/
node tools/httpcheck.mjs    # 起本地服务验证详情页四段是否真的填充
node tools/mkreadme.mjs     # 从注册表重新生成本文件
\`\`\`

## 许可

代码与文档以学习为目的开放，MIT。

---
*当前状态：${nDone}/${R.widgets.length} 个组件已完成源码与教学。*
`;

fs.writeFileSync(path.join(ROOT, 'README.md'), md, 'utf8');
console.log(`README.md 已生成：${R.widgets.length} 个组件，${R.categories.length} 个分类`);
