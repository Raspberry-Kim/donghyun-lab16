/* 동현삼 · 전투 장면 — sam-battle.js의 전투를 캔버스에 그리고 손으로 싸운다. 지도 장면 위에 얹는다(engine.pushScene).
 *   우리 부대를 찍는다 → 갈 수 있는 칸이 노랗게 → 칸을 찍어 옮긴다 → 붉은 테의 적을 찍어 친다.
 *   옮긴 뒤 칠 적이 없으면 그 부대는 그날 일을 마친다. 모두 마치면 차례가 저절로 넘어간다.
 *   조작 창: 대기 · 차례 넘기기 · 맡기기(남은 싸움을 AI에게) · 퇴각(한 번 더 묻는다) · 일기토 · 화계.
 *   일기토: 장수가 이끄는 부대를 고르고 옆 칸의 적 장수에게 청한다. 받아 주면 두 장수가 마주 서고, 합마다 공격 · 강공 · 방어 · 급소 가운데 하나를 낸다.
 *           적이 우리 장수에게 청해 오면 받을지 피할지 묻는다. 맡기기를 누른 뒤에는 장수들이 알아서 받고 싸운다.
 *   화계: 부대를 고르고 옆 칸에 불을 놓는다. 불 칸은 주황빛으로 타오르고, 날이 바뀔 때 바람 쪽으로 번진다. 비가 오면 꺼진다(위 띠의 날씨).
 *   그림: 부대는 말 탄 장수와 이름패, 지형은 산 · 숲 · 물결 · 성의 픽셀 그림이다(sam-art.js). 그림은 판의 값에 닿지 않는다.
 * 키보드: 방향키 칸 커서 · Enter 커서가 놓인 칸 찍기(손으로 찍는 것과 같다) · Space 아직 일을 마치지 않은 다음 우리 부대 ·
 *   숫자 키 조작 창의 버튼 · Esc 고른 부대 놓기. 결과 카드와 퇴각을 되묻는 창에서는 Enter가 노란 버튼을 누른다.
 * 끝나면 결과 카드를 보이고, 지도로 돌아가면서 onDone(result)를 부른다. 소유권은 지도 쪽(Game.settle)이 옮긴다. */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};
  const FONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  const fmt = n => Number(n).toLocaleString('ko-KR');
  /** 전장 색: 들은 두 가지 풀빛을 엇갈려 깔고(픽셀 지도의 결), 강은 큰 지도의 바다와 같은 물빛이다. */
  const STYLE = { plain: { fill: '#d6dbb0' }, plain2: { fill: '#cfd5a7' }, mountain: { fill: '#bba987' }, river: { fill: '#9fc4d9' }, castle: { fill: '#e6d6ae' }, forest: { fill: '#bccf94' } };
  const VIOLET = '#6a4c93', FLAME = '#f08a1d';
  const J = (w, a, b) => DH.josa(w, a, b);
  /** 이웃 칸이 어느 쪽인지(화살표). 화면에서 본 방향이다. */
  const arrowOf = (dx, dy) => { const a = Math.atan2(-dy, dx) * 180 / Math.PI; return a > -30 && a <= 30 ? '→' : a > 30 && a <= 90 ? '↗' : a > 90 && a <= 150 ? '↖' : a > 150 || a <= -150 ? '←' : a > -150 && a <= -90 ? '↙' : '↘'; };
  const BG = '#efe6d2', INK = '#26211c', ACCENT = '#f2b705', RED = '#c0321f', STEP = 18, FX = 54;
  /** 바탕색 위에 얹을 글자색(밝으면 먹, 어두우면 흰) */
  const textOn = hex => { const n = parseInt(hex.slice(1), 16), l = (0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)); return l > 150 ? INK : '#fff'; };
  const SIDE = { att: '공격', def: '수비' };
  const ARROW = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const digit = code => { const m = /^(?:Digit|Numpad)([1-9])$/.exec(code); return m ? Number(m[1]) : 0; };

  class SamBattleScene extends DH.MapScene {
    /** @param {{side:'att'|'def', onDone:(result)=>void}} o side는 사람이 맡는 쪽 */
    constructor(engine, layout, battle, o) {
      super(engine); this.layout = layout; this.b = battle; this.me = o.side; this.onDone = o.onDone;
      this.sel = null; this.reach = new Map(); this.look = null; this.fx = []; this.wait = 30; this.idle = 0; this.auto = false; this.ask = false; this.mode = 'fight'; this.res = null;
      this.cur = null; this.curX = 0;                // 키보드 커서 칸과, 위아래로 갈 때 지키는 가로 자리. 키를 쓰기 전에는 보이지 않는다
      this.pick = null;                              // 'duel' 일기토 상대를 고르는 중 · 'fire' 불 놓을 칸을 고르는 중
      this.dare = null;                              // 적이 우리 장수에게 청한 일기토 {u, t}. 받을지 피할지 묻는 중
      this.dv = null;                                // 일기토 장면 {me:0|1, names, wars, cols, hp, last, t0, end, endAt}
      this.rainy = false;
      battle.human = o.side;                         // 이쪽 장수에게 청하는 일기토는 손으로 답한다
    }
    enter() {
      const b = this.b;
      this.setupMap({ grid: b.grid, tileAt: (c, r) => { const k = b.at(c, r); return k === 'plain' && (c + (r >> 1)) % 3 === 0 ? 'plain2' : k; }, styles: STYLE, line: 'rgba(38,33,28,.2)', minZoom: 1, maxZoom: 1 });
      this.layout.log(`${b.province.name} 전투가 벌어졌다 · ${b.sides.att.name} ${fmt(b.total('att'))} 대 ${b.sides.def.name} ${fmt(b.total('def'))}`);
      this.refresh();
    }
    onDrag() {} onWheel() {}                       // 전장은 한 화면에 다 들어온다
    onKey(code, ev) {
      if (ev && (ev.ctrlKey || ev.metaKey || ev.altKey)) return;
      const d = ARROW[code], n = digit(code), used = () => { if (ev) ev.preventDefault(); };
      if (this.dv || this.dare) {                                  // 일기토 중에는 숫자 키와 Enter만 듣는다
        if (ev && ev.repeat) return;
        if (n) { used(); this.layout.press(n); } else if (code === 'Enter' || code === 'NumpadEnter') { used(); if (!this.dv || !this.dv.end || this.engine.tick - this.dv.endAt > 20) this.layout.pressPrimary(); }
        return;
      }
      if (code === 'Escape') { if (this.pick) this.pick = null; else this.select(null); this.ask = false; return this.refresh(); }
      if (d) { used(); return this.moveCursor(d); }
      if (ev && ev.repeat) return;                                 // 누르고 있어도 한 번만 누른 것으로 친다
      if (n) { used(); this.layout.press(n); }
      else if (code === 'Enter' || code === 'NumpadEnter') {
        used();
        if (this.mode === 'result') { if (this.engine.tick - this.doneAt > 30) this.command('back'); }
        else if (this.ask) this.layout.pressPrimary();
        else if (!this.cur) this.nextUnit(1);                      // 커서가 아직 없으면 우리 부대부터 잡는다
        else if (this.myTurn) this.tapCell(this.cur);
      }
      else if (code === 'Space') { used(); this.nextUnit(ev && ev.shiftKey ? -1 : 1); }
    }
    /** 커서를 한 칸 옮긴다. 위아래는 엇갈린 줄에서 가로 자리가 가장 가까운 칸으로 간다. */
    moveCursor(d) {
      const g = this.grid, b = this.b;
      if (!this.cur) { const u = this.sel || b.alive(this.me).find(x => !x.done) || b.alive(this.me)[0]; this.cur = u ? { c: u.c, r: u.r } : { c: g.cols >> 1, r: g.rows >> 1 }; this.curX = g.center(this.cur.c, this.cur.r).x; return this.peek(); }
      let { c, r } = this.cur;
      if (d[0]) { c = Math.min(g.cols - 1, Math.max(0, c + d[0])); this.curX = g.center(c, r).x; }
      else {
        const nr = r + d[1]; if (nr < 0 || nr >= g.rows) return;
        const opts = (r & 1 ? [c, c + 1] : [c - 1, c]).filter(x => x >= 0 && x < g.cols);
        c = opts.sort((a, z) => Math.abs(g.center(a, nr).x - this.curX) - Math.abs(g.center(z, nr).x - this.curX))[0]; r = nr;
      }
      this.cur = { c, r }; this.peek();
    }
    /** 커서가 놓인 칸의 사정을 정보 창에 보인다(고른 부대가 없을 때). */
    peek() { if (!this.sel && this.mode === 'fight') this.look = this.cur; this.refresh(); }
    /** Space: 아직 일을 마치지 않은 우리 부대를 차례로 고르고 커서를 그리로 옮긴다. */
    nextUnit(dir = 1) {
      if (!this.myTurn) return;
      const list = this.b.alive(this.me).filter(u => !u.done); if (!list.length) return;
      const i = list.indexOf(this.sel), u = list[i < 0 ? (dir > 0 ? 0 : list.length - 1) : (i + dir + list.length) % list.length];
      this.ask = false; this.pick = null; this.select(u); this.cur = { c: u.c, r: u.r }; this.curX = this.grid.center(u.c, u.r).x; this.sfx('tick'); this.refresh();
    }
    get myTurn() { return this.mode === 'fight' && !this.auto && !this.b.winner && this.b.side === this.me && !this.dv && !this.dare; }

    select(u) { this.sel = u; this.reach = u ? this.b.range(u) : new Map(); this.look = null; if (!u) this.pick = null; }
    /** 한 일을 화면에 남긴다: 떠오르는 피해 숫자 · 지나온 자취 · 기록 */
    show(rec) {
      if (!rec) return;
      const g = this.grid, t = this.engine.tick;
      if (rec.from && rec.to && (rec.from[0] !== rec.to[0] || rec.from[1] !== rec.to[1])) this.fx.push({ kind: 'trail', a: g.center(rec.from[0], rec.from[1]), b: g.center(rec.to[0], rec.to[1]), t0: t });
      const unit = id => this.b.units.find(u => u.id === id), hit = (u, n) => { if (!u || !n) return; const p = g.center(u.c, u.r); this.fx.push({ kind: 'hit', x: p.x, y: p.y, text: '−' + fmt(n), t0: t }); };
      if (rec.type === 'fire') {                                   // 화계: 불꽃이 솟고, 그 칸에 선 부대가 병력을 잃는다
        const p = g.center(rec.cell[0], rec.cell[1]); this.fx.push({ kind: 'burst', x: p.x, y: p.y, ok: rec.ok, t0: t });
        if (rec.ok) hit(unit(rec.target), rec.damage);
        this.layout.log(rec.text); this.sfx(rec.ok ? 'explode' : 'buzz'); const x = unit(rec.target); if (rec.ok && x && !x.troops) this.sfx('fall', 0.35);
      }
      else if (rec.type === 'refuse') { hit(unit(rec.target), rec.lost); this.layout.log(rec.text); this.sfx('swish'); }
      else if (rec.type === 'duel') { hit(unit(rec.loser), rec.lost); this.layout.log(rec.text); this.sfx('clash'); if (rec.caught != null) this.sfx('fall', 0.35); }
      else if (rec.type === 'attack' && rec.target) { const x = this.b.units.find(u => u.id === rec.target), p = g.center(x.c, x.r); this.fx.push({ kind: 'hit', x: p.x, y: p.y, text: '−' + fmt(rec.damage), t0: t }); this.layout.log(rec.text); this.sfx('clash'); if (!rec.left) this.sfx('fall', 0.35); }
      else if (rec.from && rec.to && (rec.from[0] !== rec.to[0] || rec.from[1] !== rec.to[1])) this.sfx('horse');
    }
    endSide() {
      const b = this.b; b.endSide(); this.sel = null; this.reach = new Map(); this.ask = false; this.pick = null; this.idle = 0; this.wait = STEP;
      for (const n of b.news) this.layout.log(n);                  // 날이 바뀌며 난 일: 불길 · 번짐 · 비
      if (b.news.some(n => n.includes('불길'))) this.sfx('explode');
      if (b.rain !== this.rainy) { this.rainy = b.rain; if (b.rain && !b.winner) { this.layout.log(`${b.day}일째 · 비가 내린다. 비가 그칠 때까지 불을 놓을 수 없다`); this.sfx('rows'); } }
      if (b.winner) return this.finish();
      this.layout.log(`${b.day}일째 · ${SIDE[b.side]} 측(${b.sides[b.side].name}) 차례`); this.refresh();
    }
    finish() {
      if (this.mode === 'result') return;
      this.mode = 'result'; this.res = this.b.result(); this.doneAt = this.engine.tick; this.sel = null; this.reach = new Map();
      this.layout.log(`${this.b.province.name} 전투가 끝났다 · ${this.res.reason}`); this.sfx(this.res.winner === this.me ? 'win' : 'lose', 0.4); this.refresh();
    }

    update() {
      const b = this.b, t = this.engine.tick;
      if (this.fx.length) this.fx = this.fx.filter(f => t - f.t0 < FX);
      if (this.mode !== 'fight' || this.dv || this.dare) return;   // 일기토 중에는 전장이 멈춘다
      if (b.winner) return this.finish();
      if (this.myTurn) {                                           // 우리 부대가 모두 일을 마치면 차례를 넘긴다
        if (b.alive(this.me).some(u => !u.done)) this.idle = 0; else if (++this.idle > 24) this.endSide();
        return;
      }
      if (--this.wait > 0) return;
      const rec = b.aiAct();
      if (!rec) return this.endSide();
      if (rec.type === 'challenge') {                              // 적이 우리 장수에게 일기토를 청했다: 받을지 피할지 묻는다
        const u = b.units.find(x => x.id === rec.unit), x = b.units.find(y => y.id === rec.target);
        this.dare = { u, t: x }; this.select(null); this.layout.log(`${J(u.name, '이', '가')} ${x.name}에게 일기토를 청했다`); this.sfx('alert'); return this.refresh();
      }
      this.show(rec); this.wait = STEP;
      if (b.winner) this.finish(); else this.refresh();
    }

    onTap(x, y) {
      const b = this.b;
      if (this.mode === 'result') { if (this.engine.tick - this.doneAt > 30) this.command('back'); return; }      // 싸우던 손이 그대로 카드를 넘기지 않게 반 초 둔다
      if (this.dv) { if (this.dv.end && this.engine.tick - this.dv.endAt > 20) this.command('dok'); return; }
      if (!this.myTurn) return;
      this.cur = null;                                             // 손으로 찍으면 키보드 커서는 숨는다
      this.tapCell(this.cellAt(x, y));
    }
    /** 칸 하나를 찍는다(손가락 · 마우스 · 키보드 Enter가 같이 쓴다). */
    tapCell(cell) {
      const b = this.b; this.ask = false;
      if (!cell) { this.select(null); return this.refresh(); }
      const u = b.unitAt(cell.c, cell.r), s = this.sel, k = cell.c + ',' + cell.r, pick = this.pick; this.pick = null;
      if (pick === 'fire' && s && b.canIgnite(s).some(([c, r]) => c === cell.c && r === cell.r)) return this.command('ft:' + k);
      if (pick === 'duel' && s && u && b.canDuel(s).includes(u)) return this.command('dt:' + u.id);
      if (s && u && u.side !== this.me && b.targets(s).includes(u)) { this.show(b.attack(s, u)); this.select(null); }
      else if (s && !u && this.reach.has(k)) {
        const from = [s.c, s.r]; b.move(s, cell.c, cell.r); this.show({ type: 'move', from, to: [s.c, s.r] });
        if (b.targets(s).length) this.select(s); else { b.wait(s); this.select(null); }      // 칠 적이 없으면 그날 일을 마친다
      }
      else if (u && u.side === this.me && !u.done && u !== s) { this.select(u); this.sfx('tick'); }
      else { this.select(null); this.look = cell; }
      if (b.winner) this.finish(); else this.refresh();
    }
    command(id) {
      const b = this.b;
      if (id === 'back') { if (this.mode !== 'result') return; this.engine.popScene(); return this.onDone(this.res); }
      const [key, arg] = id.split(':');
      if (this.dare) {                                             // 청해 온 일기토에 답한다
        const { u, t } = this.dare;
        if (id === 'dy') { this.dare = null; b.beginDuel(u, t); return this.openDuel(1); }
        if (id === 'dn') { this.dare = null; this.show(b.refuseDuel(u, t)); this.wait = STEP; if (b.winner) return this.finish(); }
        return this.refresh();
      }
      if (this.dv) {
        if (key === 'dm' && arg === 'auto') return this.duelRest();
        if (key === 'dm') return this.duelStep(arg);
        if (id === 'dok' && this.dv.end) { this.dv = null; this.wait = STEP; if (b.winner) return this.finish(); }
        return this.refresh();
      }
      if (!this.myTurn) return;
      const s = this.sel;
      if (id === 'wait' && s) { b.wait(s); this.select(null); }
      else if (id === 'end') return this.endSide();
      else if (id === 'auto') { this.auto = true; b.human = null; this.select(null); this.wait = 6; this.layout.log('남은 싸움을 장수들에게 맡겼다'); }
      else if (id === 'cancel') this.pick = null;
      else if (id === 'duel' && s && b.canDuel(s).length) { this.pick = 'duel'; this.ask = false; }
      else if (id === 'fire' && s && b.canIgnite(s).length) { this.pick = 'fire'; this.ask = false; }
      else if (key === 'dt' && s) {                                // 일기토를 청한다. 상대가 피하면 그 부대의 병사가 흩어지고, 우리 부대는 그날 일을 더 할 수 있다
        const x = b.units.find(y => y.id === arg), rec = x && b.challenge(s, x); this.pick = null;
        if (rec && rec.type === 'duel-start') return this.openDuel(0);
        if (rec) { this.show(rec); this.select(s); if (b.winner) return this.finish(); }
      }
      else if (key === 'ft' && s) { const [c, r] = arg.split(',').map(Number), rec = b.ignite(s, c, r); this.pick = null; if (rec) { this.show(rec); this.select(null); if (b.winner) return this.finish(); } }
      else if (id === 'retreat') { this.ask = true; this.pick = null; }
      else if (id === 'no') this.ask = false;
      else if (id === 'yes') { b.retreat(this.me); return this.finish(); }
      this.refresh();
    }

    // ───────── 일기토 ─────────
    /** 일기토 장면을 연다. me: 사람이 0 청한 쪽 · 1 받은 쪽 */
    openDuel(me) {
      const b = this.b, D = b.duel;
      this.dv = { me, names: [D.a.name, D.d.name], wars: [D.a.war, D.d.war], cols: [b.sides[D.a.side].color, b.sides[D.d.side].color], hp: [...D.hp], max: D.max, round: 0, last: null, t0: this.engine.tick, end: null, endAt: 0 };
      this.select(null); this.ask = false; this.layout.log(`${J(D.a.name, '과', '와')} ${D.d.name}의 일기토가 벌어졌다`); this.sfx('drum'); this.refresh();
    }
    /** 한 합을 겨룬다. 상대의 수는 판의 난수로 정한다. */
    duelStep(move) {
      const b = this.b, v = this.dv; if (!v || v.end || !b.duel || !DH.Sam.MOVE_NAME[move]) return;
      const other = b.duelMove(1 - v.me); this.duelShow(v.me === 0 ? b.duelRound(move, other) : b.duelRound(other, move)); this.refresh();
    }
    /** 남은 합을 장수에게 맡긴다. */
    duelRest() { const b = this.b, v = this.dv; if (!v || v.end) return; while (b.duel) this.duelShow(b.duelRound(b.duelMove(0), b.duelMove(1))); this.refresh(); }
    duelShow(rec) {
      const v = this.dv, t = this.engine.tick; if (!rec) return;
      v.last = rec; v.hp = rec.hp; v.round = rec.round; v.t0 = t; this.layout.log(rec.text); this.sfx('clash');
      if (rec.done) { v.end = rec.end; v.endAt = t; this.layout.log(rec.end.text); this.sfx(rec.end.winner < 0 ? 'tick' : rec.end.winner === v.me ? 'cheer' : 'fall', 0.4); }
    }

    refresh() {
      const b = this.b, L = this.layout, A = b.sides.att, D = b.sides.def, s = this.sel, T = b.T, max = b.B.days, MN = DH.Sam.MOVE_NAME;
      L.setInfo([{ label: '전장', value: b.province.name }, { label: '날', value: `${b.day}/${max}일` }, { label: '차례', value: this.mode === 'result' ? '끝' : `${SIDE[b.side]} 측` },
        { label: `공격 ${A.name}`, value: fmt(b.total('att')) }, { label: `수비 ${D.name}`, value: fmt(b.total('def')) }, ...(b.B.fire > 0 ? [{ label: '날씨', value: b.rain ? '비' : `바람 ${b.windMark}` }] : [])]);
      const line = side => b.units.filter(u => u.side === side).map(u => `${u.name}(무${u.war}) ${u.troops ? fmt(u.troops) : '무너짐'}`).join(' · ');
      const rows = [[`공격 ${A.name}${this.me === 'att' ? ' · 우리' : ''}`, line('att')], [`수비 ${D.name}${this.me === 'def' ? ' · 우리' : ''}`, line('def')]];
      const land = (c, r) => { const t = b.terrain(c, r); return `${t.name} · 이동 ${t.cost} · 방어 ${Math.round(t.def * 100)}%` + (b.burning(c, r) ? ' · 불타는 중' : ''); };
      const pct = x => Math.round(x * 100);
      let note;
      if (this.dv) {
        const v = this.dv, r = v.last;
        rows.push(['일기토', `${v.round}/${v.max}합`], [`${v.names[0]}${v.me === 0 ? ' · 우리' : ''}`, `무력 ${v.wars[0]} · 기력 ${v.hp[0]}`], [`${v.names[1]}${v.me === 1 ? ' · 우리' : ''}`, `무력 ${v.wars[1]} · 기력 ${v.hp[1]}`]);
        if (r) rows.push(['지난 합', `${v.names[0]} ${MN[r.moves[0]]}(${r.hit[0]}) · ${v.names[1]} ${MN[r.moves[1]]}(${r.hit[1]})`]);
        note = v.end ? v.end.text + '.' : '수를 하나 고른다. 공격은 고르게 들어간다. 강공은 크게 들어가지만(1.5배) 급소에는 헛친다. 방어는 공격과 급소를 막고 받아치지만 강공에 깨진다. 급소는 강공의 빈틈을 찌른다(1.4배).';
      } else if (this.dare) {
        const { u, t } = this.dare;
        rows.push(['청한 장수', `${SIDE[u.side]} 측 ${u.name} · 무력 ${u.war}`], ['우리 장수', `${t.name} · 무력 ${t.war} · 병력 ${fmt(t.troops)}`]);
        note = `${J(u.name, '이', '가')} 일기토를 청했다. 받아서 지면 병력의 절반을 잃고 장수가 사로잡힌다${t.lord ? '(군주는 몸을 뺀다)' : ''}. 피하면 병사 ${fmt(Math.ceil(t.troops * DH.Sam.DUEL.refuse))}이 흩어진다.`;
      } else if (this.mode === 'result') {
        const won = this.res.winner === this.me; rows.push(['결과', `${won ? '이겼다' : '졌다'} · ${this.res.reason}`], ['남은 병력', `공격 ${fmt(this.res.attTroops)} · 수비 ${fmt(this.res.defTroops)}`]);
        note = '지도로 돌아가면 결과가 반영된다.';
      } else if (s) {
        const dr = b.drill[s.side], gen = s.general && b.B.general > 0, duel = b.canDuel(s), burn = b.canIgnite(s);
        rows.push(['고른 부대', `${s.name} · 무력 ${s.war} · 지력 ${s.int} · 병력 ${fmt(s.troops)}${s.general ? ' · 장군' : ''}`], ['선 자리', land(s.c, s.r)]);
        for (const t of b.targets(s)) rows.push([`${t.name} 치기`, `${fmt(s.troops)} × ${s.war} ÷ 100 × (1 − ${+b.defAt(t).toFixed(3)})${dr !== 50 ? ` × ${(150 + dr) / 200}` : ''}${gen ? ` × ${1 + b.B.general / 100}` : ''} = ${fmt(Math.min(t.troops, b.damage(s, t)))}`]);
        if (duel.length) rows.push(['일기토', duel.map(t => `${t.name}(무력 ${t.war})`).join(' · ') + ` · 우리 ${s.war}`]);
        if (burn.length) rows.push(['화계', `성공 ${pct(b.fireChance(s))}% · 불 칸의 부대는 병력의 ${b.B.fire}%를 잃는다`]);
        note = this.pick === 'fire' ? `불을 놓을 칸을 고른다(주황 테). 불은 ${DH.Sam.FIRE.days}일(숲은 ${DH.Sam.FIRE.forestDays}일) 타고 날이 바뀔 때 바람(${b.windMark}) 쪽으로 번진다. 불타는 칸은 지나갈 수 없다. 되든 안 되든 그날 일을 마친다.`
          : this.pick === 'duel' ? '일기토를 청할 적 장수를 고른다(보라 테). 이기면 그 부대의 병력 절반이 흩어지고 장수를 사로잡는다. 지면 우리가 그렇게 된다. 상대가 피하면 그 부대의 병사 5%가 흩어진다. 한 전투에 한 번만 청할 수 있다.'
          : s.moved ? '붉은 테의 적을 찍으면 친다. 치지 않으려면 대기를 누른다.' : '노란 칸을 찍으면 옮긴다. 붉은 테의 적은 바로 칠 수 있다.';
      } else if (this.look) {
        const u = b.unitAt(this.look.c, this.look.r); rows.push(['찍은 칸', land(this.look.c, this.look.r)]);
        if (u) rows.push(['그 부대', `${SIDE[u.side]} 측 ${u.name} · 무력 ${u.war} · 병력 ${fmt(u.troops)}`]);
        note = '우리 부대를 찍으면 갈 수 있는 칸이 보인다.';
      } else note = this.auto ? '장수들이 알아서 싸우는 중이다.' : this.myTurn ? `우리 부대를 찍으면 갈 수 있는 칸이 보인다. 이동력은 하루 ${b.B.mp}이고 평지 ${T.plain.cost} · 산 ${T.mountain.cost} · 강 ${T.river.cost}가 든다.` : `${SIDE[b.side]} 측이 움직이는 중이다.`;
      if (this.me === 'att' && this.mode === 'fight' && !s && !this.look) note += ` 성에 올라선 채 차례를 마치거나 수비 부대를 모두 무너뜨리면 이긴다. ${max}일이 지나면 진다.`;
      if (this.me === 'def' && this.mode === 'fight' && !s && !this.look) note += ` ${max}일을 버티거나 공격 부대를 모두 무너뜨리면 이긴다. 성을 빼앗기면 진다.`;
      L.setDetail({ title: `${b.province.name} 전투`, rows, note });
      const off = !this.myTurn, go = id => this.command(id);
      if (this.dv) return L.setMenu(this.dv.end ? [{ id: 'dok', label: '전장으로 돌아가기', primary: true }] : [...DH.Sam.MOVES.map(m => ({ id: 'dm:' + m, label: MN[m] })), { id: 'dm:auto', label: '맡기기', hint: '남은 합을 장수가 알아서 겨룬다' }], go);
      if (this.dare) { const brave = this.dare.t.war + 5 >= this.dare.u.war; return L.setMenu([{ id: 'dy', label: '받는다', primary: brave }, { id: 'dn', label: '피한다', primary: !brave, hint: '병사의 5%가 흩어진다' }], go); }
      if (this.pick === 'duel' && s) return L.setMenu([...b.canDuel(s).map(t => ({ id: 'dt:' + t.id, label: `${t.name} 무력 ${t.war}` })), { id: 'cancel', label: '그만두기' }], go);
      if (this.pick === 'fire' && s) { const P0 = b.grid.center(s.c, s.r); return L.setMenu([...b.canIgnite(s).map(([c, r]) => { const q = b.grid.center(c, r), u = b.unitAt(c, r); return { id: `ft:${c},${r}`, label: `${arrowOf(q.x - P0.x, q.y - P0.y)} ${b.terrain(c, r).name}${u ? ' · ' + u.name : ''}` }; }), { id: 'cancel', label: '그만두기' }], go); }
      if (this.mode === 'result') L.setMenu([{ id: 'back', label: '지도로 돌아가기', primary: true }], id => this.command(id));
      else if (this.ask) L.setMenu([{ id: 'yes', label: '정말 물러난다', hint: '이 전투를 내준다' }, { id: 'no', label: '돌아가기', primary: true }], id => this.command(id));
      else L.setMenu([{ id: 'wait', label: '대기', disabled: off || !s, hint: '고른 부대가 그날 일을 마친다' }, { id: 'end', label: '차례 넘기기', primary: true, disabled: off },
        { id: 'auto', label: '맡기기', disabled: off, hint: '남은 싸움을 AI가 대신 싸운다' }, { id: 'retreat', label: '퇴각', disabled: off, hint: '전투를 내주고 물러난다' },
        { id: 'duel', label: '일기토', disabled: off || !s || !b.canDuel(s).length, hint: !(b.B.duel > 0) ? '이 판에는 일기토가 없다' : b.dueled[this.me] ? '이 전투에서 이미 청했다' : '장수가 이끄는 부대를 고르고 옆 칸의 적 장수에게 청한다' },
        { id: 'fire', label: '화계', disabled: off || !s || !b.canIgnite(s).length, hint: !(b.B.fire > 0) ? '이 판에는 화계가 없다' : b.rain ? '비가 와서 불을 놓을 수 없다' : '부대를 고르고 옆 칸에 불을 놓는다' }], id => this.command(id));
    }

    render(g) {
      g.fillStyle = BG; g.fillRect(0, 0, this.engine.width, this.engine.height);      // 아래 지도 장면을 가린다
      super.render(g);
      if (this.dv) this.drawDuel(g);
      else if (this.mode === 'result') this.drawCard(g);
    }
    drawOver(g) {
      const b = this.b, grid = this.grid, t = this.engine.tick, S = grid.size;
      // 지형 그림(픽셀 그림): 산 · 강 물결 · 성 · 들의 풀포기. 풀포기는 칸 번호로 정해 늘 같은 자리에 난다
      const A = DH.Sam.Art, defCol = b.sides.def.color;
      for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
        const k = b.at(c, r), p = grid.center(c, r), h = A.hash(c, r, b.province.id);
        if (k === 'mountain') A.draw(g, 'peak', p.x, p.y + 11, 2, A.FIELD);
        else if (k === 'river') { for (const [dx, dy] of [[-4, -8], [5, 1], [-3, 10]]) A.draw(g, 'ripple', p.x + dx, p.y + dy, 2, A.FIELD); }
        else if (k === 'forest') { A.draw(g, 'grove', p.x - 5, p.y + 1, 2, A.FIELD); A.draw(g, 'grove', p.x + 6, p.y + 13, 2, A.FIELD); }
        else if (k === 'castle') A.draw(g, 'fort', p.x, p.y + 11, 2, { ...A.castlePal(defCol), W: '#b9a888', w: '#8f7d5f', R: '#7b6a4f' });
        else if (h < 0.3) A.draw(g, 'tuft', p.x + (h * 60 - 9), p.y + 6 + (A.hash(r, c, 7) * 10 - 5), 2, A.FIELD);
      }
      // 불타는 칸: 주황빛 바닥과 일렁이는 불꽃
      const fires = [...b.fire.keys()].map(k => k.split(',').map(Number));
      if (fires.length) { g.beginPath(); for (const [c, r] of fires) grid.trace(g, c, r); g.fillStyle = `rgba(240,138,29,${(0.34 + 0.08 * Math.sin(t / 5)).toFixed(3)})`; g.fill(); }
      for (const [c, r] of fires) { const p = grid.center(c, r); A.draw(g, (Math.floor(t / 8) + c + r) % 2 ? 'flame' : 'flame2', p.x, p.y + 6, 2.2, A.FLAME); }
      // 갈 수 있는 칸 · 칠 수 있는 적
      const s = this.sel;
      if (s && this.myTurn) {
        g.beginPath(); for (const v of this.reach.values()) if (v.c !== s.c || v.r !== s.r) grid.trace(g, v.c, v.r);
        g.fillStyle = 'rgba(242,183,5,.42)'; g.fill(); g.strokeStyle = '#a77915'; g.lineWidth = 1.2; g.stroke();
      }
      // 자취
      for (const f of this.fx) if (f.kind === 'trail') { const a = 1 - (t - f.t0) / FX; g.beginPath(); g.moveTo(f.a.x, f.a.y); g.lineTo(f.b.x, f.b.y); g.strokeStyle = `rgba(38,33,28,${(0.5 * a).toFixed(3)})`; g.lineWidth = 3; g.setLineDash([5, 5]); g.stroke(); g.setLineDash([]); }
      // 부대: 말 탄 장수(장수 없는 부대는 창병 셋) + 이름과 병력을 적은 패. 공격 측은 오른쪽을, 수비 측은 왼쪽을 본다
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      for (const u of [...b.units].sort((a, z) => a.r - z.r || a.c - z.c)) {
        if (u.troops <= 0) continue;
        const p = grid.center(u.c, u.r), col = b.sides[u.side].color, w = 34, h = 17, x = p.x - w / 2, y = p.y - 1.5, dim = this.mode === 'fight' && u.side === b.side && u.done;
        g.globalAlpha = dim ? 0.62 : 1;
        if (u === s) { g.beginPath(); g.ellipse(p.x, p.y - 3, 15, 5, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(242,183,5,.75)'; g.fill(); }
        else { g.beginPath(); g.ellipse(p.x, p.y - 2.5, 12, 3.5, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(38,33,28,.22)'; g.fill(); }
        A.draw(g, u.officer == null ? 'foot' : 'rider', p.x, p.y + 0.5, 1.75, A.unitPal(col, Number(u.id.slice(-1))), { flip: u.side === 'def' });
        g.beginPath(); g.roundRect(x, y, w, h, 3.5); g.fillStyle = col; g.fill();
        g.lineWidth = u === s ? 2.6 : 1.2; g.strokeStyle = u === s ? ACCENT : INK; g.stroke();
        g.fillStyle = textOn(col); g.font = `700 8.5px ${FONT}`; g.fillText(u.name.slice(0, 3), p.x, y + 4.8);
        g.font = `700 8px ${FONT}`; g.fillText(fmt(u.troops), p.x, y + 12.4);
        g.globalAlpha = 1;
      }
      for (const [c, r] of fires) { const p = grid.center(c, r), f = (Math.floor(t / 6) + c) % 2; A.draw(g, f ? 'flame2' : 'flame', p.x - 11, p.y + 15, 1.2, A.FLAME); A.draw(g, f ? 'flame' : 'flame2', p.x + 12, p.y + 16, 1.2, A.FLAME); }      // 부대 앞에도 작은 불꽃
      if (s && this.myTurn && this.pick === 'fire') { g.beginPath(); for (const [c, r] of b.canIgnite(s)) grid.trace(g, c, r); g.setLineDash([6, 4]); g.strokeStyle = FLAME; g.lineWidth = 3; g.stroke(); g.setLineDash([]); }
      if (s && this.myTurn && this.pick === 'duel') for (const x of b.canDuel(s)) { const p = grid.center(x.c, x.r); g.beginPath(); g.arc(p.x, p.y, S * 0.98, 0, Math.PI * 2); g.strokeStyle = VIOLET; g.lineWidth = 3.4; g.stroke(); }
      else if (s && this.myTurn && !this.pick) for (const x of b.targets(s)) { const p = grid.center(x.c, x.r), pulse = 1 + 0.08 * Math.sin(t / 6); g.beginPath(); g.arc(p.x, p.y, S * 0.98 * pulse, 0, Math.PI * 2); g.strokeStyle = RED; g.lineWidth = 3; g.stroke(); }
      // 키보드 커서
      if (this.cur && this.mode === 'fight') { g.beginPath(); grid.trace(g, this.cur.c, this.cur.r); g.lineJoin = 'round'; g.strokeStyle = '#fff'; g.lineWidth = 4.6; g.stroke(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke(); }
      // 불을 놓는 순간: 붙으면 불티가 퍼지고, 안 붙으면 연기만 난다
      for (const f of this.fx) if (f.kind === 'burst') {
        const q = (t - f.t0) / FX; g.globalAlpha = Math.max(0, 1 - q);
        if (f.ok) for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + 0.3, d = 6 + q * 22; g.fillStyle = i % 2 ? '#ffd95a' : FLAME; g.fillRect(f.x + Math.cos(a) * d - 1.5, f.y + Math.sin(a) * d - 1.5 - q * 8, 3, 3); }
        else { g.beginPath(); g.arc(f.x, f.y - q * 14, 5 + q * 6, 0, Math.PI * 2); g.fillStyle = 'rgba(110,99,86,.6)'; g.fill(); }
        g.globalAlpha = 1;
      }
      // 비: 비스듬한 빗줄기
      if (b.rain) { g.beginPath(); for (let i = 0; i < 46; i++) { const x = (i * 53 + t * 3) % (grid.width + 40) - 20, y = (i * 97 + t * 7) % (grid.height + 30) - 15; g.moveTo(x, y); g.lineTo(x - 3, y + 9); } g.strokeStyle = 'rgba(90,130,170,.5)'; g.lineWidth = 1.2; g.stroke(); }
      // 떠오르는 피해 숫자
      for (const f of this.fx) if (f.kind === 'hit') {
        const q = (t - f.t0) / FX, y = f.y - 18 - q * 16; g.globalAlpha = Math.min(1, 2.2 * (1 - q)); g.font = `800 13px ${FONT}`;
        g.lineWidth = 3.5; g.strokeStyle = '#fff'; g.strokeText(f.text, f.x, y); g.fillStyle = RED; g.fillText(f.text, f.x, y); g.globalAlpha = 1;
      }
    }
    /** 일기토 장면: 두 장수가 마주 서서 합을 겨룬다. 왼쪽이 청한 쪽이다. */
    drawDuel(g) {
      const W = this.engine.width, H = this.engine.height, v = this.dv, t = this.engine.tick, A = DH.Sam.Art, MN = DH.Sam.MOVE_NAME, w = 420, h = 234, x = (W - w) / 2, y = (H - h) / 2, r = v.last;
      g.fillStyle = 'rgba(38,33,28,.55)'; g.fillRect(0, 0, W, H);
      g.beginPath(); g.roundRect(x, y, w, h, 10); g.fillStyle = '#fbf7ef'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
      g.fillStyle = VIOLET; g.fillRect(x + 1, y + 1, w - 2, 6);
      g.beginPath(); g.roundRect(x + 14, y + 150, w - 28, 8, 4); g.fillStyle = '#d9cfb8'; g.fill();      // 땅
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK; g.font = `800 16px ${FONT}`; g.fillText(`일기토 · ${v.round}/${v.max}합`, W / 2, y + 26);
      const q = r ? Math.min(1, (t - v.t0) / 20) : 1, lunge = Math.sin(q * Math.PI) * 44, cx = [W / 2 - 104 + lunge, W / 2 + 104 - lunge], lost = v.end && v.end.winner >= 0 ? 1 - v.end.winner : -1;
      for (const i of [0, 1]) {
        const bx = W / 2 + (i ? 104 : -104), bw = 132, hp = Math.max(0, v.hp[i]) / 100;
        g.globalAlpha = lost === i ? 0.45 : 1;
        A.draw(g, 'rider', cx[i], y + 152, 4, A.unitPal(v.cols[i], i), { flip: i === 1 });
        g.globalAlpha = 1;
        g.beginPath(); g.roundRect(bx - bw / 2, y + 44, bw, 9, 4); g.fillStyle = '#e4dbc8'; g.fill();
        if (hp > 0) { g.beginPath(); g.roundRect(bx - bw / 2, y + 44, Math.max(6, bw * hp), 9, 4); g.fillStyle = hp > 0.5 ? '#2e9e5b' : hp > 0.25 ? ACCENT : RED; g.fill(); }
        g.beginPath(); g.roundRect(bx - bw / 2, y + 44, bw, 9, 4); g.lineWidth = 1.2; g.strokeStyle = INK; g.stroke();
        g.fillStyle = INK; g.font = `700 13px ${FONT}`; g.fillText(`${v.names[i]} · 무력 ${v.wars[i]}${v.me === i ? ' · 우리' : ''}`, bx, y + 172);
        g.font = `600 11px ${FONT}`; g.fillStyle = '#6e6356'; g.fillText(`기력 ${v.hp[i]}`, bx, y + 62);
        if (r) { g.font = `700 12px ${FONT}`; g.fillStyle = VIOLET; g.fillText(`${MN[r.moves[i]]} · ${r.hit[i]}`, bx, y + 190); }
      }
      if (r && q > 0.3 && q < 0.75) {                              // 부딪는 순간의 불꽃
        g.strokeStyle = ACCENT; g.lineWidth = 2.4; g.beginPath();
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + 0.2, d0 = 5, d1 = 13 + (i % 2) * 6; g.moveTo(W / 2 + Math.cos(a) * d0, y + 112 + Math.sin(a) * d0); g.lineTo(W / 2 + Math.cos(a) * d1, y + 112 + Math.sin(a) * d1); }
        g.stroke();
      }
      g.font = `800 14px ${FONT}`; g.fillStyle = INK;
      if (v.end) g.fillText(v.end.winner < 0 ? '승부가 나지 않았다' : `${v.names[v.end.winner]}의 승리`, W / 2, y + 214);
      else { g.font = `500 11px ${FONT}`; g.fillStyle = '#6e6356'; g.fillText('아래에서 수를 고른다', W / 2, y + 214); }
    }
    drawCard(g) {
      const W = this.engine.width, H = this.engine.height, r = this.res, won = r.winner === this.me, w = 300, h = 132, x = (W - w) / 2, y = (H - h) / 2;
      g.fillStyle = 'rgba(38,33,28,.45)'; g.fillRect(0, 0, W, H);
      g.beginPath(); g.roundRect(x, y, w, h, 10); g.fillStyle = '#fbf7ef'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
      g.fillStyle = won ? ACCENT : '#8d8477'; g.fillRect(x + 1, y + 1, w - 2, 6);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK;
      g.font = `800 22px ${FONT}`; g.fillText(won ? '이겼다' : '졌다', W / 2, y + 36);
      g.font = `600 13px ${FONT}`; g.fillText(`${this.b.province.name} · ${r.reason}`, W / 2, y + 66);
      g.font = `500 12px ${FONT}`; g.fillStyle = '#6e6356'; g.fillText(`남은 병력 · 공격 ${fmt(r.attTroops)} · 수비 ${fmt(r.defTroops)}`, W / 2, y + 88);
      g.fillText('여기를 찍거나 ‘지도로 돌아가기’를 누른다', W / 2, y + 110);
    }
    save() { return { battle: this.b.province.id, day: this.b.day, side: this.b.side }; }
  }

  DH.Sam = Object.assign(DH.Sam || {}, { SamBattleScene });
})(typeof globalThis !== 'undefined' ? globalThis : this);
