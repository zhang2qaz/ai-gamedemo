"""《摇摆！》打印版排版：Markdown → HTML（A5 印刷样式＋封面）→ PDF（Playwright Chromium）。
用法：python3 build.py [书目key ...]   不带参数则构建全部已有源文件。"""
import json, os, re, subprocess, sys
import markdown
from covers import cover_svg, INK, PAPER, GOLD, GRAY

ROOT = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.abspath(os.path.join(ROOT, "..", ".."))
OUT = os.path.abspath(os.path.join(ROOT, ".."))
P3 = os.path.join(DOCS, "phase3")

BOOKS = [
    # key, 源文件, 封面参数
    ("01-lajiao", "characters/01-lajiao.md", dict(no="No.01", name="辣椒·冲冲", party="驴", role="驴友党众议员 · 厨房直播网红", slogan="锅都热了，你还凉着？", prop="lajiao")),
    ("02-gaowen", "characters/02-gaowen.md", dict(no="No.02", name="定型·高文", party="驴", role="冲浪州州长 · 建制派领跑者", slogan="风再大，发型不乱。", prop="gaowen")),
    ("03-andefu", "characters/03-andefu.md", dict(no="No.03", name="“老底”安德福", party="驴", role="驴友党众议院党鞭", slogan="我不记仇，我记账。", prop="andefu")),
    ("04-mei", "characters/04-mei.md", dict(no="No.04", name="梅·独家", party="驴", role="驴友党通讯总监 · 前调查记者", slogan="我有个独家，下次告诉你。", prop="mei")),
    ("05-maike", "characters/05-maike.md", dict(no="No.05", name="麦克·三小时", party="象", role="播客之王 · 大象党初选挑战者", slogan="这事儿咱展开聊三小时。", prop="maike")),
    ("06-gengen", "characters/06-gengen.md", dict(no="No.06", name="半步·跟跟", party="象", role="现任副总统 · 大象党接班人", slogan="我一直就在您身后半步。", prop="gengen")),
    ("07-qianduoduo", "characters/07-qianduoduo.md", dict(no="No.07", name="钱多多", party="象", role="开盒智能创始人 · 大象党头号金主", slogan="两边押，才叫稳。", prop="qianduoduo")),
    ("08-linda", "characters/08-linda.md", dict(no="No.08", name="琳达·背调", party="象", role="大象党首席选举律师", slogan="我查过了，他是干净的。", prop="linda")),
    ("09-dm-hosting", "dm/01-dm-hosting-manual.md", dict(no="DM·上", name="DM主持手册", party=None, role="上册 · 流程与主持（主持人：贾不睡）", slogan="今夜不睡，明天的总统还是今晚的总统吗？", prop="dm", kind="DM专用 · 上册", warn="仅限DM与场控阅读", color="#b8322a")),
    ("10-dm-secret", "dm/02-dm-secret-appendix.md", dict(no="DM·下", name="DM机密附录", party=None, role="下册 · 真相、机密册、账本与结局", slogan="账，总是要还的。", prop="dm", kind="DM专用 · 下册 · 绝密", warn="开本前请勿让任何玩家看到", color="#1b1a17")),
    ("11-public", "public/01-public-materials.md", dict(no="公共", name="节目单与规则书", party=None, role="《今夜不睡·大选特别季》公共物料", slogan="你支持的候选人，可能也在支持你的对手。", prop="public", kind="全员公开物料", warn="可在开本时分发给所有玩家", color="#1f4e9c")),
]

CSS = """
@page { size: 148mm 210mm; margin: 16mm 13mm 17mm 13mm; }
@page cover { margin: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: 'Noto Serif SC', serif; color: #1b1a17; font-size: 10.2pt; line-height: 1.72; margin: 0; background: #fff; }
.cover { page: cover; width: 148mm; height: 210mm; overflow: hidden; break-after: page; }
.cover svg { display: block; width: 148mm; height: 210mm; }
.titlepage { break-after: page; height: 170mm; display: flex; flex-direction: column; justify-content: center; text-align: center; }
.titlepage .t1 { font-family: 'ZCOOL QingKe HuangYou'; font-size: 44pt; margin: 0; }
.titlepage .t2 { font-family: 'Noto Sans SC'; font-weight: 900; font-size: 18pt; margin: 6mm 0 2mm; }
.titlepage .t3 { color: #4a4a48; font-family: 'Noto Sans SC'; font-size: 9pt; }
.titlepage .rule { width: 40mm; height: 1.2mm; background: VAR_C; margin: 6mm auto; }
.titlepage .note { margin-top: 18mm; font-family: 'Noto Sans SC'; font-size: 8.5pt; color: #4a4a48; border: 0.4mm solid #1b1a17; padding: 3mm 4mm; text-align: left; }
h1 { break-before: page; font-family: 'Noto Sans SC'; font-weight: 900; font-size: 17pt; line-height: 1.3; margin: 0 0 5mm; padding: 4mm 0 3mm; border-bottom: 1.2mm solid VAR_C; }
h1:first-of-type { break-before: avoid; }
h2 { font-family: 'Noto Sans SC'; font-weight: 900; font-size: 12.5pt; margin: 6mm 0 2.5mm; padding-left: 3mm; border-left: 1.4mm solid VAR_C; break-after: avoid; }
h3 { font-family: 'Noto Sans SC'; font-weight: 700; font-size: 11pt; margin: 4.5mm 0 2mm; break-after: avoid; }
h4 { font-family: 'Noto Sans SC'; font-weight: 700; font-size: 10.2pt; margin: 3.5mm 0 1.5mm; }
p { margin: 0 0 2.4mm; text-align: justify; }
strong { font-weight: 900; }
ul, ol { margin: 0 0 2.6mm; padding-left: 6mm; }
li { margin-bottom: 1mm; }
blockquote { margin: 3mm 0 3.5mm; padding: 3mm 4mm 2mm; background: #f3e9d4; border: 0.45mm solid #1b1a17; border-radius: 1.6mm; break-inside: avoid; box-shadow: 1.1mm 1.1mm 0 VAR_C; }
blockquote p:first-child strong:first-child { font-family: 'Noto Sans SC'; color: VAR_C; }
blockquote p { margin-bottom: 1.6mm; }
table { border-collapse: collapse; width: 100%; margin: 2.5mm 0 3.5mm; font-size: 8.6pt; line-height: 1.5; break-inside: auto; }
th { background: #1b1a17; color: #f3e9d4; font-family: 'Noto Sans SC'; font-weight: 700; padding: 1.4mm 1.6mm; text-align: left; }
td { border-bottom: 0.25mm solid #b9ae98; padding: 1.3mm 1.6mm; vertical-align: top; }
tr { break-inside: avoid; }
tr:nth-child(even) td { background: #faf5ea; }
hr { border: 0; border-top: 0.4mm dashed #4a4a48; margin: 4mm 0; }
code { font-family: 'Noto Sans SC'; background: #f3e9d4; padding: 0 1mm; }
.pagebreak { break-after: page; }
"""


def font_css():
    css = open(os.path.join(ROOT, "fonts", "fonts.css"), encoding="utf-8").read()
    return css.replace("url(", "url(fonts/")


LIST_RE = re.compile(r"^\s*([-*+]|\d+[.)])\s+")


def normalize_md(text):
    """列表项、表格、引用块之前若紧跟正文行，补一个空行，避免被并入上一段。"""
    out = []
    for line in text.split("\n"):
        if out:
            prev = out[-1]
            starts_block = LIST_RE.match(line) or line.startswith("|") or line.startswith(">")
            prev_is_text = prev.strip() and not LIST_RE.match(prev) and not prev.startswith("|") \
                and not prev.startswith(">") and not prev.startswith("#") and not prev.startswith("    ")
            if starts_block and prev_is_text:
                out.append("")
        out.append(line)
    return "\n".join(out)


def build_html(key, src, cv):
    md_text = normalize_md(open(os.path.join(P3, src), encoding="utf-8").read())
    body = markdown.markdown(md_text, extensions=["tables", "sane_lists", "md_in_html", "attr_list"])
    color = cv.get("color") or ("#1f4e9c" if cv.get("party") == "驴" else "#b8322a" if cv.get("party") == "象" else "#1b1a17")
    css = CSS.replace("VAR_C", color)
    svg = cover_svg(**cv)
    is_char = cv.get("party") is not None
    note = ("本册分为四册，请严格按DM指示的时点阅读对应一册；其余各册保持封口。"
            "<br>游戏中只能口述自己的信息，禁止出示本册原文、卡片与DM给你的任何物件。") if is_char else \
           ("本册供DM与场控使用。开本前请完整通读并完成上岗考核（见上册第一章）。") if "dm" in key else \
           ("本册为公开物料，可在片头分发给全体玩家。")
    title = f'''<section class="titlepage">
  <p class="t1">摇摆！</p><div class="rule"></div>
  <p class="t2">{cv["name"]}</p><p class="t3">{cv["role"]}</p>
  <div class="note">{note}</div>
  <p class="t3" style="margin-top:14mm">Ascham工作室 · 城限欢乐阵营本 · 6–8人 · 约8小时</p>
</section>'''
    html = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>摇摆！· {cv["name"]}</title>
<style>{font_css()}{css}</style></head><body>
<section class="cover">{svg}</section>{title}
<main>{body}</main></body></html>'''
    path = os.path.join(ROOT, f"{key}.html")
    open(path, "w", encoding="utf-8").write(html)
    return path, cv["name"]


def main():
    want = set(sys.argv[1:])
    jobs = []
    for key, src, cv in BOOKS:
        if want and key not in want:
            continue
        if not os.path.exists(os.path.join(P3, src)):
            print(f"跳过 {key}：源文件不存在"); continue
        html, label = build_html(key, src, cv)
        jobs.append({"html": html, "pdf": os.path.join(OUT, f"{key}.pdf"), "label": label})
    if not jobs:
        return
    json.dump(jobs, open(os.path.join(ROOT, "jobs.json"), "w"), ensure_ascii=False)
    subprocess.run(["node", os.path.join(ROOT, "render.mjs"), os.path.join(ROOT, "jobs.json")], check=True)


if __name__ == "__main__":
    main()
