#!/usr/bin/env python3
"""Texture validator for entity/item/block PNGs (python3 stdlib + Pillow only).

usage: check-texture.py PNG [options]
  --size WxH            expected size in pixels (else taken from --model; else not checked)
  --model FILE          .bbmodel (Blockbench) or .geo.json (Bedrock/GeckoLib): UV islands and texture size
  --uv-json FILE        extra islands: JSON list of {"name": str, "rect": [x0, y0, x1, y1]} in texture pixels
  --alpha MODE          cutout (default: alpha only 0 or 255) | translucent (any alpha) | opaque (alpha 255 only)
  --allow-hole NAME     island that may be fully or partly transparent (repeatable; "element:face" or uv-json name)
  --allow-npot          do not fail on a side that is not a power of two
  --max-colors N        fail if the image has more than N distinct opaque colors
  --palette FILE        fail on any opaque pixel whose #rrggbb is not listed (one hex color per line, # comments)
  --json                print one JSON report instead of text lines
exit 0 = no errors (warnings allowed), 1 = errors, 2 = cannot read input, 64 = usage.

Checks: size; power of two; alpha mode; every UV island inside the texture; no transparent pixel inside an
island (except --allow-hole); painted pixels outside every island (warning); palette stats (distinct colors, top 8).
UV islands come from the model, never from the image: for a .bbmodel every enabled cube face `uv` (scaled from
the project resolution to the PNG size); for a .geo.json every cube (box UV from `uv` + `size`, or per-face UV).
"""
import argparse
import json
import sys
from collections import Counter

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    print("check-texture: Pillow is required (python3 -m pip install --user Pillow)", file=sys.stderr)
    sys.exit(2)

FACES = ("north", "east", "south", "west", "up", "down")


def box_uv_rects(size, u, v):
    """Box-UV face rectangles (x0, y0, x1, y1) for a cube of size (w, h, d) at offset (u, v)."""
    w, h, d = size
    return {
        "east": (u, v + d, u + d, v + d + h),
        "north": (u + d, v + d, u + d + w, v + d + h),
        "west": (u + d + w, v + d, u + 2 * d + w, v + d + h),
        "south": (u + 2 * d + w, v + d, u + 2 * d + 2 * w, v + d + h),
        "up": (u + d, v, u + d + w, v + d),
        "down": (u + d + w, v, u + d + 2 * w, v + d),
    }


def norm(rect):
    x0, y0, x1, y1 = (float(c) for c in rect)
    return (min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))


def islands_from_bbmodel(doc):
    """Returns (islands, (res_w, res_h)). Islands: list of (name, rect) in project-resolution units."""
    res = doc.get("resolution") or {}
    res_wh = (res.get("width", 16), res.get("height", 16))
    out = []
    for el in doc.get("elements", []):
        if el.get("type", "cube") != "cube":
            continue
        for face, data in (el.get("faces") or {}).items():
            if not isinstance(data, dict) or data.get("texture") is None or data.get("texture") is False:
                continue
            uv = data.get("uv")
            if uv and len(uv) == 4:
                x0, y0, x1, y1 = norm(uv)
                if x1 > x0 and y1 > y0:
                    out.append((f"{el.get('name', '?')}:{face}", (x0, y0, x1, y1)))
    return out, res_wh


def islands_from_geo(doc):
    geos = doc.get("minecraft:geometry") or []
    if not geos:
        raise ValueError("no minecraft:geometry in model")
    geo = geos[0]
    desc = geo.get("description", {})
    res_wh = (desc.get("texture_width", 16), desc.get("texture_height", 16))
    out = []
    for bone in geo.get("bones", []):
        for i, cube in enumerate(bone.get("cubes", [])):
            base = f"{bone.get('name', '?')}#{i}"
            uv = cube.get("uv")
            if isinstance(uv, list):
                size = [abs(float(s)) for s in cube.get("size", [0, 0, 0])]
                for face, r in box_uv_rects(size, float(uv[0]), float(uv[1])).items():
                    if r[2] > r[0] and r[3] > r[1]:
                        out.append((f"{base}:{face}", r))
            elif isinstance(uv, dict):
                for face, f in uv.items():
                    x, y = f["uv"]
                    sw, sh = f.get("uv_size", [0, 0])
                    x0, y0, x1, y1 = norm((x, y, x + sw, y + sh))
                    if x1 > x0 and y1 > y0:
                        out.append((f"{base}:{face}", (x0, y0, x1, y1)))
    return out, res_wh


def load_model(path):
    with open(path, encoding="utf-8") as fh:
        doc = json.load(fh)
    if "minecraft:geometry" in doc:
        return islands_from_geo(doc)
    if "elements" in doc or "meta" in doc:
        return islands_from_bbmodel(doc)
    raise ValueError("unknown model format (expected .bbmodel or .geo.json)")


def is_pot(n):
    return n > 0 and (n & (n - 1)) == 0


def is_hex6(text):
    return len(text) == 6 and all(c in "0123456789abcdefABCDEF" for c in text)


def load_palette(path):
    cols = set()
    with open(path, encoding="utf-8") as fh:
        for raw in fh:
            text = raw.split()[0] if raw.split() else ""  # first token; the rest of the line is a comment
            hexpart = text[1:] if text.startswith("#") else text
            if not text or (text.startswith("#") and not is_hex6(hexpart)):
                continue  # blank line or "# comment"
            if not is_hex6(hexpart):
                raise ValueError(f"bad palette entry: {text!r}")
            cols.add(tuple(int(hexpart[i:i + 2], 16) for i in (0, 2, 4)))
    return cols


def check(png, size=None, model=None, uv_json=None, alpha="cutout", allow_holes=(), allow_npot=False,
          max_colors=None, palette=None):
    """Returns a report dict: {ok, errors, warnings, stats}. Raises OSError/ValueError on unreadable input."""
    errors, warnings = [], []
    img = Image.open(png)
    has_alpha = img.mode in ("RGBA", "LA", "PA") or (img.mode == "P" and "transparency" in img.info)
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()

    islands, res_wh = [], None
    if model:
        islands, res_wh = load_model(model)
    scale = (w / res_wh[0], h / res_wh[1]) if res_wh else (1.0, 1.0)
    islands = [(n, (r[0] * scale[0], r[1] * scale[1], r[2] * scale[0], r[3] * scale[1])) for n, r in islands]
    if uv_json:
        with open(uv_json, encoding="utf-8") as fh:
            for item in json.load(fh):
                islands.append((item["name"], norm(item["rect"])))

    expected = size
    if expected is None and res_wh is not None:
        # a .bbmodel/.geo resolution is a UV space; the PNG may be an integer multiple of it
        if (w * res_wh[1]) != (h * res_wh[0]) or w % res_wh[0] or h % res_wh[1]:
            errors.append(f"size {w}x{h} does not match the model texture size {res_wh[0]}x{res_wh[1]} (or a multiple)")
    elif expected is not None and (w, h) != tuple(expected):
        errors.append(f"size {w}x{h} != expected {expected[0]}x{expected[1]}")
    if not (is_pot(w) and is_pot(h)):
        (warnings if allow_npot else errors).append(f"size {w}x{h} is not a power of two")
    if not has_alpha and alpha != "opaque":
        warnings.append("image has no alpha channel")

    alpha_counts = Counter()
    colors = Counter()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            alpha_counts["0" if a == 0 else "255" if a == 255 else "semi"] += 1
            if a > 0:
                colors[(r, g, b)] += 1
    if alpha == "cutout" and alpha_counts["semi"]:
        errors.append(f"{alpha_counts['semi']} semi-transparent pixels (cutout allows alpha 0 or 255 only)")
    if alpha == "opaque" and (alpha_counts["semi"] or alpha_counts["0"]):
        errors.append(f"{alpha_counts['semi'] + alpha_counts['0']} non-opaque pixels (opaque mode)")

    covered = [[False] * w for _ in range(h)]
    allow = set(allow_holes)
    island_report = []
    for name, (x0, y0, x1, y1) in islands:
        if x0 < 0 or y0 < 0 or x1 > w or y1 > h:
            errors.append(f"UV island {name} {fmt_rect((x0, y0, x1, y1))} is outside the {w}x{h} texture")
        ix0, iy0 = max(0, int(x0)), max(0, int(y0))
        ix1, iy1 = min(w, int(-(-x1 // 1))), min(h, int(-(-y1 // 1)))
        holes = 0
        for y in range(iy0, iy1):
            for x in range(ix0, ix1):
                covered[y][x] = True
                if px[x, y][3] == 0:
                    holes += 1
        island_report.append({"name": name, "rect": [x0, y0, x1, y1], "transparent": holes})
        if holes and name not in allow:
            errors.append(f"UV island {name} has {holes} transparent pixels (allow with --allow-hole {name})")
    outside = 0
    if islands:
        outside = sum(1 for y in range(h) for x in range(w) if not covered[y][x] and px[x, y][3] > 0)
        if outside:
            warnings.append(f"{outside} painted pixels outside every UV island (never shown)")

    if max_colors is not None and len(colors) > max_colors:
        errors.append(f"{len(colors)} distinct opaque colors > max {max_colors}")
    if palette is not None:
        bad = {c: n for c, n in colors.items() if c not in palette}
        if bad:
            sample = ", ".join("#%02x%02x%02x" % c for c in list(bad)[:5])
            errors.append(f"{sum(bad.values())} pixels in {len(bad)} colors outside the palette ({sample})")

    stats = {
        "file": str(png), "size": [w, h], "alpha": dict(alpha_counts), "distinct_colors": len(colors),
        "top_colors": [["#%02x%02x%02x" % c, n] for c, n in colors.most_common(8)],
        "islands": len(islands), "painted_outside": outside,
    }
    return {"ok": not errors, "errors": errors, "warnings": warnings, "stats": stats, "island_detail": island_report}


def fmt_rect(r):
    return "[" + ",".join(f"{v:g}" for v in r) + "]"


def parse_size(text):
    try:
        a, b = text.lower().split("x")
        return (int(a), int(b))
    except ValueError:
        raise argparse.ArgumentTypeError("size must be WxH, e.g. 64x32")


def main(argv=None):
    ap = argparse.ArgumentParser(prog="check-texture.py", description=__doc__.split("\n")[0])
    ap.add_argument("png")
    ap.add_argument("--size", type=parse_size)
    ap.add_argument("--model")
    ap.add_argument("--uv-json")
    ap.add_argument("--alpha", choices=["cutout", "translucent", "opaque"], default="cutout")
    ap.add_argument("--allow-hole", action="append", default=[])
    ap.add_argument("--allow-npot", action="store_true")
    ap.add_argument("--max-colors", type=int)
    ap.add_argument("--palette")
    ap.add_argument("--json", action="store_true")
    try:
        args = ap.parse_args(argv)
    except SystemExit as e:
        return 0 if e.code == 0 else 64
    try:
        palette = load_palette(args.palette) if args.palette else None
        rep = check(args.png, args.size, args.model, args.uv_json, args.alpha, args.allow_hole, args.allow_npot,
                    args.max_colors, palette)
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as e:
        print(f"check-texture: cannot read input: {e}", file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps(rep, indent=2))
    else:
        s = rep["stats"]
        print(f"{s['file']}: {s['size'][0]}x{s['size'][1]} alpha={s['alpha']} colors={s['distinct_colors']} "
              f"islands={s['islands']} painted_outside={s['painted_outside']}")
        for e in rep["errors"]:
            print(f"ERROR {e}")
        for wmsg in rep["warnings"]:
            print(f"WARN  {wmsg}")
        print("OK" if rep["ok"] else "FAIL")
    return 0 if rep["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
