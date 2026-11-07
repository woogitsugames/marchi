import json,sys,statistics as st
rows={}
for line in open(sys.argv[1]):
    tag,js=line.split(' ',1)
    for r in json.loads(js):
        m=r['marks']; rows.setdefault(tag,[]).append({'ready':m['ready'],'ff':m['first-frame'],'gap':m['first-frame']-m['ready'],'shown':m.get('shown',-1),'sgap':m.get('shown',-1)-m['ready'],'bake':r['bake'],'firstUse':r['leaf'].get('onFirstUse',0)})
for tag,rs in rows.items():
    print(tag, len(rs), {k: round(st.median([x[k] for x in rs]),1) for k in rs[0]})
