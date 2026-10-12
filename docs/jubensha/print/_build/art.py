"""封面美术：把封面原图排成带出血的整页底图。
- art/src/：出品方提供的原图（02、06、07、08 单人封面和全员海报 poster），1024×1536。
- art/gen/：01、03、04、05 没有单人封面，从全员海报裁切后用 EDSR×4 超分（见 sr_crops）；
  02-gaowen-fix.webp 是烦高原图标语去掉多余叹号的修图（见 fix_02）。都已提交，重做才需要 OpenCV-contrib。
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
PROVIDED = {"02-gaowen": "02-gaowen.webp", "06-gengen": "06-gengen.webp",
            "07-qianduoduo": "07-qianduoduo.webp", "08-linda": "08-linda.webp", "poster": "poster.webp"}
# 海报裁切（海报像素坐标，2:3）
CROPS = {"01-lajiao": (34, 74, 444, 649), "03-andefu": (514, 236, 896, 772),
         "04-mei": (199, 236, 591, 786), "05-maike": (34, 628, 368, 1097)}
# 补做的四张按整页（含出血 154×216）比例裁，直接满版，不用补边
# 裁进来的别的角色的脸做虚化压暗，当背景人物（页面比例坐标 x0, y0, x1, y1）
# 每项：x0, y0, x1, y1, 模糊半径, 亮度倍数, 羽化半径
SOFTEN = {"01-lajiao": [(.57, .34, 1.05, .78, 26, .3, 70)],
          "03-andefu": [(.7, -.05, 1.05, .34, 22, .42, 65), (.6, -.05, .75, .07, 22, .42, 25)],
          "04-mei": [(-.05, .08, .13, .62, 18, .5, 40), (.87, .1, 1.05, .66, 18, .5, 40),
                     (.15, -.05, .30, .075, 18, .5, 15), (.12, .26, .2, .58, 14, .6, 20)],
          "05-maike": [(.64, .14, 1.05, .70, 22, .42, 70), (.45, -.05, 1.05, .1, 18, .5, 30),
                       (-.05, -.05, .2, .1, 0, .55, 40)]}  # 最后一项只压暗不模糊：编号“05”底下


def sr_crops(model_path, keys=None):
    """重做 art/gen：裁海报四人并用 EDSR×4 超分。需要 opencv-contrib-python 和 EDSR_x4.pb。"""
    import cv2
    poster = cv2.cvtColor(np.array(Image.open(os.path.join(SRC, "poster.webp")).convert("RGB")), cv2.COLOR_RGB2BGR)
    sr = cv2.dnn_superres.DnnSuperResImpl_create()
    sr.readModel(model_path)
    sr.setModel("edsr", 4)
    os.makedirs(GEN, exist_ok=True)
    for key, (x0, y0, x1, y1) in CROPS.items():
        if keys and key not in keys:
            continue
        up = sr.upsample(poster[y0:y1, x0:x1])
        Image.fromarray(cv2.cvtColor(up, cv2.COLOR_BGR2RGB)).save(os.path.join(GEN, f"{key}.jpg"), quality=93)
        print("超分", key, up.shape)


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


def _noise(w, h, scale, rng):
    """低频噪声场，0—1。"""
    small = rng.random((max(2, h // scale), max(2, w // scale)))
    im = Image.fromarray((small * 255).astype("uint8")).resize((w, h), Image.BICUBIC)
    im = im.filter(ImageFilter.GaussianBlur(scale / 2))
    a = np.asarray(im, dtype=np.float32) / 255
    return (a - a.min()) / max(1e-6, a.max() - a.min())


def parchment_panel(w, h, top, seed):
    """大理石羊皮纸底栏（RGBA），top 以上透明；上沿是带雾气的不规则边。"""
    rng = np.random.default_rng(seed)
    base = np.array([241, 231, 207], np.float32)
    mott = _noise(w, h, 90, rng)[..., None] - .5
    grain = rng.normal(0, 1, (h, w, 1)).astype(np.float32)
    rgb = base + mott * np.array([22, 20, 16]) + grain * 3.2
    img = Image.fromarray(np.clip(rgb, 0, 255).astype("uint8"), "RGB")
    # 金色纹理
    veins = Image.new("L", (w * 2, h * 2), 0)
    d = ImageDraw.Draw(veins)
    for i in range(7):
        x, y = rng.uniform(-.1, .4) * w * 2, rng.uniform(top / h, 1.0) * h * 2
        ang = rng.uniform(-.5, .3)
        pts = [(x, y)]
        for _ in range(140):
            ang += rng.normal(0, .09)
            x += np.cos(ang) * 22
            y += np.sin(ang) * 22
            pts.append((x, y))
        d.line(pts, fill=int(rng.uniform(120, 200)), width=int(rng.integers(2, 5)))
        for b in range(3):
            j = int(rng.integers(10, 120))
            bx, by = pts[j]
            ba = ang + rng.choice([-1, 1]) * rng.uniform(.6, 1.1)
            bp = [(bx, by)]
            for _ in range(int(rng.integers(15, 45))):
                ba += rng.normal(0, .12)
                bx += np.cos(ba) * 16
                by += np.sin(ba) * 16
                bp.append((bx, by))
            d.line(bp, fill=int(rng.uniform(70, 140)), width=2)
    veins = veins.resize((w, h), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.1))
    gold = Image.new("RGB", (w, h), (190, 150, 86))
    img = Image.composite(gold, img, veins.point(lambda v: int(v * .42)))
    # 上沿：低频起伏＋细碎抖动，边缘柔化
    xs = np.arange(w)
    walk = np.cumsum(rng.normal(0, 1, w))
    walk = np.convolve(walk - walk.mean(), np.ones(61) / 61, mode="same")
    edge = top + walk / max(1e-6, np.abs(walk).max()) * h * .012 + rng.normal(0, 1.2, w)
    yy = np.arange(h)[:, None]
    alpha = np.clip((yy - edge[None, :]) / 10 + .5, 0, 1)
    # 雾：上沿以上一段乳白渐隐，带云状起伏
    fog_h = h * .07
    cloud = _noise(w, h, 40, rng)
    fog = np.clip(1 - (edge[None, :] - yy) / fog_h, 0, 1) ** 1.6 * (.55 + .45 * cloud)
    fog = np.where(yy < edge[None, :], fog * .85, 0)
    a = np.maximum(alpha, fog)
    out = img.convert("RGBA")
    out.putalpha(Image.fromarray((a * 255).astype("uint8")))
    return out


def standin_page(key):
    """补做封面的整页底图（含出血）：海报裁切超分图满版，顶部压暗，下方羊皮纸底栏（文字由版式叠加层另排）。
    底栏上沿对齐原图框的 73.5% 高度处，和出品方封面的位置一致。"""
    im = Image.open(os.path.join(GEN, f"{key}.jpg")).convert("RGB").resize((FULL_W, FULL_H), Image.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=1.0, percent=35, threshold=2))
    im = ImageEnhance.Brightness(im).enhance(1.06)
    for x0, y0, x1, y1, blur, bright, feather in SOFTEN.get(key, []):
        soft = ImageEnhance.Brightness(im.filter(ImageFilter.GaussianBlur(blur)) if blur else im).enhance(bright)
        m = Image.new("L", im.size, 0)
        ImageDraw.Draw(m).rectangle([int(x0 * FULL_W), int(y0 * FULL_H), int(x1 * FULL_W), int(y1 * FULL_H)], fill=255)
        im = Image.composite(soft, im, m.filter(ImageFilter.GaussianBlur(feather)))
    shade = np.clip(1 - np.arange(FULL_H) / (FULL_H * .14), 0, 1)[:, None, None] * .38
    im = Image.fromarray((np.asarray(im, np.float32) * (1 - shade)).astype("uint8"))
    panel = parchment_panel(FULL_W, FULL_H, ART_Y + int(ART_PX_H * .735), seed=sum(map(ord, key)))
    im = im.convert("RGBA")
    im.alpha_composite(panel)
    return im.convert("RGB")


def art_canvas(key):
    """封面原图缩放到 ART_PX_W×ART_PX_H；补做的四张取整页底图中原图框那一块（只给封底用）。"""
    if key in PROVIDED:
        im = Image.open(provided_path(key)).convert("RGB")
        im = im.resize((ART_PX_W, ART_PX_H), Image.LANCZOS)
        return im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=55, threshold=2))
    return standin_page(key).crop((ART_X, ART_Y, ART_X + ART_PX_W, ART_Y + ART_PX_H))


def _cover_fill(im, w, h):
    s = max(w / im.width, h / im.height)
    big = im.resize((int(im.width * s + .5), int(im.height * s + .5)), Image.LANCZOS)
    x, y = (big.width - w) // 2, (big.height - h) // 2
    return big.crop((x, y, x + w, y + h))


def cover_page(key):
    if key not in PROVIDED:
        return standin_page(key)
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
    srcs = [provided_path(key)] if key in PROVIDED else [os.path.join(GEN, f"{key}.jpg")]
    newest = max(os.path.getmtime(p) for p in srcs + [os.path.abspath(__file__)])
    if not (os.path.exists(cov) and os.path.getmtime(cov) >= newest):
        cover_page(key).save(cov, quality=90, optimize=True, dpi=(DPI, DPI))
    if not (os.path.exists(back) and os.path.getmtime(back) >= newest):
        back_page(key).save(back, quality=86, optimize=True, dpi=(DPI, DPI))
    return cov, back


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 2 and sys.argv[1] == "sr":
        sr_crops(sys.argv[2], sys.argv[3:])
    elif len(sys.argv) > 1 and sys.argv[1] == "fix02":
        fix_02()
    else:
        for k in list(PROVIDED) + list(CROPS):
            print(k, *ensure(k))
