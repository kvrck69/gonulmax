# tools/catalog-merged.json (Beymen+Sephora+Boyner, tekilleştirilmiş) -> web/js/catalog-data.js
# Kullanım: python3 -I tools/make-catalog.py   (aile/yoğunluk değerleri TAHMİNDİR)
import json,re,unicodedata
def nb(s): return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',s.replace('ı','i').replace('İ','I')).encode('ascii','ignore').decode().lower())
L=json.load(open('tools/catalog-merged.json',encoding='utf-8'))
# boş konsantrasyonlu kayıt, aynı parfümün konsantrasyonu belli bir kaydı varsa yinelenmiştir
by={}
for v in L: by.setdefault((nb(v['brand']),nb(v['name'])),[]).append(v)
keep=[]
for v in L:
    g=by[(nb(v['brand']),nb(v['name']))]
    if v['conc']=='' and len(g)>1: continue
    keep.append(v)
MAIN={'dior','chanel','giorgioarmani','yvessaintlaurent','hugoboss','versace','dolcegabbana','gucci','prada','burberry','bvlgari','calvinklein','carolinaherrera','hermes','jeanpaulgaultier','rabanne','valentino','givenchy','azzaro','montblanc','lacoste','tommyhilfiger','ferragamo','kenzo','davidoff','diesel','robertocavalli','trussardi','lattafa','armaf','rasasi','afnan','moschino','michaelkors','chloe','jimmychoo','eliesaab','esteelauder','clinique','mugler','narcisorodriguez','issey miyake','isseymiyake','dkny','joop','police','nautica','guess','coach','cerruti1881','jilsander','bananarepublic','philippplein','karllagerfeld','dsquared2','boucheron','chopard','lalique','abercrombiefitch','swissarabian','frenchavenue','parriscorner','pariscorner','fragranceworld','jackjones','lecoqsportif','pepejeans','reebok','superdry','pierrecardin','welder','jaguar','beverlyhillspoloclub','laurabiagiotti','korloff','mauboussin','baldessarini','no4711','korres','loccitane','nuxe','sisley','barbour','kyliejenner','lolitalempicka','viktorrolf','houbigant','zadigvoltaire','johnvarvatos','tumi','cacharel','kayali','guerlain','lancome','ysl'}
FAM=[('aquatic',r'aqua|acqua|marine|ocean|\bsea\b|water|blue|sport|wave|splash|sail|\bgio\b|cool|\bice\b|fresh|wind|brise|pacific|mare\b|\bsurf'),
('citrus',r'citr|lemon|limon|cedrat|bergamot|orange|agrumi|neroli|mandarin|grapefruit|\bzest|\bsole\b|sun\b|summer|lime\b|yuzu|\bpomelo'),
('green',r'green|\bvert\b|herb|\bmint|basil|grass|\btea\b|\bthe\b|fig\b|\bfir\b|moss|garden|leaf'),
('leather',r'leather|cuir|suede|tobacco|tabac|smoke|smok|\bblack\b|\bnoir|whisk|rum\b|cigar|ombre'),
('gourmand',r'vanill|tonka|sweet|candy|caramel|coffee|cacao|chocol|honey|cherry|sugar|praline|gourmand|milk|almond|dessert|cookie|toffee|cream|kahve|\bsugar'),
('oriental',r'\boud|\bud\b|amber|ambre|incense|myrrh|saffron|safran|spice|orient|arab|\bmusk|resin|oudh|mukhallat|dubai|sultan|\bkhamrah|bakhoor|attar|anbar|royal|gold|king|prince|\bhawas'),
('floral',r'ros[ae]|flower|blossom|jasmin|floral|peony|lily|\biris|violet|tuberose|fleur|bloom|lotus|magnolia|orchid|gardenia|mimosa|\bfem|\bher\b'),
('aromatic',r'lavend|\bsage|rosemary|aromat|fougere|\bpour homme|\bhomme|\bman\b|\bmen\b|gentle|classic|original|\bpour lui|uomo|\bsauvage'),
('woody',r'cedar|cedre|wood|bois|sandal|santal|vetiver|\boak|\bpine|forest|timber|\bwild|terre|earth|vetyver|\bcypress'),
('chypre',r'chypre|patchouli|oakmoss|\bpatch')]
FAM=[(f,re.compile(p,re.I)) for f,p in FAM]
INT={'EDC':2,'Cologne':2,'EDT':3,'':3,'EDP':4,'Parfum':4,'Other':4,'Extrait':5,'Elixir':5}
def fam(v):
    t=v['name']
    for f,rx in FAM:
        if rx.search(t): return f
    if v['conc']=='Cologne': return 'citrus'
    return 'woody' if v['conc'] in ('EDP','Extrait','Parfum','Elixir') else 'aromatic'
def fixbrand(b):
    return b.title() if b.isupper() and len(b)>3 else b
occ={'citrus':'ocs','aquatic':'ocs','green':'oc','aromatic':'ocd','floral':'ocdf','woody':'ocdf','chypre':'dnf','leather':'dn','oriental':'dnf','gourmand':'dn'}
rows=[]
for v in keep:
    b=fixbrand(v['brand']);n=v['name'].strip()
    if v['conc'] and v['conc']!='Other' and not re.search(r'\b'+re.escape(v['conc'])+r'\b',n,re.I): n=f"{n} {v['conc']}"
    f=fam(v);i=INT[v['conc']]
    o=occ[f]+('n' if i==5 and 'n' not in occ[f] else '')
    niche=0 if nb(b) in MAIN else 1
    rows.append([b,n,f,niche,i,o,1 if v['g']=='u' else 0])
json.dump(rows,open('/tmp/rows.json','w'),ensure_ascii=False)
js='// OTOMATİK ÜRETİLİR (tools/make-catalog.py). Kaynak: Beymen, Sephora TR, Boyner erkek/unisex parfüm listeleri (yalnızca marka+ad+konsantrasyon).\n// Aile/yoğunluk/durum değerleri addan ve konsantrasyondan TAHMİN edilmiştir; doğru değildir, kullanıcı düzeltebilir.\n// [marka, ad, aile, niş, yoğunluk, durumlar, unisex]\nexport default '+json.dumps(rows,ensure_ascii=False,separators=(',',':'))+';\n'
open('web/js/catalog-data.js','w',encoding='utf-8').write(js)
print(len(L),len(keep),len(js))
import collections;print(collections.Counter(r[2] for r in rows),sum(r[3] for r in rows))
