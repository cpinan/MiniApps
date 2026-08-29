#!/usr/bin/env python3
"""Genera los iconos PNG (192, 512 y maskable 512) de cada miniapp.

Sin assets de terceros: todo son formas dibujadas con PIL. Ejecutar desde la raíz:
    python3 tools/make-icons.py
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

SS = 4  # supersample

def canvas(size, bg=None, radius=0.22):
    img = Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if bg:
        S = size * SS
        d.rounded_rectangle([0, 0, S, S], radius=int(S * radius), fill=bg)
    return img, d

def font(size):
    for p in ["/System/Library/Fonts/Supplemental/Arial Bold.ttf",
              "/System/Library/Fonts/Helvetica.ttc",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]:
        if Path(p).exists():
            try:
                return ImageFont.truetype(p, size)
            except OSError:
                continue
    return ImageFont.load_default()

def centered(d, box, text, f, fill):
    x0, y0, x1, y1 = box
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    d.text(((x0 + x1 - (r - l)) / 2 - l, (y0 + y1 - (b - t)) / 2 - t), text, font=f, fill=fill)

# ---------------------------------------------------------------- diseños

def teams(size, pad=0.0):
    img, d = canvas(size, bg=(15, 17, 24, 255))
    S = size * SS
    p = S * pad
    r = S * 0.20
    d.ellipse([S*0.20+p, S*0.28+p, S*0.20+2*r+p, S*0.28+2*r+p], fill=(238, 21, 21, 255))
    d.ellipse([S*0.44-p, S*0.28+p, S*0.44+2*r-p, S*0.28+2*r+p], fill=(59, 76, 202, 255))
    d.rounded_rectangle([S*0.13+p, S*0.62+p, S*0.47+p, S*0.80+p], radius=int(S*0.06), fill=(238, 21, 21, 255))
    d.rounded_rectangle([S*0.53-p, S*0.62+p, S*0.87-p, S*0.80+p], radius=int(S*0.06), fill=(59, 76, 202, 255))
    return img

def gift(size, pad=0.0):
    img, d = canvas(size, bg=(15, 17, 24, 255))
    S = size * SS
    box = [S*0.16, S*0.34, S*0.84, S*0.84]
    d.rounded_rectangle(box, radius=int(S*0.05), fill=(238, 21, 21, 255))
    d.rectangle([S*0.44, S*0.34, S*0.56, S*0.84], fill=(255, 203, 5, 255))          # cinta vertical
    d.rectangle([S*0.16, S*0.52, S*0.84, S*0.62], fill=(255, 203, 5, 255))          # cinta horizontal
    d.ellipse([S*0.28, S*0.16, S*0.52, S*0.38], fill=(255, 203, 5, 255))            # lazo
    d.ellipse([S*0.48, S*0.16, S*0.72, S*0.38], fill=(255, 203, 5, 255))
    d.ellipse([S*0.44, S*0.26, S*0.56, S*0.38], fill=(238, 21, 21, 255))
    return img

def shield(size, pad=0.0):
    img, d = canvas(size, bg=(11, 16, 28, 255))
    S = size * SS
    pts = [(S*0.50, S*0.14), (S*0.84, S*0.28), (S*0.84, S*0.56),
           (S*0.50, S*0.88), (S*0.16, S*0.56), (S*0.16, S*0.28)]
    d.polygon(pts, fill=(47, 191, 201, 255))
    d.polygon([(S*0.50, S*0.14), (S*0.84, S*0.28), (S*0.84, S*0.56), (S*0.50, S*0.88)],
              fill=(61, 108, 224, 255))
    f = font(int(S*0.34))
    centered(d, [S*0.16, S*0.24, S*0.84, S*0.78], "×2", f, (255, 255, 255, 255))
    return img

def bingo(size, pad=0.0):
    img, d = canvas(size, bg=(15, 17, 24, 255))
    S = size * SS
    d.ellipse([S*0.12, S*0.12, S*0.88, S*0.88], fill=(245, 245, 245, 255),
              outline=(24, 24, 26, 255), width=int(S*0.03))
    d.ellipse([S*0.26, S*0.26, S*0.74, S*0.74], fill=(238, 21, 21, 255))
    f = font(int(S*0.30))
    centered(d, [S*0.26, S*0.26, S*0.74, S*0.74], "7", f, (255, 255, 255, 255))
    return img


def pokeprice(size, pad=0.0):
    """Moneda dorada con $ y una pokéball detrás: precio + PokeMMO."""
    img, d = canvas(size, bg=(11, 16, 28, 255))
    S = size * SS
    p = S * pad
    # pokéball abajo a la derecha
    bx0, by0, bx1, by1 = S*0.42+p, S*0.42+p, S*0.90-p, S*0.90-p
    d.ellipse([bx0, by0, bx1, by1], fill=(245, 245, 245, 255), outline=(24, 24, 26, 255), width=int(S*0.028))
    d.pieslice([bx0, by0, bx1, by1], 180, 360, fill=(47, 191, 201, 255), outline=(24, 24, 26, 255), width=int(S*0.028))
    cx, cy = (bx0+bx1)/2, (by0+by1)/2
    r = S*0.055
    d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(245, 245, 245, 255), outline=(24, 24, 26, 255), width=int(S*0.024))
    # moneda arriba a la izquierda, encima
    mx0, my0, mx1, my1 = S*0.08+p, S*0.08+p, S*0.60-p, S*0.60-p
    d.ellipse([mx0, my0, mx1, my1], fill=(240, 180, 41, 255), outline=(138, 108, 5, 255), width=int(S*0.035))
    f = font(int(S*0.30))
    centered(d, [mx0, my0, mx1, my1], "$", f, (34, 26, 5, 255))
    return img

APPS = {
    "apps/teams/icons": teams,
    "apps/secretsanta/icons": gift,
    "apps/typechart/icons": shield,
    "apps/bingo/icons": bingo,
    "apps/pokeprice/icons": pokeprice,
}

for out, draw in APPS.items():
    d = Path(out)
    d.mkdir(parents=True, exist_ok=True)
    for px in (192, 512):
        draw(px).resize((px, px), Image.LANCZOS).save(d / f"icon-{px}.png")
    # maskable: 16% de zona segura alrededor
    m = draw(512, pad=0.10).resize((512, 512), Image.LANCZOS)
    m.save(d / "maskable-512.png")
    print("iconos:", out)
