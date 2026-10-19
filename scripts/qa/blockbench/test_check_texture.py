#!/usr/bin/env python3
"""Tests for check-texture.py on crafted images (stdlib unittest + Pillow).

Run: python3 -m unittest discover -s scripts/qa/blockbench -p 'test_*.py'
"""
import importlib.util
import json
import os
import tempfile
import unittest

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("check_texture", os.path.join(HERE, "check-texture.py"))
ct = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ct)

# One 8x8x8 box-UV cube at (0, 0): islands cover x 8..24 / y 0..8 (up, down) and x 0..32 / y 8..16 (sides).
CUBE_SIZE, CUBE_UV = (8, 8, 8), (0, 0)


def bbmodel(resolution=(32, 16), uv_offset=CUBE_UV, disabled=()):
    faces = {}
    for face, rect in ct.box_uv_rects(CUBE_SIZE, *uv_offset).items():
        faces[face] = {"uv": list(rect), "texture": None if face in disabled else 0}
    return {"meta": {"format_version": "5.0", "model_format": "geckolib_model", "box_uv": True},
            "resolution": {"width": resolution[0], "height": resolution[1]},
            "elements": [{"name": "box", "type": "cube", "faces": faces}]}


def geo(uv=list(CUBE_UV)):
    return {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": "geometry.t", "texture_width": 32, "texture_height": 16},
        "bones": [{"name": "root", "cubes": [{"origin": [0, 0, 0], "size": list(CUBE_SIZE), "uv": uv}]}]}]}


def good_image(size=(32, 16), scale=1):
    img = Image.new("RGBA", (size[0] * scale, size[1] * scale), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, (x0, y0, x1, y1) in enumerate(ct.box_uv_rects(CUBE_SIZE, *CUBE_UV).values()):
        d.rectangle([x0 * scale, y0 * scale, x1 * scale - 1, y1 * scale - 1], fill=(40 * i, 200 - 20 * i, 90, 255))
    return img


class CheckTextureTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def path(self, name):
        return os.path.join(self.tmp.name, name)

    def save_img(self, img, name="t.png"):
        p = self.path(name)
        img.save(p)
        return p

    def save_json(self, doc, name):
        p = self.path(name)
        with open(p, "w", encoding="utf-8") as fh:
            json.dump(doc, fh)
        return p

    def run_check(self, img, **kw):
        return ct.check(self.save_img(img), **kw)

    # --- passing cases
    def test_good_texture_with_bbmodel_passes(self):
        rep = self.run_check(good_image(), model=self.save_json(bbmodel(), "m.bbmodel"))
        self.assertTrue(rep["ok"], rep["errors"])
        self.assertEqual(rep["stats"]["islands"], 6)
        self.assertEqual(rep["stats"]["alpha"].get("semi", 0), 0)
        self.assertEqual(rep["warnings"], [])

    def test_good_texture_with_geo_json_passes(self):
        rep = self.run_check(good_image(), model=self.save_json(geo(), "m.geo.json"))
        self.assertTrue(rep["ok"], rep["errors"])
        self.assertEqual(rep["stats"]["islands"], 6)

    def test_double_resolution_png_scales_islands(self):
        rep = self.run_check(good_image(scale=2), model=self.save_json(bbmodel(), "m.bbmodel"))
        self.assertTrue(rep["ok"], rep["errors"])

    def test_disabled_face_is_not_an_island(self):
        img = good_image()
        ImageDraw.Draw(img).rectangle([8, 0, 15, 7], fill=(0, 0, 0, 0))  # clear the "up" face
        rep = self.run_check(img, model=self.save_json(bbmodel(disabled=("up",)), "m.bbmodel"))
        self.assertTrue(rep["ok"], rep["errors"])

    def test_cli_exit_codes(self):
        good = self.save_img(good_image(), "g.png")
        model = self.save_json(bbmodel(), "m.bbmodel")
        self.assertEqual(ct.main([good, "--model", model]), 0)
        self.assertEqual(ct.main([self.save_img(Image.new("RGBA", (30, 16)), "b.png"), "--size", "32x16"]), 1)
        self.assertEqual(ct.main([self.path("missing.png")]), 2)
        self.assertEqual(ct.main(["--alpha", "nope", good]), 64)

    # --- each defect is caught
    def test_wrong_size_vs_expected(self):
        rep = self.run_check(good_image(), size=(64, 32))
        self.assertFalse(rep["ok"])
        self.assertIn("!= expected 64x32", " ".join(rep["errors"]))

    def test_wrong_size_vs_model(self):
        img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
        img.paste(good_image(), (0, 0))
        rep = self.run_check(img, model=self.save_json(bbmodel(), "m.bbmodel"))
        self.assertFalse(rep["ok"])
        self.assertIn("does not match the model texture size", " ".join(rep["errors"]))

    def test_not_power_of_two(self):
        rep = self.run_check(Image.new("RGBA", (24, 16), (9, 9, 9, 255)))
        self.assertFalse(rep["ok"])
        self.assertIn("not a power of two", " ".join(rep["errors"]))
        rep = self.run_check(Image.new("RGBA", (24, 16), (9, 9, 9, 255)), allow_npot=True)
        self.assertTrue(rep["ok"])
        self.assertIn("not a power of two", " ".join(rep["warnings"]))

    def test_semi_alpha_in_cutout(self):
        img = good_image()
        img.putpixel((10, 10), (200, 10, 10, 128))
        rep = self.run_check(img, model=self.save_json(bbmodel(), "m.bbmodel"))
        self.assertFalse(rep["ok"])
        self.assertIn("1 semi-transparent", " ".join(rep["errors"]))
        rep = self.run_check(img, model=self.save_json(bbmodel(), "m.bbmodel"), alpha="translucent")
        self.assertTrue(rep["ok"], rep["errors"])

    def test_hole_inside_island_and_allowlist(self):
        img = good_image()
        img.putpixel((12, 12), (0, 0, 0, 0))  # inside the north face (x 8..16, y 8..16)
        model = self.save_json(bbmodel(), "m.bbmodel")
        rep = self.run_check(img, model=model)
        self.assertFalse(rep["ok"])
        self.assertIn("box:north has 1 transparent", " ".join(rep["errors"]))
        rep = self.run_check(img, model=model, allow_holes=["box:north"])
        self.assertTrue(rep["ok"], rep["errors"])

    def test_paint_outside_islands_is_warning(self):
        img = good_image()
        img.putpixel((0, 0), (255, 0, 255, 255))  # top-left corner is not on any face
        rep = self.run_check(img, model=self.save_json(bbmodel(), "m.bbmodel"))
        self.assertTrue(rep["ok"], rep["errors"])
        self.assertEqual(rep["stats"]["painted_outside"], 1)
        self.assertIn("outside every UV island", " ".join(rep["warnings"]))

    def test_uv_out_of_bounds(self):
        rep = self.run_check(good_image(), model=self.save_json(geo(uv=[8, 4]), "m.geo.json"))
        self.assertFalse(rep["ok"])
        self.assertIn("is outside the 32x16 texture", " ".join(rep["errors"]))

    def test_uv_json_islands(self):
        uv = self.save_json([{"name": "patch", "rect": [0, 0, 4, 4]}], "uv.json")
        rep = self.run_check(Image.new("RGBA", (16, 16), (0, 0, 0, 0)), uv_json=uv)
        self.assertFalse(rep["ok"])
        self.assertIn("patch has 16 transparent", " ".join(rep["errors"]))

    def test_max_colors(self):
        rep = self.run_check(good_image(), max_colors=3)
        self.assertFalse(rep["ok"])
        self.assertIn("distinct opaque colors > max 3", " ".join(rep["errors"]))

    def test_palette(self):
        img = Image.new("RGBA", (16, 16), (16, 32, 48, 255))
        pal = self.path("pal.txt")
        with open(pal, "w", encoding="utf-8") as fh:
            fh.write("# coat palette\n#102030 dark\n")
        self.assertTrue(self.run_check(img, palette=ct.load_palette(pal))["ok"])
        img.putpixel((3, 3), (255, 255, 255, 255))
        rep = self.run_check(img, palette=ct.load_palette(pal))
        self.assertFalse(rep["ok"])
        self.assertIn("#ffffff", " ".join(rep["errors"]))

    # --- refused / malformed input is exit 2 with a message, never a traceback or a hang
    def assert_exit2(self, *argv):
        import contextlib
        import io
        import time
        err = io.StringIO()
        t0 = time.monotonic()
        with contextlib.redirect_stderr(err):
            code = ct.main(list(argv))
        self.assertEqual(code, 2, err.getvalue())
        self.assertIn("cannot read input", err.getvalue())
        self.assertLess(time.monotonic() - t0, 5.0)
        return err.getvalue()

    def test_oversized_image_refused_before_decoding(self):
        big = self.save_img(Image.new("1", (4097, 4097)), "big.png")  # 1-bit: small file, 16.8 M pixels
        self.assertIn("pixel cap", self.assert_exit2(big))

    def test_decompression_bomb_is_exit_2(self):
        old = ct.Image.MAX_IMAGE_PIXELS
        self.addCleanup(setattr, ct.Image, "MAX_IMAGE_PIXELS", old)
        ct.Image.MAX_IMAGE_PIXELS = 10  # Pillow raises DecompressionBombError above 2x this
        self.assertIn("DecompressionBombError", self.assert_exit2(self.save_img(Image.new("RGBA", (16, 16)))))

    def test_malformed_geo_uv_short(self):
        model = self.save_json(geo(uv=[1]), "m.geo.json")
        self.assert_exit2(self.save_img(good_image()), "--model", model)

    def test_malformed_model_top_level_list(self):
        model = self.save_json([1, 2, 3], "m.bbmodel")
        self.assertIn("JSON object", self.assert_exit2(self.save_img(good_image()), "--model", model))

    def test_malformed_geo_uv_size_not_iterable(self):
        doc = geo()
        doc["minecraft:geometry"][0]["bones"][0]["cubes"][0]["uv"] = {"north": {"uv": [0, 0], "uv_size": 5}}
        self.assert_exit2(self.save_img(good_image()), "--model", self.save_json(doc, "m.geo.json"))

    def test_malformed_zero_resolution(self):
        doc = bbmodel()
        doc["resolution"]["width"] = 0
        self.assertIn("must be positive", self.assert_exit2(self.save_img(good_image()), "--model",
                                                            self.save_json(doc, "m.bbmodel")))

    def test_opaque_mode(self):
        img = Image.new("RGBA", (16, 16), (1, 2, 3, 255))
        self.assertTrue(self.run_check(img, alpha="opaque")["ok"])
        img.putpixel((0, 0), (0, 0, 0, 0))
        self.assertFalse(self.run_check(img, alpha="opaque")["ok"])


if __name__ == "__main__":
    unittest.main()
