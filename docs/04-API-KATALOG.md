# 04 — API KATALOG (sve rute: postojeće v012 + buduće po fazama)

> Konvencije 🔒: sve rute IZNAD `app.get('*')`; odgovor `{ok:true, …}` ili `{error:"poruka"}` + točan HTTP status (400 ulaz, 401 neautoriziran, 402 kvota, 403 zabranjeno, 404 nema, 409 sukob, 429 rate, 500 greška, 503 isključeno); `auth` = JWT Bearer; `sadmin` = zahtijevajSuperadmin; `pe(x)` = planEnforce (F13). Za točne postojeće potpise — server.js je istina; ovdje je ugovor.

## 1. POSTOJEĆE (v012)
| Ruta | Auth | Ugovor (sažetak) |
|---|---|---|
| `GET /api/health` | — | `{ok, app, verzija, faza, dev_mode, vrijeme, baza}` — temelj health-ping auto-refresha |
| `GET /api/init-db?key=` | INIT_KEY | idempotentna shema; SAMO uz promjenu sheme |
| `POST /api/register` | — | atomaran; duplikat → 409; kredencijali mailom (Resend) |
| `POST /api/login` | — | → `{token}` JWT 7d; prisilna-promjena tok po potrebi |
| `POST /api/lozinka/zaboravljena` → `/reset` | — | token jednokratno-atomarno (UPDATE…RETURNING u tx) |
| `POST /api/profil` | auth | ime, cilj_datum, program_kod (validiran u bazi; promjena programa resetira uže), uze_podrucje |
| `GET /api/programi` | auth | katalog programa |
| `GET /api/uci/struktura` | auth | sekcije programa → propisi (+obuhvat, NN, priznato) + br_clanaka (jedan GROUP BY) |
| `GET /api/dokument/:id` | auth | dokument meta + obuhvat (za korisnikov program) + članci [{id,redoslijed,oznaka,naslov,**preview** (v010: ≤90 zn. samo kad naslova nema; `tekst` se NE šalje),bookmark}] |
| `GET /api/clanak/:id` | auth | puni tekst + prev_id/next_id + bookmark |
| `POST /api/bookmark` | auth | toggle (DELETE-first) → `{bookmarkiran}` |
| `GET /api/bookmarki` | auth | lista |
| `GET /api/uci/pretraga?q=` | auth | ≥2 zn.; ILIKE (%,_ strip); `{propisi[≤15], clanci[≤15]}` |
| `POST /api/admin/uvoz/sifrarnik` | sadmin | tx; upsert programa/dokumenata **ON CONFLICT(naziv)**; mapiranja: DELETE po uvezenim programima pa INSERT ⚠ zato se izvor-update radi PUNIM šifrarnikom, ne mini-patchom |
| `POST /api/admin/uvoz/clanci` | sadmin | `{dokument_naziv ILI dokument_id, clanci[≤3000]}`; **hash-skip v011**: identično → `{status:'identicno'}` bez diranja (bookmarki žive); inače delete-pa-insert → `{status:'novo'|'zamijenjeno', clanaka, prije}`; F4 ga zamjenjuje upsertom (ugovor ostaje kompatibilan + dodaje `{status:'upsert', novo,izmijenjeno,brisano,identicno}`) |
| `GET /api/admin/uvoz/status` | sadmin | `{dokumenata_ukupno, uvezeno, clanaka, popis[{naziv,clanaka}]}` — progress kartica |
| `GET /api/admin/dashboard` | sadmin | ⭐v013 `{kpi:{korisnika,novih_7d,aktivnih_7d,po_tieru,bookmarka}, korisnici[≤200: id,ime,email,tier,program_kod,uze,cilj_datum,created_at,zadnja_prijava,zadnja_aktivnost,dogadjaja,bookmarka], top_clanci[10], pretrage[15]}` — pg-mem safe (datumska granica JS param, bez ANY) |
| statički: `/sw.js`(no-cache), `/manifest.webmanifest`, ikone, `/fonts/*` (whitelist, immutable) | — | eksplicitne rute, ne cijeli dir |

## 2. F3b — vodič + checklist
`GET /api/checklist` auth → `{stavke:[{kod,naziv,ucinjeno}]}` · `POST /api/checklist {kod}` toggle.

## 3. F4 — uvoz v2 + verzije + novela-diff
`POST /api/admin/uvoz/clanci` (isti path, upsert semantika §gore) · `GET /api/clanak/:id?na_dan=YYYY-MM-DD` (F17 UI; vraća verziju presjeka + `{povijesno:true, nn_izvor}`) · `GET /api/admin/novela-diff/:dokument_id` sadmin → lista izmjena zadnjeg uvoza (za "što donosi novela" objavu).

## 4. F5 — AI temelj
`POST /api/admin/ai/ingest` sadmin `{dokument_id?|sve:true}` → `{chunkova, embeddano, preskoceno}` (dirty-only opcija) 💰 · `POST /api/ai/pitaj` auth+pe('ai') `{razgovor_id?, tekst}` → **F5: JSON** `{razgovor_id, tekst, citati:[{n,clanak_id,oznaka,dokument}], upozorenje?}`; **F15: SSE** stream `data:{t:"…"}` … `data:{done:true,citati,…}` · `GET /api/ai/razgovori` / `GET /api/ai/razgovor/:id` / `DELETE /api/ai/razgovor/:id` auth · `POST /api/ai/ocjena {poruka_id, ocjena:±1}`.
Kvar-ugovori: AI_ENABLED=false → 503 `{error:'AI privremeno nedostupan'}`; kvota → 402 `{error:'limit', nadogradnja:true}`; Voyage down → radi FTS-only + `{upozorenje:'smanjena_preciznost'}`.

## 5. F6 — pitanja (admin)
`POST /api/admin/pitanja/generiraj` sadmin `{dokument_id|sekcija_put, n}` → nacrti (JSONL od Claude-a, validirani, INSERT status='nacrt', dedup-flag) · `GET /api/admin/pitanja?status&sekcija&page` · `PATCH /api/admin/pitanja/:id` (uredi polja / `{status:'ovjereno'|'povuceno'}` uz `ovjerio`) · `POST /api/admin/pitanja/uvoz-rokovi` `{stavke:[{pitanje,uze,rok_oznaka,tip?}]}` → RAG mapira clanak_refs → nacrti.

## 6. F7 — testovi
`POST /api/test/start` auth `{tip, config?}` → 402 na Free limitu (usage_mjesec.testova ON CONFLICT RETURNING); odgovor `{sesija_id, pitanja:[{id,tip,pitanje,opcije}]}` 🔒 BEZ tocno/obrazlozenje · `POST /api/test/odgovor` `{sesija_id,pitanje_id,odgovor,vrijeme_s}` → server ocijeni (abc usporedba; otvoreno → Claude rubrika q, q≥3=točno) → `{tocno, tocan_odgovor, obrazlozenje(Pro), q?}` · `POST /api/test/zavrsi {sesija_id}` → `{score, po_sekcijama, srs_azurirano}` (SRS upsert po pitanju).

## 7. F8/F9 — napredak + SRS
`GET /api/napredak` auth → `{spremnost, komponente:{pokrivenost,tocnost,svjezina}, sekcije:[{put, spremnost, n_pitanja, n_clanaka}], najslabije:[…3]}` · `POST /api/clanak/:id/procitano` toggle · `GET /api/srs/danas` → `{due:[pitanja bez tocno], ukupno_due, streak}` · `POST /api/srs/odgovor {pitanje_id, q}` → `{sljedeci_za_d}`.

## 8. F10 — push
`POST /api/push/pretplata` auth `{endpoint,p256dh,auth}` (upsert po endpoint UNIQUE) · `DELETE /api/push/pretplata` · `GET/POST /api/push/postavke` (notif_prefs) · `POST /api/admin/push/test` sadmin (probna na vlastite pretplate) · interni scheduler (nije ruta).

## 9. F13/F14 — plan + Stripe
`GET /api/plan` auth → `{tier, tier_do, kvote:{testova:{iskoristeno,limit}, ai:{…}, usmenih:{…}}}` · `POST /api/stripe/checkout` auth → `{url}` · `POST /api/stripe/portal` auth → `{url}` · `POST /api/stripe/webhook` **RAW body ⚠ registrirati PRIJE express.json()**; potpis verifikacija; event UNIQUE idempotentno; sync tier/tier_do.

## 10. F16 — usmeni
`POST /api/usmeni/start` auth+pe('usmeni') `{uze?}` → `{sesija_id, uvod, glavno_pitanje}` (zlatni sadržaj ostaje server-side u memoriji sesije/tablici) · `POST /api/usmeni/odgovor {sesija_id, tekst}` → `{potpitanje}|{kraj:true, rubrika, ponovi:[{tema,clanak_refs}]}` (SSE za tekst ispitivača u F16.2 🔓) · `GET /api/usmeni/povijest`.

## 11. F17 — praksa
`GET /api/praksa/dopisi` (katalog predložaka) · `POST /api/praksa/dopis {predlozak, polja{}}` → `{nacrt, citati}` · `GET /api/praksa/rokovi` (katalog iz rokovi.json + clanak linkovi) · `POST /api/praksa/rok {kod, datumi{}}` → `{rezultat_datum, koraci_izracuna, izvor:{clanak_id,oznaka}}` — račun KOD, ne AI 🔒.

## 12. F18/F19 — admin analitika + GDPR
`GET /api/admin/analitika?od&do` sadmin → agregati (DAU, testovi, ai_upiti, trošak €, thumbs_down top pitanja) · `GET /api/racun/izvoz` auth → JSON sve korisnikovo · `POST /api/racun/brisanje` auth → mail-potvrda token · `POST /api/racun/brisanje/potvrdi {token}` → CASCADE brisanje (03 §9 mapa).

## CHANGELOG
- 2.1 (2026-07-04): +admin/dashboard (v013).
- 2.0 (2026-07-04): inicijalno.
