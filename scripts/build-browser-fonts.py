"""Losslessly package the existing Noto browser fonts as WOFF2.

Requires fonttools[woff] (python -m pip install "fonttools[woff]").
No fonts are downloaded or subsetted. Original TTFs remain available to the
PDF renderer and logo editor. Run with --check to verify checked-in assets.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
FONT_NAMES = (
    "NotoSans-Regular", "NotoSans-Bold",
    "NotoSansMono-400-normal", "NotoSansMono-500-normal",
    "NotoSansMono-600-normal", "NotoSansMono-700-normal",
)


def verify_font(source: Path, output: Path) -> None:
    with TTFont(source) as original, TTFont(output) as compressed:
        assert original.getGlyphOrder() == compressed.getGlyphOrder(), output
        assert original["head"].unitsPerEm == compressed["head"].unitsPerEm, output
        # All character maps, positioning, substitutions and metrics remain intact.
        for tag in original.keys():
            if tag not in {"GlyphOrder", "head", "glyf", "loca"}:
                assert original.getTableData(tag) == compressed.getTableData(tag), (output, tag)
        original_glyphs, compressed_glyphs = original.getGlyphSet(), compressed.getGlyphSet()
        for name in original.getGlyphOrder():
            before, after = RecordingPen(), RecordingPen()
            original_glyphs[name].draw(before)
            compressed_glyphs[name].draw(after)
            assert before.value == after.value, (output, name)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    options = parser.parse_args()
    for name in FONT_NAMES:
        source = ROOT / "public" / "fonts" / f"{name}.ttf"
        output = source.with_suffix(".woff2")
        if not options.check:
            with TTFont(source, recalcTimestamp=False) as font:
                font.flavor = "woff2"
                font.save(output)
        verify_font(source, output)
        print(f"{name}: {source.stat().st_size:,} -> {output.stat().st_size:,} bytes; all glyphs and metrics verified")


if __name__ == "__main__":
    main()
