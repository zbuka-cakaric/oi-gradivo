# -*- coding: utf-8 -*-
# parse_thorium.py — PROFIL F: KONSOLIDIRANI Word-PDF s OZNACENIM IZMJENAMA
# (npr. Thorium Software konsolidat TP RUETZZ: prekrizeno=brisano, crveno=novo,
#  crno neprekrizeno=nepromijenjeno). Cilj: izvuci TRENUTNO VAZECI tekst.
# Tehnika:
#  - strikethrough NIJE svojstvo fonta nego TANKI RECT (h<2pt) preko sredine
#    znakova -> znak je MRTAV ako ga tanki rect x-preklapa i y mu prolazi kroz
#    srednju trecinu (|rect_y - char_center| < 0.35*char_h). Underline i granice
#    tablicnih celija NE prolaze kroz sredinu -> ne diraju filtar.
#  - crvena boja (novo) se ZADRZAVA automatski; prekrizeno crveno (dodano pa
#    kasnije brisano) filtar takoder brise — boja je nebitna, samo strikethrough.
#  - Thorium header (6 linija, top<112) + footer "N/103" (top>800) -> van.
#  - TOC na pocetku ("Clanak N. .... 7", tockice, x lijevo) -> sidro: parsiranje
#    krece tek od CENTRIRANOG "^Clanak 1.$".
#  - naslovi clanaka IZNAD headinga (buffer), CAPS/rimski = struktura,
#    "PRIJELAZNE I ZAVRSNE ODREDBE iz NN X/YY" = RAZDJELNICA novele (naslov
#    clanaka koji slijede; pad broja takoder aktivira razdjelnicu),
#    heading zna nositi sufiks "Clanak 1 iz NN 73/18." -> oznaka = cijela linija.
#  - hard-stop: ^PRILOG [A-Z] (prilozi s tablicama ostaju IZVAN — kao i drugdje).
# Poziv: python3 parse_thorium.py <pdf> "<Naziv iz sifrarnika>" <out.json>
import re, sys, json
import pdfplumber

SRC = sys.argv[1]; NAZIV = sys.argv[2]
OUT = sys.argv[3] if len(sys.argv) > 3 else 'out-clanci.json'

HEADER_Y = 112.0; FOOTER_Y = 800.0
RX_CLANAK = re.compile(r'^Članak\s+(\d+)\.?([a-z])?(\s+iz\s+NN\s+[\d/.\s]+)?\s*\.?$')
RX_RAZDJ  = re.compile(r'^PRIJELAZNE I ZAVRŠNE ODREDBE.*$', re.I)
RX_STRUKT = re.compile(r'^[IVXLC]+\.\s')
RX_STOP   = re.compile(r'^(PRILOG\s+[A-Z0-9]|Klasa:)')
RX_ODLOMAK = re.compile(r'^(\(\d+\)|–|•|[a-z]\)|\d+\.\s)')
RX_THORIUM = re.compile(r'ThoriumSoftware|thoriumsoftware\.eu|direndulic|Izvrsni inženjeri|^Mobile:|^Kontakt:|^Email:?$|^\d+/\d+$')

def sve_caps(s):
    a = [c for c in s if c.isalpha()]
    return bool(a) and all(c == c.upper() for c in a)

# ── 1. linije: strikethrough filtar + header/footer, po stranicama ──
linije = []
pdf = pdfplumber.open(SRC)
for p in pdf.pages:
    tanki = [r for r in p.rects if (r['bottom'] - r['top']) < 2.0]
    def ziv(o):
        if o.get('object_type') != 'char': return True
        cy = (o['top'] + o['bottom']) / 2; ch = o['bottom'] - o['top']
        for r in tanki:
            if (o['x0'] < r['x1'] and o['x1'] > r['x0']
                    and abs((r['top'] + r['bottom']) / 2 - cy) < ch * 0.35):
                return False
        return True
    fp = p.filter(ziv)
    rows = sorted(fp.extract_text_lines(strip=True, return_chars=False), key=lambda r: r['top'])
    for r in rows:
        if r['top'] < HEADER_Y or r['top'] > FOOTER_Y: continue
        t = re.sub(r'\s+', ' ', r['text']).strip()
        if not t or RX_THORIUM.search(t): continue
        linije.append((t, r['x0'], r['x1']))
pdf.close()

# rubovi sloga globalno (mode) — Word A4: body ~72, desni rub ~523
from collections import Counter
LIJEVO = Counter(round(x0) for _, x0, _ in linije).most_common(1)[0][0]
DESNO  = Counter(round(x1) for _, _, x1 in linije).most_common(1)[0][0]

# ── 2. stroj stanja ──
clanci = []; presk = []
cur = None; tekst = []; naslov_buf = []; razdj = ''; rbr = 0; max_br = 0
prvi_ceka = True; stop = False; prev_x0 = LIJEVO; prev_kraj = '.'

def zatvori():
    global cur, rbr
    if cur is not None:
        rbr += 1
        clanci.append({'redoslijed': rbr, 'oznaka': cur['ozn'][:60], 'naslov': cur['nas'][:300],
                       'tekst': '\n'.join(x.strip() for x in tekst if x.strip()).strip(), '_broj': cur['n']})
    cur, tekst[:] = None, []

# Word tekst NIJE justified -> geometrijska simetrija laze (nastavak alineje na
# x=108 s kracim desnim krajem izgleda "centriran"). Pouzdano: body razine su
# DISKRETNE tab-pozicije (72/90/108/126) — centrirano je sve dublje od njih.
BODY_RAZINE = [LIJEVO, LIJEVO + 18, LIJEVO + 36, LIJEVO + 54]
for (t, x0, x1) in linije:
    if stop: break
    centriran = (x0 - LIJEVO) > 40 and min(abs(x0 - r) for r in BODY_RAZINE) > 4
    if RX_STOP.match(t) and (centriran or sve_caps(t)) and not prvi_ceka:
        stop = True; break
    mc = RX_CLANAK.match(t)
    if mc and centriran and prvi_ceka and int(mc.group(1)) != 1:
        presk.append('(prije sidra) ' + t); continue
    if mc and centriran:
        prvi_ceka = False
        n = int(mc.group(1))
        if n < max_br and not razdj: razdj = 'Prijelazne i završne odredbe'  # pad broja = novela
        max_br = max(max_br, n)
        zatvori()
        ozn = t if t.endswith('.') else t + '.'
        nas = (razdj + (' — ' if razdj and naslov_buf else '') + ' '.join(naslov_buf)).strip()
        cur = {'ozn': ozn, 'n': n, 'nas': nas}
        naslov_buf = []; prev_x0 = LIJEVO; prev_kraj = '.'
        continue
    if prvi_ceka:
        presk.append(t); continue
    if RX_RAZDJ.match(t) and len(t) < 90:
        zatvori(); razdj = t; naslov_buf = []; continue
    if centriran and (sve_caps(t) or RX_STRUKT.match(t)):
        for b in naslov_buf: presk.append('(buf uz strukturu) ' + b)
        naslov_buf = []; presk.append(t); continue
    if centriran and not any(ch.isdigit() for ch in t) and len(t) >= 6:
        naslov_buf.append(t); continue          # naslov SLJEDECEG clanka (iznad headinga)
        # (len>=6: centrirani subscript-ostaci formula tipa "C,nd" idu u tekst, ne u naslov)
    if naslov_buf:                               # buffer nije bio naslov -> u tekst
        for b in naslov_buf:
            tekst.append(b)
        naslov_buf = []
    if cur is None: presk.append(t); continue
    # odlomci: markeri; broj-marker "N." vrijedi samo nakon zavrsene recenice
    m = RX_ODLOMAK.match(t)
    novi = bool(m) and (not t[0].isdigit() or prev_kraj in ';.:»')
    if not novi and x0 < prev_x0 - 5: novi = True   # pad razine uvlake
    if novi or not tekst: tekst.append(t)
    else: tekst[-1] = tekst[-1] + ' ' + t
    prev_x0 = x0; prev_kraj = t[-1] if t else '.'
zatvori()

# ── 3. QC ──
g, w = [], []
if not clanci: g.append('Nema clanaka!')
else:
    def je_novela(c): return 'prijelazne' in c['naslov'].lower() or 'iz NN' in c['oznaka']
    # kljuc = (broj, slovo) — slovni clanci 41.a/41.b nisu duplikati broja 41!
    osnovni = [(c['_broj'], re.search(r'\.([a-z])\.?$', c['oznaka']) and re.search(r'\.([a-z])\.?$', c['oznaka']).group(1) or '')
               for c in clanci if not je_novela(c)]
    brojevi = sorted(set(b for b, s in osnovni))
    mx = max(brojevi) if brojevi else 0
    rupe = [i for i in range(1, mx + 1) if i not in brojevi]
    if rupe: w.append(f'Rupe u osnovnom (brisani novelama?): {rupe[:12]}')
    if osnovni != sorted(osnovni): g.append('Osnovna numeracija nije rastuca!')
    dup = [k for k in set(osnovni) if osnovni.count(k) > 1]
    if dup: g.append(f'Duplikati u osnovnom: {sorted(dup)[:8]}')
    prazni = [c['oznaka'] for c in clanci if not c['tekst']]
    if prazni: g.append(f'Prazni: {prazni[:8]}')
    sve = ' '.join(c['tekst'] + ' ' + c['naslov'] for c in clanci)
    for ch in 'čćđšž':
        if ch not in sve: w.append(f'Nema "{ch}"')
    if re.search(r'[Ã\ufffd\ue000-\uf8ff]', sve): g.append('Mojibake/PUA!')
    dugi = [c['oznaka'] for c in clanci if len(c['oznaka']) > 60]
    if dugi: g.append(f'Oznaka >60: {dugi}')
    for c in clanci:
        m = re.search(r'(.{40,}?) \1', c['tekst'])
        if m: w.append(f"Moguci duplikat u {c['oznaka']}: {m.group(1)[:50]}")

print(f'{NAZIV}: {len(clanci)} clanaka')
for x in w: print('  UPOZORENJE:', x)
for x in g: print('  QC GRESKA:', x)
if not g:
    json.dump({'dokument_naziv': NAZIV,
               'clanci': [{k: c[k] for k in ('redoslijed', 'oznaka', 'naslov', 'tekst')} for c in clanci]},
              open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('  OK ->', OUT)
else:
    sys.exit(1)
