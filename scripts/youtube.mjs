// Záznamy zápasov z YouTube kanála PFK Piešťany -> data/videa.json + náhľady src/img/video/<id>-<šírka>.webp
//   node scripts/youtube.mjs          (zlyhanie YouTube nevadí: skončí s upozornením a nechá uložené videá)
// Zdroj: verejný RSS kanála (posledných 15 videí, bez kľúča). Video sa priradí zápasu áčka podľa dátumu
// (zápas v deň zverejnenia alebo najviac 2 dni pred ním) a súpera v názve videa. Raz priradené videá ostávajú
// uložené, aj keď z RSS vypadnú. Náhľady sa sťahujú pri zostavení, web teda z YouTube nič nenačíta, kým
// návštevník nespustí video.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'videa.json');
const IMG = path.join(ROOT, 'src', 'img', 'video');
const CHANNEL = 'UCAJ-w_Nrr1IqXqyGR5Edwdw';
const sn = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'sportnet.json'), 'utf8'));
const saved = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { channel: CHANNEL, videa: {} };
// GitHub Actions: priradenia z predošlých behov (cache .cache/videa.json), aby videá staršie než RSS nevypadli
const CACHE = process.env.VIDEA_CACHE;
if (CACHE && fs.existsSync(CACHE)) {
  for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(CACHE, 'utf8')).videa || {})) if (!saved.videa[k]) saved.videa[k] = v;
}

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const unxml = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const STOP = new Set(['fk', 'fc', 'tj', 'sk', 'osk', 'ofk', 'mfk', 'msk', 'afc', 'pfk', 'kluby', 'sportove', 'futbalovy', 'klub', 'mestsky', 'nad', 'pod', 'b', 'a']);
const words = (s) => norm(s).split(' ').filter((w) => w.length > 2 && !STOP.has(w));
const days = (a, b) => (Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 864e5;

async function get(url, type = 'text') {
  const r = await fetch(url, { headers: { 'User-Agent': 'pfk-web-build' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return type === 'buf' ? Buffer.from(await r.arrayBuffer()) : r.text();
}

try {
  const xml = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL}`);
  const feed = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
    id: /<yt:videoId>([^<]+)</.exec(e)[1],
    title: unxml(/<title>([^<]*)</.exec(e)[1]).replace(/\s+/g, ' ').trim(),
    date: /<published>(\d{4}-\d\d-\d\d)/.exec(e)[1],
  }));
  const own = sn.matches.filter((m) => m.team === 'a-muzstvo' && m.played);
  let added = 0;
  for (const v of feed) {
    if (Object.values(saved.videa).some((x) => x.id === v.id)) continue;
    // názov: „… MUŽI: PFK Piešťany - Súper 2 : 0“ -> časť za pomlčkou
    const opp = words((v.title.split(':').slice(1).join(':').split(/\s+-\s+/).slice(1).join(' ') || v.title).replace(/\d+\s*:\s*\d+.*$/, ''));
    const cand = own.filter((m) => { const d = days(v.date, m.date); return d >= 0 && d <= 2; })
      .map((m) => ({ m, hit: words(m.opponent).filter((w) => opp.some((o) => o.startsWith(w.slice(0, 5)) || w.startsWith(o.slice(0, 5)))).length }))
      .sort((a, b) => b.hit - a.hit || days(v.date, a.m.date) - days(v.date, b.m.date));
    const pick = cand.find((c) => c.hit > 0) || (cand.length === 1 ? cand[0] : null);
    if (!pick || saved.videa[pick.m.id]) continue;
    saved.videa[pick.m.id] = { id: v.id, title: v.title, date: v.date };
    added++;
  }
  // náhľady: 1280 px (maxres), inak 640 px (sd, so pruhmi hore a dole – web ich oreže cez object-fit), a malý 320 px
  fs.mkdirSync(IMG, { recursive: true });
  for (const v of Object.values(saved.videa)) {
    if (v.thumbs && v.thumbs.every((t) => fs.existsSync(path.join(IMG, `${v.id}-${t}.webp`)))) continue;
    const thumbs = [];
    const save = async (name, w) => { fs.writeFileSync(path.join(IMG, `${v.id}-${w}.webp`), await get(`https://i.ytimg.com/vi_webp/${v.id}/${name}.webp`, 'buf')); thumbs.push(w); };
    await save('mqdefault', 320);
    try { await save('maxresdefault', 1280); } catch { await save('sddefault', 640); }
    v.thumbs = thumbs;
  }
  saved.updated = new Date().toISOString();
  const before = fs.existsSync(OUT) ? JSON.stringify(JSON.parse(fs.readFileSync(OUT, 'utf8')).videa) : '';
  if (JSON.stringify(saved.videa) !== before) fs.writeFileSync(OUT, JSON.stringify(saved, null, 1) + '\n');
  if (CACHE) { fs.mkdirSync(path.dirname(CACHE), { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(saved)); }
  console.log(`YouTube: ${feed.length} videí v RSS, nových záznamov ${added}, spolu ${Object.keys(saved.videa).length}`);
} catch (e) {
  console.warn(`YouTube nie je dostupný (${e.message}) – ostávajú uložené videá`);
}
