# OI · INVESTITOR — MASTER STRATEGIJA (v4, konačna)

*Zamjenjuje sve prethodne dokumente (vizija, v2, v3). Ovo je jedini dokument koji implementacijski razgovor treba. Razina: svaki mikro-korak, svaka formula, svaki rubni slučaj, svaki test, svaki rizik s planom B.*

---

# DIO I — TEMELJI

## I.1 Vizija (jedna rečenica)
Investitor na parceli (GPS) ili za stolom (klik/kčbr) → aplikacija dohvati česticu, namjenu i urbana pravila → **sama predloži optimalnu gradnju** (tipologija, katnost, stanovi; poštujući odmake i parking) → izračuna financije → vrati **maksimalnu cijenu zemljišta za ciljanu dobit** → investitor pregovara na licu mjesta.

## I.2 Rječnik (da nam pojmovi budu isti)
- **Obuhvat** = 1..n katastarskih čestica koje analiza tretira kao jedno zemljište.
- **Gradivi dio** = geometrija obuhvata skupljena za odmake (ulica −5 m, međa −3 m; iz pravila).
- **Footprint** = tlocrtna površina zgrade = min(P × k_ig, površina gradivog dijela).
- **GBP** = građevinska bruto površina (nadzemna, ako plan tako definira k_is).
- **PGM** = parkirno-garažno mjesto.
- **Rezidual** = max ukupni iznos za zemljište uz ciljanu dobit.
- **Zlatni test** = Hercegovačka 56, k.č. 2362, k.o. Črnomerec (Ivanov ručni izračun je etalon).

## I.3 Što Investitor mod NIJE (scope guard — piše i u sučelju)
Nije: provjera vlasništva/tereta (ZK), projektna dokumentacija, jamstvo dozvole, 3D projekt. Jest: stručna procjena kapaciteta i isplativosti kao podloga za odluku i pregovore. Disclaimer na dnu svake analize i u PDF-u.

## I.4 Izvori podataka (validirano)
| Podatak | Servis | Napomena |
|---|---|---|
| Čestica (geometrija, **areaValue**, kčbr, k.o.) | DGU WFS `CP:CadastralParcel` | authKey preko ZIS registracije; javna alternativa OSS |
| Katastarske općine | DGU WFS `CP:CadastralZoning` | autocomplete + bbox po k.o. |
| Adresa | DGU `AD:Address` | reverse za naslov analize; ako nedostupno → naslov = kčbr, k.o. |
| Podloge | DGU WMS (javno) `oss.uredjenazemlja.hr/OssWebServices/inspireService/wms` | DOF + katastar overlay |
| Namjena HR | ISPU WMS/WFS | točan URL potvrditi probom (F5 fokus) |
| Namjena + urbana pravila Zagreb | ZG Geoportal / **GeoHub (ArcGIS FeatureServer → GeoJSON)** | F3 fokus |
| Cijene (orijentir) | DZS / eNekretnine | grubo; naša tablica u F5 |

**Upit klik/GPS:** WFS `GetFeature` + `INTERSECTS(geometry, POINT(x y))`. Rezerva: ako `cql_filter` (GeoServer dijalekt) ne radi → OGC XML Filter (POST); ako ni to → **plan B:** BBOX 2×2 m oko točke + lokalni point-in-polygon (turf) nad vraćenim česticama. Jedan od tri PUTA SIGURNO radi.

**Upit po broju:** filter na atribut (`label` / `nationalCadastralReference`) unutar bbox-a k.o. Rezerva: ako atributni filter ne radi → **plan B:** unos radi samo uz klik/GPS u MVP-u, kčbr-pretraga se dodaje čim nađemo ispravan filter (ne blokira fazu).

## I.5 Integracija u postojeću aplikaciju (ništa novo ne izmišljamo)
- Zeleni mod postoji (`t-invest` stub); tabovi kroz `MOD_TABOVI.investitor = [parcela, portfelj]`.
- Auth/sesije/GDPR/tier — postojeći sustavi. **GDPR:** `investitor_analize` ulaze u `/api/moji-podaci` izvoz i brišu se CASCADE s računom (dodati u F4).
- Verzija ×3, BUILD-GATE, testovi samo rastu, ZIP isporuka, biblija se ažurira (novi dokument **`11-INVESTITOR.md`** u `oi-gradivo/docs/` — kreira se u F1 s nalazima tehničke verifikacije).
- SW: **ne keširati** WMS tile-ove ni WFS odgovore u service workeru (promet/svježina); keš je serverski.
- Rate limit: investitor rute max 30 upita/min/korisnik (čuva DGU limite i nas).

## I.6 Tierovi (zaključano)
Free ❌ (teaser ekran: opis + slika primjera studije + CTA nadogradnje) · Basic 1 · Pro 4 · Enterprise 10 **spremljenih analiza mjesečno** (server enforce na INSERT; pregled/uređivanje postojećih uvijek radi; brisanje ne vraća kvotu — sprječava recikliranje). *Ivan potvrđuje "mjesečno" u §V.*
AI značajke (F5) troše postojeći token-budžet — nula novih sustava naplate.

---

# DIO II — MOTOR IZRAČUNA (formule, točne)

## II.1 Kapacitet
```
P            = Σ površina čestica obuhvata (areaValue iz WFS-a)
gradivi_dio  = inset(geometrija obuhvata; ulica −o_u, međe −o_m)     o_u=5, o_m=3 default (iz gup_pravila; h/2 flag)
footprint    = min( P × k_ig , area(gradivi_dio) )                    ← odmaci često presude na malim parcelama
etaže        = katnost iz pravila (npr. Po+P+2+Uk)
GBP_nad      = footprint × (broj_punih_etaža + uk% )                  uk% default 0,75 (uvučeni kat)
GBP_cap      = P × k_is        → GBP = min(GBP_nad, GBP_cap)          (koja je metoda mjerodavna: min)
P_pod        = footprint × udio_podruma (default 1,0; podrum se unosi zasebno, tipično izvan k_is — flag po planu)
prodajni_m2  = GBP × netoBruto                                        default 0,75–0,80
stanova      = floor( prodajni_m2 / prosj_stan )                      default prosj_stan iz Ivanovih pravila
PGM_potreba  = ceil( stanova × pgm_norma )                            norma iz gup_pravila (npr. 1,0–1,5/stan)
PGM_kapacitet= floor( P_pod / m2_po_PGM_pod ) + floor( max(0, P − footprint − okoliš_min) × udio_vanjskih / m2_po_PGM_van )
               defaulti: m2_po_PGM_pod=30 (s manevrom), m2_po_PGM_van=15
AKO PGM_kapacitet < PGM_potreba → smanji stanova dok ne stane + 🚩 "PARKING LIMITIRA KAPACITET"
```

## II.2 Troškovi
```
T_zemljište  = Z × (1 + porez + posr) + odvjetnik          porez=3% (checkbox: ne ako ide PDV-put), posr default 2–3%
T_gradnja    = GBP_nad × c_nad + P_pod × c_pod + okoliš    c_pod ≠ c_nad (podrum skuplji/jeftiniji — Ivanov default)
T_meki       = pr% × T_gradnja + geodezija                 pr% = projektiranje+nadzor
V_m3         = GBP_nad × visina_etaže(3,0) + P_pod × 3,0
T_doprinosi  = V_m3 × komunalni_tarifa(zona I–IV) + V_m3 × vodni_tarifa + priključci
T_financiranje = udio_kredita × (Z + T_gradnja + T_meki) × kamata × (trajanje_mj/12) × faktor_povlačenja
               faktor_povlačenja default 0,55 (kredit se povlači postupno — ne plaćaš kamatu na sve od 1. dana)
T_nepredviđeno = np% × (T_gradnja + T_meki + T_doprinosi)  np% default 5–10
UKUPNO       = Σ svih
```

## II.3 Prihod i PDV
```
Prihod_bruto = prodajni_m2 × cijena_m2 + n_gm × cijena_gm (+ spremišta opcionalno)
Prihod_neto  = Prihod_bruto / 1,25  (ako cijene unesene s PDV-om — prekidač "cijene s PDV-om" default DA)
Breakeven    = UKUPNO / prodajni_m2         → prikaz U OBA: neto i s PDV-om (×1,25)
```

## II.4 Klasični smjer (znam cijenu zemljišta)
```
Dobit        = Prihod_neto − UKUPNO
Marža        = Dobit / UKUPNO
ROI_kapital  = Dobit / (vlastiti kapital = (1−udio_kredita) × (Z + T_gradnja + T_meki))
ROI_godišnje = ROI_kapital / (trajanje_mj/12)
```

## II.5 Rezidualni smjer (glavni terenski — "koliko smijem platiti")
Cilj se zadaje na dva načina (prekidač; default **b**):
```
(a) Ciljana dobit D (apsolutno ili % prihoda):
    L_ukupno = Prihod_neto − Troškovi_bez_zemljišta − D
(b) Ciljana marža m na UKUPNE troškove (uklj. zemljište s transakcijom):
    Prihod_neto = (C + L(1+t)) × (1+m)     C = troškovi bez zemljišta, t = porez+posr
    →  L = ( Prihod_neto/(1+m) − C ) / (1+t)
Max cijena zemljišta (za pregovore) = L ;  po m² = L / P
```
*(b) je točna algebra — porez i posredovanje rastu s L, a marža se računa i na zemljište; nema aproksimacije.*

## II.6 Osjetljivost
Matrica 3×3: cijena gradnje {−10 %, 0, +10 %} × prodajna cijena {−10 %, 0, +10 %} → dobit (klasični) ili max cijena zemljišta (rezidualni), obojeno zeleno/žuto/crveno.

## II.7 Optimizator (pseudokod)
```
opcije = []
za svaku tipologiju T u gup_pravila.dopuštene:                    // samostojeća, poluugrađena, ugrađena
  za svaku podjelu S obuhvata:                                    // 1 zgrada; 2 zgrade (ako ≥2 čestice ili širina dopušta)
    odmaci = odmaciZa(T, S)                                       // poluugrađena: jedna međa 0 m; ugrađena: dvije 0 m
    izračunaj kapacitet (II.1) → ako footprint < prag (npr. 60 m²) preskoči
    izračunaj financije (II.2–II.5) s trenutnim ulazima
    opcije.push({T, S, GBP, stanova, PGM_flag, dobit, rezidual, breakeven})
rangiraj po dobiti (ili rezidualu — isti redoslijed jer je C fiksan); prikaži top N s "zašto"
```
Primjer poruke: *„1× poluugrađena dvojna (2 čestice): dobit 545 k€ ✅ — bolja od 2× samostojeće (480 k€) jer se gubi jedan par odmaka."*

**Engine = čisti JS modul** (ulaz objekt → izlaz objekt, nula DOM-a) unutar index.html — identično testabilan u jsdom-u i pozivan iz UI-ja. PDF ne preračunava: čita spremljeni `rezultat` JSONB.

---

# DIO III — BAZA I API

## III.1 Tablice (po fazi uvođenja)
```sql
-- F1 (init-db)
wfs_kes (kljuc TEXT PK, odgovor JSONB, created_at TIMESTAMPTZ DEFAULT now());   -- TTL 30 d čišćenje pri upisu

-- F3 (init-db)
gup_pravila (id SERIAL PK, plan TEXT, sifra TEXT, namjena TEXT,
  k_ig NUMERIC, k_is NUMERIC, katnost TEXT, max_visina NUMERIC,
  odmak_medja NUMERIC DEFAULT 3, odmak_ulica NUMERIC DEFAULT 5, pravilo_h2 BOOLEAN DEFAULT false,
  pgm_norma NUMERIC, tipologije TEXT[],            -- {'samostojeca','poluugradjena','ugradjena'}
  napomena TEXT, izvor TEXT, UNIQUE(plan, sifra));
gup_odredbe (id SERIAL PK, plan TEXT, sifra TEXT, tekst TEXT, izvor TEXT);       -- korpus za AI (F5)
gup_nedostaje (id SERIAL PK, plan TEXT, sifra TEXT, lat NUMERIC, lng NUMERIC, ts TIMESTAMPTZ DEFAULT now()); -- log rupa

-- F4 (init-db)
investitor_analize (id SERIAL PK, korisnik_id INT REFERENCES korisnici(id) ON DELETE CASCADE,
  naziv TEXT, status TEXT DEFAULT 'razmatram',      -- razmatram|kupljeno|odbaceno
  cestice JSONB, geojson JSONB, parametri JSONB, opcije JSONB, kalkulacija JSONB, rezultat JSONB,
  biljeske TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE INDEX ix_inv_kor ON investitor_analize(korisnik_id, created_at);

-- F5 (init-db)
cijene_orijentir (id SERIAL PK, grad TEXT, kvart TEXT, cijena_od INT, cijena_do INT, azurirano DATE);
```

## III.2 API rute (sve `auth` + tier-gate gdje piše)
| Ruta | Ulaz | Izlaz | Napomene |
|---|---|---|---|
| `GET /api/investitor/parcela-tocka` | lat, lng | `{cestica:{kcbr,ko,povrsina,geojson}, adresa?}` | INTERSECTS→plan B lanac; keš; timeout 8 s → 504 s porukom |
| `GET /api/investitor/parcela` | kcbr, ko | isto | atributni filter → plan B (vidi I.4) |
| `GET /api/investitor/ko` | q | `[{ime, bbox}]` | keš 24 h; min 2 znaka |
| `GET /api/investitor/gup` | lat, lng | `{plan, sifra, namjena, pravila{...}, izvor}` ili `{rucno:true}` | F3; upiše u gup_nedostaje ako rupa |
| `GET /api/investitor/adresa` | lat, lng | `{adresa}` ili `{}` | best-effort, nikad ne blokira |
| `GET/POST/PATCH/DELETE /api/investitor/analize[/:id]` | — | CRUD | **POST: mjesečni tier-limit** → 402 `{error:'limit-analize', limit, iskoristeno}`; free → 402 `{error:'tier'}` |
| svi | — | — | rate-limit 30/min; superadmin bez limita |

Tier-limit upit: `SELECT COUNT(*) FROM investitor_analize WHERE korisnik_id=$1 AND created_at >= date_trunc('month', now())` uspoređen s `{basic:1,pro:4,enterprise:10}[tier]`.

---

# DIO IV — FAZE S MIKRO-KORACIMA

> Svaka faza: 1 sesija · verzija ×3 · BUILD-GATE · testovi samo rastu · ZIP · init-db gdje piše · biblija (11-INVESTITOR.md) se dopuni.

## FAZA 1 — Parcela na karti (+GPS, multi-čestica)
**Cilj:** bilo koja čestica u HR na karti u <5 s; H56 zlatni test geometrije.
**Preduvjeti:** ništa tvrdo (OSS javni servis radi bez ključa); ZIS authKey poželjan.

Mikro-koraci:
1. **1.1 Tehnička verifikacija (prvih 45 min):** privremena debug ruta `/_probe` (superadmin) → (a) OSS WMS GetCapabilities; (b) WFS GetFeature INTERSECTS za poznatu točku H56 — proba `cql_filter`, pa OGC XML Filter, pa BBOX+turf; (c) proba atributnog filtera (label / nationalCadastralReference); (d) zapiši ishode u 11-INVESTITOR.md (koji put radi = kanonski). Debug ruta se briše prije isporuke.
2. **1.2 Server util:** `proj4` dependency; `htrs96↔wgs84(geojson)`; normalizator odgovora (GML/GeoJSON → naš oblik).
3. **1.3 Ruta `parcela-tocka`** (validacija, kanonski upit iz 1.1, keš u `wfs_kes`, greške: 404 "nema čestice", 504 timeout s porukom "državni servis ne odgovara — pokušaj ponovno").
4. **1.4 Ruta `parcela` (kčbr+ko)** kanonskim atributnim filterom; ako 1.1 pokaže da ne radi → ruta vraća 501 `{error:'kcbr-uskoro'}` i UI nudi klik/GPS (iskreno, ne blokira).
5. **1.5 Ruta `ko`** autocomplete (GetFeature CadastralZoning propertyName=ime+bbox, keš 24 h, filtriranje na serveru).
6. **1.6 Ruta `adresa`** (AD:Address nearest u radijusu 50 m; best-effort).
7. **1.7 Klijent — Leaflet lazy:** CDN skripta se učitava tek pri prvom ulasku u Investitor (štedi mobilni promet i boot ostatka appa); guard ako CDN padne → poruka + retry gumb.
8. **1.8 Karta:** OSM podloga default; toggle DOF (WMS); toggle katastar overlay (WMS, transparent); atribucija DGU.
9. **1.9 Tab Parcela UI:** gumbi [📍 Gdje stojim] [🔍 Traži] (kčbr+ko forma s autocomplete), klik-na-kartu handler; kartica **Obuhvat** (chips čestica s ✕, zbroj m², adresa); poligoni obojeni (aktivna čestica punija, obuhvat obrubljen).
10. **1.10 Multi-čestica:** klik na susjednu → dodaj; klik na postojeću → makni (toggle); `turf.union` za obrub; upozorenje ako nesusjedne ("čestice se ne dodiruju — sigurno ista investicija?") ali dopusti.
11. **1.11 GPS:** geolocation permisija; krug točnosti; greške (odbijeno → uputa; timeout → retry); nakon fiksa isti tok kao klik.
12. **1.12 Rubovi:** više čestica pod točkom (granica) → bottom-sheet izbor; čestica multipoligon → radi (union); zoom-to-fit nakon dohvaćanja.
13. **1.13 Offline:** ako fetch padne (teren bez signala) → kartica "Bez mreže — ručni unos": polje površina m² ručno; ostatak toka (F2 kalkulator) **radi potpuno offline**. (Velika terenska vrijednost.)
14. **1.14 Testovi (+8):** konverzija koordinata (poznati par), normalizator (GML fixture), rute s mock WFS-om (tocka/kcbr/ko/greške), klijent smoke (mock fetch → poligon u DOM-u + zbroj površina), zlatni: H56 površina = katastar ±1 m².
15. **1.15 Isporuka:** GATE, ZIP `oi-vNNN-investitor-f1.zip`, **init-db (wfs_kes)**, biblija.

**Gotovo kad:** H56 iscrtana s točnom površinom; GPS i klik rade; susjedna se dodaje klikom; offline fallback radi.
**Rizici:** DGU auth kasni → OSS; INTERSECTS ne radi → BBOX+turf; adresa nedostupna → naslov kčbr/k.o. (ništa ne blokira).

## FAZA 2 — Financijski motor (klasični + rezidualni)
**Cilj:** kalkulator koji reproducira Ivanov H56 izračun i daje max cijenu zemljišta.
**Preduvjeti (Ivan):** Excel H56 + defaulti (checklist §V).

1. **2.1 Engine modul** (čisti JS u index.html: `invIzracun(ulazi) → rezultat`; nula DOM-a).
2. **2.2 Shema ulaza** sa SVIM stavkama iz II.1–II.5 + Ivanovi defaulti kao početne vrijednosti (spremaju se po korisniku u localStorage kao "moji defaulti" + gumb reset).
3. **2.3 Formule II.1–II.3** (kapacitet pojednostavljen: bez gradivog dijela do F3 — footprint = P×k_ig; polje "gradivi dio" postoji ali ručno).
4. **2.4 PDV prekidač** (obje breakeven vrijednosti, jasno označeno).
5. **2.5 UI Klasični:** grupe (Zemljište/Gradnja/Meki/Doprinosi/Financiranje/Ostalo) sklopive; live preračun; rezultat: veliki broj breakeven + dobit/marža/ROI/godišnji ROI kartice.
6. **2.6 UI Rezidualni:** cilj (marža na troškove default | % prihoda | apsolutno), prodajna cijena; rezultat: **MAX CIJENA ZEMLJIŠTA** veliki broj + €/m² zemljišta.
7. **2.7 Osjetljivost 3×3** (obojena; klik na ćeliju → primijeni taj scenarij u ulaze).
8. **2.8 Komunalni doprinos auto** iz volumena × tarifa (zone I–IV editable tablica u ulazima).
9. **2.9 Mobilni "brzi način":** 3 polja (prodajna cijena, cijena gradnje, ciljana marža) + defaulti → max cijena zemljišta; "detaljno" otvara sve grupe.
10. **2.10 Testovi (+12):** engine unit (svaka formula zasebno; faktor povlačenja; PDV oba smjera; rezidual algebra (b) — ručno izveden slučaj), **zlatni H56: breakeven = Ivanov broj ±1 €/m²**, rezidual sanity (poznati ulazi → ručno provjeren L).
11. **2.11 Isporuka:** GATE, ZIP, bez sheme.

**Gotovo kad:** H56 sjeda; rezidual vraća ručno provjeren broj; mobilni brzi način <60 s.

## FAZA 3 — GUP Zagreb + gradivi dio + PGM
**Cilj:** za zagrebačku česticu parametri se popune sami; gradivi dio nacrtan; parking provjeren.
**Preduvjeti (Ivan):** GUP odredbe (PDF/link) + prioritetne namjene.

1. **3.1 Verifikacija ZG slojeva (prvih 45 min):** GeoHub FeatureServer query (point intersects) za Namjenu i Urbana pravila — polja, šifre; zapiši u bibliju.
2. **3.2 Punjenje `gup_pravila`:** ja iz odredbi izvučem parametre za prioritetne namjene → tablica (JSON seed) → **Ivan pregleda i potvrdi** (stručna validacija!) → seed u init-db. Odredbe (tekst) paralelno u `gup_odredbe`.
3. **3.3 Ruta `gup`** (presjek → šifra → join pravila; rupa → `{rucno:true}` + log u gup_nedostaje).
4. **3.4 UI kartica Urbanistički uvjeti:** auto vrijednosti s oznakom izvora ("GUP Zagreb · zona M1 · pravilo 2.2"), sve editable; upozorenje rub zone (centroid < 10 m od granice → 🚩 "provjeri — možda dvije zone").
5. **3.5 Ulična stranica:** predodabir = stranica najbliža adresnoj točki (ako je imamo), korisnik potvrđuje/mijenja klikom na brid poligona (highlight).
6. **3.6 Gradivi dio (geometrija):** inset per-brid (ulica −o_u, ostale −o_m): pomak svakog brida prema unutra + presjek poluravnina (implementacija: turf transformacije; validirano na test-poligonu). Crta se šrafirano na karti; površina ispisana.
7. **3.7 Kapacitet nadogradnja:** footprint = min(P×k_ig, gradivi dio) — engine iz F2 dobiva novi ulaz.
8. **3.8 PGM provjera** (II.1): potreba vs kapacitet; 🚩 "PARKING LIMITIRA — max N stanova" + auto-korekcija broja stanova (uz mogućnost override).
9. **3.9 h/2 pravilo:** ako `pravilo_h2` → odmak = max(o_m, visina/2); visina iz katnosti × 3,0 m (editable).
10. **3.10 Testovi (+10):** inset poznati pravokutnik 20×30 (−5 ulica, −3 međe → površina točno 14×24=336), gup ruta mock (pogodak/rupa), PGM rubovi (točno stane / ne stane / override), h/2.
11. **3.11 Isporuka:** GATE, ZIP, **init-db (gup tablice + seed)**, biblija.

**Gotovo kad:** H56 auto-parametri točni (Ivan potvrdi); gradivi dio vizualno ispravan; PGM zastava radi.

## FAZA 4 — Optimizator + Portfelj + PDF studija
**Cilj:** rang-lista opcija gradnje; spremanje s tier-limitima; isporučiv PDF.

1. **4.1 Optimizator modul** (II.7): tipologije × podjele; koristi engine + gradivi dio s odmacima po tipologiji (poluugrađena: jedna međa 0; ugrađena: dvije 0 — korisnik bira koje međe su "spojne" ako ima izbora, default najduže).
2. **4.2 UI Opcije gradnje:** kartice rangirane (naziv, GBP, stanovi, dobit/rezidual, 🚩 PGM ako ima), "zašto" redak (usporedba s #2), klik → opcija puni Financije.
3. **4.3 `investitor_analize` CRUD** + tier-limit (III.2) + statusi + updated_at.
4. **4.4 Portfelj tab:** lista (naziv/adresa, m², najbolja opcija, ključni broj, status), filtri, bilješke (inline), **usporedba do 3** (checkbox → tablica jedna-do-druge).
5. **4.5 Teaser za Free:** umjesto taba — ekran s opisom, screenshot studije, CTA "Dostupno od Basic".
6. **4.6 GDPR:** analize u `/api/moji-podaci` izvoz; CASCADE brisanje (već u DDL-u) — test.
7. **4.7 PDF „Studija isplativosti"** (7 stranica): ①naslovnica (naziv, adresa, datum, **karta = WMS GetMap statička slika bbox-a obuhvata** — bez html2canvas komplikacija; logo opc.) ②obuhvat (čestice, površine) ③urbanistički uvjeti (+izvor) ④opcije gradnje (rang tablica) ⑤financije odabrane opcije (raščlamba) ⑥osjetljivost (matrica) ⑦pretpostavke + disclaimer. Postojeći PDF pipeline (dopis-pdf stil, zelena paleta).
8. **4.8 Testovi (+12):** optimizator zlatni (uska parcela: poluugrađena > 2× samostojeća — ručno konstruiran slučaj), tier-limit 402 (basic druga analiza), free 402, GDPR izvoz sadrži analize, PDF smoke (generira se, >5 str).
9. **4.9 Isporuka:** GATE, ZIP, **init-db (investitor_analize)**, biblija.

**Gotovo kad:** optimizator na H56 daje smislen rang (Ivan potvrdi brojke); basic dobije limit na 2.; PDF isporučiv klijentu/banci.

## FAZA 5 — Napredno (cijene, scenariji, AI)
1. **5.1 `cijene_orijentir`** + superadmin unos (dashboard sekcija) + prikaz u Financijama ("Črnomerec: 6.800–7.400 €/m² · ažurirano 3/2026") — orijentir, ne autoritet.
2. **5.2 Scenariji:** spremljeni setovi ulaza (pesimist/realist/optimist) po analizi; usporedni prikaz.
3. **5.3 AI tumač GUP-a:** `gup_odredbe` → postojeći RAG pipeline (chunk→embed voyage→hibrid) kao novi korpus; pitanja tipa "smijem li u M1 poslovni prizemlje?"; troši token-budžet.
4. **5.4 AI rizici:** prompt nad spremljenim rezultatom → 5 rečenica rizika ("parking limitira; breakeven 8 % ispod tržišta = tanak buffer; rub zone").
5. **5.5 ISPU integracija** za namjenu izvan Zagreba (probni pozivi, pa isti obrazac kao ZG).
6. **5.6 DZS/eNekretnine** referentni linkovi uz cijene.
7. Testovi +8; GATE; ZIP; **init-db (cijene_orijentir)**.

---

# DIO V — ŠTO IVAN PRIPREMA (točan format)

1. ⬜ **ZIS/DGU registracija → authKey** (može i tijekom F1; OSS premošćuje).
2. ⬜ **Excel Hercegovačka 56** — pošalji datoteku (xlsx) ili tablicu: svaka stavka troška s iznosom i formulom; prodajne pretpostavke; tvoj breakeven. *Ovo postaje zlatni test F2 — bez toga F2 ne može biti "besprijekorna".*
3. ⬜ **Defaulti (tablica vrijednosti):** c_nad €/m², c_pod €/m², okoliš €, pr %, kamata %, udio kredita %, trajanje mj, np %, posr %, prosj_stan m², netoBruto, ciljana marža % (rezidual), cijena garažnog mjesta €, m²/PGM (pod/vanjski) ako imaš svoje.
4. ⬜ **GUP Zagreb odredbe za provedbu** — link ili PDF (važeća verzija + izmjene 2025).
5. ⬜ **Prioritetne namjene** (npr. M1, M2, S) — redoslijed punjenja gup_pravila.
6. ⬜ **Tvoja pravila palca:** uvučeni kat %, PGM/stan koji koristiš, podrum u/izvan k_is po GUP-u, PDV tretman u tvojim računicama, h/2 praksa.
7. ⬜ **Potvrde odluka:** (a) limit analiza = mjesečno? (b) rezidual default = marža na troškove? (c) PDF s logom ŽBUKA/OI?
8. ⬜ (Opc.) 2-3 stvarne parcele koje trenutno gledaš — kao dodatni test-slučajevi uz H56.

# DIO VI — RIZICI (sažeto) 
| Rizik | Vjerojatnost | Plan B |
|---|---|---|
| DGU filter dijalekt | srednja | 3-stupanjski lanac (cql → XML → BBOX+turf) — jedan sigurno radi |
| kčbr atributni filter ne radi | srednja | klik/GPS pokriva sve; kčbr dolazi naknadno |
| ZG slojevi bez parametara u atributima | visoka | zato i postoji `gup_pravila` — parametri iz odredbi (naš posao u 3.2) |
| GUP se mijenja | sigurna (periodično) | `plan` stupac verzionira; ažuriranje = novi seed; odredbe u bazi |
| DGU limiti/quota | niska | keš + rate-limit + authKey |
| Krive auto-vrijednosti navedu korisnika | srednja | sve editable + izvor prikazan + disclaimer + Ivan validira seed |

# DIO VII — REDOSLIJED PRVE SESIJE NOVOG RAZGOVORA
1. Povuci ovaj dokument + Ivanove materijale (§V) → 2. Faza 1 mikro-koraci 1.1–1.15 → 3. ZIP + init-db + upute → 4. Ivan push + test na H56 → 5. biblija 11-INVESTITOR.md commit.

*Kraj master strategije. Nakon Ivanovog čitanja: dopune → zaključavanje → novi razgovor.*

---
## STATUS 2026-07-09 (v183) — dopuna strategije
- **F1 ISPORUČEN** (v161–v183): karta, klik→čestica, GPS s uputama, kčbr pretraga, obuhvat više čestica, ručni m², WMS granice (v183 anonimni cp_wms). Čeka samo Ivanovu produkcijsku potvrdu čestice 2362.
- **ODLUKA: F1.5 ATOM postaje primarni izvor geometrije** (WFS api.* nepouzdan za strojni pristup: 400 na ne-browser klijente + 500 epizode). ATOM = lokalna PG baza čestica → ms odgovori, bez ovisnosti, kčbr za SVE čestice (BROJ_CESTICE). WFS pada na fallback.
- **DGU potvrda (mail 2026-07-09):** CP WMS/WFS + BU WFS (zgrade DKP!) su ZA ANONIMNE korisnike. Ivanov token = pričuva u Railway ENV.
- **Namjena/urbana pravila:** NISU kod DGU → ZG Geoportal WMS `GUPZagreb_Public` GetFeatureInfo (primarno) / dservices8 WFS Planirana namjena 2023 / ISPU nacionalno. GeoHub NEMA GUP slojeve (provjereno).
- Detalji izvora: **OI-DGU-IZVORI-PODATAKA.md** (jedina istina o izvorima).
