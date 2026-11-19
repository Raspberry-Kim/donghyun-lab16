/* 동현삼 · 자료 파서 — donghyun_sam_data.json을 읽어 검사하고 게임이 쓰는 꼴(Map·그래프)로 바꾼다.
 * 규격(version 1)
 *   map        {grid:'hex', layout:'pointy-odd-r', cols, rows, tiles:{글자:이름}, rle:[줄…]}
 *   factions[] {id, name, color, leader(장수 id)}
 *   provinces[]{id, name, hanja, lon, lat, hex:[c,r], owner(세력 id|null), pop, gold, rice, troops, loyalty(0~100), farm(0~100), adj:[주 id…]}
 *              troops·loyalty·farm은 없어도 된다(0 · 60 · 30으로 본다).
 *   officers[] {id, name, war, int, cha (1~100), faction(세력 id|null), status, province(주 id)}
 *   people[]   {id, name, war, int, cha}   시나리오에만 나오는 인물(없어도 된다). officers와 번호가 겹치지 않는다.
 *   scenarios[]{id(1부터 차례로), year, month, name, note, factions[](rank 0~2: 처음부터 왕 · 황제인 세력), lands:{세력:{주:[장수…]}}, free:{주:[장수…]}, set:[[주, 항목, 값]]}
 *              시나리오는 같은 지도 · 같은 주에 주인과 장수만 다시 놓는다. lands에 없는 주는 공백지(병력 0)이고, lands · free에 없는 장수는 그 판에 나오지 않는다.
 *              DH.Sam.worlds(json) → [기본 배치, 시나리오 1, 2, …]. 동현랭 설정 31번이 이 가운데 하나를 고른다.
 * 검사: 주 41곳 · id 겹침 · 인접이 가리키는 주가 있는지 · 자기 자신 · 한쪽만 적힌 인접 · 모든 주가 이어졌는지 ·
 *       주 칸이 지도 안 육지이고 서로 겹치지 않는지 · 능력치 범위 · 소속·상태·군주의 앞뒤가 맞는지. */
(function (root) {
  'use strict';
  const DH = root.DH = root.DH || {};
  const STATUS = { active: '현역', free: '재야', captive: '포로', dead: '사망' };

  function parse(json, opt = {}) {
    const expect = opt.provinces ?? 41;
    const chk = new DH.Checker('동현삼 자료');
    DH.Data.header(json, 'donghyun-sam-data', 1, chk); chk.done();

    // 지도
    const m = json.map || {};
    chk.ok(m.grid === 'hex' && m.layout === 'pointy-odd-r', 'map.grid', "'hex' · 'pointy-odd-r'이어야 한다");
    chk.int(m.cols, 'map.cols', 1, 512); chk.int(m.rows, 'map.rows', 1, 512);
    chk.arr(m.rle, 'map.rle', m.rows); chk.done();
    const tiles = DH.Data.rleDecode(m.rle, m.cols, chk);
    const names = m.tiles || {};
    const map = { kind: 'hex', cols: m.cols, rows: m.rows, tiles, names, at: (c, r) => names[tiles[r][c]] };
    for (const row of tiles) for (const ch of new Set(row)) chk.ok(ch in names, 'map.rle', `글자 '${ch}'의 뜻이 map.tiles에 없다`);

    // 세력
    const factions = chk.index(json.factions, 'factions');
    for (const f of factions.values()) { chk.str(f.name, `factions.${f.id}.name`); chk.ok(/^#[0-9a-f]{6}$/i.test(f.color), `factions.${f.id}.color`, '#rrggbb이어야 한다'); if (f.rank !== undefined) chk.int(f.rank, `factions.${f.id}.rank`, 0, 2); }

    // 주
    chk.arr(json.provinces, 'provinces', expect);
    const provinces = chk.index(json.provinces, 'provinces');
    const hexSeen = new Map(), adj = new Map();
    for (const p of provinces.values()) {
      const w = `provinces.${p.id}`;
      chk.int(p.id, w + '.id', 1); chk.str(p.name, w + '.name');
      chk.int(p.pop, w + '.pop', 0); chk.int(p.gold, w + '.gold', 0); chk.int(p.rice, w + '.rice', 0);
      if (p.troops === undefined) p.troops = 0; if (p.loyalty === undefined) p.loyalty = 60; if (p.farm === undefined) p.farm = 30;
      chk.int(p.troops, w + '.troops', 0); chk.int(p.loyalty, w + '.loyalty', 0, 100); chk.int(p.farm, w + '.farm', 0, 100);
      chk.ok(p.owner === null || factions.has(p.owner), w + '.owner', `세력 ${p.owner}가 없다`);
      if (chk.arr(p.hex, w + '.hex', 2)) {
        const [c, r] = p.hex, k = c + ',' + r;
        if (chk.ok(Number.isInteger(c) && Number.isInteger(r) && c >= 0 && c < m.cols && r >= 0 && r < m.rows, w + '.hex', '지도 밖이다')) {
          chk.ok(map.at(c, r) === 'land', w + '.hex', `육지 칸이 아니다(${map.at(c, r)})`);
          chk.ok(!hexSeen.has(k), w + '.hex', `주 ${hexSeen.get(k)}와 같은 칸이다`); hexSeen.set(k, p.id);
        }
      }
      if (chk.arr(p.adj, w + '.adj')) {
        chk.ok(p.adj.length > 0, w + '.adj', '이웃이 하나도 없다');
        chk.ok(new Set(p.adj).size === p.adj.length, w + '.adj', '같은 이웃이 두 번 적혔다');
        for (const b of p.adj) { chk.ok(provinces.has(b), w + '.adj', `주 ${b}가 없다`); chk.ok(b !== p.id, w + '.adj', '자기 자신을 이웃으로 적었다'); }
        adj.set(p.id, [...p.adj]);
      }
    }
    const graph = new DH.Graph(adj);
    for (const [a, b] of graph.oneWay()) chk.fail(`provinces.${a}.adj`, `${a}→${b}는 있는데 ${b}→${a}가 없다`);
    const comps = graph.components();
    chk.ok(comps.length <= 1, 'provinces', `주가 ${comps.length}덩어리로 끊겨 있다(가장 작은 덩어리: ${comps.sort((x, y) => x.length - y.length)[0]})`);

    // 장수
    const officers = chk.index(json.officers, 'officers');
    for (const o of officers.values()) {
      const w = `officers.${o.id}(${o.name})`;
      chk.str(o.name, w + '.name');
      for (const k of ['war', 'int', 'cha']) chk.int(o[k], `${w}.${k}`, 1, 100);
      chk.oneOf(o.status, Object.keys(STATUS), w + '.status');
      chk.ok(o.faction === null || factions.has(o.faction), w + '.faction', `세력 ${o.faction}가 없다`);
      chk.ok(o.province === null || provinces.has(o.province), w + '.province', `주 ${o.province}가 없다`);
      if (o.status === 'free') chk.ok(o.faction === null, w, '재야인데 소속이 있다');
      if (o.status === 'active') {
        chk.ok(o.faction !== null, w, '현역인데 소속이 없다');
        const p = provinces.get(o.province);
        if (p && o.faction !== null) chk.ok(p.owner === o.faction, w, `있는 주 ${p.name}은 ${p.owner} 땅이다(소속 ${o.faction})`);
      }
      if (o.status !== 'dead') chk.ok(o.province !== null, w + '.province', '있는 곳이 없다');
    }
    for (const f of factions.values()) {
      const l = officers.get(f.leader);
      chk.ok(l && l.faction === f.id && l.status === 'active', `factions.${f.id}.leader`, `군주 ${f.leader}가 이 세력의 현역 장수가 아니다`);
    }
    chk.done();

    return {
      meta: json.meta || {}, map, factions, provinces, officers, graph, STATUS,
      officersIn: pid => [...officers.values()].filter(o => o.province === pid && o.status !== 'dead'),
      provincesOf: fid => [...provinces.values()].filter(p => p.owner === fid)
    };
  }

  /** 시나리오 하나를 기본 자료와 같은 꼴(version 1)의 JSON으로 편다. 주의 인구 · 금 · 쌀 · 민심 · 농지는 기본 자료 그대로이고,
   *  주인 있는 주의 병력은 기본 자료 값(0이면 2,500), 공백지는 0이다. set의 값은 그 뒤에 덮어쓴다. */
  function scenarioJSON(json, s) {
    const w = `scenarios.${s && s.id}`, chk = new DH.Checker('동현삼 시나리오');
    chk.ok(s && typeof s === 'object' && Array.isArray(s.factions) && s.lands && typeof s.lands === 'object', w, '세력(factions)과 땅(lands)이 있어야 한다'); chk.done();
    chk.int(s.year, w + '.year', 1, 9999); chk.int(s.month, w + '.month', 1, 12); chk.str(s.name, w + '.name');
    const pool = new Map([...(json.officers || []), ...(json.people || [])].map(o => [o.id, o])), owner = new Map(), at = new Map();
    const put = (id, f, pid) => { chk.ok(pool.has(id), w, `장수 ${id}가 officers에도 people에도 없다`); chk.ok(!at.has(id), w, `장수 ${id}가 두 곳에 있다`); at.set(id, [f, pid]); };
    for (const [f, m] of Object.entries(s.lands)) for (const [k, ids] of Object.entries(m || {})) {
      const pid = Number(k); chk.ok(!owner.has(pid), w + '.lands', `주 ${pid}의 주인이 둘이다`); owner.set(pid, f);
      if (chk.arr(ids, `${w}.lands.${f}.${k}`)) { chk.ok(ids.length > 0, `${w}.lands.${f}.${k}`, '장수가 한 명은 있어야 한다(없으면 첫 달에 공백지가 된다)'); for (const id of ids) put(id, f, pid); }
    }
    for (const [k, ids] of Object.entries(s.free || {})) if (chk.arr(ids, `${w}.free.${k}`)) for (const id of ids) put(id, null, Number(k));
    chk.done();
    const provinces = (json.provinces || []).map(p => { const f = owner.get(p.id) ?? null; return { ...p, hex: [...p.hex], adj: [...p.adj], owner: f, troops: f ? (p.troops || 2500) : 0 }; });
    for (const [pid, key, v] of s.set || []) { const p = provinces.find(q => q.id === pid); if (chk.ok(p && ['gold', 'rice', 'troops', 'loyalty', 'farm', 'pop'].includes(key), w + '.set', `주 ${pid}의 ${key}는 고칠 수 없다`)) p[key] = v; }
    chk.done();
    const officers = [...at].map(([id, [f, pid]]) => { const o = pool.get(id); return { id, name: o.name, war: o.war, int: o.int, cha: o.cha, faction: f, status: f ? 'active' : 'free', province: pid }; }).sort((a, b) => a.id - b.id);
    return { format: json.format, version: json.version, meta: { ...(json.meta || {}), scenario: s.name, start: { year: s.year, month: s.month }, note: s.note || '' }, map: json.map, factions: s.factions.map(f => ({ ...f })), provinces, officers };
  }
  /** 자료에 든 판 배치를 모두 읽는다: [기본 배치, 시나리오 1, 2, …]. world.index가 동현랭 설정 31번의 값이고 world.title이 고르는 칸에 보이는 이름이다. */
  function worlds(json, opt) {
    const chk = new DH.Checker('동현삼 시나리오'), ids = new Set((json.officers || []).map(o => o.id));
    for (const o of json.people || []) { const w = `people.${o && o.id}`; chk.ok(o && !ids.has(o.id), w, 'id가 겹친다'); if (o) { ids.add(o.id); chk.str(o.name, w + '.name'); for (const k of ['war', 'int', 'cha']) chk.int(o[k], `${w}.${k}`, 1, 100); } }
    (json.scenarios || []).forEach((s, i) => chk.ok(s && s.id === i + 1, `scenarios[${i}].id`, `${i + 1}이어야 한다(1부터 차례로)`));
    chk.done();
    const st = (json.meta && json.meta.start) || {};
    return [parse(json, opt), ...(json.scenarios || []).map(s => parse(scenarioJSON(json, s), opt))].map((w, i) => Object.assign(w, { index: i, title: i ? json.scenarios[i - 1].name : `${st.year}년 ${st.month || 1}월 · 기본 배치` }));
  }

  DH.Sam = Object.assign(DH.Sam || {}, { parse, scenarioJSON, worlds, STATUS });
})(typeof globalThis !== 'undefined' ? globalThis : this);
