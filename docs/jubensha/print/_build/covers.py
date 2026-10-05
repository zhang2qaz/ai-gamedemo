"""《摇摆！》封面生成：复古竞选海报风，A5（148×210mm），viewBox 1480×2100。
封面只用公开信息（胸牌政党、公开身份、签名台词），不泄露真阵营。"""

INK = "#1b1a17"
PAPER = "#f3e9d4"
GOLD = "#c9a24a"
BLUE = "#1f4e9c"
RED = "#b8322a"
GRAY = "#4a4a48"

PARTY = {
    "驴": {"name": "驴友党", "color": BLUE, "motto": "驴友出发！"},
    "象": {"name": "大象党", "color": RED, "motto": "象来如此！"},
}


def star(cx, cy, r, fill):
    import math
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.42
        pts.append(f"{cx + rr * math.cos(a):.1f},{cy + rr * math.sin(a):.1f}")
    return f'<polygon points="{" ".join(pts)}" fill="{fill}"/>'


# ---------- 道具插画（中心 0,0，约 ±320） ----------
def prop_lajiao(c):
    return f'''
<g transform="rotate(-28)">
  <rect x="-18" y="40" width="36" height="300" rx="14" fill="{INK}"/>
  <rect x="-24" y="200" width="48" height="16" rx="6" fill="{GOLD}"/>
  <path d="M-110,-260 Q-120,-40 -40,40 L40,40 Q120,-40 110,-260 Z" fill="{INK}"/>
  <rect x="-62" y="-210" width="18" height="190" rx="9" fill="{PAPER}"/>
  <rect x="-9" y="-220" width="18" height="200" rx="9" fill="{PAPER}"/>
  <rect x="44" y="-210" width="18" height="190" rx="9" fill="{PAPER}"/>
</g>
<g transform="translate(150,40) rotate(24)">
  <path d="M0,-170 C70,-150 90,-40 60,60 C40,140 -10,190 -60,200 C-20,140 0,60 -10,-20 C-15,-80 -30,-130 0,-170 Z" fill="{RED}"/>
  <path d="M0,-170 C-10,-210 20,-240 50,-250" stroke="#2f6b2f" stroke-width="18" fill="none" stroke-linecap="round"/>
  <path d="M-20,-160 Q10,-190 40,-160 Q10,-150 -20,-160 Z" fill="#2f6b2f"/>
  <path d="M20,-110 C40,-60 40,0 25,50" stroke="{PAPER}" stroke-width="10" fill="none" opacity=".55" stroke-linecap="round"/>
</g>'''


def prop_gaowen(c):
    return f'''
<g>
  <path d="M-150,170 C-170,40 -150,-60 -90,-110 L90,-110 C150,-60 170,40 150,170 Z" fill="{INK}"/>
  <path d="M-170,-60 C-200,-200 -60,-300 60,-280 C180,-260 230,-170 200,-90 C150,-150 60,-170 -20,-150 C-90,-135 -140,-100 -170,-60 Z" fill="{INK}"/>
  <path d="M-120,-150 C-40,-230 90,-240 170,-150" stroke="{GOLD}" stroke-width="14" fill="none" stroke-linecap="round"/>
  <path d="M-80,-190 C0,-250 100,-240 150,-190" stroke="{PAPER}" stroke-width="8" fill="none" opacity=".7" stroke-linecap="round"/>
  <rect x="-230" y="190" width="460" height="22" rx="11" fill="{INK}"/>
</g>
<g transform="translate(240,60)">
  <rect x="-55" y="-120" width="110" height="250" rx="22" fill="{c}"/>
  <rect x="-35" y="-160" width="70" height="44" rx="10" fill="{INK}"/>
  <rect x="-12" y="-185" width="24" height="28" rx="6" fill="{INK}"/>
  <text x="0" y="20" font-family="Noto Sans SC" font-weight="900" font-size="46" fill="{PAPER}" text-anchor="middle" writing-mode="tb">定型</text>
  <path d="M-90,-175 l-40,-20 M-95,-150 l-50,0 M-90,-125 l-40,20" stroke="{INK}" stroke-width="10" stroke-linecap="round"/>
</g>'''


def prop_andefu(c):
    lines = "".join(f'<line x1="-230" y1="{y}" x2="-30" y2="{y}" stroke="{GRAY}" stroke-width="5"/>'
                    f'<line x1="30" y1="{y}" x2="230" y2="{y}" stroke="{GRAY}" stroke-width="5"/>'
                    for y in range(-120, 150, 38))
    return f'''
<g>
  <path d="M-270,-190 L0,-150 L270,-190 L270,200 L0,240 L-270,200 Z" fill="{INK}"/>
  <path d="M-250,-170 L-10,-135 L-10,215 L-250,180 Z" fill="{PAPER}"/>
  <path d="M10,-135 L250,-170 L250,180 L10,215 Z" fill="{PAPER}"/>
  {lines}
  <text x="-130" y="-60" font-family="Noto Serif SC" font-weight="900" font-size="64" fill="{c}" text-anchor="middle">欠</text>
  <text x="130" y="-60" font-family="Noto Serif SC" font-weight="900" font-size="64" fill="{c}" text-anchor="middle">还</text>
  <g transform="translate(200,180) rotate(-35)">
    <rect x="-16" y="-200" width="32" height="230" rx="8" fill="{GOLD}"/>
    <path d="M-16,30 L0,80 L16,30 Z" fill="{INK}"/>
  </g>
</g>'''


def prop_mei(c):
    return f'''
<g transform="rotate(-6)">
  <rect x="-200" y="-250" width="360" height="470" rx="18" fill="{INK}"/>
  <rect x="-180" y="-230" width="320" height="430" rx="10" fill="{PAPER}"/>
  {''.join(f'<circle cx="{x}" cy="-250" r="14" fill="{GOLD}"/>' for x in range(-160, 150, 50))}
  {''.join(f'<line x1="-150" y1="{y}" x2="110" y2="{y}" stroke="{GRAY}" stroke-width="5"/>' for y in range(-150, 180, 42))}
  <g transform="translate(-20,10) rotate(-14)">
    <rect x="-150" y="-60" width="300" height="120" rx="12" fill="none" stroke="{c}" stroke-width="14"/>
    <text x="0" y="28" font-family="Noto Serif SC" font-weight="900" font-size="86" fill="{c}" text-anchor="middle">独　家</text>
  </g>
</g>
<g transform="translate(210,40) rotate(30)">
  <rect x="-22" y="-230" width="44" height="300" rx="18" fill="{INK}"/>
  <rect x="-22" y="-120" width="44" height="18" fill="{GOLD}"/>
  <path d="M-22,70 L0,150 L22,70 Z" fill="{GOLD}"/>
</g>'''


def prop_maike(c):
    grill = "".join(f'<line x1="-95" y1="{y}" x2="95" y2="{y}" stroke="{GRAY}" stroke-width="6"/>' for y in range(-230, -40, 26))
    return f'''
<g>
  <rect x="-110" y="-280" width="220" height="280" rx="110" fill="{INK}"/>
  {grill}
  <rect x="-125" y="-120" width="250" height="26" rx="10" fill="{c}"/>
  <path d="M-170,-170 L-170,-60 C-170,40 170,40 170,-60 L170,-170" stroke="{INK}" stroke-width="22" fill="none"/>
  <rect x="-14" y="20" width="28" height="170" fill="{INK}"/>
  <rect x="-140" y="180" width="280" height="34" rx="16" fill="{INK}"/>
  <text x="0" y="270" font-family="Noto Sans SC" font-weight="900" font-size="44" fill="{c}" text-anchor="middle">● ON AIR 3:00:00</text>
</g>'''


def prop_gengen(c):
    ribs = "".join(f'<line x1="0" y1="-60" x2="{x}" y2="40" stroke="{PAPER}" stroke-width="6" opacity=".55"/>' for x in (-200, -100, 0, 100, 200))
    return f'''
<g transform="translate(-30,-40)">
  <path d="M-260,40 C-250,-150 -110,-250 0,-250 C110,-250 250,-150 260,40 C220,10 180,10 150,40 C110,10 60,10 50,40 C10,10 -40,10 -50,40 C-90,10 -140,10 -150,40 C-190,10 -230,10 -260,40 Z" fill="{INK}"/>
  {ribs}
  <rect x="-10" y="-280" width="20" height="40" rx="6" fill="{INK}"/>
  <rect x="-10" y="40" width="20" height="260" fill="{INK}"/>
  <path d="M10,300 C10,350 70,350 70,300" stroke="{INK}" stroke-width="20" fill="none" stroke-linecap="round"/>
</g>
<g fill="{c}">
  <ellipse cx="170" cy="250" rx="34" ry="54"/>
  <ellipse cx="250" cy="200" rx="34" ry="54" opacity=".45"/>
</g>
<text x="210" y="330" font-family="Noto Sans SC" font-weight="700" font-size="40" fill="{GRAY}" text-anchor="middle">← 半步 →</text>'''


def prop_qianduoduo(c):
    def bottle(tx, rot, col):
        return f'''
<g transform="translate({tx},40) rotate({rot})">
  <path d="M-55,250 L-55,-40 C-55,-90 -24,-110 -24,-150 L-24,-230 L24,-230 L24,-150 C24,-110 55,-90 55,-40 L55,250 Z" fill="{INK}"/>
  <rect x="-30" y="-262" width="60" height="40" rx="8" fill="{GOLD}"/>
  <rect x="-55" y="40" width="110" height="110" fill="{col}"/>
  <text x="0" y="112" font-family="Noto Serif SC" font-weight="900" font-size="58" fill="{PAPER}" text-anchor="middle">押</text>
</g>'''
    bubbles = "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{GOLD}" opacity=".8"/>' for x, y, r in
                      [(-120, -250, 12), (-90, -300, 8), (-150, -320, 6), (120, -250, 12), (95, -300, 8), (150, -320, 6)])
    return bottle(-110, -18, BLUE) + bottle(110, 18, RED) + bubbles


def prop_linda(c):
    return f'''
<g transform="rotate(-4)">
  <path d="M-260,-170 L-120,-170 L-90,-210 L60,-210 L80,-170 L260,-170 L260,220 L-260,220 Z" fill="{INK}"/>
  <rect x="-235" y="-140" width="470" height="330" rx="6" fill="{PAPER}"/>
  {''.join(f'<line x1="-200" y1="{y}" x2="60" y2="{y}" stroke="{GRAY}" stroke-width="5"/>' for y in range(-90, 170, 40))}
  <rect x="-200" y="-125" width="190" height="34" fill="{c}"/>
  <text x="-105" y="-98" font-family="Noto Sans SC" font-weight="900" font-size="26" fill="{PAPER}" text-anchor="middle">背景调查 · 机密</text>
</g>
<g transform="translate(120,40) rotate(-30)">
  <circle cx="0" cy="0" r="120" fill="{PAPER}" fill-opacity=".35" stroke="{INK}" stroke-width="28"/>
  <path d="M-50,-40 A70,70 0 0 1 30,-70" stroke="#fff" stroke-width="12" fill="none" opacity=".8" stroke-linecap="round"/>
  <rect x="-22" y="130" width="44" height="190" rx="14" fill="{INK}"/>
  <rect x="-26" y="125" width="52" height="30" rx="6" fill="{GOLD}"/>
</g>'''


def prop_dm(c):
    return f'''
<g>
  <rect x="-300" y="-250" width="600" height="190" rx="30" fill="{INK}"/>
  <rect x="-280" y="-230" width="560" height="150" rx="20" fill="{RED}"/>
  <text x="0" y="-122" font-family="Noto Sans SC" font-weight="900" font-size="104" fill="{PAPER}" text-anchor="middle" letter-spacing="18">ON AIR</text>
  <rect x="-70" y="-10" width="140" height="190" rx="70" fill="{INK}"/>
  {''.join(f'<line x1="-58" y1="{y}" x2="58" y2="{y}" stroke="{GRAY}" stroke-width="5"/>' for y in range(10, 150, 22))}
  <path d="M-110,60 L-110,120 C-110,220 110,220 110,120 L110,60" stroke="{INK}" stroke-width="18" fill="none"/>
  <rect x="-10" y="210" width="20" height="90" fill="{INK}"/>
  <rect x="-110" y="295" width="220" height="26" rx="12" fill="{INK}"/>
</g>'''


def prop_public(c):
    return f'''
<g>
  <rect x="-300" y="-240" width="600" height="420" rx="40" fill="{INK}"/>
  <rect x="-270" y="-210" width="540" height="360" rx="24" fill="{PAPER}"/>
  <rect x="-270" y="-210" width="270" height="360" fill="{BLUE}" opacity=".9"/>
  <rect x="0" y="-210" width="270" height="360" fill="{RED}" opacity=".9"/>
  <text x="-135" y="10" font-family="Noto Sans SC" font-weight="900" font-size="130" fill="{PAPER}" text-anchor="middle">驴</text>
  <text x="135" y="10" font-family="Noto Sans SC" font-weight="900" font-size="130" fill="{PAPER}" text-anchor="middle">象</text>
  <text x="0" y="110" font-family="Noto Sans SC" font-weight="900" font-size="54" fill="{PAPER}" text-anchor="middle">VS</text>
  <path d="M-120,180 L-160,280 M120,180 L160,280" stroke="{INK}" stroke-width="22" stroke-linecap="round"/>
  <path d="M-100,-240 L-170,-320 M100,-240 L170,-320" stroke="{INK}" stroke-width="12" stroke-linecap="round"/>
</g>'''


PROPS = {
    "lajiao": prop_lajiao, "gaowen": prop_gaowen, "andefu": prop_andefu, "mei": prop_mei,
    "maike": prop_maike, "gengen": prop_gengen, "qianduoduo": prop_qianduoduo, "linda": prop_linda,
    "dm": prop_dm, "public": prop_public,
}


def cover_svg(no, name, party, role, slogan, prop, kind="角色剧本 · 共四册", warn="未经DM允许，请勿翻阅他人剧本", color=None):
    p = PARTY.get(party)
    c = color or (p["color"] if p else INK)
    party_badge = ""
    if p:
        party_badge = f'''
  <g transform="translate(740,1640)">
    <rect x="-210" y="-48" width="420" height="96" rx="48" fill="{c}"/>
    {star(-150, 0, 30, PAPER)}{star(150, 0, 30, PAPER)}
    <text x="0" y="18" font-family="Noto Sans SC" font-weight="900" font-size="50" fill="{PAPER}" text-anchor="middle" letter-spacing="6">{p["name"]}</text>
  </g>'''
    stripes = "".join(f'<rect x="0" y="{y}" width="1480" height="14" fill="{c}" opacity=".06"/>' for y in range(240, 2100, 40))
    name_size = 150 if len(name) <= 5 else 124
    slogan_size = min(56, int(1000 / (len(slogan) + 2)))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1480 2100" width="148mm" height="210mm">
  <rect width="1480" height="2100" fill="{PAPER}"/>
  {stripes}
  <rect x="40" y="40" width="1400" height="2020" fill="none" stroke="{INK}" stroke-width="6"/>
  <rect x="58" y="58" width="1364" height="1984" fill="none" stroke="{INK}" stroke-width="2"/>
  <rect x="58" y="58" width="1364" height="96" fill="{INK}"/>
  <text x="100" y="120" font-family="Noto Sans SC" font-weight="700" font-size="34" fill="{PAPER}" letter-spacing="4">ASCHAM 工作室 出品 · 城限欢乐阵营本</text>
  <text x="1380" y="120" font-family="Noto Sans SC" font-weight="900" font-size="40" fill="{GOLD}" text-anchor="end">{no}</text>
  <text x="740" y="370" font-family="ZCOOL QingKe HuangYou" font-size="230" fill="{INK}" text-anchor="middle">摇摆！</text>
  <text x="740" y="450" font-family="Noto Serif SC" font-weight="700" font-size="48" fill="{c}" text-anchor="middle" letter-spacing="20">两边都是我的人</text>
  <circle cx="740" cy="900" r="390" fill="{c}" opacity=".14"/>
  <circle cx="740" cy="900" r="390" fill="none" stroke="{INK}" stroke-width="6"/>
  <circle cx="740" cy="900" r="408" fill="none" stroke="{c}" stroke-width="4" stroke-dasharray="14 12"/>
  <g transform="translate(740,900)">{PROPS[prop](c)}</g>
  <text x="740" y="1460" font-family="Noto Serif SC" font-weight="900" font-size="{name_size}" fill="{INK}" text-anchor="middle">{name}</text>
  <text x="740" y="1540" font-family="Noto Sans SC" font-weight="700" font-size="40" fill="{GRAY}" text-anchor="middle">{role}</text>
  {party_badge}
  <g transform="translate(740,1810)">
    <path d="M-560,-60 L560,-60 L520,0 L560,60 L-560,60 L-520,0 Z" fill="{INK}"/>
    <text x="0" y="20" font-family="Noto Serif SC" font-weight="900" font-size="{slogan_size}" fill="{PAPER}" text-anchor="middle">“{slogan}”</text>
  </g>
  <text x="740" y="1955" font-family="Noto Sans SC" font-weight="900" font-size="40" fill="{INK}" text-anchor="middle" letter-spacing="8">{kind}</text>
  <text x="740" y="2010" font-family="Noto Sans SC" font-size="30" fill="{GRAY}" text-anchor="middle">{warn}</text>
</svg>'''
