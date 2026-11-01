/* 临时测试台（交付前删除）：执行组件里的 IIFE，检查键盘/鼠标分支是否真的走得通 */
const fs = require('fs');
const vm = require('vm');

const VOID = { input: 1, br: 1, img: 1, meta: 1, hr: 1 };

function parseInto(el, html) {
  el.children = [];
  const stack = [el];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>])*)\/?>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    const [all, close, open, attrs, text] = m;
    if (all.startsWith('<!--')) continue;
    if (close) { if (stack.length > 1) stack.pop(); continue; }
    if (open) {
      const a = {};
      const ar = /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')|([\w-]+)/g;
      let x;
      while ((x = ar.exec(attrs || ''))) {
        if (x[1]) a[x[1]] = x[3] !== undefined ? x[3] : x[4];
        else if (x[5]) a[x[5]] = '';            // 布尔属性：hidden / checked 之类
      }
      const child = mkNode(open, a);
      child.parentNode = stack[stack.length - 1];
      stack[stack.length - 1].children.push(child);
      if (!VOID[open.toLowerCase()] && !all.endsWith('/>')) stack.push(child);
      continue;
    }
    if (text && text.trim()) stack[stack.length - 1].textContent += text.trim();
  }
}

let NODES = [];
function mkNode(tag, attrs) {
  attrs = attrs || {};
  const el = {
    tagName: String(tag).toUpperCase(),
    id: attrs.id || '',
    className: attrs['class'] || '',
    attrs: Object.assign({}, attrs),
    children: [],
    parentNode: null,
    style: { props: {}, setProperty(k, v) { this.props[k] = String(v); }, removeProperty(k) { delete this.props[k]; } },
    hidden: 'hidden' in attrs,
    textContent: '',
    value: attrs.value || '',
    selectionStart: 0, selectionEnd: 0,
    maxLength: attrs.maxlength || 0,
    _h: {},
    classList: {
      get contains() { return (c) => el.className.split(' ').includes(c); },
      get add() { return (...cs) => { cs.forEach(c => { if (!el.className.split(' ').includes(c)) el.className += (el.className ? ' ' : '') + c; }); }; },
      get remove() { return (...cs) => { el.className = el.className.split(' ').filter(x => x && !cs.includes(x)).join(' '); }; },
      get toggle() { return (c, force) => { const has = el.className.split(' ').includes(c); const want = force === undefined ? !has : !!force; if (want && !has) el.className += (el.className ? ' ' : '') + c; if (!want && has) el.className = el.className.split(' ').filter(x => x && x !== c).join(' '); return want; }; },
    },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    hasAttribute(k) { return k in this.attrs; },
    removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(t, fn) { (this._h[t] = this._h[t] || []).push(fn); },
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); },
    contains(c) { return c === this || walkHas(this, c); },
    closest(sel) { let n = this; while (n) { if (n.matches && n.matches(sel)) return n; n = n.parentNode; } return null; },
    matches(sel) {
      return (sel.startsWith('.') && this.className.split(' ').includes(sel.slice(1)))
        || (sel.startsWith('#') && this.id === sel.slice(1))
        || (!sel.startsWith('.') && !sel.startsWith('#') && this.tagName === sel.toUpperCase());
    },
    querySelector(sel) { return findIn(this, sel)[0] || null; },
    querySelectorAll(sel) { return findIn(this, sel); },
    focus() { DOC.activeElement = this; },
    blur() { if (DOC.activeElement === this) DOC.activeElement = DOC.body; },
    click() { fire(this, 'click', {}); },
    getBoundingClientRect() { return { left: this._l || 0, right: (this._l || 0) + (this._w || 42), top: 0, bottom: 0, width: this._w || 42, height: 20 }; },
    scrollIntoView(o) { this._siv = o; },
    setSelectionRange(a, b) { this.selectionStart = a; this.selectionEnd = (b == null ? a : b); },
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._html || ''; },
    set(v) { el._html = v; parseInto(el, v); },
  });
  NODES.push(el);
  return el;
}
function walkHas(root, c) {
  for (const k of root.children) { if (k === c || walkHas(k, c)) return true; }
  return false;
}
function findIn(root, sel) {
  const out = [];
  (function w(n) {
    n.children.forEach(c => { if (c.matches(sel)) out.push(c); w(c); });
  })(root);
  return out;
}

const DOC = {
  activeElement: null, _h: {},
  getElementById(id) { return NODES.filter(n => n.id === id)[0] || null; },
  querySelector(sel) { return findIn(DOC.body, sel)[0] || null; },
  querySelectorAll(sel) { return findIn(DOC.body, sel); },
  createElement(t) { return mkNode(t, {}); },
  addEventListener(t, fn) { (DOC._h[t] = DOC._h[t] || []).push(fn); },
};
const WIN = {
  _q: [],
  addEventListener(t, fn) { (DOC._h[t] = DOC._h[t] || []).push(fn); },
  matchMedia() { return { matches: false }; },
  requestAnimationFrame(fn) { WIN._q.push(fn); return WIN._q.length; },
};
function fire(el, type, ev) {
  const e = Object.assign({
    type, target: el, isComposing: false, clipboardData: null, key: '',
    preventDefault() { e._pd = true; }, stopPropagation() {},
  }, ev);
  (el._h[type] || []).forEach(fn => fn.call(el, e));
  return e;
}
function fireDoc(type, ev) {
  const e = Object.assign({ type, target: DOC.body, preventDefault() { e._pd = true; }, stopPropagation() {} }, ev);
  (DOC._h[type] || []).forEach(fn => fn.call(DOC, e));
  return e;
}

function run(file, extra) {
  NODES = [];
  DOC._h = {}; WIN._q = [];
  const html = fs.readFileSync(file, 'utf8');
  const js = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
  DOC.body = mkNode('body', {});
  DOC.activeElement = DOC.body;
  DOC.documentElement = DOC.body;
  /* 直接解析真实 <body>，比手搓 DOM 更接近浏览器 */
  const bodyHtml = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html)[1].replace(/<script>[\s\S]*?<\/script>/gi, '');
  parseInto(DOC.body, bodyHtml);
  /* checked 属性 → 真属性；checkbox/radio 的 checked 影响组件分支 */
  NODES.forEach(n => { if ('checked' in n.attrs) n.checked = true; });
  if (extra) extra(mkNode, DOC);
  const timers = new Map();
  let seq = 0;
  const ctx = vm.createContext({
    document: DOC, window: WIN, navigator: {},
    requestAnimationFrame: (fn) => WIN.requestAnimationFrame(fn),
    setTimeout: (fn, ms) => { timers.set(++seq, fn); return seq; },
    clearTimeout: (id) => { timers.delete(id); },
    parseInt, parseFloat, Math, String, Object, Array, RegExp, JSON, Error, console,
  });
  vm.runInContext(js, ctx, { filename: file });
  return {
    timers,
    /* 只跑最靠前的 n 个还活着的定时器（被 clearTimeout 掉的不会跑） */
    drain(n) {
      n = n || 1;
      for (let i = 0; i < n && timers.size; i++) {
        const k = timers.keys().next().value;
        const f = timers.get(k);
        timers.delete(k);
        f();
      }
    },
    pending() { return timers.size; },
    runFrames() { const q = WIN._q; WIN._q = []; q.forEach(f => f(16)); },
  };
}
module.exports = { run, fire, fireDoc, mkNode, DOC, WIN, findIn };
