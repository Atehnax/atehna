"""Build the static, PDF-safe order-document font faces.

The checked-in binaries are instantiated from the official Google Fonts
repository at one immutable commit.  This script is a maintenance tool only;
the application never downloads fonts at runtime.

Requires fonttools (`python -m pip install fonttools`).
"""

from __future__ import annotations

import hashlib
import tempfile
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


GOOGLE_FONTS_COMMIT = "6a003b5eb672dc8bf5bff5937cf5863f8b175445"
GOOGLE_FONTS_RAW = (
    "https://raw.githubusercontent.com/google/fonts/"
    f"{GOOGLE_FONTS_COMMIT}"
)
WEIGHTS = (400, 500, 600, 700)


@dataclass(frozen=True)
class Source:
    family: str
    output_stem: str
    source_path: str
    sha256: str
    style: str = "normal"
    fixed_axes: tuple[tuple[str, float], ...] = ()
    weights: tuple[int, ...] = WEIGHTS


SOURCES = (
    Source(
        "Inter",
        "Inter",
        "ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf",
        "29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031",
        fixed_axes=(("opsz", 14),),
    ),
    Source(
        "Inter",
        "Inter",
        "ofl/inter/Inter-Italic%5Bopsz%2Cwght%5D.ttf",
        "acd98e64795781b2058f07b18475e0ecee2a0fe2b42a49e2f9e37d0d6bf66ce6",
        style="italic",
        fixed_axes=(("opsz", 14),),
    ),
    Source(
        "IBM Plex Sans",
        "IBMPlexSans",
        "ofl/ibmplexsans/IBMPlexSans%5Bwdth%2Cwght%5D.ttf",
        "3b031aa4216174205bd8471f88a49b91f093169e9e87bd5262242bc5967fe2e3",
        fixed_axes=(("wdth", 100),),
    ),
    Source(
        "IBM Plex Sans",
        "IBMPlexSans",
        "ofl/ibmplexsans/IBMPlexSans-Italic%5Bwdth%2Cwght%5D.ttf",
        "0b94c5e981993764db32bf9c610ecc60cbd34ad77ec2f10ba03c64ab75124d8e",
        style="italic",
        fixed_axes=(("wdth", 100),),
    ),
    Source(
        "Source Sans 3",
        "SourceSans3",
        "ofl/sourcesans3/SourceSans3%5Bwght%5D.ttf",
        "042fe2cc0b933e328410d7acbd0aa6a1873dca5aef81875f4bc214b08825c7b9",
    ),
    Source(
        "Source Sans 3",
        "SourceSans3",
        "ofl/sourcesans3/SourceSans3-Italic%5Bwght%5D.ttf",
        "39e3ab05ccd7cb94907c31005bb5bec1d5432f0b096a2b782976e217a540eb6c",
        style="italic",
    ),
    Source(
        "Manrope",
        "Manrope",
        "ofl/manrope/Manrope%5Bwght%5D.ttf",
        "d0639be45d0af36e798172419d7bd173c4bd4f29e2b76cbb69db1d11bf8b0a40",
    ),
    Source(
        "Space Grotesk",
        "SpaceGrotesk",
        "ofl/spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf",
        "acad6de1fc93436f5c0f1f4137751ef04f1aea3063e7036535970ffcfbd79f72",
        weights=(400, 500, 700),
    ),
    Source(
        "Bitter",
        "Bitter",
        "ofl/bitter/Bitter%5Bwght%5D.ttf",
        "ef2b9a711fb02f1e5823b34da1b7450e0fc76793b7d733a8b41006e24916d4a7",
    ),
    Source(
        "Bitter",
        "Bitter",
        "ofl/bitter/Bitter-Italic%5Bwght%5D.ttf",
        "5e6e0af503171c9d7b4be7a22c16f474d7a638cf83a80051d825bcc58d664bc3",
        style="italic",
    ),
    Source(
        "Noto Sans Mono",
        "NotoSansMono",
        "ofl/notosansmono/NotoSansMono%5Bwdth%2Cwght%5D.ttf",
        "2cb2adb378a8f574213e23df697050b83c54c27df465a2015552740b2769a081",
        fixed_axes=(("wdth", 100),),
    ),
)

LICENSES = {
    "Inter-OFL.txt": (
        "ofl/inter/OFL.txt",
        "5b9321a4298cfeb6b34354164a1c3afc3db114569984c502b9b35d988fd58c57",
    ),
    "IBMPlexSans-OFL.txt": (
        "ofl/ibmplexsans/OFL.txt",
        "7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da",
    ),
    "SourceSans3-OFL.txt": (
        "ofl/sourcesans3/OFL.txt",
        "09746787287a289323b0ec3cff4d1a4a801331b82b7207c1e186f5d26619a392",
    ),
    "Manrope-OFL.txt": (
        "ofl/manrope/OFL.txt",
        "e01b637272e0cbdfb240184dd98ea5cc671556d9894dae2668d92ab2c906787c",
    ),
    "SpaceGrotesk-OFL.txt": (
        "ofl/spacegrotesk/OFL.txt",
        "564ce565c371c5e5bbf286006565a7c9aa55a9f56e7ca58d56e05d649dd61a72",
    ),
    "Bitter-OFL.txt": (
        "ofl/bitter/OFL.txt",
        "152a1e283e23b42c4940da4c72f2f5bebaa17969cb77c76d7af05903846006f1",
    ),
    "NotoSansMono-OFL.txt": (
        "ofl/notosansmono/OFL.txt",
        "cee9892f9f0cc8fe882c9e9537ee6a89621d86ee7ceaf70b02e2b2b1c25c061a",
    ),
}


def download_verified(relative_path: str, expected_sha256: str) -> bytes:
    with urllib.request.urlopen(f"{GOOGLE_FONTS_RAW}/{relative_path}") as response:
        data = response.read()
    observed = hashlib.sha256(data).hexdigest()
    if observed != expected_sha256:
        raise RuntimeError(
            f"Hash mismatch for {relative_path}: expected {expected_sha256}, got {observed}"
        )
    return data


def build_face(source_path: Path, output_path: Path, source: Source, weight: int) -> None:
    font = TTFont(source_path)
    axes = {"wght": weight, **dict(source.fixed_axes)}
    instantiateVariableFont(font, axes, inplace=True, updateFontNames=True)
    font.flavor = None
    font.save(output_path, reorderTables=True)


def main() -> None:
    project_root = Path(__file__).resolve().parents[1]
    output_dir = project_root / "public" / "fonts"
    output_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="atehna-order-document-fonts-") as raw_temp:
        temp_dir = Path(raw_temp)
        for source in SOURCES:
            source_bytes = download_verified(source.source_path, source.sha256)
            source_file = temp_dir / f"{source.output_stem}-{source.style}-variable.ttf"
            source_file.write_bytes(source_bytes)
            for weight in source.weights:
                output_file = output_dir / f"{source.output_stem}-{weight}-{source.style}.ttf"
                build_face(source_file, output_file, source, weight)
                print(f"built {output_file.relative_to(project_root)}")

        for output_name, (source_path, sha256) in LICENSES.items():
            output_file = output_dir / output_name
            output_file.write_bytes(download_verified(source_path, sha256))
            print(f"copied {output_file.relative_to(project_root)}")


if __name__ == "__main__":
    main()
