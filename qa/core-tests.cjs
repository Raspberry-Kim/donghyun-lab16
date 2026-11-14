// 동현삼 핵심 시험(공통 엔진 · 자료 · 규칙 · 동현랭). 브라우저 없이 node로 돈다: node qa/core-tests.cjs
const assert = require('assert'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
for (const f of ['src/engine/dh-core.js', 'src/engine/dh-loop.js', 'src/engine/dh-clock.js', 'src/engine/dh-grid.js', 'src/engine/dh-tilemap.js', 'src/engine/dh-layout.js', 'src/engine/dh-engine.js', 'src/engine/dh-lang.js', 'src/sam/sam-parser.js', 'src/sam/sam-rules.js', 'src/sam/sam-battle.js', 'src/sam/sam-lang.js', 'src/sam/sam-art.js', 'src/sam/sam-battle-scene.js', 'src/sam/sam-scene.js']) require(path.join(root, f));
const DH = globalThis.DH;
const samJ = () => JSON.parse(fs.readFileSync(path.join(root, 'src/sam/donghyun_sam_data.json'), 'utf8'));
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('ok ' + name); };
const bad = (fn, re) => assert.throws(fn, e => e instanceof DH.DataError && re.test(e.message), '잡아야 할 오류를 놓쳤다 ' + re);

ok('난수: 같은 시드 같은 수 · 상태를 되돌리면 이어서 같다', () => {
  const a = new DH.RNG(7), b = new DH.RNG(7); for (let i = 0; i < 50; i++) assert.strictEqual(a.next(), b.next());
  const st = a.state, x = a.next(); a.state = st; assert.strictEqual(a.next(), x); assert.notStrictEqual(new DH.RNG(8).next(), new DH.RNG(7).next());
});
ok('루프: step(n)은 틱 n번 · 그리기 한 번', () => {
  let u = 0, r = 0; const l = new DH.Loop({ update: () => u++, render: () => r++ }); l.step(60); assert.deepStrictEqual([u, r, l.tick], [60, 1, 60]);
});
ok('루프: 밀린 시간은 한 프레임에 5틱까지만 따라잡는다', () => {
  let u = 0, cb; globalThis.requestAnimationFrame = f => { cb = f; return 1; }; globalThis.cancelAnimationFrame = () => {};
  const l = new DH.Loop({ update: () => u++, render: () => {} }); l.start(); cb(1000); cb(1000 + 1000 / 60 * 3 + 1); assert.strictEqual(u, 3); cb(9000); assert.strictEqual(u, 8); cb(9000 + 17); assert.strictEqual(u, 9); l.stop();
});
ok('달력(턴): 차례 셋이 돌면 한 달 · 12월 다음은 새해', () => {
  const ev = []; const c = new DH.Clock({ unit: 'month', start: { year: 200, month: 11 }, actors: ['a', 'b', 'c'] }); c.bus.on('clock:turn', e => ev.push('t' + e.turn)); c.bus.on('clock:year', e => ev.push('y' + e.year));
  assert.strictEqual(c.endPhase(), 'b'); assert.strictEqual(c.endPhase(), 'c'); assert.strictEqual(c.label, '200년 11월'); assert.strictEqual(c.endPhase(), 'a'); assert.strictEqual(c.label, '200년 12월');
  for (let i = 0; i < 3; i++) c.endPhase(); assert.strictEqual(c.label, '201년 1월'); assert.deepStrictEqual(ev, ['t2', 'y201', 't3']);
  c.update(); assert.strictEqual(c.serial, 2, '턴제는 저절로 흐르지 않는다');
});
ok('달력(일): 20틱에 하루 · 멈추면 안 간다 · 배속 · 달 길이와 윤년', () => {
  const c = new DH.Clock({ unit: 'day', start: { year: 1522, month: 5, day: 30 }, ticksPerUnit: 20 }); for (let i = 0; i < 100; i++) c.update(); assert.strictEqual(c.label, '1522년 5월 30일');
  c.running = true; for (let i = 0; i < 20; i++) c.update(); assert.strictEqual(c.label, '1522년 5월 31일'); for (let i = 0; i < 20; i++) c.update(); assert.strictEqual(c.label, '1522년 6월 1일');
  c.speed = 4; for (let i = 0; i < 20; i++) c.update(); assert.strictEqual(c.label, '1522년 6월 5일');
  assert.strictEqual(DH.Clock.daysIn(1524, 2), 29); assert.strictEqual(DH.Clock.daysIn(1522, 2), 28);
  const s = JSON.parse(JSON.stringify(c)), d = new DH.Clock({ unit: 'day', ticksPerUnit: 20 }); d.load(s); assert.strictEqual(d.label, c.label);
});
ok('사각 격자: 칸↔픽셀 · 이웃 4·8 · 동서 이어짐 · 거리', () => {
  const g = new DH.SquareGrid(10, 6, 8), w = new DH.SquareGrid(10, 6, 8, { wrapX: true, diagonal: true });
  assert.deepStrictEqual(g.fromPixel(...Object.values(g.center(3, 4))), { c: 3, r: 4 }); assert.strictEqual(g.fromPixel(-1, 0), null); assert.strictEqual(g.neighbors(0, 0).length, 2);
  assert.strictEqual(w.neighbors(0, 0).length, 5); assert.ok(w.neighbors(0, 0).some(([c, r]) => c === 9 && r === 1)); assert.strictEqual(w.distance(0, 0, 9, 0), 1); assert.strictEqual(g.distance(0, 0, 9, 0), 9);
  assert.deepStrictEqual(w.fromPixel(-4, 4), { c: 9, r: 0 }); assert.strictEqual(w.nearX(4, 84), 84);
});
ok('육각 격자: 모든 칸의 가운데 ↔ 칸 · 이웃 6 · 이웃끼리 거리 1 · 이웃 가운데 사이가 칸 폭', () => {
  const g = new DH.HexGrid(9, 8, 10);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 9; c++) { const p = g.center(c, r); assert.deepStrictEqual(g.fromPixel(p.x, p.y), { c, r }); assert.deepStrictEqual(g.fromPixel(p.x + 3, p.y - 3), { c, r }); }
  for (const [c, r] of [[4, 3], [4, 4]]) { const nb = g.neighbors(c, r); assert.strictEqual(nb.length, 6); const p = g.center(c, r);
    for (const [nc, nr] of nb) { assert.strictEqual(g.distance(c, r, nc, nr), 1); const q = g.center(nc, nr); assert.ok(Math.abs(Math.hypot(p.x - q.x, p.y - q.y) - g.w) < 1e-9); assert.ok(g.neighbors(nc, nr).some(([a, b]) => a === c && b === r)); } }
  assert.strictEqual(g.distance(0, 0, 8, 7), 12); assert.strictEqual(g.neighbors(0, 0).length, 2);
});
ok('길 찾기: 사각·육각 같은 함수 · 벽을 돌아간다 · 막히면 null · 동서 이어진 길이 짧으면 그쪽', () => {
  const g = new DH.SquareGrid(7, 5, 1), wall = (c, r) => !(c === 3 && r < 4);
  const p = DH.findPath(g, [0, 0], [6, 0], wall); assert.strictEqual(p.length, 14); assert.deepStrictEqual(p[p.length - 1], [6, 0]); assert.ok(p.every(([c, r]) => wall(c, r)));
  assert.strictEqual(DH.findPath(g, [0, 0], [6, 0], (c) => c !== 3), null);
  const w = new DH.SquareGrid(20, 3, 1, { wrapX: true, diagonal: true }); assert.strictEqual(DH.findPath(w, [1, 1], [18, 1], () => true).length, 3);
  const h = new DH.HexGrid(8, 8, 1); assert.strictEqual(DH.findPath(h, [0, 0], [7, 7], () => true).length, h.distance(0, 0, 7, 7));
});
ok('길 찾기: 대각으로 놓인 벽 사이를 빠져나가지 않는다 · 같은 칸 수면 덜 꺾이는 길', () => {
  const g = new DH.SquareGrid(6, 6, 1, { diagonal: true }), diag = (c, r) => c !== r;                 // (0,0)…(5,5)가 벽: 대각선 한 줄
  assert.strictEqual(DH.findPath(g, [3, 1], [1, 3], diag), null, '대각 벽을 넘었다');
  assert.strictEqual(g.squeezed(2, 1, 1, 2, diag), true); assert.strictEqual(g.squeezed(2, 1, 1, 2, (c, r) => !(c === 1 && r === 1)), false, '한쪽만 막혔으면 간다');
  const gap = (c, r) => c !== r || c === 5, pg = DH.findPath(g, [3, 1], [1, 3], gap).map(String); assert.ok(pg.length === 7 && pg.includes('5,4') && pg.includes('4,5'), '벽 끝이 열렸으면 그 모서리로 돈다 ' + pg.join(' '));
  const w = new DH.SquareGrid(10, 4, 1, { wrapX: true, diagonal: true }), seam = (c, r) => !((c === 0 && r === 1) || (c === 9 && r === 2));
  assert.strictEqual(w.squeezed(9, 1, 0, 2, seam), true, '동서 이음매에서도 같다');
  const o = new DH.SquareGrid(20, 9, 1, { diagonal: true }), p = DH.findPath(o, [0, 4], [16, 6], () => true); assert.strictEqual(p.length, 16);
  assert.ok(p.every(([, r]) => r >= 4 && r <= 6), '위아래로 헛돌지 않는다'); assert.strictEqual(p.filter(([c, r], i) => r !== (i ? p[i - 1][1] : 4)).length, 2, '대각 걸음은 꼭 필요한 두 번');
});
ok('타일 렌더러: 화면에 걸친 칸만 · 사각은 같은 타일을 줄마다 합쳐 그린다 · 육각은 칸마다', () => {
  const calls = { rect: 0, moveTo: 0, fill: 0 }; const g = new Proxy({}, { get: (t, k) => (k in calls ? () => calls[k]++ : () => {}), set: () => true });
  const sq = new DH.SquareGrid(100, 100, 4), cam = new DH.Camera(40, 40), R = new DH.TileMapRenderer({ grid: sq, tileAt: (c) => (c < 5 ? 'a' : 'b'), styles: { a: { fill: '#000' }, b: { fill: '#fff' } } });
  R.render(g, cam); assert.strictEqual(R.drawn, 121); assert.strictEqual(calls.rect, 22); assert.strictEqual(calls.fill, 2);
  const hx = new DH.HexGrid(50, 50, 5), H = new DH.TileMapRenderer({ grid: hx, tileAt: () => 'a', styles: { a: { fill: '#000' } } }); H.render(g, cam); assert.ok(H.drawn > 20 && H.drawn < 80 && calls.moveTo === H.drawn);
  cam.zoomAt(2, 20, 20); assert.deepStrictEqual([cam.zoom, cam.x, cam.y], [2, 10, 10]); cam.x = -50; cam.clampTo(sq); assert.strictEqual(cam.x, 0);
});
ok('엔진: 캔버스 없이 논리만 · 맨 위 장면만 틱 · 장면 쌓기·내리기 · 저장 묶음', () => {
  const log = []; class S extends DH.Scene { constructor(e, n) { super(e); this.n = n; } enter() { log.push('in' + this.n); } exit() { log.push('out' + this.n); } update() { log.push('u' + this.n); } save() { return { n: this.n }; } }
  const e = new DH.Engine({ seed: 3, clock: { unit: 'day', ticksPerUnit: 2, start: { year: 1522, month: 5, day: 1 } } }); e.clock.running = true; const days = []; e.on('clock:day', d => days.push(d.day));
  e.setScene(new S(e, 1)); e.step(4); e.pushScene(new S(e, 2)); e.step(1); e.popScene(); e.step(1);
  assert.deepStrictEqual(log, ['in1', 'u1', 'u1', 'u1', 'u1', 'in2', 'u2', 'out2', 'u1']); assert.deepStrictEqual(days, [2, 3, 4]);
  const s = e.snapshot(); assert.deepStrictEqual([s.tick, s.clock.day, s.scene.n, s.rng], [6, 4, 1, 3]);
});
ok('동현삼 자료: 주 41 · 인접 양방향 · 한 덩어리 · 간선 63 · 장수 71(재야 19) · 주인 있는 주마다 장수 · 병력·민심·농지', () => {
  const w = DH.Sam.parse(samJ()); assert.strictEqual(w.provinces.size, 41); assert.strictEqual(w.graph.oneWay().length, 0); assert.strictEqual(w.graph.components().length, 1);
  let deg = 0; for (const p of w.provinces.values()) deg += p.adj.length; assert.strictEqual(deg, 126); assert.strictEqual(w.officers.size, 71); assert.strictEqual([...w.officers.values()].filter(o => o.status === 'free').length, 19);
  for (const p of w.provinces.values()) if (p.owner) assert.ok([...w.officers.values()].some(o => o.province === p.id && o.status === 'active' && o.faction === p.owner), p.name + '에 장수가 없다');
  const xc = w.provinces.get(14); assert.deepStrictEqual([xc.troops, xc.loyalty, xc.farm], [8000, 70, 60]); assert.strictEqual(w.officers.get(203).province, 24);
  assert.deepStrictEqual(w.graph.path(1, 3), [1, 2, 3]); assert.strictEqual(w.graph.path(1, 41).length, 12);
  assert.deepStrictEqual(w.officersIn(12).map(o => o.name), ['유비', '장비']); assert.strictEqual(w.provincesOf('cao').length, 9); assert.strictEqual(w.map.at(...w.provinces.get(31).hex), 'land');
  assert.deepStrictEqual([w.provinces.get(41).owner, w.provinces.get(41).troops], [null, 0], '건녕은 공백지'); assert.strictEqual(w.officers.get(202).status, 'free');
});
ok('동현삼 파서: 틀린 자료 열 가지를 잡고, 틀린 곳을 모두 모은다', () => {
  const P = (f, re) => { const j = samJ(); f(j); bad(() => DH.Sam.parse(j), re); };
  P(j => { j.version = 2; }, /version/); P(j => { j.provinces.pop(); }, /길이 41/);
  P(j => { j.provinces[0].adj = [2, 3]; }, /1→3는 있는데 3→1/); P(j => { j.provinces[4].adj.push(99); }, /주 99가 없다/);
  P(j => { j.provinces[0].adj = [1]; }, /자기 자신/); P(j => { j.provinces[0].adj = []; j.provinces[1].adj = [3]; }, /이웃이 하나도 없다/);
  P(j => { j.provinces[2].hex = j.provinces[3].hex; }, /같은 칸/); P(j => { j.officers[0].war = 101; }, /정수 1~100/);
  P(j => { j.officers[1].province = 6; }, /땅이다/); P(j => { j.map.rle[0] = '3#'; }, /풀면 3칸/);
  const j = samJ(); j.officers[0].war = 0; j.officers[2].status = 'x'; j.factions[0].leader = 999; try { DH.Sam.parse(j); assert.fail(); } catch (e) { assert.strictEqual(e.problems.length, 3, '틀린 곳을 모두 모은다'); }
});
// ───────── 동현삼 규칙 ─────────
const S = DH.Sam, newGame = (o = {}) => new S.Game(S.parse(samJ()), { player: 'liubei', ...o });
ok('이동 범위: 지형 값만큼 깎인다 · 못 가는 칸 · 출발 칸 포함 · 온 길을 거슬러 갈 수 있다', () => {
  const g = new DH.HexGrid(10, 10, 1), cost = (c, r) => (c === 3 ? 3 : c === 5 ? 4 : c === 7 ? Infinity : 1), m = DH.moveRange(g, [1, 4], 5, cost);
  assert.strictEqual(m.get('1,4').cost, 0); assert.strictEqual(m.get('2,4').cost, 1); assert.strictEqual(m.get('3,4').cost, 4); assert.strictEqual(m.get('4,4').cost, 5); assert.ok(!m.has('5,4') && !m.has('7,4'));
  for (const v of m.values()) assert.ok(v.cost <= 5); let k = '4,4', n = 0; while (m.get(k).from) { k = m.get(k).from; n++; } assert.deepStrictEqual([k, n], ['1,4', 3]);
  assert.strictEqual(DH.moveRange(g, [1, 4], 0, cost).size, 1); assert.strictEqual(DH.moveRange(g, [4, 4], 3, () => 1).size, 37, '평지에서 3걸음 안은 37칸');
});
ok('내정: 농지 개발(금 100 → 농지 +3+지력÷20, 민심 +2) · 주마다 한 달에 한 번', () => {
  const g = newGame(), p = g.P(12); assert.deepStrictEqual([p.gold, p.farm, p.loyalty, p.acted], [550, 45, 65, false]);
  const r = g.develop(12); assert.ok(r.ok && /45 → 51/.test(r.text)); assert.deepStrictEqual([p.gold, p.farm, p.loyalty, p.acted], [450, 51, 67, true]);      // 유비 지력 75 → 3 + 3
  assert.deepStrictEqual(g.draft(12), { ok: false, why: '이번 달 명령을 이미 내렸다' }); assert.strictEqual(p.troops, 5000);
  const q = g.P(10); g.develop(10); assert.strictEqual(q.farm, 52, '정욱 지력 90 → 3 + 4'); const r9 = g.P(9); g.officers.get(315).province = 5; g.develop(9); assert.strictEqual(r9.farm, 50, '장수가 없으면 능력치 40 → 3 + 2');
  g.endMonth(); p.gold = 99; assert.ok(/금 100/.test(g.can(12, 'develop').why)); p.gold = 500; p.farm = 98; g.develop(12); assert.strictEqual(p.farm, 100); g.endMonth(); assert.ok(/더 넓힐 수 없다/.test(g.can(12, 'develop').why));
});
ok('내정: 징병(금 100 → 병력 +1000, 인구 −1000, 민심 −(12−매력÷10)) · 민심 30 아래면 못 한다', () => {
  const g = newGame(), p = g.P(13), r = g.draft(13); assert.ok(r.ok); assert.deepStrictEqual([p.gold, p.troops, p.pop, p.loyalty], [450, 6000, 259000, 62]);       // 관우 매력 90 → −3
  const q = g.P(10); g.draft(10); assert.strictEqual(q.loyalty, 59, '정욱 매력 65 → −6'); const r9 = g.P(9); g.officers.get(315).province = 5; g.draft(9); assert.strictEqual(r9.loyalty, 57, '장수 없는 주는 −8');
  g.endMonth(); p.loyalty = 29; assert.ok(/민심이 30 아래/.test(g.can(13, 'draft').why)); p.loyalty = 30; p.gold = 99; assert.ok(/금 100/.test(g.can(13, 'draft').why)); p.gold = 100; assert.ok(g.draft(13).ok); assert.strictEqual(p.gold, 0);
});
ok('내정: 이동(이웃한 우리 주로만 · 장수와 병력) · 수색(재야 장수를 맞아들인다 · 없으면 가끔 금)', () => {
  const g = newGame(), a = g.P(12), b = g.P(13);
  assert.ok(!g.move(12, 123, 11, 0).ok, '남의 주'); assert.ok(!g.move(12, 123, 25, 0).ok, '이웃이 아닌 주'); assert.ok(!g.move(12, 122, 13, 0).ok, '다른 주의 장수'); assert.ok(!g.move(12, null, 13, 0).ok, '빈손'); assert.ok(!g.move(12, null, 13, 5001).ok); assert.strictEqual(a.acted, false);
  const r = g.move(12, 123, 13, 2000); assert.ok(r.ok && /장비가 병력 2,000과 함께/.test(r.text)); assert.deepStrictEqual([a.troops, b.troops, g.officers.get(123).province, a.acted, b.acted], [3000, 7000, 13, true, false]);
  assert.deepStrictEqual(g.officersOf(13).map(o => o.name).sort(), ['관우', '장비']); assert.deepStrictEqual(g.freeIn(13).map(o => o.name), ['미축']);
  let found = null, months = 0; for (; months < 30 && !found; months++) { const s = g.search(13); assert.ok(s.ok); if (s.found) found = s; g.endMonth(); }
  assert.strictEqual(found.found, 209); const o = g.officers.get(209); assert.deepStrictEqual([o.faction, o.status, o.province], ['liubei', 'active', 13]); assert.strictEqual(g.freeIn(13).length, 0);
  let gold = 0; for (let i = 0; i < 40; i++) { const before = b.gold, s = g.search(13); assert.strictEqual(s.found, null); if (s.gold) { assert.ok(s.gold >= 50 && s.gold <= 150 && b.gold === before + s.gold); gold++; } b.acted = false; } assert.ok(gold > 3 && gold < 25, '금 줍기는 열에 셋쯤 ' + gold);
});
ok('달 넘기기: 세금(인구÷2000×민심%) · 수확(농지×4) · 군량(병력÷100) · 민심 +1(70까지) · 인구 +0.2% · 군량이 없으면 열에 하나가 흩어진다', () => {
  const g = newGame(), p = g.P(12); assert.deepStrictEqual(g.income(12), { gold: 84, rice: 180, upkeep: 50 });
  g.develop(12); const notes = g.endMonth(); assert.deepStrictEqual(notes, []); assert.deepStrictEqual([p.gold, p.rice, p.loyalty, p.pop, p.acted, g.months], [450 + 87, 1500 + 204 - 50, 68, 260520, false, 1]);   // 개발 뒤: 충성 67 → 세금 87, 농지 51 → 쌀 204
  const x = g.P(14); assert.strictEqual(x.loyalty, 70, '70에서 멈춘다'); const n = g.P(41), n0 = { ...n }; g.endMonth(); assert.deepStrictEqual({ ...n }, n0, '공백지는 그대로');
  p.rice = 0; p.farm = 0; p.troops = 5000; const note = g.endMonth(); assert.deepStrictEqual([p.troops, p.rice], [4500, 0]); assert.ok(note.some(s => /소패: 군량이 떨어져 병사 500이 흩어졌다/.test(s)));
});
ok('전장: 같은 주는 늘 같은 전장 · 10×10 · 강은 위에서 아래까지 이어진다 · 성은 오른쪽 · 양쪽이 서는 자리는 평지', () => {
  let rivers = 0;
  for (let id = 1; id <= 41; id++) {
    const m = S.makeMap(id), m2 = S.makeMap(id); assert.deepStrictEqual(m, m2); assert.strictEqual(m.tiles.length, 10); assert.ok(m.tiles.every(r => r.length === 10 && r.every(t => t in S.TERRAIN)));
    const [cc, cr] = m.castle; assert.ok(cc === 8 && (cr === 4 || cr === 5) && m.tiles[cr][cc] === 'castle'); assert.strictEqual(m.tiles.flat().filter(t => t === 'castle').length, 1);
    for (const [c, r] of [[1, 4], [0, 2], [0, 7], [8, cr - 2], [8, cr + 2]]) assert.strictEqual(m.tiles[r][c], 'plain', `주 ${id} (${c},${r})`);
    const rv = m.tiles.map(r => r.indexOf('river')); if (rv.some(c => c >= 0)) { rivers++; assert.ok(rv.every(c => c >= 3 && c <= 6), '줄마다 강이 한 칸'); const g = new DH.HexGrid(10, 10, 1); for (let r = 1; r < 10; r++) assert.strictEqual(g.distance(rv[r - 1], r - 1, rv[r], r), 1, '강이 끊겼다'); }
  }
  assert.ok(rivers > 20 && rivers < 41, '강 있는 전장 ' + rivers); assert.deepStrictEqual([S.BATTLE.cols, S.BATTLE.rows, S.TERRAIN.plain.cost, S.TERRAIN.mountain.cost, S.TERRAIN.river.cost], [10, 10, 1, 3, 4]);
});
const side = (f, units) => ({ faction: f, name: f, color: '#888888', units });
const battle = (att, def, seed = 12) => new S.Battle({ seed, province: { id: seed, name: '시험' }, att: side('a', att), def: side('d', def) });      // 주 12의 전장은 강이 없다
ok('전투: 이동 범위(평지 1 · 산 3 · 강 4, 이동력 5) · 적은 못 지나가고 아군 칸에는 못 선다 · 하루에 한 번 움직인다', () => {
  const b = battle([{ officer: 1, name: '갑', war: 90, troops: 3000 }, { officer: 2, name: '을', war: 50, troops: 1000 }], [{ officer: 3, name: '병', war: 70, troops: 2000 }]), u = b.units[0];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) b.tiles[r][c] = 'plain'; b.tiles[4][2] = 'mountain'; b.tiles[3][1] = 'river'; b.tiles[5][8] = 'castle';
  assert.deepStrictEqual([u.c, u.r, b.units[1].c, b.units[1].r, b.units[2].c, b.units[2].r], [1, 4, 0, 2, 8, 5]);
  let m = b.range(u); assert.strictEqual(m.get('2,4').cost, 3); assert.strictEqual(m.get('1,3').cost, 4); assert.strictEqual(m.get('0,4').cost, 1); assert.strictEqual(m.get('3,4').cost, 3, '산을 돌아가는 편이 싸다'); assert.ok([...m.values()].every(v => v.cost <= 5));
  b.tiles[5][0] = 'river'; b.units[1].c = 1; b.units[1].r = 5; m = b.range(u); assert.ok(!m.has('1,5'), '아군이 선 칸에는 못 선다'); assert.deepStrictEqual([m.get('1,6').cost, m.get('1,6').from], [2, '1,5'], '아군은 지나간다');
  b.units[2].c = 1; b.units[2].r = 5; b.units[1].c = 0; b.units[1].r = 2; m = b.range(u); assert.ok(!m.has('1,5')); assert.deepStrictEqual([m.get('1,6').cost, m.get('1,6').from], [5, '0,5'], '적은 못 지나가 강으로 돌아간다');
  assert.strictEqual(b.move(u, 9, 9), false); assert.strictEqual(b.move(u, 3, 4), true); assert.strictEqual(b.move(u, 4, 4), false, '두 번은 못 움직인다'); assert.strictEqual(b.range(u).size, 1);
  assert.strictEqual(b.move(b.units[2], 2, 5), false, '남의 차례');
});
ok('전투: 피해 = (병력 × 무력 ÷ 100) × (1 − 방어 지형 보정) · 바로 옆만 친다 · 치면 그날은 끝 · 딱 떨어지는 값', () => {
  const mk = terr => { const b = battle([{ officer: 1, name: '갑', war: 95, troops: 5000 }], [{ officer: 3, name: '병', war: 40, troops: 5000 }]); for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) b.tiles[r][c] = 'plain'; const [a, d] = b.units; a.c = 4; a.r = 4; d.c = 5; d.r = 4; b.tiles[4][5] = terr; return b; };
  for (const [terr, dmg] of [['plain', 4750], ['river', 4750], ['mountain', 3325], ['castle', 2850]]) { const b = mk(terr), [a, d] = b.units; assert.strictEqual(b.damage(a, d), dmg, terr); const rec = b.attack(a, d); assert.deepStrictEqual([rec.damage, d.troops, a.done, a.troops], [dmg, 5000 - dmg, true, 5000]); assert.strictEqual(b.attack(a, d), null, '하루에 한 번'); }
  const b = mk('mountain'), [a, d] = b.units; a.troops = 100; a.war = 90; assert.strictEqual(b.damage(a, d), 63, '100 × 90 ÷ 100 × 0.7 = 63'); a.troops = 5000; a.war = 95;
  d.c = 6; assert.strictEqual(b.attack(a, d), null, '떨어진 적은 못 친다'); assert.deepStrictEqual(b.targets(a), []);
  b.endSide(); assert.strictEqual(b.side, 'def'); d.c = 5; assert.strictEqual(b.damage(d, a), 2000, '맞는 쪽이 선 지형을 본다: 평지'); assert.strictEqual(b.attack(a, d), null, '남의 차례에는 못 친다');
  b.attack(d, a); assert.strictEqual(a.troops, 3000); b.endSide(); assert.deepStrictEqual([b.side, b.day, a.done, a.moved], ['att', 2, false, false]);
});
ok('전투 승패: 모두 무너뜨리면 · 공격 측이 성에 선 채 차례를 마치면 · 20일을 버티면 수비 · 물러나면 진다', () => {
  const mk = () => battle([{ officer: 1, name: '갑', war: 100, troops: 6000 }], [{ officer: 3, name: '병', war: 40, troops: 3000 }, { officer: null, name: '수비대', war: 40, troops: 1000 }]);
  let b = mk(), [a, d, e] = b.units; a.c = 7; a.r = 5; b.attack(a, d); assert.strictEqual(d.troops, 0, '6000 × 100% × 0.6 = 3600'); assert.strictEqual(b.winner, null, '한 부대가 남았다'); assert.strictEqual(b.unitAt(8, 5), null, '무너진 부대는 자리를 비운다');
  b.endSide(); b.endSide(); a.c = e.c; a.r = e.r + 1; b.attack(a, e); assert.deepStrictEqual([b.winner, b.reason], ['att', '수비 부대가 모두 무너졌다']); assert.deepStrictEqual(b.result(), { winner: 'att', reason: '수비 부대가 모두 무너졌다', days: 2, attTroops: 6000, defTroops: 0 });
  b = mk(); [a, d] = b.units; d.c = 9; d.r = 0; a.c = 8; a.r = 5; b.endSide(); assert.deepStrictEqual([b.winner, b.reason], ['att', '성을 차지했다']);
  b = mk(); for (let i = 0; i < 40; i++) b.endSide(); assert.deepStrictEqual([b.winner, b.day, b.reason], ['def', 20, '20일을 버텼다']); b.endSide(); assert.strictEqual(b.day, 20, '끝난 뒤에는 움직이지 않는다');
  b = mk(); b.retreat('att'); assert.deepStrictEqual([b.winner, b.reason], ['def', '공격 측이 물러났다']); b = mk(); b.retreat('def'); assert.strictEqual(b.winner, 'att');
  b = mk(); const r = b.auto(); assert.ok(r.winner === 'att' && r.attTroops > 0 && r.defTroops === 0 && r.days <= 20, JSON.stringify(r)); const r2 = mk().auto(); assert.deepStrictEqual(r, r2, 'AI끼리의 싸움은 늘 같다');
});
ok('침공: 병력을 떼어 전투를 연다 · 이기면 주인이 바뀌고 부대가 들어간다 · 지면 남은 병력이 돌아온다 · 진 쪽 장수는 가까운 자기 주로', () => {
  const cap = S.RULES.capture; S.RULES.capture = 0;                       // 사로잡기는 아래 시험에서 따로 본다
  let g = newGame(); assert.ok(!g.attack(12, 13, 2000).ok, '우리 주'); assert.ok(!g.attack(12, 25, 2000).ok, '이웃이 아니다'); assert.ok(!g.attack(12, 11, 900).ok, '1000부터'); assert.ok(!g.attack(12, 11, 5001).ok);
  let r = g.attack(12, 11, 4000); assert.ok(r.ok && r.battle); assert.deepStrictEqual([g.P(12).troops, g.P(12).acted, g.P(11).owner], [1000, true, 'cao']); assert.deepStrictEqual(r.pending, { from: 12, to: 11, att: 'liubei', def: 'cao', sent: 4000, officers: [123] });
  assert.deepStrictEqual(r.battle.units.map(u => [u.side, u.name, u.war, u.troops]), [['att', '장비', 95, 4000], ['def', '하후돈', 90, 8000]]); assert.ok(/유비 군이 소패에서 진류로 쳐들어갔다\(조조 · 병력 4,000 대 8,000\)/.test(r.text));
  let out = g.settle(r.pending, { winner: 'att', attTroops: 2500, defTroops: 300, reason: '성을 차지했다' }); const t = g.P(11);
  assert.deepStrictEqual([t.owner, t.troops, t.loyalty, t.acted, g.officers.get(123).province], ['liubei', 2500, 60, true, 11]); assert.strictEqual(out.winner, 'att');
  const hh = g.officers.get(102), ref = g.P(hh.province); assert.ok(ref.owner === 'cao' && g.P(11).adj.includes(ref.id), '하후돈은 이웃한 조조 땅으로'); assert.ok(/조조의 장수들은 .+ 물러났다/.test(out.text)); assert.strictEqual(g.provincesOf('liubei').length, 3);
  g = newGame(); r = g.attack(12, 11, 4000); out = g.settle(r.pending, { winner: 'def', attTroops: 700, defTroops: 6000, reason: '공격 부대가 모두 무너졌다' });
  assert.deepStrictEqual([g.P(12).troops, g.P(11).troops, g.P(11).owner, g.officers.get(123).province], [1700, 6000, 'cao', 12]); assert.ok(/조조 쪽이 진류를 지켜 냈다/.test(out.text));
  g = newGame(); g.P(10).troops = 0; r = g.attack(12, 10, 1000); assert.ok(r.ok && r.battle === null && r.outcome.winner === 'att'); assert.deepStrictEqual([g.P(10).owner, g.P(10).troops], ['liubei', 1000]);
  g = newGame(); r = g.attack(12, 10, 5000); assert.deepStrictEqual(r.battle.units.map(u => [u.name, u.war, u.officer]), [['장비', 95, 123], ['정욱', 45, 301]]);
  g = newGame(); g.officers.get(301).province = 11; r = g.attack(12, 10, 5000); assert.deepStrictEqual(r.battle.units.map(u => [u.name, u.war, u.officer]), [['장비', 95, 123], ['수비대', 40, null]], '장수 없는 주는 수비대(무력 40)');
  S.RULES.capture = cap;
});
ok('세력의 끝: 땅을 모두 잃으면 무너지고 장수는 재야가 된다 · 사람이 지면 lost · 다른 세력이 모두 무너지면 won(공백지는 남아도 된다)', () => {
  const cap = S.RULES.capture; S.RULES.capture = 0;
  let g = newGame({ player: 'cao' }); const win = (from, to, officers = []) => g.settle({ from, to, att: g.P(from).owner, def: g.P(to).owner, sent: 1000, officers }, { winner: 'att', attTroops: 1000, defTroops: 0, reason: '시험' });
  let o = win(14, 12, [105]); assert.ok(g.factions.get('liubei').alive && /하비로 물러났다/.test(o.text)); assert.strictEqual(g.officers.get(121).province, 13); assert.deepStrictEqual([g.P(12).owner, g.officers.get(105).province], ['cao', 12]);
  o = win(14, 13, [104]); assert.ok(/유비 세력이 무너졌다/.test(o.text)); assert.strictEqual(g.factions.get('liubei').alive, false); assert.strictEqual(g.over, null);
  for (const id of [121, 122, 123]) { const f = g.officers.get(id); assert.deepStrictEqual([f.faction, f.status, f.province], [null, 'free', 13]); } assert.deepStrictEqual(g.officersOf(13).map(x => x.id), [104]); assert.strictEqual(g.freeIn(13).length, 4);
  for (const f of g.factions.values()) if (f.id !== 'cao' && f.alive) { for (const p of g.provincesOf(f.id)) p.owner = 'cao'; g.checkFaction(f.id); }
  assert.strictEqual(g.over, null); assert.strictEqual(g.P(41).owner, null); g.checkStage(); assert.deepStrictEqual([g.over, g.overWhy], ['won', 'all'], '건녕이 공백지로 남아도 이긴다'); assert.ok(!g.can(14, 'develop').ok, '끝난 판에는 명령이 없다');
  g = newGame(); win(11, 12); assert.strictEqual(g.over, null); assert.strictEqual(g.P(12).owner, null, '장수 없이 얻은 땅은 공백지가 된다'); win(16, 13); assert.strictEqual(g.over, 'lost');
  S.RULES.capture = cap;
});
ok('공백지: 장수가 없으면 주인을 잃는다 · 병력은 백성으로 · 장수를 보내 차지한다(진주) · 병력만으로는 못 간다 · 칠 수 없다', () => {
  const g = newGame({ player: 'liuzhang' }), v = g.P(41), a = g.P(39), b = g.P(40);
  assert.ok(g.vacant(v)); assert.deepStrictEqual(g.openLand(39).map(q => q.id), [41]); assert.ok(!g.targets(39).some(q => q.id === 41), '공백지는 침공 대상이 아니다');
  assert.ok(!g.attack(39, 41, 1000).ok); { const h = newGame({ player: 'liuzhang' }); h.P(40).owner = 'liubiao'; assert.ok(/공백지는 장수를 이동시켜/.test(h.attack(39, 41, 1000).why)); } assert.ok(/장수가 가야/.test(g.move(39, null, 41, 1000).why));
  const r = g.move(39, 152, 41, 1000); assert.ok(r.ok && r.took && !r.left && /장임이 병력 1,000과 함께 들어가 공백지를 차지했다/.test(r.text), r.text);
  assert.deepStrictEqual([v.owner, v.troops, v.acted, a.troops, a.acted, g.officers.get(152).province], ['liuzhang', 1000, true, 7000, true, 41]);
  const pop = b.pop, r2 = g.move(40, 153, 41, 0); assert.ok(r2.ok && r2.left && /강주: 장수가 없어 공백지가 되었다/.test(r2.text), r2.text); assert.deepStrictEqual([b.owner, b.troops, b.pop], [null, 0, pop + 5000], '마지막 장수가 떠나면 병력은 백성으로 돌아간다');
  assert.strictEqual(g.fname(null), '공백지'); assert.ok(!g.can(40, 'develop').ok, '공백지에는 명령이 없다');
  g.officers.get(351).province = 39; const notes = g.endMonth(); assert.ok(notes.some(t => /영안: 장수가 없어 공백지가 되었다/.test(t)), '달이 바뀔 때 장수 없는 주를 살핀다'); assert.strictEqual(g.P(28).owner, null);
  const inc = g.P(28).gold; g.endMonth(); assert.strictEqual(g.P(28).gold, inc, '공백지에는 세금도 수확도 없다');
});
ok('사로잡기: 침공에 이기면 지키던 장수는 30% 확률로 이긴 쪽에 든다 · 군주는 사로잡히지 않는다', () => {
  const cap = S.RULES.capture; assert.strictEqual(cap, 0.3);
  try {
    S.RULES.capture = 1; let g = newGame(), r = g.attack(12, 11, 4000), out = g.settle(r.pending, { winner: 'att', attTroops: 2500, defTroops: 300, reason: '시험' });
    const hh = g.officers.get(102); assert.deepStrictEqual([hh.faction, hh.status, hh.province], ['liubei', 'active', 11]); assert.ok(/사로잡힌 하후돈이 유비 편에 들었다/.test(out.text), out.text);
    g = newGame({ player: 'cao' }); g.P(11).troops = 9000; r = g.attack(11, 12, 9000); assert.deepStrictEqual(r.pending.officers, [102]); out = g.settle(r.pending, { winner: 'att', attTroops: 5000, defTroops: 0, reason: '시험' });
    assert.deepStrictEqual([g.officers.get(121).faction, g.officers.get(121).province], ['liubei', 13], '군주 유비는 물러난다'); assert.deepStrictEqual([g.officers.get(123).faction, g.officers.get(123).province], ['cao', 12]);
    assert.ok(/진류: 장수가 없어 공백지가 되었다/.test(out.text), '하나뿐인 장수가 나가 이기면 출발지는 공백지가 된다 ' + out.text); assert.strictEqual(g.P(11).owner, null);
    S.RULES.capture = 0.3; let n = 0; for (let i = 0; i < 400; i++) { g = newGame({ rng: new DH.RNG(100 + i) }); r = g.attack(12, 11, 4000); g.settle(r.pending, { winner: 'att', attTroops: 2500, defTroops: 0, reason: '시험' }); if (g.officers.get(102).faction === 'liubei') n++; }
    assert.ok(n > 90 && n < 150, '400번에 120번쯤 ' + n);
  } finally { S.RULES.capture = cap; }
});
ok('시혜: 쌀 500 → 민심 +(4 + 매력÷20) · 100까지 · 쌀이 모자라면 못 한다', () => {
  const g = newGame(), p = g.P(12), r = g.relief(12); assert.ok(r.ok && /민심 65 → 74/.test(r.text), r.text); assert.deepStrictEqual([p.rice, p.loyalty, p.acted], [1000, 74, true]);                 // 유비 매력 100 → 4 + 5
  const q = g.P(13); q.loyalty = 97; g.relief(13); assert.strictEqual(q.loyalty, 100); g.endMonth(); assert.ok(/가득/.test(g.can(13, 'relief').why)); p.rice = 499; assert.ok(/쌀 500/.test(g.can(12, 'relief').why));
});
ok('동맹: 이웃 세력에 금 300 · 확률 20% + 매력÷2 % (+10%p) · 12달 동안 서로 못 친다 · 기한이 끝나면 풀린다 · 깨면 민심 −10', () => {
  let g = newGame(); assert.deepStrictEqual(g.borderFactions(12), ['cao']); assert.deepStrictEqual(g.borderFactions(13), ['cao', 'yuan', 'sun']);
  assert.ok(Math.abs(g.allyChance(12, 'cao') - 0.7) < 1e-9, '유비 매력 100: 0.2 + 0.5'); assert.ok(Math.abs(g.allyChance(13, 'cao') - 0.65) < 1e-9, '관우 매력 90'); g.P(12).troops = 90000; assert.ok(Math.abs(g.allyChance(12, 'cao') - 0.8) < 1e-9, '병력이 더 많으면 +0.1'); g.P(12).troops = 5000;
  assert.ok(/이웃한 세력에만/.test(g.ally(12, 'sun').why)); g.P(12).gold = 299; assert.ok(/금 300/.test(g.ally(12, 'cao').why)); g.P(12).gold = 550;
  let made = 0, fail = 0; for (let i = 0; i < 300; i++) { const h = newGame({ rng: new DH.RNG(500 + i) }), r = h.ally(12, 'cao'); assert.ok(r.ok && h.P(12).gold === 250 && h.P(12).acted); if (r.made) { made++; assert.ok(h.allied('liubei', 'cao') && h.allied('cao', 'liubei')); } else { fail++; assert.ok(!h.allied('liubei', 'cao')); } }
  assert.ok(made > 180 && made < 240, '300번에 210번쯤 ' + made);
  g = newGame(); g.pacts.set(g.pactKey('liubei', 'cao'), 2); assert.deepStrictEqual(g.alliesOf('liubei'), [{ id: 'cao', months: 2 }]); assert.deepStrictEqual(g.targets(12), []); assert.ok(/동맹은 칠 수 없다/.test(g.can(12, 'attack').why)); assert.ok(/이미 동맹/.test(g.ally(12, 'cao').why));
  g.P(11).troops = 30000; Object.assign(g.officers.get(214), { faction: 'cao', status: 'active' }); assert.notStrictEqual(g.aiDecide(11).type, 'attack', 'AI도 동맹을 치지 않는다');
  assert.deepStrictEqual(g.endMonth(), []); assert.strictEqual(g.alliesOf('liubei')[0].months, 1); const notes = g.endMonth(); assert.ok(notes.some(t => /조조와 맺은 동맹의 기한이 끝났다/.test(t))); assert.strictEqual(g.allied('liubei', 'cao'), false); assert.strictEqual(g.targets(12).length, 3);
  g = newGame(); g.pacts.set(g.pactKey('liubei', 'cao'), 12); const r = g.breakPact(12, 'cao'); assert.ok(r.ok && /민심 −10/.test(r.text)); assert.deepStrictEqual([g.P(12).loyalty, g.P(13).loyalty, g.P(12).acted, g.allied('liubei', 'cao')], [55, 55, true, false]);
  g = newGame(); g.pacts.set(g.pactKey('liubei', 'sun'), 12); g.settle({ from: 12, to: 13, att: 'cao', def: 'liubei', sent: 1, officers: [] }, { winner: 'att', attTroops: 1, defTroops: 0, reason: '시험' }); g.settle({ from: 13, to: 12, att: 'cao', def: 'liubei', sent: 1, officers: [] }, { winner: 'att', attTroops: 1, defTroops: 0, reason: '시험' }); assert.strictEqual(g.pacts.size, 0, '무너진 세력의 동맹은 사라진다');
});
ok('AI 군주의 우선순위: 시혜 → 수색 → 공백지 진주 → 병력 확보 → 가장 약한 이웃 공격(병력의 70%, 장수가 둘 이상일 때) → 후방의 장수 · 병력을 전선으로 → 농지 개발', () => {
  const g = newGame({ player: null }), A = S.RULES.ai; assert.deepStrictEqual([A.needMin, A.needRatio, A.sendRatio, A.reliefBelow, A.occupyRatio], [6000, 2.5, 0.7, 40, 0.3]);
  const p = g.P(11), jw = g.officers.get(214); assert.deepStrictEqual(g.aiDecide(11), { type: 'search' }, '진류: 장수가 하후돈뿐이고 재야에 전위가 있다');
  Object.assign(jw, { faction: 'cao', status: 'active' }); assert.deepStrictEqual(g.aiDecide(11), { type: 'draft' }, '진류 8,000: 가장 약한 이웃 5,000의 2.5배(12,500)에 못 미친다');
  p.troops = 12500; assert.deepStrictEqual(g.aiDecide(11), { type: 'attack', to: 12, troops: 8700 }, '12,500이 모이면 70%를 보낸다');
  jw.province = 14; assert.deepStrictEqual(g.aiDecide(11), { type: 'develop' }, '장수가 한 명뿐이면 주를 비우고 나가지 않는다'); jw.province = 11;
  p.loyalty = 39; assert.deepStrictEqual(g.aiDecide(11), { type: 'relief' }, '민심이 40 아래면 쌀을 푼다'); p.rice = 800; assert.deepStrictEqual(g.aiDecide(11), { type: 'attack', to: 12, troops: 8700 }, '군량 석 달 치가 남지 않으면 풀지 않는다'); p.loyalty = 70; p.rice = 2400;
  const sp = g.P(12); sp.troops = 12500; assert.deepStrictEqual(g.aiDecide(12), { type: 'attack', to: 10, troops: 8700 }, '병력이 같으면 번호가 앞선 복양'); g.P(16).troops = 3000; assert.deepStrictEqual(g.aiDecide(12), { type: 'attack', to: 16, troops: 8700 }, '가장 약한 이웃을 고른다'); sp.troops = 5000; g.P(16).troops = 5000; p.troops = 5900; assert.deepStrictEqual(g.aiDecide(11), { type: 'draft' }, '적어도 6,000은 모은다');
  p.gold = 0; assert.deepStrictEqual(g.aiDecide(11), { type: 'wait' }, '금이 없으면 쉰다'); p.gold = 500; p.loyalty = 20; p.rice = 0; assert.deepStrictEqual(g.aiDecide(11), { type: 'develop' }, '징병을 못 하면 농지를 넓힌다'); p.acted = true; assert.deepStrictEqual(g.aiDecide(11), { type: 'wait' });
  assert.deepStrictEqual(g.aiDecide(39), { type: 'move', to: 41, troops: 2400, officer: 152 }, '성도: 군주 유장은 남고 장임이 병력 30%와 건녕으로 간다'); assert.deepStrictEqual(g.aiDecide(40), { type: 'develop' }, '강주: 장수가 엄안뿐이라 공백지로 나가지 않는다');
  const d = g.frontDistance('cao'); assert.deepStrictEqual([d.get(14), d.get(11)], [1, 0]); const mv = g.aiDecide(14); assert.deepStrictEqual([mv.type, mv.officer, mv.troops], ['move', 105, 4000], '허창(후방): 군주가 아닌 허저가 병력 절반과 간다'); assert.ok(d.get(mv.to) === 0 && g.P(mv.to).owner === 'cao', '전선에 더 가까운 우리 주로');
  const q = g.P(3), dy = g.frontDistance('yuan'); assert.strictEqual(dy.get(3), 1); assert.deepStrictEqual(g.aiDecide(3), { type: 'move', to: 2, troops: 2500, officer: null }, '계(후방): 장수가 원희뿐이라 병력만 보낸다');
  q.troops = 3900; assert.deepStrictEqual(g.aiDecide(3), { type: 'develop' }, '보낼 만큼 없으면 농지를 넓힌다');
});
ok('AI 차례: 사람의 주를 치면 전투를 돌려주고 멈춘다 · AI끼리는 바로 셈한다 · 사람의 주에는 손대지 않는다', () => {
  const g = newGame(); g.P(11).troops = 20000; Object.assign(g.officers.get(214), { faction: 'cao', status: 'active' }); const mine = () => JSON.stringify([12, 13].map(id => { const p = g.P(id); return [p.gold, p.farm, p.troops, p.acted]; })), m0 = mine();
  g.beginAI(); assert.ok(!g.queue.includes(12) && !g.queue.includes(13) && g.queue.length === 38, '공백지와 사람의 주는 줄에 없다');
  let hit = null, steps = 0; for (;;) { const s = g.nextAI(); steps++; if (s.done) break; if (s.battle) { hit = s; break; } }
  assert.ok(hit && hit.from === 11 && hit.pending.to === 12 && hit.pending.def === 'liubei' && hit.cmd.troops === 14000); assert.strictEqual(g.P(12).owner, 'liubei', '아직 싸우지 않았다'); assert.strictEqual(hit.battle.winner, null); assert.strictEqual(mine(), m0);
  const out = g.settle(hit.pending, hit.battle.auto()); assert.ok(['att', 'def'].includes(out.winner)); let rest = 0; for (;;) { const s = g.nextAI(); if (s.done) break; rest++; assert.ok(!s.battle || s.pending.def === 'liubei'); } assert.ok(steps + rest > 20);
  assert.ok([...g.provinces.values()].filter(p => p.owner && p.owner !== 'liubei' && p.acted).length > 30, 'AI의 주는 거의 모두 명령을 내렸다');
});
ok('AI만의 120달: 값이 깨지지 않는다 · 현역 장수는 늘 자기 세력의 주에 있다 · 같은 시드면 같은 역사', () => {
  const run = () => { const g = newGame({ player: null, rng: new DH.RNG(1) }); let battles = 0;
    for (let m = 0; m < 120; m++) { battles += g.runAIAll().length; g.endMonth();
      for (const p of g.provinces.values()) { for (const k of ['pop', 'gold', 'rice', 'troops', 'loyalty', 'farm']) assert.ok(Number.isInteger(p[k]) && p[k] >= 0, `${m}달 ${p.name}.${k} = ${p[k]}`); assert.ok(p.loyalty <= 100 && p.farm <= 100 && (p.owner === null || g.factions.get(p.owner).alive)); }
      for (const o of g.officers.values()) { const pr = g.P(o.province); assert.ok(pr, o.name); if (o.status === 'active') assert.strictEqual(pr.owner, o.faction, `${m}달 ${o.name}`); else assert.strictEqual(o.faction, null); }
      for (const f of g.factions.values()) assert.strictEqual(f.alive, g.provincesOf(f.id).length > 0, f.name); }
    return { battles, months: g.months, map: [...g.provinces.values()].map(p => p.owner + ':' + p.troops).join() }; };
  const a = run(), b = run(); assert.deepStrictEqual(a, b); assert.strictEqual(a.months, 120); assert.ok(a.battles > 5, '싸움이 있었다 ' + a.battles);
});
// ───────── 동현랭 연동 ─────────
const A = DH.DonghyunLangAdapter, DL = require(path.join(root, 'src/lang/donghyun.js')), HEAD = '나는 동현이냐?\n', TAIL = '\n동현이구나';
const put = (...ns) => HEAD + ns.map(v => A.print(v)).join('\n') + TAIL;
ok('동현랭 실행기: 시리즈와 같은 파일(1.55) · 정수 출력 · 틀린 코드는 문장 번호와 함께 던진다', () => {
  const crypto = require('crypto'); assert.strictEqual(crypto.createHash('md5').update(fs.readFileSync(path.join(root, 'src/lang/donghyun.js'))).digest('hex'), '5dab512e9f35820e567c0e384739b138');
  assert.strictEqual(DL.run(put(3, 3000), {}).output, '3\n3000\n'); assert.strictEqual(DL.run(HEAD + '뿡뿡 도오오옹 도오오옹ㅠ~뿡뿡뿡' + TAIL, {}).output, '6\n', '도오오옹은 3 · 공백은 곱하기 · 붙이면 더하기 · ㅠ는 −1 → 3 × (3 − 1)');
  assert.throws(() => DL.run('뿡뿡 도옹', {}), e => e.name === 'DonghyunError');
});
ok('어댑터: 수를 식 하나 또는 자릿수 쌓기로 적는다(−200~5000과 큰 수를 다시 읽어 같은 값)', () => {
  const t = new A({ name: '시험', commands: { 1: { key: 'v', label: '값', min: -1e15, max: 1e15, path: 'v' } } });
  for (const v of [...Array.from({ length: 5201 }, (_, i) => i - 200), 123457, 2147483646, -2147483646, 999999999989]) { const r = t.parse(t.compose([[1, v]])); assert.ok(r.ok && r.values.v === v, '값 ' + v + ' ' + r.errors); }
  assert.strictEqual(A.expression(0), '도옹ㅠ'); const ten = '도' + '오'.repeat(9) + '옹'; assert.strictEqual(A.expression(3000), ['도오오옹', ten, ten, ten].join(' ')); assert.strictEqual(A.expression(997), null, '큰 소수는 식 하나로 못 적는다');
});
ok('어댑터: 빈 설정은 상태를 건드리지 않는다 · 번호와 값을 읽어 덮어쓴다 · 뒤에 쓴 값이 이긴다 · multi는 쌓인다', () => {
  const t = new A({ name: '시험', commands: { 3: { key: 'gold', label: '금', min: 0, max: 9999, path: 'start.gold' }, 9: { key: 'deep', label: '깊은 곳', min: 1, max: 9, path: 'a.b.c' },
    30: { key: 'off', label: '장수', multi: true, args: [{ label: '번호', min: 1, max: 999 }, { label: '값', min: 1, max: 100 }], set: (st, v) => st.list.push(v), check: ([id]) => (id === 13 ? '13번은 없다' : null) } } });
  const st = { start: { gold: 500 }, list: [] }, same = JSON.stringify(st);
  for (const src of ['', '   \n', null, undefined, HEAD + 'ㅋㅋ 출력 없음' + TAIL]) { const r = t.applyDonghyunLang(src, st); assert.deepStrictEqual([r.ok, r.empty, r.applied], [true, true, []]); assert.strictEqual(JSON.stringify(st), same); }
  const r = t.applyDonghyunLang(put(3, 1000, 30, 7, 90, 3, 2000, 30, 8, 80, 9, 4), st);
  assert.deepStrictEqual([r.ok, r.empty, r.settings.map(x => x.n), r.values], [true, false, [30, 3, 30, 9], { gold: 2000, off: [[7, 90], [8, 80]], deep: 4 }]); assert.deepStrictEqual(st, { start: { gold: 2000 }, list: [[7, 90], [8, 80]], a: { b: { c: 4 } } });
  assert.deepStrictEqual(r.applied, ['장수 7 · 90', '금 2,000', '장수 8 · 80', '깊은 곳 4']); assert.strictEqual(t.parse(put(3, 5)).ok, true, 'parse는 상태 없이도 돈다');
  assert.deepStrictEqual(t.describe(st).map(x => [x.n, x.range, x.now]), [[3, '0~9,999', 2000], [9, '1~9', 4], [30, '번호 1~999 · 값 1~100', undefined]]);
});
ok('어댑터: 오류가 하나라도 있으면 하나도 덮어쓰지 않는다(모르는 번호 · 범위 · 값 모자람 · 글자 출력 · 자료 검사 · 동현랭 오류)', () => {
  const t = new A({ name: '시험', commands: { 3: { key: 'gold', label: '금', min: 0, max: 9999, step: 100, path: 'gold' }, 30: { key: 'off', label: '장수', multi: true, args: [{ label: '번호', min: 1, max: 999 }, { label: '값', min: 1, max: 100 }], set: (st, v) => st.list.push(v), check: ([id]) => (id === 13 ? '13번은 없다' : null) } } });
  const st = { gold: 500, list: [] }, same = JSON.stringify(st);
  const E = (src, re) => { const r = t.applyDonghyunLang(src, st); assert.strictEqual(r.ok, false, src); assert.ok(re.test(r.errors[0]), r.errors[0]); assert.deepStrictEqual(r.applied, []); assert.strictEqual(JSON.stringify(st), same, '상태가 바뀌었다'); };
  E(put(3, 1000, 4, 1), /3번째 정수 4은 시험 설정 번호가 아니다\. 쓸 수 있는 번호: 3 · 30/); E(put(3, 20000), /금 값 20,000은 쓸 수 없다\. 0~9,999, 100 단위만 된다/); E(put(3, 250), /100 단위만/);
  E(put(3, 1000, 30, 7), /설정 30\(장수\) 뒤에 값이 2개 있어야 하는데 1개뿐이다/); E(put(3, 1000, 30, 7, 101), /장수의 값 값 101은 쓸 수 없다\. 1~100만 된다/); E(put(3, 1000, 30, 13, 50), /설정 30\(장수\): 13번은 없다/);
  E(HEAD + '뿡뿡뿡 ' + A.expression(65) + TAIL, /1번째 출력 'A'는 정수가 아니다/); E(put(3) + '', /값이 1개 있어야 하는데 0개뿐/); E(HEAD + A.print(3) + '\n포동이 ' + A.expression(1500) + TAIL, /설정 3\(금\)의 값 '1\.500'는 정수가 아니다/); E('뿡뿡 도옹', /^동현랭 오류/); E(HEAD + '동현아 도옹\n몰라요' + TAIL, /^동현랭 오류 \(3번 문장\)/);
  assert.throws(() => new A({ commands: { 1: { key: 'x', label: 'x', min: 5, max: 1, path: 'x' } } }), /범위/); assert.throws(() => new A({ commands: { 1: { key: 'x', label: 'x', min: 0, max: 1 } } }), /path/);
  const none = new A({ name: '시험', runtime: { run: () => { throw new Error('없다'); } }, commands: {} }); assert.strictEqual(none.parse(put(1)).ok, false);
});
ok('동현삼 globalState: 기본값은 RULES · BATTLE · TERRAIN 그대로 · 설정 없는 판은 예전과 똑같이 흐른다(AI만 24달)', () => {
  const st = S.newState(); assert.deepStrictEqual(st.rules, S.RULES); assert.notStrictEqual(st.rules, S.RULES); assert.deepStrictEqual(st.battle, { ...S.BATTLE, terrain: S.TERRAIN });
  assert.deepStrictEqual([st.start, st.stage, st.provinces, st.officers], [{ player: null, seed: null, gold: null, rice: null, troops: null, loyalty: null, farm: null }, { goal: null, months: 0 }, [], []]);
  const snap = g => JSON.stringify([[...g.provinces.values()].map(p => [p.id, p.owner, p.gold, p.rice, p.troops, p.loyalty, p.farm, p.pop]), [...g.officers.values()].map(o => [o.id, o.faction, o.province, o.status]), g.rng.state]);
  const run = o => { const g = new S.Game(S.parse(samJ()), { player: null, rng: new DH.RNG(5), ...o }); let fights = 0; for (let i = 0; i < 24; i++) { fights += g.runAIAll().length; g.endMonth(); } return [snap(g), fights]; };
  const st2 = S.newState(), r = S.applyDonghyunLang(HEAD + 'ㅋㅋ 없음' + TAIL, st2, { world: S.parse(samJ()) }); assert.ok(r.ok && r.empty); assert.deepStrictEqual(st2, S.newState());
  const a = run({}), b = run({ state: S.newState() }), c = run({ state: st2 }); assert.strictEqual(a[0], b[0]); assert.strictEqual(a[0], c[0]); assert.ok(a[1] > 0, '그 사이 싸움이 있었다');
  const g = newGame(), g2 = newGame({ state: S.newState() }); assert.strictEqual(snap(g), snap(g2)); assert.deepStrictEqual([g.goal, g.stage, g.rules === S.RULES, g2.rules === S.RULES], [41, { goal: null, months: 0 }, true, false]);
});
ok('동현삼 설정: 시작 금 · 쌀 · 병력 · 민심 · 농지 · 주 초기값 · 장수 능력치 · 징병 수량과 드는 금 · 농지 개발 금 · 농지마다 쌀', () => {
  const w = S.parse(samJ()), st = S.newState(), L = S.lang;
  const r = S.applyDonghyunLang(L.compose([[1, 3], [2, 77], [3, 3000], [4, 20000], [5, 7000], [6, 88], [7, 60], [8, 13, 3, 1200], [8, 14, 1, 9], [10, 2000], [11, 250], [12, 40], [13, 6], [30, 121, 1, 99], [30, 123, 2, 77]]), st, { world: w });
  assert.ok(r.ok, r.errors.join()); assert.strictEqual(r.settings.length, 15); assert.deepStrictEqual(st.start, { player: 3, seed: 77, gold: 3000, rice: 20000, troops: 7000, loyalty: 88, farm: 60 });
  assert.deepStrictEqual([st.provinces, st.officers, st.rules.draft.troops, st.rules.draft.gold, st.rules.develop.gold, st.rules.ricePerFarm], [[[13, 'troops', 1200], [14, 'gold', 9]], [[121, 'war', 99], [123, 'int', 77]], 2000, 250, 40, 6]);
  assert.ok(r.applied.includes('군주 유비') && r.applied.includes('주 초기값 하비 병력 1,200') && r.applied.includes('장수 능력치 유비 무력 99'), r.applied.join());
  assert.strictEqual(S.RULES.draft.troops, 1000, '기본값 표는 그대로다'); assert.strictEqual([...w.factions.keys()][st.start.player - 1], 'liubei');
  const g = new S.Game(w, { player: 'liubei', state: st }), sp = g.P(12), hb = g.P(13), base = S.parse(samJ()).provinces;
  assert.deepStrictEqual([sp.gold, sp.rice, sp.troops, sp.loyalty, sp.farm], [3000, 20000, 7000, 88, 60]); assert.deepStrictEqual([hb.gold, hb.troops, hb.farm], [3000, 1200, 60], '주 초기값이 우리 주 시작값보다 뒤에 덮인다');
  assert.deepStrictEqual([g.P(14).gold, g.P(14).troops, g.P(11).gold], [9, base.get(14).troops, base.get(11).gold], '남의 주는 적은 것만 바뀐다'); assert.deepStrictEqual([g.officers.get(121).war, g.officers.get(123).int, g.officers.get(123).war, g.officers.get(121).int], [99, 77, S.parse(samJ()).officers.get(123).war, S.parse(samJ()).officers.get(121).int], '적은 능력만 바뀐다');
  const pop = sp.pop, d = g.draft(12); assert.ok(d.ok && /병사 2,000을 뽑았다/.test(d.text)); assert.deepStrictEqual([sp.troops, sp.gold, sp.pop], [9000, 2750, pop - 2000]);
  const dv = g.develop(13); assert.ok(dv.ok); assert.strictEqual(hb.gold, 2960); assert.strictEqual(g.income(13).rice, hb.farm * 6); hb.gold = 39; hb.acted = false; assert.strictEqual(g.can(13, 'develop').why, '금 40이 있어야 한다');
});
ok('동현삼 설정: 스테이지 조건(주 셋 · 기한) · 전투 기한과 이동력 · AI 신중함', () => {
  const w = () => S.parse(samJ()), mk = (list, o = {}) => { const st = S.newState(), r = S.applyDonghyunLang(S.lang.compose(list), st, { world: w() }); assert.ok(r.ok, r.errors.join()); return new S.Game(w(), { player: 'liubei', state: st, ...o }); };
  let g = mk([[20, 3], [21, 12]]); const win = (from, to) => g.settle({ from, to, att: g.P(from).owner, def: g.P(to).owner, sent: 1000, officers: [123] }, { winner: 'att', attTroops: 1000, defTroops: 0, reason: '시험' });      // 장비가 들어가 지킨다
  assert.deepStrictEqual([g.goal, g.stage, g.over], [3, { goal: 3, months: 12 }, null]); win(12, 16); assert.deepStrictEqual([g.over, g.overWhy, g.provincesOf('liubei').length], ['won', 'goal', 3]);
  g = mk([[20, 3], [21, 12]]); for (let i = 0; i < 11; i++) g.endMonth(); assert.strictEqual(g.over, null); g.endMonth(); assert.deepStrictEqual([g.over, g.overWhy, g.months], ['lost', 'time', 12]);
  g = mk([[20, 3], [21, 12]]); for (let i = 0; i < 11; i++) g.endMonth(); win(12, 16); g.endMonth(); assert.deepStrictEqual([g.over, g.overWhy], ['won', 'goal'], '마지막 달에 채우면 이긴다');
  g = mk([[20, 2]]); assert.deepStrictEqual([g.over, g.overWhy], ['won', 'goal'], '시작부터 채웠으면 바로 끝난다'); g = mk([[21, 5]], { player: null }); for (let i = 0; i < 6; i++) g.endMonth(); assert.strictEqual(g.over, null, '사람이 없으면 조건을 보지 않는다');
  g = mk([[22, 7], [23, 8], [24, 15]]); assert.deepStrictEqual([g.battleRules.days, g.battleRules.mp, g.rules.ai.needRatio, S.BATTLE.days, S.BATTLE.mp, S.RULES.ai.needRatio], [7, 8, 1.5, 20, 5, 2.5]);
  const join = h => { Object.assign(h.officers.get(214), { faction: 'cao', status: 'active' }); return h; };      // 전위가 조조 편에 들어 진류의 장수가 둘이다
  join(g); g.P(11).troops = 8000; g.P(12).troops = 5000; assert.deepStrictEqual(g.aiDecide(11), { type: 'attack', to: 12, troops: 5600 }, '1.5배(7,500)면 친다'); assert.deepStrictEqual(join(newGame()).aiDecide(11), { type: 'draft' }, '기본 2.5배에서는 모은다');
  const r = g.attack(13, 16, 3000), b = r.battle; assert.deepStrictEqual([b.B.days, b.B.mp, b.T.mountain.cost], [7, 8, 3]); const u = b.units.find(x => x.side === 'att'); const reach = [...b.range(u).values()]; assert.ok(reach.some(v => v.cost > 5) && reach.every(v => v.cost <= 8), '이동력 8만큼 간다');
  for (let i = 0; i < 40 && !b.winner; i++) b.endSide(); assert.deepStrictEqual([b.winner, b.day, b.reason], ['def', 7, '7일을 버텼다'], '가만히 있으면 7일째에 수비가 이긴다');
});
ok('동현삼 설정: 틀린 번호와 값은 까닭을 말하고 globalState를 그대로 둔다 · 예제 열하나가 모두 읽힌다', () => {
  const w = S.parse(samJ()), st = S.newState(), same = JSON.stringify(st), L = S.lang;
  const E = (list, re) => { const r = S.applyDonghyunLang(L.compose(list), st, { world: w }); assert.strictEqual(r.ok, false); assert.ok(re.test(r.errors[0]), r.errors[0]); assert.strictEqual(JSON.stringify(st), same); };
  E([[3, 500], [8, 99, 1, 100]], /설정 8\(주 초기값\): 99번 주는 없다/); E([[8, 12, 4, 101]], /민심 값 101은 쓸 수 없다\. 0~100만 된다/); E([[8, 12, 3, 1250]], /병력 값 1,250은 쓸 수 없다\. 0~99,900, 100 단위만 된다/);
  E([[30, 999, 1, 50]], /999번 장수는 없다/); E([[20, 42]], /주는 41개뿐이다/); E([[10, 1050]], /징병 수량 값 1,050은 쓸 수 없다\. 100~10,000, 100 단위만 된다/); E([[6, 50], [5, 150]], /우리 주 시작 병력 값 150은/);
  const r = S.applyDonghyunLang(put(9, 1), st, { world: w }); assert.ok(/1번째 정수 9은 동현삼 설정 번호가 아니다/.test(r.errors[0]));
  const ex = S.examples(w); assert.deepStrictEqual(ex.map(e => e.id), ['none', 'rich', 'stage', 'fast', 'calm', 'weak', 'unify', 'swap', 'scale', 'loop', 'heart']);
  for (const e of ex) { const s2 = S.newState(), q = S.applyDonghyunLang(e.code, s2, { world: w }); assert.ok(q.ok, e.name + q.errors.join()); assert.strictEqual(q.empty, e.id === 'none'); assert.ok(e.code.startsWith('나는 동현이냐?') && e.code.endsWith('동현이구나')); }
  assert.strictEqual(L.describe(S.newState()).length, 22); assert.ok(L.describe(S.newState()).every(x => x.now !== undefined && x.range), '표의 모든 줄에 범위와 기본값이 있다');
});
ok('동현삼 예제: 이름 앞에 번호 01~10 · 예제마다 새 판이 열린다 · 09 변수(배율 1~24) · 10 반복문(원소의 여덟 주)', () => {
  const w = () => S.parse(samJ()), ex = S.examples(w()), by = id => ex.find(e => e.id === id), run = code => { const st = S.newState(), r = S.applyDonghyunLang(code, st, { world: w() }); return { st, r }; };
  ex.forEach((e, i) => { assert.ok(e.name.startsWith(String(i + 1).padStart(2, '0') + ' · '), e.name); assert.ok(e.code.split('\n')[1].startsWith('ㅋㅋ '), e.id + ': 둘째 줄이 설명이다');
    for (const l of e.code.split('\n')) if (l.startsWith('ㅋㅋ')) assert.ok(!l.includes('~'), e.id + ': 주석에 ~가 있으면 문장이 갈린다');
    const { st, r } = run(e.code); assert.ok(r.ok); const g = new S.Game(w(), { player: 'liubei', state: st }); assert.strictEqual(g.months, 0); });
  const pick = (id, f) => { const { st, r } = run(by(id).code); assert.ok(r.ok); return f(st, r); };
  assert.deepStrictEqual(pick('calm', (st, r) => r.applied), ['AI 신중함(×10) 10배', '농지 개발에 드는 금 50', '농지 1마다 달마다 쌀 8', '징병에 드는 금 200']);
  assert.deepStrictEqual(pick('weak', (st, r) => r.applied), ['군주 장로', '우리 주 시작 금 100', '우리 주 시작 쌀 600', '우리 주 시작 병력 3,000', '승리 조건: 차지할 주 수 3', '기한(달) 60']);
  assert.deepStrictEqual(pick('unify', (st, r) => r.applied), ['군주 조조', '난수 시드 3', '기한(달) 120']);
  assert.deepStrictEqual(pick('swap', st => st.officers), [[121, 'war', 100], [121, 'cha', 75], [122, 'war', 75], [122, 'int', 95], [123, 'war', 40], [123, 'int', 95]]);
  // 09 변수: 대입 한 줄만 바꾸면 세 값이 함께 바뀐다
  const sc = by('scale').code.split('\n'), at = sc.findIndex(l => l.startsWith('동현아 ')), scale = k => run(sc.map((l, i) => i === at ? '동현아 ' + A.expression(k) : l).join('\n'));
  assert.strictEqual(sc.filter(l => l.startsWith('동현아 ')).length, 1); assert.strictEqual(sc[at], '동현아 ' + A.expression(5));
  assert.deepStrictEqual(pick('scale', st => [st.start.player, st.start.gold, st.start.rice, st.rules.draft.troops]), [3, 5000, 20000, 2000]);
  for (const k of [1, 2, 12, 24]) { const { st, r } = scale(k); assert.ok(r.ok, k + ': ' + r.errors.join()); assert.deepStrictEqual([st.start.gold, st.start.rice, st.rules.draft.troops], [k * 1000, k * 4000, k * 400]); }
  assert.ok(/징병 수량 값 0은 쓸 수 없다/.test(scale(0).r.errors.join())); assert.ok(/우리 주 시작 쌀 값 100,000은 쓸 수 없다/.test(scale(25).r.errors.join()));
  // 10 반복문: 되돌아가는 문장 번호가 주석에 적힌 번호와 같다
  const lp = by('loop').code.split('\n'), jump = lp.find(l => l.startsWith('뭉치 ')), back = lp.findIndex(l => l.includes('되돌아오는 자리')) + 1;
  assert.ok(back > 0 && lp.slice(0, back).every(l => !l.includes('~')), '되돌아오는 자리까지는 한 줄이 한 문장이다');
  assert.strictEqual(jump, `뭉치 동현${'ㅠ'.repeat(10)}? 신중동역 ${A.expression(back)}`); assert.ok(lp[back - 1].includes(`${back}번 문장`) && lp.some(l => l.includes(`${back}번 문장으로 돌아간다`)));
  const L = run(by('loop').code); assert.deepStrictEqual(L.st.provinces, [2, 3, 4, 5, 6, 7, 8, 9].map(n => [n, 'troops', 10000])); assert.strictEqual(L.r.output.trim().split('\n').length, 32, '정수 서른두 개(설정 여덟 개 × 네 정수)');
  const g = new S.Game(w(), { player: 'liubei', state: L.st }), yuan = [...g.provinces.values()].filter(p => p.owner === 'yuan'), names = yuan.map(p => p.name);
  assert.deepStrictEqual([names, yuan.every(p => p.troops === 10000)], [['북평', '계', '남피', '평원', '업', '진양', '상당', '북해'], true], '원소의 주는 여덟 개이고 모두 10,000이다');
});

/* ---------- 장면을 화면 없이 돌린다(저장 · 불러오기 · 키보드). 조작 창은 가짜로 받아 적는다 ---------- */
function fakeLayout() {
  const L = { logs: [], items: [], fn: null, detail: null,
    log(t) { L.logs.push(t); }, setInfo() {}, setDetail(d) { L.detail = d; }, setMenu(items, fn) { L.items = items; L.fn = fn; },
    keyed() { let k = 0; return L.items.map(it => ({ ...it, n: it.key ? null : ++k })); },                      // 엔진 Layout과 같은 번호 규칙(글자를 따로 준 단추는 건너뛴다)
    press(k) { const it = L.keyed().find(x => x.n === k); if (!it || it.disabled) return false; L.fn(it.id); return true; },
    pressPrimary() { const it = L.items.find(x => x.primary); if (!it || it.disabled) return false; L.fn(it.id); return true; } };
  return L;
}
function mk(seed = 1, script) {
  const world = DH.Sam.parse(samJ()), layout = fakeLayout(), engine = new DH.Engine({ width: 480, height: 360, seed, clock: { unit: 'month', start: world.meta.start } });
  const scene = new DH.Sam.SamMapScene(engine, world, layout); engine.setScene(scene);
  if (script !== undefined) assert.ok(scene.applyDonghyunLang(script).ok);
  const key = (code, o = {}) => engine.scene.onKey(code, { preventDefault() {}, ...o });
  /** 달을 넘긴다. 침공을 받으면 장수들에게 맡기고 결과 카드를 넘긴다 */
  const endMonth = () => { scene.command('end'); for (let i = 0; i < 40000 && scene.mode === 'busy'; i++) { const top = engine.scene; if (top !== scene) { if (top.mode === 'result') top.command('back'); else if (top.myTurn) top.command('auto'); } engine.step(1); } assert.notStrictEqual(scene.mode, 'busy'); };
  return { world, layout, engine, scene, key, endMonth };
}
/** 정해 둔 한 달: 우리 주마다 번호 순서로 징병(안 되면 농지 개발)을 하고 달을 넘긴다 */
const month = k => { const g = k.scene.game; if (g.over) return; for (const p of g.provincesOf(g.player).sort((a, b) => a.id - b.id)) { k.scene.selected = p.id; k.scene.command(g.can(p.id, 'draft').ok ? 'draft' : 'develop'); } k.endMonth(); };
const pack = k => JSON.parse(JSON.stringify(k.scene.saveGame()));          // 파일이나 브라우저 칸을 거친 것처럼 글자로 바꿨다가 되읽는다
const SET = [[3, 5000], [10, 2000], [20, 6], [21, 60], [24, 15], [8, 12, 3, 9000], [30, 122, 1, 60]];

ok('동현삼 저장: 판을 적었다가 되살리면 똑같다 · 자료에 있는 것(이름 · 이웃)은 적지 않는다', () => {
  const k = mk(5); k.scene.start('liubei'); for (let i = 0; i < 4; i++) month(k);
  const g = k.scene.game, j = JSON.parse(JSON.stringify(g)), h = DH.Sam.Game.restore(k.world, j, { rng: new DH.RNG(1), state: k.scene.state });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(h)), j); assert.deepStrictEqual([h.player, h.months, h.goal, h.over], [g.player, 4, g.goal, null]);
  for (const p of g.provinces.values()) assert.deepStrictEqual([h.P(p.id).name, h.P(p.id).adj, h.income(p.id)], [p.name, p.adj, g.income(p.id)]);
  assert.deepStrictEqual(Object.keys(j.provinces[0]), ['id', 'owner', 'pop', 'gold', 'rice', 'troops', 'loyalty', 'farm', 'acted']); assert.deepStrictEqual(Object.keys(j.officers[0]), ['id', 'province', 'faction', 'status', 'war', 'int', 'cha']);
  assert.deepStrictEqual([j.provinces.length, j.officers.length, j.factions.length], [41, 71, 9]);
});
ok('동현삼 저장: 불러온 뒤 같은 명령을 내리면 같은 판이 이어진다(난수 · 달력 포함) · 다른 판을 하던 화면에 불러도 같다', () => {
  const a = mk(5, DH.Sam.lang.compose(SET)); a.scene.start('liubei'); for (let i = 0; i < 3; i++) month(a);
  const d = pack(a); assert.deepStrictEqual([d.format, d.version, d.settings, d.clock.unit, d.clock.actors, d.summary.title, d.summary.date], ['donghyunsam-save', 1, SET, 'month', ['liubei'], '유비', '200년 4월']);
  for (let i = 0; i < 5; i++) month(a);
  const b = mk(99); b.scene.start('cao'); month(b);                                     // 조조로 한 달을 하던 화면
  const r = b.scene.loadGame(d); assert.ok(r.ok, r.why); assert.deepStrictEqual([b.scene.mode, b.scene.game.player, b.engine.clock.label, b.engine.rng.state], ['play', 'liubei', '200년 4월', d.rng]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(b.scene.game)), d.game); assert.ok(/저장한 판을 불러왔다 · 유비 · 200년 4월/.test(r.text));
  for (let i = 0; i < 5; i++) month(b);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(b.scene.game)), JSON.parse(JSON.stringify(a.scene.game)), '다섯 달 뒤의 판이 같다');
  assert.deepStrictEqual([b.engine.clock.label, b.engine.rng.state, b.scene.game.months], [a.engine.clock.label, a.engine.rng.state, 8]);
  assert.deepStrictEqual(pack(b).game, pack(a).game);
});
ok('동현삼 저장: 적용된 동현랭 설정이 함께 저장된다 · 불러오면 편집기와 상관없이 그 설정으로 이어진다', () => {
  const a = mk(3, DH.Sam.lang.compose(SET)); a.scene.start('liubei'); month(a);
  const d = pack(a), b = mk(3, DH.Sam.lang.compose([[10, 500]]));                       // 다른 설정으로 열려 있던 화면
  assert.strictEqual(b.scene.state.rules.draft.troops, 500); assert.ok(b.scene.loadGame(d).ok);
  assert.deepStrictEqual(b.scene.state, a.scene.state); assert.deepStrictEqual(b.scene.settings, SET); assert.deepStrictEqual([b.scene.game.goal, b.scene.game.stage.months, b.scene.game.rules.draft.troops, b.scene.game.rules.ai.needRatio], [6, 60, 2000, 1.5]);
  assert.strictEqual(b.scene.game.officers.get(122).war, 60, '장수 능력치 설정도 되살아난다');
  const e = mk(3); e.scene.start('sun'); const d0 = pack(e); assert.deepStrictEqual(d0.settings, []); assert.ok(b.scene.loadGame(d0).ok); assert.deepStrictEqual(b.scene.state, DH.Sam.newState(), '설정 없이 저장한 판은 기본값으로 돌아온다');
  const rep = DH.Sam.lang.applySettings(SET, DH.Sam.newState(), { world: a.world }), viaScript = DH.Sam.newState(); DH.Sam.applyDonghyunLang(DH.Sam.lang.compose(SET), viaScript, { world: a.world });
  const direct = DH.Sam.newState(); DH.Sam.lang.applySettings(SET, direct, { world: a.world }); assert.deepStrictEqual(direct, viaScript, '설정 목록으로 지은 값 = 동현랭 코드로 지은 값'); assert.ok(rep.ok && rep.applied.length === SET.length);
});
ok('동현삼 저장: 맞지 않는 묶음은 까닭을 말하고 하던 판을 그대로 둔다', () => {
  const k = mk(5); k.scene.start('liubei'); month(k); const good = pack(k); month(k);
  const g = k.scene.game, before = JSON.stringify(g), clock = k.engine.clock.label, rng = k.engine.rng.state, st = k.scene.state;
  const cases = [
    [null, /동현삼 저장 파일이 아니다/], [{ format: 'donghyunhang-save', version: 1 }, /동현삼 저장 파일이 아니다/], [d => { d.version = 2; }, /지원하지 않는 저장 형식 버전이다\(2\)/],
    [d => { delete d.settings; }, /저장된 설정이 맞지 않는다/], [d => { d.settings = [[10, 50]]; }, /저장된 설정이 맞지 않는다.*징병 수량/], [d => { d.settings = [[999, 1]]; }, /저장된 설정이 맞지 않는다/], [d => { d.settings = [[10]]; }, /값은 1개여야 한다/],
    [d => { d.clock.unit = 'day'; }, /날짜 정보가 맞지 않는다/], [d => { d.clock.month = 13; }, /날짜 정보/], [d => { d.clock.actors = ['cao']; }, /날짜 정보/], [d => { d.rng = -1; }, /난수 정보가 맞지 않는다/], [d => { d.rng = 1.5; }, /난수 정보/],
    [d => { delete d.game; }, /판 정보가 없다/], [d => { d.game.player = 'nobody'; }, /군주가 자료에 없다/], [d => { d.game.months = -1; }, /진행 정보/], [d => { d.game.over = 'won'; }, /진행 정보/],
    [d => { d.game.provinces.pop(); }, /주 정보가 자료와 맞지 않는다/], [d => { d.game.provinces[0].owner = 'nobody'; }, /주 정보/], [d => { d.game.provinces[1].id = d.game.provinces[0].id; }, /주 정보/], [d => { d.game.provinces[3].troops = -5; }, /주 정보/], [d => { d.game.provinces[3].gold = '300'; }, /주 정보/],
    [d => { d.game.officers[0].province = 999; }, /장수 정보가 자료와 맞지 않는다/], [d => { d.game.officers[0].war = 101; }, /장수 정보/], [d => { d.game.officers[0].status = 'free'; }, /장수 정보/], [d => { d.game.factions[0].alive = 1; }, /세력 정보가 자료와 맞지 않는다/]];
  for (const [c, re] of cases) {
    const d = typeof c === 'function' ? JSON.parse(JSON.stringify(good)) : c; if (typeof c === 'function') c(d);
    const r = k.scene.loadGame(d); assert.ok(!r.ok && re.test(r.why), `${re} ← ${r.why}`);
    assert.ok(k.scene.game === g && k.scene.state === st && JSON.stringify(g) === before && k.engine.clock.label === clock && k.engine.rng.state === rng, '하던 판이 바뀌었다 ' + re);
  }
  assert.ok(k.scene.loadGame(good).ok, '멀쩡한 묶음은 그 뒤에도 불러진다'); assert.strictEqual(k.scene.game.months, 1);
  assert.throws(() => DH.Sam.Game.restore(k.world, { ...good.game, provinces: [] }), /주 정보/); assert.throws(() => k.engine.checkSnapshot({ clock: good.clock, rng: 2 ** 32 }), /난수/);
});
ok('동현삼 저장: 우리 차례의 지도에서만 저장한다 · 불러오기는 전투 중에도 된다(전투를 접는다) · 끝난 판도 저장된다', () => {
  const k = mk(5), s = k.scene; assert.deepStrictEqual(s.saveInfo(), { ok: false, why: '군주를 고른 뒤에 저장할 수 있다.' });
  s.start('liubei'); assert.deepStrictEqual(s.saveInfo(), { ok: true }); const d = pack(k);
  s.command('end'); assert.strictEqual(s.mode, 'busy'); assert.ok(/다른 군주들의 차례가 끝난 뒤/.test(s.saveInfo().why)); for (let i = 0; i < 40000 && s.mode === 'busy'; i++) { const t = k.engine.scene; if (t !== s) { if (t.mode === 'result') t.command('back'); else if (t.myTurn) t.command('auto'); } k.engine.step(1); }
  s.selected = 12; s.command('attack'); s.command('to:10'); s.command('n:5000'); assert.ok(k.engine.scene instanceof DH.Sam.SamBattleScene); assert.ok(/전투가 끝난 뒤/.test(s.saveInfo().why));
  const r = s.loadGame(d); assert.ok(r.ok); assert.ok(k.engine.scene === s && s.mode === 'play' && s.game.months === 0 && s.game.P(12).troops === 5000, '전투를 접고 저장한 달로 돌아온다');
  const w = mk(2, DH.Sam.lang.compose([[20, 2]])); w.scene.start('liubei'); assert.deepStrictEqual([w.scene.mode, w.scene.game.over, w.scene.saveInfo().ok], ['over', 'won', true]);
  const dw = pack(w), x = mk(7); assert.ok(x.scene.loadGame(dw).ok); assert.deepStrictEqual([x.scene.mode, x.scene.game.over, x.scene.game.overWhy, x.layout.items[0].id], ['over', 'won', 'goal', 'again']);
  const v = pack(k); assert.deepStrictEqual(Object.keys(v.scene), ['selected', 'mode', 'cam']); v.scene = { selected: 999, cam: { x: 'a' } }; assert.ok(s.loadGame(v).ok); assert.strictEqual(s.selected, null, '화면 정보가 이상하면 버리고 판만 되살린다');
});
ok('동현삼 저장: 동맹도 함께 적힌다 · v0.05까지의 저장 파일(장수 40 · 동맹 없음)도 열린다 · 주인이 바뀐 주의 새 장수는 재야로 남는다', () => {
  const k = mk(5); k.scene.start('liubei'); k.scene.game.pacts.set(k.scene.game.pactKey('liubei', 'sun'), 7); const d = pack(k); assert.deepStrictEqual(d.game.pacts, [['liubei', 'sun', 7]]);
  const b = mk(9); assert.ok(b.scene.loadGame(d).ok); assert.deepStrictEqual(b.scene.game.alliesOf('liubei'), [{ id: 'sun', months: 7 }]);
  const bad = JSON.parse(JSON.stringify(d)); bad.game.pacts = [['liubei', 'liubei', 3]]; assert.ok(/동맹 정보가 맞지 않는다/.test(b.scene.loadGame(bad).why)); bad.game.pacts = [['liubei', 'sun', 0]]; assert.ok(/동맹 정보/.test(b.scene.loadGame(bad).why));
  const old = JSON.parse(JSON.stringify(d)); delete old.game.pacts; old.game.officers = old.game.officers.filter(o => o.id < 210); assert.strictEqual(old.game.officers.length, 40);
  old.game.provinces.find(p => p.id === 10).owner = 'liubei';                                    // 예전 판에서 복양을 차지해 둔 저장 파일
  const c = mk(3), r = c.scene.loadGame(old); assert.ok(r.ok, r.why); const g = c.scene.game;
  assert.strictEqual(g.officers.size, 71); assert.strictEqual(g.pacts.size, 0); assert.deepStrictEqual([g.officers.get(302).faction, g.officers.get(302).status, g.officers.get(302).province], ['cao', 'active', 15], '새로 더한 장수는 자료 그대로 들어온다');
  assert.deepStrictEqual([g.officers.get(301).faction, g.officers.get(301).status], [null, 'free'], '복양의 주인이 바뀌었으니 정욱은 재야로 남는다'); assert.deepStrictEqual(g.officersOf(10), []);
  assert.ok(c.layout.logs.some(t => /v0\.05까지의 저장 파일이다/.test(t)), '장수 없는 주가 있다고 알린다'); c.endMonth(); assert.strictEqual(c.scene.game.P(10).owner, null, '달이 바뀌면 공백지가 된다');
});
ok('동현삼 화면: 시혜 · 동맹 청하기 · 동맹 깨기 · 공백지 진주를 조작 창으로 한다 · 숫자는 1 농지 개발 … 6 시혜 · 7 동맹 · 8 턴 종료', () => {
  const k = mk(5), s = k.scene; s.start('liubei'); s.selected = 12;
  assert.deepStrictEqual(k.layout.keyed().filter(x => x.n).map(x => [x.n, x.id]), [[1, 'develop'], [2, 'draft'], [3, 'move'], [4, 'search'], [5, 'attack'], [6, 'relief'], [7, 'ally'], [8, 'end']]);
  k.key('Digit6'); assert.deepStrictEqual([s.game.P(12).loyalty, s.game.P(12).rice, s.game.P(12).acted], [74, 1000, true]); assert.ok(k.layout.logs.some(t => /소패: 쌀 500을 풀었다\. 민심 65 → 74/.test(t)));
  s.selected = 13; s.refresh(); k.key('Digit7'); assert.deepStrictEqual(s.sub, { type: 'ally', step: 'f' }); assert.deepStrictEqual(k.layout.items.map(x => x.id), ['af:cao', 'af:yuan', 'af:sun', 'cancel']); assert.ok(/조조에 청한다 · 금 300 · 65%/.test(k.layout.items[0].label), k.layout.items[0].label);
  k.key('Escape'); assert.strictEqual(s.sub, null); let made = false; for (let i = 0; i < 40 && !made; i++) { s.game.P(13).acted = false; s.game.P(13).gold = 300; s.selected = 13; s.command('ally'); s.command('af:sun'); made = s.game.allied('liubei', 'sun'); }
  assert.ok(made, '여러 번 청하면 맺어진다'); assert.ok(k.layout.logs.some(t => /하비: 손책과 동맹을 맺었다\(12달\)/.test(t))); assert.strictEqual(s.game.P(13).gold, 0);
  s.game.P(13).acted = false; s.refresh(); assert.ok(k.layout.detail && JSON.stringify(k.layout.detail).includes('손책'), '고른 주의 설명에 동맹이 보인다');
  s.command('ally'); assert.deepStrictEqual(k.layout.items.map(x => x.id), ['af:cao', 'af:yuan', 'ab:sun', 'cancel']); s.command('ab:sun'); assert.deepStrictEqual([s.sub.step, s.sub.f], ['break', 'sun']); assert.ok(k.layout.items.find(x => x.id === 'cancel').primary, '깨기는 한 번 더 묻고 노란 단추는 그만두기');
  s.command('abok'); assert.deepStrictEqual([s.game.allied('liubei', 'sun'), s.game.P(12).loyalty, s.sub], [false, 64, null]);
  const z = mk(5), t = z.scene; t.start('liuzhang'); t.selected = 39; t.command('move'); t.command('who:152'); assert.ok(z.layout.items.some(x => x.id === 'to:41'), '장수는 공백지 건녕으로도 간다'); t.command('to:41'); t.command('n:0');
  assert.deepStrictEqual([t.game.P(41).owner, t.game.officers.get(152).province, t.selected], ['liuzhang', 41, 41]); assert.ok(z.layout.logs.some(x => /장임이 들어가 공백지를 차지했다/.test(x)));
  t.selected = 39; t.game.P(39).acted = false; t.command('move'); t.command('who:none'); assert.ok(z.layout.items.some(x => x.id === 'to:41') && z.layout.items.some(x => x.id === 'to:38'), '이제 우리 주라 병력만도 간다');
});
ok('동현삼 키보드(지도): 방향키만으로 41개 주에 모두 닿는다 · Space는 명령이 남은 우리 주를 돈다 · Shift+방향키와 W A S D는 지도를 옮긴다', () => {
  const k = mk(1), s = k.scene; k.key('ArrowRight'); assert.ok(s.selected !== null, '고른 주가 없으면 화면 가운데에서 가까운 주부터');
  s.selected = null; k.key('Digit3'); assert.deepStrictEqual([s.mode, s.game.player, s.selected], ['play', 'liubei', 12], '숫자 3 = 세 번째 군주 유비');
  const seen = new Set([12]), q = [12], edges = [];
  while (q.length) { const cur = q.shift(); for (const c of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) { s.selected = cur; k.key(c); const to = s.selected; if (to !== cur) { edges.push([cur, c, to]); const A = s.pos.get(cur), B = s.pos.get(to), dx = B.x - A.x, dy = B.y - A.y; assert.ok(c === 'ArrowLeft' ? dx < 0 : c === 'ArrowRight' ? dx > 0 : c === 'ArrowUp' ? dy < 0 : dy > 0, `${c}가 반대쪽으로 갔다 ${cur}→${to}`); } if (!seen.has(to)) { seen.add(to); q.push(to); } } }
  assert.strictEqual(seen.size, 41); assert.ok(edges.length >= 41 * 2, `방향키 이동 ${edges.length}가지`);
  s.selected = null; k.key('Space'); assert.strictEqual(s.selected, 12); k.key('Space'); assert.strictEqual(s.selected, 13); k.key('Space'); assert.strictEqual(s.selected, 12); k.key('Space', { shiftKey: true }); assert.strictEqual(s.selected, 13);
  k.key('Digit2'); assert.ok(s.game.P(13).acted && s.game.P(13).troops === 6000, '숫자 2 = 징병'); k.key('Space'); k.key('Space'); assert.strictEqual(s.selected, 12, '명령을 내린 주는 건너뛴다');
  const cam = [s.cam.x, s.cam.y, s.cam.zoom]; k.key('Equal'); assert.ok(s.cam.zoom > cam[2]); const x0 = s.cam.x; k.key('ArrowRight', { shiftKey: true }); assert.ok(s.cam.x > x0 && s.selected === 12, 'Shift+→는 지도를 옮기고 고른 주는 그대로'); const x1 = s.cam.x; k.key('KeyA'); assert.ok(s.cam.x < x1 && s.selected === 12);
  k.key('Escape'); assert.strictEqual(s.selected, null); k.key('Digit1', { ctrlKey: true }); k.key('Digit1', { repeat: true }); assert.strictEqual(s.game.P(12).acted, false, 'Ctrl과 함께 누르거나 누르고 있는 키는 명령이 아니다');
});
ok('동현삼 키보드: 한 달을 키보드로만 보낸다(징병 → 이동 → 턴 종료) · 침공 대상은 방향키로 겨누고 Enter로 정한다', () => {
  const k = mk(5), s = k.scene, g = () => s.game; k.key('Digit3');
  k.key('Digit2'); assert.deepStrictEqual([g().P(12).troops, g().P(12).acted], [6000, true]);
  k.key('Space'); assert.strictEqual(s.selected, 13); k.key('Digit3'); assert.deepStrictEqual([s.sub.type, s.sub.step], ['move', 'who']); k.key('Escape'); assert.strictEqual(s.sub, null, 'Esc는 고르던 것을 그만둔다'); assert.strictEqual(s.selected, 13);
  k.key('Digit3'); const who = k.layout.keyed(); assert.strictEqual(who[who.length - 1].id, 'cancel'); k.key('Digit' + who.find(x => x.id === 'who:none').n); assert.strictEqual(s.sub.step, 'to');
  k.key('ArrowLeft'); assert.strictEqual(s.sub.aim, 12, '이웃 우리 주는 소패뿐'); assert.ok(k.layout.items.find(x => x.id === 'to:12').primary, '겨눈 대상이 노란 단추가 된다'); k.key('Enter'); assert.deepStrictEqual([s.sub.step, s.sub.to], ['n', 12]);
  k.key('Digit' + k.layout.keyed().find(x => /^절반/.test(x.label)).n); assert.deepStrictEqual([s.sub, g().P(13).troops, g().P(12).troops, g().P(13).acted], [null, 2500, 8500, true]);
  k.key('Enter'); assert.strictEqual(s.mode, 'busy', 'Enter = 노란 단추(턴 종료)'); k.key('Digit1'); k.key('ArrowLeft'); k.key('Escape'); assert.strictEqual(s.mode, 'busy', '다른 군주들의 차례에는 키가 듣지 않는다');
  for (let i = 0; i < 40000 && s.mode === 'busy'; i++) { const t = k.engine.scene; if (t !== s) { if (t.mode === 'result') t.command('back'); else if (t.myTurn) t.command('auto'); } k.engine.step(1); }
  assert.deepStrictEqual([s.mode, g().months, k.engine.clock.label], ['play', 1, '200년 2월']);
  k.key('Escape'); while (s.selected !== 12) k.key('Space'); k.key('Digit5'); assert.deepStrictEqual([s.sub.type, s.sub.step, s.sub.aim], ['attack', 'to', undefined]); k.key('Enter'); assert.strictEqual(s.sub.step, 'to', '겨누기 전의 Enter는 아무것도 정하지 않는다');
  k.key('ArrowUp'); const first = s.sub.aim; assert.ok(s.candidates().some(q => q.id === first)); const aims = new Set([first]); for (const c of ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown']) { k.key(c); aims.add(s.sub.aim); }
  assert.deepStrictEqual([...aims].sort((a, b) => a - b), s.candidates().map(q => q.id).sort((a, b) => a - b), '방향키로 침공할 수 있는 이웃을 모두 겨눌 수 있다');
});
ok('동현삼 키보드(전투): 방향키 커서 · Enter로 옮기고 친다 · Space 다음 부대 · 숫자 키 단추 · 결과 카드는 Enter', () => {
  const k = mk(5), s = k.scene; k.key('Digit3'); k.key('Digit5'); k.key('ArrowUp'); while (s.sub.aim !== 10) k.key('ArrowLeft'); k.key('Enter'); k.key('Enter');
  const b = k.engine.scene; assert.ok(b instanceof DH.Sam.SamBattleScene && b.me === 'att' && b.myTurn && b.cur === null, '커서는 키를 쓰기 전에는 없다');
  const me = b.b.alive('att'), foe = b.b.alive('def')[0], u = me[0];
  k.key('Enter'); assert.ok(b.sel === u && b.cur.c === u.c && b.cur.r === u.r, '커서가 없을 때의 Enter는 우리 부대를 잡는다'); k.key('Escape'); assert.strictEqual(b.sel, null);
  k.key('Space'); assert.strictEqual(b.sel, u);
  // 커서: 좌우는 한 칸, 위아래는 엇갈린 줄을 지그재그로 곧게 내려간다. 판 밖으로는 나가지 않는다
  const at = () => [b.cur.c, b.cur.r]; b.cur = { c: 3, r: 4 }; b.curX = b.grid.center(3, 4).x; const xs = [];
  for (let i = 0; i < 5; i++) { k.key('ArrowDown'); xs.push(b.grid.center(...at()).x); } assert.strictEqual(b.cur.r, 9); assert.ok(xs.every(x => Math.abs(x - b.curX) <= b.grid.center(1, 0).x - b.grid.center(0, 0).x + 0.01) && Math.abs(xs[1] - b.curX) < 0.01, '위아래로는 가로 자리를 지킨다');
  k.key('ArrowDown'); assert.strictEqual(b.cur.r, 9); for (let i = 0; i < 12; i++) k.key('ArrowUp'); assert.strictEqual(b.cur.r, 0); for (let i = 0; i < 12; i++) k.key('ArrowLeft'); assert.strictEqual(b.cur.c, 0); for (let i = 0; i < 12; i++) k.key('ArrowRight'); assert.strictEqual(b.cur.c, 9);
  // 갈 수 있는 칸 가운데 적에 가장 가까운 칸으로 커서를 옮겨 Enter
  const goal = [...b.reach.values()].filter(v => !b.b.unitAt(v.c, v.r)).sort((p, q) => b.grid.distance(p.c, p.r, foe.c, foe.r) - b.grid.distance(q.c, q.r, foe.c, foe.r) || p.r - q.r || p.c - q.c)[0];
  const go = (c, r) => { for (let i = 0; i < 40 && b.cur.r !== r; i++) k.key(b.cur.r < r ? 'ArrowDown' : 'ArrowUp'); for (let i = 0; i < 40 && b.cur.c !== c; i++) k.key(b.cur.c < c ? 'ArrowRight' : 'ArrowLeft'); assert.deepStrictEqual(at(), [c, r]); };
  go(goal.c, goal.r); k.key('Enter'); assert.deepStrictEqual([u.c, u.r, u.moved], [goal.c, goal.r, true], 'Enter로 커서 칸에 옮긴다');
  // 남은 부대는 숫자 1(대기)로 마친다 → 차례가 넘어가고 적이 움직인다
  for (let i = 0; i < 6 && b.b.alive('att').some(x => !x.done); i++) { k.key('Space'); if (b.sel) k.key('Digit1'); } assert.ok(b.b.alive('att').every(x => x.done));
  const day = b.b.day; for (let i = 0; i < 3000 && !(b.myTurn && b.b.day > day) && b.mode === 'fight'; i++) k.engine.step(1);
  // 적이 붙어 있으면 커서를 적에게 옮겨 Enter로 친다. 아니면 다가간다
  let hit = false;
  for (let turn = 0; turn < 30 && b.mode === 'fight' && !hit; turn++) {
    for (const x of b.b.alive('att').filter(v => !v.done)) {
      b.select(x); b.cur = { c: x.c, r: x.r }; b.curX = b.grid.center(x.c, x.r).x; const t = b.b.targets(x)[0];
      if (t) { const before = t.troops; go(t.c, t.r); k.key('Enter'); assert.ok(t.troops < before && x.done, 'Enter로 커서 칸의 적을 친다'); hit = true; break; }
      const near = [...b.reach.values()].filter(v => !b.b.unitAt(v.c, v.r)).sort((p, q) => b.grid.distance(p.c, p.r, foe.c, foe.r) - b.grid.distance(q.c, q.r, foe.c, foe.r) || p.r - q.r || p.c - q.c)[0];
      if (near) { go(near.c, near.r); k.key('Enter'); const t2 = b.b.targets(x)[0]; if (t2 && !x.done) { const before = t2.troops; go(t2.c, t2.r); k.key('Enter'); assert.ok(t2.troops < before); hit = true; break; } } else k.key('Digit1');
    }
    if (!hit && b.mode === 'fight') { const d0 = b.b.day; if (b.myTurn && b.b.alive('att').every(x => x.done) === false) k.key('Digit2'); for (let i = 0; i < 3000 && !(b.myTurn && b.b.day > d0) && b.mode === 'fight'; i++) k.engine.step(1); }
  }
  assert.ok(hit, '키보드만으로 적을 쳤다');
  if (b.mode === 'fight') { k.key('Digit4'); assert.strictEqual(b.ask, true, '숫자 4 = 퇴각(되묻는다)'); k.key('Enter'); assert.strictEqual(b.ask, false, '되묻는 창의 Enter = 노란 단추(돌아가기)'); k.key('Digit3'); assert.strictEqual(b.auto, true, '숫자 3 = 맡기기'); }
  for (let i = 0; i < 20000 && b.mode !== 'result'; i++) k.engine.step(1); assert.strictEqual(b.mode, 'result');
  k.key('Enter'); assert.ok(k.engine.scene === b, '결과 카드는 반 초 뒤부터 넘어간다'); k.engine.step(31); k.key('Enter'); assert.ok(k.engine.scene === s && s.mode !== 'pick');
  const onTap = DH.Sam.SamBattleScene.prototype.onTap.toString(); assert.ok(/this\.cur = null/.test(onTap) && /tapCell/.test(onTap), '손으로 찍으면 커서가 숨고 같은 길(tapCell)로 간다');
});
console.log(`핵심 시험 ${n}개 통과`);
