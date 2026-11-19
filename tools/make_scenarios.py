#!/usr/bin/env python3
"""동현삼 시나리오 생성기(v1.10): src/sam/donghyun_sam_data.json 끝에 people · scenarios를 덧붙인다(앞부분은 그대로 둔다).
이름으로 적은 배치를 장수 번호로 바꾸고, 겹침 · 빠짐 · 군주 자리를 검사한다. make_data.py를 돌린 뒤에 돌린다. 다시 돌려도 같은 파일이 나온다.
시작하는 해와 달만 「삼국지 DS 2」의 여섯 시나리오에서 따랐다. 배치와 능력치는 동현삼이 새로 정한 시험 값이다."""
import json, os, re, sys
PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src', 'sam', 'donghyun_sam_data.json')
text = open(PATH, encoding='utf-8').read()
i = text.find(',\n "people"')
base_text = text if i < 0 else text[:i] + '\n}\n' if text.endswith('\n') else text[:i] + '\n}'
if i < 0: base_text = text
base = json.loads(base_text)

PEOPLE = """401 동탁 85 70 40|402 여포 100 30 45|403 이유 25 90 45|404 화웅 90 45 50|405 가후 35 95 70|406 이각 75 45 40|407 곽사 75 35 35|408 한복 40 55 55|409 공손찬 85 65 70|410 공융 30 80 85|411 도겸 40 65 80|412 원술 65 65 60|413 기령 85 50 60|414 손견 95 75 90|415 정보 80 75 80|416 한당 85 55 65|417 유언 40 80 80|418 유요 40 60 70|419 공손강 70 65 65|420 조비 70 85 80|421 사마의 65 100 85|422 조홍 80 50 60|423 악진 85 55 65|424 우금 80 70 65|425 이전 80 80 75|426 장패 80 55 65|427 조진 80 70 80|428 조휴 75 70 70|429 조창 90 40 65|430 하후상 75 70 70|431 곽회 80 80 75|432 진군 30 90 80|433 등애 85 95 75|434 학소 85 80 75|435 유엽 30 90 70|436 맹달 75 75 55|437 이엄 80 80 70|438 왕평 80 75 75|439 제갈근 40 85 90|440 서성 85 75 75|441 정봉 85 70 70|442 주연 80 75 75|443 반장 80 55 50|444 보즐 45 85 85|445 공손공 50 55 60|446 조예 60 80 80|447 사마사 70 90 75|448 사마소 65 90 80|449 하후패 85 65 70|450 진태 80 85 80|451 제갈탄 75 75 70|452 관구검 80 75 70|453 왕창 70 80 75|454 왕릉 70 75 70|455 조상 60 55 55|456 하후현 55 75 75|457 장제 45 90 75|458 손례 75 70 75|459 문흠 85 45 50|460 왕기 75 85 80|461 호준 75 70 65|462 종육 35 75 70|463 유선 20 40 65|464 장완 40 90 85|465 비의 35 90 85|466 요화 75 65 70|467 장익 75 70 70|468 등지 60 80 85|469 제갈각 55 90 60|470 전종 75 75 75|471 주환 85 75 70|472 여대 75 75 80|473 고옹 25 85 85|474 공손연 70 60 55|475 진등 55 85 80|476 고순 85 55 70|477 장훈 70 60 65|480 번조 75 35 45|481 곽도 45 80 60|482 원상 70 60 70|483 봉기 40 85 60|484 곽원 70 50 50|485 신평 35 80 65|486 여광 75 45 50|487 한현 50 40 30|489 양습 55 85 85|490 가규 70 85 80|491 장기 60 85 85|492 하제 80 70 70|493 서막 60 80 85|494 호질 65 85 80|495 왕숙 30 85 75|496 배잠 45 85 80|497 주방 65 85 75|498 주거 70 75 80|499 반준 55 85 80|500 비연 70 45 50"""
people = []
for row in PEOPLE.split('|'):
    a = row.split(); people.append({'id': int(a[0]), 'name': a[1], 'war': int(a[2]), 'int': int(a[3]), 'cha': int(a[4])})
ID = {}
for o in base['officers'] + people:
    assert o['name'] not in ID, '이름 겹침 ' + o['name']; assert all(1 <= o[k] <= 100 for k in ('war', 'int', 'cha')), o
    ID[o['name']] = o['id']
assert len({o['id'] for o in base['officers'] + people}) == len(base['officers']) + len(people), 'id 겹침'
PID = {p['name']: p['id'] for p in base['provinces']}
C = dict(cao='#3566c4', yuan='#c9a227', liubei='#3f9a52', liubiao='#8b5fc7', sun='#d0483a', liuzhang='#c77a2a', zhanglu='#6b7b8c', mateng='#2f9aa0', gongsundu='#9a6b4b',
         dong='#3f3a4a', lijue='#3f3a4a', yuanshu='#d870a4', hanfu='#8f9a2e', liuyao='#8f9a2e', gongsunzan='#58a6dd', kongrong='#86c25a', lubu='#a03a78', taoqian='#c4a57a')
NOTE = '해와 달만 역사에서 가져왔다. 땅의 주인과 장수의 자리는 동현삼이 새로 정했고 능력치 · 병력 · 금 · 쌀은 시험 값이다. 이름 없는 태수가 다스리던 땅은 공백지로 두었다.'

def land(s):
    """'진류: 조조 하후돈 / 복양: 정욱' → {11: [101, 102], 10: [301]}"""
    out = {}
    for part in s.split('/'):
        k, v = part.split(':'); out[PID[k.strip()]] = [ID[n] for n in v.split()]
    return out

S = [
 dict(id=1, year=189, month=12, name='189년 12월 · 동탁과 제후들', factions=[
   ('cao', '조조', '조조', '진류: 조조 하후돈 하후연 조인 조홍'),
   ('yuan', '원소', '원소', '남피: 원소 안량 문추 순우경'),
   ('liubei', '유비', '유비', '평원: 유비 관우 장비'),
   ('dong', '동탁', '동탁', '낙양: 동탁 여포 이유 / 홍농: 화웅 장료 / 장안: 이각 곽사 가후'),
   ('sun', '손견', '손견', '장사: 손견 정보 황개 한당'),
   ('yuanshu', '원술', '원술', '완: 원술 기령'),
   ('liubiao', '유표', '유표', '양양: 유표 채모 / 강하: 황조 / 강릉: 문빙 황충'),
   ('liuzhang', '유언', '유언', '성도: 유언 유장 장임 / 자동: 황권 / 강주: 엄안'),
   ('mateng', '마등', '마등', '무위: 마등 마초 / 금성: 한수'),
   ('gongsunzan', '공손찬', '공손찬', '북평: 공손찬 전예'),
   ('hanfu', '한복', '한복', '업: 한복 장합 저수'),
   ('kongrong', '공융', '공융', '북해: 공융'),
   ('taoqian', '도겸', '도겸', '하비: 도겸 미축 / 소패: 진등'),
   ('gongsundu', '공손도', '공손도', '양평: 공손도')],
   free='계: 조운 / 북해: 태사자 / 낙양: 순유 / 진류: 순욱 전위 / 허창: 곽가 / 여남: 허저 / 복양: 정욱 진궁 / 여강: 주유 / 업: 전풍 / 금성: 방덕 / 강주: 감녕',
   set=[('낙양', 'troops', 12000)]),
 dict(id=2, year=194, month=11, name='194년 11월 · 흩어진 군웅', factions=[
   ('cao', '조조', '조조', '진류: 조조 하후돈 순욱 전위 하후연 조인 정욱'),
   ('lubu', '여포', '여포', '복양: 여포 진궁 장료 고순'),
   ('liubei', '유비', '유비', '하비: 유비 관우 미축 / 소패: 장비 진등'),
   ('yuan', '원소', '원소', '업: 원소 전풍 저수 안량 / 남피: 문추 / 평원: 원담 / 진양: 고간 / 상당: 장합'),
   ('gongsunzan', '공손찬', '공손찬', '북평: 공손찬 전예 / 계: 조운'),
   ('yuanshu', '원술', '원술', '수춘: 원술 기령 / 여남: 장훈'),
   ('sun', '손책', '손책', '여강: 손책 주유 정보 황개 한당'),
   ('liuyao', '유요', '유요', '건업: 유요 태사자'),
   ('liubiao', '유표', '유표', '양양: 유표 채모 / 강하: 황조 / 강릉: 문빙 / 장사: 황충 / 무릉: 금선 / 영릉: 유도 / 계양: 조범'),
   ('liuzhang', '유장', '유장', '성도: 유장 장임 / 자동: 황권 / 강주: 엄안 / 영안: 법정'),
   ('zhanglu', '장로', '장로', '한중: 장로'),
   ('mateng', '마등', '마등', '무위: 마등 마초 / 금성: 한수 방덕'),
   ('lijue', '이각', '이각', '장안: 이각 곽사 가후 / 홍농: 번조'),
   ('kongrong', '공융', '공융', '북해: 공융'),
   ('gongsundu', '공손도', '공손도', '양평: 공손도')],
   free='허창: 곽가 허저 / 낙양: 순유 서황 / 완: 서서 / 여강: 노숙 / 오: 여몽 장소 / 회계: 주태 / 시상: 감녕 / 장사: 위연 / 성도: 장송 / 건녕: 맹획'),
 dict(id=3, year=201, month=10, name='201년 10월 · 관도 뒤의 북쪽', factions=[
   ('cao', '조조', '조조', '허창: 조조 순욱 곽가 허저 순유 가후 / 진류: 하후돈 우금 / 복양: 정욱 장합 악진 / 소패: 조인 / 하비: 장패 / 여남: 장료 이전 / 수춘: 만총 / 낙양: 하후연 / 홍농: 서황 / 장안: 종요'),
   ('yuan', '원소', '원소', '북평: 여광 / 계: 원희 / 남피: 신평 / 평원: 곽도 / 업: 원소 원상 심배 봉기 / 진양: 고간 / 상당: 곽원 / 북해: 원담'),
   ('liubei', '유비', '유비', '완: 유비 관우 장비 조운 미축'),
   ('liubiao', '유표', '유표', '양양: 유표 채모 / 강하: 황조 / 강릉: 문빙 / 장사: 황충 / 무릉: 금선 / 영릉: 유도 / 계양: 조범'),
   ('sun', '손권', '손권', '오: 손권 주유 / 건업: 장소 노숙 / 여강: 여몽 한당 / 회계: 황개 주태 / 시상: 태사자 정보'),
   ('liuzhang', '유장', '유장', '성도: 유장 장임 / 자동: 황권 / 강주: 엄안 / 영안: 법정'),
   ('zhanglu', '장로', '장로', '한중: 장로'),
   ('mateng', '마등', '마등', '무위: 마등 마초 / 금성: 한수 방덕 / 천수: 마대'),
   ('gongsundu', '공손도', '공손도', '양평: 공손도')],
   free='완: 서서 / 양양: 제갈량 / 강릉: 방통 / 강하: 마량 / 오: 육손 / 장사: 위연 / 시상: 감녕 / 성도: 장송 / 건녕: 맹획 / 북평: 전예 / 낙양: 사마의'),
 dict(id=4, year=208, month=9, name='208년 9월 · 큰 강의 싸움 앞', factions=[
   ('cao', '조조', '조조', '북평: 전예 / 계: 조창 / 남피: 조휴 / 평원: 이전 / 업: 조비 사마의 진군 / 진양: 조진 / 상당: 곽회 / 북해: 장패 / 복양: 정욱 / 진류: 하후돈 / 소패: 우금 / 하비: 악진 / 허창: 순욱 / 여남: 조홍 / 수춘: 유엽 장료 / 낙양: 하후연 / 홍농: 서황 / 장안: 종요 / 완: 만총 / 양양: 조조 허저 순유 가후 채모 서서 / 강릉: 조인 문빙 / 장사: 한현 황충 / 무릉: 금선 / 영릉: 유도 / 계양: 조범'),
   ('liubei', '유비', '유비', '강하: 유비 관우 장비 조운 제갈량 미축'),
   ('sun', '손권', '손권', '시상: 손권 주유 노숙 황개 정보 / 건업: 장소 제갈근 / 오: 육손 주태 / 회계: 한당 / 여강: 여몽 감녕'),
   ('liuzhang', '유장', '유장', '성도: 유장 장임 장송 / 자동: 황권 이엄 / 강주: 엄안 / 영안: 법정'),
   ('zhanglu', '장로', '장로', '한중: 장로'),
   ('mateng', '마초', '마초', '무위: 마초 방덕 / 금성: 한수 / 천수: 마대'),
   ('gongsundu', '공손강', '공손강', '양평: 공손강')],
   free='장사: 위연 / 강하: 마량 / 강릉: 방통 / 건녕: 맹획 / 여강: 정봉 / 한중: 왕평',
   set=[('양양', 'troops', 15000), ('강하', 'troops', 6000), ('시상', 'troops', 8000)]),
 dict(id=5, year=221, month=4, name='221년 4월 · 세 나라', factions=[
   ('cao', '조비', '조비', '북평: 조창 / 계: 전예 / 남피: 손례 / 평원: 관구검 / 업: 조홍 / 진양: 양습 / 상당: 호준 / 북해: 왕릉 / 복양: 서서 / 진류: 장료 / 소패: 왕창 / 하비: 장패 / 허창: 가규 / 여남: 만총 등애 / 수춘: 조휴 / 낙양: 조비 사마의 진군 가후 허저 유엽 / 홍농: 종요 / 장안: 조진 장합 곽회 / 천수: 강유 / 금성: 학소 / 무위: 장기 / 완: 하후상 맹달 / 양양: 조인 서황 문빙', 2),
   ('liubei', '유비', '유비', '성도: 유비 제갈량 조운 마량 황권 장완 비의 / 자동: 장비 등지 장익 / 한중: 위연 마초 / 강주: 이엄 / 영안: 왕평 마대', 2),
   ('sun', '손권', '손권', '강하: 손권 제갈근 서성 / 강릉: 육손 주연 반장 / 장사: 보즐 / 무릉: 감녕 / 영릉: 여대 / 계양: 전종 / 시상: 한당 정봉 / 여강: 주태 주환 / 건업: 장소 제갈각 / 오: 고옹 / 회계: 하제'),
   ('gongsundu', '공손공', '공손공', '양평: 공손공 공손연')],
   free='건녕: 맹획 / 영안: 요화'),
 dict(id=6, year=235, month=2, name='235년 2월 · 별이 진 뒤', factions=[
   ('cao', '조예', '조예', '북평: 관구검 / 계: 전예 / 남피: 손례 / 평원: 종육 / 업: 사마사 / 진양: 진태 / 상당: 호준 / 북해: 왕기 / 복양: 문흠 / 진류: 제갈탄 / 소패: 조상 / 하비: 왕창 / 허창: 황권 / 여남: 등애 / 수춘: 만총 왕릉 / 낙양: 조예 진군 장제 하후현 / 홍농: 왕숙 / 장안: 사마의 사마소 / 천수: 곽회 / 금성: 하후패 / 무위: 서막 / 완: 호질 / 양양: 배잠', 2),
   ('liubei', '유선', '유선', '성도: 유선 장완 비의 / 한중: 강유 왕평 / 자동: 마대 / 강주: 등지 / 영안: 요화 / 건녕: 맹획 장익', 2),
   ('sun', '손권', '손권', '건업: 손권 장소 고옹 제갈각 / 강하: 육손 / 강릉: 주연 제갈근 / 장사: 여대 / 무릉: 반준 / 영릉: 보즐 / 계양: 정봉 / 시상: 주방 / 여강: 주환 / 오: 전종 / 회계: 주거', 2),
   ('gongsundu', '공손연', '공손연', '양평: 공손연 비연')],
   free=''),
]

used_people = set(); out = []
for s in S:
    facs, lands, seen_p, seen_o = [], {}, {}, {}
    for f in s['factions']:
        fid, name, leader, spec = f[:4]; L = land(spec)
        for pid, offs in L.items():
            assert pid not in seen_p, (s['id'], '주 겹침', pid); seen_p[pid] = fid
            assert offs, (s['id'], pid)
            for o in offs: assert o not in seen_o, (s['id'], '장수 겹침', o); seen_o[o] = pid
        assert any(ID[leader] in v for v in L.values()), (s['id'], '군주 자리 없음', leader)
        fa = {'id': fid, 'name': name, 'color': C[fid], 'leader': ID[leader]}
        if len(f) > 4: fa['rank'] = f[4]
        facs.append(fa); lands[fid] = L
    free = land(s['free']) if s['free'] else {}
    for pid, offs in free.items():
        for o in offs: assert o not in seen_o, (s['id'], '재야 겹침', o); seen_o[o] = pid
    assert len({f['id'] for f in facs}) == len(facs)
    used_people |= {o for o in seen_o if o >= 400}
    vac = sorted(set(PID.values()) - set(seen_p))
    print(s['id'], s['name'], '세력', len(facs), '주', {f['name']: len(lands[f['id']]) for f in facs}, '공백지', vac, '장수', len(seen_o), '재야', sum(len(v) for v in free.values()), file=sys.stderr)
    out.append(dict(id=s['id'], year=s['year'], month=s['month'], name=s['name'], note=NOTE, factions=facs, lands=lands, free=free, set=[[PID[a], k, v] for a, k, v in s.get('set', [])]))
unused = [p['name'] for p in people if p['id'] not in used_people]
assert not unused, '쓰이지 않은 인물 ' + ' '.join(unused)

J = lambda o: json.dumps(o, ensure_ascii=False)
def scen(s):
    L = ['  {', f'   "id": {s["id"]}, "year": {s["year"]}, "month": {s["month"]}, "name": {J(s["name"])},', f'   "note": {J(s["note"])},', '   "factions": [']
    L.append(',\n'.join('    ' + J(f) for f in s['factions'])); L.append('   ],'); L.append('   "lands": {')
    L.append(',\n'.join(f'    {J(fid)}: ' + '{' + ', '.join(f'"{pid}": {J(v)}' for pid, v in sorted(m.items())) + '}' for fid, m in s['lands'].items())); L.append('   },')
    L.append('   "free": {' + ', '.join(f'"{pid}": {J(v)}' for pid, v in sorted(s['free'].items())) + '},')
    L.append('   "set": ' + J(s['set'])); L.append('  }')
    return '\n'.join(L)
add = ',\n "people": [\n' + ',\n'.join('  ' + J(p) for p in people) + '\n ],\n "scenarios": [\n' + ',\n'.join(scen(s) for s in out) + '\n ]\n}'
body = base_text.rstrip(); assert body.endswith('}'); body = body[:-1].rstrip()
new = body + add + ('\n' if text.endswith('\n') else '')
json.loads(new)
open(PATH, 'w', encoding='utf-8').write(new)
print('people', len(people), 'scenarios', len(out), 'bytes', len(new.encode()), file=sys.stderr)
