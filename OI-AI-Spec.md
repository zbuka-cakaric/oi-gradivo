# OI ISPIT — MASTER SPEC v1.0 (AI, testovi, napredak, praksa)
**Datum:** 2026-07-04 · **Autor:** Claude (Fable 5) + Ivan Čakarić · **Stanje koda:** v012 · Faza 3
**Namjena:** ovaj dokument je jedina istina za faze F3b–F20. Piše se JEDNOM, mijenja se samo svjesnom odlukom uz zapis u §CHANGELOG na dnu. Svaka buduća sesija s Opusom 4.8 počinje prilaganjem OVOG dokumenta + HANDOFF-a + aktualnog koda.

---

## DIO 0 — KAKO KORISTIŠ OVAJ DOKUMENT (za Ivana)

1. **Jedna faza = jedna sesija.** Otvoriš novi razgovor s Opusom, priložiš: (a) ovaj spec, (b) aktualni HANDOFF, (c) aktualne `server.js`, `index.html`, `sw.js`, `test-v007.js`, `manifest.webmanifest`, (d) fazno-specifične priloge navedene u toj fazi (§DIO 4).
2. **Prva poruka = predložak iz §DIO 8** za tu fazu. Ne improviziraj prvu poruku — predložak sadrži sve stege.
3. **Prije nego prihvatiš isporuku**, prođi checklist: ✅ BUILD-GATE ispisan i čist · ✅ testovi N/N (broj mora RASTI ili ostati isti, nikad padati) · ✅ verzija u 3 mjesta · ✅ `⭐ vNNN` markeri na svim izmjenama · ✅ init-db napomena (treba/ne treba i zašto) · ✅ nijedna 🔒 odluka iz ovog speca nije prekršena.
4. **Ako Opus predloži odstupanje od 🔒 odluke** — to je crvena zastava. Traži da citira razlog, pa odluku ILI odbij ILI upiši u §CHANGELOG s datumom i obrazloženjem. Nikad tiho.
5. **Nakon deploya:** commit + git tag `vNNN` + ručna sigurnosna kopija baze prije svake faze koja mijenja shemu (§DIO 6.8).
6. 🔒 **Spec živi u GitHub repou** `oi-gradivo` (root ili `docs/`): nakon svake izmjene speca uploadaš novu verziju tamo. Time ga SVAKI budući razgovor (Claude može čitati raw.githubusercontent) može povući i bez tvog uploada — trajna memorija projekta je repo, chat-memorija je samo kažiprst prema njemu.

**Legenda:** 🔒 = odluka koja se kasnije NE mijenja (skupo/nemoguće) · 🔓 = smije se mijenjati bez posljedica · ⚠ = poznata zamka · 💰 = ima trošak (tokeni/infra).

---

## DIO 1 — VIZIJA I PROIZVOD

### 1.1 Što gradimo
Jedna aplikacija, **dva moda na istom temelju** (isto gradivo, isti AI, isti račun):
- **PRIPREMA** — kandidat za stručni ispit: uči gradivo, rješava testove, vježba usmeni s AI ispitivačem, prati spremnost do datuma ispita.
- **PRAKSA** — "džepni vještak": inženjer/arhitekt/voditelj gradilišta u 30 sekundi dobije odgovor utemeljen u propisu, s klikabilnim citatima, plus alate (generatori dopisa, kalkulatori rokova, checkliste, "koji je tekst vrijedio na dan X").

### 1.2 Zašto pobjeđujemo generički AI (ovo je pitch, nauči ga)
1. **Kurirana i ažurna baza** — mi znamo TOČNO koji propisi ulaze u koji program (službeni MPGI popisi + naši dodaci poput uzanci) i držimo ih svježima kroz kontrolirani pipeline s QC-om.
2. **Citati koji se otvaraju** — svaki AI odgovor pokazuje [1][2] i tap vodi ravno u članak u aplikaciji. Povjerenje se ne traži, ono se klika.
3. **Verzionirano pravo** 🔒 — od F4 čuvamo povijest teksta svakog članka. "Što je vrijedilo 12.3.2019.?" je upit koji vještaci plaćaju, a nitko ga ne nudi pristupačno.
4. **Usmeni AI ispitivač** — treniran na stvarnim pitanjima s rokova po užem području. Ovo je selling point #1 za PRIPREMU.

### 1.3 Korisnici (personas — dizajniraj za njih, ne općenito)
- **Kandidat** (28–45, VSS, radi puno, uči navečer/vikendom, mobitel): treba plan, dozirano gradivo, osjećaj napretka, simulaciju usmenog.
- **Praktičar** (na gradilištu/u uredu): treba ODGOVOR, ne lekciju. Brzina + citat + "što mi je činiti".
- **Tvrtka** (B2B, kasnije): seatovi za zaposlenike, admin uvid u spremnost tima. Multi-tenant iskustvo već imaš iz Gradilišta — ne gradimo prije F20+.
- **Student** (jeftiniji/free segment): gradivo + testovi, bez AI kvota.

### 1.4 Monetizacija (tehničke posljedice, cijene odlučuješ ti)
- **FREE:** čitanje svega gradiva, bookmarki, 10 test-sesija/mj (rezultat da, obrazloženja ne), bez AI-ja.
- **PRO (19,99 €/mj):** neograničeni testovi + obrazloženja, SRS, AI asistent (fair-use §6.6), usmeni ispitivač, PRAKSA alati, push podsjetnici napredni.
- 🔒 **Feature-gating se provodi ISKLJUČIVO na serveru** (middleware `planEnforce`, F13). Frontend samo prikazuje zaključano stanje. Nikad obrnuto.

---

## DIO 2 — ARHITEKTURA PODATAKA (temelj; ovdje su skoro sve 🔒 odluke)

> **Zašto ovo pišemo unaprijed:** tablice su temelji kuće. Kad na `clanak_id` jednom navežemo bookmarke, chunkove, citate AI odgovora i reference pitanja — promjena identiteta članka postaje rušenje nosivog zida. Zato identitete fiksiramo SADA.

### 2.0 Postojeće tablice (v012, 11 kom) — ne diraju se, samo proširuju
`sustav_meta, korisnici, email_tokeni, email_log, strukovna_podrucja, ispitni_programi, dokumenti, program_dokumenti, clanci, pojmovi, bookmarki`

🔒 **Identiteti koji se NIKAD ne recikliraju:** `korisnici.id`, `dokumenti.id`, `clanci.id`, (od F6) `pitanja.id`. Brisanje = soft-delete (status stupac), nikad DELETE reda na koji nešto pokazuje — jedina iznimka je današnji delete-pa-insert članaka koji **umire u F4** (zamjenjuje ga upsert §4.F4).

### 2.1 F4 — verzioniranje članaka
```sql
CREATE TABLE IF NOT EXISTS clanci_verzije (
  id SERIAL PRIMARY KEY,
  clanak_id INTEGER NOT NULL REFERENCES clanci(id) ON DELETE CASCADE,
  oznaka TEXT NOT NULL, naslov TEXT NOT NULL DEFAULT '', tekst TEXT NOT NULL,
  vrijedi_od DATE NOT NULL DEFAULT CURRENT_DATE,
  vrijedi_do DATE,                       -- NULL = aktualna verzija
  nn_izvor TEXT NOT NULL DEFAULT '',     -- npr. 'NN 155/25' ili 'NN 155/25, 69/26'
  hash CHAR(32) NOT NULL,                -- md5(oznaka\u0001naslov\u0001tekst), isti recept kao v011
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_cv_clanak ON clanci_verzije(clanak_id, vrijedi_od);
```
🔒 **Pravila:** `clanci` i dalje drži AKTUALNI tekst (denormalizirano — čitanje ostaje brzo, ništa postojeće se ne mijenja). Svaka promjena teksta kroz upsert (F4) radi: staroj verziji `vrijedi_do = danas`, INSERT nove s `vrijedi_do = NULL`, UPDATE `clanci`. Upit "na dan D": `WHERE clanak_id=$1 AND vrijedi_od<=$2 AND (vrijedi_do IS NULL OR vrijedi_do>$2)`.
⚠ Prvi put pri F4 migraciji: za svaki postojeći članak INSERT jedne verzije s `vrijedi_od` = datum stupanja na snagu iz `dokumenti.izvor` gdje je poznat, inače `'2026-01-01'` (dokumentiraj u kodu).

### 2.2 F5 — chunkovi i embeddingi
```sql
CREATE EXTENSION IF NOT EXISTS vector;    -- Railway PG podržava pgvector
CREATE TABLE IF NOT EXISTS chunkovi (
  id SERIAL PRIMARY KEY,
  clanak_id INTEGER NOT NULL REFERENCES clanci(id) ON DELETE CASCADE,
  verzija_id INTEGER REFERENCES clanci_verzije(id) ON DELETE SET NULL,
  redoslijed SMALLINT NOT NULL DEFAULT 1,
  tekst TEXT NOT NULL,
  tokeni SMALLINT NOT NULL DEFAULT 0,
  embedding vector(1024),                 -- voyage-law-2 = 1024 dim 🔒
  fts tsvector GENERATED ALWAYS AS (to_tsvector('simple', unaccent(tekst))) STORED
);
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE INDEX IF NOT EXISTS ix_ch_clanak ON chunkovi(clanak_id);
CREATE INDEX IF NOT EXISTS ix_ch_fts ON chunkovi USING GIN(fts);
CREATE INDEX IF NOT EXISTS ix_ch_vec ON chunkovi USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```
🔓 **Chunkovi su potrošna roba:** nitko ih izvana ne referencira (citati AI odgovora pokazuju na `clanak_id`, ne na chunk!). Re-chunking = `DELETE WHERE clanak_id=...` + novi INSERT-i, bez posljedica. Zato smiješ mijenjati chunking strategiju kasnije.
🔒 **Citati u cijeloj aplikaciji referenciraju `clanak_id`** — nikad chunk, nikad tekst-offset.
⚠ Ako `CREATE EXTENSION unaccent/vector` padne na Railwayu: unaccent fallback = generirani stupac bez unaccent + `translate(lower(tekst),'čćđšž','ccdsz')` u upitu; vector je nužan — ako ga plan baze nema, upgrade plana prije F5.

**Chunking algoritam** 🔓 (v1): granica = ČLANAK. Ako članak ≤ 450 tokena → 1 chunk. Ako veći → reži po stavcima `(N)`; svaki chunk = 2–5 uzastopnih stavaka do ~400 tokena, preklop = zadnji stavak prethodnog chunka. Tekst chunka UVIJEK počinje kontekst-zaglavljem: `"[{dokument_naziv} — {oznaka} {naslov}] "` (embedding tako "zna" odakle je). Tokeni: gruba mjera `Math.ceil(znakova/3.6)` je dovoljna (HR ~3.6 zn/token) — ne uvodi tokenizer ovisnost.

### 2.3 F6 — banka pitanja
```sql
CREATE TABLE IF NOT EXISTS pitanja (
  id SERIAL PRIMARY KEY,
  program_id INTEGER NOT NULL REFERENCES ispitni_programi(id),
  uze_podrucje TEXT NOT NULL DEFAULT '',       -- '' = opće za program
  tip TEXT NOT NULL CHECK (tip IN ('abc','tocno_netocno','otvoreno','usmeno')),
  pitanje TEXT NOT NULL,
  opcije JSONB,                                -- za abc: ["A ...","B ...","C ...","D ..."]
  tocno TEXT NOT NULL DEFAULT '',              -- 'B' | 'tocno' | model-odgovor za otvorena
  obrazlozenje TEXT NOT NULL DEFAULT '',
  clanak_refs INTEGER[] NOT NULL DEFAULT '{}', -- clanak_id-evi na kojima se temelji 🔒
  izvor TEXT NOT NULL DEFAULT 'ai' CHECK (izvor IN ('rok','ai','admin')),
  rok_oznaka TEXT NOT NULL DEFAULT '',         -- npr. 'GRA/Zgrade 2024-11'
  tezina SMALLINT NOT NULL DEFAULT 3 CHECK (tezina BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'nacrt' CHECK (status IN ('nacrt','ovjereno','povuceno')),
  ovjerio INTEGER REFERENCES korisnici(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_pit_prog ON pitanja(program_id, status, uze_podrucje);
```
🔒 U testove ulaze SAMO `status='ovjereno'`. AI generira nacrte; TI (superadmin) ovjeravaš u admin UI-ju (F6). Nikad automatska ovjera — točnost je proizvod.
🔒 `clanak_refs` obavezan i za pitanja s rokova: kad uploadaš rok-pitanja, Opus ih kroz RAG mapira na članke, ti potvrdiš. Bez reference nema ovjere.

### 2.4 F7 — testne sesije i odgovori
```sql
CREATE TABLE IF NOT EXISTS test_sesije (
  id SERIAL PRIMARY KEY,
  korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
  tip TEXT NOT NULL CHECK (tip IN ('brzi','puni','sekcija','slabe_tocke','usmeni')),
  config JSONB NOT NULL DEFAULT '{}',          -- {sekcija_put, n_pitanja, ...}
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(), finished_at TIMESTAMPTZ,
  score NUMERIC(5,2)                            -- 0-100, NULL dok traje
);
CREATE TABLE IF NOT EXISTS test_odgovori (
  id SERIAL PRIMARY KEY,
  sesija_id INTEGER NOT NULL REFERENCES test_sesije(id) ON DELETE CASCADE,
  pitanje_id INTEGER NOT NULL REFERENCES pitanja(id),
  odgovor TEXT NOT NULL DEFAULT '', tocno BOOLEAN, vrijeme_s SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ts_korisnik ON test_sesije(korisnik_id, started_at);
CREATE INDEX IF NOT EXISTS ix_to_sesija ON test_odgovori(sesija_id);
CREATE INDEX IF NOT EXISTS ix_to_pitanje ON test_odgovori(pitanje_id, created_at);
```
⚠ Sesija se stvara na startu (server bira pitanja i VRAĆA ih bez `tocno`/`obrazlozenje` polja!), odgovori se šalju jedan-po-jedan ili batch na kraju — odluka: **jedan-po-jedan** (preživi gubitak mreže na gradilištu). `finish` ruta računa score na serveru. 🔒 Točan odgovor NIKAD ne putuje klijentu prije predaje odgovora.

### 2.5 F9 — SRS (ponavljanje s razmakom)
```sql
CREATE TABLE IF NOT EXISTS srs_stanje (
  korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
  pitanje_id INTEGER NOT NULL REFERENCES pitanja(id) ON DELETE CASCADE,
  ef NUMERIC(3,2) NOT NULL DEFAULT 2.50,
  interval_d SMALLINT NOT NULL DEFAULT 0,
  due DATE NOT NULL DEFAULT CURRENT_DATE,
  ponavljanja SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (korisnik_id, pitanje_id)
);
CREATE INDEX IF NOT EXISTS ix_srs_due ON srs_stanje(korisnik_id, due);
```
**SM-2 lite formula (doslovno, HR komentari u kodu):** ocjena q∈{0..5} (iz točnosti: točno brzo=5, točno=4, točno uz muku/sporo=3, netočno=1). `ef' = max(1.3, ef + 0.1 - (5-q)*(0.08 + (5-q)*0.02))`. Interval: q<3 → `interval=1, ponavljanja=0`; inače ponavljanja: 1→1d, 2→6d, n→`round(interval*ef')`. `due = danas + interval`. 🔓 formula smije evoluirati (podatak per-korisnik ostaje kompatibilan).

### 2.6 F8 — pokrivenost gradiva
```sql
CREATE TABLE IF NOT EXISTS napredak_clanci (
  korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
  clanak_id INTEGER NOT NULL REFERENCES clanci(id) ON DELETE CASCADE,
  procitano_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (korisnik_id, clanak_id)
);
```
UI: u čitaču članka gumb "✓ Pročitano" (toggle, isti DELETE-first uzorak kao bookmark). Automatsko označavanje na scroll NE — lažna metrika.

### 2.7 F15/F16 — AI razgovori i usmene sesije
```sql
CREATE TABLE IF NOT EXISTS ai_razgovori (
  id SERIAL PRIMARY KEY,
  korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
  mod TEXT NOT NULL DEFAULT 'asistent' CHECK (mod IN ('asistent','usmeni')),
  naslov TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_poruke (
  id SERIAL PRIMARY KEY,
  razgovor_id INTEGER NOT NULL REFERENCES ai_razgovori(id) ON DELETE CASCADE,
  uloga TEXT NOT NULL CHECK (uloga IN ('user','assistant')),
  tekst TEXT NOT NULL,
  citati JSONB NOT NULL DEFAULT '[]',   -- [{"clanak_id":123,"oznaka":"Članak 59.","dokument":"Zakon o gradnji"}]
  tokens_in INT NOT NULL DEFAULT 0, tokens_out INT NOT NULL DEFAULT 0,
  ocjena SMALLINT,                       -- thumbs: 1 / -1 / NULL
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS usmeni_sesije (
  id SERIAL PRIMARY KEY,
  korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
  razgovor_id INTEGER REFERENCES ai_razgovori(id) ON DELETE SET NULL,
  uze_podrucje TEXT NOT NULL DEFAULT '',
  rubrika JSONB,                         -- {"potpunost":4,"tocnost_citata":3,"prakticnost":5,"komunikacija":4}
  ukupno NUMERIC(4,2), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ai_por ON ai_poruke(razgovor_id, id);
```
🔒 GDPR: korisnik može obrisati svoje razgovore (ruta DELETE, F19) i cijeli račun (kaskada je već postavljena ON DELETE CASCADE svugdje gdje treba — provjeri pri svakoj novoj tablici!).

### 2.8 F10 — notifikacije
```sql
CREATE TABLE IF NOT EXISTS notif_prefs (
  korisnik_id INTEGER PRIMARY KEY REFERENCES korisnici(id) ON DELETE CASCADE,
  push_on BOOLEAN NOT NULL DEFAULT true,
  tihi_od SMALLINT NOT NULL DEFAULT 21, tihi_do SMALLINT NOT NULL DEFAULT 8,  -- sati
  max_dnevno SMALLINT NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS notif_log (
  id SERIAL PRIMARY KEY,
  korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
  tip TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}',
  poslano_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_nl_kor ON notif_log(korisnik_id, poslano_at);
```

### 2.9 F13/F14/analitika
```sql
CREATE TABLE IF NOT EXISTS usage_mjesec (
  korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
  mjesec CHAR(7) NOT NULL,               -- '2026-07'
  testova SMALLINT NOT NULL DEFAULT 0,
  ai_poruka SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (korisnik_id, mjesec)
);
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  korisnik_id INTEGER REFERENCES korisnici(id) ON DELETE SET NULL,
  tip TEXT NOT NULL, meta JSONB NOT NULL DEFAULT '{}',
  ts TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ev ON events(tip, ts);
-- F14 Stripe: korisnici dobivaju stupce (ALTER): stripe_customer_id TEXT, stripe_sub_id TEXT,
-- tier_do DATE; + tablica stripe_webhook_log(id, event_id UNIQUE, tip, payload, ts) — idempotentnost webhooka preko UNIQUE(event_id) 🔒
```
⚠ Brojači (`usage_mjesec.testova`) se povećavaju ATOMARNO: `INSERT ... ON CONFLICT (korisnik_id,mjesec) DO UPDATE SET testova = usage_mjesec.testova + 1 RETURNING testova` — i limit se provjerava iz RETURNING vrijednosti, nikad SELECT-pa-UPDATE (utrka!). pg-mem podržava ON CONFLICT DO UPDATE ✔.

---

## DIO 3 — RAG PIPELINE (F5 + F15): kako "kritičko razmišljanje" stvarno radi

> **Laički:** RAG = prije nego AI odgovori, aplikacija PRONAĐE relevantne članke u našoj bazi i da mu ih kao jedini dopušteni izvor. AI onda ne "zna zakon iz glave" (gdje griješi) nego ČITA naše članke i slaže odgovor s citatima. Kvaliteta odgovora = kvaliteta pronalaska (retrieval). Zato 70% truda ide u retrieval, 30% u prompt.

### 3.1 Ingestija (jednokratno po verziji članka) 💰
1. `SELECT` svih članaka bez chunkova (ili s dirty flagom nakon F4 izmjene).
2. Chunker (§2.2) → nizovi tekstova.
3. Voyage API `POST https://api.voyageai.com/v1/embeddings`, body `{"model":"voyage-law-2","input":[...do 128 tekstova...],"input_type":"document"}` 🔒 (`document` za gradivo, `query` za upite — Voyage tako trenira asimetrično; zamjena tipova mjerljivo kvari rezultate). Batch po 64, retry s backoffom na 429.
4. INSERT chunkova s embeddinzima. Procjena opsega: ~3.000 članaka GRA ≈ 4.500 chunkova ≈ jedan ingest run od par minuta i par eura. Re-embed samo dirty (F4 daje dirty listu).

### 3.2 Retrieval na upit korisnika (svaki AI poziv)
1. **Query planner** (Claude, mali poziv, §5.2): korisnikovo pitanje → JSON `{"pod_upiti":["prijava početka građenja","elaborat iskolčenja",...], "kljucni_pojmovi":[...]}` — max 4 pod-upita. ⚠ Ovo je razlika između šturog i pametnog: "što mi treba za početak gradnje" postane 3 ciljana pretraživanja.
2. Za svaki pod-upit: (a) embed (`input_type:"query"`), vector top-8 cosine; (b) FTS top-8: `SELECT ... WHERE fts @@ websearch_to_tsquery('simple', unaccent($1)) ORDER BY ts_rank(...)`.
3. **RRF fuzija** svih lista: `score(chunk) = Σ 1/(60 + rank_u_listi)` → globalni top.
4. **Diversitet:** max 3 chunka po dokumentu, max 2 po članku; uzmi top 12; ako više pod-upita gađa isti članak — to je signal važnosti, ostavi mu 2 mjesta.
5. Sastavi kontekst ≤ ~6.000 tokena: svaki izvor numeriran `[n] {dokument} — {oznaka} {naslov}: {tekst}` + na kraju liste `clanak_id` mapa (interna, za citate).

### 3.3 Odgovaranje (Claude, §5.1) i post-provjera 🔒
- Sustav prompt (doslovan u §5.1) + izvori + pitanje. `max_tokens` 1200, temp 0.2. **Prompt caching:** sustav prompt + pravila označi `cache_control` — isti prefiks kroz sve upite = 90% jeftiniji input. 💰
- **Post-provjera (kod, ne AI):** (a) izvuci sve `[n]` iz odgovora → svaki mora postojati u poslanom kontekstu; (b) regex `člank?[au]?\s+(\d+[a-z]?)\.` u odgovoru → svaka spomenuta oznaka mora biti među oznakama poslanih izvora ILI eksplicitno uvedena kao "vidi i" iz metapodataka. Ako provjera padne → jedan retry s porukom "Ispravi: naveo si izvor koji nije priložen"; ako opet padne → odgovor se isporučuje s vidljivom trakom "⚠ Provjeri citate" i logira `events(tip='ai_citat_fail')`. Nikad tiho.
- Odgovor klijentu: `{tekst, citati:[{n, clanak_id, oznaka, dokument}]}` — frontend renderira `[n]` kao tap → `otvoriClanak(clanak_id)` (funkcija VEĆ postoji).

### 3.4 Eval — bez ovoga se F5 NE zatvara 🔒
- `eval/pitanja.jsonl`: linije `{"id":"E001","pitanje":"...","zlatni":"...","ocekivani_clanci":[59,89,93]}` — **prvih 40 pišete ti i ja iz stvarnih rok-pitanja** prije nego Opus dira F5 kod.
- `eval/eval.js`: gađa lokalni server (prava baza s uvezenim gradivom, NE pg-mem — pgvector u pg-mem ne postoji ⚠), mjeri: **retrieval hit** (svi očekivani clanak_id u top-12? cilj ≥ 0.90), **citat-preciznost** (svaki citat u odgovoru ∈ očekivani∪top12? cilj ≥ 0.95), i ispisuje odgovore za tvoju ručnu ocjenu 1–5 (cilj prosjek ≥ 4).
- **Gate:** F15 UI se ne gradi dok eval ne prođe ciljeve. Tuning redoslijed kad ne prolazi: chunking → pod-upiti → RRF težine → tek onda prompt.

### 3.5 Testna strategija za AI slojeve (pg-mem nema vektore) 🔒
Retrieval iza jedne funkcije `dohvatiIzvore(upit) -> [izvori]`. U `test-v007.js` se ta funkcija MOCK-a (vrati fiksne izvore) pa se testira: post-provjera citata (dobar/loš slučaj), envelope, limiti, 403. Živi kvalitet mjeri eval.js. Dvije razine, obje obavezne u BUILD-GATE-u od F5.

### 3.6 SEKVENCIJSKI PROLAZI — kako sustav diše, korak po korak

**3.6.1 "Pitao me što mi sve treba za početak gradnje?"** (Ivanovo pitanje #1, sloj A — sinteza)
1. Frontend POST `api/ai/pitaj {razgovor_id?, tekst}` → server: planEnforce('ai') → usage_mjesec.ai_poruka atomarni +1 (soft limit provjera iz RETURNING).
2. **Planner** (Haiku, §5.2, ~0.4 s): `{"pod_upiti":["prijava početka građenja","pravomoćnost i izvršnost građevinske dozvole","elaborat iskolčenja","dokumentacija na gradilištu"],"kljucni_pojmovi":["prijava početka","iskolčenje"]}`.
3. Za svaki pod-upit paralelno (`Promise.all`): Voyage embed (query) → `SELECT id, clanak_id, tekst FROM chunkovi ORDER BY embedding <=> $1 LIMIT 8` + FTS `... WHERE fts @@ websearch_to_tsquery('simple', unaccent($1)) ORDER BY ts_rank(fts, ...) DESC LIMIT 8`.
4. **RRF**: `mapa[chunk_id] += 1/(60+rank)` preko svih 8 lista (4 pod-upita × 2 kanala) → sort desc → diversitet filter (≤3/dokument, ≤2/članak) → top 12. Očekivani pobjednici: ZoG čl. 89 (prijava+iskolčenje), čl. 59 (pravomoćna/izvršna), čl. 91–93 (gradilište, ploča, dokumentacija), čl. 79 (rok pristupanja).
5. Kontekst se sklapa (svaki izvor s `[n] Zakon o gradnji — Članak 89. Prijava početka građenja i iskolčenje: ...`), **Sonnet** odgovara (§5.1): izravan odgovor → "Temelj u propisima" s [1][3][4] → "U praksi" (koraci: dozvola pravomoćna → e-prijava min. 5 dana prije → elaborat iskolčenja → ploča gradilišta → mapa dokumentacije iz čl. 93) → "Pazi" (rok 6 g. važenja).
6. **Post-provjera** (kod): svi [n] ∈ poslani; sve spomenute oznake ("Članak 89.") ∈ metapodaci izvora → prolaz → spremi ai_poruke (obje uloge, tokens, citati JSONB) → klijentu `{tekst, citati}`; frontend [n] → tap → `otvoriClanak(clanak_id)`.

**3.6.2 "Ugrađen nekvalitetan materijal, a uporabna dozvola dobivena"** (pitanje #2, sloj B — križanje zakona) — isti tok, razlika je u koracima 2 i 4: planner vrati pod-upite koji CILJANO gađaju RAZLIČITE propise ("dokazi o svojstvima ugrađenih proizvoda", "odgovornost izvođača za nedostatke", "jamstveni rok za bitne zahtjeve građevine", "pravne posljedice uporabne dozvole") → retrieval donese ZoG čl. 22 (dokazi kvalitete) + čl. 94 (uporabna ≠ amnestija: "osobito u pogledu temeljnih zahtjeva"), ZOO odjeljak o ugovoru o građenju (odgovornost za solidnost — 10 g.), Uzance (otklanjanje nedostataka, zadržani iznos), Zakon o građevnim proizvodima. Diversitet pravilo (≤3/dok) OSIGURAVA da nijedan zakon ne proguta kontekst — to je mehanika "kritičkog" odgovora: model fizički DOBIJE sve četiri perspektive pa ih mora pomiriti. Bez multi-query + diversiteta ovo pitanje dobije šturi jednodokumentni odgovor — zato su ta dva koraka 🔒 u duhu, 🔓 u parametrima.

**3.6.3 Usmeni ispitivač — state machine (F16)**
Stanja: `SCENARIJ → GLAVNO_PITANJE → ČEKAM_ODGOVOR → PROCJENA → (POTPITANJE → ČEKAM_ODGOVOR → PROCJENA)×≤3 → ZAKLJUČAK → RUBRIKA`.
- SCENARIJ: server bira ovjereno 'usmeno' pitanje (ili §5.5 generira iz nasumičnog članak-klastera užeg područja) + RAG povuče chunk-sadržaj `clanak_refs` = "zlatni sadržaj" sesije (drži se server-side cijelu sesiju, NE regenerira se).
- PROCJENA (Haiku, temp 0, nakon svakog kandidatovog odgovora): ulaz = zlatni sadržaj + dosadašnji transkript → izlaz JSON `{"pokriveno":["natuknice"],"rupe":["natuknice"],"dovoljno":bool}`. Ako `dovoljno` ili 3 potpitanja potrošena → ZAKLJUČAK; inače POTPITANJE cilja `rupe[0]` (ispitivač-persona §5.5 dobije uputu: "kandidat nije spomenuo: {rupa} — postavi jedno kratko potpitanje točno o tome").
- RUBRIKA: §5.6 nad cijelim transkriptom + zlatnim sadržajem → spremi `usmeni_sesije`, prikaži ocjene + "Ponovi" linkove (clanak_refs).
⚠ Kandidatov odgovor NIKAD ne ide u retrieval (izvor rupa je zlatni sadržaj, fiksiran na startu) — inače kandidat halucinacijom "pomiče" ispit.

**3.6.4 Test tok (F7)** — POST `test/start {tip:'brzi'}` → server: SELECT 10 ovjerenih pitanja programa (slabe_tocke: JOIN test_odgovori, sekcije s najnižim w-prosjekom), INSERT test_sesije, vrati `[{id,tip,pitanje,opcije}]` (BEZ tocno/obrazlozenje 🔒). Po pitanju POST `test/odgovor {sesija_id,pitanje_id,odgovor,vrijeme_s}` — server ocijeni (abc usporedba; otvoreno → §5.4 poziv, q≥3=točno), spremi, vrati `{tocno,tocan_odgovor,obrazlozenje}` (SAD smije). Frontend retry red za offline (queue u memoriji, flush na online event). POST `test/zavrsi` → score = točni/ukupno×100, SRS upsert po pitanju (q iz točnosti+vremena), events('test_zavrsen').

**3.6.5 Push tok (F10)** — scheduler tick (15 min): za svaki tip iz kataloga jedan SQL koji vraća kandidate (npr. spremnost_alarm: korisnici s cilj_datum-danas≤21 ∧ spremnost<50 — spremnost se za ovo priračuna dnevno u events agregatu, ne live po korisniku ⚠ skupo) → filtar: notif_prefs.push_on ∧ sat∉[tihi_od,tihi_do] ∧ COUNT(notif_log danas)<max_dnevno ∧ NE POSTOJI isti tip <72h → `webpush.sendNotification(sub, payload)` → **statusCode 404/410 = mrtva pretplata → DELETE iz push_subscriptions** (obavezno, inače lista trune) → INSERT notif_log.

### 3.7 API POZIVI — doslovno (Node, fetch; sve ključeve iz ENV-a)

**Anthropic (odgovor, s prompt cachingom i streamom):**
```js
const r = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY,
             'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
  body: JSON.stringify({
    model: process.env.MODEL_ODGOVOR, max_tokens: 1200, temperature: 0.2,
    stream: true,                                  // F15; F5 bez streama
    system: [{ type: 'text', text: SUSTAV_PROMPT_5_1,
               cache_control: { type: 'ephemeral' } }],   // 💰 caching
    messages: [{ role: 'user', content: 'IZVORI:\n' + izvori + '\n\nPITANJE: ' + pitanje }]
  })
});
// stream: čitaj r.body reader; linije 'data: {...}'; event content_block_delta → delta.text
// → res.write('data: ' + JSON.stringify({t: delta.text}) + '\n\n')  (SSE prema klijentu)
// event message_stop → pošalji {done:true, citati} i res.end(). Frontend: fetch + getReader().
```
**Retry politika 🔒:** 429/529 → čekaj 1 s, retry; opet → 2 s, retry; opet → korisniku `{error:'Gužva na AI servisu, pokušaj za minutu'}` + events('ai_preopterecen'). Timeout poziva 60 s (AbortController). NIKAD beskonačna petlja.

**Voyage (embeddings):**
```js
const r = await fetch('https://api.voyageai.com/v1/embeddings', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + process.env.VOYAGE_API_KEY,
             'content-type': 'application/json' },
  body: JSON.stringify({ model: 'voyage-law-2',
    input: tekstovi,                 // ingest: batch ≤64; upit: [jedan]
    input_type: jeUpit ? 'query' : 'document' })   // 🔒 asimetrija
});
const emb = (await r.json()).data.map(d => d.embedding);
// u SQL kao string: '[' + emb.join(',') + ']'::vector  ($1 param, cast u upitu)
```

### 3.8 FAILURE MODES — što kad nešto padne (dizajnirano, ne improvizirano)
| Kvar | Detekcija | Ponašanje | Poruka korisniku |
|---|---|---|---|
| Voyage down/429× | fetch fail nakon retryja | **FTS-only retrieval** (kanal b radi!) + traka | "Smanjena preciznost pretrage — odgovor je iz tekstualnog podudaranja." |
| Anthropic 529× | retry politika iscrpljena | odustani, spremi user poruku bez odgovora | "Gužva na AI servisu, pokušaj za minutu." |
| Post-check citata pada 2× | §3.3 | isporuči s ⚠ trakom + events log | "⚠ Provjeri citate klikom — automatska provjera nije prošla." |
| pgvector ekstenzija nema | init-db error | F5 se NE deploya; upgrade Railway plana | — (admin problem) |
| Push 404/410 | webpush status | DELETE pretplate, bez retryja | — (tiho) |
| AI_ENABLED=false | ENV | sve AI rute 503 | "AI je privremeno nedostupan." |
| Stripe webhook duplikat | UNIQUE(event_id) 23505 | ignoriraj, 200 OK | — |
| Test odgovor offline | fetch fail | frontend queue + flush na 'online' | "Spremit ću odgovor čim se vratiš na mrežu." |

---

## DIO 4 — FAZE F3b → F20 (za svaku: cilj · shema · rute · UI · testovi · "gotovo")

> Konvencije za SVE faze: rute iznad `app.get('*')`; envelope `{ok:...}`/`{error:"..."}`; auth + `planEnforce` gdje piše; koercija `s(v,max)` na svim inputima; transakcije `withTx` za višekoračne zapise; verzija ×3; `⭐ vNNN`; testovi rastu; init-db SAMO uz shemu; komentari HR bez dijakritike; Norma tokeni u UI.

**F3b — Vodič kroz prijavu ispita + checklist** *(1 sesija, bez AI)*
Shema: `korisnik_checklist(korisnik_id, stavka_kod TEXT, ucinjeno_at, PRIMARY KEY(korisnik_id,stavka_kod))`. Sadržaj vodiča = statički JS objekt (koraci prijave MPGI: uvjeti, dokumentacija, rokovi, naknada) — TI daješ točan sadržaj (Opus ne izmišlja upravne korake ⚠). Rute: GET/POST `api/checklist`. UI: novi ekran iz Danas taba. Gotovo: checklist pamti stanje, vodič čitljiv.

**F4 — Uvoz v2: upsert-po-oznaci + verzioniranje** *(1–2 sesije)* 🔒
Shema: §2.1 + `clanci` dobiva `dirty BOOLEAN NOT NULL DEFAULT false` (za F5 re-embed). Algoritam uvoza (zamjenjuje delete-pa-insert; hash-skip iz v011 ostaje prvi korak):
1. Mapiraj dolazne po `oznaka` ↔ postojeće po `oznaka` (unutar dokumenta).
2. Postojeći s istim hashom → ništa. Postojeći s različitim → `clanci_verzije` zatvaranje + nova verzija + UPDATE `clanci` + `dirty=true`. Novi → INSERT clanak + prva verzija. Nestali → `clanci.status='brisan'` (novi stupac, default 'aktivan') — bookmarki i citati PREŽIVE, čitač prikazuje "brisan novelom" traku.
3. Odgovor: `{status:'upsert', novo:N, izmijenjeno:M, brisano:K, identicno:J}` — admin progress kartica prikazuje.
⚠ `redoslijed` novih članaka ("12.a"): server ih smješta po sortiranju oznake (broj pa slovo), ostale renumerira — redoslijed je prezentacijski, NIJE identitet.
Testovi: +5 (upsert svaki ishod, verzija zapisana, bookmark preživi izmjenu).
Gotovo: re-uvoz stvarne novele (simulacija: izmijenjen 1 članak u JSON-u) daje točne brojke i povijest.

**F5 — pgvector + Voyage + retrieval API + eval** *(2 sesije: ingest+API, pa eval-tuning)* 💰
ENV: `VOYAGE_API_KEY`, `ANTHROPIC_API_KEY`, `AI_ENABLED=true`, `MODEL_ODGOVOR=claude-sonnet-4-6`, `MODEL_PLANNER=claude-haiku-4-5-20251001`.
Rute: POST `api/admin/ai/ingest` (superadmin; batch, izvještaj po dokumentu), POST `api/ai/pitaj` (auth+planEnforce; za sada vraća JSON bez streama — stream u F15), GET `api/admin/ai/eval-info`.
Gotovo: eval ciljevi §3.4 dostignuti i ZAPISANI u HANDOFF.

**F6 — Banka pitanja + generator + ovjera** *(2 sesije)*
Shema §2.3. Rute: POST `api/admin/pitanja/generiraj` ({dokument_id ili sekcija, n}) — Claude §5.3 iz članaka pravi nacrte; GET/PATCH `api/admin/pitanja` (lista po statusu, uredi, ovjeri/povuci); POST `api/admin/pitanja/uvoz-rokovi` (JSON tvojih rok-pitanja: {pitanje, uze, rok_oznaka} → RAG mapira clanak_refs → status 'nacrt').
Dedup ⚠: prije INSERT-a novog nacrta embedaj pitanje i usporedi cosine s postojećima istog programa; > 0.92 → označi `meta` napomenom "moguć duplikat #id" (admin vidi).
UI: admin ekran "Pitanja" (filtar status/sekcija, kartica s uredi-poljima, gumbi Ovjeri/Povuci).
Gotovo: 100+ ovjerenih pitanja za tvoje uže područje (ti ovjeravaš — planiraj si sat vremena).

**F7 — Testovi (korisnički)** *(2 sesije)*
Shema §2.4. Rute: POST `api/test/start` ({tip, config}) → server bira pitanja (ovjerena, program korisnika; 'slabe_tocke' = najgore sekcije iz test_odgovori povijesti) → vraća pitanja BEZ točnih; POST `api/test/odgovor`; POST `api/test/zavrsi` → score, po-pitanju feedback (sad smiju tocno+obrazlozenje), SRS update (§2.5) za svako pitanje.
FREE limit: `usage_mjesec.testova` atomarno; > 10 → 402 `{error:'limit', nadogradnja:true}`.
UI: Testovi tab konačno živ — izbor tipa, tijek (1 pitanje/ekran, progress), rezultat ekran s obrazloženjima i "otvori članak" linkovima.
⚠ **Auto-refresh guard:** dok je test aktivan (globalni flag), health-ping reload se ODGAĐA (postavi `window.OI_BLOK_RELOAD=true` na startu testa, false na kraju; v012 pingaj() to poštuje — dodaj if na vrhu). Ovo je zapisano još od v012 — ne zaboravi.
Gotovo: cijeli tok radi offline-tolerantno (odgovor se retry-a), score točan, SRS due zapisi nastaju.

**F8 — Napredak tab** *(1 sesija)*
Bez nove sheme (čita test_odgovori + napredak_clanci + srs_stanje).
**Formula spremnosti** 🔓 (v1, prikazuj i komponente!):
`pokrivenost = pročitani_clanci / clanci_programa`
`tocnost = Σ(tocno×w) / Σw`, gdje `w = 0.5^(dana_od_odgovora/30)` (svježiji odgovori vrijede više)
`svjezina = 1 - min(1, due_zaostatak/20)`
`spremnost = 0.35·pokrivenost + 0.45·tocnost + 0.20·svjezina` → prsten na Danas + Napredak razrez po sekcijama (najslabije 3 istaknute s CTA "Vježbaj ovo").
Gotovo: brojevi se slažu s ručnim izračunom na test-podacima (napiši test!).

**F9 — SRS + Danas tab pravi** *(1 sesija)*
Rute: GET `api/srs/danas` (due kartice, limit dnevni), POST `api/srs/odgovor`. Danas tab: due count, "Ponovi (N)" tok kao mini-test, streak brojač (events).
Gotovo: SM-2 intervali vidljivo rastu na točnim odgovorima.

**F10 — Push notifikacije** *(1–2 sesije)*
Lib `web-push`; ENV `VAPID_PUBLIC/PRIVATE/SUBJECT` (generiraj `npx web-push generate-vapid-keys`, u Railway ENV). `push_subscriptions` tablica postoji ✔.
sw.js: `push` event → showNotification({title, body, data:{hash}}), `notificationclick` → openWindow('/#'+hash). ⚠ sw izmjena = verzija ×3.
Scheduler: in-process `setInterval` svakih 15 min (jedna Railway instanca — dovoljno; ⚠ ako ikad skaliraš na 2+ instance, scheduler mora dobiti lock preko `sustav_meta` retka — zapiši tada).
**Katalog poruka (tip → uvjet → tekst; poštuj notif_prefs, max_dnevno, tihe sate, i notif_log da se ista ne ponovi <72h):**
- `due_gomila`: due≥15 → "Nakupilo se {n} kartica — 10 min danas čuva ritam."
- `ispit_t14/t7/t3`: dana_do∈{14,7,3} → "Usmeni je za {d} dana. Spremnost {s}% — plan za danas te čeka."
- `spremnost_alarm`: dana_do≤21 ∧ spremnost<50 → "Ispit za {d} dana, a spremnost {s}%. Stigneš — ali kreni danas: predlažem {sekcija}."
- `streak_spas`: jučer aktivan, danas do 19h nije → "Streak od {n} dana visi o koncu 🙂 5 minuta je dovoljno."
- `novo_gradivo` (admin okida): "Dodano: {dokument} — {n} članaka."
Gotovo: probna notifikacija na tvoj Samsung stiže i klik otvara pravi ekran.

**F11 — Onboarding v2 + dnevni plan** *(1 sesija)*
Plan generator (kod, ne AI): dana_do × sekcije programa ponderirane brojem članaka + tvoja tezina mapa (config JSON u repou) → raspored "danas: sekcija X čitanje + 10 pitanja". Prikaz na Danas.

**F12 — Bilješke** *(1 sesija)*
`biljeske(id, korisnik_id, clanak_id, tekst, created_at)` — bilješka po članku (MVP bez highlight raspona ⚠ offseti pucaju na verzijama članaka; highlight tek uz verzija_id sidro, kasnije 🔓). UI u čitaču.

**F13 — planEnforce middleware** *(1 sesija)* 🔒
`korisnici.tier` postoji; middleware `planEnforce(feature)` mapira feature→min tier + kvote (usage_mjesec). SVE Pro rute ga dobivaju OVDJE odjednom (popis u kodu na jednom mjestu). Testovi: free udara limite, pro prolazi.

**F14 — Stripe** *(2 sesije)*
Checkout session (Pro mjesečno), customer portal link, webhook ruta `POST api/stripe/webhook` (RAW body ⚠ — express.json ju NE smije parsirati: registriraj webhook rutu PRIJE json middlewarea s express.raw), events: checkout.completed / sub.updated / sub.deleted → tier + tier_do sync. Idempotentnost preko `stripe_webhook_log.event_id UNIQUE` 🔒. Test mode ključevi prvo; tvoj prvi pravi €19,99 je smoke test.

**F15 — AI Asistent UI** *(2 sesije)*
SSE streaming: server `res.write('data: {...}\n\n')` iz Anthropic stream API-ja; frontend EventSource-like fetch reader. Chat ekran (novi tab ili unutar Uči?→ **novi glavni tab "AI"** zamjenjuje… ne — dodaje se kao 6. NE: donja navigacija max 5 ⚠ → AI ulazi kao istaknuta kartica na Danas + gumb u čitaču članka "Pitaj o ovom članku" (pre-fill kontekst!). Povijest razgovora, thumbs, citati klik. Disclaimer traka §6.7 na dnu svakog odgovora.
Gotovo: tvoja 2 primjer-pitanja iz ove poruke vraćaju odgovore s ispravnim citatima.

**F16 — Usmeni AI ispitivač** *(2–3 sesije — kruna)*
Tok: korisnik bira uže područje → server bira seed (ovjereno 'usmeno' pitanje s roka ILI generira scenarij §5.5) → chat u "ispitivač" personi: 1 glavno pitanje, sluša odgovor, do 3 potpitanja ciljana na rupe (planner uspoređuje odgovor s clanak_refs sadržajem), na kraju **rubrika** (§5.6, JSON) + savjet što ponoviti + linkovi na članke. Sprema `usmeni_sesije`. Glas 🔓 kasnije (Web Speech API je nategnut na Samsung Internetu; MVP tekst).
Gotovo: ti odradiš 3 simulacije i kažeš "ovo liči na Mihanovićku" (ili što već treba popraviti — rubrika ide na doradu po TVOM dojmu, ti si zlatni standard).

**F17 — PRAKSA mod** *(2–3 sesije)*
- Preklopnik Priprema/Praksa u Ja (Pro).
- **Generator dopisa:** predlošci (prigovor na zapisnik, požurnica javnopravnom tijelu, obavijest o nedostacima izvođaču, zahtjev za produljenje roka — po uzancama!) kao strukturirane forme; AI puni nacrt IZ podataka forme + RAG citata; izlaz = tekst za kopiranje (docx kasnije 🔓). Tvoja arhiva stvarnih dopisa = few-shot zlato (uploadaš anonimizirane).
- **Kalkulator rokova:** kurirana tablica `rokovi.json` u repou {naziv, propis, clanak_id, formula} (npr. važenje dozvole 6/8 g od pravomoćnosti; naknada čl. 72 rok 15 d) — kod računa, uvijek prikazuje izvor. ⚠ AI ne računa rokove — kod računa, AI samo objašnjava.
- **"Na dan" prikaz:** u čitaču Pro korisnik bira datum → verzija iz clanci_verzije.
Gotovo: ti u stvarnom slučaju s gradilišta dobiješ upotrebljiv dopis za < 2 min.

**F18 — Admin analitika** *(1 sesija)* — events agregati: DAU, testova/dan, AI upita, top pitanja bez dobrog odgovora (thumbs-down klaster) → to je tvoj backlog sadržaja.

**F19 — Pravo + GDPR + sigurnosni prolaz** *(1 sesija + pravnik)* — pravnik ovjeri Uvjete/Privatnost (postoje od v007); rute: DELETE `api/racun` (potvrda emailom!), GET `api/racun/izvoz` (JSON svega); rate-limit po ruti za AI (npr. 10/min); audit log admin akcija u events.

**F20 — Launch v1.0** *(1 sesija)* — backup automatika (dnevni `pg_dump` → B2 bucket skriptom na scheduleru; restore vježba OBAVEZNA jednom!), Lighthouse prolaz, meta/OG, status page ping, HANDOFF v2 finalni.

**Graf ovisnosti:** F4→F5→(F6,F15) ; F6→F7→(F8,F9)→F10 ; F13→F14 ; F5→F16 (i F6 poželjno) ; F17 nakon F15 ; F11,F12 slobodne nakon F7.

---

## DIO 5 — AI PROMPTOVI (doslovni; drži ih u kodu kao konstante s ⭐ markerom)

### 5.1 RAG odgovarač (sustav)
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
User poruka: `IZVORI:\n[1] {dokument} — {oznaka} {naslov}: {tekst}\n[2] ...\n\nPITANJE: {pitanje}`

### 5.2 Query planner (Haiku, temp 0, JSON only)
```
Zadatak: rastavi korisnikovo pitanje o hrvatskim propisima u graditeljstvu na 1-4 kratka pretraživačka upita (imenske fraze, terminologija propisa) i izvuci ključne pojmove. Odgovori SAMO JSON:
{"pod_upiti":["..."],"kljucni_pojmovi":["..."]}
Primjer: "što mi sve treba za početak gradnje?" ->
{"pod_upiti":["prijava početka građenja","pravomoćnost građevinske dozvole","elaborat iskolčenja","dokumentacija na gradilištu"],"kljucni_pojmovi":["prijava početka","iskolčenje","gradilište"]}
```

### 5.3 Generator pitanja (F6; ulaz = 1-3 povezana članka)
```
Iz priloženih članaka sastavi {n} ispitnih pitanja za stručni ispit ({program}, uže područje: {uze}).
Mješavina: 60% abc (4 opcije, jedna točna, distraktori uvjerljivi ali jasno netočni PO TEKSTU članka), 25% tocno_netocno, 15% otvoreno (traži nabrajanje/postupak).
Za svako vrati JSON red: {"tip":"abc","pitanje":"...","opcije":["A) ...","B) ...","C) ...","D) ..."],"tocno":"B","obrazlozenje":"... s referencom (Članak X., stavak Y.)","clanak_refs":[<id-jevi iz zaglavlja izvora>],"tezina":1-5}
Zabranjeno: pitanja o brojevima NN-a, trik-pitanja o interpunkciji, opcije "sve navedeno/ništa navedeno".
Odgovori SAMO JSONL, bez ikakvog drugog teksta.
```

### 5.4 Ocjenjivač otvorenih odgovora (F7/F16; temp 0, JSON)
```
Usporedi korisnikov odgovor s modelnim odgovorom i tekstom članaka. Vrati SAMO JSON:
{"q":0-5,"nedostaje":["kratke natuknice što fali"],"pogresno":["što je krivo, ako išta"],"komentar":"2 rečenice, ohrabrujuće ali precizno"}
q skala: 5=potpuno i točno; 4=točno uz sitan propust; 3=srž pogođena, bitne rupe; 2=djelomično; 1=pretežno netočno; 0=promašeno/prazno.
```

### 5.5 Usmeni ispitivač (persona, F16)
```
Ti si ispitivač na usmenom dijelu stručnog ispita ({program} — {uze}). Ton: profesionalan, korektan, umjereno strog; kratka pitanja, bez monologa. Tok: postavi glavno pitanje iz zadanog scenarija. Nakon odgovora kandidata: ako je odgovor potpun, kratko potvrdi i postavi JEDNO produbljujuće potpitanje iz iste teme; ako ima rupa, potpitanjem ciljaj TOČNO rupu (imaš IZVORE — znaš što je trebalo reći). Maksimalno 3 potpitanja, zatim reci "Dovoljno, hvala" i STOP. Nikad ne daješ odgovor umjesto kandidata tijekom ispitivanja. Ne izlazi iz uloge.
```

### 5.6 Rubrika usmenog (poseban poziv NAKON sesije, temp 0, JSON)
```
Ocijeni transkript usmenog odgovaranja prema izvorima. SAMO JSON:
{"potpunost":1-5,"tocnost_citata":1-5,"prakticnost":1-5,"komunikacija":1-5,
 "ukupno":prosjek na 2 decimale,
 "ponovi":[{"tema":"...","clanak_refs":[...]}],
 "komentar":"3-4 rečenice: što je bilo dobro, što presudno nedostaje, konkretan savjet"}
```

### 5.7 "Što donosi novela" (F4 bonus, admin)
Diff dviju verzija članaka (kod pravi diff listu) → prompt: "Za svaki izmijenjeni članak u 1 rečenici opiši suštinu promjene, bez pravničkog prepričavanja." → objava korisnicima (novo_gradivo push).

---

## DIO 6 — NE-PREGOVARLJIVO (guardrails; Opus ovo poštuje ili objašnjava zašto ne)

6.1 **Sve postojeće discipline ostaju:** kirurški str_replace, ⭐ markeri, verzija ×3, BUILD-GATE + testovi prije svake isporuke, envelope, DIO-7 obrasci (atomarnost, koercija, bounds, NOT NULL+DEFAULT, indeksi uz svaku tablicu), initDb idempotentan, jedna faza po sesiji.
6.2 🔒 **Točan odgovor pitanja nikad ne putuje klijentu prije predaje** (F7).
6.3 🔒 **AI nikad ne dobiva cijeli korpus** — samo retrieval izvore. Nikad ne šalji korisničke osobne podatke u prompt osim nužnog konteksta pitanja.
6.4 🔒 **Post-provjera citata** (§3.3) je obavezna na SVAKOM AI odgovoru s pravnim tvrdnjama. Kill-switch: `AI_ENABLED=false` gasi sve AI rute s 503 `{error:'AI privremeno nedostupan'}`.
6.5 💰 **Trošak se mjeri od prvog dana** (tokens u ai_poruke + dnevni agregat u events; MODEL_* kroz ENV). **Red veličine po upitu:** planner (Haiku ~350 in / 120 out) ≈ €0,0005; odgovor (Sonnet ~7.500 in od čega ~1.500 necacheiran + 6.000 izvori / ~700 out) ≈ €0,02–0,03 s cachingom sustava. **Mjesečno:** 100 Pro × 20 upita ≈ €50–70 AI troška na ~€2.000 prihoda — zdravo; usmena sesija ≈ 5–8 poziva ≈ €0,10. Ingest cijelog GRA (~4.500 chunkova, Voyage) ≈ jednokratno < €2. Alarm: events dnevni zbroj > €10/dan → email superadminu (mala ruta u F18).
6.6 **Fair-use Pro AI:** 50 poruka/dan soft (usage_mjesec.ai_poruka; preko → prijateljska poruka + nastavak sutra). Usmeni: 3 sesije/dan.
6.7 **Disclaimer (doslovan, u AI podnožju):** "Informativni prikaz propisa — nije pravni savjet za pojedinačni slučaj. Provjeri izvor klikom na citat; za sporove se obrati ovlaštenom stručnjaku."
6.8 **Backup ritual:** prije SVAKE faze koja mijenja shemu → ručni `pg_dump` (Railway: `railway run pg_dump $DATABASE_URL > backup-vNNN.sql`) spremljen lokalno + na QNAP. F20 to automatizira, do tada ručno, bez iznimke.
6.9 **pg-mem lekcije vrijede za sve nove rute** (bez ANY(int[]), bez koreliranih subquerija u projekciji, toggle preko DELETE rowCount, dup-detekcija code+message) + nova: **vektorski sloj se mocka** (§3.5).
6.10 **Notifikacije poštuju čovjeka:** tihe sate, max_dnevno, nikad ista poruka <72h, jedan tap = trajni opt-out te vrste.

---

## DIO 7 — RJEČNIK (za tebe; slobodno pitaj Opusa "objasni kao u rječniku speca")

- **Embedding** — tekst pretvoren u niz od 1024 broja tako da SLIČNA ZNAČENJA imaju bliske brojeve. Omogućuje pretragu po smislu, ne samo po riječima ("uporabna dozvola" nađe i "dozvola za uporabu").
- **Chunk** — komad članka (naš: cijeli članak ili 2-5 stavaka) koji se embedira i vraća kao izvor. Mali dovoljno da bude precizan, velik dovoljno da nosi kontekst.
- **RAG** — Retrieval-Augmented Generation: prvo NAĐI izvore u našoj bazi, pa ih daj AI-ju kao jedino gradivo za odgovor. Naša obrana od izmišljanja.
- **Vector index (HNSW)** — struktura u bazi koja među tisućama embeddinga munjevito nađe najbliže. Kao kazalo, ali za značenja.
- **FTS** — full-text search, klasična pretraga riječi u bazi; kombiniramo je s vektorskom (hibrid) jer pravni tekst ima stabilnu terminologiju.
- **RRF** — jednostavan način spajanja više rang-lista u jednu: tko je visoko na više lista, pobjeđuje.
- **SSE / streaming** — odgovor se prikazuje riječ-po-riječ dok nastaje (kao u Claude appu), preko jedne otvorene HTTP veze.
- **Webhook** — Stripe NAMA šalje HTTP poziv kad se nešto dogodi (plaćeno/otkazano). Mi samo primamo i ažuriramo tier.
- **Idempotentno** — smiješ ponoviti istu radnju bez štete (naš init-db, hash-skip uvoz, Stripe event UNIQUE).
- **VAPID** — par ključeva kojim se naš server legitimira browserima za slanje push poruka.
- **SM-2 / SRS** — algoritam razmaka ponavljanja: što bolje znaš, rjeđe te pita; zaboravljaš → vraća češće.
- **Prompt caching** — Anthropic pamti nepromijenjeni početak prompta (naša pravila) pa ga naplaćuje ~10×manje na sljedećim pozivima.
- **Soft-delete** — redak ne brišemo nego označimo (status='brisan'); sve što na njega pokazuje ostaje zdravo.
- **Dirty flag** — oznaka "promijenjen, treba mu novi embedding" — da ne plaćamo re-embed svega.

---

## DIO 8 — PREDLOŠCI PRVE PORUKE ZA OPUS (kopiraj, popuni {•})

**Univerzalni okvir (svaka faza):**
```
Nastavljamo OI Ispit — faza {F#} po OI-AI-Spec.md (priložen; on je istina, uz HANDOFF i aktualni kod v{NNN}). Prije ikakvog koda: potvrdi da si pročitao §DIO 4 {F#}, nabroji 🔒 odluke koje ta faza dira i reci plan u 5 redaka. Zatim radi. PRAVILA: kirurške izmjene, ⭐ v{NNN+1} markeri, verzija u 3 mjesta, rute iznad '*', envelope, DIO 7 guardrails, init-db {treba/ne treba}, BUILD-GATE + node test-v007.js (testovi smiju samo rasti) prije isporuke, isporuka svih dirnutih fajlova u ZIP-u. Ako spec i kod proturječe — kod pobjeđuje, ali me upozori. Ako želiš odstupiti od 🔒 — stani i pitaj.
```
**Fazni dodaci (primjeri):**
- F4: "Prilažem i jedan izmijenjeni JSON (simulacija novele) za test upserta. Očekujem diff izvještaj u odgovoru rute."
- F5: "Prvo ingest+API bez UI. NE gradiš F15. Eval harness po §3.4; eval/pitanja.jsonl prilažem ({n} zapisa). Isporuka uključuje eval rezultate."
- F6: "Prilažem rok-pitanja JSON ({n} kom). Generator radi na sekciji {•}. Ovjera UI po §DIO 4 F6."
- F16: "Prije koda: napiši mi 3 primjer-transkripta simulacije (scenarij→potpitanja→rubrika) da odobrim ton. Tek onda implementacija."

---

## CHANGELOG SPECA
- v1.1 (2026-07-04): +§3.6 sekvencijski prolazi (oba referentna pitanja, usmeni state-machine, test i push tok s 410-cleanupom), +§3.7 doslovni API pozivi (Anthropic caching+SSE, Voyage, retry politika), +§3.8 failure-modes tablica, §6.5 troškovnik s brojkama, §DIO 0 t.6 spec-u-repou pravilo.
- v1.0 (2026-07-04): inicijalna verzija — Fable 5 + Ivan.
