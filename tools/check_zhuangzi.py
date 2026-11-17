#!/usr/bin/env python3
"""동현삼 · 동행낭자의 『장자』 100구절이 위키문헌 원문에 그대로 있는지 대조한다.

  python3 tools/check_zhuangzi.py            # 위키문헌에서 편마다 원문을 받아 대조한다
  python3 tools/check_zhuangzi.py --cache D  # 받은 원문을 D에 두고 다시 쓴다(〈篇名〉.txt)

src/sam/sam-council.js의 QUOTES([편명, 원문, 옮긴 글])에서 원문을 읽는다.
구두점과 이체자(爲·為, 无·無 따위)의 차이는 같은 글로 본다. 옮긴 글은 대조하지 않는다(직접 옮긴 글이다).
"""
import argparse, json, os, re, sys, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = 'https://zh.wikisource.org/w/index.php?title=' + urllib.parse.quote('莊子/') + '{}&action=raw'
VAR = str.maketrans({'為': '爲', '無': '无', '閒': '間', '溼': '濕', '肢': '枝', '履': '屨', '殙': '㱪', '惼': '褊', '劍': '劒', '鈞': '均', '真': '眞', '跡': '迹'})
PUNCT = set('，。；：「」『』？！、《》〈〉（）()　 \n\t“”‘’·—…')


def quotes():
    src = open(os.path.join(ROOT, 'src/sam/sam-council.js'), encoding='utf-8').read()
    body = src[src.index('const QUOTES = ['):]
    body = body[:body.index('\n  ];')]
    out = re.findall(r"^\s*\['([^']+)', '([^']+)', '((?:[^'\\]|\\.)+)'\],?\s*$", body, flags=re.M)
    return [(h, o, t) for h, o, t in out]


def clean(raw):
    raw = re.sub(r'\{\{header2.*?\n\}\}', '', raw, flags=re.S)
    raw = re.sub(r'<ref[^>]*>.*?</ref>', '', raw, flags=re.S)
    raw = re.sub(r'<[^>]+>', '', raw)
    for _ in range(3):
        raw = re.sub(r'\{\{另\|([^|{}]*)\|[^{}]*\}\}', r'\1', raw)
        raw = re.sub(r'\{\{[^{}|]*\|([^{}|]*)(\|[^{}]*)?\}\}', r'\1', raw)
        raw = re.sub(r'\{\{[^{}]*\}\}', '', raw)
    raw = re.sub(r'\[\[[^\]|]*\|([^\]]*)\]\]', r'\1', raw)
    return re.sub(r'\[\[([^\]]*)\]\]', r'\1', raw)


def norm(s):
    return ''.join(ch.translate(VAR) for ch in s if ch not in PUNCT)


def chapter(han, cache):
    path = cache and os.path.join(cache, han + '.txt')
    if path and os.path.exists(path):
        return open(path, encoding='utf-8').read()
    req = urllib.request.Request(RAW.format(urllib.parse.quote(han)), headers={'User-Agent': 'donghyunsam-check/0.30 (https://github.com/Raspberry-Kim/donghyun-lab16)'})
    text = urllib.request.urlopen(req, timeout=30).read().decode('utf-8')
    if path:
        os.makedirs(cache, exist_ok=True)
        open(path, 'w', encoding='utf-8').write(text)
    return text


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--cache', help='받은 원문을 두는 폴더')
    a = ap.parse_args()
    Q, texts, miss = quotes(), {}, []
    if len(Q) != 100 or len({o for _, o, _ in Q}) != 100:
        sys.exit(f'구절 수가 맞지 않는다: {len(Q)}개(서로 다른 원문 {len({o for _, o, _ in Q})}개)')
    for i, (han, orig, _) in enumerate(Q, 1):
        if han not in texts:
            texts[han] = norm(clean(chapter(han, a.cache)))
        if norm(orig) not in texts[han]:
            miss.append((i, han, orig))
    for i, han, orig in miss:
        print(f'없음 #{i} 「{han}」 {orig}')
    print(json.dumps({'구절': len(Q), '편': len(texts), '원문에 있음': len(Q) - len(miss), '없음': len(miss)}, ensure_ascii=False))
    sys.exit(1 if miss else 0)


if __name__ == '__main__':
    main()
