/* 동현삼 · 전투 장면 — sam-battle.js의 전투를 캔버스에 그리고 손으로 싸운다. 지도 장면 위에 얹는다(engine.pushScene).
 *   우리 부대를 찍는다 → 갈 수 있는 칸이 노랗게 → 칸을 찍어 옮긴다 → 붉은 테의 적을 찍어 친다.
 *   옮긴 뒤 칠 적이 없으면 그 부대는 그날 일을 마친다. 모두 마치면 차례가 저절로 넘어간다.
 *   조작 창: 대기 · 차례 넘기기 · 맡기기(남은 싸움을 AI에게) · 퇴각(한 번 더 묻는다).
 * 키보드: 방향키 칸 커서 · Enter 커서가 놓인 칸 찍기(손으로 찍는 것과 같다) · Space 아직 일을 마치지 않은 다음 우리 부대 ·
 *   숫자 키 조작 창의 단추 · Esc 고른 부대 놓기. 결과 카드와 퇴각을 되묻는 창에서는 Enter가 노란 단추를 누른다.
 * 끝나면 결과 카드를 보이고, 지도로 돌아가면서 onDone(result)를 부른다. 소유권은 지도 쪽(Game.settle)이 옮긴다. */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};
  const FONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  const fmt = n => Number(n).toLocaleString('ko-KR');
  /** 전장 색: 들은 두 가지 풀빛을 엇갈려 깔고(픽셀 지도의 결), 강은 큰 지도의 바다와 같은 물빛이다. */
  const STYLE = { plain: { fill: '#d6dbb0' }, plain2: { fill: '#cfd5a7' }, mountain: { fill: '#bba987' }, river: { fill: '#9fc4d9' }, castle: { fill: '#e6d6ae' } };
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
      if (code === 'Escape') { this.select(null); this.ask = false; return this.refresh(); }
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
      this.ask = false; this.select(u); this.cur = { c: u.c, r: u.r }; this.curX = this.grid.center(u.c, u.r).x; this.sfx('tick'); this.refresh();
    }
    get myTurn() { return this.mode === 'fight' && !this.auto && !this.b.winner && this.b.side === this.me; }

    select(u) { this.sel = u; this.reach = u ? this.b.range(u) : new Map(); this.look = null; }
    /** 한 일을 화면에 남긴다: 떠오르는 피해 숫자 · 지나온 자취 · 기록 */
    show(rec) {
      if (!rec) return;
      const g = this.grid, t = this.engine.tick;
      if (rec.from && rec.to && (rec.from[0] !== rec.to[0] || rec.from[1] !== rec.to[1])) this.fx.push({ kind: 'trail', a: g.center(rec.from[0], rec.from[1]), b: g.center(rec.to[0], rec.to[1]), t0: t });
      if (rec.type === 'attack' && rec.target) { const x = this.b.units.find(u => u.id === rec.target), p = g.center(x.c, x.r); this.fx.push({ kind: 'hit', x: p.x, y: p.y, text: '−' + fmt(rec.damage), t0: t }); this.layout.log(rec.text); this.sfx('clash'); if (!rec.left) this.sfx('fall', 0.35); }
      else if (rec.from && rec.to && (rec.from[0] !== rec.to[0] || rec.from[1] !== rec.to[1])) this.sfx('horse');
    }
    endSide() {
      const b = this.b; b.endSide(); this.sel = null; this.reach = new Map(); this.ask = false; this.idle = 0; this.wait = STEP;
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
      if (this.mode !== 'fight') return;
      if (b.winner) return this.finish();
      if (this.myTurn) {                                           // 우리 부대가 모두 일을 마치면 차례를 넘긴다
        if (b.alive(this.me).some(u => !u.done)) this.idle = 0; else if (++this.idle > 24) this.endSide();
        return;
      }
      if (--this.wait > 0) return;
      const rec = b.aiAct();
      if (!rec) return this.endSide();
      this.show(rec); this.wait = STEP;
      if (b.winner) this.finish(); else this.refresh();
    }

    onTap(x, y) {
      const b = this.b;
      if (this.mode === 'result') { if (this.engine.tick - this.doneAt > 30) this.command('back'); return; }      // 싸우던 손이 그대로 카드를 넘기지 않게 반 초 둔다
      if (!this.myTurn) return;
      this.cur = null;                                             // 손으로 찍으면 키보드 커서는 숨는다
      this.tapCell(this.cellAt(x, y));
    }
    /** 칸 하나를 찍는다(손가락 · 마우스 · 키보드 Enter가 같이 쓴다). */
    tapCell(cell) {
      const b = this.b; this.ask = false;
      if (!cell) { this.select(null); return this.refresh(); }
      const u = b.unitAt(cell.c, cell.r), s = this.sel, k = cell.c + ',' + cell.r;
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
      if (!this.myTurn) return;
      if (id === 'wait' && this.sel) { b.wait(this.sel); this.select(null); }
      else if (id === 'end') return this.endSide();
      else if (id === 'auto') { this.auto = true; this.select(null); this.wait = 6; this.layout.log('남은 싸움을 장수들에게 맡겼다'); }
      else if (id === 'retreat') this.ask = true;
      else if (id === 'no') this.ask = false;
      else if (id === 'yes') { b.retreat(this.me); return this.finish(); }
      this.refresh();
    }

    refresh() {
      const b = this.b, L = this.layout, A = b.sides.att, D = b.sides.def, s = this.sel, T = b.T, max = b.B.days;
      L.setInfo([{ label: '전장', value: b.province.name }, { label: '날', value: `${b.day}/${max}일` }, { label: '차례', value: this.mode === 'result' ? '끝' : `${SIDE[b.side]} 측` },
        { label: `공격 ${A.name}`, value: fmt(b.total('att')) }, { label: `수비 ${D.name}`, value: fmt(b.total('def')) }]);
      const line = side => b.units.filter(u => u.side === side).map(u => `${u.name}(무${u.war}) ${u.troops ? fmt(u.troops) : '무너짐'}`).join(' · ');
      const rows = [[`공격 ${A.name}${this.me === 'att' ? ' · 우리' : ''}`, line('att')], [`수비 ${D.name}${this.me === 'def' ? ' · 우리' : ''}`, line('def')]];
      const land = (c, r) => { const t = b.terrain(c, r); return `${t.name} · 이동 ${t.cost} · 방어 ${Math.round(t.def * 100)}%`; };
      let note;
      if (this.mode === 'result') {
        const won = this.res.winner === this.me; rows.push(['결과', `${won ? '이겼다' : '졌다'} · ${this.res.reason}`], ['남은 병력', `공격 ${fmt(this.res.attTroops)} · 수비 ${fmt(this.res.defTroops)}`]);
        note = '지도로 돌아가면 결과가 반영된다.';
      } else if (s) {
        rows.push(['고른 부대', `${s.name} · 무력 ${s.war} · 병력 ${fmt(s.troops)}`], ['선 자리', land(s.c, s.r)]);
        for (const t of b.targets(s)) rows.push([`${t.name} 치기`, `${fmt(s.troops)} × ${s.war} ÷ 100 × (1 − ${b.terrain(t.c, t.r).def}) = ${fmt(Math.min(t.troops, b.damage(s, t)))}`]);
        note = s.moved ? '붉은 테의 적을 찍으면 친다. 치지 않으려면 대기를 누른다.' : '노란 칸을 찍으면 옮긴다. 붉은 테의 적은 바로 칠 수 있다.';
      } else if (this.look) {
        const u = b.unitAt(this.look.c, this.look.r); rows.push(['찍은 칸', land(this.look.c, this.look.r)]);
        if (u) rows.push(['그 부대', `${SIDE[u.side]} 측 ${u.name} · 무력 ${u.war} · 병력 ${fmt(u.troops)}`]);
        note = '우리 부대를 찍으면 갈 수 있는 칸이 보인다.';
      } else note = this.auto ? '장수들이 알아서 싸우는 중이다.' : this.myTurn ? `우리 부대를 찍으면 갈 수 있는 칸이 보인다. 이동력은 하루 ${b.B.mp}이고 평지 ${T.plain.cost} · 산 ${T.mountain.cost} · 강 ${T.river.cost}가 든다.` : `${SIDE[b.side]} 측이 움직이는 중이다.`;
      if (this.me === 'att' && this.mode === 'fight' && !s && !this.look) note += ` 성에 올라선 채 차례를 마치거나 수비 부대를 모두 무너뜨리면 이긴다. ${max}일이 지나면 진다.`;
      if (this.me === 'def' && this.mode === 'fight' && !s && !this.look) note += ` ${max}일을 버티거나 공격 부대를 모두 무너뜨리면 이긴다. 성을 빼앗기면 진다.`;
      L.setDetail({ title: `${b.province.name} 전투`, rows, note });
      const off = !this.myTurn;
      if (this.mode === 'result') L.setMenu([{ id: 'back', label: '지도로 돌아가기', primary: true }], id => this.command(id));
      else if (this.ask) L.setMenu([{ id: 'yes', label: '정말 물러난다', hint: '이 전투를 내준다' }, { id: 'no', label: '돌아가기', primary: true }], id => this.command(id));
      else L.setMenu([{ id: 'wait', label: '대기', disabled: off || !s, hint: '고른 부대가 그날 일을 마친다' }, { id: 'end', label: '차례 넘기기', primary: true, disabled: off },
        { id: 'auto', label: '맡기기', disabled: off, hint: '남은 싸움을 AI가 대신 싸운다' }, { id: 'retreat', label: '퇴각', disabled: off, hint: '전투를 내주고 물러난다' }], id => this.command(id));
    }

    render(g) {
      g.fillStyle = BG; g.fillRect(0, 0, this.engine.width, this.engine.height);      // 아래 지도 장면을 가린다
      super.render(g);
      if (this.mode === 'result') this.drawCard(g);
    }
    drawOver(g) {
      const b = this.b, grid = this.grid, t = this.engine.tick, S = grid.size;
      // 지형 그림
      for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
        const k = b.at(c, r), p = grid.center(c, r);
        if (k === 'mountain') { g.beginPath(); g.moveTo(p.x - 13, p.y + 8); g.lineTo(p.x - 4, p.y - 9); g.lineTo(p.x + 2, p.y + 1); g.lineTo(p.x + 6, p.y - 5); g.lineTo(p.x + 14, p.y + 8); g.closePath(); g.fillStyle = '#8f7a58'; g.fill(); g.beginPath(); g.moveTo(p.x - 7.2, p.y - 3); g.lineTo(p.x - 4, p.y - 9); g.lineTo(p.x - 1.6, p.y - 4.5); g.closePath(); g.fillStyle = '#f3ecdc'; g.fill(); }
        else if (k === 'river') { g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.4; g.lineCap = 'round'; for (const dy of [-6, 1, 8]) { g.beginPath(); g.moveTo(p.x - 10, p.y + dy); g.quadraticCurveTo(p.x - 5, p.y + dy - 4, p.x, p.y + dy); g.quadraticCurveTo(p.x + 5, p.y + dy + 4, p.x + 10, p.y + dy); g.stroke(); } }
        else if (k === 'castle') { g.fillStyle = '#7b6a4f'; g.fillRect(p.x - 14, p.y - 4, 28, 14); for (const dx of [-14, -5, 4]) g.fillRect(p.x + dx, p.y - 10, 7, 7); g.fillRect(p.x + 7, p.y - 10, 7, 7); g.fillStyle = '#3c3226'; g.fillRect(p.x - 4, p.y + 1, 8, 9); }
      }
      // 갈 수 있는 칸 · 칠 수 있는 적
      const s = this.sel;
      if (s && this.myTurn) {
        g.beginPath(); for (const v of this.reach.values()) if (v.c !== s.c || v.r !== s.r) grid.trace(g, v.c, v.r);
        g.fillStyle = 'rgba(242,183,5,.42)'; g.fill(); g.strokeStyle = '#a77915'; g.lineWidth = 1.2; g.stroke();
      }
      // 자취
      for (const f of this.fx) if (f.kind === 'trail') { const a = 1 - (t - f.t0) / FX; g.beginPath(); g.moveTo(f.a.x, f.a.y); g.lineTo(f.b.x, f.b.y); g.strokeStyle = `rgba(38,33,28,${(0.5 * a).toFixed(3)})`; g.lineWidth = 3; g.setLineDash([5, 5]); g.stroke(); g.setLineDash([]); }
      // 부대
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      for (const u of b.units) {
        if (u.troops <= 0) continue;
        const p = grid.center(u.c, u.r), col = b.sides[u.side].color, w = 34, h = 25, x = p.x - w / 2, y = p.y - h / 2, dim = this.mode === 'fight' && u.side === b.side && u.done;
        g.globalAlpha = dim ? 0.62 : 1;
        g.beginPath(); g.roundRect(x, y, w, h, 4); g.fillStyle = col; g.fill();
        g.lineWidth = u === s ? 3 : 1.4; g.strokeStyle = u === s ? ACCENT : INK; g.stroke();
        if (u.side === 'att') { g.beginPath(); g.moveTo(x + w, y + 4); g.lineTo(x + w + 6, y + h / 2); g.lineTo(x + w, y + h - 4); g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = 1.2; g.strokeStyle = INK; g.stroke(); }   // 공격 측은 오른쪽으로 뾰족하다
        g.fillStyle = textOn(col); g.font = `700 9.5px ${FONT}`; g.fillText(u.name.slice(0, 3), p.x, p.y - 5.5);
        g.font = `700 9px ${FONT}`; g.fillText(fmt(u.troops), p.x, p.y + 6);
        g.globalAlpha = 1;
      }
      if (s && this.myTurn) for (const x of b.targets(s)) { const p = grid.center(x.c, x.r), pulse = 1 + 0.08 * Math.sin(t / 6); g.beginPath(); g.arc(p.x, p.y, S * 0.98 * pulse, 0, Math.PI * 2); g.strokeStyle = RED; g.lineWidth = 3; g.stroke(); }
      // 키보드 커서
      if (this.cur && this.mode === 'fight') { g.beginPath(); grid.trace(g, this.cur.c, this.cur.r); g.lineJoin = 'round'; g.strokeStyle = '#fff'; g.lineWidth = 4.6; g.stroke(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke(); }
      // 떠오르는 피해 숫자
      for (const f of this.fx) if (f.kind === 'hit') {
        const q = (t - f.t0) / FX, y = f.y - 18 - q * 16; g.globalAlpha = Math.min(1, 2.2 * (1 - q)); g.font = `800 13px ${FONT}`;
        g.lineWidth = 3.5; g.strokeStyle = '#fff'; g.strokeText(f.text, f.x, y); g.fillStyle = RED; g.fillText(f.text, f.x, y); g.globalAlpha = 1;
      }
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
