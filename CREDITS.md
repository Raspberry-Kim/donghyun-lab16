# 동현삼™: 출처·이용 안내

동현삼은 1989년 Koei(光栄)의 턴제 전략 게임 「삼국지 II」(PC-8801 · PC-9801로 처음 발매)의 **큰 틀**에서 영감을 받은 비상업적 취미 작품이다. 「삼국지 II」를 비롯한 원작 시리즈의 이름과 권리는 코에이 테크모 게임스(Koei Tecmo Games)에 있다. 동현삼은 이들과 관계가 없고 승인도 받지 않았다.

## 원작에서 가져온 것

- 큰 틀만 참고했다: 41개 주로 나뉜 땅에서 군주 하나를 골라 세력을 넓히는 턴제 전략이라는 것.
- 원작 게임의 그림·음악·효과음·글·자료 수치·코드는 하나도 쓰지 않았다. 원작 파일과 그 일부는 이 저장소에 없고, 원작 파일에서 그림이나 자료를 꺼내 쓰지도 않았다.
- 주의 인접, 인구·금·쌀·병력·충성도·농지, 장수 능력치, 내정·AI·전투의 규칙과 수치는 모두 동현삼이 정한 시험 값이다. 원작의 주 번호·인접·규칙·수치와 맞춰 보지 않았다.
- 군주와 장수의 이름, 주의 이름과 자리는 후한 말의 역사 인물과 실제 지명이다.

## 동현삼이 새로 만든 것

- 공통 엔진(`src/engine/`: 루프 · 달력 · 사각·육각 격자와 길 찾기 · 타일 지도와 카메라 · 화면 나누기 · 장면 · 동현랭 어댑터). 동현항(donghyun-lab17)과 같은 파일을 쓴다.
- 동현삼의 자료 규격과 파서, 내정 · AI · 전투 규칙, 지도와 전투 장면(`src/sam/`), 동현랭 출전 규약과 예제, 문서, 시험.
- 자료 생성기(`tools/make_data.py`)와 그것이 만든 `src/sam/donghyun_sam_data.json`.
- 두 낭자의 말(`src/sam/sam-council.js`): 41개 주의 한 문장 설명, 규칙 한 마디 75가지, 『장자』 100구절의 우리말. 우리말 구절은 원문을 보고 직접 짧게 옮긴 글이고 기존 번역서의 문장을 옮겨 적지 않았다.
- 동현랭 실행기(`src/lang/donghyun.js`)는 [동현랭 저장소](https://github.com/Raspberry-Kim/donghyun-lang)의 v1.55를 고치지 않고 썼다. 편집기와 페이지 뼈대 · 시리즈 띠 · 입력 표식은 동현닥을 비롯한 동현 시리즈의 방식을 따랐다.

## 두 낭자의 얼굴과 『장자』

- 얼굴 그림(`src/sam/sam-ladies.png`)은 [동현항](https://github.com/Raspberry-Kim/donghyun-lab17) v1.27의 제물포 협력자(동행낭자)와 동래 협력자(수행낭자)의 초상을 그대로 가져온 것이다. 새로 생성하고 96×128픽셀로 정리한 이미지이며, 특정 인물이나 원작 캐릭터를 본뜨지 않았고 원작 캡처나 공식 캐릭터 이미지를 포함하지 않는다.
- 『장자』 원문: 위키문헌 莊子 https://zh.wikisource.org/wiki/莊子 (공공 영역의 고전). `tools/check_zhuangzi.py`로 100구절을 편마다 대조한다.

## 지도 자료

- Natural Earth, 1:110m Physical Vectors — Land (공공 영역): https://www.naturalearthdata.com/
  받은 파일(`tools/ne_110m_land.geojson`): https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson
- 육지와 바다만 뽑아 육각 칸으로 옮겼다. 해안선은 오늘날 기준이다.

## 참고한 자료

- Romance of the Three Kingdoms II — Wikipedia: https://en.wikipedia.org/wiki/Romance_of_the_Three_Kingdoms_II
- 삼국지 II — 위키백과: https://ko.wikipedia.org/wiki/삼국지_II
- Koei Tecmo — Wikipedia: https://en.wikipedia.org/wiki/Koei_Tecmo

## 글꼴

검은고딕 Black Han Sans · Pretendard · 나눔고딕코딩 — SIL Open Font License 1.1 (`licenses/`).

## 라이선스

동현삼 코드·문서: MIT (`LICENSE`). 동현랭 실행기: MIT (`licenses/DONGHYUN-MIT.txt`).
