"""洛可可风封面：粉彩底、鎏金椭圆画框、玫瑰花环、缎带名牌。
portraits/<key>.jpg|png 存在时嵌入油画人像（椭圆裁切）；否则用18世纪剪影侧像。"""
import base64, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
INK = "#2b2118"

PAL = {  # 底色、纹样色、缎带色
    "驴": ("#dfe8f1", "#9fb6cf", "#5b7fa8"),
    "象": ("#f3e1e1", "#d4a5a8", "#a8545c"),
    None: ("#efe6d6", "#c9b48a", "#7a5c2e"),
}

DEFS = """
<defs>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7a5a17"/><stop offset=".25" stop-color="#f6e7a8"/>
    <stop offset=".5" stop-color="#b98d2c"/><stop offset=".75" stop-color="#fbefc0"/><stop offset="1" stop-color="#8a6a1f"/>
  </linearGradient>
  <radialGradient id="ivory" cx=".45" cy=".4" r=".7">
    <stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#e9dcc2"/>
  </radialGradient>
  <radialGradient id="rose" cx=".4" cy=".35" r=".7">
    <stop offset="0" stop-color="#fbe3e6"/><stop offset=".6" stop-color="#e9a3ad"/><stop offset="1" stop-color="#b9606f"/>
  </radialGradient>
  <filter id="soft"><feGaussianBlur stdDeviation="1.2"/></filter>
  <clipPath id="oval"><ellipse cx="740" cy="930" rx="330" ry="420"/></clipPath>
</defs>"""


def damask(c):
    cells = []
    for y in range(0, 2200, 160):
        for x in range(0 if (y // 160) % 2 == 0 else 80, 1560, 160):
            cells.append(f'<g transform="translate({x},{y})" fill="{c}" opacity=".28">'
                         f'<path d="M0,-34 C14,-18 14,-6 0,0 C-14,-6 -14,-18 0,-34 Z"/>'
                         f'<path d="M0,34 C14,18 14,6 0,0 C-14,6 -14,18 0,34 Z"/>'
                         f'<path d="M-34,0 C-18,-12 -6,-12 0,0 C-6,12 -18,12 -34,0 Z"/>'
                         f'<path d="M34,0 C18,-12 6,-12 0,0 C6,12 18,12 34,0 Z"/>'
                         f'<circle r="4"/></g>')
    return "".join(cells)


def scroll(x, y, rot, s=1.0):
    """C形卷草（洛可可贝壳卷）"""
    return (f'<g transform="translate({x},{y}) rotate({rot}) scale({s})" fill="none" stroke="url(#gold)" stroke-linecap="round">'
            f'<path d="M0,0 C30,-40 90,-40 100,0 C108,32 70,46 55,24 C45,10 60,-6 72,4" stroke-width="10"/>'
            f'<path d="M0,0 C-30,40 -90,40 -100,0 C-108,-32 -70,-46 -55,-24 C-45,-10 -60,6 -72,-4" stroke-width="10"/>'
            f'<path d="M-20,-8 C-10,-30 10,-30 20,-8" stroke-width="5"/></g>')


def shell(x, y, rot, s=1.0):
    ribs = "".join(f'<path d="M0,0 L{60*math.cos(math.radians(a)):.1f},{-60*math.sin(math.radians(a)):.1f}" stroke="#8a6a1f" stroke-width="3"/>' for a in range(20, 170, 20))
    return (f'<g transform="translate({x},{y}) rotate({rot}) scale({s})">'
            f'<path d="M-66,0 C-66,-80 66,-80 66,0 Z" fill="url(#gold)"/>{ribs}'
            f'<path d="M-66,0 C-40,14 40,14 66,0" fill="none" stroke="#8a6a1f" stroke-width="4"/></g>')


def rosette(x, y, s=1.0):
    petals = "".join(f'<ellipse cx="0" cy="-15" rx="12" ry="17" transform="rotate({a})" fill="url(#rose)"/>' for a in range(0, 360, 60))
    inner = "".join(f'<ellipse cx="0" cy="-7" rx="7" ry="10" transform="rotate({a+30})" fill="#f6c9d0"/>' for a in range(0, 360, 72))
    leaves = (f'<ellipse cx="-26" cy="10" rx="18" ry="7" transform="rotate(-30 -26 10)" fill="#9bb38d"/>'
              f'<ellipse cx="26" cy="10" rx="18" ry="7" transform="rotate(30 26 10)" fill="#7f9c72"/>')
    return f'<g transform="translate({x},{y}) scale({s})">{leaves}{petals}{inner}<circle r="5" fill="#c97a88"/></g>'


def garland(x1, y1, x2, y2, sag):
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2 + sag
    path = f'<path d="M{x1},{y1} Q{mx},{my + sag*0.4} {x2},{y2}" fill="none" stroke="#9bb38d" stroke-width="10" opacity=".9"/>'
    roses = ""
    for t in [i / 6 for i in range(1, 6)]:
        bx = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * mx + t * t * x2
        by = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * (my + sag * 0.4) + t * t * y2
        roses += rosette(bx, by, 0.8 if t in (0.5,) else 0.62)
    return path + roses


# ---------- 剪影侧像（面向右） ----------
MALE = ("M300,1250 L300,1110 C300,1080 315,1065 322,1050 C262,1020 240,950 250,870 C262,770 340,700 440,700 "
        "C530,700 585,750 597,830 L600,872 C608,892 628,915 640,932 L616,944 C621,957 619,965 612,971 "
        "C621,979 620,989 611,994 C618,1003 615,1012 606,1016 C609,1040 600,1062 572,1070 "
        "C548,1077 528,1084 524,1105 L530,1140 C560,1180 690,1200 740,1250 Z")
FEMALE = ("M310,1250 L312,1115 C312,1088 322,1070 330,1056 C272,1028 252,960 262,880 C274,785 348,718 444,718 "
          "C528,718 580,766 590,840 L594,878 C602,898 618,918 628,934 L606,944 C610,955 609,962 603,968 "
          "C611,975 611,984 603,989 C609,997 607,1006 599,1010 C602,1030 594,1050 570,1058 "
          "C550,1064 534,1072 532,1094 L538,1130 C568,1170 690,1196 730,1250 Z")

HAIR = {
    "lajiao": ("F", "M262,880 C220,760 300,660 430,670 C560,676 620,760 600,850 C585,800 540,770 480,780 "
                    "C430,790 420,830 380,840 C340,850 330,900 345,960 C300,980 330,1060 290,1120 C250,1060 230,980 262,880 Z"
                    "M300,1080 C260,1120 250,1180 290,1220 C250,1200 230,1140 260,1090 Z"),
    "gaowen": ("M", "M250,880 C230,760 320,650 460,640 C580,632 650,690 640,760 C600,720 560,740 590,800 "
                    "C540,780 500,790 470,800 C420,810 380,840 350,900 C330,950 300,960 280,1000 C255,960 245,920 250,880 Z"),
    "andefu": ("M", "M250,870 C245,780 320,710 440,705 C520,702 575,730 592,790 C560,760 520,758 480,770 "
                    "C430,784 380,800 340,860 C320,900 305,950 300,1000 C268,970 252,920 250,870 Z"),
    "mei": ("F", "M262,880 C238,760 330,690 450,692 C560,694 610,770 598,860 C570,820 540,800 500,800 "
                 "C450,800 400,820 370,870 C345,910 340,960 352,1010 C320,1010 290,990 276,960 C266,940 262,910 262,880 Z"),
    "maike": ("M", "M250,880 C240,770 320,690 445,690 C540,690 600,740 600,800 C570,770 530,770 490,780 "
                   "C440,790 395,815 360,860 C335,895 320,940 318,990 C280,970 258,930 250,880 Z"
                   "M520,1020 C560,1030 600,1020 612,995 C618,1030 600,1072 560,1080 C530,1084 515,1060 520,1020 Z"),
    "gengen": ("M", "M250,875 C245,770 330,700 445,698 C530,697 585,735 596,800 C565,775 525,772 485,782 "
                    "C440,792 395,812 360,858 C335,890 318,935 312,985 C276,965 255,925 250,875 Z"),
    "qianduoduo": ("M", "M250,870 C238,760 330,680 455,676 C560,673 620,720 625,790 C590,760 555,755 520,762 "
                        "C460,775 410,800 372,850 C345,885 325,930 318,980 C280,960 258,920 250,870 Z"),
    "linda": ("F", "M262,880 C236,770 330,694 448,696 C556,698 604,766 596,850 C568,808 530,792 490,796 "
                   "C440,800 398,826 372,870 C352,905 348,950 356,995 C320,990 290,960 276,925 C268,905 262,890 262,880 Z"
                   "M300,900 C230,920 200,1000 230,1080 C250,1130 240,1180 210,1220 C270,1190 290,1120 280,1060 "
                   "C272,1000 290,950 320,925 Z"),
}

ACCENT = {  # 小饰物（剪影上的金色细节）
    "lajiao": '<path d="M380,742 C410,700 440,700 452,726 C440,760 404,770 380,742 Z" fill="#b8322a"/>',
    "gaowen": '<path d="M470,790 C520,760 580,770 600,800" stroke="url(#gold)" stroke-width="6" fill="none"/>',
    "andefu": '<rect x="520" y="845" width="70" height="26" rx="12" fill="none" stroke="url(#gold)" stroke-width="5"/>',
    "mei": '<circle cx="470" cy="975" r="9" fill="url(#gold)"/>',
    "maike": '<path d="M330,860 C330,760 560,760 560,860" stroke="url(#gold)" stroke-width="10" fill="none"/>',
    "gengen": '<path d="M330,1170 L600,1170" stroke="url(#gold)" stroke-width="8"/>',
    "qianduoduo": '<circle cx="380" cy="1190" r="14" fill="url(#gold)"/><circle cx="420" cy="1190" r="14" fill="url(#gold)"/>',
    "linda": '<circle cx="452" cy="985" r="10" fill="url(#gold)"/><path d="M452,995 L452,1020" stroke="url(#gold)" stroke-width="4"/>',
}


def silhouette(key):
    g, hair = HAIR.get(key, ("M", ""))
    base = FEMALE if g == "F" else MALE
    return (f'<g transform="translate(740,930) scale(0.95) translate(-470,-930)">'
            f'<path d="{base}" fill="{INK}"/><path d="{hair}" fill="{INK}"/>{ACCENT.get(key, "")}</g>')


def emblem(kind):
    """DM与公共物料的椭圆内图样：鎏金麦克风／对开天平"""
    if kind == "dm":
        return ('<g transform="translate(740,930)" fill="url(#gold)">'
                '<rect x="-80" y="-230" width="160" height="230" rx="80"/>'
                '<path d="M-130,-60 L-130,10 C-130,120 130,120 130,10 L130,-60" fill="none" stroke="url(#gold)" stroke-width="22"/>'
                '<rect x="-12" y="110" width="24" height="120"/><rect x="-120" y="225" width="240" height="30" rx="14"/></g>')
    return ('<g transform="translate(740,930)" fill="url(#gold)" stroke="url(#gold)">'
            '<rect x="-10" y="-260" width="20" height="440"/><rect x="-200" y="-200" width="400" height="16" rx="8"/>'
            '<path d="M-180,-184 L-250,-20 L-110,-20 Z" fill="none" stroke-width="6"/><path d="M180,-184 L110,-20 L250,-20 Z" fill="none" stroke-width="6"/>'
            '<path d="M-260,-20 C-240,40 -120,40 -100,-20 Z"/><path d="M100,-20 C120,40 240,40 260,-20 Z"/>'
            '<rect x="-120" y="170" width="240" height="30" rx="14"/></g>')


def portrait_image(key):
    for ext in ("jpg", "png", "webp"):
        p = os.path.join(HERE, "portraits", f"{key}.{ext}")
        if os.path.exists(p):
            mime = "jpeg" if ext == "jpg" else ext
            data = base64.b64encode(open(p, "rb").read()).decode()
            return (f'<image href="data:image/{mime};base64,{data}" x="410" y="510" width="660" height="840" '
                    f'preserveAspectRatio="xMidYMid slice" clip-path="url(#oval)"/>')
    return None


def cover_svg(no, name, party, role, slogan, prop, kind="角色剧本 · 共四册", warn="未经DM允许，请勿翻阅他人剧本", color=None):
    bg, pat, rib = PAL.get(party, PAL[None])
    img = portrait_image(prop)
    inner = img or (silhouette(prop) if prop in HAIR else emblem(prop))
    party_txt = {"驴": "驴 友 党", "象": "大 象 党"}.get(party, "")
    name_size = 112 if len(name) <= 5 else 92
    slogan_size = min(46, int(900 / (len(slogan) + 2)))
    corners = "".join(scroll(x, y, r, 0.9) for x, y, r in [(170, 230, 45), (1310, 230, 135), (170, 1870, -45), (1310, 1870, -135)])
    frame_scrolls = "".join(scroll(740 + 372 * math.cos(math.radians(a)), 930 + 462 * math.sin(math.radians(a)), a + 90, 0.55)
                            for a in (200, 340, 160, 20))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1480 2100" width="148mm" height="210mm">{DEFS}
  <rect width="1480" height="2100" fill="{bg}"/>
  {damask(pat)}
  <rect x="50" y="50" width="1380" height="2000" fill="none" stroke="url(#gold)" stroke-width="14"/>
  <rect x="78" y="78" width="1324" height="1944" fill="none" stroke="url(#gold)" stroke-width="4"/>
  {corners}
  <text x="740" y="200" font-family="Noto Serif SC" font-weight="700" font-size="30" fill="{rib}" text-anchor="middle" letter-spacing="14">ASCHAM 工作室 · 城限欢乐阵营本 · {no}</text>
  <text x="740" y="330" font-family="Noto Serif SC" font-weight="900" font-size="140" fill="{INK}" text-anchor="middle" letter-spacing="10">摇摆！</text>
  <text x="740" y="392" font-family="Noto Serif SC" font-weight="700" font-size="38" fill="{rib}" text-anchor="middle" letter-spacing="22">两边都是我的人</text>
  <ellipse cx="740" cy="930" rx="392" ry="482" fill="url(#gold)"/>
  <ellipse cx="740" cy="930" rx="372" ry="462" fill="none" stroke="#7a5a17" stroke-width="3"/>
  <ellipse cx="740" cy="930" rx="352" ry="442" fill="url(#gold)" stroke="#fbefc0" stroke-width="3"/>
  <ellipse cx="740" cy="930" rx="330" ry="420" fill="url(#ivory)"/>
  <g clip-path="url(#oval)">{inner}</g>
  <ellipse cx="740" cy="930" rx="330" ry="420" fill="none" stroke="#7a5a17" stroke-width="5"/>
  {frame_scrolls}
  {shell(740, 462, 0, 0.95)}
  {shell(740, 1408, 180, 1.0)}
  {garland(380, 560, 1100, 560, 120)}
  {rosette(380, 560, 1.1)}{rosette(1100, 560, 1.1)}
  <g transform="translate(740,1520)">
    <path d="M-520,-70 L520,-70 L470,0 L520,70 L-520,70 L-470,0 Z" fill="{rib}"/>
    <path d="M-560,-40 L-520,-70 L-520,70 L-560,100 L-600,40 Z" fill="{rib}" opacity=".75"/>
    <path d="M560,-40 L520,-70 L520,70 L560,100 L600,40 Z" fill="{rib}" opacity=".75"/>
    <path d="M-500,-56 L500,-56 M-500,56 L500,56" stroke="url(#gold)" stroke-width="4"/>
    <text x="0" y="{name_size*0.36:.0f}" font-family="Noto Serif SC" font-weight="900" font-size="{name_size}" fill="#fffaf0" text-anchor="middle">{name}</text>
  </g>
  <text x="740" y="1660" font-family="Noto Serif SC" font-weight="700" font-size="38" fill="{INK}" text-anchor="middle">{role}</text>
  {'<text x="740" y="1725" font-family="Noto Serif SC" font-weight="900" font-size="36" fill="'+rib+'" text-anchor="middle" letter-spacing="8">❦ '+party_txt+' ❦</text>' if party_txt else ''}
  <text x="740" y="1812" font-family="Noto Serif SC" font-style="italic" font-weight="700" font-size="{slogan_size}" fill="{INK}" text-anchor="middle">“{slogan}”</text>
  <path d="M520,1850 C600,1830 680,1870 740,1850 C800,1830 880,1870 960,1850" fill="none" stroke="url(#gold)" stroke-width="5"/>
  <text x="740" y="1930" font-family="Noto Serif SC" font-weight="900" font-size="36" fill="{INK}" text-anchor="middle" letter-spacing="10">{kind}</text>
  <text x="740" y="1985" font-family="Noto Serif SC" font-size="28" fill="{rib}" text-anchor="middle">{warn}</text>
</svg>'''
