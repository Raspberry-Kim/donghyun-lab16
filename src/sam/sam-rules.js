/* 동현삼 · 규칙 — 내정 명령, 한 달 넘기기, AI 군주의 판단. 화면을 모른다(node에서 그대로 돈다).
 *
 * 한 달 = 한 턴. 주마다 한 달에 명령 하나를 내린다. 그 주에서 가장 뛰어난 장수의 능력치를 쓴다.
 *   내정       농지 개발  금 100 → 농지 +(3 + 지력÷20), 민심 +2. 농지 1마다 매달 쌀 4가 들어온다.
 *              치수       금 100 → 치수 +(3 + 지력÷20). 7월의 큰물이 덜 든다.
 *              상업       금 100 → 상업 +(3 + 지력÷20). 세금이 (70 + 상업)%로 걷힌다(처음 상업 30이면 100%).
 *              시혜       쌀 500을 풀어 민심 +(4 + 매력÷20). 100까지 오른다.
 *   징병       금 100 → 병력 +1000, 인구 −1000, 민심 −(12 − 매력÷10). 민심 30 아래면 못 한다. 새 병사는 훈련 40이라 그 주의 훈련이 병력 비율만큼 내려간다.
 *   훈련       금 50 → 훈련 +(5 + 무력÷10). 전투에서 주는 피해가 (150 + 훈련) ÷ 200배가 된다(훈련 50이면 1배).
 *   이동       장수 한 명이나 여럿(또는 병력만)을 이웃한 우리 주로 보낸다. 병력을 딸려 보낼 수 있다. 금과 쌀을 이웃한 우리 주로 실어 보낼 수도 있다(수송).
 *              장수는 이웃한 공백지로도 갈 수 있고, 가면 그 땅이 우리 주가 된다(진주).
 *   수색       그 주의 재야 장수를 찾는다(확률 30% + 매력÷2 %). 없으면 가끔 금을 줍는다.
 *   침공       이웃한 남의 주로 쳐들어간다 → 전투(sam-battle.js) → settle()로 결과를 반영한다. 동맹과 공백지는 칠 수 없다.
 *              이기면 지키던 장수는 저마다 30% 확률로 사로잡혀 우리 편이 된다(군주는 빼고). 나머지는 가장 가까운 자기 땅으로 물러난다.
 *   벼슬       '주마다 한 달에 명령 하나' 원칙에 해당하지 않는 군주의 행동이다. 태수(주마다 한 명): 세금 +매력÷4 %, 수확 +지력÷4 %, 성 방어 +무력÷10 %p. 다른 장수가 있으면 싸움에 나서지 않고 주를 지킨다.
 *              군사(세력에 한 명, 지력 85 이상): 동맹 확률 +지력÷10 %p, 화계 +10%p, 침공하기 전에 승산을 헤아려 준다.
 *              장군(무력 85 이상, 1 + 주 수÷4 명까지): 그 부대가 주는 피해 +10%.
 *              위임: 태수가 있는 주는 달마다 태수가 알아서 움직인다(내정만 · 군사까지).
 *   동맹       이웃한 세력에 금 300을 보내 청한다(확률 20% + 매력÷2 %, 우리 병력이 더 많으면 +10%p). 12달 동안 서로 치지 않는다.
 *              깨면 우리 주 모두의 민심이 10 내린다.
 * 공백지: 장수가 한 명도 없는 주는 주인을 잃는다(민심 · 금 · 쌀 · 농지는 남고, 남은 병력은 흩어져 백성으로 돌아간다).
 *         마지막 장수가 옮겨 가거나 침공에 나서 이긴 바로 그때, 그리고 달이 바뀔 때 살핀다.
 * 달이 바뀔 때: 세금(인구÷2000 × 민심% × (70 + 상업)% × 태수) · 수확(농지 × 4 × 태수) · 군량(병력÷100) · 민심 +1(70까지) · 인구 +0.2% · 동맹 기한 −1.
 *              철마다 일이 난다: 1월 역병 · 7월 큰물(치수가 막는다) · 8월 메뚜기 · 10월 풍년.
 * 호칭: 우리 주가 10곳(주 수의 1/4)이 되면 왕(전하), 14곳(1/3)이 되면 황제(폐하)에 오른다. 땅을 잃어도 내려오지 않는다.
 *       시나리오 자료에 rank가 적힌 세력은 주 수와 상관없이 처음부터 그 자리다(221년의 조비 · 유비).
 * 이기는 조건: 차지할 주 수를 정했으면 그만큼, 아니면 다른 세력이 모두 무너지거나 모든 주를 차지했을 때.
 * 민심은 자료와 저장 파일에서 loyalty라는 이름으로 적힌다(v0.05까지는 ‘충성도’라고 불렀다).
 *
 * AI 군주(aiDecide): 시혜(민심이 낮을 때) → 수색(재야 장수가 있을 때) → 공백지 진주 → 병력 확보 → 훈련 → 인접 영지 공격(장수가 둘 이상일 때만)
 *                    → 후방의 남는 장수 · 병력을 전선으로 → 농지 · 상업 · 치수 가운데 가장 낮은 것. 주를 비우는 일은 하지 않고, 동맹을 청하거나 깨지 않는다. 벼슬은 차례마다 알아서 임명한다.
 * 저장: toJSON()이 판에서 바뀌는 것만 적고, Game.restore()가 자료에 비춰 검사한 뒤 되살린다. */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};

  const RULES = {
    baseStat: 40,                                        // 장수 없는 주의 능력치(공백지가 되기 전 한 달, 옛 저장 파일)
    develop: { gold: 100, base: 3, intDiv: 20, loyalty: 2 },
    draft: { gold: 100, troops: 1000, minLoyalty: 30, minPop: 20000, base: 12, chaDiv: 10 },
    search: { base: 0.3, chaDiv: 200, goldChance: 0.3, goldMin: 50, goldMax: 150 },
    farmMax: 100, ricePerFarm: 4, taxDiv: 2000, upkeepDiv: 100, desert: 0.1, loyaltyRest: 70, growth: 0.002,
    attackMin: 1000, maxUnits: 3, conquerLoyalty: 10, capture: 0.3,                               // capture: 진 쪽 장수가 사로잡혀 이긴 쪽에 드는 확률(군주는 빼고)
    relief: { rice: 500, base: 4, chaDiv: 20 },                                                   // 시혜: 쌀 → 민심
    ally: { gold: 300, base: 0.2, chaDiv: 200, strong: 0.1, max: 0.95, months: 12, breakLoyalty: 10 },   // 동맹
    flood: { gold: 100, base: 3, intDiv: 20, max: 100, start: 30 },                               // 치수: 금 → 치수. start는 자료에 없을 때의 처음 값
    trade: { gold: 100, base: 3, intDiv: 20, max: 100, start: 30, floor: 70 },                    // 상업: 세금이 (floor + 상업)%로 걷힌다
    drill: { gold: 50, base: 5, warDiv: 10, max: 100, start: 50, recruit: 40 },                   // 훈련: 금 → 훈련. recruit는 갓 뽑은 병사의 훈련
    gov: { div: 400, defDiv: 1000 },                                                              // 태수: 세금 × (1 + 매력÷400) · 수확 × (1 + 지력÷400) · 성 방어 + 무력÷1000
    advisor: { int: 85, allyDiv: 1000 },                                                          // 군사: 지력 조건 · 동맹 확률 + 지력÷1000
    general: { war: 85, per: 4 },                                                                 // 장군: 무력 조건 · 정원 1 + 주 수÷per
    rank: { king: null, emperor: null },                                                          // 즉위하는 주 수. null이면 왕은 주 수의 1/4(내림), 황제는 1/3(올림)
    events: { scale: 100, flood: 0.25, floodFarm: 0.1, floodRice: 0.2, locust: 0.1, locustRice: 0.3, plague: 0.08, plaguePop: 0.03, plagueTroops: 0.1, bumper: 0.25, bumperMonths: 2 },   // 철마다 나는 일(scale: 확률 배율 %)
    ai: { needMin: 6000, needRatio: 2.5, sendRatio: 0.7, moveMin: 4000, moveRatio: 0.5, reliefBelow: 40, searchBelow: 2, occupyRatio: 0.3, drillBelow: 55, drillMin: 3000 }
  };
  const fmt = n => Number(n).toLocaleString('ko-KR');
  const { josa, ro } = DH;                             // 받침에 맞는 조사(공통 엔진 core)
  const NO = why => ({ ok: false, why });
  const TITLES = ['주군', '전하', '폐하'], RANKS = ['', '왕', '황제'];      // 호칭과 자리(0 군주 · 1 왕 · 2 황제)
  const CIVIL = { develop: '농지', trade: '상업', flood: '치수' };

  class Game {
    /** @param world DH.Sam.parse()의 결과
     *  @param {{player?:string|null, rng?:DH.RNG, state?:object}} o player가 null이면 모든 세력을 AI가 맡는다.
     *  state는 DH.Sam.newState()로 만든 globalState다(동현랭 설정이 덮어쓴 값이 들어 있다). 없으면 이 파일의 RULES와 자료 값을 그대로 쓴다. */
    constructor(world, o = {}) {
      const st = o.state || null;
      this.world = world; this.rng = o.rng || new DH.RNG(1); this.player = o.player ?? null;
      this.state = st; this.rules = st && st.rules ? st.rules : RULES; this.battleRules = st && st.battle ? st.battle : null;
      this.stage = { goal: null, months: 0, ...(st && st.stage ? st.stage : {}) };
      this.factions = new Map([...world.factions.values()].map(f => [f.id, { ...f, alive: true, advisor: null }]));      // rank(시나리오에 적힌 자리)도 함께 온다
      this.provinces = new Map([...world.provinces.values()].map(p => [p.id, { id: p.id, name: p.name, hanja: p.hanja, adj: [...p.adj], owner: p.owner, pop: p.pop, gold: p.gold, rice: p.rice, troops: p.troops, loyalty: p.loyalty, farm: p.farm, acted: false,
        flood: p.flood ?? this.rules.flood.start, trade: p.trade ?? this.rules.trade.start, drill: p.drill ?? this.rules.drill.start, gov: null, auto: null }]));
      this.officers = new Map([...world.officers.values()].map(o2 => [o2.id, { ...o2, general: false }]));
      this.months = 0; this.over = null; this.overWhy = null; this.queue = [];
      this.rank = this.player !== null && world.factions.has(this.player) ? world.factions.get(this.player).rank || 0 : 0; this.crowned = 0;   // 호칭(0 주군 · 1 전하 · 2 폐하). 시나리오에 적힌 자리에서 시작한다. crowned: 방금 오른 자리(화면이 알리고 0으로 돌린다)
      this.pacts = new Map();                                    // 동맹: '세력|세력'(가나다가 아니라 id 순) → 남은 달
      if (this.player !== null && !this.factions.has(this.player)) throw new Error(`세력 ${this.player}가 없다`);
      if (st) { this.applyStart(st); this.checkStage(); }      // 시작부터 목표를 채웠으면 바로 끝난다
      this.checkRank(); this.crowned = 0;                        // 처음부터 넓은 땅으로 시작하면 식 없이 그 자리에서 시작한다
    }
    /** globalState의 시작값을 판에 덮어쓴다. null이거나 없는 것은 자료 값 그대로 둔다.
     *  start.boost(%): 우리 주마다 금 · 쌀 · 민심에 곱한다(민심은 100까지) → start.{gold,rice,troops,loyalty,farm}: 우리 주마다 · provinces: [[주, 항목, 값]] · officers: [[장수, 능력, 값]] */
    applyStart(st) {
      const s = st.start || {}, b = s.boost;
      if (this.player !== null && b != null && b !== 100) for (const p of this.provincesOf(this.player)) { p.gold = Math.floor(p.gold * b / 100); p.rice = Math.floor(p.rice * b / 100); p.loyalty = Math.min(100, Math.floor(p.loyalty * b / 100)); }
      if (this.player !== null) for (const p of this.provincesOf(this.player)) for (const k of ['gold', 'rice', 'troops', 'loyalty', 'farm']) if (s[k] != null) p[k] = s[k];
      for (const [pid, key, v] of st.provinces || []) { const p = this.P(pid); if (p) p[key] = v; }
      for (const [id, key, v] of st.officers || []) { const o = this.officers.get(id); if (o) o[key] = v; }
    }
    /** 이기려면 차지해야 할 주의 수(스테이지 조건). 정하지 않았으면 모든 주. */
    get goal() { return Math.min(this.provinces.size, this.stage.goal || this.provinces.size); }
    /** 스테이지 조건을 본다: 목표한 만큼 차지했으면 이기고, 기한(달)이 지나면 진다.
     *  목표를 정하지 않았으면 다른 세력이 모두 무너졌을 때도 이긴다(공백지는 남아 있어도 된다). */
    checkStage() {
      this.checkRank();
      if (this.player === null || this.over) return;
      const all = this.goal >= this.provinces.size, alone = all && ![...this.factions.values()].some(f => f.alive && f.id !== this.player) && this.provincesOf(this.player).length > 0;
      if (this.provincesOf(this.player).length >= this.goal || alone) { this.over = 'won'; this.overWhy = all ? 'all' : 'goal'; }
      else if (this.stage.months > 0 && this.months >= this.stage.months) { this.over = 'lost'; this.overWhy = 'time'; }
    }
    /** 왕 · 황제에 오르는 주 수 */
    get thrones() { const R = this.rules.rank || {}, n = this.provinces.size; return { king: R.king ?? Math.floor(n / 4), emperor: R.emperor ?? Math.ceil(n / 3) }; }
    /** 우리 주의 수를 보고 자리를 올린다(내려오지는 않는다). 올랐으면 crowned에 적는다. */
    checkRank() {
      if (this.player === null) return;
      const n = this.provincesOf(this.player).length, T = this.thrones, r = n >= T.emperor ? 2 : n >= T.king ? 1 : 0;
      if (r > this.rank) { this.rank = r; this.crowned = r; }
    }
    /** 우리 군주를 부르는 말: 주군 · 전하 · 폐하 */
    get title() { return TITLES[this.rank]; }
    /** 세력 f의 자리(0 · 1 · 2). 다른 세력은 지금 가진 주 수와 시나리오에 적힌 자리 가운데 높은 쪽으로 본다. */
    rankOf(f) { if (!f) return 0; if (f === this.player) return this.rank; const n = this.provincesOf(f).length, T = this.thrones; return Math.max(this.factions.get(f).rank || 0, n >= T.emperor ? 2 : n >= T.king ? 1 : 0); }
    /** 지금이 몇 월인지(1~12) */
    get month() { const s = (this.world.meta && this.world.meta.start) || {}; return ((s.month || 1) - 1 + this.months) % 12 + 1; }
    P(id) { return this.provinces.get(id); }
    fname(f) { return f ? this.factions.get(f).name : '공백지'; }
    provincesOf(f) { return [...this.provinces.values()].filter(p => p.owner === f); }
    /** 그 주에서 주인을 섬기는 현역 장수 */
    officersOf(pid) { const p = this.P(pid); return [...this.officers.values()].filter(o => o.province === pid && o.status === 'active' && o.faction === p.owner && p.owner !== null); }
    freeIn(pid) { return [...this.officers.values()].filter(o => o.province === pid && o.status === 'free'); }
    /** 그 주에서 가장 뛰어난 능력치(없으면 40)와 그 장수 */
    best(pid, key) { const top = this.officersOf(pid).sort((a, b) => b[key] - a[key] || a.id - b.id)[0]; return top ? { value: top[key], officer: top } : { value: this.rules.baseStat, officer: null }; }
    /** 싸우러 나갈 장수: 무력 순으로 셋까지. 둘 이상이면 한 명은 남아 주를 지킨다. 태수는 다른 장수가 있으면 나서지 않는다. */
    fighters(pid) { const all = this.officersOf(pid), gov = all.length > 1 ? this.governor(pid) : null, list = all.filter(o => o !== gov).sort((a, b) => b.war - a.war || a.id - b.id); return list.slice(0, Math.min(this.rules.maxUnits, Math.max(1, all.length - 1))); }
    /** 그 주의 태수(그 주에 있는 우리 현역 장수일 때만). 없으면 null */
    governor(pid) { const p = this.P(pid), o = p && p.gov != null ? this.officers.get(p.gov) : null; return o && p.owner !== null && o.status === 'active' && o.province === pid && o.faction === p.owner ? o : null; }
    /** 세력 f의 군사. 없으면 null */
    advisorOf(f) { const fa = f ? this.factions.get(f) : null, o = fa && fa.advisor != null ? this.officers.get(fa.advisor) : null; return o && o.status === 'active' && o.faction === f ? o : null; }
    generalsOf(f) { return [...this.officers.values()].filter(o => o.general && o.status === 'active' && o.faction === f); }
    generalCap(f) { return 1 + Math.floor(this.provincesOf(f).length / this.rules.general.per); }
    /** 위임이 살아 있는지: 태수가 자리에 있어야 한다. 'civil' · 'war' · null */
    delegated(pid) { const p = this.P(pid); return p.auto && this.governor(pid) ? p.auto : null; }
    /** 병력 n(훈련 d)이 그 주에 더해질 때의 훈련(병력 비율로 고른다). 병력을 더하기 전에 부른다. */
    blend(p, n, d) { if (n > 0) p.drill = Math.round((p.troops * p.drill + n * d) / (p.troops + n)); }
    /** 달마다 들고 나는 것(화면에 미리 보여 준다) */
    income(pid) {
      const p = this.P(pid), R = this.rules, gv = this.governor(pid), cha = gv ? gv.cha : 0, int = gv ? gv.int : 0;      // 정수끼리 곱한 뒤 나눈다(상업 30 · 태수 없음이면 예전 식과 같다)
      return { gold: Math.floor(p.pop * p.loyalty * (R.trade.floor + p.trade) * (R.gov.div + cha) / (R.taxDiv * 100 * 100 * R.gov.div)), rice: Math.floor(p.farm * R.ricePerFarm * (R.gov.div + int) / R.gov.div), upkeep: Math.ceil(p.troops / R.upkeepDiv) };
    }
    /** 주인도 병력도 없는 땅(공백지). 장수를 보내면 차지한다. */
    vacant(q) { return q.owner === null && q.troops <= 0; }
    /** 칠 수 있는 이웃: 남의 주. 동맹과 공백지는 뺀다. */
    targets(pid) { const p = this.P(pid); return p.adj.map(id => this.P(id)).filter(q => q.owner !== p.owner && !this.vacant(q) && !this.allied(p.owner, q.owner)); }
    friends(pid) { const p = this.P(pid); return p.adj.map(id => this.P(id)).filter(q => q.owner === p.owner); }
    /** 이웃한 공백지 */
    openLand(pid) { return this.P(pid).adj.map(id => this.P(id)).filter(q => this.vacant(q)); }
    // ───────── 동맹 ─────────
    pactKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
    allied(a, b) { return !!a && !!b && a !== b && this.pacts.has(this.pactKey(a, b)); }
    /** 세력 f와 동맹인 세력들: [{id, months}] */
    alliesOf(f) { const out = []; for (const [k, m] of this.pacts) { const [a, b] = k.split('|'); if (a === f || b === f) out.push({ id: a === f ? b : a, months: m }); } return out; }
    /** 그 주와 맞닿은 다른 세력(살아 있는 세력만, 자료 순서) */
    borderFactions(pid) { const p = this.P(pid), ids = new Set(p.adj.map(id => this.P(id).owner).filter(f => f && f !== p.owner)); return [...this.factions.values()].filter(f => f.alive && ids.has(f.id)).map(f => f.id); }
    troopsOf(f) { return this.provincesOf(f).reduce((n, p) => n + p.troops, 0); }
    /** 그 주에서 f에 동맹을 청할 때의 성공 확률(0~1). 군사가 있으면 지력 ÷ 1000이 더해진다 */
    allyChance(pid, f) { const a = this.rules.ally, p = this.P(pid), adv = this.advisorOf(p.owner); return Math.min(a.max, a.base + this.best(pid, 'cha').value / a.chaDiv + (this.troopsOf(p.owner) >= this.troopsOf(f) ? a.strong : 0) + (adv ? adv.int / this.rules.advisor.allyDiv : 0)); }

    /** 그 명령을 지금 내릴 수 있는지. {ok:true} 또는 {ok:false, why} */
    can(pid, type) {
      const p = this.P(pid);
      if (!p || !p.owner) return NO('주인 없는 땅이다');
      if (this.over) return NO('판이 끝났다');
      if (p.acted) return NO('이번 달 명령을 이미 내렸다');
      if (type === 'develop') { if (p.gold < this.rules.develop.gold) return NO(`금 ${this.rules.develop.gold}이 있어야 한다`); if (p.farm >= this.rules.farmMax) return NO('농지를 더 넓힐 수 없다'); }
      else if (type === 'draft') {
        const d = this.rules.draft;
        if (p.gold < d.gold) return NO(`금 ${d.gold}이 있어야 한다`);
        if (p.loyalty < d.minLoyalty) return NO(`민심이 ${d.minLoyalty} 아래라 백성이 따르지 않는다`);
        if (p.pop < d.minPop) return NO('인구가 너무 적다');
      }
      else if (type === 'move') {
        const off = this.officersOf(pid).length, open = off ? this.openLand(pid).length : 0;
        if (!this.friends(pid).length && !open) return NO('이웃에 우리 주도 공백지도 없다');
        if (!off && p.troops <= 0) return NO('보낼 장수도 병력도 없다');
        if (!this.friends(pid).length && !off) return NO('공백지에는 장수가 가야 한다');
      }
      else if (type === 'attack') { if (!this.targets(pid).length) return NO(p.adj.some(id => this.allied(p.owner, this.P(id).owner)) ? '이웃에 칠 수 있는 주가 없다(동맹은 칠 수 없다)' : '이웃에 남의 주가 없다'); if (p.troops < this.rules.attackMin) return NO(`병력 ${fmt(this.rules.attackMin)}이 있어야 한다`); }
      else if (type === 'relief') { if (p.rice < this.rules.relief.rice) return NO(`쌀 ${fmt(this.rules.relief.rice)}이 있어야 한다`); if (p.loyalty >= 100) return NO('민심이 이미 가득하다'); }
      else if (type === 'ally') { if (!this.borderFactions(pid).length && !this.alliesOf(p.owner).length) return NO('이웃에 다른 세력이 없다'); }
      else if (type === 'flood' || type === 'trade') { const d = this.rules[type]; if (p.gold < d.gold) return NO(`금 ${d.gold}이 있어야 한다`); if (p[type] >= d.max) return NO(type === 'flood' ? '둑을 더 쌓을 수 없다' : '시장을 더 키울 수 없다'); }
      else if (type === 'drill') { const d = this.rules.drill; if (p.gold < d.gold) return NO(`금 ${d.gold}이 있어야 한다`); if (p.troops <= 0) return NO('훈련할 병사가 없다'); if (p.drill >= d.max) return NO('더 가르칠 것이 없다'); }
      else if (type === 'transport') { if (!this.friends(pid).length) return NO('이웃에 우리 주가 없다'); if (p.gold <= 0 && p.rice <= 0) return NO('보낼 금도 쌀도 없다'); }
      else if (type !== 'search') return NO('모르는 명령이다');
      return { ok: true };
    }

    develop(pid) {
      const c = this.can(pid, 'develop'); if (!c.ok) return c;
      const p = this.P(pid), d = this.rules.develop, b = this.best(pid, 'int'), before = p.farm;
      p.gold -= d.gold; p.farm = Math.min(this.rules.farmMax, p.farm + d.base + Math.floor(b.value / d.intDiv)); p.loyalty = Math.min(100, p.loyalty + d.loyalty); p.acted = true;
      return { ok: true, type: 'develop', text: `${p.name}: 농지를 넓혔다(${before} → ${p.farm}). 매달 쌀 +${fmt(this.income(pid).rice)}` };
    }
    draft(pid) {
      const c = this.can(pid, 'draft'); if (!c.ok) return c;
      const p = this.P(pid), d = this.rules.draft, b = this.best(pid, 'cha'), drop = Math.max(1, d.base - Math.floor(b.value / d.chaDiv));
      p.gold -= d.gold; this.blend(p, d.troops, this.rules.drill.recruit); p.troops += d.troops; p.pop -= d.troops; p.loyalty = Math.max(0, p.loyalty - drop); p.acted = true;
      return { ok: true, type: 'draft', text: `${p.name}: 병사 ${josa(fmt(d.troops), '을', '를')} 뽑았다. 병력 ${fmt(p.troops)} · 민심 −${drop}` };
    }
    /** 치수 · 상업: 금을 들여 그 값을 올린다(지력). */
    civil(pid, type) {
      const c = this.can(pid, type); if (!c.ok) return c;
      const p = this.P(pid), d = this.rules[type], before = p[type];
      p.gold -= d.gold; p[type] = Math.min(d.max, p[type] + d.base + Math.floor(this.best(pid, 'int').value / d.intDiv)); p.acted = true;
      return { ok: true, type, text: type === 'flood' ? `${p.name}: 둑을 쌓고 물길을 냈다(치수 ${before} → ${p.flood}). 큰물이 덜 든다` : `${p.name}: 시장을 키웠다(상업 ${before} → ${p.trade}). 매달 금 +${fmt(this.income(pid).gold)}` };
    }
    flood(pid) { return this.civil(pid, 'flood'); }
    trade(pid) { return this.civil(pid, 'trade'); }
    /** 훈련: 금을 들여 병사를 조련한다(무력). */
    drill(pid) {
      const c = this.can(pid, 'drill'); if (!c.ok) return c;
      const p = this.P(pid), d = this.rules.drill, before = p.drill;
      p.gold -= d.gold; p.drill = Math.min(d.max, p.drill + d.base + Math.floor(this.best(pid, 'war').value / d.warDiv)); p.acted = true;
      return { ok: true, type: 'drill', text: `${p.name}: 병사를 조련했다(훈련 ${before} → ${p.drill}). 주는 피해 ×${(150 + p.drill) / 200}` };
    }
    /** 수송: 금과 쌀을 이웃한 우리 주로 실어 보낸다. */
    transport(pid, toPid, gold, rice) {
      const c = this.can(pid, 'transport'); if (!c.ok) return c;
      const p = this.P(pid), t = this.P(toPid);
      if (!t || !p.adj.includes(toPid) || t.owner !== p.owner) return NO('이웃한 우리 주로만 보낼 수 있다');
      if (!Number.isInteger(gold) || !Number.isInteger(rice) || gold < 0 || rice < 0 || gold > p.gold || rice > p.rice) return NO('보낼 양이 맞지 않다');
      if (gold + rice <= 0) return NO('보낼 것이 없다');
      p.gold -= gold; p.rice -= rice; t.gold += gold; t.rice += rice; p.acted = true;
      return { ok: true, type: 'transport', text: `${p.name} → ${t.name}: ${josa([gold ? '금 ' + fmt(gold) : '', rice ? '쌀 ' + fmt(rice) : ''].filter(Boolean).join(' · '), '을', '를')} 실어 보냈다` };
    }
    // ───────── 벼슬('주마다 한 달에 명령 하나' 원칙에 해당하지 않는 군주의 행동) ─────────
    /** 태수를 임명한다. officerId가 null이면 물린다(위임도 풀린다). */
    setGovernor(pid, officerId) {
      const p = this.P(pid); if (!p || !p.owner) return NO('주인 없는 땅이다'); if (this.over) return NO('판이 끝났다');
      if (officerId === null) { p.gov = null; p.auto = null; return { ok: true, type: 'gov', text: `${p.name}: 태수 자리를 비웠다` }; }
      const o = this.officers.get(officerId); if (!o || !this.officersOf(pid).includes(o)) return NO('이 주에 있는 우리 장수가 아니다');
      p.gov = o.id; const G = this.rules.gov;
      return { ok: true, type: 'gov', text: `${p.name}: ${josa(o.name, '을', '를')} 태수로 삼았다(세금 +${Math.round(o.cha * 100 / G.div)}% · 수확 +${Math.round(o.int * 100 / G.div)}% · 성 방어 +${Math.round(o.war * 100 / G.defDiv)}%p)` };
    }
    /** 세력 f의 군사를 임명한다. officerId가 null이면 물린다. */
    setAdvisor(f, officerId) {
      const fa = this.factions.get(f); if (!fa || !fa.alive) return NO('없는 세력이다'); if (this.over) return NO('판이 끝났다');
      if (officerId === null) { fa.advisor = null; return { ok: true, type: 'advisor', text: '군사 자리를 비웠다' }; }
      const o = this.officers.get(officerId), need = this.rules.advisor.int;
      if (!o || o.status !== 'active' || o.faction !== f) return NO('우리 장수가 아니다');
      if (o.int < need) return NO(`군사는 지력 ${need} 이상이어야 한다`);
      fa.advisor = o.id;
      return { ok: true, type: 'advisor', text: `${josa(o.name, '을', '를')} 군사로 삼았다(지력 ${o.int} · 동맹 +${+(o.int * 100 / this.rules.advisor.allyDiv).toFixed(1)}%p · 화계 +10%p)` };
    }
    /** 장군으로 올리거나(on) 물린다. */
    setGeneral(officerId, on = true) {
      const o = this.officers.get(officerId), need = this.rules.general.war; if (this.over) return NO('판이 끝났다');
      if (!o || o.status !== 'active' || !o.faction) return NO('현역 장수가 아니다');
      if (!on) { o.general = false; return { ok: true, type: 'general', text: `${josa(o.name, '을', '를')} 장군에서 물렸다` }; }
      if (o.general) return NO('이미 장군이다');
      if (o.war < need) return NO(`장군은 무력 ${need} 이상이어야 한다`);
      if (this.generalsOf(o.faction).length >= this.generalCap(o.faction)) return NO(`장군은 ${this.generalCap(o.faction)}명까지다(주 ${this.rules.general.per}곳마다 한 명 더)`);
      o.general = true;
      return { ok: true, type: 'general', text: `${josa(o.name, '을', '를')} 장군으로 올렸다(무력 ${o.war} · 그 부대가 주는 피해가 는다)` };
    }
    /** 위임: 태수가 달마다 알아서 움직인다. mode: 'civil' 내정만 · 'war' 군사까지 · null 거둔다 */
    delegate(pid, mode) {
      const p = this.P(pid); if (!p || !p.owner) return NO('주인 없는 땅이다'); if (this.over) return NO('판이 끝났다');
      if (mode === null) { p.auto = null; return { ok: true, type: 'delegate', text: `${p.name}: 위임을 거두었다` }; }
      if (mode !== 'civil' && mode !== 'war') return NO('모르는 위임이다');
      const gv = this.governor(pid), lead = this.officers.get(this.factions.get(p.owner).leader);
      if (!gv) return NO('태수를 먼저 임명한다');
      if (lead && lead.status === 'active' && lead.faction === p.owner && lead.province === pid) return NO('군주가 머무는 주는 맡기지 않는다');
      p.auto = mode;
      return { ok: true, type: 'delegate', text: `${p.name}: 태수 ${gv.name}에게 ${mode === 'civil' ? '내정을' : '내정과 군사를'} 맡겼다` };
    }
    /** 시혜: 쌀을 풀어 민심을 얻는다. */
    relief(pid) {
      const c = this.can(pid, 'relief'); if (!c.ok) return c;
      const p = this.P(pid), r = this.rules.relief, before = p.loyalty;
      p.rice -= r.rice; p.loyalty = Math.min(100, p.loyalty + r.base + Math.floor(this.best(pid, 'cha').value / r.chaDiv)); p.acted = true;
      return { ok: true, type: 'relief', text: `${p.name}: 쌀 ${josa(fmt(r.rice), '을', '를')} 풀었다. 민심 ${before} → ${p.loyalty}` };
    }
    /** 동맹을 청한다. 금은 받아들이든 말든 나간다. */
    ally(pid, f) {
      const c = this.can(pid, 'ally'); if (!c.ok) return c;
      const p = this.P(pid), a = this.rules.ally, fa = this.factions.get(f);
      if (!fa || !fa.alive || f === p.owner || !this.borderFactions(pid).includes(f)) return NO('이웃한 세력에만 청할 수 있다');
      if (this.allied(p.owner, f)) return NO('이미 동맹이다');
      if (p.gold < a.gold) return NO(`금 ${a.gold}이 있어야 한다`);
      const chance = this.allyChance(pid, f); p.gold -= a.gold; p.acted = true;
      if (this.rng.next() < chance) { this.pacts.set(this.pactKey(p.owner, f), a.months); return { ok: true, type: 'ally', made: true, text: `${p.name}: ${josa(fa.name, '과', '와')} 동맹을 맺었다(${a.months}달). 그동안 서로 치지 않는다` }; }
      return { ok: true, type: 'ally', made: false, text: `${p.name}: ${josa(fa.name, '이', '가')} 동맹을 받아들이지 않았다(금 ${a.gold}은 돌아오지 않는다)` };
    }
    /** 동맹을 깬다. 우리 주 모두의 민심이 내린다. */
    breakPact(pid, f) {
      const c = this.can(pid, 'ally'); if (!c.ok) return c;
      const p = this.P(pid), a = this.rules.ally;
      if (!this.allied(p.owner, f)) return NO('동맹이 아니다');
      this.pacts.delete(this.pactKey(p.owner, f)); p.acted = true;
      for (const q of this.provincesOf(p.owner)) q.loyalty = Math.max(0, q.loyalty - a.breakLoyalty);
      return { ok: true, type: 'break', text: `${josa(this.fname(f), '과', '와')} 맺은 동맹을 깼다. 우리 주 모두의 민심 −${a.breakLoyalty}` };
    }
    /** 장수가 한 명도 없는 주는 주인을 잃는다(공백지). 남은 병력은 흩어져 백성으로 돌아간다. @returns 알릴 글 */
    abandon(p) {
      const f = p.owner; p.pop += p.troops; p.troops = 0; p.owner = null; p.acted = false; p.gov = null; p.auto = null;
      const fall = this.checkFaction(f);
      return `${p.name}: 장수가 없어 공백지가 되었다` + (fall ? `. ${fall}` : '');
    }
    /** 주어진 주(없으면 모든 주) 가운데 장수 없는 우리 · 남의 주를 공백지로 돌린다. @returns {string[]} */
    sweep(ids) { const out = []; for (const p of ids ? ids.map(id => this.P(id)) : this.provinces.values()) if (p.owner && !this.officersOf(p.id).length) out.push(this.abandon(p)); return out; }
    /** 장수를 이웃한 우리 주로 보낸다. officerId는 장수 번호 하나, 번호 여럿(배열), 또는 null(병력만)이다.
     *  장수는 이웃한 공백지로도 간다(그 땅을 차지한다). 마지막 장수가 떠난 주는 공백지가 된다. */
    move(pid, officerId, toPid, troops = 0) {
      const c = this.can(pid, 'move'); if (!c.ok) return c;
      const p = this.P(pid), t = this.P(toPid), ids = officerId === null ? [] : Array.isArray(officerId) ? officerId : [officerId], here = this.officersOf(pid), os = ids.map(id => this.officers.get(id));
      if (!t || !p.adj.includes(toPid) || (t.owner !== p.owner && !this.vacant(t))) return NO('이웃한 우리 주나 공백지로만 갈 수 있다');
      if (os.some(o => !o || !here.includes(o))) return NO('이 주에 있는 우리 장수가 아니다');
      if (new Set(ids).size !== ids.length) return NO('같은 장수를 두 번 골랐다');
      if (!Number.isInteger(troops) || troops < 0 || troops > p.troops) return NO('보낼 병력이 맞지 않다');
      if (!os.length && troops <= 0) return NO('보낼 것이 없다');
      const take = t.owner !== p.owner;
      if (take && !os.length) return NO('공백지에는 장수가 가야 한다');
      if (take) { t.owner = p.owner; t.acted = true; }
      for (const o of os) o.province = toPid;
      this.blend(t, troops, p.drill); p.troops -= troops; t.troops += troops; p.acted = true;
      const left = os.length ? this.sweep([pid]) : [];
      const text = `${p.name} → ${t.name}: ` + (os.length ? `${josa(os.map(o => o.name).join(' · '), '이', '가')} ${troops ? '병력 ' + fmt(troops) + '과 함께 ' : ''}${take ? '들어가 공백지를 차지했다' : '옮겨 갔다'}` : `병력 ${josa(fmt(troops), '을', '를')} 보냈다`) + (left.length ? '. ' + left.join('. ') : '');
      if (take) this.checkStage();
      return { ok: true, type: 'move', took: take, left: left.length > 0, officers: os.map(o => o.id), text };
    }
    search(pid) {
      const c = this.can(pid, 'search'); if (!c.ok) return c;
      const p = this.P(pid), s = this.rules.search, b = this.best(pid, 'cha'), free = this.freeIn(pid).sort((x, y) => x.id - y.id);
      p.acted = true;
      if (free.length) {
        if (this.rng.next() < s.base + b.value / s.chaDiv) { const o = this.rng.pick(free); o.faction = p.owner; o.status = 'active'; return { ok: true, type: 'search', found: o.id, text: `${p.name}: ${josa(o.name, '을', '를')} 찾아 맞아들였다(무${o.war} 지${o.int} 매${o.cha})` }; }
        return { ok: true, type: 'search', found: null, text: `${p.name}: 인재가 있다는 소문만 들었다. 다시 찾아볼 만하다` };
      }
      if (this.rng.next() < s.goldChance) { const g = this.rng.range(s.goldMin, s.goldMax); p.gold += g; return { ok: true, type: 'search', found: null, gold: g, text: `${p.name}: 사람은 못 찾고 금 ${josa(g, '을', '를')} 얻었다` }; }
      return { ok: true, type: 'search', found: null, text: `${p.name}: 아무도 찾지 못했다` };
    }
    /** 침공. 병력을 떼어 내고 전투를 만든다. 지키는 병력이 없으면 싸우지 않고 차지한다.
     *  @returns {{ok:true, pending, battle:DH.Sam.Battle|null, text}} battle이 있으면 끝난 뒤 settle(pending, battle.result())를 불러야 한다 */
    attack(pid, toPid, troops) {
      const c = this.can(pid, 'attack'); if (!c.ok) return c;
      const p = this.P(pid), t = this.P(toPid);
      if (!t || !p.adj.includes(toPid) || t.owner === p.owner) return NO('이웃한 남의 주만 칠 수 있다');
      if (this.vacant(t)) return NO('공백지는 장수를 이동시켜 차지한다');
      if (this.allied(p.owner, t.owner)) return NO('동맹은 칠 수 없다');
      if (!Number.isInteger(troops) || troops < this.rules.attackMin || troops > p.troops) return NO('보낼 병력이 맞지 않다');
      const off = this.fighters(pid), pending = { from: pid, to: toPid, att: p.owner, def: t.owner, sent: troops, officers: off.map(o => o.id), drill: p.drill };
      const battle = t.troops > 0 ? this.makeBattle(pid, toPid, troops, this.rng) : null;
      p.troops -= troops; p.acted = true;
      const text = `${this.fname(p.owner)} 군이 ${p.name}에서 ${ro(t.name)} 쳐들어갔다(${this.fname(t.owner)} · 병력 ${fmt(troops)} 대 ${fmt(t.troops)})`;
      if (!battle) return { ok: true, type: 'attack', pending, battle: null, text, outcome: this.settle(pending, { winner: 'att', attTroops: troops, defTroops: 0, days: 0, reason: '지키는 병력이 없었다' }) };
      return { ok: true, type: 'attack', pending, battle, text };
    }
    /** 그 병력으로 칠 때의 전투를 짓는다(판을 바꾸지 않는다). 부대는 장수마다 하나, 병력은 고르게 나눈다. */
    makeBattle(pid, toPid, troops, rng) {
      const p = this.P(pid), t = this.P(toPid), off = this.fighters(pid), gov = this.governor(toPid);
      const unit = (list, total, fallback, f) => {
        const n = Math.max(1, Math.min(list.length, this.rules.maxUnits, total)), each = Math.floor(total / n), lead = f ? this.factions.get(f).leader : null;
        return Array.from({ length: n }, (_, i) => { const o = list[i]; return { officer: o ? o.id : null, name: o ? o.name : fallback, war: o ? o.war : this.rules.baseStat, int: o ? o.int : this.rules.baseStat, lord: !!o && o.id === lead, general: !!o && !!o.general, troops: each + (i === 0 ? total - each * n : 0) }; });
      };
      const defOff = this.officersOf(toPid).sort((a, b) => b.war - a.war || a.id - b.id);
      const side = (f, units, drill) => ({ faction: f, name: this.fname(f), color: f ? this.factions.get(f).color : '#8d8477', units, drill, advisor: !!this.advisorOf(f) });
      return new DH.Sam.Battle({ seed: toPid, province: { id: t.id, name: t.name }, att: side(p.owner, unit(off, troops, '원정대', p.owner), p.drill), def: side(t.owner, unit(defOff, t.troops, '수비대', t.owner), t.drill),
        rules: this.battleRules, rng, base: this.rules.baseStat, castleDef: gov ? gov.war / this.rules.gov.defDiv : 0 });
    }
    /** 군사의 헤아림: 지금 그 병력으로 치면 어떻게 될지 미리 싸워 본다(판도 판의 난수도 건드리지 않는다). 군사가 없으면 null
     *  @returns {{advisor, win:boolean, left:number, days:number}|null} */
    forecast(pid, toPid, troops) {
      const p = this.P(pid), t = this.P(toPid), adv = p && p.owner ? this.advisorOf(p.owner) : null;
      if (!adv || !t) return null;
      if (t.troops <= 0) return { advisor: adv, win: true, left: troops, days: 0 };
      const r = this.makeBattle(pid, toPid, troops, new DH.RNG((this.rng.state ^ Math.imul(toPid + 1, 2654435761)) >>> 0)).auto();
      return { advisor: adv, win: r.winner === 'att', left: r.attTroops, days: r.days };
    }
    /** 전투 결과를 지도에 반영한다. res = {winner:'att'|'def', attTroops, defTroops, reason, captives?, duelWins?}
     *  일기토에서 사로잡은 장수는 전투까지 이긴 쪽만 데려간다(진 쪽이 잡은 장수는 풀려난다). 일기토를 이긴 장수는 무력이 1 오른다. */
    settle(pending, res) {
      const from = this.P(pending.from), to = this.P(pending.to), attF = pending.att, defF = pending.def;
      const held = side => (res.captives || []).filter(x => x.by === side).map(x => this.officers.get(x.officer)).filter(Boolean);
      for (const id of res.duelWins || []) { const o = this.officers.get(id); if (o) o.war = Math.min(100, o.war + 1); }
      const join = (o, f) => { o.faction = f; o.general = false; };
      let text;
      if (res.winner === 'att') {
        const defOff = [...this.officers.values()].filter(o => o.province === to.id && o.status === 'active' && o.faction === defF && defF !== null), taken = new Set(held('att'));
        const refuge = defF ? this.nearestOwn(to.id, defF) : null, lead = defF ? this.factions.get(defF).leader : null, caught = [], away = [];
        if (refuge) this.blend(refuge, res.defTroops, to.drill);
        to.owner = attF; to.acted = true; to.troops = res.attTroops; to.loyalty = Math.max(0, to.loyalty - this.rules.conquerLoyalty); to.gov = null; to.auto = null; to.drill = pending.drill ?? this.rules.drill.start;
        for (const o of defOff) {                                    // 진 쪽 장수: 일기토에서 잡혔으면 이긴 쪽에 든다. 아니면 군주가 아닌 장수는 사로잡힐 수 있고, 나머지는 가장 가까운 자기 땅으로 물러난다
          if (attF && taken.has(o)) { join(o, attF); caught.push(o); }
          else if (attF && o.id !== lead && this.rng.next() < this.rules.capture) { join(o, attF); caught.push(o); }
          else if (refuge) { o.province = refuge.id; away.push(o); }
        }
        if (refuge) refuge.troops += res.defTroops;
        for (const id of pending.officers) this.officers.get(id).province = to.id;
        text = `${this.fname(attF)} 군이 ${josa(to.name, '을', '를')} 차지했다(${res.reason})` + (caught.length ? `. 사로잡힌 ${josa(caught.map(o => o.name).join(' · '), '이', '가')} ${this.fname(attF)} 편에 들었다` : '') + (away.length ? `. ${this.fname(defF)}의 장수들은 ${ro(refuge.name)} 물러났다` : '');
        if (defF) { const fall = this.checkFaction(defF); if (fall) text += `. ${fall}`; }
        const left = this.sweep([from.id, to.id]);                 // 장수가 모두 옮겨 간 출발지(와 장수 없이 얻은 땅)는 공백지가 된다
        if (left.length) text += '. ' + left.join('. ');
      } else {
        this.blend(from, res.attTroops, pending.drill ?? from.drill); from.troops += res.attTroops; to.troops = res.defTroops;
        const caught = defF ? held('def') : [];                      // 공격하다 일기토에서 잡힌 장수는 지켜 낸 쪽에 든다
        for (const o of caught) { join(o, defF); o.province = to.id; }
        text = `${this.fname(defF)} 쪽이 ${josa(to.name, '을', '를')} 지켜 냈다(${res.reason})` + (caught.length ? `. 사로잡힌 ${josa(caught.map(o => o.name).join(' · '), '이', '가')} ${this.fname(defF)} 편에 들었다` : '');
        const left = caught.length ? this.sweep([from.id]) : [];
        if (left.length) text += '. ' + left.join('. ');
      }
      this.checkStage();
      return { winner: res.winner, text };
    }
    /** 그 주에서 가장 가까운 f의 주(이웃 길을 따라). 없으면 null. 같은 거리면 병력이 많은 곳. */
    nearestOwn(pid, f) {
      const seen = new Set([pid]); let ring = [pid];
      while (ring.length) {
        const next = [];
        for (const id of ring) for (const b of this.P(id).adj) if (!seen.has(b)) { seen.add(b); next.push(b); }
        const own = next.map(id => this.P(id)).filter(q => q.owner === f).sort((a, b) => b.troops - a.troops || a.id - b.id);
        if (own.length) return own[0];
        ring = next;
      }
      return null;
    }
    /** 두 주를 잇는 가장 짧은 길(이웃을 따라). [from, …, to]. 이웃이면 두 곳이다. 길이 없으면 [from, to] */
    route(fromPid, toPid) {
      const prev = new Map([[fromPid, null]]); let ring = [fromPid];
      while (ring.length && !prev.has(toPid)) { const next = []; for (const id of ring) for (const b of this.P(id).adj) if (!prev.has(b)) { prev.set(b, id); next.push(b); } ring = next; }
      if (!prev.has(toPid)) return [fromPid, toPid];
      const out = []; for (let id = toPid; id !== null; id = prev.get(id)) out.unshift(id);
      return out;
    }
    /** 땅을 모두 잃은 세력은 사라지고 그 장수들은 재야가 된다. */
    checkFaction(f) {
      const fa = this.factions.get(f);
      if (!fa.alive || this.provincesOf(f).length) return null;
      fa.alive = false; fa.advisor = null;
      for (const k of [...this.pacts.keys()]) if (k.split('|').includes(f)) this.pacts.delete(k);
      for (const o of this.officers.values()) if (o.faction === f && o.status === 'active') { o.faction = null; o.status = 'free'; o.general = false; }
      if (f === this.player) { this.over = 'lost'; this.overWhy = 'fall'; }
      return `${fa.name} 세력이 무너졌다`;
    }

    /** 달을 넘긴다: 공백지 살피기 · 세금 · 수확 · 군량 · 민심 · 인구 · 동맹 기한 · 철마다 나는 일. 명령 표시를 지운다. @returns {string[]} 알릴 일 */
    endMonth() {
      const notes = this.sweep();
      for (const [k, m] of [...this.pacts]) {
        if (m > 1) { this.pacts.set(k, m - 1); continue; }
        this.pacts.delete(k); const [a, b] = k.split('|');
        if (a === this.player || b === this.player) notes.push(`${josa(this.fname(a === this.player ? b : a), '과', '와')} 맺은 동맹의 기한이 끝났다`);
      }
      for (const p of this.provinces.values()) {
        p.acted = false;
        if (!p.owner) continue;
        const inc = this.income(p.id);
        p.gold += inc.gold; p.rice += inc.rice;
        if (p.rice >= inc.upkeep) p.rice -= inc.upkeep;
        else { const lost = Math.floor(p.troops * this.rules.desert); p.rice = 0; p.troops -= lost; if (lost && p.owner === this.player) notes.push(`${p.name}: 군량이 떨어져 병사 ${josa(fmt(lost), '이', '가')} 흩어졌다`); }
        if (p.loyalty < this.rules.loyaltyRest) p.loyalty++;
        p.pop += Math.floor(p.pop * this.rules.growth);
      }
      this.months++;
      for (const t of this.seasonEvents()) notes.push(t);
      this.checkStage();
      return notes;
    }
    /** 새 달에 나는 일: 1월 역병 · 7월 큰물 · 8월 메뚜기 · 10월 풍년. 주인 있는 주마다 한 번씩 굴린다(확률 배율이 0이면 굴리지 않는다).
     *  @returns {string[]} 우리 주에 난 일 */
    seasonEvents() {
      const E = this.rules.events, kind = { 1: 'plague', 7: 'flood', 8: 'locust', 10: 'bumper' }[this.month], out = [];
      if (!kind || !(E.scale > 0)) return out;
      for (const p of this.provinces.values()) {
        if (!p.owner) continue;
        const chance = E[kind] * E.scale / 100 * (kind === 'flood' ? (100 - p.flood) / 100 : 1);
        if (!(this.rng.next() < chance)) continue;
        let text;
        if (kind === 'flood') { const farm = Math.min(p.farm, Math.max(1, Math.floor(p.farm * E.floodFarm))), rice = Math.floor(p.rice * E.floodRice); p.farm -= farm; p.rice -= rice; text = `${p.name}: 큰물이 들었다(농지 −${farm} · 쌀 −${fmt(rice)}). 치수가 높으면 덜 든다`; }
        else if (kind === 'locust') { const rice = Math.floor(p.rice * E.locustRice); p.rice -= rice; text = `${p.name}: 메뚜기 떼가 지나갔다(쌀 −${fmt(rice)})`; }
        else if (kind === 'plague') { const pop = Math.floor(p.pop * E.plaguePop), troops = Math.floor(p.troops * E.plagueTroops); p.pop -= pop; p.troops -= troops; text = `${p.name}: 돌림병이 돌았다(인구 −${fmt(pop)} · 병력 −${fmt(troops)})`; }
        else { const rice = this.income(p.id).rice * E.bumperMonths; p.rice += rice; text = `${p.name}: 풍년이 들었다(쌀 +${fmt(rice)})`; }
        if (p.owner === this.player) out.push(text);
      }
      return out;
    }

    // ───────── AI 군주 · 위임받은 태수 ─────────
    /** 세력 f의 주마다 전선까지 몇 걸음인지(칠 수 있는 주나 공백지와 맞닿으면 0). 자기 땅만 밟아 센다. */
    frontDistance(f) {
      const d = new Map(); let ring = this.provincesOf(f).filter(p => this.targets(p.id).length || this.openLand(p.id).length).map(p => p.id);
      ring.forEach(id => d.set(id, 0));
      for (let n = 1; ring.length; n++) { const next = []; for (const id of ring) for (const b of this.P(id).adj) if (this.P(b).owner === f && !d.has(b)) { d.set(b, n); next.push(b); } ring = next; }
      return d;
    }
    /** 내정 가운데 지금 할 수 있고 값이 가장 낮은 것(농지 · 상업 · 치수). 없으면 null */
    civilPick(pid) { const p = this.P(pid), list = [['develop', p.farm], ['trade', p.trade], ['flood', p.flood]].filter(([k]) => this.can(pid, k).ok).sort((a, b) => a[1] - b[1]); return list.length ? list[0][0] : null; }
    /** AI 군주(와 위임받은 태수)가 그 주에서 내릴 명령 하나를 정한다(실행은 하지 않는다).
     *  우선순위: ⓪ 시혜(민심이 낮고 쌀이 넉넉할 때) → ① 수색(재야 장수가 있고 장수가 한 명일 때) → ② 공백지 진주(장수가 둘 이상일 때)
     *           → ③ 병력 확보(징병) → ④ 훈련(병력이 넉넉한데 훈련이 낮을 때) → ⑤ 인접 영지 공격(장수가 둘 이상일 때만. 한 명은 남아 주를 지킨다)
     *           → ⑥ 후방의 남는 장수 · 병력을 전선 쪽으로 → ⑦ 농지 · 상업 · 치수 가운데 가장 낮은 것 → 쉰다.
     *  주를 비우지 않는다: 장수가 한 명인 주에서는 장수를 내보내지 않는다. 군주와 태수는 이동 · 진주에 나서지 않는다.
     *  mode가 'civil'이면(내정만 맡은 태수) 시혜 · 수색 · 훈련 · 내정만 한다.
     *  @returns {{type:'relief'|'search'|'draft'|'drill'|'attack'|'move'|'develop'|'trade'|'flood'|'wait', to?:number, troops?:number, officer?:number|null}} */
    aiDecide(pid, mode = 'war') {
      const p = this.P(pid), A = this.rules.ai, R = this.rules;
      if (!p.owner || p.acted) return { type: 'wait' };
      const offs = this.officersOf(pid), n = offs.length, lead = this.factions.get(p.owner).leader, gov = this.governor(pid);
      const spare = () => offs.filter(o => o.id !== lead && o !== gov).sort((a, b) => b.war - a.war || a.id - b.id)[0];   // 군주도 태수도 아닌 장수 가운데 무력이 가장 높은 이
      const hundreds = x => Math.floor(x / 100) * 100, drill = () => p.drill < A.drillBelow && p.troops >= A.drillMin && this.can(pid, 'drill').ok;
      const civil = () => { const k = this.civilPick(pid); return { type: k || 'wait' }; };
      if (p.loyalty < A.reliefBelow && this.can(pid, 'relief').ok && p.rice >= R.relief.rice + this.income(pid).upkeep * 3) return { type: 'relief' };   // ⓪
      if (n < A.searchBelow && this.freeIn(pid).length) return { type: 'search' };                                    // ①
      if (mode === 'civil') return drill() ? { type: 'drill' } : civil();
      const open = this.openLand(pid).sort((a, b) => b.pop - a.pop || a.id - b.id);
      if (n >= 2 && open.length && spare()) return { type: 'move', to: open[0].id, troops: hundreds(p.troops * A.occupyRatio), officer: spare().id };   // ②
      const foes = this.targets(pid).sort((a, b) => a.troops - b.troops || a.id - b.id);
      if (foes.length) {
        const target = foes[0], need = Math.max(A.needMin, Math.ceil(target.troops * A.needRatio));
        if (p.troops < need) { if (this.can(pid, 'draft').ok) return { type: 'draft' }; }                             // ③ 칠 만큼 모자라면 모은다
        else if (drill()) return { type: 'drill' };                                                                    // ④ 치기 전에 조련한다
        else if (n >= 2) { const send = hundreds(p.troops * A.sendRatio); if (send >= R.attackMin && send > target.troops) return { type: 'attack', to: target.id, troops: send }; }   // ⑤ 가장 약한 이웃을 친다
      } else if (!open.length) {
        const d = this.frontDistance(p.owner), here = d.get(pid) ?? Infinity;
        const next = this.friends(pid).filter(q => (d.get(q.id) ?? Infinity) < here).sort((a, b) => d.get(a.id) - d.get(b.id) || a.id - b.id)[0];
        const troops = p.troops >= A.moveMin ? hundreds(p.troops * A.moveRatio) : 0;
        if (next && n >= 2 && spare()) return { type: 'move', to: next.id, troops, officer: spare().id };              // ⑥ 남는 장수가 병력 절반을 데리고 간다
        if (next && troops > 0) return { type: 'move', to: next.id, troops, officer: null };                           //    장수가 한 명이면 병력만 보낸다
      }
      return civil();                                                                                                  // ⑦
    }
    /** 세력 f의 벼슬을 알아서 채운다(AI 군주). 태수: 주마다 군주가 아닌 장수 가운데 매력 + 지력이 가장 높은 이(군주만 있으면 군주가 직접).
     *  군사: 지력이 가장 높은 이(조건을 넘을 때) · 장군: 무력 순으로 정원까지. 이미 있는 자리는 건드리지 않는다. */
    autoOffices(f) {
      const fa = this.factions.get(f); if (!fa || !fa.alive) return;
      for (const p of this.provincesOf(f)) if (!this.governor(p.id)) {
        const all = this.officersOf(p.id), pool = all.filter(o => o.id !== fa.leader), top = (pool.length ? pool : all).sort((a, b) => (b.cha + b.int) - (a.cha + a.int) || a.id - b.id)[0];
        p.gov = top ? top.id : null;
      }
      const mine = [...this.officers.values()].filter(o => o.status === 'active' && o.faction === f);
      if (!this.advisorOf(f)) { const top = mine.filter(o => o.int >= this.rules.advisor.int).sort((a, b) => b.int - a.int || a.id - b.id)[0]; fa.advisor = top ? top.id : null; }
      let room = this.generalCap(f) - this.generalsOf(f).length;
      for (const o of mine.filter(o => !o.general && o.war >= this.rules.general.war).sort((a, b) => b.war - a.war || a.id - b.id)) { if (room-- <= 0) break; o.general = true; }
    }
    /** 정한 명령을 실행한다(AI 군주와 위임받은 태수가 함께 쓴다). 침공은 attack()의 결과를 그대로 돌려준다. */
    exec(pid, cmd) {
      const F = this.fname(this.P(pid).owner);
      if (['draft', 'develop', 'relief', 'flood', 'trade', 'drill'].includes(cmd.type)) return { quiet: true, ...this[cmd.type](pid) };
      if (cmd.type === 'search') { const r = this.search(pid); return { quiet: !r.found, ...r, text: r.found ? `${F}: ${r.text}` : r.text }; }
      if (cmd.type === 'move') { const r = this.move(pid, cmd.officer, cmd.to, cmd.troops); return { quiet: !r.took, ...r, text: r.took ? `${F}: ${r.text}` : r.text }; }
      if (cmd.type === 'attack') return this.attack(pid, cmd.to, cmd.troops);
      return NO('모르는 명령이다');
    }
    /** 위임받은 우리 태수들이 이번 달 명령을 내린다(차례를 넘길 때). 전투는 태수가 알아서 싸운다.
     *  @returns {{pid:number, cmd, text:string, battle?:boolean, won?:boolean}[]} 한 일 */
    runDelegates() {
      const out = [];
      if (this.player === null) return out;
      for (const p of this.provincesOf(this.player).sort((a, b) => a.id - b.id)) {
        if (this.over) break;
        const mode = this.delegated(p.id); if (!mode || p.acted || p.owner !== this.player) continue;
        const gv = this.governor(p.id), cmd = this.aiDecide(p.id, mode); if (cmd.type === 'wait') continue;
        const r = this.exec(p.id, cmd); if (!r.ok) continue;
        if (cmd.type === 'attack') { const o = r.battle ? this.settle(r.pending, r.battle.auto()) : r.outcome; out.push({ pid: p.id, cmd, battle: true, won: o.winner === 'att', text: `태수 ${gv.name}: ${r.text} → ${o.text}` }); }
        else out.push({ pid: p.id, cmd, text: `태수 ${gv.name}: ${r.text.replace(/^[^:]+: (?=[^:]+: )/, '')}` });
      }
      return out;
    }
    /** AI 차례를 연다: 사람이 아닌 세력의 벼슬을 채우고, 그 주를 세력 순서대로 줄 세운다. */
    beginAI() { this.queue = []; for (const f of this.factions.values()) if (f.alive && f.id !== this.player) { this.autoOffices(f.id); for (const p of this.provincesOf(f.id).sort((a, b) => a.id - b.id)) this.queue.push(p.id); } }
    /** 줄에서 주 하나를 꺼내 명령을 내린다.
     *  @returns {{done:true} | {done:false, cmd, from:number, by:string, text?, quiet?:boolean, battle?, pending?}} by는 명령을 내린 세력
     *  사람의 주를 치는 전투는 battle을 돌려주고 멈춘다(화면에서 싸운 뒤 settle을 부른다). AI끼리의 전투는 바로 셈한다. */
    nextAI() {
      while (this.queue.length && !this.over) {
        const pid = this.queue.shift(), p = this.P(pid);
        if (!p.owner || p.owner === this.player || p.acted) continue;          // 그 사이 주인이 바뀌었거나 이미 움직였다
        const cmd = this.aiDecide(pid), by = p.owner;
        if (cmd.type === 'wait') continue;
        const r = this.exec(pid, cmd);
        if (cmd.type !== 'attack') return { done: false, cmd, from: pid, by, ...r };
        if (!r.ok) continue;
        if (r.battle && r.pending.def === this.player) return { done: false, cmd, from: pid, by, text: r.text, battle: r.battle, pending: r.pending };
        const out = r.battle ? this.settle(r.pending, r.battle.auto()) : r.outcome;
        return { done: false, cmd, from: pid, by, text: `${r.text} → ${out.text}` };
      }
      return { done: true };
    }
    // ───────── 저장과 불러오기 ─────────
    /** 판에서 바뀌는 것만 적는다(이름 · 이웃 · 색은 자료에 있다). 설정(globalState)과 난수는 장면이 따로 적는다. */
    toJSON() {
      return { player: this.player, months: this.months, over: this.over, overWhy: this.overWhy, rank: this.rank,
        pacts: [...this.pacts].map(([k, m]) => [...k.split('|'), m]),
        factions: [...this.factions.values()].map(f => ({ id: f.id, alive: f.alive, advisor: f.advisor })),
        provinces: [...this.provinces.values()].map(p => ({ id: p.id, owner: p.owner, pop: p.pop, gold: p.gold, rice: p.rice, troops: p.troops, loyalty: p.loyalty, farm: p.farm, acted: p.acted, flood: p.flood, trade: p.trade, drill: p.drill, gov: p.gov, auto: p.auto })),
        officers: [...this.officers.values()].map(o => ({ id: o.id, province: o.province, faction: o.faction, status: o.status, war: o.war, int: o.int, cha: o.cha, general: o.general })) };
    }
    /** toJSON()이 적은 것으로 판을 되살린다. 자료와 맞지 않으면 까닭을 담아 던진다(아무것도 바꾸지 않는다).
     *  v0.36까지의 저장 파일에는 치수 · 상업 · 훈련 · 벼슬 · 호칭이 없다. 없는 것은 처음 값으로 둔다.
     *  @param world 자료 @param d toJSON()의 결과 @param {{rng?:DH.RNG, state?:object}} o */
    static restore(world, d, o = {}) {
      const need = (ok, why) => { if (!ok) throw new Error(why); }, I = (v, min = 0, max = 1e12) => Number.isInteger(v) && v >= min && v <= max;
      const opt = (v, ok) => v === undefined || ok(v), who = v => v === null || world.officers.has(v);
      need(d && typeof d === 'object' && Array.isArray(d.factions) && Array.isArray(d.provinces) && Array.isArray(d.officers), '판 정보가 없다.');
      need(typeof d.player === 'string' && world.factions.has(d.player), '군주가 자료에 없다.');
      need(I(d.months, 0, 1e6) && [null, 'won', 'lost'].includes(d.over) && [null, 'all', 'goal', 'time', 'fall'].includes(d.overWhy) && (d.over === null) === (d.overWhy === null) && opt(d.rank, v => I(v, 0, 2)), '진행 정보가 맞지 않는다.');
      const owner = f => f === null || (typeof f === 'string' && world.factions.has(f)), uniq = list => new Set(list.map(x => x && x.id)).size === list.length;
      need(d.factions.length === world.factions.size && uniq(d.factions) && d.factions.every(f => f && world.factions.has(f.id) && typeof f.alive === 'boolean' && opt(f.advisor, who)), '세력 정보가 자료와 맞지 않는다.');
      need(d.provinces.length === world.provinces.size && uniq(d.provinces) && d.provinces.every(p => p && world.provinces.has(p.id) && owner(p.owner) && I(p.pop) && I(p.gold) && I(p.rice) && I(p.troops) && I(p.loyalty, 0, 100) && I(p.farm, 0, 1000) && typeof p.acted === 'boolean'
        && opt(p.flood, v => I(v, 0, 100)) && opt(p.trade, v => I(v, 0, 100)) && opt(p.drill, v => I(v, 0, 100)) && opt(p.gov, who) && opt(p.auto, v => [null, 'civil', 'war'].includes(v))), '주 정보가 자료와 맞지 않는다.');
      // v0.05까지의 저장 파일에는 나중에 더한 장수가 없다. 없는 장수는 자료 그대로 둔다(아래에서 자리를 맞춘다)
      need(d.officers.length <= world.officers.size && uniq(d.officers) && d.officers.every(x => { const w = x && world.officers.get(x.id);      // 현역 · 재야가 아닌 장수(포로 · 사망)는 자료 그대로여야 한다
        return w && owner(x.faction) && I(x.war, 1, 100) && I(x.int, 1, 100) && I(x.cha, 1, 100) && opt(x.general, v => typeof v === 'boolean') && (((x.status === 'active' && x.faction !== null) || (x.status === 'free' && x.faction === null)) ? world.provinces.has(x.province) : x.status === w.status && x.province === w.province && x.faction === w.faction); }), '장수 정보가 자료와 맞지 않는다.');
      const g = new Game(world, { player: d.player, rng: o.rng, state: o.state }), R = g.rules;
      for (const f of d.factions) Object.assign(g.factions.get(f.id), { alive: f.alive, advisor: f.advisor ?? null });
      for (const p of d.provinces) Object.assign(g.P(p.id), { owner: p.owner, pop: p.pop, gold: p.gold, rice: p.rice, troops: p.troops, loyalty: p.loyalty, farm: p.farm, acted: p.acted,
        flood: p.flood ?? R.flood.start, trade: p.trade ?? R.trade.start, drill: p.drill ?? R.drill.start, gov: p.gov ?? null, auto: p.auto ?? null });
      for (const x of d.officers) Object.assign(g.officers.get(x.id), { province: x.province, faction: x.faction, status: x.status, war: x.war, int: x.int, cha: x.cha, general: x.general === true && x.status === 'active' });
      const saved = new Set(d.officers.map(x => x.id));
      for (const o of g.officers.values()) if (!saved.has(o.id) && o.status === 'active' && g.P(o.province).owner !== o.faction) { o.faction = null; o.status = 'free'; }   // 그 땅의 주인이 바뀌었으면 재야로 남는다
      g.pacts = new Map();
      if (d.pacts !== undefined) {
        need(Array.isArray(d.pacts) && d.pacts.every(x => Array.isArray(x) && x.length === 3 && world.factions.has(x[0]) && world.factions.has(x[1]) && x[0] !== x[1] && I(x[2], 1, 1200)), '동맹 정보가 맞지 않는다.');
        for (const [a, b, m] of d.pacts) if (g.factions.get(a).alive && g.factions.get(b).alive) g.pacts.set(g.pactKey(a, b), m);
      }
      g.months = d.months; g.over = d.over; g.overWhy = d.overWhy; g.queue = [];
      g.rank = Math.max(d.rank ?? 0, world.factions.get(d.player).rank || 0); g.checkRank(); g.crowned = 0;          // 옛 저장 파일은 지금 가진 주 수로 자리를 정한다(식은 올리지 않는다)
      return g;
    }

    /** 화면 없이 AI 차례를 끝까지 돌린다(사람이 없는 판 · 시험). 사람의 주가 공격받으면 그 전투도 AI가 대신 싸운다. */
    runAIAll() { const log = []; this.beginAI(); for (;;) { const s = this.nextAI(); if (s.done) break; if (s.battle) { const out = this.settle(s.pending, s.battle.auto()); log.push(`${s.text} → ${out.text}`); } else if (!s.quiet && s.text) log.push(s.text); } return log; }
  }

  DH.Sam = Object.assign(DH.Sam || {}, { Game, RULES, TITLES, RANKS, CIVIL, josa, ro });
})(typeof globalThis !== 'undefined' ? globalThis : this);
