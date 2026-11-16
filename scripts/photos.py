# Fotky z Instagramu klubu (@pfkpiestany) -> src/img/foto/*.webp + data/foto-out.json (pre build.js)
#   python -I scripts/photos.py          (FORCE=1 prepíše aj existujúce súbory)
# Vstup: media/ig-posts.json (zbiera Playwright MCP bez prihlásenia – posledných 12 príspevkov),
#        media/ig/<kód>/<n>.jpg (scripts/ig-download.mjs), data/foto.json (výber: úvodná fotka, album)
# Texty príspevkov sa preberajú bez zmeny (len bez emoji); počty lajkov a dátumy z popisu príspevku.
import json, os, re
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
cfg = json.loads((ROOT / 'data' / 'foto.json').read_text(encoding='utf8'))
posts = json.loads((ROOT / 'media' / 'ig-posts.json').read_text(encoding='utf8'))
if isinstance(posts, str): posts = json.loads(posts)
IG = ROOT / 'media' / 'ig'
OUT = ROOT / 'src' / 'img' / 'foto'; OUT.mkdir(parents=True, exist_ok=True)
FORCE = bool(os.environ.get('FORCE'))
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
EMOJI = re.compile(r'[\U0001F000-\U0001FAFF☀-➿⬀-⯿️‍]')

def load(code, n=1):
    return ImageOps.exif_transpose(Image.open(IG / code.replace('reel/', 'reel-') / f'{n}.jpg')).convert('RGB')

def widths(im, name, ws, q=80):
    out = []
    for w in ws:
        if w > im.width and out: break
        c = im.copy(); c.thumbnail((w, 100000), Image.LANCZOS)
        f = OUT / f'{name}-{c.width}.webp'
        if FORCE or not f.exists(): c.save(f, 'WEBP', quality=q, method=6)
        out.append(c.width)
    return out

def crop(im, ratio, fx=0.5, fy=0.5):
    W, H = im.size
    if W / H > ratio: w, h = round(H * ratio), H
    else: w, h = W, round(W / ratio)
    x = min(max(round(fx * W - w / 2), 0), W - w); y = min(max(round(fy * H - h / 2), 0), H - h)
    return im.crop((x, y, x + w, y + h))

def parse(p):
    m = re.match(r'([\d,\.]+) likes?, ([\d,\.]+) comments? - \w+ (\w+) (\d+), (\d{4}): "(.*)"\.\s*$', p['og'], re.S)
    likes, text, date = 0, '', (p.get('time') or '')[:10]
    if m:
        likes = int(m.group(1).replace(',', '').replace('.', ''))
        date = f'{m.group(5)}-{MONTHS.index(m.group(3)) + 1:02d}-{int(m.group(4)):02d}'
        text = m.group(6)
    text = EMOJI.sub('', text).replace(' ', ' ')
    text = '\n'.join(re.sub(r'[ \t]+', ' ', l).strip() for l in text.split('\n')).strip()
    return likes, date, text

out = {'source': 'https://www.instagram.com/pfkpiestany/', 'posts': []}
for p in posts:
    likes, date, text = parse(p)
    im = load(p['code'])
    g = crop(im, 4 / 5)
    name = 'ig-' + p['code'].replace('reel/', 'reel-')
    out['posts'].append({'code': p['code'], 'url': p['url'], 'date': date, 'likes': likes, 'text': text, 'video': p['code'].startswith('reel/'),
                         'n': max(1, len(p.get('imgs') or [])), 'thumb': widths(g, name, [320, 640], 78)})
out['posts'].sort(key=lambda x: x['date'], reverse=True)

# úvodná fotka (tímová fotka sezóny)
h = cfg['hero']; im = load(h['code'], h.get('n', 1))
out['hero'] = {'name': 'hero', 'w': im.width, 'h': im.height, 'widths': widths(im, 'hero', [640, 1024, 1600, 2400], 80), 'alt': h['alt'],
               'url': next(p['url'] for p in posts if p['code'] == h['code']), 'pos': h.get('pos', '50% 50%')}

# album zo zápasu
a = cfg['album']; src = next(p for p in posts if p['code'] == a['code'])
items = []
for n in range(1, len(src['imgs']) + 1):
    im = load(a['code'], n)
    items.append({'n': n, 'w': im.width, 'h': im.height, 'widths': widths(im, f'alb-{n}', [480, 960, 1600], 80)})
out['album'] = {**{k: v for k, v in a.items() if k != 'code'}, 'code': a['code'], 'url': src['url'], 'date': parse(src)[1], 'items': items}

(ROOT / 'data' / 'foto-out.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf8')
print(f"príspevkov {len(out['posts'])}, album {len(items)} fotiek, úvodná fotka {out['hero']['w']}×{out['hero']['h']}")
