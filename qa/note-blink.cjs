// 안내 상자(.mobile-note)의 테두리를 확인한다.
// 노란빛이 도는 연한 빨강(살구색) 실선 2px이고, 페이지를 열면 처음 열 번만 깜빡인 뒤(1초에 한 번) 켜진 채 머문다.
// 색·굵기·주기·횟수, 실제 시간으로 본 열 번의 깜빡임과 그 뒤의 멈춤, 밝은·어두운 화면, 상자 크기, 휴대폰 너비,
// 기기의 동작 줄이기 상태, 탭을 오가도 다시 깜빡이지 않는지를 본다.
// 네 저장소(동현삼·동현닥·동현테·동현둠)에서 같은 파일을 쓴다.
// 사용: node build.cjs 뒤에 node qa/note-blink.cjs [chromium|firefox|webkit] [URL]
const pw = require('/home/user/node_modules/playwright'), assert = require('node:assert/strict'), path = require('node:path');
(async () => {
  const root = path.resolve(__dirname, '..'), name = process.argv[2] || 'chromium', base = process.argv[3] || 'file://' + path.join(root, 'index.html');
  const LIGHT = [235, 168, 138, 1], DARK = [169, 106, 91, 1], OLD = [200, 64, 47, 1]; // #eba88a · #a96a5b · 이전 판의 #c8402f
  const b = await pw[name].launch(name === 'chromium' ? { channel: 'chromium' } : {});
  let checks = 0; const pass = s => { checks++; console.log('PASS', s); };
  const open = async (options = {}, query = '') => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'ko-KR', ...options });
    const p = await ctx.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    // 깜빡임이 시작된 횟수를 처음부터 센다(탭을 오가거나 화면을 바꿔도 다시 시작하지 않는지 보려고).
    await p.addInitScript(() => { window.__noteStarts = 0; document.addEventListener('animationstart', e => { if (e.animationName === 'note-blink') window.__noteStarts++; }, true); });
    await p.goto(base + query); await p.waitForSelector('.mobile-note');
    await p.evaluate(() => { window.__noteAnim = document.querySelector('.mobile-note').getAnimations()[0] || null; });
    return { ctx, p, errors };
  };
  const rgba = s => { const m = s.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1]; };
  const hue = c => { const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]); return 60 * ((c[1] - c[2]) / (mx - mn)); }; // 빨강 계열(r이 가장 큼)에서의 색상각. 0은 빨강, 60은 노랑
  const light = c => (Math.max(c[0], c[1], c[2]) + Math.min(c[0], c[1], c[2])) / 2;
  const read = p => p.evaluate(() => { const n = document.querySelector('.mobile-note'), c = getComputedStyle(n), r = n.getBoundingClientRect();
    return { text: n.textContent, strong: n.querySelector('strong').textContent, color: c.borderTopColor, style: c.borderTopStyle, width: c.borderTopWidth, pad: [c.paddingTop, c.paddingLeft],
      anim: c.animationName, dur: c.animationDuration, iter: c.animationIterationCount, timing: c.animationTimingFunction, starts: window.__noteStarts, running: n.getAnimations().length,
      box: [r.width, r.height], scrollW: document.documentElement.scrollWidth, innerW: innerWidth, visible: r.width > 0 && r.height > 0 && c.display !== 'none' && c.visibility !== 'hidden' }; });
  // 깜빡임의 시각을 직접 옮겨 그때의 테두리 색을 읽는다. 10000ms부터는 깜빡임이 끝난 뒤다.
  const at = async (p, ms) => rgba(await p.evaluate(ms => { const n = document.querySelector('.mobile-note'), a = window.__noteAnim; a.pause(); a.currentTime = ms; const c = getComputedStyle(n).borderTopColor; if (ms < 10000) a.play(); return c; }, ms));
  // 실제 시간으로 지켜본다: 켜져 있던 시간의 비율, 바뀐 횟수, 마지막으로 바뀐 때, 끝의 상태.
  const watch = (p, ms) => p.evaluate(ms => new Promise(done => { const n = document.querySelector('.mobile-note'), seen = [], t0 = performance.now(), a = window.__noteAnim, a0 = a && a.currentTime != null ? a.currentTime : null;
    const tick = () => { const c = getComputedStyle(n).borderTopColor.match(/[\d.]+/g).map(Number), t = performance.now() - t0; seen.push([t, (c.length > 3 ? c[3] : 1) > 0.5 ? 1 : 0]);
      if (t < ms) return setTimeout(tick, 30);
      let on = 0, flips = 0, last = 0; for (let i = 1; i < seen.length; i++) { if (seen[i - 1][1]) on += seen[i][0] - seen[i - 1][0]; if (seen[i][1] !== seen[i - 1][1]) { flips++; last = seen[i][0]; } }
      const total = seen[seen.length - 1][0] - seen[0][0]; done({ n: seen.length, on: Math.round(on / total * 100), flips, last: Math.round(last), total: Math.round(total), end: seen[seen.length - 1][1], a0: a0 == null ? null : Math.round(a0) }); }; tick(); }), ms);
  const pattern = async (p, colour, what) => {
    for (const ms of [0, 250, 499, 1100, 9400]) assert.deepStrictEqual(await at(p, ms), colour, `${what}: ${ms}ms에 켜져 있지 않다`);
    for (const ms of [500, 750, 999, 9700, 9999]) assert.equal((await at(p, ms))[3], 0, `${what}: ${ms}ms에 꺼지지 않았다`);
    assert.deepStrictEqual(await at(p, 10000), colour, `${what}: 열 번 뒤에 켜진 채 머물지 않는다`);
    const s = await read(p); assert.equal(s.running, 0, `${what}: 열 번 뒤에도 깜빡임이 남아 있다`); assert.deepStrictEqual(rgba(s.color), colour);
  };

  // 1. 데스크톱 밝은 화면: 문구 · 살구색 실선 2px · 1초 주기 · 열 번 · 그 뒤 켜진 채
  { const { ctx, p, errors } = await open(), s = await read(p);
    assert.ok(s.visible && s.strong.length > 0 && s.text.length > 30, '안내 상자가 보이지 않는다');
    assert.ok(/데스크톱 권장|데스크톱 화면에서의 이용을 권장한다/.test(s.text), '데스크톱 권장 문구가 없다');
    assert.deepStrictEqual([s.style, s.width, s.anim, s.dur, s.iter], ['solid', '2px', 'note-blink', '1s', '10']);
    assert.ok(/^steps\(1/.test(s.timing), '점멸이 아니라 서서히 바뀐다: ' + s.timing);
    const c = await at(p, 100); assert.deepStrictEqual(c, LIGHT, '밝은 화면의 테두리가 #eba88a가 아니다');
    assert.ok(c[0] > c[1] && c[1] > c[2], '빨간 계열이 아니다');
    assert.ok(hue(c) > hue(OLD) + 8 && hue(c) < 30, `이전보다 노란빛이 돌지 않는다: 색상각 ${hue(c).toFixed(1)} · 이전 ${hue(OLD).toFixed(1)}`);
    assert.ok(light(c) > light(OLD) + 40, '이전보다 연하지 않다');
    const sides = await p.evaluate(() => { const c = getComputedStyle(document.querySelector('.mobile-note')); return [c.borderTopColor, c.borderRightColor, c.borderBottomColor, c.borderLeftColor]; });
    assert.ok(sides.every(x => x === sides[0]), '네 변의 색이 다르다');
    await pattern(p, LIGHT, '밝은 화면');
    assert.deepStrictEqual(errors, []); pass(`데스크톱 밝은 화면: 실선 2px · rgb(${c.slice(0, 3).join(', ')}) · 색상각 ${hue(c).toFixed(1)}°(이전 ${hue(OLD).toFixed(1)}°) · 1초 주기로 열 번 · 그 뒤 켜진 채 머묾 · 네 변 같음`); await ctx.close(); }

  // 2. 실제 시간으로 12.5초: 처음 10초 동안 열 번 깜빡이고, 그 뒤로는 바뀌지 않고 켜져 있다
  { const { ctx, p, errors } = await open(), w = await watch(p, 12500);
    assert.ok(w.a0 != null && w.a0 < 3000, '지켜보기 전에 시간이 너무 흘렀다: ' + JSON.stringify(w));
    const want = 20 - Math.floor(w.a0 / 500), end = 10000 - w.a0; // 지켜보기 시작한 때까지 지나간 반 주기를 뺀다
    assert.ok(Math.abs(w.flips - want) <= 1, `바뀐 횟수가 맞지 않는다(기대 ${want}): ` + JSON.stringify(w));
    assert.ok(Math.abs(w.last - end) <= 300, `마지막으로 바뀐 때가 10초가 아니다(기대 ${Math.round(end)}ms): ` + JSON.stringify(w));
    assert.equal(w.end, 1, '끝에 켜져 있지 않다'); assert.ok(w.total - w.last >= 1500, '끝난 뒤를 충분히 보지 못했다');
    const s = await read(p); assert.deepStrictEqual([s.running, s.starts], [0, 1]); assert.deepStrictEqual(rgba(s.color), LIGHT);
    assert.deepStrictEqual(errors, []); pass(`12.5초 관찰(연 지 ${(w.a0 / 1000).toFixed(2)}초 뒤부터): 바뀜 ${w.flips}번(남은 횟수 ${want}와 맞음, 처음부터면 스무 번 = 열 번 깜빡임) · 마지막 바뀜 ${(w.last + w.a0) / 1000}초 · 그 뒤 ${((w.total - w.last) / 1000).toFixed(1)}초 동안 켜진 채 · ${w.n}번 읽음`); await ctx.close(); }

  // 3. 어두운 화면: 어두운 화면의 살구색(#a96a5b)으로 같은 동작. 화면을 바꿔도 다시 깜빡이지 않는다
  { const { ctx, p, errors } = await open(); await p.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    const c = await at(p, 100); assert.deepStrictEqual(c, DARK); assert.ok(c[0] > c[1] && c[1] > c[2]);
    await pattern(p, DARK, '어두운 화면');
    await p.evaluate(() => { document.documentElement.dataset.theme = 'light'; }); await p.waitForTimeout(200);
    await p.evaluate(() => { document.documentElement.dataset.theme = 'dark'; }); await p.waitForTimeout(200);
    const s = await read(p); assert.deepStrictEqual([s.running, s.starts], [0, 1], '화면을 바꾸면 다시 깜빡인다'); assert.deepStrictEqual(rgba(s.color), DARK);
    assert.deepStrictEqual(errors, []); pass(`어두운 화면: rgb(${c.slice(0, 3).join(', ')})로 같은 동작 · 화면을 바꿔도 다시 깜빡이지 않음`); await ctx.close(); }

  // 4. 상자 크기: 테두리 2px + 안쪽 여백 9px·13px, 깜빡이는 동안 크기와 자리가 그대로, 화면을 옆으로 밀지 않는다
  { const { ctx, p, errors } = await open(), s = await read(p);
    assert.deepStrictEqual(s.pad, ['9px', '13px']); assert.equal(Math.round(s.box[0]), 1200); assert.ok(s.scrollW <= s.innerW, '가로로 넘친다');
    const stable = await p.evaluate(() => new Promise(done => { const n = document.querySelector('.mobile-note'), hs = new Set(), t0 = performance.now();
      const tick = () => { const r = n.getBoundingClientRect(); hs.add(r.width + 'x' + r.height + '@' + Math.round(r.top + scrollY)); if (performance.now() - t0 < 1300) setTimeout(tick, 60); else done([...hs]); }; tick(); }));
    assert.equal(stable.length, 1, '깜빡이는 동안 상자 크기나 자리가 바뀐다: ' + stable.join(' '));
    assert.deepStrictEqual(errors, []); pass(`상자 크기 ${Math.round(s.box[0])}×${s.box[1].toFixed(1)} · 깜빡이는 동안 크기와 자리가 그대로 · 가로 넘침 없음`); await ctx.close(); }

  // 5. 휴대폰 390×844(터치): 같은 동작, 가로 넘침 없음
  const doom = path.basename(root).includes('doom');
  { const { ctx, p, errors } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: name !== 'firefox', deviceScaleFactor: 3 }), s = await read(p);
    const touchOnly = await p.evaluate(() => document.documentElement.classList.contains('touch-only'));
    assert.ok(s.visible); assert.deepStrictEqual([s.style, s.width, s.anim, s.dur, s.iter], ['solid', '2px', 'note-blink', '1s', '10']); assert.ok(s.scrollW <= s.innerW, '가로로 넘친다');
    await pattern(p, doom && touchOnly ? OLD : LIGHT, '휴대폰');
    assert.deepStrictEqual(errors, []); pass(`휴대폰 390×844: 같은 동작 · 상자 ${Math.round(s.box[0])}×${Math.round(s.box[1])} · 가로 넘침 없음`); await ctx.close(); }

  // 6. 기기의 동작 줄이기(윈도우에서 ‘애니메이션 효과’를 끈 PC 포함): 같은 동작
  { const { ctx, p, errors } = await open({ reducedMotion: 'reduce' });
    assert.equal(await p.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
    const s = await read(p), w = await watch(p, 2400); assert.deepStrictEqual([s.anim, s.iter], ['note-blink', '10']);
    assert.ok(w.n >= 10 && w.on >= 30 && w.on <= 70 && w.flips >= 3 && w.flips <= 6, '동작 줄이기: ' + JSON.stringify(w));
    await pattern(p, LIGHT, '동작 줄이기');
    assert.deepStrictEqual(errors, []); pass(`기기의 동작 줄이기 상태: 같은 동작(2.4초 동안 켜진 시간 ${w.on}% · 바뀜 ${w.flips}번 · 열 번 뒤 켜진 채)`); await ctx.close(); }

  // 7. 탭을 오가도 다시 깜빡이지 않는다(깜빡이는 중에도, 끝난 뒤에도)
  { const { ctx, p, errors } = await open(), tabs = await p.$$eval('.tabs button', bs => bs.map(x => x.dataset.tab));
    const round = async () => { for (const t of [...tabs.slice(1), tabs[0]]) { await p.click(`.tabs button[data-tab="${t}"]`); await p.waitForTimeout(120); } };
    await round(); let s = await read(p); assert.deepStrictEqual([s.starts, s.running, s.visible], [1, 1, true], '깜빡이는 중에 탭을 오가면 처음부터 다시 깜빡인다');
    await p.evaluate(() => window.__noteAnim.finish()); await round(); await p.waitForTimeout(300);
    s = await read(p); assert.deepStrictEqual([s.starts, s.running, s.visible], [1, 0, true], '끝난 뒤 탭을 오가면 다시 깜빡인다'); assert.deepStrictEqual(rgba(s.color), LIGHT);
    assert.deepStrictEqual(errors, []); pass(`탭 ${tabs.length}개를 오가도 깜빡임은 처음 한 차례(시작 ${s.starts}번)`); await ctx.close(); }

  // 8. 동현테만: 주소 끝의 ?motion=reduce에서는 처음부터 깜빡이지 않는 테두리
  if (path.basename(root).includes('te') && !path.basename(root).includes('ten')) {
    const { ctx, p, errors } = await open({}, '?motion=reduce'), s = await read(p), w = await watch(p, 2400);
    assert.equal(s.anim, 'none'); assert.deepStrictEqual(rgba(s.color), LIGHT); assert.deepStrictEqual([s.style, s.width, s.starts], ['solid', '2px', 0]); assert.deepStrictEqual([w.on, w.flips], [100, 0]);
    assert.deepStrictEqual(errors, []); pass('?motion=reduce: 처음부터 깜빡이지 않는 살구색 실선 2px'); await ctx.close(); }

  // 9. 동현둠만: 터치만 있는 기기의 강조 상자는 빨간 테두리 그대로, 열 번 깜빡인 뒤 켜진 채
  if (doom) {
    const { ctx, p, errors } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: name !== 'firefox', deviceScaleFactor: 3 });
    const touchOnly = await p.evaluate(() => document.documentElement.classList.contains('touch-only'));
    if (!touchOnly) await p.evaluate(() => document.documentElement.classList.add('touch-only'));
    const s = await read(p); assert.deepStrictEqual([s.style, s.width, s.anim, s.iter], ['solid', '2px', 'note-blink', '10']);
    await pattern(p, OLD, '터치 전용');
    assert.deepStrictEqual(errors, []); pass(`터치만 있는 기기의 강조 상자: 빨간 테두리 rgb(200, 64, 47) · 열 번 깜빡인 뒤 켜진 채(${touchOnly ? '브라우저가 터치 전용으로 알림' : '터치 전용 표시를 직접 붙임'})`); await ctx.close(); }

  await b.close(); console.log(`PASS ${checks} note-blink groups (${name})`);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
