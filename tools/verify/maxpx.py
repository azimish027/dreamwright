# -*- coding: utf-8 -*-
"""取指定元素区域内最亮/最暗像素，判断真实渲染色。"""
import json, os, sys, collections
from PIL import Image
os.chdir(os.path.dirname(os.path.abspath(__file__)))
data = json.load(open('audit.json', encoding='utf-8'))
keys = sys.argv[1].split('|')
n = 0
for it in data:
    if not any(k in it['p'] for k in keys):
        continue
    im = Image.open(it['img']).convert('RGB')
    box = (int(it['x'] * 2), int(it['y'] * 2), int((it['x'] + it['w']) * 2), int((it['y'] + it['h']) * 2))
    sub = im.crop(box)
    px = list(sub.getdata())
    def lum(p):
        return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]
    px.sort(key=lum, reverse=True)
    top = px[:max(1, len(px) // 200)]
    avg = tuple(int(sum(c[i] for c in top) / len(top)) for i in range(3))
    cnt = collections.Counter(px)
    print('%s "%s"  box=%dx%d  brightest1%%=%s  lum=%.0f  mode=%s' % (
        it['p'][-38:], it['t'][:10], sub.width, sub.height,
        ','.join(map(str, avg)), lum(avg), ','.join(map(str, cnt.most_common(1)[0][0]))))
    n += 1
    if n >= 8:
        break
