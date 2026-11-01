/* 临时（交付前删除）：连接一个已经在跑的 headless Chrome（由 pwsh 在沙箱外启动）
   1) 有没有运行时异常  2) body 自然高度是否超出注册表 viewport  3) 关键交互后的状态
   组件本身零请求，所以直接走 file:// ，不起 http 服务。 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const OUT = path.join(ROOT, 'tmp-shots');
fs.mkdirSync(OUT, { recursive: true });
const PORT = Number(process.env.CDP_PORT || 9778);
const BASE = 'file:///' + ROOT.replace(/\\/g, '/');

let version = null;
for (let i = 0; i < 20 && !version; i++) {
  try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
  catch { await new Promise(r => setTimeout(r, 300)); }
}
if (!version) { console.error(`调试端口 ${PORT} 未就绪（先用 pwsh 启动 Chrome）`); process.exit(2); }

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0; const pending = new Map(); const handlers = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
    else if (m.method && handlers.has(m.method)) handlers.get(m.method).forEach(fn => fn(m.params));
  };
  return {
    ready: new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }),
    send: (method, params = {}) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method, params })); }),
    on: (method, fn) => { (handlers.get(method) || handlers.set(method, []).get(method)).push(fn); },
    close: () => { try { ws.close(); } catch { } },
  };
}
let pageTarget = null;
for (let i = 0; i < 20 && !pageTarget; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about%3Ablank`, { method: 'PUT' }); if (r.ok) { const t = await r.json(); if (t.type === 'page' && t.webSocketDebuggerUrl) pageTarget = t; } } catch { }
  if (!pageTarget) await new Promise(r => setTimeout(r, 300));
}
const c = connect(pageTarget.webSocketDebuggerUrl);
await c.ready;
await c.send('Runtime.enable');
await c.send('Page.enable');

const problems = [];
let cur = '';
c.on('Runtime.exceptionThrown', (p) => {
  const d = p.exceptionDetails || {};
  problems.push(`[${cur}] 异常: ` + String(d.exception ? (d.exception.description || d.exception.value) : d.text).split('\n')[0]);
});
c.on('Log.entryAdded', (p) => { if (p.entry.level === 'error') problems.push(`[${cur}] console.error: ` + p.entry.text.slice(0, 160)); });
c.on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error' || p.type === 'warning') problems.push(`[${cur}] ${p.type}: ` + (p.args || []).map(a => a.value ?? a.description).join(' ').slice(0, 160)); });

async function load(url) {
  await c.send('Page.navigate', { url });
  await new Promise(r => setTimeout(r, 900));
  for (let i = 0; i < 20; i++) {
    const { result } = await c.send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
    if (result.value === 'complete') break;
    await new Promise(r => setTimeout(r, 150));
  }
}
async function ev(expr) {
  const r = await c.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) problems.push(`[${cur}] evaluate 失败: ` + (r.exceptionDetails.text || ''));
  return r.result ? r.result.value : undefined;
}
async function shot(w, h, file) {
  await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: false });
  await new Promise(r => setTimeout(r, 250));
  const { data } = await c.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, file), Buffer.from(data, 'base64'));
}
const W = 760;
const TARGETS = [
  ['otp-input', 240], ['range-slider', 220], ['toggle-morph', 220], ['searchable-select', 380],
];

for (const [id, viewport] of TARGETS) {
  cur = id;
  console.log(`\n──── ${id} (viewport ${viewport}) ────`);
  await load(`${BASE}/widgets/controls/${id}.html`);
  await shot(W, viewport, `${id}__0-initial.png`);
  const geo = await ev(`(function(){
    var b=document.body, r=b.getBoundingClientRect();
    var kids=Array.from(b.children).map(function(el){var q=el.getBoundingClientRect();return {t:el.tagName+'.'+el.className, top:Math.round(q.top+scrollY), bot:Math.round(q.bottom+scrollY), h:Math.round(q.height)};});
    return JSON.stringify({
      scrollH: b.scrollHeight, docH: document.documentElement.scrollHeight,
      inner: window.innerHeight,
      bodyClientH: b.clientHeight,
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
      scrollable: getComputedStyle(document.documentElement).overflowY,
      lastBot: kids.length ? kids[kids.length-1].bot : 0,
      kids: kids
    }, null, 1);
  })()`);
  console.log(geo);

  /* ---- 交互剧本 ---- */
  if (id === 'otp-input') {
    await ev(`(function(){var i=document.getElementById('code');i.focus();i.value='12345';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await shot(W, viewport, `${id}__1-five.png`);
    await ev(`(function(){var i=document.getElementById('code');i.value='123456';i.setSelectionRange(6,6);i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await new Promise(r => setTimeout(r, 500));
    await shot(W, viewport, `${id}__2-success.png`);
    await ev(`document.getElementById('badBtn').click()`);
    await new Promise(r => setTimeout(r, 480));
    await shot(W, viewport, `${id}__3-error-shake.png`);
    await ev(`(function(){var i=document.getElementById('code');i.focus();i.value='123456';i.setSelectionRange(6,6);i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await new Promise(r => setTimeout(r, 700));
    await ev(`(function(){var m=document.getElementById('cMask');m.checked=true;m.dispatchEvent(new Event('change',{bubbles:true}));
      var i=document.getElementById('code');i.focus();i.value='876543';i.setSelectionRange(6,6);i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await new Promise(r => setTimeout(r, 450));
    await shot(W, viewport, `${id}__4-masked-error.png`);
    await ev(`(function(){var b=document.getElementById('L8');b.checked=true;b.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await shot(W, viewport, `${id}__5-eight-cells.png`);
    /* 键盘：Tab 到控件、点第 3 格、退格 */
    await ev(`(function(){var b=document.getElementById('L6');b.checked=true;b.dispatchEvent(new Event('change',{bubbles:true}));
      var i=document.getElementById('code');i.focus();i.value='123456';i.setSelectionRange(6,6);i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await new Promise(r => setTimeout(r, 800));
    await ev(`(function(){var i=document.getElementById('code');var cs=document.getElementById('cells').children;
      var r=cs[2].getBoundingClientRect();i.focus();
      document.getElementById('otp').dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));})()`);
    const caret = await ev(`JSON.stringify({s:document.getElementById('code').selectionStart,active:Array.from(document.getElementById('cells').children).map(function(c){return c.className.replace('cell ','')}).join('|')})`);
    console.log('点第3格 →', caret);
    await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await new Promise(r => setTimeout(r, 120));
    console.log('退格后 →', await ev(`JSON.stringify({v:document.getElementById('code').value})`));
    await shot(W, viewport, `${id}__6-cell3-backspace.png`);
  }

  if (id === 'range-slider') {
    await ev(`(function(){var r=document.getElementById('rSingle');r.focus();r.value=980;r.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await new Promise(r => setTimeout(r, 120));
    await shot(W, viewport, `${id}__1-right-edge.png`);
    await ev(`document.getElementById('rSingle').value=10;document.getElementById('rSingle').dispatchEvent(new Event('input',{bubbles:true}))`);
    await new Promise(r => setTimeout(r, 120));
    await shot(W, viewport, `${id}__2-left-edge.png`);
    await ev(`(function(){var m=document.getElementById('mPair');m.checked=true;m.dispatchEvent(new Event('change',{bubbles:true}));
      var t=document.getElementById('cTicks');t.checked=true;t.dispatchEvent(new Event('change',{bubbles:true}));
      var y=document.getElementById('cYuan');y.checked=true;y.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await new Promise(r => setTimeout(r, 150));
    await ev(`(function(){var a=document.getElementById('rLo'),b=document.getElementById('rHi');
      a.focus();a.value=460;a.dispatchEvent(new Event('input',{bubbles:true}));
      b.focus();b.value=520;b.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await new Promise(r => setTimeout(r, 150));
    await shot(W, viewport, `${id}__3-pair-ticks-yuan.png`);
    const state = await ev(`JSON.stringify({lo:document.getElementById('rLo').value,hi:document.getElementById('rHi').value,zLo:document.getElementById('rLo').style.zIndex,zHi:document.getElementById('rHi').style.zIndex,read:document.getElementById('oRead').textContent})`);
    console.log('双滑块重叠附近 →', state);
    await ev(`(function(){var s=document.getElementById('st1');s.checked=true;s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await new Promise(r => setTimeout(r, 150));
    console.log('step=1 刻度数 →', await ev(`document.getElementById('tPair').children.length`));
    await shot(W, viewport, `${id}__4-step1-ticks.png`);
    /* 键盘：聚焦后按方向键 */
    await ev(`document.getElementById('rLo').focus()`);
    for (const k of [{ key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 }, { key: 'PageUp', code: 'PageUp', windowsVirtualKeyCode: 33 }, { key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 }]) {
      await c.send('Input.dispatchKeyEvent', { type: 'keyDown', ...k });
      await c.send('Input.dispatchKeyEvent', { type: 'keyUp', ...k });
    }
    await new Promise(r => setTimeout(r, 150));
    console.log('键盘后 lo →', await ev(`document.getElementById('rLo').value`));
    await shot(W, viewport, `${id}__5-keyboard-focus-visible.png`);
  }

  if (id === 'toggle-morph') {
    await ev(`document.getElementById('sw').focus()`);
    await shot(W, viewport, `${id}__1-day-focus.png`);
    await ev(`document.getElementById('sw').click()`);
    await new Promise(r => setTimeout(r, 150));
    await shot(W, viewport, `${id}__2-night-mid.png`);
    await new Promise(r => setTimeout(r, 600));
    await shot(W, viewport, `${id}__3-night-settled.png`);
    await ev(`(function(){document.getElementById('d600').checked=true;document.getElementById('d600').dispatchEvent(new Event('change',{bubbles:true}));
      document.getElementById('sw').setAttribute('aria-checked','false');})()`);
    await ev(`document.getElementById('sw').click()`);
    await new Promise(r => setTimeout(r, 300));
    await shot(W, viewport, `${id}__4-600ms-mid.png`);
    await new Promise(r => setTimeout(r, 700));
    await ev(`(function(){var s=document.getElementById('sScale');s.value=1.4;s.dispatchEvent(new Event('input',{bubbles:true}));
      var st=document.getElementById('cSt');st.checked=true;st.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await shot(W, viewport, `${id}__5-big-stagger-off.png`);
    await ev(`(function(){document.getElementById('sw').setAttribute('aria-checked','true');document.getElementById('sw').dispatchEvent(new Event('click',{bubbles:true}));})()`);
    await new Promise(r => setTimeout(r, 200));
    await shot(W, viewport, `${id}__6-day-big.png`);
    console.log('aria-checked →', await ev(`document.getElementById('sw').getAttribute('aria-checked')`), 'rd →', await ev(`document.getElementById('rd2').textContent`));
  }

  if (id === 'searchable-select') {
    await ev(`(function(){var q=document.getElementById('q');q.focus();q.value='bl';q.setSelectionRange(2,2);q.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await new Promise(r => setTimeout(r, 200));
    await shot(W, viewport, `${id}__1-open-bl.png`);
    const n = await ev(`document.querySelectorAll('#pop .opt').length`);
    console.log('bl 命中 →', n, '第一行 HTML →', await ev(`document.querySelector('#pop .opt').outerHTML.slice(0,220)`));
    for (const k of [{ key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 }, { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 }]) {
      await c.send('Input.dispatchKeyEvent', { type: 'keyDown', ...k });
      await c.send('Input.dispatchKeyEvent', { type: 'keyUp', ...k });
    }
    await new Promise(r => setTimeout(r, 200));
    console.log('activedescendant →', await ev(`document.getElementById('q').getAttribute('aria-activedescendant')`), '焦点 →', await ev(`document.activeElement.id`));
    await shot(W, viewport, `${id}__2-arrowdown-active.png`);
    await ev(`(function(){var q=document.getElementById('q');q.value='';q.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await new Promise(r => setTimeout(r, 250));
    await shot(W, viewport, `${id}__3-all-scrolled.png`);
    await ev(`(function(){var q=document.getElementById('q');q.focus();q.value='zzzqq';q.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await new Promise(r => setTimeout(r, 200));
    await shot(W, viewport, `${id}__4-empty.png`);
    console.log('空态 →', await ev(`JSON.stringify({noneHidden:document.getElementById('none').hidden,noneParent:document.getElementById('none').parentElement.className,opts:document.querySelectorAll('#pop .opt').length,expanded:document.getElementById('q').getAttribute('aria-expanded')})`));
    await ev(`(function(){var q=document.getElementById('q');q.value='';q.dispatchEvent(new Event('input',{bubbles:true}));
      var m=document.getElementById('cMulti');m.checked=true;m.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await new Promise(r => setTimeout(r, 200));
    await ev(`(function(){var q=document.getElementById('q');q.focus();q.value='模';q.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await new Promise(r => setTimeout(r, 200));
    await ev(`document.querySelectorAll('#pop .opt')[0].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))`);
    await new Promise(r => setTimeout(r, 120));
    await ev(`document.querySelectorAll('#pop .opt')[0] && document.querySelectorAll('#pop .opt')[0].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))`);
    await new Promise(r => setTimeout(r, 200));
    console.log('多选 tag →', await ev(`JSON.stringify({tags:Array.from(document.querySelectorAll('.tag')).map(function(t){return t.textContent}),focus:document.activeElement.id,expanded:document.getElementById('q').getAttribute('aria-expanded')})`));
    await ev(`(function(){var q=document.getElementById('q');q.focus();q.value='g';q.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await new Promise(r => setTimeout(r, 200));
    await shot(W, viewport, `${id}__5-multi-tags.png`);
    await ev(`(function(){var c=document.getElementById('cap6');c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));
      var q=document.getElementById('q');q.focus();q.value='c';q.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await new Promise(r => setTimeout(r, 250));
    console.log('cap6 播报 →', await ev(`document.getElementById('live').textContent`));
    await shot(W, viewport, `${id}__6-cap6-live.png`);
    /* 面板不能被弹窗盖住 */
    console.log('几何 →', await ev(`(function(){var p=document.getElementById('pop').getBoundingClientRect();var q=document.querySelector('.panel').getBoundingClientRect();
      return JSON.stringify({popBot:Math.round(p.bottom),panelTop:Math.round(q.top),overlap:p.bottom>q.top,bodyScrollH:document.body.scrollHeight,inner:window.innerHeight});})()`));
  }
}

console.log('\n================ 报告 ================');
if (problems.length) { console.log(`✗ ${problems.length} 个问题：`); problems.forEach(p => console.log('  ' + p)); }
else console.log('✓ 无运行时异常、无 console.error/warning');
c.close();
process.exit(problems.length ? 1 : 0);
