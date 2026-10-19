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

async def api(route):
    q=dict(urllib.parse.parse_qsl(urllib.parse.urlparse(route.request.url).query)); a=q.get('action')
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
