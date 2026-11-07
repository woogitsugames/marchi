import json,sys,statistics as st,collections
res=collections.defaultdict(list)
for fn in sys.argv[1:]:
  tag=fn.split('/')[-1].split('-')[1]
  d=json.load(open(fn)); ev=d['traceEvents'] if isinstance(d,dict) else d
  mk={e['name'][8:]:e for e in ev if e.get('name','').startswith('marchia:')}
  r=mk['ready']; f=mk['first-frame']; pid,tid=f['pid'],f['tid']
  base=[e for e in ev if e.get('name')=='marchia:boot'][0]['ts']-0
  # navigation start ~ boot mark ts - boot mark startTime: use relative to 'boot'
  tasks=[e for e in ev if e.get('pid')==pid and e.get('tid')==tid and e.get('ph')=='X' and e['name']=='RunTask' and e['ts']<=f['ts']<=e['ts']+e.get('dur',0)]
  t=max(tasks,key=lambda e:e['dur']) if tasks else None
  end=(t['ts']+t['dur']) if t else f['ts']
  commit=sum(e['dur'] for e in ev if e.get('pid')==pid and e.get('tid')==tid and e.get('ph')=='X' and e['name']=='Commit' and t and t['ts']<=e['ts']<=end)
  res[tag].append({'ready':(r['ts']-base)/1000,'ff':(f['ts']-base)/1000,'done':(end-base)/1000,'gap':(f['ts']-r['ts'])/1000,'dgap':(end-r['ts'])/1000,'commit':commit/1000})
for tag,rs in res.items(): print(tag,len(rs),{k:round(st.median([x[k] for x in rs])) for k in rs[0]})
