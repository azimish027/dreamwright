# -*- coding: utf-8 -*-
# 从用户提供的 UI 组件图裁切元素 -> uicomps.js（base64 webp）+ uic-*.webp
# v2：自动收紧 bbox —— 按 alpha / 离白度阈值找内容真实边界，杜绝"旁边一圈白"
from PIL import Image, ImageFile, ImageChops, ImageDraw
ImageFile.LOAD_TRUNCATED_IMAGES = True
import base64, os

SRC = r'D:/WorkBuddy/2026-09-05-03-13-43/outputs/uicomps/user'
OUT = r'D:/WorkBuddy/2026-09-05-03-13-43/outputs/ipstudio-p2/tools'

# name -> (source file, rough box in 2048 coords, target long-edge px[, bg_thresh])
# bg_thresh：泛洪去底阈值（源图白底与内容的色差容忍度），dlg 蕾丝娇贵用小值
CROPS = {
    # A：对话框面板 + 圆形X钮（配套）——蕾丝边柔和，阈值放低防吃边
    'dlg':      ('1788990191505.png', (1150,   40, 2048, 1120), 640, 20),
    'xbtn':     ('1788990191505.png', (1180, 1180, 2048, 1880), 200, 20),
    # B：方卡 / 云朵心 / 横幅 / 云朵
    'cardsq':   ('1788990255506.png', (   0,    0,  680,  760), 360, 10),
    'cloudheart':('1788990255506.png',(1450,   10, 1985,  290), 240, 10),
    'banner':   ('1788990255506.png', (1520,  400, 1985,  760), 280, 10),
    'cloud2':   ('1788990255506.png', (1560, 1685, 1985, 1910), 220, 10),
    # C：竖滑轨 / 横按钮条 / 心形面板 / 矩形小面板
    'vslider':  ('1788990297166.png', (  60,  380,  470, 1985), 300, 12),
    'hbtn':     ('1788990297166.png', (  30, 1670, 1420, 1960), 560, 12),
    'heartp':   ('1788990297166.png', (1440,  480, 1985, 1030), 320, 12),
    'rectp':    ('1788990297166.png', (1480,  980, 1985, 1530), 300, 12),
    # D：横按钮条2 / 竖蕾丝滑轨
    'hbtn2':    ('1788990341225.png', (  30, 1600, 1400, 1990), 560, 12),
    'vslider2': ('1788990341225.png', (1330,  120, 1830, 1990), 320, 12),
    # E：方卡2 / 翅膀心 / 分隔条 / 圆环翅膀 / 横滑条 / 竖长卡 / 小花
    'cardsq2':  ('1788990385462.png', (  70,  505,  485,  885), 340, 10),
    'wingheart':('1788990385462.png', (  90, 1190,  570, 1440), 260, 10),
    'divider':  ('1788990385462.png', (  30, 1390,  580, 1500), 300, 10),
    'ring':     ('1788990385462.png', (1490, 1090, 1950, 1395), 280, 10),
    'hslider':  ('1788990385462.png', (1420, 1790, 1940, 1900), 340, 10),
    'vtall':    ('1788990385462.png', (1500,   60, 1975,  990), 320, 10),
    'flower':   ('1788990385462.png', (1210, 1790, 1390, 1985), 120, 10),
    # 抠好的圆形天空蕾丝镜片（唤醒屏中心装饰）
    'sky':      ('uic-sky-cut.png',   (   0,    0, 2048, 2048), 520),
    # AI 抠好的方形华丽框（统计卡/关于页卡）
    'framecut': ('uic-framecut.png',  (   0,    0, 2048, 2048), 520),
}

SENTINEL = (255, 0, 255)  # （保留兼容）泛洪哨兵色

def strip_bg(im, thresh=40):
    """白底转透明：scipy 连通域标记——与图像边缘连通的近白区域 -> alpha 0。
    只吃与边缘连通的白底，云朵/贴纸内部的白色不受影响。
    thresh 控制近白判定（RGB 各通道离白的容忍度）。"""
    import numpy as np
    from scipy import ndimage
    rgb = np.asarray(im.convert('RGB'), dtype=np.int16)
    t = thresh
    near_white = (rgb.min(axis=2) > 255 - t*1.5) & \
                 ((rgb.max(axis=2) - rgb.min(axis=2)) < t)
    lbl, n = ndimage.label(near_white)
    border_ids = np.unique(np.concatenate([
        lbl[0, :], lbl[-1, :], lbl[:, 0], lbl[:, -1]]))
    border_ids = border_ids[border_ids != 0]
    bg = np.isin(lbl, border_ids)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    # 1px 腐蚀式羽化边缘：把背景边界一圈做半透明，贴图边缘不生硬
    edge = bg & ndimage.binary_dilation(~bg)
    alpha[edge] = 160
    out = im.convert('RGBA')
    out.putalpha(Image.fromarray(alpha, 'L'))
    return out

def tighten(part, a_thr=10, pad=3):
    """按 alpha 阈值收紧到内容真实边界，四周留 pad 像素"""
    mask = part.split()[3].point(lambda a: 255 if a > a_thr else 0)
    bb = mask.getbbox()
    if not bb:
        return part
    x0, y0, x1, y1 = bb
    x0 = max(0, x0 - pad); y0 = max(0, y0 - pad)
    x1 = min(part.width, x1 + pad); y1 = min(part.height, y1 + pad)
    return part.crop((x0, y0, x1, y1))

def crop_one(im, box, bg_thresh):
    part = im.crop(box)
    return tighten(part)

def main():
    imgs = {}
    entries = []
    total = 0
    for name, spec in CROPS.items():
        src, box, edge = spec[0], spec[1], spec[2]
        bg_thr = spec[3] if len(spec) > 3 else 40
        p = os.path.join(SRC, src)
        if not os.path.exists(p):
            print('SKIP(无源文件)', name, src); continue
        if src not in imgs:
            raw = Image.open(p).convert('RGBA')
            # 已有真透明（如预抠镜片）直接用；不透明白底图先泛洪去底
            a = raw.split()[3]
            if a.getextrema()[0] < 250:
                imgs[src] = raw
            else:
                imgs[src] = strip_bg(raw, bg_thr)
        part = crop_one(imgs[src], box, bg_thr)
        r = edge / max(part.size)
        if r < 1: part = part.resize((max(1,int(part.width*r)), max(1,int(part.height*r))), Image.LANCZOS)
        webp = os.path.join(OUT, 'uic-%s.webp' % name)
        part.save(webp, 'WEBP', quality=88, method=6)
        n = os.path.getsize(webp); total += n
        b64 = base64.b64encode(open(webp,'rb').read()).decode()
        entries.append('%s:"data:image/webp;base64,%s"' % (name, b64))
        print('%-10s %s edge=%d  %dKB' % (name, part.size, edge, n//1024))
    js = ('/* uicomps.js —— 用户提供的 Galgame 糖果系 UI 素材（webp base64，v2 自动收紧） */\n'
          'var UIC={%s};\n' % ','.join(entries))
    open(os.path.join(OUT, 'uicomps.js'), 'w').write(js)
    print('uicomps.js total %dKB' % ((total + len(js))//1024))

if __name__ == '__main__':
    main()
