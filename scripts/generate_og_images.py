#!/usr/bin/env python3
"""Generate Tech-Noir OG images for Muuney.hub pages (1200x630).

Each page gets a custom PNG with:
- #0a0a0a bg
- #0B6C3E accent corner bar
- Tech-Noir grid dots
- Module name (Poppins Bold, large) + subtitle + muuney.hub brand

Output: public/og/<slug>.png
"""
from PIL import Image, ImageDraw, ImageFont
import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
OUT_DIR = BASE_DIR / "public" / "og"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Fonts
POPPINS_BOLD = "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf"
POPPINS_MEDIUM = "/usr/share/fonts/truetype/google-fonts/Poppins-Medium.ttf"
POPPINS_LIGHT = "/usr/share/fonts/truetype/google-fonts/Poppins-Light.ttf"

# Colors
BG = (10, 10, 10)                 # #0a0a0a
ACCENT = (11, 108, 62)            # #0B6C3E Muuney green
ACCENT_DIM = (11, 108, 62, 30)    # accent w/ alpha
TEXT_MAIN = (255, 255, 255)       # white
TEXT_SUB = (161, 161, 170)        # zinc-400
TEXT_MUTED = (82, 82, 91)         # zinc-600

# Pages config
PAGES = [
    {
        "slug": "macro",
        "module": "Macro",
        "title": "Panorama Macroeconômico",
        "subtitle": "Selic · IPCA · PIB · Focus · 73 series BACEN",
    },
    {
        "slug": "credito",
        "module": "Crédito",
        "title": "Overview de Crédito",
        "subtitle": "Spreads · Inadimplência · Concessões · 73 séries BACEN",
    },
    {
        "slug": "renda-fixa",
        "module": "Renda Fixa",
        "title": "Terminal de Renda Fixa",
        "subtitle": "Curva DI · NTN-B · Tesouro · Breakeven",
    },
    {
        "slug": "fundos",
        "module": "Fundos",
        "title": "Fundos de Investimento",
        "subtitle": "29.491 fundos CVM · Fund Score™ · Rankings RCVM 175",
    },
    {
        "slug": "fidc",
        "module": "FIDC",
        "title": "FIDC Deep Module",
        "subtitle": "Subordinação · Inadimplência · Rankings por lastro",
    },
    {
        "slug": "fii",
        "module": "FII",
        "title": "FII Deep Module",
        "subtitle": "Dividend Yield · Segmentos · Mandatos",
    },
    {
        "slug": "ofertas",
        "module": "Ofertas",
        "title": "Ofertas Públicas Radar",
        "subtitle": "CVM 160 · Pipeline · Debêntures · CRA · CRI",
    },
    {
        "slug": "fidc-lamina",
        "module": "FIDC",
        "title": "Lâmina FIDC",
        "subtitle": "Análise detalhada · Estrutura de capital · Performance",
    },
    {
        "slug": "fii-lamina",
        "module": "FII",
        "title": "Lâmina FII",
        "subtitle": "Análise detalhada · DY · Composição · Performance",
    },
    {
        "slug": "fund-lamina",
        "module": "Fundo",
        "title": "Lâmina de Fundo",
        "subtitle": "Fund Score™ · Composição CDA · Performance",
    },
    # Default hub cover (used by HubLanding and default fallback)
    {
        "slug": "default",
        "module": "muuney.hub",
        "title": "Inteligência de Mercado",
        "subtitle": "BACEN · CVM · Fundos · Renda Fixa · Ofertas",
    },
]


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def draw_grid_dots(draw: ImageDraw.ImageDraw, w: int, h: int) -> None:
    """Tech-Noir subtle grid: 1px dots every 40px, very faint."""
    dot_color = (30, 30, 30)
    for x in range(0, w, 40):
        for y in range(0, h, 40):
            draw.point((x, y), fill=dot_color)


def draw_accent_corner(im: Image.Image) -> None:
    """Green glow bar top-left + bottom-right corner accents."""
    draw = ImageDraw.Draw(im, "RGBA")
    # Top-left vertical accent bar
    draw.rectangle([0, 0, 6, 120], fill=ACCENT)
    # Top-left horizontal accent
    draw.rectangle([0, 0, 120, 6], fill=ACCENT)
    # Bottom-right mirror
    draw.rectangle([1200 - 120, 630 - 6, 1200, 630], fill=ACCENT)
    draw.rectangle([1200 - 6, 630 - 120, 1200, 630], fill=ACCENT)
    # Soft green glow blob top-right (very transparent)
    for r in range(180, 120, -4):
        alpha = max(0, int((180 - r) * 0.8))
        draw.ellipse(
            [1000 - r, -r, 1000 + r, r],
            fill=(11, 108, 62, alpha // 4),
        )


def draw_muuney_mark(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    """Small mono-style ●muuney.hub mark."""
    # Green dot
    draw.ellipse([x, y, x + 16, y + 16], fill=ACCENT)
    # Text
    try:
        font = load_font(POPPINS_MEDIUM, 22)
    except OSError:
        font = ImageFont.load_default()
    draw.text((x + 28, y - 4), "muuney.hub", fill=TEXT_MAIN, font=font)


def draw_uppercase_mono(draw: ImageDraw.ImageDraw, text: str, x: int, y: int, size: int = 18) -> None:
    """Mono uppercase label (module tag)."""
    font = load_font(POPPINS_MEDIUM, size)
    # Letter spacing hack: draw each char
    cursor = x
    for ch in text.upper():
        draw.text((cursor, y), ch, fill=ACCENT, font=font)
        bbox = draw.textbbox((cursor, y), ch, font=font)
        cursor = bbox[2] + 3


def wrap_lines(text: str, font: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    line = ""
    for w in words:
        test = (line + " " + w).strip()
        if font.getlength(test) <= max_w:
            line = test
        else:
            if line:
                lines.append(line)
            line = w
    if line:
        lines.append(line)
    return lines


def generate(page: dict) -> None:
    W, H = 1200, 630
    im = Image.new("RGB", (W, H), BG)
    # Grid dots
    grid = ImageDraw.Draw(im)
    draw_grid_dots(grid, W, H)
    # Accent
    draw_accent_corner(im)
    # Composite drawing layer
    draw = ImageDraw.Draw(im)
    # Muuney mark top-left
    draw_muuney_mark(draw, 80, 78)
    # Module tag
    draw_uppercase_mono(draw, page["module"], 80, 200, size=20)
    # Title (big bold)
    title_font = load_font(POPPINS_BOLD, 76)
    title_lines = wrap_lines(page["title"], title_font, W - 160)
    y = 240
    for line in title_lines:
        draw.text((80, y), line, fill=TEXT_MAIN, font=title_font)
        y += 84
    # Subtitle (lighter, smaller)
    sub_font = load_font(POPPINS_LIGHT, 30)
    sub_lines = wrap_lines(page["subtitle"], sub_font, W - 160)
    y += 16
    for line in sub_lines:
        draw.text((80, y), line, fill=TEXT_SUB, font=sub_font)
        y += 40
    # Footer strip: data source attribution
    footer_font = load_font(POPPINS_MEDIUM, 18)
    draw.text(
        (80, H - 60),
        "Dados oficiais · BACEN · CVM · Atualização contínua",
        fill=TEXT_MUTED,
        font=footer_font,
    )
    # Url right side
    url_font = load_font(POPPINS_MEDIUM, 20)
    url_text = "hub.muuney.com.br"
    tw = url_font.getlength(url_text)
    draw.text((W - 80 - tw, H - 60), url_text, fill=ACCENT, font=url_font)
    # Save
    out_path = OUT_DIR / f"{page['slug']}.png"
    im.save(out_path, "PNG", optimize=True)
    size_kb = out_path.stat().st_size // 1024
    print(f"✓ {out_path.name} ({size_kb} KB)")


def main() -> None:
    for p in PAGES:
        generate(p)
    print(f"\nGenerated {len(PAGES)} OG images in {OUT_DIR}")


if __name__ == "__main__":
    main()
