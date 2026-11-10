/* 동현삼 앱: 공통 엔진의 지도 장면을 A 칸에 띄우고, B 칸의 동현랭 편집기가 설정을 읽어 새 판을 연다.
 * 편집기(줄 번호 · 색 입히기 · 들여쓰기 · .dh 저장과 열기)는 동현 시리즈와 같은 모양이다. 동현항과 이 파일은 GAME 한 줄만 다르다. */
(function () {
'use strict';
const GAME = DH.Sam;
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const el = (tag, text) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; return e; };
let current = null;            // boot()이 돌려준 묶음: engine · layout · scene · world · lang · examples · convention · applyDonghyunLang

/* ---------- 화면 전환 · 탭 ---------- */
$('#theme').onclick = () => { const dark = document.documentElement.dataset.theme !== 'dark'; document.documentElement.dataset.theme = dark ? 'dark' : 'light'; $('#theme').setAttribute('aria-pressed', String(dark)); };
let tab = 'play', resume = false;
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
  const next = b.dataset.tab; if (next === tab) return;
  if (current) {                                         // 설명을 읽는 동안에는 판이 흐르지 않는다
    if (tab === 'play') { resume = current.engine.loop.running; current.engine.stop(); }
    else if (next === 'play' && resume) current.engine.start();
  }
  tab = next;
  document.querySelectorAll('.tabs button').forEach(x => { const on = x.dataset.tab === tab; x.classList.toggle('active', on); on ? x.setAttribute('aria-current', 'page') : x.removeAttribute('aria-current'); });
  document.querySelectorAll('.tab-panel').forEach(p => p.hidden = p.id !== 'tab-' + tab);
});
$('.brand').onclick = e => { e.preventDefault(); document.querySelector('[data-tab=play]').click(); scrollTo({ top: 0, behavior: 'smooth' }); };

/* ---------- 동현랭 편집기(동현랭 시리즈와 같은 모양) ---------- */
const DH_TOKEN = /(ㅋㅋ.*$)|(나는 동현이냐\?|동현이구나)|(오겡끼데스까)|(신중동역|신중동|뭉치)|(뿡뿡뿡|뿡뿡|포동이)|(꽥꽥)|(동+현아)|(동+현)|(도오*옹)|(ㅠ+)|(뚱띠|또치)/g;
const DH_CLS = [null, 't-cmt', 't-frame', 't-halt', 't-ctl', 't-out', 't-in', 't-assign', 't-var', 't-num', 't-minus', 't-op'];
function dhLine(line) { let html = '', last = 0; line.replace(DH_TOKEN, (m, ...gr) => { const idx = gr[gr.length - 2]; html += esc(line.slice(last, idx)); const k = gr.slice(0, 11).findIndex(x => x !== undefined) + 1; html += `<span class="${DH_CLS[k]}">${esc(m)}</span>`; last = idx + m.length; return m; }); return html + esc(line.slice(last)); }
const code = $('#code'), result = $('#result'), area = document.createElement('div'), hl = document.createElement('div');
area.className = 'code-area'; hl.id = 'hl'; hl.setAttribute('aria-hidden', 'true'); code.parentNode.insertBefore(area, code); area.append(hl, code);
function hlSync() { hl.scrollTop = code.scrollTop; hl.scrollLeft = code.scrollLeft; }
function hlMetrics() { const cs = getComputedStyle(code); for (const p of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontFamily', 'fontSize', 'lineHeight', 'tabSize', 'letterSpacing']) hl.style[p] = cs[p]; }
function highlight() { hlMetrics(); hl.innerHTML = code.value.split('\n').map(l => `<span class="ln">${dhLine(l) || ' '}</span>`).join('') + '<span class="ln"> </span>'; hlSync(); }
code.addEventListener('scroll', () => { hlSync(); $('#lines').scrollTop = code.scrollTop; }); addEventListener('resize', highlight);
function indent() {
  const text = code.value, lines = text.split('\n'), lead = l => l.length - l.replace(/^[ \t]+/, '').length;
  const next = lines.map(l => { const b = l.slice(lead(l)); if (!b) return ''; if (b.startsWith('ㅋㅋ')) return '   ' + b; const s = b.split('~')[0].replace(/ㅋㅋ.*$/, '').trim(); return (s === '나는 동현이냐?' || s === '동현이구나' ? '' : '  ') + b; });
  const { selectionStart: a, selectionEnd: b, selectionDirection: dir, scrollTop: y, scrollLeft: x } = code;
  const moved = p => { let o = 0, n = 0; for (let i = 0; i < lines.length; i++) { const L = lines[i].length; if (p <= o + L) { const c = p - o, ol = lead(lines[i]), nl = lead(next[i]); return n + Math.min(next[i].length, c < ol ? nl : c - ol + nl); } o += L + 1; n += next[i].length + 1; } return n; };
  const value = next.join('\n'), na = moved(a), nb = moved(b); if (value === text && na === a && nb === b) return; if (value !== text) code.value = value; code.setSelectionRange(na, nb, dir); code.scrollTop = y; code.scrollLeft = x;
}
let previewTimer = 0;
function codeChanged(e) { if (!e?.isComposing) indent(); const n = code.value.split('\n').length; $('#line-count').textContent = n + '줄'; $('#lines').textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n'); highlight(); clearTimeout(previewTimer); previewTimer = setTimeout(preview, 250); }
code.addEventListener('compositionend', () => codeChanged());
function codeLead() { const a = code.selectionStart, v = code.value, ls = v.lastIndexOf('\n', a - 1) + 1, le = v.indexOf('\n', ls); return { a, ls, lead: /^[ \t]*/.exec(v.slice(ls, le < 0 ? v.length : le))[0].length }; }
document.addEventListener('selectionchange', () => { if (document.activeElement !== code || code.selectionStart !== code.selectionEnd) return; const { a, ls, lead } = codeLead(); if (a - ls < lead) code.setSelectionRange(ls + lead, ls + lead); });
code.addEventListener('beforeinput', e => { const { a, ls, lead } = codeLead(); if (a !== code.selectionEnd) return; if (e.inputType === 'deleteContentBackward' && ls > 0 && a > ls && a - ls <= lead) { e.preventDefault(); code.setRangeText('', ls - 1, a, 'end'); codeChanged(); } });
code.oninput = codeChanged;
code.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); sortie(); } });
function selectExample() {
  const ex = current && current.examples.find(e => e.id === $('#example').value); if (!ex) return;
  code.value = ex.code; const note = ex.code.split('\n').find(l => l.startsWith('ㅋㅋ ')); $('#example-note').textContent = note ? note.slice(3) : ''; codeChanged();
}
$('#example').onchange = selectExample;
$('#save').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([code.value + '\n'], { type: 'text/plain;charset=utf-8' })); a.download = 'sortie.dh'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
$('#open').onchange = async e => { const f = e.target.files[0]; if (!f) return; code.value = (await f.text()).replace(/\r/g, '').replace(/\n$/, ''); $('#example-note').textContent = ''; codeChanged(); e.target.value = ''; };
$('#run').onclick = () => sortie();

/* ---------- 출전 규약: 동현랭이 출력한 정수를 '설정 번호 · 값'으로 읽는다 ---------- */
const say = (kind, text) => { result.dataset.kind = kind; result.textContent = text; };
const list = rep => rep.settings.map(s => `${s.label} = ${s.text}`).join(' · ');
/** 코드를 고칠 때마다 읽기만 해 본다(판은 건드리지 않는다) */
function preview() {
  if (!current) return;
  const rep = current.lang.parse(code.value, { ctx: { world: current.world } });
  if (!rep.ok) return say('error', rep.errors.join(' '));
  say('', rep.empty ? '설정이 없다. 출전을 누르면 기본값으로 새 판이 열린다.' : `읽은 설정 ${rep.settings.length}개: ${list(rep)}. 출전을 누르면 이 값으로 새 판이 열린다.`);
}
/** 출전: 설정을 덮어쓰고 새 판을 연다. 오류가 하나라도 있으면 하던 판을 그대로 둔다 */
function sortie() {
  if (!current) return;
  clearTimeout(previewTimer);
  const rep = current.applyDonghyunLang(code.value);
  if (!rep.ok) { $('#status').textContent = '출전하지 못했다'; $('#status').dataset.kind = 'error'; return say('error', rep.errors.join(' ') + ' 하던 판은 그대로 두었다.'); }
  $('#status').dataset.kind = ''; $('#status').textContent = rep.empty ? '기본값으로 새 판' : `설정 ${rep.settings.length}개로 새 판`;
  say('ok', rep.empty ? '설정이 없다. 기본값으로 새 판을 열었다.' : `설정 ${rep.settings.length}개를 적용하고 새 판을 열었다: ${rep.applied.join(' · ')}`);
}
/** 예제 목록과 설정 번호 표를 채운다 */
function fillLang() {
  for (const ex of current.examples) { const o = el('option', ex.name); o.value = ex.id; $('#example').append(o); }
  $('#lang-rows').replaceChildren(...current.convention.map(r => {
    const tr = el('tr'), name = el('td', r.label); if (r.hint) name.append(el('small', r.hint));
    tr.append(el('td', r.n), name, el('td', r.range), el('td', r.now === undefined || r.now === null ? '-' : typeof r.now === 'number' ? r.now.toLocaleString('ko-KR') : r.now));
    return tr; }));
  selectExample();
}

/* ---------- 전체 화면(동현램 · 동현닥과 같은 규칙): 정보 띠 · 지도 · 조작 창을 통째로 띄운다 ---------- */
const stageFull = $('#stage-full'), host = $('#host'), FS_VARS = ['--fs-stage', '--fs-app', '--fs-panel', '--fs-h'];
const fullEl = () => document.fullscreenElement || document.webkitFullscreenElement;
const canNativeFull = !!((document.fullscreenEnabled || document.webkitFullscreenEnabled) && (stageFull.requestFullscreen || stageFull.webkitRequestFullscreen));
const isPseudo = () => stageFull.classList.contains('pseudo-full');
const isFull = () => fullEl() === stageFull || isPseudo();
/** 전체 화면에서 지도의 크기를 정한다. 세 가지 배치: 좁거나 세로로 긴 화면은 아래로 쌓고(stack), 낮은 가로 화면은 지도를 왼쪽에 꽉 채우고(side), 나머지는 평소처럼 지도 옆에 조작 창을 둔다 */
function fit() {
  const app = host.querySelector('.dh-app'); if (!app || !current) return;
  const st = stageFull.style, e = current.engine, ratio = e.width / e.height;
  FS_VARS.forEach(v => st.removeProperty(v));
  if (!isFull()) { stageFull.classList.remove('stack', 'side'); return e.fit(); }
  const stack = stageFull.clientWidth < 720 || stageFull.clientHeight > stageFull.clientWidth, side = !stack && stageFull.clientHeight < 600;
  stageFull.classList.toggle('stack', stack); stageFull.classList.toggle('side', side);
  const cs = getComputedStyle(stageFull), px = k => parseFloat(cs[k]) || 0, top = app.querySelector('.dh-top');
  const W = stageFull.clientWidth - px('paddingLeft') - px('paddingRight'), H = stageFull.clientHeight - px('paddingTop') - px('paddingBottom');
  let w = 0;
  for (let i = 0; i < 2; i++) {                          // 두 번 잰다: 폭이 정해져야 정보 띠의 높이(줄 수)가 정해진다
    if (stack) w = Math.min(i ? host.clientWidth : W, H * 0.62 * ratio);
    else if (side) { w = Math.min(H * ratio, W - 270); st.setProperty('--fs-h', Math.floor(H) + 'px'); }
    else { w = Math.max(240, Math.floor(Math.min(W - 310, (H - top.offsetHeight - 10) * ratio))); st.setProperty('--fs-app', w + 310 + 'px'); st.setProperty('--fs-panel', Math.floor(w / ratio) + 'px'); }
    w = Math.max(240, Math.floor(w)); st.setProperty('--fs-stage', w + 'px');
  }
  e.fit(w);
}
function setPseudo(on) { stageFull.classList.toggle('pseudo-full', on); document.documentElement.classList.toggle('pseudo-full-on', on); onFull(); }
function exitFull() { if (isPseudo()) return setPseudo(false); if (fullEl() === stageFull) (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document); }
let hintTimer = 0;
function onFull() {
  const on = isFull(); stageFull.classList.toggle('fs', on);
  $('#exit-full').hidden = !on; $('#full').textContent = on ? '전체 화면 닫기' : '전체 화면';
  clearTimeout(hintTimer); $('#full-hint').hidden = !on; if (on) hintTimer = setTimeout(() => { $('#full-hint').hidden = true; }, 5000);
  fit(); setTimeout(fit, 60);
  if (on) { $('#full').blur(); const cv = host.querySelector('.dh-canvas'); if (cv) cv.focus({ preventScroll: true }); }   // 방향키가 바로 듣게
}
document.addEventListener('fullscreenchange', onFull); document.addEventListener('webkitfullscreenchange', onFull);
addEventListener('resize', () => { if (isFull()) fit(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && isPseudo()) setPseudo(false); });
$('#exit-full').onclick = exitFull;
$('#full').onclick = () => {
  if (isFull()) return exitFull(); if (!current) return;
  if (!canNativeFull) return setPseudo(true);            // iPhone Safari: 창을 가득 채우는 유사 전체 화면
  try { const r = stageFull.requestFullscreen ? stageFull.requestFullscreen() : stageFull.webkitRequestFullscreen(); if (r && r.catch) r.catch(() => setPseudo(true)); } catch (err) { setPseudo(true); }
};
window.__dhFull = { fit, setPseudo, isFull };            // 시험용 손잡이

/* ---------- 시작: 자료를 읽고 기본값으로 판을 연다 ---------- */
GAME.boot($('#host'), '#lab-data').then(g => {
  current = g; window.__dh = g;                          // 시험용 손잡이
  $('#run').disabled = false; $('#full').disabled = false; $('#status').textContent = '기본값으로 열었다';
  fillLang();
}).catch(e => {
  const p = el('pre', e.message); p.className = 'boot-error'; $('#host').replaceChildren(p);
  $('#status').textContent = '자료를 읽지 못했다'; $('#status').dataset.kind = 'error';
});
})();
