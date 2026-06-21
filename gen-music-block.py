#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen-music-block.py —— 扫描某个目录里的音频文件，自动生成 docsify-music-player
可用的 ```music 代码块，直接粘进 markdown 文章即可。

不带参数运行（或加 -h / --help）会打印本帮助。

用法:
    python gen-music-block.py <音频目录> [选项]

示例:
    # 扫描 docs/_media/music 下的音频，写入 docs/_media/music/playlist.md
    python gen-music-block.py docs/_media/music

    # 封面单独放在另一个目录：覆盖 coverBase（audioBase 仍是默认 _media/music）
    python gen-music-block.py docs/_media/music \\
        --cover-dir docs/_media/covers --cover-base _media/covers

    # 文件名是「歌手 - 曲名」的顺序，并指定标题、播放模式
    python gen-music-block.py ./music --order artist-title \\
        --title 我的歌单 --mode shuffle --autoplay

    # 自定义输出文件名
    python gen-music-block.py ./music -o my-playlist.md

文件名解析:
    脚本会去掉扩展名，按分隔符（默认 "-"）拆出 曲名 和 歌手。
        Dreamlover-Mariah Carey.mp3  →  Dreamlover | Mariah Carey
    --order title-artist (默认) 表示「曲名在前」；artist-title 表示「歌手在前」。
    文件名里没有分隔符时，整个名字当作曲名，歌手留空。
    用 --sep 改分隔符（例如 " - "）。

封面匹配:
    默认在音频同目录里找同名图片（.jpg/.jpeg/.png/.webp/.gif）。
    用 --cover-dir 指定单独的封面目录。匹配不到则该行不写封面（前端用占位图）。

路径生成:
    - 默认输出 audioBase / coverBase 配置行（均为 _media/music），曲目行只写文件名，
      由前端自动拼接。coverBase 默认跟随 audioBase，可用 --cover-base 单独覆盖。
    - 把 --audio-base 设为空字符串则不写 base 配置行，改为「<前缀>/<文件名>」的
      完整路径模式：前缀默认是传入的音频目录，用 --prefix / --cover-prefix 覆盖。

输出说明:
    生成的 ```music 代码块默认写入 <音频目录>/playlist.md（用 -o 改文件名），
    终端只显示配置、曲目预览表和统计，不打印代码块；需要核对时加 --preview。
    安装了 rich（pip install rich）会显示彩色表格 / 面板，没装则自动降级为纯文本，
    功能不受影响。
"""

import argparse
import os
import re
import sys

# rich 用来在 stderr 上输出整齐的预览/统计；没装也能正常工作（自动降级为纯文本）。
try:
    from rich import box
    from rich.console import Console
    from rich.panel import Panel
    from rich.syntax import Syntax
    from rich.table import Table

    _HAS_RICH = True
    # 注意：生成的 ```music 代码块走 stdout（方便重定向/管道），
    # 所有装饰性输出都走 stderr，互不污染。
    _console = Console(stderr=True)
except ImportError:  # pragma: no cover - 仅在未安装 rich 时触发
    _HAS_RICH = False
    _console = None

AUDIO_EXTS = (".mp3", ".m4a", ".flac", ".ogg", ".oga", ".opus", ".wav", ".aac")
COVER_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp")

EXAMPLES = """\
# 扫描目录，写入 docs/_media/music/playlist.md
python gen-music-block.py docs/_media/music

# 抽出公共前缀为 audioBase / coverBase，曲目行只写文件名
python gen-music-block.py docs/_media/music \\
    --audio-base _media/music --cover-base _media/covers

# 文件名是「歌手 - 曲名」顺序，指定标题与播放模式
python gen-music-block.py ./music --order artist-title \\
    --title 我的歌单 --mode shuffle --autoplay

# 自定义输出文件名
python gen-music-block.py ./music -o my-playlist.md"""


def die(msg):
    """打印错误并退出。装了 rich 就用红色面板，否则退回纯文本。"""
    if _HAS_RICH:
        _console.print(Panel(str(msg), title="✗ 错误", border_style="red",
                             box=box.ROUNDED))
    else:
        sys.stderr.write("错误: %s\n" % msg)
    sys.exit(1)


def natural_key(s):
    """让 track1, track2, track10 这样的文件名按自然顺序排序。"""
    return [int(t) if t.isdigit() else t.lower()
            for t in re.split(r"(\d+)", s)]


def parse_filename(stem, sep, order):
    """从去扩展名的文件名里拆出 (曲名, 歌手)。"""
    parts = [p.strip() for p in stem.split(sep, 1)] if sep else [stem.strip()]
    if len(parts) == 2 and parts[0] and parts[1]:
        if order == "artist-title":
            artist, title = parts
        else:
            title, artist = parts
        return title, artist
    return stem.strip(), ""


def find_cover(stem, cover_dir):
    """在 cover_dir 里找与 stem 同名的图片，返回文件名或 None。"""
    if not cover_dir or not os.path.isdir(cover_dir):
        return None
    for ext in COVER_EXTS:
        cand = stem + ext
        if os.path.isfile(os.path.join(cover_dir, cand)):
            return cand
    return None


def join_url(prefix, name):
    """用正斜杠拼接路径（web 路径，不用 os.sep）。"""
    if not prefix:
        return name
    return prefix.rstrip("/") + "/" + name


def build_block(args):
    audio_dir = args.directory
    if not os.path.isdir(audio_dir):
        die("目录不存在 -> %s" % audio_dir)

    cover_dir = args.cover_dir or audio_dir

    files = [f for f in os.listdir(audio_dir)
             if os.path.isfile(os.path.join(audio_dir, f))
             and os.path.splitext(f)[1].lower() in AUDIO_EXTS]
    files.sort(key=natural_key)

    if not files:
        die("目录里没有找到音频文件 (%s)" % ", ".join(AUDIO_EXTS))

    # 曲目行里的路径前缀。--prefix 显式优先；否则默认用传入的目录。
    audio_prefix = args.prefix if args.prefix is not None else audio_dir
    cover_prefix = args.cover_prefix if args.cover_prefix is not None else cover_dir

    lines = ["```music"]

    # ---- 配置行 ----
    if args.title:
        lines.append("title: %s" % args.title)
    lines.append("mode: %s" % args.mode)
    if args.theme:
        lines.append("theme: %s" % args.theme)
    if args.autoplay:
        lines.append("autoplay: true")
    if args.audio_base is not None:
        lines.append("audioBase: %s" % args.audio_base)
    if args.cover_base is not None:
        lines.append("coverBase: %s" % args.cover_base)

    # ---- 曲目行 ----
    tracks = []
    for f in files:
        stem, _ = os.path.splitext(f)
        title, artist = parse_filename(stem, args.sep, args.order)

        if args.audio_base is not None:
            audio_url = f                       # 由前端拼接 audioBase
        else:
            audio_url = join_url(audio_prefix, f)

        cover_file = find_cover(stem, cover_dir)
        if cover_file:
            if args.cover_base is not None:
                cover_url = cover_file          # 由前端拼接 coverBase
            else:
                cover_url = join_url(cover_prefix, cover_file)
        else:
            cover_url = ""

        row = "%s | %s | %s" % (title, artist, audio_url)
        if cover_url:
            row += " | %s" % cover_url
        lines.append(row)

        tracks.append({
            "title": title,
            "artist": artist,
            "audio_url": audio_url,
            "cover_url": cover_url,
            "has_cover": bool(cover_url),
        })

    lines.append("```")
    return "\n".join(lines), tracks


def render_config(args):
    """把生效的配置项整理成一个面板。"""
    if not _HAS_RICH:
        return
    rows = [
        ("标题", args.title or "[dim]（默认：本地音乐）[/dim]"),
        ("播放模式", args.mode),
        ("皮肤", args.theme or "[dim]（默认）[/dim]"),
        ("自动播放", "[green]是[/green]" if args.autoplay else "[dim]否[/dim]"),
        ("文件名顺序", args.order),
        ("分隔符", "[cyan]%r[/cyan]" % args.sep),
    ]
    if args.audio_base is not None:
        rows.append(("audioBase", args.audio_base or "[dim]（空）[/dim]"))
    if args.cover_base is not None:
        rows.append(("coverBase", args.cover_base or "[dim]（空）[/dim]"))

    grid = Table.grid(padding=(0, 2))
    grid.add_column(justify="right", style="bold")
    grid.add_column()
    for k, v in rows:
        grid.add_row(k, str(v))
    _console.print(Panel(grid, title="⚙ 配置", border_style="cyan",
                         box=box.ROUNDED, expand=False))


def render_tracks(tracks):
    """把解析出的曲目列成一张表。"""
    if not _HAS_RICH:
        return
    table = Table(title="🎵 曲目预览", box=box.ROUNDED,
                  header_style="bold magenta", title_style="bold")
    table.add_column("#", justify="right", style="dim")
    table.add_column("曲名", style="bold")
    table.add_column("歌手", style="green")
    table.add_column("封面", justify="center")
    table.add_column("音频路径", style="blue", overflow="fold")
    for i, t in enumerate(tracks, 1):
        table.add_row(
            str(i),
            t["title"],
            t["artist"] or "[dim]—[/dim]",
            "[green]✓[/green]" if t["has_cover"] else "[red]—[/red]",
            t["audio_url"],
        )
    _console.print(table)


def render_summary(tracks, dest):
    """收尾统计；写到文件时再附上代码块的语法高亮预览。"""
    n_files = len(tracks)
    n_cover = sum(t["has_cover"] for t in tracks)

    if not _HAS_RICH:
        if dest:
            sys.stderr.write("已写入 %s：%d 首歌曲，%d 个匹配到封面。\n"
                             % (dest, n_files, n_cover))
        else:
            sys.stderr.write("共 %d 首歌曲，%d 个匹配到封面。\n"
                             % (n_files, n_cover))
        return

    miss = n_files - n_cover
    msg = ("共 [bold]%d[/bold] 首歌曲，[bold green]%d[/bold green] 个匹配到封面"
           % (n_files, n_cover))
    msg += "。" if not miss else "，[yellow]%d 个缺封面[/yellow]。" % miss
    if dest:
        msg = "已写入 [bold]%s[/bold]\n%s" % (dest, msg)
    _console.print(Panel(msg, title="✓ 完成", border_style="green",
                         box=box.ROUNDED, expand=False))


def render_help(parser):
    """打印帮助。装了 rich 就用面板 / 表格美化，否则退回原始 docstring。"""
    if not _HAS_RICH:
        sys.stdout.write(__doc__)
        return

    out = Console()  # 帮助是主输出，走 stdout

    out.print(Panel.fit(
        "[bold cyan]gen-music-block.py[/bold cyan]\n"
        "扫描音频目录，自动生成 docsify-music-player 可用的 "
        "[magenta]```music[/magenta] 代码块。",
        border_style="cyan", box=box.ROUNDED))

    out.print("\n[bold]用法[/bold]")
    out.print("  [green]python gen-music-block.py[/green] "
              "[cyan]<音频目录>[/cyan] [dim][选项][/dim]\n")

    # 选项表从 argparse 解析器派生，自动与实际参数保持一致。
    opts = Table(box=box.SIMPLE_HEAD, header_style="bold magenta",
                 title="选项", title_style="bold", title_justify="left")
    opts.add_column("参数", style="cyan", no_wrap=True)
    opts.add_column("说明")
    opts.add_column("默认 / 可选", style="dim")
    for act in parser._actions:
        names = ", ".join(act.option_strings) if act.option_strings else act.dest
        extra = ""
        if act.choices:
            extra = " | ".join(str(c) if c != "" else "(空)" for c in act.choices)
        elif isinstance(act, argparse._StoreTrueAction):
            extra = "flag"
        elif act.default not in (None, "", argparse.SUPPRESS):
            extra = str(act.default)
        opts.add_row(names, act.help or "", extra)
    out.print(opts)

    out.print(Panel(Syntax(EXAMPLES, "bash", theme="ansi_dark",
                           background_color="default"),
                    title="示例", border_style="green", box=box.ROUNDED))

    notes = (
        "[bold]文件名解析[/bold]：去扩展名后按 --sep（默认 \"-\"）拆出 曲名/歌手；"
        "--order 控制先后；无分隔符时整名作曲名。\n"
        "[bold]封面匹配[/bold]：默认在音频同目录找同名图片，匹配不到则该行不写封面。\n"
        "[bold]路径生成[/bold]：默认写 <前缀>/<文件名>；提供 --audio-base / --cover-base "
        "时改输出 base 配置行，曲目行只写文件名。\n"
        "[bold]输出[/bold]：```music 代码块默认写入 <音频目录>/playlist.md（-o 改文件名），"
        "终端只显示配置 / 曲目表 / 统计，加 --preview 才打印代码块。装了 "
        "[cyan]rich[/cyan] 显示彩色表格，没装自动降级为纯文本。"
    )
    out.print(Panel(notes, title="说明", border_style="dim", box=box.ROUNDED))


def main():
    p = argparse.ArgumentParser(
        prog="gen-music-block.py",
        description="扫描音频目录，生成 docsify-music-player 的 ```music 代码块。",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        add_help=False,  # 自己接管 -h/--help，统一走 rich 美化的帮助。
    )
    p.add_argument("-h", "--help", action="store_true", dest="show_help",
                   help="显示本帮助并退出")
    p.add_argument("directory", nargs="?", help="要扫描的音频目录")
    p.add_argument("--title", default="", help="播放器标题（默认不写，前端用「本地音乐」）")
    p.add_argument("--mode", default="listLoop",
                   choices=["sequence", "listLoop", "single", "shuffle"],
                   help="播放模式，默认 listLoop")
    p.add_argument("--theme", default="",
                   choices=["", "auto", "light", "dark"],
                   help="皮肤，默认不写")
    p.add_argument("--autoplay", action="store_true", help="加上则写 autoplay: true")

    p.add_argument("--sep", default="-", help='文件名里 曲名/歌手 的分隔符，默认 "-"')
    p.add_argument("--order", default="title-artist",
                   choices=["title-artist", "artist-title"],
                   help="文件名里 曲名 与 歌手 的先后顺序，默认 title-artist")

    p.add_argument("--cover-dir", default="", help="封面图所在目录，默认与音频同目录")
    p.add_argument("--prefix", default=None,
                   help="曲目行音频路径前缀，默认用传入目录；设为空字符串只写文件名")
    p.add_argument("--cover-prefix", default=None,
                   help="曲目行封面路径前缀，默认用封面目录")
    p.add_argument("--audio-base", default="_media/music", dest="audio_base",
                   help="audioBase 配置行的基础目录，默认 _media/music；曲目行只写文件名。"
                        "设为空字符串则不写 base、曲目行写完整路径")
    p.add_argument("--cover-base", default=None, dest="cover_base",
                   help="coverBase 配置行的基础目录，默认跟随 --audio-base")

    p.add_argument("-o", "--output", default="",
                   help="输出 md 文件路径，默认 <音频目录>/playlist.md")
    p.add_argument("-p", "--preview", action="store_true",
                   help="额外在终端打印 ```music 代码块内容（默认只写文件、不展示）")

    args = p.parse_args()

    # 不带参数，或显式 -h/--help：打印（rich 美化的）帮助并退出。
    if args.show_help or args.directory is None:
        render_help(p)
        return

    # coverBase 默认跟随 audioBase（封面与音频通常放在同一目录）。
    if args.cover_base is None:
        args.cover_base = args.audio_base
    # 空字符串表示「不启用 base」：不写 base 配置行、曲目行写完整路径。
    if args.audio_base == "":
        args.audio_base = None
    if args.cover_base == "":
        args.cover_base = None

    block, tracks = build_block(args)

    render_config(args)
    render_tracks(tracks)

    # 默认只写入 md 文件、不把代码块打印到终端；-o 可覆盖文件名。
    out_path = args.output or os.path.join(args.directory, "playlist.md")
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(block + "\n")

    # 需要在终端核对时，才用 --preview 打印代码块内容。
    if args.preview and _HAS_RICH:
        _console.print(Panel(Syntax(block, "markdown",
                                    theme="ansi_dark", word_wrap=True),
                             title="📄 预览", border_style="dim",
                             box=box.ROUNDED))

    render_summary(tracks, out_path)


if __name__ == "__main__":
    main()
