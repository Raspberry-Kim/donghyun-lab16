/* 동현 공통 엔진 · 7/7 engine — Engine과 Scene. 두 게임이 똑같이 쓰는 뼈대다.
 * Engine이 갖는 것: 캔버스(고해상도 맞춤 · fit) · 루프(Loop) · 달력(Clock) · 난수(RNG) · 사건 버스 · 장면 쌓기 · 입력(찍기·끌기·바퀴·키).
 * 게임은 Scene을 이어받아 update(tick)·render(g,alpha)·onTap/onDrag/onWheel/onKey만 채운다. 규칙과 자료는 게임 쪽에 둔다. */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};

  class Scene {
    constructor(engine) { this.engine = engine; }
    enter() {} exit() {}
    update(tick) {}                 // 논리 틱(초당 60번)
    render(g, alpha) {}             // 그리기. 좌표는 논리 크기(engine.width × engine.height)
    onTap(x, y) {} onDrag(dx, dy, x, y) {} onWheel(delta, x, y) {} onKey(code, ev) {}
    save() { return null; }         // 저장할 장면 상태(없으면 null)
  }

  /** 지도 장면의 공통 바탕: 격자 + 카메라 + 타일 렌더러, 끌어서 옮기기 · 바퀴/+−로 확대 · 화살표로 옮기기.
   *  게임 장면은 이것을 이어받아 drawOver(g)에서 지도 위 그림(도시·배·길)을 세계 좌표로 그린다. */
  class MapScene extends Scene {
    /** @param {{grid:any, tileAt:Function, styles:object, line?:string, minZoom?:number, maxZoom?:number}} o */
    setupMap(o) {
      const e = this.engine;
      this.grid = o.grid; this.cam = new DH.Camera(e.width, e.height);
      this.cam.minZoom = o.minZoom ?? 1; this.cam.maxZoom = o.maxZoom ?? 4;
      this.tiles = new DH.TileMapRenderer({ grid: o.grid, tileAt: o.tileAt, styles: o.styles, line: o.line });
      this.cam.centerOn(o.grid.width / 2, o.grid.height / 2); this.cam.clampTo(o.grid);
    }
    zoomBy(f, sx = this.engine.width / 2, sy = this.engine.height / 2) { this.cam.zoomAt(f, sx, sy); this.cam.clampTo(this.grid); }
    onDrag(dx, dy) { this.cam.pan(dx, dy); this.cam.clampTo(this.grid); this.follow = false; }
    onWheel(delta, x, y) { this.zoomBy(delta < 0 ? 1.15 : 1 / 1.15, x, y); }
    onKey(code, ev) {
      const step = 24, k = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[code];
      if (k) { this.onDrag(k[0], k[1]); ev && ev.preventDefault(); }
      else if (code === 'Equal' || code === 'NumpadAdd') this.zoomBy(1.25);
      else if (code === 'Minus' || code === 'NumpadSubtract') this.zoomBy(0.8);
    }
    /** 화면 좌표가 가리키는 칸({c,r}) 또는 null */
    cellAt(sx, sy) { const w = this.cam.toWorld(sx, sy); return this.grid.fromPixel(w.x, w.y); }
    render(g) { this.tiles.render(g, this.cam); this.tiles.world(g, this.cam, () => this.drawOver(g)); }
    drawOver(g) {}
  }

  class Engine {
    /** @param {{canvas?:HTMLCanvasElement, width?:number, height?:number, seed?:number, clock?:object, hz?:number, background?:string}} o
     *  canvas 없이 만들면 그리기·입력 없이 논리만 돈다(node 시험). */
    constructor(o = {}) {
      this.width = o.width || 480; this.height = o.height || 360;
      this.background = o.background || '#221e1a';
      this.bus = new DH.EventBus();
      this.rng = new DH.RNG(o.seed ?? 1);
      this.clock = new DH.Clock({ ...(o.clock || {}), bus: this.bus });
      this.scenes = [];
      this.loop = new DH.Loop({ hz: o.hz || 60, update: t => this._update(t), render: a => this._render(a) });
      this.canvas = o.canvas || null; this.g = null;
      if (this.canvas) { this._fit(); this._bindInput(); }
    }
    get scene() { return this.scenes[this.scenes.length - 1] || null; }
    get tick() { return this.loop.tick; }
    on(type, fn) { return this.bus.on(type, fn); }

    /** 장면을 바꾼다(쌓인 것을 모두 내리고). push/pop은 메뉴·전투처럼 위에 얹는 장면에 쓴다. */
    setScene(scene) { while (this.scenes.length) this.scenes.pop().exit(); this.scenes.push(scene); scene.enter(); return scene; }
    pushScene(scene) { this.scenes.push(scene); scene.enter(); return scene; }
    popScene() { const s = this.scenes.pop(); if (s) s.exit(); return s; }

    start() { this.loop.start(); }
    stop() { this.loop.stop(); }
    step(n = 1) { this.loop.step(n); }

    _update(tick) { this.clock.update(); const s = this.scene; if (s) s.update(tick); }   // 맨 위 장면만 논리가 돈다
    _render(alpha) {
      const g = this.g; if (!g) return;
      g.setTransform(this._scale, 0, 0, this._scale, 0, 0);
      g.fillStyle = this.background; g.fillRect(0, 0, this.width, this.height);
      for (const s of this.scenes) { g.save(); s.render(g, alpha); g.restore(); }           // 아래 장면부터 겹쳐 그린다
    }
    /** 캔버스 안쪽 해상도를 화면 배율에 맞춘다(글자·선이 흐리지 않게). 논리 좌표는 그대로다.
     *  cssWidth(화면에 보이는 캔버스 폭, CSS px)를 주면 그 크기에서도 또렷하도록 배율을 4배까지 올린다(전체 화면). */
    _fit(cssWidth) {
      const dpr = Math.min(3, Math.max(1, Math.round(root.devicePixelRatio || 1)));
      const scale = cssWidth > 0 ? Math.min(4, Math.max(dpr, Math.ceil(cssWidth * dpr / this.width - 0.01))) : dpr;
      if (scale === this._scale && this.g) return;
      this._scale = scale; this.canvas.width = this.width * scale; this.canvas.height = this.height * scale;
      this.g = this.canvas.getContext('2d');
    }
    /** 캔버스가 화면에서 커지거나 작아진 뒤에 부른다. cssWidth 없이 부르면 화면 배율로 되돌린다. 루프가 멈춰 있어도 한 번 다시 그린다. */
    fit(cssWidth) { if (!this.canvas) return; this._fit(cssWidth); this._render(1); }
    /** 화면 좌표 → 논리 좌표 */
    _pt(ev) { const b = this.canvas.getBoundingClientRect(); return { x: (ev.clientX - b.left) * this.width / b.width, y: (ev.clientY - b.top) * this.height / b.height }; }
    _bindInput() {
      const cv = this.canvas; let down = null;
      const off = [];
      const add = (t, type, fn, opt) => { t.addEventListener(type, fn, opt); off.push(() => t.removeEventListener(type, fn, opt)); };
      add(cv, 'pointerdown', ev => { const p = this._pt(ev); down = { id: ev.pointerId, x: p.x, y: p.y, moved: false }; cv.setPointerCapture(ev.pointerId); });
      add(cv, 'pointermove', ev => {
        if (!down || ev.pointerId !== down.id) return;
        const p = this._pt(ev), dx = p.x - down.x, dy = p.y - down.y;
        if (!down.moved && Math.hypot(dx, dy) < 6) return;       // 6px 안쪽 떨림은 찍기로 본다
        down.moved = true; down.x = p.x; down.y = p.y;
        if (this.scene) this.scene.onDrag(dx, dy, p.x, p.y);
      });
      add(cv, 'pointerup', ev => { if (!down || ev.pointerId !== down.id) return; const p = this._pt(ev), tap = !down.moved; down = null; if (tap && this.scene) this.scene.onTap(p.x, p.y); });
      add(cv, 'pointercancel', () => { down = null; });
      add(cv, 'wheel', ev => { ev.preventDefault(); const p = this._pt(ev); if (this.scene) this.scene.onWheel(ev.deltaY, p.x, p.y); }, { passive: false });
      add(cv, 'keydown', ev => { if (this.scene) this.scene.onKey(ev.code, ev); });
      if (root.document) add(root.document, 'visibilitychange', () => { if (root.document.hidden) { this._wasRunning = this.loop.running; this.stop(); } else if (this._wasRunning) this.start(); });
      this._off = off;
    }
    /** 저장용 묶음: 틱·달력·난수·맨 위 장면 상태. */
    snapshot() { return { engine: DH.VERSION, tick: this.loop.tick, clock: this.clock.toJSON(), rng: this.rng.state, scene: this.scene ? this.scene.save() : null }; }
    destroy() { this.stop(); while (this.scenes.length) this.scenes.pop().exit(); if (this._off) this._off.forEach(f => f()); }
  }

  Object.assign(DH, { Scene, MapScene, Engine });
})(typeof globalThis !== 'undefined' ? globalThis : this);
