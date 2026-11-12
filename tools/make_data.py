#!/usr/bin/env python3
"""동현삼·동현항 샘플 자료 만들기. 두 저장소에 같은 파일로 들어 있고, 이 저장소에 있는 쪽(src/sam 또는 src/hang)의 JSON만 쓴다.
표(아래 PROV·EDGES·OFFICERS·PORTS…)와 Natural Earth 110m 육지(공공 영역)에서 JSON을 만든다.
- 해안선은 그리지 않고 자료에서 뽑는다. 칸 가운데가 육지 다각형 안이면 육지.
- 인접 목록은 EDGES 한 곳에서만 적고 양쪽으로 펼친다(한쪽만 적히는 일을 막는다).
쓰기: python3 tools/make_data.py
"""
import json, math, os, collections
from PIL import Image, ImageDraw
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
LAND=json.load(open(os.path.join(HERE,'ne_110m_land.geojson')))

def raster(lon0,lat0,lon1,lat1,W,H):
    """(lon0,lat0)=왼쪽 위, (lon1,lat1)=오른쪽 아래. 육지=1인 W×H 마스크."""
    im=Image.new('1',(W,H),0); d=ImageDraw.Draw(im)
    fx=lambda lon:(lon-lon0)/(lon1-lon0)*W; fy=lambda lat:(lat0-lat)/(lat0-lat1)*H
    for f in LAND['features']:
        g=f['geometry']; polys=[g['coordinates']] if g['type']=='Polygon' else g['coordinates']
        for rings in polys:
            d.polygon([(fx(x),fy(y)) for x,y in rings[0]],fill=1)
            for hole in rings[1:]: d.polygon([(fx(x),fy(y)) for x,y in hole],fill=0)
    return im
def rle(row):
    out=[];i=0
    while i<len(row):
        j=i
        while j<len(row) and row[j]==row[i]: j+=1
        n=j-i; out.append((str(n) if n>1 else '')+row[i]); i=j
    return ''.join(out)

# ───────────────────────── 동현삼 ─────────────────────────
# 육각 칸: 뾰족한 위, 홀수 줄을 오른쪽으로 반 칸(odd-r). 위도 32° 기준 정거 원통 도법.
S_COLS,S_ROWS=32,33; S_LON0,S_LAT0=99.0,43.4; S_ROWSTEP=0.6      # 줄 간격 0.6°
S_SIZE=S_ROWSTEP/1.5; S_W=math.sqrt(3)*S_SIZE/math.cos(math.radians(32))  # 칸 폭(경도 °)
def hex_center(c,r): return (S_LON0+S_W*(c+0.5+(r&1)*0.5), S_LAT0-S_SIZE*(1+1.5*r))
def hex_of(lon,lat):
    best=None
    for r in range(S_ROWS):
        for c in range(S_COLS):
            x,y=hex_center(c,r); d=((x-lon)*math.cos(math.radians(32)))**2+(y-lat)**2
            if best is None or d<best[0]: best=(d,c,r)
    return best[1],best[2]
SS=8; s_lon1=S_LON0+S_W*(S_COLS+0.5); s_lat1=S_LAT0-S_SIZE*(1.5*S_ROWS+0.5)
s_im=raster(S_LON0,S_LAT0,s_lon1,s_lat1,int((s_lon1-S_LON0)*SS*4),int((S_LAT0-s_lat1)*SS*4))
def s_land(c,r):
    x,y=hex_center(c,r); px=(x-S_LON0)/(s_lon1-S_LON0)*s_im.width; py=(S_LAT0-y)/(S_LAT0-s_lat1)*s_im.height
    n=0
    for dx in(-3,0,3):
        for dy in(-3,0,3):
            X=min(max(int(px+dx),0),s_im.width-1);Y=min(max(int(py+dy),0),s_im.height-1); n+=1 if s_im.getpixel((X,Y)) else 0
    return n>=5
s_rows=[''.join('#' if s_land(c,r) else '~' for c in range(S_COLS)) for r in range(S_ROWS)]

# id, 이름, 한자, 경도, 위도, 등급(A 큰 고을 · B 보통 · C 변방), 세력
PROV=[
(1,'양평','襄平',123.2,41.3,'C','gongsundu'),(2,'북평','北平',118.9,39.9,'C','yuan'),(3,'계','薊',116.4,39.9,'B','yuan'),
(4,'남피','南皮',116.7,38.0,'B','yuan'),(5,'평원','平原',116.4,37.2,'B','yuan'),(6,'업','鄴',114.6,36.3,'A','yuan'),
(7,'진양','晉陽',112.5,37.9,'B','yuan'),(8,'상당','上黨',113.1,36.2,'C','yuan'),(9,'북해','北海',119.1,36.7,'B','yuan'),
(10,'복양','濮陽',115.0,35.7,'B','cao'),(11,'진류','陳留',114.5,34.7,'A','cao'),(12,'소패','小沛',116.9,34.7,'B','liubei'),
(13,'하비','下邳',118.0,34.1,'B','liubei'),(14,'허창','許昌',113.8,34.0,'A','cao'),(15,'여남','汝南',114.4,33.0,'B','cao'),
(16,'수춘','壽春',116.8,32.6,'B','cao'),(17,'낙양','洛陽',112.4,34.7,'A','cao'),(18,'홍농','弘農',110.9,34.5,'C','cao'),
(19,'장안','長安',108.9,34.3,'A','cao'),(20,'천수','天水',105.7,34.6,'C','mateng'),(21,'금성','金城',103.8,36.1,'C','mateng'),
(22,'무위','武威',102.6,37.9,'C','mateng'),(23,'한중','漢中',107.0,33.1,'B','zhanglu'),(24,'완','宛',112.5,33.0,'B','cao'),
(25,'양양','襄陽',112.1,32.0,'A','liubiao'),(26,'강하','江夏',114.3,30.6,'B','liubiao'),(27,'강릉','江陵',112.2,30.3,'A','liubiao'),
(28,'영안','永安',109.5,31.0,'C','liuzhang'),(29,'여강','廬江',117.0,31.3,'B','sun'),(30,'건업','建業',118.8,32.1,'A','sun'),
(31,'오','吳',120.6,31.3,'A','sun'),(32,'회계','會稽',120.6,30.0,'B','sun'),(33,'시상','柴桑',116.0,29.7,'B','sun'),
(34,'장사','長沙',113.0,28.2,'B','liubiao'),(35,'무릉','武陵',111.7,29.0,'C','liubiao'),(36,'영릉','零陵',111.6,26.4,'C','liubiao'),
(37,'계양','桂陽',113.0,25.8,'C','liubiao'),(38,'자동','梓潼',105.2,31.6,'B','liuzhang'),(39,'성도','成都',104.1,30.7,'A','liuzhang'),
(40,'강주','江州',106.5,29.6,'B','liuzhang'),(41,'건녕','建寧',103.8,25.5,'C',None)]
EDGES=[(1,2),(2,3),(3,4),(3,7),(4,5),(4,6),(5,9),(5,10),(6,8),(6,10),(7,8),(8,17),(9,13),(10,11),(10,12),(11,12),(11,14),(11,17),
(12,13),(12,16),(13,16),(13,30),(14,15),(14,17),(14,24),(15,16),(15,24),(15,26),(16,29),(17,18),(17,24),(18,19),(19,20),(19,23),
(20,21),(20,23),(21,22),(23,38),(23,25),(24,25),(25,26),(25,27),(26,27),(26,29),(26,33),(27,28),(27,35),(27,34),(28,40),(29,30),
(29,33),(30,31),(31,32),(33,34),(34,35),(34,36),(34,37),(35,36),(36,37),(38,39),(39,40),(39,41),(40,41)]
TIER={'A':(420000,900,2400,8000,70,60),'B':(260000,550,1500,5000,65,45),'C':(120000,300,800,2500,60,30)}   # 인구, 금, 쌀, 병력, 민심(자료의 loyalty), 농지 (시험 값)
FACTIONS=[('cao','조조','#3566c4',101),('yuan','원소','#c9a227',111),('liubei','유비','#3f9a52',121),('liubiao','유표','#8b5fc7',131),
('sun','손책','#d0483a',141),('liuzhang','유장','#c77a2a',151),('zhanglu','장로','#6b7b8c',161),('mateng','마등','#2f9aa0',171),('gongsundu','공손도','#9a6b4b',181)]
# id, 이름, 무력, 지력, 매력, 세력, 상태, 있는 주  (능력치는 동현삼의 시험 값이다. 원작 수치가 아니다)
OFFICERS=[
(101,'조조',80,95,95,'cao','active',14),(102,'하후돈',90,60,80,'cao','active',11),(103,'순욱',30,95,90,'cao','active',14),
(104,'곽가',20,95,75,'cao','active',14),(105,'허저',95,35,60,'cao','active',14),(106,'종요',35,80,80,'cao','active',19),
(111,'원소',70,75,90,'yuan','active',6),(112,'안량',90,40,55,'yuan','active',6),(113,'문추',90,35,55,'yuan','active',6),
(114,'전풍',30,95,70,'yuan','active',6),(115,'원담',65,50,60,'yuan','active',5),(116,'고간',65,60,60,'yuan','active',7),
(121,'유비',75,75,100,'liubei','active',12),(122,'관우',95,75,90,'liubei','active',13),(123,'장비',95,40,45,'liubei','active',12),
(131,'유표',45,75,85,'liubiao','active',25),(132,'채모',70,70,55,'liubiao','active',25),(133,'황조',65,50,45,'liubiao','active',26),(134,'황충',90,60,75,'liubiao','active',34),
(141,'손책',90,75,95,'sun','active',31),(142,'주유',75,95,90,'sun','active',31),(143,'손권',65,80,90,'sun','active',31),(144,'태사자',90,65,75,'sun','active',33),
(151,'유장',30,55,70,'liuzhang','active',39),(152,'장임',85,75,70,'liuzhang','active',39),(153,'엄안',80,65,70,'liuzhang','active',40),
(161,'장로',45,70,80,'zhanglu','active',23),(171,'마등',80,55,85,'mateng','active',22),(172,'한수',70,80,70,'mateng','active',21),(173,'마초',95,45,75,'mateng','active',22),
(181,'공손도',70,65,65,'gongsundu','active',1),
(201,'조운',95,75,85,None,'free',6),(202,'제갈량',35,100,95,None,'free',25),
# 재야 장수: 수색으로 찾는다. 있는 주는 대강의 연고지다(시험 배치)
(203,'서서',65,95,80,None,'free',24),(204,'방통',35,98,70,None,'free',27),(205,'마량',25,90,85,None,'free',26),(206,'육손',70,95,90,None,'free',31),
(207,'위연',90,65,50,None,'free',34),(208,'노숙',45,90,90,None,'free',29),(209,'미축',30,70,85,None,'free',13),
(210,'감녕',90,65,60,None,'free',33),(211,'강유',85,90,75,None,'free',20),(212,'방덕',90,60,65,None,'free',21),(213,'순유',30,95,80,None,'free',17),
(214,'전위',95,30,55,None,'free',11),(215,'맹획',85,40,70,None,'free',41),(216,'장송',25,90,60,None,'free',39),(217,'진궁',50,90,70,None,'free',10),
(218,'주태',90,50,65,None,'free',32),(219,'전예',75,80,75,None,'free',2),
# 태수: 주마다 장수가 적어도 한 명 있다. 장수가 없는 주는 주인 없는 공백지가 된다(동현삼 규칙)
(301,'정욱',45,90,65,'cao','active',10),(302,'장료',95,80,80,'cao','active',15),(303,'만총',60,85,75,'cao','active',16),(304,'하후연',90,55,70,'cao','active',17),
(305,'서황',90,70,70,'cao','active',18),(306,'조인',85,65,75,'cao','active',24),
(311,'순우경',70,45,50,'yuan','active',2),(312,'원희',55,60,60,'yuan','active',3),(313,'저수',45,95,75,'yuan','active',4),(314,'장합',90,75,70,'yuan','active',8),(315,'심배',60,85,65,'yuan','active',9),
(331,'문빙',80,65,70,'liubiao','active',27),(332,'금선',55,45,50,'liubiao','active',35),(333,'유도',45,55,55,'liubiao','active',36),(334,'조범',50,60,50,'liubiao','active',37),
(341,'여몽',85,80,75,'sun','active',29),(342,'장소',25,95,85,'sun','active',30),(343,'황개',85,65,70,'sun','active',32),
(351,'법정',45,95,70,'liuzhang','active',28),(352,'황권',60,85,75,'liuzhang','active',38),(371,'마대',80,60,65,'mateng','active',20)]

adj=collections.defaultdict(set)
for a,b in EDGES: assert a!=b; adj[a].add(b); adj[b].add(a)
def hex_dist(a,b):
    (c1,r1),(c2,r2)=a,b; x1=c1-(r1-(r1&1))//2; x2=c2-(r2-(r2&1))//2; dx=x1-x2; dz=r1-r2
    return max(abs(dx),abs(dz),abs(dx+dz))
# 주 칸: 실제 위치에 가장 가까운 육지 칸. 다만 주끼리 바로 붙지 않게(사이에 한 칸 이상) 한다.
# 중원처럼 고을이 몰린 곳은 한 칸(약 0.6°)쯤 밀린다. 큰 고을(A)부터 제자리를 잡는다.
LANDHEX=[(c,r) for r in range(S_ROWS) for c in range(S_COLS) if s_rows[r][c]=='#']
used={}; spot={}
for pid,name,hj,lon,lat,tier,owner in sorted(PROV,key=lambda p:('ABC'.index(p[5]),p[0])):
    def d2(h): x,y=hex_center(*h); return ((x-lon)*math.cos(math.radians(32)))**2+(y-lat)**2
    c,r=min((h for h in LANDHEX if all(hex_dist(h,u)>=2 for u in used)),key=d2)
    used[(c,r)]=name; spot[pid]=(c,r,math.sqrt(d2((c,r))))
provinces=[]
for pid,name,hj,lon,lat,tier,owner in PROV:
    c,r,off=spot[pid]; assert off<1.0,(name,'제자리에서 1° 넘게 밀렸다',off)
    pop,gold,rice,troops,loyalty,farm=TIER[tier]
    if owner is None: troops=0                      # 주인 없는 땅(공백지)에는 병력이 없다
    provinces.append(dict(id=pid,name=name,hanja=hj,lon=lon,lat=lat,hex=[c,r],owner=owner,pop=pop,gold=gold,rice=rice,troops=troops,loyalty=loyalty,farm=farm,adj=sorted(adj[pid])))
print('주 칸이 제자리에서 가장 멀리 밀린 곳:',max((v[2],k) for k,v in spot.items()))
assert len(provinces)==41 and all(p['adj'] for p in provinces)
for p in provinces: assert p['owner'] is None or any(o[5]==p['owner'] and o[6]=='active' and o[7]==p['id'] for o in OFFICERS),(p['name'],'주인이 있는데 장수가 없다')
assert len({o[0] for o in OFFICERS})==len(OFFICERS)
sam=dict(format='donghyun-sam-data',version=1,
 meta=dict(title='동현삼 샘플 자료',scenario='200년 1월 무렵을 본뜬 시험 배치',start=dict(year=200,month=1),
  note='41개 주는 후한 말 실제 지명과 위치에서 골랐고 인접은 동현삼이 정했다. 원작의 주 번호·인접·능력치를 옮긴 것이 아니다. 인구·금·쌀·병력·민심·농지·능력치는 시험 값이다. 해안선은 오늘날 기준이다.',
  sources=['Natural Earth 110m land (public domain) https://www.naturalearthdata.com/']),
 map=dict(grid='hex',layout='pointy-odd-r',cols=S_COLS,rows=S_ROWS,origin=dict(lon=S_LON0,lat=S_LAT0),rowStepDeg=S_ROWSTEP,tiles={'~':'sea','#':'land'},rle=[rle(x) for x in s_rows]),
 factions=[dict(id=i,name=n,color=c,leader=l) for i,n,c,l in FACTIONS],
 provinces=provinces,
 officers=[dict(id=i,name=n,war=w,int=t,cha=c,faction=f,status=s,province=p) for i,n,w,t,c,f,s,p in OFFICERS])

# ───────────────────────── 동현항 ─────────────────────────
H_COLS,H_ROWS=360,132; H_LON0,H_LAT0=-180.0,72.0      # 한 칸 = 경위도 1°
h_im=raster(H_LON0,H_LAT0,180.0,H_LAT0-H_ROWS,H_COLS*8,H_ROWS*8)
def h_land(c,r):
    n=0
    for dx in(1,4,6):
        for dy in(1,4,6): n+=1 if h_im.getpixel((c*8+dx,r*8+dy)) else 0
    return n>=5
grid=[[('#' if h_land(c,r) else '~') for c in range(H_COLS)] for r in range(H_ROWS)]
# 1° 칸으로는 닫혀 버리는 좁은 해협을 물로 튼다(실제로 배가 지나는 곳만).
CARVE=[('지브롤터 해협',[(174,36)]),('도버 해협',[(181,21)]),('다르다넬스·마르마라·보스포루스',[(206,31),(207,31),(208,31)]),
       ('말라카 해협',[(281,70),(283,70)])]
def sea_steps(c,r):
    """배가 한 걸음에 갈 수 있는 바다 칸. 엔진 길 찾기와 같은 규칙: 대각 걸음은 모서리를 낀 두 칸이 모두 땅이면 못 간다."""
    out=[]
    for dc in(-1,0,1):
        for dr in(-1,0,1):
            if not(dc or dr): continue
            cc=(c+dc)%H_COLS; rr=r+dr
            if not(0<=rr<H_ROWS) or grid[rr][cc]!='~': continue
            if dc and dr and grid[r][cc]=='#' and grid[rr][c]=='#': continue
            out.append((cc,rr))
    return out
def comp_from(c0,r0):
    seen={(c0,r0)}; q=collections.deque([(c0,r0)])
    while q:
        c,r=q.popleft()
        for cc,rr in sea_steps(c,r):
            if (cc,rr) not in seen: seen.add((cc,rr)); q.append((cc,rr))
    return seen
carved=[]
for name,cells in CARVE:
    assert all(grid[r][c]=='#' for c,r in cells),(name,'이미 물인 칸이 있다')
    ch=[[c,r] for c,r in cells]
    for c,r in ch: grid[r][c]='~'
    if ch: carved.append(dict(name=name,cells=ch))
OCEAN=comp_from(150,40)   # 대서양 한가운데에서 이어진 바다
def tile(lon,lat): return int(math.floor(lon-H_LON0)), int(math.floor(H_LAT0-lat))
def nb8(c,r): return [((c+dc)%H_COLS,r+dr) for dc in(-1,0,1) for dr in(-1,0,1) if (dc or dr) and 0<=r+dr<H_ROWS]
def place(lon,lat):
    """항구 칸 = 큰 바다와 맞닿은 육지 칸 가운데 실제 위치에 가장 가까운 칸. 정박 칸 = 그 옆 바다 칸."""
    c0,r0=tile(lon,lat); best=None
    for r in range(max(0,r0-4),min(H_ROWS,r0+5)):
        for c in range(c0-4,c0+5):
            c%=H_COLS
            if grid[r][c]!='#': continue
            sea=[n for n in nb8(c,r) if n in OCEAN]
            if not sea: continue
            d=(c+0.5+H_LON0-lon)**2+(H_LAT0-r-0.5-lat)**2
            if best is None or d<best[0]: best=(d,c,r,min(sea,key=lambda n:(n[0]+0.5+H_LON0-lon)**2+(H_LAT0-n[1]-0.5-lat)**2))
    assert best,(lon,lat); return best[1],best[2],best[3]
GOODS=[('wine','포도주',30),('olive','올리브유',24),('wool','모직물',40),('glass','유리구슬',36),('gold','금',300),('ivory','상아',120),
('pepper','후추',60),('cotton','면직물',45),('silk','비단',160),('porcelain','도자기',110),('clove','정향',140),('sugar','설탕',50)]
ORIGIN={'wine':['iberia','med'],'olive':['med','iberia'],'wool':['europe_n'],'glass':['venice'],'gold':['wafrica','sofala'],'ivory':['eafrica','wafrica'],
'pepper':['india'],'cotton':['india'],'silk':['eastasia'],'porcelain':['canton'],'clove':['malacca'],'sugar':['america']}
FAC=dict(harbor='항구',market='교역소',shipyard='도크',inn='주점',guild='조합',palace='왕궁',lodge='여관')
BIG=['harbor','market','shipyard','inn','guild','palace','lodge']; MID=['harbor','market','shipyard','inn','lodge']; SMALL=['harbor','market','inn','lodge']   # 작은 항구에는 도크가 없다
# id, 이름, 경도, 위도, 권역 꼬리표, 시설
PORTS=[('lisbon','리스본',-9.14,38.72,['iberia'],BIG),('seville','세비야',-5.98,37.39,['iberia'],BIG),('london','런던',-0.12,51.50,['europe_n'],BIG),
('amsterdam','암스테르담',4.90,52.37,['europe_n'],MID),('genoa','제노바',8.93,44.41,['med'],MID),('venice','베네치아',12.33,45.44,['med','venice'],BIG),
('istanbul','이스탄불',28.98,41.01,['med'],BIG),('alexandria','알렉산드리아',29.92,31.20,['med'],MID),('elmina','엘미나',-1.35,5.08,['wafrica'],SMALL),
('sofala','소팔라',34.85,-20.15,['eafrica','sofala'],SMALL),('mombasa','몸바사',39.67,-4.05,['eafrica'],SMALL),('aden','아덴',45.03,12.78,['arabia'],MID),
('hormuz','호르무즈',56.45,27.10,['arabia'],MID),('goa','고아',73.83,15.50,['india'],MID),('calicut','캘리컷',75.78,11.25,['india'],MID),
('malacca','말라카',102.25,2.20,['sea','malacca'],MID),('canton','광저우',113.26,23.13,['eastasia','canton'],BIG),('hakata','하카타',130.40,33.60,['eastasia'],MID),
('santodomingo','산토도밍고',-69.90,18.47,['america'],SMALL),('veracruz','베라크루스',-96.13,19.20,['america'],SMALL)]
pos={}
for pid,name,lon,lat,tags,fac in PORTS: pos[pid]=place(lon,lat)
assert len({(c,r) for c,r,_ in pos.values()})==20, '항구 칸이 겹친다'
def sea_dist(src):
    d={src:0}; q=collections.deque([src])
    while q:
        cur=q.popleft()
        for n in sea_steps(*cur):
            if n not in d: d[n]=d[cur]+1; q.append(n)
    return d
DIST={pid:sea_dist(pos[pid][2]) for pid in pos}
for a in pos:
    for b in pos: assert pos[b][2] in DIST[a],(a,b,'바닷길이 끊겼다')
ports=[]
for pid,name,lon,lat,tags,fac in PORTS:
    c,r,an=pos[pid]; market=[]
    for gid,gname,base in GOODS:
        makers=[q for q,_,_,_,t,_ in PORTS if set(t)&set(ORIGIN[gid])]
        if pid in makers: price,stock=round(base*0.6),200
        else:
            d=min(DIST[m][an] for m in makers); price,stock=round(base*(1+min(1.4,d/120))),0   # 산지에서 뱃길이 멀수록 비싸다(시험 식)
        market.append(dict(good=gid,price=price,stock=stock))
    ports.append(dict(id=pid,name=name,lon=lon,lat=lat,x=c,y=r,anchor=list(an),market=market,facilities=fac))
lis=pos['lisbon'][2]
hang=dict(format='donghyun-hang-data',version=1,
 meta=dict(title='동현항 샘플 자료',start=dict(year=1522,month=5,day=1),
  note='항구 20곳은 1522년에 이미 교역하던 실제 항구다. 좌표는 실제 경위도에서 1° 칸으로 옮겼고, 항구 칸은 큰 바다와 맞닿은 가장 가까운 육지 칸이다(세비야는 실제로는 강 안쪽이라 바닷가로 나와 있다). 시세·시설·배 수치는 시험 값이다. 원작 수치를 옮긴 것이 아니다. 해안선은 오늘날 기준이다.',
  sources=['Natural Earth 110m land (public domain) https://www.naturalearthdata.com/']),
 map=dict(grid='square',cols=H_COLS,rows=H_ROWS,wrapX=True,origin=dict(lon=H_LON0,lat=H_LAT0),degPerTile=1,tiles={'~':'sea','#':'land'},carved=carved,rle=[rle(''.join(x)) for x in grid]),
 goods=[dict(id=i,name=n,base=b) for i,n,b in GOODS], facilities=FAC, ports=ports,
 shipTypes=[dict(id='caravel',name='캐러벨',cargo=120,minCrew=10,maxCrew=40,speed=2,hull=60,guns=8,price=2000),dict(id='carrack',name='캐럭',cargo=320,minCrew=30,maxCrew=120,speed=1,hull=120,guns=16,price=5000),
  # 거북선은 무적 모드에서만 고른다(cheat). 짐은 캐러벨만큼 싣고, 가장 빠르고, 포가 가장 세다(지어낸 시험 값).
  dict(id='turtle',name='거북선',cargo=120,minCrew=10,maxCrew=40,speed=3,hull=200,guns=40,price=30000,cheat=True)],
 fleets=[dict(id='player',name='포동이 탐험대',x=lis[0],y=lis[1],port='lisbon',crew=28,food=90,water=60,gold=1000,captain=dict(name='포동이',war=70),
   ships=[dict(id='s1',type='caravel',name='꼬리바람호',hold=[dict(good='wine',qty=40,paid=18),dict(good='olive',qty=20,paid=14)])])],
 # 바다에서 만나는 적 함대(지어낸 이름). 첫 배가 기함이다.
 rivals=[dict(id='redsail',name='붉은 돛 해적단',captain=dict(name='붉은수염',war=55),ships=['caravel'],crew=24,gold=400),
  dict(id='blackreef',name='검은 암초 해적단',captain=dict(name='외눈 선장',war=72),ships=['caravel','caravel'],crew=56,gold=900),
  dict(id='storm',name='폭풍 사략 함대',captain=dict(name='폭풍 제독',war=86),ships=['carrack','caravel'],crew=110,gold=1800)])

def dump(path,obj):
    s=json.dumps(obj,ensure_ascii=False,indent=1)
    # 짧은 배열·객체는 한 줄로 접어 사람이 읽기 쉽게 한다
    import re
    s=re.sub(r'\[\s+((?:-?\d+(?:\.\d+)?,\s+)*-?\d+(?:\.\d+)?)\s+\]',lambda m:'['+re.sub(r'\s+','',m.group(1))+']',s)
    s=re.sub(r'\{\s+("good": "[a-z]+",)\s+("[a-z]+": -?\d+,)\s+("[a-z]+": -?\d+)\s+\}',r'{\1 \2 \3}',s)
    open(path,'w').write(s+'\n'); json.loads(s); return len(s)
SRC=os.path.join(ROOT,'src')
if os.path.isdir(os.path.join(SRC,'sam')): print('sam',dump(os.path.join(SRC,'sam','donghyun_sam_data.json'),sam),'bytes · 간선',len(EDGES))
if os.path.isdir(os.path.join(SRC,'hang')): print('hang',dump(os.path.join(SRC,'hang','donghyun_hang_data.json'),hang),'bytes · 튼 해협',[c['name'] for c in carved])
# 눈으로 볼 그림
im=Image.new('RGB',(H_COLS*3,H_ROWS*3),'#9cc3dd'); d=ImageDraw.Draw(im)
for r in range(H_ROWS):
    for c in range(H_COLS):
        if grid[r][c]=='#': d.rectangle([c*3,r*3,c*3+2,r*3+2],fill='#d9cfa8')
        elif (c,r) not in OCEAN: d.rectangle([c*3,r*3,c*3+2,r*3+2],fill='#5a86a8')
for p in ports: d.rectangle([p['x']*3-1,p['y']*3-1,p['x']*3+3,p['y']*3+3],fill='#c8402f')
im.save('/tmp/hang-map.png')
