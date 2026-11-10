/* 동현 공통 엔진 · 6/7 layout — 화면 나누기: 위 정보 띠 · 가운데 캔버스 · 오른쪽(좁은 화면에서는 아래) 조작 창.
 * DOM을 한 번 짓고, 그 뒤로는 글자만 바꾼다. 자료에서 온 글은 textContent로만 넣는다(HTML로 풀지 않는다).
 *   setInfo([{label,value}]) 위 띠 · setDetail({title,rows:[[이름,값]],note}) 조작 창 위쪽 설명
 *   setMenu([{id,label,hint,disabled,primary}], onSelect) 조작 단추 · log(글) 기록 한 줄 */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};
  const el = (tag, cls, text) => { const e = root.document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

  class Layout {
    /** @param {HTMLElement} host @param {{title:string, width:number, height:number, panel?:'auto'|'right'|'bottom'}} o */
    constructor(host, o) {
      this.host = host;
      const app = this.root = el('div', 'dh-app'); app.dataset.panel = o.panel || 'auto';
      const top = el('header', 'dh-top');
      this.titleEl = el('strong', 'dh-title', o.title);
      this.infoEl = el('dl', 'dh-info');
      top.append(this.titleEl, this.infoEl);
      const body = el('div', 'dh-body');
      const stage = el('div', 'dh-stage');
      this.canvas = el('canvas', 'dh-canvas');
      this.canvas.setAttribute('role', 'img'); this.canvas.setAttribute('aria-label', o.title + ' 지도'); this.canvas.tabIndex = 0;
      stage.style.aspectRatio = `${o.width} / ${o.height}`;
      stage.append(this.canvas);
      const panel = el('aside', 'dh-panel'); panel.setAttribute('aria-label', '조작 창');
      this.detailEl = el('section', 'dh-detail');
      this.menuEl = el('div', 'dh-menu'); this.menuEl.setAttribute('role', 'group'); this.menuEl.setAttribute('aria-label', '명령');
      this.logEl = el('ol', 'dh-log'); this.logEl.setAttribute('aria-live', 'polite');
      panel.append(this.detailEl, this.menuEl, this.logEl);
      body.append(stage, panel); app.append(top, body);
      host.replaceChildren(app);
      this._info = [];
      this.menuEl.addEventListener('click', e => { const b = e.target.closest('button[data-id]'); if (b && !b.disabled && this._onSelect) this._onSelect(b.dataset.id); });
    }
    setInfo(items) {
      if (items.length !== this._info.length) {
        this.infoEl.replaceChildren(); this._info = items.map(it => { const w = el('div', 'dh-info-item'), dt = el('dt', null, it.label), dd = el('dd', null, ''); w.append(dt, dd); this.infoEl.append(w); return { dt, dd, v: null }; });
      }
      items.forEach((it, i) => { const s = this._info[i], v = String(it.value); if (s.v !== v) { s.dd.textContent = v; s.v = v; } if (s.dt.textContent !== it.label) s.dt.textContent = it.label; });
    }
    setDetail(d) {
      const kids = [el('h2', 'dh-detail-title', d.title)];
      if (d.rows && d.rows.length) { const dl = el('dl', 'dh-rows'); for (const [k, v] of d.rows) dl.append(el('dt', null, k), el('dd', null, String(v))); kids.push(dl); }
      if (d.note) kids.push(el('p', 'dh-note', d.note));
      this.detailEl.replaceChildren(...kids);
    }
    setMenu(items, onSelect) {
      this._onSelect = onSelect;
      this.menuEl.replaceChildren(...items.map(it => { const b = el('button', it.primary ? 'dh-btn dh-primary' : 'dh-btn', it.label); b.type = 'button'; b.dataset.id = it.id; if (it.hint) b.title = it.hint; b.disabled = !!it.disabled; return b; }));
    }
    log(text) { this.logEl.prepend(el('li', null, text)); while (this.logEl.children.length > 30) this.logEl.lastChild.remove(); }
    destroy() { this.root.remove(); }
  }

  DH.Layout = Layout;
})(typeof globalThis !== 'undefined' ? globalThis : this);
