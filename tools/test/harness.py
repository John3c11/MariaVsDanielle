# Screenshot test harness for the MariaVsDanielle site (Playwright + Chromium, Python).
#   python3 tools/test/harness.py shoot <name>         copies the site to /tmp/mvd-<name>, screenshots every tab,
#                                                      full screen and admin screen (phone + desktop, dark + light)
#   python3 tools/test/harness.py compare <old> <new>  % of pixels that changed between two shoot runs
# The sheets and the Apps Script are faked: tools/test/data/sheets.json is a copy of the season sheets,
# and the script answers with the canned replies in api() below. The clock is frozen at 2026-10-19 noon (Monday of week 6, before MNF).
# Refresh the data with tools/test/xlsx2sheets.py.
# Needs: pip install playwright pillow  (and a Chromium that Playwright can find).
import asyncio, sys, os, json, shutil, glob, datetime, urllib.parse
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
D=json.load(open(os.path.join(HERE,'data','sheets.json'))); ros,qbs,v25,v26=D['Rosters'],D['QBs'],D['2025'],D['2026']
TABS='stats crowd schedule profiles chat submit bethistory rosters legacy game lab machine weekly patch futures bracket museum analytics'.split()
FULL=[('story',"openStory('2026')",4000),('gamepage',"switchTab('game'); openGame('2026','6')",3000),('card',"openPlayerCard('Tyler Warren')",3000),
      ('tm',"openTimeMachine()",2000),('look',"openLook()",800),('team',"openTeamCard('Indianapolis Colts')",2500)]
ADM=['night','check','odds','games','plan','friends','chat','season','futures','machine','mlab','status','theme','pins']

def stage(name):
    out='/tmp/mvd-'+name
    shutil.rmtree(out, ignore_errors=True)
    shutil.copytree(ROOT, out, ignore=shutil.ignore_patterns('tools','apps-script','*.md','.git'))
    open(out+'/config.js','w').write("const CONFIG={API_KEY:'x',PICKS_URL:'https://x'};")   # the real one lives only on GitHub
    return out

# ── Fake Machine picks and friends (v157), made from the real 2026 sheet so every run gets the same ones ──
# The Machine plays every 2026 game that has kicked off by the frozen clock: it sometimes takes the same player as
# Maria or Danielle (overlaps), sometimes the real first scorer (hits). Jake and Sam pick every played game.
def fake_data():
    import math
    teams=ros[0][1:]; offered={}
    for c,t in enumerate(teams):
        offered[t]=[r[c+1] for r in ros[1:] if len(r)>c+1 and r[c+1]]
    G={}
    for r in v26[1:]:
        r=r+['']*(17-len(r))
        if not r[0] or r[3] not in ('Maria','Danielle'): continue
        g=G.setdefault(r[0],{'game':r[0],'week':int(r[1]),'slot':r[2],'home':r[4],'away':r[5],'scorer':r[11],'md':{}})
        g['md'][r[3]]=(r[6],r[7])
    start=datetime.datetime(2026,9,11,0,20)  # Thursday of week 1, 7:20 pm Central (Friday 00:20 UTC)
    day={'WNF':-1,'TNF':0,'Saturday':2,'International':3,'SNF':3,'MNF':4}
    clock=datetime.datetime(2026,10,19,17,0)  # the frozen clock (noon Central) in UTC
    picks=[]; crowd=[]
    for i,g in enumerate(sorted(G.values(), key=lambda g:int(g['game']))):
        ko=start+datetime.timedelta(days=7*(g['week']-1)+day.get(g['slot'],3))
        if g['slot']=='International': ko-=datetime.timedelta(hours=9)
        g['ko']=ko.strftime('%Y-%m-%dT%H:%M:%S.000Z')
        if ko>clock: continue
        hO=offered.get(g['home'],[]); aO=offered.get(g['away'],[])
        ch={}
        for lst,f in ((hO,0.52),(aO,0.48)):
            for j,n in enumerate(lst): ch[n]=round(f*[0.17,0.15,0.11,0.09,0.07,0.06,0.05,0.04,0.03][min(j,8)],4)
        for who in g['md'].values():
            for n in who:
                if n and n not in ch: ch[n]=0.025
        m=g['md'].get('Maria',('','')); d=g['md'].get('Danielle',('',''))
        hp=hO[1] if len(hO)>1 else (hO[0] if hO else m[0]); ap=aO[0] if aO else m[1]
        if i%3==0 and m[0]: hp=m[0]            # same player as Maria
        if i%4==1 and d[1]: ap=d[1]            # same player as Danielle
        if i%5==2 and g['scorer'] in hO: hp=g['scorer']
        if i%5==2 and g['scorer'] in aO: ap=g['scorer']
        price=lambda n:-int(round((0.8/max(ch.get(n,0.03),0.01)-1)*100))
        picks.append({'week':str(g['week']),'game':g['game'],'home':g['home'],'away':g['away'],'kickoff':g['ko'],
          'hp':hp,'hpct':ch.get(hp,0.03),'hprice':price(hp),'ap':ap,'apct':ch.get(ap,0.03),'aprice':price(ap),
          'made':'2026-10-01T12:00:00Z','retro':g['week']<4,'chances':ch,'why':None})
        if g['scorer']:
            jh=g['scorer'] if i%4==0 and g['scorer'] in hO else (hO[0] if hO else '')
            crowd.append({'friend':'Jake','week':str(g['week']),'game':g['game'],'homePick':jh,'awayPick':aO[1] if len(aO)>1 else ''})
            sa=g['scorer'] if i%6==3 and g['scorer'] in aO else (aO[0] if aO else '')
            crowd.append({'friend':'Sam','week':str(g['week']),'game':g['game'],'homePick':hO[2] if len(hO)>2 else '','awayPick':sa})
    mpub={'season':'2026','picks':picks,'sealed':1,'made':len(picks)+1,'trainedAt':'2026-10-10T06:01:00Z','games':2100,'report':None,
          'price':{'k0':math.log(0.8),'k1':-1}}
    crowdOut={'season':'2026','friends':['Jake','Sam'],'picks':crowd,'counts':{},'styles':{}}
    return mpub, crowdOut
MPUB, CROWD = fake_data()

async def api(route):
    q=dict(urllib.parse.parse_qsl(urllib.parse.urlparse(route.request.url).query)); a=q.get('action')
    if a=='machinepub': return await route.fulfill(status=200, content_type='application/json', body=json.dumps(MPUB))
    if a=='crowd': return await route.fulfill(status=200, content_type='application/json', body=json.dumps(CROWD if q.get('season','2026')=='2026' else {'season':q.get('season'),'friends':[],'picks':[],'counts':{}}))
    body={'friends':[{'name':'Jake'}],'invite':'abcdef1234','pending':[{'name':'Sam','at':'2026-10-03T12:00:00Z','clash':False}]} if a=='friends' else {'errors':[{'msg':'x','at':'2026-10-04T10:00:00Z'}],'dcOk':[]} if a=='errlist' else {'versions':{},'season':'2026','friends':1,'machine':{'label':'memory 0.75','standard':False,'meta':{'from':'My test','at':'2026-10-10T06:00:00Z'},'prev':{'label':'Standard settings'},'trainedAt':'2026-10-10T06:01:00Z'},'triggers':[]} if a=='status' else {'versions':{}} if a=='versions' else {'jobs':[]} if a=='jobs' else {'items':[{'state':'todo','key':'odds','title':'Odds needed for 2 games','detail':'x'},{'state':'ok','key':'graded','title':'Week 5 graded','detail':'y'}],'todo':1,'lastWeek':5,'nextWeek':6} if a=='checklist' else {'ok':True,'who':['Maria','Danielle','ADMIN']} if a=='pins' else {'admin':True,'rows':[],'season':'2026'} if not a else {'season':'2026','friends':[],'picks':[],'injuries':[],'list':[]}
    await route.fulfill(status=200, content_type='application/json', body=json.dumps(body))

async def setup(b, site, w, touch, Q=''):
    ctx=await b.new_context(viewport={'width':w,'height':844}, has_touch=touch, is_mobile=touch)
    pg=await ctx.new_page()
    await ctx.add_init_script("try{localStorage.setItem('mvd-v150','1');localStorage.setItem('mvd-weekly-seen','2026-5')}catch(e){}")  # skip the one-time v150 reveal
    await pg.clock.install(time=datetime.datetime(2026,10,19,12,0,0))
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    async def sheets(route):
        u=route.request.url
        vals = ros if 'Rosters' in u else qbs if 'QBs' in u else v25 if '1DWLY' in u else v26 if 'Winnings' in u else []
        await route.fulfill(status=200, content_type='application/json', body=json.dumps({'values': vals}))
    await pg.route('**/sheets.googleapis.com/**', sheets)
    await pg.route('**/*espn*/**', lambda r: r.abort())
    await pg.route('https://x/**', api)
    await pg.goto('file://'+site+'/index.html'+Q); await pg.clock.run_for(5000); await pg.wait_for_timeout(2000)
    return pg, errs

async def shoot(name):
    from playwright.async_api import async_playwright
    site=stage(name); out=site+'-shots'; shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for w,t in ((390,True),(1280,False)):
            for th in ('dark','light'):
                async def fresh():
                    pg,e=await setup(b,site,w,t)
                    if th=='light': await pg.evaluate("setLook('light')"); await pg.wait_for_timeout(600)
                    return pg,e
                pg,e=await fresh()
                for tab in ['home']+TABS:
                    if tab!='home': await pg.evaluate("switchTab('%s')"%tab)
                    await pg.clock.run_for(3000); await pg.wait_for_timeout(900); await pg.evaluate("window.scrollTo(0,0)")
                    await pg.screenshot(path='%s/%s_%s_%d.png'%(out,tab,th,w), full_page=True)
                if e: print(w,th,'page errors:',e)
                await pg.context.close()
                for nm,js,ms in FULL:
                    pg,e=await fresh(); await pg.evaluate(js); await pg.clock.run_for(ms); await pg.wait_for_timeout(1200)
                    await pg.screenshot(path='%s/F%s_%s_%d.png'%(out,nm,th,w))
                    if e: print(w,th,nm,'page errors:',e)
                    await pg.context.close()
                for sec in ADM:
                    pg,e=await fresh()
                    await pg.evaluate("(s) => { switchTab('submit'); SUB.pin='x'; SUB.role='admin'; return loadAdmin().then(function(){ showAdmin(s); }); }", sec)
                    await pg.clock.run_for(3000); await pg.wait_for_timeout(1000)
                    await pg.screenshot(path='%s/A%s_%s_%d.png'%(out,sec,th,w), full_page=True)
                    if e: print(w,th,'admin',sec,'page errors:',e)
                    await pg.context.close()
        await b.close()
    print('shots in', out)

def compare(a, b):
    from PIL import Image, ImageChops
    A='/tmp/mvd-'+a+'-shots'; B='/tmp/mvd-'+b+'-shots'; R=[]
    for f in sorted(glob.glob(A+'/*.png')):
        k=os.path.basename(f)[:-4]; g=B+'/'+k+'.png'
        if not os.path.exists(g): R.append((k,'missing',1)); continue
        x=Image.open(f).convert('RGB'); y=Image.open(g).convert('RGB')
        if x.size!=y.size: R.append((k,'size %s -> %s'%(x.size,y.size),1)); continue
        d=ImageChops.difference(x,y).convert('L').point(lambda v:255 if v>24 else 0)
        n=d.histogram()[255]/(x.size[0]*x.size[1]); R.append((k,'%.2f%%'%(n*100),n))
    for k,s,n in sorted(R,key=lambda r:-r[2]): print(k,s)

if __name__=='__main__':
    if sys.argv[1]=='shoot': asyncio.run(shoot(sys.argv[2]))
    elif sys.argv[1]=='compare': compare(sys.argv[2], sys.argv[3])
