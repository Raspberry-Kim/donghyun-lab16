// 동현삼 화면 시험(Playwright): node build.cjs 뒤에 node qa/ui.cjs
const { chromium } = require('/home/user/node_modules/playwright'); const assert = require('assert'), fs = require('fs'), path = require('path'), fmt = n => Number(n).toLocaleString('ko-KR');
const url = 'file://' + path.join(__dirname, '..', 'index.html'), shot = path.join(__dirname, 'tmp'); fs.mkdirSync(shot, { recursive: true });
(async () => {
  const b = await chromium.launch(), errs = []; let n = 0; const ok = s => { n++; console.log('ok ' + s); };
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
  p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
  await p.goto(url); await p.waitForTimeout(500);
  await p.waitForFunction(() => window.__dh && !document.querySelector('#run').disabled);
  /** 캔버스를 화면 가운데로 올리고, 캔버스 안 (x, y)의 화면 좌표를 준다 */
  const at = (x, y) => p.evaluate(([x, y]) => { const cv = document.querySelector('.dh-canvas'); cv.scrollIntoView({ block: 'center' }); const r = cv.getBoundingClientRect(); return [r.left + x, r.top + y]; }, [x, y]);
  const info = () => p.$$eval('.dh-info-item', a => Object.fromEntries(a.map(e => [e.querySelector('dt').textContent, e.querySelector('dd').textContent])));
  const rows = () => p.$$eval('.dh-rows dt', a => Object.fromEntries(a.map(e => [e.textContent, e.nextElementSibling.textContent])));
  const clickWorld = async (x, y) => { const s = await p.evaluate(([x, y]) => { const cv = document.querySelector('.dh-canvas'); cv.scrollIntoView({ block: 'center' }); const c = __dh.scene.cam.toScreen(x, y), r = cv.getBoundingClientRect(); return { x: r.left + c.x * r.width / 480, y: r.top + c.y * r.height / 360 }; }, [x, y]); await p.mouse.click(s.x, s.y); };
  const ink = () => p.evaluate(() => { const c = document.querySelector('.dh-canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, s = new Set(); for (let i = 0; i < d.length; i += 4 * 97) s.add(d[i] << 16 | d[i + 1] << 8 | d[i + 2]); return s.size; });

  // 1) 화면 나누기(데스크톱): 위 띠 · 가운데 캔버스 · 오른쪽 조작 창
  const L = await p.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { top: r('.dh-top'), stage: r('.dh-stage'), panel: r('.dh-panel'), dpr: devicePixelRatio, cw: document.querySelector('.dh-canvas').width }; });
  assert.ok(L.top.bottom <= L.stage.top && L.panel.left >= L.stage.right && Math.abs(L.panel.top - L.stage.top) < 2, '오른쪽 조작 창'); assert.ok(Math.abs(L.stage.width / L.stage.height - 480 / 360) < 0.01); assert.strictEqual(L.cw, 480 * L.dpr);
  ok('화면 나누기: 위 정보 띠 · 가운데 캔버스(4:3) · 오른쪽 조작 창');

  // ───────── 동현삼 ─────────
  const G = fn => p.evaluate(fn), step = n => p.evaluate(n => __dh.engine.step(n), n), menu = () => p.$$eval('.dh-menu button', a => a.map(e => e.dataset.id + (e.disabled ? '!' : '')));
  const title = () => p.$eval('.dh-detail-title', e => e.textContent), logTop = (k = 1) => p.$$eval('.dh-log li', (a, k) => a.slice(0, k).map(e => e.textContent).join(' / '), k);
  const tapProv = async id => { const P = await p.evaluate(id => __dh.scene.pos.get(id), id); await clickWorld(P.x, P.y); };
  const tapHex = async (c, r) => { const q = await p.evaluate(([c, r]) => { const cv = document.querySelector('.dh-canvas'); cv.scrollIntoView({ block: 'center' }); const s = __dh.engine.scene, P = s.grid.center(c, r), k = s.cam.toScreen(P.x, P.y), R = cv.getBoundingClientRect(); return { x: R.left + k.x * R.width / 480, y: R.top + k.y * R.height / 360 }; }, [c, r]); await p.mouse.click(q.x, q.y); };
  const bs = () => G(() => { const s = __dh.engine.scene, b = s.b, g = s.grid; return { n: __dh.engine.scenes.length, me: s.me, side: b.side, day: b.day, winner: b.winner, mode: s.mode, auto: s.auto, sel: s.sel && s.sel.id,
    units: b.units.map(u => ({ id: u.id, name: u.name, side: u.side, c: u.c, r: u.r, troops: u.troops, done: u.done, moved: u.moved, war: u.war })), reach: [...s.reach.values()].map(v => [v.c, v.r, v.cost, b.at(v.c, v.r)]),
    targets: s.sel ? b.targets(s.sel).map(t => ({ id: t.id, c: t.c, r: t.r, troops: t.troops, def: b.terrain(t.c, t.r).def })) : [], castle: b.castle }; });
  const DHro = w => { const c = w.charCodeAt(w.length - 1), f = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0; return (f === 0 || f === 8 ? '와' : '과') + ' 해전'; };
  const hexDist = (a, b) => { const x1 = a[0] - (a[1] - (a[1] & 1)) / 2, x2 = b[0] - (b[1] - (b[1] & 1)) / 2, dx = x1 - x2, dz = a[1] - b[1]; return Math.max(Math.abs(dx), Math.abs(dz), Math.abs(dx + dz)); };
  const px = (c, r, dx = 0, dy = 0) => p.evaluate(([c, r, dx, dy]) => { const s = __dh.engine.scene, P = s.grid.center(c, r), k = s.cam.toScreen(P.x + dx, P.y + dy), cv = document.querySelector('.dh-canvas'), f = cv.width / 480; return [...cv.getContext('2d').getImageData(Math.round(k.x * f), Math.round(k.y * f), 1, 1).data].slice(0, 3); }, [c, r, dx, dy]);
  /** 다른 군주들의 차례가 끝날 때까지 돌린다. 우리 주가 침공받으면 onBattle이 맡는다(없으면 '맡기기'). */
  const finishAI = async (onBattle) => { let fights = 0;
    for (let i = 0; i < 400; i++) { const st = await G(() => ({ mode: __dh.scene.mode, n: __dh.engine.scenes.length })); if (st.n === 2) { fights++; if (onBattle && fights === 1) await onBattle(); else { const b = await bs(); if (b.mode === 'fight' && !b.auto && b.side === b.me) await p.click('button[data-id=auto]'); else if (b.mode === 'result') { await step(40); await p.click('button[data-id=back]'); } else await step(20); } } else if (st.mode !== 'busy') return fights; else await step(10); }
    throw new Error('다른 군주들의 차례가 끝나지 않는다'); };
  await G(() => __dh.engine.stop());                         // 시간에 기대지 않고 틱으로 돌린다

  // 2) 군주 고르기 전: 지도 · 주 찍기
  assert.deepStrictEqual(await info(), { 날짜: '200년 1월', 군주: '고르는 중', 주: '41', 병력: '-', '남은 명령': '-' }); await step(1); assert.ok(await ink() > 6, '지도가 비었다');
  assert.strictEqual(await title(), '군주를 고른다'); assert.deepStrictEqual((await menu()).filter(x => x.startsWith('f:')), ['cao', 'yuan', 'liubei', 'liubiao', 'sun', 'liuzhang', 'zhanglu', 'mateng', 'gongsundu'].map(x => 'f:' + x));
  await tapProv(14); assert.strictEqual(await title(), '허창 許昌'); const r1 = await rows();
  assert.deepStrictEqual([r1.세력, r1.인구, r1.병력, r1.충성도, r1.농지], ['조조', '420,000', '8,000', '70', '60']); assert.ok(r1.장수.startsWith('조조(무80 지95 매95)') && r1.이웃.startsWith('진류(조조 8,000) · 여남('), JSON.stringify(r1));
  await tapProv(25); assert.ok(!(await rows()).장수.includes('제갈량'), '재야 장수는 수색하기 전에는 보이지 않는다');
  await p.mouse.click(...(await at(8, 8))); assert.strictEqual(await title(), '군주를 고른다');
  ok('동현삼: 군주 고르기 화면 · 주 찍기(허창·양양) · 병력·충성도·농지 · 재야 장수는 숨김');

  // 3) 유비로 시작 → 농지 개발 · 징병 → 턴 종료
  await p.click('button[data-id="f:liubei"]');
  assert.deepStrictEqual(await info(), { 날짜: '200년 1월', 군주: '유비', 주: '2', 병력: '10,000', '남은 명령': '2' }); assert.strictEqual(await title(), '소패 小沛'); assert.strictEqual((await rows()).세력, '유비 · 우리 땅');
  assert.deepStrictEqual(await menu(), ['develop', 'draft', 'move', 'search', 'attack', 'end', 'zin', 'zout']);
  await p.click('button[data-id=develop]'); let r = await rows(); assert.ok(r.농지 === '51' && r.금.startsWith('450 ') && r.충성도 === '67', JSON.stringify(r)); assert.ok((await logTop()).includes('농지를 넓혔다(45 → 51)'));
  assert.deepStrictEqual(await menu(), ['develop!', 'draft!', 'move!', 'search!', 'attack!', 'end', 'zin', 'zout'], '한 달에 한 번'); assert.strictEqual((await info())['남은 명령'], '1'); assert.ok((await p.$eval('.dh-note', e => e.textContent)).includes('이미 내렸다'));
  await tapProv(13); assert.strictEqual(await title(), '하비 下邳'); await p.click('button[data-id=draft]'); r = await rows(); assert.deepStrictEqual([r.병력, r.충성도, r.인구], ['6,000', '62', '259,000']);
  assert.deepStrictEqual([(await info()).병력, (await info())['남은 명령']], ['11,000', '0']);
  await tapProv(11); assert.deepStrictEqual((await menu()).slice(0, 6), ['develop!', 'draft!', 'move!', 'search!', 'attack!', 'end'], '남의 땅에는 명령이 없다');
  await p.click('button[data-id=end]'); assert.strictEqual(await G(() => __dh.scene.mode), 'busy'); assert.ok((await menu()).includes('end!')); assert.strictEqual(await finishAI(), 0, '첫 달에는 침공받지 않는다');
  assert.deepStrictEqual(await info(), { 날짜: '200년 2월', 군주: '유비', 주: '2', 병력: '11,000', '남은 명령': '2' }); assert.ok((await logTop(3)).includes('200년 2월이 되었다'));
  const m2 = await G(() => { const g = __dh.game; return { sp: [g.P(12).gold, g.P(12).rice, g.P(12).loyalty], jl: g.P(11).troops, xc: g.P(14).troops, months: g.months }; });
  assert.deepStrictEqual(m2, { sp: [537, 1654, 68], jl: 13000, xc: 4000, months: 1 }, '세금·수확·군량 · 진류는 징병했고(+1,000) 후방의 허창이 병력 절반(4,000)을 진류로 보냈다');
  ok('동현삼: 유비로 시작 · 농지 개발(45 → 51) · 징병(+1,000, 충성도 −3) · 주마다 한 달에 한 번 · 턴 종료 뒤 AI가 움직이고 달이 넘어간다');

  // 4) 이동(누가 → 어디로(지도 찍기) → 병력) · 수색
  await tapProv(12); await p.click('button[data-id=move]'); assert.deepStrictEqual(await menu(), ['who:121', 'who:123', 'who:none', 'cancel']); await p.click('button[data-id="who:123"]');
  assert.deepStrictEqual(await menu(), ['to:13', 'cancel']); await step(1); await tapProv(13); assert.deepStrictEqual(await menu(), ['n:0', 'n:2500', 'n:5000', 'cancel']); assert.strictEqual(await title(), '소패 小沛', '대상을 찍어도 고른 주는 그대로다');
  await p.click('button[data-id="n:2500"]'); assert.deepStrictEqual(await G(() => { const g = __dh.game; return [g.P(12).troops, g.P(13).troops, g.officers.get(123).province, g.P(12).acted]; }), [2500, 8500, 13, true]); assert.ok((await logTop()).includes('장비가 병력 2,500과 함께 옮겨 갔다'));
  await p.click('button[data-id=zin]'); await tapProv(13); await p.click('button[data-id=move]'); await p.click('button[data-id=cancel]'); assert.ok((await menu()).includes('search'), '그만두면 명령 메뉴로'); await p.click('button[data-id=zout]');
  await p.click('button[data-id=search]'); assert.ok(/^하비: /.test(await logTop())); assert.strictEqual((await info())['남은 명령'], '0');
  ok('동현삼: 이동(장비 + 병력 2,500 → 하비, 지도에서 대상 찍기) · 그만두기 · 수색');

  // 5) 침공받는다: 진류(13,000)가 병력이 줄어든 소패(2,500)로 쳐들어온다 → 수비 측으로 전장에 선다 → 퇴각을 되묻는다 → 맡기기
  await p.click('button[data-id=end]'); let defended = null;
  const fights = await finishAI(async () => {
    let d = await bs(); assert.deepStrictEqual([d.me, d.side, d.mode, d.day], ['def', 'att', 'fight', 1]); assert.deepStrictEqual(await menu(), ['wait!', 'end!', 'auto!', 'retreat!'], '남의 차례에는 손댈 수 없다');
    assert.deepStrictEqual(await info(), { 전장: '소패', 날: '1/20일', 차례: '공격 측', '공격 조조': '9,100', '수비 유비': '2,500' }); assert.ok((await logTop(2)).includes('조조 군이 진류에서 소패로 쳐들어갔다(유비 · 병력 9,100 대 2,500)'));
    assert.deepStrictEqual(d.units.map(u => [u.side, u.name, u.troops, u.war, u.c, u.r]), [['att', '허저', 9100, 95, 1, 4], ['def', '유비', 2500, 75, d.castle[0], d.castle[1]]], '허창에서 병력과 함께 온 허저 대 성 위의 유비');
    for (let i = 0; i < 40 && d.side !== 'def' && !d.winner; i++) { await step(20); d = await bs(); } assert.strictEqual(d.side, 'def', '공격 측이 움직인 뒤 우리 차례가 온다'); assert.ok(d.units[0].c > 1, '공격 측 AI가 다가왔다');
    await p.click('button[data-id=retreat]'); assert.deepStrictEqual(await menu(), ['yes', 'no']); await p.click('button[data-id=no]'); assert.deepStrictEqual(await menu(), ['wait!', 'end', 'auto', 'retreat']); assert.strictEqual((await bs()).winner, null);
    await p.click('button[data-id=auto]'); for (let i = 0; i < 200 && (d = await bs()).mode !== 'result'; i++) await step(40); assert.strictEqual(d.mode, 'result'); defended = d.winner;
    await step(40); await p.screenshot({ path: shot + '/ui-sam-defeat.png' }); await p.click('button[data-id=back]');
  });
  assert.ok(fights >= 1 && defended, '침공받았다'); assert.strictEqual(await G(() => __dh.engine.scenes.length), 1);
  const lost = await G(() => { const g = __dh.game; return { owner: g.P(12).owner, liu: g.officers.get(121).province, over: g.over, mode: __dh.scene.mode, hh: g.officers.get(105).province }; });
  assert.deepStrictEqual([defended, lost.owner, lost.liu, lost.hh, lost.over, lost.mode], ['att', 'cao', 13, 12, null, 'play'], '소패는 조조에게 넘어가고 유비는 하비로 물러났다 · 허저가 소패로 들어왔다');
  assert.deepStrictEqual([(await info()).날짜, (await info()).주], ['200년 3월', '1']); assert.ok((await logTop(4)).includes('조조 군이 소패를 차지했다'));
  ok('동현삼: 진류가 소패로 쳐들어왔다(9,100 대 2,500) → 수비 측 전장 · 퇴각 되묻기 · 맡기기 → 소패를 내주고 유비는 하비로 · 달이 넘어간다');

  // 6) 침공 → 육각 전장에서 손으로 싸운다 → 주인이 바뀌고 지도로 돌아온다
  const pre = await G(() => { const g = __dh.game; return { mine: g.P(13).troops, foe: g.P(16).troops, owner: g.P(16).owner, n: g.provincesOf('liubei').length, who: g.fighters(13).map(o => o.name), ids: g.fighters(13).map(o => o.id), all: g.officersOf(13).map(o => o.id) }; }); assert.ok(pre.mine >= 8500 && pre.owner === 'cao');
  assert.strictEqual(pre.who.length, Math.min(3, pre.all.length - 1), '한 명은 남아 하비를 지킨다'); assert.deepStrictEqual(pre.who.slice(0, 2), ['관우', '장비'], '무력 순으로 나선다');
  await tapProv(13); await p.click('button[data-id=attack]'); assert.ok((await menu()).includes('to:16')); await step(1); await tapProv(16); assert.deepStrictEqual(await menu(), ['n:' + Math.floor(pre.mine / 2), 'n:' + pre.mine, 'cancel']); assert.ok((await p.$eval('.dh-note', e => e.textContent)).includes(pre.who.join(' · ') + ' 부대로 나뉘어 나선다'));
  await p.click(`button[data-id="n:${pre.mine}"]`); let B = await bs(); assert.deepStrictEqual([B.n, B.me, B.side, B.day, B.mode], [2, 'att', 'att', 1, 'fight']);
  assert.deepStrictEqual(await info(), { 전장: '수춘', 날: '1/20일', 차례: '공격 측', '공격 유비': fmt(pre.mine), '수비 조조': fmt(pre.foe) }); assert.strictEqual(await title(), '수춘 전투'); assert.deepStrictEqual(await menu(), ['wait!', 'end', 'auto', 'retreat']);
  assert.deepStrictEqual(await G(() => { const b = __dh.engine.scene.b; return [b.grid.cols, b.grid.rows, b.grid.kind]; }), [10, 10, 'hex']); assert.deepStrictEqual(B.units.map(u => u.name), [...pre.who, '수비대']); assert.strictEqual(B.units.filter(u => u.side === 'att').reduce((n, u) => n + u.troops, 0), pre.mine, '보낸 병력을 부대 수로 나눈다');
  const me0 = B.units[0]; assert.deepStrictEqual([me0.c, me0.r], [1, 4]); await step(1); const before = await px(0, 4, 0, 12); await tapHex(1, 4); B = await bs(); await step(1); const after = await px(0, 4, 0, 12);
  assert.strictEqual(B.sel, 'att0'); assert.ok(B.reach.length > 15 && B.reach.every(v => v[2] <= 5), '이동력 5 안쪽만'); assert.ok(before[2] > 150 && after[2] < 140 && after[0] > after[2] + 60, `갈 수 있는 칸이 노랗게 ${before} → ${after}`);
  const COST = { plain: 1, mountain: 3, river: 4, castle: 1 }; for (const v of B.reach) if (hexDist([v[0], v[1]], [1, 4]) === 1) assert.strictEqual(v[2], COST[v[3]], '바로 옆 칸은 그 지형 값'); assert.ok(!B.reach.some(v => v[3] === 'river' && v[2] < 4) && !B.reach.some(v => v[3] === 'mountain' && v[2] < 3));
  const terr = await G(() => __dh.engine.scene.b.tiles.flat().reduce((o, t) => (o[t] = (o[t] || 0) + 1, o), {}));
  let hits = 0, shown = null, moves = 0;
  for (let guard = 0; guard < 80 && !B.winner; guard++) {
    if (B.side !== 'att') { await step(20); B = await bs(); continue; }
    const u = B.units.find(x => x.side === 'att' && x.troops > 0 && !x.done); if (!u) { await step(30); B = await bs(); continue; }           // 모두 마치면 차례가 저절로 넘어간다
    if (B.sel !== u.id) { await tapHex(u.c, u.r); B = await bs(); } assert.strictEqual(B.sel, u.id);
    if (!B.targets.length) { const foe = B.units.filter(x => x.side === 'def' && x.troops > 0).sort((x, y) => hexDist([x.c, x.r], [u.c, u.r]) - hexDist([y.c, y.r], [u.c, u.r]))[0];
      const go = B.reach.filter(v => v[0] !== u.c || v[1] !== u.r).sort((x, y) => hexDist([x[0], x[1]], [foe.c, foe.r]) - hexDist([y[0], y[1]], [foe.c, foe.r]) || x[2] - y[2])[0];
      if (!go) { await p.click('button[data-id=wait]'); B = await bs(); continue; }
      await tapHex(go[0], go[1]); B = await bs(); const mv = B.units.find(x => x.id === u.id); assert.deepStrictEqual([mv.c, mv.r, mv.moved], [go[0], go[1], true], '찍은 칸으로 옮겨 갔다'); moves++; }
    if (B.targets.length) { const t = B.targets[0], me = B.units.find(x => x.id === u.id), want = Math.min(t.troops, Math.floor(me.troops * me.war * (100 - Math.round(t.def * 100)) / 10000));
      const row = Object.entries(await rows()).find(([k]) => k.endsWith(' 치기')); assert.ok(row && row[1].endsWith('= ' + fmt(want)), '조작 창의 피해 셈 ' + JSON.stringify(row)); if (!shown) shown = row[1];
      await step(1); let red = false; for (const dy of [-18, -19, -20, -21, -22, -23, -24]) { const c = await px(t.c, t.r, 0, dy); if (c[0] > 150 && c[1] < 110) red = true; } assert.ok(red, '칠 수 있는 적에 붉은 테');
      await tapHex(t.c, t.r); B = await bs(); const now = B.units.find(x => x.id === t.id); assert.strictEqual(now.troops, t.troops - want, '피해 = 병력 × 무력 ÷ 100 × (1 − 지형)'); assert.ok(B.units.find(x => x.id === u.id).done, '치면 그날은 끝'); hits++; }
    else assert.ok(B.units.find(x => x.id === u.id).done, '칠 적이 없으면 그날 일을 마친다');
  }
  assert.deepStrictEqual([B.winner, B.mode], ['att', 'result'], JSON.stringify(B)); assert.ok(hits >= 2 && moves >= 2); assert.deepStrictEqual(await menu(), ['back']); assert.strictEqual((await info()).차례, '끝'); assert.ok((await rows()).결과.startsWith('이겼다'));
  await step(40); await p.screenshot({ path: shot + '/ui-sam-result.png' }); await p.click('button[data-id=back]');
  const post = await G(() => { const g = __dh.game; return { n: __dh.engine.scenes.length, owner: g.P(16).owner, troops: g.P(16).troops, at: [...g.officers.values()].filter(o => o.faction === 'liubei').map(o => [o.id, o.province]), home: g.P(13).troops, mode: __dh.scene.mode, sel: __dh.scene.selected, acted: g.P(16).acted }; });
  assert.deepStrictEqual([post.n, post.owner, post.home, post.mode, post.sel, post.acted], [1, 'liubei', 0, 'play', 16, true]); for (const [id, at] of post.at) assert.strictEqual(at, pre.ids.includes(id) ? 16 : 13, '나선 장수는 수춘으로, 남은 장수는 하비에'); assert.strictEqual(post.troops, B.units.filter(u => u.side === 'att').reduce((n, u) => n + u.troops, 0), '남은 병력이 그대로 들어간다');
  assert.strictEqual((await info()).주, String(pre.n + 1)); assert.strictEqual(await title(), '수춘 壽春'); assert.strictEqual((await rows()).세력, '유비 · 우리 땅'); assert.ok((await logTop(2)).includes('유비 군이 수춘을 차지했다'));
  await step(1); const dot = await G(() => { const s = __dh.scene, P = s.pos.get(16), k = s.cam.toScreen(P.x, P.y - 3), cv = document.querySelector('.dh-canvas'), f = cv.width / 480; return [...cv.getContext('2d').getImageData(Math.round(k.x * f), Math.round(k.y * f), 1, 1).data].slice(0, 3); });
  assert.ok(dot[1] > dot[0] + 30 && dot[1] > dot[2] + 30, '지도에서 수춘이 유비의 색으로 ' + dot);
  ok(`동현삼: 침공 → 10×10 육각 전장(${Object.entries(terr).map(([k, v]) => k + ' ' + v).join(' · ')}) · 이동 범위(평지 1 · 산 3 · 강 4) · 손으로 ${moves}번 옮기고 ${hits}번 침(${shown}) · 승리 → 수춘의 주인이 유비로 · 지도로 복귀`);

  // 7) 물러난다(퇴각) → 모두 잃으면 판이 끝난다 → 다시 하기
  await G(() => { const g = __dh.game; for (const q of g.provinces.values()) if (q.owner && q.owner !== 'liubei') q.troops = 30000; }); await p.click('button[data-id=end]'); let ret = null;
  await finishAI(async () => { let d = await bs(); const where = (await info()).전장; for (let i = 0; i < 40 && d.side !== 'def' && !d.winner; i++) { await step(20); d = await bs(); }
    await p.click('button[data-id=retreat]'); await p.click('button[data-id=yes]'); d = await bs(); assert.deepStrictEqual([d.winner, d.mode], ['att', 'result']); assert.ok((await rows()).결과.includes('졌다 · 수비 측이 성을 버렸다')); ret = where;
    await step(10); await tapHex(5, 5); assert.strictEqual(await G(() => __dh.engine.scenes.length), 2, '끝난 직후의 손짓은 카드를 넘기지 않는다'); await step(40); await tapHex(5, 5); assert.strictEqual(await G(() => __dh.engine.scenes.length), 1, '결과 카드를 찍으면 지도로 돌아온다'); });
  assert.ok(ret, '침공받았다'); assert.notStrictEqual(await p.evaluate(w => [...__dh.game.provinces.values()].find(q => q.name === w).owner, ret), 'liubei', '물러난 주는 넘어갔다');
  if (!(await G(() => __dh.game.over))) { await G(() => { const g = __dh.game; for (const q of g.provinces.values()) { if (q.owner === 'liubei') q.troops = 0; else if (q.owner) q.troops = 30000; } }); await p.click('button[data-id=end]'); await finishAI(); }
  assert.deepStrictEqual(await G(() => [__dh.game.over, __dh.scene.mode, __dh.game.factions.get('liubei').alive, __dh.game.provincesOf('liubei').length, __dh.game.officers.get(122).status]), ['lost', 'over', false, 0, 'free']);
  assert.deepStrictEqual(await menu(), ['again', 'zin', 'zout']); await step(1); await p.screenshot({ path: shot + '/ui-sam-over.png' });
  await p.click('button[data-id=again]'); assert.strictEqual((await info()).군주, '고르는 중'); await p.click('button[data-id="f:cao"]');
  const caoT = fmt(await G(() => __dh.world.provincesOf('cao').reduce((n, q) => n + q.troops, 0)));
  assert.deepStrictEqual(await info(), { 날짜: '200년 1월', 군주: '조조', 주: '9', 병력: caoT, '남은 명령': '9' }); assert.deepStrictEqual(await G(() => [__dh.game.P(12).owner, __dh.game.P(12).troops, __dh.game.months, __dh.game.over]), ['liubei', 5000, 0, null], '새 판');
  ok(`동현삼: ${ret}에서 퇴각(되물은 뒤) · 주를 모두 잃으면 끝 · 다시 하기 → 조조로 새 판`);
  await G(() => __dh.engine.start());

  // 4) 지도 조작: 바퀴·단추 확대, 끌어 옮기기, 화살표
  const cam = () => p.evaluate(() => { const c = __dh.scene.cam; return { x: c.x, y: c.y, z: c.zoom }; }); const c0 = await cam();
  await p.mouse.move(...(await at(300, 200))); await p.mouse.wheel(0, -300); const c1 = await cam(); assert.ok(c1.z > c0.z);
  await p.click('button[data-id=zin]'); const c2 = await cam(); assert.ok(c2.z > c1.z);
  await p.mouse.move(...(await at(300, 200))); await p.mouse.down(); await p.mouse.move(...(await at(240, 170)), { steps: 4 }); await p.mouse.up(); const c3 = await cam(); assert.ok(c3.x > c2.x && c3.y > c2.y, '끌면 지도가 따라온다');
  await p.focus('.dh-canvas'); await p.keyboard.press('ArrowLeft'); assert.ok((await cam()).x < c3.x, '화살표로 지도를 옮긴다(끌어서 오른쪽 끝에 닿았으니 왼쪽으로)'); for (let i = 0; i < 12; i++) await p.click('button[data-id=zout]'); assert.strictEqual((await cam()).z, 1);
  ok('지도 조작: 바퀴·단추 확대 · 끌기 · 화살표 · 축소 하한');

  // 5) 60FPS 루프
  await p.waitForTimeout(1500); const fps = await p.evaluate(() => __dh.engine.loop.fps); assert.ok(fps >= 50 && fps <= 70, 'fps ' + fps);
  const t0 = await p.evaluate(() => __dh.engine.tick); await p.waitForTimeout(1000); const dt = (await p.evaluate(() => __dh.engine.tick)) - t0; assert.ok(dt >= 50 && dt <= 70, '1초 틱 ' + dt);
  ok(`루프: 초당 그리기 ${fps} · 1초에 논리 틱 ${dt}`);

  // ───────── 동현랭 칸(동현삼) ─────────
  const lang = () => p.evaluate(() => { const o = document.querySelector('#result'); return { ex: [...document.querySelectorAll('#example option')].map(x => x.value), nums: [...document.querySelectorAll('#lang-rows tr')].map(tr => tr.children[0].textContent).join(' '), code: document.querySelector('#code').value, out: o.textContent, state: o.dataset.kind || '' }; });
  const setCode = text => p.fill('#code', text), runLang = async () => { await p.click('#run'); return lang(); }, compose = list => p.evaluate(list => __dh.lang.compose(list, '', { world: __dh.world }), list);
  const label = id => p.$eval(`button[data-id="${id}"]`, e => e.textContent), note = () => p.$eval('.dh-note', e => e.textContent);
  await G(() => __dh.engine.stop());
  let lg = await lang(); assert.deepStrictEqual([lg.ex, lg.nums, lg.state], [['none', 'rich', 'stage', 'fast', 'calm', 'weak', 'unify', 'swap', 'scale', 'loop'], '1 2 3 4 5 6 7 8 10 11 12 13 20 21 22 23 24 30', '']);
  const exNames = await p.$$eval('#example option', a => a.map(o => o.textContent)); assert.deepStrictEqual(exNames.map(t => t.slice(0, 5)), ['01 · ', '02 · ', '03 · ', '04 · ', '05 · ', '06 · ', '07 · ', '08 · ', '09 · ', '10 · ']); assert.strictEqual(exNames[1], '02 · 넉넉한 유비');
  await p.selectOption('#example', 'loop'); lg = await runLang(); assert.strictEqual(lg.state, 'ok'); assert.ok(lg.out.startsWith('설정 8개를 적용하고 새 판을 열었다: 주 초기값 북평 병력 10,000 · '), lg.out); assert.deepStrictEqual(await G(() => [2, 3, 4, 5, 6, 7, 8, 9].map(n => __dh.game.P(n).troops)), Array(8).fill(10000), '반복문 예제: 원소의 여덟 주가 모두 10,000');
  await p.selectOption('#example', 'scale'); lg = await runLang(); assert.ok(lg.out.startsWith('설정 4개를 적용하고 새 판을 열었다: 군주 유비 · 우리 주 시작 금 5,000 · 우리 주 시작 쌀 20,000 · 징병 수량 2,000'), lg.out); assert.ok(lg.code.startsWith('나는 동현이냐?') && lg.code.endsWith('동현이구나'));
  await p.selectOption('#example', 'rich'); assert.ok((await lang()).code.includes('ㅋㅋ 3번')); lg = await runLang(); assert.strictEqual(lg.state, 'ok');
  assert.ok(lg.out.startsWith('설정 5개를 적용하고 새 판을 열었다: 군주 유비 · 우리 주 시작 금 3,000 · 우리 주 시작 쌀 20,000 · 징병 수량 2,000 · 장수 능력치 유비 무력 90'), lg.out);
  assert.deepStrictEqual(await G(() => { const g = __dh.game; return [g.player, g.P(12).gold, g.P(12).rice, g.P(13).gold, g.officers.get(121).war, g.months, __dh.state.rules.draft.troops]; }), ['liubei', 3000, 20000, 3000, 90, 0, 2000]);
  assert.deepStrictEqual([(await info()).군주, (await info()).병력], ['유비', '10,000']); assert.ok((await label('draft')).includes('2,000'), '징병 단추에 수량이 적힌다: ' + await label('draft'));
  await p.click('button[data-id=draft]'); assert.strictEqual((await info()).병력, '12,000', '징병 수량이 설정값(2,000)을 따른다');
  await G(() => { __dh.game.__mark = 1; }); await setCode(await compose([[3, 100000]])); lg = await runLang(); assert.strictEqual(lg.state, 'error'); assert.strictEqual(lg.out, '우리 주 시작 금 값 100,000은 쓸 수 없다. 0~99,999만 된다. 하던 판은 그대로 두었다.');
  await setCode('안녕'); lg = await runLang(); assert.strictEqual(lg.state, 'error'); const badText = lg.out;
  assert.deepStrictEqual(await G(() => [__dh.game.__mark, __dh.game.P(12).gold >= 2800, __dh.state.rules.draft.troops]), [1, true, 2000], '오류가 나면 하던 판과 설정이 그대로다');
  await p.selectOption('#example', 'none'); lg = await runLang(); assert.deepStrictEqual([lg.state, lg.out], ['ok', '설정이 없다. 기본값으로 새 판을 열었다.']); assert.strictEqual((await info()).군주, '고르는 중'); assert.strictEqual(await G(() => __dh.state.rules.draft.troops), 1000);
  ok(`동현랭 칸(동현삼): 예제 열(이름 앞 번호 01~10) · 10 반복문과 09 변수 적용 · 설정 번호 표 18줄 · ‘넉넉한 유비’ 적용(금 3,000 · 쌀 20,000 · 징병 2,000 · 유비 무력 90) · 틀린 값과 동현랭이 아닌 글(“${badText.slice(0, 40)}…”)은 하던 판을 그대로 둔다 · 설정 없음 → 기본값`);

  // ───────── 페이지: 시리즈 띠 · 탭 · 설명 글 · 편집기 · 화면 전환 ─────────
  const NAME = '동현삼', TABS = ['지도', '동현삼 출전 규약', '규칙', '엔진과 자료', '모델과 출처'], HEADS = { protocol: ['설정 번호', '예제 열'], rules: ['놀이 방법', '조작', '동현삼 규칙'], engine: ['엔진의 층', '게임이 얹는 법', '동현랭 어댑터', 'JSON 규격', '파일', '돌려 보기'], about: ['상표와 관계', '이 자료가 무엇이고 무엇이 아닌지', '자료 출처'] };
  const band = await p.evaluate(() => ({ n: document.querySelectorAll('.series-item').length, ctx: document.querySelector('.series-context').textContent, here: [...document.querySelectorAll('.series-item[aria-current=page]')].map(a => a.querySelector('.series-name').textContent), hrefs: [...document.querySelectorAll('a.series-item')].map(a => a.getAttribute('href')),
    ed: document.querySelector('.edition').textContent.trim(), foot: document.querySelector('footer').textContent, title: document.title, left: document.documentElement.innerHTML.match(/__[A-Z_]+__|<!--README/g) }));
  assert.deepStrictEqual([band.n, band.here, band.hrefs.length, band.left], [18, [NAME + '™'], 17, null]); assert.ok(band.ctx.includes('열일곱 개의 작은 세계') && band.ed.startsWith('v0.02') && band.foot.includes(NAME + ' v0.02') && band.title.includes(NAME), JSON.stringify([band.ctx, band.ed, band.title]));
  assert.ok(band.hrefs.every(h => /^https:\/\/raspberry-kim\.github\.io\/donghyun-(lang|lab\d+)\/$/.test(h)) && new Set(band.hrefs).size === 17, '띠의 주소 열일곱 개가 서로 다르다');
  ok(`시리즈 띠 18칸(지금 여기: ${NAME}) · 머리글과 바닥글의 판 번호 v0.02 · 빌드 자리표가 남지 않았다`);

  const tabsNow = () => p.evaluate(() => ({ names: [...document.querySelectorAll('.tabs button')].map(b => b.textContent), on: [...document.querySelectorAll('.tabs button[aria-current=page]')].map(b => b.dataset.tab), shown: [...document.querySelectorAll('.tab-panel')].filter(x => !x.hidden).map(x => x.id), sw: document.documentElement.scrollWidth, run: __dh.engine.loop.running }));
  await G(() => __dh.engine.start()); let T = await tabsNow(); assert.deepStrictEqual([T.names, T.on, T.shown, T.run], [TABS, ['play'], ['tab-play'], true]);
  const docs = {};
  for (const [id, heads] of Object.entries(HEADS)) {
    await p.click(`.tabs button[data-tab=${id}]`); T = await tabsNow(); assert.deepStrictEqual([T.on, T.shown, T.run], [[id], ['tab-' + id], false], id + ' 탭 · 설명을 읽는 동안 판이 멎는다'); assert.ok(T.sw <= 1280, id + ' 가로 넘침 ' + T.sw);
    const d = await p.evaluate(id => { const s = document.querySelector('#tab-' + id); return { heads: [...s.querySelectorAll('h2, h3, h4')].map(h => h.textContent), chars: s.textContent.length, tables: s.querySelectorAll('table').length, pre: s.querySelectorAll('pre').length, raw: /(^|\n)#{1,4} |\*\*|\]\(http/.test(s.textContent),
      wide: [...s.querySelectorAll('table, pre, p, li')].filter(e => { const w = e.closest('.table-wrap') || e; return w.getBoundingClientRect().right > innerWidth + 1; }).length }; }, id);
    for (const h of heads) assert.ok(d.heads.some(x => x.includes(h)), `${id} 탭에 ‘${h}’ 제목이 없다: ${d.heads.join(' | ')}`); assert.ok(d.chars > 1500 && !d.raw && d.wide === 0, id + ' ' + JSON.stringify({ chars: d.chars, raw: d.raw, wide: d.wide })); docs[id] = d;
    await p.screenshot({ path: shot + '/ui-tab-' + id + '.png', fullPage: true });
  }
  assert.ok(docs.protocol.tables >= 1 && docs.protocol.pre >= 1 && docs.engine.tables >= 1 && docs.engine.pre >= 1, '규약과 엔진 탭에 표와 코드 상자');
  await p.click('.tabs button[data-tab=play]'); T = await tabsNow(); assert.deepStrictEqual([T.on, T.shown, T.run], [['play'], ['tab-play'], true], '돌아오면 판이 다시 흐른다');
  await G(() => __dh.engine.stop()); await p.click('.tabs button[data-tab=rules]'); await p.click('.brand'); T = await tabsNow(); assert.deepStrictEqual([T.on, T.run], [['play'], false], '멈춰 둔 판은 돌아와도 멈춰 있다 · 머리글 이름을 누르면 첫 탭');
  ok(`탭 다섯: 설명 탭 넷의 글이 README에서 왔다(${Object.entries(docs).map(([k, d]) => k + ' ' + d.chars.toLocaleString('ko-KR') + '자').join(' · ')}) · 마크다운 기호가 남지 않았다 · 설명을 읽는 동안 판이 멎고 돌아오면 흐른다`);

  // 편집기: 줄 번호 · 색 · 미리 읽기 · ⌘/Ctrl+Enter · .dh 저장과 열기 · 설정 번호 표
  const ed = () => p.evaluate(() => { const c = document.querySelector('#code'); return { code: c.value, lines: document.querySelector('#lines').textContent.split('\n').length, count: document.querySelector('#line-count').textContent, spans: document.querySelectorAll('#hl .ln').length, colors: [...new Set([...document.querySelectorAll('#hl .ln span')].map(s => s.className))].sort().join(' '),
    note: document.querySelector('#example-note').textContent, out: document.querySelector('#result').textContent, kind: document.querySelector('#result').dataset.kind || '', status: document.querySelector('#status').textContent }; });
  await p.selectOption('#example', 'stage'); await p.waitForTimeout(400); let E = await ed(); const nl = E.code.split('\n').length;
  assert.deepStrictEqual([E.lines, E.count, E.spans, E.kind], [nl, nl + '줄', nl + 1, '']); assert.ok(E.colors.includes('t-frame') && E.colors.includes('t-cmt') && E.colors.includes('t-out') && E.colors.includes('t-num'), E.colors);
  assert.ok(E.note.length > 5 && /^읽은 설정 \d+개: .+\. 출전을 누르면 이 값으로 새 판이 열린다\.$/.test(E.out), E.out); const mark = await G(() => { __dh.engine.__mark = 1; return __dh.state.stage; });
  await p.fill('#code', '나는 동현이냐?\n뿡뿡 도오오옹\n동현이구나'); await p.waitForTimeout(400); E = await ed(); assert.deepStrictEqual([E.kind, E.lines, E.code.split('\n')[1]], ['error', 3, '  뿡뿡 도오오옹'], '고치는 동안 읽기만 해 본다 · 몸통 줄은 두 칸 들여 쓴다'); assert.ok(E.out.length > 10 && !E.out.includes('그대로 두었다'));
  assert.deepStrictEqual(await G(() => __dh.state.stage), mark, '미리 읽기는 판을 건드리지 않는다');
  await p.focus('#code'); await p.keyboard.press('Control+Enter'); E = await ed(); assert.deepStrictEqual([E.kind, E.status], ['error', '출전하지 못했다']); assert.ok(E.out.endsWith('하던 판은 그대로 두었다.'), E.out);
  await p.selectOption('#example', 'stage'); const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]); const saved = fs.readFileSync(await dl.path(), 'utf8'); assert.strictEqual(dl.suggestedFilename(), 'sortie.dh'); assert.strictEqual(saved, (await ed()).code + '\n');
  await p.selectOption('#example', 'none'); await p.setInputFiles('#open', { name: 'mine.dh', mimeType: 'text/plain', buffer: Buffer.from(saved.replace(/\n/g, '\r\n')) }); await p.waitForTimeout(400); E = await ed(); assert.strictEqual(E.code + '\n', saved, '.dh를 열면 저장한 그대로'); assert.strictEqual(E.note, '');
  await p.focus('#code'); await p.keyboard.press('Control+Enter'); E = await ed(); assert.strictEqual(E.kind, 'ok'); assert.ok(/^설정 \d+개로 새 판$/.test(E.status) && E.out.startsWith('설정 '), E.status + ' / ' + E.out);
  const rule = await p.evaluate(() => { const d = document.querySelector('.lang-rule'); d.open = true; const t = d.querySelector('table'); return { head: [...t.querySelectorAll('th')].map(x => x.textContent), rows: [...t.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent)), sw: document.documentElement.scrollWidth }; });
  assert.deepStrictEqual(rule.head, ['번호', '설정', '값', '기본값']); assert.strictEqual(rule.rows.length, 18); assert.ok(rule.rows.every(r => r.length === 4 && /^\d+$/.test(r[0]) && r[1] && r[2]) && rule.sw <= 1280, JSON.stringify(rule.rows[0]));
  await p.evaluate(() => document.querySelector('.ed-panel').scrollIntoView({ block: 'center' })); await p.screenshot({ path: shot + '/ui-editor.png' });
  ok(`편집기: 줄 번호와 색 입히기 · 고치는 동안 미리 읽기(판은 그대로) · Ctrl+Enter 출전 · 틀린 코드는 하던 판을 둔다 · sortie.dh 저장 → 열기(줄 끝 CRLF도) → 출전 · 설정 번호 표 ${rule.rows.length}줄`);

  // 화면 전환 · 입력 표식
  const look = () => p.evaluate(() => ({ theme: document.documentElement.dataset.theme || 'light', pressed: document.querySelector('#theme').getAttribute('aria-pressed'), bg: getComputedStyle(document.body).backgroundColor, ink: getComputedStyle(document.body).color }));
  const light = await look(); await p.click('#theme'); const dark = await look(); assert.deepStrictEqual([dark.theme, dark.pressed], ['dark', 'true']); assert.ok(dark.bg !== light.bg && dark.ink !== light.ink, JSON.stringify([light, dark]));
  await p.evaluate(() => scrollTo(0, 0)); await step(1); await p.screenshot({ path: shot + '/ui-dark.png', fullPage: true }); await p.click('#theme'); assert.deepStrictEqual(await look(), light);
  const marks = await p.evaluate(() => [...document.querySelectorAll('.input-marks .mark')].map(e => [e.getAttribute('aria-label'), e.classList.contains('off'), (e.dataset.tip || '').length > 10])); assert.strictEqual(marks.length, 4); assert.ok(marks.every(k => k[0] && k[2] && k[1] === /없음$/.test(k[0])), JSON.stringify(marks));
  ok(`화면 전환: 어두운 화면과 밝은 화면을 오간다 · 입력 표식 넷(${marks.map(k => k[0]).join(' · ')})`);

  // 전체 화면(데스크톱): 지도 아래 단추 → 정보 띠 · 지도 · 조작 창이 화면을 채운다 → 닫으면 제자리
  const fsNow = () => p.evaluate(() => { const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom }; }, cv = document.querySelector('.dh-canvas');
    return { full: __dhFull.isFull(), cls: document.querySelector('#stage-full').className, stage: r('.dh-stage'), panel: r('.dh-panel'), top: r('.dh-top'), exit: !document.querySelector('#exit-full').hidden, exitBox: r('#exit-full'), hint: !document.querySelector('#full-hint').hidden, btn: document.querySelector('#full').textContent, off: document.querySelector('#full').disabled,
      cw: cv.width, iw: innerWidth, ih: innerHeight, focus: document.activeElement === cv, edIn: document.querySelector('#stage-full').contains(document.querySelector('.ed-panel')) }; });
  await p.click('.tabs button[data-tab=play]'); await p.evaluate(() => document.querySelector('#full').scrollIntoView({ block: 'center' })); const F0 = await fsNow(), inkF0 = await ink();
  assert.deepStrictEqual([F0.full, F0.exit, F0.hint, F0.btn, F0.off, F0.cw, F0.edIn], [false, false, false, '전체 화면', false, 480 * L.dpr, false], '편집기는 전체 화면에 들지 않는다');
  await p.click('#full'); await p.waitForTimeout(600); const F1 = await fsNow(); await p.screenshot({ path: shot + '/ui-full-desktop.png' });
  assert.deepStrictEqual([F1.full, F1.exit, F1.hint, F1.btn, F1.focus], [true, true, true, '전체 화면 닫기', true], JSON.stringify(F1.cls)); assert.ok(/\bfs\b/.test(F1.cls) && !/stack|side/.test(F1.cls), '넓은 화면: 지도 옆에 조작 창 · ' + F1.cls);
  assert.ok(F1.stage.w > F0.stage.w + 100 && Math.abs(F1.stage.w / F1.stage.h - 480 / 360) < 0.01, `전체 화면에서 지도가 커진다(4:3 그대로): ${F0.stage.w} → ${F1.stage.w}`);
  assert.ok(F1.top.b <= F1.stage.y + 1 && F1.panel.x >= F1.stage.r - 1 && F1.panel.r <= F1.iw + 1 && F1.stage.b <= F1.ih + 1 && F1.stage.x >= 0, '정보 띠 · 지도 · 조작 창이 모두 화면 안: ' + JSON.stringify([F1.stage, F1.panel, F1.iw, F1.ih]));
  assert.ok(F1.exitBox.r <= F1.iw && F1.exitBox.b <= F1.top.y + 1, '닫기 단추는 정보 띠를 가리지 않는다'); assert.ok(F1.cw >= F1.stage.w && F1.cw > F0.cw && F1.cw % 480 === 0, `커진 만큼 촘촘히 그린다: 캔버스 ${F0.cw} → ${F1.cw}px`); assert.ok(await ink() >= inkF0 * 0.8, '전체 화면에서도 지도가 그려진다');
  await p.click('#exit-full'); await p.waitForTimeout(500); const F2 = await fsNow(); assert.deepStrictEqual([F2.full, F2.exit, F2.hint, F2.btn, F2.cw, F2.cls], [false, false, false, '전체 화면', F0.cw, 'stage-full']); assert.ok(Math.abs(F2.stage.w - F0.stage.w) < 2 && Math.abs(F2.panel.x - F0.panel.x) < 2, '닫으면 제자리');
  await G(() => __dhFull.setPseudo(true)); await p.waitForTimeout(200); assert.strictEqual((await fsNow()).full, true); await p.keyboard.press('Escape'); await p.waitForTimeout(200); const F3 = await fsNow(); assert.deepStrictEqual([F3.full, F3.cw, Math.abs(F3.stage.w - F0.stage.w) < 2], [false, F0.cw, true], '창을 채우는 방식은 Esc로 닫힌다');
  ok(`전체 화면(데스크톱 ${F1.iw}×${F1.ih}): 지도 ${Math.round(F0.stage.w)} → ${Math.round(F1.stage.w)}px(4:3) · 캔버스 ${F0.cw} → ${F1.cw}px · 오른쪽에 조작 창 · 닫기 단추와 5초 안내 · 닫으면 제자리 · 창을 채우는 방식은 Esc로 닫힌다`);


  // 9) 휴대폰: 조작 창이 캔버스 아래로
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), m = await ctx.newPage(); m.on('pageerror', e => errs.push('m ' + e.message));
  await m.goto(url); await m.waitForTimeout(500);
  const M = await m.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { stage: r('.dh-stage'), panel: r('.dh-panel'), sw: document.documentElement.scrollWidth, btn: Math.min(...[...document.querySelectorAll('#host button')].map(e => e.getBoundingClientRect().height)), cw: document.querySelector('.dh-canvas').width }; });
  assert.ok(M.panel.top >= M.stage.bottom && M.sw <= 390 && M.btn >= 44 && M.cw === 1440, JSON.stringify(M));
  const hp = await m.evaluate(() => { document.querySelector('.dh-canvas').scrollIntoView({ block: 'center' }); const s = __dh.scene, P = s.pos.get(39), c = s.cam.toScreen(P.x, P.y), r = document.querySelector('.dh-canvas').getBoundingClientRect(); return { x: r.left + c.x * r.width / 480, y: r.top + c.y * r.height / 360 }; });
  await m.touchscreen.tap(hp.x, hp.y); assert.strictEqual(await m.$eval('.dh-detail-title', e => e.textContent), '성도 成都');
  ok('휴대폰 390px: 조작 창이 캔버스 아래 · 가로 넘침 없음 · 놀이 단추 44px · 손가락으로 주 찍기');

  // 10) 휴대폰에서 침공과 전투: 손가락으로 군주 · 명령 · 부대 · 칸을 찍는다
  const tapBtn = async id => { const h = await m.$(`button[data-id="${id}"]`); await h.scrollIntoViewIfNeeded(); const r = await h.boundingBox(); await m.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); };
  const tapCell = async (c, r) => { await m.evaluate(() => document.querySelector('.dh-canvas').scrollIntoView({ block: 'center' })); const q = await m.evaluate(([c, r]) => { const s = __dh.engine.scene, P = s.grid.center(c, r), k = s.cam.toScreen(P.x, P.y), R = document.querySelector('.dh-canvas').getBoundingClientRect(); return { x: R.left + k.x * R.width / 480, y: R.top + k.y * R.height / 360 }; }, [c, r]); await m.touchscreen.tap(q.x, q.y); };
  await m.evaluate(() => __dh.engine.stop()); await tapBtn('f:liuzhang'); assert.strictEqual(await m.evaluate(() => [__dh.game.player, __dh.scene.selected].join()), 'liuzhang,39');
  await tapBtn('attack'); await tapBtn('to:41'); const all = await m.evaluate(() => __dh.game.P(39).troops); await tapBtn('n:' + all);
  assert.deepStrictEqual(await m.evaluate(() => [__dh.engine.scenes.length, __dh.engine.scene.me, __dh.engine.scene.b.sides.def.name]), [2, 'att', '빈 땅']);
  await tapCell(1, 4); const ms = await m.evaluate(() => { const s = __dh.engine.scene; __dh.engine.step(1); return { sel: s.sel && s.sel.id, reach: s.reach.size, far: [...s.reach.values()].sort((a, b) => b.c - a.c || a.cost - b.cost)[0] }; }); assert.ok(ms.sel === 'att0' && ms.reach > 10);
  const tint = await m.evaluate(() => { const c = document.querySelector('.dh-canvas'), R = c.getBoundingClientRect(); return { hl: getComputedStyle(c).webkitTapHighlightColor, px: [...c.getContext('2d').getImageData(12, 12, 1, 1).data].slice(0, 3), x: R.left + 4, y: R.top + 4 }; });
  const shotPx = await m.evaluate(async b64 => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const c = document.createElement('canvas'); c.width = c.height = 1; const g = c.getContext('2d'); g.drawImage(i, 0, 0, 1, 1); return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3); }, (await m.screenshot({ clip: { x: tint.x, y: tint.y, width: 1, height: 1 } })).toString('base64'));
  assert.deepStrictEqual(shotPx, tint.px, '찍은 뒤에도 캔버스에 누름 표시(푸른 덧칠)가 덮이지 않는다'); assert.strictEqual(tint.hl, 'rgba(0, 0, 0, 0)');
  await m.screenshot({ path: shot + '/ui-sam-phone-battle.png' }); await tapCell(ms.far.c, ms.far.r); assert.deepStrictEqual(await m.evaluate(() => { const u = __dh.engine.scene.b.units[0]; return [u.c, u.r, u.moved]; }), [ms.far.c, ms.far.r, true]);
  const MB = await m.evaluate(() => ({ sw: document.documentElement.scrollWidth, btn: Math.min(...[...document.querySelectorAll('.dh-menu button')].map(e => e.getBoundingClientRect().height)), n: document.querySelectorAll('.dh-menu button').length, info: document.querySelector('.dh-top').getBoundingClientRect().height }));
  assert.ok(MB.sw <= 390 && MB.btn >= 44 && MB.n === 4 && MB.info < 140, JSON.stringify(MB));
  await tapBtn('auto'); for (let i = 0; i < 100 && await m.evaluate(() => __dh.engine.scene.mode !== 'result'); i++) await m.evaluate(() => __dh.engine.step(60));
  await m.evaluate(() => __dh.engine.step(40)); await m.screenshot({ path: shot + '/ui-sam-phone-result.png' }); const win = await m.evaluate(() => __dh.engine.scene.res.winner); await tapBtn('back');
  assert.deepStrictEqual(await m.evaluate(() => [__dh.engine.scenes.length, __dh.game.P(41).owner]), [1, win === 'att' ? 'liuzhang' : null]);
  ok(`휴대폰: 유장으로 시작 · 성도에서 건녕(빈 땅) 침공 · 손가락으로 부대와 칸 찍기(누름 덧칠 없음) · 맡기기 → ${win === 'att' ? '건녕을 차지했다' : '물러났다'} · 가로 넘침 없음`);

  // 휴대폰 페이지: 시리즈 띠 · 탭 다섯 · 편집기가 390px 안에 든다
  await m.evaluate(() => { document.querySelector('.tabs button[data-tab=play]').click(); scrollTo(0, 0); }); await m.evaluate(() => __dh.engine.step(1)); await m.screenshot({ path: shot + '/ui-phone-play.png', fullPage: true });
  const mb = await m.evaluate(() => { const it = [...document.querySelectorAll('.series-item')].map(e => e.getBoundingClientRect()); return { n: it.length, right: Math.max(...it.map(r => r.right)), left: Math.min(...it.map(r => r.left)), h: Math.min(...it.map(r => r.height)), w: [...new Set(it.map(r => Math.round(r.width)))], sw: document.documentElement.scrollWidth,
    ed: ['.ed-panel', '#code', '#example', '#run', '#result', '.file-row', '.lang-rule', '.tabs', '.getting-started'].map(s => [s, Math.round(document.querySelector(s).getBoundingClientRect().right)]).filter(x => x[1] > 390) }; });
  assert.ok(mb.n === 18 && mb.right <= 390 && mb.left >= 0 && mb.h >= 44 && mb.sw <= 390 && mb.ed.length === 0, JSON.stringify(mb)); assert.strictEqual(mb.w.length, 1, '띠 18칸(짝수)은 모두 같은 폭: ' + mb.w);
  const mdocs = [];
  for (const id of ['protocol', 'rules', 'engine', 'about']) {
    const h = await m.$(`.tabs button[data-tab=${id}]`); await h.scrollIntoViewIfNeeded(); const r = await h.boundingBox(); assert.ok(r.height >= 44, id + ' 탭 단추 높이 ' + r.height); await m.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
    const d = await m.evaluate(id => { const s = document.querySelector('#tab-' + id); return { shown: !s.hidden, sw: document.documentElement.scrollWidth, wide: [...s.querySelectorAll('h2, h3, h4, p, li, a, pre, .table-wrap, .science-block')].filter(e => e.getBoundingClientRect().right > 391).map(e => e.tagName + ':' + e.textContent.slice(0, 20)), scroll: [...s.querySelectorAll('.table-wrap, pre')].filter(e => e.scrollWidth > e.clientWidth + 1).length }; }, id);
    assert.ok(d.shown && d.sw <= 390 && d.wide.length === 0, id + ' ' + JSON.stringify(d)); mdocs.push(id + (d.scroll ? `(옆으로 미는 표·코드 ${d.scroll})` : '')); await m.screenshot({ path: shot + '/ui-phone-' + id + '.png', fullPage: true });
  }
  ok(`휴대폰 페이지: 시리즈 띠 18칸이 같은 폭(${mb.w[0]}px)으로 390px 안 · 편집기와 저장 줄 넘침 없음 · 설명 탭 넷(${mdocs.join(' · ')}) 가로 넘침 없음`);

  // 휴대폰 전체 화면: 세로는 아래로 쌓고, 가로로 눕히면 지도를 왼쪽에 꽉 채운다
  await m.evaluate(() => { document.querySelector('.tabs button[data-tab=play]').click(); document.querySelector('#full').scrollIntoView({ block: 'center' }); });
  const mfs = () => m.evaluate(() => { const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom }; }, host = document.querySelector('#host');
    return { full: __dhFull.isFull(), cls: document.querySelector('#stage-full').className, stage: r('.dh-stage'), panel: r('.dh-panel'), top: r('.dh-top'), exit: r('#exit-full'), shown: !document.querySelector('#exit-full').hidden, cw: document.querySelector('.dh-canvas').width, iw: innerWidth, ih: innerHeight, sw: host.scrollWidth - host.clientWidth, btn: Math.min(...[...document.querySelectorAll('#host button')].map(e => e.getBoundingClientRect().height)) }; });
  const P0 = await mfs(); { const h = await m.$('#full'), r = await h.boundingBox(); await m.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); } await m.waitForTimeout(600); const P1 = await mfs(); await m.evaluate(() => __dh.engine.step(1)); await m.screenshot({ path: shot + '/ui-full-phone.png' });
  assert.ok(P1.full && P1.shown && /\bstack\b/.test(P1.cls), '세로 화면은 아래로 쌓는다: ' + P1.cls); assert.ok(P1.stage.x >= 0 && P1.stage.r <= P1.iw + 1 && P1.stage.w >= 360 && P1.sw <= 1 && P1.panel.y >= P1.stage.b - 1 && P1.top.b <= P1.stage.y + 1 && P1.exit.b <= P1.top.y + 1 && P1.btn >= 44, JSON.stringify(P1));
  await m.setViewportSize({ width: 844, height: 390 }); await m.waitForTimeout(400); const P2 = await mfs(); await m.evaluate(() => __dh.engine.step(1)); await m.screenshot({ path: shot + '/ui-full-phone-land.png' });
  assert.ok(P2.full && /\bside\b/.test(P2.cls), '눕히면 지도를 왼쪽에 꽉 채운다: ' + P2.cls); assert.ok(P2.stage.h >= P2.ih - 40 && P2.stage.b <= P2.ih + 1 && P2.panel.x >= P2.stage.r - 1 && P2.top.x >= P2.stage.r - 1 && P2.panel.r <= P2.iw + 1 && P2.top.y >= P2.exit.b - 1 && P2.sw <= 1, JSON.stringify(P2));
  await m.setViewportSize({ width: 390, height: 844 }); await m.waitForTimeout(300); { const h = await m.$('#exit-full'), r = await h.boundingBox(); await m.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); } await m.waitForTimeout(400); const P3 = await mfs();
  assert.deepStrictEqual([P3.full, P3.shown, P3.cls, P3.cw, Math.abs(P3.stage.w - P0.stage.w) < 2], [false, false, 'stage-full', P0.cw, true], '닫으면 제자리'); assert.ok(await m.evaluate(() => document.documentElement.scrollWidth) <= 390);
  ok(`휴대폰 전체 화면: 세로 ${P1.iw}×${P1.ih}는 아래로 쌓기(지도 ${Math.round(P1.stage.w)}px) · 가로 ${P2.iw}×${P2.ih}는 지도 왼쪽 가득(높이 ${Math.round(P2.stage.h)}px) + 오른쪽에 정보 띠와 조작 창 · 닫기 단추가 정보 띠를 가리지 않는다 · 닫으면 제자리`);

  assert.deepStrictEqual(errs, []); console.log(`\n${n} ui tests passed · 콘솔 오류 0`); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
