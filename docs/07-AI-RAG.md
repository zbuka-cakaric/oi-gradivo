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
2. Po pod-upitu paralelno: (a) embed(query) → `ORDER BY embedding <=> $1::vector LIMIT 8`; (b) FTS → `WHERE fts @@ websearch_to_tsquery('simple', unaccent($1)) ORDER BY ts_rank(fts, websearch_to_tsquery('simple', unaccent($1))) DESC LIMIT 8`.
3. **RRF fuzija:** `score[chunk] += 1/(60 + rank)` preko svih lista → sort desc.
4. **Diversitet 🔒 (duh; parametri 🔓):** ≤3 chunka/dokument, ≤2/članak → top **12**. (Pitanje #2 iz §7 fizički DOBIJE ZoG + ZOO + uzance + građ. proizvode — pa ih model MORA pomiriti; bez ovoga dobiješ jednodokumentni šturi odgovor.)
5. Kontekst ≤ ~6.000 tok: `[n] {dokument} — {oznaka} {naslov}: {tekst}` + interna mapa n→clanak_id.

## 4. Odgovaranje + post-provjera 🔒
Sonnet, max_tokens 1200, temp 0.2, **prompt caching** na system bloku (`cache_control:{type:'ephemeral'}` → ~10× jeftiniji ponovljeni prefiks 💰). F5 JSON, F15 SSE stream (04 §4).
**Post-provjera KODOM na SVAKOM odgovoru:** (a) svaki `[n]` ∈ poslani izvori; (b) svaka spomenuta oznaka `člank?[au]?\s+\d+[a-z]?\.` ∈ oznake izvora. Pad → 1 retry s uputom "naveo si nepriloženi izvor"; 2. pad → isporuka s vidljivom trakom "⚠ Provjeri citate" + `events('ai_citat_fail')`. Nikad tiho.
Odgovor: `{tekst, citati:[{n,clanak_id,oznaka,dokument}]}`; frontend `[n]` → tap → `otvoriClanak(clanak_id)` 🔒.
**Anthropic poziv (Node fetch):** headers `x-api-key`, `anthropic-version:'2023-06-01'`; **retry politika 🔒:** 429/529 → 1 s → retry → 2 s → retry → korisniku "Gužva na AI servisu, pokušaj za minutu" + event; AbortController timeout 60 s; nikad beskonačna petlja.
**Voyage poziv:** `POST /v1/embeddings {model:'voyage-law-2', input:[…], input_type:'document'|'query'}`; embedding u SQL kao `'[a,b,…]'::vector` parametar.

## 5. PROMPTOVI (doslovni; u kodu kao konstante s ⭐)
**P1 — RAG odgovarač (system):**
```
Ti si stručni asistent za hrvatske propise u graditeljstvu unutar aplikacije OI Ispit.
PRAVILA (kruta):
1. Odgovaraš ISKLJUČIVO na temelju priloženih IZVORA. Vlastito opće znanje smiješ koristiti samo za povezivanje i strukturu, nikad za tvrdnje o sadržaju propisa.
2. Svaku pravnu tvrdnju označi referencom [n] na izvor iz kojeg dolazi. Ne izmišljaj brojeve članaka ni NN brojeve.
3. Ako izvori ne pokrivaju dio pitanja, izričito napiši što nedostaje i predloži gdje bi se moglo nalaziti (naziv propisa), bez nagađanja sadržaja.
4. Struktura odgovora: (a) izravan odgovor u 2-4 rečenice; (b) "Temelj u propisima" — kratke točke s [n]; (c) "U praksi" — što korisnik konkretno čini, koraci; (d) po potrebi "Pazi" — rokovi, česte greške.
5. Piši hrvatski, ti-forma, jasno i bez pravničkog viška. Ne ponavljaj tekst članaka doslovno više od nužnog citata.
6. Ovo nije pravni savjet u pojedinačnom sporu — kad pitanje miriše na spor, uputi na ovlaštenog vještaka/odvjetnika, ali svejedno daj pravni okvir iz izvora.
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

## CHANGELOG
- 2.0 (2026-07-04): inicijalno (apsorbira OI-AI-Spec v1.1 §DIO 3+5, sekvencijske prolaze i failure-modes).
