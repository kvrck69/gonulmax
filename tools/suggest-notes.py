# Eşleşmeyen ünlü-marka parfümleri için kaynak veri setlerinden en yakın adayları önerir (inceleme için).
import csv,json,re,sys,unicodedata,collections,difflib,subprocess
csv.field_size_limit(10**9)
def toks(s):
    s=re.sub(r'(?i)\beau[\s-]+de[\s-]+(parfum|toilette|cologne)\b',' \\1 ',s)
    s=unicodedata.normalize('NFKD',s.lower().replace('ı','i')).encode('ascii','ignore').decode().replace("'",'')
    return [w for w in re.findall(r'[a-z0-9]+',s) if w not in {'edp','edt','edc','parfum','extrait','cologne','eau','de','the','le','la','for','men','man','pour','homme','intense','by','mens'}]
def nb(s): return ''.join(toks(s))
fra=list(csv.DictReader(open('tools/fra_cleaned.csv',encoding='latin-1'),delimiter=';'))
par=list(csv.DictReader(open('/home/claude/rfordatascience/tidytuesday/data/2024/2024-12-10/parfumo_data_clean.csv',encoding='utf-8')))
byb=collections.defaultdict(list)
for x in fra: byb[nb(x['Brand'])].append(('fra',x['Perfume'].replace('-',' '),x))
for x in par:
    if x['Top_Notes']!='NA' or x['Main_Accords']!='NA': byb[nb(re.sub(r'\s*/.*','',x['Brand']))].append(('par',x['Name'],x))
ALI={'rabanne':'pacorabanne','hugoboss':'hugoboss','giorgioarmani':'giorgioarmani','yvessaintlaurent':'yvessaintlaurent','dolcegabbana':'dolcegabbana','jomalonelondon':'jomalonelondon','kilian':'bykilian','dior':'dior'}
want=json.load(open(sys.argv[1]))
out=[]
for w in want:
    b=nb(w['brand']);ks=[k for k in byb if k==b or k==ALI.get(b) or (len(b)>3 and k.startswith(b)) or (len(k)>3 and b.startswith(k))]
    wt=set(toks(w['name'])); best=[]
    for k in ks:
        for src,name,x in byb[k]:
            tt=set(toks(re.sub(re.escape(w['brand']),'',name,flags=re.I)))
            if not tt or not wt: continue
            j=len(wt&tt)/len(wt|tt)
            r=difflib.SequenceMatcher(None,''.join(sorted(wt)),''.join(sorted(tt))).ratio()
            best.append((max(j,r*0.95),src,name,x))
    best.sort(key=lambda z:-z[0])
    out.append((w,best[:3]))
json.dump([[w['brand'],w['name'],[(round(s,2),src,n,(x['url'] if src=='fra' else x['URL'])) for s,src,n,x in b]] for w,b in out],open('/tmp/suggest.json','w'),ensure_ascii=False)
for w,b in out: print(w['brand'][:12],'|',w['name'][:34],'=>',' || '.join(f"{s:.2f} {src}:{n[:34]}" for s,src,n,x in b[:2]))
