/* 동현 공통 엔진 · 4/7 grid — 사각·육각 격자의 기하, 길 찾기, 노드 그래프.
 * 두 격자는 같은 메서드를 갖는다. 렌더러·길 찾기·장면은 어느 격자인지 묻지 않고 이 메서드만 쓴다.
 *   inBounds(c,r) · center(c,r)→{x,y} · fromPixel(x,y)→{c,r}|null · neighbors(c,r)→[[c,r]…] · distance(c1,r1,c2,r2)
 *   trace(g,c,r) 칸 윤곽을 경로에 더한다 · range(x0,y0,x1,y1) 그 네모에 걸치는 칸 범위 · width/height 전체 픽셀 크기
 * 좌표는 모두 (c 열, r 줄)이고 픽셀은 격자 왼쪽 위가 (0,0)인 '세계 좌표'다. */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};
  const SQ3 = Math.sqrt(3);

  class SquareGrid {
    /** @param {{wrapX?:boolean, diagonal?:boolean}} o wrapX: 동서로 이어진 세계 지도. diagonal: 대각 이동을 이웃으로 친다. */
    constructor(cols, rows, size, o = {}) {
      this.kind = 'square'; this.cols = cols; this.rows = rows; this.size = size;
      this.wrapX = !!o.wrapX; this.diagonal = !!o.diagonal;
      this.width = cols * size; this.height = rows * size;
    }
    normC(c) { return this.wrapX ? ((c % this.cols) + this.cols) % this.cols : c; }
    inBounds(c, r) { return r >= 0 && r < this.rows && (this.wrapX || (c >= 0 && c < this.cols)); }
    center(c, r) { return { x: (c + 0.5) * this.size, y: (r + 0.5) * this.size }; }
    fromPixel(x, y) {
      const c = Math.floor(x / this.size), r = Math.floor(y / this.size);
      return this.inBounds(c, r) ? { c: this.normC(c), r } : null;
    }
    neighbors(c, r) {
      const out = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dc && !dr) continue;
        if (!this.diagonal && dc && dr) continue;
        if (this.inBounds(c + dc, r + dr)) out.push([this.normC(c + dc), r + dr]);
      }
      return out;
    }
    /** 대각으로 한 칸 갈 때, 그 모서리를 낀 두 칸이 모두 막혔으면 참. 길 찾기가 이 걸음을 버린다.
     *  이 검사가 없으면 대각으로 놓인 땅(지협·반도) 사이를 배가 빠져나간다. */
    squeezed(c, r, nc, nr, passable) {
      if (nr === r) return false;
      let dc = nc - c; if (this.wrapX) { if (dc > 1) dc -= this.cols; else if (dc < -1) dc += this.cols; }
      if (!dc) return false;
      return !passable(this.normC(c + dc), r) && !passable(c, nr);
    }
    /** 한 걸음의 값. 대각은 아주 조금 비싸게 쳐서, 칸 수가 같은 길 가운데 덜 꺾이는 길을 고르게 한다(칸 수는 그대로). */
    stepCost(c, r, nc, nr) { return nr !== r && nc !== c ? 1 + 1 / 1024 : 1; }
    distance(c1, r1, c2, r2) {
      let dx = Math.abs(c1 - c2); const dy = Math.abs(r1 - r2);
      if (this.wrapX) dx = Math.min(dx, this.cols - dx);
      return this.diagonal ? Math.max(dx, dy) : dx + dy;
    }
    trace(g, c, r) { g.rect(c * this.size, r * this.size, this.size, this.size); }
    range(x0, y0, x1, y1) {
      const s = this.size;
      let c0 = Math.floor(x0 / s), c1 = Math.floor(x1 / s);
      if (!this.wrapX) { c0 = Math.max(0, c0); c1 = Math.min(this.cols - 1, c1); }
      return { c0, c1, r0: Math.max(0, Math.floor(y0 / s)), r1: Math.min(this.rows - 1, Math.floor(y1 / s)) };
    }
    /** wrapX 지도에서 x를 기준점 ref에 가장 가까운 바퀴로 옮긴다(배·항구를 화면 쪽 사본에 그릴 때). */
    nearX(x, ref) { return this.wrapX ? x + Math.round((ref - x) / this.width) * this.width : x; }
  }

  /** 육각 격자. 뾰족한 쪽이 위, 홀수 줄을 오른쪽으로 반 칸 민다(odd-r). size는 가운데에서 꼭짓점까지. */
  class HexGrid {
    constructor(cols, rows, size) {
      this.kind = 'hex'; this.cols = cols; this.rows = rows; this.size = size;
      this.w = SQ3 * size; this.rowStep = 1.5 * size;
      this.width = this.w * (cols + 0.5); this.height = size * (1.5 * rows + 0.5);
      this._corner = [0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 180 * (60 * i - 30); return [Math.cos(a) * size, Math.sin(a) * size]; });
    }
    inBounds(c, r) { return c >= 0 && c < this.cols && r >= 0 && r < this.rows; }
    center(c, r) { return { x: this.w * (c + 0.5 + (r & 1) * 0.5), y: this.size * (1 + 1.5 * r) }; }
    fromPixel(x, y) {
      const px = x - this.w / 2, py = y - this.size;
      let q = (SQ3 / 3 * px - py / 3) / this.size, r = (2 / 3 * py) / this.size;
      // 정육면체 좌표로 반올림
      let cx = q, cz = r, cy = -cx - cz;
      let rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
      const dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
      if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
      const col = rx + (rz - (rz & 1)) / 2;
      return this.inBounds(col, rz) ? { c: col + 0, r: rz + 0 } : null;   // +0: 반올림에서 나온 -0을 0으로
    }
    neighbors(c, r) {
      const d = r & 1 ? [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]] : [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
      const out = [];
      for (const [dc, dr] of d) if (this.inBounds(c + dc, r + dr)) out.push([c + dc, r + dr]);
      return out;
    }
    distance(c1, r1, c2, r2) {
      const x1 = c1 - (r1 - (r1 & 1)) / 2, x2 = c2 - (r2 - (r2 & 1)) / 2;
      const dx = x1 - x2, dz = r1 - r2;
      return Math.max(Math.abs(dx), Math.abs(dz), Math.abs(dx + dz));
    }
    trace(g, c, r) {
      const { x, y } = this.center(c, r), k = this._corner;
      g.moveTo(x + k[0][0], y + k[0][1]);
      for (let i = 1; i < 6; i++) g.lineTo(x + k[i][0], y + k[i][1]);
      g.closePath();
    }
    range(x0, y0, x1, y1) {
      return {
        c0: Math.max(0, Math.floor(x0 / this.w) - 1), c1: Math.min(this.cols - 1, Math.floor(x1 / this.w)),
        r0: Math.max(0, Math.floor((y0 - this.size * 2) / this.rowStep)), r1: Math.min(this.rows - 1, Math.floor(y1 / this.rowStep))
      };
    }
    nearX(x) { return x; }
  }

  /** A* 길 찾기. 어느 격자든 neighbors·distance만 쓴다. passable(c,r)이 참인 칸으로만 간다. 못 가면 null.
   *  격자에 squeezed가 있으면(사각 격자) 막힌 두 칸 사이의 대각 걸음은 가지 않는다.
   *  @returns {Array<[number,number]>|null} 출발 칸을 뺀 경로 */
  function findPath(grid, from, to, passable, maxNodes = 200000) {
    const key = (c, r) => r * grid.cols + c;
    const goal = key(to[0], to[1]), start = key(from[0], from[1]);
    if (start === goal) return [];
    const gS = new Map([[start, 0]]), came = new Map();
    const heap = [[grid.distance(from[0], from[1], to[0], to[1]), from[0], from[1]]];
    const push = n => { let i = heap.push(n) - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) { heap[0] = last; let i = 0; for (;;) { let m = i; const l = 2 * i + 1, r = l + 1; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } }
      return top;
    };
    let seen = 0;
    while (heap.length && seen++ < maxNodes) {
      const [, c, r] = pop(), k = key(c, r);
      if (k === goal) {
        const path = []; let cur = k;
        while (cur !== start) { path.push([cur % grid.cols, Math.floor(cur / grid.cols)]); cur = came.get(cur); }
        return path.reverse();
      }
      const base = gS.get(k);
      for (const [nc, nr] of grid.neighbors(c, r)) {
        const nk = key(nc, nr);
        if (nk !== goal && !passable(nc, nr)) continue;
        if (grid.squeezed && grid.squeezed(c, r, nc, nr, passable)) continue;
        const cost = base + (grid.stepCost ? grid.stepCost(c, r, nc, nr) : 1);
        if (cost < (gS.get(nk) ?? Infinity)) { gS.set(nk, cost); came.set(nk, k); push([cost + grid.distance(nc, nr, to[0], to[1]), nc, nr]); }
      }
    }
    return null;
  }

  /** 이동 범위. from에서 budget 안에 닿는 칸을 모두 찾는다. cost(c,r)는 그 칸에 들어가는 값이고 Infinity면 못 들어간다.
   *  @returns {Map<string,{c:number,r:number,cost:number,from:string|null}>} 열쇠는 'c,r'. 출발 칸(값 0)도 들어 있다. from을 거슬러 가면 온 길이다. */
  function moveRange(grid, from, budget, cost) {
    const k0 = from[0] + ',' + from[1], out = new Map([[k0, { c: from[0], r: from[1], cost: 0, from: null }]]), open = [k0];
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (out.get(open[i]).cost < out.get(open[bi]).cost) bi = i;      // 칸이 적으니 줄 세우지 않고 가장 싼 것을 고른다
      const k = open.splice(bi, 1)[0], cur = out.get(k);
      for (const [nc, nr] of grid.neighbors(cur.c, cur.r)) {
        if (grid.squeezed && grid.squeezed(cur.c, cur.r, nc, nr, (c, r) => cost(c, r) !== Infinity)) continue;
        const v = cur.cost + cost(nc, nr), nk = nc + ',' + nr, old = out.get(nk);
        if (v > budget || (old && old.cost <= v)) continue;
        out.set(nk, { c: nc, r: nr, cost: v, from: k }); if (!open.includes(nk)) open.push(nk);
      }
    }
    return out;
  }

  /** 노드 그래프(주 사이 인접). 인접 목록 Map<id, id[]>으로 만든다. */
  class Graph {
    constructor(adj) { this.adj = adj; }
    neighbors(id) { return this.adj.get(id) || []; }
    has(a, b) { return this.neighbors(a).includes(b); }
    /** 한쪽에만 적힌 간선을 [a,b] 목록으로 돌려준다(없어야 정상). */
    oneWay() { const out = []; for (const [a, list] of this.adj) for (const b of list) if (!this.has(b, a)) out.push([a, b]); return out; }
    /** 이어진 덩어리들. 하나여야 모든 주가 서로 닿는다. */
    components() {
      const seen = new Set(), out = [];
      for (const s of this.adj.keys()) {
        if (seen.has(s)) continue;
        const comp = [], q = [s]; seen.add(s);
        while (q.length) { const a = q.shift(); comp.push(a); for (const b of this.neighbors(a)) if (this.adj.has(b) && !seen.has(b)) { seen.add(b); q.push(b); } }
        out.push(comp);
      }
      return out;
    }
    /** 가장 적은 걸음의 길(출발·도착 포함). 없으면 null. via(id)가 거짓인 노드는 지나지 않는다. */
    path(a, b, via = () => true) {
      const prev = new Map([[a, null]]), q = [a];
      while (q.length) {
        const x = q.shift();
        if (x === b) { const p = []; for (let y = b; y !== null; y = prev.get(y)) p.push(y); return p.reverse(); }
        for (const y of this.neighbors(x)) if (!prev.has(y) && (y === b || via(y))) { prev.set(y, x); q.push(y); }
      }
      return null;
    }
  }

  Object.assign(DH, { SquareGrid, HexGrid, findPath, moveRange, Graph });
})(typeof globalThis !== 'undefined' ? globalThis : this);
