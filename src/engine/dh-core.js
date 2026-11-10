/* 동현 공통 엔진 · 1/7 core — 이름 공간 DH, 사건 버스, 씨앗 난수, 자료 검사기, JSON 읽기, 줄 길이 압축 풀기, 받침에 맞는 조사.
 * 모든 엔진 파일은 같은 꼴이다: 전역 DH에 붙이고(브라우저는 window.DH), node에서는 require로 같은 DH를 받는다.
 * 묶는 순서: core → loop → clock → grid → tilemap → layout → engine → (게임별 parser → scene) */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};
  DH.VERSION = '0.01-draft';

  /** 사건 버스. on()은 끊는 함수를 돌려준다. */
  class EventBus {
    constructor() { this._m = new Map(); }
    on(type, fn) {
      if (!this._m.has(type)) this._m.set(type, new Set());
      this._m.get(type).add(fn);
      return () => this._m.get(type).delete(fn);
    }
    emit(type, payload) {
      const s = this._m.get(type);
      if (s) for (const fn of [...s]) fn(payload, type);
    }
  }

  /** 씨앗 난수(mulberry32). 같은 씨앗이면 같은 판. state를 저장하면 이어서 같은 수가 나온다. */
  class RNG {
    constructor(seed = 1) { this.state = seed >>> 0; }
    next() {
      let t = (this.state = (this.state + 0x6D2B79F5) >>> 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    int(n) { return Math.floor(this.next() * n); }            // 0 … n-1
    range(a, b) { return a + this.int(b - a + 1); }           // a … b
    pick(arr) { return arr[this.int(arr.length)]; }
  }

  /** 자료가 규격과 다를 때 던진다. problems에 틀린 곳이 모두 들어 있다(첫 하나에서 멈추지 않는다). */
  class DataError extends Error {
    constructor(title, problems) {
      super(`${title}: 자료 오류 ${problems.length}곳\n- ` + problems.slice(0, 20).join('\n- '));
      this.name = 'DataError'; this.problems = problems;
    }
  }

  /** 자료 검사기. 틀린 곳을 모았다가 done()에서 한꺼번에 던진다. */
  class Checker {
    constructor(title) { this.title = title; this.problems = []; }
    fail(where, msg) { this.problems.push(`${where}: ${msg}`); return false; }
    ok(cond, where, msg) { return cond ? true : this.fail(where, msg); }
    int(v, where, min = -Infinity, max = Infinity) {
      return this.ok(Number.isInteger(v) && v >= min && v <= max, where, `정수 ${min}~${max}이어야 한다(받은 값 ${JSON.stringify(v)})`);
    }
    num(v, where, min = -Infinity, max = Infinity) {
      return this.ok(typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max, where, `수 ${min}~${max}이어야 한다(받은 값 ${JSON.stringify(v)})`);
    }
    str(v, where) { return this.ok(typeof v === 'string' && v.length > 0, where, '빈 글이 아니어야 한다'); }
    arr(v, where, len) {
      return this.ok(Array.isArray(v) && (len === undefined || v.length === len), where, len === undefined ? '배열이어야 한다' : `길이 ${len}인 배열이어야 한다(받은 길이 ${Array.isArray(v) ? v.length : '없음'})`);
    }
    oneOf(v, list, where) { return this.ok(list.includes(v), where, `${list.join(' · ')} 가운데 하나여야 한다(받은 값 ${JSON.stringify(v)})`); }
    /** 배열에서 id가 겹치지 않는 Map을 만든다. */
    index(list, where) {
      const m = new Map();
      (list || []).forEach((o, i) => {
        if (o == null || o.id === undefined) return this.fail(`${where}[${i}]`, 'id가 없다');
        if (m.has(o.id)) return this.fail(`${where}[${i}]`, `id ${o.id}가 겹친다`);
        m.set(o.id, o);
      });
      return m;
    }
    done() { if (this.problems.length) throw new DataError(this.title, this.problems); }
  }

  const Data = {
    /** JSON 읽기. 객체면 그대로, '#id'면 페이지에 심은 <script type="application/json">, 그 밖에는 주소로 가져온다.
     *  한 장으로 묶은 index.html은 file://에서도 열려야 하므로 '#id' 길을 둔다. */
    async load(src) {
      if (src && typeof src === 'object') return src;
      if (typeof src === 'string' && src[0] === '#') {
        const el = root.document && root.document.getElementById(src.slice(1));
        if (!el) throw new Error(`심어 둔 자료 ${src}가 없다`);
        return JSON.parse(el.textContent);
      }
      const res = await fetch(src);
      if (!res.ok) throw new Error(`${src}: ${res.status}`);
      return res.json();
    },
    /** 줄 길이 압축 풀기. "12~3#~" → ~ 12칸, # 3칸, ~ 1칸. 줄마다 길이가 cols인지 본다. */
    rleDecode(rows, cols, chk, where = 'map.rle') {
      return rows.map((s, r) => {
        let out = '', n = '';
        for (const ch of s) {
          if (ch >= '0' && ch <= '9') { n += ch; continue; }
          out += ch.repeat(n === '' ? 1 : +n); n = '';
        }
        if (chk && (out.length !== cols || n !== '')) chk.fail(`${where}[${r}]`, `풀면 ${out.length}칸이다(${cols}칸이어야 한다)`);
        return out;
      });
    },
    /** 공통 머리 검사: format 이름과 version. */
    header(json, format, version, chk) {
      chk.ok(json && json.format === format, 'format', `"${format}"이어야 한다`);
      chk.ok(json && json.version === version, 'version', `${version}이어야 한다(받은 값 ${json && json.version})`);
    }
  };

  /** 받침에 맞는 조사. josa('관우','이','가') → '관우가'. 숫자로 끝나면 읽는 소리로 가린다. ro()는 '(으)로'. */
  const tail = w => { const ch = String(w).slice(-1), k = ch.charCodeAt(0);
    if (k >= 0xAC00 && k <= 0xD7A3) return (k - 0xAC00) % 28;                       // 0 받침 없음 · 8 ㄹ
    if (ch >= '0' && ch <= '9') return '013678'.includes(ch) ? ('178'.includes(ch) ? 8 : 1) : 0;   // 영·일·삼·육·칠·팔은 받침, 일·칠·팔은 ㄹ
    return 0; };
  const josa = (w, a, b) => w + (tail(w) ? a : b);
  const ro = w => w + (tail(w) && tail(w) !== 8 ? '으로' : '로');

  Object.assign(DH, { EventBus, RNG, DataError, Checker, Data, josa, ro });
  if (typeof module !== 'undefined' && module.exports) module.exports = DH;
})(typeof globalThis !== 'undefined' ? globalThis : this);
