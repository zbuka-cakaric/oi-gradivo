# 09 — OPERATIVA I RUNBOOK (deploy, backup, kad nešto ne radi, rječnik)

## 1. Deploy ritual (svaki put isti)
1. AI isporuči ZIP → raspakiraj → **GitHub oi-ispit repo: upload dirnutih fajlova na main** (web UI: Add file → Upload) → Railway auto-build (~1–2 min).
2. **init-db SAMO ako je faza mijenjala shemu:** otvori `https://oi-ispit.zbuka.hr/api/init-db?key=io-ispit-2026` — jednom; odgovor mora biti `{ok:true, shema_verzija:…}`.
3. Provjera: `…/api/health` u čistom tabu → verzija vNNN; app na mobitelu se sama osvježi (v012 health-ping: odmah na fokus/otvaranje, najkasnije 5 min).
4. `git tag vNNN` (kroz GitHub: Releases → Draft new → tag) — rollback disciplina.
5. Ako je faza dirala TRAJNU istinu (shema, ugovor rute, algoritam): ažuriraj odgovarajući biblija-dokument + CHANGELOG + upload u oi-gradivo/docs. HANDOFF ažurirati na kraju svake sesije.

## 2. Backup 🔒 (dok F20 ne automatizira — ručno, bez iznimke)
**Kada:** PRIJE svakog deploya koji mijenja shemu + tjedno nedjeljom.
**Kako (Railway):** projekt → Postgres → Connect → kopiraj `DATABASE_URL` → lokalno/na PC-u: `pg_dump "postgres://…" > oi-backup-vNNN-YYYYMMDD.sql` (Windows: instaliran psql klijent; alternativa Railway CLI `railway run pg_dump…`). Spremi: lokalno + **QNAP** (ZBUKA NAS, postojeća backup navika).
**Restore vježba:** F20 obavezno 1× (backup bez testiranog restorea je molitva, ne backup).
**Repo je backup koda; oi-gradivo je backup sadržaja i dokumentacije** — baza je jedino što živi samo na Railwayu ⚠.

## 3. Dijagnostika — simptom → uzrok → lijek
| Simptom | Prvo provjeri | Najčešći uzrok / lijek |
|---|---|---|
| App pokazuje staru verziju | `/api/health` u ČISTOM tabu (istina servera) vs Ja tab | build nije prošao (Railway Deployments log) ILI pre-v012 cache: minimiziraj→vrati app; zadnja linija: Chrome site settings → Clear storage |
| "Dokument nije pronađen" pri uvozu | naziv u JSON-u vs šifrarnik | naziv nije egzaktan — 06 §1 🔒 |
| Uvoz "identično" a očekivao si promjenu | — | sadržaj JE isti (hash); to je feature (bookmarki žive) |
| Uči prazan / krivi broj propisa | Ja→Admin progress kartica | šifrarnik nije uvezen / uvezen stari — uvezi PUNI aktualni |
| 403 na admin rutama | prijavljen račun | nisi na SUPERADMIN_EMAIL računu |
| Mailovi u spamu | Resend dashboard + DMARC | svježa domena povijest — "Not spam" trenira; DMARC je postavljen |
| Push ne stiže (F10+) | notif_log, prefs, tihe sate | pretplata mrtva (410→obrisana — re-subscribe u Ja), quiet hours, max_dnevno |
| AI "Gužva na servisu" | events ai_preopterecen | Anthropic 529 val — prolazan; retry politika radi svoje |
| AI čudno citira | traka ⚠ + events ai_citat_fail | post-check radi svoj posao; prijavi pitanje → eval set |
| Railway build fail | Deployments log | najčešće sintaksa — BUILD-GATE ga je trebao uhvatiti PRIJE pusha ⚠ nikad preskakati gate |
| Baza "connection refused" | Railway status | restart PG servisa; pool error handler drži app živim |

## 4. Incident protokol (kad je produkcija stvarno pokvarena)
1. **Rollback koda:** GitHub → prethodni tag → download fajlova → upload na main (ili Revert commita) → Railway redeploy. Health mora vratiti staru verziju.
2. **Shema se NE rollbacka** (idempotentni ADD-ovi su neškodljivi starom kodu — zato su NOT NULL uvijek s DEFAULT 🔒).
3. AI kaos → `AI_ENABLED=false` u Railway ENV (instant 503 na AI, ostatak appa živi).
4. Podaci oštećeni → zadnji pg_dump restore (zato §2).
5. Post-mortem u HANDOFF: što, zašto, koji guard fali → guard se DODAJE (tako su nastali orphan-dedup, health-ping, hash-skip…).

## 5. Ritam održavanja
Tjedno: backup + pogled na admin progress/analitiku + Railway metrics. Mjesečno: `usage` i trošak AI (events), Resend deliverability, provjera ima li novela na praćenim propisima (zakon.hr banner datuma). Po noveli: 06 §7 modus operandi. Po Anthropic/Voyage promjeni cjenika/modela: ENV MODEL_* bump, ništa u kodu 🔒.

## 6. RJEČNIK ZA IVANA (prošireni; "objasni kao u rječniku biblije")
**Embedding** — tekst pretvoren u 1024 broja tako da slična ZNAČENJA imaju bliske brojeve; pretraga po smislu. **Chunk** — komad članka koji se embedira; naš = članak ili 2-5 stavaka sa zaglavljem porijekla. **RAG** — nađi izvore u NAŠOJ bazi pa ih daj AI-ju kao jedino gradivo; obrana od izmišljanja. **Vector index (HNSW)** — kazalo za značenja: među tisućama embeddinga munjevito nađe najbliže. **FTS** — klasična pretraga riječi u bazi; s vektorskom čini hibrid. **RRF** — spajanje više rang-lista: tko je visoko na više njih, pobjeđuje. **Retrieval hit@12** — jesu li SVI članci koje je odgovor trebao pronaći završili u top-12 izvora; naša glavna mjera kvalitete. **Prompt caching** — Anthropic pamti nepromijenjeni početak upita (naša pravila) i naplaćuje ga ~10× manje. **Temperature** — koliko AI "slobodno" formulira; 0 = strogo predvidljivo (JSON zadaci), 0.2 = naš standard za odgovore. **SSE/streaming** — odgovor stiže riječ-po-riječ preko jedne otvorene veze. **Webhook** — Stripe NAMA šalje poziv kad se nešto plati/otkaže. **Idempotentno** — ponovi bez štete (init-db, hash-skip, Stripe UNIQUE event). **Soft-delete** — označimo umjesto da obrišemo; sve što pokazuje na redak ostaje zdravo. **Dirty flag** — "promijenjen, treba novi embedding" — štedi novac. **VAPID** — ključevi kojima se naš server legitimira browserima za push. **SM-2/SRS** — razmaknuto ponavljanje: znaš → rjeđe pita; zaboravljaš → češće. **Middleware** — sloj kroz koji prolazi svaki zahtjev prije rute (auth, planEnforce). **Migracija** — promjena sheme baze; kod nas uvijek dodavanje (IF NOT EXISTS), nikad rušenje. **JSONB** — "ladica" u retku baze za polustrukturirane podatke (opcije pitanja, rubrika). **Envelope** — dogovoren oblik svakog API odgovora `{ok:…}`/`{error:…}`. **Kill-switch** — jedna ENV varijabla koja gasi rizičan podsustav bez deploya. **Regresijski test** — dokaz da novo NIJE pokvarilo staro (ZoG bit-identičan; testovi samo rastu). **Orphan (prijelom)** — izvornikov duplikat linije preko granice stranice; naš dedup ga briše. **PUA znak** — "privatna" Unicode ikonica web-fonta; smeće koje filtriramo.

## CHANGELOG
- 2.0 (2026-07-04): inicijalno.
