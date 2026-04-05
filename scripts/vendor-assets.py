#!/usr/bin/env python3
"""Download external assets and rewrite CSS for fully local deploy."""
from __future__ import annotations

import hashlib
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets"
FONTS = ASSETS / "fonts"
IMAGES = ASSETS / "images"
CSS_DIR = ASSETS / "css"
JS_DIR = ASSETS / "js"
LOTTIE = ASSETS / "lottie"


def curl(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "curl",
            "-fsSL",
            "-L",
            "-A",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            url,
            "-o",
            str(dest),
        ],
        check=True,
    )


def safe_name_from_url(url: str) -> str:
    path = unquote(urlparse(url).path)
    base = path.rsplit("/", 1)[-1]
    if not base or base.endswith("/"):
        base = hashlib.sha256(url.encode()).hexdigest()[:12] + ".bin"
    return base


def download_fonts_from_google_css(css_path: Path, out_css_path: Path) -> None:
    text = css_path.read_text()
    urls = re.findall(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", text)
    mapping: dict[str, str] = {}
    for u in urls:
        u = u.strip()
        if u in mapping:
            continue
        fname = safe_name_from_url(u)
        local = f"../fonts/{fname}"
        dest = FONTS / fname
        print("  font", fname)
        curl(u, dest)
        mapping[u] = local

    out = text
    for remote, local in mapping.items():
        out = out.replace(remote, local)
    out_css_path.write_text(out)


def patch_webflow_css(css_in: Path, css_out: Path) -> None:
    text = css_in.read_text()
    pattern = r"https://cdn\.prod\.website-files\.com/5f7f7c03bae46f44fc34ddf4/([^)\"\']+)"
    urls = set(re.findall(pattern, text))

    for rel in urls:
        full = f"https://cdn.prod.website-files.com/5f7f7c03bae46f44fc34ddf4/{rel}"
        ext = rel.rsplit(".", 1)[-1].lower()
        sub = "fonts" if ext in ("woff2", "ttf", "woff", "otf") else "images"
        fname = rel.split("/")[-1]
        fname = unquote(fname)
        dest = ASSETS / sub / fname
        print("  wf", fname)
        curl(full, dest)
        text = text.replace(full, f"../{sub}/{fname}")

    css_out.write_text(text)


def main() -> None:
    for d in (FONTS, IMAGES, CSS_DIR, JS_DIR, LOTTIE):
        d.mkdir(parents=True, exist_ok=True)

    print("Webflow CSS + embedded CDN assets…")
    wf_src = CSS_DIR / "mels-beautiful-project.webflow.min.css"
    if not wf_src.exists():
        curl(
            "https://cdn.prod.website-files.com/5f7f7c03bae46f44fc34ddf4/css/mels-beautiful-project-26552e.webflow.shared.da1e35da9.min.css",
            wf_src,
        )
    patch_webflow_css(wf_src, CSS_DIR / "webflow.bundle.css")

    print("Google Fonts (Lora headings + Lato body)…")
    gf_query = (
        "https://fonts.googleapis.com/css2?"
        "family=Lato:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900&"
        "family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&"
        "display=swap"
    )
    raw = CSS_DIR / "google-fonts-raw.css"
    curl(gf_query, raw)
    download_fonts_from_google_css(raw, CSS_DIR / "google-fonts.css")

    binaries = [
        (
            "https://d3e54v103j8qbb.cloudfront.net/js/jquery-3.5.1.min.dc5e7f18c8.js?site=5f7f7c03bae46f44fc34ddf4",
            JS_DIR / "jquery-3.5.1.min.js",
        ),
        (
            "https://cdn.prod.website-files.com/5f7f7c03bae46f44fc34ddf4/js/webflow.schunk.57d5559d2f0cd9f8.js",
            JS_DIR / "webflow.schunk.57d5559d2f0cd9f8.js",
        ),
        (
            "https://cdn.prod.website-files.com/5f7f7c03bae46f44fc34ddf4/js/webflow.schunk.3b94eee02e342815.js",
            JS_DIR / "webflow.schunk.3b94eee02e342815.js",
        ),
        (
            "https://cdn.prod.website-files.com/5f7f7c03bae46f44fc34ddf4/js/webflow.2f121503.6823c5431fc3f984.js",
            JS_DIR / "webflow.2f121503.6823c5431fc3f984.js",
        ),
        (
            "https://cdn.jsdelivr.net/npm/@flowbase-co/boosters-before-after-slider@1.0.1/dist/before-after-slider.min.js",
            JS_DIR / "before-after-slider.min.js",
        ),
    ]
    print("JavaScript…")
    for url, dest in binaries:
        print(" ", dest.name)
        curl(url, dest)

    static_images = [
        "683076d780fd523927c18d20_MehLogoIco.png",
        "683078107d431cc67115b34c_MehLogo.png",
        "68274b56aa7dc59d6f17a5f2_linkedin.svg",
        "6827517d26402a8aa52628e8_profilebw.jpeg",
        "6831129d87ffa38c4469dad4_Brain.svg",
        "683115beb7f46d4871032973_Eye.svg",
        "6831169e6c7c236c76645ec6_Profile.svg",
        "689564b51e5fd0bf98ed6d1a_Opengraph.png",
    ]
    print("Raster / SVG…")
    base = "https://cdn.prod.website-files.com/5f7f7c03bae46f44fc34ddf4/"
    for name in static_images:
        curl(base + name, IMAGES / name)

    print("Lottie…")
    curl(
        base + "682901b816de3744b09dbd29_logo.json",
        LOTTIE / "logo.json",
    )

    print("Done.")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as e:
        print("curl failed:", e, file=sys.stderr)
        sys.exit(1)
