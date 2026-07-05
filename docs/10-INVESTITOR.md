# 10 — INVESTITOR (zadnja faza aplikacije: od kčbr do investicijske studije)

> **Status:** planirana ZADNJA faza (F21–F27), kreće **tek nakon F20 / launcha v1.0** 🔒. Ovaj dokument je potpuna istina za nju — pisan da buduća sesija NE MORA izmišljati arhitekturu, samo izvoditi. Prije F21 obavezno pročitati: 00, 01, 02, 03, 04, 07 + ovaj dokument.

## 1. Vizija u jednoj rečenici
Investitor unese **kčbr + katastarsku općinu** (jedan ili više), aplikacija sama povuče geometriju čestice, utvrdi **GUP namjenu**, izračuna **što se smije graditi** (tipologije, gabariti, kig/kis, katnost, parkiranje), nacrta **volumetrijsku studiju** (SVG s kotama), prođe **pravni checklist s klikabilnim citatima** iz postojeće baze članaka, i izbaci **investicijsku studiju s brojkama** (PDF) — sve u minutama umjesto tjedana.

## 2. Tri stupa, jedan temelj (proširenje 01 §2)
| | **PRIPREMA** (instruktor) | **PRAKSA** (vještak) | **INVESTITOR** (studija) |
|---|---|---|---|
| Korisnik | kandidat | inženjer/vještak | investitor, developer, vlasnik zemljišta, agencija |
| Ulaz | datum ispita | pitanje s gradilišta | kčbr + k.o. |
| Srce | testovi+SRS+usmeni | AI odgovor s citatima | geometrija→pravila→brojke→PDF |
| Izlaz | položen ispit | citat+koraci | volumetrija + studija isplativosti |
| KPI | spremnost % | vrijeme-do-odgovora | analiza < 5 min, Ivan-test točnosti |
🔒 **Temelj je ZAJEDNIČKI:** ista baza članaka (GUP odredbe se UVOZE kao dokument kroz postojeći pipeline 06!), isti RAG, isti račun/tier sustav, isti PDF generator. INVESTITOR je novi ekran + geometrijski engine + dvije kurirane JSON tablice — NE nova aplikacija.

## 3. KLJUČNE ARHITEKTONSKE ODLUKE (redoslijedom važnosti)

### 3.1 Geometrija čestice: SLUŽBENI WFS, ne slika 🔒
**Problem s Ivanovom prvom idejom** (upload PDF/slike s GUP portala, AI očita mjerilo 1:M i "nacrta parcelu"): raster nema pouzdano mjerilo (DPI, izrez, rotacija, kompresija), vektorizacija granica iz slike je nepouzdana, a greška od 3 % na fronti ruši cijeli proračun gabarita. **Rješenje: geometriju NE čitamo iz slike nego iz službenog servisa** — DGU (Državna geodetska uprava) po INSPIRE direktivi javno servira katastarske čestice:
- **Primarno:** WFS/OGC API sloj *Cadastral Parcels* (kčbr + MB k.o. → GML/GeoJSON poligon u **EPSG:3765 / HTRS96-TM** — koordinate SU METRI, mjerilo je NEPOTREBNO!). Endpoint i parametre utvrditi u F21 (geoportal.dgu.hr / oss.uredjenazemlja.hr — servisi se mijenjaju, sesija F21 verificira aktualni URL + uvjete korištenja i upisuje ih OVDJE).
- **Fallback A (vektorski PDF):** DKP izvod iz e-katastra je često vektorski PDF → pdfplumber `lines/curves` + tekst kota → rekonstrukcija (profil-F iskustvo: geometrija iz PDF-a je izvediva).
- **Fallback B (raster/slika):** Claude vision očita OBLIK + korisnik OBAVEZNO unese duljinu fronte s izvoda (kalibracija mjerila ručnim sidrom) → prikaz s trakom "⚠ geometrija iz slike, tolerancija ±3 %". Nikad jedini put za naplaćenu studiju.
- **Više kčbr:** union poligona (turf.union) → jedna obračunska čestica; presjek mora biti povezan (inače upozorenje).
🔒 Svaka analiza sprema **izvor geometrije** (wfs/pdf/slika/ručno) — pojavljuje se u PDF studiji i disclaimeru.

### 3.2 GUP namjena: servis + OBAVEZNA ljudska potvrda 🔒
- **Primarno:** Zagreb geoportal WMS **GetFeatureInfo** na reprezentativnu točku čestice (pole-of-inaccessibility, ne centroid — centroid L-čestice zna pasti izvan!) → šifra namjene (S, M1, M2, K1, G, Z…). URL sloja utvrditi u F22 i upisati ovdje.
- **Fallback:** korisnik uploada izrez GUP karte → Claude vision očita boju+šifru → prikaz "Očitao sam **M1 — mješovita, pretežito stambena** — potvrdi ili ispravi".
- 🔒 **Namjena se UVIJEK potvrđuje klikom korisnika** prije proračuna (o njoj ovisi sve; servis zna kasniti za izmjenama GUP-a). Potvrda se loga u analizu.
- **Multi-grad dizajn od prvog dana:** sve što je "Zagreb" živi u `gup/zagreb/…` (pravila.json, WMS URL, zone doprinosa). Drugi grad = novi folder, nula izmjena koda 🔒.

### 3.3 Pravila NE halucinira AI: dvije kurirane JSON tablice 🔒
Isti princip kao rokovi.json (01/07): **KOD RAČUNA, AI OBJAŠNJAVA, ČLANCI SE CITIRAJU.**

**`gup/zagreb/pravila.json`** (kurira Ivan uz AI; verzija = datum GUP izmjene; git = povijest):
```json
{ "grad": "Zagreb", "verzija_gup": "GUP ZG — SG 21/24", "vrijedi_od": "2024-07-01",
  "namjene": {
    "S":  { "naziv": "Stambena", "tipologije": ["samostojeca","poluugradena","ugradena"],
            "kig": 0.3, "kis": 1.2, "katnost": "Po+P+2", "visina_m": 9.0,
            "min_cestica_m2": {"samostojeca": 400, "poluugradena": 300, "ugradena": 240},
            "min_fronta_m":   {"samostojeca": 14,  "poluugradena": 12,  "ugradena": 9},
            "udaljenost_medja_m": {"samostojeca": 3, "poluugradena_slobodna_strana": 3},
            "pravilo_h2": true, "gradjevni_pravac_min_m": 5, "min_zelenilo_pct": 30,
            "parkiranje": {"stan_do_60m2": 1, "stan_od_60m2": 2, "poslovni_po_m2": 0.033},
            "citati": ["Odluka o donošenju GUP-a — čl. …"] },
    "M1": { "...": "…po istom obrascu…" }
  },
  "napomene": ["h/2 pravilo: udaljenost = max(3 m, visina_vijenca/2) kad pravila.json kaže pravilo_h2"] }
```
⚠ Brojke gore su ILUSTRACIJA SHEME — stvarne vrijednosti Ivan verificira iz Odluke o donošenju GUP-a (on ovo radi napamet 25 godina; F22 je zajednička kuraža). **Odredbe za provedbu GUP-a uvesti kao dokument u bazu članaka** (pipeline 06, profil po izvoru) → checklist i AI citiraju KLIKABILNO.

**`gup/zagreb/troskovi.json`** (Ivanove stvarne brojke iz ŽBUKA prakse + službene tarife):
```json
{ "verzija": "2026-07", "gradnja_eur_m2": {"roh_bau": 750, "kljuc_u_ruke": 1400, "visoki_standard": 1900},
  "komunalni_doprinos_zone_eur_m3": {"I": 20.16, "II": 13.44, "III": 8.4, "IV": 4.2},
  "vodni_doprinos_eur_m3": 1.35, "prikljucci_pausal": {"struja": 2500, "voda": 3000, "plin": 2200},
  "projektiranje_pct": 3.5, "nadzor_pct": 1.2, "geodet_pausal": 1500,
  "porez_promet_nekretnina_pct": 3, "agencija_pct": 2, "rezerva_pct": 7,
  "napomena": "komunalni: obujam po Pravilniku NN 15/19 (u bazi!); zone po Odluci Grada — verificirati pri svakoj izmjeni" }
```

### 3.4 Geometrijski engine (deterministički, testabilan)
1. **Fronta:** korisnik KLIKNE rub(ove) čestice prema prometnici (v1 ručno = pouzdano 🔒; v2 auto-detekcija preko susjednih čestica s načinom uporabe "cesta").
2. **Gradivi dio:** per-brid offset prema unutra — fronta za `gradjevni_pravac_min_m`, bočne/stražnja za `udaljenost_medja_m` (ili h/2 → h iz `visina_m`); presjek offsetanih poluravnina (konveksne točno; konkavne konzervativno — dokumentirati u ispisu). Tipologija mijenja koje međe imaju 0 m (poluugrađena/ugrađena).
3. **Kapacitet po tipologiji:** max tlocrt = min(kig·P, površina gradivog dijela); GBP = min(kis·P, tlocrt·broj_etaža); obujam za doprinos po **Pravilniku NN 15/19** (u bazi — GRA lista!); parkirna mjesta iz normativa → provjera stanu li na česticu (PM = 12.5 m²+manevriranje pojednostavljeno 25 m²/PM vanjsko).
4. **Parcelacija (opcija):** podjela okomito na frontu na N dijelova uz min_cestica i min_fronta; sve nove čestice moraju dirati frontu (inače flag "potrebna interna prometnica — v2").
5. **Volumetrija SVG:** čestica + gradivi dio (šrafura) + upisani gabarit (najveći pravokutnik orijentiran na frontu) + kote udaljenosti + sjever + tablica brojki. 🔒 Ovo NIJE tlocrt prostorija ni projekt — **"preliminarna volumetrijska studija"** (AI tekstualno predloži organizaciju: ulaz/garaža prema fronti, dnevni jug…).
6. Biblioteka: turf.js (union/area/buffer) + ~150 linija vlastite per-brid offset logike; **sve s jediničnim testovima na 3 sintetske čestice + Hercegovačka 56 kao zlatni test** (Ivan IMA stvarne brojke svog projekta → engine mora reproducirati njegov ručni proračun!).

### 3.5 Pravni checklist = spoj s Vještakom
Automatski RAG upiti nad POSTOJEĆOM bazom, svaki check → status + klikabilan citat: priključak na javnu cestu (Pravilnik o priključcima — uvezen!), udaljenost od željeznice (pružni pojas — uvezen!), ZOP razmaci, vodozaštitne zone (uvezen!), ceste-elementi, kulturno dobro flag (ručni unos v1). Format: `[✓/⚠/✗] tvrdnja — Članak X. <link>`.

### 3.6 Investicijska studija (PDF)
Stavke: zemljište (unos) · porez 3 % · geodet/parcelacija · projektiranje % · komunalni (zona×obujam) · vodni · priključci · gradnja (standard×GBP) · nadzor % · rezerva % → **ukupno, €/m² izlazno, marža** uz unos očekivane prodajne €/m² (Ivan ima ZG tržišne brojke). Struktura PDF-a: naslovnica s disclaimerom → geometrija/izvor → namjena+potvrda → kapaciteti po tipologijama → volumetrija → checklist s citatima → financije → pretpostavke i verzije tablica. PDF kroz postojeći pipeline.

## 4. Pravna ograda 🔒 (doslovno u UI + PDF)
> "Ovo je preliminarna studija izvedivosti izrađena automatiziranom analizom javno dostupnih prostornih podataka i važećih propisa. **Nije lokacijska informacija, nije projektna dokumentacija i ne zamjenjuje posebne uvjete javnopravnih tijela ni geodetski elaborat.** Prije bilo kakvog ulaganja obvezno angažirajte ovlaštene stručnjake."
Analiza sprema: verzije pravila.json/troskovi.json, izvor geometrije, datum, potvrdu namjene.

## 5. Shema (dodaci u 03 pri F21)
`investitor_analize` (id, korisnik_id, naziv, kcbr_json, ko_mb, geometrija_geojson, izvor_geometrije, namjena, namjena_potvrdjena_at, params_json, rezultat_json, verzija_pravila, verzija_troskova, created_at) · pravila/troškovi su **file-based u repou** (git = verzioniranje) 🔒 v1 — NE tablica.

## 6. Rute (dodaci u 04 pri F21)
`POST /api/investitor/cestica` {kcbr[], ko} → geometrija+površina · `GET /api/investitor/namjena?lat&lng` → šifra (proxy WMS, keš 24 h) · `POST /api/investitor/analiza` {geometrija, namjena, tipologija?, parcelacija?} → kapaciteti+SVG+checklist · `POST /api/investitor/studija` {analiza_id, troskovni_unosi} → PDF · sve auth + planEnforce (tier).

## 7. Fazni plan (poslije F20; format kao 08)
**F21 — Geometrijski temelj** · WFS klijent+keš (tablica ili disk), prikaz čestice (Leaflet + DGU DOF WMS podloga), multi-kčbr union, fallback ručni unos · Gotovo: Ivan unese **Hercegovačka 56 (k.č. 2362 k.o. Črnomerec)** i vidi SVOJU česticu s točnom površinom · 2 sesije · ⚠ prva sesija VERIFICIRA aktualne DGU endpointe/ToS i upisuje ih u §3.1.
**F22 — Pravila + namjena** · gup/zagreb/pravila.json (Ivan kurira!), WMS namjena + potvrda UI, uvoz Odluke GUP-a u bazu članaka (pipeline 06) · Gotovo: 5 test-čestica → namjena i brojke točne po Ivanu · 2 sesije.
**F23 — Regulacijski engine** · fronta-klik, per-brid offset, tipologije, kapaciteti, volumetrija SVG · Gotovo: **engine reproducira Ivanov ručni proračun Hercegovačke** (zlatni test) · 2–3 sesije.
**F24 — Parcelacija** · 1 sesija.
**F25 — Studija + PDF** · troskovi.json, financijska tablica, PDF · Gotovo: Ivan usporedi sa svojom stvarnom investicijskom studijom · 2 sesije.
**F26 — AI izvještaj + checklist** · RAG checklist s citatima, AI sinteza "prijedlog objekta" (07 pravila: citati post-provjera KODOM) · 1–2 sesije.
**F27 — Paket + landing** · tier "Investitor" (cijena 🔓 Ivanova poluga; tehnički: planEnforce flag + Stripe price), landing sekcija na ai.zbuka.hr stilu · 1 sesija.

## 8. Rizici (pošteno)
DGU servisi se mijenjaju/rate-limitaju → keš + fallback lanac §3.1 · GUP izmjene → verzija+datum u json, disclaimer "provjeri važeći GUP" · h/2 kružnost (visina↔udaljenost) → h fiksno iz katnosti tablice v1 · konkavne čestice → konzervativan gradivi dio (piše se u ispisu) · ZOP razmaci pojednostavljeni v1 · odgovornost → §4 ograda + human-potvrde.

## 9. BRAND — krovno ime za tri stupa (🔓 ODLUKA NA KRAJU, ovdje samo smjernice)
Tri proizvoda, jedan temelj (propisi): PRIPREMA · PRAKSA/VJEŠTAK · INVESTITOR. Kandidati (provjeriti domenu+žig prije odluke):
| Ime | Zašto | Rizik |
|---|---|---|
| **NORMA** | već ime design-sustava; autoritet, kratko, izgovorljivo | generično, domena vjerojatno zauzeta (normagrad.hr?) |
| **TEMELJ** | savršena metafora sva tri stupa; hrvatski, toplo | provjeriti temelj.hr/.app |
| **KOTA** | graditeljski, 4 slova, logo-friendly (simbol kote ↕) | manje govori laiku-investitoru |
| **GABARIT** | investitorski vokabular | dugačko |
| **REGULA** | propisi-korijen, tech zvuk | latinski hladno |
Logo smjer: monogram + navodnici »« (citat = DNK proizvoda) ili kota-simbol; Norma paleta (#2B4A75 + papir #F5F5F1). **Odluka i logo: zadnja sesija F27, Ivan bira.**

## CHANGELOG
- 1.0 (2026-07-05): inicijalni dokument — arhitektura (WFS umjesto slike 🔒, kurirane tablice 🔒, kod-računa-AI-objašnjava), faze F21–F27, sheme JSON tablica, rizici, brand smjernice.
