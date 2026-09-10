# -*- coding: utf-8 -*-
# 生成吉祥物内嵌资产 -> mascot.js + build.js 用的 CSS 背景图（--mm-fig / --mm-sit）
from PIL import Image, ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True  # 点赞那张源文件截断，容错读取
import base64, os

mascot = r'D:/WorkBuddy/2026-09-05-03-13-43/outputs/mascot'

def chibi(src, width):
    im = Image.open(mascot + '/' + src)
    r = width / im.width
    return im.resize((width, int(im.height * r)), Image.LANCZOS)

def b64webp(im, name, q=82):
    im.save(name, 'WEBP', quality=q, method=6)
    n = os.path.getsize(name)
    print(name, im.size, n)
    return base64.b64encode(open(name, 'rb').read()).decode()

# 真站姿（莉莉安_MainArt，941x1672 全身）：按高度缩放到 1400（欢迎屏角色卡 + 梦幻层背景共用）
im = Image.open(mascot + '/梦梦-立绘-站姿.png')
r = 1400 / im.height
imf = im.resize((int(im.width * r), 1400), Image.LANCZOS)
f = b64webp(imf, 'mascot-figure.webp', 80)

# 站姿梦幻层背景：整幅（cover 取景时自然聚焦人物），宽 1100 足够 2K 屏
w, h0 = im.size
fig = im.resize((1100, int(h0 * 1100 / w)), Image.LANCZOS)
fig = b64webp(fig, 'mascot-figtop.webp', 80)

# 坐姿：弹窗整幅背景用
sit = Image.open(mascot + '/梦梦-坐姿.png')
sit = sit.resize((720, int(sit.height * 720 / sit.width)), Image.LANCZOS)
s = b64webp(sit, 'mascot-sit.webp', 80)

h = b64webp(chibi('梦梦-比心.png', 230), 'mascot-heart.webp')
j = b64webp(chibi('梦梦-跳跃.png', 260), 'mascot-jump.webp')
t = b64webp(chibi('梦梦-思考.png', 230), 'mascot-think.webp')
l = b64webp(chibi('梦梦-点赞.png', 230), 'mascot-like.webp')

js = ('/* mascot.js —— 吉祥物「镜梦菱（梦梦）」内嵌资产（webp base64） */\n'
      'var MASCOT={figure:"data:image/webp;base64,' + f +
      '",heart:"data:image/webp;base64,' + h +
      '",jump:"data:image/webp;base64,' + j +
      '",think:"data:image/webp;base64,' + t +
      '",like:"data:image/webp;base64,' + l + '"};\n')
open('mascot.js', 'w').write(js)
print('mascot.js', os.path.getsize('mascot.js'))

