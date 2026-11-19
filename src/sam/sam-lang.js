/* 동현삼 · 동현랭 연동 — globalState와, 동현랭이 출력한 정수를 그 자리에 덮어쓰는 규약.
 *
 * globalState(DH.Sam.newState())에는 기본값이 먼저 들어 있다. 기본값은 sam-rules.js의 RULES와 sam-battle.js의 BATTLE · TERRAIN을 베낀 것이고,
 * 시작값(start)은 null이다. null이면 JSON 자료에 적힌 값을 그대로 쓴다. 동현랭 설정이 없으면 이 기본값 그대로 판이 열린다.
 *
 *   번호  설정                     값
 *    1    군주                     0 고르는 화면 · 1~16 고른 시나리오에 적힌 순서(기본 배치는 1 조조 … 9 공손도)
 *    2    난수 시드                1~2147483646
 *    3~7  우리 주마다 시작 금 · 쌀 · 병력 · 민심 · 농지
 *    8    주 하나의 초기값         주 번호, 항목(1 금 · 2 쌀 · 3 병력 · 4 민심 · 5 농지 · 6 치수 · 7 상업 · 8 훈련), 값   ← 여러 번 쓸 수 있다
 *    9    우리 주의 금 · 쌀 · 민심 배율(%)   100이 자료 값 그대로 · 300이면 세 배(민심은 100까지). 3~8번의 값이 있으면 그것이 이긴다
 *    10~13 징병 수량 · 징병 금 · 농지 개발 금 · 농지 1마다 쌀
 *    14~17 시혜에 드는 쌀 · 동맹에 드는 금 · 동맹 기간(달) · 장수를 사로잡을 확률(%)
 *    18~19 군사가 되는 지력 · 장군이 되는 무력
 *    20~24 승리 조건(차지할 주 수) · 기한(달) · 전투 기한(일) · 부대 이동력 · AI 신중함(×10)
 *    25~29 일기토 최대 합(0 없음) · 왕이 되는 주 수 · 황제가 되는 주 수 · 화계 피해 %(0 없음) · 철마다 나는 일의 확률 배율 %(0 없음)
 *    30   장수 능력치              장수 번호, 능력(1 무력 · 2 지력 · 3 매력), 값 1~100              ← 여러 번 쓸 수 있다
 *    31   시나리오                 0 기본 배치(200년 1월) · 1~6 자료의 scenarios 순서(189년 12월 … 235년 2월)
 *    40~42 치수 · 상업 · 훈련에 드는 금
 *
 *   DH.Sam.applyDonghyunLang(scriptText, state, {world})  → 보고서 {ok, empty, settings, errors, applied}
 *   DH.Sam.readLang(scriptText, worlds, state?)           → 같은 보고서 + world. 시나리오(31번)를 먼저 읽어 판을 고른 뒤 그 판에 비춰 나머지를 검사한다.
 *     군주 · 주 · 장수 번호는 시나리오마다 뜻이 다르므로 설정을 두 번 읽는다: 한 번은 자료 없이(범위만), 한 번은 고른 판으로. state를 주면 오류가 없을 때 덮어쓴다. */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};
  const S = DH.Sam, clone = o => JSON.parse(JSON.stringify(o));
  const fmt = n => Number(n).toLocaleString('ko-KR');
  const FIELD = [null, ['gold', '금', 0, 99999, 1], ['rice', '쌀', 0, 99999, 1], ['troops', '병력', 0, 99900, 100], ['loyalty', '민심', 0, 100, 1], ['farm', '농지', 0, 100, 1], ['flood', '치수', 0, 100, 1], ['trade', '상업', 0, 100, 1], ['drill', '훈련', 0, 100, 1]];
  const STAT = [null, ['war', '무력'], ['int', '지력'], ['cha', '매력']];

  /** 동현삼의 globalState. 기본값(fallback)이 들어 있다. */
  function newState() {
    return {
      rules: clone(S.RULES),                                              // 내정 수치(징병 수량 · 드는 금 · AI 기준 …)
      battle: { ...S.BATTLE, terrain: clone(S.TERRAIN) },                 // 전투 수치(이동력 · 기한 · 지형)
      start: { scenario: 0, player: null, seed: null, boost: null, gold: null, rice: null, troops: null, loyalty: null, farm: null },   // null = 자료 값 그대로 · boost: 우리 주의 금 · 쌀 · 민심 배율(%)
      stage: { goal: null, months: 0 },                                   // goal null = 모든 주 · months 0 = 기한 없음
      provinces: [], officers: []                                         // [[주, 항목, 값]] · [[장수, 능력, 값]]
    };
  }
  const factionAt = (world, n) => (world ? [...world.factions.values()][n - 1] : null);
  const startCmd = (k, i) => ({ key: 'start.' + k, label: `우리 주 시작 ${FIELD[i][1]}`, min: FIELD[i][2], max: FIELD[i][3], step: FIELD[i][4], path: 'start.' + k, hint: '고른 군주의 주마다 이 값으로 시작한다', def: '자료 값' });

  const lang = new DH.DonghyunLangAdapter({ name: '동현삼', commands: {
    1: { key: 'start.player', label: '군주', min: 0, max: 16, path: 'start.player', hint: '0 고르는 화면 · 1부터는 고른 시나리오에 적힌 순서', def: '0',
      check: ([n], { world }) => (world && n > world.factions.size ? `${world.title ? `'${world.title}'의 ` : ''}군주는 ${world.factions.size}명뿐이다` : null),
      show: ([n], { world }) => (n === 0 ? '고르는 화면' : factionAt(world, n) ? factionAt(world, n).name : n + '번') },
    2: { key: 'start.seed', label: '난수 시드', min: 1, max: 2147483646, path: 'start.seed', hint: '같은 시드면 같은 판', def: '1' },
    3: startCmd('gold', 1), 4: startCmd('rice', 2), 5: startCmd('troops', 3), 6: startCmd('loyalty', 4), 7: startCmd('farm', 5),
    8: { key: 'provinces', label: '주 초기값', multi: true, hint: '항목 1 금 · 2 쌀 · 3 병력 · 4 민심 · 5 농지 · 6 치수 · 7 상업 · 8 훈련', def: '자료 값',
      args: [{ label: '주 번호', min: 1, max: 999 }, { label: '항목', min: 1, max: 8 }, { label: '값', min: 0, max: 99999 }],
      check: ([p, k, v], { world }) => { const f = FIELD[k];
        if (world && !world.provinces.has(p)) return `${p}번 주는 없다`;
        return v > f[3] || v % f[4] ? `${f[1]} 값 ${fmt(v)}은 쓸 수 없다. ${fmt(f[2])}~${fmt(f[3])}${f[4] > 1 ? `, ${f[4]} 단위` : ''}만 된다` : null; },
      show: ([p, k, v], { world }) => `${world && world.provinces.has(p) ? world.provinces.get(p).name : p + '번 주'} ${FIELD[k][1]} ${fmt(v)}`,
      set: (st, [p, k, v]) => st.provinces.push([p, FIELD[k][0], v]) },
    9: { key: 'start.boost', label: '우리 주의 금 · 쌀 · 민심 배율(%)', min: 10, max: 1000, step: 10, path: 'start.boost', hint: '고른 군주의 주마다 자료 값에 곱한다 · 민심은 100까지 · 다른 군주는 그대로', def: '100',
      show: ([v]) => `${v}%` + (v >= 200 && v % 100 === 0 ? ` (${['두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'][v / 100 - 2]} 배)` : '') },
    10: { key: 'draft.troops', label: '징병 수량', min: 100, max: 10000, step: 100, path: 'rules.draft.troops', hint: '한 번에 뽑는 병사' },
    11: { key: 'draft.gold', label: '징병에 드는 금', min: 0, max: 10000, path: 'rules.draft.gold' },
    12: { key: 'develop.gold', label: '농지 개발에 드는 금', min: 0, max: 10000, path: 'rules.develop.gold' },
    13: { key: 'ricePerFarm', label: '농지 1마다 달마다 쌀', min: 1, max: 100, path: 'rules.ricePerFarm' },
    14: { key: 'relief.rice', label: '시혜에 드는 쌀', min: 0, max: 10000, path: 'rules.relief.rice', hint: '쌀을 풀어 민심을 얻는다' },
    15: { key: 'ally.gold', label: '동맹에 드는 금', min: 0, max: 10000, path: 'rules.ally.gold', hint: '받아들이지 않아도 돌아오지 않는다' },
    16: { key: 'ally.months', label: '동맹 기간(달)', min: 1, max: 120, path: 'rules.ally.months', hint: '이 동안 서로 치지 않는다' },
    17: { key: 'capture', label: '장수를 사로잡을 확률(%)', min: 0, max: 100, hint: '침공에 이겼을 때 지키던 장수마다 · 군주는 빼고', get: st => Math.round(st.rules.capture * 100),
      show: ([v]) => `${v}%`, set: (st, [v]) => { st.rules.capture = v / 100; } },
    18: { key: 'advisor.int', label: '군사가 되는 지력', min: 1, max: 100, path: 'rules.advisor.int', hint: '이 지력부터 군사로 삼을 수 있다' },
    19: { key: 'general.war', label: '장군이 되는 무력', min: 1, max: 100, path: 'rules.general.war', hint: '이 무력부터 장군으로 올릴 수 있다' },
    20: { key: 'stage.goal', label: '승리 조건: 차지할 주 수', min: 2, max: 999, path: 'stage.goal', hint: '이만큼 차지하면 이긴다 · 정하지 않으면 다른 세력을 모두 무너뜨려야 한다', def: '모든 주',
      check: ([n], { world }) => (world && n > world.provinces.size ? `주는 ${world.provinces.size}개뿐이다` : null) },
    21: { key: 'stage.months', label: '기한(달)', min: 0, max: 1200, path: 'stage.months', hint: '이 달 수가 지나면 진다 · 0 기한 없음' },
    22: { key: 'battle.days', label: '전투 기한(일)', min: 5, max: 60, path: 'battle.days', hint: '공격 측이 이 안에 못 이기면 물러난다' },
    23: { key: 'battle.mp', label: '부대 이동력', min: 1, max: 12, path: 'battle.mp', hint: '하루에 쓰는 이동력' },
    24: { key: 'ai.needRatio', label: 'AI 신중함(×10)', min: 10, max: 100, hint: '상대 병력의 몇 배를 모아야 치는지 · 25는 2.5배', get: st => Math.round(st.rules.ai.needRatio * 10),
      show: ([v]) => `${v / 10}배`, set: (st, [v]) => { st.rules.ai.needRatio = v / 10; } },
    25: { key: 'battle.duel', label: '일기토 최대 합', min: 0, max: 30, path: 'battle.duel', hint: '이 합을 채우면 비긴다 · 0 일기토 없음', show: ([v]) => (v ? v + '합' : '일기토 없음') },
    26: { key: 'rank.king', label: '왕이 되는 주 수', min: 1, max: 999, path: 'rules.rank.king', hint: '이만큼 차지하면 왕에 올라 전하라 불린다', def: '주 수의 1/4',
      check: ([n], { world }) => (world && n > world.provinces.size ? `주는 ${world.provinces.size}개뿐이다` : null) },
    27: { key: 'rank.emperor', label: '황제가 되는 주 수', min: 1, max: 999, path: 'rules.rank.emperor', hint: '이만큼 차지하면 황제에 올라 폐하라 불린다', def: '주 수의 1/3',
      check: ([n], { world }) => (world && n > world.provinces.size ? `주는 ${world.provinces.size}개뿐이다` : null) },
    28: { key: 'battle.fire', label: '화계 피해(%)', min: 0, max: 90, path: 'battle.fire', hint: '불이 난 칸의 부대가 날마다 잃는 병력 · 0 화계 없음', show: ([v]) => (v ? v + '%' : '화계 없음') },
    29: { key: 'events.scale', label: '철마다 나는 일의 확률 배율(%)', min: 0, max: 300, path: 'rules.events.scale', hint: '큰물 · 메뚜기 · 돌림병 · 풍년 · 100이 보통 · 0이면 나지 않는다', show: ([v]) => (v ? v + '%' : '나지 않는다') },
    30: { key: 'officers', label: '장수 능력치', multi: true, hint: '능력 1 무력 · 2 지력 · 3 매력', def: '자료 값',
      args: [{ label: '장수 번호', min: 1, max: 99999 }, { label: '능력', min: 1, max: 3 }, { label: '값', min: 1, max: 100 }],
      check: ([id], { world }) => (world && !world.officers.has(id) ? `${id}번 장수는 없다` : null),
      show: ([id, k, v], { world }) => `${world && world.officers.has(id) ? world.officers.get(id).name : id + '번 장수'} ${STAT[k][1]} ${v}`,
      set: (st, [id, k, v]) => st.officers.push([id, STAT[k][0], v]) },
    31: { key: 'scenario', label: '시나리오', min: 0, max: 6, path: 'start.scenario', hint: '0 기본 배치 · 1~6 시작 해가 다른 여섯 판 · 군주 번호(1번 설정)는 고른 판의 순서를 따른다', def: '0',
      check: ([n], { worlds }) => (worlds && n >= worlds.length ? `시나리오는 0부터 ${worlds.length - 1}까지 있다` : null),
      show: ([n], { worlds }) => (worlds && worlds[n] ? worlds[n].title : n + '번') },
    40: { key: 'flood.gold', label: '치수에 드는 금', min: 0, max: 10000, path: 'rules.flood.gold' },
    41: { key: 'trade.gold', label: '상업에 드는 금', min: 0, max: 10000, path: 'rules.trade.gold' },
    42: { key: 'drill.gold', label: '훈련에 드는 금', min: 0, max: 10000, path: 'rules.drill.gold' }
  } });

  /** 동현랭 설정을 동현삼 globalState에 덮어쓴다. ctx.world를 주면 주 · 장수 · 군주 번호도 검사한다. */
  const applyDonghyunLang = (scriptText, state, ctx) => lang.applyDonghyunLang(scriptText, state, ctx);
  /** 시나리오(31번)를 먼저 읽어 판을 고르고, 그 판에 비춰 설정을 다시 검사한다. 보고서에 world(고른 판)가 붙는다. state를 주면 오류가 없을 때 덮어쓴다. */
  function readLang(scriptText, worlds, state) {
    const a = lang.parse(scriptText, { ctx: { worlds } }); a.applied = [];
    if (!a.ok || a.empty) return Object.assign(a, { world: worlds[0] });
    const world = worlds[a.values.scenario || 0], b = lang.applySettings(a.settings.map(s => [s.n, ...s.values]), state || null, { world, worlds });
    return Object.assign(b, { output: a.output, steps: a.steps, world });
  }
  /** 저장한 판의 설정 목록 [[번호, 값…]]에서 시나리오 번호를 찾는다(없으면 0). */
  const scenarioOf = list => { const s = Array.isArray(list) ? list.filter(x => Array.isArray(x) && x[0] === 31).pop() : null; return s ? s[1] : 0; };

  /* 손으로 쓴 예제(변수 · 반복문)를 짓는 도우미. 수는 어댑터의 식 적기(expression)로 적는다.
   * script(줄들): 줄을 잇는다. '@' 한 글자뿐인 줄은 되돌아올 자리(빈 문장)이고, 다른 줄의 {@}는 그 문장 번호를 적은 식으로 바뀐다.
   * 문장 번호는 동현랭 명세대로 센다: 줄바꿈과 ~로 나눈 조각마다 하나, 주석만 있는 줄도 하나. */
  const A = DH.DonghyunLangAdapter, lit = n => A.expression(n), say = e => `뿡뿡 ${e}~뿡뿡뿡`;
  function script(lines) {
    const at = lines.indexOf('@'), no = at < 0 ? 0 : lines.slice(0, at).reduce((n, l) => n + l.split('~').length, 0) + 1;
    return lines.map(l => (l === '@' ? `ㅋㅋ ↓ 여기가 ${no}번 문장이다. 되돌아오는 자리` : l.replace('{@}', lit(no)).replace('{@번}', no + '번'))).join('\n');
  }

  /** 플레이그라운드에 싣는 예제 열. name의 번호는 고르는 칸에 보이는 순서다. worlds: DH.Sam.worlds()가 준 판 배치들.
   *  01 설정 없음 · 02~07 시작 해가 다른 여섯 시나리오 · 08~14 쉬운 판(우리만 금 · 쌀 · 민심 세 배) · 15~24 수치 실험 · 25 · 26 손으로 쓴 동현랭(변수 · 반복문). */
  const YEARS = ['200년 1월', '189년 12월', '194년 11월', '201년 10월', '208년 9월', '221년 4월', '235년 2월'];
  const examples = worlds => {
    const W = Array.isArray(worlds) ? worlds : [worlds], at = list => W[scenarioOf(list)] || W[0];
    const c = (list, title) => lang.compose(list, title, { world: at(list), worlds: W }), two = n => String(n).padStart(2, '0');
    const G = ['수치 실험', '동현랭 문법'];
    const who = w => { const f = [...w.factions.values()].map(x => x.name); return f.length > 5 ? `${f.slice(0, 4).join(' · ')} 등 ${f.length}세력` : f.join(' · '); };
    const plain = [1, 2, 3, 4, 5, 6].filter(i => W[i]).map((i, k) => ({ id: 's' + YEARS[i].slice(0, 3), group: '시나리오 · 시작 해가 다른 여섯 판', name: `${two(2 + k)} · 시나리오: ${W[i].title}`,
      code: c([[31, i]], `${W[i].title} · ${who(W[i])} · 군주는 고르는 화면에서 정한다`) }));
    const easy = [1, 2, 0, 3, 4, 5, 6].filter(i => W[i]).map((i, k) => ({ id: 'e' + YEARS[i].slice(0, 3), group: '쉬운 판 · 나만 금 · 쌀 · 민심 세 배', name: `${two(8 + k)} · 쉬운 판: ${W[i].title}`,
      code: c(i ? [[31, i], [9, 300]] : [[9, 300]], `쉬운 판 · ${W[i].title} · 내 주만 금 · 쌀 · 민심이 다른 군주의 세 배(민심은 100까지) · 군주는 고르는 화면에서 정한다. 1번 설정을 더하면 군주도 정해 둘 수 있다`) }));
    return [
    { id: 'none', group: '기본', name: '01 · 기본값(설정 없음)', code: '나는 동현이냐?\nㅋㅋ 아무것도 출력하지 않으면 기본값 그대로 시작한다(200년 1월 · 군주는 고르는 화면에서 정한다)\n동현이구나' },
    ...plain, ...easy,
    { id: 'rich', group: G[0], name: '15 · 넉넉한 유비', code: c([[1, 3], [3, 3000], [4, 20000], [10, 2000], [30, 121, 1, 90]], '유비로 시작 · 금 3,000 · 쌀 20,000 · 징병 2,000씩 · 유비 무력 90') },
    { id: 'stage', group: G[0], name: '16 · 스테이지: 3년 안에 다섯 주', code: c([[1, 3], [2, 7], [20, 5], [21, 36]], '유비로 시작 · 시드 7 · 다섯 주를 차지하면 이긴다 · 36달 안에') },
    { id: 'weak', group: G[0], name: '17 · 좁은 땅: 장로의 한중', code: c([[1, 7], [3, 100], [4, 600], [5, 3000], [20, 3], [21, 60]], '장로로 시작 · 금 100 · 쌀 600 · 병력 3,000 · 세 주를 차지하면 이긴다 · 60달 안에') },
    { id: 'unify', group: G[0], name: '18 · 208년 조조의 통일: 10년 기한', code: c([[31, 4], [1, 1], [2, 3], [21, 120]], '208년 9월 · 조조로 시작 · 시드 3 · 다른 세력을 모두 무너뜨리면 이긴다 · 120달 안에') },
    { id: 'fast', group: G[0], name: '19 · 빠른 전투 · 급한 AI', code: c([[22, 10], [23, 8], [24, 15], [8, 14, 3, 30000]], '전투 10일 · 이동력 8 · AI는 1.5배만 모아도 친다 · 허창 병력 30,000') },
    { id: 'calm', group: G[0], name: '20 · 느긋한 내정 · 신중한 AI', code: c([[24, 100], [12, 50], [13, 8], [11, 200]], 'AI는 10배를 모아야 친다 · 농지 개발 금 50 · 농지 1마다 쌀 8 · 징병 금 200') },
    { id: 'swap', group: G[0], name: '21 · 능력치 실험: 문무를 바꾼 세 형제', code: c([[1, 3], [30, 121, 1, 100], [30, 121, 3, 75], [30, 122, 1, 75], [30, 122, 2, 95], [30, 123, 1, 40], [30, 123, 2, 95]], '유비로 시작 · 유비는 무력 100에 매력 75 · 관우는 무력 75에 지력 95 · 장비는 무력 40에 지력 95') },
    { id: 'heart', group: G[0], name: '22 · 민심과 동맹: 싼 시혜 · 긴 동맹', code: c([[1, 3], [6, 50], [14, 300], [15, 100], [16, 36], [17, 60]], '유비로 시작 · 우리 주 민심 50 · 시혜 쌀 300 · 동맹 금 100 · 동맹 36달 · 사로잡을 확률 60%') },
    { id: 'duel', group: G[0], name: '23 · 무인의 시대: 긴 일기토 · 화계 없음', code: c([[1, 3], [25, 20], [28, 0], [19, 80], [42, 20]], '유비로 시작 · 일기토 20합까지 · 화계 없음 · 장군은 무력 80부터 · 훈련 금 20') },
    { id: 'crown', group: G[0], name: '24 · 이른 즉위와 거친 하늘', code: c([[1, 3], [26, 3], [27, 5], [29, 200], [40, 50], [18, 80]], '유비로 시작 · 주 3곳이면 왕 · 5곳이면 황제 · 철마다 나는 일 2배 · 치수 금 50 · 군사는 지력 80부터') },
    { id: 'scale', group: G[1], name: '25 · 변수: 배율 하나로 시작값 셋', code: script(['나는 동현이냐?',
      'ㅋㅋ 변수 · 배율 하나(동현 = 5)로 금 5,000 · 쌀 20,000 · 징병 2,000씩',
      'ㅋㅋ 아래 한 줄의 수만 고치면 세 값이 함께 바뀐다. 배율은 1부터 24까지 된다',
      `동현아 ${lit(5)}`,
      'ㅋㅋ 1번 군주 = 유비', say(lit(1)), say(lit(3)),
      'ㅋㅋ 3번 우리 주 시작 금 = 배율 × 1,000', say(lit(3)), say(`동현 ${lit(1000)}`),
      'ㅋㅋ 4번 우리 주 시작 쌀 = 배율 × 4,000', say(lit(4)), say(`동현 ${lit(4000)}`),
      'ㅋㅋ 10번 징병 수량 = 배율 × 400', say(lit(10)), say(`동현 ${lit(400)}`),
      '동현이구나']) },
    { id: 'loop', group: G[1], name: '26 · 반복문: 원소의 여덟 주에 병력 10,000', code: script(['나는 동현이냐?',
      'ㅋㅋ 반복문 · 원소의 여덟 주(2번 북평부터 9번 북해까지)의 병력을 모두 10,000으로',
      'ㅋㅋ 동현 = 주 번호. 한 바퀴에 설정 하나(8번: 주 번호, 항목 3 병력, 값 10,000)를 출력한다',
      `동현아 ${lit(2)}`,
      '@',
      say(lit(8)), say('동현'), say(lit(3)), say(lit(10000)),
      '동현아 동현도옹',
      'ㅋㅋ 동현이 10보다 작으면(동현에 ㅠ를 열 번 더해 음수면) {@번} 문장으로 돌아간다',
      `뭉치 동현${'ㅠ'.repeat(10)}? 신중동역 {@}`,
      '동현이구나']) }
  ]; };

  DH.Sam = Object.assign(S, { newState, lang, applyDonghyunLang, readLang, scenarioOf, examples });
})(typeof globalThis !== 'undefined' ? globalThis : this);
