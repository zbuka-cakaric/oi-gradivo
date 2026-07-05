# 07 — AI / RAG (mozak vještaka i instruktora)

> **Princip u jednoj rečenici:** AI nikad ne odgovara "iz glave" o propisima — aplikacija prvo PRONAĐE relevantne članke u našoj bazi (retrieval) i da mu ih kao JEDINI dopušteni izvor; kvaliteta odgovora = kvaliteta pronalaska, zato 70% inženjeringa živi u retrievalu. Kod (ne AI) zatim PROVJERI svaki citat.

## 1. Sastavnice i modeli
| Uloga | Model (ENV) | Zašto |
|---|---|---|
| Odgovori korisniku, generator pitanja, dopisi, sažeci | `MODEL_ODGOVOR` (Sonnet klasa) | kvaliteta HR pravnog teksta uz razuman 💰 |
| Query planner, procjena rupa usmenog, ocjena q0-5 | `MODEL_PLANNER` (Haiku klasa) | brzo+jeftino, JSON-only zadaci |
| Embeddingi | Voyage `voyage-law-2`, dim **1024** 🔒 | pravno-domenski treniran; `input_type` **document/query asimetrija 🔒** (zamjena mjerljivo kvari rezultate) |

## 2. Ingestija (F5) 💰 jednokratno po verziji članka
SELECT članaka bez chunkova ili `dirty=true` → **chunker** 🔓: članak ≤450 tok = 1 chunk; veći → po stavcima `(N)`, 2–5 stavaka do ~400 tok, preklop = zadnji stavak prethodnog; SVAKI chunk počinje zaglavljem `"[{dokument} — {oznaka} {naslov}] "` (embedding "zna" porijeklo). Tokeni gruba mjera `ceil(zn/3.6)` (HR). → Voyage batch ≤64, retry na 429 → INSERT. Cijeli GRA (~4.500 chunkova) < €2, par minuta. Nakon: `dirty=false`.

## 3. Retrieval po upitu (svaki AI poziv)
1. **Planner** (§P2): pitanje → `{"pod_upiti":[1-4 kratka], "kljucni_pojmovi":[…]}` — OVO je razlika između šturog i kritičkog: "što mi treba za početak gradnje" postane 3-4 ciljana pretraživanja.
2. Po pod-upitu paralelno (v030): originalno pitanje UVIJEK prvi upit + plannerovi (max 5); (a) embed(query) → `ORDER BY embedding <=> $1::vector LIMIT 12`; (b) FTS → `websearch_to_tsquery('simple', unaccent(q))` LIMIT 12; (c) **pg_trgm** → `ORDER BY word_similarity(unaccent(lower(q)), unaccent(lower(tekst))) DESC LIMIT 12` — HR morfologija (mjereno: FTS-only 7% vs TRGM-only 83% hit@12 na 30 pitanja!).
3. **RRF fuzija:** `score[chunk] += 1/(60 + rank)` preko svih lista → sort desc → **RERANK (v028+): Voyage `VOYAGE_RERANK_MODEL` (default rerank-2.5-lite) nad top-60, vraća 32** — cross-encoder presloži po stvarnoj relevantnosti prema ORIGINALNOM pitanju; pad → RRF poredak + `smanjena_preciznost`.
4. **Diversitet 🔒 (duh; parametri 🔓, v030):** ≤2 chunka/članak; po dokumentu ≤6 NAKON uspješnog reranka (≤4 u RRF fallbacku — pravna pitanja legitimno žive u 5-6 članaka istog zakona) → top **12**. (Pitanje #2 iz §7 fizički DOBIJE ZoG + ZOO + uzance + građ. proizvode — pa ih model MORA pomiriti; bez ovoga dobiješ jednodokumentni šturi odgovor.)
5. Kontekst ≤ ~6.000 tok: `[n] {dokument} — {oznaka} {naslov}: {tekst}` + interna mapa n→clanak_id.

## 4. Odgovaranje + post-provjera 🔒
Sonnet, max_tokens 1200, temp 0.2, **prompt caching** na system bloku (`cache_control:{type:'ephemeral'}` → ~10× jeftiniji ponovljeni prefiks 💰). F5 JSON, F15 SSE stream (04 §4).
**Post-provjera KODOM na SVAKOM odgovoru:** (a) svaki `[n]` ∈ poslani izvori; (b) svaka spomenuta oznaka `člank?[au]?\s+\d+[a-z]?\.` ∈ oznake izvora. Pad → 1 retry s uputom "naveo si nepriloženi izvor"; 2. pad → isporuka s vidljivom trakom "⚠ Provjeri citate" + `events('ai_citat_fail')`. Nikad tiho.
Odgovor: `{tekst, citati:[{n,clanak_id,oznaka,dokument}]}`; frontend `[n]` → tap → `otvoriClanak(clanak_id)` 🔒.
**Anthropic poziv (Node fetch):** headers `x-api-key`, `anthropic-version:'2023-06-01'`; **retry politika 🔒:** 429/529 → 1 s → retry → 2 s → retry → korisniku "Gužva na AI servisu, pokušaj za minutu" + event; AbortController timeout 60 s; nikad beskonačna petlja.
**Voyage poziv:** `POST /v1/embeddings {model:'voyage-law-2', input:[…], input_type:'document'|'query'}`; embedding u SQL kao `'[a,b,…]'::vector` parametar.

## 5. PROMPTOVI (doslovni; u kodu kao konstante s ⭐)
**P1 — RAG odgovarač (system) — v2 (v041/v042: IRAC + hijerarhija + alati, 13 §1-2):**
```
Ti si Vještak — stručni AI asistent za hrvatske propise u graditeljstvu (platforma ŽBUKA AI).
Kratice koje korisnici koriste: ZOG/ZoG=Zakon o gradnji · ZOPU=Zakon o prostornom uređenju · ZNR=Zakon o zaštiti na radu · ZOP/ZZOP=Zakon o zaštiti od požara · ZUP=Zakon o općem upravnom postupku · ZOO=Zakon o obveznim odnosima · GD=građevinska dozvola · UD=uporabna dozvola · GLP/GP=glavni projekt. // ⭐ v039
ALATI (agentska pretraga): // ⭐ v041 — 13 §1
- Prije konačnog odgovora smiješ u najviše 4 kruga koristiti alate: trazi_propise (nova ciljana pretraga kad priloženi izvori ne pokrivaju dio pitanja), procitaj_clanak (puni tekst članka i susjednih kad trebaš točan sadržaj, nabrajanje ili kontekst), clanak_na_dan (verzija članka na povijesni datum — sporovi, ugovori, stara stanja).
- Alat pozovi ČIM uočiš rupu: korisnik traži konkretan članak kojeg nema u izvorima; odredba upućuje na drugi propis ("posebnim propisom", "iz članka X."); pitanje se odnosi na prošli datum; izvor je odrezan usred nabrajanja. Ako priloženi IZVORI već pokrivaju pitanje — odgovori odmah, bez alata.
- Rezultati alata stižu kao novi numerirani izvori ([13], [14]…) — citiraš ih jednako kao početne. Budi štedljiv: svaki krug troši korisnikov budžet.
PRAVILA (kruta):
1. Odgovaraš ISKLJUČIVO na temelju priloženih IZVORA (početnih i onih dobivenih alatima). Vlastito opće znanje smiješ koristiti samo za povezivanje i strukturu, nikad za tvrdnje o sadržaju propisa.
2. Svaku pravnu tvrdnju označi referencom [n] na izvor iz kojeg dolazi. Ne izmišljaj brojeve članaka ni NN brojeve.
3. Ako ni nakon pretrage alatima izvori ne pokrivaju dio pitanja, izričito napiši što nedostaje i predloži gdje bi se moglo nalaziti (naziv propisa), bez nagađanja sadržaja.
4. STRUKTURA ODGOVORA — za situacijska i pravna pitanja piši IRAC formom s podnaslovima: // ⭐ v041 — 13 §2
   "Situacija" — sažmi činjenice iz pitanja u 1-2 rečenice; ako moraš nešto pretpostaviti, izričito to napiši.
   "Pravno pitanje" — jedna rečenica: što se pravno zapravo pita.
   "Mjerodavne odredbe" — kratke točke s [n], poredane PO PRAVNOJ HIJERARHIJI (zakon → uredba/pravilnik → tehnički propis → norme/uzance).
   "Primjena" — poveži odredbe s konkretnom situacijom korisnika; navedi i protuargumente ili iznimke ako iz izvora proizlaze.
   "Zaključak" — izravan odgovor u 1-3 rečenice; na kraju "Pazi" — rokovi, rizici, česte greške.
   Za kratka činjenična pitanja (rok, broj, definicija, jedan podatak): izravan odgovor u 2-4 rečenice + "Temelj u propisima" s [n] + po potrebi "Pazi" — BEZ pune IRAC forme.
5. PRAVNA HIJERARHIJA I KOLIZIJE: viši akt jači od nižeg (zakon > pravilnik > tehnički propis); posebni propis jači od općeg (lex specialis); kasniji jači od ranijeg (lex posterior). Kad se odredbe sukobljavaju, izričito napiši koja prevladava i zašto. UVIJEK vodi računa o važenju na datum pitanja — zadano je danas; za prošle datume koristi clanak_na_dan i naglasi o kojoj verziji govoriš. // ⭐ v041 — 13 §2
6. Piši hrvatski, ti-forma, jasno i bez pravničkog viška. Ne ponavljaj tekst članaka doslovno više od nužnog citata. Formatiranje: smiješ koristiti **podebljano** za podnaslove i crtice ("- ") za nabrajanja; NE koristi ## znakove, tablice ni vodoravne crte (---). // ⭐ v042
7. Ovo nije pravni savjet u pojedinačnom sporu — kad pitanje miriše na spor, uputi na ovlaštenog vještaka/odvjetnika, ali svejedno daj pravni okvir iz izvora.
```
User: `IZVORI:\n[1] …\n\nPITANJE: {pitanje}`

**P2 — Query planner (Haiku, temp 0, SAMO JSON):**
```
Zadatak: rastavi korisnikovo pitanje o hrvatskim propisima u graditeljstvu na 1-4 kratka pretraživačka upita (imenske fraze, terminologija propisa) i izvuci ključne pojmove. Odgovori SAMO JSON:
{"pod_upiti":["..."],"kljucni_pojmovi":["..."]}
Primjer: "što mi sve treba za početak gradnje?" ->
{"pod_upiti":["prijava početka građenja","pravomoćnost građevinske dozvole","elaborat iskolčenja","dokumentacija na gradilištu"],"kljucni_pojmovi":["prijava početka","iskolčenje","gradilište"]}
```

**P3 — Generator pitanja (ulaz 1-3 povezana članka, izlaz SAMO JSONL):**
```
Iz priloženih članaka sastavi {n} ispitnih pitanja za stručni ispit ({program}, uže područje: {uze}).
Mješavina: 60% abc (4 opcije, jedna točna, distraktori uvjerljivi ali jasno netočni PO TEKSTU članka), 25% tocno_netocno, 15% otvoreno (traži nabrajanje/postupak).
Za svako vrati JSON red: {"tip":"abc","pitanje":"...","opcije":["A) ...","B) ...","C) ...","D) ..."],"tocno":"B","obrazlozenje":"... s referencom (Članak X., stavak Y.)","clanak_refs":[<id-jevi iz zaglavlja izvora>],"tezina":1-5}
Zabranjeno: pitanja o brojevima NN-a, trik-pitanja o interpunkciji, opcije "sve navedeno/ništa navedeno".
```
Dedup nacrta: embed pitanja, cosine > 0.92 s postojećima programa → flag "moguć duplikat #id".

**P4 — Ocjenjivač otvorenih (temp 0, SAMO JSON):**
```
Usporedi korisnikov odgovor s modelnim odgovorom i tekstom članaka. Vrati SAMO JSON:
{"q":0-5,"nedostaje":["kratke natuknice što fali"],"pogresno":["što je krivo, ako išta"],"komentar":"2 rečenice, ohrabrujuće ali precizno"}
q skala: 5=potpuno i točno; 4=točno uz sitan propust; 3=srž pogođena, bitne rupe; 2=djelomično; 1=pretežno netočno; 0=promašeno/prazno.
```

**P5 — Usmeni ispitivač (persona):**
```
Ti si ispitivač na usmenom dijelu stručnog ispita ({program} — {uze}). Ton: profesionalan, korektan, umjereno strog; kratka pitanja, bez monologa. Tok: postavi glavno pitanje iz zadanog scenarija. Nakon odgovora kandidata: ako je odgovor potpun, kratko potvrdi i postavi JEDNO produbljujuće potpitanje iz iste teme; ako ima rupa, potpitanjem ciljaj TOČNO rupu (imaš IZVORE — znaš što je trebalo reći). Maksimalno 3 potpitanja, zatim reci "Dovoljno, hvala" i STOP. Nikad ne daješ odgovor umjesto kandidata tijekom ispitivanja. Ne izlazi iz uloge.
```

**P6 — Rubrika usmenog (poseban poziv NAKON sesije, temp 0, SAMO JSON):**
```
Ocijeni transkript usmenog odgovaranja prema izvorima. SAMO JSON:
{"potpunost":1-5,"tocnost_citata":1-5,"prakticnost":1-5,"komunikacija":1-5,
 "ukupno":prosjek na 2 decimale,
 "ponovi":[{"tema":"...","clanak_refs":[...]}],
 "komentar":"3-4 rečenice: što je bilo dobro, što presudno nedostaje, konkretan savjet"}
```
**P7 — "Što donosi novela":** kod pravi diff verzija → "Za svaki izmijenjeni članak u 1 rečenici opiši suštinu promjene, bez pravničkog prepričavanja."
**P9a — Skraćeno članka (v042; keš u `clanak_pomoc` po hashu teksta — jedna generacija služi sve 💰):**
```
Razloži priloženi članak hrvatskog propisa u 3-7 kratkih crtica.
Pravila: svaka crtica pocinje sa "• " i ima najviše 14 riječi · običan jezik, bez pravničkog · bez uvoda i zaključka · ako članak nabraja stavke, grupiraj ih smisleno · brojevi, rokovi i iznosi SAMO ako doslovno stoje u članku · ne dodaji ništa čega u članku nema.
```
**P9b — Primjer iz prakse (v042; isti keš mehanizam):**
```
Napiši JEDAN konkretan primjer s gradilišta (5-8 rečenica) koji slikovito pokazuje što priloženi članak znači u praksi.
Pravila: imenuj uloge (investitor, izvođač, nadzorni inženjer, projektant…) · običan jezik · smiješ izmisliti imena i situaciju, ali pravni sadržaj (obveze, rokovi, posljedice) uzimaš isključivo iz članka · završi jednom rečenicom koja počinje "Poanta: " · bez naslova i uvoda.
```
**P8 — Generator dopisa (F17):** system = pravila forme + few-shot iz Ivanove anonimizirane arhive; user = polja forme + RAG izvori; izlaz = nacrt s [n] citatima; disclaimer obvezan.

## 6. Usmeni ispitivač — state machine (F16) 🔒 ključne odluke
`SCENARIJ → GLAVNO → ČEKAM → PROCJENA → (POTPITANJE → ČEKAM → PROCJENA)×≤3 → ZAKLJUČAK → RUBRIKA`
- SCENARIJ: ovjereno 'usmeno' pitanje s roka ILI generiran iz članak-klastera; RAG povuče **"zlatni sadržaj"** = chunkovi clanak_refs, FIKSIRA se na startu server-side i NE regenerira 🔒.
- PROCJENA (Haiku, temp 0): zlatni sadržaj + transkript → `{"pokriveno":[…],"rupe":[…],"dovoljno":bool}`; potpitanje cilja `rupe[0]`.
- ⚠🔒 **Kandidatov odgovor NIKAD ne ide u retrieval** — izvor istine je zlatni sadržaj; inače kandidat halucinacijom "pomiče" ispit.
- RUBRIKA (P6) nad cijelim transkriptom → `usmeni_sesije` + "Ponovi" linkovi (clanak_refs). Glas 🔓 kasnije (Web Speech na Samsung Internetu nategnut; MVP tekst).

## 7. Referentni prolazi (sjeverna zvijezda — trajni regresijski slučajevi)
**#1 "Što mi sve treba za početak gradnje?"** → planner: prijava početka / pravomoćnost / iskolčenje / dokumentacija gradilišta → očekivani pobjednici: ZoG čl. 89, 59, 91–93, 79 → odgovor: koraci (dozvola pravomoćna → e-prijava ≥5 dana prije → elaborat iskolčenja → ploča → mapa čl. 93) + Pazi (6 g. važenja).
**#2 "Nekvalitetan materijal, uporabna dobivena"** → pod-upiti gađaju RAZLIČITE propise (dokazi svojstava / odgovornost izvođača za nedostatke / jamstvo za solidnost / posljedice uporabne) → ZoG 22+94 (uporabna ≠ amnestija za temeljne zahtjeve), ZOO (odgovornost za solidnost), Uzance (otklanjanje, zadržani iznos), ZGP → odgovor pomiruje sve četiri perspektive s koracima.
Oba MORAJU proći prije zatvaranja F15 i ostaju u eval setu zauvijek.

## 8. Eval — gate F5 🔒
`eval/pitanja.jsonl`: `{"id":"E001","pitanje":"…","zlatni":"…","ocekivani_clanci":[59,89,93]}` — **prvih 40 piše IVAN iz stvarnih rok-pitanja PRIJE F5 koda.** `eval/eval.js` gađa lokalni server s PRAVOM bazom (pg-mem nema vektore ⚠): **retrieval hit@12 ≥ 0.90** (svi očekivani u top-12), **citat-preciznost ≥ 0.95**, ljudska ocjena ≥ 4/5. Tuning redoslijed kad ne prolazi: chunking → pod-upiti → RRF težine → tek onda prompt. F15 UI se NE gradi prije prolaska.
Test strategija dvoslojna 🔒: pg-mem testovi s MOCK `dohvatiIzvore()` (post-check dobar/loš, limiti, 403, envelope) + živi eval.
**✅ GATE POLOŽEN 2026-07-05 (v030): hit@12 = 37/40 = 93%** (put 63%→88%→93%; ključni potezi: pg_trgm kanal, Voyage rerank, orig. pitanje kao upit, post-rerank dok-cap 6). Otvoreno (pod pragom, čeka held-out ~100 rok-pitanja): E031 ZZOP čl.28, E032 ZZOP čl.4, E040 ZOO čl.633 — sistemske rezerve u ladici: pojmovnik query-expansion, HyDE, težinski RRF.

## 9. Troškovnik 💰 (red veličine; loguje se od 1. dana u ai_poruke + events)
Planner ≈ €0,0005 · odgovor (7,5k in od čega ~6k izvori, ~1,5k necached; 700 out) ≈ €0,02–0,03 s cachingom · usmena sesija (5–8 poziva) ≈ €0,10 · 100 Pro × 20 upita/mj ≈ €50–70 na ~€2.000 MRR · ingest GRA jednokratno < €2. Alarm: dnevni zbroj > €10 → mail superadminu (F18).

## 10. Failure modes (dizajnirano, ne improvizirano)
| Kvar | Ponašanje | Korisniku |
|---|---|---|
| Voyage down/429× | **FTS-only retrieval** (kanal b radi) + `upozorenje` | "Smanjena preciznost pretrage." |
| Anthropic 529× | retry iscrpljen → spremi user poruku bez odgovora | "Gužva na AI servisu, pokušaj za minutu." |
| Post-check 2× pad | isporuka s ⚠ trakom + event | "⚠ Provjeri citate klikom." |
| AI_ENABLED=false | sve AI rute 503 | "AI je privremeno nedostupan." |
| pgvector nema | F5 se ne deploya; upgrade plana | — |
| Kvota | 402 `{error:'limit'}` | prijateljski + nadogradnja CTA |

## 11. Guardrails AI-ja 🔒
AI nikad ne dobiva cijeli korpus, samo retrieval izvore · PII korisnika ne ide u promptove osim nužnog konteksta pitanja · disclaimer doslovan u podnožju svakog AI odgovora: **"Informativni prikaz propisa — nije pravni savjet za pojedinačni slučaj. Provjeri izvor klikom na citat; za sporove se obrati ovlaštenom stručnjaku."** · korisnik može obrisati svoje razgovore (F19) · imena modela SAMO iz ENV-a · fair-use: Pro 50 poruka/dan soft, 3 usmene/dan (usage_mjesec atomarno).

**P2 dopune u kodu (v028/v029):** primjer 2 (preslikavanje životne situacije u pravne institute: "nekvalitetan materijal + uporabna" → odgovornost za nedostatke / jamstvo za solidnost / posljedice uporabne) + napomena o sinonimima terminologije propisa (gradilište/privremeno radilište…). Kod = istina za doslovni tekst.

## CHANGELOG
- 2.6 (2026-07-05): **v061 — F7 pismeni: P3T_PISMENI + AI 10% "iznenađenja"**. Novi prompt P3T_PISMENI (marker 'PISMENI dio stručnog ispita'): on-the-fly generator abc pitanja iz 2-3 random aktivna članka (MODEL_PLANNER, ~900 tok). aiN=min(round(0.1×ukupno),3). **Keš filozofija 💰: generirana pitanja se SPREMAJU u banku (izvor='ai', rok_oznaka='AI-GEN', status='ovjereno') — jedna generacija služi sve buduće testove kroz banku.** Platformski trošak (NE tereti korisnikov AI budžet; ~1 Haiku poziv/test, free max 10 testova/mj). Validacija prije INSERT-a: tip abc, 4 opcije, tocno A-D. Try/catch fallback = sve iz banke; AI_ENABLED kill-switch poštovan. 🔒 tocno/obrazlozenje klijentu tek NAKON predaje odgovora na TO pitanje (testPitanjeKlijentu guard).
- 2.5 (2026-07-05): **v060 — usmeni LJUDSKI FAKTOR (Ivan)**. P6_PROCJENA prepravljen: kad kandidat kaže "ne znam"/prazan/promašen odgovor, potpitanje NIJE preformulacija nego **KRATAK HINT** koji navodi na trag (institucija/članak/pojam-orijentir, BEZ cijelog odgovora) — hint SAMO JEDNOM po pitanju, pa "kraj" ako opet ne zna. Kod-brana (server) 🔒: `neznamRe` regex broji "ne znam"/"nemam pojma"/"nisam siguran"; **2+ takva odgovora forsiraju kraj bez obzira na P6** (zaštita od beskonačnog forsiranja pitanja — Ivan uočio na terenu). P7A_ISPRAVAK: ton dobrog profesora — ako nije znao, NE prekoravaj, mirno objasni gradivo (koje osobe/članci/zašto) + orijentir-uputa što ponoviti; do 130 riječi. Ocjena 0-100 po pitanju + deterministički prosjek + prag 90 nepromijenjeni.
- 2.4 (2026-07-05): **F16 v053 — usmeni = ISPIT od N pitanja** (ENV `USMENI_BR_PITANJA` def 10, `USMENI_PROLAZ` def 90). Plan pitanja fiksira se na startu (Fisher-Yates u JS-u); po zaključenju pitanja (P6 "kraj" ili ≥3 potpitanja) ide **P7A_ISPRAVAK** (MODEL_ODGOVOR, STROGI JSON `{"ocjena":0-100,"ispravak":"…"}` — smije otkriti zlatni jer je TO pitanje zaključeno; fallback ocjena = P6 tocnost). Rez transkripta po pitanju preko `rezultati[].do_id` (id poruke ispravka) — P6/P7A dobivaju SAMO poruke aktivnog pitanja. **Finale DETERMINISTIČKI** (bez AI poziva, financijska matematika sveta 🔒): ukupna = round(prosjek ocjena), prolaz = ukupna ≥ prag; rubrika = `{ocjena,prolaz,prag,po_pitanjima,sazetak,savjet}`. P7_RUBRIKA ostaje u kodu kao povijest (ne poziva se). 🔒 nepromijenjeni: zlatni ne curi PRIJE zaključenja tog pitanja, P6 procjena ne curi, kandidatov odgovor nikad u retrieval.
- 2.3 (2026-07-05): **F16 v047** — P5_ISPITIVAC / P6_PROCJENA / P7_RUBRIKA doslovno u server.js (uz P9); state-machine u /api/usmeni/odgovori; P6 na MODEL_PLANNER, P5/P7 na MODEL_ODGOVOR; pokusajJson() disciplina za stroge JSON izlaze.
- 2.2 (2026-07-05): **P1 v2 doslovno** (F15.5: agentska petlja §alati, IRAC struktura, pravna hijerarhija, formatiranje bez ##) + **P9a/P9b Skraćeno/Primjer** (v042, ruta /api/ai/clanak-pomoc, keš clanak_pomoc, budžet samo na generaciji). Agentska petlja živi u SSE grani /api/ai/pitaj (JSON grana jednoprolazna — mock/eval kompatibilnost).
- 2.1 (2026-07-05): **Retrieval v2** — pg_trgm kanal (mjereno 7%→83% vs FTS), Voyage rerank sloj (ENV `VOYAGE_RERANK_MODEL`), orig. pitanje kao prvi upit, post-rerank dok-cap 6/fallback 4, P2 primjer 2 + sinonimi; **GATE 93% upisan** (§8).
- 2.0 (2026-07-04): inicijalno (apsorbira OI-AI-Spec v1.1 §DIO 3+5, sekvencijske prolaze i failure-modes).
