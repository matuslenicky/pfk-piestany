# PFK Piešťany – návrh webu

Návrh nového webu futbalového klubu PFK Piešťany (Prvý futbalový klub Piešťany). **Nie je to oficiálna stránka klubu.** Ukážka má v hlavičke pás s týmto upozornením a vyhľadávače ju neindexujú (`noindex`).

Ukážka: https://matuslenicky.github.io/pfk-piestany/ · administrácia (ukážka bez ukladania): https://matuslenicky.github.io/pfk-piestany/admin/

## Vzhľad

Farby z erbu: azúrový kruh, žlto-modrý štít s Barlolámačom, biela. Podpis webu je **rebrík návratu**: muži zanikli v roku 2015 po 102 rokoch, v roku 2016 začali od VIII. ligy a dnes hrajú IV. ligu. Zápasová karta má šikmé delenie ako štít erbu. Široké písmo Archivo (Expanded) na nadpisy, Public Sans na text. Na počítači je menu v bočnom paneli, na telefóne v spodnom paneli (`<dialog>`).

## Obsah a zdroje

- Zápasy, výsledky, strelci, karty, počty divákov, zostavy dospelých, tabuľky a súpisky 13 tímov zo Sportnetu (Futbalnet), verejné API súťaží (`scripts/sportnet.mjs` → `data/sportnet.json`). Vek hráčov sa neukladá, zostavy len pri dospelých. Tabuľky prípraviek bez zapísaných výsledkov a tímy bez zápasu sa neukazujú.
- Údaje o klube v `data/klub.json`, každá časť s uvedeným zdrojom: história, názvy klubu, sezóny po návrate, areál, Športhotel, kontakt a údaje k 2 % zo starého webu pfkpiestany.sk; farby, ihrisko a vedenie od 2016 z Wikipédie; kapacita a rozmery ihriska zo Sportnetu.
- Erb PFK Piešťany a erby súperov zo Sportnetu (`scripts/logos.py`). Patria príslušným klubom.
- Písmo Archivo a Public Sans, licencia SIL Open Font License 1.1 (`scripts/fonts.py`).
- Texty starého webu (`data/stary-web/`, sťahované len ako zdroj faktov) nie sú v repozitári.

## Zostavenie

Statický generátor bez závislostí (Node 20+, Python 3 s Pillow na erby):

```
node scripts/sportnet.mjs        # zápasy, tabuľky a súpisky (FULL=1 stiahne znova aj detaily zápasov)
python -I scripts/logos.py       # erby súperov a náš erb do src/img (FORCE=1 stiahne znova)
node build.js                    # data/ + src/ -> dist/ (TODAY=2026-11-16 prepíše dnešný dátum)
node scripts/serve.mjs dist 5300 # náhľad na http://127.0.0.1:5300/
node scripts/deploy.mjs          # nasadenie dist/ na vetvu gh-pages (GitHub Pages)
```

Výsledky sa po zápasoch aktualizujú samé cez GitHub Actions (`.github/workflows/sportnet.yml`).
