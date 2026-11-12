/* 동현 공통 엔진 · lang — 동현랭(donghyun-lang) 연동. 두 게임이 똑같이 쓴다.
 *
 * 동현랭에는 '자금'이나 '병력' 같은 낱말이 없다. 값은 모두 정수이고, 밖으로 나가는 것은 출력뿐이다.
 * 그래서 시리즈의 다른 게임과 같은 규약을 쓴다: 동현랭 프로그램이 출력한 정수를 [설정 번호, 값…] 묶음으로 읽는다.
 *     뿡뿡 도오오옹~뿡뿡뿡        ㅋㅋ 3번 설정
 *     뿡뿡 … ~뿡뿡뿡              ㅋㅋ 그 값
 * 어느 번호가 무엇인지는 게임이 commands로 정한다. 어댑터는 실행 → 정수 읽기 → 검사 → globalState에 덮어쓰기만 한다.
 *
 *   const lang = new DH.DonghyunLangAdapter({ name: '동현삼', commands: { 3: { key, label, min, max, step, path | set } } });
 *   lang.parse(scriptText)                       → { ok, empty, settings, values, errors, output }   (상태를 건드리지 않는다)
 *   lang.applyDonghyunLang(scriptText, state)    → 같은 보고서. 오류가 하나도 없을 때만 state에 덮어쓴다
 *   lang.compose([[3, 3000], [10, 2000]])        → 그 설정을 출력하는 동현랭 코드(예제 · 시험)
 *   lang.applySettings([[3, 3000]], state)       → 설정 목록을 바로 덮어쓴다(저장한 판을 불러올 때. 검사는 같다)
 * 스크립트가 비었으면 아무것도 덮어쓰지 않는다. state에 미리 든 기본값이 그대로 남는다. */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};
  const fmt = n => Number(n).toLocaleString('ko-KR');
  const INT = /^[+-]?\d+$/, START = '나는 동현이냐?', END = '동현이구나';

  /** 실행기(donghyun.js): 브라우저에서는 전역 Donghyun, node에서는 lang/donghyun.js */
  function findRuntime() {
    if (root.Donghyun && typeof root.Donghyun.run === 'function') return root.Donghyun;
    if (typeof module === 'object' && typeof require === 'function') { try { return require('../lang/donghyun.js'); } catch (e) { /* 없으면 null */ } }
    return null;
  }

  const lit = n => '도' + '오'.repeat(n - 1) + '옹';
  /** 정수 n을 식 하나로 적는다(공백은 곱하기). 식 하나로 짧게 못 적으면 null. */
  function expression(n) {
    if (n === 0) return '도옹ㅠ';
    if (n < 0) { const e = expression(-n); return e && 'ㅠ ' + e; }
    if (n <= 10) return lit(n);
    for (let a = 10; a >= 2; a--) if (n % a === 0) { const rest = expression(n / a); if (rest) return rest + ' ' + lit(a); }
    return n <= 30 ? lit(n) : null;
  }
  /** 정수 n을 출력하는 문장들. 식 하나로 안 되면 1번 변수에 자릿수를 하나씩 쌓는다(×10 하고 더하기). */
  function printStatements(n) {
    const e = expression(n);
    if (e !== null) return ['뿡뿡 ' + e, '뿡뿡뿡'];
    const ds = String(Math.abs(n)).split('').map(Number), out = ['동현아 ' + lit(ds[0])];
    for (const d of ds.slice(1)) { out.push('동현아 동현 ' + lit(10)); if (d) out.push('동현아 동현' + lit(d)); }
    out.push(n < 0 ? '뿡뿡 ㅠ 동현' : '뿡뿡 동현', '뿡뿡뿡');
    return out;
  }
  const getPath = (o, path) => path.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
  function setPath(o, path, v) { const ks = path.split('.'), last = ks.pop(); let x = o; for (const k of ks) { if (x[k] == null || typeof x[k] !== 'object') x[k] = {}; x = x[k]; } x[last] = v; }

  class DonghyunLangAdapter {
    /** @param {{name:string, commands:Object<number,Command>, validate?:(values, ctx)=>string|null, runtime?:object, maxSteps?:number}} o
     *  Command = { key, label, hint?, multi?:boolean,
     *              min, max, step?            값이 하나일 때의 범위. 여러 개면 args:[{label, min, max, step?}, …]
     *              path?: 'rules.draft.troops'  state의 그 자리에 값을 쓴다
     *              set?: (state, values, ctx) => void   자리 하나로 안 될 때
     *              check?: (values, ctx) => string|null   자료에 비춰 본 검사(없는 장수 번호 등). 문제가 있으면 그 까닭 }
     *  multi가 참이면 같은 번호를 여러 번 쓸 수 있다(장수마다 능력치). 아니면 뒤에 쓴 값이 이긴다. */
    constructor(o) {
      this.name = o.name || '게임'; this.maxSteps = o.maxSteps || 300000; this._runtime = o.runtime || null; this.validate = o.validate || null;
      this.commands = new Map();
      for (const [n, c] of Object.entries(o.commands || {})) {
        const num = Number(n), args = c.args || [{ label: c.label, min: c.min, max: c.max, step: c.step }];
        if (!Number.isInteger(num) || num < 0) throw new Error(`설정 번호 ${n}이 맞지 않다`);
        if (!c.key || !c.label || (!c.path && !c.set)) throw new Error(`설정 ${n}: key · label과 path(또는 set)가 있어야 한다`);
        for (const a of args) if (!Number.isInteger(a.min) || !Number.isInteger(a.max) || a.min > a.max) throw new Error(`설정 ${n}(${c.label}): 범위가 맞지 않다`);
        this.commands.set(num, { ...c, n: num, args });
      }
    }
    get runtime() { return this._runtime || (this._runtime = findRuntime()); }
    static expression(n) { return expression(n); }
    /** 정수 n을 출력하는 문장 한 줄(~로 이은 것) */
    static print(n) { return printStatements(n).join('~'); }
    static rangeText(a) { return `${fmt(a.min)}~${fmt(a.max)}` + (a.step > 1 ? `, ${fmt(a.step)} 단위` : ''); }

    /** 스크립트를 돌려 출력한 정수를 설정으로 읽는다. 상태를 건드리지 않는다.
     *  @returns {{ok:boolean, empty:boolean, name:string, output:string, steps:number, settings:Array, values:object, errors:string[]}} */
    parse(scriptText, opt = {}) {
      const rep = { ok: true, empty: false, name: this.name, output: '', steps: 0, settings: [], values: {}, errors: [] };
      const fail = msg => { rep.ok = false; rep.errors.push(msg); return rep; };
      if (scriptText == null || !String(scriptText).trim()) { rep.empty = true; return rep; }      // 설정 없음 → 기본값 그대로
      const rt = this.runtime;
      if (!rt) return fail('동현랭 실행기(donghyun.js)를 찾지 못했다');
      let run;
      try { run = rt.run(String(scriptText), { input: opt.input || [], maxSteps: this.maxSteps }); }
      catch (e) { return fail(`동현랭 오류${e && e.line ? ` (${e.line}번 문장)` : ''}: ${e && e.message ? e.message : e}`); }
      rep.output = run.output; rep.steps = run.steps;
      const tok = run.output.split(/\s+/).filter(Boolean);
      if (!tok.length) { rep.empty = true; return rep; }                                            // 아무것도 출력하지 않았다 → 기본값 그대로
      return this._read(tok, rep, opt);
    }
    /** 정수 토큰들을 [설정 번호, 값…] 묶음으로 읽어 보고서에 채운다(parse와 applySettings가 같이 쓴다). */
    _read(tok, rep, opt = {}) {
      const fail = msg => { rep.ok = false; rep.errors.push(msg); return rep; };
      for (let i = 0; i < tok.length;) {
        const at = i + 1;
        if (!INT.test(tok[i])) return fail(`${at}번째 출력 '${tok[i].slice(0, 12)}'는 정수가 아니다. 설정은 뿡뿡(정수)으로만 내보내고 뿡뿡뿡(줄바꿈)으로 띄운다.`);
        const n = Number(tok[i]), c = this.commands.get(n);
        if (!c) return fail(`${at}번째 정수 ${n}은 ${this.name} 설정 번호가 아니다. 쓸 수 있는 번호: ${[...this.commands.keys()].sort((a, b) => a - b).join(' · ')}`);
        const vals = [];
        for (let k = 0; k < c.args.length; k++) {
          const a = c.args[k], raw = tok[i + 1 + k];
          if (raw === undefined) return fail(`설정 ${n}(${c.label}) 뒤에 값이 ${c.args.length}개 있어야 하는데 ${k}개뿐이다.`);
          if (!INT.test(raw)) return fail(`설정 ${n}(${c.label})의 값 '${raw.slice(0, 12)}'는 정수가 아니다.`);
          const v = Number(raw);
          if (v < a.min || v > a.max || (a.step > 1 && v % a.step !== 0)) return fail(`${c.args.length > 1 ? `${c.label}의 ${a.label}` : c.label} 값 ${DH.josa(fmt(v), '은', '는')} 쓸 수 없다. ${DonghyunLangAdapter.rangeText(a)}만 된다.`);
          vals.push(v);
        }
        if (c.check) { const why = c.check(vals, opt.ctx || {}); if (why) return fail(`설정 ${n}(${c.label}): ${why}`); }
        const item = { n, key: c.key, label: c.label, values: vals, text: c.show ? c.show(vals, opt.ctx || {}) : vals.map(fmt).join(' · ') };
        if (!c.multi) { const old = rep.settings.findIndex(s => s.n === n); if (old >= 0) rep.settings.splice(old, 1); }   // 뒤에 쓴 값이 이긴다
        rep.settings.push(item);
        if (c.multi) (rep.values[c.key] = rep.values[c.key] || []).push(vals); else rep.values[c.key] = vals.length === 1 ? vals[0] : vals;
        i += 1 + c.args.length;
      }
      if (this.validate) { const why = this.validate(rep.values, opt.ctx || {}); if (why) return fail(why); }      // 설정을 모두 읽은 뒤 서로 맞는지 본다
      return rep;
    }

    /** 동현랭 설정을 globalState에 덮어쓴다. 오류가 있으면 하나도 쓰지 않는다(상태는 그대로).
     *  @param {string} scriptText 동현랭 코드. 비었으면 아무것도 하지 않는다
     *  @param {object} state 게임의 globalState(기본값이 이미 들어 있는 객체)
     *  @param {object} [ctx] 검사에 쓸 자료(예: {world}) */
    applyDonghyunLang(scriptText, state, ctx = {}) {
      const rep = this.parse(scriptText, { ctx });
      rep.applied = [];
      if (!rep.ok || !state) return rep;
      return this._write(rep, state, ctx);
    }

    /** 설정 목록 [[번호, 값…], …]을 동현랭을 돌리지 않고 globalState에 덮어쓴다(저장한 판을 불러올 때).
     *  범위 · 자료 검사는 스크립트로 읽을 때와 같다. 오류가 있으면 하나도 쓰지 않는다. @returns 보고서 {ok, empty, settings, errors, applied} */
    applySettings(list, state, ctx = {}) {
      const rep = { ok: true, empty: false, name: this.name, output: '', steps: 0, settings: [], values: {}, errors: [], applied: [] };
      if (!Array.isArray(list) || list.length > 2000 || list.some(x => !Array.isArray(x) || !x.length || x.some(v => !Number.isInteger(v)))) { rep.ok = false; rep.errors.push('설정 목록은 [번호, 값…] 묶음의 목록이어야 한다.'); return rep; }
      if (!list.length) { rep.empty = true; return rep; }
      for (const x of list) { const c = this.commands.get(x[0]); if (c && x.length !== 1 + c.args.length) { rep.ok = false; rep.errors.push(`설정 ${x[0]}(${c.label})의 값은 ${c.args.length}개여야 한다.`); return rep; } }
      this._read(list.flat().map(String), rep, { ctx });
      if (!rep.ok || !state) return rep;
      return this._write(rep, state, ctx);
    }
    _write(rep, state, ctx) {
      for (const s of rep.settings) {
        const c = this.commands.get(s.n);
        if (c.set) c.set(state, s.values, ctx); else setPath(state, c.path, s.values.length === 1 ? s.values[0] : s.values);
        rep.applied.push(`${c.label} ${s.text}`);
      }
      return rep;
    }

    /** 설정 목록을 출력하는 동현랭 코드를 짓는다. list: [[번호, 값…], …] · title과 ctx는 주석 줄에만 쓴다 */
    compose(list, title, ctx = {}) {
      const out = [START]; if (title) out.push('ㅋㅋ ' + String(title).replace(/~/g, '-'));
      for (const [n, ...vals] of list) {
        const c = this.commands.get(n); if (!c) throw new Error(`설정 번호 ${n}이 없다`);
        if (vals.length !== c.args.length) throw new Error(`설정 ${n}(${c.label})의 값은 ${c.args.length}개여야 한다`);
        out.push(`ㅋㅋ ${n}번 ${c.label} = ${c.show ? c.show(vals, ctx) : vals.map(fmt).join(' · ')}`.replace(/~/g, '-'));
        for (const v of [n, ...vals]) out.push(printStatements(v).join('~'));
      }
      out.push(END);
      return out.join('\n');
    }
    /** 규약 표: [{n, label, range, hint, now}] — state를 주면 그 안의 값(기본값)도 적는다. 명령에 def가 있으면 그 글을 쓴다. */
    describe(state) {
      return [...this.commands.values()].sort((a, b) => a.n - b.n).map(c => ({ n: c.n, key: c.key, label: c.label, hint: c.hint || '',
        range: c.args.map(a => (c.args.length > 1 ? a.label + ' ' : '') + DonghyunLangAdapter.rangeText(a)).join(' · '),
        now: c.def !== undefined ? c.def : state && c.path ? getPath(state, c.path) : state && c.get ? c.get(state) : undefined }));
    }
  }

  Object.assign(DH, { DonghyunLangAdapter });
})(typeof globalThis !== 'undefined' ? globalThis : this);
