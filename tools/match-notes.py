# Parfumo verisi (TidyTuesday 2024-12-10, parfumo_data_clean.csv) ile katalogu eşleştirir -> tools/catalog-notes.json
# Kullanım: python3 -I tools/match-notes.py <parfumo_data_clean.csv>
import csv,json,re,sys,unicodedata,difflib,collections
def nb(s): return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',s.replace('ı','i').replace('İ','I')).encode('ascii','ignore').decode().lower())
CONC=[('Extrait',r'extrait(?: de parfum)?|extract'),('EDP',r'eau de parfum|edp'),('EDT',r'eau de toilette|edt'),('EDC',r'eau de cologne|edc'),('Elixir',r'elixir|élixir'),('Cologne',r'cologne'),('Parfum',r'parfum|perfume|pure parfum')]
def split_conc(name):
    s=name;c=''
    for k,p in CONC:
        m=re.search(r'\b(?:'+p+r')\b',s,re.I)
        if m and k!='Elixir':
            c=c or k
    return c
def clean_pname(name,brand):
    s=re.sub(r'\b(19|20)\d\d\b',' ',name)
    s=re.sub(r'\b(extrait de parfum|eau de parfum|eau de toilette|eau de cologne|parfum|extrait|cologne|edp|edt|pour homme|for men|homme)\b',' ',s,flags=re.I)
    b=re.sub(r'\s*/.*','',brand)
    s=re.sub(re.escape(b),' ',s,flags=re.I)
    return nb(s)
STOP={'pour','homme','for','men','man','him','eau','de','du','le','la','les','the','of','and','by','edition','extrait','parfum','edp','edt','edc','cologne','perfume','spray','the'}
def words(name,brand):
    bw=set(re.findall(r'[a-z0-9]+',unicodedata.normalize('NFKD',re.sub(r'\s*/.*','',brand).lower().replace('ı','i')).encode('ascii','ignore').decode()))|{'emporio'}
    s=unicodedata.normalize('NFKD',name.lower().replace('ı','i').replace('\u00b0',' ')).encode('ascii','ignore').decode()
    s=re.sub(r'\b(19|20)\d\d\b',' ',s)
    return tuple(sorted(w for w in re.findall(r'[a-z0-9]+',s) if w not in bw and w not in STOP))
MALE=re.compile(r'\b(men|man|homme|him|uomo|male|masculine)\b',re.I)
def male(n): return bool(MALE.search(n))
def clean_ours(name):
    s=re.sub(r'\b(extrait|edp|edt|edc|parfum|cologne|pour homme|homme)\b',' ',name,flags=re.I)
    return nb(s)
P=list(csv.DictReader(open(sys.argv[1],encoding='utf-8')))
byb=collections.defaultdict(list)
for x in P:
    if x['Top_Notes']=='NA' and x['Main_Accords']=='NA': continue
    bk=nb(re.sub(r'\s*/.*','',x['Brand']))
    byb[bk].append((clean_pname(x['Name'],x['Brand']),split_conc(x['Name']),x,words(x['Name'],x['Brand'])))
def brand_keys(b):
    k=nb(b);out=[k]
    out+=[kk for kk in byb if len(k)>=4 and (kk.startswith(k) or k.startswith(kk) and len(kk)>=4) and kk not in out]
    ALI={'hugoboss':['boss'],'rabanne':['pacorabanne'],'ferragamo':['salvatoreferragamo'],'kilian':['bykilian'],'maisonfranciskurkdjian':['maisonfranciskurkdjian'],'editionsdeparfumsfredericmalle':['fredericmalle','editionsdeparfumsfredericmalle'],'boadiceathevictorious':['boadiceathevictorious'],'jomalonelondon':['jomalone','jomalonelondon'],'cerruti1881':['cerruti'],'puzzleparfum':['puzzleparfumes']}
    out+=ALI.get(k,[])
    return [o for o in out if o in byb]
L=json.load(open('tools/catalog-merged.json',encoding='utf-8'))
out={};stat=collections.Counter()
for v in L:
    ks=brand_keys(v['brand'])
    if not ks: stat['nobrand']+=1;continue
    n=clean_ours(v['name']);c=v['conc']
    cand=[t for k in ks for t in byb[k]]
    best=None
    cand=[t for t in cand if male(t[2]['Name'])==male(v['name'])]
    exact=[t for t in cand if t[0]==n and n]
    wo=words(v['name'],v['brand'])
    if exact:
        same=[t for t in exact if c and t[1]==c]
        best=(same or exact)[0];kind='exact'
    else:
        ex2=[t for t in cand if wo and t[3]==wo]
        if ex2:
            same=[t for t in ex2 if c and t[1]==c]
            best=(same or ex2)[0];kind='exact'
        else:
            sc=[(difflib.SequenceMatcher(None,n,t[0]).ratio(),t) for t in cand if n]
            if sc:
                r,t=max(sc,key=lambda z:z[0])
                dig=lambda w:set(re.findall(r'\d+',w))
                fem=lambda w:bool(re.search(r'women|woman|femme|pour elle|\bher\b',w,re.I))
                if r>=0.95 and dig(v['name'])==dig(t[2]['Name']) and fem(v['name'])==fem(t[2]['Name']) and ('for men' in v['name'].lower())==('for men' in t[2]['Name'].lower()): best=t;kind='fuzzy'
    if not best: stat['noname']+=1;continue
    x=best[2];stat[kind]+=1
    out[f"{v['brand']}|{v['name']}|{v['conc']}"]={'accords':[a.strip() for a in x['Main_Accords'].split(',') if a.strip() and a!='NA'],'top':[a.strip() for a in x['Top_Notes'].split(',') if a.strip() and a!='NA'],'heart':[a.strip() for a in x['Middle_Notes'].split(',') if a.strip() and a!='NA'],'base':[a.strip() for a in x['Base_Notes'].split(',') if a.strip() and a!='NA'],'src':x['URL'],'match':kind,'pname':x['Name']}
json.dump(out,open('tools/catalog-notes.json','w',encoding='utf-8'),ensure_ascii=False)
print(len(L),stat,len(out))
