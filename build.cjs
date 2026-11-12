// 동현삼 묶기: src의 HTML·CSS·JS·자료를 index.html 한 장으로 합친다(글꼴·아이콘 내장).
// 설명 탭의 글은 README.md에서 가져온다. README를 고치고 다시 묶으면 페이지의 설명도 같이 바뀐다.
const fs = require('fs'), path = require('path');
const { copyIcons } = require('./icon-files.cjs');
const LAB = { name: '동현삼', version: '0.06', data: 'sam/donghyun_sam_data.json',
  game: ['sam/sam-parser.js', 'sam/sam-rules.js', 'sam/sam-battle.js', 'sam/sam-lang.js', 'sam/sam-art.js', 'sam/sam-battle-scene.js', 'sam/sam-scene.js'] };
const ENGINE = ['dh-core.js', 'dh-loop.js', 'dh-clock.js', 'dh-grid.js', 'dh-tilemap.js', 'dh-layout.js', 'dh-engine.js', 'dh-lang.js'].map(f => 'engine/' + f);
const JS = ['lang/donghyun.js', ...ENGINE, ...LAB.game, 'sfx.js', 'app.js'];
const root = __dirname, out = path.join(root, 'dist'), src = n => fs.readFileSync(path.join(root, 'src', n), 'utf8');

/* ---------- README.md → 설명 탭 ---------- */
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const LINK = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
function inline(s) {                                   // `코드` · **굵게** · [글](주소) · 맨 주소
  return s.split(/(`[^`]+`)/).map(part => {
    if (/^`[^`]+`$/.test(part)) return '<code>' + esc(part.slice(1, -1)) + '</code>';
    return esc(part).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)|(https?:\/\/[^\s<)]+)/g, (m, text, href, bare) => bare ? LINK(bare, bare) : LINK(href, text));
  }).join('');
}
/** 마크다운 줄들을 HTML로. shift: '###'을 h(3+shift)로 낸다 */
function md(lines, shift = 0) {
  const o = []; let i = 0;
  const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (l.startsWith('```')) { const b = []; i++; while (i < lines.length && !lines[i].startsWith('```')) b.push(lines[i++]); i++; o.push('<pre class="code-example">' + esc(b.join('\n')) + '</pre>'); continue; }
    const h = /^(#{3,4}) (.+)$/.exec(l);
    if (h) { o.push(`<h${h[1].length + shift}>${inline(h[2])}</h${h[1].length + shift}>`); i++; continue; }
    if (l.startsWith('|')) {
      const head = cells(l); i += 2; const rows = []; while (i < lines.length && lines[i].startsWith('|')) rows.push(cells(lines[i++]));
      o.push('<div class="table-wrap"><table><thead><tr>' + head.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>'); continue;
    }
    const li = /^(- |\d+\. )/.exec(l);
    if (li) {
      const tag = li[1] === '- ' ? 'ul' : 'ol', items = [];
      while (i < lines.length && /^(- |\d+\. )/.test(lines[i])) { let t = lines[i++].replace(/^(- |\d+\. )/, ''); while (i < lines.length && /^ {2,}\S/.test(lines[i])) t += '\n' + lines[i++].trim(); items.push(t); }
      o.push(`<${tag}>` + items.map(t => '<li>' + t.split('\n').map(inline).join('<br>') + '</li>').join('') + `</${tag}>`); continue;
    }
    const p = []; while (i < lines.length && lines[i].trim() && !/^(```|#{2,4} |\||- |\d+\. )/.test(lines[i])) p.push(lines[i++].trim());
    if (!p.length) p.push(lines[i++].trim());        // 어느 꼴에도 안 맞는 줄은 그대로 한 문단
    o.push('<p>' + p.map(inline).join(' ') + '</p>');
  }
  return o.join('\n');
}
const README = fs.readFileSync(path.join(root, 'README.md'), 'utf8').split('\n');
function section(title) {                              // '## 제목' 아래의 줄들(다음 '## ' 앞까지). 코드 울타리 안의 '## '는 세지 않는다
  const a = README.indexOf('## ' + title); if (a < 0) throw new Error('README.md에 "## ' + title + '" 절이 없다');
  let b = a + 1, fence = false; for (; b < README.length; b++) { if (README[b].startsWith('```')) fence = !fence; if (!fence && README[b].startsWith('## ')) break; }
  return README.slice(a + 1, b);
}
/** <!--README:제목--> 은 그 절의 본문만(제목은 페이지가 따로 단다), <!--README+:제목|제목--> 은 절마다 제목을 h3로 달고 한 단씩 내린다 */
const docs = html => html
  .replace(/<!--README:([^>|]+)-->/g, (m, t) => md(section(t.trim())))
  .replace(/<!--README\+:([^>]+)-->/g, (m, ts) => ts.split('|').map(t => `<h3>${inline(t.trim())}</h3>\n` + md(section(t.trim()), 1)).join('\n'));

/* ---------- 판 번호가 문서마다 같은지 ---------- */
const need = (ok, why) => { if (!ok) throw new Error(why); };
need(README[0] === `# ${LAB.name} v${LAB.version}`, 'README.md 첫 줄의 판 번호가 build.cjs와 다르다');
need(fs.readFileSync(path.join(root, 'CITATION.cff'), 'utf8').includes(`\nversion: "${LAB.version}"\n`), 'CITATION.cff의 version이 build.cjs와 다르다');
need(/^## v([\d.]+) /m.exec(fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'))[1] === LAB.version, 'CHANGELOG.md 맨 위 판 번호가 build.cjs와 다르다');

/* ---------- 한 장으로 ---------- */
let css = src('style.css') + '\n' + src('engine/dh-layout.css');
for (const name of fs.readdirSync(path.join(root, 'fonts')))
  css = css.replaceAll('./fonts/' + name, 'data:font/woff2;base64,' + fs.readFileSync(path.join(root, 'fonts', name)).toString('base64'));
const html = docs(src('index.html'))
  .replace('__SERIES_NAV__', () => src('series.html'))
  .replace('__BRAND_ICON__', () => src('brand-icon.txt').trim())
  .replaceAll('__VERSION__', LAB.version)
  .replace('__DATA_JSON__', () => JSON.stringify(JSON.parse(src(LAB.data))).replaceAll('</', '<\\/'))
  .replace('<link rel="stylesheet" href="./style.css">', () => `<style>${css}</style>`)
  .replace('<script src="./game.js"></script>', () => '<script>' + JS.map(src).join('\n;\n').replaceAll('</script', '<\\/script') + '</script>');
need(!/src="\.\/game\.js"|__SERIES_NAV__|__BRAND_ICON__|__VERSION__|__DATA_JSON__|<!--README|href="\.\/style\.css"/.test(html), '묶지 못한 자리가 남았다');
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
copyIcons(out);
fs.cpSync(path.join(root, 'licenses'), path.join(out, 'licenses'), { recursive: true });
console.log(JSON.stringify({ lab: LAB.name, version: LAB.version, bytes: Buffer.byteLength(html) }));
