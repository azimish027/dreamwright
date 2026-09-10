# -*- coding: utf-8 -*-
"""思源字体按字频子集化 -> woff2 -> base64
字集 = GB2312一级/二级候选 按中文真实字频取 top N ∪ 源码界面汉字 ∪ 符号 ∪ ASCII
用法: python subfont.py
产出: outputs/fonts/subset-*.woff2 与 outputs/fonts/fonts_b64.js
"""
import os, re, base64, sys
from fontTools import subset

PY = r"C:/Users/13458/.workbuddy/binaries/python/versions/3.13.12/python.exe"
sys.path  # noqa
from wordfreq import zipf_frequency

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))  # outputs/
FONTS = os.path.join(ROOT, 'fonts')
SRC = os.path.join(ROOT, 'ipstudio-p2', 'src')
os.makedirs(FONTS, exist_ok=True)

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

def top_by_freq(han, n):
    scored = sorted(han, key=lambda c: zipf_frequency(c, 'zh'), reverse=True)
    return set(scored[:n])

def build_charset(han_cands, top_n):
    src = source_chars()
    base = top_by_freq(han_cands - src, top_n)  # 字频名额优先分配给源码未覆盖的字
    base |= src                                  # 源码界面汉字全数兜底
    return (base | symbols()) - {'\x00'}

def run(src_path, out_path, text, label):
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
    print('%s -> %s (%d KB / %d chars)' % (label, os.path.basename(out_path), os.path.getsize(out_path) // 1024, len(text)))
    # 校验关键示例是否覆盖（cmap 键为 int 码点）
    from fontTools.ttLib import TTFont as _T
    _ck = _T(out_path).getBestCmap()
    miss = []
    for sample in ['IP创作工作台正式版世界观人物检索上传保存取消章节标记画布灵感逻辑',
                   '深夜他推开那扇锈蚀的铁门，风裹着尘埃涌出来，像一段被遗忘的序章',
                   '打卡统计模板库企划世界观人物主线剧情灵感捕捉自动同步云端']:
        miss += [c for c in sample if ord(c) > 127 and ord(c) not in _ck]
    if miss:
        print('  !! 缺字: %s' % ''.join(dict.fromkeys(miss)))
    else:
        print('  ✔ 校验：界面文案与示例正文全部覆盖')

def main():
    han1 = gb2312_range(0xB0, 0xD7)   # 一级 3755
    han2 = gb2312_range(0xD8, 0xF7)   # 二级 3008（备选池，生僻用）
    text = build_charset(han1 | han2, 3500)
    text = ''.join(sorted(text))
    print('charset total: %d glyphs' % len(text))
    sans_src = os.path.join(ROOT, 'SourceHanSansSC-Regular.otf')
    sans_out = os.path.join(FONTS, 'subset-sans.woff2')
    run(sans_src, sans_out, text, 'Sans')
    b64 = base64.b64encode(open(sans_out, 'rb').read()).decode()
    with open(os.path.join(FONTS, 'fonts_b64.js'), 'w', encoding='utf-8') as f:
        f.write('window.__FONT_B64__={sans:"%s",serif:null};' % b64)
    print('fonts_b64.js: %d KB (base64)' % (len(b64) // 1024))

if __name__ == '__main__':
    main()
