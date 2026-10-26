"""卡牌物料印刷文件：按 phase4/public/cards-print.md（卡面与物料印刷册）把每种物料排成逐张卡面。
- 每张卡一页，成品尺寸加出血（卡片3mm；胸牌包边到70mm）；双面卡按“正、背、正、背……”排，印厂按页序双面印。
- 同款卡（欠条、纸条、民调牌等）只排一张，印多少张见印刷清单。
- 卡面正文从卡面册的表格里读，改卡面册后重出即可同步。
由 press.py 调用（python3 press.py cards 只出卡牌）。"""
import html as H
import os, re

import build as B
import press as P

SRC = os.path.join(B.P3, "public", "cards-print.md")
FOLDER = os.path.join(P.PRESS, "卡牌物料")
NO = {"皮拉提": "01", "烦高": "02", "下木": "03", "梅戏": "04", "麦克播": "05", "半步爹": "06", "建国钱": "07", "狗登罗": "08"}
CREAM, INK, GOLD = "#f7f0e1", "#1b1a17", "#a9843a"
GOLD_TX = "#8a6d2e"  # 金色小字用深一档，米色底上看得清
DONKEY, ELEPHANT = "#2f5aa8", "#a8352f"


# ───────────────────────── 读卡面册 ─────────────────────────

def section(md, head):
    i = md.index("\n## " + head)
    j = md.find("\n## ", i + 4)
    return md[i:j if j > 0 else len(md)]


def tables(text):
    out, cur = [], None
    for line in text.split("\n"):
        if line.startswith("|"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if all(set(c) <= set("-: ") for c in cells):
                continue
            if cur is None:
                cur = []
                out.append(cur)
            cur.append(cells)
        else:
            cur = None
    return out


def fences(text):
    return re.findall(r"```[^\n]*\n(.*?)\n```", text, re.S)


def esc(s):
    """转义但保留引号（后面要换成弯引号）。"""
    return H.escape(s, quote=False)


def inline(s):
    """表格单元格 → HTML：转义，保留 <br>，**粗体**；句末落款（——某某）整体不断开。"""
    s = H.escape(s, quote=False).replace("&lt;br&gt;", "<br>")
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"(?<![A-Za-z0-9.−-])(\d+(?:[.:：]\d+)*[人米岁年月日号页张块次个名家条分秒％%]?)(?![^<]*>)", r'<span class="nw">\1</span>', s)
    return re.sub(r"(——[^—<]{1,10})$", r'<span class="nw">\1</span>', s)


def box_lines(block):
    """框线字符画 → 去掉边框后的文字行（保留行首缩进量）。"""
    rows = []
    for ln in block.split("\n"):
        t = ln.strip()
        if t.startswith(("┌", "└", "├")):
            continue
        t = t.strip("│").rstrip()
        rows.append(t)
    return rows



# ───────────────────────── 版式公用件 ─────────────────────────

PAD = 1.0  # 每页四周多排1mm，出PDF后把 MediaBox 裁掉（Chromium 会把页面尺寸取整，直接写成品＋出血尺寸会差零点几毫米）
FRAME = 4.0  # 金框离裁切线（裁切误差±1mm时边框仍然匀称）
INSET = 6.8  # 版心离裁切线


def size_class(w):
    return "s" if w < 80 else "m" if w < 120 else "l"


def css(w, h, bleed):
    W, Hh, b = w + 2 * bleed, h + 2 * bleed, bleed
    return P.font_faces() + f"""
@page {{ size: {W + 2 * PAD}mm {Hh + 2 * PAD}mm; margin: 0; }}
html {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
body {{ margin: 0; font-family: 'Noto Serif SC'; color: {INK}; text-spacing-trim: space-all; }}  /* 标点保持全角：开挤压时行末“。”会多占半格超出版心 */
.pg {{ position: relative; width: {W + PAD + .4}mm; height: {Hh + PAD + .4}mm; overflow: hidden; break-after: page; }}
.pg:last-child {{ break-after: auto; }}
.cd {{ position: absolute; left: {PAD}mm; top: {PAD}mm; width: {W}mm; height: {Hh}mm; }}
.cd::before {{ content: ""; position: absolute; inset: -{PAD}mm; background: inherit; z-index: -1; }}  /* 底色往外多铺，盖住取整留下的细白边 */
.f {{ background: {CREAM}; }}
.b {{ background: {INK}; }}
.fr {{ position: absolute; inset: {b + FRAME}mm; border: 0.35mm solid {GOLD}; }}
.fr::after {{ content: ""; position: absolute; inset: 0.8mm; border: 0.15mm solid {GOLD}; }}
.b .fr::after {{ border-width: 0.22mm; }}
.b .fr, .b .fr::after {{ border-color: #c9a75e; }}
.safe {{ position: absolute; left: {b + INSET}mm; right: {b + INSET}mm; top: {b + INSET - .2}mm; bottom: {b + INSET - .6}mm;
        display: flex; flex-direction: column; overflow: hidden; }}
.hd {{ font-family: 'Noto Sans SC'; font-weight: 900; letter-spacing: .08em; color: {GOLD_TX}; border-bottom: 0.3mm solid {GOLD};
      padding-bottom: 1.3mm; margin-bottom: 2.2mm; }}
.body {{ flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: safe center; }}
.body.top {{ justify-content: flex-start; }}
.ft {{ display: flex; justify-content: space-between; align-items: flex-end; gap: 3mm; margin-top: 2mm; }}
.no {{ font-family: 'Noto Sans SC'; color: #7d735f; white-space: nowrap; margin-left: auto; }}
.tx {{ text-align: left; text-wrap: pretty; }}
.nw {{ white-space: nowrap; }}  /* 短行里夹着不能断开的英文词（如“Happy”）时，两端对齐会把字距拉开 */
.tx p {{ margin: 0 0 1.4mm; }}
.sm {{ font-family: 'Noto Sans SC'; line-height: 1.5; color: #5d5547; }}
.s .hd {{ font-size: 7pt; }} .m .hd, .l .hd {{ font-size: 8pt; }}
.s .tx {{ font-size: 9.8pt; line-height: 1.72; }} .m .tx, .l .tx {{ font-size: 11.4pt; line-height: 1.8; }}
.s .sm {{ font-size: 6.4pt; }} .m .sm, .l .sm {{ font-size: 7.2pt; }}
.s .no {{ font-size: 6.2pt; }} .m .no, .l .no {{ font-size: 7pt; }}
.grow {{ flex: 1; }}
.ln {{ display: inline-block; border-bottom: 0.25mm solid {INK}; min-width: 18mm; height: 1em; vertical-align: -0.15em; }}
.box {{ display: inline-block; width: 0.82em; height: 0.82em; border: 0.3mm solid {INK}; vertical-align: -0.08em; margin-right: 1.2mm; box-sizing: border-box; }}
.b .pat {{ position: absolute; inset: -{PAD}mm; opacity: .08;
          background: repeating-linear-gradient(45deg, #c9a75e 0 0.3mm, transparent 0.3mm 3mm); }}
.bk {{ position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #e8d39b; }}
.bk .ms {{ display: flex; gap: 1.2mm; margin-bottom: 2.6mm; }}
.s .bk .ms svg {{ width: 11mm; height: 11mm; }} .m .bk .ms svg {{ width: 15mm; height: 15mm; }}
.bk .lg {{ font-family: 'Noto Serif SC'; font-weight: 900; letter-spacing: .12em; margin-left: .12em; color: #f0dca6; line-height: 1.2; }}
.s .bk .lg {{ font-size: 16pt; }} .m .bk .lg {{ font-size: 21pt; }}
.bk .rule {{ width: 14mm; border-top: 0.25mm solid #c9a75e; margin-top: 2.2mm; }}
.bk .bt {{ font-family: 'Noto Sans SC'; font-weight: 700; letter-spacing: .25em; margin: 2.4mm 0 0 .25em; }}
.s .bk .bt {{ font-size: 8pt; }} .m .bk .bt {{ font-size: 9.5pt; }}
.bk .bs {{ font-family: 'Noto Sans SC'; letter-spacing: .1em; margin-top: 1.4mm; color: #cdb98a; }}
.s .bk .bs {{ font-size: 6.8pt; }} .m .bk .bs {{ font-size: 8pt; }}
.mk {{ position: absolute; left: 0; right: 0; bottom: {b + FRAME + 2.4}mm; text-align: center; font-family: 'Cinzel'; font-size: 5.5pt;
      letter-spacing: .45em; margin-left: .45em; color: #a8925f; }}
"""


def front(body, hd=None, no=None, cls="", foot="", top=False, lead="", under=""):
    """正面：金框＋页眉＋正文（默认在版心里上下居中）＋页脚（小字说明、右下角编号）。"""
    h = f'<div class="hd">{hd}</div>' if hd else ""
    n = f'<div class="no">{no}</div>' if no else ""
    ft = f'<div class="ft"><div class="sm">{foot}</div>{n}</div>' if (foot or no) else ""
    t = " top" if top else ""
    return (f'<section class="pg f {cls}">{under}<div class="fr"></div><div class="safe">{h}{lead}'
            f'<div class="body{t}">{body}</div>{ft}</div></section>')


def back(title, sub=""):
    """背面：同一种卡完全一样（线索卡按规定印幕名和地点）。"""
    s = f'<div class="bs">{sub}</div>' if sub else ""
    return (f'<section class="pg b"><div class="pat"></div><div class="fr"></div><div class="bk">'
            f'<div class="ms">{donkey("12mm")}{elephant("12mm")}</div><div class="lg">摇摆！</div><div class="rule"></div>'
            f'<div class="bt">{title}</div>{s}</div><div class="mk">ASCHAM</div></section>')



def donkey(size):
    return f'''<svg viewBox="0 -5 100 100" width="{size}" height="{size}">
 <g stroke="#16305f" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">
  <path d="M40,36 C33,26 31,13 34,6 C41,10 45,22 45,34 Z" fill="#fff"/><path d="M60,36 C67,26 69,13 66,6 C59,10 55,22 55,34 Z" fill="#fff"/>
  <path d="M38.5,31 C36,23 35.5,15 36.5,10.5 C40,14 42,21 42.5,29" fill="#f2c9cf" stroke="none"/>
  <path d="M61.5,31 C64,23 64.5,15 63.5,10.5 C60,14 58,21 57.5,29" fill="#f2c9cf" stroke="none"/>
  <path d="M50,30 C61,30 68,38 67,52 C66,60 64,64 63,68 L37,68 C36,64 34,60 33,52 C32,38 39,30 50,30 Z" fill="#fff"/>
  <ellipse cx="50" cy="72" rx="16" ry="11.5" fill="#dfe6f3"/><path d="M45,30 C46,26 49,25 50,28 C51,25 54,26 55,30" fill="none"/></g>
 <ellipse cx="44.5" cy="73" rx="2" ry="2.8" fill="#16305f"/><ellipse cx="55.5" cy="73" rx="2" ry="2.8" fill="#16305f"/>
 <circle cx="42.5" cy="49" r="3" fill="#16305f"/><circle cx="43.4" cy="48.1" r="1" fill="#fff"/>
 <circle cx="57.5" cy="49" r="3" fill="#16305f"/><circle cx="58.4" cy="48.1" r="1" fill="#fff"/>
 <path d="M45,80 C48,82.5 52,82.5 55,80" fill="none" stroke="#16305f" stroke-width="1.5" stroke-linecap="round"/></svg>'''


def elephant(size):
    return f'''<svg viewBox="0 4 100 100" width="{size}" height="{size}">
 <g stroke="#5c1a16" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">
  <path d="M34,34 C20,26 9,36 11,51 C13,64 25,68 34,60 Z" fill="#fff"/><path d="M66,34 C80,26 91,36 89,51 C87,64 75,68 66,60 Z" fill="#fff"/>
  <path d="M32,38 C23,34 16,40 17,50 C18,58 25,61 31,56 Z" fill="#f2c9cf" stroke="none"/>
  <path d="M68,38 C77,34 84,40 83,50 C82,58 75,61 69,56 Z" fill="#f2c9cf" stroke="none"/>
  <path d="M44.5,57 C44.5,65 44.5,71 46.5,76 C48.5,81 56,83.5 60.5,80.5 C62.5,79 62,75.5 59.5,76.5 C57.5,78.5 54.5,78 53.5,74 C52.5,70 53.5,64 55.5,57 Z" fill="#fff"/>
  <ellipse cx="50" cy="45" rx="20" ry="19" fill="#fff" stroke="none"/>
  <path d="M45,63 C35,61 30,53 30,45 C30,33 39,26 50,26 C61,26 70,33 70,45 C70,53 65,61 55,63" fill="none"/>
  <path d="M42,60 C40,64 37,65.5 35,63.5" fill="#fffaf0" stroke-width="1.3"/><path d="M58,60 C60,64 63,65.5 65,63.5" fill="#fffaf0" stroke-width="1.3"/></g>
 <circle cx="42.5" cy="45" r="3" fill="#5c1a16"/><circle cx="43.4" cy="44.1" r="1" fill="#fff"/>
 <circle cx="57.5" cy="45" r="3" fill="#5c1a16"/><circle cx="58.4" cy="44.1" r="1" fill="#fff"/></svg>'''



# ───────────────────────── 各种物料 ─────────────────────────

class Card:
    def __init__(self, key, name, w, h, pages, extra_css="", bleed=3.0, note="", label=None):
        self.key, self.name, self.w, self.h, self.pages = key, name, w, h, pages
        self.extra_css, self.bleed, self.note = extra_css, bleed, note
        self.label = label or f"{w}×{h}mm"  # 文件名里的尺寸


def auction(md):
    sec = section(md, "一、拍品卡")
    rows = tables(sec)[0][1:]
    css_ = """
.au .nm { font-family: 'Noto Serif SC'; font-weight: 900; font-size: 19pt; line-height: 1.35; text-align: center; letter-spacing: .06em; }
.au .orn { text-align: center; color: #a9843a; font-size: 7pt; letter-spacing: .8em; margin: 4.5mm 0 5mm .8em; }
.au .kv { align-self: center; font-family: 'Noto Sans SC'; font-size: 9.6pt; line-height: 2; text-align: center;
          border-top: 0.25mm solid #a99e86; border-bottom: 0.25mm solid #a99e86; padding: 1.4mm 5mm; }
.au .kv b { color: #8a6d2e; font-weight: 700; margin-right: 2mm; }
.au .ft .sm { flex: 1; text-align: center; border-top: 0.25mm dashed #a99e86; padding-top: 1.6mm; }
.score { padding: 0 1.6mm; }
.score table { border-collapse: collapse; width: 100%; font-family: 'Noto Sans SC'; font-size: 8.4pt; }
.score th, .score td { border: 0.25mm solid #6d8a5a; padding: 1.8mm 1.2mm; text-align: center; color: #23401a; }
.score th { background: #e3ecd6; }
.score .holes { display: flex; justify-content: space-between; margin-bottom: 2mm; }
.score .holes i { width: 3mm; height: 3mm; border-radius: 50%; background: #d9cdb2; display: block; }
.score .ttl { font-family: 'Noto Sans SC'; font-weight: 900; font-size: 13pt; color: #23401a; text-align: center; margin-bottom: 1mm; }
.score .sub { font-family: 'Noto Sans SC'; font-size: 7.5pt; color: #4f5d45; text-align: center; margin-bottom: 3mm; }
.score .ft .sm { margin-left: auto; text-align: right; color: #4f5d45; font-size: 6.4pt; }
.phone { flex: 1; width: 64mm; align-self: center; margin: 1mm 0 2mm; border: 0.5mm solid #333; border-radius: 4mm; background: #f4f4f6; padding: 3mm 2.8mm; display: flex; flex-direction: column; }
.phone .bar { font-family: 'Noto Sans SC'; font-size: 6.6pt; color: #777; display: flex; justify-content: space-between; }
.phone .from { margin: 1mm 0 4.5mm; height: 7mm; border-radius: 1mm; background: #cfcfd3;
   -webkit-mask: linear-gradient(#000, #000) 0 1.4mm / 100% 100% no-repeat, conic-gradient(from -45deg at 50% 1.4mm, #000 90deg, transparent 0) 0 0 / 2.8mm 1.4mm repeat-x; }
.phone .from span { display: block; font-family: 'Noto Sans SC'; font-size: 6.6pt; color: #888; padding: 2.2mm 1.6mm; }
.phone .bub { align-self: flex-start; max-width: 86%; background: #fff; border: 0.25mm solid #ddd; border-radius: 3mm; padding: 2.6mm 3.2mm;
   font-family: 'Noto Sans SC'; font-size: 10pt; line-height: 1.6; }
.phone .rd { font-family: 'Noto Sans SC'; font-size: 6.6pt; color: #999; margin-top: 1.6mm; }
"""
    pages = []
    for no, face, back_text in rows:
        name, get, price = [x.strip() for x in face.split("／")]
        n = no.replace("拍品", "")
        body = (f'<div class="nm">{esc(name)}</div><div class="orn">◆◆◆</div>'
                f'<div class="kv"><b>得到</b>{esc(get)}<br><b>起拍</b>{price}资金</div>')
        pages.append(front(body, f"两头吃遗物 · 拍品{n}", cls="au", foot="举手跟价 · 一件最多出5 · 同价猜拳"))
        hd = f"拍品{n} · 背面"
        if n == "1":  # 真记分卡样式
            names = re.findall(r"([^、：（]+)（(\d+)岁）", back_text)
            trs = "".join(f"<tr><td>{esc(a.strip())}</td><td>{b}</td><td></td><td></td></tr>" for a, b in names)
            note = re.search(r"<br>([^<]+)$", back_text)  # 最后一行（"按本会惯例……"）印在背面角落小字
            body = (f'<div class="score"><div class="holes"><i></i><i></i><i></i></div><div class="ttl">第18洞记分卡</div>'
                    f'<div class="sub">最后一组 · 四人</div>'
                    f'<table><tr><th>球员</th><th>年龄</th><th>杆数</th><th>签名</th></tr>{trs}</table></div>')
            pages.append(front(body, None, cls="aub score", foot=esc(note.group(1)) if note else ""))  # 角落小字放右下角
        elif n == "8":  # 手机截图样式，发信人一栏撕掉
            msg = re.search(r'"(.+)"', back_text).group(1)
            body = (f'<div class="phone"><div class="from"><span>发信人：</span></div><div class="bub">{esc(msg)}</div>'
                    f'<div class="rd">已读</div></div>')
            pages.append(front(body, None, cls="aub", top=True))
        else:
            pages.append(front(f'<div class="tx">{inline(back_text)}</div>', hd, cls="aub"))
    return Card("01", "拍品卡", 90, 130, pages, css_,
                note="8张双面。正面拍卖时出示，背面只给得主看；拍品1背面做成记分卡、拍品8背面做成手机截图")


ROUNDS = [("第一轮", ["内华达（6分）"]), ("第二轮", ["威斯康星（10分）", "密歇根（15分）"]),
          ("第三轮", ["佐治亚（16分）", "宾夕法尼亚（19分）"])]


def money_slip(md):
    css_ = """
.slip .t1 { font-family: 'Noto Sans SC'; font-weight: 900; font-size: 10.4pt; line-height: 1.45; margin: 1mm 0 4mm; white-space: nowrap; }
.slip .tx { font-size: 10.5pt; }
.slip table { width: 100%; border-collapse: collapse; margin: 4mm 0 4mm; }
.slip th { font-family: 'Noto Sans SC'; font-weight: 700; font-size: 8pt; text-align: left; border-bottom: 0.35mm solid #1b1a17; padding: 1.2mm 0; }
.slip td { font-size: 10.5pt; padding: 5mm 0 1mm; border-bottom: 0.25mm solid #b9ae98; }
.slip td.v { width: 21mm; }
.slip td.v span { display: block; border-bottom: 0.25mm solid #1b1a17; width: 15mm; height: 5mm; }
.slip .bold { font-family: 'Noto Sans SC'; font-weight: 900; font-size: 9.6pt; margin-top: 4mm; padding: 2mm 2.5mm; border: 0.35mm solid #1b1a17; }
.dmc .st { font-family: 'Noto Sans SC'; font-weight: 900; font-size: 10pt; margin: 1mm 0 1.5mm; }
.dmc table { width: 100%; border-collapse: collapse; font-family: 'Noto Sans SC'; font-size: 7.6pt; margin-bottom: 4mm; table-layout: fixed; }
.dmc th { font-weight: 700; color: #5d5547; padding: 1mm 0.6mm; line-height: 1.35; border-bottom: 0.3mm solid #1b1a17; text-align: center; }
.dmc th:first-child { width: 19mm; }
.dmc td { height: 9mm; border-bottom: 0.25mm solid #b9ae98; border-left: 0.25mm solid #d6cdb9; text-align: center; vertical-align: bottom; padding: 0 0.6mm 1mm; color: #5d5547; }
.dmc td:first-child { border-left: 0; text-align: left; font-weight: 700; color: #1b1a17; }
.dmc td:last-child { background: #efe5cf; }
"""
    pages = []
    for rnd, states in ROUNDS:
        rows = "".join(f"<tr><td>{s}</td><td class='v'><span></span></td><td class='v'><span></span></td></tr>" for s in states)
        extra = '<div class="bold">真相题答题卡还没交的，现在一起封进信封。</div>' if rnd == "第三轮" else ""
        body = (f'<div class="t1">摇摆之夜 · {rnd} · 我往信封里装了多少</div><div class="tx">我是：<span class="ln" style="min-width:34mm"></span></div>'
                f'<table><tr><th>州</th><th>驴友党提名票</th><th>大象党提名票</th></tr>{rows}</table>'
                f'<div class="tx">合计<span class="ln" style="min-width:14mm"></span>资金 ＝ 信封内资金</div>'
                f'<div class="sm" style="margin-top:2mm">可以投0 · 可以投给任何一张提名票</div>{extra}')
        pages.append(front(body, None, cls="slip", top=True))
        calc = "".join(
            f'<div class="st">{s}</div><table><tr><th></th><th>信封里<br>的钱</th><th>＋欠条<br>张数</th><th>＋撑场<br>块数×2</th><th>＝合计</th></tr>'
            f'<tr><td>驴友党提名票</td><td></td><td>张</td><td>块</td><td></td></tr>'
            f'<tr><td>大象党提名票</td><td></td><td>张</td><td>块</td><td></td></tr></table>' for s in states)
        body = (f'<div class="dmc">{calc}</div><div class="sm">钱多的拿下；一样多：民调和 驴友<span class="ln" style="min-width:7mm"></span> '
                f'大象<span class="ln" style="min-width:7mm"></span>，高的拿下；再一样猜拳</div>')
        pages.append(front(body, f"DM计算栏 · {rnd}（DM用）", cls="slipb", top=True))
    return Card("02", "装钱单", 90, 130, pages, css_, note="三轮各一版，正面玩家填、背面DM计算栏；每版印8张（另备4张）")


def iou(md):
    sec = section(md, "三、欠条样式")
    fs = fences(sec)
    css_ = """
.iou { background: #eef3e6 !important; }
.iou .gl { position: absolute; inset: 0; opacity: .55; background:
   repeating-radial-gradient(circle at 30% 40%, transparent 0 1.6mm, #b9d2a7 1.6mm 1.8mm),
   repeating-radial-gradient(circle at 75% 70%, transparent 0 2.1mm, #c9dcb9 2.1mm 2.3mm); }
.iou .ti { font-family: 'Noto Serif SC'; font-weight: 900; font-size: 17pt; text-align: center; letter-spacing: .6em; margin: 0 0 3.5mm .6em; color: #23401a; }
.iou .tx { font-size: 9.4pt; line-height: 1.8; }
.iou .sm { color: #3f5236; font-size: 6.8pt; line-height: 1.6; }
.iou .fr, .iou .fr::after { border-color: #6d8a5a; }
.iou .opt { display: flex; }
.iou .gl { inset: -1mm; }
"""
    f_lines = [l.strip() for l in box_lines(fs[0]) if l.strip()]
    b_lines = [l.strip() for l in box_lines(fs[1]) if l.strip()]
    rules = [l for l in f_lines if l.endswith("。") and "签名：" not in l]
    gl = '<div class="gl"></div>'
    body = ('<div class="ti">欠条</div>'
            '<div class="tx">欠 <span class="ln" style="min-width:25mm"></span> 一次<br><span class="sm">（这一栏可以不填）</span></div>'
            '<div class="tx" style="margin-top:2.5mm">签名：<span class="ln" style="min-width:31mm"></span></div>'
            f'<div class="sm" style="margin-top:4mm">{"<br>".join(esc(x) for x in rules)}</div>')
    pages = [front(body, None, cls="iou", under=gl)]
    tail = [l for l in b_lines if l.startswith(("签名的人", "当场", "他没钱", "下一轮", "以交给", "用完"))]
    body = ('<div class="tx" style="font-weight:700;font-size:10.4pt">请签名的人投1资金</div>'
            '<div class="tx" style="margin-top:3mm">州：<span class="ln" style="min-width:30mm"></span></div>'
            '<div class="tx opt" style="margin-top:1.5mm"><span>投给：</span><span><span class="box"></span>驴友党提名票<br><span class="box"></span>大象党提名票</span></div>'
            f'<div class="sm" style="margin-top:4mm">{"".join(esc(x) for x in tail)}</div>')
    pages.append(front(body, None, cls="iou", under=gl))
    return Card("03", "欠条", 63, 88, pages, css_, note="双面，同款；可签字的哑光卡纸，正面淡绿色票据纹；8人局印27张＋备用6张")


def answer_sheet(md):
    sec = section(md, "四、真相题答题卡")
    lines = [l.strip() for l in box_lines(fences(sec)[0]) if l.strip()]
    qs = [l for l in lines if re.match(r"[①②③④]", l)]
    tips = [l for l in lines if not re.match(r"[①②③④]|《|答题人|＿", l)]
    css_ = """
.ans .tx { font-size: 10.5pt; }
.ans .q { font-size: 10.5pt; margin-top: 3.4mm; }
.ans .a { border-bottom: 0.25mm solid #1b1a17; height: 7.5mm; margin-left: 5.5mm; }
.ans .dm { height: 20mm; }
"""
    qhtml = "".join(f'<div class="q">{esc(q)}</div><div class="a"></div>' for q in qs)
    body = (f'<div class="tx">答题人：<span class="ln" style="min-width:36mm"></span></div>{qhtml}'
            f'<div class="sm" style="margin-top:4mm">{"<br>".join(esc(t) for t in tips)}</div><div class="grow"></div><div class="dm"></div>')
    return Card("04", "真相题答题卡", 90, 130, [front(body, "《今夜不睡》听众竞猜 · 真相题答题卡", cls="ans", top=True)], css_,
                note="单面，同款；底部留2cm空白供DM打勾；8人局印8张＋备用2张")


def badges(md):
    # 成品：直径70mm圆形纸片压进58mm胸章，中间直径58mm是正面，外圈包到背后；TrimBox 是70mm圆的外接正方形，四周再铺2mm
    # 图文都在中间直径约46mm以内（扣面开始弯的地方不放细线）
    css_ = """
.bd { background: transparent !important; display: flex; align-items: center; justify-content: center; }
.bd .disc { position: absolute; inset: -1mm; }
.bd .ring { position: absolute; left: 13mm; top: 13mm; width: 48mm; height: 48mm; box-sizing: border-box; border-radius: 50%; border: 0.4mm solid rgba(255,255,255,.6); }
.bd .in { position: relative; text-align: center; color: #fff; }
.bd .in svg { display: block; margin: 0.6mm auto 0; }
.bd .pn { font-family: 'Noto Sans SC'; font-weight: 900; font-size: 10.5pt; letter-spacing: .3em; margin-left: .3em; }
.bd .cn { font-family: 'Noto Serif SC'; font-weight: 900; font-size: 13pt; letter-spacing: .1em; margin: 0.4mm 0 0 .1em; line-height: 1.3; }
"""
    pages = []
    for cn, no in NO.items():
        party = "驴友党" if int(no) <= 4 else "大象党"
        color = DONKEY if party == "驴友党" else ELEPHANT
        icon = donkey("23mm") if party == "驴友党" else elephant("23mm")
        pages.append(f'<section class="pg bd"><div class="disc" style="background:{color}"></div><div class="ring"></div>'
                     f'<div class="in"><div class="pn">{party}</div>{icon}<div class="cn">{cn}</div></div></section>')
    return Card("05", "胸牌", 70, 70, pages, css_, bleed=2.0, label="直径58mm胸章",
                note="直径58mm马口铁胸章，8枚各不相同。按直径70mm圆刀裁纸（TrimBox 是这个圆的外接正方形，四周另有2mm出血），中间直径58mm是正面，外圈包到背后；不要按 TrimBox 裁成方片。两党图样同风格、同饱和度，不印任何与心有关的字或色")


def dirt(md):
    rows = tables(section(md, "六、黑料卡"))[0][1:]
    pages = []
    for no, who, face in rows:
        pages.append(front(f'<div class="tx">{inline(face)}</div>', f"黑料 · 当事人：{esc(who)}", no=no))
        pages.append(back("《今夜不睡》黑料"))
    return Card("06", "黑料卡", 63, 88, pages, note="16张双面；真卡、伪造卡完全同款，真伪和持卡人都不印")


def ledger(md):
    sec = section(md, "七、账本页")
    rows = tables(sec)[0][1:]
    css_ = """
.lg, .lgb { background: #ecebe6 !important; }
.lg { display: flex; align-items: center; justify-content: center; }
.lg .post { width: calc(100% - 22mm); max-height: calc(100% - 26mm); box-sizing: border-box; background: #fff; border: 0.3mm solid #d8d4ca;
            border-radius: 3.5mm; padding: 8mm 9mm 6mm; display: flex; flex-direction: column; overflow: hidden; }
.lg .who { display: flex; align-items: center; gap: 3.2mm; }
.lg .av { width: 12mm; height: 12mm; border-radius: 50%; background: #1b1a17; color: #f0dca6; font-family: 'Noto Serif SC'; font-weight: 900;
          font-size: 14pt; display: flex; align-items: center; justify-content: center; }
.lg .hn { font-family: 'Noto Sans SC'; font-weight: 900; font-size: 12.5pt; }
.lg .pt { font-family: 'Noto Sans SC'; font-weight: 700; font-size: 10.5pt; margin: 7mm 0 4.5mm; color: #555; }
.lg .bd2 { font-size: 14pt; line-height: 2; text-align: justify; }
.lg .hand { font-family: 'Long Cang'; font-size: 19pt; line-height: 1.8; text-align: left; }
.lg .hand .sf { font-family: 'Noto Serif SC'; font-size: 14pt; }
.lg .sig { font-family: 'Noto Sans SC'; font-size: 7.5pt; color: #999; text-align: right; letter-spacing: .05em; margin-top: 9mm; }
.lgb .dmline { position: absolute; left: 13mm; bottom: 13mm; font-family: 'Noto Sans SC'; font-size: 8pt; color: #555; }
"""
    pages = []
    for page, who, when, text in rows:
        n = re.match(r"第(\d)页", page).group(1)
        hand = " hand" if n == "9" else ""
        body_text = inline(text)
        if hand:
            body_text = re.sub(r"(——|：)", r'<span class="sf">\1</span>', body_text)
        body = (f'<div class="post"><div class="who"><div class="av">账</div><div class="hn">@午夜账房</div></div>'
                f'<div class="pt">账本·第{n}页（共九页）</div><div class="bd2{hand}">{body_text}</div>'
                f'<div class="sig">签名 8302-7716-5590-4418-0001</div></div>')
        pages.append(f'<section class="pg lg">{body}</section>')
        who2 = "结账" if n == "9" else who
        pages.append(f'<section class="pg lgb"><div class="dmline">第{n}页｜{esc(who2)}｜{esc(when)}</div></section>')
    return Card("07", "账本页", 148, 210, pages, css_,
                note="A5双面，共10张（第1—9页＋6人局版第8页）；正面网帖样式，第9页手写体；背面一行DM用小字")


def clues(md):
    sec = section(md, "八、线索卡")
    tbs = tables(sec)
    notes = {k: esc(v) for k, v in re.findall(r'^- (公开|私密)卡："(.+)"$', sec, re.M)}  # 底注从卡面册"底注两种"读
    css_ = """
.cl .loc { font-family: 'Noto Sans SC'; font-weight: 700; font-size: 9pt; }
.cl .tx { font-size: 11.6pt; line-height: 1.85; }
.cl .ft { flex-direction: column; align-items: stretch; gap: 0.8mm; }
.cl .ft .no { align-self: flex-end; }
"""
    pages = []
    # 背面幕名照卡面册“背面”一条（与地点牌下行小字一致）
    m = re.search(r'第二幕8张印"(.+?) · 〔地点〕"，第三幕8张印"(.+?) · 〔地点〕"', sec)
    scene = {"B": m.group(1), "C": m.group(2)}
    for t in tbs:
        for no, loc, kind, face in t[1:]:
            code = re.search(r"线([BC]\d)", no).group(1)
            label = f"线{code}"  # 7、6人局版的编号也只印“线B6”，DM凭正文区分
            pages.append(front(f'<div class="tx">{inline(face)}</div>', f"线索 · {kind}卡", no=label, cls="cl", foot=notes[kind],
                               lead=f'<div class="loc">地点：{esc(loc)}</div>'))
            pages.append(back(scene[code[0]], esc(loc)))
    return Card("08", "线索卡", 90, 130, pages, css_, note="18张双面（16张＋线B6的7、6人局版＋线C9）；背面印幕名和地点，不印公开／私密")


def place_cards(md):
    t = tables(section(md, "九、地点牌"))[0][1:]
    css_ = """
.pl .half { position: absolute; left: 0; right: 0; height: 50%; }
.pl .top { top: 0; transform: rotate(180deg); }
.pl .bot { bottom: 0; }
.pl .hf { position: absolute; left: 7mm; right: 7mm; top: 4mm; bottom: 7mm; border: 0.35mm solid #a9843a; }
.pl .hf::after { content: ""; position: absolute; inset: 0.8mm; border: 0.15mm solid #a9843a; }
.pl .face { position: absolute; left: 9mm; right: 9mm; top: 6mm; bottom: 9mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.pl .big.lg2 { font-size: 18pt; }
.pl .big { font-family: 'Noto Serif SC'; font-weight: 900; font-size: 21pt; line-height: 1.3; letter-spacing: .08em; margin-left: .08em; }
.pl .orn { color: #a9843a; font-size: 6pt; letter-spacing: .8em; margin: 2.6mm 0 2mm .8em; }
.pl .scn { font-family: 'Noto Sans SC'; font-size: 8.5pt; letter-spacing: .15em; color: #7a6a45; }
"""
    pages = []
    for scn, locs in t:
        for loc in locs.split("／"):
            loc = re.sub(r"（[^）]*人局[^）]*）", "", loc)  # “（7、6人局加摆；括注不印）”这类说明不上牌
            big = re.sub(r"（[^）]*）", lambda m: f'<span class="nw">{m.group(0)}</span>', esc(loc))
            lg2 = " lg2" if len(loc) >= 10 else ""
            face = (f'<div class="hf"></div><div class="face"><div class="big{lg2}">{big}</div><div class="orn">◆◆◆</div>'
                    f'<div class="scn">{esc(scn.split("（")[0])}</div></div>')
            pages.append(f'<section class="pg f pl"><div class="half top">{face}</div><div class="half bot">{face}</div></section>')
    return Card("09", "地点牌", 100, 140, pages, css_,
                note="17块（16块＋7、6人局加摆的律所前台）；单面印，沿中线（成品70mm处）压痕对折成立牌，上半面倒印，立起后两面同文")


def envelopes(md):
    sec = section(md, "十、党代会信封卡")
    tbs = tables(sec)
    mole, others = tbs[0][1:], tbs[1][1:]
    tmpl = "今晚没有人要你做决定，这一页只给你一条消息：{}。下面两格随手勾一格，折好交回。"
    merged = re.search(r'\*\*6人局皮拉提合并版[^\n]*\n"(.+?)"', sec, re.S).group(1).replace("'", '"')
    css_ = ".ev .tx { font-size: 11.4pt; line-height: 1.85; } .ev .ft .sm { font-family: 'Noto Serif SC'; font-size: 11pt; color: #1b1a17; letter-spacing: .1em; }"
    def fill(clue):  # 线索本身以句号（或句号加引号）收尾时，模板里的句号不再补
        t = tmpl.format(clue)
        return t.replace(clue + "。", clue, 1) if re.search(r"""[。！？]["'”’]?$""", clue) else t
    items = [(who, text) for who, text in mole] + [(who, fill(clue)) for who, clue in others]
    items.sort(key=lambda x: NO[x[0]])
    ck = '<span class="box"></span>坚守　　<span class="box"></span>倒戈'
    pages = [front(f'<div class="tx">{inline(text)}</div>', "党代会之夜 · 信封", no=NO[who], cls="ev", foot=ck) for who, text in items]
    pages.append(front(f'<div class="tx">{inline(merged)}</div>', "党代会之夜 · 信封", no="01", cls="ev", foot=ck))
    return Card("10", "党代会信封卡", 90, 130, pages, css_,
                note="9张单面（8张按编号01—08＋6人局皮拉提合并版）；8张同纸同字号同排版，右下角只印收件人编号；信封另购，外面不印字")


def hotline(md):
    t = tables(section(md, "十一、热线来电卡"))[0][1:]
    calls = {}
    for r in t:
        calls[int(r[0])] = r[1]
        calls[int(r[2])] = r[3]
    pages = []
    for i in sorted(calls):
        pages.append(front(f'<div class="tx">{inline(calls[i])}</div>', "《今夜不睡》选民热线 · 来电", no=str(i)))
        pages.append(back("选民热线"))
    return Card("11", "热线来电卡", 63, 88, pages, note="24张双面；背面统一“选民热线”")


def hot_cards(md):
    t = tables(section(md, "十二、热线小卡"))[0][1:]
    css_ = ".hc .tx { font-size: 10.2pt; line-height: 1.8; } .hc .tp { text-align: center; color: #a9843a; font-size: 6pt; letter-spacing: .8em; margin: 0 0 4mm .8em; }"
    pages, counts = [], []
    for kind, n, text in t:
        pages.append(front(f'<div class="tp">◆◆◆</div><div class="tx">{inline(text)}</div>', None, cls="hc"))
        pages.append(back("《今夜不睡》午夜热线"))
        counts.append(f"第{len(counts) + 1}款{n}张")
    return Card("12", "热线小卡", 63, 88, pages, css_,
                note="4款双面，共14张：" + "、".join(counts) + "（按页序第1—4款；四款同纸同字号同排版，不印任何代号）")


def debate(md):
    t = tables(section(md, "十三、辩论题卡"))[0][1:]
    css_ = ".db .tx { font-size: 13.5pt; line-height: 1.85; font-weight: 700; }"
    pages = [front(f'<div class="tx">{inline(q)}</div>', "首场总统辩论", no=n, cls="db") for n, q in t]
    return Card("13", "辩论题卡", 90, 130, pages, css_, note="5张单面")


def surface(md):
    sec = section(md, "十四、表层秘密卡")
    t = tables(sec)[0][1:]
    hd = re.search(r'\*\*正面\*\*："(.+?) · 〔角色名〕"', sec).group(1)  # 卡头照卡面册"正面"一条
    bk = re.search(r'\*\*背面\*\*：统一印"(.+?)"', sec).group(1)
    pages = []
    for who, text in t:
        pages.append(front(f'<div class="tx">{inline(text)}</div>', f"{esc(hd)} · {esc(who)}"))
        pages.append(back(esc(bk)))
    return Card("14", "表层秘密卡", 63, 88, pages, note=f"8张双面；正面卡头“{hd} · 角色名”，背面统一“{bk}”")


def handover(md):
    fs = fences(section(md, "十六、交权书"))
    css_ = """
.ho { background: #fbfaf6 !important; }
.ho .doc { position: absolute; left: 11mm; right: 11mm; top: 13mm; bottom: 12mm; font-family: 'Noto Serif SC'; font-size: 10pt; line-height: 1.95; }
.ho .doc p { margin: 0; text-indent: 2em; text-align: justify; }
.ho .doc p.to { text-indent: 0; }
.ho .ttl { font-family: 'Noto Sans SC'; font-weight: 900; font-size: 12pt; text-align: center; margin: 0 0 6mm; }
.ho .r { text-align: right; margin-top: 5mm; }
.ho .sigrow { margin-top: 7mm; display: flex; align-items: baseline; gap: 2mm; white-space: nowrap; }
.ho .sigrow .ln { flex: 1; min-width: 0; }
.ho .h1 { font-family: 'Ma Shan Zheng'; font-size: 19pt; }
.ho .h2 { font-family: 'Long Cang'; font-size: 22pt; }
.ho .pgno { position: absolute; left: 0; right: 0; bottom: 8mm; text-align: center; font-family: 'Noto Sans SC'; font-size: 6.5pt; color: #999; }
"""
    raw = fs[0].split("\n")
    title = raw[0].strip()
    lines = [l for l in raw[1:] if l.strip()]
    sign = [l.strip() for l in lines if l.startswith("    ")]
    text = [l.strip() for l in lines if not l.startswith("    ")]
    # 原稿按字符画宽度硬折行：没以句末标点或冒号结尾的行接到下一行
    paras = []
    for l in text:
        if paras and not re.search(r"[。！？：]$", paras[-1]):
            paras[-1] += l
        else:
            paras.append(l)
    ps = "".join(f'<p{" class=to" if p.endswith("：") else ""}>{esc(p)}</p>' for p in paras)
    doc = f'<div class="doc"><div class="ttl">{esc(title)}</div>{ps}<div class="r">{esc(sign[0]) if sign else ""}</div></div>'
    pg1 = f'<section class="pg ho">{doc}<div class="pgno">第一页</div></section>'
    doc2 = ('<div class="doc"><div class="ttl">签字栏</div>'
            '<div class="sigrow">同意荣休并移交：<span class="ln"></span>（老师）</div>'
            '<div class="sigrow" style="margin-top:14mm">学生：<span class="h1">下木</span></div>'
            '<div class="sigrow">学生：<span class="h2">建国钱</span></div></div>')
    pg2 = f'<section class="pg ho">{doc2}<div class="pgno">第二页</div></section>'
    return Card("15", "交权书", 90, 130, [pg1, pg2], css_,
                note="2张单面，打印文件样式；签名手写体（下木工整），老师一栏留空；终局开场随建国钱终局册发")


def state_board(md):
    sec = section(md, "十五、州板")
    t = tables(sec)[0]
    css_ = """
.sb .fr { inset: 11mm; }
.sb .safe { left: 17mm; right: 17mm; top: 16mm; bottom: 15mm; }
.sb .tt { font-family: 'Noto Serif SC'; font-weight: 900; font-size: 30pt; text-align: center; letter-spacing: .3em; margin: 1mm 0 5mm .3em; }
.sb table { width: 100%; border-collapse: collapse; font-family: 'Noto Sans SC'; table-layout: fixed; }
.sb th { background: #1b1a17; color: #f3e9d4; font-weight: 700; padding: 2.5mm 3mm; font-size: 15pt; height: 15mm; }
.sb th:nth-child(1) { width: 25%; } .sb th:nth-child(2) { width: 9%; } .sb th:nth-child(3) { width: 14%; }
.sb th.d { background: #2f5aa8; } .sb th.e { background: #a8352f; }
.sb th .ic { display: inline-flex; align-items: center; gap: 2.5mm; }
.sb td { border: 0.5mm solid #8a7d62; padding: 2mm 4mm; height: 27mm; text-align: center; font-size: 19pt; }
.sb td.st { font-weight: 900; font-size: 21pt; text-align: left; }
.sb tr.fixed td { background: #efe5cf; height: 22mm; font-size: 16pt; }
.sb .ft2 { font-family: 'Noto Sans SC'; font-weight: 900; font-size: 17pt; text-align: center; margin-top: 5mm; }
"""
    head = t[0]
    trs = ""
    for r in t[1:]:
        cls = ' class="fixed"' if "开局" in r[0] else ""
        trs += f'<tr{cls}><td class="st">{esc(r[0])}</td><td>{r[1]}</td><td>{r[2]}</td><td></td><td></td></tr>'
    ths = (f"<tr><th>{head[0]}</th><th>{head[1]}</th><th>{head[2]}</th>"
           f'<th class="d"><span class="ic">{donkey("16mm")}{head[3]}</span></th><th class="e"><span class="ic">{elephant("16mm")}{head[4]}</span></th></tr>')
    foot = re.search(r'底部印一行："(.+?)"', sec).group(1)
    body = f'<div class="tt">摇摆之夜 · 州板</div><table>{ths}{trs}</table><div class="ft2">{esc(foot)}</div>'
    return Card("16", "州板", 420, 297, [front(body, None, cls="sb", top=True)], css_, note="A3横版单面1张；五个摇摆州的两栏留空，放撑场圆片、写钱数")


def poll(md):
    css_ = """
.pc .ttl { font-family: 'Noto Sans SC'; font-weight: 900; font-size: 12pt; text-align: center; letter-spacing: .5em; margin: 0 0 2mm .5em; }
.pc .sc { flex: 1; display: flex; flex-direction: column-reverse; margin: 1mm 0 1.6mm; }
.pc .sc div { flex: 1; display: flex; align-items: center; justify-content: space-between; border-top: 0.25mm solid #b9ae98;
              font-family: 'Noto Sans SC'; font-weight: 900; font-size: 13pt; }
.pc .sc div:first-child { border-bottom: 0.25mm solid #b9ae98; }
.pc .sc i { display: block; width: 9mm; border-top: 0.7mm solid #a9843a; }
"""
    sc = "".join(f"<div><span>{i}</span><i></i></div>" for i in range(11))
    return Card("17", "民调牌", 63, 120, [front(f'<div class="sc">{sc}</div>', None, cls="pc", top=True)], css_,
                note="单面，同款，只印0—10刻度；每块配夹子1只，夹在当前数值的刻度线上")


def primary_slip(md):
    css_ = ".ps .tx { font-size: 11pt; line-height: 2; text-align: left; } .ps .sm { font-size: 7.5pt; margin-top: 1mm; }"
    body = '<div class="tx">我写本党的：<span class="ln" style="min-width:24mm"></span></div><div class="sm">（不能写自己）</div>'
    return Card("18", "初选纸条", 63, 88, [front(body, None, cls="ps")], css_, note="单面，同款；8人局印8张＋备用2张")


def chips(md):
    css_ = """
.ch { background: transparent !important; display: flex; align-items: center; justify-content: center; }
.ch .disc { position: absolute; inset: -1mm; background: radial-gradient(circle at 42% 38%, #f6e6b0, #c9a75e 58%, #8a6a1f); }
.ch .ring { position: absolute; left: 7mm; top: 7mm; width: 22mm; height: 22mm; box-sizing: border-box; border-radius: 50%; border: 0.4mm solid #6d531c; }
.ch .in { position: relative; text-align: center; color: #3f2a0f; }
.ch .in svg { display: block; margin: 0 auto 0.6mm; }
.ch .two { font-family: 'Cinzel'; font-weight: 700; font-size: 19pt; line-height: .8; }
"""
    flag = ('<svg viewBox="0 0 40 24" width="7.6mm" height="4.6mm"><path d="M4,2 V23" stroke="#3f2a0f" stroke-width="1.6"/>'
            '<path d="M5,3 C12,0 18,6 26,3 C30,2 34,2 37,3 V13 C30,11 26,15 18,13 C12,11 9,12 5,13 Z" fill="#3f2a0f"/></svg>')
    page = f'<section class="pg ch"><div class="disc"></div><div class="ring"></div><div class="in">{flag}<div class="two">2</div></div></section>'
    return Card("19", "撑场圆片", 30, 30, [page], css_, label="直径30mm",
                note="直径30mm圆片，单面，同款，只印一面小旗和“2”；按直径30mm圆刀模切（TrimBox 是这个圆的外接正方形）；8人局印8块")


def runs(nos):
    """["补01", "补02", "补03", "补05"] → "补01—补03、补05"（连号并成一段）。"""
    out, i = [], 0
    while i < len(nos):
        j = i
        while j + 1 < len(nos) and int(nos[j + 1][1:]) == int(nos[j][1:]) + 1:
            j += 1
        out.append(nos[i] if i == j else f"{nos[i]}—{nos[j]}")
        i = j + 1
    return "、".join(out)


def task_slips(md):
    """人数任务条（第十七节）：表里每行一张，单面。上方印“收件人 · 幕名”（“半步爹·第一幕册”印成“半步爹 · 第一幕”），
    中间印纸条正文，右下角小字印编号；“用于”一列只供DM挑条，不上卡。"""
    rows = tables(section(md, "十七、人数任务条"))[0][1:]
    css_ = ".ts .hd { font-size: 8pt; } .ts .tx { font-size: 10.4pt; line-height: 1.85; }"
    names = re.compile("|".join(NO))  # 人名不拆在两行（“麦克／播”）
    pages, use = [], {"7": [], "6": []}
    for no, used, to, text in rows:
        who, book = re.split(r"\s*·\s*", to, maxsplit=1)
        act = re.sub(r"册$", "", book)
        body = names.sub(lambda m: f'<span class="nw">{m.group(0)}</span>', inline(text))
        pages.append(front(f'<div class="tx">{body}</div>', f"{esc(who)} · {esc(act)}", no=esc(no), cls="ts"))
        for n in re.findall(r"[67]", used):
            use[n].append(no)
    return Card("20", "人数任务条", 63, 88, pages, css_,
                note=(f"{len(pages)}张单面（{runs([r[0] for r in rows])}），背面空白，每个编号印1张；"
                      f"7人局用{runs(use['7'])}，6人局用{runs(use['6'])}，开本前DM挑出夹进对应角色那一幕的册子；"
                      "正面只印收件人与幕名、纸条正文、右下角编号，不印人数"))


def spec(md=None):
    """卡面册印制总表：物料名 → (尺寸, 正反, 8人局, 7人局, 6人局, 备注)。"""
    md = md or open(SRC, encoding="utf-8").read()
    rows = tables(section(md, "印制总表"))[0][1:]
    return {r[0]: r[1:7] for r in rows}


ALL = [auction, money_slip, iou, answer_sheet, badges, dirt, ledger, clues, place_cards, envelopes,
       hotline, hot_cards, debate, surface, handover, state_board, poll, primary_slip, chips, task_slips]
PG_RE = re.compile(r'^<section class="pg ([^"]*)"([^>]*)>(.*)</section>$', re.S)


def jobs():
    md = open(SRC, encoding="utf-8").read()
    out = []
    for fn in ALL:
        c = fn(md)
        style = css(c.w, c.h, c.bleed) + c.extra_css
        sz = size_class(c.w)
        pages = [P.curly_quotes(PG_RE.sub(rf'<section class="pg"><div class="cd {sz} \1"\2>\3</div></section>', p)) for p in c.pages]
        out_path = os.path.join(FOLDER, f"{c.key}-{c.name}（{c.label}）.pdf")
        j = P.Job(out_path, f"摇摆！· {c.name}", style, pages, lambda: [], lambda k: 0, trim=(c.w, c.h))
        j.card = c
        j.crop = (PAD, PAD, c.w + 2 * c.bleed, c.h + 2 * c.bleed)
        out.append(j)
    return out
