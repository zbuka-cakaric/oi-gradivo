# 03 — BAZA PODATAKA (potpuni katalog: postojeće + buduće)

> **Izvor istine za točne stupce postojećih tablica = `initDb()` u server.js.** Ovdje je semantika, odnosi i SVE buduće sheme sa SQL-om spremnim za copy u initDb (uvijek kroz `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, na KRAJ initDb-a — initDb je kumulativan 🔒).

## 0. Načela 🔒
1. **Identiteti se ne recikliraju:** `korisnici.id`, `dokumenti.id`, `clanci.id`, `pitanja.id` (od F6) su vječni. Brisanje = soft-delete (`status` stupac). Jedina povijesna iznimka (delete-pa-insert članaka) umire u F4.
2. **Sve što korisnik stvori kaskadno umire s njim:** svaka nova tablica s `korisnik_id` nosi `ON DELETE CASCADE` (GDPR F19 se oslanja na to).
3. **Citati, bookmarki, reference pitanja → `clanak_id`.** Nikad chunk, nikad offset.
4. **Brojači atomarno:** `INSERT … ON CONFLICT DO UPDATE SET x=x+1 RETURNING x` — limit se čita iz RETURNING.
5. **Novac/kvote/status = server-side istina;** klijent je samo prikaz.

## 1. POSTOJEĆE (v012) — semantika i ključne veze
| Tablica | Uloga | Ključne točke |
|---|---|---|
| `sustav_meta` | ključ→vrijednost (shema_verzija…) | budući scheduler-lock ovdje ⚠ ako ikad >1 instanca |
| `korisnici` | računi | email UNIQUE, bcrypt+pepper hash, `tier` (indeksiran), `program_id` FK→ispitni_programi (v007), `uze_podrucje`, ime, cilj_datum; `je_superadmin` računa se iz SUPERADMIN_EMAIL (stupac `uloga` tek F13) |
| `email_tokeni` | reset/verifikacija | korisnik_id NOT NULL + indeks (v006); `iskoristen` — atomarna potrošnja |
| `email_log` | poslani mailovi | (korisnik_id, created_at) indeks |
| `strukovna_podrucja` / `ispitni_programi` | GRA/ARH/ELE/STR katalog | punjeno šifrarnikom |
| `dokumenti` | propisi (195+) | naziv UNIQUE (upsert sidro 🔒), vrsta, izvor (NN), priznato_pravilo, `status='aktivno'` |
| `program_dokumenti` | M:N program↔dokument | `sekcija_put`, `uze_podrucje`, `redni`, `obuhvat` (per-POJAVLJIVANJE! isti zakon 2× u programu s različitim obuhvatom je legitiman), `izvor_naveden`, `napomena` |
| `clanci` | članci propisa | dokument_id FK, redoslijed, oznaka(≤60), naslov(≤300), tekst; F4 dodaje `status`('aktivan'/'brisan') + `dirty` |
| `pojmovi` | rječnik struke | punjenje F3b+ |
| `bookmarki` | zvjezdice | (korisnik,clanak) — obje FK **ON DELETE CASCADE** ⚠ zato je hash-skip (v011) i F4 upsert bitan: čuvaju clanak_id |

## 2. F4 — verzioniranje + statusi
```sql
ALTER TABLE clanci ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aktivan';
ALTER TABLE clanci ADD COLUMN IF NOT EXISTS dirty BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS clanci_verzije (
  id SERIAL PRIMARY KEY,
  clanak_id INTEGER NOT NULL REFERENCES clanci(id) ON DELETE CASCADE,
  oznaka TEXT NOT NULL, naslov TEXT NOT NULL DEFAULT '', tekst TEXT NOT NULL,
  vrijedi_od DATE NOT NULL DEFAULT CURRENT_DATE,
  vrijedi_do DATE,                       -- NULL = aktualna
  nn_izvor TEXT NOT NULL DEFAULT '',
  hash CHAR(32) NOT NULL,                -- md5(oznaka\u0001naslov\u0001tekst) — ISTI recept kao v011 uvoz 🔒
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS ix_cv_clanak ON clanci_verzije(clanak_id, vrijedi_od);
```
Semantika: `clanci` UVIJEK drži aktualni tekst (čitanje ostaje brzo, ništa postojeće ne puca); verzije = povijest. "Na dan D": `vrijedi_od<=D AND (vrijedi_do IS NULL OR vrijedi_do>D)`. Migracija: postojeći članci dobiju po jednu verziju (vrijedi_od = stupanje na snagu iz dokumenti.izvor gdje je jednoznačno, inače '2026-01-01' uz komentar). Brisan novelom → `clanci.status='brisan'`, tekst OSTAJE (čitač prikazuje traku "brisan novelom {NN}"), bookmarki/citati žive 🔒.

## 3. F5 — chunkovi (potrošni 🔓, ali shema 🔒)
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE TABLE IF NOT EXISTS chunkovi (
  id SERIAL PRIMARY KEY,
  clanak_id INTEGER NOT NULL REFERENCES clanci(id) ON DELETE CASCADE,
  verzija_id INTEGER REFERENCES clanci_verzije(id) ON DELETE SET NULL,
  redoslijed SMALLINT NOT NULL DEFAULT 1,
  tekst TEXT NOT NULL, tokeni SMALLINT NOT NULL DEFAULT 0,
  embedding vector(1024),
  fts tsvector GENERATED ALWAYS AS (to_tsvector('simple', unaccent(tekst))) STORED);
CREATE INDEX IF NOT EXISTS ix_ch_clanak ON chunkovi(clanak_id);
CREATE INDEX IF NOT EXISTS ix_ch_fts ON chunkovi USING GIN(fts);
CREATE INDEX IF NOT EXISTS ix_ch_vec ON chunkovi USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64);
```
⚠ ako ekstenzije nema na planu: unaccent-fallback `translate(lower(tekst),'čćđšž','ccdsz')`; vector je uvjet F5 (upgrade plana).

## 4. F6 — pitanja
```sql
CREATE TABLE IF NOT EXISTS pitanja (
  id SERIAL PRIMARY KEY,
  program_id INTEGER NOT NULL REFERENCES ispitni_programi(id),
  uze_podrucje TEXT NOT NULL DEFAULT '',
  tip TEXT NOT NULL CHECK (tip IN ('abc','tocno_netocno','otvoreno','usmeno')),
  pitanje TEXT NOT NULL, opcije JSONB,
  tocno TEXT NOT NULL DEFAULT '', obrazlozenje TEXT NOT NULL DEFAULT '',
  clanak_refs INTEGER[] NOT NULL DEFAULT '{}',
  izvor TEXT NOT NULL DEFAULT 'ai' CHECK (izvor IN ('rok','ai','admin')),
  rok_oznaka TEXT NOT NULL DEFAULT '',
  tezina SMALLINT NOT NULL DEFAULT 3 CHECK (tezina BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'nacrt' CHECK (status IN ('nacrt','ovjereno','povuceno')),
  ovjerio INTEGER REFERENCES korisnici(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS ix_pit_prog ON pitanja(program_id, status, uze_podrucje);
```
🔒 u testove/usmeni SAMO `ovjereno`; `clanak_refs` obavezan i za rok-pitanja (RAG mapiranje + Ivanova potvrda).

## 5. F7 — testovi
```sql
CREATE TABLE IF NOT EXISTS test_sesije (
  id SERIAL PRIMARY KEY,
  korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
  tip TEXT NOT NULL CHECK (tip IN ('brzi','puni','sekcija','slabe_tocke','usmeni')),
  config JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(), finished_at TIMESTAMPTZ,
  score NUMERIC(5,2));
CREATE TABLE IF NOT EXISTS test_odgovori (
  id SERIAL PRIMARY KEY,
  sesija_id INTEGER NOT NULL REFERENCES test_sesije(id) ON DELETE CASCADE,
  pitanje_id INTEGER NOT NULL REFERENCES pitanja(id),
  odgovor TEXT NOT NULL DEFAULT '', tocno BOOLEAN, vrijeme_s SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS ix_ts_kor ON test_sesije(korisnik_id, started_at);
CREATE INDEX IF NOT EXISTS ix_to_ses ON test_odgovori(sesija_id);
CREATE INDEX IF NOT EXISTS ix_to_pit ON test_odgovori(pitanje_id, created_at);
```

## 6. F8/F9 — napredak + SRS
```sql
CREATE TABLE IF NOT EXISTS napredak_clanci (
  korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
  clanak_id INTEGER NOT NULL REFERENCES clanci(id) ON DELETE CASCADE,
  procitano_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (korisnik_id, clanak_id));
CREATE TABLE IF NOT EXISTS srs_stanje (
  korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
  pitanje_id INTEGER NOT NULL REFERENCES pitanja(id) ON DELETE CASCADE,
  ef NUMERIC(3,2) NOT NULL DEFAULT 2.50,
  interval_d SMALLINT NOT NULL DEFAULT 0,
  due DATE NOT NULL DEFAULT CURRENT_DATE,
  ponavljanja SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (korisnik_id, pitanje_id));
CREATE INDEX IF NOT EXISTS ix_srs_due ON srs_stanje(korisnik_id, due);
```

## 7. F10 — notifikacije (uz postojeći push_subscriptions? ⚠ NE — push_subscriptions je ŽBUKA tablica; OI je dobiva u F10)
```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS notif_prefs (
  korisnik_id INTEGER PRIMARY KEY REFERENCES korisnici(id) ON DELETE CASCADE,
  push_on BOOLEAN NOT NULL DEFAULT true,
  tihi_od SMALLINT NOT NULL DEFAULT 21, tihi_do SMALLINT NOT NULL DEFAULT 8,
  max_dnevno SMALLINT NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS notif_log (
  id SERIAL PRIMARY KEY,
  korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
  tip TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}',
  poslano_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS ix_nl ON notif_log(korisnik_id, tip, poslano_at);
```

## 8. F12–F19 — bilješke, kvote, AI, Stripe, analitika
```sql
CREATE TABLE IF NOT EXISTS biljeske (
  id SERIAL PRIMARY KEY,
  korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
  clanak_id INTEGER NOT NULL REFERENCES clanci(id) ON DELETE CASCADE,
  tekst TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS ix_bilj ON biljeske(korisnik_id, clanak_id);

CREATE TABLE IF NOT EXISTS usage_mjesec (
  korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
  mjesec CHAR(7) NOT NULL,
  testova SMALLINT NOT NULL DEFAULT 0, ai_poruka SMALLINT NOT NULL DEFAULT 0,
  usmenih SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (korisnik_id, mjesec));

CREATE TABLE IF NOT EXISTS ai_razgovori (
  id SERIAL PRIMARY KEY,
  korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
  mod TEXT NOT NULL DEFAULT 'asistent' CHECK (mod IN ('asistent','usmeni')),
  naslov TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS ai_poruke (
  id SERIAL PRIMARY KEY,
  razgovor_id INTEGER NOT NULL REFERENCES ai_razgovori(id) ON DELETE CASCADE,
  uloga TEXT NOT NULL CHECK (uloga IN ('user','assistant')),
  tekst TEXT NOT NULL, citati JSONB NOT NULL DEFAULT '[]',
  tokens_in INT NOT NULL DEFAULT 0, tokens_out INT NOT NULL DEFAULT 0,
  ocjena SMALLINT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS ix_aip ON ai_poruke(razgovor_id, id);
CREATE TABLE IF NOT EXISTS usmeni_sesije (
  id SERIAL PRIMARY KEY,
  korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
  razgovor_id INTEGER REFERENCES ai_razgovori(id) ON DELETE SET NULL,
  uze_podrucje TEXT NOT NULL DEFAULT '', rubrika JSONB,
  ukupno NUMERIC(4,2), created_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- F13: ALTER korisnici ADD uloga TEXT NOT NULL DEFAULT 'korisnik';  (superadmin/korisnik)
-- F14:
-- ALTER TABLE korisnici ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
-- ALTER TABLE korisnici ADD COLUMN IF NOT EXISTS stripe_sub_id TEXT;
-- ALTER TABLE korisnici ADD COLUMN IF NOT EXISTS tier_do DATE;
CREATE TABLE IF NOT EXISTS stripe_webhook_log (
  id SERIAL PRIMARY KEY, event_id TEXT NOT NULL UNIQUE,
  tip TEXT NOT NULL, payload JSONB NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS korisnik_checklist (
  korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
  stavka_kod TEXT NOT NULL, ucinjeno_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (korisnik_id, stavka_kod));

-- ✅ v013: events tablica JE u produkciji (instrumentirano: login, registracija,
-- clanak_otvoren, bookmark_on/off, pretraga) — nova instrumentacija se dodaje po fazama
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  korisnik_id INTEGER REFERENCES korisnici(id) ON DELETE SET NULL,
  tip TEXT NOT NULL, meta JSONB NOT NULL DEFAULT '{}',
  ts TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS ix_ev ON events(tip, ts);
```

## 9. Kaskadna mapa (GDPR provjera u 10 sekundi)
`korisnici` ← CASCADE: email_tokeni, email_log, bookmarki, napredak_clanci, srs_stanje, test_sesije(→test_odgovori), ai_razgovori(→ai_poruke), usmeni_sesije, biljeske, usage_mjesec, notif_*, push_subscriptions, korisnik_checklist; SET NULL: events. `clanci` ← CASCADE: bookmarki, chunkovi, napredak_clanci, biljeske, clanci_verzije; ali `test_odgovori→pitanja→clanak_refs[]` je ARRAY (bez FK) — pri soft-deleteu članka pitanja s referencom idu u 'povuceno' review listu (F4 zadatak).

## CHANGELOG
- 2.1 (2026-07-04): events tablica premjestena iz F18 u produkciju (v013)
- 2.0 (2026-07-04): inicijalno (apsorbira spec §DIO 2 + dopune: usmenih kvota, uloga stupac, kaskadna mapa, checklist).

> ✅ **Provjereno 2026-07-09 (stanje koda v183).**
## DOPUNA 2026-07-09 (v183)
### Nove tablice (u produkciji; init-db key=io-ispit-2026)
**`promo_akcije`** (v176): id, naziv, opis, tip ('dani_pro'|'bonus_budzet'|...), vrijednost, vrijedi_od/do, aktivna BOOL, uvjet (rang-logika: prva aktivna čiji uvjet prolazi), created_at. Hook `promoPrimijeniNaNovog` pri registraciji; dodjela `promoDodijeli`.
**`tier_postavke`** (v177): tier PK ('free'|'pro'|'enterprise'), budzet_usd NUMERIC NULL, pismeni_mj/usmeni_mj/vjestak_mj/**investitor_mj** INTEGER NULL (NULL=∞), updated_at. Keš 60 s u memoriji. Kvota 'investitor' broji `events` tip='inv_parcela' u tekućem mjesecu.
### Planirane tablice — F1.5 ATOM (sljedeća sesija, SHEMA)
**`ko_opcine`**: mbr INTEGER PK, naziv TEXT (+unaccent index), url TEXT, dohvaceno TIMESTAMPTZ NULL, br_cestica INT — puni se parsiranjem `atom_feed.xml` (cijela HR).
**`cestice`**: id BIGSERIAL, ko_mbr INT REFERENCES ko_opcine, kcbr TEXT (BROJ_CESTICE, npr. '2362' ili '2362/1'), povrsina NUMERIC (POVRSINA_GRAFICKA m²), cestica_id TEXT (CESTICA_ID), geom_wgs JSONB (GeoJSON poligon WGS84), bbox NUMERIC[4], azurirano TIMESTAMPTZ. Indeksi: (ko_mbr,kcbr) UNIQUE; bbox pretraga po točki pa točni point-in-polygon u kodu. Izvor: `ko-{mbr}.zip → zisapp/atom/katastarske_cestice.gml` (EPSG:3765 → WGS84 postojećim konverterom).
