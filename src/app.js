/* 동현삼 앱: 공통 엔진의 지도 장면을 A 칸에 띄우고, B 칸의 동현랭 편집기가 설정을 읽어 새 판을 연다.
 * 편집기(줄 번호 · 색 입히기 · 들여쓰기 · .dh 저장과 열기)는 동현 시리즈와 같은 모양이다. 동현항과 이 파일은 GAME 한 줄만 다르다.
 * 저장과 불러오기(브라우저 칸 3개 + .dhsave 파일)는 동현심과 같은 규칙이다. 무엇을 적고 어떻게 되살리는지는 장면(saveGame · loadGame)이 안다.
 * 효과음은 장면이 엔진에 알리는 'sfx' 사건을 여기서 받아 튼다(sfx.js · 동현큐와 같은 소리). 첫 출전 전에는 지도 위에 시작 카드를 얹고 판을 멈춘다. */
(function () {
'use strict';
const GAME = DH.Sam;
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const el = (tag, text) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; return e; };
let current = null;            // boot()이 돌려준 묶음: engine · layout · scene · world · lang · examples · convention · applyDonghyunLang

/* ---------- 화면 전환 · 소리 · 탭 ---------- */
$('#theme').onclick = () => { const dark = document.documentElement.dataset.theme !== 'dark'; document.documentElement.dataset.theme = dark ? 'dark' : 'light'; $('#theme').setAttribute('aria-pressed', String(dark)); };
const SND = DHSFX(GAME.SAVE.file + ':sound'), sounds = [];              // sounds: 시험용 기록(최근 50개)
function sndUI() { const b = $('#sound'); b.setAttribute('aria-pressed', String(SND.on)); b.classList.toggle('muted', !SND.on); b.title = SND.on ? '효과음 끄기 (M)' : '효과음 켜기 (M)'; }
$('#sound').onclick = () => { SND.set(!SND.on); sndUI(); }; sndUI();
document.addEventListener('keydown', e => { if (e.code !== 'KeyM' || e.metaKey || e.ctrlKey || e.altKey || menu) return; const a = document.activeElement; if (a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT' || a.tagName === 'SELECT')) return; SND.set(!SND.on); sndUI(); });
function playSfx(s) { sounds.push(s.k); if (sounds.length > 50) sounds.shift(); SND.play(s.k, s.delay); }
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
let picked = '';                                       // 시작 카드에 적을 코드 이름(예제 이름 · 파일 이름 · 직접 고친 코드)
code.oninput = e => { picked = ''; codeChanged(e); };
code.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); sortie(); } });
function selectExample() {
  const ex = current && current.examples.find(e => e.id === $('#example').value); if (!ex) return;
  code.value = ex.code; picked = ex.name; const note = ex.code.split('\n').find(l => l.startsWith('ㅋㅋ ')); $('#example-note').textContent = note ? note.slice(3) : ''; codeChanged();
}
$('#example').onchange = selectExample;
$('#save').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([code.value + '\n'], { type: 'text/plain;charset=utf-8' })); a.download = 'sortie.dh'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
$('#open').onchange = async e => { const f = e.target.files[0]; if (!f) return; code.value = (await f.text()).replace(/\r/g, '').replace(/\n$/, ''); picked = f.name; $('#example-note').textContent = ''; codeChanged(); e.target.value = ''; };
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
  if (!rep.ok) { $('#status').textContent = '출전하지 못했다'; $('#status').dataset.kind = 'error'; SND.play('buzz'); return say('error', rep.errors.join(' ') + (waiting ? '' : ' 하던 판은 그대로 두었다.')); }
  begun(); $('#status').dataset.kind = ''; $('#status').textContent = rep.empty ? '기본값으로 새 판' : `설정 ${rep.settings.length}개로 새 판`;
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
  $('#exit-full').hidden = !on; $('#fs-save').hidden = !on; $('#fs-load').hidden = !on; $('#full').textContent = on ? '전체 화면 닫기' : '전체 화면';
  clearTimeout(hintTimer); $('#full-hint').hidden = !on; if (on) hintTimer = setTimeout(() => { $('#full-hint').hidden = true; }, 5000);
  fit(); setTimeout(fit, 60);
  if (on) { $('#full').blur(); const cv = host.querySelector('.dh-canvas'); if (cv) cv.focus({ preventScroll: true }); }   // 방향키가 바로 듣게
}
document.addEventListener('fullscreenchange', onFull); document.addEventListener('webkitfullscreenchange', onFull);
addEventListener('resize', () => { if (isFull()) fit(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && isPseudo() && !menu) setPseudo(false); });
$('#exit-full').onclick = exitFull;
$('#full').onclick = () => {
  if (isFull()) return exitFull(); if (!current) return;
  if (!canNativeFull) return setPseudo(true);            // iPhone Safari: 창을 가득 채우는 유사 전체 화면
  try { const r = stageFull.requestFullscreen ? stageFull.requestFullscreen() : stageFull.webkitRequestFullscreen(); if (r && r.catch) r.catch(() => setPseudo(true)); } catch (err) { setPseudo(true); }
};
window.__dhFull = { fit, setPseudo, isFull };            // 시험용 손잡이

/* ---------- 저장 · 불러오기(동현심과 같은 규칙): 브라우저 칸 3개 + .dhsave 파일. 저절로 저장하지 않는다 ----------
   메뉴는 화면 가운데 뜨고(전체 화면에서도), 떠 있는 동안 판은 멎는다. 칸은 이 기기의 이 브라우저에만 남는다 */
const SAVE = GAME.SAVE, SLOTS = 3, menuBack = $('#menu-back'), menuEl = $('#menu');
let menu = null, menuResume = false;
const status = (text, kind) => { $('#status').textContent = text; $('#status').dataset.kind = kind || ''; };
const toast = (text, kind) => { status(text, kind); if (current) current.layout.log(text); };
const clip = (v, n = 40) => String(v ?? '').slice(0, n);
const eul = n => (n === 2 ? '를' : '을');                // 칸 1을 · 칸 2를 · 칸 3을
function snapshot() { return { ...current.scene.saveGame(), lab: (/v([\d.]+)/.exec($('.edition').textContent) || [])[1] || '', savedAt: new Date().toISOString() }; }
function readSlot(n) { try { const t = localStorage.getItem(SAVE.slot + n), d = t ? JSON.parse(t) : null; return d && d.format === SAVE.format ? d : null; } catch (e) { return null; } }
function slotNote(d) {
  if (!d) return '비어 있음';
  const u = d.summary || {}, t = new Date(d.savedAt), pad = v => String(v).padStart(2, '0'), when = isNaN(t) ? '' : ` · ${t.getMonth() + 1}/${t.getDate()} ${pad(t.getHours())}:${pad(t.getMinutes())} 저장`;
  return [u.title, u.date, u.line].filter(Boolean).map(x => clip(x)).join(' · ') + when;
}
function saveToSlot(n) {
  try { const d = snapshot(); localStorage.setItem(SAVE.slot + n, JSON.stringify(d)); toast(`브라우저 칸 ${n}에 저장했다 · ${d.summary.title} · ${d.summary.date}`); return true; }
  catch (e) { toast('브라우저 저장에 실패했다. 파일로 내려받아 저장하자.', 'error'); return false; }
}
function saveToFile() {
  const d = snapshot(), a = document.createElement('a'), name = `${SAVE.file}-${d.summary.title}-${d.summary.date}`.replace(/[\\/:*?"<>|\s]+/g, '');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: 'application/json' })); a.download = name + '.dhsave'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`.dhsave 파일로 내려받았다 · ${d.summary.title} · ${d.summary.date}`);
}
/** 저장 묶음을 판에 되살린다. 맞지 않으면 까닭을 알리고 하던 판을 그대로 둔다 */
function loadFrom(d) {
  const r = current.scene.loadGame(d);
  if (!r.ok) { toast('불러오기 실패: ' + r.why + ` 하던 ${SAVE.word}은 그대로 두었다.`, 'error'); return false; }
  begun(); status(`저장한 ${SAVE.word}을 불러왔다`); say('ok', r.text + (r.applied.length ? ` · 저장될 때의 설정: ${r.applied.join(' · ')}` : ' · 저장될 때의 설정: 기본값') + '. 편집기의 코드는 그대로다.');
  fit(); return true;
}
async function loadFile(input) {
  const f = input.files[0]; input.value = ''; if (!f || !current) return;
  let d = null; try { if (f.size <= 4e6) d = JSON.parse(await f.text()); } catch (e) { d = null; }
  if (!d || typeof d !== 'object' || d.format !== SAVE.format) return toast(`불러오기 실패: ${SAVE.name} 저장 파일이 아니다. 하던 ${SAVE.word}은 그대로 두었다.`, 'error');
  confirmMenu(`${slotNote(d)}\n이 파일을 불러올까? 저장하지 않은 진행은 사라진다.`, [['불러온다', () => loadFrom(d)], ['그만둔다', loadMenu]], loadMenu);
}
/* 메뉴: items = [{label, note, off, fn}] 또는 [label, fn]. 고르면 닫히고 fn을 부른다. Esc와 바깥 누르기는 onCancel(없으면 그냥 닫기) */
function openMenu(title, items, onCancel, text) {
  if (!menu) { menuResume = !!current && current.engine.loop.running; if (current) current.engine.stop(); }
  menu = { items: items.map(it => (Array.isArray(it) ? { label: it[0], fn: it[1] } : it)), onCancel };
  const h = el('h4', title); h.id = 'menu-title'; menuEl.replaceChildren(h);
  if (text) { const q = el('p', text); q.className = 'menu-text'; menuEl.append(q); }
  menu.items.forEach((it, i) => { const b = el('button'); b.type = 'button'; b.className = 'mi'; b.dataset.i = i; b.disabled = !!it.off; b.append(el('span', it.label)); if (it.note) b.append(el('small', it.note)); menuEl.append(b); });
  menuBack.hidden = false;
  const first = menuEl.querySelector('.mi:not(:disabled)'); if (first) first.focus({ preventScroll: true });
}
function closeMenu() {
  if (!menu) return; menu = null; menuBack.hidden = true;
  if (current) { if (menuResume && tab === 'play') current.engine.start(); const cv = host.querySelector('.dh-canvas'); if (cv) cv.focus({ preventScroll: true }); }   // 닫으면 키보드가 다시 지도에 듣는다
}
function cancelMenu() { const c = menu && menu.onCancel; closeMenu(); if (c) c(); }
function confirmMenu(q, opts, back) { const [title, ...rest] = q.split('\n'); openMenu(rest.length ? rest.join(' ') : title, opts, back, rest.length ? title : ''); }
menuEl.addEventListener('click', e => { const b = e.target.closest('.mi'); if (!b || !menu) return; const it = menu.items[+b.dataset.i]; if (!it || it.off) return; closeMenu(); if (it.fn) it.fn(); });
menuBack.addEventListener('click', e => { if (e.target === menuBack) cancelMenu(); });
menuBack.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return cancelMenu(); }
  const list = [...menuEl.querySelectorAll('.mi:not(:disabled)')], i = list.indexOf(document.activeElement), d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
  if (d && list.length) { e.preventDefault(); list[(i + d + list.length) % list.length].focus(); }
  else if (e.key === 'Tab' && list.length) { e.preventDefault(); list[(i + (e.shiftKey ? -1 : 1) + list.length) % list.length].focus(); }      // 메뉴 밖으로 나가지 않는다
});
function saveMenu() {
  if (!current) return;
  if (waiting) return openMenu('지금은 저장할 수 없다', [['돌아가기', null]], null, `아직 ${SAVE.word}을 시작하지 않았다. 출전을 누르면 시작한다.`);
  const can = current.scene.saveInfo(); if (!can.ok) return openMenu('지금은 저장할 수 없다', [['돌아가기', null]], null, can.why);
  const items = [];
  for (let n = 1; n <= SLOTS; n++) { const d = readSlot(n); items.push({ label: `브라우저 칸 ${n}`, note: slotNote(d), fn: () => (d ? confirmMenu(`칸 ${n}에 덮어쓸까?`, [['덮어쓴다', () => saveToSlot(n)], ['그만둔다', saveMenu]], saveMenu) : saveToSlot(n)) }); }
  items.push({ label: '파일로 내려받기', note: '.dhsave', fn: saveToFile }, { label: '칸 지우기', fn: deleteMenu }, ['돌아가기', null]);
  openMenu('저장', items, null, '칸은 이 기기의 이 브라우저에만 남는다. 다른 기기로 옮기려면 파일로 내려받는다.');
}
function deleteMenu() {
  const items = [];
  for (let n = 1; n <= SLOTS; n++) { const d = readSlot(n); items.push({ label: `브라우저 칸 ${n}`, note: slotNote(d), off: !d,
    fn: () => confirmMenu(`칸 ${n}${eul(n)} 지울까? 되돌릴 수 없다.`, [['지운다', () => { try { localStorage.removeItem(SAVE.slot + n); } catch (e) {} toast(`브라우저 칸 ${n}${eul(n)} 지웠다`); deleteMenu(); }], ['그만둔다', deleteMenu]], deleteMenu) }); }
  items.push(['돌아가기', saveMenu]); openMenu('칸 지우기', items, saveMenu);
}
function loadMenu() {
  if (!current) return;
  const items = [];
  for (let n = 1; n <= SLOTS; n++) { const d = readSlot(n); items.push({ label: `브라우저 칸 ${n}`, note: slotNote(d), off: !d,
    fn: () => confirmMenu(`지금 ${SAVE.word}을 두고 칸 ${n}${eul(n)} 불러올까? 저장하지 않은 진행은 사라진다.`, [['불러온다', () => loadFrom(readSlot(n))], ['그만둔다', loadMenu]], loadMenu) }); }
  items.push({ label: '파일에서 불러오기', note: '.dhsave', fn: () => $('#load-file').click() }, ['돌아가기', null]);
  openMenu('불러오기', items);
}
for (const id of ['#game-save', '#fs-save']) $(id).onclick = saveMenu;
for (const id of ['#game-load', '#fs-load']) $(id).onclick = loadMenu;
$('#load-file').onchange = e => loadFile(e.target);

/* ---------- 시작 카드: 첫 출전(또는 불러오기) 전까지 지도 위에 얹는다. 아래 판은 멈추고 입력은 카드가 받는다 ---------- */
let waiting = true;
const FONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
class StartCard extends DH.Scene {
  constructor(engine, layout) { super(engine); this.layout = layout; }
  enter() {
    this.layout.setDetail({ title: '출전 준비', rows: [], note: `B 칸에서 동현랭 출전 코드(예제)를 고르고 코드 위의 출전을 누르면 시작한다. 저장해 둔 ${SAVE.word}은 지도 아래 불러오기로 이어 한다.` });
    this.layout.setMenu([], null);   // 출전 단추는 B 칸 하나뿐이다. 코드를 보고 누르게 한다
  }
  onKey() {}   // 시작 전에는 지도가 키를 받지 않는다
  render(g) {
    const W = this.engine.width, H = this.engine.height, w = 280, h = 88, x = (W - w) / 2, y = (H - h) / 2;
    if (current && this._src !== code.value) { this._src = code.value; this._rep = current.lang.parse(code.value, { ctx: { world: current.world } }); }   // 글이 바뀔 때만 다시 읽는다
    const rep = this._rep, fit = s => (s.length > 30 ? s.slice(0, 29) + '…' : s);
    g.fillStyle = 'rgba(38,33,28,.22)'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(74,66,88,.88)'; g.fillRect(x, y, w, h);
    g.textAlign = 'center'; g.textBaseline = 'top'; g.fillStyle = '#fff'; g.font = `bold 13px ${FONT}`;
    g.fillText(fit(`${SAVE.name} · ${picked || '직접 쓴 코드'}`), W / 2, y + 12);
    g.font = `11px ${FONT}`; g.fillText(fit(!rep ? '' : !rep.ok ? '코드에 오류가 있다 · B 칸을 보자' : rep.empty ? '설정 없음 · 기본값으로 연다' : `설정 ${rep.settings.length}개 · ${rep.settings.map(s => s.label).join(' · ')}`), W / 2, y + 34);
    g.fillStyle = '#f2b705'; g.font = `bold 12px ${FONT}`; g.fillText('B 칸의 출전을 누르면 시작한다', W / 2, y + 60);
  }
  save() { return null; }
}
/** 첫 출전이나 불러오기가 되면 카드를 걷는다. 장면의 applyDonghyunLang · loadGame이 위에 얹힌 장면을 이미 내렸으면 할 일이 없다 */
function begun() {
  if (!waiting) return; waiting = false; $('#full').disabled = false;   // 전체 화면에는 편집기가 따라오지 않으므로 시작한 뒤에 연다
  const e = current.engine, i = e.scenes.findIndex(s => s instanceof StartCard); if (i >= 0) e.scenes.splice(i, 1)[0].exit();
}

/* ---------- 시작: 자료를 읽고 기본값의 판 위에 시작 카드를 얹는다 ---------- */
GAME.boot($('#host'), '#lab-data').then(g => {
  current = g; window.__dh = g; g.sounds = sounds;       // 시험용 손잡이
  g.engine.on('sfx', playSfx);
  g.engine.pushScene(new StartCard(g.engine, g.layout)); g.waiting = () => waiting;
  $('#run').disabled = false; $('#game-save').disabled = false; $('#game-load').disabled = false; $('#status').textContent = '출전 준비';
  fillLang();
}).catch(e => {
  const p = el('pre', e.message); p.className = 'boot-error'; $('#host').replaceChildren(p);
  $('#status').textContent = '자료를 읽지 못했다'; $('#status').dataset.kind = 'error';
});
})();
