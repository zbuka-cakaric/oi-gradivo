# 08 — FAZE I ROADMAP (F3b → F20) + predlošci sesija

> **STATUS 2026-07-07 (v128):** GOTOVO — F3b–F17 (verzioniranje, RAG GATE 93%, banka čisti restart 1072, Vještak agentska petlja, usmeni s komisijom-personama + LJUDSKI OSJEĆAJ v126 + ŽIVA INTERAKCIJA v127, AI provjera točnosti). **OBRAČUNSKA SEKCIJA KOMPLETIRANA** (TU 19 + VOB 60 + Prosječne norme I-VII+niskogradnja 41 stavka — čeka ingest). Bug hunt v128 (admin sučelje, incognito, modal uređivanja). PREOSTALO do launcha: F13 planEnforce, F14 Stripe, F18 analitika, F19 pravo/GDPR, F20 launch. **SLJEDEĆA SESIJA — PROMJENA REDOSLIJEDA: INVESTITOR konceptualni razvoj kreće SADA** (ne čeka launch — Ivanova odluka 2026-07-07). Prvi kod = WFS prikaz čestice. Vidi 10-INVESTITOR.md v2.0 + PRVI-PROMPT-INVESTITOR.md + HANDOFF-2026-07-07.md.

> Format po fazi: **Cilj · Shema (→03) · Rute (→04) · UI (→05) · Testovi · Gotovo-kad · Sesija(e) · Prilozi za sesiju**. Detaljni SQL je u 03, ugovori ruta u 04, AI u 07 — ovdje je orkestracija. Graf ovisnosti: F4→F5→(F6, F15) · F6→F7→(F8, F9)→F10 · F13→F14 · F5(+F6)→F16 · F15→F17 · F11, F12 slobodne nakon F7 · F18/F19/F20 završnica.

**F3b — Vodič kroz prijavu + checklist** · Shema: korisnik_checklist · Rute: checklist GET/POST · UI: ekran iz Danas; sadržaj vodiča (upravni koraci MPGI prijave) **daje Ivan** ⚠ AI ne izmišlja postupke · Testovi: +2 (toggle, lista) · Gotovo: checklist pamti stanje kroz sesije · 1 sesija · Prilozi: Ivanov tekst koraka.

**F4 — Uvoz v2 (upsert + verzije)** 🔒 · Shema: clanci.status/dirty + clanci_verzije · Ruta: uvoz/clanci upsert semantika (04 §3) + novela-diff · Migracija: postojeći članci → po 1 verzija · Testovi: +5 (svaki ishod upserta, verzija zapisana, bookmark preživi izmjenu, brisan-status, diff brojke) · Gotovo: simulirana novela (priloženi izmijenjeni JSON) daje točan diff i povijest; bookmark na izmijenjenom članku živ · 1–2 sesije · Prilozi: jedan namjerno izmijenjeni JSON.

**F5 — RAG temelj (ingest + retrieval + pitaj API + EVAL)** 💰 · Shema: chunkovi + ekstenzije · ENV: AI set (02 §3) · Rute: 04 §4 (bez SSE) · Testovi: +4 s mock retrievalom (post-check pass/fail, 402 kvota placeholder, 503 kill-switch) · **Gotovo-GATE 🔒: eval hit@12 ≥ 0.90, citat ≥ 0.95, Ivanova ocjena ≥ 4 — brojke se upisuju u HANDOFF** · 2 sesije (ingest+API; eval-tuning) · Prilozi: **eval/pitanja.jsonl (40 kom — IVAN piše prije sesije!)**, VOYAGE/ANTHROPIC ključevi u Railway.

**F6 — Banka pitanja + generator + ovjera** · Shema: pitanja · Rute: 04 §5 · UI: admin "Pitanja" ekran (filtar, uredi, ovjeri/povuci) · Testovi: +4 (CRUD, samo-ovjereno vidljivo, 403) · Gotovo: ≥100 ovjerenih za Ivanovo uže područje (Ivan ovjerava ~1 h) · 2 sesije · Prilozi: rok-pitanja JSON.

**F7 — Testovi (korisnički)** · Shema: test_sesije/odgovori + usage_mjesec · Rute: 04 §6 · UI: Testovi tab pun tok; **offline queue**; ⚠ **OI_BLOK_RELOAD guard u pingaj()** — reload se odgađa dok test traje · Testovi: +6 (start bez točnih 🔒, ocjena abc, limit 402 na 11., zavrsi score, SRS zapis, queue-simulacija) · Gotovo: pun test na mobitelu kroz tunel bez mreže preživi · 2 sesije.

**F8 — Napredak** · Bez sheme (+napredak_clanci ako nije u F7) · Ruta: napredak + procitano toggle · Formula (07/01): 0.35/0.45/0.20, decay w=0.5^(dana/30) — **test s ručno izračunatim primjerom obavezan** · UI: prsten s komponentama + razrez + najslabije 3 · 1 sesija.

**F9 — SRS + Danas** · Shema: srs_stanje (ako nije F7) · SM-2 lite doslovno (03 §6) · UI: Danas due tok + streak · Testovi: +3 (interval raste na q=5, resetira na q<3, due upit) · 1 sesija.

**F10 — Push** · Shema: push_subscriptions/notif_prefs/notif_log · ENV: VAPID · sw.js: push+notificationclick (⚠ verzija ×3!) · Scheduler 15 min in-process (⚠ lock kroz sustav_meta ako ikad >1 instanca) · Katalog poruka i pravila: 01 §4.5 (tihe sate, max 1/dan, 72 h, **404/410 → DELETE pretplate**) · Testovi: +3 (prefs CRUD, log dedup pravilo kao čista funkcija, 403 admin-test) · Gotovo: proba stiže na Ivanov Samsung, klik otvara deep-link · 1–2 sesije.

**F11 — Onboarding v2 + plan** · Plan generator = KOD (dana×sekcije×težine config) · 1 sesija.
**F12 — Bilješke** · Shema: biljeske; bez highlight raspona ⚠ (03) · 1 sesija.
**F13 — planEnforce** 🔒 · korisnici.uloga stupac; middleware + JEDNO mjesto s mapom feature→tier+kvota; retrofit na sve Pro rute · Testovi: +4 (free blokade, pro prolazi, kvote RETURNING) · 1 sesija.
**F14 — Stripe** · 04 §9; ⚠ webhook RAW body PRIJE express.json; idempotentnost UNIQUE(event_id) 🔒; prvo test-mode, Ivanov live €19,99 = smoke · 2 sesije.
**F15 — AI Asistent UI** · SSE stream; ulazi: Danas kartica + "Pitaj o ovom članku" (⚠ NE 6. tab — 05 §3); povijest, thumbs, klik-citati; disclaimer traka · **Gotovo: oba referentna pitanja (07 §7) savršena** · 2 sesije.
**F16 — Usmeni ispitivač** · 07 §6 state-machine; kvota 3/dan · **Prije koda: Opus piše 3 primjer-transkripta (scenarij→potpitanja→rubrika) — Ivan odobrava TON** · Gotovo: Ivan odradi 3 simulacije i potpiše da "liči na pravi usmeni" · 2–3 sesije.
**F17 — Praksa mod** · preklopnik u Ja; dopisi (few-shot = Ivanova arhiva), rokovi.json (KOD računa 🔒), "na dan" UI, checkliste set · Gotovo: Ivan u stvarnom slučaju s gradilišta dobije upotrebljiv dopis < 2 min · 2–3 sesije · Prilozi: anonimizirani dopisi + rokovi.json nacrt.
**F18 — Admin analitika** · events agregati + trošak-alarm >€10/dan · 1 sesija.
**F19 — Pravo/GDPR/sigurnost** · pravnik ovjeri Uvjete/Privatnost; izvoz+brisanje računa; rate-limit AI ruta ~10/min; CORS/headeri ŽBUKA set; audit admin akcija u events · 1 sesija + pravnik.
**F21–F27 — INVESTITOR (poslije launcha)** · kompletan plan, sheme i 🔒 odluke u **10-INVESTITOR.md** — ovdje se NE duplicira · redoslijed: F21 geometrija (WFS) → F22 pravila+namjena → F23 engine (zlatni test: Hercegovačka 56!) → F24 parcelacija → F25 studija+PDF → F26 AI+checklist → F27 paket+brand odluka.
**F20 — Launch v1.0** · backup automatika (dnevni pg_dump → B2/QNAP, **restore vježba obavezna 1×**), Lighthouse, meta/OG, uptime ping, HANDOFF v-final, tagovi · 1 sesija.

---

## PREDLOŠCI PRVE PORUKE (kopiraj, popuni {•})

**Univerzalni okvir:**
```
Nastavljamo OI Ispit — faza {F#}. ISTINA: biblija u repou zbuka-cakaric/oi-gradivo/docs (povuci 00 + {relevantni dokumenti} s raw.githubusercontent ako nisu priloženi) + priloženi HANDOFF + aktualni kod v{NNN}. Prije ikakvog koda: potvrdi pročitano, nabroji 🔒 odluke koje faza dira, plan u 5 redaka. PRAVILA: kirurške izmjene s ⭐ v{NNN+1}, verzija u 3 mjesta, rute iznad '*', envelope, koercija inputa, atomarnost, init-db {da/ne}, BUILD-GATE + node test-v007.js (testovi samo rastu) prije isporuke, sve dirnute fajlove u ZIP-u. Kod pobjeđuje bibliju uz upozorenje; 🔒 se ne krši bez mog odobrenja i CHANGELOG zapisa.
```
**Fazni dodaci:** F4: "+ prilažem izmijenjeni JSON za diff test." · F5: "+ eval/pitanja.jsonl ({n}); NE gradiš UI; isporuka uključuje eval brojke." · F6: "+ rok-pitanja JSON; generator na sekciji {•}." · F7: "ne zaboravi OI_BLOK_RELOAD guard." · F10: "sw.js se mijenja → verzija ×3." · F14: "webhook RAW body prije json middlewarea." · F16: "PRVO 3 primjer-transkripta na odobrenje, pa kod." · Batch zakona (bilo kada, Sonet): "Parsiraj batch iz oi-gradivo repoa po 06-SADRZAJNI-PIPELINE.md — profil {A/B}, QC + regresija ZoG, isporuka JSON-ova u ZIP-u + zbirna tablica."

## CHANGELOG
- 2.1 (2026-07-05): dodan pokazivač F21–F27 INVESTITOR (→10-INVESTITOR.md).
- 2.0 (2026-07-04): inicijalno (apsorbira spec §DIO 4+8, dodane Gotovo-definicije i prilozi po fazi).

> ✅ **Provjereno 2026-07-09 (stanje koda v183).**
## DOPUNA 2026-07-09 — stanje faza
Isporučeno kroz v129–v183: audit+batch popravci, tablice-ingestion, smart search, pretplatnički tierovi + tier_postavke + promo, token meter + raščlamba, dashboard troškovna analitika, email redesign, multi-device sesije + GDPR export, sidebar badges, Vještak privici/retry/auto-nastavak/dragdrop, **Investitor F1** (karta+čestica+GPS+kčbr+obuhvat). **SLJEDEĆE: F1.5 ATOM ingestion** (vidi 10-INVESTITOR §F1.5 i PRVI-PROMPT-F15-ATOM.md), zatim F2 kalkulator (čeka Ivanov Excel Hercegovačke + defaulte), F3 namjena (ZG GUP GetFeatureInfo).
