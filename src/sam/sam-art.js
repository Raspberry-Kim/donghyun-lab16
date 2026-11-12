/* 동현삼 · 그림 — 지도의 성과 산·숲·물결, 전장의 장수와 지형을 픽셀 그림으로 그린다(동현항의 배와 같은 방식).
 *   칸 하나가 글자 하나다. 같은 색으로 이어진 칸을 한 줄씩 묶어 두고(runs), 칸 경계를 기기 픽셀에 맞춰 반올림해 칠한다.
 *   그래서 어떤 배율에서도 칸 사이에 틈이나 번짐이 없다. 그림은 판의 값을 바꾸지 않는다(난수도 쓰지 않는다).
 *   DH.Sam.Art.draw(g, 이름, x, y, 칸 크기, 색 표, {flip, ax, ay})  (x,y)는 그림의 가로 가운데 · 세로 바닥 */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};
  const INK = '#26211c';

  const ROWS = {
    /* 지도 · 성: o 테두리 · W 성벽(세력 색) · w 성벽 그늘 · R 지붕 · g 성문 · f 깃발 · p 깃대 */
    town: [
      '....ooo....',
      '..ooRRRoo..',
      '.oRRRRRRRo.',
      '..oWWWWWo..',
      'o.oWWWWWo.o',
      'oWoWWWWWoWo',
      'oWWWWgWWWwo',
      'oWWWWgWWWwo',
      'ooooooooooo',
    ],
    capital: [
      '......pff....',
      '......pfff...',
      '......pff....',
      '....ooooo....',
      '...oRRRRRo...',
      '..oooWWWooo..',
      '.oRRRRRRRRRo.',
      '..oWWWWWWWo..',
      'o.oWWWWWWWo.o',
      'oWoWWWgWWWoWo',
      'oWWWWWgWWWWwo',
      'ooooooooooooo',
    ],
    ruin: [
      '..o.....o..',
      '.oWo...oWo.',
      'oWWo.o.oWWo',
      'oWWWoWooWwo',
      'ooooooooooo',
    ],
    /* 지도 · 꾸밈: l 밝은 비탈 · m 그늘 · s 눈 · t 잎 · u 잎 그늘 · b 줄기 · v 물결 */
    hill: [
      '...s......',
      '..lsm.....',
      '.lllmm.l..',
      'llllmmllm.',
      'lllllmlmmm',
    ],
    hill2: [
      '..l...',
      '.llm..',
      'lllmm.',
    ],
    wood: [
      '.t..t.',
      'ttutt.',
      'tuuttu',
      '.b..b.',
    ],
    wave: [
      'vv...',
      '..vvv',
    ],
    /* 전장 · 장수(말 탄 무장, 오른쪽을 본다): o 테두리 · H 투구 · r 투구 술 · S 얼굴 · A 갑옷(세력 색) · a 갑옷 그늘 · c 망토 ·
     *   B 말 · b 말 그늘 · e 눈 · n 갈기와 꼬리 · s 창날 · p 창대 · f 깃발(세력 색) */
    rider: [
      '.......rr.....s.',
      '......oHHo...sp.',
      '.ff..oHHHHo.p...',
      '.fff.oSSSeop....',
      '.ff.coAAAApoo...',
      '.p.ccAAAAapnBBo.',
      '.pocaAAaaonBBBeo',
      'noBBBBaaBBBBBBBo',
      'noBBBBBBBBBBoooo',
      'n.obBBBBBBBbo...',
      '..oBoob.oBoo....',
      '..oBo...oBo.....',
      '..oo....oo......',
    ],
    /* 전장 · 장수 없는 부대(창병 셋) */
    foot: [
      '..s....s....s..',
      '..p....p....p..',
      '.oHo..oHo..oHo.',
      '.oSo..oSo..oSo.',
      'oAAAooAAAooAAAo',
      'oAaAooAaAooAaAo',
      'oAAAooAAAooAAAo',
      '.oao..oao..oao.',
      '.o.o..o.o..o.o.',
      '.o.o..o.o..o.o.',
    ],
    /* 전장 · 지형: 산(l 밝은 비탈 · m 그늘 · s 눈 · k 바위 금) · 숲 · 풀 · 성(W 벽 · w 그늘 · R 지붕 · g 문 · f 깃발 · p 깃대 · o 테두리) */
    peak: [
      '......ss.........',
      '.....sssm........',
      '....lssmmm.......',
      '...lllkmmm..s....',
      '..llllmmmmmssm...',
      '.lllklmmmmllmmm..',
      '.llllmmkmmlllmmm.',
      'llllmmmmmllkmmmm.',
      'lllkmmmmlllmmmmmm',
    ],
    grove: [
      '..t....t..',
      '.ttu..ttu.',
      'ttttutttuu',
      'ttuuuttuuu',
      '.b....b...',
    ],
    tuft: [
      'g.g..g',
      '.gg.g.',
    ],
    ripple: [
      'vv....vv...',
      '..vvvv..vvv',
    ],
    fort: [
      '.pff...............',
      '.pfff..............',
      '.pff...............',
      '.p.................',
      'o.o.o.........o.o.o',
      'ooooo.........ooooo',
      'oWWWo.........oWWwo',
      'oWWWo.........oWWwo',
      'oWWWo.o.o.o.o.oWWwo',
      'oWWWoooooooooooWWwo',
      'oWWWWWWWWWWWWWWWWwo',
      'oWWWWWWWgggWWWWWWwo',
      'oWWWWWWgggggWWWWwwo',
      'oWWWWWWgggggWWWWwwo',
      'ooooooooooooooooooo',
    ],
  };
  /** 글자 줄을 같은 색끼리 묶는다: [줄, 시작 칸, 길이, 글자] */
  const runs = rows => { const out = []; rows.forEach((r, y) => { for (let x = 0; x < r.length;) { const ch = r[x]; let n = 1; while (r[x + n] === ch) n++; if (ch !== '.') out.push([y, x, n, ch]); x += n; } }); return out; };
  const SPR = {};
  for (const [k, rows] of Object.entries(ROWS)) { const w = rows[0].length; if (rows.some(r => r.length !== w)) throw new Error('그림 ' + k + '의 줄 길이가 다르다'); SPR[k] = { w, h: rows.length, runs: runs(rows) }; }

  /** 그림 하나. (x,y)는 가로 가운데 · 세로 바닥(세계 좌표), cell은 칸 하나의 크기. flip이면 좌우를 뒤집는다. pal에 없는 글자는 먹색. */
  function draw(g, name, x, y, cell, pal, o = {}) {
    const sp = SPR[name], m = g.getTransform(), left = x - sp.w * cell / 2, top = y - sp.h * cell;
    const DX = j => Math.round(m.a * (left + (o.flip ? sp.w - j : j) * cell) + m.e), DY = i => Math.round(m.d * (top + i * cell) + m.f);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    for (const [r, x0, n, ch] of sp.runs) {
      const col = pal[ch]; if (col === null) continue;                    // null이면 그 글자는 그리지 않는다(깃발 없는 성)
      const a = DX(x0), b = DX(x0 + n), y0 = DY(r), y1 = DY(r + 1);
      g.fillStyle = col || INK; g.fillRect(Math.min(a, b), y0, Math.abs(b - a), y1 - y0);
    }
    g.restore();
  }
  const mix = (a, b, t) => DH.mixColor(a, b, t);
  /** 세력 색으로 성의 색 표를 짓는다. 주인 없는 땅(색 없음)은 잿빛 폐허다. */
  function castlePal(color) {
    if (!color) return { o: '#5f574c', W: '#b9b0a2', w: '#9c9386', R: '#8d8477', g: '#5f574c', f: null, p: null };
    return { o: INK, W: mix(color, '#ffffff', 0.18), w: mix(color, INK, 0.22), R: mix(color, INK, 0.5), g: '#2f271f', f: mix(color, '#ffffff', 0.05), p: INK };
  }
  const HORSE = [{ B: '#9a6a3c', b: '#6f4a28', n: '#3c2a1c' }, { B: '#efe6d2', b: '#c9bda3', n: '#8d8477' }, { B: '#4a3f36', b: '#2f271f', n: '#1c1611' }];
  /** 부대의 색 표. n번째 부대마다 말 빛깔이 다르다(밤색 · 흰 · 검정). */
  function unitPal(color, n = 0) {
    return { o: INK, H: mix(color, INK, 0.45), r: '#c0321f', S: '#f0c9a0', e: INK, A: color, a: mix(color, INK, 0.3), c: mix(color, '#ffffff', 0.35), f: mix(color, '#ffffff', 0.1), p: '#4a3424', s: '#dfe3e6', ...HORSE[n % 3] };
  }
  const LAND = { l: '#d3c092', m: '#b39c6c', s: '#fbf7ef', k: '#8f7a58', t: '#9db57a', u: '#7f9a62', b: '#7a5c3a', v: '#d6e9f1', g: '#a9bb7c' };
  const FIELD = { l: '#a8926a', m: '#7f6a4a', s: '#fbf7ef', k: '#5f4e36', t: '#7fa05a', u: '#5f8046', b: '#6b4a2f', v: '#e4f1f6', g: '#aab77e' };
  /** 칸마다 늘 같은 수(0~1). 꾸밈 그림을 어디에 둘지 정한다(판의 난수와는 따로다). */
  const hash = (c, r, k = 0) => { let h = (c * 73856093) ^ (r * 19349663) ^ (k * 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  DH.Sam = Object.assign(DH.Sam || {}, { Art: { draw, castlePal, unitPal, hash, LAND, FIELD, sprites: SPR } });
})(typeof globalThis !== 'undefined' ? globalThis : this);
