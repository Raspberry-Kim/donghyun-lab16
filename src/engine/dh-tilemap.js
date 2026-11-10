/* 동현 공통 엔진 · 5/7 tilemap — 카메라와 타일 맵 공통 렌더러.
 * 격자가 사각이든 육각이든 같은 코드로 그린다: 화면에 걸친 칸만 고르고(range), 같은 색끼리 한 경로로 모아 칠한다.
 * 사각 격자는 한 줄에서 이어진 같은 타일을 긴 네모 하나로 합친다(세계 지도처럼 칸이 많을 때 빠르다). */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};

  /** 세계 좌표의 어디를 화면에 비추는지. x,y는 화면 왼쪽 위에 오는 세계 좌표. */
  class Camera {
    constructor(viewW, viewH) { this.x = 0; this.y = 0; this.zoom = 1; this.viewW = viewW; this.viewH = viewH; this.minZoom = 0.5; this.maxZoom = 4; }
    toWorld(sx, sy) { return { x: this.x + sx / this.zoom, y: this.y + sy / this.zoom }; }
    toScreen(wx, wy) { return { x: (wx - this.x) * this.zoom, y: (wy - this.y) * this.zoom }; }
    centerOn(wx, wy) { this.x = wx - this.viewW / this.zoom / 2; this.y = wy - this.viewH / this.zoom / 2; }
    pan(dsx, dsy) { this.x -= dsx / this.zoom; this.y -= dsy / this.zoom; }
    /** 화면의 (sx,sy)가 가리키는 세계 지점을 붙든 채 확대·축소한다. */
    zoomAt(factor, sx, sy) {
      const w = this.toWorld(sx, sy);
      this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * factor));
      this.x = w.x - sx / this.zoom; this.y = w.y - sy / this.zoom;
    }
    /** 격자 밖으로 나가지 않게 붙든다. 지도가 화면보다 작으면 가운데에 둔다. 동서로 이어진 지도는 x를 한 바퀴 안으로 접는다. */
    clampTo(grid) {
      const vw = this.viewW / this.zoom, vh = this.viewH / this.zoom;
      if (grid.wrapX) this.x = ((this.x % grid.width) + grid.width) % grid.width;
      else this.x = grid.width <= vw ? (grid.width - vw) / 2 : Math.min(grid.width - vw, Math.max(0, this.x));
      this.y = grid.height <= vh ? (grid.height - vh) / 2 : Math.min(grid.height - vh, Math.max(0, this.y));
    }
  }

  class TileMapRenderer {
    /** @param {{grid:any, tileAt:(c:number,r:number)=>string, styles:Object<string,{fill:string}>, line?:string}} o
     *  tileAt은 타일 이름(글자)을 돌려준다. styles가 그 이름의 칠을 정한다. line을 주면 칸 테두리를 긋는다. */
    constructor(o) { this.grid = o.grid; this.tileAt = o.tileAt; this.styles = o.styles; this.line = o.line || null; this.drawn = 0; }
    /** 카메라 변환을 걸고 fn(g)를 세계 좌표로 부른다. 장면이 지도 위에 도시·배·길을 얹을 때 쓴다. */
    world(g, cam, fn) { g.save(); g.scale(cam.zoom, cam.zoom); g.translate(-cam.x, -cam.y); fn(g); g.restore(); }
    render(g, cam) {
      const grid = this.grid, vw = cam.viewW / cam.zoom, vh = cam.viewH / cam.zoom;
      const R = grid.range(cam.x, cam.y, cam.x + vw, cam.y + vh);
      const buckets = new Map(); let n = 0;
      const put = (t, fn) => { let b = buckets.get(t); if (!b) buckets.set(t, b = []); b.push(fn); };
      for (let r = R.r0; r <= R.r1; r++) {
        if (grid.kind === 'square') {
          let runT = null, runC = 0;
          for (let c = R.c0; c <= R.c1 + 1; c++) {
            const t = c <= R.c1 ? this.tileAt(grid.normC(c), r) : null;
            if (t !== runT) {
              if (runT !== null) { const a = runC, w = c - runC; put(runT, [a * grid.size, r * grid.size, w * grid.size, grid.size]); n += w; }
              runT = t; runC = c;
            }
          }
        } else for (let c = R.c0; c <= R.c1; c++) { put(this.tileAt(c, r), [c, r]); n++; }
      }
      this.drawn = n;
      this.world(g, cam, () => {
        for (const [t, list] of buckets) {
          g.beginPath();
          if (grid.kind === 'square') for (const q of list) g.rect(q[0], q[1], q[2] + 0.5 / cam.zoom, q[3] + 0.5 / cam.zoom);   // 반 픽셀 겹쳐 틈이 보이지 않게
          else for (const q of list) grid.trace(g, q[0], q[1]);
          g.fillStyle = (this.styles[t] || this.styles.default || { fill: '#f0f' }).fill; g.fill();
          if (this.line && grid.kind !== 'square') { g.strokeStyle = this.line; g.lineWidth = 1 / cam.zoom; g.stroke(); }
        }
      });
    }
  }

  /** 칸마다 가장 가까운 뭍까지의 걸음 수(뭍은 0, 뭍이 없으면 Infinity). r*cols+c 자리에 담는다. 바다를 깊이로 칠할 때 쓴다. */
  function shoreDistance(grid, isLand) {
    const n = grid.cols * grid.rows, d = new Float64Array(n).fill(Infinity), q = [];
    for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) if (isLand(c, r)) { d[r * grid.cols + c] = 0; q.push(c, r); }
    for (let i = 0; i < q.length; i += 2) {
      const c = q[i], r = q[i + 1], k = d[r * grid.cols + c] + 1;
      for (const [nc, nr] of grid.neighbors(c, r)) { const j = nr * grid.cols + nc; if (d[j] > k) { d[j] = k; q.push(nc, nr); } }
    }
    return d;
  }
  /** 두 색(#rrggbb)을 t(0~1)만큼 섞는다. */
  function mixColor(a, b, t) {
    const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), x = p(a), y = p(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }

  Object.assign(DH, { Camera, TileMapRenderer, shoreDistance, mixColor });
})(typeof globalThis !== 'undefined' ? globalThis : this);
