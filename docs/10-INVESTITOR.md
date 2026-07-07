# 10 — INVESTITOR (mod: od kčbr do investicijske studije)

> **Verzija:** 2.0 · **Datum:** 2026-07-07 · **Status:** konceptualni razvoj u tijeku (nije još kod).
> Ovaj dokument je puna istina za Investitor mod. Verzija 1.0 (2026-07-05) postavila je temeljnu arhitekturu; verzija 2.0 unosi **Ivanove odluke iz sesije 2026-07-07** (razbijanje koncepta) i mijenja pristup s "zadnja faza poslije launcha" na **aktivan konceptualni razvoj sada**. Prije pisanja koda pročitati: 00, 01, 02, 03, 04, 07 + ovaj dokument.
>
> **VAŽNO — što se promijenilo od v1.0:** Ivan je odlučio da Investitor NIJE nužno zadnja faza poslije launcha — počinjemo **konceptualni razvoj odmah**, a prvi kodni korak je **prikaz čestice preko WFS-a**. Ovaj dokument je proširen njegovim konkretnim odlukama (dolje §0).

---

## 0. IVANOVE ODLUKE IZ SESIJE 2026-07-07 (🔒 temelj v2.0)

Kroz strukturiranu raspravu (ask_user_input) Ivan je donio sljedeće odluke koje su sada temelj:

1. **Korisnik = profesionalci** (developeri, projektanti, investitori s iskustvom). → maksimalna dubina, stručni vokabular, ne pojednostavljivati za laike. Investitor mod NIJE za širu publiku nego za ljude koji znaju čitati gabarite.

2. **Najvažniji izlaz = sve troje ravnopravno u JEDNOM PDF-u:** volumetrija + financije + pravni checklist. Ne biramo jedan fokus — cjelovita studija je proizvod.

3. **GUP pokrivenost = Zagreb + priprema za druge gradove OD DANA 1.** Struktura `gup/<grad>/` od početka (Zagreb prvi, ali kod ne smije biti "hardkodiran na Zagreb"). Drugi grad = novi folder, nula izmjena koda 🔒.

4. **Geometrija prva verzija = WFS + fallback na sliku s ručnom kalibracijom fronte** (±3%, izvor geometrije se pamti i pojavljuje u PDF-u). Potvrđeno da je DGU WFS **javno dostupan** (web search 2026-07-07): endpoint `https://api.uredjenazemlja.hr/services/inspire/cp/wfs`, klase `CP:CadastralParcel` + `CP:CadastralZoning`, koordinate u metrima (HTRS96/TM), **komercijalna upotreba dozvoljena** uz izjavu o izvoru + datum + poveznicu. WMS za registrirane: `https://oss.uredjenazemlja.hr/OssWebServices/inspireService/wms?token=xyz`.

5. **Financije = DJELOMIČNO u MVP** (GBP + gruba procjena troška; puni breakeven/ROI izračun dolazi u fazi 2). Ne čekamo savršenu financijsku analizu za prvu verziju.

6. **Crtanje = app PREDLAŽE početnu masu/tlocrt koju korisnik korigira** 🔒 (ključna odluka). App crta **maksimalnu volumetrijsku masu** unutar dozvoljene ovojnice (NE arhitektonski raspored prostorija) — korisnik je prstom oblikuje/korigira, uz **živu provjeru zeleno/crveno** na odmake, kig i kis. Ovo je bitna promjena od v1.0 gdje je korisnik samo klikao frontu: sada app aktivno predlaže masu, korisnik je dorađuje.

7. **PRVI korak koji se kodira = WFS prikaz čestice** 🔒. Korisnik unese kčbr → app prikaže česticu na karti (+ susjedne). To je temelj svega ostaloga; sve druge značajke grade se na tome.

### Ivanova vizija toka (megalomanska ali "idemo redom")
Ivan je opisao pun tok kako ga vidi:
> Korisnik kaže da je zainteresiran za kupnju čestice → app prikaže česticu (+ susjedne) → Claude provuče namjenu + urbano pravilo + uvjete → prema arhitektonskim pravilnicima nacrta tlocrt (odmak od susjeda i ceste, provjeri pristupni put, prst-korekcija poligona uz zeleno/crveno) → GBP iz tlocrtne površine → iskoristivost → financijska analiza kao Hercegovačka.

Claude je odgovorio: idemo redom, korak po korak, prvi je WFS prikaz čestice.

### GBP izračun — POTVRĐEN pravni temelj
Pravilnik o načinu izračuna građevinske bruto površine (već u planu za bazu članaka, "arh-uvoz"):
- **čl. 3:** koeficijent **0,25** za garažu, **0,50** za pomoćni prostor (kad je etaža ≥75% ispod konačno zaravnanog terena);
- **čl. 4:** NE uračunava se prostor svijetle visine < 2,0 m.
→ KOD računa GBP i CITIRA članak (isti princip kao rokovi.json: kod računa, AI objašnjava, članci se citiraju).

### PENDING prije pisanja finalnog koncepta
Claude čeka od Ivana **referentne čestice za širi test** — 2-3 konkretne kčbr + k.o. (ili da Claude predloži po tipu: kutna M1, stambena S unutar bloka, veća K). **Zlatni test ostaje Hercegovačka 56** (k.č. 2362, k.o. Črnomerec, Po+P+1+Uvučeni kat, 3 stana + 6 garaža, breakeven ~5.741 €/m², target 7.000 €/m² uklj. PDV) + 2-3 dodatne čestice za širinu.

---

## 1. Vizija u jednoj rečenici
Investitor (profesionalac) unese **kčbr + katastarsku općinu**, aplikacija sama povuče geometriju čestice iz službenog WFS-a, utvrdi **GUP namjenu**, izračuna **što se smije graditi** (tipologije, gabariti, kig/kis, katnost, parkiranje), **predloži maksimalnu volumetrijsku masu** koju korisnik prstom dorađuje uz živu zeleno/crveno provjeru, izračuna **GBP i iskoristivost** (uz citate pravilnika), prođe **pravni checklist s klikabilnim citatima** iz postojeće baze članaka, i izbaci **investicijsku studiju s brojkama** (jedan PDF: volumetrija + financije + pravo) — sve u minutama umjesto tjedana.

## 2. Tri stupa, jedan temelj
| | **MENTOR / OI Ispit** | **VJEŠTAK** | **INVESTITOR** |
|---|---|---|---|
| Boja | plava #2B4A75 | narančasta #D06A1F | tamnozelena #1E5741 |
| Korisnik | kandidat | inženjer/vještak | investitor, developer, projektant, vlasnik zemljišta |
| Ulaz | datum ispita | pitanje s gradilišta | kčbr + k.o. |
| Srce | testovi+SRS+usmeni | AI odgovor s citatima | geometrija→pravila→masa→GBP→brojke→PDF |
| Izlaz | položen ispit | citat+koraci | studija izvedivosti (volumetrija+financije+pravo) |
🔒 **Temelj je ZAJEDNIČKI:** ista baza članaka (GUP odredbe + pravilnici se UVOZE kroz postojeći pipeline 06!), isti RAG, isti račun/tier sustav, isti PDF generator. INVESTITOR je novi ekran + geometrijski engine + kurirane JSON tablice — NE nova aplikacija.

## 3. KLJUČNE ARHITEKTONSKE ODLUKE

### 3.1 Geometrija čestice: SLUŽBENI WFS (POTVRĐEN javan) 🔒
Ivanova prva ideja (upload slike GUP portala, AI očita mjerilo) odbačena u v1.0 — raster nema pouzdano mjerilo, greška 3% na fronti ruši gabarite. **Rješenje potvrđeno u sesiji 2026-07-07:**
- **Primarno WFS (potvrđeno javno dostupno):** `https://api.uredjenazemlja.hr/services/inspire/cp/wfs` (INSPIRE Cadastral Parcels). Klase `CP:CadastralParcel` (granica čestice) + `CP:CadastralZoning` (katastarska općina). kčbr + MB k.o. → GeoJSON/GML poligon u **HTRS96/TM (EPSG:3765) — koordinate SU METRI**, mjerilo nepotrebno. **Komercijalna upotreba dozvoljena** uz izjavu o izvoru + datum + poveznicu (upisati u disclaimer PDF-a 🔒).
- **WMS podloga (za registrirane):** `https://oss.uredjenazemlja.hr/OssWebServices/inspireService/wms?token=xyz` — ortofoto/katastarska podloga.
- **Fallback A (vektorski PDF):** DKP izvod iz e-katastra često vektorski → pdfplumber lines/curves + kote → rekonstrukcija.
- **Fallback B (raster/slika):** Claude vision očita OBLIK + korisnik OBAVEZNO unese duljinu fronte s izvoda (ručna kalibracija mjerila) → prikaz "⚠ geometrija iz slike, tolerancija ±3%". Nikad jedini put za naplaćenu studiju.
- **Više kčbr:** union poligona (turf.union) → jedna obračunska čestica.
🔒 Svaka analiza sprema **izvor geometrije** (wfs/pdf/slika/ručno) — pojavljuje se u PDF studiji i disclaimeru.
⚠ **Prva kodna sesija VERIFICIRA aktualni WFS endpoint + parametre + ToS** (servisi se mijenjaju) i upisuje ih ovdje. Mrežni pristup: dodati `api.uredjenazemlja.hr` i `oss.uredjenazemlja.hr` na allowlist.

### 3.2 GUP namjena: servis + OBAVEZNA ljudska potvrda 🔒
- **Primarno:** Zagreb geoportal WMS GetFeatureInfo na reprezentativnu točku čestice (**pole-of-inaccessibility, ne centroid** — centroid L-čestice pada izvan!) → šifra namjene (S, M1, M2, K1, G, Z…). URL sloja utvrditi i upisati ovdje.
- **Fallback:** korisnik uploada izrez GUP karte → Claude vision očita boju+šifru → "Očitao sam M1 — mješovita, pretežito stambena — potvrdi ili ispravi".
- 🔒 **Namjena se UVIJEK potvrđuje klikom korisnika** prije proračuna (o njoj ovisi sve; servis kasni za GUP izmjenama). Potvrda se loga u analizu.
- **Multi-grad OD DANA 1** (Ivanova odluka #3): sve "Zagreb" živi u `gup/zagreb/…` (pravila.json, WMS URL, zone doprinosa). Drugi grad = novi folder, nula izmjena koda 🔒.

### 3.3 Pravila NE halucinira AI: kurirane JSON tablice 🔒
Isti princip kao rokovi.json: **KOD RAČUNA, AI OBJAŠNJAVA, ČLANCI SE CITIRAJU.**

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
⚠ Brojke gore su ILUSTRACIJA SHEME — Ivan verificira iz Odluke o donošenju GUP-a (radi to napamet 25 godina). **Odredbe za provedbu GUP-a uvesti kao dokument u bazu članaka** (pipeline 06) → checklist i AI citiraju KLIKABILNO.

**`gup/zagreb/troskovi.json`** (Ivanove stvarne brojke iz ŽBUKA prakse + službene tarife) — puna shema u v1.0 ostaje; MVP koristi samo grubu procjenu (Ivanova odluka #5).

### 3.4 Geometrijski engine — v2.0 s app-predloženom masom (🔒 ključna promjena)
**Promjena od v1.0:** ranije je korisnik samo klikao frontu, engine crtao gradivi dio. Sada (Ivanova odluka #6) app **PREDLAŽE masu**, korisnik je dorađuje prstom.

1. **Fronta:** korisnik klikne rub(ove) prema prometnici (v1 ručno = pouzdano 🔒; v2 auto-detekcija preko susjednih čestica s načinom uporabe "cesta"). Susjedne čestice se dohvaćaju iz WFS-a da app zna gdje su međe.
2. **Gradivi dio:** per-brid offset prema unutra — fronta za `gradjevni_pravac_min_m`, bočne/stražnja za `udaljenost_medja_m` (ili h/2). Presjek offsetanih poluravnina. Tipologija mijenja koje međe imaju 0 m.
3. **App PREDLAŽE maksimalnu masu:** unutar gradivog dijela app crta najveći upisani gabarit orijentiran na frontu (max tlocrt = min(kig·P, površina gradivog dijela)), s katnošću iz tablice. **Ovo je volumetrijska masa, NE raspored prostorija** 🔒.
4. **Korisnik prstom korigira:** povlači vrhove poligona mase; **živa provjera** — zeleno kad je unutar dozvoljenog (odmaci, kig, kis), crveno kad prekorači. GBP se preračunava u stvarnom vremenu.
5. **GBP i iskoristivost:** GBP = min(kis·P, tlocrt·broj_etaža) uz pravilnik (čl. 3 koef. garaža 0,25/pomoćni 0,50; čl. 4 svijetla visina <2,0 m ne ulazi). Iskoristivost = GBP/površina čestice. **Kod računa, citira članak.**
6. **Parkiranje:** iz normativa (pravila.json) → provjera stanu li mjesta na česticu.
7. **Volumetrija render:** čestica + susjedne + gradivi dio (šrafura) + masa (korisnički doradiva) + kote + sjever + tablica brojki. 🔒 "Preliminarna volumetrijska studija", NE projekt.
8. **Biblioteka:** turf.js (union/area/buffer) + vlastita per-brid offset logika; **jedinični testovi na sintetske čestice + Hercegovačka 56 kao zlatni test** (Ivan ima stvarne brojke → engine mora reproducirati njegov ručni proračun).

### 3.5 Pravni checklist = spoj s Vještakom
Automatski RAG upiti nad POSTOJEĆOM bazom, svaki check → status + klikabilan citat: priključak na javnu cestu, udaljenost od željeznice (pružni pojas), ZOP razmaci, vodozaštitne zone, kulturno dobro (ručni flag v1). Format: `[✓/⚠/✗] tvrdnja — Članak X. <link>`.

### 3.6 Investicijska studija (PDF) — jedan dokument, sve troje
Ivanova odluka #2: **volumetrija + financije + pravo u JEDNOM PDF-u.** Struktura: naslovnica s disclaimerom → geometrija + izvor → namjena + potvrda → kapaciteti po tipologijama → volumetrija (masa) → GBP + iskoristivost s citatima → pravni checklist s citatima → financije (MVP: gruba procjena; faza 2: pun breakeven/ROI) → pretpostavke i verzije tablica. PDF kroz postojeći generator.

## 4. Pravna ograda 🔒 (doslovno u UI + PDF)
> "Ovo je preliminarna studija izvedivosti izrađena automatiziranom analizom javno dostupnih prostornih podataka i važećih propisa. **Nije lokacijska informacija, nije projektna dokumentacija i ne zamjenjuje posebne uvjete javnopravnih tijela ni geodetski elaborat.** Prije bilo kakvog ulaganja obvezno angažirajte ovlaštene stručnjake."
Analiza sprema: verzije pravila.json/troskovi.json, izvor geometrije, datum, potvrdu namjene. **Izvor geometrije (DGU) navesti s datumom i poveznicom** (uvjet komercijalne upotrebe).

## 5. Shema (dodaci u 03 pri prvoj kodnoj fazi)
`investitor_analize` (id, korisnik_id, naziv, kcbr_json, ko_mb, geometrija_geojson, izvor_geometrije, namjena, namjena_potvrdjena_at, masa_geojson, params_json, rezultat_json, verzija_pravila, verzija_troskova, created_at) · pravila/troškovi = file-based u repou (git = verzioniranje) 🔒 v1.

## 6. Rute (dodaci u 04 pri prvoj kodnoj fazi)
`POST /api/investitor/cestica` {kcbr[], ko} → geometrija+površina+susjedne · `GET /api/investitor/namjena?lat&lng` → šifra (proxy WMS, keš 24h) · `POST /api/investitor/analiza` {geometrija, namjena, tipologija?, masa?} → kapaciteti+GBP+SVG+checklist · `POST /api/investitor/studija` {analiza_id, troskovni_unosi} → PDF · sve auth + planEnforce (tier Investitor).

## 7. Fazni plan (v2.0 — kreće SADA, ne čeka launch)
**PRVI KORAK 🔒 (Ivanova odluka #7) — WFS prikaz čestice:**
- Klijent MCP/mrežno: WFS klijent za `api.uredjenazemlja.hr`, unos kčbr + k.o., prikaz čestice na karti (Leaflet + WMS podloga), + susjedne čestice.
- Gotovo: Ivan unese **Hercegovačka 56 (k.č. 2362, k.o. Črnomerec)** i vidi SVOJU česticu s točnom površinom + susjedne.
- ⚠ Sesija VERIFICIRA aktualni WFS endpoint/parametre/ToS i upisuje u §3.1.

**Dalje (redoslijedom):** namjena + potvrda → pravila.json (Ivan kurira) → regulacijski engine s app-predloženom masom i prst-korekcijom → GBP + iskoristivost → pravni checklist → financije MVP → PDF studija → tier Investitor + landing.

**Zlatni test kroz sve faze:** engine mora reproducirati Ivanov ručni proračun Hercegovačke 56.

## 8. Rizici (pošteno)
DGU WFS se mijenja/rate-limitira → keš + fallback lanac §3.1 · GUP izmjene → verzija+datum u json, disclaimer · h/2 kružnost → h fiksno iz katnosti v1 · konkavne čestice → konzervativan gradivi dio (piše se u ispisu) · app-predložena masa mora biti očito "volumetrija ne projekt" da se ne shvati kao arhitektonski nacrt · odgovornost → §4 ograda + human-potvrde.

## 9. BRAND — krovno ime (🔓 odluka na kraju)
Tri proizvoda, jedan temelj. Kandidati (provjeriti domenu+žig): NORMA, TEMELJ, KOTA, GABARIT, REGULA. Logo smjer: monogram + navodnici »« ili kota-simbol; paleta #2B4A75 + papir #F5F5F1. Odluka: zadnja sesija Investitora, Ivan bira.

## CHANGELOG
- **2.0 (2026-07-07):** unesene Ivanove odluke iz sesije razbijanja koncepta (§0): korisnik=profesionalci, sve troje u jednom PDF-u, multi-grad od dana 1, WFS+fallback slika, financije djelomično u MVP, **app predlaže masu + prst-korekcija zeleno/crveno** (ključna promjena engine-a §3.4), prvi kodni korak = WFS prikaz čestice. Potvrđen javni DGU WFS endpoint (web search). GBP pravni temelj (Pravilnik čl. 3/4). Status promijenjen s "zadnja faza poslije launcha" na "aktivan konceptualni razvoj sada". Pending: referentne čestice za širi test.
- 1.0 (2026-07-05): inicijalni dokument — WFS umjesto slike 🔒, kurirane tablice 🔒, faze F21–F27, sheme, rizici, brand.
