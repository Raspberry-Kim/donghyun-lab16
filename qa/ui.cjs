// 동현삼 화면 시험(Playwright): node build.cjs 뒤에 node qa/ui.cjs
const { chromium } = require('/home/user/node_modules/playwright'); const assert = require('assert'), fs = require('fs'), path = require('path'), fmt = n => Number(n).toLocaleString('ko-KR');
const url = 'file://' + path.join(__dirname, '..', 'index.html'), shot = path.join(__dirname, 'tmp'); fs.mkdirSync(shot, { recursive: true });
// 예제를 고른다. 하던 판이 있으면 '바꾼다'고 답한다(v1.11: 예제를 고르면 지도가 그 배치로 바뀐다)
const pickEx = async (pg, id) => { await pg.selectOption('#example', id); const y = pg.locator('#menu .mi:has(span:text-is("바꾼다"))'); if (await y.isVisible()) await y.click(); };
(async () => {
  const b = await chromium.launch({ env: { ...process.env, LC_ALL: 'C.UTF-8' } }), errs = []; let n = 0; const ok = s => { n++; console.log('ok ' + s); };
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
  p.on('pageerror', e => errs.push(e.message)); p.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
  await p.goto(url); await p.waitForTimeout(500);
  await p.waitForFunction(() => window.__dh && !document.querySelector('#run').disabled);
  // 0) 시작 카드: 출전을 누르기 전에는 멈춰 있다 · 효과음 버튼과 M 키
  { const C = () => p.evaluate(() => ({ w: __dh.waiting(), top: __dh.engine.scenes.at(-1).constructor.name, title: document.querySelector('.dh-detail-title').textContent, menu: [...document.querySelectorAll('.dh-menu button')].map(e => e.textContent.trim()), st: document.querySelector('#status').textContent, snd: document.querySelector('#sound').getAttribute('aria-pressed') }));
    const C0 = await C(); assert.deepStrictEqual([C0.w, C0.top, C0.title, C0.st, C0.snd], [true, 'StartCard', '출전 준비', '출전 준비', 'true']); assert.strictEqual(C0.menu.length, 0, JSON.stringify(C0.menu)); assert.strictEqual(await p.$eval('#full', e => e.disabled), true, '시작 전에는 전체 화면을 막는다');
    assert.ok((await p.$eval('.getting-started', e => e.textContent)).includes('출전을 눌러야') && (await p.$eval('#result', e => e.textContent)).includes('출전을 누르면'));
    await p.click('#game-save'); assert.ok((await p.$eval('#menu-title', e => e.parentElement.textContent)).includes('아직 판을 시작하지 않았다')); await p.keyboard.press('Escape');
    await p.click('.dh-canvas'); await p.keyboard.press('KeyM'); assert.strictEqual(await p.$eval('#sound', e => e.getAttribute('aria-pressed')), 'false'); assert.strictEqual(await p.evaluate(() => localStorage.getItem('donghyunsam:sound')), 'off');
    await p.click('#sound'); assert.strictEqual(await p.$eval('#sound', e => e.getAttribute('aria-pressed')), 'true');
    const code0 = await p.$eval('#code', e => e.value); await p.focus('#code'); await p.keyboard.press('End'); await p.keyboard.press('KeyM'); assert.strictEqual(await p.$eval('#sound', e => e.getAttribute('aria-pressed')), 'true', '편집기에서는 M이 글자다'); await p.fill('#code', code0);
    await p.click('.dh-canvas'); for (const k of ['Enter', 'Digit1']) await p.keyboard.press(k); await p.waitForTimeout(200); const C1 = await C(); assert.deepStrictEqual([C1.w, C1.top], [true, 'StartCard'], '카드에서는 Enter · 1로 시작하지 않는다');
    await p.focus('#code'); await p.keyboard.press('Control+Enter'); await p.waitForTimeout(200); assert.deepStrictEqual([await p.evaluate(() => __dh.waiting()), await p.$eval('#full', e => e.disabled)], [false, false], '편집기에서 Ctrl+Enter로 출전 · 전체 화면이 켜진다');
    await p.reload(); await p.waitForFunction(() => window.__dh && !document.querySelector('#run').disabled); assert.strictEqual(await p.evaluate(() => __dh.waiting()), true);
    await p.click('#run'); await p.waitForTimeout(200); assert.deepStrictEqual([await p.evaluate(() => __dh.waiting()), await p.evaluate(() => __dh.engine.scenes.some(s => s.constructor.name === 'StartCard'))], [false, false]); }
  ok('시작 카드: 출전 전에는 멈추고 저장 · 전체 화면을 막는다 · 출전은 편집기 위의 버튼과 Ctrl+Enter뿐(카드의 Enter · 1은 듣지 않는다) · 효과음 버튼과 M 키(편집기에서는 글자) · 이 브라우저가 기억한다');
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
    targets: s.sel ? b.targets(s.sel).map(t => ({ id: t.id, c: t.c, r: t.r, troops: t.troops, def: b.defAt(t) })) : [], castle: b.castle, drill: b.drill, gen: Object.fromEntries(b.units.map(u => [u.id, u.general ? b.B.general : 0])) }; });
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
  assert.deepStrictEqual([r1.세력, r1.인구, r1.병력, r1.민심, r1.농지], ['조조', '420,000', '8,000', '70', '60']); assert.ok(r1.장수.startsWith('조조(무80 지95 매95)') && r1.이웃.startsWith('진류(조조 8,000) · 여남('), JSON.stringify(r1));
  await tapProv(25); assert.ok(!(await rows()).장수.includes('제갈량'), '재야 장수는 수색하기 전에는 보이지 않는다');
  await p.mouse.click(...(await at(8, 8))); assert.strictEqual(await title(), '군주를 고른다');
  ok('동현삼: 군주 고르기 화면 · 주 찍기(허창·양양) · 병력·민심·농지 · 재야 장수는 숨김');

  // 3) 유비로 시작 → 농지 개발 · 징병 → 턴 종료
  await p.click('button[data-id="f:liubei"]');
  assert.deepStrictEqual(await info(), { 날짜: '200년 1월', 군주: '유비', 주: '2', 병력: '10,000', '남은 명령': '2' }); assert.strictEqual(await title(), '소패 小沛'); assert.strictEqual((await rows()).세력, '유비 · 우리 땅');
  assert.deepStrictEqual(await menu(), ['civil', 'draft', 'drill', 'move', 'attack', 'search', 'ally', 'office', 'end']);
  await p.click('button[data-id=civil]'); assert.deepStrictEqual(await menu(), ['develop', 'flood', 'trade', 'relief', 'cancel'], '내정을 누르면 네 가지가 열린다'); await p.click('button[data-id=develop]'); let r = await rows(); assert.ok(r.농지 === '51' && r.금.startsWith('450 ') && r.민심 === '67', JSON.stringify(r)); assert.ok((await logTop()).includes('농지를 넓혔다(45 → 51)'));
  assert.deepStrictEqual(await menu(), ['civil!', 'draft!', 'drill!', 'move!', 'attack!', 'search!', 'ally!', 'office', 'end'], '한 달에 한 번(벼슬은 이 원칙에 해당하지 않는다)'); assert.strictEqual((await info())['남은 명령'], '1'); assert.ok((await p.$eval('.dh-note', e => e.textContent)).includes('이미 내렸다'));
  await tapProv(13); assert.strictEqual(await title(), '하비 下邳'); await p.click('button[data-id=draft]'); r = await rows(); assert.deepStrictEqual([r.병력, r.민심, r.인구], ['6,000', '62', '259,000']);
  assert.deepStrictEqual([(await info()).병력, (await info())['남은 명령']], ['11,000', '0']);
  await tapProv(11); assert.deepStrictEqual((await menu()).slice(0, 9), ['civil!', 'draft!', 'drill!', 'move!', 'attack!', 'search!', 'ally!', 'office!', 'end'], '남의 땅에는 명령이 없다');
  await p.click('button[data-id=end]'); assert.strictEqual(await G(() => __dh.scene.mode), 'busy'); assert.ok((await menu()).includes('end!')); assert.strictEqual(await finishAI(), 0, '첫 달에는 침공받지 않는다');
  assert.deepStrictEqual(await info(), { 날짜: '200년 2월', 군주: '유비', 주: '2', 병력: '11,000', '남은 명령': '2' }); assert.ok((await logTop(3)).includes('200년 2월이 되었다'));
  const m2 = await G(() => { const g = __dh.game; return { sp: [g.P(12).gold, g.P(12).rice, g.P(12).loyalty], jl: g.P(11).troops, xc: g.P(14).troops, months: g.months }; });
  assert.deepStrictEqual(m2, { sp: [537, 1654, 68], jl: 12000, xc: 4000, months: 1 }, '세금·수확·군량 · 진류는 재야 장수를 찾느라 징병하지 않았고 후방의 허창이 병력 절반(4,000)을 진류로 보냈다');
  ok('동현삼: 유비로 시작 · 농지 개발(45 → 51) · 징병(+1,000, 민심 −3) · 주마다 한 달에 한 번 · 턴 종료 뒤 AI가 움직이고 달이 넘어간다');

  // 4) 이동(누가 → 어디로(지도 찍기) → 병력) · 수색
  await tapProv(12); await p.click('button[data-id=move]'); assert.deepStrictEqual(await menu(), ['who:121', 'who:123', 'who:ok!', 'who:none', 'who:cart', 'cancel']); await p.click('button[data-id="who:123"]');
  assert.deepStrictEqual((await p.$$eval('.dh-menu button[data-id^="who:"]', a => a.map(b => [b.dataset.id, b.textContent.includes('✓'), b.classList.contains('sam-on'), b.getAttribute('aria-pressed'), b.disabled]))).slice(0, 3), [['who:121', false, false, 'false', false], ['who:123', true, true, 'true', false], ['who:ok', false, false, null, false]], '고른 장수는 ✓와 눌린 모양으로 보인다');
  assert.ok((await p.$eval('button[data-id="who:ok"]', e => e.textContent)).includes('고른 장수로 1명'));
  await p.click('button[data-id="who:ok"]');
  assert.deepStrictEqual(await menu(), ['to:13', 'cancel']); await step(1); await tapProv(13); assert.deepStrictEqual(await menu(), ['q:-1000!', 'q:-100!', 'q:100', 'q:1000', 'qs:0', 'qs:half', 'qs:all', 'qok', 'cancel']); assert.strictEqual(await title(), '소패 小沛', '대상을 찍어도 고른 주는 그대로다');
  // 얼마나: 수로 정한다(v1.11). 버튼 위에 보낼 병력과 남는 병력이 보이고, 버튼에는 번호가 없다
  const Q = () => p.evaluate(() => { const m = document.querySelector('.dh-menu'), q = m.querySelector('.sam-qty'); return { cols: m.dataset.cols, qty: [...q.children].map(e => e.textContent), ok: m.querySelector('button[data-id=qok]').textContent, keys: m.querySelectorAll('.dh-key').length, role: q.getAttribute('role'),
    small: [...m.querySelectorAll('button')].filter(b => b.offsetHeight < 44).length, rows: new Set([...m.querySelectorAll('button')].map(b => Math.round(b.getBoundingClientRect().top))).size, clip: [...m.querySelectorAll('button')].filter(b => b.scrollWidth > b.clientWidth + 1).length }; });
  assert.deepStrictEqual(await Q(), { cols: 'q', qty: ['보낼 병력 0', '남는 병력 5,000'], ok: '병력 없이 보낸다', keys: 0, role: 'status', small: 0, rows: 3, clip: 0 });
  for (const id of ['q:1000', 'q:1000', 'q:100', 'q:-1000']) await p.click(`button[data-id="${id}"]`); assert.deepStrictEqual([(await Q()).qty, (await Q()).ok], [['보낼 병력 1,100', '남는 병력 3,900'], '보낸다 · 병력 1,100']);
  await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowRight'); assert.strictEqual((await Q()).qty[0], '보낼 병력 2,200', '버튼을 누른 뒤에도 방향키가 지도에 듣는다'); for (const c of ['2', '5', '0', '0']) await p.keyboard.press(c); assert.strictEqual((await Q()).qty[0], '보낼 병력 2,500', '숫자 키로 바로 적는다');
  await p.click('button[data-id="qs:all"]'); assert.deepStrictEqual([(await Q()).qty, (await menu()).slice(2, 4)], [['보낼 병력 5,000', '남는 병력 0'], ['q:100!', 'q:1000!']]); await p.click('button[data-id="qs:half"]'); assert.strictEqual((await Q()).ok, '보낸다 · 병력 2,500');
  await p.click('button[data-id=qok]'); assert.strictEqual(await p.$eval('.dh-menu', m => m.dataset.cols || ''), '', '수량 격자는 그 단계에서만 쓴다'); assert.deepStrictEqual(await G(() => { const g = __dh.game; return [g.P(12).troops, g.P(13).troops, g.officers.get(123).province, g.P(12).acted]; }), [2500, 8500, 13, true]); assert.ok((await logTop()).includes('장비가 병력 2,500과 함께 옮겨 갔다'));
  await p.click('.sam-zoom button[data-zoom=zin]'); await tapProv(13); await p.click('button[data-id=move]'); await p.click('button[data-id=cancel]'); assert.ok((await menu()).includes('search'), '그만두면 명령 메뉴로'); await p.click('.sam-zoom button[data-zoom=zout]');
  await p.click('button[data-id=search]'); assert.ok(/^하비: /.test(await logTop())); assert.strictEqual((await info())['남은 명령'], '0');
  ok('동현삼: 이동(장비 + 병력 2,500 → 하비, 지도에서 대상 찍기) · 그만두기 · 수색');

  // 5) 침공받는다: 진류(12,000)가 병력이 줄어든 소패(2,500)로 쳐들어온다 → 수비 측으로 전장에 선다 → 퇴각을 되묻는다 → 맡기기
  await p.click('button[data-id=end]'); assert.strictEqual(await finishAI(), 0, '진류는 치기 전에 한 달 조련한다'); assert.deepStrictEqual(await G(() => { const g = __dh.game; return [g.P(11).troops, g.P(11).drill, g.governor(11).name, g.months]; }), [14000, 62, '하후돈', 2], '조련(50 → 64) 뒤에 허창이 보낸 2,000이 섞여 62');
  await p.click('button[data-id=end]'); let defended = null;
  const fights = await finishAI(async () => {
    let d = await bs(); assert.deepStrictEqual([d.me, d.side, d.mode, d.day], ['def', 'att', 'fight', 1]); assert.deepStrictEqual(await menu(), ['wait!', 'end!', 'auto!', 'retreat!', 'duel!', 'fire!'], '남의 차례에는 손댈 수 없다');
    assert.deepStrictEqual(await info(), { 전장: '소패', 날: '1/20일', 차례: '공격 측', '공격 조조': '9,800', '수비 유비': '2,500', 날씨: '바람 ↗' }); assert.ok((await logTop(2)).includes('조조 군이 진류에서 소패로 쳐들어갔다(유비 · 병력 9,800 대 2,500)'));
    assert.deepStrictEqual(d.units.map(u => [u.side, u.name, u.troops, u.war, u.c, u.r]), [['att', '허저', 3268, 95, 1, 4], ['att', '전위', 3266, 95, 0, 2], ['att', '곽가', 3266, 20, 0, 7], ['def', '유비', 2500, 75, d.castle[0], d.castle[1]]], '허창에서 병력과 함께 온 허저 · 곽가와 진류가 찾아낸 전위 대 성 위의 유비(태수 하후돈은 남아 진류를 지킨다)');
    for (let i = 0; i < 40 && d.side !== 'def' && !d.winner; i++) { await step(20); d = await bs(); } assert.strictEqual(d.side, 'def', '공격 측이 움직인 뒤 우리 차례가 온다'); assert.ok(d.units[0].c > 1, '공격 측 AI가 다가왔다');
    await p.click('button[data-id=retreat]'); assert.deepStrictEqual(await menu(), ['yes', 'no']); await p.click('button[data-id=no]'); assert.deepStrictEqual(await menu(), ['wait!', 'end', 'auto', 'retreat', 'duel!', 'fire!']); assert.strictEqual((await bs()).winner, null);
    await p.click('button[data-id=auto]'); for (let i = 0; i < 200 && (d = await bs()).mode !== 'result'; i++) await step(40); assert.strictEqual(d.mode, 'result'); defended = d.winner;
    await step(40); await p.screenshot({ path: shot + '/ui-sam-defeat.png' }); await p.click('button[data-id=back]');
  });

  assert.ok(fights >= 1 && defended, '침공받았다'); assert.strictEqual(await G(() => __dh.engine.scenes.length), 1);
  const lost = await G(() => { const g = __dh.game; return { owner: g.P(12).owner, liu: g.officers.get(121).province, over: g.over, mode: __dh.scene.mode, hh: g.officers.get(105).province }; });
  assert.deepStrictEqual([defended, lost.owner, lost.liu, lost.hh, lost.over, lost.mode], ['att', 'cao', 13, 12, null, 'play'], '소패는 조조에게 넘어가고 유비는 하비로 물러났다 · 허저가 소패로 들어왔다');
  assert.deepStrictEqual([(await info()).날짜, (await info()).주], ['200년 4월', '1']); assert.ok((await logTop(12)).includes('조조 군이 소패를 차지했다'));
  ok('동현삼: 진류가 소패로 한 달 조련한 뒤 소패로 쳐들어왔다(9,800 대 2,500) → 수비 측 전장 · 퇴각 되묻기 · 맡기기 → 소패를 내주고 유비는 하비로 · 달이 넘어간다');

  // 6) 침공 → 육각 전장에서 손으로 싸운다 → 주인이 바뀌고 지도로 돌아온다
  const pre = await G(() => { const g = __dh.game; return { mine: g.P(13).troops, foe: g.P(16).troops, owner: g.P(16).owner, n: g.provincesOf('liubei').length, who: g.fighters(13).map(o => o.name), ids: g.fighters(13).map(o => o.id), all: g.officersOf(13).map(o => o.id) }; }); assert.ok(pre.mine >= 8500 && pre.owner === 'cao');
  assert.strictEqual(pre.who.length, Math.min(3, pre.all.length - 1), '한 명은 남아 하비를 지킨다'); assert.deepStrictEqual(pre.who.slice(0, 2), ['관우', '장비'], '무력 순으로 나선다');
  await tapProv(13); await p.click('button[data-id=attack]'); assert.ok((await menu()).includes('to:16')); await step(1); await tapProv(16); assert.deepStrictEqual(await menu(), ['q:-1000', 'q:-100', 'q:100!', 'q:1000!', 'qs:min', 'qs:half', 'qs:all', 'qok', 'cancel']); assert.strictEqual(await p.$eval('button[data-id=qok]', e => e.textContent), `친다 · 병력 ${fmt(pre.mine)}`, '침공은 전부에서 시작한다'); assert.ok((await p.$eval('.dh-note', e => e.textContent)).includes(pre.who.join(' · ') + ' 부대로 나뉘어 나선다'));
  await p.click('button[data-id=qok]'); assert.deepStrictEqual(await G(() => [__dh.engine.scenes.length, !!__dh.scene.hold]), [1, true], '부대가 수춘까지 걸어가는 동안은 지도에 머문다'); assert.ok((await p.$eval('.dh-note', e => e.textContent)).includes('부대가 길을 가는 중이다')); await step(1); await p.screenshot({ path: shot + '/ui-sam-march.png' });
  await step(40); let B = await bs(); assert.deepStrictEqual([B.n, B.me, B.side, B.day, B.mode], [2, 'att', 'att', 1, 'fight']);
  { const { 날씨, ...rest } = await info(); assert.deepStrictEqual(rest, { 전장: '수춘', 날: '1/20일', 차례: '공격 측', '공격 유비': fmt(pre.mine), '수비 조조': fmt(pre.foe) }); assert.ok(/^바람 [←→↖↗↙↘]$/.test(날씨), 날씨); } assert.strictEqual(await title(), '수춘 전투'); assert.deepStrictEqual(await menu(), ['wait!', 'end', 'auto', 'retreat', 'duel!', 'fire!']);
  assert.deepStrictEqual(await G(() => { const b = __dh.engine.scene.b; return [b.grid.cols, b.grid.rows, b.grid.kind]; }), [10, 10, 'hex']); assert.deepStrictEqual(B.units.map(u => u.name), [...pre.who, '만총'], '수춘은 태수 만총이 지킨다'); assert.strictEqual(B.units.filter(u => u.side === 'att').reduce((n, u) => n + u.troops, 0), pre.mine, '보낸 병력을 부대 수로 나눈다');
  const me0 = B.units[0]; assert.deepStrictEqual([me0.c, me0.r], [1, 4]); await step(1); const before = await px(0, 4, 0, 12); await tapHex(1, 4); B = await bs(); await step(1); const after = await px(0, 4, 0, 12);
  assert.strictEqual(B.sel, 'att0'); assert.ok(B.reach.length > 15 && B.reach.every(v => v[2] <= 5), '이동력 5 안쪽만'); assert.ok(before[2] > 150 && after[2] < 140 && after[0] > after[2] + 60, `갈 수 있는 칸이 노랗게 ${before} → ${after}`);
  const COST = { plain: 1, forest: 2, mountain: 3, river: 4, castle: 1 }; for (const v of B.reach) if (hexDist([v[0], v[1]], [1, 4]) === 1) assert.strictEqual(v[2], COST[v[3]], '바로 옆 칸은 그 지형 값'); assert.ok(!B.reach.some(v => v[3] === 'river' && v[2] < 4) && !B.reach.some(v => v[3] === 'mountain' && v[2] < 3));
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
    if (B.targets.length) { const t = B.targets[0], me = B.units.find(x => x.id === u.id), want = Math.min(t.troops, Math.floor(me.troops * me.war * (100 - Math.round(t.def * 100)) * (150 + B.drill.att) * (100 + B.gen[me.id]) / (10000 * 200 * 100)));
      const row = Object.entries(await rows()).find(([k]) => k.endsWith(' 치기')); assert.ok(row && row[1].endsWith('= ' + fmt(want)), '조작 창의 피해 셈 ' + JSON.stringify(row)); if (!shown) shown = row[1];
      await step(1); let red = false; for (const dy of [-18, -19, -20, -21, -22, -23, -24]) { const c = await px(t.c, t.r, 0, dy); if (c[0] > 150 && c[1] < 110) red = true; } assert.ok(red, '칠 수 있는 적에 붉은 테');
      await tapHex(t.c, t.r); B = await bs(); const now = B.units.find(x => x.id === t.id); assert.strictEqual(now.troops, t.troops - want, '피해 = 병력 × 무력 ÷ 100 × (1 − 지형) × (150 + 훈련) ÷ 200'); assert.ok(B.units.find(x => x.id === u.id).done, '치면 그날은 끝'); hits++; }
    else assert.ok(B.units.find(x => x.id === u.id).done, '칠 적이 없으면 그날 일을 마친다');
  }
  assert.deepStrictEqual([B.winner, B.mode], ['att', 'result'], JSON.stringify(B)); assert.ok(hits >= 2 && moves >= 2); assert.deepStrictEqual(await menu(), ['back']); assert.strictEqual((await info()).차례, '끝'); assert.ok((await rows()).결과.startsWith('이겼다'));
  await step(40); await p.screenshot({ path: shot + '/ui-sam-result.png' }); await p.click('button[data-id=back]');
  const post = await G(() => { const g = __dh.game; return { n: __dh.engine.scenes.length, owner: g.P(16).owner, troops: g.P(16).troops, at: [...g.officers.values()].filter(o => o.faction === 'liubei').map(o => [o.id, o.province]), home: g.P(13).troops, mode: __dh.scene.mode, sel: __dh.scene.selected, acted: g.P(16).acted }; });

  assert.deepStrictEqual([post.n, post.owner, post.home, post.mode, post.sel, post.acted], [1, 'liubei', 0, 'play', 16, true]); for (const [id, at] of post.at) assert.strictEqual(at, pre.ids.includes(id) || !pre.all.includes(id) ? 16 : 13, '나선 장수는 수춘으로, 남은 장수는 하비에(사로잡혀 우리 편이 된 장수는 수춘에)'); assert.strictEqual(post.troops, B.units.filter(u => u.side === 'att').reduce((n, u) => n + u.troops, 0), '남은 병력이 그대로 들어간다');
  assert.strictEqual((await info()).주, String(pre.n + 1)); assert.strictEqual(await title(), '수춘 壽春'); assert.strictEqual((await rows()).세력, '유비 · 우리 땅'); assert.ok((await logTop(2)).includes('유비 군이 수춘을 차지했다'));
  await step(1); const dot = await G(() => { const s = __dh.scene, P = s.pos.get(16), k = s.cam.toScreen(P.x, P.y - 3), cv = document.querySelector('.dh-canvas'), f = cv.width / 480; return [...cv.getContext('2d').getImageData(Math.round(k.x * f), Math.round(k.y * f), 1, 1).data].slice(0, 3); });
  assert.ok(dot[1] > dot[0] + 30 && dot[1] > dot[2] + 30, '지도에서 수춘이 유비의 색으로 ' + dot);
  ok(`동현삼: 침공 → 10×10 육각 전장(${Object.entries(terr).map(([k, v]) => k + ' ' + v).join(' · ')}) · 이동 범위(평지 1 · 산 3 · 강 4) · 손으로 ${moves}번 옮기고 ${hits}번 침(${shown}) · 승리 → 수춘의 주인이 유비로 · 지도로 복귀`);

  // 7) 물러난다(퇴각) → 모두 잃으면 판이 끝난다 → 다시 하기
  await G(() => { const g = __dh.game; for (const q of g.provinces.values()) if (q.owner && q.owner !== 'liubei') { q.troops = 30000; q.drill = 60; } }); await p.click('button[data-id=end]'); let ret = null;      // 훈련이 55 아래면 AI는 치기 전에 조련부터 한다
  await finishAI(async () => { let d = await bs(); const where = (await info()).전장; for (let i = 0; i < 40 && d.side !== 'def' && !d.winner; i++) { await step(20); d = await bs(); }
    await p.click('button[data-id=retreat]'); await p.click('button[data-id=yes]'); d = await bs(); assert.deepStrictEqual([d.winner, d.mode], ['att', 'result']); assert.ok((await rows()).결과.includes('졌다 · 수비 측이 성을 버렸다')); ret = where;
    await step(10); await tapHex(5, 5); assert.strictEqual(await G(() => __dh.engine.scenes.length), 2, '끝난 직후의 손짓은 카드를 넘기지 않는다'); await step(40); await tapHex(5, 5); assert.strictEqual(await G(() => __dh.engine.scenes.length), 1, '결과 카드를 찍으면 지도로 돌아온다'); });
  assert.ok(ret, '침공받았다'); assert.notStrictEqual(await p.evaluate(w => [...__dh.game.provinces.values()].find(q => q.name === w).owner, ret), 'liubei', '물러난 주는 넘어갔다');
  if (!(await G(() => __dh.game.over))) { await G(() => { const g = __dh.game; for (const q of g.provinces.values()) { if (q.owner === 'liubei') q.troops = 0; else if (q.owner) { q.troops = 30000; q.drill = 60; } } }); await p.click('button[data-id=end]'); await finishAI(); }
  assert.deepStrictEqual(await G(() => [__dh.game.over, __dh.scene.mode, __dh.game.factions.get('liubei').alive, __dh.game.provincesOf('liubei').length, [...__dh.game.officers.values()].filter(o => o.faction === 'liubei' && o.status === 'active').length]), ['lost', 'over', false, 0, 0], '유비의 장수는 재야로 흩어지거나 사로잡혀 남의 편이 된다');
  assert.deepStrictEqual(await menu(), ['again']); await step(1); await p.screenshot({ path: shot + '/ui-sam-over.png' });
  await p.click('button[data-id=again]'); assert.strictEqual((await info()).군주, '고르는 중'); await p.click('button[data-id="f:cao"]');
  const caoT = fmt(await G(() => __dh.world.provincesOf('cao').reduce((n, q) => n + q.troops, 0)));
  assert.deepStrictEqual(await info(), { 날짜: '200년 1월', 군주: '조조', 주: '9', 병력: caoT, '남은 명령': '9' }); assert.deepStrictEqual(await G(() => [__dh.game.P(12).owner, __dh.game.P(12).troops, __dh.game.months, __dh.game.over]), ['liubei', 5000, 0, null], '새 판');
  ok(`동현삼: ${ret}에서 퇴각(되물은 뒤) · 주를 모두 잃으면 끝 · 다시 하기 → 조조로 새 판`);
  await G(() => __dh.engine.start());

  // 4) 지도 조작: 버튼 확대, 끌어 옮기기, 화살표. v0.10: 바퀴와 트랙패드 제스처는 지도를 키우지 않는다
  const cam = () => p.evaluate(() => { const c = __dh.scene.cam; return { x: c.x, y: c.y, z: c.zoom }; }); const c0 = await cam();
  await p.mouse.move(...(await at(300, 200))); await p.mouse.wheel(0, -300); const c1 = await cam(); assert.strictEqual(c1.z, c0.z, '바퀴로는 배율이 바뀌지 않는다');
  const blocked = await p.evaluate(() => { const el = document.querySelector('.dh-canvas'); return ['wheel', 'gesturestart', 'gesturechange'].map(type => { const e = type === 'wheel' ? new WheelEvent(type, { ctrlKey: true, deltaY: -80, bubbles: true, cancelable: true }) : new Event(type, { bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; }); });
  assert.deepStrictEqual(blocked, [true, true, true], 'Ctrl+바퀴(트랙패드 확대)와 Safari gesture를 막는다'); assert.strictEqual((await cam()).z, c0.z);
  await p.click('.sam-zoom button[data-zoom=zin]'); const c2 = await cam(); assert.ok(c2.z > c1.z);
  assert.deepStrictEqual(await p.$$eval('.sam-zoom button', a => a.map(b => [b.getAttribute('aria-label'), b.textContent, b.offsetWidth >= 38 && b.offsetHeight >= 38])), [['지도 확대', '+', true], ['지도 축소', '−', true]]); assert.strictEqual(await p.$eval('.sam-zoom', e => e.hidden), false);
  await p.mouse.move(...(await at(300, 200))); await p.mouse.down(); await p.mouse.move(...(await at(240, 170)), { steps: 4 }); await p.mouse.up(); const c3 = await cam(); assert.ok(c3.x > c2.x && c3.y > c2.y, '끌면 지도가 따라온다');
  await p.focus('.dh-canvas'); await p.keyboard.press('Shift+ArrowLeft'); const c4 = await cam(); assert.ok(c4.x < c3.x, 'Shift+화살표로 지도를 옮긴다(끌어서 오른쪽 끝에 닿았으니 왼쪽으로)'); await p.keyboard.press('KeyD'); assert.ok((await cam()).x > c4.x, 'D도 지도를 옮긴다'); for (let i = 0; i < 12; i++) await p.click('.sam-zoom button[data-zoom=zout]'); assert.strictEqual((await cam()).z, 1);
  ok('지도 조작: 지도 위 아이콘 확대 · 바퀴와 제스처 차단 · 끌기 · Shift+화살표와 W A S D · 축소 하한');

  // 5) 60FPS 루프
  await p.waitForTimeout(1500); const fps = await p.evaluate(() => __dh.engine.loop.fps); assert.ok(fps >= 50 && fps <= 70, 'fps ' + fps);
  const t0 = await p.evaluate(() => __dh.engine.tick); await p.waitForTimeout(1000); const dt = (await p.evaluate(() => __dh.engine.tick)) - t0; assert.ok(dt >= 50 && dt <= 70, '1초 틱 ' + dt);
  ok(`루프: 초당 그리기 ${fps} · 1초에 논리 틱 ${dt}`);

  // ───────── 동현랭 칸(동현삼) ─────────
  const lang = () => p.evaluate(() => { const o = document.querySelector('#result'); return { ex: [...document.querySelectorAll('#example option')].map(x => x.value), nums: [...document.querySelectorAll('#lang-rows tr')].map(tr => tr.children[0].textContent).join(' '), code: document.querySelector('#code').value, out: o.textContent, state: o.dataset.kind || '' }; });
  const setCode = text => p.fill('#code', text), runLang = async () => { await p.click('#run'); return lang(); }, compose = list => p.evaluate(list => __dh.lang.compose(list, '', { world: __dh.world }), list);
  const label = id => p.$eval(`button[data-id="${id}"]`, e => e.textContent), note = () => p.$eval('.dh-note', e => e.textContent);
  await G(() => __dh.engine.stop());
  let lg = await lang(); assert.deepStrictEqual([lg.ex, lg.nums, lg.state], [['none', 's189', 's194', 's201', 's208', 's221', 's235', 'e189', 'e194', 'e200', 'e201', 'e208', 'e221', 'e235', 'rich', 'stage', 'weak', 'unify', 'fast', 'calm', 'swap', 'heart', 'duel', 'crown', 'scale', 'loop'], '1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 40 41 42', 'ok']);
  const exNames = await p.$$eval('#example option', a => a.map(o => o.textContent)); assert.deepStrictEqual(exNames.map(t => t.slice(0, 5)), Array.from({ length: 26 }, (_, i) => String(i + 1).padStart(2, '0') + ' · ')); assert.deepStrictEqual([exNames[1], exNames[7], exNames[14]], ['02 · 시나리오: 189년 12월 · 동탁과 제후들', '08 · 쉬운 판: 189년 12월 · 동탁과 제후들', '15 · 넉넉한 유비']);
  assert.deepStrictEqual(await p.$$eval('#example optgroup', a => a.map(g => [g.label, g.children.length])), [['기본', 1], ['시나리오 · 시작 해가 다른 여섯 판', 6], ['쉬운 판 · 나만 금 · 쌀 · 민심 세 배', 7], ['수치 실험', 10], ['동현랭 문법', 2]]);
  await pickEx(p, 'loop'); lg = await runLang(); assert.strictEqual(lg.state, 'ok'); assert.ok(lg.out.startsWith('설정 8개를 적용하고 새 판을 열었다: 주 초기값 북평 병력 10,000 · '), lg.out); assert.deepStrictEqual(await G(() => [2, 3, 4, 5, 6, 7, 8, 9].map(n => __dh.game.P(n).troops)), Array(8).fill(10000), '반복문 예제: 원소의 여덟 주가 모두 10,000');
  await pickEx(p, 'scale'); lg = await runLang(); assert.ok(lg.out.startsWith('설정 4개를 적용하고 새 판을 열었다: 군주 유비 · 우리 주 시작 금 5,000 · 우리 주 시작 쌀 20,000 · 징병 수량 2,000'), lg.out); assert.ok(lg.code.startsWith('나는 동현이냐?') && lg.code.endsWith('동현이구나'));
  await pickEx(p, 'rich'); assert.ok((await lang()).code.includes('ㅋㅋ 3번')); lg = await runLang(); assert.strictEqual(lg.state, 'ok');
  assert.ok(lg.out.startsWith('설정 5개를 적용하고 새 판을 열었다: 군주 유비 · 우리 주 시작 금 3,000 · 우리 주 시작 쌀 20,000 · 징병 수량 2,000 · 장수 능력치 유비 무력 90'), lg.out);
  assert.deepStrictEqual(await G(() => { const g = __dh.game; return [g.player, g.P(12).gold, g.P(12).rice, g.P(13).gold, g.officers.get(121).war, g.months, __dh.state.rules.draft.troops]; }), ['liubei', 3000, 20000, 3000, 90, 0, 2000]);
  assert.deepStrictEqual([(await info()).군주, (await info()).병력], ['유비', '10,000']); assert.ok((await label('draft')).includes('2,000'), '징병 버튼에 수량이 적힌다: ' + await label('draft'));
  await p.click('button[data-id=draft]'); assert.strictEqual((await info()).병력, '12,000', '징병 수량이 설정값(2,000)을 따른다');
  await G(() => { __dh.game.__mark = 1; }); await setCode(await compose([[3, 100000]])); lg = await runLang(); assert.strictEqual(lg.state, 'error'); assert.strictEqual(lg.out, '우리 주 시작 금 값 100,000은 쓸 수 없다. 0~99,999만 된다. 하던 판은 그대로 두었다.');
  await setCode('안녕'); lg = await runLang(); assert.strictEqual(lg.state, 'error'); const badText = lg.out;
  assert.deepStrictEqual(await G(() => [__dh.game.__mark, __dh.game.P(12).gold >= 2800, __dh.state.rules.draft.troops]), [1, true, 2000], '오류가 나면 하던 판과 설정이 그대로다');
  await pickEx(p, 'none'); lg = await runLang(); assert.deepStrictEqual([lg.state, lg.out], ['ok', '설정이 없다. 기본값으로 새 판을 열었다.']); assert.strictEqual((await info()).군주, '고르는 중'); assert.strictEqual(await G(() => __dh.state.rules.draft.troops), 1000);
  ok(`동현랭 칸(동현삼): 예제 스물여섯(이름 앞 번호 01~26, 다섯 묶음) · 26 반복문과 25 변수 적용 · 설정 번호 표 34줄 · ‘넉넉한 유비’ 적용(금 3,000 · 쌀 20,000 · 징병 2,000 · 유비 무력 90) · 틀린 값과 동현랭이 아닌 글(“${badText.slice(0, 40)}…”)은 하던 판을 그대로 둔다 · 설정 없음 → 기본값`);

  // ───────── 페이지: 시리즈 띠 · 탭 · 설명 글 · 편집기 · 화면 전환 ─────────
  const NAME = '동현삼', TABS = ['지도', '동현삼 출전 규약', '규칙', '엔진과 자료', '수학적 원리', '모델과 출처'], HEADS = { protocol: ['설정 번호', '예제 스물여섯', '시나리오'], rules: ['플레이 방법', '조작', '동현삼 규칙'], engine: ['엔진의 층', '게임이 얹는 법', '동현랭 어댑터', 'JSON 규격', '파일', '돌려 보기'], about: ['상표와 관계', '이 자료가 무엇이고 무엇이 아닌지', '자료 출처'] };
  const band = await p.evaluate(() => ({ n: document.querySelectorAll('.series-item').length, ctx: document.querySelector('.series-context').textContent, here: [...document.querySelectorAll('.series-item[aria-current=page]')].map(a => a.querySelector('.series-name').textContent), hrefs: [...document.querySelectorAll('a.series-item')].map(a => a.getAttribute('href')),
    ed: document.querySelector('.edition').textContent.trim(), foot: document.querySelector('footer').textContent, title: document.title, left: document.documentElement.innerHTML.match(/__[A-Z_]+__|<!--README/g) }));
  assert.deepStrictEqual([band.n, band.here, band.hrefs.length, band.left], [19, [NAME + '™'], 18, null]); assert.ok(band.ctx.includes('열여덟 개의 작은 세계') && band.ed.startsWith('v1.11') && band.foot.includes(NAME + ' v1.11') && band.title.includes(NAME), JSON.stringify([band.ctx, band.ed, band.title]));
  assert.ok(band.hrefs.every(h => /^https:\/\/raspberry-kim\.github\.io\/donghyun-(lang|lab\d+)\/$/.test(h)) && new Set(band.hrefs).size === 18, '띠의 주소 열여덟 개가 서로 다르다');
  ok(`시리즈 띠 19칸(지금 여기: ${NAME}) · 머리글과 바닥글의 판 번호 v1.11 · 빌드 자리표가 남지 않았다`);

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
  await pickEx(p, 'stage'); await p.waitForTimeout(400); let E = await ed(); const nl = E.code.split('\n').length;
  assert.deepStrictEqual([E.lines, E.count, E.spans, E.kind], [nl, nl + '줄', nl + 1, '']); assert.ok(E.colors.includes('t-frame') && E.colors.includes('t-cmt') && E.colors.includes('t-out') && E.colors.includes('t-num'), E.colors);
  assert.ok(E.note.length > 5 && /^읽은 설정 \d+개: .+\. 출전을 누르면 이 값으로 새 판이 열린다\.$/.test(E.out), E.out); const mark = await G(() => { __dh.engine.__mark = 1; return __dh.state.stage; });
  await p.fill('#code', '나는 동현이냐?\n뿡뿡 도오오옹\n동현이구나'); await p.waitForTimeout(400); E = await ed(); assert.deepStrictEqual([E.kind, E.lines, E.code.split('\n')[1]], ['error', 3, '  뿡뿡 도오오옹'], '고치는 동안 읽기만 해 본다 · 몸통 줄은 두 칸 들여 쓴다'); assert.ok(E.out.length > 10 && !E.out.includes('그대로 두었다'));
  assert.deepStrictEqual(await G(() => __dh.state.stage), mark, '미리 읽기는 판을 건드리지 않는다');
  await p.focus('#code'); await p.keyboard.press('Control+Enter'); E = await ed(); assert.deepStrictEqual([E.kind, E.status], ['error', '출전하지 못했다']); assert.ok(E.out.length > 10 && !E.out.includes('하던 판'), '출전 전이라 하던 판이 없다: ' + E.out); assert.deepStrictEqual(await G(() => [__dh.waiting(), __dh.state.stage]), [true, mark], '틀린 코드는 펴 둔 지도를 건드리지 않는다');
  await pickEx(p, 'stage'); const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#save')]); const saved = fs.readFileSync(await dl.path(), 'utf8'); assert.strictEqual(dl.suggestedFilename(), 'sortie.dh'); assert.strictEqual(saved, (await ed()).code + '\n');
  await pickEx(p, 'none'); await p.setInputFiles('#open', { name: 'mine.dh', mimeType: 'text/plain', buffer: Buffer.from(saved.replace(/\n/g, '\r\n')) }); await p.waitForTimeout(400); E = await ed(); assert.strictEqual(E.code + '\n', saved, '.dh를 열면 저장한 그대로'); assert.strictEqual(E.note, '');
  await p.focus('#code'); await p.keyboard.press('Control+Enter'); E = await ed(); assert.strictEqual(E.kind, 'ok'); assert.ok(/^설정 \d+개로 새 판$/.test(E.status) && E.out.startsWith('설정 '), E.status + ' / ' + E.out);
  const rule = await p.evaluate(() => { const d = document.querySelector('.lang-rule'); d.open = true; const t = d.querySelector('table'); return { head: [...t.querySelectorAll('th')].map(x => x.textContent), rows: [...t.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent)), sw: document.documentElement.scrollWidth }; });
  assert.deepStrictEqual(rule.head, ['번호', '설정', '값', '기본값']); assert.strictEqual(rule.rows.length, 34); assert.ok(rule.rows.every(r => r.length === 4 && /^\d+$/.test(r[0]) && r[1] && r[2]) && rule.sw <= 1280, JSON.stringify(rule.rows[0]));
  await p.evaluate(() => document.querySelector('.ed-panel').scrollIntoView({ block: 'center' })); await p.screenshot({ path: shot + '/ui-editor.png' });
  ok(`편집기: 줄 번호와 색 입히기 · 고치는 동안 미리 읽기(판은 그대로) · Ctrl+Enter 출전 · 틀린 코드는 하던 판을 둔다 · sortie.dh 저장 → 열기(줄 끝 CRLF도) → 출전 · 설정 번호 표 ${rule.rows.length}줄`);

  // 화면 전환 · 입력 표식
  const look = () => p.evaluate(() => ({ theme: document.documentElement.dataset.theme || 'light', pressed: document.querySelector('#theme').getAttribute('aria-pressed'), bg: getComputedStyle(document.body).backgroundColor, ink: getComputedStyle(document.body).color }));
  const light = await look(); await p.click('#theme'); const dark = await look(); assert.deepStrictEqual([dark.theme, dark.pressed], ['dark', 'true']); assert.ok(dark.bg !== light.bg && dark.ink !== light.ink, JSON.stringify([light, dark]));
  await p.evaluate(() => scrollTo(0, 0)); await step(1); await p.screenshot({ path: shot + '/ui-dark.png', fullPage: true }); await p.click('#theme'); assert.deepStrictEqual(await look(), light);
  const marks = await p.evaluate(() => [...document.querySelectorAll('.input-marks .mark')].map(e => [e.getAttribute('aria-label'), e.classList.contains('off'), (e.dataset.tip || '').length > 10])); assert.strictEqual(marks.length, 4); assert.ok(marks.every(k => k[0] && k[2] && k[1] === /없음$/.test(k[0])), JSON.stringify(marks));
  ok(`화면 전환: 어두운 화면과 밝은 화면을 오간다 · 입력 표식 넷(${marks.map(k => k[0]).join(' · ')})`);

  // 전체 화면(데스크톱): 지도 아래 버튼 → 정보 띠 · 지도 · 조작 창이 화면을 채운다 → 닫으면 제자리
  const fsNow = () => p.evaluate(() => { const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b: b.bottom }; }, cv = document.querySelector('.dh-canvas');
    return { full: __dhFull.isFull(), cls: document.querySelector('#stage-full').className, stage: r('.dh-stage'), panel: r('.dh-panel'), top: r('.dh-top'), exit: !document.querySelector('#exit-full').hidden, exitBox: r('#exit-full'), hint: !document.querySelector('#full-hint').hidden, btn: document.querySelector('#full').textContent, off: document.querySelector('#full').disabled,
      cw: cv.width, iw: innerWidth, ih: innerHeight, focus: document.activeElement === cv, edIn: document.querySelector('#stage-full').contains(document.querySelector('.ed-panel')) }; });
  await p.click('.tabs button[data-tab=play]'); await p.evaluate(() => document.querySelector('#full').scrollIntoView({ block: 'center' })); const F0 = await fsNow(), inkF0 = await ink();
  assert.deepStrictEqual([F0.full, F0.exit, F0.hint, F0.btn, F0.off, F0.cw, F0.edIn], [false, false, false, '전체 화면', false, 480 * L.dpr, false], '편집기는 전체 화면에 들지 않는다');
  await p.click('#full'); await p.waitForTimeout(600); const F1 = await fsNow(); await p.screenshot({ path: shot + '/ui-full-desktop.png' });
  assert.deepStrictEqual([F1.full, F1.exit, F1.hint, F1.btn, F1.focus], [true, true, true, '전체 화면 닫기', true], JSON.stringify(F1.cls)); assert.ok(/\bfs\b/.test(F1.cls) && !/stack|side/.test(F1.cls), '넓은 화면: 지도 옆에 조작 창 · ' + F1.cls);
  assert.ok(F1.stage.w > F0.stage.w + 100 && Math.abs(F1.stage.w / F1.stage.h - 480 / 360) < 0.01, `전체 화면에서 지도가 커진다(4:3 그대로): ${F0.stage.w} → ${F1.stage.w}`);
  assert.ok(F1.top.b <= F1.stage.y + 1 && F1.panel.x >= F1.stage.r - 1 && F1.panel.r <= F1.iw + 1 && F1.stage.b <= F1.ih + 1 && F1.stage.x >= 0, '정보 띠 · 지도 · 조작 창이 모두 화면 안: ' + JSON.stringify([F1.stage, F1.panel, F1.iw, F1.ih]));
  assert.ok(F1.exitBox.r <= F1.iw && F1.exitBox.b <= F1.top.y + 1, '닫기 버튼은 정보 띠를 가리지 않는다'); assert.ok(F1.cw >= F1.stage.w && F1.cw > F0.cw && F1.cw % 480 === 0, `커진 만큼 촘촘히 그린다: 캔버스 ${F0.cw} → ${F1.cw}px`); assert.ok(await ink() >= inkF0 * 0.8, '전체 화면에서도 지도가 그려진다');
  await p.click('#exit-full'); await p.waitForTimeout(500); const F2 = await fsNow(); assert.deepStrictEqual([F2.full, F2.exit, F2.hint, F2.btn, F2.cw, F2.cls], [false, false, false, '전체 화면', F0.cw, 'stage-full']); assert.ok(Math.abs(F2.stage.w - F0.stage.w) < 2 && Math.abs(F2.panel.x - F0.panel.x) < 2, '닫으면 제자리');
  await G(() => __dhFull.setPseudo(true)); await p.waitForTimeout(200); assert.strictEqual((await fsNow()).full, true); await p.keyboard.press('Escape'); await p.waitForTimeout(200); const F3 = await fsNow(); assert.deepStrictEqual([F3.full, F3.cw, Math.abs(F3.stage.w - F0.stage.w) < 2], [false, F0.cw, true], '창을 채우는 방식은 Esc로 닫힌다');
  ok(`전체 화면(데스크톱 ${F1.iw}×${F1.ih}): 지도 ${Math.round(F0.stage.w)} → ${Math.round(F1.stage.w)}px(4:3) · 캔버스 ${F0.cw} → ${F1.cw}px · 오른쪽에 조작 창 · 닫기 버튼과 5초 안내 · 닫으면 제자리 · 창을 채우는 방식은 Esc로 닫힌다`);


  { const snd = await p.evaluate(() => [...new Set(__dh.sounds)]); for (const k of ['zone', 'tick', 'clash', 'drum']) assert.ok(snd.includes(k), k + ' 소리 기록 없음: ' + snd.join(' ')); ok('효과음: 플레이 중에 난 소리 ' + snd.length + '가지(' + snd.join(' · ') + ')'); }
  // 9) 휴대폰: 조작 창이 캔버스 아래로
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), m = await ctx.newPage(); m.on('pageerror', e => errs.push('m ' + e.message));
  await m.goto(url); await m.waitForTimeout(500);
  await m.waitForFunction(() => window.__dh && !document.querySelector('#run').disabled); await m.evaluate(() => document.querySelector('#run').click());
  const M = await m.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { stage: r('.dh-stage'), panel: r('.dh-panel'), sw: document.documentElement.scrollWidth, btn: Math.min(...[...document.querySelectorAll('#host button')].map(e => e.getBoundingClientRect().height)), cw: document.querySelector('.dh-canvas').width }; });
  assert.ok(M.panel.top >= M.stage.bottom && M.sw <= 390 && M.btn >= 44 && M.cw === 1440, JSON.stringify(M));
  const hp = await m.evaluate(() => { document.querySelector('.dh-canvas').scrollIntoView({ block: 'center' }); const s = __dh.scene, P = s.pos.get(39), c = s.cam.toScreen(P.x, P.y), r = document.querySelector('.dh-canvas').getBoundingClientRect(); return { x: r.left + c.x * r.width / 480, y: r.top + c.y * r.height / 360 }; });
  await m.touchscreen.tap(hp.x, hp.y); assert.strictEqual(await m.$eval('.dh-detail-title', e => e.textContent), '성도 成都');
  ok('휴대폰 390px: 조작 창이 캔버스 아래 · 가로 넘침 없음 · 플레이 버튼 44px · 손가락으로 주 찍기');

  // 10) 휴대폰에서 침공과 전투: 손가락으로 군주 · 명령 · 부대 · 칸을 찍는다
  const tapBtn = async id => { const h = await m.$(`button[data-id="${id}"]`); await h.scrollIntoViewIfNeeded(); const r = await h.boundingBox(); await m.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); };
  const tapCell = async (c, r) => { await m.evaluate(() => document.querySelector('.dh-canvas').scrollIntoView({ block: 'center' })); const q = await m.evaluate(([c, r]) => { const s = __dh.engine.scene, P = s.grid.center(c, r), k = s.cam.toScreen(P.x, P.y), R = document.querySelector('.dh-canvas').getBoundingClientRect(); return { x: R.left + k.x * R.width / 480, y: R.top + k.y * R.height / 360 }; }, [c, r]); await m.touchscreen.tap(q.x, q.y); };
  await m.evaluate(() => __dh.engine.stop()); await tapBtn('f:liuzhang'); assert.strictEqual(await m.evaluate(() => [__dh.game.player, __dh.scene.selected].join()), 'liuzhang,39');
  // 건녕은 공백지다: 칠 수 없고, 장수를 이동시키면 차지한다
  assert.strictEqual(await m.evaluate(() => __dh.game.P(41).owner), null); assert.ok(await m.$eval('button[data-id=attack]', e => e.disabled), '성도 둘레에는 칠 주가 없다(건녕은 공백지)');
  await tapBtn('move'); await tapBtn('who:152'); await tapBtn('who:ok'); assert.ok((await m.$eval('button[data-id="to:41"]', e => e.textContent)).includes('건녕 · 공백지')); await tapBtn('to:41'); const half = await m.evaluate(() => Math.floor(__dh.game.P(39).troops / 2)); { const q = await m.evaluate(() => { const bs = [...document.querySelectorAll('.dh-menu button')].map(e => e.getBoundingClientRect()), t = document.querySelector('.sam-qty').getBoundingClientRect(); return { n: bs.length, minH: Math.min(...bs.map(r => Math.round(r.height))), minW: Math.min(...bs.map(r => Math.round(r.width))), right: Math.max(t.right, ...bs.map(r => r.right)), left: Math.min(t.left, ...bs.map(r => r.left)), sw: document.documentElement.scrollWidth, clip: [...document.querySelectorAll('.dh-menu button')].filter(e => e.scrollWidth > e.clientWidth + 1).length }; });
    assert.ok(q.n === 9 && q.minH >= 44 && q.minW >= 44 && q.left >= 0 && q.right <= 390 && q.sw <= 390 && q.clip === 0, '휴대폰: 수량 버튼은 44px 이상이고 화면을 넘지 않는다 ' + JSON.stringify(q)); }
  await tapBtn('qs:half'); await tapBtn('qok');
  assert.deepStrictEqual(await m.evaluate(() => { const g = __dh.game; return [g.P(41).owner, g.P(41).troops, g.officers.get(152).province, g.P(39).acted, __dh.engine.scenes.length]; }), ['liuzhang', half, 41, true, 1], '장임이 병력 절반과 함께 건녕으로 들어가 차지했다');
  // 자동(5,000)에서 장로의 한중(5,000)으로 쳐들어간다
  const zp = await m.evaluate(() => { document.querySelector('.dh-canvas').scrollIntoView({ block: 'center' }); const s = __dh.scene, P = s.pos.get(38), c = s.cam.toScreen(P.x, P.y), r = document.querySelector('.dh-canvas').getBoundingClientRect(); return { x: r.left + c.x * r.width / 480, y: r.top + c.y * r.height / 360 }; });
  await m.touchscreen.tap(zp.x, zp.y); assert.strictEqual(await m.evaluate(() => __dh.scene.selected), 38);
  await tapBtn('attack'); await tapBtn('to:23'); const all = await m.evaluate(() => __dh.game.P(38).troops); assert.strictEqual(await m.$eval('.sam-qty b', e => e.textContent), '보낼 병력 ' + fmt(all)); await tapBtn('qok');
  assert.ok(await m.evaluate(() => !!__dh.scene.hold && __dh.engine.scenes.length === 1), '부대가 걸어가는 동안은 지도에 머문다'); await m.evaluate(() => { const cv = document.querySelector('.dh-canvas'); cv.scrollIntoView({ block: 'center' }); }); { const R = await m.evaluate(() => { const r = document.querySelector('.dh-canvas').getBoundingClientRect(); return [r.left + 20, r.top + 20]; }); await m.touchscreen.tap(...R); }      // 지도를 한 번 누르면 행군을 건너뛴다
  assert.deepStrictEqual(await m.evaluate(() => [__dh.engine.scenes.length, __dh.engine.scene.me, __dh.engine.scene.b.sides.def.name]), [2, 'att', '장로']);
  await tapCell(1, 4); const ms = await m.evaluate(() => { const s = __dh.engine.scene; __dh.engine.step(1); return { sel: s.sel && s.sel.id, reach: s.reach.size, far: [...s.reach.values()].sort((a, b) => b.c - a.c || a.cost - b.cost)[0] }; }); assert.ok(ms.sel === 'att0' && ms.reach > 10);
  const tint = await m.evaluate(() => { const c = document.querySelector('.dh-canvas'), R = c.getBoundingClientRect(); return { hl: getComputedStyle(c).webkitTapHighlightColor, px: [...c.getContext('2d').getImageData(12, 12, 1, 1).data].slice(0, 3), x: R.left + 4, y: R.top + 4 }; });
  const shotPx = await m.evaluate(async b64 => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const c = document.createElement('canvas'); c.width = c.height = 1; const g = c.getContext('2d'); g.drawImage(i, 0, 0, 1, 1); return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3); }, (await m.screenshot({ clip: { x: tint.x, y: tint.y, width: 1, height: 1 } })).toString('base64'));
  assert.deepStrictEqual(shotPx, tint.px, '찍은 뒤에도 캔버스에 누름 표시(푸른 덧칠)가 덮이지 않는다'); assert.strictEqual(tint.hl, 'rgba(0, 0, 0, 0)');
  await m.screenshot({ path: shot + '/ui-sam-phone-battle.png' }); await tapCell(ms.far.c, ms.far.r); assert.deepStrictEqual(await m.evaluate(() => { const u = __dh.engine.scene.b.units[0]; return [u.c, u.r, u.moved]; }), [ms.far.c, ms.far.r, true]);
  const MB = await m.evaluate(() => ({ sw: document.documentElement.scrollWidth, btn: Math.min(...[...document.querySelectorAll('.dh-menu button')].map(e => e.getBoundingClientRect().height)), n: document.querySelectorAll('.dh-menu button').length, info: document.querySelector('.dh-top').getBoundingClientRect().height }));
  assert.ok(MB.sw <= 390 && MB.btn >= 44 && MB.n === 6 && MB.info < 140, JSON.stringify(MB));
  await tapBtn('auto'); for (let i = 0; i < 100 && await m.evaluate(() => __dh.engine.scene.mode !== 'result'); i++) await m.evaluate(() => __dh.engine.step(60));
  await m.evaluate(() => __dh.engine.step(40)); await m.screenshot({ path: shot + '/ui-sam-phone-result.png' }); const win = await m.evaluate(() => __dh.engine.scene.res.winner); await tapBtn('back');
  assert.deepStrictEqual(await m.evaluate(() => [__dh.engine.scenes.length, __dh.game.P(23).owner]), [1, win === 'att' ? 'liuzhang' : 'zhanglu']);
  ok(`휴대폰: 유장으로 시작 · 장임을 보내 공백지 건녕을 차지 · 자동에서 한중 침공 · 손가락으로 부대와 칸 찍기(누름 덧칠 없음) · 맡기기 → ${win === 'att' ? '한중을 차지했다' : '물러났다'} · 가로 넘침 없음`);

  // 휴대폰 페이지: 시리즈 띠 · 탭 다섯 · 편집기가 390px 안에 든다
  await m.evaluate(() => { document.querySelector('.tabs button[data-tab=play]').click(); scrollTo(0, 0); }); await m.evaluate(() => __dh.engine.step(1)); await m.screenshot({ path: shot + '/ui-phone-play.png', fullPage: true });
  const mb = await m.evaluate(() => { const it = [...document.querySelectorAll('.series-item')].map(e => e.getBoundingClientRect()); return { n: it.length, right: Math.max(...it.map(r => r.right)), left: Math.min(...it.map(r => r.left)), h: Math.min(...it.map(r => r.height)), w: [...new Set(it.map(r => Math.round(r.width)))], sw: document.documentElement.scrollWidth,
    ed: ['.ed-panel', '#code', '#example', '#run', '#result', '.file-row', '.lang-rule', '.tabs', '.getting-started'].map(s => [s, Math.round(document.querySelector(s).getBoundingClientRect().right)]).filter(x => x[1] > 390) }; });
  assert.ok(mb.n === 19 && mb.right <= 390 && mb.left >= 0 && mb.h >= 44 && mb.sw <= 390 && mb.ed.length === 0, JSON.stringify(mb)); assert.strictEqual(mb.w.length, 2, '띠 19칸(홀수): 동현랭만 두 칸 폭: ' + mb.w);
  const mdocs = [];
  for (const id of ['protocol', 'rules', 'engine', 'about']) {
    const h = await m.$(`.tabs button[data-tab=${id}]`); await h.scrollIntoViewIfNeeded(); const r = await h.boundingBox(); assert.ok(r.height >= 44, id + ' 탭 버튼 높이 ' + r.height); await m.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
    const d = await m.evaluate(id => { const s = document.querySelector('#tab-' + id); return { shown: !s.hidden, sw: document.documentElement.scrollWidth, wide: [...s.querySelectorAll('h2, h3, h4, p, li, a, pre, .table-wrap, .science-block')].filter(e => e.getBoundingClientRect().right > 391).map(e => e.tagName + ':' + e.textContent.slice(0, 20)), scroll: [...s.querySelectorAll('.table-wrap, pre')].filter(e => e.scrollWidth > e.clientWidth + 1).length }; }, id);
    assert.ok(d.shown && d.sw <= 390 && d.wide.length === 0, id + ' ' + JSON.stringify(d)); mdocs.push(id + (d.scroll ? `(옆으로 미는 표·코드 ${d.scroll})` : '')); await m.screenshot({ path: shot + '/ui-phone-' + id + '.png', fullPage: true });
  }
  ok(`휴대폰 페이지: 시리즈 띠 19칸, 동현랭 두 칸 폭(${mb.w[0]}px)으로 390px 안 · 편집기와 저장 줄 넘침 없음 · 설명 탭 넷(${mdocs.join(' · ')}) 가로 넘침 없음`);

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
  ok(`휴대폰 전체 화면: 세로 ${P1.iw}×${P1.ih}는 아래로 쌓기(지도 ${Math.round(P1.stage.w)}px) · 가로 ${P2.iw}×${P2.ih}는 지도 왼쪽 가득(높이 ${Math.round(P2.stage.h)}px) + 오른쪽에 정보 띠와 조작 창 · 닫기 버튼이 정보 띠를 가리지 않는다 · 닫으면 제자리`);

  // ───────── v0.03: 저장과 불러오기 · 키보드 ─────────
  { // 새 창에서 본다(브라우저 칸이 빈 채로 시작한다). 내려받은 파일은 qa/tmp에 둔다
  const cx = await b.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true }), s = await cx.newPage(), SLOT = 'donghyunsam:slot';
  s.on('pageerror', e => errs.push(e.message)); s.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
  const open = async pg => { await pg.goto(url); await pg.waitForFunction(() => window.__dh && !document.querySelector('#run').disabled); await pg.click('#run'); await pg.evaluate(() => __dh.engine.stop()); }; await open(s);
  const S = fn => s.evaluate(fn), sInfo = () => s.$$eval('.dh-info-item', a => Object.fromEntries(a.map(e => [e.querySelector('dt').textContent, e.querySelector('dd').textContent])));
  const sMenu = pg => (pg || s).$$eval('.dh-menu button', a => a.map(e => e.dataset.id + (e.disabled ? '!' : ''))), status = () => s.$eval('#status', e => [e.textContent, e.dataset.kind || '']);
  /** 떠 있는 저장 메뉴: 제목 · 안내 글 · 버튼(흐린 버튼은 !) · 칸의 한 줄 · 초점 */
  const gm = pg => (pg || s).evaluate(() => { const back = document.querySelector('#menu-back'); if (back.hidden) return null; const m = document.querySelector('#menu'), t = m.querySelector('.menu-text'), a = document.activeElement;
    return { title: m.querySelector('h4').textContent, text: t ? t.textContent : '', items: [...m.querySelectorAll('.mi')].map(x => x.querySelector('span').textContent + (x.disabled ? '!' : '')), notes: [...m.querySelectorAll('.mi small')].map(x => x.textContent), focus: a && a.classList.contains('mi') ? a.querySelector('span').textContent : null }; });
  const pick = (label, pg) => (pg || s).click(`#menu .mi:has(span:text-is("${label}"))`), slot = n => s.evaluate(k => JSON.parse(localStorage.getItem(k)), SLOT + n), onMap = pg => (pg || s).evaluate(() => document.activeElement === document.querySelector('.dh-canvas'));
  const sFinishAI = async pg => { pg = pg || s; for (let i = 0; i < 400; i++) { const st = await pg.evaluate(() => { const z = __dh.engine.scene; return { mode: __dh.scene.mode, n: __dh.engine.scenes.length, bm: z.mode, auto: z.auto, mine: z.b && z.b.side === z.me }; });
    if (st.n === 2) { if (st.bm === 'fight' && !st.auto && st.mine) await pg.click('button[data-id=auto]'); else if (st.bm === 'result') { await pg.evaluate(() => __dh.engine.step(40)); await pg.click('button[data-id=back]'); } else await pg.evaluate(() => __dh.engine.step(20)); }
    else if (st.mode === 'busy') await pg.evaluate(() => __dh.engine.step(30)); else return; } throw new Error('다른 군주들의 차례가 끝나지 않는다'); };
  const whole = pg => (pg || s).evaluate(() => JSON.stringify([__dh.game.toJSON(), __dh.engine.clock.toJSON(), __dh.engine.rng.state]));

  // 저장 메뉴: 군주를 고르기 전에는 못 한다 → 칸 셋 · 파일 · 지우기 → 칸 1에 저장 → 덮어쓰기는 되묻는다
  assert.deepStrictEqual(await S(() => ['#game-save', '#game-load'].map(q => { const e = document.querySelector(q); return [e.textContent, e.disabled, e.getBoundingClientRect().height >= 28]; })), [['저장', false, true], ['불러오기', false, true]]);
  await s.click('#game-save'); let M = await gm(); assert.deepStrictEqual([M.title, M.text, M.items], ['지금은 저장할 수 없다', '군주를 고른 뒤에 저장할 수 있다.', ['돌아가기']]); await pick('돌아가기'); assert.strictEqual(await gm(), null);
  await s.click('button[data-id="f:liubei"]'); await S(() => __dh.engine.start()); await s.click('#game-save'); M = await gm();
  assert.deepStrictEqual([M.title, M.items, M.notes, M.focus], ['저장', ['브라우저 칸 1', '브라우저 칸 2', '브라우저 칸 3', '파일로 내려받기', '칸 지우기', '돌아가기'], ['비어 있음', '비어 있음', '비어 있음', '.dhsave'], '브라우저 칸 1']); assert.ok(M.text.includes('이 기기의 이 브라우저에만'));
  assert.strictEqual(await S(() => __dh.engine.loop.running), false, '메뉴가 떠 있는 동안 판은 멎는다'); await s.screenshot({ path: shot + '/ui-save-menu.png' });
  await s.keyboard.press('ArrowDown'); assert.strictEqual((await gm()).focus, '브라우저 칸 2'); await s.keyboard.press('ArrowUp'); await s.keyboard.press('ArrowUp'); assert.strictEqual((await gm()).focus, '돌아가기'); await s.keyboard.press('Tab'); assert.strictEqual((await gm()).focus, '브라우저 칸 1');
  await s.keyboard.press('Escape'); assert.strictEqual(await gm(), null); assert.deepStrictEqual([await S(() => __dh.engine.loop.running), await onMap()], [true, true], 'Esc로 닫으면 판이 다시 돌고 키보드는 지도에 듣는다');
  await s.click('#game-save'); await s.mouse.click(12, 12); assert.strictEqual(await gm(), null, '메뉴 바깥을 누르면 닫힌다'); await S(() => __dh.engine.stop());
  await s.click('#game-save'); await s.keyboard.press('Enter'); assert.strictEqual(await gm(), null); assert.deepStrictEqual(await status(), ['브라우저 칸 1에 저장했다 · 유비 · 200년 1월', '']);
  let d1 = await slot(1); assert.deepStrictEqual([d1.format, d1.version, d1.lab, d1.summary, d1.settings, d1.game.player, d1.game.provinces[11].farm], ['donghyunsam-save', 1, '1.11', { title: '유비', date: '200년 1월', line: '주 2 · 병력 10,000' }, [], 'liubei', 45]); assert.ok(!isNaN(new Date(d1.savedAt)));
  await s.click('button[data-id=civil]'); await s.click('button[data-id=develop]'); assert.strictEqual(await S(() => __dh.game.P(12).farm), 51); assert.ok(await onMap(), '버튼을 누른 뒤에도 키보드는 지도에 듣는다');
  await s.click('#game-save'); M = await gm(); assert.ok(/^유비 · 200년 1월 · 주 2 · 병력 10,000 · \d+\/\d+ \d\d:\d\d 저장$/.test(M.notes[0]), M.notes[0]); await pick('브라우저 칸 1'); M = await gm(); assert.deepStrictEqual([M.title, M.items], ['칸 1에 덮어쓸까?', ['덮어쓴다', '그만둔다']]);
  await pick('그만둔다'); assert.strictEqual((await gm()).title, '저장'); assert.strictEqual((await slot(1)).game.provinces[11].farm, 45, '그만두면 칸은 그대로다');
  await pick('브라우저 칸 1'); await s.keyboard.press('Escape'); assert.strictEqual((await gm()).title, '저장', '되묻는 창에서 Esc는 앞 메뉴로 돌아간다'); await pick('브라우저 칸 1'); await pick('덮어쓴다'); assert.strictEqual(await gm(), null);
  const afterDev = await whole(); d1 = await slot(1); assert.strictEqual(JSON.stringify([d1.game, d1.clock, d1.rng]), afterDev, '덮어쓴 칸은 지금 판이다');
  ok('저장 메뉴: 군주를 고르기 전에는 못 한다 · 칸 셋 · 파일 · 지우기 · ↑↓ · Tab · Esc · 바깥 누르기 · 떠 있는 동안 판이 멎는다 · 칸 1 저장 · 덮어쓰기는 되묻는다 · 버튼을 누른 뒤 초점은 지도');

  // 불러오기: 한 달을 넘긴 뒤 칸 1을 불러온다 → 저장한 달로 돌아온다 → 같은 명령이면 같은 다음 달
  await s.click('button[data-id=end]'); await sFinishAI(); const feb = await whole(); assert.strictEqual((await sInfo()).날짜, '200년 2월');
  await s.click('#game-load'); M = await gm(); assert.deepStrictEqual([M.title, M.items], ['불러오기', ['브라우저 칸 1', '브라우저 칸 2!', '브라우저 칸 3!', '파일에서 불러오기', '돌아가기']]);
  await pick('브라우저 칸 1'); M = await gm(); assert.deepStrictEqual([M.title, M.items], ['지금 판을 두고 칸 1을 불러올까? 저장하지 않은 진행은 사라진다.', ['불러온다', '그만둔다']]); await pick('그만둔다'); assert.strictEqual((await gm()).title, '불러오기'); assert.strictEqual(await whole(), feb);
  await pick('브라우저 칸 1'); await pick('불러온다'); assert.strictEqual(await gm(), null); assert.strictEqual(await whole(), afterDev); assert.deepStrictEqual(await sInfo(), { 날짜: '200년 1월', 군주: '유비', 주: '2', 병력: '10,000', '남은 명령': '1' });
  assert.deepStrictEqual(await status(), ['저장한 판을 불러왔다', '']); assert.strictEqual(await s.$eval('#result', e => e.textContent), '저장한 판을 불러왔다 · 유비 · 200년 1월 · 저장될 때의 설정: 기본값. 편집기의 코드는 그대로다.'); assert.ok(await onMap());
  assert.deepStrictEqual((await sMenu()).slice(0, 9), ['civil!', 'draft!', 'drill!', 'move!', 'attack!', 'search!', 'ally!', 'office', 'end'], '이번 달 명령을 내린 것도 돌아온다');
  await s.click('button[data-id=end]'); await sFinishAI(); assert.strictEqual(await whole(), feb, '불러온 뒤 같은 명령이면 같은 판이 이어진다');
  ok('불러오기: 빈 칸은 흐리다 · 되묻는다 · 칸 1을 불러오면 저장한 달 · 남은 명령 · 고른 주가 돌아온다 · 다시 턴 종료하면 앞서와 같은 200년 2월(난수까지 같다)');

  // 파일: .dhsave로 내려받고 다시 연다 · 맞지 않는 파일은 하던 판을 그대로 둔다
  const [dl] = await Promise.all([s.waitForEvent('download'), (async () => { await s.click('#game-save'); await pick('파일로 내려받기'); })()]), file = path.join(shot, 'ui-save.dhsave'); await dl.saveAs(file);
  assert.strictEqual(dl.suggestedFilename(), 'donghyunsam-유비-200년2월.dhsave'); assert.deepStrictEqual(await status(), ['.dhsave 파일로 내려받았다 · 유비 · 200년 2월', '']);
  const fd = JSON.parse(fs.readFileSync(file, 'utf8')); assert.strictEqual(JSON.stringify([fd.game, fd.clock, fd.rng]), feb); assert.deepStrictEqual(Object.keys(fd).sort(), ['clock', 'engine', 'format', 'game', 'lab', 'rng', 'savedAt', 'scene', 'settings', 'summary', 'tick', 'version']);
  const choose = async f => { const [fc] = await Promise.all([s.waitForEvent('filechooser'), (async () => { await s.click('#game-load'); await pick('파일에서 불러오기'); })()]); await fc.setFiles(f); await s.waitForTimeout(150); };
  const bad = (name, text) => { const f = path.join(shot, name); fs.writeFileSync(f, typeof text === 'string' ? text : JSON.stringify(text)); return f; };
  await s.keyboard.press('Space'); await s.click('button[data-id=draft]'); const mar = await whole(); assert.notStrictEqual(mar, feb);
  await choose(bad('ui-bad-other.dhsave', { ...fd, format: 'donghyunhang-save' })); assert.strictEqual(await gm(), null); assert.deepStrictEqual(await status(), ['불러오기 실패: 동현삼 저장 파일이 아니다. 하던 판은 그대로 두었다.', 'error']);
  await choose(bad('ui-bad-text.dhsave', '나는 동현이냐?')); assert.deepStrictEqual(await status(), ['불러오기 실패: 동현삼 저장 파일이 아니다. 하던 판은 그대로 두었다.', 'error']); assert.strictEqual(await whole(), mar);
  const why = [];
  for (const [name, edit] of [['version', d => { d.version = 2; }], ['troops', d => { d.game.provinces[11].troops = -5; }], ['short', d => { d.game.provinces.pop(); }], ['rng', d => { d.rng = 'x'; }], ['setting', d => { d.settings = [[3, -1]]; }]]) {
    const d = JSON.parse(JSON.stringify(fd)); edit(d); await choose(bad('ui-bad-' + name + '.dhsave', d)); M = await gm(); assert.strictEqual(M.title, '이 파일을 불러올까? 저장하지 않은 진행은 사라진다.'); await pick('불러온다');
    const st = await status(); assert.ok(st[0].startsWith('불러오기 실패: ') && st[0].endsWith(' 하던 판은 그대로 두었다.') && st[1] === 'error', st[0]); assert.strictEqual(await whole(), mar, name); why.push(st[0].slice(9, -15)); }
  assert.strictEqual(why[0], '지원하지 않는 저장 형식 버전이다(2).'); assert.deepStrictEqual(why.slice(1, 4), ['주 정보가 자료와 맞지 않는다.', '주 정보가 자료와 맞지 않는다.', '난수 정보가 맞지 않는다.'], why.join(' | ')); assert.ok(why[4].startsWith('저장된 설정이 맞지 않는다. '), why[4]);
  await choose(file); M = await gm(); assert.ok(/^유비 · 200년 2월 · 주 2 · 병력 [\d,]+ · \d+\/\d+ \d\d:\d\d 저장$/.test(M.text), M.text); assert.deepStrictEqual(M.items, ['불러온다', '그만둔다']); await pick('불러온다'); assert.strictEqual(await whole(), feb); assert.strictEqual((await status())[0], '저장한 판을 불러왔다');
  ok(`파일: ${dl.suggestedFilename()}로 내려받는다 · 다시 열면 그 판 · 다른 게임의 파일 · 글 파일 · 어긋난 값 다섯(형식 버전 · 병력 −5 · 주가 하나 모자람 · 난수 · 설정 값)은 까닭을 알리고 하던 판을 그대로 둔다`);

  // 설정도 따라온다: 동현랭으로 연 판을 칸 2에 → 기본값으로 새 판 → 칸 2를 불러오면 그때의 설정으로 돌아온다(편집기는 그대로)
  await pickEx(s, 'scale'); await s.click('#run'); assert.deepStrictEqual([await S(() => __dh.state.rules.draft.troops), (await sInfo()).군주], [2000, '유비']); await s.click('#game-save'); await pick('브라우저 칸 2'); const d2 = await slot(2); assert.strictEqual(d2.settings.length, 4);
  await pickEx(s, 'none'); await s.click('#run'); assert.deepStrictEqual([await S(() => __dh.state.rules.draft.troops), (await sInfo()).군주, await S(() => __dh.scene.settings.length)], [1000, '고르는 중', 0]); const code0 = await s.$eval('#code', e => e.value);
  await s.click('#game-load'); await pick('브라우저 칸 2'); await pick('불러온다'); const res = await s.$eval('#result', e => e.textContent);
  assert.deepStrictEqual([await S(() => __dh.state.rules.draft.troops), (await sInfo()).군주, await S(() => __dh.scene.settings), await s.$eval('#code', e => e.value) === code0], [2000, '유비', d2.settings, true]); assert.ok(res.includes('저장될 때의 설정: 군주 유비 · 우리 주 시작 금 5,000 · 우리 주 시작 쌀 20,000 · 징병 수량 2,000. 편집기의 코드는 그대로다.'), res);
  await s.keyboard.press('Space'); await s.click('button[data-id=draft]'); assert.ok((await s.$$eval('.dh-log li', a => a[0].textContent)).includes('2,000'), '불러온 설정(징병 2,000)이 적용된다');
  ok('설정도 따라온다: 동현랭으로 연 판(설정 4개)을 저장 → 기본값 새 판 → 불러오면 징병 2,000으로 돌아온다 · 편집기의 코드는 바뀌지 않는다');

  // 전투 중 · 다른 군주들의 차례: 저장은 못 하고 불러오기는 된다(전투를 접는다) · 칸 지우기
  await s.click('#game-load'); await pick('브라우저 칸 1'); await pick('불러온다'); assert.strictEqual(await whole(), afterDev); await s.keyboard.press('Space'); assert.strictEqual(await S(() => __dh.scene.selected), 13);
  await s.click('button[data-id=attack]'); await s.click('button[data-id="to:16"]'); await s.click('.dh-menu button.dh-primary'); assert.deepStrictEqual(await S(() => [__dh.engine.scenes.length, !!__dh.scene.hold]), [1, true]);
  await s.click('#game-save'); M = await gm(); assert.deepStrictEqual([M.title, M.text], ['지금은 저장할 수 없다', '부대가 닿은 뒤에 저장할 수 있다.']); await s.keyboard.press('Escape'); await S(() => __dh.engine.step(41)); assert.strictEqual(await S(() => __dh.engine.scenes.length), 2, '부대가 닿으면 전투가 열린다');
  await s.click('#game-save'); M = await gm(); assert.deepStrictEqual([M.title, M.text], ['지금은 저장할 수 없다', '전투가 끝난 뒤에 저장할 수 있다.']); await s.keyboard.press('Escape');
  await s.click('#game-load'); await pick('브라우저 칸 1'); await pick('불러온다'); assert.deepStrictEqual([await S(() => __dh.engine.scenes.length), await whole() === afterDev, await S(() => document.querySelector('.dh-detail-title').textContent)], [1, true, '소패 小沛']);
  await s.click('button[data-id=end]'); assert.strictEqual(await S(() => __dh.scene.mode), 'busy'); await s.click('#game-save'); M = await gm(); assert.deepStrictEqual([M.title, M.text], ['지금은 저장할 수 없다', '다른 군주들의 차례가 끝난 뒤에 저장할 수 있다.']); await pick('돌아가기'); await sFinishAI(); assert.strictEqual(await whole(), feb);
  await s.click('#game-save'); await pick('칸 지우기'); M = await gm(); assert.deepStrictEqual([M.title, M.items], ['칸 지우기', ['브라우저 칸 1', '브라우저 칸 2', '브라우저 칸 3!', '돌아가기']]); await pick('브라우저 칸 2'); M = await gm(); assert.deepStrictEqual([M.title, M.items], ['칸 2를 지울까? 되돌릴 수 없다.', ['지운다', '그만둔다']]);
  await pick('지운다'); M = await gm(); assert.deepStrictEqual([M.title, M.items, await slot(2), (await status())[0]], ['칸 지우기', ['브라우저 칸 1', '브라우저 칸 2!', '브라우저 칸 3!', '돌아가기'], null, '브라우저 칸 2를 지웠다']);
  await s.keyboard.press('Escape'); assert.strictEqual((await gm()).title, '저장'); await s.keyboard.press('Escape'); assert.strictEqual(await gm(), null);
  ok('전투 중과 다른 군주들의 차례에는 저장하지 못한다(까닭을 알린다) · 전투 중에 불러오면 전투를 접고 지도로 · 칸 지우기는 되묻고, 지운 칸은 흐려진다');

  // 전체 화면: 오른쪽 위 저장 · 불러오기 버튼은 전체 화면에서만 보인다 · 메뉴가 그 위에 뜬다
  const tools = () => S(() => ['#fs-save', '#fs-load', '#exit-full'].map(q => { const e = document.querySelector(q), r = e.getBoundingClientRect(); return !e.hidden && r.width > 0 && r.right <= innerWidth && r.top >= 0; }));
  assert.deepStrictEqual(await tools(), [false, false, false]); await S(() => document.querySelector('#full').scrollIntoView({ block: 'center' })); await s.click('#full'); await s.waitForTimeout(600); assert.deepStrictEqual([await S(() => __dhFull.isFull()), await tools()], [true, [true, true, true]]);
  await s.click('#fs-save'); const fm = await S(() => { const m = document.querySelector('#menu').getBoundingClientRect(), top = document.elementFromPoint(m.left + m.width / 2, m.top + 20); return { in: m.left >= 0 && m.right <= innerWidth && m.top >= 0 && m.bottom <= innerHeight, top: !!top.closest('#menu'), native: !!document.fullscreenElement }; });
  assert.ok(fm.in && fm.top, JSON.stringify(fm)); await S(() => __dh.engine.step(1)); await s.screenshot({ path: shot + '/ui-full-save.png' });
  await s.keyboard.press('ArrowDown'); await s.keyboard.press('ArrowDown'); await s.keyboard.press('Enter'); assert.strictEqual((await status())[0], '브라우저 칸 3에 저장했다 · 유비 · 200년 2월'); assert.ok(await S(() => __dhFull.isFull()));
  await s.click('#fs-load'); await pick('브라우저 칸 1'); await pick('불러온다'); assert.deepStrictEqual([await whole() === afterDev, await S(() => __dhFull.isFull()), await onMap()], [true, true, true]);
  await s.click('#fs-load'); await S(() => (document.fullscreenElement ? document.exitFullscreen() : __dhFull.setPseudo(false))); await s.waitForTimeout(400);           // 메뉴가 뜬 채로 전체 화면이 닫혀도(브라우저의 Esc) 메뉴는 남는다
  const left = await S(() => { const m = document.querySelector('#menu').getBoundingClientRect(), top = document.elementFromPoint(m.left + m.width / 2, m.top + 20); return [__dhFull.isFull(), !!top.closest('#menu'), m.top >= 0 && m.bottom <= innerHeight]; });
  assert.deepStrictEqual([left, (await gm()).title], [[false, true, true], '불러오기']); await pick('돌아가기'); assert.deepStrictEqual([await gm(), await tools()], [null, [false, false, false]]);
  await S(() => __dhFull.setPseudo(true)); await s.waitForTimeout(200); assert.deepStrictEqual(await tools(), [true, true, true]); await s.click('#fs-save'); await s.keyboard.press('Escape'); assert.deepStrictEqual([await gm(), await S(() => __dhFull.isFull())], [null, true], '창 채우기에서 Esc는 메뉴부터 닫는다');
  await s.keyboard.press('Escape'); await s.waitForTimeout(200); assert.strictEqual(await S(() => __dhFull.isFull()), false);
  ok(`전체 화면(${fm.native ? '브라우저 전체 화면' : '창 채우기'}): 저장 · 불러오기 버튼이 오른쪽 위에 · 메뉴가 화면 안에 뜬다 · 칸 3 저장 · 칸 1 불러오기 뒤에도 전체 화면 · 전체 화면이 닫혀도 메뉴는 남는다 · 창 채우기에서 Esc는 메뉴 → 전체 화면 순서로 닫는다`);

  // 키보드만으로 한 달과 전투 하나: 지도를 한 번 찍은 뒤 숫자 · 방향키 · Space · Enter · Esc
  const k = await cx.newPage(); k.on('pageerror', e => errs.push('k ' + e.message)); await open(k);
  const K = fn => k.evaluate(fn), press = async (...keys) => { for (const key of keys) await k.keyboard.press(key); }, badges = () => k.$$eval('.dh-menu button', a => a.map(e => { const m = e.querySelector('kbd.dh-key'); return (m ? m.textContent : '') + ':' + e.dataset.id + (getComputedStyle(m || e).display === 'none' ? '(숨김)' : ''); }));
  const kInfo = () => k.$$eval('.dh-info-item', a => Object.fromEntries(a.map(e => [e.querySelector('dt').textContent, e.querySelector('dd').textContent])));
  const cvXY = await K(() => { const cv = document.querySelector('.dh-canvas'); cv.scrollIntoView({ block: 'center' }); const r = cv.getBoundingClientRect(); return [r.left + 8, r.top + 8]; });
  await press('3'); assert.strictEqual(await K(() => __dh.game.player), null, '지도를 찍기 전에는 키를 듣지 않는다'); await k.mouse.click(...cvXY); assert.ok(await onMap(k));
  assert.deepStrictEqual(await badges(), ['1:f:cao', '2:f:yuan', '3:f:liubei', '4:f:liubiao', '5:f:sun', '6:f:liuzhang', '7:f:zhanglu', '8:f:mateng', '9:f:gongsundu']);
  await press('ArrowRight'); const first = await K(() => __dh.scene.selected); assert.ok(first !== null, '군주를 고르기 전에도 방향키로 주를 본다'); await press('Escape'); assert.strictEqual(await K(() => __dh.scene.selected), null);
  await press('3'); assert.deepStrictEqual([await K(() => __dh.game.player), await K(() => __dh.scene.selected)], ['liubei', 12]); assert.deepStrictEqual(await badges(), ['1:civil', '2:draft', '3:drill', '4:move', '5:attack', '6:search', '7:ally', '8:office', '9:end']);
  await K(() => __dh.engine.step(1)); await k.screenshot({ path: shot + '/ui-key-map.png' });
  const seen = new Set([12]); for (const key of ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowDown']) { const a = await K(() => __dh.scene.selected); await press(key); const z = await K(() => __dh.scene.selected); assert.notStrictEqual(z, a, key); seen.add(z); } assert.ok(seen.size >= 4, [...seen].join(' '));
  // 첫 달: Space로 소패 → 4 이동 → 2 장비 → 방향키로 하비를 겨누고 Enter → 1 병력 없이 · Space로 하비 → 1 내정 → 1 농지 개발 · + − · Enter 턴 종료
  await press('Escape', 'Space'); assert.strictEqual(await K(() => __dh.scene.selected), 12); await press('4'); assert.strictEqual(await K(() => __dh.scene.sub.step), 'who'); assert.deepStrictEqual(await badges(), ['1:who:121', '2:who:123', '3:who:ok', '4:who:none', '5:who:cart', '6:cancel']);
  await press('3'); assert.strictEqual(await K(() => __dh.scene.sub.step), 'who', '아무도 고르지 않으면 고른 장수로는 눌리지 않는다'); await press('2'); assert.deepStrictEqual(await K(() => [__dh.scene.sub.step, __dh.scene.sub.picks.join()]), ['who', '123']); await press('3'); assert.strictEqual(await K(() => __dh.scene.sub.step), 'to'); await press('ArrowRight'); assert.strictEqual(await K(() => __dh.scene.sub.aim), 13); await press('Enter'); assert.deepStrictEqual(await sMenu(k), ['q:-1000!', 'q:-100!', 'q:100', 'q:1000', 'qs:0', 'qs:half', 'qs:all', 'qok', 'cancel']); assert.ok((await badges()).every(x => x.startsWith(':')), '수량을 정할 때는 버튼에 번호가 없다');
  await press('7', '5'); assert.strictEqual(await K(() => __dh.scene.sub.n), 75, '숫자 키는 수를 적는다'); await press('Backspace', 'Backspace'); assert.strictEqual(await K(() => __dh.scene.sub.n), 0); await press('End'); assert.strictEqual(await K(() => __dh.scene.sub.n), 5000); await press('Home');
  await press('Enter'); assert.deepStrictEqual([await K(() => __dh.game.officersOf(13).map(o => o.name).sort()), await K(() => __dh.game.P(12).troops), (await kInfo())['남은 명령']], [['관우', '장비'], 5000, '1']);
  await press('4'); assert.strictEqual(await K(() => __dh.scene.sub), null, '흐린 버튼은 눌리지 않는다'); await press('Space'); assert.strictEqual(await K(() => __dh.scene.selected), 13); await press('1'); assert.deepStrictEqual(await badges(), ['1:develop', '2:flood', '3:trade', '4:relief', '5:cancel']); await press('1'); assert.deepStrictEqual([await K(() => __dh.game.P(13).farm > __dh.world.provinces.get(13).farm), (await kInfo())['남은 명령']], [true, '0']);
  const z0 = await K(() => __dh.scene.cam.zoom); await press('Equal'); const z1 = await K(() => __dh.scene.cam.zoom); await press('Minus'); assert.ok(z1 > z0 && await K(() => __dh.scene.cam.zoom) === z0);
  await press('Enter'); assert.strictEqual(await K(() => __dh.scene.mode), 'busy'); const busy = await K(() => __dh.scene.selected); await press('1', 'Space', 'ArrowUp'); assert.strictEqual(await K(() => __dh.scene.selected), busy, '다른 군주들의 차례에는 키를 듣지 않는다'); await sFinishAI(k); assert.strictEqual((await kInfo()).날짜, '200년 2월');
  // 둘째 달: 유비도 병력을 모두 데리고 하비로(4 → 1 → Enter → 방향키 · Enter → End · Enter, 소패는 공백지가 된다) → Space로 하비 → 5 침공 → 방향키로 겨눈다 → Esc로 그만두기 → 다시 5 → 방향키 → Enter → Enter(전부)
  await press('Escape', 'Space'); assert.strictEqual(await K(() => __dh.scene.selected), 12); await press('4', '1'); assert.strictEqual(await k.$eval('.dh-menu button.dh-primary', e => e.dataset.id), 'who:ok', '장수를 고르면 고른 장수로 버튼이 노랗다'); await press('Enter'); assert.strictEqual(await K(() => __dh.scene.sub.step), 'to', 'Enter로 고른 장수로를 누른다'); await press('ArrowRight', 'Enter', 'End', 'Enter'); assert.deepStrictEqual(await K(() => __dh.game.fighters(13).map(o => o.name)), ['관우', '장비'], '장수 셋이 모이면 두 부대가 나선다'); assert.deepStrictEqual(await K(() => [__dh.game.P(12).owner, __dh.game.P(12).troops]), [null, 0], '마지막 장수 유비가 병력을 모두 데리고 떠난 소패는 공백지가 된다');
  await press('Space'); assert.strictEqual(await K(() => __dh.scene.selected), 13); await press('5'); assert.deepStrictEqual([await K(() => __dh.scene.sub.step), await K(() => __dh.scene.sub.aim ?? null)], ['to', null]);
  await press('ArrowDown'); const aim = await K(() => __dh.scene.sub.aim); assert.ok(aim != null); assert.strictEqual(await k.$eval('.dh-menu button.dh-primary', e => e.dataset.id), 'to:' + aim, '겨눈 주의 버튼이 노랗다'); await K(() => __dh.engine.step(1)); await k.screenshot({ path: shot + '/ui-key-aim.png' });
  await press('Escape'); assert.deepStrictEqual([await K(() => __dh.scene.sub), await K(() => __dh.scene.selected)], [null, 13], 'Esc는 고르던 것만 그만둔다'); await press('5', 'ArrowDown', 'Enter'); assert.deepStrictEqual([await K(() => __dh.scene.sub.to), (await sMenu(k)).length], [aim, 9]);
  await press('Enter'); assert.deepStrictEqual(await K(() => [__dh.engine.scenes.length, !!__dh.scene.hold]), [1, true], 'Enter(전부)로 부대가 길을 나선다'); await press('Space'); assert.strictEqual(await K(() => __dh.engine.scenes.length), 2, '아무 키나 누르면 행군을 건너뛰고 전장이 열린다');
  // 전투: 방향키 칸 커서 → Enter로 고르고 옮긴다 → Space 다음 부대 → 1 대기 → 4 퇴각을 되묻는다 → Enter(돌아가기) → 3 맡기기 → 결과 카드에서 Enter
  const kb = () => K(() => { const z = __dh.engine.scene, b = z.b; return { cur: z.cur && [z.cur.c, z.cur.r], sel: z.sel && z.sel.id, ask: z.ask, auto: z.auto, mode: z.mode, my: z.myTurn, reach: [...z.reach.values()].map(v => [v.c, v.r]), mine: b.alive(z.me).map(u => ({ id: u.id, c: u.c, r: u.r, done: u.done, moved: u.moved })) }; });
  let B = await kb(); assert.deepStrictEqual([B.cur, B.sel, B.my], [null, null, true]); assert.deepStrictEqual(await badges(), ['1:wait', '2:end', '3:auto', '4:retreat', '5:duel', '6:fire']);
  await press('ArrowRight'); B = await kb(); const u0 = B.mine.find(u => !u.done); assert.deepStrictEqual([B.cur, B.sel], [[u0.c, u0.r], null], '첫 방향키는 우리 부대 자리에 커서를 만든다'); await press('Enter'); B = await kb(); assert.strictEqual(B.sel, u0.id); assert.ok(B.reach.length > 0);
  const row = B.reach.filter(v => v[1] === u0.r && v[0] !== u0.c).sort((a, z) => Math.abs(a[0] - u0.c) - Math.abs(z[0] - u0.c))[0]; assert.ok(row, '같은 줄에 갈 칸이 있다');
  for (let i = 0; i < Math.abs(row[0] - u0.c); i++) await press(row[0] > u0.c ? 'ArrowRight' : 'ArrowLeft'); B = await kb(); assert.deepStrictEqual(B.cur, row); await K(() => __dh.engine.step(1)); await k.screenshot({ path: shot + '/ui-key-battle.png' });
  await press('Enter'); B = await kb(); const u1 = B.mine.find(u => u.id === u0.id); assert.deepStrictEqual([[u1.c, u1.r], u1.moved], [row, true], 'Enter로 커서 칸에 옮긴다');
  await press('ArrowDown'); const dn = (await kb()).cur; await press('ArrowUp'); assert.deepStrictEqual([dn[1], (await kb()).cur], [row[1] + 1, row], '위아래로 갔다 오면 제자리');
  await press('Escape'); assert.strictEqual((await kb()).sel, null); await press('Space'); B = await kb(); const nx = B.mine.find(u => u.id === B.sel); assert.ok(nx && !nx.done); assert.deepStrictEqual(B.cur, [nx.c, nx.r], 'Space는 다음 부대를 고르고 커서를 옮긴다');
  await press('1'); B = await kb(); assert.ok(B.mine.find(u => u.id === nx.id).done && B.sel === null, '1 대기');
  assert.ok(B.my, '틱이 가기 전에는 아직 우리 차례다'); await press('4'); assert.deepStrictEqual([(await kb()).ask, await badges()], [true, ['1:yes', '2:no']]); await press('Enter'); assert.deepStrictEqual([(await kb()).ask, await K(() => __dh.engine.scenes.length)], [false, 2], '되묻는 창에서 Enter는 돌아가기');
  await press('3'); for (let i = 0; i < 400 && (await kb()).mode !== 'result'; i++) await K(() => __dh.engine.step(20)); assert.strictEqual((await kb()).mode, 'result'); assert.deepStrictEqual(await badges(), ['1:back']);
  await press('Enter'); assert.strictEqual(await K(() => __dh.engine.scenes.length), 2, '결과 카드는 잠깐 본 뒤에 닫힌다'); await K(() => __dh.engine.step(40)); await press('Enter'); assert.strictEqual(await K(() => __dh.engine.scenes.length), 1); assert.ok(await onMap(k));
  await press('Space'); assert.ok(await K(() => __dh.scene.selected) !== null, '전투 뒤에도 지도가 키를 듣는다');
  ok(`키보드만으로 두 달과 전투 하나: 지도를 찍기 전에는 듣지 않는다 · 3으로 유비 · 방향키로 주 고르기(${seen.size}곳) · Space · 4 이동(2 장비 → 방향키 · Enter → 1 병력 없이) · 1 내정 → 1 농지 개발 · + − · Enter 턴 종료 · 5 침공 → 방향키로 겨누고 Enter 둘 → 아무 키로 행군 건너뛰기 → 전장에서 칸 커서 · Enter로 옮기기 · Space 다음 부대 · 1 대기 · 4 퇴각 → Enter(돌아가기) · 3 맡기기 · 결과 카드 Enter`);

  // 휴대폰(390px): 저장 줄과 메뉴가 화면 안에 · 손가락으로 저장하고 불러온다 · 버튼 번호는 숨는다
  const pc = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), h = await pc.newPage(); h.on('pageerror', e => errs.push('h ' + e.message)); await open(h);
  const tap = async sel => { const e = await h.$(sel); await e.scrollIntoViewIfNeeded(); const r = await e.boundingBox(); await h.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); }, tapItem = label => tap(`#menu .mi:has(span:text-is("${label}"))`);
  const bar = await h.evaluate(() => { const r = q => document.querySelector(q).getBoundingClientRect(), a = ['#game-save', '#game-load', '#full'].map(r); return { tops: new Set(a.map(x => Math.round(x.top))).size, h: Math.min(...a.map(x => x.height)), right: Math.max(...a.map(x => x.right)), note: r('.save-note').bottom <= a[0].top + 1, sw: document.documentElement.scrollWidth }; });
  assert.ok(bar.tops === 1 && bar.h >= 32 && bar.right <= 390 && bar.note && bar.sw <= 390, JSON.stringify(bar));
  await tap('button[data-id="f:liubei"]'); assert.ok((await h.$$eval('.dh-menu kbd.dh-key', a => a.map(e => getComputedStyle(e).display))).every(x => x === 'none'), '손가락 화면에서는 버튼 번호를 숨긴다');
  await tap('#game-save'); const pm = await h.evaluate(() => { const m = document.querySelector('#menu').getBoundingClientRect(), it = [...document.querySelectorAll('#menu .mi')].map(e => e.getBoundingClientRect()); return { l: m.left, r: m.right, t: m.top, b: m.bottom, h: Math.min(...it.map(x => x.height)), n: it.length, sw: document.documentElement.scrollWidth, ih: innerHeight }; });
  assert.ok(pm.l >= 0 && pm.r <= 390 && pm.t >= 0 && pm.b <= pm.ih && pm.h >= 44 && pm.n === 6 && pm.sw <= 390, JSON.stringify(pm)); await h.evaluate(() => __dh.engine.step(1)); await h.screenshot({ path: shot + '/ui-phone-save.png' });
  await tapItem('브라우저 칸 1'); assert.strictEqual(await h.$eval('#status', e => e.textContent), '브라우저 칸 1에 저장했다 · 유비 · 200년 1월'); const p0 = await whole(h);
  await tap('button[data-id=civil]'); await tap('button[data-id=develop]'); assert.notStrictEqual(await whole(h), p0); await tap('#game-load'); await tapItem('브라우저 칸 1'); await tapItem('불러온다'); assert.strictEqual(await whole(h), p0); assert.strictEqual(await gm(h), null);
  await tap('#game-load'); await h.touchscreen.tap(8, 8); assert.strictEqual(await gm(h), null, '메뉴 바깥을 누르면 닫힌다');
  ok(`휴대폰: 저장 · 불러오기 · 전체 화면 버튼이 한 줄(높이 ${Math.round(bar.h)}px) · 메뉴가 390px 안(버튼 ${Math.round(pm.h)}px) · 손가락으로 칸 1 저장 → 불러오기 · 버튼 번호는 숨김`);

  // 달이 바뀌면서 판이 끝나면(기한이 찼다) 그 자리에서 끝 화면이 된다
  { const t = await b.newPage({ viewport: { width: 1280, height: 860 } }); t.on('pageerror', e => errs.push(e.message)); t.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
    await t.goto(url); await t.waitForFunction(() => window.__dh && !document.querySelector('#run').disabled); await pickEx(t, 'stage'); await t.click('#run'); await t.evaluate(() => __dh.engine.stop());
    const T = fn => t.evaluate(fn), tm = () => t.$$eval('.dh-menu button', a => a.map(e => e.dataset.id + (e.disabled ? '!' : '')));
    assert.deepStrictEqual(await T(() => [__dh.game.player, __dh.game.stage.months, __dh.game.goal, __dh.scene.mode]), ['liubei', 36, 5, 'play']);
    await T(() => { const g = __dh.game; g.months = 35; for (const q of g.provinces.values()) if (q.owner === g.player) { q.troops = 300000; q.rice = 9000000; } });
    await t.click('button[data-id=end]'); await sFinishAI(t);
    assert.deepStrictEqual(await T(() => [__dh.game.months, __dh.game.over, __dh.game.overWhy, __dh.scene.mode]), [36, 'lost', 'time', 'over'], '서른여섯째 달이 끝나면 바로 끝 화면');
    assert.deepStrictEqual(await tm(), ['again']); const top = await t.$$eval('.dh-log li', a => a.slice(0, 3).map(e => e.textContent)); assert.strictEqual(top[0], '기한이 다 되었다', JSON.stringify(top));
    await t.click('button[data-id=again]'); assert.deepStrictEqual(await T(() => [__dh.game.months, __dh.game.over, __dh.scene.mode]), [0, null, 'play'], '다시 하기는 같은 설정으로 새 판'); await t.close();
    ok('기한: 스테이지(36달)의 마지막 달을 넘기면 턴 종료를 다시 누르지 않아도 끝 화면(기한이 다 되었다 · 다시 하기)'); }
  }

  // ───────── 편집기 아래 저장 칸 목록(다른 실험실과 같은 모양) ─────────
  { const cl = await b.newContext({ viewport: { width: 1280, height: 860 } }), l = await cl.newPage(); l.on('pageerror', e => errs.push('slot ' + e.message)); await l.goto(url); await l.waitForFunction(() => window.__dh && !document.querySelector('#run').disabled);
    const L = fn => l.evaluate(fn), list = () => L(() => [...document.querySelectorAll('#slot-list .slot-row')].map(r => { const b = r.querySelector('.slot-btn'), x = r.querySelector('.slot-del'); return { t: [...b.children].map(e => e.textContent), off: b.disabled, del: x ? x.textContent : null }; }));
    let rows = await list(); assert.deepStrictEqual(rows, [1, 2, 3].map(n => ({ t: ['칸 ' + n, '비어 있음'], off: true, del: null })), '빈 칸 셋은 흐리고 지우기 버튼이 없다');
    assert.deepStrictEqual(await L(() => [document.querySelector('.load-head strong').textContent, document.querySelector('.load-head label').textContent.trim(), !!document.querySelector('.load-box').closest('.setup-panel')]), ['저장한 판 불러오기', '파일에서 불러오기', true]);
    await l.click('#run'); await l.click('button[data-id="f:liubei"]'); await l.click('#game-save'); await l.click('#menu .mi:has(span:text-is("브라우저 칸 2"))');
    rows = await list(); assert.deepStrictEqual([rows[0].off, rows[1].off, rows[2].off, rows[1].del, rows[1].t[0]], [true, false, true, '지우기', '칸 2']); assert.ok(/^유비 · 200년 1월 · \d+\/\d+ \d\d:\d\d 저장$/.test(rows[1].t[1]), rows[1].t[1]); assert.ok(rows[1].t[2] && rows[1].t[2].length > 3, '요약 줄이 셋째 줄에');
    const saved = await L(() => localStorage.getItem('donghyunsam:slot2')); await l.reload(); await l.waitForFunction(() => window.__dh && !document.querySelector('#run').disabled);
    assert.deepStrictEqual((await list())[1].t, rows[1].t, '다시 열어도 목록이 그대로 보인다'); assert.strictEqual(await L(() => __dh.waiting()), true);
    await L(() => document.querySelector('.load-box').scrollIntoView({ block: 'center' })); await l.screenshot({ path: shot + '/ui-slot-list.png' });
    await l.click('#slot-list .slot-row:nth-child(2) .slot-btn'); assert.deepStrictEqual([await L(() => __dh.waiting()), await L(() => __dh.game.player), await l.$eval('#status', e => e.textContent), await L(() => document.querySelector('#menu-back').hidden)], [false, 'liubei', '저장한 판을 불러왔다', true], '출전하기 전에는 칸을 누르면 바로 이어 한다');
    await l.click('#slot-list .slot-row:nth-child(2) .slot-btn'); assert.deepStrictEqual(await L(() => [...document.querySelectorAll('#menu .mi span:first-child')].map(e => e.textContent)), ['불러온다', '그만둔다'], '하던 판이 있으면 되묻는다'); await l.click('#menu .mi:has(span:text-is("그만둔다"))');
    await l.click('#slot-list .slot-row:nth-child(2) .slot-del'); assert.deepStrictEqual([(await list())[1].del, await L(() => localStorage.getItem('donghyunsam:slot2'))], ['정말 지운다', saved], '한 번 누르면 되묻기만 한다');
    await l.click('#slot-list .slot-row:nth-child(2) .slot-del'); assert.deepStrictEqual([await list(), await L(() => localStorage.getItem('donghyunsam:slot2')), await l.$eval('#status', e => e.textContent)], [[1, 2, 3].map(n => ({ t: ['칸 ' + n, '비어 있음'], off: true, del: null })), null, '브라우저 칸 2를 지웠다.']);
    await l.setViewportSize({ width: 390, height: 844 }); await L(() => localStorage.setItem('donghyunsam:slot1', '{"format":"x"}')); await l.reload(); await l.waitForFunction(() => window.__dh && !document.querySelector('#run').disabled);
    const ph = await L(() => { const r = [...document.querySelectorAll('#slot-list .slot-row, .load-head, .load-box .slot-note, #slot-list button')].map(e => e.getBoundingClientRect()); return { sw: document.documentElement.scrollWidth, right: Math.max(...r.map(x => x.right)), left: Math.min(...r.map(x => x.left)), h: Math.min(...[...document.querySelectorAll('#slot-list button')].map(e => e.getBoundingClientRect().height)) }; });
    assert.ok(ph.sw <= 390 && ph.right <= 390 && ph.left >= 0 && ph.h >= 40, JSON.stringify(ph)); await L(() => localStorage.clear()); await cl.close();
    ok('저장 칸 목록: 편집기 아래 칸 셋(빈 칸은 흐림) · 저장하면 제목 · 날짜 · 저장 시각 · 요약 · 출전 전에는 눌러서 바로 이어 하기 · 하던 판이 있으면 되묻기 · 지우기는 두 번 눌러야 · 휴대폰 390px 안'); }


  // ───────── v0.30: 두 낭자와 지도 배율 ─────────
  { const cx = await b.newContext({ viewport: { width: 1280, height: 860 } }), c = await cx.newPage(); c.on('pageerror', e => errs.push('council ' + e.message)); c.on('console', x => { if (x.type() === 'error') errs.push('council ' + x.text()); });
    await c.goto(url); await c.waitForFunction(() => window.__dh && !document.querySelector('#run').disabled);
    const E = fn => c.evaluate(fn), say = () => E(() => ({ a: document.querySelector('.sam-say:not(.sam-say-b) .sam-text').textContent, b: document.querySelector('.sam-say-b .sam-text').textContent, src: (e => e.hidden ? null : [e.textContent, e.href, e.target, e.rel, e.title])(document.querySelector('.sam-src')) }));
    const tapP = id => E(`(() => { const s = __dh.scene, P = s.pos.get(${id}), q = s.cam.toScreen(P.x, P.y); s.onTap(q.x, q.y); })()`);
    /** 얼굴과 카드의 자리 · 아이콘에 가린 주 · 가로 넘침 */
    const look = () => E(async () => { const q = s => document.querySelector(s), R = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, ps = [...document.querySelectorAll('.sam-portrait')], cs = ps.map(e => getComputedStyle(e));
      const img = new Image(); img.src = cs[0].backgroundImage.slice(5, -2); await img.decode();
      const sc = __dh.scene, cv = q('.dh-canvas').getBoundingClientRect(), k = cv.width / 480, ic = q('.sam-zoom').getBoundingClientRect();
      const under = [...sc.pos.entries()].filter(([id, P]) => { const a = sc.cam.toScreen(P.x, P.y), x = cv.left + a.x * k, y = cv.top + a.y * k; return x + 14 * k > ic.left && x - 14 * k < ic.right && y + 22 * k > ic.top && y - 12 * k < ic.bottom; }).map(([id]) => sc.game.P(id).name);
      const out = [...sc.pos.values()].filter(P => { const a = sc.cam.toScreen(P.x, P.y); return a.x < 12 || a.x > 468 || a.y < 10 || a.y > 345; }).length;
      return { first: q('.dh-panel').firstElementChild.className, card: R(q('.sam-counsel')), panel: R(q('.dh-panel')), faces: ps.map(R), img: [img.naturalWidth, img.naturalHeight], data: cs[0].backgroundImage.startsWith('url("data:image/png;base64,'), pos: cs.map(x => x.backgroundPositionX), flip: cs.map(x => x.transform), caps: [...document.querySelectorAll('.sam-face figcaption')].map(e => e.textContent), alt: ps.map(e => e.getAttribute('aria-label')),
        zoom: sc.cam.zoom, under, out, icon: R(q('.sam-zoom')), cv: R(q('.dh-canvas')), sw: document.documentElement.scrollWidth, iw: innerWidth, cls: q('#stage-full').className }; });
    const L0 = await look(), S0 = await say();
    assert.strictEqual(await E(() => __dh.waiting()), true); assert.strictEqual(L0.first, 'sam-counsel', '조작 창 맨 위'); assert.deepStrictEqual(L0.caps, ['동행낭자', '수행낭자']); assert.deepStrictEqual(L0.alt, ['동행낭자 얼굴 초상', '수행낭자 얼굴 초상']);
    assert.deepStrictEqual([L0.img, L0.data, L0.pos, L0.flip], [[192, 128], true, ['0px', '100%'], ['none', 'matrix(-1, 0, 0, 1, 0, 0)']], '얼굴 그림 두 칸 · 오른쪽 얼굴만 뒤집어 마주 본다');
    assert.ok(L0.faces.every(f => f.w === 72 && f.h === 96) && L0.faces[0].r < L0.faces[1].l && Math.abs(L0.faces[0].t - L0.faces[1].t) < 1 && L0.faces[0].l >= L0.panel.l && L0.faces[1].r <= L0.panel.r, JSON.stringify(L0.faces));
    assert.ok(S0.a.startsWith('주군, 저는') && S0.a.includes('동행낭자') && S0.b === '주군, 저는 곁에서 살필 수행낭자입니다. 주군께서 운영하실 규칙과 숨은 셈법을 하나씩 아뢰겠습니다.' && S0.src === null, '출전 전부터 두 낭자가 말한다');
    assert.deepStrictEqual([L0.zoom, L0.under, L0.out], [1.125, [], 0], '처음 배율 1.125 · 아이콘에 가린 주가 없다 · 41개 주가 모두 보인다');
    await E(() => document.querySelector('.dh-canvas').scrollIntoView({ block: 'center' })); await c.screenshot({ path: shot + '/ui-council-first.png' });
    await c.click('#run'); await c.waitForTimeout(200); const Lr = await look(); assert.deepStrictEqual([Lr.zoom, Lr.under, Lr.out], [1.125, [], 0], '출전해도 그대로 · 아이콘에 가린 주가 없다');
    assert.ok(Lr.icon.w > 70 && Lr.icon.r <= Lr.cv.r && Lr.icon.b <= Lr.cv.b && Lr.icon.t > Lr.cv.t + Lr.cv.h / 2 && Lr.icon.l > Lr.cv.l + Lr.cv.w / 2, '아이콘은 지도 오른쪽 아래');
    await tapP(14); const S1 = await say(), xc = await E(() => [__dh.game.P(14).troops, __dh.game.officersOf(14).length, __dh.game.troopsOf('cao'), __dh.game.provincesOf('cao').length]);
    assert.ok(S1.a.startsWith('주군, 허창은') && S1.a.endsWith(`군주 조조가 이곳에 머물고 있으며, 병력은 ${fmt(xc[0])}, 장수는 ${xc[1]}명입니다. 조조 세력은 모두 ${xc[3]}주, 병력 ${fmt(xc[2])}입니다.`) && S1.src === null && S1.b !== S0.b, S1.a);
    await c.click('button[data-id="f:liubei"]'); const S2 = await say(), QQ = /^주군, 『장자』 「(.+)」의 한 구절입니다\. “(.+)”$/;
    assert.ok(QQ.test(S2.a) && S2.b !== S1.b, S2.a); assert.ok(S2.src && S2.src[0] === `『장자』 「${S2.a.match(QQ)[1]}」 원문 · 직접 옮김` && S2.src[1].startsWith('https://zh.wikisource.org/wiki/%E8%8E%8A%E5%AD%90/') && S2.src[2] === '_blank' && S2.src[3] === 'noopener' && /^[\u3400-\u9fff（），。；：？、]+$/.test(S2.src[3 + 1]), JSON.stringify(S2.src));
    await c.click('button[data-id=draft]'); assert.deepStrictEqual(await say(), S2, '명령을 내려도 말은 그대로');
    const P12 = await E(() => { const s = __dh.scene, P = s.pos.get(12), q = s.cam.toScreen(P.x, P.y), cv = document.querySelector('.dh-canvas'); cv.scrollIntoView({ block: 'center' }); const r = cv.getBoundingClientRect(); return [r.left + q.x * r.width / 480, r.top + q.y * r.height / 360]; });
    await c.mouse.click(P12[0], P12[1]); const S3 = await say(); assert.ok(QQ.test(S3.a) && S3.a !== S2.a && S3.b !== S2.b, '같은 주를 다시 누르면 다음 구절 · 수행낭자도 새 한 마디');
    await tapP(27); const S4 = await say(), jz = await E(() => { const g = __dh.game, p = g.P(27); return [p.name, p.troops, g.factions.get(p.owner).name]; }); assert.ok(S4.a.startsWith(`주군, ${jz[0]}`) && S4.a.includes(`병력은 ${fmt(jz[1])},`) && S4.a.includes(jz[2]) && S4.src === null && S4.b !== S3.b, S4.a);
    await c.click('.dh-canvas'); await c.keyboard.press('Escape'); const S5 = await say(); assert.strictEqual(S5.a, `주군, 우리 땅은 2주, 병력은 모두 ${fmt(await E(() => __dh.game.troopsOf('liubei')))}입니다. 이번 달 명령이 남은 주는 1곳입니다.`);
    for (const t of [S0, S1, S2, S3, S4, S5]) assert.ok(!/뿐|!|undefined|NaN/.test(t.a + t.b) && /(니다|시지요)\.$/.test(t.b), t.b);
    // 글자와 바탕의 명암(밝은 테마 · 어두운 테마)
    const contrast = () => E(() => { const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }, bg = lum(getComputedStyle(document.querySelector('.dh-panel')).backgroundColor);
      return ['.sam-text', '.sam-face figcaption', '.sam-who', '.sam-src'].map(s => { const e = document.querySelector(s), st = getComputedStyle(e), back = s === '.sam-who' ? lum(st.backgroundColor) : bg, f = lum(st.color); return +((Math.max(f, back) + 0.05) / (Math.min(f, back) + 0.05)).toFixed(2); }); });
    await tapP(12); const cl = await contrast(); await c.click('#theme'); const cd = await contrast(); assert.ok([...cl, ...cd].every(v => v >= 4.5), '명암비 ' + JSON.stringify([cl, cd]));
    await E(() => document.querySelector('.dh-canvas').scrollIntoView({ block: 'center' })); await c.screenshot({ path: shot + '/ui-council-dark.png' }); await c.click('#theme');
    // 배율의 단: + 1.40625 · − 1.125 · − 1 · 키도 같은 단
    await c.click('.sam-zoom button[data-zoom=zin]'); assert.strictEqual((await look()).zoom, 1.40625); await c.click('.sam-zoom button[data-zoom=zout]'); const Lh = await look(); assert.deepStrictEqual([Lh.zoom, Lh.out], [1.125, 0]);
    await c.click('.sam-zoom button[data-zoom=zout]'); const L1 = await look(); assert.deepStrictEqual([L1.zoom, L1.out, L1.under], [1, 0, []]); await c.click('.dh-canvas'); await c.keyboard.press('Equal'); assert.strictEqual((await look()).zoom, 1.125); await c.keyboard.press('Equal'); await c.keyboard.press('Minus'); assert.strictEqual((await look()).zoom, 1.125);
    // 전체 화면(낮은 화면 1280×720): 카드가 맨 위 · 명령 버튼이 창 안에 붙어 있다 · 배율 그대로
    await c.setViewportSize({ width: 1280, height: 720 }); await c.click('#full'); await c.waitForTimeout(400); await tapP(13); const F = await look(), fb = await E(() => { const pn = document.querySelector('.dh-panel').getBoundingClientRect(); return { n: document.querySelectorAll('.dh-menu button').length, in: [...document.querySelectorAll('.dh-menu button')].every(e => { const r = e.getBoundingClientRect(); return r.top >= pn.top && r.bottom <= pn.bottom + 1; }), over: document.querySelector('.dh-panel').scrollHeight > document.querySelector('.dh-panel').clientHeight }; });
    assert.ok(/\bfs\b/.test(F.cls) && F.first === 'sam-counsel' && F.zoom === 1.125 && F.out === 0 && F.under.length === 0 && F.card.t >= F.panel.t && F.card.b < F.panel.b && F.faces[0].w === 54, JSON.stringify([F.cls, F.zoom, F.card, F.panel]));
    assert.deepStrictEqual(fb, { n: 9, in: true, over: true }, '조작 창이 넘쳐도 명령 버튼 아홉이 창 안에 보인다'); await c.screenshot({ path: shot + '/ui-council-full-720.png' });
    await c.click('.dh-menu button[data-id=civil]'); await c.click('.dh-menu button[data-id=develop]'); assert.strictEqual(await E(() => __dh.game.P(13).acted), true, '붙어 있는 버튼이 눌린다');
    await c.setViewportSize({ width: 1512, height: 982 }); await c.waitForTimeout(300); const F2 = await look(); assert.ok(F2.faces[0].w === 72 && F2.zoom === 1.125 && F2.under.length === 0 && F2.sw <= F2.iw, JSON.stringify(F2.faces)); await c.screenshot({ path: shot + '/ui-council-full-1512.png' });
            await cx.close();
    ok('두 낭자: 출전 전부터 조작 창 맨 위에서 마주 본다 · 남의 땅은 군주와 병력(판의 값) · 우리 땅은 『장자』와 원문 링크 · 같은 주를 다시 누르면 다음 구절 · 두 테마 명암비 4.5 이상 · 처음 배율 1.125와 배율의 단 · 전체 화면에서 명령 버튼이 창 안'); }
  // 휴대폰(390×844): 카드가 화면 안 · 얼굴 54×72 · 처음 배율 1.125 · 아이콘에 가린 주 없음
  { const cx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }), m = await cx.newPage(); m.on('pageerror', e => errs.push('council-m ' + e.message));
    await m.goto(url); await m.waitForFunction(() => window.__dh && !document.querySelector('#run').disabled);
    const look = () => m.evaluate(() => { const q = s => document.querySelector(s), R = e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: r.width, h: r.height }; }, sc = __dh.scene, cv = q('.dh-canvas').getBoundingClientRect(), k = cv.width / 480, ic = q('.sam-zoom').getBoundingClientRect();
      const under = [...sc.pos.entries()].filter(([id, P]) => { const a = sc.cam.toScreen(P.x, P.y), x = cv.left + a.x * k, y = cv.top + a.y * k; return x + 14 * k > ic.left && x - 14 * k < ic.right && y + 22 * k > ic.top && y - 12 * k < ic.bottom; }).length;
      return { sw: document.documentElement.scrollWidth, card: R(q('.sam-counsel')), faces: [...document.querySelectorAll('.sam-portrait')].map(R), text: [...document.querySelectorAll('.sam-say')].map(R), zoom: sc.cam.zoom, under, first: q('.dh-panel').firstElementChild.className }; });
    const M0 = await look(); assert.ok(M0.sw <= 390 && M0.card.l >= 0 && M0.card.r <= 390 && M0.faces.every(f => f.w === 54 && f.h === 72 && f.l >= 0 && f.r <= 390) && M0.text.every(t => t.l >= 0 && t.r <= 390), JSON.stringify(M0)); assert.deepStrictEqual([M0.zoom, M0.under, M0.first], [1.125, 0, 'sam-counsel']);
    await m.tap('#run'); await m.tap('button[data-id="f:liubei"]'); const M1 = await look(); assert.ok(M1.sw <= 390 && M1.zoom === 1.125 && M1.under === 0);
    assert.ok((await m.$eval('.sam-say:not(.sam-say-b) .sam-text', e => e.textContent)).startsWith('주군, 『장자』')); await m.evaluate(() => document.querySelector('.dh-canvas').scrollIntoView({ block: 'start' })); await m.screenshot({ path: shot + '/ui-council-phone.png' });
    await cx.close(); ok('두 낭자(휴대폰 390px): 카드와 얼굴(54×72)이 화면 안 · 처음 배율 1.125 · 아이콘에 가린 주 없음'); }

  // ───────── 예제를 고르면 지도가 그 배치로 바뀐다(v1.11) ─────────
  { const v = await b.newPage({ viewport: { width: 1280, height: 860 } }); v.on('pageerror', e => errs.push(e.message)); v.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
    await v.goto(url); await v.waitForFunction(() => window.__dh && !document.querySelector('#run').disabled);
    const V = () => v.evaluate(() => { const g = __dh.game, w = __dh.world, c = document.querySelector('#code').value, top = __dh.engine.scenes.at(-1);
      return { w: __dh.waiting(), top: top.constructor.name, title: w.title, date: document.querySelector('.dh-info-item dd').textContent, player: g.player, mode: __dh.scene.mode, ex: document.querySelector('#example').value, btn: document.querySelectorAll('.dh-menu button').length,
        lords: new Set([...g.provinces.values()].map(q => q.owner).filter(Boolean)).size, p12: g.P(12).owner, full: document.querySelector('#full').disabled, st: document.querySelector('#status').textContent, said: [...document.querySelectorAll('.dh-log li')].filter(e => e.textContent.startsWith('시나리오: ')).length, peek: [...document.querySelectorAll('.dh-log li')].map((e, i) => (i ? '(맨 위 아님) ' : '') + e.textContent).filter(t => t.includes('미리 보기: ')).join(' | '),
        card: top.constructor.name !== 'StartCard' || top._src === undefined || top._src === c, n31: (c.match(/^\s*뿡{31} /m) || []).length }; });
    const asked = () => v.locator('#menu .mi:has(span:text-is("바꾼다"))').isVisible(), say = label => v.click(`#menu .mi:has(span:text-is("${label}"))`), exCode = id => v.evaluate(id => __dh.examples.find(e => e.id === id).code, id);
    let a = await V(); assert.deepStrictEqual([a.w, a.top, a.title, a.date, a.p12, a.lords, a.ex], [true, 'StartCard', '200년 1월 · 기본 배치', '200년 1월', 'liubei', 9, 'none']);
    await v.selectOption('#example', 's189'); assert.strictEqual(await asked(), false, '출전 전에는 묻지 않는다'); await v.evaluate(() => __dh.engine.step(1)); a = await V();
    assert.deepStrictEqual([a.w, a.top, a.title, a.date, a.p12, a.lords, a.player, a.mode, a.btn, a.full, a.st, a.said, a.card], [true, 'StartCard', '189년 12월 · 동탁과 제후들', '189년 12월', 'taoqian', 14, null, 'pick', 0, true, '출전 준비', 0, true], '예제를 고르면 지도 · 날짜 · 시작 카드가 그 배치로 바뀐다(판은 시작하지 않는다)'); assert.strictEqual(a.peek, '미리 보기: 189년 12월 · 동탁과 제후들 · 군주 14', '기록 맨 위에 미리 보는 배치가 한 줄 적힌다');
    await v.screenshot({ path: shot + '/ui-preview-s189.png' });
    await v.click('#run'); a = await V(); assert.deepStrictEqual([a.w, a.mode, a.btn, a.said, a.peek], [false, 'pick', 14, 1, ''], '출전하면 그 배치의 군주 열넷이 나오고 미리 보기 줄은 지워진다');
    await v.selectOption('#example', 's208'); assert.strictEqual(await asked(), false, '군주를 고르기 전에는 묻지 않는다'); a = await V();
    assert.deepStrictEqual([a.w, a.top, a.title, a.date, a.p12, a.lords, a.btn, a.full], [true, 'StartCard', '208년 9월 · 큰 강의 싸움 앞', '208년 9월', 'cao', 7, 0, true], '군주를 고르던 중에 예제를 바꾸면 옛 군주 메뉴가 남지 않는다'); assert.strictEqual(a.peek, '미리 보기: 208년 9월 · 큰 강의 싸움 앞 · 군주 7');
    await v.selectOption('#example', 's221'); await v.selectOption('#example', 's208'); a = await V(); assert.strictEqual(a.peek, '미리 보기: 208년 9월 · 큰 강의 싸움 앞 · 군주 7', '예제를 넘겨 봐도 미리 보기 줄은 하나뿐이다');
    await v.click('#run'); a = await V(); assert.deepStrictEqual([a.w, a.btn], [false, 7]); await v.click('button[data-id="f:cao"]'); a = await V(); assert.deepStrictEqual([a.player, a.mode], ['cao', 'play']);
    const kept = await v.$eval('#code', e => e.value); await v.selectOption('#example', 's235'); assert.strictEqual(await asked(), true, '하던 판이 있으면 묻는다'); assert.ok((await v.$eval('#menu', e => e.textContent)).includes('저장하지 않은 진행은 사라진다'));
    await say('그만둔다'); a = await V(); assert.deepStrictEqual([a.ex, a.title, a.player, a.w, await v.$eval('#code', e => e.value) === kept], ['s208', '208년 9월 · 큰 강의 싸움 앞', 'cao', false, true], '그만두면 목록 · 코드 · 하던 판이 그대로다');
    await v.selectOption('#example', 's235'); await say('바꾼다'); a = await V(); assert.deepStrictEqual([a.ex, a.title, a.date, a.player, a.w, a.top, a.btn], ['s235', '235년 2월 · 별이 진 뒤', '235년 2월', null, true, 'StartCard', 0]); assert.strictEqual(a.peek, '미리 보기: 235년 2월 · 별이 진 뒤 · 군주 ' + a.lords);
    // 손으로 고친 코드: 출전 전에는 지도가 따라가고, 하던 판은 건드리지 않는다
    await v.fill('#code', await exCode('s194')); await v.waitForTimeout(450); a = await V(); assert.deepStrictEqual([a.title, a.w, a.card], ['194년 11월 · 흩어진 군웅', true, true], '출전 전에는 손으로 고친 코드도 지도가 따라간다'); assert.ok(a.peek.startsWith('미리 보기: 194년 11월') && !a.peek.includes('|'), a.peek);
    await v.fill('#code', '나는 동현이냐?\n뿡뿡 도오오옹\n동현이구나'); await v.waitForTimeout(450); a = await V(); assert.deepStrictEqual([a.title, a.w], ['194년 11월 · 흩어진 군웅', true], '틀린 코드는 지도를 바꾸지 않는다');
    await v.fill('#code', await exCode('s194')); await v.click('#run'); await v.click('.dh-menu button[data-id^="f:"]'); await v.fill('#code', await exCode('s201')); await v.waitForTimeout(450); a = await V();
    assert.deepStrictEqual([a.title, a.w, a.mode, !!a.player], ['194년 11월 · 흩어진 군웅', false, 'play', true], '하던 판에서는 코드를 고쳐도 지도가 그대로다(출전을 눌러야 바뀐다)');
    await v.close(); ok('미리 보기: 예제를 고르면 지도 · 날짜 · 시작 카드 · 기록 맨 위 한 줄이 그 배치로 바뀐다 · 군주를 고르던 메뉴가 남지 않는다 · 하던 판은 묻고, 그만두면 그대로다 · 손으로 고친 코드는 출전 전에만 지도가 따라간다'); }

  assert.deepStrictEqual(errs, []); console.log(`\n${n} ui tests passed · 콘솔 오류 0`); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
