/* 동현삼 · 지도 장면 — 육각 지도 위의 41개 주에서 한 달에 한 번씩 명령을 내린다. 규칙은 sam-rules.js에 있다.
 *   군주를 고른다 → 우리 주를 찍는다 → 내정(농지 개발 · 치수 · 상업 · 시혜) · 징병 · 훈련 · 이동 · 침공 · 수색 · 동맹 가운데 하나 → 턴 종료.
 *   이동과 침공은 조작 창에서 차례로 고른다(누가 → 어디로 → 병력). 어디로는 지도의 주를 찍어도 된다. 이동에서는 장수를 여럿 골라 함께 보낼 수 있고, 금과 쌀을 수레에 실어 보낼 수도 있다.
 *   벼슬(태수 · 군사 · 장군 · 위임)은 '주마다 한 달에 명령 하나' 원칙에 해당하지 않는 군주의 행동이다. 위임한 주는 턴 종료를 누를 때 태수가 알아서 움직인다.
 *   재야: 우리 주에 재야 장수가 있으면 지도의 성 왼쪽 위에 노란 마름모가 뜨고, 주 정보의 '재야' 줄과 수색 버튼에 적힌다. 달이 바뀔 때마다 수행낭자가 어느 주에 누가 있는지 아뢴다.
 *   시나리오: 자료에 든 판 배치(200년 1월의 기본 배치와 189 · 194 · 201 · 208 · 221 · 235년) 가운데 하나를 동현랭 설정 31번으로 고른다. 지도와 주는 같고 주인과 장수가 다르다.
 *   주 정보: 조작 창의 주 정보는 12칸 격자에 줄여 적는다(인구 · 병력 / 금 · 쌀 / 민심 · 농지 · 훈련 / 치수 · 상업 · 태수가 한 줄씩).
 *   행군: 이동 · 수송 · 침공을 하면 깃발 든 부대(또는 수레)가 길을 따라 걸어간다. 침공은 부대가 닿은 뒤에 전투가 열린다. 화면을 누르거나 키를 누르면 건너뛴다.
 *   철: 봄 3~5월 · 여름 6~8월 · 가을 9~11월 · 겨울 12~2월에 따라 땅과 숲의 빛이 바뀐다.
 *   즉위: 주가 늘어 왕 · 황제에 오르면 카드가 뜨고, 두 낭자가 부르는 말이 주군 → 전하 → 폐하로 바뀐다.
 *   장수가 이웃한 공백지(잿빛 성터)로 가면 그 땅을 차지한다. 마지막 장수가 떠난 주는 공백지가 된다. 동맹은 상대를 고르고, 깰 때는 한 번 더 묻는다.
 *   그림: 주는 세력 색 성(군주가 있는 곳은 깃발 단 큰 성)으로, 산 · 숲 · 물결은 sam-art.js의 픽셀 그림으로 그린다.
 *   조작 창 맨 위에는 두 낭자가 있다(sam-council.js). 동행낭자는 우리 땅에서 『장자』를 읊고 남의 땅에서는 그곳의 군주와 병력을 아뢴다. 수행낭자는 규칙을 한 마디씩 한다.
 *   턴 종료를 누르면 다른 군주들이 움직인다. 우리 주가 침공받으면 전투 화면으로 넘어간다(sam-battle-scene.js).
 *   침공하거나 침공받은 전투가 끝나면 주의 주인이 바뀌고 이 지도로 돌아온다.
 * 키보드(지도를 한 번 누른 뒤): 방향키 주 고르기 · Space 명령이 남은 다음 우리 주 · 숫자 키 조작 창의 버튼 · Enter 노란 버튼 · Esc 그만두기 ·
 *   Shift+방향키(또는 W A S D) 지도 옮기기 · + − 확대와 축소(1 · 1.125 · 1.41 · 1.76 · 2.2 · 2.75 · 3배. 처음은 1.125배). 이동·침공에서 '어디로'를 고를 때는 방향키로 대상을 옮기고 Enter로 정한다.
 * 저장: saveGame()이 설정 목록 · 달력 · 난수 · 판을 한 묶음으로 내고, loadGame()이 검사한 뒤 되살린다. 우리 차례의 지도에서만 저장한다. */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};
  const FONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  const NEUTRAL = '#b9b0a2', INK = '#26211c', ACCENT = '#f2b705', RED = '#c0321f';
  const MAP = { shallow: '#b5d6e2', sea: '#9fc4d9', deep: '#93bcd4', land: '#ece2c7', rim: '#c9b48a' };   // 지도 기본 색(동현항과 같은 바다)
  const fmt = n => Number(n).toLocaleString('ko-KR');
  const ZOOM = [['zin', '지도 확대', '+'], ['zout', '지도 축소', '−']];   // 지도 위 아이콘(동현항과 같은 자리 · 같은 모양)
  // 지도 배율의 단. 처음 배율(HOME)은 기본 1배와 +를 한 번 누른 1.25배의 가운데인 1.125배다. 거기서 1.25배씩 커지고, 한 번 줄이면 지도 전체가 보이는 1배다.
  const HOME = 1.125, LEVELS = [1, HOME, HOME * 1.25, HOME * 1.25 ** 2, HOME * 1.25 ** 3, HOME * 1.25 ** 4, 3];
  const SAVE = { format: 'donghyunsam-save', version: 1, name: '동현삼', slot: 'donghyunsam:slot', file: 'donghyunsam', word: '판' };
  const ARROW = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }, PAN = { KeyA: 'ArrowLeft', KeyD: 'ArrowRight', KeyW: 'ArrowUp', KeyS: 'ArrowDown' };
  const digit = code => { const m = /^(?:Digit|Numpad)([1-9])$/.exec(code); return m ? Number(m[1]) : 0; };
  const NO = why => ({ ok: false, why });
  const J = (w, a, b) => DH.Sam.josa(w, a, b);
  // 철: 0 봄 · 1 여름 · 2 가을 · 3 겨울. 땅의 빛에 그 철의 색을 조금 섞는다(바다는 그대로).
  const SEASON = ['봄', '여름', '가을', '겨울'], TINT = [['#cfe2a6', 0.22], ['#a9cd8a', 0.26], ['#e6bf7c', 0.26], ['#f6f5f1', 0.5]];
  const seasonOf = m => m >= 3 && m <= 5 ? 0 : m >= 6 && m <= 8 ? 1 : m >= 9 && m <= 11 ? 2 : 3;
  const MARCH = 40, CROWN = 210;                           // 행군 한 구간의 틱 수 · 즉위 카드가 떠 있는 틱 수
  const CIVIL = ['develop', 'flood', 'trade', 'relief'], ORDERS = { develop: 'pop', flood: 'pop', trade: 'coin', relief: 'pop', draft: 'foot', drill: 'drum', search: 'ping' };

  class SamMapScene extends DH.MapScene {
    /** @param worlds 고를 수 있는 판 배치들(DH.Sam.worlds). 주지 않으면 world 하나다. */
    constructor(engine, world, layout, worlds) {
      super(engine); this.world = world; this.told = world; this.layout = layout; this.worlds = worlds && worlds.length ? worlds : [world];
      this.state = DH.Sam.newState();                             // globalState: 기본값. 동현랭 설정이 오면 새로 지어 덮어쓴다
      this.game = this.newGame(null);                              // 군주를 고르기 전에는 구경만 한다
      this.mode = 'pick'; this.selected = null; this.sub = null; this.pause = 0; this.flash = null;
      this.marches = []; this.crown = null;                        // 걷고 있는 부대들 · 즉위 카드
      this.settings = [];                                          // 지금 판에 적용된 동현랭 설정 [[번호, 값…]] (저장할 때 함께 적는다)
      this.council = new DH.Sam.Council();                         // 두 낭자(동행낭자 · 수행낭자). 주머니의 난수는 판의 난수와 따로 돈다
    }
    newGame(player) { return new DH.Sam.Game(this.world, { player, rng: this.engine.rng, state: this.state }); }
    /** 동현랭 설정을 받아 globalState를 새로 짓고 판을 다시 연다. 오류가 있으면 지금 판을 그대로 둔다.
     *  hold를 주면 판을 시작하지 않고 그 설정의 배치만 지도에 편다(출전 전 미리 보기 · 군주가 정해져 있어도 고르지 않는다).
     *  @returns 보고서 {ok, empty, settings, errors, applied} */
    applyDonghyunLang(scriptText, hold) {
      const st = DH.Sam.newState(), rep = DH.Sam.readLang(scriptText, this.worlds, st);      // 시나리오(31번)를 먼저 읽어 판을 고른 뒤 그 판에 비춰 검사한다
      if (!rep.ok) return rep;
      this.state = st; this.settings = rep.settings.map(x => [x.n, ...x.values]);
      while (this.engine.scene && this.engine.scene !== this) this.engine.popScene();          // 전투 중이었으면 접는다
      this.setWorld(rep.world, hold);
      if (!hold) this.layout.log(rep.empty ? '동현랭 설정이 없다. 기본값으로 새 판을 연다' : `동현랭 설정 ${rep.settings.length}개를 적용했다: ${rep.applied.join(' · ')}`);
      this.restart(hold);
      return rep;
    }
    /** 미리 보는 배치를 기록 맨 위 한 줄로 알린다. 예제를 넘겨 볼 때마다 쌓이지 않게 그 한 줄만 고쳐 쓰고, 판을 열면 지운다. 처음 알린 배치를 그대로 볼 때는 적지 않는다. */
    peek(w) {
      const ol = this.layout.logEl; if (!ol) return;
      if (this._peek) this._peek.remove(); this._peek = null;
      if (w) { this.layout.log(`미리 보기: ${w.title || w.meta.scenario} · 군주 ${w.factions.size}`); this._peek = ol.firstChild; }
    }
    /** 판 배치(시나리오)를 바꾼다. 지도와 주는 같으니 세력 색만 다시 짓는다. 바뀌었으면 true */
    setWorld(w, quiet) {
      if (!w) return false;
      this.peek(quiet && (w !== this.told || this.opened) ? w : null); if (!quiet) this.opened = true;
      if (!quiet && w !== this.told) { this.told = w; this.layout.log(`시나리오: ${w.title || w.meta.scenario} · 군주 ${w.factions.size}`); }   // 미리 보기는 쌓이는 줄을 남기지 않는다(peek의 한 줄). 판을 열 때 앞서 알린 배치와 다르면 한 번 적는다
      if (w === this.world) return false;
      this.world = w;
      if (this.grid && this.tiles) { const pal = this.palette(this.grid); this.seasons = pal.seasons; this.tiles.tileAt = pal.tileAt; this.tiles.styles = pal.seasons[this.season]; }
      return true;
    }
    /** 새 판. 설정에 군주가 정해져 있으면 바로 시작하고, 아니면 고르는 화면으로 간다. hold면 군주가 정해져 있어도 시작하지 않는다(미리 보기). */
    restart(hold) {
      const w = this.world, c = this.engine.clock, n = this.state.start.player;
      Object.assign(c, { year: w.meta.start.year, month: w.meta.start.month || 1, serial: 0, turn: 1 }); c.setActors([]);
      this.sub = null; this.flash = null; this.pause = 0; this.selected = null; this.marches = []; this.crown = null;
      if (hold && this.cam) this.home();                                                     // 미리 보기는 지도 전체가 보이는 처음 자리로 돌아간다
      if (n && !hold) return this.start([...w.factions.keys()][n - 1]);
      this.game = this.newGame(null); this.mode = 'pick'; this.refresh();
    }
    enter() {
      const w = this.world, e = this.engine;
      const grid = new DH.HexGrid(w.map.cols, w.map.rows, 7);
      const pal = this.palette(grid); this.seasons = pal.seasons; this.season = seasonOf(e.clock.month);
      this.setupMap({ grid, tileAt: pal.tileAt, styles: pal.seasons[this.season], line: 'rgba(38,33,28,.07)', minZoom: 1, maxZoom: 3 });
      this.pos = new Map([...w.provinces.values()].map(p => [p.id, grid.center(p.hex[0], p.hex[1])]));
      this.decor = this.decorate(grid);
      this.home();
      e.clock.setActors([]);
      this._off = [e.on('clock:turn', d => this.layout.log(`${d.year}년 ${d.month}월이 되었다`))];
      this.layout.log(`${w.title || w.meta.scenario || '시작'} · 주 ${w.provinces.size} · 군주 ${w.factions.size}`);
      this.refresh();
    }
    exit() { this._off.forEach(f => f()); }
    /** 처음 배율로 맞춘다: 1.125배. 41개 주의 성과 이름이 모두 들어오게 주들이 놓인 자리의 가운데를 화면 가운데에 둔다. */
    home() {
      const P = [...this.pos.values()], xs = P.map(p => p.x), ys = P.map(p => p.y), top = Math.min(...ys) - 10, bottom = Math.max(...ys) + 6 + 9 / HOME;      // 성 지붕 위부터 이름 아래까지
      this.cam.zoom = HOME; this.cam.centerOn((Math.min(...xs) + Math.max(...xs)) / 2, (top + bottom) / 2); this.cam.clampTo(this.grid);
    }
    /** 배율을 한 단 올리거나 내린다(dir +1 · −1). 화면 가운데를 붙든다. 저장 파일에서 온 어중간한 배율도 가까운 단으로 간다. */
    zoomStep(dir) {
      const c = this.cam, z = c.zoom, next = dir > 0 ? LEVELS.find(v => v > z + 1e-6) : [...LEVELS].reverse().find(v => v < z - 1e-6);
      if (next === undefined) return;
      if (next === HOME && z < HOME) return this.home();                                      // 지도 전체(1배)에서 한 단 키우면 처음 화면으로 돌아온다
      const sx = this.engine.width / 2, sy = this.engine.height / 2, w = c.toWorld(sx, sy);
      c.zoom = Math.min(c.maxZoom, Math.max(c.minZoom, next)); c.x = w.x - sx / c.zoom; c.y = w.y - sy / c.zoom; c.clampTo(this.grid);
    }
    /** 지도 색(레트로 픽셀 지도처럼 몇 가지 평평한 색만 쓴다). 바다는 뭍에서 멀수록 짙어지는 세 단.
     *  뭍은 가장 가까운 주(걸음 수)의 세력 색을 아주 옅게 머금어 땅의 주인이 한눈에 보이고, 바다에 닿은 칸은 조금 짙게 해 해안선을 세운다.
     *  seasons는 철마다의 색 한 벌이다(봄 연둣빛 · 여름 풀빛 · 가을 누런빛 · 겨울 눈빛). */
    palette(grid) {
      const w = this.world, at = (c, r) => w.map.at(c, r), land = (c, r) => at(c, r) === 'land', depth = DH.shoreDistance(grid, land);
      const own = new Int32Array(grid.cols * grid.rows).fill(-1), q = [];
      for (const p of w.provinces.values()) { own[p.hex[1] * grid.cols + p.hex[0]] = p.id; q.push(p.hex); }
      for (let i = 0; i < q.length; i++) { const [c, r] = q[i], id = own[r * grid.cols + c]; for (const [nc, nr] of grid.neighbors(c, r)) { const j = nr * grid.cols + nc; if (own[j] < 0 && land(nc, nr)) { own[j] = id; q.push([nc, nr]); } } }
      const coast = (c, r) => grid.neighbors(c, r).some(([nc, nr]) => !land(nc, nr));
      const kind = Array.from({ length: grid.rows }, (_, r) => Array.from({ length: grid.cols }, (_, c) => !land(c, r) ? 's' + Math.min(3, depth[r * grid.cols + c]) : coast(c, r) ? 'c' : 'l'));
      const styles = { s1: { fill: MAP.shallow }, s2: { fill: MAP.sea }, s3: { fill: MAP.deep }, default: { fill: MAP.land } };
      for (const [id, color] of [['', NEUTRAL], ...[...w.factions.values()].map(f => [f.id, f.color])]) {
        const tint = DH.mixColor(MAP.land, color, id ? 0.11 : 0.05);
        styles['l' + id] = { fill: tint }; styles['c' + id] = { fill: DH.mixColor(tint, MAP.rim, 0.3) };
      }
      const sea = /^s\d$/, seasons = TINT.map(([col, t]) => Object.fromEntries(Object.entries(styles).map(([k, v]) => [k, sea.test(k) ? v : { fill: DH.mixColor(v.fill, col, t) }])));      // 철마다 한 벌
      return { styles, seasons, tileAt: (c, r) => { const k = kind[r][c]; if (k[0] === 's') return k; const id = own[r * grid.cols + c], p = id >= 0 && this.game && this.game.P(id); return k + (p && p.owner ? p.owner : ''); } };
    }
    /** 지도 꾸밈: 주가 없는 칸에 산 · 숲 · 물결을 둔다. 칸 번호로 정하니 늘 같은 자리다(서쪽일수록 산이 많다). 주와 그 이웃 칸은 비워 이름이 가리지 않게 한다. */
    decorate(grid) {
      const w = this.world, A = DH.Sam.Art, land = (c, r) => w.map.at(c, r) === 'land', near = new Set(), out = [];
      for (const p of w.provinces.values()) { near.add(p.hex[0] + ',' + p.hex[1]); for (const [c, r] of grid.neighbors(p.hex[0], p.hex[1])) near.add(c + ',' + r); }
      for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
        if (near.has(c + ',' + r)) continue;
        const h = A.hash(c, r), P = grid.center(c, r);
        if (!land(c, r)) { if (h < 0.09 && grid.neighbors(c, r).every(([nc, nr]) => !land(nc, nr))) out.push({ name: 'wave', x: P.x, y: P.y + 1, cell: 0.9 }); continue; }
        const hill = c < 9 ? 0.3 : c < 14 ? 0.15 : 0.06;
        if (h < hill) out.push({ name: h < hill * 0.55 ? 'hill' : 'hill2', x: P.x, y: P.y + 2.5, cell: 0.9 });
        else if (h > 0.87) out.push({ name: 'wood', x: P.x, y: P.y + 2, cell: 0.9 });
      }
      return out;
    }
    colorOf(p) { return p.owner ? this.game.factions.get(p.owner).color : NEUTRAL; }
    colorOfF(f) { return f ? this.game.factions.get(f).color : NEUTRAL; }
    /** 달력의 달에 맞춰 지도의 철을 바꾼다. */
    syncSeason() { const s = seasonOf(this.engine.clock.month); if (s !== this.season && this.tiles) { this.season = s; this.tiles.styles = this.seasons[s]; } }

    // ───────── 행군 ─────────
    /** 부대(또는 수레)가 from에서 to까지 길을 따라 걷는다. o.then을 주면 닿을 때까지 조작을 막고, 닿은 뒤에 부른다(침공 → 전투).
     *  @param {{kind?:'rider'|'foot'|'cart', color?:string, then?:Function}} o */
    marchGo(from, to, o = {}) {
      const pts = this.game.route(from, to).map(id => this.pos.get(id));
      const m = { pts, t0: this.engine.tick, dur: MARCH * Math.max(1, pts.length - 1), kind: o.kind || 'rider', color: o.color || NEUTRAL, then: o.then || null };
      this.marches.push(m); return m;
    }
    /** 조작을 막고 있는 행군(닿은 뒤에 할 일이 있는 것). 없으면 null */
    get hold() { return this.marches.find(m => m.then) || null; }
    /** 조작을 막고 있는 행군을 건너뛴다(바로 닿은 것으로 친다). 건너뛴 것이 있으면 true */
    skipMarch() { const m = this.hold; if (!m) return false; this.marches.splice(this.marches.indexOf(m), 1); m.then(); return true; }
    /** 행군 중인 부대가 지금 선 자리와 보는 쪽 */
    marchAt(m, tick) {
      const n = m.pts.length - 1, q = Math.min(0.9999, Math.max(0, (tick - m.t0) / m.dur)) * n, i = Math.floor(q), f = q - i, a = m.pts[i], b = m.pts[i + 1] || a;
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, left: b.x < a.x, from: m.pts[0] };
    }
    get mine() { const p = this.game.P(this.selected); return this.mode === 'play' && p && p.owner === this.game.player ? p : null; }

    /** 군주를 고르고 판을 연다. */
    start(fid) {
      const w = this.world, c = this.engine.clock, f = w.factions.get(fid);
      if (this.state.start.seed != null) this.engine.rng.state = this.state.start.seed >>> 0;      // 시드를 정했으면 판마다 같은 수가 나온다
      this.game = this.newGame(fid);
      Object.assign(c, { year: w.meta.start.year, month: w.meta.start.month || 1, serial: 0, turn: 1 }); c.setActors([fid]);
      this.mode = 'play'; this.sub = null; this.flash = null; this.marches = []; this.crown = null; this.selected = w.officers.get(f.leader).province;
      const g = this.game, all = g.goal >= g.provinces.size;
      this.layout.log(`${DH.Sam.ro(f.name)} 시작한다. 우리 주를 찍고 한 달에 한 번씩 명령을 내린다`); this.sfx('zone');
      this.council.poke();
      this.layout.log(`이기는 조건: ${all ? '다른 세력을 모두 무너뜨린다(또는 모든 주를 차지한다)' : `주 ${g.goal}개를 차지한다`}` + (g.stage.months ? ` · ${g.stage.months}달 안에` : ''));
      this.announce(true);
      this.settled();
    }
    /** 우리 주에 있는 재야 장수: [[주, [장수…]], …] (주 번호 순서) */
    talents() {
      const g = this.game; if (!g.player) return [];
      return g.provincesOf(g.player).sort((a, b) => a.id - b.id).map(p => [p, g.freeIn(p.id).sort((a, b) => a.id - b.id)]).filter(([, f]) => f.length);
    }
    /** 새 달(또는 판을 열 때)에 우리 주의 재야 장수를 수행낭자가 아뢴다. 기록에는 목록이 바뀌었을 때만(force면 늘) 한 줄 남긴다. 없으면 평소의 한 마디가 나온다. */
    announce(force) {
      const g = this.game, T = this.talents(), line = T.map(([p, f]) => `${p.name} ${f.map(o => o.name).join(' · ')}`).join(' / ');
      if (!T.length || g.over) { this._talent = ''; return; }
      const head = T.slice(0, 4).map(([p, f]) => `${p.name}에 ${f.map(o => o.name).join(' · ')}`).join(', '), more = T.length > 4 ? ` 외 ${T.length - 4}곳` : '';
      this.council.tell(`${g.title}, 재야에 사람이 있습니다. ${head}${more}입니다. 그 주에서 수색하시면 맞아들일 수 있습니다.`);
      if (force || line !== this._talent) this.layout.log(`재야: ${line}`);
      this._talent = line;
    }
    /** 이동·침공에서 지금 찍을 수 있는 주들 */
    candidates() {
      const s = this.sub, p = this.mine; if (!s || s.step !== 'to' || !p) return [];
      return s.type === 'move' ? [...this.game.friends(p.id), ...(s.officer != null ? this.game.openLand(p.id) : [])] : s.type === 'attack' ? this.game.targets(p.id) : [];
    }

    onTap(x, y) {
      if (this.crown) { this.crown = null; return; }                                           // 즉위 카드는 누르면 닫힌다
      if (this.skipMarch()) return;                                                            // 걷는 부대를 기다리는 중이면 건너뛴다
      if (this.mode === 'busy') return;
      const wpt = this.cam.toWorld(x, y); let best = null, bd = 12 / this.cam.zoom + 4;      // 손가락이 조금 빗나가도 잡히게
      for (const [id, p] of this.pos) { const d = Math.hypot(p.x - wpt.x, p.y - wpt.y); if (d < bd) { bd = d; best = id; } }
      if (best !== null && this.candidates().some(q => q.id === best)) return this.command('to:' + best);   // 고르는 중이면 그 주가 대상이 된다
      if (best !== null && best !== this.selected) this.sfx('tick');
      else if (best !== null && !this.sub) this.council.poke();                               // 같은 주를 다시 누르면 동행낭자가 다음 구절을 읊는다
      this.sub = null; this.selected = best; this.refresh();
    }
    /** 키보드. 방향키는 주를 고르고(대상을 고르는 중이면 대상을 옮기고), 숫자 키와 Enter는 조작 창의 버튼을 누른다. */
    onKey(code, ev) {
      if (ev && (ev.ctrlKey || ev.metaKey || ev.altKey)) return;
      const d = ARROW[code], shift = !!(ev && ev.shiftKey), n = digit(code), used = () => { if (ev) ev.preventDefault(); };
      if (this.crown && !(ev && ev.repeat)) this.crown = null;
      if (this.hold) { if (!(ev && ev.repeat)) { used(); this.skipMarch(); } return; }      // 아무 키나 누르면 행군을 건너뛴다
      if ((d && shift) || PAN[code]) return super.onKey(PAN[code] || code, ev);              // 지도 옮기기
      const q = this.qty();                                                                   // 수량을 정하는 중이면 방향키와 숫자 키가 수를 바꾼다
      if (d && q) { used(); return this.qtyBump(d[0] ? d[0] * 100 : -d[1] * 1000); }          // ← → 100 · ↑ ↓ 1,000
      if (d) { used(); return this.step(d); }
      if (code === 'Escape') { if (this.mode === 'busy') return; if (this.sub) this.sub = null; else this.selected = null; return this.refresh(); }
      if (ev && ev.repeat) return;                                                            // 누르고 있어도 버튼은 한 번만 눌린다
      if (q) {
        const m = /^(?:Digit|Numpad)(\d)$/.exec(code);
        if (m) { used(); return this.qtyType(Number(m[1])); }                                 // 숫자 키로 수를 바로 적는다
        if (code === 'Backspace') { used(); return this.qtyType(null); }
        if (code === 'Delete') { used(); return this.command('cancel'); }                    // 이 단계의 버튼에는 번호가 없다. 전체 화면에서는 Esc가 전체 화면을 닫으니 Delete로도 그만둔다
        if (code === 'Home' || code === 'End') { used(); return this.command(code === 'End' ? 'qs:all' : this.sub.type === 'attack' ? 'qs:min' : 'qs:0'); }      // Home 0(침공은 최소) · End 전부
        if (code === 'Space' && this.sub.cart) { used(); return this.command('qf:' + (this.sub.field === 'rice' ? 'gold' : 'rice')); }      // 금 ↔ 쌀
      }
      if (n) { used(); this.layout.press(n); }
      else if (code === 'Enter' || code === 'NumpadEnter') { used(); const s = this.sub; if (s && s.step === 'to' && s.aim != null) this.command('to:' + s.aim); else this.layout.pressPrimary(); }
      else if (code === 'Space') { used(); this.nextOwn(shift ? -1 : 1); }
      else if (code === 'Equal' || code === 'NumpadAdd') this.command('zin');                 // + − 확대 · 축소(아이콘과 같은 단을 밟는다)
      else if (code === 'Minus' || code === 'NumpadSubtract') this.command('zout');
    }
    // 지도 배율은 지도 위의 + − 아이콘과 + − 키로만 바꾼다. 마우스 바퀴와 트랙패드 제스처로는 바뀌지 않는다(동현항과 같은 규칙).
    onWheel() {}
    /** 지도 오른쪽 위의 확대 · 축소 아이콘. 이 장면이 맨 위일 때만 보인다(시작 카드와 전투 중에는 숨는다). node 시험에서는 만들지 않는다. */
    zoomIcons() {
      const cv = this.layout.canvas, doc = root.document;
      if (!doc || !cv || !cv.parentElement) return;
      if (!this.zoomTools) {
        const tools = this.zoomTools = doc.createElement('div'); tools.className = 'sam-zoom';
        for (const [id, label, icon] of ZOOM) {
          const b = doc.createElement('button'); b.type = 'button'; b.textContent = icon; b.dataset.zoom = id; b.setAttribute('aria-label', label); b.title = label;
          b.onclick = () => { if (this.engine.scene === this) this.command(id); };
          tools.append(b);
        }
        cv.parentElement.append(tools);
      }
      const hide = this.engine.scene !== this; if (this.zoomTools.hidden !== hide) this.zoomTools.hidden = hide;
    }
    /** from에서 d 방향으로 가장 가까운 주(pool 가운데). 그 방향의 56° 안쪽을 먼저 보고, 없으면 그쪽 절반에서 찾는다. 없으면 null */
    toward(from, d, pool) {
      const P = this.pos.get(from); let best = null, bs = Infinity, wide = null, ws = Infinity;
      for (const q of pool) {
        if (q.id === from) continue;
        const Q = this.pos.get(q.id), vx = Q.x - P.x, vy = Q.y - P.y, along = vx * d[0] + vy * d[1], side = Math.abs(vx * d[1] - vy * d[0]), sc = along + side * 2;
        if (along <= 0.01) continue;
        if (side <= along * 1.5) { if (sc < bs) { bs = sc; best = q.id; } } else if (sc < ws) { ws = sc; wide = q.id; }
      }
      return best ?? wide;
    }
    /** 방향키 한 번. 고른 주가 없으면 우리 본거지(없으면 화면 가운데에서 가까운 주)부터 시작한다. */
    step(d) {
      if (this.mode === 'busy') return;
      const g = this.game, s = this.sub, all = [...g.provinces.values()];
      if (s && s.step === 'to') { const c = this.candidates(), next = s.aim == null ? this.toward(this.selected, d, c) ?? (c[0] && c[0].id) : this.toward(s.aim, d, c); if (next != null) { if (next !== s.aim) this.sfx('tick'); s.aim = next; this.reveal(next); } return this.refresh(); }
      if (s) return;
      let next;
      if (this.selected === null) {
        const own = g.player ? g.provincesOf(g.player) : [], home = g.player && g.officers.get(g.factions.get(g.player).leader), mid = this.cam.toWorld(this.engine.width / 2, this.engine.height / 2);
        next = home && own.some(p => p.id === home.province) ? home.province : own.length ? own[0].id : all.map(p => ({ id: p.id, d: Math.hypot(this.pos.get(p.id).x - mid.x, this.pos.get(p.id).y - mid.y) })).sort((a, b) => a.d - b.d)[0].id;
      } else next = this.toward(this.selected, d, all);
      if (next == null) return;
      if (next !== this.selected) this.sfx('tick');
      this.selected = next; this.reveal(next); this.refresh();
    }
    /** Space: 명령이 남은 우리 주를 번호 순서로 돈다. 남은 주가 없으면 우리 주를 모두 돈다. */
    nextOwn(dir = 1) {
      const g = this.game; if (this.mode !== 'play' || this.sub) return;
      const own = g.provincesOf(g.player).sort((a, b) => a.id - b.id), left = own.filter(p => !p.acted), list = left.length ? left : own; if (!list.length) return;
      const cur = this.selected ?? (dir > 0 ? -Infinity : Infinity), next = dir > 0 ? list.find(p => p.id > cur) || list[0] : [...list].reverse().find(p => p.id < cur) || list[list.length - 1];
      if (next.id !== this.selected) this.sfx('tick');
      this.selected = next.id; this.reveal(next.id); this.refresh();
    }
    /** 그 주가 화면 가장자리 밖에 있으면 화면 가운데로 데려온다. */
    reveal(id) { const P = this.pos.get(id), q = this.cam.toScreen(P.x, P.y), m = 28, e = this.engine; if (q.x < m || q.x > e.width - m || q.y < m || q.y > e.height - m) { this.cam.centerOn(P.x, P.y); this.cam.clampTo(this.grid); } }

    /** 수량을 정하는 단계에서 지금 다루는 것: {key 적어 두는 칸, name, max 가진 양, val 지금 값}. 수송은 금과 쌀 가운데 고른 쪽이다. 그 단계가 아니면 null */
    qty() {
      const s = this.sub, p = this.mine; if (!s || s.step !== 'n' || !p) return null;
      const key = s.cart ? (s.field === 'rice' ? 'rice' : 'gold') : 'n', max = s.cart ? p[key] : p.troops;
      return { key, name: key === 'gold' ? '금' : key === 'rice' ? '쌀' : '병력', max, val: Math.max(0, Math.min(max, s[key] || 0)) };
    }
    /** 수량을 v로 맞춘다(0부터 가진 만큼까지). */
    qtySet(v) { const q = this.qty(); if (!q) return; this.sub[q.key] = Math.max(0, Math.min(q.max, Math.floor(v))); this.sub.fresh = true; this.sfx('tick'); this.refresh(); }
    /** 수량을 d만큼 올리거나 내린다. 전부(백 단위가 아닌 수)에서 내리면 백 단위로 맞춘다. */
    qtyBump(d) { const q = this.qty(); if (!q) return; let v = q.val + d; if (d < 0 && q.val === q.max && q.max % 100) v = Math.ceil(v / 100) * 100; this.qtySet(v); }
    /** 숫자 키로 수를 적는다. 처음 누른 숫자는 새로 적고 이어 누르면 뒤에 붙는다. ch가 null이면 끝자리를 지운다(Backspace). 가진 것보다 많이 적으면 가진 만큼이 된다. */
    qtyType(ch) {
      const q = this.qty(); if (!q) return; const s = this.sub;
      const v = ch === null ? Math.floor(q.val / 10) : (s.fresh ? 0 : q.val) * 10 + ch;
      s[q.key] = Math.max(0, Math.min(q.max, v)); s.fresh = v > q.max; this.sfx('tick'); this.refresh();      // 넘쳐서 가진 만큼이 되었으면 다음 숫자는 새로 적는다
    }

    command(id) {
      if (id === 'zin') return this.zoomStep(1);
      if (id === 'zout') return this.zoomStep(-1);
      const g = this.game, [key, arg] = id.split(':');
      if (this.mode === 'pick') { if (key === 'f') this.start(arg); return; }
      if (this.mode === 'over') { if (id === 'again') this.restart(); return; }
      if (this.hold) return void this.skipMarch();
      if (this.mode !== 'play') return;
      if (id === 'end') { this.sfx('swish'); return this.endTurn(); }
      const p = this.mine; if (!p) return;
      const s = this.sub, me = g.player;
      if (id === 'cancel') this.sub = null;
      else if (id === 'back' && s && s.type === 'office') s.step = 'top';
      else if (ORDERS[id]) { this.sub = null; this.say(g[id](p.id), ORDERS[id]); }
      else if (id === 'civil') this.sub = { type: 'civil' };
      else if (id === 'office') this.sub = { type: 'office', step: 'top' };
      else if (s && s.type === 'office') {                                                    // 벼슬: '주마다 한 달에 명령 하나' 원칙에 해당하지 않는다(acted를 건드리지 않는다). 정한 뒤에는 벼슬 메뉴로 돌아온다
        const num = arg === 'none' ? null : Number(arg); let r = null;
        if (['ogov', 'oadv', 'ogen', 'odel'].includes(id)) s.step = id.slice(1);
        else if (key === 'og') r = g.setGovernor(p.id, num);
        else if (key === 'oa') r = g.setAdvisor(me, num);
        else if (key === 'on') { const o = g.officers.get(num); r = g.setGeneral(num, !(o && o.general)); }
        else if (key === 'od') r = g.delegate(p.id, arg === 'none' ? null : arg);
        if (r) { this.say(r, 'sparkle'); if (r.ok) s.step = 'top'; }
      }
      else if (id === 'ally') this.sub = { type: 'ally', step: 'f' };
      else if (key === 'af' && s && s.type === 'ally' && s.step === 'f') { this.sub = null; const r = g.ally(p.id, arg); this.say(r, r.made ? 'cheer' : 'tick'); }
      else if (key === 'ab' && s && s.type === 'ally' && s.step === 'f') { s.f = arg; s.step = 'break'; }
      else if (id === 'abok' && s && s.type === 'ally' && s.step === 'break') { this.sub = null; this.say(g.breakPact(p.id, s.f), 'alert'); }
      else if (id === 'move') this.sub = { type: 'move', step: 'who', picks: [] };                // picks: 함께 보낼 장수들(누를 때마다 켜고 끈다)
      else if (id === 'attack') this.sub = { type: 'attack', step: 'to' };
      else if (key === 'who' && s && s.step === 'who') {                                        // s.officer: 보낼 장수 번호들(배열) · 병력만이나 수레면 null
        const here = g.officersOf(p.id).map(o => o.id), picks = (s.picks || []).filter(x => here.includes(x)), n = Number(arg);
        if (arg === 'cart' || arg === 'none') { s.cart = arg === 'cart'; s.officer = null; s.step = 'to'; }
        else if (arg === 'ok') { if (picks.length) { s.cart = false; s.officer = here.filter(x => picks.includes(x)); s.step = 'to'; } }
        else if (here.includes(n)) { s.picks = picks.includes(n) ? picks.filter(x => x !== n) : [...picks, n]; this.sfx('tick'); }
      }
      else if (key === 'to' && s && s.step === 'to') {
        s.to = Number(arg); s.step = 'n'; s.fresh = true; s.fore = null;                      // 얼마나 보낼지는 수로 정한다(qty). fresh: 숫자 키를 처음 누르면 새로 적는다
        if (s.cart) { s.gold = 0; s.rice = 0; s.field = 'gold'; }                              // 처음 값: 수송은 금도 쌀도 0
        else s.n = s.type === 'attack' ? p.troops : s.officer != null ? 0 : Math.floor(p.troops / 200) * 100 || p.troops;      // 침공은 전부 · 장수가 가면 0 · 병력만 보내면 절반(백 단위)
      }
      else if (s && s.step === 'n' && (key === 'q' || key === 'qs' || key === 'qf' || id === 'qok')) {
        const q = this.qty();
        if (key === 'q') return this.qtyBump(Number(arg));                                     // q:-1000 · q:-100 · q:100 · q:1000
        if (key === 'qs') return this.qtySet(arg === 'all' ? q.max : arg === 'half' ? q.max / 2 : arg === 'min' ? g.rules.attackMin : 0);
        if (key === 'qf') { if (s.cart) { s.field = arg === 'rice' ? 'rice' : 'gold'; s.fresh = true; this.sfx('tick'); } }      // 수송: 금과 쌀 가운데 맞출 쪽을 고른다
        else return this.command(s.cart ? `cg:${Math.min(p.gold, s.gold || 0)}:${Math.min(p.rice, s.rice || 0)}` : 'n:' + q.val);      // qok: 정한 수로 보낸다
      }
      else if (key === 'n' && s && s.step === 'n' && !s.cart) {
        const n = Number(arg); this.sub = null;
        if (s.type === 'move') {
          const col = this.colorOf(p), r = g.move(p.id, s.officer, s.to, n); this.say(r, 'horse');
          if (r.ok) { this.marchGo(p.id, s.to, { kind: s.officer != null ? 'rider' : 'foot', color: col }); if (r.took) this.selected = s.to; }
          return this.settled();
        }
        else return this.invade(p.id, s.to, n);
      }
      else if (key === 'cg' && s && s.step === 'n' && s.cart) {                                // 수송: cg:금:쌀
        const [, a, b] = id.split(':'), r = g.transport(p.id, s.to, Number(a), Number(b)); this.sub = null; this.say(r, 'coin');
        if (r.ok) this.marchGo(p.id, s.to, { kind: 'cart', color: this.colorOf(p) });
      }
      this.refresh();
    }
    /** 한 일을 기록에 남긴다. 되었으면 그 소리(ok), 안 되었으면 막히는 소리 */
    say(r, ok) { this.layout.log(r.ok ? r.text : r.why); if (!r.ok) this.sfx('buzz'); else if (ok) this.sfx(ok); }
    invade(from, to, n) {
      const r = this.game.attack(from, to, n);
      if (!r.ok) { this.say(r); return this.refresh(); }
      this.layout.log(r.text); this.flash = { from, to, t0: this.engine.tick }; this.sfx('drum'); this.sfx('horse', 0.25);
      this.marchGo(from, to, { kind: r.pending.officers.length ? 'rider' : 'foot', color: this.colorOfF(r.pending.att), then: () => {      // 부대가 닿은 뒤에 싸운다
        if (r.battle) return this.openBattle(r, 'att');
        this.layout.log(r.outcome.text); this.selected = to; this.sfx('cheer'); this.settled();
      } });
      this.refresh();
    }
    /** 전투 화면을 얹는다. 끝나면 결과를 지도에 반영하고 돌아온다. */
    openBattle(r, side) {
      this.engine.pushScene(new DH.Sam.SamBattleScene(this.engine, this.layout, r.battle, { side, onDone: res => {
        const out = this.game.settle(r.pending, res); this.layout.log(out.text);
        if (side === 'att' && out.winner === 'att') { this.selected = r.pending.to; this.sfx('cheer'); }
        this.pause = 20; this.settled();
      } }));
    }
    /** 왕 · 황제에 올랐으면 알린다(카드 · 기록 · 소리). 낭자들이 부르는 말이 이때 바뀐다. */
    enthrone() {
      const g = this.game, r = g.crowned; if (!r) return;
      g.crowned = 0; this.crown = { rank: r, t0: this.engine.tick };
      const T = g.thrones, me = g.fname(g.player);
      this.layout.log(r === 2 ? `${J(me, '이', '가')} 황제의 자리에 올랐다(주 ${T.emperor}곳). 이제부터 ‘${g.title}’라 불린다` : `${J(me, '이', '가')} 왕위에 올랐다(주 ${T.king}곳). 이제부터 ‘${g.title}’라 불린다`);
      this.sfx('pomp', 0.2); this.council.poke();
    }
    settled() { this.enthrone(); if (this.game.over && this.mode !== 'over') { this.mode = 'over'; this.sub = null; this.layout.log(this.overTitle()); this.sfx(this.game.over === 'won' ? 'pomp' : 'lose', 0.6); } this.refresh(); }
    /** 판이 끝난 까닭에 맞는 한 줄 */
    overTitle() { const w = this.game.overWhy; return w === 'all' ? '온 땅을 하나로 모았다' : w === 'goal' ? '목표한 땅을 모두 차지했다' : w === 'time' ? '기한이 다 되었다' : '세력이 무너졌다'; }

    /** 턴 종료: 위임받은 태수들이 먼저 움직이고(전투는 태수가 알아서 싸운다), 이어서 다른 군주들의 차례가 된다. */
    endTurn() {
      const g = this.game, col = this.colorOfF(g.player); this.sub = null; this.pause = 0;
      for (const d of g.runDelegates()) {
        this.layout.log(d.text);
        if (d.cmd.to != null) { this.marchGo(d.pid, d.cmd.to, { kind: d.battle || d.cmd.officer != null ? 'rider' : 'foot', color: col }); this.pause = 20; if (d.battle) this.sfx(d.won ? 'cheer' : 'fall', 0.2); }
      }
      if (g.over) return this.settled();
      this.enthrone(); this.mode = 'busy'; g.beginAI(); this.refresh();
    }
    /** 다른 군주들의 차례. 조용한 일(징병·개발·이동)은 한꺼번에 넘기고, 침공은 하나씩 보여 준다. 우리 주로 오는 군은 닿은 뒤에 전투가 열린다. */
    update(tick) {
      if (this.flash && tick - this.flash.t0 > 60) this.flash = null;
      if (this.crown && tick - this.crown.t0 > CROWN) this.crown = null;
      for (const m of [...this.marches]) if (tick - m.t0 >= m.dur) { const i = this.marches.indexOf(m); if (i >= 0) this.marches.splice(i, 1); if (m.then) m.then(); }
      if (this.mode !== 'busy' || this.hold || this.engine.scene !== this) return;
      if (this.pause > 0) { this.pause--; return; }
      for (let i = 0; i < 400; i++) {
        const s = this.game.nextAI();
        if (s.done) return this.endMonth();
        if (s.quiet) continue;
        const fight = s.cmd.type === 'attack', walk = s.cmd.to != null ? { kind: fight || s.cmd.officer != null ? 'rider' : 'foot', color: this.colorOfF(s.by) } : null;
        if (walk) this.flash = { from: s.from, to: s.cmd.to, t0: tick };
        this.layout.log(s.text); this.sfx(s.battle ? 'alert' : fight ? 'drum' : 'tick');            // 우리 주가 침공당하면 경보
        if (s.battle) { this.marchGo(s.from, s.cmd.to, { ...walk, then: () => this.openBattle(s, 'def') }); return this.refresh(); }
        if (walk) this.marchGo(s.from, s.cmd.to, walk);
        this.pause = 26; return this.refresh();
      }
    }
    endMonth() {
      if (this.game.over) return this.settled();
      const notes = this.game.endMonth(), was = this.season;
      this.engine.clock.endPhase(); this.syncSeason();
      if (this.season !== was) this.layout.log(`${J(SEASON[this.season], '이', '가')} 왔다`);
      for (const n of notes) this.layout.log(n); this.sfx('rows'); if (notes.some(n => /큰물|메뚜기|돌림병/.test(n))) this.sfx('alert', 0.3);
      this.mode = 'play'; this.council.poke(); this.announce(false); this.settled();      // 달이 바뀌면서 기한이 차거나 마지막 주를 잃으면 여기서 바로 끝 화면으로 간다
    }

    refresh() {
      const g = this.game, c = this.engine.clock, L = this.layout, sel = g.P(this.selected), me = g.player, own = me ? g.provincesOf(me) : [], RK = DH.Sam.RANKS;
      const crownOf = f => RK[g.rankOf(f)] ? `(${RK[g.rankOf(f)]})` : '';
      this.syncSeason(); if (g.crowned) this.enthrone();
      L.setInfo([{ label: '날짜', value: c.label }, { label: '군주', value: me ? g.fname(me) + crownOf(me) : '고르는 중' }, { label: '주', value: me ? (g.goal < g.provinces.size ? `${own.length}/${g.goal}` : own.length) : g.provinces.size },
        { label: '병력', value: me ? fmt(own.reduce((s, p) => s + p.troops, 0)) : '-' }, { label: '남은 명령', value: me ? own.filter(p => !p.acted && !g.delegated(p.id)).length : '-' },
        ...(me && g.stage.months ? [{ label: '기한', value: `${Math.max(0, g.stage.months - g.months)}달 남음` }] : [])]);
      const pick = () => {
        L.setMenu(this.menu(), id2 => this.command(id2));
        const el = L.menuEl; if (!el || !el.dataset) return;                                   // node 시험의 가짜 화면에는 없다
        const q = this.qty();
        if (this.mode === 'pick' && g.factions.size >= 10) el.dataset.cols = '3'; else if (q) el.dataset.cols = 'q'; else delete el.dataset.cols;      // 군주가 많은 시나리오는 한 줄에 셋씩 · 수량을 정할 때는 − · + 넷을 한 줄에 놓는다
        if (q && !this.sub.cart && root.document) {                                            // 보낼 병력과 남는 병력을 버튼 위에 크게 적는다(수송은 금 · 쌀 버튼이 수를 보인다)
          const r = root.document.createElement('p'), b = root.document.createElement('b'), rest = root.document.createElement('span');
          r.className = 'sam-qty'; r.setAttribute('role', 'status'); b.textContent = `보낼 병력 ${fmt(q.val)}`; rest.textContent = `남는 병력 ${fmt(q.max - q.val)}`; r.append(b, rest); el.prepend(r);
        }
        if (q) for (const b of el.querySelectorAll('button[data-id^="qf:"]')) { const on = b.dataset.id === 'qf:' + q.key; b.classList.toggle('sam-on', on); b.setAttribute('aria-pressed', String(on)); }
        const picks = this.sub && this.sub.step === 'who' ? this.sub.picks || [] : [];
        for (const b of el.querySelectorAll('button[data-id^="who:"]')) { const on = picks.includes(Number(b.dataset.id.slice(4))); b.classList.toggle('sam-on', on); if (/^who:\d+$/.test(b.dataset.id)) b.setAttribute('aria-pressed', String(on)); }
      };
      /** 주 정보를 12칸 격자로 놓는다. rows의 셋째 값이 칸 너비다(이름 + 값): w 한 줄(2 + 10) · h 절반(2 + 4) · t 1/3(2 + 2) · g 금(1 + 4) · r 쌀(1 + 6). 칸 모양은 style.css의 .sam-grid가 정한다 */
      const detail = d => {
        L.setDetail(d);
        const dl = L.detailEl && L.detailEl.querySelector ? L.detailEl.querySelector('dl.dh-rows') : null; if (!dl) return;
        dl.classList.add('sam-grid');
        d.rows.forEach((r, i) => { const k = 'sam-c-' + (r[2] || 'w'); if (dl.children[2 * i + 1]) { dl.children[2 * i].className = k; dl.children[2 * i + 1].className = k; } });
      };
      this.zoomIcons(); this.council.sync(this); this.council.paint(L);
      if (!sel) {
        if (this.mode === 'pick') detail({ title: '군주를 고른다', rows: [['시나리오', this.world.title || this.world.meta.scenario || '-'], ['주', g.provinces.size, 't'], ['장수', g.officers.size, 't'], ['군주', g.factions.size, 't']], note: '아래에서 군주를 고르면 시작한다. 지도의 주를 찍으면 그 땅의 사정이 보인다. 끌면 지도가 움직이고 지도 위 + · − 아이콘으로 크기를 바꾼다. 키보드로는 지도를 한 번 누른 뒤 방향키로 주를 고르고 숫자 키로 버튼을 누른다.' });
        else {
          const adv = g.advisorOf(me), gens = g.generalsOf(me), T = g.thrones;
          detail({ title: this.title(), rows: [['우리 주', own.map(p => p.name).join(' · ') || '없음'], ['동맹', g.alliesOf(me).map(a => `${g.fname(a.id)}(${a.months}달 남음)`).join(' · ') || '없음'],
            ['벼슬', `군사 ${adv ? adv.name : '없음'} · 장군 ${gens.length ? gens.map(o => o.name).join(' · ') : '없음'}(${gens.length}/${g.generalCap(me)})`],
            ['자리', g.rank === 2 ? '황제 · 폐하' : g.rank === 1 ? `왕 · 전하(주 ${T.emperor}곳이면 황제)` : `군주 · 주군(주 ${T.king}곳이면 왕)`]], note: this.note(null) });
        }
        return pick();
      }
      const inc = g.income(sel.id), off = g.officersOf(sel.id), gov = g.governor(sel.id), adv = g.advisorOf(sel.owner), auto = g.delegated(sel.id);
      const tag = o => (gov === o ? ' · 태수' : '') + (adv === o ? ' · 군사' : '') + (o.general ? ' · 장군' : '');
      const mineP = !!me && sel.owner === me && this.mode !== 'pick', free = mineP ? g.freeIn(sel.id).sort((a, b) => a.id - b.id) : [];
      detail({ title: `${sel.name} ${sel.hanja || ''}`, rows: [
        ['세력', g.fname(sel.owner) + crownOf(sel.owner) + (sel.owner && sel.owner === me ? ' · 우리 땅' : me && g.allied(me, sel.owner) ? ` · 동맹(${g.alliesOf(me).find(a => a.id === sel.owner).months}달 남음)` : g.vacant(sel) ? ' · 장수를 보내면 차지한다' : '')],
        ['인구', fmt(sel.pop), 'h'], ['병력', fmt(sel.troops), 'h'],
        ['금', sel.owner ? `${fmt(sel.gold)} (+${fmt(inc.gold)})` : fmt(sel.gold), 'g'], ['쌀', sel.owner ? `${fmt(sel.rice)} (+${fmt(inc.rice)} −${fmt(inc.upkeep)})` : fmt(sel.rice), 'r'],      // 괄호 안은 달마다 드나드는 양
        ['민심', sel.loyalty, 't'], ['농지', sel.farm, 't'], ...(sel.owner ? [['훈련', sel.drill, 't'], ['치수', sel.flood, 't'], ['상업', sel.trade, 't'], ['태수', gov ? gov.name : '없음', 't']] : []),
        ...(auto ? [['위임', `${gov.name} · ${auto === 'civil' ? '내정을 맡겼다' : '내정과 군사를 맡겼다'}`]] : []),
        ['장수', off.length ? off.map(o => `${o.name}(무${o.war} 지${o.int} 매${o.cha}${tag(o)})`).join(', ') : '없음'],
        ...(mineP ? [['재야', free.length ? free.map(o => `${o.name}(무${o.war} 지${o.int} 매${o.cha})`).join(', ') + ' · 수색하면 맞아들일 수 있다' : '없음']] : []),
        ['이웃', sel.adj.map(id => { const q = g.P(id); return `${q.name}(${g.fname(q.owner)} ${fmt(q.troops)})`; }).join(' · ')]], note: this.note(sel) });
      pick();
    }
    title() { return this.mode === 'over' ? this.overTitle() : this.mode === 'busy' ? '다른 군주들의 차례' : '주를 찍는다'; }
    note(sel) {
      const g = this.game, s = this.sub, p = this.mine;
      if (this.mode === 'pick') return '아래에서 군주를 고르면 시작한다.';
      if (this.mode === 'over') return (g.overWhy === 'all' ? `${g.months}달 만에 천하를 하나로 모았다(우리 주 ${g.provincesOf(g.player).length}개).` : g.overWhy === 'goal' ? `${g.months}달 만에 목표한 ${g.goal}개 주를 차지했다.` : g.overWhy === 'time' ? (g.goal >= g.provinces.size ? `${g.stage.months}달 안에 다른 세력을 모두 무너뜨리지 못했다.` : `${g.stage.months}달 안에 ${g.goal}개 주를 차지하지 못했다.`) : '주를 모두 잃었다.') + ' 다시 하려면 아래 버튼을 누른다.';
      if (this.hold) return '부대가 길을 가는 중이다. 화면을 누르거나 아무 키나 누르면 건너뛴다.';
      if (this.mode === 'busy') return '다른 군주들이 움직이는 중이다. 침공이 있으면 기록에 뜬다.';
      if (!sel) return '우리 주를 찍으면 명령을 내릴 수 있다. 다 내렸으면 턴 종료를 누른다.';
      if (!p) return g.vacant(sel) ? '공백지다. 이웃한 우리 주에서 장수를 이동시키면 차지한다.' : g.allied(g.player, sel.owner) ? '동맹의 땅이다. 동맹인 동안에는 서로 치지 않는다.' : '남의 땅이다. 우리 주를 찍으면 명령을 내릴 수 있다.';
      if (s) {
        const here = g.officersOf(p.id).length, going = s.type === 'move' ? (s.step === 'who' ? (s.picks || []).length : s.officer ? s.officer.length : 0) : 0;
        const last = s.type === 'move' ? going > 0 && going >= here : here === 1;            // 이동: 고른 장수가 그 주의 전부일 때 · 침공: 장수가 한 명일 때
        const empty = here === 1 ? ` 장수가 한 명이라, 그 장수가 떠나면 ${DH.Sam.josa(p.name, '은', '는')} 공백지가 된다(남은 병력은 흩어진다).` : ` 장수가 모두 떠나면 ${DH.Sam.josa(p.name, '은', '는')} 공백지가 된다(남은 병력은 흩어진다).`;
        if (s.type === 'ally') return s.step === 'f' ? `동맹을 청할 세력을 고른다. 금 ${g.rules.ally.gold}은 받아들이든 말든 나간다. 맺으면 ${g.rules.ally.months}달 동안 서로 치지 않는다.` : `${DH.Sam.josa(g.fname(s.f), '과', '와')} 맺은 동맹을 깨면 우리 주 모두의 민심이 ${g.rules.ally.breakLoyalty} 내린다.`;
        if (s.type === 'civil') return `내정 하나를 고른다. 농지는 수확을, 치수는 여름 큰물을 막는 힘을, 상업은 세금을 올린다(지력이 높을수록 많이 오른다). 시혜는 쌀을 풀어 민심을 얻는다(매력).`;
        if (s.type === 'office') {
          const R = g.rules, me = g.player;
          if (s.step === 'gov') return `${p.name}의 태수를 고른다. 태수의 매력은 세금을, 지력은 수확을, 무력은 성의 방어를 올린다. 장수가 둘 이상이면 태수는 성에 남고 싸움에는 나서지 않는다.`;
          if (s.step === 'adv') return `군사를 고른다(지력 ${R.advisor.int} 이상). 침공할 때 승산을 헤아려 주고, 동맹 확률과 화계 확률을 올린다. 세력에 한 명이다.`;
          if (s.step === 'gen') return `장군을 고른다(무력 ${R.general.war} 이상). 장군의 부대는 피해를 ${g.battleRules.general ?? 10}% 더 준다. 지금 ${g.generalsOf(me).length}/${g.generalCap(me)}명이고, 주 ${R.general.per}곳마다 한 명 더 둘 수 있다. 장군을 다시 고르면 물린다.`;
          if (s.step === 'del') return `${J(p.name, '을', '를')} 태수에게 맡긴다. 맡긴 주는 턴 종료를 누를 때 태수가 알아서 명령을 내린다. 그 전에 손수 명령을 내리면 그 달은 그대로 따른다. 군사까지 맡기면 태수가 침공도 하고 전투도 알아서 싸운다.`;
          return "벼슬은 '주마다 한 달에 명령 하나' 원칙에 해당하지 않는 군주의 행동이다. 태수와 위임은 이 주의 일이고, 군사와 장군은 세력 전체의 일이다.";
        }
        if (s.step === 'who') return '누가 옮겨 갈지 고른다. 여럿을 골라 함께 보낼 수 있다(다시 누르면 뺀다). 다 골랐으면 ‘고른 장수로’를 누른다. 물자 수송은 금과 쌀을 수레에 실어 이웃한 우리 주로 보낸다.' + (last || here === 1 ? empty : '');
        if (s.step === 'to') return s.type === 'move' ? (s.cart ? '수레를 어디로 보낼지 고른다. 지도에서 노란 테의 주를 찍어도 된다.' : '어디로 보낼지 고른다. 지도에서 노란 테의 주를 찍어도 된다.') + (s.officer != null && g.openLand(p.id).length ? ' 공백지로 가면 그 땅을 차지한다.' : '') + (last ? empty : '') : '어디를 칠지 고른다. 지도에서 붉은 테의 주를 찍어도 된다.';
        const how = ' − · +로 맞추거나 숫자 키로 바로 적는다(← → 100 · ↑ ↓ 1,000 · End 전부 · Enter).';
        if (s.cart) return `${g.P(s.to).name}에 실어 보낼 금과 쌀을 정한다. 금이나 쌀을 누르고` + how.replace('Enter', 'Space 금 ↔ 쌀 · Enter');
        if (s.type === 'move') return (s.officer ? `${s.officer.map(id => g.officers.get(id).name).join(' · ')}: ` : '') + `${g.P(s.to).name}에 딸려 보낼 병력을 정한다.` + how + (last ? empty : '');
        const q = this.qty(), min = g.rules.attackMin;
        if (!s.fore || s.fore.n !== q.val) s.fore = { n: q.val, f: q.val >= min ? g.forecast(p.id, s.to, q.val) : null };      // 군사가 있으면 그 병력으로 미리 헤아린다(수를 바꿀 때만 다시 센다)
        const F = s.fore.f, fore = F ? `군사 ${F.advisor.name}: “${g.title}, ${J(fmt(q.val), '을', '를')} 보내면 ${F.win ? `이길 듯합니다(${F.days}일 · 약 ${fmt(F.left)} 남음)` : '이기기 어렵습니다'}.” ` : '';
        const f = g.fighters(p.id); return fore + `${g.P(s.to).name}에 보낼 병력을 정한다(${fmt(min)}부터).` + how + ' ' + (f.length ? `${f.map(o => o.name).join(' · ')}${f.length > 1 ? ' 부대로 나뉘어' : josaGa(f[0].name)} 나선다.` : `장수가 없어 원정대(무력 ${g.rules.baseStat})가 나선다.`) + (last ? ` 이기면 장수가 옮겨 가 ${DH.Sam.josa(p.name, '은', '는')} 공백지가 된다(남은 병력은 흩어진다).` : '');
      }
      if (p.acted) return "이번 달 명령을 이미 내렸다. 다른 주를 고르거나 턴 종료를 누른다. 벼슬은 '주마다 한 달에 명령 하나' 원칙에 해당하지 않아 지금도 내릴 수 있다.";
      if (g.delegated(p.id)) return `태수 ${g.governor(p.id).name}에게 맡긴 주다. 그대로 두면 턴 종료 때 태수가 움직이고, 지금 손수 명령을 내려도 된다.`;
      const no = [['develop', '농지 개발'], ['draft', '징병'], ['drill', '훈련'], ['move', '이동'], ['attack', '침공'], ['relief', '시혜'], ['ally', '동맹']].map(([k, n]) => [n, g.can(p.id, k)]).filter(([, r]) => !r.ok).map(([n, r]) => `${n}: ${r.why}`);
      return '명령 하나를 고른다. 주마다 한 달에 한 번이다.' + (no.length ? ' 지금 못 하는 것 — ' + no.join(' · ') : '');
    }
    menu() {
      const g = this.game, p = this.mine, s = this.sub, cancel = { id: 'cancel', label: '그만두기' };
      if (this.mode === 'pick') return [...[...g.factions.values()].map(f => ({ id: 'f:' + f.id, label: `${f.name}${g.factions.size >= 10 ? '\n' : ' · '}주 ${g.provincesOf(f.id).length}` }))];      // 군주가 많으면 세 줄로 놓으니 이름과 주 수를 두 줄로 적는다
      if (this.mode === 'over') return [{ id: 'again', label: '다시 하기', primary: true }];
      if (p && s && s.type === 'ally') {
        const A = g.rules.ally, me = g.player;
        if (s.step === 'break') return [{ id: 'abok', label: `정말 깬다 · 우리 주 민심 −${A.breakLoyalty}` }, { ...cancel, primary: true }];
        return [...g.borderFactions(p.id).filter(f => !g.allied(me, f)).map(f => ({ id: 'af:' + f, label: `${g.fname(f)}에 청한다 · 금 ${A.gold} · ${Math.round(g.allyChance(p.id, f) * 100)}%`, disabled: p.gold < A.gold, hint: p.gold < A.gold ? `금 ${A.gold}이 있어야 한다` : '' })),
          ...g.alliesOf(me).map(a => ({ id: 'ab:' + a.id, label: `${g.fname(a.id)} 동맹 깨기 · ${a.months}달 남음` })), cancel];
      }
      if (p && s && s.type === 'civil') {
        const R = g.rules, it = (id, label) => { const r = g.can(p.id, id); return { id, label, disabled: !r.ok, hint: r.ok ? '' : r.why }; };
        return [it('develop', `농지 개발 · 금 ${R.develop.gold} · 지금 ${p.farm}`), it('flood', `치수 · 금 ${R.flood.gold} · 지금 ${p.flood}`), it('trade', `상업 · 금 ${R.trade.gold} · 지금 ${p.trade}`), it('relief', `시혜 · 쌀 ${fmt(R.relief.rice)} · 민심 ${p.loyalty}`), cancel];
      }
      if (p && s && s.type === 'office') {
        const R = g.rules, me = g.player, gov = g.governor(p.id), adv = g.advisorOf(me), auto = g.delegated(p.id), back = { id: 'back', label: '돌아가기' };
        const all = [...g.officers.values()].filter(o => o.status === 'active' && o.faction === me), at = o => g.P(o.province).name;
        if (s.step === 'gov') return [...g.officersOf(p.id).sort((a, b) => b.cha + b.int - a.cha - a.int || a.id - b.id).slice(0, 7).map(o => ({ id: 'og:' + o.id, label: `${o.name} 매${o.cha} 지${o.int} 무${o.war}`, primary: gov === o })), ...(gov ? [{ id: 'og:none', label: '태수 물리기' }] : []), back];
        if (s.step === 'adv') return [...all.filter(o => o.int >= R.advisor.int).sort((a, b) => b.int - a.int || a.id - b.id).slice(0, 7).map(o => ({ id: 'oa:' + o.id, label: `${o.name} 지${o.int} · ${at(o)}`, primary: adv === o })), ...(adv ? [{ id: 'oa:none', label: '군사 물리기' }] : []), back];
        if (s.step === 'gen') { const full = g.generalsOf(me).length >= g.generalCap(me); return [...all.filter(o => o.war >= R.general.war || o.general).sort((a, b) => b.war - a.war || a.id - b.id).slice(0, 7).map(o => ({ id: 'on:' + o.id, label: `${o.name} 무${o.war} · ${at(o)}${o.general ? ' · 장군' : ''}`, primary: !!o.general, disabled: !o.general && full, hint: !o.general && full ? '장군 자리가 찼다' : '' })), back]; }
        if (s.step === 'del') return [{ id: 'od:civil', label: '내정만 맡긴다', primary: auto === 'civil' }, { id: 'od:war', label: '내정과 군사를 맡긴다', primary: auto === 'war' }, ...(p.auto ? [{ id: 'od:none', label: '위임을 거둔다' }] : []), back];
        const n = g.generalsOf(me).length, here = g.officers.get(g.factions.get(me).leader).province === p.id;
        return [{ id: 'ogov', label: `태수 · ${gov ? gov.name : '없음'}`, disabled: !g.officersOf(p.id).length }, { id: 'oadv', label: `군사 · ${adv ? adv.name : '없음'}`, disabled: !adv && !all.some(o => o.int >= R.advisor.int), hint: `지력 ${R.advisor.int} 이상` },
          { id: 'ogen', label: `장군 · ${n}/${g.generalCap(me)}`, disabled: !n && !all.some(o => o.war >= R.general.war), hint: `무력 ${R.general.war} 이상` },
          { id: 'odel', label: `위임 · ${auto === 'civil' ? '내정' : auto === 'war' ? '내정과 군사' : '없음'}`, disabled: !gov || here, hint: !gov ? '태수를 먼저 임명한다' : here ? '군주가 머무는 주는 맡기지 않는다' : '' }, cancel];
      }
      if (p && s) {
        if (s.step === 'who') { const tr = g.can(p.id, 'transport'), picks = s.picks || [], n = g.officersOf(p.id).filter(o => picks.includes(o.id)).length;
          return [...g.officersOf(p.id).map(o => ({ id: 'who:' + o.id, label: `${picks.includes(o.id) ? '✓ ' : ''}${o.name} 무${o.war}` })), { id: 'who:ok', label: n ? `고른 장수로 ${n}명` : '고른 장수로', primary: n > 0, disabled: !n, hint: n ? '고른 장수를 함께 보낸다' : '보낼 장수를 먼저 고른다' }, { id: 'who:none', label: '병력만', disabled: p.troops <= 0 || !g.friends(p.id).length }, { id: 'who:cart', label: '물자 수송', disabled: !tr.ok, hint: tr.ok ? '금과 쌀을 이웃한 우리 주로 보낸다' : tr.why }, cancel]; }
        if (s.step === 'to') return [...this.candidates().map(q => ({ id: 'to:' + q.id, primary: s.aim === q.id, label: s.type === 'move' ? (g.vacant(q) ? `${q.name} · 공백지` : `${q.name} ${fmt(q.troops)}`) : `${q.name} · ${g.fname(q.owner)} ${fmt(q.troops)}` })), cancel];
        // 얼마나: 수로 정한다. − · + 넷(1,000 · 100) · 바로 가기 셋 · 보내기. 이 단계의 버튼에는 번호를 붙이지 않는다(숫자 키는 수를 적는 데 쓴다)
        const q = this.qty(), min = g.rules.attackMin, k = { key: false }, stop = { ...cancel, ...k };
        const steps = [-1000, -100, 100, 1000].map(d => ({ id: 'q:' + d, ...k, label: (d < 0 ? '−' : '+') + fmt(Math.abs(d)), disabled: d < 0 ? q.val <= 0 : q.val >= q.max }));
        const quick = [s.type === 'attack' ? { id: 'qs:min', ...k, label: `최소 ${fmt(min)}` } : { id: 'qs:0', ...k, label: '0' }, { id: 'qs:half', ...k, label: '절반', disabled: q.max <= 0 }, { id: 'qs:all', ...k, label: '전부', disabled: q.max <= 0 }];
        if (s.cart) {
          const G = Math.min(p.gold, s.gold || 0), R = Math.min(p.rice, s.rice || 0), what = [G ? '금 ' + fmt(G) : '', R ? '쌀 ' + fmt(R) : ''].filter(Boolean).join(' · ');
          return [{ id: 'qf:gold', ...k, label: `금 ${fmt(G)} / ${fmt(p.gold)}`, hint: '금을 맞춘다' }, { id: 'qf:rice', ...k, label: `쌀 ${fmt(R)} / ${fmt(p.rice)}`, hint: '쌀을 맞춘다' }, ...steps, ...quick,
            { id: 'qok', ...k, label: what ? `보낸다 · ${what}` : '보낼 양을 정한다', primary: true, disabled: !what }, stop];
        }
        if (s.type === 'move') return [...steps, ...quick, { id: 'qok', ...k, label: q.val ? `보낸다 · 병력 ${fmt(q.val)}` : s.officer !== null ? '병력 없이 보낸다' : '보낼 병력을 정한다', primary: true, disabled: !q.val && s.officer === null }, stop];
        return [...steps, ...quick, { id: 'qok', ...k, label: `친다 · 병력 ${fmt(q.val)}`, primary: true, disabled: q.val < min, hint: q.val < min ? `병력 ${fmt(min)}부터 보낼 수 있다` : '' }, stop];
      }
      const R = g.rules, busy = this.mode === 'busy' || !!this.hold, why = this.hold ? '부대가 길을 가는 중이다' : busy ? '다른 군주들의 차례다' : '우리 주를 먼저 찍는다';
      const can = id => p && !busy ? g.can(p.id, id) : { ok: false, why }, cmd = (id, label) => { const r = can(id); return { id, label, disabled: !r.ok, hint: r.ok ? '' : r.why }; };
      const civ = CIVIL.map(can), mv = [can('move'), can('transport')];
      const fr = p ? g.freeIn(p.id).sort((a, b) => a.id - b.id) : [], sr = can('search');     // 수색 버튼에 재야 장수가 있는지 적는다(허탕을 치지 않게)
      const find = { id: 'search', label: !p ? '수색' : fr.length ? `수색 · 재야 ${fr.length}명` : '수색 · 재야 없음', disabled: !sr.ok, hint: !sr.ok ? sr.why : fr.length ? `재야: ${fr.map(o => o.name).join(' · ')}` : '재야 장수가 없다. 가끔 금을 줍는다' };
      return [{ id: 'civil', label: '내정', disabled: !civ.some(r => r.ok), hint: civ.some(r => r.ok) ? '농지 개발 · 치수 · 상업 · 시혜' : civ[0].why },
        cmd('draft', `징병 +${fmt(R.draft.troops)} · 금 ${R.draft.gold}`), cmd('drill', `훈련 · 금 ${R.drill.gold}`),
        { id: 'move', label: '이동', disabled: !mv.some(r => r.ok), hint: mv.some(r => r.ok) ? '장수 · 병력 · 물자를 옮긴다' : mv[0].why }, cmd('attack', '침공'), find, cmd('ally', '동맹'),
        { id: 'office', label: '벼슬', disabled: !p || busy || !!g.over, hint: p && !busy ? "태수 · 군사 · 장군 · 위임('주마다 한 달에 명령 하나' 원칙에 해당하지 않는 군주의 행동)" : why },
        { id: 'end', label: '턴 종료', primary: true, disabled: busy, hint: '다른 군주들이 움직이고 달이 넘어간다' }];
    }

    render(g) { super.render(g); if (this.mode === 'over') this.drawCard(g); else if (this.crown) this.drawCrown(g); this.zoomIcons(); }
    drawOver(g) {
      const gm = this.game, z = this.cam.zoom, sel = this.selected, t = this.engine.tick, me = gm.player, near = sel ? new Set(gm.P(sel).adj) : new Set(), A = DH.Sam.Art;
      const cand = new Set(this.candidates().map(q => q.id)), candCol = this.sub && this.sub.type === 'attack' ? RED : ACCENT;
      // 산 · 숲 · 물결
      const land = A.landPal(this.season);
      for (const d of this.decor) A.draw(g, d.name, d.x, d.y, d.cell, land);
      // 이웃 길: 흙길 빛 띠 위에 밝은 가운데 줄. 고른 주에서 나가는 길은 짙게
      g.lineCap = 'round';
      const road = (hot, w, col) => { g.beginPath(); for (const p of gm.provinces.values()) for (const b of p.adj) { if (b < p.id || (sel !== null && (p.id === sel || b === sel)) !== hot) continue; const P = this.pos.get(p.id), B = this.pos.get(b); g.moveTo(P.x, P.y); g.lineTo(B.x, B.y); } g.strokeStyle = col; g.lineWidth = w; g.stroke(); };
      road(false, 2.3, 'rgba(120,96,62,.5)'); road(false, 0.8, 'rgba(250,240,214,.85)');
      road(true, 3, INK); road(true, 1.1, ACCENT);
      // 방금 있었던 침공
      if (this.flash) { const P = this.pos.get(this.flash.from), B = this.pos.get(this.flash.to), a = Math.max(0, 1 - (t - this.flash.t0) / 60); g.beginPath(); g.moveTo(P.x, P.y); g.lineTo(B.x, B.y); g.strokeStyle = `rgba(192,50,31,${a.toFixed(3)})`; g.lineWidth = 3.2; g.stroke(); }
      // 주: 세력 색 성. 군주가 있는 곳은 깃발 단 큰 성, 주인 없는 공백지는 잿빛 성터
      const caps = new Set([...gm.factions.values()].filter(f => f.alive).map(f => gm.officers.get(f.leader)).filter(o => o && o.status === 'active').map(o => o.province));
      for (const p of gm.provinces.values()) {
        const P = this.pos.get(p.id), kind = !p.owner ? 'ruin' : caps.has(p.id) ? 'capital' : 'town', top = kind === 'capital' ? 8.5 : kind === 'town' ? 5.5 : 2;
        if (cand.has(p.id)) { g.beginPath(); g.arc(P.x, P.y, 9.6 + 0.7 * Math.sin(t / 7), 0, Math.PI * 2); g.strokeStyle = candCol; g.lineWidth = 1.8; g.stroke(); }
        if (cand.has(p.id) && this.sub.aim === p.id) { g.beginPath(); g.arc(P.x, P.y, 12.8, 0, Math.PI * 2); g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke(); }      // 방향키로 겨눈 대상
        if (p.id === sel || near.has(p.id)) {                                               // 고른 주는 노란 받침, 이웃한 주는 흰 받침
          g.beginPath(); g.roundRect(P.x - 8, P.y - top - 1.5, 16, top + 7, 3);
          g.fillStyle = p.id === sel ? 'rgba(242,183,5,.5)' : 'rgba(255,255,255,.55)'; g.fill(); g.lineWidth = p.id === sel ? 1.8 : 1; g.strokeStyle = p.id === sel ? ACCENT : '#fff'; g.stroke();
        }
        A.draw(g, kind, P.x, P.y + 4.5, 1, A.castlePal(p.owner ? this.colorOf(p) : null));
        if (me && p.owner === me && !p.acted && this.mode === 'play') { g.beginPath(); g.arc(P.x + 7, P.y - top + 1, 1.9, 0, Math.PI * 2); g.fillStyle = gm.delegated(p.id) ? '#7fb3d9' : '#fff'; g.fill(); g.lineWidth = 0.8; g.strokeStyle = INK; g.stroke(); }      // 아직 명령을 내리지 않은 우리 주(태수에게 맡긴 주는 하늘빛)
        if (me && p.owner === me && this.mode !== 'pick' && gm.freeIn(p.id).length) { const x = P.x - 7, y = P.y - top + 1, r = 2.7; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.fillStyle = ACCENT; g.fill(); g.lineWidth = 0.8; g.strokeStyle = INK; g.stroke(); }      // 재야 장수가 있는 우리 주(노란 마름모)
        if (me && gm.allied(me, p.owner)) { g.beginPath(); g.arc(P.x - 7, P.y - top + 1, 1.9, 0, Math.PI * 2); g.fillStyle = '#2e9e5b'; g.fill(); g.lineWidth = 0.8; g.strokeStyle = '#fff'; g.stroke(); }                  // 동맹의 주
      }
      // 길을 가는 부대와 수레: 지나온 길에 점선을 남기고, 걸음에 맞춰 조금씩 들썩인다
      for (const m of this.marches) {
        const q = this.marchAt(m, t), bob = Math.abs(Math.sin(t / 3.2)) * 0.7;
        g.beginPath(); g.moveTo(m.pts[0].x, m.pts[0].y); for (let i = 1; i < m.pts.length; i++) g.lineTo(m.pts[i].x, m.pts[i].y);
        g.setLineDash([2.2, 2.2]); g.lineWidth = 1.3; g.strokeStyle = m.kind === 'cart' ? 'rgba(122,92,58,.8)' : 'rgba(192,50,31,.75)'; g.stroke(); g.setLineDash([]);
        g.beginPath(); g.ellipse(q.x, q.y + 1.2, 4.6, 1.4, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(38,33,28,.28)'; g.fill();
        if (m.kind === 'cart') A.draw(g, 'cart', q.x, q.y + 1.6 - bob * 0.5, 0.8, A.CART, { flip: q.left });
        else A.draw(g, m.kind, q.x, q.y + 1.6 - bob, 0.7, A.unitPal(m.color), { flip: q.left });
      }
      // 이름(크게 보면 병력도): 화면에서 늘 같은 크기로 보이게 배율로 나눈다
      const fs = 9 / z; g.textAlign = 'center'; g.textBaseline = 'top'; g.lineJoin = 'round';
      for (const p of gm.provinces.values()) {
        const P = this.pos.get(p.id);
        g.font = `700 ${fs}px ${FONT}`; g.lineWidth = 2.4 / z; g.strokeStyle = 'rgba(251,247,239,.92)'; g.strokeText(p.name, P.x, P.y + 6);
        g.fillStyle = INK; g.fillText(p.name, P.x, P.y + 6);
        if (z >= 1.5) { const s = p.owner || p.troops ? fmt(p.troops) : '공백지'; g.font = `600 ${7.5 / z}px ${FONT}`; g.strokeText(s, P.x, P.y + 6 + fs * 1.05); g.fillStyle = '#5a4f43'; g.fillText(s, P.x, P.y + 6 + fs * 1.05); }
      }
    }
    /** 끝 화면 카드의 자리(판 좌표). 꽃비가 이 자리를 비켜 간다 */
    cardRect() { const w = 300, h = 96; return { x: (this.engine.width - w) / 2, y: (this.engine.height - h) / 2, w, h }; }
    drawCard(g) {
      const W = this.engine.width, H = this.engine.height, won = this.game.over === 'won', { x, y, w, h } = this.cardRect();
      g.fillStyle = 'rgba(38,33,28,.4)'; g.fillRect(0, 0, W, H);
      g.beginPath(); g.roundRect(x, y, w, h, 10); g.fillStyle = '#fbf7ef'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
      g.fillStyle = won ? ACCENT : '#8d8477'; g.fillRect(x + 1, y + 1, w - 2, 6);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK; g.font = `800 20px ${FONT}`; g.fillText(this.overTitle(), W / 2, y + 40);
      g.font = `500 12px ${FONT}`; g.fillStyle = '#6e6356'; g.fillText(`${this.engine.clock.label} · ‘다시 하기’를 누르면 ${this.state.start.player ? '같은 군주로 새 판을 연다' : '군주를 다시 고른다'}`, W / 2, y + 68);      // 설정으로 군주를 정했으면 고르는 화면을 거치지 않는다
    }
    /** 즉위 카드: 왕 · 황제에 오른 것을 잠깐 알린다. 누르면 닫힌다. */
    drawCrown(g) {
      const W = this.engine.width, gm = this.game, r = this.crown.rank, w = 300, h = 92, x = (W - w) / 2, y = 26, q = Math.min(1, (this.engine.tick - this.crown.t0) / 12);
      g.save(); g.globalAlpha = q; g.translate(0, (1 - q) * -10);
      g.beginPath(); g.roundRect(x, y, w, h, 10); g.fillStyle = '#fbf7ef'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
      g.fillStyle = r === 2 ? ACCENT : RED; g.fillRect(x + 1, y + 1, w - 2, 6);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK; g.font = `800 20px ${FONT}`;
      g.fillText(`${gm.fname(gm.player)}, ${r === 2 ? '황제에 오르다' : '왕위에 오르다'}`, W / 2, y + 38);
      g.font = `500 12px ${FONT}`; g.fillStyle = '#6e6356'; g.fillText(`두 낭자가 이제부터 ‘${DH.Sam.TITLES[r]}’라 부른다`, W / 2, y + 66);
      g.restore();
    }
    // ───────── 저장과 불러오기 ─────────
    save() { return { selected: this.selected, mode: this.mode, cam: { x: this.cam.x, y: this.cam.y, zoom: this.cam.zoom }, council: this.council.toJSON() }; }
    /** 지금 저장할 수 있는지. 우리 차례의 지도에서만 된다. {ok:true} 또는 {ok:false, why} */
    saveInfo() {
      if (this.engine.scene !== this) return NO('전투가 끝난 뒤에 저장할 수 있다.');
      if (this.mode === 'pick') return NO('군주를 고른 뒤에 저장할 수 있다.');
      if (this.mode === 'busy') return NO('다른 군주들의 차례가 끝난 뒤에 저장할 수 있다.');
      if (this.hold) return NO('부대가 닿은 뒤에 저장할 수 있다.');
      return { ok: true };
    }
    /** 저장 묶음: 머리말 · 한 줄 요약 · 적용된 설정 목록 · 달력 · 난수 · 판. JSON으로 그대로 적을 수 있다. */
    saveGame() {
      const g = this.game, own = g.provincesOf(g.player);
      return { format: SAVE.format, version: SAVE.version, summary: { title: g.fname(g.player), date: this.engine.clock.label, line: `주 ${own.length} · 병력 ${fmt(own.reduce((n, p) => n + p.troops, 0))}` },
        settings: this.settings.map(x => [...x]), ...this.engine.snapshot(), game: g.toJSON() };
    }
    /** 저장 묶음으로 판을 되살린다. 하나라도 맞지 않으면 하던 판을 그대로 둔다. 전투 중이었으면 전투를 접는다.
     *  @returns {{ok:true, text, applied:string[]} | {ok:false, why}} */
    loadGame(d) {
      const e = this.engine; let st, game, rep, w;
      try {
        DH.Save.head(d, SAVE.format, SAVE.version, SAVE.name);
        w = this.worlds[DH.Sam.scenarioOf(d.settings)];                                        // 저장된 설정의 31번이 판 배치를 정한다(v1.00까지의 저장 파일은 기본 배치)
        DH.Save.need(w, '저장된 시나리오가 이 자료에 없다.');
        st = DH.Sam.newState(); rep = DH.Sam.lang.applySettings(d.settings, st, { world: w, worlds: this.worlds });
        DH.Save.need(rep.ok, '저장된 설정이 맞지 않는다. ' + rep.errors.join(' '));
        e.checkSnapshot(d);
        game = DH.Sam.Game.restore(w, d.game, { rng: e.rng, state: st });
        DH.Save.need(d.clock.actors.length === 1 && d.clock.actors[0] === game.player, '날짜 정보가 맞지 않는다.');
      } catch (err) { return NO(err.message); }
      while (e.scene && e.scene !== this) e.popScene();
      this.setWorld(w); this.state = st; this.settings = d.settings.map(x => [...x]); this.game = game; e.restore(d);
      this.mode = game.over ? 'over' : 'play'; this.sub = null; this.flash = null; this.pause = 0; this.marches = []; this.crown = null; game.crowned = 0; this.syncSeason();
      const v = d.scene || {}, c = v.cam, num = x => typeof x === 'number' && isFinite(x);
      this.selected = w.provinces.has(v.selected) ? v.selected : null;
      if (c && num(c.x) && num(c.y) && num(c.zoom)) { this.cam.zoom = Math.min(this.cam.maxZoom, Math.max(this.cam.minZoom, c.zoom)); this.cam.x = c.x; this.cam.y = c.y; this.cam.clampTo(this.grid); }
      this.council.restore(v.council); this.council.poke();                                   // 낭자의 주머니도 이어 간다(없으면 하던 대로)
      const text = `저장한 판을 불러왔다 · ${game.fname(game.player)} · ${e.clock.label}`;
      this.layout.log(text); this.announce(true);
      if (d.game.pacts === undefined && [...game.provinces.values()].some(p => p.owner && !game.officersOf(p.id).length)) this.layout.log('v0.05까지의 저장 파일이다. 장수가 없는 주는 달이 바뀔 때 공백지가 된다. 그 전에 장수를 보내 두면 지킬 수 있다');
      this.refresh();
      return { ok: true, text, applied: rep.applied };
    }
  }
  const josaGa = w => DH.Sam.josa(w, '이', '가').slice(w.length);

  /** 자료를 읽어 동현삼을 띄운다. host: 화면을 지을 자리. opt.player를 주면 군주 고르기를 건너뛴다. opt.script는 동현랭 설정이다. */
  async function boot(host, src, opt = {}) {
    const worlds = DH.Sam.worlds(await DH.Data.load(src)), world = worlds[0];                // 기본 배치와 시나리오들. 동현랭 설정 31번이 고른다
    const W = 480, H = 360;
    const layout = new DH.Layout(host, { title: '동현삼', width: W, height: H, hotkeys: true });      // 조작 버튼에 번호가 붙는다(숫자 키)
    const engine = new DH.Engine({ canvas: layout.canvas, width: W, height: H, seed: opt.seed ?? 1, background: MAP.deep, clock: { unit: 'month', start: world.meta.start } });
    const scene = new SamMapScene(engine, world, layout, worlds); engine.setScene(scene);
    if (opt.script) scene.applyDonghyunLang(opt.script);                      // 동현랭 설정을 주면 그 값으로 연다
    if (opt.player) scene.start(opt.player);
    if (opt.autostart !== false) engine.start();
    return { engine, layout, scene, worlds, get world() { return scene.world; }, get game() { return scene.game; }, lang: DH.Sam.lang, examples: DH.Sam.examples(worlds), convention: DH.Sam.lang.describe(DH.Sam.newState()),
      readLang: text => DH.Sam.readLang(text, worlds),                          // 판을 건드리지 않고 읽어만 본다(편집기의 미리 읽기)
      get state() { return scene.state; }, applyDonghyunLang: text => scene.applyDonghyunLang(text),
      previewDonghyunLang: text => scene.applyDonghyunLang(text, true),         // 출전 전: 그 설정의 배치만 지도에 편다
      save: SAVE };
  }

  DH.Sam = Object.assign(DH.Sam || {}, { SamMapScene, boot, SAVE });
})(typeof globalThis !== 'undefined' ? globalThis : this);
