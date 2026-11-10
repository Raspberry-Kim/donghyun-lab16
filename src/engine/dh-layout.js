/* 동현 공통 엔진 · 6/7 layout — 화면 나누기: 위 정보 띠 · 가운데 캔버스 · 오른쪽(좁은 화면에서는 아래) 조작 창.
 * DOM을 한 번 짓고, 그 뒤로는 글자만 바꾼다. 자료에서 온 글은 textContent로만 넣는다(HTML로 풀지 않는다).
 *   setInfo([{label,value}]) 위 띠 · setDetail({title,rows:[[이름,값]],note}) 조작 창 위쪽 설명
 *   setMenu([{id,label,hint,disabled,primary,key}], onSelect) 조작 단추 · log(글) 기록 한 줄
 *   press(n) · pressPrimary() 키보드로 단추 누르기(hotkeys를 켠 게임) */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};
  const el = (tag, cls, text) => { const e = root.document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

  class Layout {
    /** @param {HTMLElement} host @param {{title:string, width:number, height:number, panel?:'auto'|'right'|'bottom', hotkeys?:boolean}} o
     *  hotkeys를 켜면 조작 단추에 번호(1~9)가 붙고, 장면이 press(n)으로 그 단추를 누를 수 있다(키보드로 노는 게임). */
    constructor(host, o) {
      this.host = host; this.hotkeys = !!o.hotkeys;
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
      this.menuEl.addEventListener('click', e => { const b = e.target.closest('button[data-id]'); if (!b || b.disabled || !this._onSelect) return; this._onSelect(b.dataset.id);
        if (e.detail > 0) this.canvas.focus({ preventScroll: true }); });      // 마우스나 손가락으로 누른 뒤에는 키보드가 다시 지도에 듣는다(키보드로 누른 단추는 초점을 지킨다)
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
      const doc = root.document, lost = doc.activeElement && this.menuEl.contains(doc.activeElement); let n = 0;
      this.menuEl.replaceChildren(...items.map(it => {
        const b = el('button', it.primary ? 'dh-btn dh-primary' : 'dh-btn', it.label); b.type = 'button'; b.dataset.id = it.id; if (it.hint) b.title = it.hint; b.disabled = !!it.disabled;
        if (this.hotkeys && it.key !== false) {                 // 번호는 자리대로 붙는다(흐린 단추도 센다). key를 주면 그 글자를 적고 번호는 건너뛴다
          const k = it.key || (n < 9 ? String(++n) : '');
          if (k) { const mark = el('kbd', 'dh-key', k); mark.setAttribute('aria-hidden', 'true'); b.prepend(mark); if (!it.key) b.dataset.key = k; b.setAttribute('aria-keyshortcuts', k); }
        }
        return b; }));
      if (lost) this.canvas.focus({ preventScroll: true });     // 누른 단추가 사라져도 키보드가 지도에 남는다
    }
    /** 번호 n(1~9)이 붙은 단추를 누른다. 없거나 흐리면 false */
    press(n) { const b = this.menuEl.querySelector(`button[data-key="${n}"]`); if (!b || b.disabled || !this._onSelect) return false; this._onSelect(b.dataset.id); return true; }
    /** 강조된(노란) 단추를 누른다. 없거나 흐리면 false */
    pressPrimary() { const b = this.menuEl.querySelector('button.dh-primary'); if (!b || b.disabled || !this._onSelect) return false; this._onSelect(b.dataset.id); return true; }
    log(text) { this.logEl.prepend(el('li', null, text)); while (this.logEl.children.length > 30) this.logEl.lastChild.remove(); }
    destroy() { this.root.remove(); }
  }

  DH.Layout = Layout;
})(typeof globalThis !== 'undefined' ? globalThis : this);
