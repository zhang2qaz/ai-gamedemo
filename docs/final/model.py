import json, copy
FX=6.7
# ---------- unit basis (USD) ----------
P={"121":dict(list=599,promo=549,bf=499,le=899,land=244.23,exw=120.70,dutyfrt=244.23-120.70-3.83,fba=107,mcf=190,war=12.5,share=40/176),
   "bar":dict(list=799,promo=799,bf=799,le=1099,land=383.35,exw=213.45,dutyfrt=383.35-213.45-3.83,fba=107,mcf=190,war=12.5,share=66/176),
   "wine":dict(list=799,promo=799,bf=799,le=1099,land=355.42,exw=233.61,dutyfrt=355.42-233.61-3.83,fba=107,mcf=190,war=12.5,share=30/176),
   "ct":dict(list=499,promo=479,bf=449,le=699,land=190.77,exw=114.40,dutyfrt=190.77-114.40-1.16,fba=22,mcf=45,war=9.4,share=40/176)}
def ref(p): return 0.15*min(p,300)+0.08*max(p-300,0)
RET=0.04; CS=2; PAY=0.03; DMG=0.02
A=dict(nyc_courier=115, nyc_pick=15, nat_fee=79)   # adjustable assumptions
def u_amz(k,tier="list",ads=0.12,fbm=False):
    p=P[k][tier]; f=P[k]["fba"]+(293 if (fbm and k!="ct") else 0)
    return p-ref(p)-f-RET*p-P[k]["war"]-CS-P[k]["land"]-ads*p
def u_nyc(k,tier="list",roy=0):
    p=P[k][tier]; d=A["nyc_courier"] if k!="ct" else 35
    return p-P[k]["land"]-A["nyc_pick"]-d-PAY*p-RET*p-P[k]["war"]-3-DMG*P[k]["land"]-roy*p
def u_nat(k,tier="list",roy=0,disc=1.0):
    p=P[k][tier]*disc; fee=A["nat_fee"] if k!="ct" else 0
    return p+fee-P[k]["land"]-P[k]["mcf"]-PAY*(p+fee)-RET*p-P[k]["war"]-3-DMG*P[k]["land"]-roy*p
def u_b2b(k,disc): return P[k]["list"]*disc-P[k]["land"]-30-P[k]["war"]*0.5
def mix(fn): return sum(P[k]["share"]*fn(k) for k in P)
def mixp(tier="list",disc=1.0): return sum(P[k]["share"]*P[k][tier]*disc for k in P)
CH={ # channel: (unit contribution fn, avg price fn, cash timing lag months, deposit model)
 "amz_launch":(lambda: mix(lambda k:u_amz(k,"promo",0.30)), lambda: mixp("promo")),
 "amz_fbm":(lambda: mix(lambda k:u_amz(k,"promo",0.30,True)), lambda: mixp("promo")),
 "amz_list":(lambda: mix(lambda k:u_amz(k,"list",0.12)), lambda: mixp("list")),
 "amz_promo":(lambda: mix(lambda k:u_amz(k,"promo",0.12)), lambda: mixp("promo")),
 "amz_bf":(lambda: mix(lambda k:u_amz(k,"bf",0.15)), lambda: mixp("bf")),
 "pre_nyc":(lambda: mix(lambda k:u_nyc(k)), lambda: mixp()),
 "pre_nat":(lambda: mix(lambda k:u_nat(k)), lambda: mixp()),
 "nyc":(lambda: mix(lambda k:u_nyc(k)), lambda: mixp()),
 "nat":(lambda: mix(lambda k:u_nat(k)), lambda: mixp()),
 "b2b":(lambda: mix(lambda k:u_b2b(k,0.55)), lambda: mixp("list",0.55)),
 "venue":(lambda: mix(lambda k:u_b2b(k,0.65)), lambda: mixp("list",0.65)),
 "le_nyc":(lambda: mix(lambda k:u_nyc(k,"le",0.10)), lambda: mixp("le")),
 "le_nat":(lambda: mix(lambda k:u_nat(k,"le",0.10)), lambda: mixp("le")),
 "gift":(lambda: mix(lambda k:u_nat(k,"list",0,0.85)), lambda: mixp("list",0.85)),
}
MONTHS=["2026-11","2026-12"]+[f"2027-{m:02d}" for m in range(1,13)]
def zeros(): return {m:0 for m in MONTHS}
# ---------- base sales path (units by channel by month) ----------
def base_sales():
    s={c:zeros() for c in CH}
    # pre-order: deposits Jan 320, delivered Feb 111 (first batch sellable), Mar 161
    s["pre_nyc"]["2027-02"]=56; s["pre_nat"]["2027-02"]=55; s["pre_nyc"]["2027-03"]=80; s["pre_nat"]["2027-03"]=81
    amz={"2027-01":("amz_fbm",30),"2027-02":("amz_launch",42),"2027-03":("amz_launch",44),"2027-04":("amz_list",60),"2027-05":("amz_list",62),"2027-06":("amz_list",60),
         "2027-07":("amz_promo",81),"2027-08":("amz_list",68),"2027-09":("amz_list",66),"2027-10":("amz_list",68),"2027-11":("amz_bf",105),"2027-12":("amz_promo",93)}
    for m,(c,u) in amz.items(): s[c][m]+=u
    for m,u in zip(MONTHS[3:],[42,60,90,120,130, 160,180,200,220,260,220]): s["nyc"][m]+=u   # Feb popup 42 then DTC; H2 is phase3
    for m,u in zip(MONTHS[4:],[20,30,40,40,60,60,60,60,60,60]): s["nat"][m]+=u
    for m,u in {"2027-04":30,"2027-05":30,"2027-06":40,"2027-07":50,"2027-08":50,"2027-09":50,"2027-10":80,"2027-11":90,"2027-12":80}.items(): s["b2b"][m]+=u
    for m,u in {"2027-04":5,"2027-05":7,"2027-06":8,"2027-07":30,"2027-08":30,"2027-09":40,"2027-10":40,"2027-11":40,"2027-12":200}.items(): s["venue"][m]+=u  # Dec incl hotel rooms
    s["le_nyc"]["2027-09"]=150; s["le_nat"]["2027-09"]=150
    for m,u in {"2027-10":60,"2027-11":120,"2027-12":120}.items(): s["gift"][m]+=u
    return s
# ---------- costs ----------
def fixed_costs(phase3=True, staff_scale=1.0):
    f={m:{} for m in MONTHS}
    for m in MONTHS:
        f[m]["adlink"]=10000 if m<"2027-02" else (20000 if m<"2027-07" else 26000)
        if m in ("2026-11","2026-12","2027-01","2027-02"): f[m]["us_staff"]=3750*staff_scale
        elif m<="2027-06": f[m]["us_staff"]=7500*staff_scale
        else: f[m]["us_staff"]=(7500+(6000 if phase3 else 0))*staff_scale
        f[m]["cs"]=500 if m>="2027-01" else 0
        f[m]["ins_platform"]=900 if m>="2027-01" else 300
    return f
ONEOFF={ # label -> {month: amount}  (USD)
 "Jon 设计尾款（合同，验收后）":{"2026-12":49500},
 "傲然深化设计（合同，未付）":{"2026-11":85790/FX},
 "Alofty 制作 24 万（报价）40/40/20":{"2026-11":96000,"2026-12":96000,"2027-01":48000},
 "展馆官方费用（预留）":{"2027-01":28000},
 "CES 运营（预留 ≤10 万）":{"2026-12":30000,"2027-01":65000},
 "CES 公关（预留）":{"2026-12":15000,"2027-01":10000},
 "CES 预备金":{"2027-01":20000},
 "Adlink 建站 20,276":{"2026-11":14193,"2027-01":4055,"2027-02":2028},
}
PHASE={
 "P1":{"2026-11":8000,"2026-12":32000,"2027-01":24000,"2027-02":35000},   # 9.9万 incl 2.4万 pre-launch list ads
 "P2":{"2027-03":30000,"2027-04":32000,"2027-05":23000,"2027-06":23000},  # 10.8万
 "P3":{"2027-07":90000,"2027-08":45000,"2027-09":55000,"2027-10":40000,"2027-11":42000,"2027-12":45000}, # 31.7万
}
def inventory_plan(sales):
    # units needed per month -> purchases: batch arrivals; cash: dutyfrt at arrival, exw 60 days later
    need={m:sum(sales[c][m] for c in CH) for m in MONTHS}
    arrivals={"2026-12":176}
    # batch2 ordered Jan9 arrives Mar; subsequent arrivals sized to next 2 months demand
    sched={"2027-03":["2027-03","2027-04"],"2027-05":["2027-05","2027-06"],"2027-07":["2027-07","2027-08"],"2027-09":["2027-09","2027-10"],"2027-11":["2027-11","2027-12"]}
    stock=176
    for am,cov in sched.items():
        cov_need=sum(need[x] for x in cov)
        prior=sum(need[x] for x in MONTHS if x<am)
        have=sum(arrivals.values())-prior
        qty=max(0,int(round((cov_need-have+40)/10.0))*10)
        if am=="2027-03": qty=max(qty,300)
        arrivals[am]=qty
    return need,arrivals
def run(sales, fixed, phases=("P1","P2","P3"), oneoff=ONEOFF, label="base"):
    uc={c:CH[c][0]() for c in CH}; pr={c:CH[c][1]() for c in CH}
    need,arr=inventory_plan(sales)
    rows=[]; cum=0; peak=(0,"")
    cash_in=zeros(); cash_out=zeros()
    for m in MONTHS:
        rev=sum(sales[c][m]*pr[c] for c in CH); contrib=sum(sales[c][m]*uc[c] for c in CH)
        fx=sum(fixed[m].values()); one=sum(v.get(m,0) for v in oneoff.values()); ph=sum(PHASE[p].get(m,0) for p in phases)
        ebit=contrib-fx-one-ph
        # cash: revenue timing: DTC same month (deposits earlier ignored), amazon 50% next month, b2b +2 months
        rows.append(dict(m=m,units=sum(sales[c][m] for c in CH),rev=rev,contrib=contrib,fixed=fx,oneoff=one,phase=ph,ebit=ebit))
    # cash flow
    idx={m:i for i,m in enumerate(MONTHS)}
    for i,m in enumerate(MONTHS):
        r=rows[i]
        # revenue receipts
        amz_rev=sum(sales[c][m]*pr[c] for c in CH if c.startswith("amz")); b2b_rev=sum(sales[c][m]*pr[c] for c in CH if c in("b2b","venue")); dtc_rev=r["rev"]-amz_rev-b2b_rev
        amz_net=sum(sales[c][m]*(pr[c]-ref(pr[c])-P["121"]["fba"]*0.77-0.12*pr[c]) for c in CH if c.startswith("amz"))  # amazon remits net of fees/ads approx
        cash_in[m]+=dtc_rev
        if i+1<len(MONTHS): cash_in[MONTHS[i+1]]+=amz_net*0.6
        cash_in[m]+=amz_net*0.4
        if i+2<len(MONTHS): cash_in[MONTHS[i+2]]+=b2b_rev
        # variable costs excluding product & amazon fees (already netted): DTC fulfil, returns, warranty, cs, payment, b2b handling
        var=0
        for c in CH:
            if sales[c][m]==0: continue
            if c.startswith("amz"): var+=sales[c][m]*(RET*pr[c]+P["121"]["war"]*0.8+CS)
            elif c in ("b2b","venue"): var+=sales[c][m]*(30+6)
            else:
                cost=pr[c]-uc[c]-mix(lambda k:P[k]["land"])
                var+=sales[c][m]*cost
        cash_out[m]+=var+r["fixed"]+r["oneoff"]+r["phase"]
        # inventory cash
        if m in arr:
            cash_out[m]+=arr[m]*mix(lambda k:P[k]["dutyfrt"])
            j=i+2
            if j<len(MONTHS): cash_out[MONTHS[j]]+=arr[m]*mix(lambda k:P[k]["exw"])
    cum=0; cumrows=[]
    for m in MONTHS:
        net=cash_in[m]-cash_out[m]; cum+=net
        if cum<peak[0]: peak=(cum,m)
        cumrows.append(dict(m=m,cin=cash_in[m],cout=cash_out[m],net=net,cum=cum))
    tot=dict(units=sum(r["units"] for r in rows),rev=sum(r["rev"] for r in rows),contrib=sum(r["contrib"] for r in rows),fixed=sum(r["fixed"] for r in rows),
             oneoff=sum(r["oneoff"] for r in rows),phase=sum(r["phase"] for r in rows),ebit=sum(r["ebit"] for r in rows),cum_cash=cum,peak=peak,arrivals=arr)
    return dict(label=label,rows=rows,cash=cumrows,tot=tot,uc=uc,pr=pr)
def scale(sales,factor,chs=None):
    s=copy.deepcopy(sales)
    for c in s:
        if chs and c not in chs: continue
        for m in s[c]: s[c][m]=int(round(s[c][m]*factor))
    return s
def phase3_off(sales):
    s=copy.deepcopy(sales)
    for c in s:
        for m in s[c]:
            if m>="2027-07":
                if c in ("nyc",): s[c][m]=min(s[c][m],130)
                elif c in ("le_nyc","le_nat","gift"): s[c][m]=0
                elif c=="venue": s[c][m]=min(s[c][m],10)
    return s
OUT={}
base=base_sales(); OUT["base"]=run(base,fixed_costs())
# down: phase2 gate fails -> phase3 not launched
down=copy.deepcopy(base)
for c in down:
    for m in down[c]:
        if c in("pre_nyc","pre_nat"): down[c][m]=int(round(down[c][m]*0.35))
        elif c.startswith("amz"): down[c][m]=int(round(down[c][m]*0.7))
        elif c=="nyc": down[c][m]=int(round(down[c][m]*0.6))
        elif c=="b2b": down[c][m]=int(round(down[c][m]*0.4))
        elif c=="nat": down[c][m]=int(round(down[c][m]*0.5))
down=phase3_off(down)
OUT["down"]=run(down,fixed_costs(phase3=False),phases=("P1","P2"),label="down")
up=copy.deepcopy(base)
for c in up:
    for m in up[c]:
        if c in("pre_nyc","pre_nat"): up[c][m]=int(round(up[c][m]*1.7))
        elif c.startswith("amz"): up[c][m]=int(round(up[c][m]*1.2))
        elif c in ("nyc","nat"): up[c][m]=int(round(up[c][m]*1.4))
        elif c=="b2b": up[c][m]=int(round(up[c][m]*1.6))
        elif c in ("le_nyc","le_nat","gift"): up[c][m]=int(round(up[c][m]*1.6))
OUT["up"]=run(up,fixed_costs(),label="up")
# stress tests on base
OUT["s_half"]=run(scale(base,0.5),fixed_costs(),label="half")
nomedia=copy.deepcopy(base)
for c in nomedia:
    for m in nomedia[c]:
        if c in("pre_nyc","pre_nat"): nomedia[c][m]=int(round(nomedia[c][m]*0.3))
        elif c in("nyc","nat"): nomedia[c][m]=int(round(nomedia[c][m]*0.4))
        elif c.startswith("amz"): nomedia[c][m]=int(round(nomedia[c][m]*0.7))
OUT["s_nomedia"]=run(nomedia,fixed_costs(),label="nomedia")
A0=dict(A); A.update(nyc_courier=175); 
for k in ("121","bar","wine"): P[k]["mcf"]=250; P[k]["fba"]=202
OUT["s_delivery"]=run(base,fixed_costs(),label="delivery+")
OUT["s_both"]=run(scale(base,0.5),fixed_costs(),label="half+delivery")
A.update(A0)
for k in ("121","bar","wine"): P[k]["mcf"]=190; P[k]["fba"]=107
delay=copy.deepcopy(base)
# 6-week delay: Jan-Feb amazon 0, pre-order deliveries shift to Apr, NYC Mar-Apr halved
for c in delay:
    if c in ("amz_fbm","amz_launch"):
        delay[c]["2027-01"]=0; delay[c]["2027-02"]=0
    if c in ("pre_nyc","pre_nat"):
        v=delay[c]["2027-02"]+delay[c]["2027-03"]; delay[c]["2027-02"]=0; delay[c]["2027-03"]=0; delay[c]["2027-04"]=int(round(v*0.85))
    if c=="nyc":
        delay[c]["2027-03"]=int(delay[c]["2027-03"]*0.5); delay[c]["2027-04"]=int(delay[c]["2027-04"]*0.5)
OUT["s_delay"]=run(delay,fixed_costs(),label="delay")
# channel table
OUT["units"]={c:{"uc":CH[c][0](),"pr":CH[c][1]()} for c in CH}
OUT["per_product"]={k:{"amz_list":u_amz(k),"amz_launch":u_amz(k,"promo",0.30),"nyc":u_nyc(k),"nat":u_nat(k),"b2b":u_b2b(k,0.55),"venue":u_b2b(k,0.65),"le_nyc":u_nyc(k,"le",0.10),"gift":u_nat(k,"list",0,0.85),"list":P[k]["list"],"land":P[k]["land"],"ref":ref(P[k]["list"]),"fba":P[k]["fba"]} for k in P}
OUT["base_sales"]=base; OUT["down_sales"]=down

# ---- alternatives ----
# Alt A: cancel CES now (save build/venue/ops/PR/reserve), launch Feb via NY popup + media event (+3万) + IHS March (+1.5万)
oneA={k:v for k,v in ONEOFF.items() if k.startswith(("Jon","傲然","Adlink"))}
oneA["纽约媒体发布会+芝加哥展（替代）"]={"2027-02":30000,"2027-03":15000}
altA=copy.deepcopy(base)
for c in altA:
    for m in altA[c]:
        if c in("pre_nyc","pre_nat"): altA[c][m]=int(round(altA[c][m]*0.4))
        elif c.startswith("amz"): altA[c][m]=int(round(altA[c][m]*0.8))
        elif c=="b2b": altA[c][m]=int(round(altA[c][m]*0.6))
        elif c in("nyc","nat"): altA[c][m]=int(round(altA[c][m]*0.85))
OUT["altA_noCES"]=run(altA,fixed_costs(),oneoff=oneA,label="noCES")
# Alt B: CES + Amazon/B2B/national only, no NY phases (staff 1 FTE from Apr only)
altB={c:zeros() for c in CH}
for c in ("amz_fbm","amz_launch","amz_list","amz_promo","amz_bf","b2b","nat"):
    altB[c]=copy.deepcopy(base[c])
for m in altB["nat"]: altB["nat"][m]=int(altB["nat"][m]*0.5)
fB=fixed_costs(phase3=False)
for m in fB:
    fB[m]["us_staff"]=0 if m<"2027-04" else 7500
OUT["altB_amz_b2b"]=run(altB,fB,phases=(),label="amz_b2b")
# ---- 2028 conditional (base path passed all gates) ----
y28_units={"nyc":3000,"amz_list":1800,"b2b":2500,"venue":600,"le_nyc":300,"le_nat":300,"gift":600,"nat":900}
uc={c:CH[c][0]() for c in CH}; pr={c:CH[c][1]() for c in CH}
r28=sum(u*pr[c] for c,u in y28_units.items()); c28=sum(u*uc[c] for c,u in y28_units.items())
f28=10000*12+10000*12+6000*12+(7500+7500+6000+5000)*12+18000  # adlink, 2 BD/ops + 2 store, cs/ins
p28=144000+120000+100000+60000+30000       # store lease, events, content, PR, LE tooling
OUT["y2028"]=dict(units=sum(y28_units.values()),rev=r28,contrib=c28,fixed=f28,program=p28,ebit=c28-f28-p28,detail=y28_units)
# ---- stop-loss tables ----
def spent_until(res,m_end):
    tot=0
    for r in res["rows"]:
        if r["m"]<=m_end: tot+=r["fixed"]+r["oneoff"]+r["phase"]-r["contrib"]
    return tot
OUT["stop"]={
 "P1_end":dict(net_spent=spent_until(OUT["down"],"2027-02"),adlink_tail=10000*8,inventory_units=176+300,inventory_cost=(176+300)*mix(lambda k:P[k]["land"])),
 "P2_end":dict(net_spent=spent_until(OUT["down"],"2027-06"),adlink_tail=10000*4,inventory_units=OUT["down"]["tot"]["arrivals"]["2027-05"]+260,inventory_cost=0),
}
json.dump(OUT,open("/tmp/claude-0/-home-user-ai-gamedemo/b143fa9f-d94c-50cb-9503-e400b8d7eac0/scratchpad/final/out.json","w"),ensure_ascii=False,default=str)
for k in ("altA_noCES","altB_amz_b2b"):
    t=OUT[k]["tot"]; print(f"{k:12s} units {t['units']:5d} rev {t['rev']/1e4:6.1f} contrib {t['contrib']/1e4:6.1f} fixed {t['fixed']/1e4:5.1f} oneoff {t['oneoff']/1e4:5.1f} phase {t['phase']/1e4:5.1f} ebit {t['ebit']/1e4:6.1f} cumcash {t['cum_cash']/1e4:6.1f} peak {t['peak'][0]/1e4:6.1f} {t['peak'][1]}")
y=OUT["y2028"]; print("2028", y["units"], round(y["rev"]/1e4,1), round(y["contrib"]/1e4,1), round(y["fixed"]/1e4,1), round(y["program"]/1e4,1), round(y["ebit"]/1e4,1))
print("stop",{k:{kk:round(vv/1e4,1) if isinstance(vv,float) else vv for kk,vv in v.items()} for k,v in OUT["stop"].items()})

json.dump(OUT,open("/tmp/claude-0/-home-user-ai-gamedemo/b143fa9f-d94c-50cb-9503-e400b8d7eac0/scratchpad/final/out.json","w"),ensure_ascii=False,default=str)
for k in ("base","down","up","s_half","s_nomedia","s_delivery","s_both","s_delay"):
    t=OUT[k]["tot"]
    print(f"{k:11s} units {t['units']:5d} rev {t['rev']/1e4:6.1f} contrib {t['contrib']/1e4:6.1f} fixed {t['fixed']/1e4:5.1f} oneoff {t['oneoff']/1e4:5.1f} phase {t['phase']/1e4:5.1f} ebit {t['ebit']/1e4:6.1f} cumcash {t['cum_cash']/1e4:6.1f} peak {t['peak'][0]/1e4:6.1f} {t['peak'][1]} arr {t['arrivals']}")
print({c:(round(OUT['units'][c]['uc']),round(OUT['units'][c]['pr'])) for c in CH})
for r in OUT["base"]["rows"]: print(r["m"],r["units"],round(r["rev"]/1e3),round(r["contrib"]/1e3),round(r["fixed"]/1e3),round(r["oneoff"]/1e3),round(r["phase"]/1e3),round(r["ebit"]/1e3))
for r in OUT["base"]["cash"]: print(r["m"],round(r["cin"]/1e3),round(r["cout"]/1e3),round(r["net"]/1e3),round(r["cum"]/1e3))
