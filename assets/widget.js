/* 详情页：① 演示 ② 描述 ③ 源码 ④ 教学 */
(function () {
  var R = window.WIDGET_REGISTRY;
  var GH = 'https://github.com/yx333221c/frontend-widget-lab/blob/main/';
  var RAW = 'https://raw.githubusercontent.com/yx333221c/frontend-widget-lab/main/';
  var root = document.getElementById('root');
  var toastEl = document.getElementById('toast');

  /* ---------------- 通用工具 ---------------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }
  function copy(text, btn) {
    var done = function () { toast('已复制到剪贴板'); if (btn) flash(btn); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacy(text, done); });
    } else legacy(text, done);
  }
  function legacy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动选择'); }
    document.body.removeChild(ta);
  }
  function flash(btn) { var o = btn.textContent; btn.textContent = '✓ 已复制'; setTimeout(function () { btn.textContent = o; }, 1400); }

  /* ---------------- 主题 ---------------- */
  var themeBtn = document.getElementById('themeBtn');
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    themeBtn.textContent = t === 'dark' ? '🌙 夜间' : '☀️ 白天';
    try { localStorage.setItem('wl-theme', t); } catch (e) {}
  }
  var savedTheme = null;
  try { savedTheme = localStorage.getItem('wl-theme'); } catch (e) {}
  applyTheme(savedTheme || 'dark');
  themeBtn.onclick = function () {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  };

  /* ================================================================
     语法高亮：分词 -> {t, c} -> 按行输出（跨行 token 也能正确闭合标签）
     ================================================================ */
  var JS_RE = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\[\s\S])*`)|\b(0x[\d a-fA-F]+|\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?)\b|\b(const|let|var|function|return|if|else|for|while|new|class|extends|this|typeof|instanceof|null|undefined|true|false|async|await|of|in|do|break|continue|switch|case|default|try|catch|finally|throw|import|export|from|delete|void|yield)\b|([A-Za-z_$][\w$]*)(?=\s*\()/g;
  var CSS_RE = /(\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(@[\w-]+|:hover|:focus-visible|:active|:root|::[w-]+|::before|::after)|([-\w]+)(?=\s*:)|(#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|rem|em|%|s|ms|vh|vw|deg|fr|ch|vmin|vmax|turn)?\b)|([a-zA-Z-]+(?=\())/g;
  var HTML_RE = /(&lt;!--[\s\S]*?--&gt;)|(&lt;\/?)([a-zA-Z][\w:-]*)|([a-zA-Z-]+)(?==&quot;|=\")|(&quot;[^&]*?&quot;)/g;

  function tokenize(src, re, map) {
    var out = [], last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(src))) {
      if (m.index > last) out.push({ t: src.slice(last, m.index), c: '' });
      var cls = '';
      for (var i = 1; i < m.length; i++) { if (m[i] != null) { cls = map[i] || ''; break; } }
      out.push({ t: m[0], c: cls });
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++;
    }
    if (last < src.length) out.push({ t: src.slice(last), c: '' });
    return out;
  }

  function tokensToLines(tokens) {
    var lines = [[]];
    tokens.forEach(function (tk) {
      var parts = tk.t.split('\n');
      parts.forEach(function (p, i) {
        if (i) lines.push([]);
        if (p) lines[lines.length - 1].push({ t: p, c: tk.c });
      });
    });
    return lines;
  }

  function lineHtml(tokLine) {
    return tokLine.map(function (tk) {
      return tk.c ? '<span class="' + tk.c + '">' + tk.t + '</span>' : tk.t;
    }).join('');
  }

  /* 把 .html 文件拆成 style / script / 其余，分别用对应规则高亮 */
  function highlightMixed(src) {
    var segs = [], re = /(<style[^>]*>)([\s\S]*?)(<\/style>)|(<script(?![^>]*src)[^>]*>)([\s\S]*?)(<\/script>)/gi, last = 0, m;
    while ((m = re.exec(src))) {
      if (m.index > last) segs.push({ s: src.slice(last, m.index), l: 'html' });
      segs.push({ s: m[1] + '\n', l: 'html' });
      segs.push({ s: m[2], l: m[2] ? 'css' : 'html' });
      segs.push({ s: m[3] + '\n', l: 'html' });
      last = m.index + m[0].length;
    }
    if (last < src.length) segs.push({ s: src.slice(last), l: 'html' });

    var lines = [];
    segs.forEach(function (seg) {
      var toks;
      if (seg.l === 'css') toks = tokenize(seg.s, CSS_RE, { 1: 'com', 2: 'str', 3: 'kw', 4: 'prop', 5: 'num', 6: 'fn' });
      else if (seg.l === 'js') toks = tokenize(seg.s, JS_RE, { 1: 'com', 2: 'str', 3: 'num', 4: 'kw', 5: 'fn' });
      else toks = tokenize(esc(seg.s), HTML_RE, { 1: 'com', 3: 'tagname', 4: 'attr', 5: 'str' });
      tokensToLines(toks).forEach(function (l) { lines.push(lineHtml(l)); });
    });
    return lines;
  }
  function highlightPlain(src, lang) {
    var toks;
    if (lang === 'css') toks = tokenize(src, CSS_RE, { 1: 'com', 2: 'str', 3: 'kw', 4: 'prop', 5: 'num', 6: 'fn' });
    else if (lang === 'js') toks = tokenize(src, JS_RE, { 1: 'com', 2: 'str', 3: 'num', 4: 'kw', 5: 'fn' });
    else toks = tokenize(esc(src), HTML_RE, { 1: 'com', 3: 'tagname', 4: 'attr', 5: 'str' });
    return tokensToLines(toks).map(lineHtml);
  }

  /* ================================================================
     Markdown -> HTML（够用即可：标题/列表/表格/代码/引用/行内）
     ================================================================ */
  function md2html(md) {
    var lines = md.replace(/\r\n?/g, '\n').split('\n');
    var out = [], i = 0, inList = null, listItems = [];
    function flushList() {
      if (!inList) return;
      out.push('<' + inList + '>' + listItems.join('') + '</' + inList + '>');
      inList = null; listItems = [];
    }
    function inline(s) {
      s = esc(s);
      s = s.replace(/`([^`]+)`/g, function (_, c) { return '<code>' + c + '</code>'; });
      s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
      s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(\s+"[^"]*")?\)/g, function (_, t, u, ti) {
        var ext = /^https?:/.test(u);
        return '<a href="' + u + '"' + (ti ? ' title="' + ti.slice(1, -1) + '"' : '') +
          (ext ? ' target="_blank" rel="noopener"' : '') + '>' + t + '</a>';
      });
      return s;
    }
    while (i < lines.length) {
      var ln = lines[i];
      /* 围栏代码 */
      var f = ln.match(/^```(\w*)\s*$/);
      if (f) {
        flushList();
        var buf = []; i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        out.push('<pre data-lang="' + (f[1] || 'text') + '"><code>' + esc(buf.join('\n')) + '</code></pre>');
        continue;
      }
      /* 表格 */
      if (/^\s*\|.*\|\s*$/.test(ln) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        flushList();
        var head = splitRow(ln), align = splitRow(lines[i + 1]).map(function (c) {
          return /:^?:$/.test(c) ? '' : /-+:$/.test(c) ? 'right' : 'left';
        });
        i += 2;
        var rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(splitRow(lines[i])); i++; }
        out.push('<table><thead><tr>' + head.map(function (h, k) {
          return '<th style="text-align:' + (align[k] || 'left') + '">' + inline(h) + '</th>';
        }).join('') + '</tr></thead><tbody>' + rows.map(function (r) {
          return '<tr>' + r.map(function (c, k) {
            return '<td style="text-align:' + (align[k] || 'left') + '">' + inline(c) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table>');
        continue;
      }
      var hM = ln.match(/^(#{1,4})\s+(.*)$/);
      if (hM) { flushList(); var lv = hM[1].length; out.push('<h' + lv + '>' + inline(hM[2]) + '</h' + lv + '>'); i++; continue; }
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(ln)) { flushList(); out.push('<hr>'); i++; continue; }
      var bq = ln.match(/^>\s?(.*)$/);
      if (bq) { flushList(); var qb = [bq[1]]; i++;
        while (i < lines.length && /^>\s?/.test(lines[i])) { qb.push(lines[i].replace(/^>\s?/, '')); i++; }
        out.push('<blockquote>' + inline(qb.join(' ')) + '</blockquote>'); continue; }
      var ul = ln.match(/^\s*[-*+]\s+(.*)$/);
      var ol = ln.match(/^\s*(\d+)[.)]\s+(.*)$/);
      if (ul || ol) {
        var type = ul ? 'ul' : 'ol';
        if (inList && inList !== type) flushList();
        inList = type;
        listItems.push('<li>' + inline(ul ? ul[1] : ol[2]) + '</li>');
        i++; continue;
      }
      if (/^\s*$/.test(ln)) { flushList(); i++; continue; }
      flushList();
      var para = [ln]; i++;
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,4}\s|```|>|\s*[-*+]\s|\s*\d[.)]\s|\|)/.test(lines[i])) { para.push(lines[i]); i++; }
      out.push('<p>' + inline(para.join(' ')) + '</p>');
    }
    flushList();
    return out.join('\n');
    function splitRow(r) { return r.trim().replace(/^\||\|$/g, '').split('|').map(function (x) { return x.trim(); }); }
  }

  /* ================================================================
     取文件（GitHub Pages / http 直接 fetch；file:// 时降级为提示）
     ================================================================ */
  function getFile(path) {
    if (location.protocol === 'file:') return Promise.reject(new Error('LOCAL'));
    return fetch(path, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    });
  }

  /* ================================================================
     渲染
     ================================================================ */
  function findWidget(id) {
    return R.widgets.filter(function (w) { return w.id === id; })[0] || null;
  }
  function catOf(id) {
    return R.categories.filter(function (c) { return c.id === id; })[0] || { title: id, glyph: '◆', blurb: '' };
  }

  function render(id) {
    var w = findWidget(id);
    if (!w) {
      root.innerHTML = '<div class="empty">没找到这个组件。<a href="./">回到目录</a></div>';
      return;
    }
    var c = catOf(w.cat);
    var idx = R.widgets.indexOf(w);
    location.hash = w.id;
    document.title = w.title + ' · ' + c.title + ' · Widget Lab';

    root.innerHTML =
      '<div class="detail-head">' +
        '<div class="crumb"><a href="./">目录</a> / <a href="./#catalog">' + esc(c.title) + '</a> / <span>' + esc(w.title) + '</span></div>' +
        '<h1>' + esc(w.title) + '</h1>' +
        '<p class="sub">' + esc(w.summary) + '</p>' +
        '<div class="pills">' +
          '<span class="tag">' + esc(c.glyph + ' ' + c.title) + '</span>' +
          '<span class="tag diff">' + esc(w.difficulty) + '</span>' +
          '<span class="tag">约 ' + w.minutes + ' 分钟读完</span>' +
          w.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') +
          '<a class="btn sm" href="' + GH + w.file + '" target="_blank" rel="noopener">↗ 在 GitHub 打开源码</a>' +
        '</div>' +
      '</div>' +

      /* ---------- ① 演示 ---------- */
      '<section class="part" id="part-demo">' +
        '<div class="part-head"><span class="idx">1</span><h2>组件展示</h2>' +
          '<span class="desc">可以直接在这里操作 —— 这是一个真实运行的 iframe</span>' +
          '<span class="spacer"></span>' +
          '<button class="btn sm" id="reloadBtn">⟳ 重载</button>' +
          '<button class="btn sm" id="wideBtn">↔ 加宽</button>' +
          '<a class="btn sm" id="openBtn" href="' + w.file + '" target="_blank" rel="noopener">⧉ 新窗口</a>' +
        '</div>' +
        '<div class="part-body">' +
          '<div class="stage">' +
            '<div class="stage-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span>' +
              '<span style="margin-left:8px" id="stagePath">' + esc(w.file) + '</span></div>' +
            '<iframe id="stage" title="' + esc(w.title) + ' 演示" src="' + w.file + '" style="height:' + (w.viewport || 320) + 'px"></iframe>' +
          '</div>' +
          '<p class="mini" id="demoHint" style="margin-top:9px">演示区可交互；若下方提示源码未加载，说明你是用 file:// 直接打开的，请用本地服务器预览。</p>' +
        '</div>' +
      '</section>' +

      /* ---------- ② 描述 ---------- */
      '<section class="part" id="part-desc">' +
        '<div class="part-head"><span class="idx">2</span><h2>组件描述</h2>' +
          '<span class="desc">它解决什么问题、用了哪些技术、哪里最容易踩坑</span></div>' +
        '<div class="part-body prose" id="descBody"><p class="mini">载入中…</p></div>' +
      '</section>' +

      /* ---------- ③ 源码 ---------- */
      '<section class="part" id="part-code">' +
        '<div class="part-head"><span class="idx">3</span><h2>组件代码</h2>' +
          '<span class="desc">单文件、零依赖，整块复制即可用</span>' +
          '<span class="spacer"></span>' +
          '<a class="btn sm primary" href="' + GH + w.file + '" target="_blank" rel="noopener">↗ GitHub 打开该文件</a>' +
          '<a class="btn sm" href="' + RAW + w.file + '" target="_blank" rel="noopener">Raw</a>' +
          '<button class="btn sm" id="copyCode">⧉ 复制全部</button>' +
        '</div>' +
        '<div class="part-body"><div class="code-wrap"><div class="code-scroll"><pre class="code" id="codeBody"></pre></div></div></div>' +
      '</section>' +

      /* ---------- ④ 教学 ---------- */
      '<section class="part" id="part-doc">' +
        '<div class="part-head"><span class="idx">4</span><h2>组件制作教学</h2>' +
          '<span class="desc">分步拆解原理，每一步都能单独验证</span>' +
          '<span class="spacer"></span>' +
          '<a class="btn sm primary" id="docGh" href="' + GH + w.doc + '" target="_blank" rel="noopener">↗ GitHub 打开教学文件</a>' +
          '<a class="btn sm" id="docRaw" href="' + RAW + w.doc + '" target="_blank" rel="noopener">Raw</a>' +
        '</div>' +
        '<div class="part-body"><article class="doc" id="docBody"><p class="mini">载入中…</p></article></div>' +
      '</section>';

    /* 上下篇导航 */
    var prev = R.widgets[idx - 1], next = R.widgets[idx + 1];
    document.getElementById('prevBtn').onclick = function () { go(prev); };
    document.getElementById('nextBtn').onclick = function () { go(next); };
    document.getElementById('prevBtn').disabled = !prev;
    document.getElementById('nextBtn').disabled = !next;
    document.getElementById('prevBtn').title = prev ? prev.title : '已是第一个';
    document.getElementById('nextBtn').title = next ? next.title : '已是最后一个';
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft' && prev) { e.preventDefault(); go(prev); }
      if (e.key === 'ArrowRight' && next) { e.preventDefault(); go(next); }
    });

    document.getElementById('reloadBtn').onclick = function () {
      var f = document.getElementById('stage'); f.src = w.file + '?r=' + Date.now(); toast('已重载');
    };
    var widened = false;
    document.getElementById('wideBtn').onclick = function () {
      widened = !widened;
      document.querySelector('.stage').style.maxWidth = widened ? 'none' : '';
      document.querySelector('.stage').style.width = widened ? '160%' : '';
      toast(widened ? '宽幅预览：横向滚动查看' : '已还原宽度');
    };

    /* 数据加载 */
    loadDesc(w);
    loadCode(w);
    loadDoc(w);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  function go(w) { if (w) location.hash = w.id; }

  /* ---------- ② ---------- */
  function loadDesc(w) {
    var el = document.getElementById('descBody');
    getFile('data/fragments/' + w.id + '.json').then(function (txt) {
      var d = JSON.parse(txt);
      var html = '<p>' + esc(w.summary) + '</p>';
      if (d.what) html += '<p>' + esc(d.what) + '</p>';
      if (d.points && d.points.length) {
        html += '<h3 style="font-size:14px;margin:20px 0 8px">关键技术点</h3><div class="kv">' +
          d.points.map(function (p) { return '<div><dt>' + esc(p.k) + '</dt><dd>' + esc(p.v) + '</dd></div>'; }).join('') + '</div>';
      }
      if (d.tryIt && d.tryIt.length) {
        html += '<h3 style="font-size:14px;margin:20px 0 6px">上手试试</h3><ul>' +
          d.tryIt.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
      }
      if (d.trap) html += '<blockquote><strong>容易踩的坑：</strong>' + esc(d.trap) + '</blockquote>';
      if (d.suite) html += '<p class="mini">适合用在：' + esc(d.suite) + '</p>';
      el.innerHTML = html;
    }).catch(function () {
      el.innerHTML = '<p>' + esc(w.summary) + '</p><div class="kv">' +
        w.tags.map(function (t) { return '<div><dt>技术点</dt><dd>' + esc(t) + '</dd></div>'; }).join('') + '</div>' +
        '<p class="mini">完整说明见第 ④ 段教学文档。</p>';
    });
  }

  /* ---------- ③ ---------- */
  function loadCode(w) {
    var el = document.getElementById('codeBody');
    getFile(w.file).then(function (src) {
      var lines = /\.css$/i.test(w.file) ? highlightPlain(src, 'css')
        : /\.js$/i.test(w.file) ? highlightPlain(src, 'js')
        : highlightMixed(src);
      el.innerHTML = lines.map(function (l, i) {
        return '<div class="code-line"><span class="ln">' + (i + 1) + '</span><span>' + (l || ' ') + '</span></div>';
      }).join('');
      document.getElementById('copyCode').onclick = function () { copy(src, this); };
      var st = document.getElementById('stagePath');
      st.textContent = w.file + ' · ' + lines.length + ' 行 · ' + (src.length / 1024).toFixed(1) + ' KB';
      store(src);
    }).catch(function (err) {
      el.innerHTML = '<div class="code-line"><span class="ln">·</span><span>' +
        (err.message === 'LOCAL'
          ? '本地 file:// 打开时浏览器禁止读取同目录文件，无法内联显示源码。\n请点右上角「GitHub 打开该文件」查看，或用 npx serve 启动后浏览。'
          : '源码加载失败：' + esc(err.message)) + '</span></div>';
      document.getElementById('copyCode').onclick = function () { toast('请先在 GitHub 查看源码'); };
    });
  }
  var currentSrc = '';
  function store(s) { currentSrc = s; }

  /* ---------- ④ ---------- */
  function loadDoc(w) {
    var el = document.getElementById('docBody');
    getFile(w.doc).then(function (md) {
      el.innerHTML = md2html(md);
      decorate(el);
    }).catch(function (err) {
      el.innerHTML = '<p>' + (err.message === 'LOCAL'
        ? '本地 file:// 无法读取 Markdown 教学，请点右上角「GitHub 打开教学文件」。'
        : '教学文档加载失败：' + esc(err.message)) + '</p>';
    });
  }
  function decorate(scope) {
    scope.querySelectorAll('pre').forEach(function (pre) {
      var code = pre.querySelector('code');
      if (!code) return;
      var lang = (pre.getAttribute('data-lang') || '').toLowerCase();
      if (lang === 'html' || lang === 'css' || lang === 'js' || lang === 'javascript') {
        var lines = lang === 'css' ? highlightPlain(code.textContent, 'css')
          : (lang === 'js' || lang === 'javascript') ? highlightPlain(code.textContent, 'js')
          : highlightPlain(code.textContent, 'html');
        code.innerHTML = lines.map(function (l) { return l || ' '; }).join('\n');
      }
      var b = document.createElement('button');
      b.className = 'copy-btn'; b.type = 'button'; b.textContent = '复制';
      b.onclick = function () { copy(pre.querySelector('code').textContent, b); };
      pre.appendChild(b);
    });
    /* 标题锚点 */
    scope.querySelectorAll('h1,h2,h3').forEach(function (h, i) {
      h.id = 'sec-' + i;
      var a = document.createElement('a');
      a.href = '#' + h.id; a.textContent = ' #';
      a.style.cssText = 'opacity:0;text-decoration:none;color:var(--fg-mute);font-weight:400';
      h.appendChild(a);
      h.addEventListener('mouseenter', function () { a.style.opacity = '.7'; });
      h.addEventListener('mouseleave', function () { a.style.opacity = '0'; });
    });
  }

  /* ---------------- 启动 / 路由 ---------------- */
  function boot() { render((location.hash || '#magnetic-cursor').slice(1)); }
  window.addEventListener('hashchange', boot);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
