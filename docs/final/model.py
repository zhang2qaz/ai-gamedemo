import json, copy
FX=6.7
P={"121":dict(list=599,promo=549,bf=499,le=899,land=244.23,exw=120.70,fba=107,mcf=190,war=12.5,share=40/176),
   "bar":dict(list=799,promo=799,bf=799,le=1099,land=383.35,exw=213.45,fba=107,mcf=190,war=12.5,share=66/176),
   "wine":dict(list=799,promo=799,bf=799,le=1099,land=355.42,exw=233.61,fba=107,mcf=190,war=12.5,share=30/176),
   "ct":dict(list=499,promo=479,bf=449,le=699,land=190.77,exw=114.40,fba=22,mcf=45,war=9.4,share=40/176)}
for k in P: P[k]["dutyfrt"]=P[k]["land"]-P[k]["exw"]
def ref(p): return 0.15*min(p,300)+0.08*max(p-300,0)
RET=0.04; CS=2; PAY=0.03; DMG=0.02
A=dict(nyc_courier=115, nyc_pick=15, nat_fee=79)
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
CH={"amz_fbm":(lambda: mix(lambda k:u_amz(k,"promo",0.30,True)), lambda: mixp("promo")),
 "amz_launch":(lambda: mix(lambda k:u_amz(k,"promo",0.30)), lambda: mixp("promo")),
 "amz_list":(lambda: mix(lambda k:u_amz(k,"list",0.12)), lambda: mixp("list")),
 "amz_promo":(lambda: mix(lambda k:u_amz(k,"promo",0.12)), lambda: mixp("promo")),
 "amz_bf":(lambda: mix(lambda k:u_amz(k,"bf",0.15)), lambda: mixp("bf")),
 "pre":(lambda: mix(lambda k:0.5*u_nyc(k)+0.5*u_nat(k)), lambda: mixp()),
 "nyc":(lambda: mix(lambda k:u_nyc(k)), lambda: mixp()),
 "nat":(lambda: mix(lambda k:u_nat(k)), lambda: mixp()),
 "b2b":(lambda: mix(lambda k:u_b2b(k,0.55)), lambda: mixp("list",0.55)),
 "venue":(lambda: mix(lambda k:u_b2b(k,0.65)), lambda: mixp("list",0.65)),
 "le":(lambda: mix(lambda k:0.5*u_nyc(k,"le",0.10)+0.5*u_nat(k,"le",0.10)), lambda: mixp("le")),
 "gift":(lambda: mix(lambda k:u_nat(k,"list",0,0.85)), lambda: mixp("list",0.85))}
AMZ={"amz_fbm","amz_launch","amz_list","amz_promo","amz_bf"}
MONTHS=["2026-11","2026-12"]+[f"2027-{m:02d}" for m in range(1,13)]+[f"2028-{m:02d}" for m in range(1,13)]
M27=[m for m in MONTHS if m.startswith("2027")]
def zeros(): return {m:0 for m in MONTHS}
LAND=mix(lambda k:P[k]["land"]); EXW=mix(lambda k:P[k]["exw"]); DUTY=mix(lambda k:P[k]["dutyfrt"])
# ------------- demand paths -------------
def demand(path, phase3=True, y28=True):
    """path: 'A' no CES (Feb launch), 'B' minimal CES, 'C' full CES. Returns demand by channel/month (not stock-constrained)."""
    s={c:zeros() for c in CH}
    ces = {"A":0.0,"B":0.8,"C":1.0}[path]
    # pre-order deposits -> deliveries (85%); list drivers
    if path in ("B","C"):
        dep_jan=int(round((2500*ces+1500)*0.04)); dep_feb=int(round((1500+800+420)*0.04))
        deliver={"2027-02":int(round(dep_jan*0.85)),"2027-03":int(round(dep_feb*0.85))}
    else:
        dep_feb=int(round((5000+800+420+300)*0.04)); deliver={"2027-03":int(round(dep_feb*0.85))}
    for m,u in deliver.items(): s["pre"][m]=u
    amz27={"2027-01":("amz_fbm",30 if path!="A" else 0),"2027-02":("amz_launch",42),"2027-03":("amz_launch",44),"2027-04":("amz_list",60),"2027-05":("amz_list",62),"2027-06":("amz_list",60),
           "2027-07":("amz_promo",81),"2027-08":("amz_list",68),"2027-09":("amz_list",66),"2027-10":("amz_list",68),"2027-11":("amz_bf",105),"2027-12":("amz_promo",93)}
    for m,(c,u) in amz27.items(): s[c][m]+=int(round(u*(1+0.15*ces)))
    # NYC DTC: popup Feb 42; web Mar-Jun; H2 web + store incremental (phase3)
    nyc={"2027-02":42,"2027-03":60,"2027-04":90,"2027-05":120,"2027-06":130,"2027-07":130,"2027-08":140,"2027-09":150,"2027-10":160,"2027-11":190,"2027-12":170}
    store={"2027-08":60,"2027-09":90,"2027-10":110,"2027-11":150,"2027-12":120}
    for m,u in nyc.items(): s["nyc"][m]+=u
    if phase3:
        for m,u in store.items(): s["nyc"][m]+=u
    for m,u in zip(M27[2:],[20,30,40,40,60,60,60,60,60,60]): s["nat"][m]+=u
    # B2B: C: 5 clients; B: 4; A: 3 (IHS March)
    b2b={"C":{"2027-04":30,"2027-05":30,"2027-06":40,"2027-07":50,"2027-08":50,"2027-09":50,"2027-10":80,"2027-11":90,"2027-12":80},
         "B":{"2027-04":20,"2027-05":30,"2027-06":30,"2027-07":40,"2027-08":40,"2027-09":50,"2027-10":70,"2027-11":70,"2027-12":60},
         "A":{"2027-06":20,"2027-07":30,"2027-08":30,"2027-09":40,"2027-10":60,"2027-11":60,"2027-12":60}}[path]
    for m,u in b2b.items(): s["b2b"][m]+=u
    ven={"2027-04":5,"2027-05":7,"2027-06":8}; ven3={"2027-07":30,"2027-08":30,"2027-09":40,"2027-10":40,"2027-11":40,"2027-12":200}
    for m,u in ven.items(): s["venue"][m]+=u
    if phase3:
        for m,u in ven3.items(): s["venue"][m]+=u
        s["le"]["2027-09"]=300
        for m,u in {"2027-10":60,"2027-11":120,"2027-12":120}.items(): s["gift"][m]+=u
    if y28:
        b28={"C":2500,"B":2000,"A":1500}[path]
        for i,m in enumerate([x for x in MONTHS if x.startswith("2028")]):
            s["nyc"][m]+= [200,200,220,240,260,260,260,270,280,300,340,300][i] if phase3 else 150
            s["amz_list"][m]+= [120,120,130,140,150,150,170,150,150,150,200,170][i]
            s["b2b"][m]+= int(round(b28/12*[0.6,0.6,0.8,0.9,1.0,1.0,1.0,1.0,1.1,1.3,1.4,1.3][i]))
            s["nat"][m]+=75
            if phase3:
                s["venue"][m]+=50; s["gift"][m]+= [20,20,20,30,40,40,40,40,50,80,120,100][i]
                if m in ("2028-04","2028-09"): s["le"][m]+=300
    return s
# ------------- costs -------------
def fixed_costs(path, phase3=True):
    f={m:{} for m in MONTHS}
    for m in MONTHS:
        f[m]["adlink"]=10000 if m<"2027-02" else (20000 if m<"2027-07" else 26000)
        lead=9000 if m>="2026-12" else 0; sales=8000 if m>="2027-01" else 0
        store=(10000 if (phase3 and m>="2027-07") else 0)
        f[m]["us_staff"]=lead+sales+store
        f[m]["cs_ins"]=(500+900) if m>="2027-01" else 300
    return f
def oneoff(path, alofty_terms="80/20"):
    o={"Jon 设计尾款（合同，验收后）":{"2026-12":49500},
       "傲然深化设计（合同，未付）":{"2026-11":85790/FX},
       "Adlink 建站 20,276（合同）":{"2026-11":14193,"2027-01":4055,"2027-02":2028}}
    if path=="C":
        if alofty_terms=="80/20": o["Alofty 制作 22.0 万上限（报价条款 80/20）"]={"2026-11":176000,"2027-01":44000}
        else: o["Alofty 制作 22.0 万上限（目标条款 40/40/20）"]={"2026-11":88000,"2026-12":88000,"2027-01":44000}
        o["展馆官方费用（预留）"]={"2027-01":28000}; o["CES 运营（预留 8.0）"]={"2026-12":25000,"2027-01":55000}
        o["CES 公关（预留）"]={"2026-12":15000,"2027-01":10000}; o["CES 预备金"]={"2027-01":20000}
    elif path=="B":
        o["租赁结构搭建（待报价）"]={"2026-12":60000,"2027-01":40000}; o["展馆官方费用（预留）"]={"2027-01":28000}
        o["CES 运营（精简）"]={"2026-12":20000,"2027-01":40000}; o["CES 公关（预留）"]={"2026-12":15000,"2027-01":10000}; o["预备金"]={"2027-01":10000}
    else:
        o["纽约发布会（2 月）"]={"2027-02":20000}; o["芝加哥家居展观展（3 月）"]={"2027-03":15000}
        o["同等媒体覆盖所需额外公关和拍摄"]={m:5000 for m in M27[:10]}
    return o
PHASE={"P1":{"2026-11":8000,"2026-12":32000,"2027-01":24000,"2027-02":35000},
       "P2":{"2027-03":30000,"2027-04":32000,"2027-05":23000,"2027-06":23000},
       "P3":{"2027-07":90000,"2027-08":45000,"2027-09":55000,"2027-10":40000,"2027-11":42000,"2027-12":45000},
       "P28":{m:38000 for m in MONTHS if m.startswith("2028")}}
# marketing cost attributable to acquisition, by month (for CAC) -- subset of PHASE
ACQ={"pre":{"2026-12":8000,"2027-01":8000,"2027-02":4400},     # paid list 2.4 + part of content
     "nyc":{"2027-02":20000,"2027-03":13000,"2027-04":13000,"2027-05":13000,"2027-06":13000,"2027-07":15000,"2027-08":15000,"2027-09":15000,"2027-10":15000,"2027-11":15000,"2027-12":15000}}
SEED={"2027-01":30,"2027-03":20}; VINE={"2027-01":20}; SAMPLES={"2027-01":10,"2027-04":5}; SPARES={"2027-01":5}
# ------------- engine -------------
def run(path, phase3=True, y28=True, phases=("P1","P2","P3","P28"), alofty_terms="80/20", scale=None, dem_override=None, label="", stop_month=None, arrivals_override=None, nyc_courier=None, fba_big=None):
    global A
    A0=dict(A); 
    if nyc_courier: A["nyc_courier"]=nyc_courier
    fb0={k:P[k]["fba"] for k in P}; mc0={k:P[k]["mcf"] for k in P}
    if fba_big:
        for k in ("121","bar","wine"): P[k]["fba"]=fba_big; P[k]["mcf"]=fba_big+80
    uc={c:CH[c][0]() for c in CH}; pr={c:CH[c][1]() for c in CH}
    dem=dem_override or demand(path,phase3,y28)
    if scale:
        for c,fac in scale.items():
            for m in dem[c]: dem[c][m]=int(round(dem[c][m]*fac))
    if stop_month:
        for c in dem:
            for m in dem[c]:
                if m>stop_month: dem[c][m]=0
    # arrivals: first batch 176 Dec; batch2 200 ordered 1/9 arr 3/15; then sized to cover next 2 months + 40 safety, ordered 2 months ahead
    arr={"2026-12":176,"2027-01":300,"2027-03":300} if path in ("B","C") else {"2026-12":176,"2027-03":300}
    if arrivals_override: arr.update(arrivals_override)
    fixed=fixed_costs(path,phase3); one=oneoff(path,alofty_terms)
    stock=0; rows=[]; inv_rows=[]; cum=0; peak=(0,""); cin=zeros(); cout=zeros(); ar=zeros(); ap=zeros()
    sold={c:zeros() for c in CH}
    lost=zeros()
    for i,m in enumerate(MONTHS):
        # dynamic arrivals: at month i, decide arrival for i+2 (lead 60 days) to cover months i+2,i+3
        if i>=3 and (MONTHS[i+2] if i+2<len(MONTHS) else None) and MONTHS[i+2] not in arr and not (stop_month and m>=stop_month):
            need=sum(dem[c][x] for c in CH for x in MONTHS[i+2:i+4])
            proj=stock+sum(arr.get(x,0) for x in MONTHS[i:i+2])-sum(dem[c][x] for c in CH for x in MONTHS[i:i+2])
            q=max(0,int(round((need-proj+40)/10.0))*10)
            if q>0: arr[MONTHS[i+2]]=q
        opening=stock; stock+=arr.get(m,0)
        use=SEED.get(m,0)+VINE.get(m,0)+SAMPLES.get(m,0)+SPARES.get(m,0)
        use=min(use,stock); stock-=use
        # sales constrained by stock, priority: pre, b2b, nyc, amazon..., others
        want=sum(dem[c][m] for c in CH); m_sold=0
        for c in ["pre","b2b","nyc","amz_fbm","amz_launch","amz_list","amz_promo","amz_bf","nat","venue","le","gift"]:
            q=min(dem[c][m],stock); sold[c][m]=q; stock-=q; m_sold+=q
        lost[m]=want-m_sold
        returns=int(round(m_sold*0.02))  # resalable returns back to stock
        stock+=returns
        inv_rows.append(dict(m=m,opening=opening,arrival=arr.get(m,0),use=use,sold=m_sold,returns=returns,closing=stock,unmet=lost[m]))
        rev=sum(sold[c][m]*pr[c] for c in CH); contrib=sum(sold[c][m]*uc[c] for c in CH)
        fx=sum(fixed[m].values()); oo=sum(v.get(m,0) for v in one.values()); ph=sum(PHASE[p].get(m,0) for p in phases if (p!="P3" or phase3) and (p!="P28" or (y28 and phase3)))
        if path in ("B","C") and m=="2027-01" and "P1" in phases: ph-=9600
        if stop_month and m>stop_month: ph=0; fx=fixed[m]["adlink"]*(1 if m<="2027-10" else 0)+fixed[m]["cs_ins"]  # after stop: adlink to contract end (Oct 2027), cs/ins
        units_cost=use*LAND
        ebit=contrib-fx-oo-ph-units_cost
        rows.append(dict(m=m,units=m_sold,rev=rev,contrib=contrib,fixed=fx,oneoff=oo,phase=ph,seed=units_cost,ebit=ebit))
        # cash
        amz_rev=sum(sold[c][m]*pr[c] for c in CH if c in AMZ); b2b_rev=sum(sold[c][m]*pr[c] for c in CH if c in("b2b","venue")); dtc_rev=rev-amz_rev-b2b_rev
        amz_net=sum(sold[c][m]*(pr[c]-ref(pr[c])-mix(lambda k:P[k]["fba"])-(0.30 if c in("amz_fbm","amz_launch") else 0.12)*pr[c]) for c in CH if c in AMZ)
        cin[m]+=dtc_rev+amz_net*0.4
        if i+1<len(MONTHS): cin[MONTHS[i+1]]+=amz_net*0.6
        else: ar[m]+=amz_net*0.6
        if i+2<len(MONTHS): cin[MONTHS[i+2]]+=b2b_rev
        else: ar[m]+=b2b_rev
        var=0
        for c in CH:
            if sold[c][m]==0: continue
            if c in AMZ: var+=sold[c][m]*(RET*pr[c]+mix(lambda k:P[k]["war"])*0.8+CS)
            elif c in("b2b","venue"): var+=sold[c][m]*36
            else: var+=sold[c][m]*(pr[c]-uc[c]-LAND)
        cout[m]+=var+fx+oo+ph
        if m in arr:
            cout[m]+=arr[m]*DUTY
            if i+2<len(MONTHS): cout[MONTHS[i+2]]+=arr[m]*EXW
            else: ap[m]+=arr[m]*EXW
    cash=[]; cum=0; peak=(0,"")
    for m in MONTHS:
        net=cin[m]-cout[m]; cum+=net
        if cum<peak[0]: peak=(cum,m)
        cash.append(dict(m=m,cin=cin[m],cout=cout[m],net=net,cum=cum))
    A=dict(A0)
    for k in P: P[k]["fba"]=fb0[k]; P[k]["mcf"]=mc0[k]
    def agg(ms):
        R=[r for r in rows if r["m"] in ms]; C=[c for c in cash if c["m"] in ms]
        return dict(units=sum(r["units"] for r in R),rev=sum(r["rev"] for r in R),contrib=sum(r["contrib"] for r in R),fixed=sum(r["fixed"] for r in R),oneoff=sum(r["oneoff"] for r in R),phase=sum(r["phase"] for r in R),seed=sum(r["seed"] for r in R),ebit=sum(r["ebit"] for r in R),cash=sum(c["net"] for c in C))
    y26=agg([m for m in MONTHS if m.startswith("2026")]); y27=agg(M27); y28s=agg([m for m in MONTHS if m.startswith("2028")])
    end27=[c for c in cash if c["m"]=="2027-12"][0]["cum"]
    payable_end27=sum(arr.get(x,0)*EXW for x in ("2027-11","2027-12"))
    inv_end27=[r for r in inv_rows if r["m"]=="2027-12"][0]["closing"]
    payback=next((c["m"] for c in cash if c["cum"]>=0 and c["m"]>"2027-06"),None)
    return dict(label=label,path=path,rows=rows,cash=cash,inv=inv_rows,sold=sold,uc=uc,pr=pr,arr=arr,y26=y26,y27=y27,y28=y28s,end27=end27,peak=peak,payable_end27=payable_end27,inv_end27=inv_end27,payback=payback,unmet=sum(lost[m] for m in M27))
OUT={}
for p in "ABC": OUT[p]=run(p,label=p)
OUT["C4040"]=run("C",alofty_terms="40/40/20",label="C 40/40/20")
base=OUT["C"]
# scenarios on base path A
OUT["A_down"]=run("C",phase3=False,y28=True,scale={"pre":0.4,"nyc":0.6,"b2b":0.4,"nat":0.5,"amz_launch":0.7,"amz_list":0.7,"amz_promo":0.7,"amz_bf":0.7},label="down")
OUT["A_up"]=run("C",scale={"pre":1.6,"nyc":1.4,"b2b":1.6,"nat":1.4,"amz_launch":1.2,"amz_list":1.2,"amz_promo":1.2,"amz_bf":1.2,"le":1.5,"gift":1.5},label="up")
OUT["A_half"]=run("C",scale={c:0.5 for c in CH},label="half")
OUT["A_nomedia"]=run("C",scale={"pre":0.3,"nyc":0.4,"nat":0.4,"amz_launch":0.7,"amz_list":0.7,"amz_promo":0.7,"amz_bf":0.7},label="nomedia")
OUT["A_delivery"]=run("C",nyc_courier=175,fba_big=202,label="delivery+")
OUT["A_both"]=run("C",scale={c:0.5 for c in CH},nyc_courier=175,fba_big=202,label="half+delivery")
dl=demand("C")
for c in dl:
    for m in list(dl[c]):
        if m in ("2027-02","2027-03") and c in ("pre","nyc","amz_launch"): 
            dl[c]["2027-04"]=dl[c].get("2027-04",0)+int(dl[c][m]*0.6); dl[c][m]=0
OUT["A_delay"]=run("C",dem_override=dl,arrivals_override={"2027-01":0,"2027-03":300},label="delay")
# stops on path A: stop at 2027-02 (P1 fail), 2027-06 (P2 fail)
OUT["A_stop_feb"]=run("C",phase3=False,y28=False,phases=("P1",),stop_month="2027-02",label="stop feb",scale={"pre":0.4,"nyc":0.6,"amz_launch":0.7,"amz_list":0.7})
OUT["A_stop_jun"]=run("C",phase3=False,y28=False,phases=("P1","P2"),stop_month="2027-06",label="stop jun",scale={"pre":0.4,"nyc":0.6,"b2b":0.4,"amz_launch":0.7,"amz_list":0.7})
# CES increment: C vs A, 2027+2028 contribution and cost
def inc(a,b):
    return dict(contrib27=b["y27"]["contrib"]-a["y27"]["contrib"],contrib28=b["y28"]["contrib"]-a["y28"]["contrib"],oneoff=b["y26"]["oneoff"]+b["y27"]["oneoff"]-a["y26"]["oneoff"]-a["y27"]["oneoff"],ebit27=b["y27"]["ebit"]+b["y26"]["ebit"]-a["y27"]["ebit"]-a["y26"]["ebit"],ebit28=b["y28"]["ebit"]-a["y28"]["ebit"],peak=b["peak"][0]-a["peak"][0])
OUT["inc_C"]=inc(OUT["A"],OUT["C"]); OUT["inc_B"]=inc(OUT["A"],OUT["B"])
OUT["inc_C"]["contrib29"]=1500*OUT["C"]["uc"]["b2b"]
# CAC per channel (path A, 2027)
cac={}
for c,costs in ACQ.items():
    u=sum(OUT["C"]["sold"][c][m] for m in M27); k=sum(v for m,v in costs.items() if m in M27 or m.startswith("2026"))
    cac[c]=dict(units=u,cost=k,cac=k/u if u else None,uc=OUT["C"]["uc"][c],net=OUT["C"]["uc"][c]-(k/u if u else 0))
OUT["cac"]=cac

# ---- stop settlement (path A) ----
def settlement(res, stop_m, deposits_units):
    """已发生净支出 + 未结合同义务 + 清算 − 库存净回收"""
    cash_to=[c for c in res["cash"] if c["m"]<=stop_m]
    spent=-sum(c["net"] for c in cash_to)                       # 已发生净现金支出
    i=MONTHS.index(stop_m)
    committed=sum(res["arr"].get(x,0) for x in MONTHS[i+1:i+3])          # 已下单未到货
    inv=[r for r in res["inv"] if r["m"]==stop_m][0]["closing"]+committed
    unpaid=sum(res["arr"].get(x,0) for x in MONTHS[max(0,i-1):i+3])*EXW+committed*DUTY   # 未付出厂价 + 在途关税海运
    months_left=MONTHS.index("2027-10")-i                        # Adlink phase1 to contract end Oct 2027
    adlink=max(0,months_left)*10000
    # liquidation: 60/mo via Amazon at list (uc amz_list), 70% normal, 20% at -20% price, 10% unsold
    uc=res["uc"]["amz_list"]; pr=res["pr"]["amz_list"]
    normal=int(inv*0.7); disc=int(inv*0.2); unsold=inv-normal-disc
    recov=normal*uc+disc*(uc-0.2*pr)   # contribution recovered
    months_to_sell=(normal+disc)/60
    hold=months_to_sell*(1400)         # cs+ins during sell-down
    refund=deposits_units*0.30*res["pr"]["pre"]
    total=spent+unpaid+adlink+hold-recov
    return dict(stop=stop_m,spent=spent,inventory_units=inv,committed=committed,unpaid_goods=unpaid,adlink_tail=adlink,hold=hold,recovery=recov,unsold_units=unsold,months_to_sell=months_to_sell,deposit_refund=refund,total_loss=total)
OUT["settle_feb"]=settlement(OUT["A_stop_feb"],"2027-02",104)
OUT["settle_jun"]=settlement(OUT["A_stop_jun"],"2027-06",0)
# cancel now
OUT["settle_now"]=dict(sunk=223881+49500,obligations=49500+85790/FX+20276,note="取消 CES 且不启动第一阶段")
# ---- CES break-even: extra DTC units or B2B units needed to cover incremental cost ----
OUT["ces_be"]={"C":dict(cost=OUT["inc_C"]["oneoff"],ret=OUT["inc_C"]["contrib27"]+OUT["inc_C"]["contrib28"]+OUT["inc_C"]["contrib29"],dtc_units=OUT["inc_C"]["oneoff"]/OUT["A"]["uc"]["nyc"],b2b_units=OUT["inc_C"]["oneoff"]/OUT["A"]["uc"]["b2b"]),
               "B":dict(cost=OUT["inc_B"]["oneoff"],dtc_units=OUT["inc_B"]["oneoff"]/OUT["A"]["uc"]["nyc"],b2b_units=OUT["inc_B"]["oneoff"]/OUT["A"]["uc"]["b2b"])}
# ---- gate economics ----
A_=OUT["C"]
cum_oct=sum(r["units"] for r in A_["rows"] if "2027-01"<=r["m"]<="2027-10")
store_inc=sum(A_["sold"]["nyc"][m] for m in ("2027-08","2027-09","2027-10","2027-11","2027-12"))  # includes web; store incremental assumed 530
OUT["gates"]=dict(cum_oct=cum_oct,store_monthly_cost=12000+10000+5000,store_breakeven_units=(12000+10000+5000)/A_["uc"]["nyc"],
                  p1_deposits_base=int(round((2500+1500)*0.04))+int(round((1500+800+420)*0.04)),p1_deliver_base=int(round((2500+1500)*0.04*0.85))+int(round((1500+800+420)*0.04*0.85)),
                  batch2=300,first_sellable=111)
# ---- 2028 cash reconciliation (path A) ----
OUT["recon28"]=dict(ebit=A_["y28"]["ebit"],cash=A_["y28"]["cash"],diff=A_["y28"]["cash"]-A_["y28"]["ebit"],cum_end28=A_["cash"][-1]["cum"])

json.dump(OUT,open("/tmp/claude-0/-home-user-ai-gamedemo/b143fa9f-d94c-50cb-9503-e400b8d7eac0/scratchpad/final/out3.json","w"),ensure_ascii=False,default=str)
W=lambda x:f"{x/1e4:6.1f}"
for k in ("A","B","C","C4040","A_down","A_up","A_half","A_nomedia","A_delivery","A_both","A_delay","A_stop_feb","A_stop_jun"):
    r=OUT[k]; print(f"{k:10s} 27u {r['y27']['units']:5d} rev{W(r['y27']['rev'])} ctr{W(r['y27']['contrib'])} fx{W(r['y27']['fixed'])} oo{W(r['y26']['oneoff']+r['y27']['oneoff'])} ph{W(r['y26']['phase']+r['y27']['phase'])} ebit26-27{W(r['y26']['ebit']+r['y27']['ebit'])} cash27end{W(r['end27'])} peak{W(r['peak'][0])} {r['peak'][1]} 28u {r['y28']['units']} ebit28{W(r['y28']['ebit'])} cash28{W(r['y28']['cash'])} payback {r['payback']} unmet {r['unmet']} payable{W(r['payable_end27'])} inv {r['inv_end27']}")
print("incC",{k:round(v/1e4,1) for k,v in OUT["inc_C"].items()}); print("incB",{k:round(v/1e4,1) for k,v in OUT["inc_B"].items()})
print("cac",{c:{k:(round(v) if isinstance(v,(int,float)) else v) for k,v in d.items()} for c,d in cac.items()})
for r in OUT["C"]["inv"][:9]: print(r)
print("incC",{k:round(v/1e4,1) for k,v in OUT["inc_C"].items()})

print("settle_feb",{k:(round(v/1e4,1) if isinstance(v,float) and abs(v)>100 else v) for k,v in OUT["settle_feb"].items()})
print("settle_jun",{k:(round(v/1e4,1) if isinstance(v,float) and abs(v)>100 else v) for k,v in OUT["settle_jun"].items()})
print("ces_be",{k:{a:round(b) for a,b in v.items()} for k,v in OUT["ces_be"].items()})
print("gates",OUT["gates"]); print("recon28",{k:round(v/1e4,1) for k,v in OUT["recon28"].items()})
