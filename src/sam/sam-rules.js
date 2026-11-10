/* 동현삼 · 규칙 — 내정 명령, 한 달 넘기기, AI 군주의 판단. 화면을 모른다(node에서 그대로 돈다).
 *
 * 한 달 = 한 턴. 주마다 한 달에 명령 하나를 내린다. 장수가 있으면 가장 뛰어난 능력치를 쓰고, 없으면 40으로 친다.
 *   농지 개발  금 100 → 농지 +(3 + 지력÷20), 충성도 +2. 농지 1마다 매달 쌀 4가 들어온다.
 *   징병       금 100 → 병력 +1000, 인구 −1000, 충성도 −(12 − 매력÷10). 충성도 30 아래면 못 한다.
 *   이동       장수 한 명(또는 병력만)을 이웃한 우리 주로 보낸다. 병력을 딸려 보낼 수 있다.
 *   수색       그 주의 재야 장수를 찾는다(확률 30% + 매력÷2 %). 없으면 가끔 금을 줍는다.
 *   침공       이웃한 남의 주로 쳐들어간다 → 전투(sam-battle.js) → settle()로 결과를 반영한다.
 * 달이 바뀔 때: 세금(인구÷2000 × 충성도%) · 수확(농지 × 4) · 군량(병력÷100) · 충성도 +1(70까지) · 인구 +0.2%.
 *
 * AI 군주(aiDecide): ① 병력 확보 → ② 인접 영지 공격 → ③ 후방 병력을 전선으로 → ④ 농지 개발.
 * 저장: toJSON()이 판에서 바뀌는 것만 적고, Game.restore()가 자료에 비춰 검사한 뒤 되살린다. */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};

  const RULES = {
    baseStat: 40,                                        // 장수 없는 주의 능력치
    develop: { gold: 100, base: 3, intDiv: 20, loyalty: 2 },
    draft: { gold: 100, troops: 1000, minLoyalty: 30, minPop: 20000, base: 12, chaDiv: 10 },
    search: { base: 0.3, chaDiv: 200, goldChance: 0.3, goldMin: 50, goldMax: 150 },
    farmMax: 100, ricePerFarm: 4, taxDiv: 2000, upkeepDiv: 100, desert: 0.1, loyaltyRest: 70, growth: 0.002,
    attackMin: 1000, maxUnits: 3, conquerLoyalty: 10,
    ai: { needMin: 6000, needRatio: 2.5, sendRatio: 0.7, moveMin: 4000, moveRatio: 0.5 }
  };
  const fmt = n => Number(n).toLocaleString('ko-KR');
  const { josa, ro } = DH;                             // 받침에 맞는 조사(공통 엔진 core)
  const NO = why => ({ ok: false, why });

  class Game {
    /** @param world DH.Sam.parse()의 결과
     *  @param {{player?:string|null, rng?:DH.RNG, state?:object}} o player가 null이면 모든 세력을 AI가 맡는다.
     *  state는 DH.Sam.newState()로 만든 globalState다(동현랭 설정이 덮어쓴 값이 들어 있다). 없으면 이 파일의 RULES와 자료 값을 그대로 쓴다. */
    constructor(world, o = {}) {
      const st = o.state || null;
      this.world = world; this.rng = o.rng || new DH.RNG(1); this.player = o.player ?? null;
      this.state = st; this.rules = st && st.rules ? st.rules : RULES; this.battleRules = st && st.battle ? st.battle : null;
      this.stage = { goal: null, months: 0, ...(st && st.stage ? st.stage : {}) };
      this.factions = new Map([...world.factions.values()].map(f => [f.id, { ...f, alive: true }]));
      this.provinces = new Map([...world.provinces.values()].map(p => [p.id, { id: p.id, name: p.name, hanja: p.hanja, adj: [...p.adj], owner: p.owner, pop: p.pop, gold: p.gold, rice: p.rice, troops: p.troops, loyalty: p.loyalty, farm: p.farm, acted: false }]));
      this.officers = new Map([...world.officers.values()].map(o2 => [o2.id, { ...o2 }]));
      this.months = 0; this.over = null; this.overWhy = null; this.queue = [];
      if (this.player !== null && !this.factions.has(this.player)) throw new Error(`세력 ${this.player}가 없다`);
      if (st) { this.applyStart(st); this.checkStage(); }      // 시작부터 목표를 채웠으면 바로 끝난다
    }
    /** globalState의 시작값을 판에 덮어쓴다. null이거나 없는 것은 자료 값 그대로 둔다.
     *  start.{gold,rice,troops,loyalty,farm}: 우리 주마다 · provinces: [[주, 항목, 값]] · officers: [[장수, 능력, 값]] */
    applyStart(st) {
      const s = st.start || {};
      if (this.player !== null) for (const p of this.provincesOf(this.player)) for (const k of ['gold', 'rice', 'troops', 'loyalty', 'farm']) if (s[k] != null) p[k] = s[k];
      for (const [pid, key, v] of st.provinces || []) { const p = this.P(pid); if (p) p[key] = v; }
      for (const [id, key, v] of st.officers || []) { const o = this.officers.get(id); if (o) o[key] = v; }
    }
    /** 이기려면 차지해야 할 주의 수(스테이지 조건). 정하지 않았으면 모든 주. */
    get goal() { return Math.min(this.provinces.size, this.stage.goal || this.provinces.size); }
    /** 스테이지 조건을 본다: 목표한 만큼 차지했으면 이기고, 기한(달)이 지나면 진다. */
    checkStage() {
      if (this.player === null || this.over) return;
      if (this.provincesOf(this.player).length >= this.goal) { this.over = 'won'; this.overWhy = this.goal >= this.provinces.size ? 'all' : 'goal'; }
      else if (this.stage.months > 0 && this.months >= this.stage.months) { this.over = 'lost'; this.overWhy = 'time'; }
    }
    P(id) { return this.provinces.get(id); }
    fname(f) { return f ? this.factions.get(f).name : '빈 땅'; }
    provincesOf(f) { return [...this.provinces.values()].filter(p => p.owner === f); }
    /** 그 주에서 주인을 섬기는 현역 장수 */
    officersOf(pid) { const p = this.P(pid); return [...this.officers.values()].filter(o => o.province === pid && o.status === 'active' && o.faction === p.owner && p.owner !== null); }
    freeIn(pid) { return [...this.officers.values()].filter(o => o.province === pid && o.status === 'free'); }
    /** 그 주에서 가장 뛰어난 능력치(없으면 40)와 그 장수 */
    best(pid, key) { const top = this.officersOf(pid).sort((a, b) => b[key] - a[key] || a.id - b.id)[0]; return top ? { value: top[key], officer: top } : { value: this.rules.baseStat, officer: null }; }
    /** 싸우러 나갈 장수: 무력 순으로 셋까지. 둘 이상이면 한 명은 남아 주를 지킨다. */
    fighters(pid) { const list = this.officersOf(pid).sort((a, b) => b.war - a.war || a.id - b.id); return list.slice(0, Math.min(this.rules.maxUnits, Math.max(1, list.length - 1))); }
    /** 달마다 들고 나는 것(화면에 미리 보여 준다) */
    income(pid) { const p = this.P(pid); return { gold: Math.floor(p.pop / this.rules.taxDiv * p.loyalty / 100), rice: p.farm * this.rules.ricePerFarm, upkeep: Math.ceil(p.troops / this.rules.upkeepDiv) }; }
    targets(pid) { const p = this.P(pid); return p.adj.map(id => this.P(id)).filter(q => q.owner !== p.owner); }
    friends(pid) { const p = this.P(pid); return p.adj.map(id => this.P(id)).filter(q => q.owner === p.owner); }

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
        if (p.loyalty < d.minLoyalty) return NO(`충성도가 ${d.minLoyalty} 아래라 백성이 따르지 않는다`);
        if (p.pop < d.minPop) return NO('인구가 너무 적다');
      }
      else if (type === 'move') { if (!this.friends(pid).length) return NO('이웃에 우리 주가 없다'); if (!this.officersOf(pid).length && p.troops <= 0) return NO('보낼 장수도 병력도 없다'); }
      else if (type === 'attack') { if (!this.targets(pid).length) return NO('이웃에 남의 주가 없다'); if (p.troops < this.rules.attackMin) return NO(`병력 ${fmt(this.rules.attackMin)}이 있어야 한다`); }
      else if (type !== 'search') return NO('모르는 명령이다');
      return { ok: true };
    }

    develop(pid) {
      const c = this.can(pid, 'develop'); if (!c.ok) return c;
      const p = this.P(pid), d = this.rules.develop, b = this.best(pid, 'int'), before = p.farm;
      p.gold -= d.gold; p.farm = Math.min(this.rules.farmMax, p.farm + d.base + Math.floor(b.value / d.intDiv)); p.loyalty = Math.min(100, p.loyalty + d.loyalty); p.acted = true;
      return { ok: true, type: 'develop', text: `${p.name}: 농지를 넓혔다(${before} → ${p.farm}). 매달 쌀 +${fmt(p.farm * this.rules.ricePerFarm)}` };
    }
    draft(pid) {
      const c = this.can(pid, 'draft'); if (!c.ok) return c;
      const p = this.P(pid), d = this.rules.draft, b = this.best(pid, 'cha'), drop = Math.max(1, d.base - Math.floor(b.value / d.chaDiv));
      p.gold -= d.gold; p.troops += d.troops; p.pop -= d.troops; p.loyalty = Math.max(0, p.loyalty - drop); p.acted = true;
      return { ok: true, type: 'draft', text: `${p.name}: 병사 ${josa(fmt(d.troops), '을', '를')} 뽑았다. 병력 ${fmt(p.troops)} · 충성도 −${drop}` };
    }
    /** officerId가 null이면 병력만 보낸다. */
    move(pid, officerId, toPid, troops = 0) {
      const c = this.can(pid, 'move'); if (!c.ok) return c;
      const p = this.P(pid), t = this.P(toPid), o = officerId === null ? null : this.officers.get(officerId);
      if (!t || !p.adj.includes(toPid) || t.owner !== p.owner) return NO('이웃한 우리 주로만 갈 수 있다');
      if (officerId !== null && (!o || !this.officersOf(pid).includes(o))) return NO('이 주에 있는 우리 장수가 아니다');
      if (!Number.isInteger(troops) || troops < 0 || troops > p.troops) return NO('보낼 병력이 맞지 않다');
      if (!o && troops <= 0) return NO('보낼 것이 없다');
      if (o) o.province = toPid;
      p.troops -= troops; t.troops += troops; p.acted = true;
      return { ok: true, type: 'move', text: `${p.name} → ${t.name}: ` + (o ? `${josa(o.name, '이', '가')} ${troops ? '병력 ' + fmt(troops) + '과 함께 ' : ''}옮겨 갔다` : `병력 ${josa(fmt(troops), '을', '를')} 보냈다`) };
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
      if (!Number.isInteger(troops) || troops < this.rules.attackMin || troops > p.troops) return NO('보낼 병력이 맞지 않다');
      const off = this.fighters(pid), pending = { from: pid, to: toPid, att: p.owner, def: t.owner, sent: troops, officers: off.map(o => o.id) };
      p.troops -= troops; p.acted = true;
      const text = `${this.fname(p.owner)} 군이 ${p.name}에서 ${ro(t.name)} 쳐들어갔다(${this.fname(t.owner)} · 병력 ${fmt(troops)} 대 ${fmt(t.troops)})`;
      if (t.troops <= 0) return { ok: true, type: 'attack', pending, battle: null, text, outcome: this.settle(pending, { winner: 'att', attTroops: troops, defTroops: 0, days: 0, reason: '지키는 병력이 없었다' }) };
      const unit = (list, total, fallback) => { const n = Math.max(1, Math.min(list.length, this.rules.maxUnits, total)), each = Math.floor(total / n);
        return Array.from({ length: n }, (_, i) => ({ officer: list[i] ? list[i].id : null, name: list[i] ? list[i].name : fallback, war: list[i] ? list[i].war : this.rules.baseStat, troops: each + (i === 0 ? total - each * n : 0) })); };
      const defOff = this.officersOf(toPid).sort((a, b) => b.war - a.war || a.id - b.id);
      const side = (f, units) => ({ faction: f, name: this.fname(f), color: f ? this.factions.get(f).color : '#8d8477', units });
      const battle = new DH.Sam.Battle({ seed: toPid, province: { id: t.id, name: t.name }, att: side(p.owner, unit(off, troops, '원정대')), def: side(t.owner, unit(defOff, t.troops, '수비대')), rules: this.battleRules });
      return { ok: true, type: 'attack', pending, battle, text };
    }
    /** 전투 결과를 지도에 반영한다. res = {winner:'att'|'def', attTroops, defTroops, reason} */
    settle(pending, res) {
      const from = this.P(pending.from), to = this.P(pending.to), attF = pending.att, defF = pending.def;
      let text;
      if (res.winner === 'att') {
        const defOff = [...this.officers.values()].filter(o => o.province === to.id && o.status === 'active' && o.faction === defF && defF !== null);
        to.owner = attF; to.acted = true; to.troops = res.attTroops; to.loyalty = Math.max(0, to.loyalty - this.rules.conquerLoyalty);
        const refuge = defF ? this.nearestOwn(to.id, defF) : null;
        if (refuge) { for (const o of defOff) o.province = refuge.id; refuge.troops += res.defTroops; }
        for (const id of pending.officers) this.officers.get(id).province = to.id;
        text = `${this.fname(attF)} 군이 ${josa(to.name, '을', '를')} 차지했다(${res.reason})` + (refuge && defOff.length ? `. ${this.fname(defF)}의 장수들은 ${ro(refuge.name)} 물러났다` : '');
        if (defF) { const fall = this.checkFaction(defF); if (fall) text += `. ${fall}`; }
      } else {
        from.troops += res.attTroops; to.troops = res.defTroops;
        text = `${this.fname(defF)} 쪽이 ${josa(to.name, '을', '를')} 지켜 냈다(${res.reason})`;
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
    /** 땅을 모두 잃은 세력은 사라지고 그 장수들은 재야가 된다. */
    checkFaction(f) {
      const fa = this.factions.get(f);
      if (!fa.alive || this.provincesOf(f).length) return null;
      fa.alive = false;
      for (const o of this.officers.values()) if (o.faction === f && o.status === 'active') { o.faction = null; o.status = 'free'; }
      if (f === this.player) { this.over = 'lost'; this.overWhy = 'fall'; }
      return `${fa.name} 세력이 무너졌다`;
    }

    /** 달을 넘긴다: 세금 · 수확 · 군량 · 충성도 · 인구. 명령 표시를 지운다. @returns {string[]} 알릴 일 */
    endMonth() {
      const notes = [];
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
      this.months++; this.checkStage();
      return notes;
    }

    // ───────── AI 군주 ─────────
    /** 세력 f의 주마다 전선까지 몇 걸음인지(남의 주와 맞닿으면 0). 자기 땅만 밟아 센다. */
    frontDistance(f) {
      const d = new Map(); let ring = this.provincesOf(f).filter(p => this.targets(p.id).length).map(p => p.id);
      ring.forEach(id => d.set(id, 0));
      for (let n = 1; ring.length; n++) { const next = []; for (const id of ring) for (const b of this.P(id).adj) if (this.P(b).owner === f && !d.has(b)) { d.set(b, n); next.push(b); } ring = next; }
      return d;
    }
    /** AI 군주가 그 주에서 내릴 명령 하나를 정한다(실행은 하지 않는다).
     *  우선순위: ① 병력 확보(징병) → ② 인접 영지 공격 → ③ 후방 병력을 전선 쪽으로 → ④ 농지 개발 → 쉰다.
     *  @returns {{type:'draft'|'attack'|'move'|'develop'|'wait', to?:number, troops?:number, officer?:number|null}} */
    aiDecide(pid) {
      const p = this.P(pid), A = this.rules.ai;
      if (!p.owner || p.acted) return { type: 'wait' };
      const foes = this.targets(pid).sort((a, b) => a.troops - b.troops || a.id - b.id);
      if (foes.length) {
        const target = foes[0], need = Math.max(A.needMin, Math.ceil(target.troops * A.needRatio));
        if (p.troops < need) { if (this.can(pid, 'draft').ok) return { type: 'draft' }; }                         // ① 칠 만큼 모자라면 모은다
        else { const send = Math.floor(p.troops * A.sendRatio / 100) * 100; if (send >= this.rules.attackMin && send > target.troops) return { type: 'attack', to: target.id, troops: send }; }   // ② 가장 약한 이웃을 친다
      } else if (p.troops >= A.moveMin) {
        const d = this.frontDistance(p.owner), here = d.get(pid) ?? Infinity;
        const next = this.friends(pid).filter(q => (d.get(q.id) ?? Infinity) < here).sort((a, b) => d.get(a.id) - d.get(b.id) || a.id - b.id)[0];
        if (next) return { type: 'move', to: next.id, troops: Math.floor(p.troops * A.moveRatio / 100) * 100, officer: this.officersOf(pid).length > 1 ? this.best(pid, 'war').officer.id : null };   // ③ 절반을 보낸다. 장수는 둘 이상일 때만 따라간다
      }
      if (this.can(pid, 'develop').ok) return { type: 'develop' };                                                 // ④
      return { type: 'wait' };
    }
    /** AI 차례를 연다: 사람이 아닌 세력의 주를 세력 순서대로 줄 세운다. */
    beginAI() { this.queue = []; for (const f of this.factions.values()) if (f.alive && f.id !== this.player) for (const p of this.provincesOf(f.id).sort((a, b) => a.id - b.id)) this.queue.push(p.id); }
    /** 줄에서 주 하나를 꺼내 명령을 내린다.
     *  @returns {{done:true} | {done:false, cmd, from:number, text?, quiet?:boolean, battle?, pending?}}
     *  사람의 주를 치는 전투는 battle을 돌려주고 멈춘다(화면에서 싸운 뒤 settle을 부른다). AI끼리의 전투는 바로 셈한다. */
    nextAI() {
      while (this.queue.length && !this.over) {
        const pid = this.queue.shift(), p = this.P(pid);
        if (!p.owner || p.owner === this.player || p.acted) continue;          // 그 사이 주인이 바뀌었거나 이미 움직였다
        const cmd = this.aiDecide(pid);
        if (cmd.type === 'wait') continue;
        if (cmd.type === 'draft') return { done: false, cmd, from: pid, quiet: true, ...this.draft(pid) };
        if (cmd.type === 'develop') return { done: false, cmd, from: pid, quiet: true, ...this.develop(pid) };
        if (cmd.type === 'move') return { done: false, cmd, from: pid, quiet: true, ...this.move(pid, cmd.officer, cmd.to, cmd.troops) };
        const r = this.attack(pid, cmd.to, cmd.troops);
        if (!r.ok) continue;
        if (r.battle && r.pending.def === this.player) return { done: false, cmd, from: pid, text: r.text, battle: r.battle, pending: r.pending };
        const out = r.battle ? this.settle(r.pending, r.battle.auto()) : r.outcome;
        return { done: false, cmd, from: pid, text: `${r.text} → ${out.text}` };
      }
      return { done: true };
    }
    // ───────── 저장과 불러오기 ─────────
    /** 판에서 바뀌는 것만 적는다(이름 · 이웃 · 색은 자료에 있다). 설정(globalState)과 난수는 장면이 따로 적는다. */
    toJSON() {
      return { player: this.player, months: this.months, over: this.over, overWhy: this.overWhy,
        factions: [...this.factions.values()].map(f => ({ id: f.id, alive: f.alive })),
        provinces: [...this.provinces.values()].map(p => ({ id: p.id, owner: p.owner, pop: p.pop, gold: p.gold, rice: p.rice, troops: p.troops, loyalty: p.loyalty, farm: p.farm, acted: p.acted })),
        officers: [...this.officers.values()].map(o => ({ id: o.id, province: o.province, faction: o.faction, status: o.status, war: o.war, int: o.int, cha: o.cha })) };
    }
    /** toJSON()이 적은 것으로 판을 되살린다. 자료와 맞지 않으면 까닭을 담아 던진다(아무것도 바꾸지 않는다).
     *  @param world 자료 @param d toJSON()의 결과 @param {{rng?:DH.RNG, state?:object}} o */
    static restore(world, d, o = {}) {
      const need = (ok, why) => { if (!ok) throw new Error(why); }, I = (v, min = 0, max = 1e12) => Number.isInteger(v) && v >= min && v <= max;
      need(d && typeof d === 'object' && Array.isArray(d.factions) && Array.isArray(d.provinces) && Array.isArray(d.officers), '판 정보가 없다.');
      need(typeof d.player === 'string' && world.factions.has(d.player), '군주가 자료에 없다.');
      need(I(d.months, 0, 1e6) && [null, 'won', 'lost'].includes(d.over) && [null, 'all', 'goal', 'time', 'fall'].includes(d.overWhy) && (d.over === null) === (d.overWhy === null), '진행 정보가 맞지 않는다.');
      const owner = f => f === null || (typeof f === 'string' && world.factions.has(f)), uniq = list => new Set(list.map(x => x && x.id)).size === list.length;
      need(d.factions.length === world.factions.size && uniq(d.factions) && d.factions.every(f => f && world.factions.has(f.id) && typeof f.alive === 'boolean'), '세력 정보가 자료와 맞지 않는다.');
      need(d.provinces.length === world.provinces.size && uniq(d.provinces) && d.provinces.every(p => p && world.provinces.has(p.id) && owner(p.owner) && I(p.pop) && I(p.gold) && I(p.rice) && I(p.troops) && I(p.loyalty, 0, 100) && I(p.farm, 0, 1000) && typeof p.acted === 'boolean'), '주 정보가 자료와 맞지 않는다.');
      need(d.officers.length === world.officers.size && uniq(d.officers) && d.officers.every(x => { const w = x && world.officers.get(x.id);      // 현역 · 재야가 아닌 장수(포로 · 사망)는 자료 그대로여야 한다
        return w && owner(x.faction) && I(x.war, 1, 100) && I(x.int, 1, 100) && I(x.cha, 1, 100) && (((x.status === 'active' && x.faction !== null) || (x.status === 'free' && x.faction === null)) ? world.provinces.has(x.province) : x.status === w.status && x.province === w.province && x.faction === w.faction); }), '장수 정보가 자료와 맞지 않는다.');
      const g = new Game(world, { player: d.player, rng: o.rng, state: o.state });
      for (const f of d.factions) g.factions.get(f.id).alive = f.alive;
      for (const p of d.provinces) Object.assign(g.P(p.id), { owner: p.owner, pop: p.pop, gold: p.gold, rice: p.rice, troops: p.troops, loyalty: p.loyalty, farm: p.farm, acted: p.acted });
      for (const x of d.officers) Object.assign(g.officers.get(x.id), { province: x.province, faction: x.faction, status: x.status, war: x.war, int: x.int, cha: x.cha });
      g.months = d.months; g.over = d.over; g.overWhy = d.overWhy; g.queue = [];
      return g;
    }

    /** 화면 없이 AI 차례를 끝까지 돌린다(사람이 없는 판 · 시험). 사람의 주가 공격받으면 그 전투도 AI가 대신 싸운다. */
    runAIAll() { const log = []; this.beginAI(); for (;;) { const s = this.nextAI(); if (s.done) break; if (s.battle) { const out = this.settle(s.pending, s.battle.auto()); log.push(`${s.text} → ${out.text}`); } else if (!s.quiet && s.text) log.push(s.text); } return log; }
  }

  DH.Sam = Object.assign(DH.Sam || {}, { Game, RULES, josa, ro });
})(typeof globalThis !== 'undefined' ? globalThis : this);
