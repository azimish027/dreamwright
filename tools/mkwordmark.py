# -*- coding: utf-8 -*-
"""
把「筑梦之境」四字从思源宋体提取为 SVG 轮廓路径（艺术字底稿）。
产出：tools/wordmark.js  ——  内含 WM_PATHS(单字 path) / WM(整条合成 path) / 尺寸常量。
坐标：字体 upem=1000，y 轴向上；输出时统一翻转成 SVG 的 y 向下，并归一化到 viewBox。
用法： python mkwordmark.py [字体文件名] [标签]
"""
import os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.misc.transform import Transform

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))  # outputs
TEXT = '筑梦之境'
TRACK = 40          # 字间距（字体单位，1000 = 1em）
ASC, DESC = 880, -120   # 取字范围，裁掉多余空白


def load(fn):
    return TTFont(os.path.join(ROOT, fn))


def glyph_paths(font, text, track):
    """返回 [(char, path_d, advance)] 与整体墨迹尺寸。
    坐标：翻转 y 轴（SVG 向下为正），再整体平移使墨迹左上角落在 (0,0)。"""
    gs = font.getGlyphSet()
    cm = font.getBestCmap()
    raw = []
    x = 0
    miny, maxy = 1e9, -1e9
    for ch in text:
        gname = cm.get(ord(ch))
        if not gname:
            print('!! 缺字', ch)
            continue
        bp = BoundsPen(gs)
        gs[gname].draw(bp)
        if bp.bounds is None:
            continue
        x0, y0, x1, y1 = bp.bounds
        miny = min(min(miny, -y1), -y1)
        maxy = max(maxy, -y0)
        raw.append([ch, gname, x0, x1])
        x += (x1 - x0) + track
    total_w = x - track
    h = maxy - miny
    out, cx = [], 0
    for ch, gname, x0, x1 in raw:
        t = Transform(1, 0, 0, -1, cx - x0, -miny)
        pen = SVGPathPen(gs)
        gs[gname].draw(TransformPen(pen, t))
        out.append((ch, pen.getCommands(), (x1 - x0) + track))
        cx += (x1 - x0) + track
    return out, total_w, h


def build(fn, label):
    try:
        font = load(fn)
    except Exception as e:
        print('!! 跳过 %s（%s）' % (fn, str(e)[:60]))
        return None
    upem = font['head'].unitsPerEm
    items, total_w, H = glyph_paths(font, TEXT, TRACK)
    if not items:
        print('!! 没有产出', label)
        return
    d_all = ' '.join(p for _, p, _ in items if p)
    print('%s: 宽 %d  高 %d  (0 0 %d %d)' % (label, total_w, H, total_w, H))
    return {
        'label': label, 'd': d_all,
        'w': total_w, 'h': H, 'upem': upem,
        'items': [(c, p) for c, p, _ in items]
    }


def emit(results):
    """写成 JS 常量文件"""
    lines = ['/* 自动生成 · 筑梦之境 艺术字轮廓（思源宋体，SIL OFL 免费商用） */',
             '/* 由 tools/mkwordmark.py 生成，勿手改 */',
             'var WM_SET = {};']
    for r in results:
        if not r:
            continue
        lines.append('WM_SET[%s] = {' % repr(r['label']))
        lines.append('  w: %d, h: %d,' % (r['w'], r['h']))
        lines.append("  d: '%s'," % r['d'].replace("\\", "\\\\").replace("'", "\\'"))
        lines.append('  chars: [')
        for c, p in r['items']:
            lines.append("    ['%s', '%s']," % (c, p.replace("\\", "\\\\").replace("'", "\\'")))
        lines.append('  ]')
        lines.append('};')
    p = os.path.join(os.path.dirname(__file__), 'wordmark.js')
    open(p, 'w', encoding='utf-8').write('\n'.join(lines))
    print('-> %s (%d KB)' % (os.path.basename(p), os.path.getsize(p) // 1024))


# ---------------- 内容区隐形品牌水印 ----------------
# 实心菱形剪影（上）+ 艺术字（下），整体作为 .content::before 的背景
DIAMOND = 'M28 3 L53 28 L28 53 L3 28 Z'
WM_W = 240          # 艺术字目标宽度
CW, CH = 400, 286   # 水印画布


def emit_watermark(r):
    if not r:
        return
    s = WM_W / float(r['w'])
    wh = r['h'] * s
    tx = (CW - WM_W) / 2.0
    ty = 196
    logo_s = 96 / 56.0
    svg = (
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 %d %d'>"
        "<g fill='%%23B9BCFF'>"
        "<path d='%s' transform='translate(152,26) scale(%s)'/>"
        "<path d='%s' transform='translate(%s,%s) scale(%s)'/>"
        "</g></svg>"
    ) % (CW, CH, DIAMOND, round(logo_s, 4), r['d'], round(tx, 2), ty, round(s, 5))
    # data URI 编码
    try:
        from urllib.parse import quote
        enc = quote(svg, safe="")
    except Exception:
        enc = svg.replace('#', '%23').replace('<', '%3C').replace('>', '%3E').replace('"', '%22')
    css = (
        "/* 内容区隐形品牌水印（自动生成） */\n"
        ".content{position:relative;isolation:isolate}\n"
        ".content::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;\n"
        "  background:url(\"data:image/svg+xml,%s\") center 46%%/340px auto no-repeat;\n"
        "  opacity:.13}\n"
    ) % enc
    p = os.path.join(os.path.dirname(__file__), 'watermark.css')
    open(p, 'w', encoding='utf-8').write(css)
    print('-> %s (%d KB)' % (os.path.basename(p), os.path.getsize(p) // 1024))


if __name__ == '__main__':
    jobs = []

    def safe(fn, label):
        try:
            return build(fn, label)
        except Exception as e:
            print('!! 跳过 %s（%s）' % (fn, str(e)[:70]))
            return None

    jobs.append(safe('SourceHanSerifCN-Light.otf', 'serifLight'))
    sb = os.path.join(ROOT, 'SourceHanSerifSC-SemiBold.otf')
    if os.path.exists(sb) and os.path.getsize(sb) > 1000000:
        jobs.append(safe('SourceHanSerifSC-SemiBold.otf', 'serifSemi'))
    jobs = [j for j in jobs if j]
    emit(jobs)
    emit_watermark(jobs[0])
