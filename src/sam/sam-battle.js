/* 동현삼 · 전투 규칙 — 10×10 육각 전장에서 부대를 움직여 싸운다. 화면을 모른다(node에서 그대로 돈다).
 *
 *   지형      평지: 이동 1, 방어 0 · 산: 이동 3, 방어 0.3 · 강: 이동 4, 방어 0 · 성: 이동 1, 방어 0.4
 *   이동력    부대마다 하루 5. 적 부대는 지나갈 수 없고, 아군은 지나가되 겹쳐 설 수 없다.
 *   공격      바로 옆 칸의 적을 친다. 한 부대는 하루에 한 번 움직이고 한 번 친다(치면 그날은 끝).
 *   피해      (공격 부대 병력 × 장수 무력 ÷ 100) × (1 − 맞는 쪽이 선 지형의 방어 보정). 소수점은 버린다.
 *   하루      공격 측이 모두 움직이고, 이어서 수비 측이 움직인다.
 *   승패      한쪽이 모두 쓰러지면 진다 · 공격 측이 자기 차례를 마칠 때 성에 서 있으면 이긴다 ·
 *             20일이 지나면 수비 측이 이긴다 · 물러나면 진다.
 * 전장은 주 번호(seed)로 만든다. 같은 주는 언제나 같은 전장이다. */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};
  const TERRAIN = {
    plain: { name: '평지', cost: 1, def: 0 }, mountain: { name: '산', cost: 3, def: 0.3 },
    river: { name: '강', cost: 4, def: 0 }, castle: { name: '성', cost: 1, def: 0.4 }
  };
  const BATTLE = { cols: 10, rows: 10, hex: 22, mp: 5, days: 20, engage: 5 };

  /** 전장 만들기. 왼쪽 두 줄과 오른쪽 두 줄은 평지로 둔다(양쪽이 서는 자리). 성은 오른쪽. */
  function makeMap(seed) {
    const B = BATTLE, rng = new DH.RNG((seed >>> 0) * 7919 + 13), t = Array.from({ length: B.rows }, () => Array(B.cols).fill('plain'));
    if (rng.next() < 0.7) {                                    // 강: 위에서 아래로 끊기지 않게 흐른다
      let c = 4 + rng.int(2);
      for (let r = 0; r < B.rows; r++) { t[r][c] = 'river'; const pick = r & 1 ? [c, c + 1] : [c - 1, c], ok = pick.filter(x => x >= 3 && x <= 6); c = ok[rng.int(ok.length)]; }
    }
    const grid = new DH.HexGrid(B.cols, B.rows, B.hex);
    for (let i = 0; i < 4; i++) {                              // 산: 네 덩이
      const c = 2 + rng.int(6), r = rng.int(B.rows), n = 1 + rng.int(3);
      if (t[r][c] === 'plain') t[r][c] = 'mountain';
      const nb = grid.neighbors(c, r).filter(([x]) => x >= 2 && x <= 7);
      for (let k = 0; k < n && nb.length; k++) { const [x, y] = nb.splice(rng.int(nb.length), 1)[0]; if (t[y][x] === 'plain') t[y][x] = 'mountain'; }
    }
    const castle = [8, 4 + rng.int(2)]; t[castle[1]][castle[0]] = 'castle';
    return { tiles: t, castle };
  }

  class Battle {
    /** @param {{seed:number, province:{id:number,name:string}, att:Side, def:Side}} o
     *  Side = {faction, name, color, units:[{officer:number|null, name, war, troops}]} (부대는 셋까지)
     *  o.rules = {mp, days, engage, terrain}를 주면 그 값으로 싸운다(동현랭 설정). 없으면 이 파일의 BATTLE · TERRAIN. */
    constructor(o) {
      const B = BATTLE, m = makeMap(o.seed), R = o.rules || {};
      this.B = { mp: R.mp ?? B.mp, days: R.days ?? B.days, engage: R.engage ?? B.engage }; this.T = R.terrain || TERRAIN;
      this.province = o.province; this.sides = { att: { ...o.att }, def: { ...o.def } };
      this.grid = new DH.HexGrid(B.cols, B.rows, B.hex); this.tiles = m.tiles; this.castle = m.castle;
      const [cc, cr] = m.castle, spot = { att: [[1, 4], [0, 2], [0, 7]], def: [[cc, cr], [8, cr - 2], [8, cr + 2]] };
      this.units = [];
      for (const side of ['att', 'def']) o[side].units.slice(0, 3).forEach((u, i) => this.units.push({ id: side + i, side, officer: u.officer, name: u.name, war: u.war, troops: u.troops, start: u.troops, c: spot[side][i][0], r: spot[side][i][1], moved: false, done: false, hold: side === 'def' && i === 0 }));
      this.side = 'att'; this.day = 1; this.winner = null; this.reason = ''; this.log = [];
    }
    at(c, r) { return this.tiles[r][c]; }
    terrain(c, r) { return this.T[this.tiles[r][c]]; }
    unitAt(c, r) { return this.units.find(u => u.troops > 0 && u.c === c && u.r === r) || null; }
    alive(side) { return this.units.filter(u => u.side === side && u.troops > 0); }
    total(side) { return this.alive(side).reduce((s, u) => s + u.troops, 0); }
    /** 이 부대가 지금 갈 수 있는 칸. Map<'c,r',{c,r,cost,from}>. 설 수 없는 칸(아군이 선 칸)은 뺀다. 제자리는 들어 있다. */
    range(u) {
      const mp = u.done || u.moved || u.troops <= 0 ? 0 : this.B.mp;
      const all = DH.moveRange(this.grid, [u.c, u.r], mp, (c, r) => { const x = this.unitAt(c, r); return x && x.side !== u.side ? Infinity : this.terrain(c, r).cost; });
      for (const [k, v] of all) { const x = this.unitAt(v.c, v.r); if (x && x !== u) all.delete(k); }
      return all;
    }
    /** (c,r)에 선다면 칠 수 있는 적 */
    foesNear(u, c = u.c, r = u.r) { return this.grid.neighbors(c, r).map(([x, y]) => this.unitAt(x, y)).filter(x => x && x.side !== u.side); }
    targets(u) { return u.done || u.troops <= 0 || u.side !== this.side || this.winner ? [] : this.foesNear(u); }
    /** 피해 = (공격 부대 병력 × 무력 ÷ 100) × (1 − 맞는 쪽 지형의 방어 보정). 소수점은 버린다.
     *  0.7 같은 수는 컴퓨터 안에서 딱 떨어지지 않아(100 × 90 ÷ 100 × 0.7이 62.99…가 된다) 정수로 바꿔 셈한다. 식은 같다. */
    damage(u, t) { return Math.floor(u.troops * u.war * (100 - Math.round(this.terrain(t.c, t.r).def * 100)) / 10000); }

    move(u, c, r) {
      if (this.winner || u.side !== this.side || u.done || u.moved) return false;
      const k = c + ',' + r; if (!this.range(u).has(k) || (u.c === c && u.r === r)) return false;
      u.c = c; u.r = r; u.moved = true; return true;
    }
    attack(u, t) {
      if (!this.targets(u).includes(t)) return null;
      const dmg = Math.min(t.troops, this.damage(u, t)); t.troops -= dmg; u.done = true;
      const rec = { type: 'attack', unit: u.id, target: t.id, damage: dmg, left: t.troops, text: `${u.name} 부대가 ${t.name} 부대를 쳤다 · 피해 ${dmg.toLocaleString('ko-KR')}${t.troops ? '' : ' · 무너졌다'}` };
      this.log.push(rec.text);
      if (!this.alive(t.side).length) this.finish(u.side, t.side === 'def' ? '수비 부대가 모두 무너졌다' : '공격 부대가 모두 무너졌다');
      return rec;
    }
    wait(u) { if (u.side === this.side && !this.winner) u.done = true; }
    /** 지금 쪽의 차례를 마친다. 수비 측까지 마치면 하루가 간다. */
    endSide() {
      if (this.winner) return;
      if (this.side === 'att') {
        const [cc, cr] = this.castle, x = this.unitAt(cc, cr);
        if (x && x.side === 'att') return this.finish('att', '성을 차지했다');
        this.side = 'def';
      } else {
        if (this.day >= this.B.days) return this.finish('def', `${this.B.days}일을 버텼다`);
        this.day++; this.side = 'att';
      }
      for (const u of this.units) if (u.side === this.side) { u.moved = false; u.done = false; }
    }
    retreat(side) { if (!this.winner) this.finish(side === 'att' ? 'def' : 'att', side === 'att' ? '공격 측이 물러났다' : '수비 측이 성을 버렸다'); }
    finish(winner, reason) { this.winner = winner; this.reason = reason; this.log.push(reason); }
    result() { return { winner: this.winner, reason: this.reason, days: this.day, attTroops: this.total('att'), defTroops: this.total('def') }; }

    /** 지금 쪽의 부대 하나를 AI가 움직인다. 움직일 부대가 없으면 null(그러면 endSide를 부른다).
     *  ① 닿는 칸에서 칠 수 있으면 가장 큰 피해를 주는 자리로 가서 친다(방어 좋은 칸을 조금 더 친다).
     *  ② 못 치면: 공격 측은 빈 성이 닿으면 성으로, 아니면 가장 가까운 적 쪽으로. 수비 측은 적이 5칸 안에 오면 맞으러 간다.
     *  성을 지키는 부대(hold)는 자리를 뜨지 않는다. */
    aiAct() {
      if (this.winner) return null;
      const u = this.units.find(x => x.side === this.side && x.troops > 0 && !x.done); if (!u) return null;
      const g = this.grid, reach = u.hold ? new Map([[u.c + ',' + u.r, { c: u.c, r: u.r, cost: 0 }]]) : this.range(u), rec = { type: 'move', unit: u.id, from: [u.c, u.r], to: [u.c, u.r] };
      let best = null;
      for (const v of reach.values()) for (const t of this.foesNear(u, v.c, v.r)) {
        const dmg = Math.min(t.troops, this.damage(u, t)), score = dmg + (dmg >= t.troops ? 500 : 0) + this.terrain(v.c, v.r).def * 1000 - v.cost;
        if (!best || score > best.score) best = { score, v, t };
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
    /** AI끼리 끝까지 싸운다. @returns result() */
    auto() { for (let n = 0; !this.winner && n < 5000; n++) if (!this.aiAct()) this.endSide(); if (!this.winner) this.finish('def', '끝이 나지 않았다'); return this.result(); }
  }

  DH.Sam = Object.assign(DH.Sam || {}, { Battle, TERRAIN, BATTLE, makeMap });
})(typeof globalThis !== 'undefined' ? globalThis : this);
