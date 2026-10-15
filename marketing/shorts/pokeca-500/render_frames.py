from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "frames"
OUT.mkdir(exist_ok=True)

WIDTH, HEIGHT = 1080, 1920
FPS = 12
DURATION = 12
FONT = "/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc"
GOLD = (239, 196, 92)
WHITE = (250, 248, 241)

screens = {
    "home": Image.open(ROOT / "home.png").convert("RGB"),
    "market": Image.open(ROOT / "market.png").convert("RGB"),
    "search": Image.open(ROOT / "search.png").convert("RGB"),
}

def font(size):
    return ImageFont.truetype(FONT, size)

def cover(image, size):
    ratio = max(size[0] / image.width, size[1] / image.height)
    resized = image.resize((round(image.width * ratio), round(image.height * ratio)), Image.Resampling.LANCZOS)
    left = (resized.width - size[0]) // 2
    top = (resized.height - size[1]) // 2
    return resized.crop((left, top, left + size[0], top + size[1]))

def fit_phone(image, width=760):
    height = round(width * image.height / image.width)
    return image.resize((width, height), Image.Resampling.LANCZOS)

def alpha(t, start, end, fade=0.35):
    if t < start or t >= end:
        return 0
    return min(1, (t - start) / fade, (end - t) / fade)

def draw_centered(draw, text, y, text_font, fill, spacing=18):
    box = draw.multiline_textbbox((0, 0), text, font=text_font, spacing=spacing, align="center")
    x = (WIDTH - (box[2] - box[0])) // 2
    draw.multiline_text((x, y), text, font=text_font, fill=fill, spacing=spacing, align="center")

def scene_frame(t):
    if t < 2.8:
        key, title, sub = "home", "ポケカの価格確認、\nまだ何サイトも見てる？", "探す時間を、選ぶ時間へ。"
        start, end = 0, 2.8
    elif t < 5.5:
        key, title, sub = "market", "人気カード\n500種類に拡大", "販売参考価格と確認済み買取価格"
        start, end = 2.8, 5.5
    elif t < 8.5:
        key, title, sub = "search", "カード名を\n入れるだけ", "気になる1枚をすぐ比較"
        start, end = 5.5, 8.5
    else:
        key, title, sub = "home", "無料で相場を\nチェック", "POKÉCA VAULT"
        start, end = 8.5, 12

    bg = cover(screens[key], (WIDTH, HEIGHT)).filter(ImageFilter.GaussianBlur(24))
    shade = Image.new("RGBA", (WIDTH, HEIGHT), (5, 7, 13, 190))
    frame = Image.alpha_composite(bg.convert("RGBA"), shade)
    draw = ImageDraw.Draw(frame)

    progress = (t - start) / max(0.01, end - start)
    shot = fit_phone(screens[key])
    phone = Image.new("RGBA", (shot.width + 24, shot.height + 24), (0, 0, 0, 0))
    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, shot.width, shot.height), radius=34, fill=255)
    phone.paste(shot, (12, 12), mask)
    ImageDraw.Draw(phone).rounded_rectangle((2, 2, phone.width - 3, phone.height - 3), radius=42, outline=(239, 196, 92, 210), width=5)
    phone_y = 610 + round(18 * math.sin(progress * math.pi))
    frame.alpha_composite(phone, ((WIDTH - phone.width) // 2, phone_y))

    draw.rounded_rectangle((72, 88, 1008, 520), radius=34, fill=(7, 9, 16, 235), outline=(239, 196, 92, 150), width=3)
    draw_centered(draw, title, 145, font(72), WHITE)
    draw_centered(draw, sub, 390, font(34), GOLD)

    if t >= 8.5:
        draw.rounded_rectangle((112, 1600, 968, 1745), radius=28, fill=GOLD)
        draw_centered(draw, "今すぐ無料で見る", 1633, font(48), (12, 13, 18))
        draw_centered(draw, "anadayo.github.io/pokeca-vault/", 1790, font(28), WHITE)
    else:
        draw_centered(draw, "POKÉCA VAULT", 1790, font(30), GOLD)

    opacity = alpha(t, start, end)
    if opacity < 1:
        fade = Image.new("RGBA", (WIDTH, HEIGHT), (5, 7, 13, round((1 - opacity) * 255)))
        frame = Image.alpha_composite(frame, fade)
    return frame.convert("RGB")

for index in range(FPS * DURATION):
    scene_frame(index / FPS).save(OUT / f"frame_{index:04d}.jpg", quality=88, optimize=True)

print(f"Rendered {FPS * DURATION} frames at {WIDTH}x{HEIGHT}")
