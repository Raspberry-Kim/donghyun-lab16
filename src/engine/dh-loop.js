/* 동현 공통 엔진 · 2/7 loop — 60FPS 그리기 루프와 고정 간격 논리 틱.
 * 그리기는 화면 주사율을 따르고(requestAnimationFrame), 논리는 1/60초씩 고정으로 돈다. 그래서 120Hz 화면에서도 게임 속도가 같다.
 * 시험은 start() 없이 step(n)으로 틱을 직접 돌린다(시간에 기대지 않는다). */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};

  class Loop {
    /** @param {{update:(tick:number)=>void, render:(alpha:number)=>void, hz?:number, maxSteps?:number}} o */
    constructor(o) {
      this.update = o.update; this.render = o.render;
      this.hz = o.hz || 60; this.dt = 1000 / this.hz;
      this.maxSteps = o.maxSteps || 5;          // 한 프레임에 따라잡는 틱 상한(탭이 멈췄다 돌아올 때 폭주를 막는다)
      this.tick = 0; this.running = false; this.fps = 0;
      this._acc = 0; this._last = 0; this._raf = 0; this._fpsN = 0; this._fpsT = 0;
      this._frame = this._frame.bind(this);
    }
    start() {
      if (this.running) return;
      this.running = true; this._last = 0; this._acc = 0;
      this._raf = root.requestAnimationFrame(this._frame);
    }
    stop() { this.running = false; if (this._raf) root.cancelAnimationFrame(this._raf); this._raf = 0; }
    /** 논리 틱 n번과 그리기 한 번. 시험·한 걸음 실행용. */
    step(n = 1) { for (let i = 0; i < n; i++) this.update(this.tick++); this.render(0); }
    _frame(now) {
      if (!this.running) return;
      if (!this._last) { this._last = now; this._fpsT = now; }
      this._acc += now - this._last; this._last = now;
      let n = 0;
      while (this._acc >= this.dt && n < this.maxSteps) { this.update(this.tick++); this._acc -= this.dt; n++; }
      if (n === this.maxSteps) this._acc = 0;   // 밀린 시간은 버린다
      this.render(this._acc / this.dt);
      if (++this._fpsN >= 30) { this.fps = Math.round(30000 / (now - this._fpsT)); this._fpsN = 0; this._fpsT = now; }
      this._raf = root.requestAnimationFrame(this._frame);
    }
  }

  DH.Loop = Loop;
})(typeof globalThis !== 'undefined' ? globalThis : this);
