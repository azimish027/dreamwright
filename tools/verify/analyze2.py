# -*- coding: utf-8 -*-
"""稳健的像素对比度判定（纯 PIL，不用 numpy）：
bg 取众数簇；文字取「最亮 0.5%」与「最暗 0.5%」中离 bg 更远的那个。"""
import json, os, collections
from PIL import Image

os.chdir(os.path.dirname(os.path.abspath(__file__)))
data = json.load(open('audit.json', encoding='utf-8'))

def lum(p):
    def f(v):
        v /= 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2])

def contrast(a, b):
    L1, L2 = lum(a), lum(b)
    hi, lo = max(L1, L2), min(L1, L2)
    return (hi + 0.05) / (lo + 0.05)

res = []
for it in data:
    try:
        im = Image.open(it['img']).convert('RGB')
        box = (int(it['x'] * 2), int(it['y'] * 2),
               int((it['x'] + it['w']) * 2), int((it['y'] + it['h']) * 2))
        if box[2] - box[0] < 8 or box[3] - box[1] < 8:
            continue
        px = list(im.crop(box).getdata())
        if len(px) < 40:
            continue
        # 量化众数作为背景
        q = collections.Counter((p[0] // 12, p[1] // 12, p[2] // 12) for p in px)
        mk, mc = q.most_common(1)[0]
        near = [p for p in px if abs(p[0] // 12 - mk[0]) <= 1 and abs(p[1] // 12 - mk[1]) <= 1 and abs(p[2] // 12 - mk[2]) <= 1]
        bg = tuple(sum(c[i] for c in near) / len(near) for i in range(3))
        s = sorted(px, key=lum)
        k = max(1, len(px) // 200)
        dark = tuple(sum(c[i] for c in s[:k]) / k for i in range(3))
        light = tuple(sum(c[i] for c in s[-k:]) / k for i in range(3))
        dd = sum(abs(dark[i] - bg[i]) for i in range(3))
        dl = sum(abs(light[i] - bg[i]) for i in range(3))
        txt = light if dl > dd else dark
        if max(dl, dd) < 24:
            continue
        rt = contrast(txt, bg)
        large = it['fs'] >= 24 or (it['fs'] >= 18.66 and it['fw'] >= 700)
        mn = 3.0 if large else 4.5
        res.append((round(rt, 2), mn, it['fs'], it['fw'],
                    ','.join(str(int(v)) for v in txt), ','.join(str(int(v)) for v in bg),
                    it['t'], it['p'], it['img']))
    except Exception:
        pass

bad = [r for r in res if r[0] < r[1]]
bad.sort(key=lambda r: r[0])
seen = set()
print('=== 采样 %d，不达标 %d ===' % (len(res), len(bad)))
for r in bad:
    sig = (r[4], r[5])
    if sig in seen:
        continue
    seen.add(sig)
    print('  %5.2f(min%.1f) %s/%s fg=%s bg=%s "%s"  %s  [%s]' % (
        r[0], r[1], r[2], r[3], r[4], r[5], r[6][:16], r[7][-78:], r[8]))
