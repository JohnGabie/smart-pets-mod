#!/usr/bin/env python3
"""Generates original 16x16 pixel-art tiles as SVG (deterministic). Output: site/assets/img/*.svg"""
import random, pathlib
OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "img"
OUT.mkdir(parents=True, exist_ok=True)

def tile(name, base, shades, seed, density=0.35, overlay=None):
    rnd = random.Random(seed)
    rects = [f'<rect width="16" height="16" fill="{base}"/>']
    for y in range(16):
        for x in range(16):
            if rnd.random() < density:
                rects.append(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{rnd.choice(shades)}"/>')
    if overlay:
        rects += overlay(rnd)
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" '
           'shape-rendering="crispEdges">' + "".join(rects) + "</svg>")
    (OUT / f"{name}.svg").write_text(svg)

tile("dirt", "#866043", ["#6e4d34", "#9a7150", "#5a3f2a", "#7a5738"], 1)
tile("stone", "#7f7f7f", ["#6c6c6c", "#8f8f8f", "#5e5e5e", "#9b9b9b"], 2)
tile("deepslate", "#3a3a3f", ["#2f2f34", "#46464c", "#26262a"], 3, 0.4)
tile("planks", "#a07c4a", ["#8d6b3c", "#b48c58"], 4, 0.15,
     lambda r: [f'<rect x="0" y="{y}" width="16" height="1" fill="#6f522d"/>' for y in (0, 5, 10, 15)])

def grass_overlay(rnd):
    out = ['<rect width="16" height="4" fill="#5d9b3a"/>']
    for x in range(16):
        h = 4 + (1 if rnd.random() < 0.5 else 0) + (1 if rnd.random() < 0.2 else 0)
        out.append(f'<rect x="{x}" y="0" width="1" height="{h}" fill="#5d9b3a"/>')
        if rnd.random() < 0.5:
            out.append(f'<rect x="{x}" y="{rnd.randint(0,3)}" width="1" height="1" fill="#7cbd45"/>')
    return out
tile("grass-side", "#866043", ["#6e4d34", "#9a7150", "#5a3f2a"], 5, 0.3, grass_overlay)
print("tiles written to", OUT)
