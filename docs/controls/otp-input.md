# 验证码分格输入（OTP Input）制作教学

> 目标：把"六个小方格填验证码"做成一个既有分格观感、又不牺牲原生粘贴与自动填充的输入框。
> 产出文件：[`widgets/controls/otp-input.html`](../../widgets/controls/otp-input.html)
> 难度：入门 · 约 20 分钟

---

## 0. 先想清楚：六个 input 为什么是错的

最常见的实现是画 6 个 `<input maxlength="1">`，每输入一个就聚焦下一个。看着直观，实际有三个写不完的分支。

1. **退格跨格**。第 3 格是空的，在它里面按 Backspace，浏览器默认什么都不做。你得补"空且按 Backspace，就聚焦第 2 格并清空"，再补"第 2 格也空，继续往前"，还要处理 Alt+Backspace（删到词首）和 Ctrl+Backspace 各删多少。
2. **粘贴要自己分发**。用户按 Ctrl+V 贴进 `123456`，原生只会把这串塞进当前那一个格子，它 `maxlength=1`，于是只剩 `1`，后五位直接丢了。你只能拦 `paste`、读剪贴板、逐位拆开再塞进不同的框；剪贴板里混了空格和 `-` 又是一层过滤。
3. **输入法与自动填充全废**。输入法在每格容一个字符的框里，候选窗位置乱跳；`autocomplete="one-time-code"` 只建议到一个输入框，六个框它不知道该填哪个。Tab 要走六次，读屏器进这一段会连念六遍"编辑框"。

结论：六个格子是装饰，只有一个真 input。跳格、粘贴、退格这些难点全部退回给浏览器。

---

## 1. 结构：一个 input 铺满整条格子

```html
  <div class="otp" id="otp">
    <!-- 视觉层：6 个格子，全部 aria-hidden，读屏器只会念下面那一个 input -->
    <div class="cells" id="cells" aria-hidden="true"></div>
    <!-- 交互层：唯一的事实来源 -->
    <input class="layer" id="code" type="text" inputmode="numeric" autocomplete="one-time-code"
           pattern="[0-9]{6}" maxlength="6" aria-label="6 位验证码" aria-describedby="status"
           spellcheck="false" autocapitalize="off">
  </div>
```

```css
  .otp { position: relative; display: inline-block; }
  .layer {
    position: absolute; left: 0; top: 0; z-index: 2;
    width: 100%; height: 100%;
    letter-spacing: 24px;          /* 撑开原生光标间距，选区也不会糊成一团 */
    opacity: 0;                    /* 不能 display:none / visibility:hidden：元素不渲染就没有粘贴、IME、autofill */
    caret-color: transparent;
    outline: none;
  }
```

关键是 `opacity: 0`，不是 `display: none` 也不是 `visibility: hidden`。元素必须真的被渲染，交互才成立：隐藏的 input 不参与布局，粘贴没有落点，输入法候选窗不知道往哪贴，自动填充也不会命中它。`opacity:0` 只关掉视觉，焦点、选区、组合输入、`setSelectionRange` 都照常工作。

视觉层给 `aria-hidden="true"`，读屏器于是只念那一个 input 的当前值，不会把六个空格子念成六个空编辑框。

> 坑：表现是"点第 4 格没反应，手机上也不弹数字键盘"。原因是给覆盖层加了 `pointer-events:none` 或 `visibility:hidden`。覆盖层就该吃掉全部点击，原生靠落点 x 决定光标位置，这正好是我们要的。

---

## 2. 用 `selectionStart` 把格序映射成光标

`input.selectionStart` 就是光标左边的字符数，也就是"该亮第几格"；反过来"点第 k 格"等于"把光标放到第 k 个字符之前"。

```js
function caret() {
  var v = input.value.length, s = input.selectionStart, e = input.selectionEnd;
  if (s == null) return v;                       // 极少数浏览器在类型不兼容时返回 null
  return Math.min(Math.max(s, 0), v);
}
```

`pattern="[0-9]{6}"` 只是给浏览器和自动填充器的提示，不阻止用户敲字母，所以要和 `input` 事件里的数字过滤配合。

点格子：

```js
otp.addEventListener('click', function (e) {
  if (e.target !== input) return;
  var kids = cellsEl.children, hit = kids.length - 1;
  for (var i = 0; i < kids.length; i++) {
    if (e.clientX < kids[i].getBoundingClientRect().right) { hit = i; break; }
  }
  placeCaretAtCell(hit);
});
function placeCaretAtCell(index) {
  var pos = Math.min(index, input.value.length);
  setSel(pos, pos);
  paint();
}
```

覆盖层在最上面，`e.target` 永远是 input，所以只能用 `clientX` 反查点中的格子。`Math.min(index, value.length)` 不能省：光标不能放到"还没输入的第 5 格"上，否则浏览器会把落点夹到末尾，用户以为接下来删第 2 位，实际删掉了最后一位。

删掉一格时也别写 `value = value.slice(0, i)`，那会把它后面的全抹掉。只删一位，再自己接管 Backspace 和 Delete：

```js
function spliceOut(v, i) { return v.slice(0, i) + v.slice(i + 1); }

input.addEventListener('keydown', function (e) {
  var v = input.value, s = caret(), e2 = input.selectionEnd;
  if (e.key === 'Backspace' && s === e2 && s > 0) {
    e.preventDefault();                 // 抢在原生"删字符串最后一个字符"之前
    setValue(spliceOut(v, s - 1)); setSel(s - 1); paint();
  } else if (e.key === 'Delete' && s === e2 && s < v.length) {
    e.preventDefault();
    setValue(spliceOut(v, s)); setSel(s); paint();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (v.length === N) verify(); else say('还差 ' + (N - v.length) + ' 位。');
  } else if (e.key === 'Escape') {
    e.preventDefault(); clearAll();
  }
  /* 方向键 / Home / End 完全不拦：原生按字符移动光标，落点正好是格序 */
});
```

`preventDefault` 只在"无选区且光标不在末尾"时调用。光标本来就在末尾时交给原生，少改一处就少一个 bug。方向键、Home、End 一个都不拦：在单 input 方案里原生行为就是正确行为。

粘贴一次填满：

```js
input.addEventListener('paste', function (e) {
  e.preventDefault();                   // 自己分发：只取数字、截断到位数、整串覆盖
  var text = (e.clipboardData && e.clipboardData.getData('text')) || '';
  var digits = text.replace(/\D/g, '').slice(0, N);
  if (!digits) { say('剪贴板里没有数字。'); return; }
  setValue(digits); setSel(digits.length); paint();
  if (digits.length === N) verify();
});
```

---

## 3. `input` 事件里只在真需要时回写 value

```js
input.addEventListener('input', function () {
  var raw = input.value;
  var digits = raw.replace(/\D/g, '');
  if (digits.length > N) digits = digits.slice(0, N);
  if (digits !== raw) setValue(digits);   // 只有真过滤掉字符才回写，否则光标会被抢走
  paint();
  if (input.value.length === N) verify();
});
```

给 `input.value` 赋值会把光标瞬移到末尾。如果每次输入都无条件回写，用户想回去改第 2 位时光标就再也移不动了。加一句 `if (digits !== raw)`，正常输入于是完全走原生路径。这类组件最常见的隐性 bug 就漏在这一行。

## 4. 校验与错误反馈

满位自动提交，模拟 300ms 网络往返；失败抖动，抖动结束清空：

```js
function verify() {
  stop();
  otp.classList.remove('ok', 'bad');
  say('校验中…');
  t1 = setTimeout(function () {
    if (input.value === code()) {
      otp.classList.add('ok');
      say('✓ 校验通过（正确码 ' + code() + '）');
    } else {
      otp.classList.add('bad');
      say('✕ 验证码不正确，抖动结束后自动清空');
      t2 = setTimeout(clearAll, reduce ? 0 : 620);
    }
  }, 300);
}
```

抖动只动 `transform`，关键帧放在 `.cells` 而不是每个 `.cell` 上：一个动画，六个格子一起晃。`t1` 和 `t2` 都要 `stop()` 清掉，否则用户在抖动没结束时就重新输入，会看到刚输的码被上一次失败清空。

`prefers-reduced-motion` 命中时延迟归零：错误反馈还给，但不晃。

## 5. 掩码不要改成 `type="password"`

```css
.otp.masked .cell.on { color: transparent; font-size: 0; }
.otp.masked .cell.on::before { content: "•"; font: 700 22px/1 system-ui; color: var(--ink); }
```

`type="password"` 会让 Chrome、Safari 的验证码自动填充失效。这里只压掉显示，`input.value` 仍是明文，自动填充、输入法、粘贴都不受影响。

## 6. `autocomplete="one-time-code"` 是白拿的

这一行属性写下去，iOS 和 Android 的键盘候选条会把短信里那串码顶到键盘上方，点一下整串进框，走的就是上面的 `input` 分支；macOS 从密码库、Chrome 从短信转发给出的建议也走同一路径。这些能力只在"单个输入框"上成立，六个框的方案拿不到，因为浏览器不知道往哪个框填。

## 7. 接进真实项目

剥掉控制面板，核心就是"一个覆盖层 input + `selectionStart` 对格序 + 只在必要时回写 value"。封装时把位数 `N` 做成参数，别把 6 写死。

可访问性这块要说清具体行为：焦点落进来时读屏器念"6 位验证码，编辑框"，之后每敲一个字符念出该字符；每格的状态变化不播报（`aria-hidden`），避免六个格子轮流刷屏。键盘路径是：数字键直接填，← → 逐位移动光标并亮对应格子，Home / End 跳到首尾，Backspace 删光标左边的格，Delete 删光标右边的格，Enter 提交，Esc 清空。控制项里的格数用真 `radio` 组成 `name="len"` 的组，所以方向键在组内切换是浏览器自带的；切换后用 `aria-label` 读出"4 位验证码"这类新语义。

扩展方向（讲思路，本页没实现）：

- **WebAuthn 安全 token**。`navigator.credentials.get({ mediation: 'silent', publicKey: { challenge, rpId, allowCredentials: [] } })`，`challenge` 由服务端把预期的一次性码做哈希后给出，浏览器会绕过用户直接"填"进这个框。前提是页面在 HTTPS 下、`rpId` 与站点匹配，并且框上有 `autocomplete="one-time-code"` 与 `inputmode="numeric"`，UA 才认它是可接收安全 token 的目标。
- **短信内容读取**。网页层没有读短信的 API。现实路径只有三条：`one-time-code` 建议、WebAuthn，以及"用户手动粘贴"时读 `navigator.clipboard.readText()`（需授权，且有安全上下文要求）。
- **不适合**：位数会变的验证码（TOTP 与短信混用）要做成参数驱动；纯展示的分段卡号应该用真分隔符排版，不该复用这套光标接管逻辑。

## 8. 自查清单

- [ ] 整条只有一个 `<input>`，视觉层是 `aria-hidden`
- [ ] 覆盖层用 `opacity:0`，不是 `display:none` / `visibility:hidden`
- [ ] `inputmode="numeric"`、`autocomplete="one-time-code"`、`pattern`、`maxLength` 都在
- [ ] 回写 value 前先比 `digits !== raw`，光标不会被抢到末尾
- [ ] Backspace 删的是光标左边那格，方向键与 Home / End 未被拦截
- [ ] 粘贴混合字符能一次填满并触发校验，失败抖动后清空不吃新输入
- [ ] `role="status"` 在满位、失败、成功三态都有播报
- [ ] 掩码走显示层，没有改成 `type="password"`

## 相关组件

- [双色滑块 + 数值气泡](#/range-slider)：同一套路，原生 input 打底、外观自绘，连 ARIA 都不用补。
- [可搜索下拉](#/searchable-select)：输入对象从数字换成候选词之后，焦点管理要改成 `aria-activedescendant`。
- [3D 翻牌计数器](#/flip-counter)：一格一字符的另一种画法，可以借这里的格子布局。
