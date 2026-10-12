"""封面美术：把封面原图排成带出血的整页底图。
- art/src/：出品方提供的原图（01—08 八张单人封面和全员海报 poster），1024×1536。
- art/gen/02-gaowen-fix.webp：烦高原图标语去掉多余叹号的修图（见 fix_02，需要 OpenCV；已提交）。
- art/out/：本脚本生成的整页底图（不提交）。封面＝原图缩到高204mm居中，四周把原图最外一圈颜色往外延展成柔和渐变，补满到出血；
  封底＝同图大幅模糊压暗。尺寸按 A5（148×210）加 3mm 出血、300dpi。
只依赖 Pillow 和 numpy。"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
SRC, GEN, OUT = (os.path.join(HERE, "art", d) for d in ("src", "gen", "out"))

DPI = 300
BLEED = 3.0
PAGE_W, PAGE_H = 148.0, 210.0
ART_H = 204.0                       # 原图在页面上的高度；原图自带的金框离裁切线约4.4mm


def mm2px(mm):
    return int(round(mm / 25.4 * DPI))


FULL_W, FULL_H = mm2px(PAGE_W + 2 * BLEED), mm2px(PAGE_H + 2 * BLEED)
ART_PX_H = mm2px(ART_H)
ART_PX_W = int(round(ART_PX_H * 2 / 3))
ART_X, ART_Y = (FULL_W - ART_PX_W) // 2, (FULL_H - ART_PX_H) // 2


def px2mm(px):
    return px / DPI * 25.4


# 原图在整页（含出血）上的位置，单位mm；版式叠加层按这个框对齐
ART_BOX = dict(left=px2mm(ART_X), top=px2mm(ART_Y), width=px2mm(ART_PX_W), height=px2mm(ART_PX_H))

# 出品方原图
PROVIDED = {"01-lajiao": "01-lajiao.webp", "02-gaowen": "02-gaowen.webp", "03-andefu": "03-andefu.webp",
            "04-mei": "04-mei.webp", "05-maike": "05-maike.webp", "06-gengen": "06-gengen.webp",
            "07-qianduoduo": "07-qianduoduo.webp", "08-linda": "08-linda.webp", "poster": "poster.webp"}


def fix_02():
    """烦高原图底栏标语误作“摇摆！！”：抹掉第二个叹号，补一条与其他封面一致的分隔竖线。
    结果存 art/gen/02-gaowen-fix.webp，原图不动。需要 OpenCV。"""
    import cv2
    im = np.array(Image.open(os.path.join(SRC, "02-gaowen.webp")).convert("RGB"))
    x0, y0, x1, y1 = 436, 1432, 460, 1468
    g = cv2.cvtColor(im[y0:y1, x0:x1], cv2.COLOR_RGB2GRAY)
    mask = np.zeros(im.shape[:2], np.uint8)
    mask[y0:y1, x0:x1] = cv2.dilate((g < 170).astype(np.uint8) * 255, np.ones((5, 5), np.uint8))
    out = Image.fromarray(cv2.inpaint(im, mask, 6, cv2.INPAINT_TELEA))
    ink = im[1438:1462, 410:428].reshape(-1, 3)
    ink = tuple(int(c) for c in ink[ink.sum(1).argsort()[:20]].mean(0))
    px0, py0, px1, py1 = 430, 1426, 466, 1474
    patch = out.crop((px0, py0, px1, py1)).resize(((px1 - px0) * 8, (py1 - py0) * 8), Image.LANCZOS)
    cx = (447 - px0) * 8
    ImageDraw.Draw(patch).rectangle([cx - 4, (1434 - py0) * 8, cx + 4, (1466 - py0) * 8], fill=ink)
    out.paste(patch.resize((px1 - px0, py1 - py0), Image.LANCZOS), (px0, py0))
    out.save(os.path.join(GEN, "02-gaowen-fix.webp"), quality=96)


def provided_path(key):
    fixed = os.path.join(GEN, f"{key}-fix.webp")
    return fixed if os.path.exists(fixed) else os.path.join(SRC, PROVIDED[key])


def art_canvas(key):
    """封面原图缩放到 ART_PX_W×ART_PX_H。"""
    im = Image.open(provided_path(key)).convert("RGB")
    im = im.resize((ART_PX_W, ART_PX_H), Image.LANCZOS)
    return im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=55, threshold=2))


def _cover_fill(im, w, h):
    s = max(w / im.width, h / im.height)
    big = im.resize((int(im.width * s + .5), int(im.height * s + .5)), Image.LANCZOS)
    x, y = (big.width - w) // 2, (big.height - h) // 2
    return big.crop((x, y, x + w, y + h))


def cover_page(key):
    art = art_canvas(key)
    # 补边：取原图最外3像素以内的颜色往外延展（不会把画面内容或金框重复一遍），
    # 再沿边方向大幅柔化成渐变（去掉条纹），越往外越暗一点
    a = np.asarray(art)[3:-3, 3:-3]
    py, px = ART_Y + 3, ART_X + 3
    pad = ((py, FULL_H - a.shape[0] - py), (px, FULL_W - a.shape[1] - px), (0, 0))
    bg = Image.fromarray(np.pad(a, pad, mode="edge"))
    bg = bg.resize((FULL_W // 60, FULL_H // 150), Image.BOX).resize((FULL_W, FULL_H), Image.BICUBIC)
    bg = bg.filter(ImageFilter.GaussianBlur(24))
    xs, ys = np.arange(FULL_W), np.arange(FULL_H)
    dx = np.clip(np.maximum(ART_X - xs, xs - (ART_X + ART_PX_W)) / ART_X, 0, 1)
    dy = np.clip(np.maximum(ART_Y - ys, ys - (ART_Y + ART_PX_H)) / ART_Y, 0, 1)
    dark = 1 - .3 * np.maximum(dx[None, :], dy[:, None])
    bg = Image.fromarray((np.asarray(bg, np.float32) * dark[..., None]).clip(0, 255).astype("uint8"))
    feather = 9
    m = np.ones((ART_PX_H, ART_PX_W), np.float32)
    ramp = np.clip((np.arange(feather) + 1) / (feather + 1), 0, 1)
    m[:feather, :] *= ramp[:, None]
    m[-feather:, :] *= ramp[::-1][:, None]
    m[:, :feather] *= ramp[None, :]
    m[:, -feather:] *= ramp[::-1][None, :]
    bg.paste(art, (ART_X, ART_Y), Image.fromarray((m * 255).astype("uint8")))
    return bg


def back_page(key):
    art = art_canvas(key)
    bg = _cover_fill(art, FULL_W, FULL_H).filter(ImageFilter.GaussianBlur(38))
    bg = ImageEnhance.Color(ImageEnhance.Brightness(bg).enhance(.36), ).enhance(.8)
    # 下部（底栏羊皮纸虚化后偏亮）再压暗，底部小字对比度够
    k = 1 - .55 * np.clip((np.arange(FULL_H) / FULL_H - .55) / .3, 0, 1)
    return Image.fromarray((np.asarray(bg, np.float32) * k[:, None, None]).astype("uint8"))


def ensure(key):
    """生成（或复用）封面、封底底图，返回两个文件路径。"""
    os.makedirs(OUT, exist_ok=True)
    cov, back = os.path.join(OUT, f"{key}-cover.jpg"), os.path.join(OUT, f"{key}-back.jpg")
    newest = max(os.path.getmtime(p) for p in (provided_path(key), os.path.abspath(__file__)))
    if not (os.path.exists(cov) and os.path.getmtime(cov) >= newest):
        cover_page(key).save(cov, quality=90, optimize=True, dpi=(DPI, DPI))
    if not (os.path.exists(back) and os.path.getmtime(back) >= newest):
        back_page(key).save(back, quality=86, optimize=True, dpi=(DPI, DPI))
    return cov, back


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "fix02":
        fix_02()
    else:
        for k in PROVIDED:
            print(k, *ensure(k))
