# docsify-music-player

A local music player plugin for docsify — a CSS CD‑turntable UI you embed inside any article.
一个用于 [docsify](https://docsify.js.org/) 的本地音乐播放器插件：纯 CSS 打造的 CD 唱机界面，可直接嵌入到任意文章中。

播放列表写在文章里（而不是 `index.html`），哪篇文章放了 ` ```music ` 代码块，哪篇才显示播放器。适合个人知识库、博客笔记、歌单分享等场景。

## 功能特性

- 🎵 **CD 唱机界面**：纯 CSS 黑胶唱片，播放时唱片旋转、唱臂落针（唱针只接触唱片外圈边缘）
- 🖼️ **显示封面**：每首歌可单独配封面，作为唱片标签显示；无封面时自动用内置音符占位图
- 🔀 **四种播放模式**：顺序播放 / 列表循环 / 单曲循环 / 随机播放（随机用洗牌算法，避免立即重复）
- 📜 **播放列表**：可展开、点歌、用 ▲▼ 自由调整播放顺序
- 🌗 **三种皮肤**：自动（跟随系统）/ 亮色 / 暗色，可手动切换，选择会被记住
- ⛶ **全屏模式**：氛围模糊封面背景 + 毛玻璃信息面板，`Esc` 退出
- 🪟 **最小化**：可收进右下角悬浮唱片图标，点击再展开
- ⚡ **按需加载**：任一时刻只加载当前播放的一首（且未播放时只读元数据，不下载整首）；列表缩略图、全屏大图都是懒加载，打开页面几乎不耗流量
- 📱 **移动端自适应**

## 使用方式

将 `docsify-music-player.js` 和 `docsify-music-player.css` 放入你的 docsify 项目，例如：

```text
docs/
├── index.html
├── README.md
└── plugins/
    ├── docsify-music-player.js
    └── docsify-music-player.css
```

在 `index.html` 中引入（CSS 放 `<head>`，JS 放 docsify 主脚本之后）：

```html
<link rel="stylesheet" href="./plugins/docsify-music-player.css" />
...
<script src="//cdn.jsdelivr.net/npm/docsify/lib/docsify.min.js"></script>
<script src="./plugins/docsify-music-player.js"></script>
```

也可以用 CDN（发布到 GitHub 后通过 jsDelivr）：

```html
<link rel="stylesheet" href="//cdn.jsdelivr.net/gh/jav1988/docsify-music-player/docsify-music-player.css" />
<script src="//cdn.jsdelivr.net/gh/jav1988/docsify-music-player/docsify-music-player.js"></script>
```

## 在文章中插入播放器

在**任意一篇** markdown 文章里写一个 ` ```music ` 代码块即可：

````markdown
```music
title: 我的歌单           # 可选，标题
mode: listLoop           # 可选：sequence 顺序 / listLoop 列表循环 / single 单曲循环 / shuffle 随机
theme: auto              # 可选：auto 跟随系统 / light 亮色 / dark 暗色（也可在界面右上角切换）
autoplay: false          # 可选，是否自动播放（多数浏览器会拦截无交互的自动播放）
coverBase: music/covers  # 可选，封面基础目录；下面封面只写文件名即可
不如见一面 | 海来阿木 & 单依纯 | music/不如见一面.mp3 | 不如见一面.jpg
贝加尔湖畔 | 李健 | music/贝加尔湖畔.mp3 | 贝加尔湖畔.jpg
野子 | 苏运莹 | music/野子.mp3
```
````

**每行一首**，用 `|` 分隔四列：`曲名 | 歌手 | 音频地址 | 封面地址`。

- 歌手、封面可省略；省略封面时显示内置音符占位图。
- 音频 / 封面路径相对你的站点根目录。
- 如果多首歌的封面在同一目录，可以写 `coverBase: music/covers`，曲目行里的封面列只填文件名。已有完整 URL、根路径、`data:` 地址不会被拼接。

## 配置项

代码块内可写以下配置行（`key: value`），其余行均按曲目解析：

| 配置 | 取值 | 说明 |
| --- | --- | --- |
| `title` | 任意文本 | 播放器标题，默认「本地音乐」 |
| `mode` | `sequence` / `listLoop` / `single` / `shuffle` | 默认播放模式，默认 `listLoop` |
| `theme` | `auto` / `light` / `dark` | 默认皮肤，默认 `auto`（用户手动切换后以本地记录为准） |
| `autoplay` | `true` / `false` | 是否自动播放，默认 `false` |
| `coverBase` | 相对目录或绝对 URL | 封面基础目录，用于自动拼接曲目行第 4 列 |
| `audioBase` / `musicBase` | 相对目录或绝对 URL | 音频基础目录，用于自动拼接曲目行第 3 列 |

## 界面操作

- **左侧模式按钮**：循环切换顺序 / 列表循环 / 单曲循环 / 随机
- **进度条**：点击或拖动跳转
- **播放列表**：点击「播放列表」展开，点歌曲播放，hover 出现 ▲▼ 调整顺序
- **右上角**：🌗 切换皮肤、⛶ 全屏、最小化

## 浏览器兼容

- 依赖 `Audio`、CSS 变量、`backdrop-filter`（全屏毛玻璃），现代浏览器均支持。
- 自动播放受浏览器策略限制，通常需要用户先与页面交互一次。

## License

[MIT](./LICENSE) © 2026 Javen Ma
