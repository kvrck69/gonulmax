# Parfumo accord/nota adlarını koku çarkının 16 eksenine eşler (değerler 0-1). Elle yazılmış sözlük.
import re
ACCORD={'Spicy':{'spicy':1},'Woody':{'woody':1},'Sweet':{'oriental':.5},'Fresh':{'citrus':.4,'herbaceous':.25},'Floral':{'floral':1},'Fruity':{'fruity':1},'Citrus':{'citrus':1},'Green':{'green':1},'Oriental':{'oriental':1},'Synthetic':{},'Creamy':{'musk':.3,'oriental':.2},'Powdery':{'floral':.3,'aldehydic':.2,'musk':.3},'Gourmand':{'oriental':.5,'fruity':.2},'Resinous':{'oriental':.7,'conifer':.2},'Smoky':{'leather':.6,'tobacco':.2},'Leathery':{'leather':1},'Aquatic':{'citrus':.3,'musk':.25,'herbaceous':.2},'Earthy':{'chypre':.6,'green':.3,'woody':.3},'Animal':{'leather':.5,'musk':.3},'Fougère':{'fougere':1,'lavender':.4},'Chypre':{'chypre':1}}
NOTE=[
(r'bergamot|lemon|lime\b|mandarin|tangerine|grapefruit|yuzu|citron|pomelo|bitter orange|blood orange|\borange\b(?! blossom)|petitgrain|citrus|zest|clementine',{'citrus':1}),
(r'neroli',{'citrus':.5,'floral':.6}),
(r'rose|rosa |jasmin|heliotrop|violet(?! leaf)|lily|tuberose|orange blossom|peony|geranium|ylang|magnolia|freesia|heliotrope|narcissus|mimosa|orchid|gardenia|carnation|lotus|floral|cyclamen|hyacinth|osmanthus|honeysuckle|lilac|tiar|frangipani|hawthorn|blossom|white flowers|orris|\biris\b|chamomile|everlasting',{'floral':1}),
(r'orris|\biris\b',{'musk':.2,'aldehydic':.15}),
(r'aldehyd',{'aldehydic':1}),
(r'amber|ambergris|vanill|benzoin|labdanum|incense|frankincense|myrrh|\boud\b|cypriol|tonka|resin|opoponax|styrax|balsam(?! fir)|honey|caramel|praline|praliné|almond|hazelnut|chestnut|maltol|tolu|toffee|cocoa|chocolate|elemi|mastic|nagarmotha|cistus|sweet|brown sugar|marron|gingerbread|liquorice|milk|palo santo',{'oriental':1}),
(r'lavend|lavandin',{'lavender':1,'fougere':.5,'herbaceous':.3}),
(r'coumarin|fougere|fern',{'fougere':1}),
(r'apple|pineapple|peach|plum|berry|raspberry|currant|cassis|cherry|pear\b|\bfig\b(?! leaf)|mango|coconut|melon|apricot|fruit|lychee|banana|strawberry|grape|passion|pomegranate|nectarine|quince|rhubarb|tropical',{'fruity':1}),
(r'\bpine|\bfir\b|fir balsam|spruce|juniper|cypress|conifer|balsam fir|eucalyptus|camphor|laurel',{'conifer':1}),
(r'oakmoss|moss|patchouli|chypre|cistus',{'chypre':1}),
(r'basil|rosemary|sage|thyme|mint|herb|tarragon|artemisia|mugwort|absinth|lemongrass|verbena|vervain|tea\b|ma[tt]é|aromatic|angelica|caraway|bay leaf|chamomile|davana|buchu',{'herbaceous':1}),
(r'green|grass|galbanum|leaves|leaf|vetiver|hay|bamboo|cucumber|tomato|banana leaf|cedar leaf|tagetes|carrot',{'green':1}),
(r'pepper|cinnamon|cardamom|saffron|ginger|clove|nutmeg|coriander|cumin|spice|anise|pimento|chili|turmeric|mace|allspice|sichuan|paprika|rum\b|cognac|whisk',{'spicy':1}),
(r'cedar|sandalwood|vetiver|patchouli|guaiac|gaiac|\bwood|\boak\b|birch|ebony|teak|rosewood|agarwood|\boud\b|amberwood|cashmere|cashmeran|papyrus|iso e|iso-e|amyris|akigalawood|georgywood|clearwood|ambroxan|ambrox|orcanox|ambrofix|ambrocenide|ambrostar|pepperwood|trungle|vorblex',{'woody':1}),
(r'tobacco|tabac|cigar|shisha|whisk|rum\b|coffee|cognac',{'tobacco':1}),
(r'leather|suede|birch tar|castoreum|smok|\bfume\b|civet|animalic|cade|saddle|truffle|black truffle',{'leather':1}),
(r'musk|muscone|ambrette|skin|cashmere|cashmeran|salt|sea salt|spindrift|ozon|aquatic|marine|solar|milk|white amber|hedione',{'musk':1}),
]
NOTE=[(re.compile(p,re.I),w) for p,w in NOTE]
def note_axes(name):
    out={}
    for rx,w in NOTE:
        if rx.search(name):
            for a,v in w.items(): out[a]=max(out.get(a,0),v)
    return out
PYR={'top':.5,'heart':.8,'base':1.0}
AW=[1,.85,.7,.55,.45,.35]
def profile(accords,top,heart,base):
    A={};N={}
    for i,a in enumerate(accords):
        for ax,v in ACCORD.get(a,{}).items(): A[ax]=max(A.get(ax,0),v*AW[min(i,5)])
    for part,items in (('top',top),('heart',heart),('base',base)):
        for it in items:
            for ax,v in note_axes(it).items():
                N[ax]=max(N.get(ax,0),v*PYR[part])
    out={}
    for ax in set(A)|set(N):
        p=1-(1-A.get(ax,0))*(1-.8*N.get(ax,0))
        if p>=0.12: out[ax]=round(min(p,1),2)
    return out
