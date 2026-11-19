/* 동현삼 · 전투 규칙 — 10×10 육각 전장에서 부대를 움직여 싸운다. 화면을 모른다(node에서 그대로 돈다).
 *
 *   지형      평지: 이동 1, 방어 0 · 산: 이동 3, 방어 0.3 · 강: 이동 4, 방어 0 · 성: 이동 1, 방어 0.4 · 숲: 이동 2, 방어 0.2
 *   이동력    부대마다 하루 5. 적 부대와 불타는 칸은 지나갈 수 없고, 아군은 지나가되 겹쳐 설 수 없다.
 *   공격      바로 옆 칸의 적을 친다. 한 부대는 하루에 한 번 움직이고 한 번 친다(치면 그날은 끝).
 *   피해      (공격 부대 병력 × 장수 무력 ÷ 100) × (1 − 맞는 쪽이 선 지형의 방어 보정) × (150 + 훈련) ÷ 200 × (장군이면 1.1). 소수점은 버린다.
 *             수비 측이 성에 서 있으면 태수의 무력 ÷ 1000이 성의 방어 보정에 더해진다.
 *   일기토    장수가 이끄는 부대가 옆 칸의 적 장수에게 청한다(쪽마다 전투당 한 번). 기력 100으로 시작해 합마다 공격 · 강공 · 방어 · 급소 가운데 하나를 낸다.
 *             한 합의 피해 = (무력 ÷ 4 + 0~9) × 수의 배율 × (100 + 무력 차) %. 무력이 1 앞설 때마다 1% 더 주고 1% 덜 받는다.
 *             진 부대는 병력의 절반을 잃고 장수는 사로잡힌다(군주는 달아난다). 피하면 병력의 5%가 흩어진다. 10합 안에 끝나지 않으면 비긴다.
 *   화계      옆 칸에 불을 놓는다(성공 확률 30% + 지력÷2 %, 군사가 있으면 +10%p). 불은 3일(숲은 4일) 타고, 날이 바뀔 때 바람 쪽으로 번진다.
 *             불 칸의 부대는 불이 붙을 때와 날이 바뀔 때 병력의 20%를 잃는다. 비가 오면 꺼지고 놓을 수 없다. 강과 성은 타지 않는다.
 *   하루      공격 측이 모두 움직이고, 이어서 수비 측이 움직인다.
 *   승패      한쪽이 모두 쓰러지면 진다 · 공격 측이 자기 차례를 마칠 때 성에 서 있으면 이긴다 ·
 *             20일이 지나면 수비 측이 이긴다 · 물러나면 진다.
 * 전장은 주 번호(seed)로 만든다. 같은 주는 언제나 같은 전장이다. 일기토 · 화계 · 날씨의 난수는 o.rng(판의 난수)를 쓴다. */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};
  const TERRAIN = {
    plain: { name: '평지', cost: 1, def: 0 }, mountain: { name: '산', cost: 3, def: 0.3 },
    river: { name: '강', cost: 4, def: 0 }, castle: { name: '성', cost: 1, def: 0.4 }, forest: { name: '숲', cost: 2, def: 0.2 }
  };
  /** duel: 일기토의 최대 합(0이면 일기토가 없다) · fire: 불 칸의 부대가 잃는 병력 %(0이면 화계가 없다) · general: 장군 부대의 피해 덤 % */
  const BATTLE = { cols: 10, rows: 10, hex: 22, mp: 5, days: 20, engage: 5, duel: 10, fire: 20, general: 10 };
  /** 화계: 타는 날 수 · 성공 확률(base + 지력 ÷ intDiv + 군사) · 번질 확률 · 비 올 확률 · 바람이 돌 확률 · AI가 불을 쓰는 지력 */
  const FIRE = { days: 3, forestDays: 4, base: 0.3, intDiv: 200, advisor: 0.1, max: 0.95, spread: 0.5, forestSpread: 0.8, rain: 0.15, turn: 0.3, aiInt: 60, burns: ['plain', 'forest', 'mountain'] };
  /** 일기토: 기력 · 한 합의 피해(무력 ÷ warDiv + 0~roll−1) · 무력 차 1마다 더 주는 피해 %(edge, 아무리 뒤져도 floor %는 준다) · AI가 청하는 무력 차 · 받아 주는 무력 차 · 피한 쪽과 진 쪽이 잃는 병력 */
  const DUEL = { hp: 100, warDiv: 4, roll: 10, edge: 1, floor: 20, lead: 10, lag: 15, refuse: 0.05, lose: 0.5 };
  const MOVES = ['attack', 'power', 'guard', 'feint'], MOVE_NAME = { attack: '공격', power: '강공', guard: '방어', feint: '급소' };
  /** 내가 낸 수(행)와 상대가 낸 수(열)에 따라 내가 주는 피해의 배율 × 10. 강공은 방어를 깨고, 방어는 급소와 공격을 받아치고, 급소는 강공의 빈틈을 찌른다. */
  const HITS = { attack: { attack: 10, power: 13, guard: 3, feint: 10 }, power: { attack: 15, power: 15, guard: 15, feint: 0 }, guard: { attack: 6, power: 0, guard: 0, feint: 8 }, feint: { attack: 8, power: 14, guard: 3, feint: 8 } };
  /** 육각 칸의 여섯 방향(0 동 · 1 북동 · 2 북서 · 3 서 · 4 남서 · 5 남동). 홀수 줄과 짝수 줄이 다르다. */
  const DIRS = [[[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]], [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]]];
  const WIND = ['→', '↗', '↖', '←', '↙', '↘'];
  const fmt = n => Number(n).toLocaleString('ko-KR');
  const J = (w, a, b) => DH.josa(w, a, b);

  /** 전장 만들기. 왼쪽 두 줄과 오른쪽 두 줄은 평지로 둔다(양쪽이 서는 자리). 성은 오른쪽. */
  function makeMap(seed) {
    const B = BATTLE, rng = new DH.RNG((seed >>> 0) * 7919 + 13), t = Array.from({ length: B.rows }, () => Array(B.cols).fill('plain'));
    if (rng.next() < 0.7) {                                    // 강: 위에서 아래로 끊기지 않게 흐른다
      let c = 4 + rng.int(2);
      for (let r = 0; r < B.rows; r++) { t[r][c] = 'river'; const pick = r & 1 ? [c, c + 1] : [c - 1, c], ok = pick.filter(x => x >= 3 && x <= 6); c = ok[rng.int(ok.length)]; }
    }
    const grid = new DH.HexGrid(B.cols, B.rows, B.hex);
    const clump = (kind, most) => {
      const c = 2 + rng.int(6), r = rng.int(B.rows), n = 1 + rng.int(most);
      if (t[r][c] === 'plain') t[r][c] = kind;
      const nb = grid.neighbors(c, r).filter(([x]) => x >= 2 && x <= 7);
      for (let k = 0; k < n && nb.length; k++) { const [x, y] = nb.splice(rng.int(nb.length), 1)[0]; if (t[y][x] === 'plain') t[y][x] = kind; }
    };
    for (let i = 0; i < 4; i++) clump('mountain', 3);          // 산: 네 덩이
    const castle = [8, 4 + rng.int(2)]; t[castle[1]][castle[0]] = 'castle';
    for (let i = 0; i < 3; i++) clump('forest', 2);            // 숲: 세 덩이(v1.00). 강 · 산 · 성을 정한 뒤에 뽑으니 그 자리는 예전 그대로다
    return { tiles: t, castle };
  }

  class Battle {
    /** @param {{seed:number, province:{id:number,name:string}, att:Side, def:Side}} o
     *  Side = {faction, name, color, drill?, advisor?, units:[{officer:number|null, name, war, int?, lord?, general?, troops}]} (부대는 셋까지)
     *  o.rules = {mp, days, engage, duel, fire, general, terrain}를 주면 그 값으로 싸운다(동현랭 설정). 없으면 이 파일의 BATTLE · TERRAIN.
     *  o.rng 일기토 · 화계 · 날씨에 쓰는 난수(없으면 주 번호로 만든다) · o.base 장수 없는 부대의 능력치 · o.castleDef 태수가 성에 더하는 방어 보정 */
    constructor(o) {
      const B = BATTLE, m = makeMap(o.seed), R = o.rules || {};
      this.B = { mp: R.mp ?? B.mp, days: R.days ?? B.days, engage: R.engage ?? B.engage, duel: R.duel ?? B.duel, fire: R.fire ?? B.fire, general: R.general ?? B.general }; this.T = R.terrain || TERRAIN;
      this.province = o.province; this.sides = { att: { ...o.att }, def: { ...o.def } };
      this.rng = o.rng || new DH.RNG((((o.seed >>> 0) + 1) * 2654435761) >>> 0); this.base = o.base ?? 40; this.castleDef = o.castleDef || 0;
      this.drill = { att: o.att.drill ?? 50, def: o.def.drill ?? 50 }; this.advisor = { att: !!o.att.advisor, def: !!o.def.advisor };
      this.grid = new DH.HexGrid(B.cols, B.rows, B.hex); this.tiles = m.tiles; this.castle = m.castle;
      const [cc, cr] = m.castle, spot = { att: [[1, 4], [0, 2], [0, 7]], def: [[cc, cr], [8, cr - 2], [8, cr + 2]] };
      this.units = [];
      for (const side of ['att', 'def']) o[side].units.slice(0, 3).forEach((u, i) => this.units.push({ id: side + i, side, officer: u.officer, name: u.name, war: u.war, int: u.int ?? this.base, lord: !!u.lord, general: !!u.general, troops: u.troops, start: u.troops, c: spot[side][i][0], r: spot[side][i][1], moved: false, done: false, hold: side === 'def' && i === 0 }));
      this.side = 'att'; this.day = 1; this.winner = null; this.reason = ''; this.log = [];
      this.fire = new Map();                                     // 불타는 칸: 'c,r' → 남은 날
      this.wind = this.B.fire > 0 ? this.rng.int(6) : 0; this.rain = false; this.news = [];
      this.duel = null; this.dueled = { att: false, def: false }; this.captives = []; this.duelWins = [];
      this.human = null;                                         // 사람이 맡은 쪽('att' · 'def'). 그쪽 장수에게 AI가 일기토를 청하면 물어본다
    }
    at(c, r) { return this.tiles[r][c]; }
    terrain(c, r) { return this.T[this.tiles[r][c]] || TERRAIN[this.tiles[r][c]]; }
    /** 그 칸에 선 부대 u가 받는 방어 보정. 수비 측이 성에 서 있으면 태수의 몫이 더해진다. */
    defAt(u) { const d = this.terrain(u.c, u.r).def; return u.side === 'def' && this.tiles[u.r][u.c] === 'castle' ? Math.min(0.9, d + this.castleDef) : d; }
    unitAt(c, r) { return this.units.find(u => u.troops > 0 && u.c === c && u.r === r) || null; }
    alive(side) { return this.units.filter(u => u.side === side && u.troops > 0); }
    total(side) { return this.alive(side).reduce((s, u) => s + u.troops, 0); }
    burning(c, r) { return this.fire.has(c + ',' + r); }
    get windMark() { return WIND[this.wind]; }
    /** 이 부대가 지금 갈 수 있는 칸. Map<'c,r',{c,r,cost,from}>. 설 수 없는 칸(아군이 선 칸)은 뺀다. 제자리는 들어 있다. 불타는 칸은 들어갈 수 없다. */
    range(u) {
      const mp = u.done || u.moved || u.troops <= 0 ? 0 : this.B.mp;
      const all = DH.moveRange(this.grid, [u.c, u.r], mp, (c, r) => { const x = this.unitAt(c, r); return (x && x.side !== u.side) || this.burning(c, r) ? Infinity : this.terrain(c, r).cost; });
      for (const [k, v] of all) { const x = this.unitAt(v.c, v.r); if (x && x !== u) all.delete(k); }
      return all;
    }
    /** (c,r)에 선다면 칠 수 있는 적 */
    foesNear(u, c = u.c, r = u.r) { return this.grid.neighbors(c, r).map(([x, y]) => this.unitAt(x, y)).filter(x => x && x.side !== u.side); }
    targets(u) { return u.done || u.troops <= 0 || u.side !== this.side || this.winner || this.duel ? [] : this.foesNear(u); }
    /** 피해 = (공격 부대 병력 × 무력 ÷ 100) × (1 − 맞는 쪽 지형의 방어 보정) × (150 + 훈련) ÷ 200 × (100 + 장군 덤) ÷ 100. 소수점은 버린다.
     *  0.7 같은 수는 컴퓨터 안에서 딱 떨어지지 않아(100 × 90 ÷ 100 × 0.7이 62.99…가 된다) 정수로 바꿔 셈한다. 식은 같다. 훈련 50에 장군이 아니면 뒤의 두 항은 1이다. */
    damage(u, t) { return Math.floor(u.troops * u.war * (100 - Math.round(this.defAt(t) * 100)) * (150 + this.drill[u.side]) * (100 + (u.general ? this.B.general : 0)) / (10000 * 200 * 100)); }

    move(u, c, r) {
      if (this.winner || this.duel || u.side !== this.side || u.done || u.moved) return false;
      const k = c + ',' + r; if (!this.range(u).has(k) || (u.c === c && u.r === r)) return false;
      u.c = c; u.r = r; u.moved = true; return true;
    }
    attack(u, t) {
      if (!this.targets(u).includes(t)) return null;
      const dmg = Math.min(t.troops, this.damage(u, t)); t.troops -= dmg; u.done = true;
      const rec = { type: 'attack', unit: u.id, target: t.id, damage: dmg, left: t.troops, text: `${u.name} 부대가 ${t.name} 부대를 쳤다 · 피해 ${fmt(dmg)}${t.troops ? '' : ' · 무너졌다'}` };
      this.log.push(rec.text);
      this.checkFall(u.side, t.side === 'def' ? '수비 부대가 모두 무너졌다' : '공격 부대가 모두 무너졌다');
      return rec;
    }
    /** side의 상대가 모두 쓰러졌으면 side가 이긴다. */
    checkFall(side, reason) { const foe = side === 'att' ? 'def' : 'att'; if (!this.winner && !this.alive(foe).length) this.finish(this.alive(side).length ? side : foe, reason); }
    wait(u) { if (u.side === this.side && !this.winner) u.done = true; }
    /** 지금 쪽의 차례를 마친다. 수비 측까지 마치면 하루가 간다(불이 번지고 날씨가 바뀐다 → news). */
    endSide() {
      if (this.winner || this.duel) return;
      this.news = [];
      if (this.side === 'att') {
        const [cc, cr] = this.castle, x = this.unitAt(cc, cr);
        if (x && x.side === 'att') return this.finish('att', '성을 차지했다');
        this.side = 'def';
      } else {
        if (this.day >= this.B.days) return this.finish('def', `${this.B.days}일을 버텼다`);
        this.day++; this.side = 'att'; this.newDay(); if (this.winner) return;
      }
      for (const u of this.units) if (u.side === this.side) { u.moved = false; u.done = false; }
    }
    retreat(side) { if (!this.winner) this.finish(side === 'att' ? 'def' : 'att', side === 'att' ? '공격 측이 물러났다' : '수비 측이 성을 버렸다'); }
    finish(winner, reason) { this.winner = winner; this.reason = reason; this.duel = null; this.log.push(reason); }
    /** captives: 일기토에서 사로잡힌 장수 [{officer, by:'att'|'def'}] · duelWins: 일기토를 이긴 장수 번호 */
    result() { return { winner: this.winner, reason: this.reason, days: this.day, attTroops: this.total('att'), defTroops: this.total('def'), captives: this.captives.map(c => ({ ...c })), duelWins: [...this.duelWins] }; }

    // ───────── 화계 ─────────
    /** (c,r)에서 바람이 부는 쪽의 이웃 칸. 전장 밖이면 null */
    downwind(c, r) { const [dc, dr] = DIRS[r & 1][this.wind], x = c + dc, y = r + dr; return this.grid.inBounds(x, y) ? [x, y] : null; }
    burnable(c, r) { return FIRE.burns.includes(this.tiles[r][c]) && !this.burning(c, r); }
    /** 이 부대가 지금 불을 놓을 수 있는 칸들 [[c,r]…] */
    canIgnite(u) { return !(this.B.fire > 0) || this.rain || this.winner || this.duel || u.done || u.troops <= 0 || u.side !== this.side ? [] : this.grid.neighbors(u.c, u.r).filter(([c, r]) => this.burnable(c, r)); }
    fireChance(u) { return Math.min(FIRE.max, FIRE.base + u.int / FIRE.intDiv + (this.advisor[u.side] ? FIRE.advisor : 0)); }
    /** 불 칸에 선 부대가 병력을 잃는다. @returns 잃은 수 */
    burn(x) { const d = Math.min(x.troops, Math.max(1, Math.ceil(x.troops * this.B.fire / 100))); x.troops -= d; return d; }
    /** 옆 칸에 불을 놓는다. 되든 안 되든 그 부대는 그날 일을 마친다. */
    ignite(u, c, r) {
      if (!this.canIgnite(u).some(([x, y]) => x === c && y === r)) return null;
      u.done = true;
      const ok = this.rng.next() < this.fireChance(u), t = this.unitAt(c, r), rec = { type: 'fire', unit: u.id, cell: [c, r], ok, target: t ? t.id : null, damage: 0 };
      if (ok) { this.fire.set(c + ',' + r, this.tiles[r][c] === 'forest' ? FIRE.forestDays : FIRE.days); if (t) rec.damage = this.burn(t); }
      rec.text = ok ? `${u.name} 부대가 불을 놓았다` + (t ? ` · ${t.name} 부대가 불길에 ${J(fmt(rec.damage), '을', '를')} 잃었다${t.troops ? '' : ' · 무너졌다'}` : '') : `${u.name} 부대의 불이 붙지 않았다`;
      this.log.push(rec.text);
      if (t) this.checkFall(u.side, '불길에 무너졌다');
      return rec;
    }
    /** 날이 바뀐다: 비가 오면 불이 꺼진다. 아니면 불 칸의 부대가 병력을 잃고, 불이 바람 쪽으로 번지고, 다 탄 칸은 꺼진다. */
    newDay() {
      if (!(this.B.fire > 0)) return;
      const n = this.news;
      this.rain = this.rng.next() < FIRE.rain;
      if (this.rng.next() < FIRE.turn) { this.wind = (this.wind + (this.rng.next() < 0.5 ? 1 : 5)) % 6; }
      if (this.rain) { if (this.fire.size) n.push('비가 내려 불이 모두 꺼졌다'); this.fire.clear(); return; }
      for (const u of this.units) if (u.troops > 0 && this.burning(u.c, u.r)) { const d = this.burn(u); n.push(`${u.name} 부대가 불길에 ${J(fmt(d), '을', '를')} 잃었다${u.troops ? '' : ' · 무너졌다'}`); }
      const add = [];
      for (const k of this.fire.keys()) {
        const [c, r] = k.split(',').map(Number), to = this.downwind(c, r);
        if (to && this.burnable(to[0], to[1]) && !add.some(a => a[0] === to[0] && a[1] === to[1]) && this.rng.next() < (this.tiles[to[1]][to[0]] === 'forest' ? FIRE.forestSpread : FIRE.spread)) add.push(to);
      }
      for (const [k, d] of [...this.fire]) { if (d > 1) this.fire.set(k, d - 1); else this.fire.delete(k); }
      for (const [c, r] of add) this.fire.set(c + ',' + r, this.tiles[r][c] === 'forest' ? FIRE.forestDays : FIRE.days);
      if (add.length) n.push(`불이 바람(${this.windMark})을 타고 ${add.length}칸 번졌다`);
      for (const t of n) this.log.push(t);
      if (!this.alive('att').length || !this.alive('def').length) this.finish(this.alive('att').length ? 'att' : 'def', '불길에 무너졌다');
    }

    // ───────── 일기토 ─────────
    /** 이 부대가 지금 일기토를 청할 수 있는 적 부대 */
    canDuel(u) { return !(this.B.duel > 0) || this.winner || this.duel || this.dueled[u.side] || u.done || u.troops <= 0 || u.side !== this.side || u.officer == null ? [] : this.foesNear(u).filter(x => x.officer != null); }
    /** AI가 받아 주는지: 무력이 lag(15)까지 뒤져도 받는다 */
    takes(t, u) { return t.war + DUEL.lag >= u.war; }
    /** 일기토를 청한다(사람이 청할 때). 상대(AI)가 받으면 this.duel이 열리고 {type:'duel-start'}, 피하면 {type:'refuse', …} */
    challenge(u, t) { if (!this.canDuel(u).includes(t)) return null; if (!this.takes(t, u)) return this.refuseDuel(u, t); this.beginDuel(u, t); return { type: 'duel-start', unit: u.id, target: t.id }; }
    beginDuel(u, t) { this.dueled[u.side] = true; u.done = true; this.duel = { a: u, d: t, hp: [DUEL.hp, DUEL.hp], round: 0, max: this.B.duel, done: false, winner: null }; return this.duel; }
    /** 일기토를 피한다: 피한 부대(t)의 병력 5%가 흩어진다. 청한 부대는 그날 일을 더 할 수 있다. */
    refuseDuel(u, t) {
      this.dueled[u.side] = true;
      const lost = Math.min(t.troops, Math.ceil(t.troops * DUEL.refuse)); t.troops -= lost;
      const rec = { type: 'refuse', unit: u.id, target: t.id, lost, text: `${J(t.name, '이', '가')} ${u.name}의 일기토를 피했다 · 사기가 꺾여 병사 ${J(fmt(lost), '이', '가')} 흩어졌다` };
      this.log.push(rec.text); this.checkFall(u.side, t.side === 'def' ? '수비 부대가 모두 무너졌다' : '공격 부대가 모두 무너졌다');
      return rec;
    }
    /** AI가 낼 수. 기력이 30 아래면 지키고, 상대가 30 아래면 몰아친다. i: 0 청한 쪽 · 1 받은 쪽 */
    duelMove(i) {
      const D = this.duel, w = D.hp[i] < 30 ? [25, 15, 35, 25] : D.hp[1 - i] < 30 ? [35, 35, 10, 20] : [35, 25, 20, 20];
      let x = this.rng.int(100), k = 0; while (x >= w[k]) x -= w[k++];
      return MOVES[k];
    }
    /** 한 합. m0은 청한 쪽, m1은 받은 쪽의 수. 피해 = (무력 ÷ 4 + 0~9) × 배율 × (100 + 무력 차) %. 소수점은 버린다. 한쪽의 기력이 다하면 끝나고, 정한 합을 채우면 비긴다. */
    duelRound(m0, m1) {
      const D = this.duel; if (!D || D.done || !HITS[m0] || !HITS[m1]) return null;
      const f = [D.a, D.d], roll = i => Math.floor(f[i].war / DUEL.warDiv) + this.rng.int(DUEL.roll), edge = i => Math.max(DUEL.floor, 100 + (f[i].war - f[1 - i].war) * DUEL.edge);
      const r0 = roll(0), r1 = roll(1), hit = [Math.floor(r0 * HITS[m0][m1] * edge(0) / 1000), Math.floor(r1 * HITS[m1][m0] * edge(1) / 1000)];      // hit[i]: i가 준 피해
      D.hp[1] = Math.max(0, D.hp[1] - hit[0]); D.hp[0] = Math.max(0, D.hp[0] - hit[1]); D.round++;
      const ko = D.hp[0] <= 0 || D.hp[1] <= 0;
      if (ko || D.round >= D.max) { D.done = true; D.winner = !ko || D.hp[0] === D.hp[1] ? -1 : D.hp[0] > D.hp[1] ? 0 : 1; }
      const rec = { type: 'round', round: D.round, moves: [m0, m1], hit, hp: [...D.hp], done: D.done, winner: D.winner,
        text: `${D.round}합 · ${D.a.name} ${MOVE_NAME[m0]}(${hit[0]}) · ${D.d.name} ${MOVE_NAME[m1]}(${hit[1]})` };
      if (D.done) rec.end = this.endDuel();
      return rec;
    }
    /** 일기토의 끝: 진 부대는 병력의 절반을 잃고 장수는 사로잡힌다(군주는 달아난다). 이긴 장수는 duelWins에 적힌다. */
    endDuel() {
      const D = this.duel, out = { type: 'duel', unit: D.a.id, target: D.d.id, winner: D.winner, rounds: D.round, hp: [...D.hp], names: [D.a.name, D.d.name], lost: 0, loser: null, caught: null };
      this.duel = null;
      if (D.winner < 0) out.text = `${J(D.a.name, '과', '와')} ${D.d.name}의 일기토는 ${D.round}합 끝에 승부가 나지 않았다`;
      else {
        const W = D.winner ? D.d : D.a, L = D.winner ? D.a : D.d, name = L.name;
        out.lost = Math.min(L.troops, Math.ceil(L.troops * DUEL.lose)); L.troops -= out.lost; out.loser = L.id; this.duelWins.push(W.officer);
        if (L.lord) out.text = `${J(W.name, '이', '가')} ${D.round}합 만에 ${J(name, '을', '를')} 꺾었다 · ${J(name, '은', '는')} 군주라 몸을 뺐고 병사 ${J(fmt(out.lost), '이', '가')} 흩어졌다`;
        else {
          this.captives.push({ officer: L.officer, by: W.side }); out.caught = L.officer;
          L.officer = null; L.name = '잔병'; L.war = this.base; L.int = this.base; L.general = false;
          out.text = `${J(W.name, '이', '가')} ${D.round}합 만에 ${J(name, '을', '를')} 사로잡았다 · 병사 ${J(fmt(out.lost), '이', '가')} 흩어졌다`;
        }
        this.checkFall(W.side, L.side === 'def' ? '수비 부대가 모두 무너졌다' : '공격 부대가 모두 무너졌다');
      }
      this.log.push(out.text);
      return out;
    }
    /** 두 장수의 일기토를 끝까지 셈한다(AI끼리). @returns endDuel()의 결과 */
    duelAuto(u, t) { this.beginDuel(u, t); let rec = null; while (this.duel) rec = this.duelRound(this.duelMove(0), this.duelMove(1)); return rec.end; }

    /** 지금 쪽의 부대 하나를 AI가 움직인다. 움직일 부대가 없으면 null(그러면 endSide를 부른다).
     *  ⓪ 옆 칸의 적 장수보다 무력이 10 이상 앞서면 일기토를 청한다(쪽마다 한 번). 사람의 장수에게 청할 때는 {type:'challenge'}를 돌려주고 답을 기다린다.
     *  ① 닿는 칸에서 칠 수 있으면 가장 큰 피해를 주는 자리로 가서 친다(방어 좋은 칸을 조금 더 친다). 옆 칸의 적에게 불을 놓는 쪽이 더 이로우면(지력 60 이상) 불을 놓는다.
     *  ② 못 치면: 공격 측은 빈 성이 닿으면 성으로, 아니면 가장 가까운 적 쪽으로. 수비 측은 적이 5칸 안에 오면 맞으러 간다.
     *  성을 지키는 부대(hold)는 자리를 뜨지 않는다. */
    aiAct() {
      if (this.winner || this.duel) return null;
      const u = this.units.find(x => x.side === this.side && x.troops > 0 && !x.done); if (!u) return null;
      const foe = this.canDuel(u).filter(x => u.war >= x.war + DUEL.lead).sort((a, b) => a.war - b.war || (a.id < b.id ? -1 : 1))[0];
      if (foe) {
        if (this.human === foe.side) { this.dueled[u.side] = true; return { type: 'challenge', unit: u.id, target: foe.id }; }
        return this.takes(foe, u) ? this.duelAuto(u, foe) : this.refuseDuel(u, foe);
      }
      const g = this.grid, reach = u.hold ? new Map([[u.c + ',' + u.r, { c: u.c, r: u.r, cost: 0 }]]) : this.range(u), rec = { type: 'move', unit: u.id, from: [u.c, u.r], to: [u.c, u.r] };
      let best = null;
      for (const v of reach.values()) for (const t of this.foesNear(u, v.c, v.r)) {
        const dmg = Math.min(t.troops, this.damage(u, t)), score = dmg + (dmg >= t.troops ? 500 : 0) + this.terrain(v.c, v.r).def * 1000 - v.cost;
        if (!best || score > best.score) best = { score, v, t, dmg };
      }
      if (u.int >= FIRE.aiInt) {                                   // 화계: 옆 칸에 선 적 가운데 병력이 가장 많은 부대. 기대 피해가 칼보다 크면 불을 놓는다
        const spot = this.canIgnite(u).map(([c, r]) => ({ c, r, t: this.unitAt(c, r) })).filter(x => x.t && x.t.side !== u.side).sort((a, b) => b.t.troops - a.t.troops || a.c - b.c || a.r - b.r)[0];
        if (spot && this.fireChance(u) * Math.ceil(spot.t.troops * this.B.fire / 100) > (best ? best.dmg : 0)) return { ...rec, ...this.ignite(u, spot.c, spot.r) };
      }
      if (best) { if (best.v.c !== u.c || best.v.r !== u.r) this.move(u, best.v.c, best.v.r); rec.to = [u.c, u.r]; const a = this.attack(u, best.t); return { ...rec, ...a, type: 'attack' }; }
      if (!u.hold) {
        const foes = this.alive(u.side === 'att' ? 'def' : 'att'), near = foes.map(f => ({ f, d: g.distance(u.c, u.r, f.c, f.r) })).sort((a, b) => a.d - b.d)[0];
        const [cc, cr] = this.castle; let goal = null;
        if (u.side === 'att' && reach.has(cc + ',' + cr) && !this.unitAt(cc, cr)) goal = [cc, cr];
        else if (near && (u.side === 'att' || near.d <= this.B.engage)) goal = [near.f.c, near.f.r];
        if (goal) {
          const here = g.distance(u.c, u.r, goal[0], goal[1]); let pick = null;
          for (const v of reach.values()) { const d = g.distance(v.c, v.r, goal[0], goal[1]), s = d * 10 + v.cost - this.terrain(v.c, v.r).def * 5; if (d < here && (!pick || s < pick.s)) pick = { s, v }; }
          if (pick) { this.move(u, pick.v.c, pick.v.r); rec.to = [u.c, u.r]; }
        }
      }
      u.done = true; return rec;
    }
    /** AI끼리 끝까지 싸운다(일기토도 모두 AI가 싸운다). @returns result() */
    auto() { this.human = null; if (this.duel) { while (this.duel) this.duelRound(this.duelMove(0), this.duelMove(1)); } for (let n = 0; !this.winner && n < 5000; n++) if (!this.aiAct()) this.endSide(); if (!this.winner) this.finish('def', '끝이 나지 않았다'); return this.result(); }
  }

  DH.Sam = Object.assign(DH.Sam || {}, { Battle, TERRAIN, BATTLE, FIRE, DUEL, MOVES, MOVE_NAME, HITS, WIND, makeMap });
})(typeof globalThis !== 'undefined' ? globalThis : this);
