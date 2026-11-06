# fra_cleaned.csv (Kaggle "Fragrantica.com Fragrance Dataset", CC BY-NC-SA 4.0, PewdevCodes/Perfume-Database-Project kopyası)
# ile kataloğu eşleştirir -> tools/catalog-notes-fra.json. Kullanım: python3 -I tools/match-notes-fra.py tools/fra_cleaned.csv
import csv,json,re,sys,unicodedata,collections
csv.field_size_limit(10**9)
def nb(s): return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',s.replace('ı','i').replace('İ','I')).encode('ascii','ignore').decode().lower())
STOP={'mens','mens','pour','homme','for','men','man','him','du','le','la','les','the','of','and','by','edition','extrait','parfum','edp','edt','edc','cologne','perfume','spray','uomo','intense_'}
def toks(s):
    s=re.sub(r'(?i)\beau[\s-]+de[\s-]+(parfum|toilette|cologne)\b',' \\1 ',s)
    s=unicodedata.normalize('NFKD',s.lower().replace('ı','i').replace('°',' ')).encode('ascii','ignore').decode()
    s=re.sub(r"[']",'',s)
    return re.findall(r'[a-z0-9]+',s)
def key_words(name,brand):
    bw=set(toks(brand))|{'emporio'}
    if 'calvin' in bw: bw|={'ck'}
    if 'jean' in bw and 'gaultier' in bw: bw|={'jpg'}
    r=tuple(sorted(w for w in toks(name) if w not in bw and w not in STOP and not re.fullmatch(r'(19|20)\d\d',w)))
    if not r:  # ad yalnızca 'Homme' gibi sözcüklerden oluşuyorsa onları koru
        r=tuple(sorted(w for w in toks(name) if w not in bw and w not in {'eau','de','parfum','toilette','cologne','edp','edt','edc','extrait','elixir'}))
    return r
def conc_of(slug):
    s=' '.join(toks(slug))
    if re.search(r'\bextrait\b',s): return 'Extrait'
    if re.search(r'\beau de parfum\b|\bedp\b',s): return 'EDP'
    if re.search(r'\beau de toilette\b|\bedt\b',s): return 'EDT'
    if re.search(r'\beau de cologne\b|\bcologne\b',s): return 'Cologne'
    if re.search(r'\belixir\b',s): return 'Elixir'
    if re.search(r'\bparfum\b|\bperfume\b',s): return 'Parfum'
    return ''
MALE=re.compile(r"\b(men|mens|man|homme|him|uomo|male|men's)\b",re.I)
NOISE={'millesime','niche','tag','signatures','signature','collection','private','prive','ap','jpg','jean','paul','gaultier','the','alchemists','garden','le','la','les','by','of','new','classic','original','intense_'}
EXPAND={'ap':['armani','prive'],'jpg':[]}
rows=list(csv.DictReader(open(sys.argv[1],encoding='latin-1'),delimiter=';'))
byb=collections.defaultdict(list)
for x in rows:
    if x['Gender']=='women': continue
    byb[nb(x['Brand'])].append(x)
ALI={'hugoboss':['hugo-boss','boss'],'rabanne':['paco-rabanne','rabanne'],'ferragamo':['salvatore-ferragamo'],'kilian':['by-kilian','kilian'],'jomalonelondon':['jo-malone-london'],'editionsdeparfumsfredericmalle':['frederic-malle','editions-de-parfums-frederic-malle'],'cerruti1881':['cerruti'],'yvessaintlaurent':['yves-saint-laurent'],'dolcegabbana':['dolce-gabbana'],'giorgioarmani':['giorgio-armani','armani'],'armani':['giorgio-armani','armani'],'boadiceathevictorious':['boadicea-the-victorious'],'maisonfranciskurkdjian':['maison-francis-kurkdjian'],'houseofsillage':['house-of-sillage'],'lattafa':['lattafa-perfumes','lattafa'],'armaf':['armaf'],'afnan':['afnan'],'frenchavenue':['fragrance-world','french-avenue']}
def bkeys(b):
    k=nb(b);out=[k]+[nb(a) for a in ALI.get(k,[])]
    out+=[kk for kk in byb if len(k)>=4 and len(kk)>=4 and (kk.startswith(k) or k.startswith(kk)) and kk not in out]
    return [o for o in dict.fromkeys(out) if o in byb]
idx={}
for k,lst in byb.items():
    d=collections.defaultdict(list)
    for x in lst: d[key_words(x['Perfume'],x['Brand'])].append(x)
    idx[k]=d
L=json.load(open('tools/catalog-merged.json',encoding='utf-8'))
def conc_clean(n): return re.sub(r'\b(edp|edt|edc|extrait|parfum|cologne|elixir)\b',' ',n,flags=re.I)
out={};stat=collections.Counter()
for v in L:
    ks=bkeys(v['brand'])
    if not ks: stat['nobrand']+=1;continue
    w=key_words(conc_clean(v['name']),v['brand'])
    if not w: stat['empty']+=1;continue
    cands=[x for k in ks for x in idx[k].get(w,[])]
    if not cands:
        # elixir/intense gibi adın parçası olan kelimeler: konsantrasyon sözcüğünü silmeden de dene
        w2=key_words(v['name'],v['brand'])
        cands=[x for k in ks for x in idx[k].get(w2,[])]
    if not cands:
        ours=set(w2 if False else key_words(conc_clean(v['name']),v['brand']))
        ours=set(x for ww in ours for x in EXPAND.get(ww,[ww]))
        best=[]
        for k in ks:
            for kw,lst in idx[k].items():
                th=set(kw)
                if not th or not ours: continue
                if th<=ours and (ours-th)<=NOISE and len(th)>=1:
                    best+= [(len(ours-th),x) for x in lst]
                elif ours<=th and (th-ours)<=NOISE and len(ours)>=1:
                    best+= [(len(th-ours),x) for x in lst]
        if best:
            m=min(b[0] for b in best);cands=[x for d,x in best if d==m]
            if len({tuple(sorted(key_words(x['Perfume'],x['Brand']))) for x in cands})>1: cands=[]
    if not cands: stat['noname']+=1;continue
    mine=bool(MALE.search(v['name']))
    # Cinsiyet filtresi: kadın kayıtlar zaten dışarıda; 'Pour Homme' gibi ekler ad eşleşmesini bozmasın diye ayrıca süzülmez.
    if not cands: stat['gender']+=1;continue
    c=v['conc']
    pick=[x for x in cands if conc_of(x['Perfume'])==c] or [x for x in cands if conc_of(x['Perfume'])==''] or cands
    x=pick[0]
    acc=[x[f'mainaccord{i}'] for i in range(1,6) if x[f'mainaccord{i}']]
    sp=lambda s:[a.strip() for a in s.split(',') if a.strip()]
    out[f"{v['brand']}|{v['name']}|{v['conc']}"]={'accords':acc,'top':sp(x['Top']),'heart':sp(x['Middle']),'base':sp(x['Base']),'src':x['url'],'match':'fra','pname':x['Perfume']}
    stat['ok']+=1
json.dump(out,open('tools/catalog-notes-fra.json','w',encoding='utf-8'),ensure_ascii=False)
print(len(L),stat)
