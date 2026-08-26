"""Sync the complete, PDF-safe Barlow static TTF faces from Google Fonts.

This development-only asset step uses the Python standard library and pins each
primary-source file by SHA-256. The application has no font download or
conversion runtime dependency.
"""

from hashlib import sha256
from pathlib import Path
from urllib.request import Request, urlopen


BASE_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/barlow"
ASSETS = {
    "Barlow-400-normal.ttf": (
        "Barlow-Regular.ttf",
        "95aa02c7c43096e0dd44d787ba6216864a67157e402adab59b35572e0c1577ea",
    ),
    "Barlow-400-italic.ttf": (
        "Barlow-Italic.ttf",
        "70cf45c354af39e55082fd506e748cc6a0a1812949875f99ded3f76bf691e4ca",
    ),
    "Barlow-500-normal.ttf": (
        "Barlow-Medium.ttf",
        "f8906f762cb73dca441da034bc363b2d8e2e68bc10d5c05e58717646c20cc4b4",
    ),
    "Barlow-500-italic.ttf": (
        "Barlow-MediumItalic.ttf",
        "dbf6d2df1348c4a91874a15bbe7b3f3d893d491bd2ae73370795afe157c993b9",
    ),
    "Barlow-600-normal.ttf": (
        "Barlow-SemiBold.ttf",
        "86577cb32f8abe3673db53ca0f4221e6856751a4f6730c867e00f720f8bb1fc5",
    ),
    "Barlow-600-italic.ttf": (
        "Barlow-SemiBoldItalic.ttf",
        "277b45fc0b9f066bf77e88e5d147baae8d1ad7441cedee1dc305fc3dc6e84ce7",
    ),
    "Barlow-700-normal.ttf": (
        "Barlow-Bold.ttf",
        "84e6a4d61e7c3e21f3c50ea6a4f7e5303a3467864c038be6ea3759bab8d547f9",
    ),
    "Barlow-700-italic.ttf": (
        "Barlow-BoldItalic.ttf",
        "079dcee4a53544177f3b16354b27b40b521e22861a40084ab4d052f0289ed9e8",
    ),
    "Barlow-OFL.txt": (
        "OFL.txt",
        "186d750eb496a4c17a76385f82be6aea2ac1cf2de074a811d63786cf374ea73f",
    ),
}


def download(source_name: str, expected_hash: str) -> bytes:
    request = Request(
        f"{BASE_URL}/{source_name}",
        headers={"User-Agent": "Atehna-PDF-font-sync"},
    )
    with urlopen(request, timeout=30) as response:
        payload = response.read()
    actual_hash = sha256(payload).hexdigest()
    if actual_hash != expected_hash:
        raise RuntimeError(
            f"SHA-256 mismatch for {source_name}: {actual_hash} != {expected_hash}"
        )
    if source_name.endswith(".ttf") and payload[:4] not in (b"\x00\x01\x00\x00", b"OTTO"):
        raise RuntimeError(f"Downloaded file is not an sfnt font: {source_name}")
    return payload


def main() -> None:
    repository = Path(__file__).resolve().parents[1]
    output_directory = repository / "public" / "fonts"
    output_directory.mkdir(parents=True, exist_ok=True)
    for target_name, (source_name, expected_hash) in ASSETS.items():
        payload = download(source_name, expected_hash)
        target = output_directory / target_name
        temporary = target.with_suffix(target.suffix + ".tmp")
        temporary.write_bytes(payload)
        temporary.replace(target)
        print(f"{source_name} -> {target.relative_to(repository)}")


if __name__ == "__main__":
    main()
