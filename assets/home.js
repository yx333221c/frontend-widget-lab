/* 主页渲染：注册表 -> 分类目录 + 卡片网格，支持搜索 / 分类 / 难度筛选 */
(function () {
  var R = window.WIDGET_REGISTRY;
  var BASE = (function () {
    var p = location.pathname.split('/');
    p.pop();
    return p.length ? p.join('/') + '/' : '/';
  })();

  var catBody = document.getElementById('catalogBody');
  var chipsEl = document.getElementById('chips');
  var diffsEl = document.getElementById('diffs');
  var qEl = document.getElementById('q');
  var emptyEl = document.getElementById('emptyState');
  var countEl = document.getElementById('resultCount');

  var state = { q: '', cats: new Set(), diffs: new Set() };

  document.getElementById('statCount').textContent = R.widgets.length;
  document.getElementById('statCat').textContent = R.categories.length;

  /* ---------- 主题 ---------- */
  var themeBtn = document.getElementById('themeBtn');
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    themeBtn.textContent = t === 'dark' ? '🌙 夜间' : '☀️ 白天';
    try { localStorage.setItem('wl-theme', t); } catch (e) {}
  }
  var saved = null;
  try { saved = localStorage.getItem('wl-theme'); } catch (e) {}
  applyTheme(saved || 'dark');
  themeBtn.addEventListener('click', function () {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  /* ---------- 筛选条 ---------- */
  R.categories.forEach(function (c) {
    var n = R.widgets.filter(function (w) { return w.cat === c.id; }).length;
    var b = document.createElement('button');
    b.className = 'chip';
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    b.dataset.cat = c.id;
    b.innerHTML = c.glyph + ' ' + c.title + '<span class="n">' + n + '</span>';
    b.addEventListener('click', function () { toggle(state.cats, c.id, b); });
    chipsEl.appendChild(b);
  });
  ['入门', '进阶', '高级'].forEach(function (d) {
    var b = document.createElement('button');
    b.className = 'chip';
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = d;
    b.addEventListener('click', function () { toggle(state.diffs, d, b); });
    diffsEl.appendChild(b);
  });
  function toggle(set, key, btn) {
    if (set.has(key)) { set.delete(key); btn.setAttribute('aria-pressed', 'false'); }
    else { set.add(key); btn.setAttribute('aria-pressed', 'true'); }
    render();
  }
  qEl.addEventListener('input', function () { state.q = qEl.value.trim().toLowerCase(); render(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== qEl) { e.preventDefault(); qEl.focus(); }
    if (e.key === 'Escape' && document.activeElement === qEl) { qEl.value = ''; state.q = ''; render(); qEl.blur(); }
  });

  /* ---------- 匹配 ---------- */
  function match(w) {
    if (state.cats.size && !state.cats.has(w.cat)) return false;
    if (state.diffs.size && !state.diffs.has(w.difficulty)) return false;
    if (!state.q) return true;
    var hay = (w.title + ' ' + w.summary + ' ' + w.tags.join(' ') + ' ' + w.id + ' ' + w.difficulty).toLowerCase();
    return state.q.split(/\s+/).every(function (t) { return hay.indexOf(t) > -1; });
  }

  /* ---------- 卡片 ---------- */
  function card(w) {
    var a = document.createElement('a');
    a.className = 'card';
    a.href = 'widget.html#' + w.id;
    a.innerHTML =
      '<div class="card-shot">' +
        '<span class="badge-accent">' + esc(w.difficulty) + '</span>' +
        '<img loading="lazy" alt="' + esc(w.title) + ' 效果预览" src="' + BASE + 'assets/shots/' + w.id + '.png" ' +
        'onerror="this.parentNode.querySelector(\'.fallback\')&&(this.style.display=\'none\')">' +
        '<span class="fallback" aria-hidden="true">' + esc(catGlyph(w.cat)) + '</span>' +
      '</div>' +
      '<div class="card-body">' +
        '<h3 class="card-title">' + esc(w.title) + '</h3>' +
        '<p class="card-sum">' + esc(w.summary) + '</p>' +
        '<div class="card-meta">' +
          w.tags.slice(0, 3).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') +
          '<span class="tag diff">' + w.minutes + ' min</span>' +
        '</div>' +
        '<div class="card-foot">' +
          '<span class="mini">▶ 看演示</span><span class="spacer"></span>' +
          '<span class="mini" data-gh="' + esc(w.file) + '">↗ 源码</span>' +
        '</div>' +
      '</div>';
    var gh = a.querySelector('[data-gh]');
    gh.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      window.open(GH_RAW + w.file, '_blank', 'noopener');
    });
    return a;
  }

  var GH_RAW = 'https://github.com/yx333221c/frontend-widget-lab/blob/main/';
  function catGlyph(id) {
    var c = R.categories.filter(function (x) { return x.id === id; })[0];
    return c ? c.glyph : '◆';
  }
  function catTitle(id) {
    var c = R.categories.filter(function (x) { return x.id === id; })[0];
    return c ? c.title : id;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  /* ---------- 渲染 ---------- */
  function render() {
    var shown = 0;
    catBody.innerHTML = '';
    R.categories.forEach(function (c) {
      var list = R.widgets.filter(function (w) { return w.cat === c.id && match(w); });
      if (!list.length) return;
      shown += list.length;
      var sec = document.createElement('section');
      sec.className = 'section';
      sec.innerHTML =
        '<div class="cat-head"><span class="glyph">' + c.glyph + '</span>' +
        '<h2>' + esc(c.title) + '</h2><p>' + esc(c.blurb) + '</p></div>';
      var grid = document.createElement('div');
      grid.className = 'grid';
      list.forEach(function (w) { grid.appendChild(card(w)); });
      sec.appendChild(grid);
      catBody.appendChild(sec);
    });
    emptyEl.hidden = shown > 0;
    countEl.textContent = shown + ' / ' + R.widgets.length + ' 个组件';
  }
  render();
})();
