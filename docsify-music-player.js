/* ============================================================
 * docsify-music-player  —  本地音乐播放器（CD 唱机风格 · 文章内嵌）
 *
 * 用法：在 **任意一篇 markdown 文章** 中插入如下代码块即可，
 *       播放列表就写在文章里，不需要改 index.html：
 *
 *   ```music
 *   title: 我的歌单                       ← 可选，标题
 *   mode: listLoop                        ← 可选，默认播放模式
 *   autoplay: false                       ← 可选，是否自动播放
 *   coverBase: music/covers               ← 可选，封面基础目录
 *   不如见一面 | 海来阿木 & 单依纯 | _media/music/不如见一面-海来阿木&单依纯.mp3 | cover.jpg
 *   另一首歌 | 某歌手 | _media/music/xxx.mp3
 *   ```
 *
 *   每行一首：曲名 | 歌手 | 音频地址 | 封面地址（封面可省略）
 *   mode 取值：sequence 顺序 | listLoop 列表循环 | single 单曲循环 | shuffle 随机
 *
 * index.html 里只需引入一次：
 *   <link rel="stylesheet" href="./_plugs/docsify-music-player.css" />
 *   <script src="_plugs/docsify-music-player.js"></script>
 * ============================================================ */
(function () {
  'use strict';

  var MODES = [
    { key: 'sequence', label: '顺序播放', icon: 'list' },
    { key: 'listLoop', label: '列表循环', icon: 'loop' },
    { key: 'single', label: '单曲循环', icon: 'single' },
    { key: 'shuffle', label: '随机播放', icon: 'shuffle' },
  ];

  var SVG = {
    prev: '<path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>',
    next: '<path d="M16 6h2v12h-2zm-2 6L5.5 6v12z"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    pause: '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>',
    list: '<path d="M3 5h18v2H3zm0 6h18v2H3zm0 6h12v2H3z"/>',
    loop: '<path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/>',
    single: '<path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/><text x="12" y="14.5" font-size="8" text-anchor="middle" fill="currentColor">1</text>',
    shuffle: '<path d="M17 3l4 4-4 4V8h-3l-2 2-1.4-1.4L12.6 6H17zM3 6h4l2 2 1.4-1.4L8.6 4H3zm14 9v-3l4 4-4 4v-3h-4.4l-2-2 1.4-1.4 1.6 1.4zM3 18h4.4l8-8 1.4 1.4-8.6 8.6H3z"/>',
    caret: '<path d="M7 10l5 5 5-5z"/>',
    note: '<path d="M9 17V5l10-2v12" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
    sun: '<path d="M12 7a5 5 0 100 10 5 5 0 000-10zm0-5v3m0 14v3M4.2 4.2l2.1 2.1m11.4 11.4l2.1 2.1M2 12h3m14 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    moon: '<path d="M20 14.5A8 8 0 119.5 4a6.5 6.5 0 1010.5 10.5z"/>',
    auto: '<path d="M12 3a9 9 0 000 18V3z"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    compress: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  };

  var THEMES = [
    { key: 'auto', label: '跟随系统', icon: 'auto' },
    { key: 'light', label: '亮色', icon: 'sun' },
    { key: 'dark', label: '暗色', icon: 'moon' },
  ];

  function svg(name, cls) {
    return '<svg class="' + (cls || 'dmp-svg') + '" viewBox="0 0 24 24">' + SVG[name] + '</svg>';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtTime(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function defaultCover() {
    var s =
      '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150">' +
      '<rect width="150" height="150" fill="#2a3140"/>' +
      '<g fill="#ee5865"><path d="M60 98V55l36-8v38" fill="none" stroke="#ee5865" stroke-width="5"/>' +
      '<circle cx="53" cy="98" r="10"/><circle cx="96" cy="85" r="10"/></g></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }
  function isExternalOrRootPath(path) {
    return /^([a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(path);
  }
  function joinMediaPath(base, path) {
    if (!base || !path || isExternalOrRootPath(path)) return path;
    var cleanBase = String(base).replace(/\/+$/, '');
    var cleanPath = String(path).replace(/^\/+/, '');
    if (!cleanBase) return cleanPath;
    if (cleanPath === cleanBase || cleanPath.indexOf(cleanBase + '/') === 0) return cleanPath;
    return cleanBase + '/' + cleanPath;
  }
  function cleanConfigValue(value) {
    return String(value).replace(/\s+#.*$/, '').trim();
  }

  // 系统配色偏好
  var mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function systemDark() { return mql ? mql.matches : true; }

  // 主题设置：优先用户上次选择，其次代码块 theme:，再次自动
  function readTheme(blockTheme) {
    var saved;
    try { saved = localStorage.getItem('dmp-theme'); } catch (e) {}
    var t = saved || blockTheme || 'auto';
    return /^(auto|light|dark)$/.test(t) ? t : 'auto';
  }
  function findTheme(key) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].key === key) return THEMES[i];
    return THEMES[0];
  }

  // —— 解析 ```music 代码块文本 ——
  function parseBlock(text) {
    var cfg = { title: '本地音乐', mode: 'listLoop', autoplay: false, theme: '', audioBase: '', coverBase: '', list: [] };
    text.split('\n').forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      var m = line.match(/^(title|mode|autoplay|theme|audioBase|musicBase|coverBase)\s*[:：]\s*(.+)$/i);
      if (m && line.indexOf('|') === -1) {
        var k = m[1].toLowerCase(), v = cleanConfigValue(m[2]);
        if (k === 'autoplay') cfg.autoplay = /^(true|1|yes|on)$/i.test(v);
        else if (k === 'audiobase' || k === 'musicbase') cfg.audioBase = v;
        else if (k === 'coverbase') cfg.coverBase = v;
        else cfg[k] = v;
        return;
      }
      // 曲目行：name | artist | url | cover
      var parts = line.split('|').map(function (s) { return s.trim(); });
      var t = { name: parts[0] || '', artist: parts[1] || '', url: parts[2] || '', cover: parts[3] || '' };
      if (!t.url && t.name) { t.url = t.name; t.name = t.url.split('/').pop(); } // 容错：只给了地址
      if (t.url) cfg.list.push(t);
    });
    cfg.list.forEach(function (t) {
      t.url = joinMediaPath(cfg.audioBase, t.url);
      t.cover = joinMediaPath(cfg.coverBase, t.cover);
    });
    return cfg;
  }

  function MusicPlayer(container, cfg) {
    this.container = container;
    this.cfg = cfg;
    this.list = cfg.list.slice();
    this.index = 0;
    this.modeIndex = this.findModeIndex(cfg.mode);
    this.listOpen = false;
    this.fullscreen = false;
    this.theme = readTheme(cfg.theme);   // auto | light | dark
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.shuffleBag = [];
    this.build();
    this.bindAudio();
    this.applyTheme();
    this.load(this.index, false);
    if (cfg.autoplay) { var a = this.audio; a.play().catch(function () {}); }
  }

  MusicPlayer.prototype.findModeIndex = function (key) {
    for (var i = 0; i < MODES.length; i++) if (MODES[i].key === key) return i;
    return 1;
  };
  MusicPlayer.prototype.mode = function () { return MODES[this.modeIndex]; };

  MusicPlayer.prototype.build = function () {
    var self = this;
    var card = document.createElement('div');
    card.className = 'dmp-card';
    card.innerHTML =
      '<div class="dmp-bg-blur"></div>' +
      '<div class="dmp-stage">' +
        '<div class="dmp-disc"><div class="dmp-cover"></div></div>' +
        '<div class="dmp-tonearm"><div class="dmp-pivot"></div><div class="dmp-arm"></div><div class="dmp-head"></div></div>' +
      '</div>' +
      '<div class="dmp-panel">' +
        '<div class="dmp-head-row">' +
          '<span class="dmp-brand">' + svg('note', 'dmp-svg') + '<span>' + esc(this.cfg.title) + '</span></span>' +
          '<span class="dmp-tools">' +
            '<span class="dmp-tool dmp-theme-btn" title="切换皮肤"></span>' +
            '<span class="dmp-tool dmp-fs-btn" title="全屏"></span>' +
            '<span class="dmp-tool dmp-min" title="最小化到悬浮图标">' + svg('caret', 'dmp-svg') + '</span>' +
          '</span>' +
        '</div>' +
        '<div class="dmp-song">—</div>' +
        '<div class="dmp-artist"></div>' +
        '<div class="dmp-progress">' +
          '<span class="dmp-cur">0:00</span>' +
          '<div class="dmp-bar"><div class="dmp-bar-fill"></div></div>' +
          '<span class="dmp-dur">0:00</span>' +
        '</div>' +
        '<div class="dmp-controls">' +
          '<button class="dmp-mode-btn" title="播放模式"></button>' +
          '<button class="dmp-prev" title="上一首">' + svg('prev') + '</button>' +
          '<button class="dmp-play-btn" title="播放/暂停">' + svg('play') + '</button>' +
          '<button class="dmp-next" title="下一首">' + svg('next') + '</button>' +
          '<span class="dmp-spacer"></span>' +
        '</div>' +
        '<div class="dmp-list-bar">' +
          '<span class="dmp-list-toggle">' + svg('list') + '<span>播放列表</span>' + svg('caret', 'dmp-svg dmp-caret') + '</span>' +
          '<span class="dmp-count"></span>' +
        '</div>' +
        '<div class="dmp-list-wrap"></div>' +
      '</div>';
    this.container.innerHTML = '';
    this.container.appendChild(card);
    this.card = card;

    // 悬浮唱片图标（最小化目标，默认隐藏）
    var launcher = document.createElement('div');
    launcher.className = 'dmp-launcher dmp-hidden';
    launcher.title = '展开音乐播放器';
    launcher.addEventListener('click', function () { self.minimize(false); });
    document.body.appendChild(launcher);
    this.launcher = launcher;

    // 引用
    this.el_bgblur = card.querySelector('.dmp-bg-blur');
    this.el_cover = card.querySelector('.dmp-cover');
    this.el_disc = card.querySelector('.dmp-disc');
    this.el_arm = card.querySelector('.dmp-tonearm');
    this.el_song = card.querySelector('.dmp-song');
    this.el_artist = card.querySelector('.dmp-artist');
    this.el_cur = card.querySelector('.dmp-cur');
    this.el_dur = card.querySelector('.dmp-dur');
    this.el_bar = card.querySelector('.dmp-bar');
    this.el_fill = card.querySelector('.dmp-bar-fill');
    this.el_play = card.querySelector('.dmp-play-btn');
    this.el_mode = card.querySelector('.dmp-mode-btn');
    this.el_listwrap = card.querySelector('.dmp-list-wrap');
    this.el_toggle = card.querySelector('.dmp-list-toggle');
    this.el_count = card.querySelector('.dmp-count');
    this.el_theme = card.querySelector('.dmp-theme-btn');
    this.el_fs = card.querySelector('.dmp-fs-btn');
    this.el_fs.innerHTML = svg('expand', 'dmp-svg');

    // 事件
    this.el_theme.addEventListener('click', function () { self.cycleTheme(); });
    this.el_fs.addEventListener('click', function () { self.toggleFullscreen(); });
    card.querySelector('.dmp-min').addEventListener('click', function () { self.minimize(true); });
    card.querySelector('.dmp-prev').addEventListener('click', function () { self.prev(); });
    card.querySelector('.dmp-next').addEventListener('click', function () { self.next(); });
    this.el_play.addEventListener('click', function () { self.toggle(); });
    this.el_mode.addEventListener('click', function () { self.cycleMode(); });
    this.el_toggle.addEventListener('click', function () { self.toggleList(); });
    this.el_bar.addEventListener('click', function (e) { self.seek(e); });

    this.renderMode();
    this.renderList();
    this.el_count.textContent = this.list.length + ' 首';
  };

  MusicPlayer.prototype.bindAudio = function () {
    var self = this, a = this.audio;
    a.addEventListener('timeupdate', function () {
      if (a.duration) {
        self.el_fill.style.width = (a.currentTime / a.duration * 100) + '%';
        self.el_cur.textContent = fmtTime(a.currentTime);
      }
    });
    a.addEventListener('loadedmetadata', function () { self.el_dur.textContent = fmtTime(a.duration); });
    a.addEventListener('play', function () { self.onPlayState(); });
    a.addEventListener('pause', function () { self.onPlayState(); });
    a.addEventListener('ended', function () { self.onEnded(); });
    a.addEventListener('error', function () { self.el_artist.textContent = '⚠️ 无法加载音频，请检查路径'; });
  };

  MusicPlayer.prototype.load = function (i, autoplay) {
    if (!this.list.length) { this.el_song.textContent = '播放列表为空'; return; }
    this.index = (i + this.list.length) % this.list.length;
    var t = this.list[this.index];
    this.audio.src = t.url;
    this.el_song.textContent = t.name || t.url.split('/').pop();
    this.el_artist.textContent = t.artist || '';
    var coverUrl = t.cover || defaultCover();
    this.el_cover.style.backgroundImage = 'url("' + coverUrl + '")';
    // 全屏氛围背景：仅当全屏时才真正加载这张大图
    this._coverUrl = coverUrl;
    if (this.fullscreen) this.el_bgblur.style.backgroundImage = 'url("' + coverUrl + '")';
    this.el_fill.style.width = '0%';
    this.el_cur.textContent = '0:00';
    this.renderListActive();
    if (autoplay) this.audio.play().catch(function () {});
  };

  MusicPlayer.prototype.toggle = function () {
    if (this.audio.paused) this.audio.play().catch(function () {});
    else this.audio.pause();
  };

  MusicPlayer.prototype.onPlayState = function () {
    var playing = !this.audio.paused;
    this.el_play.innerHTML = svg(playing ? 'pause' : 'play');
    this.el_disc.classList.toggle('dmp-playing', playing);
    this.el_arm.classList.toggle('dmp-on', playing);
    this.launcher.classList.toggle('dmp-spin', playing);
  };

  MusicPlayer.prototype.prev = function () {
    if (this.mode().key === 'shuffle') return this.load(this.randomIndex(), true);
    this.load(this.index - 1, true);
  };
  MusicPlayer.prototype.next = function () {
    if (this.mode().key === 'shuffle') return this.load(this.randomIndex(), true);
    this.load(this.index + 1, true);
  };

  MusicPlayer.prototype.randomIndex = function () {
    if (this.list.length <= 1) return this.index;
    if (!this.shuffleBag.length) {
      for (var i = 0; i < this.list.length; i++) if (i !== this.index) this.shuffleBag.push(i);
      for (var j = this.shuffleBag.length - 1; j > 0; j--) {
        var k = Math.floor(Math.random() * (j + 1));
        var tmp = this.shuffleBag[j]; this.shuffleBag[j] = this.shuffleBag[k]; this.shuffleBag[k] = tmp;
      }
    }
    return this.shuffleBag.pop();
  };

  MusicPlayer.prototype.onEnded = function () {
    var mode = this.mode().key;
    if (mode === 'single') { this.audio.currentTime = 0; this.audio.play().catch(function () {}); }
    else if (mode === 'shuffle') { this.load(this.randomIndex(), true); }
    else if (mode === 'listLoop') { this.load(this.index + 1, true); }
    else { if (this.index < this.list.length - 1) this.load(this.index + 1, true); else this.onPlayState(); }
  };

  MusicPlayer.prototype.cycleMode = function () {
    this.modeIndex = (this.modeIndex + 1) % MODES.length;
    this.shuffleBag = [];
    this.renderMode();
  };
  MusicPlayer.prototype.renderMode = function () {
    var m = this.mode();
    this.el_mode.innerHTML = svg(m.icon) + '<span class="dmp-mode-label">' + m.label + '</span>';
    this.el_mode.title = '播放模式：' + m.label + '（点击切换）';
  };

  MusicPlayer.prototype.seek = function (e) {
    if (!this.audio.duration) return;
    var rect = this.el_bar.getBoundingClientRect();
    var ratio = (e.clientX - rect.left) / rect.width;
    this.audio.currentTime = Math.max(0, Math.min(1, ratio)) * this.audio.duration;
  };

  MusicPlayer.prototype.toggleList = function () {
    this.listOpen = !this.listOpen;
    this.el_listwrap.classList.toggle('dmp-open', this.listOpen);
    this.el_toggle.classList.toggle('dmp-open', this.listOpen);
    if (this.listOpen) this.applyThumbs(); // 首次展开才加载缩略图
  };

  MusicPlayer.prototype.minimize = function (min) {
    this.card.classList.toggle('dmp-min-hidden', min);
    this.launcher.classList.toggle('dmp-hidden', !min);
  };

  // —— 皮肤：auto / light / dark ——
  MusicPlayer.prototype.applyTheme = function () {
    var t = findTheme(this.theme);
    var dark = this.theme === 'dark' || (this.theme === 'auto' && systemDark());
    this.card.classList.toggle('dmp-skin-dark', dark);
    this.card.classList.toggle('dmp-skin-light', !dark);
    this.el_theme.innerHTML = svg(t.icon, 'dmp-svg');
    this.el_theme.title = '皮肤：' + t.label + '（点击切换）';
    // 自动模式下监听系统切换
    if (mql && !this._mqlBound) {
      var self = this;
      this._mqlHandler = function () { if (self.theme === 'auto') self.applyTheme(); };
      (mql.addEventListener ? mql.addEventListener('change', this._mqlHandler)
                           : mql.addListener(this._mqlHandler));
      this._mqlBound = true;
    }
  };
  MusicPlayer.prototype.cycleTheme = function () {
    var i = 0;
    for (var k = 0; k < THEMES.length; k++) if (THEMES[k].key === this.theme) i = k;
    this.theme = THEMES[(i + 1) % THEMES.length].key;
    try { localStorage.setItem('dmp-theme', this.theme); } catch (e) {}
    this.applyTheme();
  };

  // —— 全屏模式 ——
  MusicPlayer.prototype.toggleFullscreen = function (force) {
    this.fullscreen = (typeof force === 'boolean') ? force : !this.fullscreen;
    if (this.fullscreen && this._coverUrl) this.el_bgblur.style.backgroundImage = 'url("' + this._coverUrl + '")';
    this.card.classList.toggle('dmp-fullscreen', this.fullscreen);
    document.body.classList.toggle('dmp-fs-lock', this.fullscreen);
    this.el_fs.innerHTML = svg(this.fullscreen ? 'compress' : 'expand', 'dmp-svg');
    this.el_fs.title = this.fullscreen ? '退出全屏' : '全屏';
    if (this.fullscreen && !this._escBound) {
      var self = this;
      this._escHandler = function (e) { if (e.key === 'Escape') self.toggleFullscreen(false); };
      document.addEventListener('keydown', this._escHandler);
      this._escBound = true;
    }
  };

  MusicPlayer.prototype.renderList = function () {
    var self = this, html = '';
    this.list.forEach(function (t, i) {
      // 缩略图懒加载：先只存 data-cover，展开列表时才真正请求图片
      var thumb = t.cover ? 'data-cover="' + esc(t.cover) + '"' : '';
      html +=
        '<div class="dmp-list-item" data-i="' + i + '">' +
          '<span class="dmp-idx">' + (i + 1) + '</span>' +
          '<div class="dmp-thumb" ' + thumb + '></div>' +
          '<div class="dmp-li-info">' +
            '<div class="dmp-li-name">' + esc(t.name || t.url.split('/').pop()) + '</div>' +
            (t.artist ? '<div class="dmp-li-artist">' + esc(t.artist) + '</div>' : '') +
          '</div>' +
          '<div class="dmp-li-sort"><span class="dmp-up" title="上移">▲</span><span class="dmp-down" title="下移">▼</span></div>' +
        '</div>';
    });
    this.el_listwrap.innerHTML = html;
    Array.prototype.forEach.call(this.el_listwrap.querySelectorAll('.dmp-list-item'), function (row) {
      var i = parseInt(row.getAttribute('data-i'), 10);
      row.addEventListener('click', function (e) {
        if (e.target.classList.contains('dmp-up') || e.target.classList.contains('dmp-down')) return;
        self.load(i, true);
      });
      row.querySelector('.dmp-up').addEventListener('click', function (e) { e.stopPropagation(); self.moveItem(i, -1); });
      row.querySelector('.dmp-down').addEventListener('click', function (e) { e.stopPropagation(); self.moveItem(i, 1); });
    });
    this.renderListActive();
    if (this.listOpen) this.applyThumbs(); // 列表已展开时补加载缩略图
  };

  // 真正请求缩略图：仅对尚未加载、且带 data-cover 的项设置背景
  MusicPlayer.prototype.applyThumbs = function () {
    Array.prototype.forEach.call(this.el_listwrap.querySelectorAll('.dmp-thumb[data-cover]'), function (el) {
      el.style.backgroundImage = 'url("' + el.getAttribute('data-cover') + '")';
      el.removeAttribute('data-cover');
    });
  };

  MusicPlayer.prototype.renderListActive = function () {
    var self = this;
    Array.prototype.forEach.call(this.el_listwrap.querySelectorAll('.dmp-list-item'), function (row) {
      row.classList.toggle('dmp-active', parseInt(row.getAttribute('data-i'), 10) === self.index);
    });
  };

  MusicPlayer.prototype.moveItem = function (i, dir) {
    var j = i + dir;
    if (j < 0 || j >= this.list.length) return;
    var cur = this.list[this.index];
    var tmp = this.list[i]; this.list[i] = this.list[j]; this.list[j] = tmp;
    this.index = this.list.indexOf(cur);
    this.shuffleBag = [];
    this.renderList();
  };

  MusicPlayer.prototype.destroy = function () {
    try { this.audio.pause(); this.audio.src = ''; } catch (e) {}
    if (this.fullscreen) { this.card.classList.remove('dmp-fullscreen'); document.body.classList.remove('dmp-fs-lock'); }
    if (this._escBound && this._escHandler) document.removeEventListener('keydown', this._escHandler);
    if (this._mqlBound && this._mqlHandler && mql) {
      (mql.removeEventListener ? mql.removeEventListener('change', this._mqlHandler) : mql.removeListener(this._mqlHandler));
    }
    if (this.launcher && this.launcher.parentNode) this.launcher.parentNode.removeChild(this.launcher);
  };

  // ============================================================
  // docsify 插件：每次渲染文章时，把 ```music 代码块替换成播放器
  // ============================================================
  function plugin(hook) {
    var instances = [];

    function cleanup() {
      instances.forEach(function (p) { p.destroy(); });
      instances = [];
    }

    hook.doneEach(function () {
      cleanup();
      var content = document.querySelector('.markdown-section') || document;
      // 自定义渲染器会输出 <pre data-lang="music">…</pre>
      var blocks = content.querySelectorAll('pre[data-lang="music"], code.lang-music');
      Array.prototype.forEach.call(blocks, function (node) {
        var pre = node.tagName === 'PRE' ? node : node.closest('pre');
        if (!pre || pre.getAttribute('data-dmp') === '1') return;
        pre.setAttribute('data-dmp', '1');
        var cfg = parseBlock(pre.textContent || '');
        if (!cfg.list.length) {
          // 没写歌也给个演示，避免空白
          cfg.list.push({ name: '不如见一面', artist: '海来阿木 & 单依纯', url: '_media/music/不如见一面-海来阿木&单依纯.mp3', cover: '' });
        }
        var host = document.createElement('div');
        host.className = 'dmp-host';
        pre.parentNode.replaceChild(host, pre);
        instances.push(new MusicPlayer(host, cfg));
      });
    });
  }

  if (window.$docsify) {
    window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins || []);
  }
  window.DocsifyMusicPlayer = MusicPlayer;
})();
