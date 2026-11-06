# tools/notes-curated.tsv (elle derlenen 76 parfüm için onaylı kaynak kaydı) -> tools/catalog-notes-curated.json
import csv,json
csv.field_size_limit(10**9)
fra={}
for x in csv.DictReader(open('tools/fra_cleaned.csv',encoding='latin-1'),delimiter=';'): fra.setdefault(x['Perfume'].replace('-',' '),x)
par={}
for x in csv.DictReader(open('/home/claude/rfordatascience/tidytuesday/data/2024/2024-12-10/parfumo_data_clean.csv',encoding='utf-8')): par.setdefault(x['Name'],x)
sp=lambda s:[a.strip() for a in s.split(',') if a.strip() and a!='NA']
out={};miss=[]
for line in open('tools/notes-curated.tsv',encoding='utf-8'):
    line=line.rstrip('\n')
    if not line: continue
    cid,src=line.split('\t');kind,name=src.split(':',1)
    if kind=='fra':
        x=fra.get(name)
        if not x: miss.append((cid,src));continue
        out[cid]={'accords':[x[f'mainaccord{i}'] for i in range(1,6) if x[f'mainaccord{i}']],'top':sp(x['Top']),'heart':sp(x['Middle']),'base':sp(x['Base']),'src':x['url']}
    else:
        x=par.get(name) or next((v for k,v in par.items() if k==name or k.startswith(name+' ')),None)
        if not x or (x['Top_Notes']=='NA' and x['Main_Accords']=='NA'): miss.append((cid,src));continue
        out[cid]={'accords':sp(x['Main_Accords']),'top':sp(x['Top_Notes']),'heart':sp(x['Middle_Notes']),'base':sp(x['Base_Notes']),'src':x['URL']}
json.dump(out,open('tools/catalog-notes-curated.json','w',encoding='utf-8'),ensure_ascii=False)
print(len(out),'miss',miss)
