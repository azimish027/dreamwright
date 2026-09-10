# -*- coding: utf-8 -*-
"""梦梦字体系统子集化 -> woff2 -> base64 -> tools/fonts2.js
- 乐米小奶泡体  = 正文（轻软可爱，长文可读）
- 乐米元气团团体 = 标题/按钮/梦梦台词（圆润粗体）
- 泰拉瑞姆像素体 = 数字/英文/版本号点缀
字集与 subfont.py 完全一致（字频 top3500 + 界面汉字 + 符号 + ASCII），
缺字自动回落思源黑体（font stack 兜底），不会出现空白方块。
"""
import os, re, base64, sys
from fontTools import subset
from wordfreq import zipf_frequency

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))   # outputs/
FONTS2 = os.path.join(ROOT, 'fonts_new')
SRC = os.path.join(ROOT, 'ipstudio-p2', 'src')

def gb2312_range(hi_lo, hi_hi):
    out = set()
    for hi in range(hi_lo, hi_hi + 1):
        for lo in range(0xA1, 0xFF):
            try:
                out.add(bytes([hi, lo]).decode('gb2312'))
            except Exception:
                pass
    return out

def source_chars():
    out = set()
    if os.path.isdir(SRC):
        for fn in os.listdir(SRC):
            if fn.endswith('.js'):
                try:
                    txt = open(os.path.join(SRC, fn), encoding='utf-8').read()
                    out |= set(re.findall(r'[\u4e00-\u9fff]', txt))
                except Exception:
                    pass
    return out

def symbols():
    s = set()
    for hi in range(0xA1, 0xAA):
        for lo in range(0xA1, 0xFF):
            try:
                s.add(bytes([hi, lo]).decode('gb2312'))
            except Exception:
                pass
    for c in range(0x20, 0x7F):
        s.add(chr(c))
    for c in '·…—‘’“”《》〈〉【】〔〕、，。！？；：%℃×÷→←↑↓§№✓':
        s.add(c)
    s.discard('\x00')
    return s

def build_charset(top_n=3500):
    han1 = gb2312_range(0xB0, 0xD7)
    han2 = gb2312_range(0xD8, 0xF7)
    src = source_chars()
    scored = sorted(han1 | han2, key=lambda c: zipf_frequency(c, 'zh'), reverse=True)
    base = set(scored[:top_n]) | src
    return ''.join(sorted((base | symbols()) - {'\x00'}))

def run(src_path, out_name, text, label):
    out_path = os.path.join(HERE, out_name)
    opt = subset.Options()
    opt.flavor = 'woff2'
    opt.name_IDs = ['*']
    opt.name_languages = ['*']
    opt.layout_features = ['*']
    opt.notdef_outline = True
    font = subset.load_font(src_path, opt)
    ss = subset.Subsetter(opt)
    ss.populate(text=text)
    ss.subset(font)
    subset.save_font(font, out_path, opt)
    kb = os.path.getsize(out_path) // 1024
    print('%s -> %s (%d KB)' % (label, out_name, kb))
    from fontTools.ttLib import TTFont as _T
    ck = _T(out_path).getBestCmap()
    miss = []
    for sample in ['筑梦之境梦梦陪你写字逻辑体检打卡统计模板库企划世界观',
                   '深夜他推开那扇锈蚀的铁门，风裹着尘埃涌出来',
                   '还没有企划哦好久不见欢迎回来同步成功']:
        miss += [c for c in sample if ord(c) > 127 and ord(c) not in ck]
    if miss:
        print('  !! 缺字(将回落思源黑体): %s' % ''.join(dict.fromkeys(miss)))
    else:
        print('  ✔ 全覆盖')
    return base64.b64encode(open(out_path, 'rb').read()).decode()

def main():
    text_full = build_charset(3500)
    print('charset full: %d glyphs' % len(text_full))
    text_ui = build_charset(1200)          # 标题字体只承担界面字+高频字，省 1MB
    print('charset ui:   %d glyphs' % len(text_ui))
    np = run(os.path.join(FONTS2, '乐米小奶泡体.ttf'), 'mm-naipao.woff2', text_full, '小奶泡(正文)')
    yq = run(os.path.join(FONTS2, '乐米元气团团体.ttf'), 'mm-yuanqi.woff2', text_ui, '元气团(标题)')
    px = run(os.path.join(FONTS2, '泰拉瑞姆像素体.otf'), 'mm-pixel.woff2', text_full, '像素(点缀)')
    js = ('/* fonts2.js —— 梦梦字体系统（子集 woff2 base64）*/\n'
          'window.__FONTS2__={naipao:"%s",yuanqi:"%s",pixel:"%s"};\n' % (np, yq, px))
    with open(os.path.join(HERE, 'fonts2.js'), 'w', encoding='utf-8') as f:
        f.write(js)
    print('fonts2.js: %d KB' % (os.path.getsize(os.path.join(HERE, 'fonts2.js')) // 1024))

if __name__ == '__main__':
    main()
