#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen-music-block.py —— 扫描某个目录里的音频文件，自动生成 docsify-music-player
可用的 ```music 代码块，直接粘进 markdown 文章即可。

不带参数运行（或加 -h / --help）会打印本帮助。

用法:
    python gen-music-block.py <音频目录> [选项]

示例:
    # 扫描 docs/_media/music 下的音频，路径原样写进每一行
    python gen-music-block.py docs/_media/music

    # 把公共前缀抽成 audioBase / coverBase 配置行，曲目行只写文件名
    python gen-music-block.py docs/_media/music \\
        --audio-base _media/music --cover-base _media/covers

    # 文件名是「歌手 - 曲名」的顺序，并指定标题、播放模式
    python gen-music-block.py ./music --order artist-title \\
        --title 我的歌单 --mode shuffle --autoplay

    # 直接写到文件
    python gen-music-block.py ./music -o playlist.md

文件名解析:
    脚本会去掉扩展名，按分隔符（默认 "-"）拆出 曲名 和 歌手。
        不如见一面-海来阿木&单依纯.mp3  →  不如见一面 | 海来阿木&单依纯
    --order title-artist (默认) 表示「曲名在前」；artist-title 表示「歌手在前」。
    文件名里没有分隔符时，整个名字当作曲名，歌手留空。
    用 --sep 改分隔符（例如 " - "）。

封面匹配:
    默认在音频同目录里找同名图片（.jpg/.jpeg/.png/.webp/.gif）。
    用 --cover-dir 指定单独的封面目录。匹配不到则该行不写封面（前端用占位图）。

路径生成:
    - 默认把「曲目行的路径」写成  <前缀>/<文件名>，前缀默认就是你传入的音频目录。
      用 --prefix 覆盖这个前缀（设为空字符串则只写文件名）。
    - 若提供 --audio-base / --cover-base，则改为输出 audioBase / coverBase 配置行，
      曲目行里只写文件名，由前端自动拼接。封面同理用 --cover-base。
"""

import argparse
import os
import re
import sys

AUDIO_EXTS = (".mp3", ".m4a", ".flac", ".ogg", ".oga", ".opus", ".wav", ".aac")
COVER_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp")


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
        sys.exit("错误: 目录不存在 -> %s" % audio_dir)

    cover_dir = args.cover_dir or audio_dir

    files = [f for f in os.listdir(audio_dir)
             if os.path.isfile(os.path.join(audio_dir, f))
             and os.path.splitext(f)[1].lower() in AUDIO_EXTS]
    files.sort(key=natural_key)

    if not files:
        sys.exit("错误: 目录里没有找到音频文件 (%s)" % ", ".join(AUDIO_EXTS))

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
    n_cover = 0
    for f in files:
        stem, _ = os.path.splitext(f)
        title, artist = parse_filename(stem, args.sep, args.order)

        if args.audio_base is not None:
            audio_url = f                       # 由前端拼接 audioBase
        else:
            audio_url = join_url(audio_prefix, f)

        cover_file = find_cover(stem, cover_dir)
        if cover_file:
            n_cover += 1
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

    lines.append("```")
    return "\n".join(lines), len(files), n_cover


def main():
    # 不带任何参数时，打印帮助并退出（与项目里其他脚本一致）。
    if len(sys.argv) == 1:
        sys.stdout.write(__doc__)
        return

    p = argparse.ArgumentParser(
        prog="gen-music-block.py",
        description="扫描音频目录，生成 docsify-music-player 的 ```music 代码块。",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("directory", help="要扫描的音频目录")
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
    p.add_argument("--audio-base", default=None, dest="audio_base",
                   help="输出 audioBase 配置行，曲目行只写音频文件名")
    p.add_argument("--cover-base", default=None, dest="cover_base",
                   help="输出 coverBase 配置行，曲目行只写封面文件名")

    p.add_argument("-o", "--output", default="", help="写入文件，默认打印到标准输出")

    args = p.parse_args()

    block, n_files, n_cover = build_block(args)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as fh:
            fh.write(block + "\n")
        sys.stderr.write("已写入 %s：%d 首歌曲，%d 个匹配到封面。\n"
                         % (args.output, n_files, n_cover))
    else:
        print(block)
        sys.stderr.write("共 %d 首歌曲，%d 个匹配到封面。\n" % (n_files, n_cover))


if __name__ == "__main__":
    main()
