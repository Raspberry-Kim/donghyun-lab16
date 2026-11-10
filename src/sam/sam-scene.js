/* 동현삼 · 지도 장면 — 육각 지도 위의 41개 주에서 한 달에 한 번씩 명령을 내린다. 규칙은 sam-rules.js에 있다.
 *   군주를 고른다 → 우리 주를 찍는다 → 농지 개발 · 징병 · 이동 · 수색 · 침공 가운데 하나 → 턴 종료.
 *   이동과 침공은 조작 창에서 차례로 고른다(누가 → 어디로 → 병력). 어디로는 지도의 주를 찍어도 된다.
 *   턴 종료를 누르면 다른 군주들이 움직인다. 우리 주가 침공받으면 전투 화면으로 넘어간다(sam-battle-scene.js).
 *   침공하거나 침공받은 전투가 끝나면 주의 주인이 바뀌고 이 지도로 돌아온다. */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};
  const FONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  const NEUTRAL = '#b9b0a2', INK = '#26211c', ACCENT = '#f2b705', RED = '#c0321f';
  const fmt = n => Number(n).toLocaleString('ko-KR');
  const ZOOM = [{ id: 'zin', label: '확대' }, { id: 'zout', label: '축소' }];

  class SamMapScene extends DH.MapScene {
    constructor(engine, world, layout) {
      super(engine); this.world = world; this.layout = layout;
      this.state = DH.Sam.newState();                             // globalState: 기본값. 동현랭 설정이 오면 새로 지어 덮어쓴다
      this.game = this.newGame(null);                              // 군주를 고르기 전에는 구경만 한다
      this.mode = 'pick'; this.selected = null; this.sub = null; this.pause = 0; this.flash = null;
    }
    newGame(player) { return new DH.Sam.Game(this.world, { player, rng: this.engine.rng, state: this.state }); }
    /** 동현랭 설정을 받아 globalState를 새로 짓고 판을 다시 연다. 오류가 있으면 지금 판을 그대로 둔다.
     *  @returns 보고서 {ok, empty, settings, errors, applied} */
    applyDonghyunLang(scriptText) {
      const st = DH.Sam.newState(), rep = DH.Sam.applyDonghyunLang(scriptText, st, { world: this.world });
      if (!rep.ok) return rep;
      this.state = st;
      while (this.engine.scene && this.engine.scene !== this) this.engine.popScene();          // 전투 중이었으면 접는다
      this.layout.log(rep.empty ? '동현랭 설정이 없다. 기본값으로 새 판을 연다' : `동현랭 설정 ${rep.settings.length}개를 적용했다: ${rep.applied.join(' · ')}`);
      this.restart();
      return rep;
    }
    /** 새 판. 설정에 군주가 정해져 있으면 바로 시작하고, 아니면 고르는 화면으로 간다. */
    restart() {
      const w = this.world, c = this.engine.clock, n = this.state.start.player;
      Object.assign(c, { year: w.meta.start.year, month: w.meta.start.month || 1, serial: 0, turn: 1 }); c.setActors([]);
      this.sub = null; this.flash = null; this.pause = 0; this.selected = null;
      if (n) return this.start([...w.factions.keys()][n - 1]);
      this.game = this.newGame(null); this.mode = 'pick'; this.refresh();
    }
    enter() {
      const w = this.world, e = this.engine;
      const grid = new DH.HexGrid(w.map.cols, w.map.rows, 7);
      this.setupMap({ grid, tileAt: (c, r) => w.map.at(c, r), styles: { sea: { fill: '#a9cbe0' }, land: { fill: '#eadfc3' } }, line: 'rgba(38,33,28,.07)', minZoom: 1, maxZoom: 3 });
      this.pos = new Map([...w.provinces.values()].map(p => [p.id, grid.center(p.hex[0], p.hex[1])]));
      e.clock.setActors([]);
      this._off = [e.on('clock:turn', d => this.layout.log(`${d.year}년 ${d.month}월이 되었다`))];
      this.layout.log(`${w.meta.scenario || '시작'} · 주 ${w.provinces.size} · 군주 ${w.factions.size}`);
      this.refresh();
    }
    exit() { this._off.forEach(f => f()); }
    colorOf(p) { return p.owner ? this.game.factions.get(p.owner).color : NEUTRAL; }
    get mine() { const p = this.game.P(this.selected); return this.mode === 'play' && p && p.owner === this.game.player ? p : null; }

    /** 군주를 고르고 판을 연다. */
    start(fid) {
      const w = this.world, c = this.engine.clock, f = w.factions.get(fid);
      if (this.state.start.seed != null) this.engine.rng.state = this.state.start.seed >>> 0;      // 씨앗을 정했으면 판마다 같은 수가 나온다
      this.game = this.newGame(fid);
      Object.assign(c, { year: w.meta.start.year, month: w.meta.start.month || 1, serial: 0, turn: 1 }); c.setActors([fid]);
      this.mode = 'play'; this.sub = null; this.flash = null; this.selected = w.officers.get(f.leader).province;
      const g = this.game, all = g.goal >= g.provinces.size;
      this.layout.log(`${DH.Sam.ro(f.name)} 시작한다. 우리 주를 찍고 한 달에 한 번씩 명령을 내린다`);
      if (!all || g.stage.months) this.layout.log(`이기는 조건: ${all ? '모든 주' : `주 ${g.goal}개`}를 차지한다` + (g.stage.months ? ` · ${g.stage.months}달 안에` : ''));
      this.settled();
    }
    /** 이동·침공에서 지금 찍을 수 있는 주들 */
    candidates() {
      const s = this.sub, p = this.mine; if (!s || s.step !== 'to' || !p) return [];
      return s.type === 'move' ? this.game.friends(p.id) : this.game.targets(p.id);
    }

    onTap(x, y) {
      if (this.mode === 'busy') return;
      const wpt = this.cam.toWorld(x, y); let best = null, bd = 12 / this.cam.zoom + 4;      // 손가락이 조금 빗나가도 잡히게
      for (const [id, p] of this.pos) { const d = Math.hypot(p.x - wpt.x, p.y - wpt.y); if (d < bd) { bd = d; best = id; } }
      if (best !== null && this.candidates().some(q => q.id === best)) return this.command('to:' + best);   // 고르는 중이면 그 주가 대상이 된다
      this.sub = null; this.selected = best; this.refresh();
    }

    command(id) {
      if (id === 'zin') return this.zoomBy(1.25);
      if (id === 'zout') return this.zoomBy(0.8);
      const g = this.game, [key, arg] = id.split(':');
      if (this.mode === 'pick') { if (key === 'f') this.start(arg); return; }
      if (this.mode === 'over') { if (id === 'again') this.restart(); return; }
      if (this.mode !== 'play') return;
      if (id === 'end') return this.endTurn();
      const p = this.mine; if (!p) return;
      const s = this.sub;
      if (id === 'cancel') this.sub = null;
      else if (id === 'develop' || id === 'draft' || id === 'search') this.say(g[id](p.id));
      else if (id === 'move') this.sub = g.officersOf(p.id).length ? { type: 'move', step: 'who' } : { type: 'move', step: 'to', officer: null };
      else if (id === 'attack') this.sub = { type: 'attack', step: 'to' };
      else if (key === 'who' && s && s.step === 'who') { s.officer = arg === 'none' ? null : Number(arg); s.step = 'to'; }
      else if (key === 'to' && s && s.step === 'to') { s.to = Number(arg); s.step = 'n'; }
      else if (key === 'n' && s && s.step === 'n') {
        const n = Number(arg); this.sub = null;
        if (s.type === 'move') this.say(g.move(p.id, s.officer, s.to, n));
        else return this.invade(p.id, s.to, n);
      }
      this.refresh();
    }
    say(r) { this.layout.log(r.ok ? r.text : r.why); }
    invade(from, to, n) {
      const r = this.game.attack(from, to, n);
      if (!r.ok) { this.say(r); return this.refresh(); }
      this.layout.log(r.text); this.flash = { from, to, t0: this.engine.tick };
      if (r.battle) return this.openBattle(r, 'att');
      this.layout.log(r.outcome.text); this.selected = to; this.settled();
    }
    /** 전투 화면을 얹는다. 끝나면 결과를 지도에 반영하고 돌아온다. */
    openBattle(r, side) {
      this.engine.pushScene(new DH.Sam.SamBattleScene(this.engine, this.layout, r.battle, { side, onDone: res => {
        const out = this.game.settle(r.pending, res); this.layout.log(out.text);
        if (side === 'att' && out.winner === 'att') this.selected = r.pending.to;
        this.pause = 20; this.settled();
      } }));
    }
    settled() { if (this.game.over) { this.mode = 'over'; this.sub = null; this.layout.log(this.overTitle()); } this.refresh(); }
    /** 판이 끝난 까닭에 맞는 한 줄 */
    overTitle() { const w = this.game.overWhy; return w === 'all' ? '온 땅을 하나로 모았다' : w === 'goal' ? '목표한 땅을 모두 차지했다' : w === 'time' ? '기한이 다 되었다' : '세력이 무너졌다'; }

    endTurn() { this.mode = 'busy'; this.sub = null; this.pause = 0; this.game.beginAI(); this.refresh(); }
    /** 다른 군주들의 차례. 조용한 일(징병·개발·이동)은 한꺼번에 넘기고, 침공은 하나씩 보여 준다. */
    update(tick) {
      if (this.flash && tick - this.flash.t0 > 60) this.flash = null;
      if (this.mode !== 'busy') return;
      if (this.pause > 0) { this.pause--; return; }
      for (let i = 0; i < 400; i++) {
        const s = this.game.nextAI();
        if (s.done) return this.endMonth();
        if (s.quiet) continue;
        this.flash = { from: s.from, to: s.cmd.to, t0: tick }; this.layout.log(s.text);
        if (s.battle) return this.openBattle(s, 'def');
        this.pause = 26; return this.refresh();
      }
    }
    endMonth() {
      if (this.game.over) return this.settled();
      for (const n of this.game.endMonth()) this.layout.log(n);
      this.engine.clock.endPhase(); this.mode = 'play'; this.refresh();
    }

    refresh() {
      const g = this.game, c = this.engine.clock, L = this.layout, sel = g.P(this.selected), me = g.player, own = me ? g.provincesOf(me) : [];
      L.setInfo([{ label: '날짜', value: c.label }, { label: '군주', value: me ? g.fname(me) : '고르는 중' }, { label: '주', value: me ? (g.goal < g.provinces.size ? `${own.length}/${g.goal}` : own.length) : g.provinces.size },
        { label: '병력', value: me ? fmt(own.reduce((s, p) => s + p.troops, 0)) : '-' }, { label: '남은 명령', value: me ? own.filter(p => !p.acted).length : '-' },
        ...(me && g.stage.months ? [{ label: '기한', value: `${Math.max(0, g.stage.months - g.months)}달 남음` }] : [])]);
      const pick = id => L.setMenu(this.menu(), id2 => this.command(id2));
      if (!sel) {
        if (this.mode === 'pick') L.setDetail({ title: '군주를 고른다', rows: [['주', g.provinces.size], ['장수', g.officers.size], ['군주', g.factions.size]], note: '아래에서 군주를 고르면 시작한다. 지도의 주를 찍으면 그 땅의 사정이 보인다. 끌면 지도가 움직이고 바퀴로 크기를 바꾼다.' });
        else L.setDetail({ title: this.title(), rows: [['우리 주', own.map(p => p.name).join(' · ') || '없음']], note: this.note(null) });
        return pick();
      }
      const inc = g.income(sel.id), off = g.officersOf(sel.id);
      L.setDetail({ title: `${sel.name} ${sel.hanja || ''}`, rows: [
        ['세력', g.fname(sel.owner) + (sel.owner && sel.owner === me ? ' · 우리 땅' : '')], ['인구', fmt(sel.pop)],
        ['금', sel.owner ? `${fmt(sel.gold)} (달마다 +${fmt(inc.gold)})` : fmt(sel.gold)], ['쌀', sel.owner ? `${fmt(sel.rice)} (달마다 +${fmt(inc.rice)} −${fmt(inc.upkeep)})` : fmt(sel.rice)],
        ['병력', fmt(sel.troops)], ['충성도', sel.loyalty], ['농지', sel.farm],
        ['장수', off.length ? off.map(o => `${o.name}(무${o.war} 지${o.int} 매${o.cha})`).join(', ') : '없음'],
        ['이웃', sel.adj.map(id => { const q = g.P(id); return `${q.name}(${g.fname(q.owner)} ${fmt(q.troops)})`; }).join(' · ')]], note: this.note(sel) });
      pick();
    }
    title() { return this.mode === 'over' ? this.overTitle() : this.mode === 'busy' ? '다른 군주들의 차례' : '주를 찍는다'; }
    note(sel) {
      const g = this.game, s = this.sub, p = this.mine;
      if (this.mode === 'pick') return '아래에서 군주를 고르면 시작한다.';
      if (this.mode === 'over') return (g.overWhy === 'all' ? `${g.months}달 만에 ${g.provinces.size}개 주를 모두 차지했다.` : g.overWhy === 'goal' ? `${g.months}달 만에 목표한 ${g.goal}개 주를 차지했다.` : g.overWhy === 'time' ? `${g.stage.months}달 안에 ${g.goal}개 주를 차지하지 못했다.` : '주를 모두 잃었다.') + ' 다시 하려면 아래 단추를 누른다.';
      if (this.mode === 'busy') return '다른 군주들이 움직이는 중이다. 침공이 있으면 기록에 뜬다.';
      if (!sel) return '우리 주를 찍으면 명령을 내릴 수 있다. 다 내렸으면 턴 종료를 누른다.';
      if (!p) return '남의 땅이다. 우리 주를 찍으면 명령을 내릴 수 있다.';
      if (s) {
        if (s.step === 'who') return '누가 옮겨 갈지 고른다.';
        if (s.step === 'to') return s.type === 'move' ? '어디로 보낼지 고른다. 지도에서 노란 테의 주를 찍어도 된다.' : '어디를 칠지 고른다. 지도에서 붉은 테의 주를 찍어도 된다.';
        if (s.type === 'move') return `${g.P(s.to).name}에 병력을 얼마나 딸려 보낼지 고른다.`;
        const f = g.fighters(p.id); return `${g.P(s.to).name}에 보낼 병력을 고른다. ` + (f.length ? `${f.map(o => o.name).join(' · ')}${f.length > 1 ? ' 부대로 나뉘어' : josaGa(f[0].name)} 나선다.` : `장수가 없어 원정대(무력 ${g.rules.baseStat})가 나선다.`);
      }
      if (p.acted) return '이번 달 명령을 이미 내렸다. 다른 주를 고르거나 턴 종료를 누른다.';
      const no = [['develop', '농지 개발'], ['draft', '징병'], ['move', '이동'], ['attack', '침공']].map(([k, n]) => [n, g.can(p.id, k)]).filter(([, r]) => !r.ok).map(([n, r]) => `${n}: ${r.why}`);
      return '명령 하나를 고른다. 주마다 한 달에 한 번이다.' + (no.length ? ' 지금 못 하는 것 — ' + no.join(' · ') : '');
    }
    menu() {
      const g = this.game, p = this.mine, s = this.sub, cancel = { id: 'cancel', label: '그만두기' };
      if (this.mode === 'pick') return [...[...g.factions.values()].map(f => ({ id: 'f:' + f.id, label: `${f.name} · 주 ${g.provincesOf(f.id).length}` })), ...ZOOM];
      if (this.mode === 'over') return [{ id: 'again', label: '다시 하기', primary: true }, ...ZOOM];
      if (p && s) {
        if (s.step === 'who') return [...g.officersOf(p.id).map(o => ({ id: 'who:' + o.id, label: `${o.name} 무${o.war}` })), { id: 'who:none', label: '병력만', disabled: p.troops <= 0 }, cancel];
        if (s.step === 'to') return [...this.candidates().map(q => ({ id: 'to:' + q.id, label: s.type === 'move' ? `${q.name} ${fmt(q.troops)}` : `${q.name} · ${g.fname(q.owner)} ${fmt(q.troops)}` })), cancel];
        const half = Math.floor(p.troops / 2), min = g.rules.attackMin;
        if (s.type === 'move') return [...(s.officer !== null ? [{ id: 'n:0', label: '병력 없이' }] : []), { id: 'n:' + half, label: `절반 ${fmt(half)}`, disabled: half <= 0 }, { id: 'n:' + p.troops, label: `전부 ${fmt(p.troops)}`, disabled: p.troops <= 0 }, cancel];
        return [{ id: 'n:' + half, label: `절반 ${fmt(half)}`, disabled: half < min, hint: half < min ? `병력 ${fmt(min)}부터 보낼 수 있다` : '' }, { id: 'n:' + p.troops, label: `전부 ${fmt(p.troops)}`, primary: true }, cancel];
      }
      const R = g.rules, busy = this.mode === 'busy', cmd = (id, label) => { const r = p && !busy ? g.can(p.id, id) : { ok: false, why: busy ? '다른 군주들의 차례다' : '우리 주를 먼저 찍는다' }; return { id, label, disabled: !r.ok, hint: r.ok ? '' : r.why }; };
      return [cmd('develop', `농지 개발 · 금 ${R.develop.gold}`), cmd('draft', `징병 +${fmt(R.draft.troops)} · 금 ${R.draft.gold}`), cmd('move', '이동'), cmd('search', '수색'), cmd('attack', '침공'),
        { id: 'end', label: '턴 종료', primary: true, disabled: busy, hint: '다른 군주들이 움직이고 달이 넘어간다' }, ...ZOOM];
    }

    render(g) { super.render(g); if (this.mode === 'over') this.drawCard(g); }
    drawOver(g) {
      const gm = this.game, z = this.cam.zoom, sel = this.selected, t = this.engine.tick, me = gm.player, near = sel ? new Set(gm.P(sel).adj) : new Set();
      const cand = new Set(this.candidates().map(q => q.id)), candCol = this.sub && this.sub.type === 'attack' ? RED : ACCENT;
      // 이웃 길
      g.lineCap = 'round';
      for (const p of gm.provinces.values()) for (const b of p.adj) {
        if (b < p.id) continue;
        const A = this.pos.get(p.id), B = this.pos.get(b), hot = sel !== null && (p.id === sel || b === sel);
        g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y);
        g.strokeStyle = hot ? INK : 'rgba(38,33,28,.38)'; g.lineWidth = (hot ? 2 : 1) / z * (z > 1.5 ? 1.3 : 1); g.stroke();
      }
      // 방금 있었던 침공
      if (this.flash) { const A = this.pos.get(this.flash.from), B = this.pos.get(this.flash.to), a = Math.max(0, 1 - (t - this.flash.t0) / 60); g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.strokeStyle = `rgba(192,50,31,${a.toFixed(3)})`; g.lineWidth = 3.2; g.stroke(); }
      // 주
      for (const p of gm.provinces.values()) {
        const P = this.pos.get(p.id), r = p.id === sel ? 5.2 : 4.2;
        if (cand.has(p.id)) { g.beginPath(); g.arc(P.x, P.y, r + 2.6 + 0.7 * Math.sin(t / 7), 0, Math.PI * 2); g.strokeStyle = candCol; g.lineWidth = 1.8; g.stroke(); }
        g.beginPath(); g.arc(P.x, P.y, r, 0, Math.PI * 2); g.fillStyle = this.colorOf(p); g.fill();
        g.lineWidth = p.id === sel ? 2 : near.has(p.id) ? 1.6 : 0.9; g.strokeStyle = p.id === sel ? ACCENT : near.has(p.id) ? '#fff' : INK; g.stroke();
        if (me && p.owner === me && !p.acted && this.mode === 'play') { g.beginPath(); g.arc(P.x, P.y, 1.5, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); }      // 아직 명령을 내리지 않은 우리 주
      }
      // 이름(크게 보면 병력도): 화면에서 늘 같은 크기로 보이게 배율로 나눈다
      const fs = 9 / z; g.textAlign = 'center'; g.textBaseline = 'top'; g.lineJoin = 'round';
      for (const p of gm.provinces.values()) {
        const P = this.pos.get(p.id);
        g.font = `700 ${fs}px ${FONT}`; g.lineWidth = 2.4 / z; g.strokeStyle = 'rgba(251,247,239,.92)'; g.strokeText(p.name, P.x, P.y + 5.5);
        g.fillStyle = INK; g.fillText(p.name, P.x, P.y + 5.5);
        if (z >= 1.5) { const s = fmt(p.troops); g.font = `600 ${7.5 / z}px ${FONT}`; g.strokeText(s, P.x, P.y + 5.5 + fs * 1.05); g.fillStyle = '#5a4f43'; g.fillText(s, P.x, P.y + 5.5 + fs * 1.05); }
      }
    }
    drawCard(g) {
      const W = this.engine.width, H = this.engine.height, won = this.game.over === 'won', w = 300, h = 96, x = (W - w) / 2, y = (H - h) / 2;
      g.fillStyle = 'rgba(38,33,28,.4)'; g.fillRect(0, 0, W, H);
      g.beginPath(); g.roundRect(x, y, w, h, 10); g.fillStyle = '#fbf7ef'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke();
      g.fillStyle = won ? ACCENT : '#8d8477'; g.fillRect(x + 1, y + 1, w - 2, 6);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK; g.font = `800 20px ${FONT}`; g.fillText(this.overTitle(), W / 2, y + 40);
      g.font = `500 12px ${FONT}`; g.fillStyle = '#6e6356'; g.fillText(`${this.engine.clock.label} · ‘다시 하기’를 누르면 군주를 다시 고른다`, W / 2, y + 68);
    }
    save() { return { selected: this.selected, mode: this.mode, player: this.game.player, months: this.game.months }; }
  }
  const josaGa = w => DH.Sam.josa(w, '이', '가').slice(w.length);

  /** 자료를 읽어 동현삼을 띄운다. host: 화면을 지을 자리. opt.player를 주면 군주 고르기를 건너뛴다. opt.script는 동현랭 설정이다. */
  async function boot(host, src, opt = {}) {
    const world = DH.Sam.parse(await DH.Data.load(src));
    const W = 480, H = 360;
    const layout = new DH.Layout(host, { title: '동현삼', width: W, height: H });
    const engine = new DH.Engine({ canvas: layout.canvas, width: W, height: H, seed: opt.seed ?? 1, background: '#a9cbe0', clock: { unit: 'month', start: world.meta.start } });
    const scene = new SamMapScene(engine, world, layout); engine.setScene(scene);
    if (opt.script) scene.applyDonghyunLang(opt.script);                      // 동현랭 설정을 주면 그 값으로 연다
    if (opt.player) scene.start(opt.player);
    if (opt.autostart !== false) engine.start();
    return { engine, layout, scene, world, get game() { return scene.game; }, lang: DH.Sam.lang, examples: DH.Sam.examples(world), convention: DH.Sam.lang.describe(DH.Sam.newState()),
      get state() { return scene.state; }, applyDonghyunLang: text => scene.applyDonghyunLang(text) };
  }

  DH.Sam = Object.assign(DH.Sam || {}, { SamMapScene, boot });
})(typeof globalThis !== 'undefined' ? globalThis : this);
