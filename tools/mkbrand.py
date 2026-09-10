# -*- coding: utf-8 -*-
"""生成品牌形象标准图（透明底）：菱形玻璃 logo + 艺术字「筑梦之境」+ Dreamwright。
产出 outputs/brand/筑梦之境-品牌图.svg （PNG 由 Playwright 从 SVG 转）
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from mkwordmark import build

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'brand'))
os.makedirs(OUT, exist_ok=True)

r = build('SourceHanSerifCN-Light.otf', 'serifLight')

W, H = 800, 600
LOGO_S = 240 / 56.0          # logo 放大到 240
LOGO_TX, LOGO_TY = (W - 240) / 2, 36
WM_S = 470 / float(r['w'])   # 艺术字宽 470
WM_H = r['h'] * WM_S
WM_TX, WM_TY = (W - 470) / 2, 348

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
  <defs>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#CFD2FF" stop-opacity=".5"/>
      <stop offset=".48" stop-color="#6E72FF" stop-opacity=".2"/>
      <stop offset="1" stop-color="#7FD4FF" stop-opacity=".38"/>
    </linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity=".9"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="glow">
      <stop offset="0" stop-color="#6E72FF" stop-opacity=".55"/>
      <stop offset="1" stop-color="#6E72FF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="wmg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset=".52" stop-color="#D3D6FF"/>
      <stop offset="1" stop-color="#8ECCFF"/>
    </linearGradient>
  </defs>

  <!-- 菱形玻璃镜片 -->
  <g transform="translate({LOGO_TX:.0f},{LOGO_TY:.0f}) scale({LOGO_S:.4f})">
    <circle cx="28" cy="28" r="26" fill="url(#glow)"/>
    <path d="M28 3 L53 28 L28 53 L3 28 Z" fill="url(#glass)" stroke="#FFFFFF" stroke-opacity=".9" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M28 3 L3 28 L28 28 Z" fill="#FFFFFF" opacity=".30"/>
    <path d="M28 3 L53 28 L28 28 Z" fill="#FFFFFF" opacity=".13"/>
    <path d="M3 28 L28 53 L28 28 Z" fill="#6E72FF" opacity=".28"/>
    <path d="M53 28 L28 53 L28 28 Z" fill="#7FD4FF" opacity=".17"/>
    <path d="M28 3 L28 53 M3 28 L53 28" fill="none" stroke="#FFFFFF" stroke-opacity=".26" stroke-width=".9"/>
    <path d="M15.5 20.5 L29 7 L34.5 7 L21 20.5 Z" fill="url(#shine)"/>
    <circle cx="28" cy="28" r="7" fill="#6E72FF" opacity=".32"/>
    <circle cx="28" cy="28" r="2.8" fill="#FFFFFF"/>
  </g>

  <!-- 艺术字 · 筑梦之境 -->
  <g transform="translate({WM_TX:.0f},{WM_TY:.0f}) scale({WM_S:.5f})">
    <path d="{r['d']}" fill="url(#wmg)"/>
  </g>

  <!-- 英文名 -->
  <text x="{W / 2}" y="{WM_TY + WM_H + 46:.0f}" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif" font-size="21" fill="#9DA1C4"
        letter-spacing="10">DREAMWRIGHT</text>
</svg>
'''

p = os.path.join(OUT, 'brand.svg')
open(p, 'w', encoding='utf-8').write(svg)
print('->', p, os.path.getsize(p) // 1024, 'KB')
