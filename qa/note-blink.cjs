// 안내 상자(.mobile-note) 테두리의 빨간색 점멸을 확인한다.
// 색·굵기·주기, 켜짐과 꺼짐이 실제로 번갈아 오는지, 밝은·어두운 화면, 휴대폰 너비, 기기의 동작 줄이기 상태, 상자 크기를 본다.
// 네 저장소(동현삼·동현닥·동현테·동현둠)에서 같은 파일을 쓴다.
// 사용: node build.cjs 뒤에 node qa/note-blink.cjs [chromium|firefox|webkit] [URL]
const pw = require('/home/user/node_modules/playwright'), assert = require('node:assert/strict'), path = require('node:path');
(async () => {
  const root = path.resolve(__dirname, '..'), name = process.argv[2] || 'chromium', base = process.argv[3] || 'file://' + path.join(root, 'index.html');
  const b = await pw[name].launch(name === 'chromium' ? { channel: 'chromium' } : {});
  let checks = 0; const pass = s => { checks++; console.log('PASS', s); };
  const open = async (options = {}, query = '') => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'ko-KR', ...options });
    const p = await ctx.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(base + query); await p.waitForSelector('.mobile-note'); await p.evaluate(() => document.fonts.ready);
    return { ctx, p, errors };
  };
  // 테두리의 색을 [r, g, b, a]로 읽는다. 꺼진 때는 a가 0.
  const rgba = s => { const m = s.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1]; };
  const read = p => p.evaluate(() => { const n = document.querySelector('.mobile-note'), c = getComputedStyle(n), r = n.getBoundingClientRect();
    const probe = document.createElement('i'); probe.style.color = 'var(--red)'; document.body.appendChild(probe); const red = getComputedStyle(probe).color; probe.remove();
    return { text: n.textContent, strong: n.querySelector('strong').textContent, color: c.borderTopColor, sides: [c.borderTopColor, c.borderRightColor, c.borderBottomColor, c.borderLeftColor],
      style: c.borderTopStyle, width: c.borderTopWidth, pad: [c.paddingTop, c.paddingLeft], anim: c.animationName, dur: c.animationDuration, iter: c.animationIterationCount, timing: c.animationTimingFunction,
      red, box: [r.width, r.height], scrollW: document.documentElement.scrollWidth, innerW: innerWidth, visible: r.width > 0 && r.height > 0 && c.display !== 'none' && c.visibility !== 'hidden' }; });
  // 실제 시간으로 2.4초 동안 테두리를 읽어, 켜져 있던 시간의 비율과 바뀐 횟수를 잰다(읽는 간격이 느린 브라우저에서도 같게 재도록 시각으로 계산).
  const watch = p => p.evaluate(() => new Promise(done => { const n = document.querySelector('.mobile-note'), seen = [], t0 = performance.now();
    const tick = () => { const a = getComputedStyle(n).borderTopColor.match(/[\d.]+/g).map(Number), t = performance.now() - t0; seen.push([t, (a.length > 3 ? a[3] : 1) > 0.5 ? 1 : 0]);
      if (t < 2400) return setTimeout(tick, 30);
      let on = 0, flips = 0; for (let i = 1; i < seen.length; i++) { if (seen[i - 1][1]) on += seen[i][0] - seen[i - 1][0]; if (seen[i][1] !== seen[i - 1][1]) flips++; }
      const total = seen[seen.length - 1][0] - seen[0][0]; done({ n: seen.length, on: Math.round(on / total * 100), off: Math.round(100 - on / total * 100), flips }); }; tick(); }));
  const blinking = w => w.n >= 10 && w.on >= 30 && w.on <= 70 && w.flips >= 3 && w.flips <= 6;
  // 애니메이션의 시각을 직접 옮겨 각 시점의 색을 읽는다.
  const at = (p, ms) => p.evaluate(ms => { const n = document.querySelector('.mobile-note'), a = n.getAnimations()[0]; a.pause(); a.currentTime = ms; const c = getComputedStyle(n).borderTopColor; a.play(); return c; }, ms);

  // 1. 데스크톱 밝은 화면: 문구·빨간 실선 2px·1초 주기·끝없이 반복
  { const { ctx, p, errors } = await open(), s = await read(p);
    assert.ok(s.visible && s.strong.length > 0 && s.text.length > 30, '안내 상자가 보이지 않는다');
    assert.ok(/데스크톱 권장|데스크톱 화면에서의 이용을 권장한다/.test(s.text), '데스크톱 권장 문구가 없다');
    assert.deepStrictEqual([s.style, s.width, s.anim, s.dur, s.iter], ['solid', '2px', 'note-blink', '1s', 'infinite']);
    assert.ok(/^steps\(1/.test(s.timing), '점멸이 아니라 서서히 바뀐다: ' + s.timing);
    const red = rgba(s.red); assert.deepStrictEqual(red, [200, 64, 47, 1], '밝은 화면의 빨강이 #c8402f가 아니다');
    assert.ok(red[0] > 150 && red[0] > red[1] * 2.5 && red[0] > red[2] * 2.5, '빨간색이 아니다');
    for (const ms of [0, 250, 499]) assert.deepStrictEqual(rgba(await at(p, ms)), red, ms + 'ms에 빨간 테두리가 아니다');
    for (const ms of [500, 750, 999]) assert.equal(rgba(await at(p, ms))[3], 0, ms + 'ms에 테두리가 꺼지지 않았다');
    assert.deepStrictEqual(rgba(await at(p, 1100)), red, '둘째 주기에 다시 켜지지 않았다');
    const sides = await p.evaluate(() => { const n = document.querySelector('.mobile-note'), a = n.getAnimations()[0]; a.pause(); a.currentTime = 100; const c = getComputedStyle(n); const r = [c.borderTopColor, c.borderRightColor, c.borderBottomColor, c.borderLeftColor]; a.play(); return r; });
    assert.ok(sides.every(x => x === sides[0]), '네 변의 색이 다르다');
    assert.deepStrictEqual(errors, []); pass(`데스크톱 밝은 화면: 실선 2px · ${s.red} · 1초 주기(0~0.5초 켜짐, 0.5~1초 꺼짐) · 끝없이 반복 · 네 변 같음`); await ctx.close(); }

  // 2. 실제 시간으로 지켜보기: 켜짐과 꺼짐이 번갈아 오고, 1초에 세 번을 넘겨 번쩍이지 않는다
  { const { ctx, p, errors } = await open(), w = await watch(p);
    assert.ok(blinking(w), '켜짐·꺼짐이 고르게 번갈아 오지 않는다: ' + JSON.stringify(w));
    assert.deepStrictEqual(errors, []); pass(`2.4초 관찰: 켜진 시간 ${w.on}% · 꺼진 시간 ${w.off}% · 바뀜 ${w.flips}번(1초에 한 번 깜빡임) · ${w.n}번 읽음`); await ctx.close(); }

  // 3. 어두운 화면: 어두운 화면의 빨강(#f0705c)으로 같은 점멸
  { const { ctx, p, errors } = await open(); await p.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    const s = await read(p), red = rgba(s.red); assert.deepStrictEqual(red, [240, 112, 92, 1]);
    assert.deepStrictEqual(rgba(await at(p, 200)), red); assert.equal(rgba(await at(p, 700))[3], 0);
    assert.deepStrictEqual(errors, []); pass(`어두운 화면: ${s.red}로 같은 점멸`); await ctx.close(); }

  // 4. 상자 크기: 테두리 2px + 안쪽 여백 9px·13px(이전의 1px + 10px·14px와 같은 합), 화면을 옆으로 밀지 않는다
  { const { ctx, p, errors } = await open(), s = await read(p);
    assert.deepStrictEqual(s.pad, ['9px', '13px']); assert.equal(Math.round(s.box[0]), 1200); assert.ok(s.scrollW <= s.innerW, '가로로 넘친다');
    const stable = await p.evaluate(() => new Promise(done => { const n = document.querySelector('.mobile-note'), hs = new Set(), t0 = performance.now();
      const tick = () => { const r = n.getBoundingClientRect(); hs.add(r.width + 'x' + r.height + '@' + Math.round(r.top + scrollY)); if (performance.now() - t0 < 1300) setTimeout(tick, 60); else done([...hs]); }; tick(); }));
    assert.equal(stable.length, 1, '깜빡이는 동안 상자 크기나 자리가 바뀐다: ' + stable.join(' '));
    assert.deepStrictEqual(errors, []); pass(`상자 크기 ${Math.round(s.box[0])}×${s.box[1].toFixed(1)} · 깜빡이는 동안 크기와 자리가 그대로 · 가로 넘침 없음`); await ctx.close(); }

  // 5. 휴대폰 390×844(터치): 같은 점멸, 가로 넘침 없음
  { const { ctx, p, errors } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: name !== 'firefox', deviceScaleFactor: 3 }), s = await read(p);
    assert.ok(s.visible); assert.deepStrictEqual([s.style, s.width, s.anim, s.dur], ['solid', '2px', 'note-blink', '1s']); assert.ok(s.scrollW <= s.innerW, '가로로 넘친다');
    assert.deepStrictEqual(rgba(await at(p, 200)), rgba(s.red)); assert.equal(rgba(await at(p, 700))[3], 0);
    const w = await watch(p); assert.ok(blinking(w), '휴대폰: ' + JSON.stringify(w));
    assert.deepStrictEqual(errors, []); pass(`휴대폰 390×844: 같은 점멸 · 상자 ${Math.round(s.box[0])}×${Math.round(s.box[1])} · 가로 넘침 없음`); await ctx.close(); }

  // 6. 기기의 동작 줄이기(윈도우에서 ‘애니메이션 효과’를 끈 PC 포함): 그대로 깜빡인다
  { const { ctx, p, errors } = await open({ reducedMotion: 'reduce' });
    assert.equal(await p.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
    const s = await read(p), w = await watch(p); assert.equal(s.anim, 'note-blink'); assert.ok(blinking(w), '동작 줄이기: ' + JSON.stringify(w));
    assert.deepStrictEqual(errors, []); pass(`기기의 동작 줄이기 상태: 그대로 깜빡임(켜진 시간 ${w.on}% · 바뀜 ${w.flips}번)`); await ctx.close(); }

  // 7. 동현테만: 주소 끝의 ?motion=reduce에서는 깜빡이지 않는 빨간 테두리
  if (path.basename(root).includes('te') && !path.basename(root).includes('ten')) {
    const { ctx, p, errors } = await open({}, '?motion=reduce'), s = await read(p), w = await watch(p);
    assert.equal(s.anim, 'none'); assert.deepStrictEqual(rgba(s.color), rgba(s.red)); assert.deepStrictEqual([s.style, s.width], ['solid', '2px']); assert.deepStrictEqual([w.on, w.flips], [100, 0]);
    assert.deepStrictEqual(errors, []); pass('?motion=reduce: 깜빡이지 않는 빨간 실선 2px'); await ctx.close(); }

  // 8. 동현둠만: 터치만 있는 기기의 강조 상자에서도 같은 점멸
  if (path.basename(root).includes('doom')) {
    const { ctx, p, errors } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: name !== 'firefox', deviceScaleFactor: 3 });
    const touchOnly = await p.evaluate(() => document.documentElement.classList.contains('touch-only'));
    if (!touchOnly) await p.evaluate(() => document.documentElement.classList.add('touch-only'));
    const s = await read(p); assert.deepStrictEqual([s.style, s.width, s.anim], ['solid', '2px', 'note-blink']);
    assert.deepStrictEqual(rgba(await at(p, 200)), rgba(s.red)); assert.equal(rgba(await at(p, 700))[3], 0);
    assert.deepStrictEqual(errors, []); pass(`터치만 있는 기기의 강조 상자: 같은 점멸(${touchOnly ? '브라우저가 터치 전용으로 알림' : '터치 전용 표시를 직접 붙임'})`); await ctx.close(); }

  await b.close(); console.log(`PASS ${checks} note-blink groups (${name})`);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
