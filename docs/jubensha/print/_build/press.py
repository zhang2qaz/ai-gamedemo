"""《摇摆！》印刷文件：按 DM手册1.2／卡面册印制总表拆册排版，出带3mm出血的PDF。
用法：python3 press.py [角色key或 rules/dm/print/scripts/forms ...]   不带参数则全部重出。
      python3 press.py proof   全部重出，另在 ../ 下出合订校对版（几册接起来、裁到成品尺寸，只供屏幕通读，不提交）。
输出：../印刷文件/   交印厂的文件（A5＋3mm出血，TrimBox 已标；装订册页数为4的倍数，可骑马钉）
依赖：python-markdown、Pillow、numpy、pypdf、Playwright Chromium（node）。"""
import html as H
import json, os, re, shutil, subprocess, sys
import markdown
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject

import art as A
import build as B

ROOT = B.ROOT
P3 = B.P3
OUT = B.OUT
PRESS = os.path.join(OUT, "印刷文件")
WORK = os.path.join(ROOT, "_press")
MM = 72 / 25.4
TRIM_W, TRIM_H = 148.0, 210.0
BLEED = A.BLEED
FOOT = "Ascham工作室 · 城限欢乐阵营本 · 6–8人 · 约6小时"

# 补做封面（海报裁切）的党派与身份；出品方原图自带文字，不用这一项
STANDIN = {"01-lajiao": "驴友党 · 网红议员", "03-andefu": "驴友党 · 党鞭",
           "04-mei": "驴友党 · 通讯总监", "05-maike": "大象党 · 播客之王"}
# 册名缎带：位置（原图1024宽坐标的中心x）按各封面画面避让
RIBBON_X = {"02-gaowen": 958, "07-qianduoduo": 958}
ACTS = [  # 断开的一级标题、册名、拉丁小字、缎带底色、停读标记
    (None, "第一幕册", "ACT I", "#7c1e22", "■ 第一幕 完 ■"),
    ("# 第二幕", "第二幕册", "ACT II", "#1d3a63", "■ 第二幕 完 ■"),
    ("# 第三幕", "第三幕册", "ACT III", "#24513b", "■ 第三幕 完 ■"),
    ("# 终局", "终局册", "FINALE", "#2b2420", "■ 终局 完 ■"),
]
SCRIPTS = [("序幕", "prologue.md"), ("第二幕", "act2.md"), ("第三幕", "act3.md"), ("终局", "finale.md")]


# ───────────────────────── 样式 ─────────────────────────

def page_css(label, color):
    base = re.sub(r"@page[^}]*}\n", "", B.CSS)
    base = re.sub(r"\.cover[^}]*}\n", "", base).replace("VAR_C", color)
    lab = label.replace('"', '\\"')
    fonts = B.font_css().replace("url(fonts/", f"url(file://{ROOT}/fonts/")
    for fam, files in (("Cinzel", ((500, "Cinzel-Medium"), (700, "Cinzel-Bold"))),
                       ("Cormorant Garamond", ((500, "CormorantGaramond-Medium"), (600, "CormorantGaramond-SemiBold"),
                                               (700, "CormorantGaramond-Bold")))):
        for w, f in files:
            fonts += (f"\n@font-face{{font-family:'{fam}';font-weight:{w};font-style:normal;"
                      f"src:url(file://{ROOT}/fonts/static/{f}.ttf) format('truetype');}}")
    b = BLEED
    return fonts + f"""
@page {{ size: {TRIM_W + 2 * b}mm {TRIM_H + 2 * b}mm; margin: {16 + b}mm {13 + b}mm {17 + b}mm {13 + b}mm;
  @bottom-left {{ content: "{lab}"; font-family: 'Noto Sans SC'; font-size: 7pt; color: #4a4a48; }}
  @bottom-right {{ content: counter(page); font-family: 'Noto Sans SC'; font-size: 7pt; color: #4a4a48; }} }}
@page cover {{ margin: 0; @bottom-left {{ content: none; }} @bottom-right {{ content: none; }} }}
@page bare {{ @bottom-left {{ content: none; }} @bottom-right {{ content: none; }} }}
""" + base + f"""
.cover {{ page: cover; position: relative; width: {TRIM_W + 2 * b}mm; height: {TRIM_H + 2 * b}mm; overflow: hidden; break-before: page; break-after: page; }}
.cover > img.bg {{ position: absolute; left: 0; top: 0; width: 100%; height: 100%; }}
.cover > svg {{ position: absolute; overflow: visible; }}
.titlepage {{ page: bare; height: 172mm; }}
.titlepage .t4 {{ font-family: 'Noto Sans SC'; font-weight: 900; font-size: 13pt; color: {color}; margin: 1mm 0 0; letter-spacing: .08em; }}
.notes, .blank {{ page: bare; break-before: page; }}
.notes .nt {{ font-family: 'Noto Sans SC'; font-weight: 700; font-size: 10pt; color: #8a8270; letter-spacing: .3em; border-bottom: 0.4mm solid #8a8270; padding-bottom: 1.5mm; }}
.blank {{ height: 172mm; position: relative; }}
.blank .mark {{ position: absolute; right: 0; top: 80mm; width: 30mm; font-family: 'Noto Sans SC'; font-size: 6.5pt; color: #b0a894; text-align: right; line-height: 1.5; }}
.seal {{ break-before: page; }}
.seal .stop {{ break-after: auto; margin: 0 0 6mm; }}
.sealintro {{ break-before: page; }}
.sealintro h1 {{ break-before: avoid; }}
.sealbox {{ margin-top: 8mm; padding: 4mm 5mm; border: 0.5mm solid #1b1a17; background: #f3e9d4; font-family: 'Noto Sans SC'; font-size: 9.5pt; line-height: 1.8; }}
.back .backtext {{ position: absolute; left: {b + 14}mm; right: {b + 14}mm; top: {b + 52}mm; text-align: center; color: #ead7a4; }}
.back .b1 {{ font-family: 'Noto Serif SC'; font-weight: 900; font-size: 40pt; letter-spacing: .12em; margin: 0; color: #f0dca6; }}
.back .b2 {{ font-family: 'Noto Serif SC'; font-weight: 700; font-size: 11pt; letter-spacing: .5em; margin: 3mm 0 0; }}
.back .brule {{ width: 34mm; margin: 9mm auto; border-top: 0.35mm solid #c9a75e; }}
.back .b3 {{ font-family: 'Noto Sans SC'; font-weight: 700; font-size: 11pt; letter-spacing: .1em; margin: 0 0 4mm; }}
.back .b4 {{ font-family: 'Noto Sans SC'; font-size: 8.6pt; line-height: 1.9; margin: 0 auto; max-width: 96mm; color: #dcc995; text-align: center; }}
.back .b5 {{ position: absolute; left: 0; right: 0; bottom: {b + 14}mm; text-align: center; font-family: 'Noto Sans SC'; font-size: 7pt; letter-spacing: .12em; color: #b9a678; }}
.back .b5x {{ position: absolute; left: 0; right: 0; bottom: {b + 9}mm; text-align: center; font-family: 'Cinzel'; font-size: 7pt; letter-spacing: .5em; color: #9c8a60; }}
.card {{ font-size: 9.6pt; line-height: 1.62; }}
.card h2:first-child {{ margin-top: 0; }}
.card p, .card li {{ margin-bottom: 1.4mm; }}
pre {{ margin: 2mm 0 3.5mm; padding: 2mm 2.5mm; background: #f6f1e6; border: 0.3mm solid #cfc4ad; font-size: 7.4pt; line-height: 1.4; white-space: pre; break-inside: avoid; }}
pre code {{ background: none; padding: 0; font-family: 'Noto Sans SC'; }}
td, th, p, li {{ overflow-wrap: anywhere; }}
td.nw, th.nw {{ white-space: nowrap; }}
table.intel, table.spec {{ table-layout: fixed; }}
table.spec {{ font-size: 7.8pt; }}
table.spec td, table.spec th {{ white-space: normal; padding: 1.1mm 1mm; }}
table.spec th:nth-child(1) {{ width: 13%; }} table.spec th:nth-child(2) {{ width: 13%; }} table.spec th:nth-child(3) {{ width: 7%; }}
table.spec th:nth-child(4), table.spec th:nth-child(5), table.spec th:nth-child(6) {{ width: 11%; }}
table.intel th:nth-child(1), table.intel td:nth-child(1) {{ width: 32%; }}
table.intel th:nth-child(2), table.intel td:nth-child(2) {{ width: 40%; }}
h1, h2, h3, h4, p.lead {{ break-after: avoid; }}
.titlepage p, .back p {{ text-align: center; }}
blockquote {{ box-shadow: none; border-right: 1.3mm solid {color}; border-bottom: 1.3mm solid {color}; -webkit-box-decoration-break: clone; box-decoration-break: clone; }}
blockquote.long {{ break-inside: auto; }}
.note, .sealbox, .stop, .yanyi, pre, blockquote {{ box-sizing: border-box; margin-right: 0.6mm; }}
.titlepage .note {{ align-self: stretch; margin-left: 0.3mm; }}
.mock {{ border: 0.5mm solid #1b1a17; border-radius: 1mm; padding: 2.5mm 3.5mm; margin: 2mm 0 4mm; font-family: 'Noto Sans SC'; font-size: 8.8pt; line-height: 1.6; break-inside: avoid; max-width: 104mm; background: #fffdf8; box-sizing: border-box; }}
.mock.plain {{ border-style: dashed; border-color: #8a8270; max-width: none; }}
.mock .c {{ text-align: center; }}
.mock .r {{ text-align: right; }}
.mock .i {{ padding-left: 2em; }}
.mock .mk-gap {{ height: 0.7em; }}
.mock .mk-hr {{ border-top: 0.3mm solid #8a8270; margin: 1mm 0; }}
.mock .mk-cols {{ display: grid; column-gap: 4mm; }}
"""


# ───────────────────────── 封面叠加层（原图1024×1536坐标） ─────────────────────────

DEFS = """<defs>
<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbedbd"/><stop offset=".55" stop-color="#d9b46a"/><stop offset="1" stop-color="#a77b31"/></linearGradient>
<linearGradient id="goldh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a77b31"/><stop offset=".5" stop-color="#f3dc9a"/><stop offset="1" stop-color="#a77b31"/></linearGradient>
<linearGradient id="bronze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a7434"/><stop offset=".45" stop-color="#6e4c1c"/><stop offset="1" stop-color="#3f2a0f"/></linearGradient>
<filter id="sh" x="-20%" y="-5%" width="140%" height="115%"><feGaussianBlur stdDeviation="3"/></filter>
</defs>"""


def _corner(x, y, sx, sy):
    return (f'<g transform="translate({x},{y}) scale({sx},{sy})" fill="none" stroke="url(#gold)" stroke-width="1.6">'
            '<path d="M0,40 C2,22 8,10 18,6 C26,3 32,8 28,14 C25,19 18,16 20,11"/>'
            '<path d="M40,0 C22,2 10,8 6,18 C3,26 8,32 14,28 C19,25 16,18 11,20"/>'
            '<path d="M8,8 L13,13" stroke-width="2.4"/></g>')


def standin_layer(no, name, party_role):
    """补做封面的金框、编号、ASCHAM、角色名、党派身份、标语，仿出品方封面版式。"""
    ls = 40 if len(name) == 2 else 10
    out = [
        '<rect x="11" y="11" width="1002" height="1514" fill="none" stroke="url(#gold)" stroke-width="2.4"/>',
        '<rect x="17" y="17" width="990" height="1502" fill="none" stroke="url(#gold)" stroke-width=".9"/>',
        _corner(17, 17, 1, 1), _corner(1007, 17, -1, 1), _corner(17, 1519, 1, -1), _corner(1007, 1519, -1, -1),
        f'<text x="42" y="80" font-family="Cormorant Garamond" font-weight="600" font-size="50" fill="url(#gold)">{no}</text>',
        '<text x="516" y="50" text-anchor="middle" font-family="Cinzel" font-weight="500" font-size="17" letter-spacing="9" fill="url(#gold)">ASCHAM</text>',
        '<path d="M462,64 H500 M524,64 H562" stroke="url(#goldh)" stroke-width="1.2"/><path d="M512,58 L518,64 L512,70 L506,64 Z" fill="url(#gold)"/>',
        f'<text x="{512 + ls / 2}" y="1326" text-anchor="middle" font-family="Noto Serif SC" font-weight="900" font-size="150" letter-spacing="{ls}" fill="#2a1a06" opacity=".22" filter="url(#sh)" transform="translate(3,5)">{name}</text>',
        f'<text x="{512 + ls / 2}" y="1326" text-anchor="middle" font-family="Noto Serif SC" font-weight="900" font-size="150" letter-spacing="{ls}" fill="url(#bronze)">{name}</text>',
        '<path d="M292,1366 H488 M536,1366 H732" stroke="#8b6a2e" stroke-width="1.5"/>'
        '<path d="M512,1356 L522,1366 L512,1376 L502,1366 Z" fill="#8b6a2e"/>'
        '<circle cx="492" cy="1366" r="2.6" fill="#8b6a2e"/><circle cx="532" cy="1366" r="2.6" fill="#8b6a2e"/>',
        f'<text x="514" y="1418" text-anchor="middle" font-family="Noto Serif SC" font-weight="700" font-size="37" letter-spacing="4" fill="#3a2812">{party_role}</text>',
        '<text x="512" y="1480" text-anchor="middle" font-family="Noto Serif SC" font-weight="700" font-size="31" letter-spacing="7" fill="#3a2812">摇摆！　<tspan font-weight="400" fill="#8b6a2e">|</tspan>　两边都是我的人</text>',
    ]
    return "".join(out)


def ribbon(cx, title, latin, color, top=-70, bottom=332):
    """挂在顶边的册名缎带。"""
    w = 86
    x0, x1 = cx - w / 2, cx + w / 2
    gid = "rb" + color.strip("#")
    chars = list(title)
    size, step = (41, 60) if len(chars) >= 4 else (44, 62)
    txt = "".join(f'<text x="{cx}" y="{106 + i * step + size * .36:.1f}" text-anchor="middle" font-family="Noto Serif SC" '
                  f'font-weight="900" font-size="{size}" fill="url(#gold)">{c}</text>' for i, c in enumerate(chars))
    notch = 28
    path = f"M{x0},{top} H{x1} V{bottom} L{cx},{bottom - notch} L{x0},{bottom} Z"
    inner = f"M{x0 + 7},{top} V{bottom - 9} L{cx},{bottom - notch - 8} L{x1 - 7},{bottom - 9} V{top}"
    return (f'<defs><linearGradient id="{gid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{color}" stop-opacity="1"/>'
            f'<stop offset=".5" stop-color="{color}" stop-opacity=".86"/><stop offset="1" stop-color="{color}" stop-opacity="1"/></linearGradient></defs>'
            f'<path d="{path}" fill="#000" opacity=".35" filter="url(#sh)" transform="translate(4,6)"/>'
            f'<path d="{path}" fill="{color}"/><path d="{path}" fill="url(#{gid})"/>'
            f'<path d="{path}" fill="none" stroke="#c9a75e" stroke-width="1.2"/>'
            f'<path d="{inner}" fill="none" stroke="url(#gold)" stroke-width="1.6"/>'
            f'<text x="{cx}" y="62" text-anchor="middle" font-family="Cinzel" font-weight="700" font-size="13" letter-spacing="2" fill="url(#gold)">{latin}</text>'
            + txt)


def plaque(title, sub=None, secret=False, y=962):
    """海报封面用的书名牌，放在人物下方、大字标题上方的桌面区。"""
    h = 112 if sub else 96
    s = (f'<rect x="214" y="{y}" width="596" height="{h}" fill="#140e08" opacity=".86"/>'
         f'<rect x="214" y="{y}" width="596" height="{h}" fill="none" stroke="url(#gold)" stroke-width="2.4"/>'
         f'<rect x="221" y="{y + 7}" width="582" height="{h - 14}" fill="none" stroke="url(#gold)" stroke-width=".9"/>'
         f'<text x="515" y="{y + 64}" text-anchor="middle" font-family="Noto Serif SC" font-weight="900" font-size="50" letter-spacing="6" fill="url(#gold)">{title}</text>')
    if sub:
        s += (f'<text x="512" y="{y + 94}" text-anchor="middle" font-family="Noto Sans SC" font-weight="700" font-size="17" '
              f'letter-spacing="3" fill="#e8c98a">{sub}</text>')
    if secret:
        cx, cy = 770, y - 4
        s += (f'<g transform="rotate(-14 {cx} {cy})"><circle cx="{cx}" cy="{cy}" r="44" fill="#f4e6c8" opacity=".9"/>'
              f'<circle cx="{cx}" cy="{cy}" r="44" fill="none" stroke="#a3221b" stroke-width="5"/>'
              f'<circle cx="{cx}" cy="{cy}" r="37" fill="none" stroke="#a3221b" stroke-width="1.5"/>'
              f'<text x="{cx}" y="{cy + 12}" text-anchor="middle" font-family="Noto Serif SC" font-weight="900" font-size="32" fill="#a3221b">机密</text></g>')
    return s


def cover_html(art_key, layer):
    cov, _ = A.ensure(art_key)
    bx = A.ART_BOX
    return (f'<section class="cover"><img class="bg" src="file://{cov}">'
            f'<svg viewBox="0 0 1024 1536" style="left:{bx["left"]:.3f}mm;top:{bx["top"]:.3f}mm;width:{bx["width"]:.3f}mm;height:{bx["height"]:.3f}mm">'
            f'{DEFS}{layer}</svg></section>')


def back_html(art_key, l3, l4):
    _, back = A.ensure(art_key)
    return (f'<section class="cover back"><img class="bg" src="file://{back}"><div class="backtext">'
            f'<p class="b1">摇摆！</p><p class="b2">两边都是我的人</p><div class="brule"></div>'
            f'<p class="b3">{l3}</p><p class="b4">{l4}</p></div>'
            f'<p class="b5">{FOOT}</p><p class="b5x">ASCHAM</p></section>')


def notes_html(n):
    lines = "".join(f'<line x1="0" y1="{14 + i * 8}" x2="122" y2="{14 + i * 8}"/>' for i in range(19))
    page = (f'<section class="notes"><div class="nt">笔　记</div>'
            f'<svg width="122mm" height="166mm" viewBox="0 0 122 166"><g stroke="#d6cdb9" stroke-width=".25">{lines}</g></svg></section>')
    return page * n


def blank_html(mark=""):
    return f'<section class="blank"><div class="mark">{mark}</div></section>'


FENCE_RE = re.compile(r"^```[^\n]*\n(.*?)\n```[ \t]*$", re.M | re.S)
PATH_RE = re.compile(r"[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+){2,}")
CELL_RE = re.compile(r"<(td|th)>(.*?)</\1>", re.S)


def mock_html(block):
    """卡面册里用框线字符画的样张 → 带边框的HTML卡片（不靠等宽对齐）。
    行首缩进≥7居中、3—6缩进、无框文件里≥16靠右；行内两个以上空格隔开的几段排成等宽栏。"""
    lines = block.split("\n")
    boxed = lines[0].lstrip().startswith("┌")
    rows = []
    for ln in lines:
        t = ln.rstrip()
        if t.lstrip().startswith(("┌", "└")):
            continue
        if t.lstrip().startswith("├"):
            rows.append('<div class="mk-hr"></div>')
            continue
        if boxed:
            t = t.strip()
            t = t[1:] if t.startswith("│") else t
            t = t[:-1] if t.endswith("│") else t
            t = t.rstrip()
        lead = len(t) - len(t.lstrip(" "))
        t = t.strip()
        if not t:
            rows.append('<div class="mk-gap"></div>')
            continue
        segs = re.split(r" {2,}", t)
        if len(segs) > 1:
            cells = "".join(f"<span>{H.escape(x)}</span>" for x in segs)
            rows.append(f'<div class="mk-cols" style="grid-template-columns:repeat({len(segs)},auto)">{cells}</div>')
            continue
        cls = ("r" if lead >= 16 and not boxed else "c" if lead >= 7 and boxed else "i" if lead >= 3 else "")
        rows.append(f'<div class="{cls}">{H.escape(t)}</div>')
    return f'\n\n<div class="mock{"" if boxed else " plain"}">{"".join(rows)}</div>\n\n'


def md_html(md_text, name=None):
    md_text = FENCE_RE.sub(lambda m: mock_html(m.group(1)), md_text)
    md_text = re.sub(r"(?m)^ {2,3}([-*+] |\d+[.)] )", r"    \1", md_text)  # 2—3格缩进的子列表
    md_text = PATH_RE.sub(lambda m: m.group(0).replace("/", "/\u200b"), md_text)  # 长路径允许折行
    md_text = B.inject_yanyi(B.normalize_md(md_text), name)
    h = markdown.markdown(md_text, extensions=["tables", "sane_lists", "md_in_html", "attr_list"])

    def cell(m):  # 短格不折行，免得表格自动列宽把人名、编号、时刻挤成一字一行
        txt = H.unescape(re.sub(r"<[^>]+>", "", m.group(2))).strip()
        nw = 0 < len(txt) <= 7 and "<br" not in m.group(2)
        cls = ' class="nw"' if nw else ""
        return f"<{m.group(1)}{cls}>{m.group(2)}</{m.group(1)}>"
    h = CELL_RE.sub(cell, h)
    h = re.sub(r"<table>(\s*<thead>\s*<tr>\s*<th[^>]*>✅)", r'<table class="intel">\1', h)
    h = re.sub(r"<table>(\s*<thead>\s*<tr>\s*<th[^>]*>物料</th>\s*<th[^>]*>尺寸)", r'<table class="spec">\1', h)
    h = re.sub(r"<p>(<strong>(?:(?!</p>).)*</strong>)</p>", r'<p class="lead">\1</p>', h, flags=re.S)
    h = re.sub(r"<p>(?=(?:(?!</?p[ >]).)*[：:]</p>)", '<p class="lead">', h, flags=re.S)
    h = re.sub(r"<blockquote>((?:(?!</blockquote>).){500,}?)</blockquote>", r'<blockquote class="long">\1</blockquote>', h, flags=re.S)
    return h


def titlepage(t2, t3, t4, note):
    return (f'<section class="titlepage"><p class="t1">摇摆！</p><div class="rule"></div>'
            f'<p class="t2">{t2}</p><p class="t3">{t3}</p><p class="t4">{t4}</p>'
            f'<div class="note">{note}</div><p class="t3" style="margin-top:12mm">{FOOT}</p></section>')


def doc(title, css, parts):
    return (f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>{H.escape(title)}</title>'
            f'<style>{css}</style></head><body>{"".join(parts)}</body></html>')


# ───────────────────────── 书目 ─────────────────────────

class Job:
    """一册：head＝封面到正文末，tail＝填充页之后的固定尾部（封口页、封底）；pad_rule 决定填几页。"""

    def __init__(self, out, title, css, head, tail_fn, pad_rule, trim=(TRIM_W, TRIM_H)):
        self.out, self.title, self.css, self.head, self.tail_fn, self.pad_rule = out, title, css, head, tail_fn, pad_rule
        self.trim = trim

    def html(self, pad):
        return doc(self.title, self.css, self.head + [notes_html(pad)] + self.tail_fn())


def pad_booklet(k):
    """普通册：封面1＋正文k＋填充p＋封底1，总页数为4的倍数。"""
    return (2 - k) % 4


def pad_finale(k):
    """终局册：封面1＋正文k＋填充p＋封口块6＋封三1＋封底1；封口块第一页须在右手页（奇数页）。"""
    return (3 - k) % 4


def character_jobs(key, src, cv):
    md = open(os.path.join(P3, src), encoding="utf-8").read()
    name, no = cv["name"], cv["no"].replace("No.", "")
    color = "#1f4e9c" if cv["party"] == "驴" else "#b8322a"
    cuts = [md.index("\n" + a[0]) for a in ACTS[1:]] + [md.index("\n# 结局")]
    bounds = [0] + cuts
    parts = [md[bounds[i]:bounds[i + 1]] for i in range(4)]
    ending = md[cuts[-1]:]
    m1, m2 = ending.index('<div class="stop">■ 封口页一'), ending.index('<div class="stop">■ 封口页二')
    intro, e1, e2 = ending[:m1], ending[m1:m2], ending[m2:]
    jobs = []
    folder = os.path.join(PRESS, "角色本", f"{no}-{name}")
    for i, (_, book, latin, rcolor, stop) in enumerate(ACTS):
        act_title = re.search(r"^# (第.幕|终局) · (.+)$", parts[i], re.M)
        sub = act_title.group(2) if act_title else ""
        label = f"摇摆！· {name} · {book}"
        css = page_css(label, color)
        layer = (standin_layer(no, name, STANDIN[key]) if key in STANDIN else "") + \
            ribbon(RIBBON_X.get(key, 912), book, latin, rcolor)
        common = "不能出示本册原文；线索卡和拍到的遗物线索可以给人看，不能转手。"
        if i == 0:
            note = (f"本角色本共四册，终局册末尾另订两张封口结局页。DM发哪一册才读哪一册；本册读到“{stop}”立即合上，等待DM指示。"
                    f"「我的底牌」在本册，整局随时可以翻回来看。<br>{common}")
        elif i < 3:
            note = f"DM发下本册后才可翻开。读到“{stop}”立即合上，等待DM指示。<br>{common}"
        else:
            note = (f"DM发下本册后才可翻开。读到“{stop}”立即合上，等待DM指示。本册末尾是两张封口结局页："
                    f"复盘时DM报到哪一张才撕开哪一张，另一张整局不拆。<br>{common}")
        head = [cover_html(key, layer),
                titlepage(f"No.{no}　{name}", cv["role"], f"{book} · {sub}", note),
                f"<main>{md_html(parts[i], name)}</main>"]
        b4 = f"本册只属于你。读到“{stop}”请合上，等待DM指示。"
        if i < 3:
            tail = (lambda key=key, no=no, name=name, book=book, b4=b4:
                    [back_html(key, f"No.{no}　{name} · {book}", b4)])
            rule = pad_booklet
        else:
            def tail(key=key, no=no, name=name, book=book, b4=b4, intro=intro, e1=e1, e2=e2):
                box = ("<div class=\"sealbox\">下面两张是<strong>封口页</strong>，出厂时各用一枚封口贴封住。"
                       "复盘时DM报“结局一”只撕开封口页一，报“结局二”只撕开封口页二；另一张整局不拆。</div>")
                return [f'<section class="sealintro">{md_html(intro)}{box}</section>',
                        blank_html("封口一：本页与右页沿外侧开口边贴封口贴"),
                        f'<section class="seal">{md_html(e1)}</section>',
                        blank_html("封口二：本页与右页沿外侧开口边贴封口贴"),
                        f'<section class="seal">{md_html(e2)}</section>',
                        blank_html(), notes_html(1),
                        back_html(key, f"No.{no}　{name} · {book}", b4)]
            rule = pad_finale
        out = os.path.join(folder, f"{no}-{name}-{i + 1}-{book}.pdf")
        jobs.append(Job(out, f"摇摆！· {name} · {book}", css, head, tail, rule))
    return jobs


def rules_jobs():
    md = open(os.path.join(P3, "public", "rules.md"), encoding="utf-8").read()
    cut = [md.index("\n## 第一幕规则卡"), md.index("\n## 第二幕规则卡"), md.index("\n## 第三幕规则卡"), md.index("\n## 终局规则卡")]
    opening = md[:cut[0]].rstrip().rstrip("-").rstrip()
    cards = [md[cut[i]:(cut[i + 1] if i + 1 < len(cut) else len(md))].strip().rstrip("-").rstrip() for i in range(4)]
    color = "#1f4e9c"
    folder = os.path.join(PRESS, "规则书")
    jobs = []
    css = page_css("摇摆！· 节目单与规则书", color)
    head = [cover_html("poster", plaque("节目单与规则书", "全员公开物料 · 片头发")),
            titlepage("节目单与规则书", "《今夜不睡·大选特别季》公共物料", "片头发 · 每人一份",
                      "片头和本册一起发第一幕规则卡；第二幕、第三幕、终局开场，DM再发当幕规则卡。规则以本册和规则卡为准。"),
            f"<main>{md_html(opening)}</main>"]
    jobs.append(Job(os.path.join(folder, "规则书-0-节目单与片头规则.pdf"), "摇摆！· 节目单与规则书", css, head,
                    lambda: [back_html("poster", "节目单与规则书", "规则以本册和各幕规则卡为准。")], pad_booklet))
    for i, c in enumerate(cards):
        t = re.match(r"## (\S+)", c.strip()).group(1)
        css = page_css(f"摇摆！· {t}", color)
        jobs.append(Job(os.path.join(folder, f"规则书-{i + 1}-{t}.pdf"), f"摇摆！· {t}", css,
                        [f'<main class="card">{md_html(c)}</main>'], lambda: [], lambda k: 0))
    return jobs


def scripts_jobs():
    jobs = []
    for i, (t, f) in enumerate(SCRIPTS):
        md = open(os.path.join(P3, "shared", f), encoding="utf-8").read()
        css = page_css(f"摇摆！· 全员演绎台本 · {t}", "#7a5c2e")
        jobs.append(Job(os.path.join(PRESS, "演绎台本", f"台本-{i + 1}-{t}.pdf"), f"摇摆！· 演绎台本 · {t}", css,
                        [f'<main><div class="yanyi">{md_html(md)}</div></main>'], lambda: [], lambda k: k % 2))
    return jobs


def dm_job():
    md = open(os.path.join(P3, "dm", "dm-manual.md"), encoding="utf-8").read()
    md += "\n\n# 附录 · 全员演绎台本（DM朗读版）\n\n" + "\n\n".join(f"<!--演绎:{w}-->" for w, _ in SCRIPTS)
    color = "#b8322a"
    css = page_css("摇摆！· DM主持手册", color)
    head = [cover_html("poster", plaque("DM主持手册", "主持人：贾不睡 · 开本前勿让玩家看到", secret=True)),
            titlepage("DM主持手册", "流程、主持词与机密附录（主持人：贾不睡）", "DM专用 · 含机密",
                      "本册供DM使用，单DM可开，场控可选。开本前请完整通读一遍；含机密附录，开本前后都不要让玩家看到。"),
            f"<main>{md_html(md)}</main>"]
    return Job(os.path.join(PRESS, "DM", "DM主持手册.pdf"), "摇摆！· DM主持手册", css, head,
               lambda: [back_html("poster", "DM主持手册", "含机密附录。请收好，不要让玩家看到。")], pad_booklet)


def print_job():
    md = open(os.path.join(P3, "public", "cards-print.md"), encoding="utf-8").read()
    color = "#1b1a17"
    css = page_css("摇摆！· 卡面与物料印刷册", color)
    head = [cover_html("poster", plaque("卡面与物料印刷册", "只交印厂与DM · 不得交给玩家", secret=True)),
            titlepage("卡面与物料印刷册", "全部卡面正文（含机密，只交印厂与DM）", "印厂与DM专用 · 含机密",
                      "本册收全部卡面版式与正文，按“印制总表”的尺寸、正反、数量开印。含机密正文，不得交给玩家。"),
            f"<main>{md_html(md)}</main>"]
    return Job(os.path.join(PRESS, "印厂", "卡面与物料印刷册.pdf"), "摇摆！· 卡面与物料印刷册", css, head,
               lambda: [back_html("poster", "卡面与物料印刷册", "含机密正文，只交印厂与DM。")], pad_booklet)


FORM_CSS = """
@page { size: 210mm 297mm; margin: 9mm 12mm 8mm 12mm; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: 'Noto Sans SC'; color: #1b1a17; font-size: 8.4pt; line-height: 1.45; margin: 0; }
.sheet { break-after: page; }
.sheet:last-child { break-after: auto; }
.hd { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1mm solid #1b1a17; padding-bottom: 1.5mm; margin-bottom: 3mm; }
.hd b { font-size: 15pt; font-weight: 900; }
.hd span { font-size: 8pt; color: #4a4a48; }
h3 { font-size: 9.4pt; font-weight: 900; margin: 2.4mm 0 1mm; }
h3 small { font-weight: 400; color: #4a4a48; font-size: 7.6pt; margin-left: 2mm; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 0.25mm solid #6d675c; padding: 0.3mm 1.2mm; vertical-align: middle; height: 5.2mm; line-height: 1.2; }
th { background: #ece4d3; font-weight: 700; font-size: 7.8pt; }
td.c { text-align: center; }
td.w { height: 5.2mm; }
.grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 8mm; }
.grid h3 { margin-top: 2mm; }
.box { display: inline-block; width: 3.2mm; height: 3.2mm; border: 0.3mm solid #1b1a17; vertical-align: -0.6mm; margin: 0 0.6mm 0 1.6mm; }
.line { display: inline-block; border-bottom: 0.25mm solid #1b1a17; min-width: 18mm; margin: 0 1mm; }
.row { margin: 1.2mm 0; }
.lines div { border-bottom: 0.25mm solid #9b9486; height: 6mm; }
.note { font-size: 7.4pt; color: #4a4a48; margin-top: 1.5mm; }
"""

CAST = [("01", "皮拉提"), ("02", "烦高"), ("03", "下木"), ("04", "梅戏"),
        ("05", "麦克播"), ("06", "半步爹"), ("07", "建国钱"), ("08", "狗登罗")]
SKILL = {"01": "直播带票", "02": "稳如发胶", "03": "党鞭点票", "04": "终极特稿",
         "05": "三小时连麦", "06": "身后半步", "07": "开盒", "08": "背调"}
STRICT = {"03", "06", "07"}  # 知情人：4问全对才得星（DM手册1.5第7条、4.3⑤）


def forms_job():
    box = '<span class="box"></span>'
    heads = "".join(f"<th>{n}<br>{m}</th>" for n, m in CAST)
    votes = [f"账本第{i}页（锤／洗）" for i in range(1, 9)] + ["扒马褂·辩：＿＿＿＿"] * 4
    s1 = "".join(f"<tr><td>{v}</td>" + '<td class="c"></td>' * 8 + "<td></td></tr>" for v in votes)
    sk = []
    for n, m in CAST:
        if n == "06":
            cnt = f"第一幕{box}第二幕{box}第三幕{box}终局{box}　拍品＋1{box}"
        else:
            cnt = f"{box}　拍品＋1{box}"
        sk.append(f"<tr><td>{n} {m}</td><td>{SKILL[n]}</td><td>{cnt}</td><td class=\"w\"></td></tr>")
    truth = "".join(f"<tr><td>{n} {m}</td>" + '<td class="c"></td>' * 4 +
                    f"<td>{'<b>4问全对</b>' if n in STRICT else '①对＋另三题对≥2'}</td><td class=\"c\">{box}</td></tr>"
                    for n, m in CAST)
    scenes = "".join(f"{n}{m}{box}　" for n, m in CAST)
    sheet1 = f"""<section class="sheet"><div class="hd"><b>摇摆！· DM台账（一）</b><span>DM手册1.5 · 全程只有DM看 · 开本前每局打印一份</span></div>
<h3>1 闭眼举牌记录<small>每格记“锤／洗”或“信／不信”；下木的党鞭点票来查这里</small></h3>
<table><tr><th style="width:31mm">哪一次</th>{heads}<th style="width:16mm">结果</th></tr>{s1}</table>
<h3>2 技能<small>用一次划一格，旁边记何时、结果；半步爹钱发到手就打勾（DM手册1.6）</small></h3>
<table><tr><th style="width:20mm">角色</th><th style="width:20mm">技能</th><th style="width:80mm">次数（拍品＋1＝拍到老座钟或旧推杆）</th><th>何时 · 结果</th></tr>{"".join(sk)}</table>
<h3>3 名场面<small>判定完成就打勾（原句、时机见5.9）</small></h3><div class="row">{scenes}</div>
<div class="grid"><div>
<h3>4 卧底</h3><div class="row">烦高　坚守{box}倒戈{box}　　半步爹　坚守{box}倒戈{box}</div>
<div class="row">→ 驴心<span class="line" style="min-width:10mm"></span>人　象心<span class="line" style="min-width:10mm"></span>人</div>
<div class="row">热线判定：H1{box}　H2{box}　H3{box}</div>
</div><div>
<h3>5 关键结果</h3>
<div class="row">初选第一：驴友党<span class="line" style="min-width:22mm"></span>大象党<span class="line" style="min-width:22mm"></span></div>
<div class="row">驴友票：总统<span class="line" style="min-width:18mm"></span>副手<span class="line" style="min-width:18mm"></span></div>
<div class="row">大象票：总统<span class="line" style="min-width:18mm"></span>副手<span class="line" style="min-width:18mm"></span></div>
</div></div>
<h3>7 真相题<small>①错就不得星</small></h3>
<table><tr><th style="width:24mm">角色</th><th>①</th><th>②</th><th>③</th><th>④</th><th style="width:34mm">门槛</th><th style="width:12mm">得星</th></tr>{truth}</table>
<h3>8 当场口径<small>编号｜时刻｜一句判法；判完当众说一遍；写不下记在本页背面</small></h3>
<div class="lines"><div></div></div></section>"""
    states = [("第一轮", "内华达", 6), ("第二轮", "威斯康星", 10), ("第二轮", "密歇根", 15),
              ("第三轮", "佐治亚", 16), ("第三轮", "宾夕法尼亚", 19)]
    rows = ""
    for r, st, ev in states:
        for k, tk in enumerate(("驴友票", "大象票")):
            lead = f'<td rowspan="2" class="c">{r}</td><td rowspan="2" class="c"><b>{st}</b><br>{ev}票</td>' if k == 0 else ""
            rows += f'<tr>{lead}<td class="c">{tk}</td><td class="w"></td><td></td><td></td><td></td>' +                     (f'<td rowspan="2"></td>' if k == 0 else "") + "</tr>"
    sheet2 = f"""<section class="sheet"><div class="hd"><b>摇摆！· DM台账（二）终局算钱表</b><span>DM手册1.5第6条 · 只记每州两张票的合计，不抄装钱单</span></div>
<div class="row">开票那一刻两张提名票的民调和（钱相等时用）：驴友票<span class="line"></span>　大象票<span class="line"></span>　　再相等猜拳</div>
<table><tr><th style="width:15mm">轮次</th><th style="width:24mm">州</th><th style="width:16mm">提名票</th><th>信封里的钱</th><th>欠条（每张1）</th><th>撑场（每块2）</th><th>合计</th><th style="width:22mm">拿下</th></tr>{rows}</table>
<h3>选举人票</h3>
<table><tr><th></th><th>开局</th><th>第一轮后</th><th>第二轮后</th><th>第三轮后</th></tr>
<tr><td class="c">驴友票</td><td class="c">236</td><td class="w"></td><td></td><td></td></tr>
<tr><td class="c">大象票</td><td class="c">236</td><td class="w"></td><td></td><td></td></tr></table>
<div class="note">先到270当选；总数538，不会平票。</div>
<h3>欠条兑现记录<small>持有人｜签名人｜州｜提名票（签名人没钱就下一轮再用）</small></h3>
<div class="lines"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div></section>"""
    star = "".join(f"<tr><td>{n} {m}</td><td class=\"c\">{box}</td><td>{'<b>4问全对</b>' if n in STRICT else '①对＋另三题对≥2'}　{box}</td>"
                   f"<td class=\"c\">{box}</td><td class=\"w\"></td></tr>" for n, m in CAST)
    sheet3 = f"""<section class="sheet"><div class="hd"><b>摇摆！· 评星表</b><span>DM手册4.3⑤ · 复盘时用</span></div>
<table><tr><th style="width:26mm">角色</th><th>阵营星<br>（翻心时的心赢了）</th><th>真相星（门槛）</th><th>名场面星（5.9）</th><th style="width:18mm">合计</th></tr>{star}</table>
<div class="note">每人最多三星。按编号报“××：阵营星有／没有，真相星有／没有，名场面有／没有——（一句理由）”；三星者起立鼓掌。</div>
<h3>最佳60秒（荣誉，不改星）</h3><div class="row">得票最多：<span class="line" style="min-width:60mm"></span></div></section>"""
    return Job(os.path.join(PRESS, "DM", "DM台账与评星表（A4）.pdf"), "摇摆！· DM台账与评星表", B.font_css().replace("url(fonts/", f"url(file://{ROOT}/fonts/") + FORM_CSS,
               [sheet1, sheet2, sheet3], lambda: [], lambda k: 0, trim=(210, 297))


# ───────────────────────── 渲染与后处理 ─────────────────────────

def render(pairs):
    """pairs: [(html_path, pdf_path)]，一次起浏览器全部渲染。"""
    jf = os.path.join(WORK, "jobs.json")
    json.dump([{"html": h, "pdf": p} for h, p in pairs], open(jf, "w"), ensure_ascii=False)
    r = subprocess.run(["node", os.path.join(ROOT, "render.mjs"), jf], check=True, capture_output=True, text=True)
    bad = [l for l in r.stdout.splitlines() if l.startswith("OVERFLOW")]
    if bad:  # 有元素超出版心时 Chromium 会把整本等比缩小（封面也会缩），必须先改掉
        sys.exit("内容超出版心宽度：\n" + "\n".join(bad))


def finish(pdf_in, pdf_out, title, trim=(TRIM_W, TRIM_H)):
    """标 TrimBox（居中成品尺寸）、BleedBox，写标题。"""
    r = PdfReader(pdf_in)
    w = PdfWriter()
    for pg in r.pages:
        mb = pg.mediabox
        W, Hh = float(mb.width), float(mb.height)
        tw, th = min(W, trim[0] * MM), min(Hh, trim[1] * MM)
        x0, y0 = (W - tw) / 2, (Hh - th) / 2
        pg.trimbox = RectangleObject([x0, y0, x0 + tw, y0 + th])
        pg.bleedbox = RectangleObject([0, 0, W, Hh])
        w.add_page(pg)
    w.add_metadata({"/Title": title, "/Author": "Ascham工作室"})
    os.makedirs(os.path.dirname(pdf_out), exist_ok=True)
    with open(pdf_out, "wb") as f:
        w.write(f)
    return len(r.pages)


def proof(sources, out, title):
    """合订校对版：把几册接起来，CropBox 裁到成品尺寸。"""
    w = PdfWriter()
    for s in sources:
        for pg in PdfReader(s).pages:
            pg.cropbox = pg.trimbox
            w.add_page(pg)
    w.add_metadata({"/Title": title, "/Author": "Ascham工作室"})
    try:
        w.compress_identical_objects(remove_duplicates=True, remove_unreferenced=True)
    except Exception:
        pass
    with open(out, "wb") as f:
        w.write(f)


def run(jobs):
    os.makedirs(WORK, exist_ok=True)
    # 第一遍：只排封面到正文，量出正文页数
    first = []
    for n, j in enumerate(jobs):
        hp = os.path.join(WORK, f"m{n}.html")
        open(hp, "w", encoding="utf-8").write(doc(j.title, j.css, j.head))
        first.append((hp, os.path.join(WORK, f"m{n}.pdf")))
    render(first)
    second = []
    for n, j in enumerate(jobs):
        cover_pages = 1 if "class=\"cover\"" in j.head[0] else 0
        k = len(PdfReader(first[n][1]).pages) - cover_pages
        j.k, j.pad = k, j.pad_rule(k)
        hp = os.path.join(WORK, f"f{n}.html")
        open(hp, "w", encoding="utf-8").write(j.html(j.pad))
        second.append((hp, os.path.join(WORK, f"f{n}.pdf")))
    render(second)
    for n, j in enumerate(jobs):
        j.pages = finish(second[n][1], j.out, j.title, j.trim)
        print(f"{j.pages:3d}页  {os.path.relpath(j.out, OUT)}")


def write_manifest(groups):
    """印刷清单：和本目录文件同步，每次全量出图时重写。"""
    rel = lambda j: os.path.relpath(j.out, PRESS)
    L = ["# 《摇摆！》印刷清单", "",
         "> 本清单由排版程序（print/_build/press.py）随文件一起生成，页数与本目录文件一致。",
         "", "## 通用要求", "",
         "- **成品尺寸**：除注明 A4 的以外，全部是 A5（148×210mm）。PDF 每页已含四边各 3mm 出血（154×216mm），每页都标了 TrimBox（裁切框）和 BleedBox。",
         "- **颜色**：PDF 为 RGB，请印厂按常规转 CMYK。封面、封底是彩色满版；内页以黑白为主，有少量彩色（党派色标题条、✅⛔🎭小图标、演绎台本里本人台词的浅黄底），黑白印也能分辨。",
         "- **字体**：已全部嵌入。",
         "- **装订**：角色本每册、节目单册、DM手册、卡面册的页数都是 4 的倍数，按页序骑马钉即可；第1页是封面，最后一页是封底。如要用厚封面纸：第1、2页和最后两页在同一张纸上。DM手册 72 页，骑马钉或胶装都可以。",
         "- **单页物料**：规则卡单面印；演绎台本一张正反两面；DM台账与评星表是 A4 单面。",
         "- **卡牌与其他物料**（拍品卡、欠条、线索卡、账本页等）：尺寸、正反、数量见《卡面与物料印刷册》第一页的“印制总表”，卡面正文在册内各节；目前没有单独排成逐张的印刷文件。",
         "", "## 角色本（每人四册，按人数印）", "",
         "8人局印全部 8 套；7人局不印 08 狗登罗；6人局再不印 04 梅戏。每套四册分开装订，片头发第一幕册，以后每幕开头发当幕一册。", "",
         "| 角色 | 第一幕册 | 第二幕册 | 第三幕册 | 终局册 | 终局册封口贴位置 |", "|---|---|---|---|---|---|"]
    for k, g in groups.items():
        if not k[:2].isdigit():
            continue
        fin = g[3]
        s1 = 1 + fin.k + fin.pad + 1
        seal = f"第{s1 + 1}页与第{s1 + 2}页（结局一）、第{s1 + 3}页与第{s1 + 4}页（结局二）"
        name = os.path.basename(os.path.dirname(fin.out))
        L.append(f"| {name} | " + " | ".join(f"{j.pages}页" for j in g) + f" | {seal} |")
    L += ["", "**封口页**：终局册末尾的两张结局页要各自封住。上表“第x页与第y页”是相对的两页（左页空白、右页是结局），"
          "沿外侧开口边贴一枚封口贴，把这两页粘在一起；每册两枚，8 套共 16 枚。复盘时 DM 报到哪一张，玩家才撕开哪一张。", "",
          "## 其余文件", "", "| 文件 | 页数 | 尺寸 | 印法 | 8人局 | 7人局 | 6人局 | 用途 |", "|---|---|---|---|---|---|---|---|"]
    other = []
    for j in groups.get("rules", []):
        if "节目单" in j.out:
            other.append((rel(j), j.pages, "A5", "双面，骑马钉", 8, 7, 6, "片头每人一份"))
        else:
            other.append((rel(j), j.pages, "A5", "单面", 8, 7, 6, "当幕开场每人一张"))
    for j in groups.get("scripts", []):
        other.append((rel(j), j.pages, "A5", "一张双面", 9, 8, 7, "演绎前发，演完收；含DM一份"))
    for j in groups.get("dm", []):
        other.append((rel(j), j.pages, "A5", "双面，骑马钉或胶装", 1, 1, 1, "DM专用，含机密"))
    for j in groups.get("forms", []):
        other.append((rel(j), j.pages, "A4", "单面", 1, 1, 1, "第1、2页是DM台账，第3页是评星表；每开一局用一份"))
    for j in groups.get("print", []):
        other.append((rel(j), j.pages, "A5", "双面", 1, 1, 1, "交印厂做卡牌物料的依据，也给DM备查；含机密，不发玩家"))
    for r in other:
        L.append("| " + " | ".join(str(x) for x in r) + " |")
    L += ["", "另需：封口贴 16 枚（7人局 14、6人局 12）。", ""]
    open(os.path.join(PRESS, "印刷清单.md"), "w", encoding="utf-8").write("\n".join(L))


def main(argv=()):
    want = set(argv)
    proof_only = want == {"proof"}
    if proof_only:
        want = set()
    chars = [(k, s, cv) for k, s, cv in B.BOOKS if cv.get("party")]
    groups = {}
    for k, s, cv in chars:
        if not want or k in want:
            groups[k] = character_jobs(k, s, cv)
    if not want or "rules" in want:
        groups["rules"] = rules_jobs()
    if not want or "scripts" in want:
        groups["scripts"] = scripts_jobs()
    if not want or "dm" in want:
        groups["dm"] = [dm_job()]
    if not want or "print" in want:
        groups["print"] = [print_job()]
    if not want or "forms" in want:
        groups["forms"] = [forms_job()]
    jobs = [j for g in groups.values() for j in g]
    if not jobs:
        return
    if not want and os.path.isdir(PRESS):
        shutil.rmtree(PRESS)
    run(jobs)
    if not want:
        write_manifest(groups)
    if not proof_only:
        return
    names = {k: cv for k, _, cv in B.BOOKS}
    for k, g in groups.items():
        if k in names:
            proof([j.out for j in g], os.path.join(OUT, f"{k}.pdf"), f"摇摆！· {names[k]['name']}（合订校对版）")
    if "rules" in groups:
        proof([j.out for j in groups["rules"]], os.path.join(OUT, "11-rules.pdf"), "摇摆！· 节目单与规则书（合订校对版）")
    if "dm" in groups:
        proof([groups["dm"][0].out], os.path.join(OUT, "09-dm.pdf"), "摇摆！· DM主持手册（校对版）")
    if "print" in groups:
        proof([groups["print"][0].out], os.path.join(OUT, "10-print.pdf"), "摇摆！· 卡面与物料印刷册（校对版）")
    if "scripts" in groups:
        proof([j.out for j in groups["scripts"]], os.path.join(OUT, "12-scripts.pdf"), "摇摆！· 全员演绎台本（合订校对版）")


if __name__ == "__main__":
    main(sys.argv[1:])
