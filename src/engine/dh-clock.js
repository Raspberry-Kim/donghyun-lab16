/* 동현 공통 엔진 · 3/7 clock — 턴·일자 진행 관리자.
 * 두 가지 쓰임을 한 클래스로 받는다.
 *  · 턴제(동현삼): unit 'month', ticksPerUnit 0. 차례(actors)를 endPhase()로 넘기고, 한 바퀴 돌면 달이 넘어간다.
 *  · 흐르는 날짜(동현항): unit 'day', ticksPerUnit 30쯤. 루프 틱마다 update()가 쌓여 하루씩 간다. running·speed로 멈추고 빨리 감는다.
 * 사건: clock:phase {actor,index} · clock:turn {turn} · clock:day · clock:month · clock:year (모두 {year,month,day,serial} 포함) */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};
  const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const leap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const daysIn = (y, m) => (m === 2 && leap(y) ? 29 : DAYS[m - 1]);

  class Clock {
    /** @param {{unit?:'month'|'day', start?:{year:number,month?:number,day?:number}, ticksPerUnit?:number, actors?:any[], bus?:any}} o */
    constructor(o = {}) {
      this.unit = o.unit || 'month';
      const s = o.start || {};
      this.year = s.year || 1; this.month = s.month || 1; this.day = s.day || 1;
      this.ticksPerUnit = o.ticksPerUnit || 0;   // 0이면 저절로 흐르지 않는다
      this.running = false; this.speed = 1;
      this.serial = 0;                           // 시작부터 지난 단위 수(일 또는 달)
      this.turn = 1; this.actors = o.actors ? [...o.actors] : []; this.index = 0;
      this.bus = o.bus || new DH.EventBus();
      this._acc = 0;
    }
    get actor() { return this.actors.length ? this.actors[this.index] : null; }
    get date() { return { year: this.year, month: this.month, day: this.day, serial: this.serial }; }
    /** 지금 단위가 얼마나 지났는지 0~1(흐르는 날짜에서 움직임을 부드럽게 그릴 때). */
    get progress() { return this.ticksPerUnit ? this._acc / this.ticksPerUnit : 0; }
    get label() { return this.unit === 'day' ? `${this.year}년 ${this.month}월 ${this.day}일` : `${this.year}년 ${this.month}월`; }

    /** 루프 틱마다 부른다. 흐르는 날짜일 때만 일을 한다. */
    update() {
      if (!this.running || !this.ticksPerUnit) return;
      this._acc += this.speed;
      while (this._acc >= this.ticksPerUnit) { this._acc -= this.ticksPerUnit; this.advance(1); }
    }
    /** 단위를 n번 넘긴다. */
    advance(n = 1) {
      for (let i = 0; i < n; i++) {
        this.serial++;
        if (this.unit === 'day') {
          this.day++;
          if (this.day > daysIn(this.year, this.month)) { this.day = 1; this._nextMonth(); }
          this.bus.emit('clock:day', this.date);
        } else this._nextMonth();
      }
    }
    _nextMonth() {
      this.month++;
      const newYear = this.month > 12;
      if (newYear) { this.month = 1; this.year++; }
      this.bus.emit('clock:month', this.date);
      if (newYear) this.bus.emit('clock:year', this.date);
    }
    /** 차례를 정한다(세력 id 목록). */
    setActors(list) { this.actors = [...list]; this.index = 0; this.bus.emit('clock:phase', { actor: this.actor, index: 0, ...this.date }); }
    /** 지금 차례를 끝낸다. 마지막 차례였으면 단위를 하나 넘기고 새 턴을 연다. */
    endPhase() {
      if (this.index + 1 < this.actors.length) this.index++;
      else { this.index = 0; this.turn++; this.advance(1); this.bus.emit('clock:turn', { turn: this.turn, ...this.date }); }
      this.bus.emit('clock:phase', { actor: this.actor, index: this.index, ...this.date });
      return this.actor;
    }
    toJSON() { const { unit, year, month, day, serial, turn, index, actors, speed, _acc } = this; return { unit, year, month, day, serial, turn, index, actors, speed, acc: _acc }; }
    load(s) { Object.assign(this, { year: s.year, month: s.month, day: s.day, serial: s.serial, turn: s.turn, index: s.index, actors: [...s.actors], speed: s.speed, _acc: s.acc || 0 }); }
  }
  Clock.daysIn = daysIn;

  DH.Clock = Clock;
})(typeof globalThis !== 'undefined' ? globalThis : this);
