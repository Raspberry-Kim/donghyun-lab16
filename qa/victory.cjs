// 승리 축하: 이기면 팡파르(pomp)와 꽃비가 나오고, 지면 예전 소리(lose)만 나며 꽃비가 없는지 본다.
// 꽃비가 끝 화면 카드 자리를 비우는지, 클릭을 가로채지 않는지, 약 10초 뒤 스스로 걷히는지, 다시 하기·출전으로 함께 멈추는지,
// 이긴 판의 저장을 불러올 때는 다시 틀지 않는지, 소리를 꺼도 꽃비는 내리는지, 휴대폰 크기와 전체 화면에서도 맞는지 확인한다.
// 두 저장소(동현삼·동현항)에서 같은 파일을 쓴다. 승리 조건은 판에 직접 맞춰 두고, 판을 끝내는 마지막 행동은 실제 버튼으로 한다.
// 사용: node build.cjs 뒤에 node qa/victory.cjs [chromium|firefox|webkit] [URL]
const pw = require('/home/user/node_modules/playwright'), assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
(async () => {
  const root = path.resolve(__dirname, '..'), hang = path.basename(root).includes('hang'), name = process.argv[2] || 'chromium';
  const url = process.argv[3] || 'file://' + path.join(root, 'index.html'), out = path.join(root, 'qa', 'tmp'); fs.mkdirSync(out, { recursive: true });
  const b = await pw[name].launch(name === 'chromium' ? { channel: 'chromium' } : {});
  let checks = 0; const pass = s => { checks++; console.log('PASS', s); };
  const open = async (options = {}) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'ko-KR', ...options });
    const p = await ctx.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(url); await p.waitForFunction(() => window.__dh && !document.querySelector('#run').disabled);
    const E = (fn, a) => p.evaluate(fn, a), over = hang ? () => __dh.voyage.over : () => __dh.game.over;
    const H = () => E(() => { const c = document.querySelector('.dh-petals'), st = document.querySelector('.dh-stage');
      return { mode: __dh.scene.mode, sounds: __dh.sounds.slice(), played: __dh.snd.played, ringing: __dh.snd.ringing, on: DHPETALS.on, count: DHPETALS.count, ended: DHPETALS.ended, canvases: document.querySelectorAll('.dh-petals').length,
        inStage: !!c && c.parentNode === st, pe: c ? getComputedStyle(c).pointerEvents : null, size: c ? [c.clientWidth, c.clientHeight, st.clientWidth, st.clientHeight] : null }; });
    const click = id => p.locator(`.dh-menu button[data-id="${id}"]`).click();
    const start = async id => { await p.selectOption('#example', id); await p.click('#run'); await p.waitForFunction(() => !__dh.waiting()); };
    const wait = (what, ms = 120000) => p.waitForFunction(hang ? w => __dh.voyage.over === w && __dh.scene.mode === 'over' : w => __dh.game.over === w && __dh.scene.mode === 'over', what, { timeout: ms });
    // 승리: 동현삼은 목표한 주의 수를 지금 가진 수에 맞추고 턴을 끝낸다. 동현항은 자금을 목표보다 조금 많게 두고 시장에서 포도주를 한 단 샀다가 판다.
    const win = async (started) => {
      if (!started) await start('stage');
      if (hang) { await E(() => { const v = __dh.voyage; v.gold = v.stage.gold + 50000; __dh.scene.refresh(); }); await click('tab:market'); await click('buy:wine'); await click('sell:wine'); }
      else { await E(() => { const g = __dh.game; g.stage.goal = g.provincesOf(g.player).length; for (const q of g.provinces.values()) if (q.owner === g.player) { q.troops = 300000; q.rice = 9000000; } }); await click('end'); }
      await wait('won');
    };
    const lose = async () => {
      if (hang) { await start('stage'); await E(() => { __dh.voyage.day = 299; __dh.scene.refresh(); }); await click('sail'); await p.locator('.dh-canvas').focus(); await p.keyboard.press('ArrowLeft'); }
      else { await start('stage'); await E(() => { const g = __dh.game; g.months = 35; for (const q of g.provinces.values()) if (q.owner === g.player) { q.troops = 300000; q.rice = 9000000; } }); await click('end'); }
      await wait('lost');
    };
    const rain = () => p.waitForFunction(() => DHPETALS.count > 10, null, { timeout: 8000 });
    /** 꽃잎 캔버스에서 색이 있는 점의 수: 전체와 카드 자리 안쪽 */
    const pixels = () => E(() => { const c = document.querySelector('.dh-petals'); if (!c) return { all: 0, card: 0 };
      const r = __dh.scene.cardRect(), kx = c.width / __dh.engine.width, ky = c.height / __dh.engine.height, n = (x, y, w, h) => { const d = c.getContext('2d').getImageData(x, y, w, h).data; let k = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) k++; return k; };
      return { all: n(0, 0, c.width, c.height), card: n(Math.ceil(r.x * kx), Math.ceil(r.y * ky), Math.floor(r.w * kx), Math.floor(r.h * ky)) }; });
    const picture = () => E(() => { const c = document.querySelector('.dh-petals'); return c ? c.toDataURL() : ''; });
    return { ctx, p, errors, E, H, click, start, win, lose, rain, pixels, picture };
  };
  try {
    // 1. 데스크톱: 승리 → 팡파르와 꽃비 → 약 10초 뒤 스스로 걷히고 끝 화면은 남는다
    let t = await open(); assert.deepEqual([(await t.H()).on, (await t.H()).canvases], [false, 0], '시작할 때는 꽃비가 없다');
    await t.win(); const t0 = Date.now(); await t.rain(); let h = await t.H();
    assert(h.sounds.includes('pomp') && !h.sounds.includes('lose') && h.played.includes('pomp'), '승리 소리: ' + h.sounds); assert.equal(h.ringing, true);
    assert.deepEqual([h.mode, h.on, h.canvases, h.inStage, h.pe], ['over', true, 1, true, 'none']); assert.deepEqual(h.size.slice(0, 2), h.size.slice(2), '꽃비가 지도 전체를 덮는다');
    await t.p.waitForTimeout(1200); let px = await t.pixels(); assert(px.all > 200 && px.card === 0, '꽃잎은 그려지고 카드 자리는 비어 있다: ' + JSON.stringify(px));
    const a = await t.picture(); await t.p.waitForTimeout(700); assert.notEqual(await t.picture(), a, '꽃잎이 움직인다');
    await t.E(() => document.querySelector('.dh-stage').scrollIntoView({ block: 'center' }));
    assert.equal(await t.E(() => { const r = document.querySelector('.dh-stage').getBoundingClientRect(); return document.elementFromPoint(r.left + 30, r.top + 30).className; }), 'dh-canvas', '클릭은 지도가 받는다');
    await t.E(() => document.querySelector('.dh-stage').scrollIntoView({ block: 'center' })); await t.p.locator('.dh-stage').screenshot({ path: path.join(out, `victory-${name}-desktop.png`) });
    await t.p.waitForFunction(() => !DHPETALS.on, null, { timeout: 15000 }); const took = (Date.now() - t0) / 1000; h = await t.H();
    assert(took > 9.5 && took < 13, '꽃비 길이 ' + took.toFixed(1) + '초'); assert.deepEqual([h.ended, h.canvases, h.mode], [1, 0, 'over']);
    await t.p.waitForFunction(() => !__dh.snd.ringing, null, { timeout: 3000 });
    // 이긴 판을 저장했다가 불러오면 끝 화면만 다시 보이고 축하는 다시 하지 않는다
    const saved = await t.E(() => __dh.scene.saveGame()); await t.click('again'); const n0 = (await t.H()).sounds.filter(k => k === 'pomp').length;
    assert.equal(await t.E(d => __dh.scene.loadGame(d).ok, saved), true); await t.p.waitForTimeout(900); h = await t.H();
    assert.deepEqual([h.mode, h.on, h.sounds.filter(k => k === 'pomp').length, h.ringing], ['over', false, n0, false], '이긴 저장을 불러올 때는 다시 틀지 않는다');
    assert.deepEqual(t.errors, []); pass(`데스크톱 승리: 소리 pomp · 꽃비가 카드 자리를 비우고 ${took.toFixed(1)}초 뒤 걷힘 · 끝 화면 유지 · 이긴 저장을 불러올 때는 다시 틀지 않음`);
    // 2. 꽃비 중에 다시 하기 · 출전을 누르면 꽃비와 팡파르가 함께 멈춘다
    await t.win(); await t.rain(); await t.click('again'); await t.p.waitForFunction(() => !DHPETALS.on, null, { timeout: 2000 }); h = await t.H();
    assert.deepEqual([h.canvases, h.ringing, h.mode === 'over'], [0, false, false], '다시 하기');
    await t.win(); await t.rain(); await t.p.click('#run'); h = await t.H(); assert.deepEqual([h.on, h.canvases, h.ringing], [false, 0, false], '출전');
    assert.deepEqual(t.errors, []); pass('꽃비 중 다시 하기 · 출전: 꽃비와 팡파르 함께 멈춤');
    // 3. 패배: 예전 소리만, 꽃비 없음
    const n1 = (await t.H()).sounds.filter(k => k === 'pomp').length; await t.lose(); await t.p.waitForTimeout(1200); h = await t.H();
    assert.deepEqual([h.on, h.canvases, h.sounds.filter(k => k === 'pomp').length, h.sounds.lastIndexOf('lose') > h.sounds.lastIndexOf('pomp')], [false, 0, n1, true], '패배: ' + h.sounds.slice(-6));
    assert.deepEqual(t.errors, []); pass('패배: 소리 lose · 꽃비 없음');
    if (hang) {      // 공국 엔딩도 승리다(이전 판에서는 패배 소리가 났다). 마지막 승작에서는 딩동댕 대신 팡파르만 낸다
      await t.start('duchy'); await t.E(() => { const v = __dh.voyage; v.growth.profit = 280000; v.growth.explored = [...__dh.world.ports.keys()].filter(p => !DH.Hang.GROWTH.ports[p]).slice(0, 30); v.growth.investments = v.growth.explored.slice(0, 8).map(p => [p, 5000]); __dh.scene.refresh(); });
      const s0 = (await t.H()).sounds.length; await t.click('tab:palace'); for (let i = 0; i < 5; i++) await t.click('promote');
      assert.deepEqual(await t.E(() => [__dh.voyage.over, __dh.voyage.overWhy]), ['won', 'duchy']); await t.rain(); h = await t.H();
      assert.deepEqual(h.sounds.slice(s0).filter(k => ['win', 'pomp', 'lose'].includes(k)), ['win', 'win', 'win', 'win', 'pomp'], '공국 엔딩의 소리');
      await t.p.waitForTimeout(1500); await t.E(() => document.querySelector('.dh-stage').scrollIntoView({ block: 'center' })); await t.p.locator('.dh-stage').screenshot({ path: path.join(out, `victory-${name}-duchy.png`) });
      assert.deepEqual(t.errors, []); pass('공국 엔딩: 소리 pomp(패배 소리 아님) · 꽃비');
    }
    await t.ctx.close();
    // 4. 소리를 꺼 둔 채 승리: 팡파르는 없고 꽃비는 내린다. 켠 채 이긴 뒤 M으로 끄면 팡파르만 멈춘다
    t = await open(); await t.p.click('#sound'); await t.win(); await t.rain(); h = await t.H();
    assert.deepEqual([h.on, h.played.includes('pomp'), h.ringing], [true, false, false]);
    await t.p.click('#sound'); await t.win(); await t.rain(); assert.equal((await t.H()).ringing, true);
    await t.p.locator('.dh-canvas').focus(); await t.p.keyboard.press('m'); h = await t.H(); assert.deepEqual([h.ringing, h.on], [false, true], 'M: 팡파르는 멈추고 꽃비는 남는다');
    assert.deepEqual(t.errors, []); await t.ctx.close(); pass('소리 끔: 팡파르 없이 꽃비 · 도중에 M으로 끄면 팡파르만 멈춤');
    // 5. 휴대폰 크기와 전체 화면
    t = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, ...(name === 'firefox' ? {} : { isMobile: true }) }); await t.win(); await t.rain(); h = await t.H();
    assert.deepEqual([h.inStage, h.pe], [true, 'none']); assert.deepEqual(h.size.slice(0, 2), h.size.slice(2)); await t.p.waitForTimeout(1500); px = await t.pixels(); assert(px.all > 100 && px.card === 0, JSON.stringify(px));
    await t.E(() => document.querySelector('.dh-stage').scrollIntoView({ block: 'center' })); await t.p.locator('.dh-stage').screenshot({ path: path.join(out, `victory-${name}-phone.png`) });
    await t.p.locator('.dh-menu button[data-id="again"]').tap(); await t.p.waitForFunction(() => !DHPETALS.on, null, { timeout: 2000 }); assert.deepEqual(t.errors, []); await t.ctx.close();
    t = await open({ viewport: { width: 1280, height: 720 } }); await t.start('stage'); await t.p.click('#full'); await t.p.waitForFunction(() => document.querySelector('#stage-full').classList.contains('fs')); await t.p.waitForTimeout(400);
    await t.win(true); await t.rain(); h = await t.H(); assert.deepEqual([h.inStage, h.pe], [true, 'none']); assert.deepEqual(h.size.slice(0, 2), h.size.slice(2), '전체 화면에서도 지도 전체를 덮는다');
    await t.p.waitForTimeout(1500); px = await t.pixels(); assert(px.all > 200 && px.card === 0, JSON.stringify(px)); await t.p.screenshot({ path: path.join(out, `victory-${name}-full.png`) });
    await t.click('again'); await t.p.waitForFunction(() => !DHPETALS.on, null, { timeout: 2000 }); assert.deepEqual(t.errors, []); await t.ctx.close();
    pass('휴대폰 390×844 · 전체 화면 1280×720: 꽃비가 지도 전체를 덮고 카드 자리는 비움 · 다시 하기가 눌림');
    console.log(`PASS ${checks} victory groups (${name})`);
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exit(1); });
