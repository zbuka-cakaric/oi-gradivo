/*  OI Ispit — server.js
 *  Stack: Node/Express + PostgreSQL (Railway) + pgvector (Faza 5)
 *  Konvencije: jedan file, kirurske izmjene, komentari HR, verzija u 3 mjesta.
 *  Nove rute UVIJEK iznad catch-all '*'.
 *
 *  CHANGELOG
 *    v001 — skelet: health, init-db (sustav_meta), PWA statika, SPA fallback
 *    v002 — Faza 1: racuni i prijava (korisnici/email_tokeni/email_log),
 *           register + Resend, login + JWT, prisilna promjena lozinke, reset lozinke
 *    v003 — Norma redizajn mailova (badge, kartica, gumb, sastavnica),
 *           plain-text dio + reply-to (bolja isporuka / manje spama)
 *    v004 — Faza 2: self-host fontovi (/fonts/*), POST /api/profil (ime, cilj_datum)
 *    v005 — PWA instalacija: Android beforeinstallprompt banner + iOS upute
 *    v006 — hardening (DIO 7): withTx, atomarno trosenje reset tokena, atomaran
 *           register bez SELECT-pa-INSERT utrke (409 preko UNIQUE), koercija+limiti
 *           inputa, granica petlje korisnickog imena, novi indeksi + NOT NULL
 *    v007 — Faza 3a: gradivo (strukovna_podrucja, ispitni_programi, dokumenti,
 *           program_dokumenti, clanci, pojmovi, bookmarki), superadmin uvoz,
 *           Uci struktura+clanak+bookmark+pretraga, profil: program+uze podrucje,
 *           pravne stranice (modal)
 *    v008 — onboarding: podrucje se sprema odmah na "Dalje"; datum ispita opcionalan
 */
'use strict';

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { generirajDopisDocx } = require('./dopis-docx.js'); // ⭐ v089 — DOCX izvoz dopisa
const { generirajDopisPdf } = require('./dopis-pdf.js'); // ⭐ v137 — PDF izvoz dopisa (lazy pdfkit unutar funkcije)

// ⭐ v016 — verzija (drzi sinkrono sa sw.js CACHE_VERSION i footerom u index.html)
const VERZIJA = 'v147'; // ⭐ v147 — VJEŠTAK "Vidi tablicu": ako citirani članak sadrži sliku tablice (TABLICA_SLIKA), odgovor dobije istaknut chip "📊 Vidi tablicu uživo — Članak N" koji otvori članak sa slikom izvornika (potvrda odgovora jednim tapom). // ⭐ v146 — TABLICE (pilot): proxy /api/tablica služi slike tablica iz oi-gradivo repoa (sigurno, kao 'self'); čitač renderira pipe-tablice kao <table> i TABLICA_SLIKA liniju kao sliku izvornika iz propisa (klik za povećanje). Vještak odgovara iz strukturiranog teksta, korisnik vidi originalnu tablicu. // ⭐ v145 — MENTOR "Objasni primjerom": uz "Zašto?" na pismenom novi gumb koji oživi članak kroz konkretnu situaciju s gradilišta (Sonnet 5, P_PRIMJER, isti grounding, on-demand + budžet). // ⭐ v144 — GLAS PRAVOPIS: kontekstualni AI-cleanup izdiktiranog teksta (Haiku, /api/glas/ocisti) na kraju diktata u usmenom i Vještaku — ispravlja fonetske promašaje STT-a po smislu rečenice (pravomošnost→pravomoćnost). Platformski trošak (~$0.0016/poziv), fail-safe (na grešku vraća original). Statični normalizator ostaje kao instant prvi prolaz. // ⭐ v143 — AUDIT FIX: napuštena Simulacija roka više ne blokira pokretanje nove (simStart uvijek kreće ispočetka). // ⭐ v142 — VJEŠTAK UX v2: (1) akcijski gumbi kompaktniji u JEDNOM redu (scroll ako ne stanu) + kraći natpisi (Dopis/Predmet), "Je li odgovor pomogao?" u zasebnom redu ispod; (2) STT hrvatski normalizator — izdiktirani srpski/ekavski oblici (obaveštava→obavještava, uslov→uvjet, tačno→točno…) prevode se whole-word na hrvatski u usmenom i Vještaku (lang='hr-HR' + kurirana lista). // ⭐ v141 — VJEŠTAK UX + DOKUMENTI: (1) akcijski gumbi ispod odgovora sada veliki, tappable, s natpisom (Kopiraj / Pretvori u dopis / Word / PDF / Spremi u predmet) + jasna "Je li odgovor pomogao?" povratna informacija; (2) PDF izvoz FIX — nema više praznih stranica (footer se crta uz margins.bottom=0); (3) vizualna dorada PDF i DOCX dopisa (hairline pod zaglavljem, tracked labele, izražajniji PREDMET, potpisni blok); (4) prekid streama pri izlasku iz app-a više ne briše u "Greška veze" nego zadrži što je stiglo uz mekšu poruku. // ⭐ v140 — STT POPRAVAK: mikrofon (usmeni umMic + Vještak aiMic) prešao na continuous=false + gradnju iz SVIH rezultata jedne sesije, bez auto-restarta i bez akumulacije — uklanja ponavljanje riječi/fraza ("hrvatski hrvatski… zavod je zavod je") koje je Android Chrome radio u continuous+restart načinu (v106 zakrpa nije bila dovoljna). Kompromis: mikrofon stane nakon pauze, za nastavak se tapne opet (tekst se čuva). // ⭐ v139 — BATCH 5 (SHEMA! uključuje v136–v138): SIMULACIJA ROKA — pismeni→usmeni→zajednički ishod; /api/simulacija/zavrsi VERIFICIRA obje sesije i čita ocjene iz baze (bez varanja), prolaz traži oba dijela; Pro (usmeni je Pro). PREDMETI (case-file) — nove tablice predmeti+predmet_stavke, CRUD rute, samostalni overlay (bez diranja navigacije), 📁 na Vještak odgovoru sprema u predmet. NOVE TABLICE: simulacije, predmeti, predmet_stavke → POKRENI init-db + BACKUP prije. // ⭐ v138 — BATCH 4 (uključuje v136/v137): MENTOR dijagnostika — /api/mentor/slabe-teme (točnost po užem području iz gotovih testova) + "Vježbaj baš ovo" (test/start prima `tema` filter, bez AI-iznenađenja izvan teme); RUBRIKA PO KRITERIJIMA na usmenom — P7A vraća kriterije (potpunost/tocnost_citata/prakticnost/komunikacija), finale ih deterministički prosječi (ne mijenja ocjenu/prolaz), klijent prikazuje trake. // ⭐ v137 — BATCH 2+3 (uključuje v136): VJEŠTAK IZVOZ — PDF izvoz dopisa (pdfkit + font, uz DOCX), "Pretvori odgovor u dopis", glasovni unos (STT) u Vještaku; VREMEPLOV — čitač pokazuje verziju članka "na dan" (postojeći ?na_dan); MENTOR mikro-tutor — /api/mentor/objasni "Zašto?" nakon pismenog odgovora (grounding: obrazloženje + članci, budžet kao Vještak). // ⭐ v136 — BUGFIX BATCH 1: (1) SRS ponavljanja ne troše mjesečnu kvotu testova (brojač uzima samo vrsta='test'); (2) tocno_netocno ocjenjivanje robusno — s opcijama ide indeks-po-tekstu kao abc, bez opcija kanonski T/N (radi za slovo/riječ/'A) ...'/vlastite tekstove, kraj "točan=netočno" za dio banke); (3) usmeni finale gramatika (pitanje/pitanja). // ⭐ v110 — ČISTI RESTART: ruta /api/admin/pitanja/obrisi-rok (potvrda OBRISI-ROK) briše sva rok-pitanja za ponovni uvoz očišćenog mastera + gumb s dvostrukom potvrdom. // ⭐ v109 — PRAVI UZROK NAĐEN: Provjeri banku gumb je slao POST na GET-rutu (api() umjesto apiGet()) → 404 HTML → generička "Greška.". Bug od v099 — zato nikad nije radila. Sad apiGet(). v107/v108 (bulletproof SQL + timeout + fallback) ostaju kao dodatna otpornost. // ⭐ v108 — Provjeri banku: statement_timeout 15s + LAKI COUNT fallback ako pun pregled istekne pod opterećenjem (Provjeri točnost); dijagnostički gumb pokazuje HTTP status. Uzrok generičke Greške = gateway timeout jer točnost drži konekcije. // ⭐ v107 — HOTFIX: Provjeri banku više ne puca (v105 je uveo jsonb_array_length(opcije) koji puca na usmenim pitanjima gdje je opcije=NULL — PostgreSQL ne štiti OR-kratki-spoj). Sad ABC validacija u JS-u (Array.isArray hvata null), bez rizičnih jsonb SQL funkcija. // ⭐ v106 — STT BUGFIX: mikrofon kod usmenog više ne ponavlja riječi ("hrvatskihrvatskihrvatski"). Uzrok bio loop od 0 koji je re-lijepio sve rezultate uključivo međurezultate; sad obrađuje samo nove (od e.resultIndex) i razdvaja konačne (isFinal) od međurezultata. // ⭐ v105 — BUGFIX: Provjeri banku optimiziran (lagan SQL SELECT umjesto povlačenja punog teksta 2000+ pitanja — više ne pada pod konkurencijom s Provjeri točnost); Provjeri točnost sad VRAĆA U NACRT ovjerena pitanja koja proturječe propisu (ne ostaju kao točna); klijentsko upozorenje da ne pokreneš oboje istovremeno. // ⭐ v104 — uvoz/clanci auto-kreira dokument ako ne postoji (vrsta/priznato iz JSON-a) → tehnički uvjeti i normativi idu izravno pod "Članci", bez zasebnog šifrarnik-koraka. // ⭐ v103 — WAKE LOCK: zaslon ostaje upaljen tijekom dugih uvoza/provjera (Wake Lock API + re-akvizicija na visibilitychange + indikator 🔆); wireiran u admPitUvoz i admPitTocnost. // ⭐ v102 — BUGFIX+UX: dopis izrezan (samo dopis u Word, vidljiv gumb); admin pretplata UI (desktop grid+mobilni); Nastavi gdje si stao (test/članak/usmeni); pismeni promo na Danas; SIGURNOST: CSP+HSTS+Permissions-Policy, throttle register/reset, startup upozorenje za default tajne. // ⭐ v101 — AI PROVJERA TOČNOSTI: POST /api/admin/pitanja/provjeri-tocnost → RAG-izvori (propisi iz gradiva) + AI-recenzent usporedi golden odgovor s propisom; verdikt (da/djelomicno/ne/nema_izvora) u pitanja.provjera; sporna dobiju [⚠ pa ih Ovjeri sve preskoči. // ⭐ v100 — KOMISIJA S KARAKTERIMA: svaki član ima temperament + strogost 1-5 (Perić/ZOP strog 5, Novak/opće blag 2); persona ide u P5+P6+P7A (dosljedan ton i prag tolerancije, ali ocjena OSTAJE poštena 🔒). Napredak dobiva TREND (spremnost po danu + smjer raste/pada). // ⭐ v099 — PROVJERA BANKE (temelj Master moda): GET /api/admin/pitanja/provjera → zdravstveni pregled uvezene banke (brojke po tipu/statusu/izvoru/uzem/težini, zastavice: abc bez opcija, abc tocno izvan opcija, prazan zlatni, duplikat teksta, [⚠ flag), uzorak pitanja BEZ zlatnog 🔒. Agregacija u JS (pg-mem bez HAVING/jsonb_array_length). // v098 rok-pitanja Faza A: uvoz-rokovi tezina + usmeni težinsko biranje // v097 audit p1p2 // v096 usmeni banka
const FAZA = 17; // ⭐ v081 — F19 pravnik/GDPR // ⭐ v047 — F16 Mentor // ⭐ v041 // ⭐ v035 // ⭐ v025 — F4+F5 kod isporučen, F6 banka pitanja
const PORT = process.env.PORT || 3000;
const INIT_KEY = process.env.INIT_KEY || 'oi-init-2026';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-tajna-promijeni-me';
const PWD_PEPPER = process.env.PWD_PEPPER || 'dev-pepper';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM = process.env.RESEND_FROM || 'OI Ispit <noreply@zbuka.hr>';
const RESEND_REPLY_TO = process.env.RESEND_REPLY_TO || 'info@zbuka.hr'; // ⭐ v003
const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase(); // ⭐ v007
const APP_URL = process.env.APP_URL || ''; // npr. https://oi.zbuka.hr (za reset link)
const DEV_MODE = !RESEND_API_KEY;          // bez Resend kljuca -> vracamo kredencijale u odgovoru

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '8mb' })); // ⭐ v007 — veci limit zbog uvoza clanaka zakona
app.use(express.urlencoded({ extended: true }));

// ── Sigurnosni headeri (⭐ v102 — pojačano: CSP, HSTS, Permissions-Policy) ──
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // klik-jacking zaštita
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
  // ⭐ v102 — HSTS: prisili HTTPS 180 dana (Railway je iza HTTPS proxyja)
  res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  // ⭐ v102 — ograniči moćne browser API-je (nitko ne treba kameru/mikrofon osim STT koji je user-gesture)
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()');
  // ⭐ v102 — CSP: dopusti samo vlastite resurse + Anthropic/Voyage/Google TTS (fetch) + inline (app je single-file);
  // 'unsafe-inline' nužan jer su skripta i stil u index.html — ali frame-ancestors 'none' i object-src 'none' zatvaraju glavne vektore.
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https://api.anthropic.com https://api.voyageai.com https://texttospeech.googleapis.com; " +
    "media-src 'self' blob: data:; " +
    "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  next();
});

// ── Osnovni in-memory rate-limit na /api ─────────────────────────────
const RL = new Map();
const RL_MAX = 300, RL_WIN = 60 * 1000;
app.use('/api', (req, res, next) => {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'x';
  const now = Date.now();
  const rec = RL.get(ip) || { n: 0, t: now };
  if (now - rec.t > RL_WIN) { rec.n = 0; rec.t = now; }
  rec.n++; RL.set(ip, rec);
  if (rec.n > RL_MAX) return res.status(429).json({ error: 'Previse zahtjeva, pricekaj minutu.' });
  next();
});

// ── PostgreSQL (lazy; ne rusi boot ako DATABASE_URL fali) ────────────
let pool = null;
function getPool() {
  if (pool) return pool;
  const cs = process.env.DATABASE_URL;
  if (!cs) return null;
  const bezSsl = cs.includes('localhost') || cs.includes('127.0.0.1') || cs.includes('.railway.internal');
  pool = new Pool({ connectionString: cs, ssl: bezSsl ? false : { rejectUnauthorized: false }, max: 5, idleTimeoutMillis: 30000 });
  pool.on('error', (e) => console.error('[pg] pool error:', e.message));
  return pool;
}
async function q(text, params) {
  const p = getPool();
  if (!p) throw new Error('Baza nije dostupna (DATABASE_URL nije postavljen).');
  return p.query(text, params);
}
async function dbStatus() {
  const p = getPool();
  if (!p) return { spojeno: false, razlog: 'DATABASE_URL nije postavljen' };
  try { const r = await p.query('select now() as ts'); return { spojeno: true, ts: r.rows[0].ts }; }
  catch (e) { return { spojeno: false, razlog: e.message }; }
}
// ⭐ v006 — withTx: transakcija za visekoracne upise (DIO 7A)
async function withTx(fn) {
  const p = getPool();
  if (!p) throw new Error('Baza nije dostupna.');
  const c = await p.connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
  finally { c.release(); }
}

// ── Idempotentna shema (raste po fazama) ─────────────────────────────
async function initDb() {
  const p = getPool();
  if (!p) throw new Error('Nema DATABASE_URL — ne mogu inicijalizirati bazu.');

  await p.query(`CREATE TABLE IF NOT EXISTS sustav_meta (
    kljuc TEXT PRIMARY KEY, vrijednost TEXT, azurirano TIMESTAMPTZ DEFAULT now());`);

  // Faza 1
  await p.query(`CREATE TABLE IF NOT EXISTS korisnici (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    korisnicko_ime TEXT UNIQUE NOT NULL,
    lozinka_hash TEXT NOT NULL,
    ime TEXT,
    tier TEXT NOT NULL DEFAULT 'free',
    je_admin BOOLEAN NOT NULL DEFAULT false,
    email_potvrden BOOLEAN NOT NULL DEFAULT false,
    mora_promijeniti_lozinku BOOLEAN NOT NULL DEFAULT true,
    cilj_datum DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    zadnja_prijava TIMESTAMPTZ);`);

  await p.query(`CREATE TABLE IF NOT EXISTS email_tokeni (
    id SERIAL PRIMARY KEY,
    korisnik_id INTEGER REFERENCES korisnici(id) ON DELETE CASCADE,
    tip TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    istek TIMESTAMPTZ NOT NULL,
    iskoristen BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now());`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_email_tokeni_hash ON email_tokeni(token_hash);`);

  await p.query(`CREATE TABLE IF NOT EXISTS email_log (
    id SERIAL PRIMARY KEY,
    korisnik_id INTEGER,
    primatelj TEXT, tip TEXT, status TEXT, resend_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now());`);

  // ⭐ v007 — Faza 3: gradivo (sifrarnik regulative + clanci + bookmarki)
  await p.query(`CREATE TABLE IF NOT EXISTS strukovna_podrucja (
    id SERIAL PRIMARY KEY,
    kod TEXT UNIQUE NOT NULL,
    naziv TEXT NOT NULL,
    redoslijed INTEGER NOT NULL DEFAULT 0);`);

  await p.query(`CREATE TABLE IF NOT EXISTS ispitni_programi (
    id SERIAL PRIMARY KEY,
    kod TEXT UNIQUE NOT NULL,
    strukovno_id INTEGER NOT NULL REFERENCES strukovna_podrucja(id),
    vrsta_poslova TEXT NOT NULL DEFAULT '',
    sprema TEXT NOT NULL DEFAULT 'VSS',
    naziv TEXT NOT NULL DEFAULT '',
    verzija_popisa TEXT NOT NULL DEFAULT '');`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_programi_strukovno ON ispitni_programi(strukovno_id);`);

  await p.query(`CREATE TABLE IF NOT EXISTS dokumenti (
    id SERIAL PRIMARY KEY,
    naziv TEXT UNIQUE NOT NULL,
    vrsta TEXT NOT NULL DEFAULT 'zakon',
    izvor TEXT NOT NULL DEFAULT '',
    priznato_pravilo BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'aktivno' CHECK (status IN ('aktivno','zastarjelo')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_dokumenti_status ON dokumenti(status);`);

  await p.query(`CREATE TABLE IF NOT EXISTS program_dokumenti (
    id SERIAL PRIMARY KEY,
    program_id INTEGER NOT NULL REFERENCES ispitni_programi(id) ON DELETE CASCADE,
    dokument_id INTEGER NOT NULL REFERENCES dokumenti(id) ON DELETE CASCADE,
    sekcija_put TEXT NOT NULL DEFAULT '',
    uze_podrucje TEXT,
    redni INTEGER NOT NULL DEFAULT 0,
    izvor_naveden TEXT NOT NULL DEFAULT '',
    obuhvat TEXT NOT NULL DEFAULT '',
    priznato BOOLEAN NOT NULL DEFAULT false);`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_pd_program ON program_dokumenti(program_id);`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_pd_dokument ON program_dokumenti(dokument_id);`);

  await p.query(`CREATE TABLE IF NOT EXISTS clanci (
    id SERIAL PRIMARY KEY,
    dokument_id INTEGER NOT NULL REFERENCES dokumenti(id) ON DELETE CASCADE,
    redoslijed INTEGER NOT NULL DEFAULT 0,
    oznaka TEXT NOT NULL DEFAULT '',
    naslov TEXT NOT NULL DEFAULT '',
    tekst TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_clanci_dok ON clanci(dokument_id, redoslijed);`);

  // ⭐ v018 — F4: statusi + verzioniranje clanaka (03 §2). clanci = UVIJEK aktualni
  // tekst (citanje brzo, nista postojece ne puca); clanci_verzije = povijest.
  await p.query(`ALTER TABLE clanci ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aktivan';`);
  await p.query(`ALTER TABLE clanci ADD COLUMN IF NOT EXISTS dirty BOOLEAN NOT NULL DEFAULT false;`);
  await p.query(`CREATE TABLE IF NOT EXISTS clanci_verzije (
    id SERIAL PRIMARY KEY,
    clanak_id INTEGER NOT NULL REFERENCES clanci(id) ON DELETE CASCADE,
    oznaka TEXT NOT NULL,
    naslov TEXT NOT NULL DEFAULT '',
    tekst TEXT NOT NULL,
    vrijedi_od DATE NOT NULL DEFAULT CURRENT_DATE,
    vrijedi_do DATE,
    nn_izvor TEXT NOT NULL DEFAULT '',
    hash CHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
  await p.query(`CREATE INDEX IF NOT EXISTS ix_cv_clanak ON clanci_verzije(clanak_id, vrijedi_od);`);

  // ⭐ v042 — Skraćeno/Primjer keš: jedna generacija po (članak, tip, hash teksta) služi SVIM korisnicima 💰.
  // Novela mijenja tekst -> hash se ne poklapa -> tiha regeneracija pri prvom pozivu.
  await p.query(`CREATE TABLE IF NOT EXISTS clanak_pomoc (
    id SERIAL PRIMARY KEY,
    clanak_id INTEGER NOT NULL REFERENCES clanci(id) ON DELETE CASCADE,
    tip TEXT NOT NULL,
    clanak_hash CHAR(32) NOT NULL,
    tekst TEXT NOT NULL,
    korisnik_id INTEGER REFERENCES korisnici(id) ON DELETE SET NULL,
    tokeni_in INTEGER NOT NULL DEFAULT 0,
    tokeni_out INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(clanak_id, tip));`);


  // ⭐ v019 — F5: chunkovi (03 §3). Ekstenzije/vector NEMA u pg-mem -> try-catch;
  // produkcija (Railway PG s pgvector) prolazi. Chunkovi su POTROSNI 🔓 — citati
  // SVUGDJE referenciraju clanak_id 🔒.
  global.__CHUNKOVI_GRESKA = null; // ⭐ v024 — svježa dijagnoza svakog init-a
  try {
    await p.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    await p.query(`CREATE EXTENSION IF NOT EXISTS unaccent;`);
    await p.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`); // ⭐ v028 — morfološki kanal za HR
    await p.query(`CREATE TABLE IF NOT EXISTS chunkovi (
      id SERIAL PRIMARY KEY,
      clanak_id INTEGER NOT NULL REFERENCES clanci(id) ON DELETE CASCADE,
      verzija_id INTEGER REFERENCES clanci_verzije(id) ON DELETE SET NULL,
      redoslijed SMALLINT NOT NULL DEFAULT 1,
      tekst TEXT NOT NULL, tokeni SMALLINT NOT NULL DEFAULT 0,
      embedding vector(1024),
      fts tsvector);`); // ⭐ v024 — bez GENERATED (unaccent nije IMMUTABLE na PG18); puni ga ingest INSERT
    await p.query(`CREATE INDEX IF NOT EXISTS ix_ch_clanak ON chunkovi(clanak_id);`);
    await p.query(`CREATE INDEX IF NOT EXISTS ix_ch_fts ON chunkovi USING GIN(fts);`);
    await p.query(`CREATE INDEX IF NOT EXISTS ix_ch_trgm ON chunkovi USING GIN(tekst gin_trgm_ops);`); // ⭐ v028
    await p.query(`CREATE INDEX IF NOT EXISTS ix_ch_vec ON chunkovi USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64);`);
  } catch (e) {
    console.log('[init-db] chunkovi preskočeni (nema vector/unaccent):', e.message.slice(0, 120));
    global.__CHUNKOVI_GRESKA = e.message.slice(0, 200); // ⭐ v023 — dijagnoza u init-db odgovoru
  }
  if (!global.__CHUNKOVI_GRESKA) { try { await p.query('SELECT 1 FROM chunkovi LIMIT 1'); global.__CHUNKOVI_GRESKA = null; } catch (_) {} }
  await p.query(`CREATE TABLE IF NOT EXISTS ai_razgovori (
    id SERIAL PRIMARY KEY,
    korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
    naslov TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
  await p.query(`CREATE INDEX IF NOT EXISTS ix_air_kor ON ai_razgovori(korisnik_id, id);`);
  await p.query(`CREATE TABLE IF NOT EXISTS ai_poruke (
    id SERIAL PRIMARY KEY,
    razgovor_id INTEGER NOT NULL REFERENCES ai_razgovori(id) ON DELETE CASCADE,
    uloga TEXT NOT NULL,
    tekst TEXT NOT NULL DEFAULT '',
    citati TEXT NOT NULL DEFAULT '[]',
    upozorenje TEXT,
    tokeni_in INTEGER NOT NULL DEFAULT 0, tokeni_out INTEGER NOT NULL DEFAULT 0,
    ocjena SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
  await p.query(`CREATE INDEX IF NOT EXISTS ix_aip_raz ON ai_poruke(razgovor_id, id);`);

  // ⭐ v025 — F6: banka pitanja (03 §4). U testove/usmeni SAMO status='ovjereno' 🔒.
  await p.query(`CREATE TABLE IF NOT EXISTS pitanja (
    id SERIAL PRIMARY KEY,
    program_id INTEGER NOT NULL REFERENCES ispitni_programi(id),
    uze_podrucje TEXT NOT NULL DEFAULT '',
    tip TEXT NOT NULL CHECK (tip IN ('abc','tocno_netocno','otvoreno','usmeno')),
    pitanje TEXT NOT NULL,
    opcije JSONB,
    tocno TEXT NOT NULL DEFAULT '',
    obrazlozenje TEXT NOT NULL DEFAULT '',
    clanak_refs INTEGER[] NOT NULL DEFAULT '{}',
    izvor TEXT NOT NULL DEFAULT 'ai' CHECK (izvor IN ('rok','ai','admin')),
    rok_oznaka TEXT NOT NULL DEFAULT '',
    tezina SMALLINT NOT NULL DEFAULT 3 CHECK (tezina BETWEEN 1 AND 5),
    status TEXT NOT NULL DEFAULT 'nacrt' CHECK (status IN ('nacrt','ovjereno','povuceno')),
    ovjerio INTEGER REFERENCES korisnici(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
  await p.query(`CREATE INDEX IF NOT EXISTS ix_pit_prog ON pitanja(program_id, status, uze_podrucje);`);
  // ⭐ v101 — AI provjera točnosti golden odgovora protiv RAG-izvora (propisa u gradivu).
  // {slaganje:'da'|'djelomicno'|'ne'|'nema_izvora', problem, clanak, kada} — NULL = još neprovjereno.
  await p.query(`ALTER TABLE pitanja ADD COLUMN IF NOT EXISTS provjera JSONB;`);
  // ⭐ v047 — F16 Mentor (usmeni AI ispitivač, 13 §5): sesija = 1 pitanje iz ovjerene banke +
  // ≤3 potpitanja + rubrika. Zlatni sadržaj (tocno/obrazlozenje) NIKAD ne ide klijentu prije kraja 🔒.
  await p.query(`CREATE TABLE IF NOT EXISTS usmeni_sesije (
    id SERIAL PRIMARY KEY,
    korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
    pitanje_id INTEGER NOT NULL REFERENCES pitanja(id),
    stanje TEXT NOT NULL DEFAULT 'glavno' CHECK (stanje IN ('glavno','gotovo')),
    potpitanja SMALLINT NOT NULL DEFAULT 0,
    rubrika JSONB,
    plan_pitanja JSONB NOT NULL DEFAULT '[]',
    pitanje_br SMALLINT NOT NULL DEFAULT 1,
    rezultati JSONB NOT NULL DEFAULT '[]',
    tokeni_in INTEGER NOT NULL DEFAULT 0,
    tokeni_out INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    zavrsena_at TIMESTAMPTZ);`);
  // ⭐ v053 — ispit = N pitanja (def 10): plan_pitanja = [pitanje_id…] fiksiran na startu,
  // pitanje_br = 1-bazirani redni broj aktivnog pitanja, rezultati = [{br,pitanje_id,ocjena,do_id}]
  // (do_id = id zadnje poruke tog pitanja -> rez transkripta po pitanju). Migracija idempotentna.
  for (const ddl of [
    `ALTER TABLE usmeni_sesije ADD COLUMN IF NOT EXISTS plan_pitanja JSONB NOT NULL DEFAULT '[]'`,
    `ALTER TABLE usmeni_sesije ADD COLUMN IF NOT EXISTS pitanje_br SMALLINT NOT NULL DEFAULT 1`,
    `ALTER TABLE usmeni_sesije ADD COLUMN IF NOT EXISTS rezultati JSONB NOT NULL DEFAULT '[]'`
  ]) { try { await p.query(ddl); } catch (_) { /* pg-mem: kolone već u CREATE */ } }
  // ⭐ v066 — povijest usmenih: ocjena+prolaz kolone (za brzi graf bez parsiranja rubrika JSONB) + index
  for (const ddl of [
    `ALTER TABLE usmeni_sesije ADD COLUMN IF NOT EXISTS ocjena SMALLINT`,
    `ALTER TABLE usmeni_sesije ADD COLUMN IF NOT EXISTS prolaz BOOLEAN`
  ]) { try { await p.query(ddl); } catch (_) {} }
  await p.query(`CREATE INDEX IF NOT EXISTS ix_usmeni_pov ON usmeni_sesije(korisnik_id, zavrsena_at);`);
  await p.query(`CREATE TABLE IF NOT EXISTS usmeni_poruke (
    id SERIAL PRIMARY KEY,
    sesija_id INTEGER NOT NULL REFERENCES usmeni_sesije(id) ON DELETE CASCADE,
    uloga TEXT NOT NULL CHECK (uloga IN ('ispitivac','kandidat')),
    tekst TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
  await p.query(`CREATE INDEX IF NOT EXISTS ix_usm_kor ON usmeni_sesije(korisnik_id, created_at);`);
  // ⭐ v061 — F7 PISMENI TEST (free tier): 20 pitanja (abc/tocno_netocno) iz ovjerene banke + ~10% AI-generiranih;
  // odgovor-po-odgovor s trenutnim ispravkom (tocno+obrazlozenje NAKON predaje tog pitanja 🔒);
  // finale deterministicki: ocjena = round(100*tocnih/ukupno), prag TEST_PROLAZ (def 90).
  await p.query(`CREATE TABLE IF NOT EXISTS test_sesije (
    id SERIAL PRIMARY KEY,
    korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
    plan_pitanja JSONB NOT NULL DEFAULT '[]',
    pitanje_br SMALLINT NOT NULL DEFAULT 1,
    rezultati JSONB NOT NULL DEFAULT '[]',
    stanje TEXT NOT NULL DEFAULT 'aktivan' CHECK (stanje IN ('aktivan','gotovo')),
    ocjena SMALLINT,
    prolaz BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    zavrsena_at TIMESTAMPTZ);`);
  await p.query(`ALTER TABLE test_sesije ADD COLUMN IF NOT EXISTS shuffle_seed BIGINT`); // ⭐ v129 — slučajan seed po sesiji za pravi random raspored opcija
  await p.query(`CREATE INDEX IF NOT EXISTS ix_test_kor ON test_sesije(korisnik_id, created_at);`);
  // ⭐ v062 — F8 SRS "Ponovi pogreške" (Leitner): kriv odgovor u testu -> stavka box=1;
  // ponavljanje kroz istu test-mehaniku (vrsta='srs', bez kvote); točan -> box+1 i due dalje (1/3/7/14/30 dana), kriv -> box=1.
  await p.query(`ALTER TABLE test_sesije ADD COLUMN IF NOT EXISTS vrsta TEXT NOT NULL DEFAULT 'test';`);
  await p.query(`CREATE TABLE IF NOT EXISTS srs_stavke (
    id SERIAL PRIMARY KEY,
    korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
    pitanje_id INTEGER NOT NULL REFERENCES pitanja(id) ON DELETE CASCADE,
    box SMALLINT NOT NULL DEFAULT 1,
    due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (korisnik_id, pitanje_id));`);
  await p.query(`CREATE INDEX IF NOT EXISTS ix_srs_due ON srs_stavke(korisnik_id, due_at);`);
  // migracija (idempotentno): svaki postojeci clanak bez ijedne verzije dobije
  // prvu verziju; hash per-clanak md5(oznaka\u0001naslov\u0001tekst) — recept 🔒;
  // vrijedi_od pausalno '2026-01-01' (novi ZoG/ZOPU val; tocnije nije jednoznacno).
  {
    const crypto = require('crypto');
    const r = await p.query(`SELECT c.id, c.oznaka, c.naslov, c.tekst FROM clanci c
      LEFT JOIN clanci_verzije v ON v.clanak_id = c.id WHERE v.id IS NULL`);
    for (const c of r.rows) {
      const h = crypto.createHash('md5').update(`${c.oznaka}\u0001${c.naslov}\u0001${c.tekst}`, 'utf8').digest('hex');
      await p.query(`INSERT INTO clanci_verzije (clanak_id, oznaka, naslov, tekst, vrijedi_od, hash)
                     VALUES ($1,$2,$3,$4,'2026-01-01',$5)`, [c.id, c.oznaka, c.naslov, c.tekst, h]);
    }
  }

  await p.query(`CREATE TABLE IF NOT EXISTS pojmovi (
    id SERIAL PRIMARY KEY,
    dokument_id INTEGER REFERENCES dokumenti(id) ON DELETE CASCADE,
    clanak_id INTEGER REFERENCES clanci(id) ON DELETE CASCADE,
    pojam TEXT NOT NULL,
    definicija TEXT NOT NULL DEFAULT '');`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_pojmovi_clanak ON pojmovi(clanak_id);`);

  await p.query(`CREATE TABLE IF NOT EXISTS bookmarki (
    id SERIAL PRIMARY KEY,
    korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
    clanak_id INTEGER NOT NULL REFERENCES clanci(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(korisnik_id, clanak_id));`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_bookmarki_kor ON bookmarki(korisnik_id);`);

  // ⭐ v139 — Batch 5: SIMULACIJA ROKA (pismeni + usmeni = jedan ishod) + PREDMETI (case-file mape).
  // Ocjene su SNAPSHOT (SET NULL na brisanje sesije) da zajednički ishod ostane u povijesti.
  await p.query(`CREATE TABLE IF NOT EXISTS simulacije (
    id SERIAL PRIMARY KEY,
    korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
    test_sesija_id INTEGER REFERENCES test_sesije(id) ON DELETE SET NULL,
    usmeni_sesija_id INTEGER REFERENCES usmeni_sesije(id) ON DELETE SET NULL,
    ocjena_pismeni SMALLINT, ocjena_usmeni SMALLINT,
    prolaz_pismeni BOOLEAN, prolaz_usmeni BOOLEAN, prolaz BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
  await p.query(`CREATE INDEX IF NOT EXISTS ix_sim_kor ON simulacije(korisnik_id, created_at);`);
  await p.query(`CREATE TABLE IF NOT EXISTS predmeti (
    id SERIAL PRIMARY KEY,
    korisnik_id INTEGER NOT NULL REFERENCES korisnici(id) ON DELETE CASCADE,
    naziv TEXT NOT NULL,
    opis TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
  await p.query(`CREATE INDEX IF NOT EXISTS ix_predmeti_kor ON predmeti(korisnik_id, updated_at);`);
  await p.query(`CREATE TABLE IF NOT EXISTS predmet_stavke (
    id SERIAL PRIMARY KEY,
    predmet_id INTEGER NOT NULL REFERENCES predmeti(id) ON DELETE CASCADE,
    tip TEXT NOT NULL DEFAULT 'biljeska',
    naslov TEXT NOT NULL DEFAULT '',
    sadrzaj TEXT NOT NULL DEFAULT '',
    meta JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
  await p.query(`CREATE INDEX IF NOT EXISTS ix_pstavke_pred ON predmet_stavke(predmet_id, created_at);`);

  await p.query(`ALTER TABLE korisnici ADD COLUMN IF NOT EXISTS program_id INTEGER;`);
  await p.query(`ALTER TABLE korisnici ADD COLUMN IF NOT EXISTS uze_podrucje TEXT;`);
  // ⭐ v080 — F19: naplatni/pravni podaci (za Stripe račune i R1). Prazno dok korisnik ne kupi Pro.
  await p.query(`ALTER TABLE korisnici ADD COLUMN IF NOT EXISTS tip_osobe TEXT NOT NULL DEFAULT 'fizicka';`); // 'fizicka' | 'pravna'
  await p.query(`ALTER TABLE korisnici ADD COLUMN IF NOT EXISTS naplatni_naziv TEXT;`);   // ime i prezime / naziv tvrtke
  await p.query(`ALTER TABLE korisnici ADD COLUMN IF NOT EXISTS oib TEXT;`);              // 11 znamenki
  await p.query(`ALTER TABLE korisnici ADD COLUMN IF NOT EXISTS adresa TEXT;`);           // ulica i kbr
  await p.query(`ALTER TABLE korisnici ADD COLUMN IF NOT EXISTS grad TEXT;`);
  await p.query(`ALTER TABLE korisnici ADD COLUMN IF NOT EXISTS posta TEXT;`);            // poštanski broj
  await p.query(`ALTER TABLE korisnici ADD COLUMN IF NOT EXISTS drzava TEXT NOT NULL DEFAULT 'HR';`);
  await p.query(`ALTER TABLE korisnici ADD COLUMN IF NOT EXISTS uvjeti_prihvaceni_at TIMESTAMPTZ;`); // GDPR/uvjeti trag
  // ⭐ v095 — tier istek (kad istekne, korisnik pada na FREE) + povijest promjena tiera
  await p.query(`ALTER TABLE korisnici ADD COLUMN IF NOT EXISTS tier_istek DATE;`); // NULL = bez isteka (trajno dok se ručno ne promijeni)
  await p.query(`CREATE TABLE IF NOT EXISTS tier_promjene (
    id BIGSERIAL PRIMARY KEY,
    korisnik_id INTEGER REFERENCES korisnici(id) ON DELETE CASCADE,
    stari_tier TEXT, novi_tier TEXT NOT NULL,
    istek DATE,
    promijenio_id INTEGER REFERENCES korisnici(id) ON DELETE SET NULL,
    promijenio_ime TEXT,
    napomena TEXT,
    ts TIMESTAMPTZ NOT NULL DEFAULT now());`);
  await p.query(`CREATE INDEX IF NOT EXISTS ix_tier_promjene_kor ON tier_promjene(korisnik_id, ts);`);

  // ⭐ v006 — hardening: indeksi po DIO 8 + NOT NULL dotezanje (idempotentno)
  await p.query(`CREATE INDEX IF NOT EXISTS idx_email_tokeni_korisnik ON email_tokeni(korisnik_id);`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_email_log_korisnik ON email_log(korisnik_id, created_at);`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_korisnici_tier ON korisnici(tier);`);
  await p.query(`ALTER TABLE email_tokeni ALTER COLUMN korisnik_id SET NOT NULL;`);
  await p.query(`ALTER TABLE korisnici ALTER COLUMN created_at SET NOT NULL;`);
  await p.query(`ALTER TABLE email_tokeni ALTER COLUMN created_at SET NOT NULL;`);
  await p.query(`ALTER TABLE email_log ALTER COLUMN created_at SET NOT NULL;`);

  // ⭐ v013 — events: aktivnost korisnika od danas (biblija 03 §8); SET NULL cuva agregat nakon GDPR brisanja
  await p.query(`CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    korisnik_id INTEGER REFERENCES korisnici(id) ON DELETE SET NULL,
    tip TEXT NOT NULL,
    meta JSONB NOT NULL DEFAULT '{}',
    ts TIMESTAMPTZ NOT NULL DEFAULT now());`);
  await p.query(`CREATE INDEX IF NOT EXISTS ix_ev_tip ON events(tip, ts);`);
  await p.query(`CREATE INDEX IF NOT EXISTS ix_ev_kor ON events(korisnik_id, ts);`);

  await p.query(`INSERT INTO sustav_meta (kljuc, vrijednost) VALUES ('shema_verzija', $1)
    ON CONFLICT (kljuc) DO UPDATE SET vrijednost = $1, azurirano = now()`, [VERZIJA]);

  // ⭐ v023 — AI dijagnostika u odgovoru (mobilni debug bez logova)
  let aiStatus = { chunkovi: true };
  try { await p.query('SELECT 1 FROM chunkovi LIMIT 1'); }
  catch (_) { aiStatus = { chunkovi: false, razlog: global.__CHUNKOVI_GRESKA || 'nepoznato' }; }
  try { const rv = await p.query('SELECT version()'); aiStatus.pg = String(rv.rows[0].version).split(' on ')[0]; } catch (_) {}
  return { ok: true, shema_verzija: VERZIJA, faza: FAZA, ai: aiStatus, poruka: `Shema (Faza ${FAZA}) spremna.` };
}

// ── Pomocne: lozinke, tokeni, JWT, korisnici ─────────────────────────
async function hashLozinke(plain) { return bcrypt.hash(plain + PWD_PEPPER, 10); }
async function provjeriLozinku(plain, hash) { return bcrypt.compare(plain + PWD_PEPPER, hash); }
function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function noviToken() { return crypto.randomBytes(32).toString('hex'); }
function jwtPotpis(k) { return jwt.sign({ uid: k.id, ime: k.korisnicko_ime }, JWT_SECRET, { expiresIn: '7d' }); }

function valEmail(e) { return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
// ⭐ v006 — koercija na string + granica duljine (nikad .trim() na ne-stringu)
function s(v, max = 200) { return String(v ?? '').trim().slice(0, max); }
// ⭐ v080 — F19: validacija hrvatskog OIB-a (ISO 7064, MOD 11,10). 11 znamenki, zadnja je kontrolna.
function validanOIB(oib) {
  const o = String(oib || '').trim();
  if (!/^\d{11}$/.test(o)) return false;
  let ost = 10;
  for (let i = 0; i < 10; i++) {
    ost = (ost + Number(o[i])) % 10;
    if (ost === 0) ost = 10;
    ost = (ost * 2) % 11;
  }
  let kontrolni = (11 - ost) % 10;
  return kontrolni === Number(o[10]);
}

// ⭐ v013 — biljezenje aktivnosti (fire-and-forget: nikad ne blokira ni rusi rutu)
function zabiljezi(korisnikId, tip, meta) {
  q(`INSERT INTO events (korisnik_id, tip, meta) VALUES ($1,$2,$3)`,
    [korisnikId || null, s(tip, 40), JSON.stringify(meta || {})]).catch(() => {});
}

// Korisnicko ime iz emaila (+ jedinstvenost)
async function generirajKorisnickoIme(email) {
  let baza = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 20) || 'korisnik';
  let kime = baza, i = 0;
  while (i < 200) { // ⭐ v006 — granica petlje; poslije random sufiks
    const r = await q('SELECT 1 FROM korisnici WHERE korisnicko_ime = $1', [kime]);
    if (r.rowCount === 0) return kime;
    i++; kime = `${baza}${i}`;
  }
  return `${baza.slice(0, 14)}.${crypto.randomBytes(3).toString('hex')}`;
}
// Citljiva privremena lozinka (bez dvosmislenih znakova)
function privremenaLozinka(n = 10) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = ''; const buf = crypto.randomBytes(n);
  for (let i = 0; i < n; i++) s += abc[buf[i] % abc.length];
  return s;
}

// ── Slanje maila (Resend preko fetch; fallback: log) ─────────────────
async function posaljiMail({ to, subject, html, text, korisnik_id, tip }) {
  if (!RESEND_API_KEY) {
    console.log(`[mail:DEV] (${tip}) -> ${to} :: ${subject}`);
    try { await q(`INSERT INTO email_log (korisnik_id, primatelj, tip, status) VALUES ($1,$2,$3,'logged')`, [korisnik_id || null, to, tip]); } catch {}
    return { sent: false, dev: true };
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html, reply_to: RESEND_REPLY_TO, ...(text ? { text } : {}) }),
    });
    const data = await r.json().catch(() => ({}));
    const status = r.ok ? 'sent' : 'error';
    try { await q(`INSERT INTO email_log (korisnik_id, primatelj, tip, status, resend_id) VALUES ($1,$2,$3,$4,$5)`, [korisnik_id || null, to, tip, status, data.id || null]); } catch {}
    if (!r.ok) console.error('[mail] Resend error:', data);
    return { sent: r.ok, id: data.id };
  } catch (e) {
    console.error('[mail] iznimka:', e.message);
    try { await q(`INSERT INTO email_log (korisnik_id, primatelj, tip, status) VALUES ($1,$2,$3,'error')`, [korisnik_id || null, to, tip]); } catch {}
    return { sent: false, error: e.message };
  }
}

// ── Mail predlosci — Norma stil (tablicni layout zbog mail klijenata) ─
// ⭐ v003 — mailOkvir: zaglavlje (OI badge), bijela kartica, gumb, sastavnica
function mailOkvir({ naslov, uvod, sadrzaj, gumbTekst, gumbLink, napomena }) {
  return `<!DOCTYPE html>
<html lang="hr"><body style="margin:0;padding:0;background:#F5F5F1;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F1;"><tr><td align="center" style="padding:34px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
  <tr><td align="center" style="padding:0 0 20px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td width="44" height="44" align="center" valign="middle" style="background:#2B4A75;border-radius:12px;font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:bold;color:#FFFFFF;">OI</td>
      <td style="padding-left:11px;font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#16181B;">OI&nbsp;Ispit</td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#FFFFFF;border:1px solid #E3E4DE;border-radius:16px;padding:30px 28px;">
    <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:24px;line-height:1.25;color:#16181B;">${naslov}</h1>
    <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#5A5E63;">${uvod}</p>
    ${sadrzaj || ''}
    ${gumbTekst && gumbLink ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 2px;"><tr><td style="background:#2B4A75;border-radius:10px;"><a href="${gumbLink}" style="display:inline-block;padding:12px 22px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#FFFFFF;text-decoration:none;">${gumbTekst}</a></td></tr></table>` : ''}
    ${napomena ? `<p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#8C9096;">${napomena}</p>` : ''}
  </td></tr>
  <tr><td align="center" style="padding:18px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:9.5px;letter-spacing:1.5px;color:#8C9096;text-transform:uppercase;">OI Ispit &middot; priprema za stručni ispit &middot; donira&nbsp;<span style="color:#5A5E63;font-weight:bold;">Žbuka Čakarić d.o.o.</span></td></tr>
</table>
</td></tr></table>
</body></html>`;
}
function mailKredencijali({ ime, kime, lozinka }) {
  const sadrzaj = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F1;border:1px solid #E3E4DE;border-radius:10px;">
      <tr><td style="padding:13px 16px 3px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#8C9096;">Korisničko ime</td></tr>
      <tr><td style="padding:0 16px 12px;font-family:'Courier New',Courier,monospace;font-size:16px;font-weight:bold;color:#16181B;">${kime}</td></tr>
      <tr><td style="border-top:1px solid #E3E4DE;padding:12px 16px 3px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#8C9096;">Privremena lozinka</td></tr>
      <tr><td style="padding:0 16px 13px;font-family:'Courier New',Courier,monospace;font-size:16px;font-weight:bold;color:#16181B;">${lozinka}</td></tr>
    </table>`;
  const html = mailOkvir({
    naslov: `Dobrodošli u OI Ispit${ime ? ', ' + ime : ''}`,
    uvod: 'Račun je spreman. Prijavi se s podacima ispod — pri prvoj prijavi postavljaš svoju lozinku.',
    sadrzaj,
    gumbTekst: 'Otvori OI Ispit',
    gumbLink: APP_URL || '',
    napomena: 'Ako nisi ti otvorio račun, slobodno ignoriraj ovaj mail.'
  });
  const text = `Dobrodošli u OI Ispit${ime ? ', ' + ime : ''}\n\nKorisničko ime: ${kime}\nPrivremena lozinka: ${lozinka}\n\nPri prvoj prijavi postavljaš svoju lozinku.${APP_URL ? `\nPrijava: ${APP_URL}` : ''}\n\nOI Ispit · priprema za stručni ispit · donira Žbuka Čakarić d.o.o.`;
  return { html, text };
}
function mailReset({ link }) {
  const html = mailOkvir({
    naslov: 'Promjena lozinke',
    uvod: 'Zatražena je promjena lozinke za tvoj OI Ispit račun. Klikni gumb i postavi novu — link vrijedi 1 sat.',
    sadrzaj: '',
    gumbTekst: 'Postavi novu lozinku',
    gumbLink: link,
    napomena: 'Ako nisi ti zatražio promjenu, ignoriraj ovaj mail — lozinka ostaje ista.'
  });
  const text = `Promjena lozinke — OI Ispit\n\nOtvori link i postavi novu lozinku (vrijedi 1 sat):\n${link}\n\nAko nisi ti zatražio promjenu, ignoriraj ovaj mail.`;
  return { html, text };
}

// ── JWT middleware ───────────────────────────────────────────────────
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return res.status(401).json({ error: 'Nije prijavljen.' });
  try { req.uid = jwt.verify(t, JWT_SECRET).uid; next(); }
  catch { return res.status(401).json({ error: 'Sesija istekla, prijavi se ponovno.' }); }
}
async function ucitajKorisnika(id) {
  const r = await q(`SELECT k.id,k.email,k.korisnicko_ime,k.ime,k.tier,k.tier_istek,k.je_admin,k.mora_promijeniti_lozinku,k.cilj_datum,
      k.program_id, k.uze_podrucje, p.kod AS program_kod, p.naziv AS program_naziv
    FROM korisnici k LEFT JOIN ispitni_programi p ON p.id = k.program_id WHERE k.id=$1`, [id]);
  const k = r.rows[0] || null;
  if (k) {
    k.je_superadmin = !!(SUPERADMIN_EMAIL && k.email && k.email.toLowerCase() === SUPERADMIN_EMAIL); // ⭐ v007
    // ⭐ v095 — efektivni tier: ako je istek prošao, korisnik pada na 'free' (ne diramo bazu ovdje; samo za provjere)
    k.tier_spremljen = k.tier;
    if (k.tier !== 'free' && k.tier_istek) {
      const danas = new Date(); danas.setHours(0, 0, 0, 0);
      const istek = new Date(k.tier_istek); istek.setHours(0, 0, 0, 0);
      if (istek < danas) k.tier = 'free';
    }
  }
  return k;
}

// ⭐ v007 — superadmin gate (bootstrap preko ENV SUPERADMIN_EMAIL; uloga stize u F13)
async function zahtijevajSuperadmin(req, res, next) {
  try {
    const k = await ucitajKorisnika(req.uid);
    if (!k || !k.je_superadmin) return res.status(403).json({ error: 'Samo za administratora.' });
    req.korisnik = k; next();
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// ── Login throttle (in-memory; DB-persistent dolazi u Fazi 19) ───────
const LT = new Map();
function loginThrottle(kljuc) {
  const now = Date.now(), WIN = 15 * 60 * 1000, MAX = 5;
  const rec = LT.get(kljuc) || { n: 0, t: now };
  if (now - rec.t > WIN) { rec.n = 0; rec.t = now; }
  return { blokiran: rec.n >= MAX, rec, zabiljezi: () => { rec.n++; LT.set(kljuc, rec); }, reset: () => LT.delete(kljuc) };
}

// ════════════════════════════════════════════════════════════════════
//  API rute (nove rute UVIJEK iznad catch-all '*')
// ════════════════════════════════════════════════════════════════════

app.get('/api/health', async (req, res) => {
  res.json({ ok: true, app: 'OI Ispit', verzija: VERZIJA, faza: FAZA, dev_mode: DEV_MODE, vrijeme: new Date().toISOString(), baza: await dbStatus() });
});

app.get('/api/init-db', async (req, res) => {
  if (req.query.key !== INIT_KEY) return res.status(403).json({ error: 'Neispravan kljuc.' });
  try { res.json(await initDb()); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Registracija — kreira racun, salje (ili logira) kredencijale
app.post('/api/register', async (req, res) => {
  try {
    // ⭐ v102 — anti-spam: max 5 registracija/15min po IP-u (sprječava masovno kreiranje računa)
    const ipR = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'x';
    const thR = loginThrottle('reg|' + ipR);
    if (thR.blokiran) return res.status(429).json({ error: 'Previše pokušaja registracije. Pričekaj 15 minuta.' });
    thR.zabiljezi();
    const email = s(req.body.email, 120).toLowerCase();
    const ime = s(req.body.ime, 60) || null;
    if (!valEmail(email)) return res.status(400).json({ error: 'Neispravna e-mail adresa.' });
    if (req.body.uvjeti_prihvaceni !== true) return res.status(400).json({ error: 'Za registraciju je potrebno prihvatiti Uvjete korištenja i Politiku privatnosti.' }); // ⭐ v081 — GDPR/uvjeti obavezni
    const tipOsobe = req.body.tip_osobe === 'pravna' ? 'pravna' : 'fizicka'; // ⭐ v081

    // ⭐ v006 — atomaran upis: bez SELECT-pa-INSERT utrke; UNIQUE(email) odlucuje
    const kime = await generirajKorisnickoIme(email);
    const lozinka = privremenaLozinka();
    const hash = await hashLozinke(lozinka);
    const INS = `INSERT INTO korisnici (email, korisnicko_ime, lozinka_hash, ime, tip_osobe, uvjeti_prihvaceni_at, mora_promijeniti_lozinku)
       VALUES ($1,$2,$3,$4,$5,now(),true) RETURNING id`;
    let uid;
    try {
      uid = (await q(INS, [email, kime, hash, ime, tipOsobe])).rows[0].id;
    } catch (e) {
      const dup = e.code === '23505' || /duplicate key|unique/i.test(e.message || '');
      const naKime = /korisnicko_ime/i.test(String(e.constraint || '') + (e.detail || '') + (e.message || ''));
      if (dup && naKime) {
        const kime2 = `${kime.slice(0, 14)}.${crypto.randomBytes(3).toString('hex')}`;
        try { uid = (await q(INS, [email, kime2, hash, ime, tipOsobe])).rows[0].id; }
        catch (e2) {
          if (e2.code === '23505' || /duplicate key|unique/i.test(e2.message || ''))
            return res.status(409).json({ error: 'Račun s ovom e-mail adresom već postoji.' });
          throw e2;
        }
      } else if (dup) {
        return res.status(409).json({ error: 'Račun s ovom e-mail adresom već postoji.' });
      } else throw e;
    }

    const m = mailKredencijali({ ime, kime, lozinka }); // ⭐ v003
    const mail = await posaljiMail({ to: email, subject: 'OI Ispit — pristupni podaci', html: m.html, text: m.text, korisnik_id: uid, tip: 'kredencijali' });
    zabiljezi(uid, 'registracija', {}); // ⭐ v013

    const odg = { ok: true, poruka: DEV_MODE ? 'Račun kreiran (DEV: kredencijali u odgovoru).' : 'Račun kreiran. Provjeri e-mail za pristupne podatke.' };
    if (DEV_MODE) odg.dev = { korisnicko_ime: kime, privremena_lozinka: lozinka, mail };
    res.json(odg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Prijava
app.post('/api/login', async (req, res) => {
  try {
    const ident = s(req.body.identifikator ?? req.body.email, 120).toLowerCase();
    const lozinka = String(req.body.lozinka ?? '').slice(0, 200);
    if (!ident || !lozinka) return res.status(400).json({ error: 'Unesi e-mail/korisničko ime i lozinku.' });

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'x';
    const th = loginThrottle(ip + '|' + ident);
    if (th.blokiran) return res.status(429).json({ error: 'Previše pokušaja. Pričekaj 15 minuta.' });

    const r = await q(`SELECT * FROM korisnici WHERE email=$1 OR korisnicko_ime=$1`, [ident]);
    const k = r.rows[0];
    const ok = k ? await provjeriLozinku(lozinka, k.lozinka_hash) : false;
    if (!ok) { th.zabiljezi(); return res.status(401).json({ error: 'Pogrešno korisničko ime ili lozinka.' }); }

    th.reset();
    await q('UPDATE korisnici SET zadnja_prijava=now() WHERE id=$1', [k.id]);
    const token = jwtPotpis(k);
    zabiljezi(k.id, 'login', {}); // ⭐ v013
    // ⭐ v128 — BUGFIX: login je vraćao krnji korisnik objekt (bez je_superadmin/program/cilj) → nakon SVJEŽE prijave
    // admin sučelje se nije prikazivalo (reload bi ga popravio jer /api/me vraća pun objekt). Sad login vraća PUN objekt.
    const kpun = await ucitajKorisnika(k.id);
    res.json({ ok: true, token, mora_promijeniti_lozinku: k.mora_promijeniti_lozinku, korisnik: kpun || {
      id: k.id, korisnicko_ime: k.korisnicko_ime, ime: k.ime, email: k.email, tier: k.tier, je_admin: k.je_admin } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Tko sam
app.get('/api/me', auth, async (req, res) => {
  try { const k = await ucitajKorisnika(req.uid); if (!k) return res.status(404).json({ error: 'Korisnik ne postoji.' }); res.json({ ok: true, korisnik: k }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Promjena lozinke (prisilna pri prvoj prijavi: bez stare; inace: stara obavezna)
app.post('/api/lozinka/promijeni', auth, async (req, res) => {
  try {
    const nova = String(req.body.nova ?? '').slice(0, 200); // ⭐ v006 — koercija
    if (nova.length < 8) return res.status(400).json({ error: 'Lozinka mora imati barem 8 znakova.' });
    const r = await q('SELECT * FROM korisnici WHERE id=$1', [req.uid]);
    const k = r.rows[0]; if (!k) return res.status(404).json({ error: 'Korisnik ne postoji.' });
    if (!k.mora_promijeniti_lozinku) {
      const stara = String(req.body.stara ?? '').slice(0, 200); // ⭐ v006
      if (!(await provjeriLozinku(stara, k.lozinka_hash))) return res.status(401).json({ error: 'Stara lozinka nije točna.' });
    }
    await q('UPDATE korisnici SET lozinka_hash=$1, mora_promijeniti_lozinku=false, email_potvrden=true WHERE id=$2', [await hashLozinke(nova), k.id]);
    res.json({ ok: true, poruka: 'Lozinka promijenjena.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Zaboravljena lozinka -> salje reset link (uvijek ok, ne otkriva postoji li mail)
app.post('/api/lozinka/zaboravljena', async (req, res) => {
  try {
    const email = s(req.body.email, 120).toLowerCase(); // ⭐ v006 — koercija
    const odg = { ok: true, poruka: 'Ako račun postoji, poslan je link za promjenu lozinke.' };
    // ⭐ v102 — anti-spam: max 5 zahtjeva/15min po IP-u (sprječava bombardiranje mailom)
    const ipZ = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'x';
    const thZ = loginThrottle('zab|' + ipZ);
    if (thZ.blokiran) return res.json(odg); // tiho (ne otkrivaj throttle)
    thZ.zabiljezi();
    if (!valEmail(email)) return res.json(odg);
    const r = await q('SELECT id FROM korisnici WHERE email=$1', [email]);
    const k = r.rows[0];
    if (k) {
      const token = noviToken();
      await q(`INSERT INTO email_tokeni (korisnik_id, tip, token_hash, istek) VALUES ($1,'reset',$2, now() + interval '1 hour')`, [k.id, sha256(token)]);
      const base = APP_URL || (req.headers.origin || '');
      const link = `${base}/reset?token=${token}`;
      const m = mailReset({ link }); // ⭐ v003
      const mail = await posaljiMail({ to: email, subject: 'OI Ispit — promjena lozinke', html: m.html, text: m.text, korisnik_id: k.id, tip: 'reset' });
      if (DEV_MODE) odg.dev = { reset_link: link, token, mail };
    }
    res.json(odg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Reset lozinke tokenom
app.post('/api/lozinka/reset', async (req, res) => {
  try {
    const token = s(req.body.token, 200); // ⭐ v006 — koercija
    const nova = String(req.body.nova ?? '').slice(0, 200);
    if (nova.length < 8) return res.status(400).json({ error: 'Lozinka mora imati barem 8 znakova.' });
    // ⭐ v006 — atomarno trosenje tokena (rowCount odlucuje) + promjena lozinke u ISTOJ transakciji
    const hash = await hashLozinke(nova);
    const ok = await withTx(async (c) => {
      const t = await c.query(
        `UPDATE email_tokeni SET iskoristen=true
          WHERE token_hash=$1 AND tip='reset' AND iskoristen=false AND istek > now()
          RETURNING korisnik_id`, [sha256(token)]);
      if (t.rowCount === 0) return false;
      await c.query('UPDATE korisnici SET lozinka_hash=$1, mora_promijeniti_lozinku=false, email_potvrden=true WHERE id=$2',
        [hash, t.rows[0].korisnik_id]);
      return true;
    });
    if (!ok) return res.status(400).json({ error: 'Link je neispravan ili je istekao.' });
    res.json({ ok: true, poruka: 'Lozinka postavljena. Možeš se prijaviti.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v004 — Faza 2: profil (onboarding) — ime i cilj_datum (datum ispita)
app.post('/api/profil', auth, async (req, res) => {
  try {
    const k0 = await ucitajKorisnika(req.uid);
    if (!k0) return res.status(404).json({ error: 'Korisnik ne postoji.' });
    let ime = k0.ime, cilj = k0.cilj_datum;
    if ('ime' in req.body) {
      ime = s(req.body.ime, 60) || null; // ⭐ v006 — koercija
    }
    if ('cilj_datum' in req.body) {
      const v = s(req.body.cilj_datum, 10);
      if (v === '') cilj = null;
      else if (/^\d{4}-\d{2}-\d{2}$/.test(v)) cilj = v;
      else return res.status(400).json({ error: 'Datum mora biti u formatu GGGG-MM-DD.' });
    }
    // ⭐ v007 — odabir ispitnog programa (strukovno podrucje) i uzeg podrucja
    let programId = k0.program_id, uze = k0.uze_podrucje;
    if ('program_kod' in req.body) {
      const kod = s(req.body.program_kod, 40).toUpperCase(); // ⭐ v006 — koercija
      if (kod === '') { programId = null; uze = null; }
      else {
        const rp = await q('SELECT id FROM ispitni_programi WHERE kod=$1', [kod]);
        if (rp.rowCount === 0) return res.status(400).json({ error: 'Nepoznat ispitni program.' });
        if (rp.rows[0].id !== programId) uze = null; // promjena programa resetira uze podrucje
        programId = rp.rows[0].id;
      }
    }
    if ('uze_podrucje' in req.body) {
      uze = s(req.body.uze_podrucje, 120) || null; // ⭐ v006 — koercija
    }
    await q('UPDATE korisnici SET ime=$1, cilj_datum=$2, program_id=$3, uze_podrucje=$4 WHERE id=$5',
      [ime, cilj, programId, uze, req.uid]);
    res.json({ ok: true, korisnik: await ucitajKorisnika(req.uid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v080 — F19: naplatni/pravni podaci (za Stripe račune i R1). Poziva se pri kupnji Pro-a ili iz profila.
app.get('/api/naplatni-podaci', auth, async (req, res) => {
  try {
    const r = await q(`SELECT tip_osobe, naplatni_naziv, oib, adresa, grad, posta, drzava, uvjeti_prihvaceni_at
      FROM korisnici WHERE id=$1`, [req.uid]);
    if (!r.rowCount) return res.status(404).json({ error: 'Korisnik ne postoji.' });
    res.json({ ok: true, podaci: r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/naplatni-podaci', auth, async (req, res) => {
  try {
    const b = req.body || {};
    const tip = b.tip_osobe === 'pravna' ? 'pravna' : 'fizicka';
    const naziv = s(b.naplatni_naziv, 140);
    const oib = s(b.oib, 11);
    const adresa = s(b.adresa, 140);
    const grad = s(b.grad, 80);
    const posta = s(b.posta, 10);
    const drzava = s(b.drzava, 2).toUpperCase() || 'HR';
    // Validacije (za HR OIB obavezan i točan; za druge države preskačemo OIB provjeru)
    if (!naziv) return res.status(400).json({ error: tip === 'pravna' ? 'Upiši naziv tvrtke.' : 'Upiši ime i prezime.' });
    if (drzava === 'HR') {
      if (!oib) return res.status(400).json({ error: 'OIB je obavezan.' });
      if (!validanOIB(oib)) return res.status(400).json({ error: 'OIB nije ispravan (mora imati 11 znamenki i točnu kontrolnu znamenku).' });
    }
    if (!adresa) return res.status(400).json({ error: 'Upiši adresu.' });
    if (!grad) return res.status(400).json({ error: 'Upiši grad.' });
    // Prihvat uvjeta: zabilježi trenutak prvi put (GDPR trag), ne gazi postojeći
    const uvjeti = b.uvjeti_prihvaceni === true;
    await q(`UPDATE korisnici SET tip_osobe=$1, naplatni_naziv=$2, oib=$3, adresa=$4, grad=$5, posta=$6, drzava=$7,
      uvjeti_prihvaceni_at = CASE WHEN $8 AND uvjeti_prihvaceni_at IS NULL THEN now() ELSE uvjeti_prihvaceni_at END
      WHERE id=$9`, [tip, naziv, oib || null, adresa, grad, posta || null, drzava, uvjeti, req.uid]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v089 — DOCX izvoz dopisa: prima tekst dopisa, generira lijep Word s podacima korisnika iz profila
app.post('/api/dopis/docx', auth, async (req, res) => {
  try {
    const tekst = String((req.body || {}).tekst || '').trim();
    if (!tekst) return res.status(400).json({ error: 'Nema teksta dopisa.' });
    if (tekst.length > 20000) return res.status(400).json({ error: 'Dopis je predugačak.' });
    const k = await ucitajKorisnika(req.uid);
    if (!k) return res.status(404).json({ error: 'Korisnik ne postoji.' });
    // naplatni podaci iz profila (za header)
    const np = await q(`SELECT tip_osobe, naplatni_naziv, oib, adresa, grad, posta FROM korisnici WHERE id=$1`, [req.uid]);
    const korisnik = { ...(np.rows[0] || {}), ime: k.ime, email: k.email };
    const ur_broj = String((req.body || {}).ur_broj || '').slice(0, 40) || null;
    const buf = await generirajDopisDocx({ tekst, korisnik, ur_broj });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="dopis.docx"');
    res.setHeader('Content-Length', buf.length);
    res.end(buf); // ⭐ v090 — end (ne send) za Buffer: bez Express transformacija/etag
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v137 — PDF izvoz dopisa (uz DOCX). Ista logika/header podaci; pdfkit + font lazy (nedostatak ne ruši app).
app.post('/api/dopis/pdf', auth, async (req, res) => {
  try {
    const tekst = String((req.body || {}).tekst || '').trim();
    if (!tekst) return res.status(400).json({ error: 'Nema teksta dopisa.' });
    if (tekst.length > 20000) return res.status(400).json({ error: 'Dopis je predugačak.' });
    const k = await ucitajKorisnika(req.uid);
    if (!k) return res.status(404).json({ error: 'Korisnik ne postoji.' });
    const np = await q(`SELECT tip_osobe, naplatni_naziv, oib, adresa, grad, posta FROM korisnici WHERE id=$1`, [req.uid]);
    const korisnik = { ...(np.rows[0] || {}), ime: k.ime, email: k.email };
    const ur_broj = String((req.body || {}).ur_broj || '').slice(0, 40) || null;
    const buf = await generirajDopisPdf({ tekst, korisnik, ur_broj });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="dopis.pdf"');
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v083 — TRAJNO brisanje računa (GDPR pravo na zaborav). Potvrda: točan upis imena/emaila.
// CASCADE briše ai_razgovori(+poruke), usmeni_sesije(+poruke), test_sesije, srs_stavke, bookmarki, email_tokeni.
// email_log (bez FK) i clanak_pomoc/events (SET NULL) čistimo/odspajamo eksplicitno. Nepovratno.
app.delete('/api/racun', auth, async (req, res) => {
  try {
    const k = await ucitajKorisnika(req.uid);
    if (!k) return res.status(404).json({ error: 'Korisnik ne postoji.' });
    const potvrda = String((req.body || {}).potvrda || '').trim().toLowerCase();
    // Prihvati potvrdu ako se poklapa s imenom (ako postoji) ILI s e-mailom (uvijek dostupan fallback)
    const ime = String(k.ime || '').trim().toLowerCase();
    const email = String(k.email || '').trim().toLowerCase();
    const ok = (ime && potvrda === ime) || (potvrda === email);
    if (!ok) return res.status(400).json({ error: 'Potvrda ne odgovara. Upiši točno svoje ime i prezime (ili e-mail) da potvrdiš trajno brisanje.' });
    // Brisanje u transakciji (sve ili ništa)
    const p = getPool(); if (!p) throw new Error('Baza nije dostupna.');
    const client = await p.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM email_log WHERE korisnik_id=$1`, [req.uid]);           // bez FK — ručno
      await client.query(`UPDATE clanak_pomoc SET korisnik_id=NULL WHERE korisnik_id=$1`, [req.uid]); // dijeljeni keš — odspoji
      await client.query(`DELETE FROM korisnici WHERE id=$1`, [req.uid]);                     // CASCADE ostalo
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
    res.json({ ok: true, poruka: 'Račun i svi podaci su trajno obrisani.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Popis strukovnih podrucja + programa (za onboarding)
app.get('/api/programi', auth, async (req, res) => {
  try {
    const r = await q(`SELECT p.id, p.kod, p.naziv, p.vrsta_poslova, p.sprema, s.kod AS strukovno_kod, s.naziv AS strukovno_naziv
      FROM ispitni_programi p JOIN strukovna_podrucja s ON s.id = p.strukovno_id
      ORDER BY s.redoslijed, p.kod LIMIT 100`);
    res.json({ ok: true, programi: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Superadmin: uvoz sifrarnika regulative (JSON iz parsera ministarskih popisa)
app.post('/api/admin/uvoz/sifrarnik', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const { programi, dokumenti, mapiranja, meta } = req.body || {};
    if (!Array.isArray(programi) || !Array.isArray(dokumenti) || !Array.isArray(mapiranja))
      return res.status(400).json({ error: 'Očekujem { programi, dokumenti, mapiranja }.' });
    if (dokumenti.length > 2000 || mapiranja.length > 10000)
      return res.status(400).json({ error: 'Prevelik uvoz.' });
    const NAZIVI_SP = { 'građevinarstvo': 'Građevinarstvo', 'arhitektura': 'Arhitektura', 'elektrotehnika': 'Elektrotehnika', 'strojarstvo': 'Strojarstvo' };
    const rez = await withTx(async (c) => {
      const spId = {}, progId = {}, dokId = {};
      let red = 0;
      for (const p of programi) {
        const spKod = String(p.strukovno || '').toLowerCase();
        if (!spId[spKod]) {
          const rs = await c.query(
            `INSERT INTO strukovna_podrucja (kod, naziv, redoslijed) VALUES ($1,$2,$3)
             ON CONFLICT (kod) DO UPDATE SET naziv=EXCLUDED.naziv RETURNING id`,
            [spKod, NAZIVI_SP[spKod] || p.strukovno, ++red]);
          spId[spKod] = rs.rows[0].id;
        }
        const naziv = `${NAZIVI_SP[spKod] || p.strukovno} — ${p.vrsta_poslova} (${p.sprema})`;
        const rp = await c.query(
          `INSERT INTO ispitni_programi (kod, strukovno_id, vrsta_poslova, sprema, naziv, verzija_popisa)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (kod) DO UPDATE SET vrsta_poslova=EXCLUDED.vrsta_poslova, sprema=EXCLUDED.sprema,
             naziv=EXCLUDED.naziv, verzija_popisa=EXCLUDED.verzija_popisa RETURNING id`,
          [p.id, spId[spKod], p.vrsta_poslova || '', p.sprema || 'VSS', naziv, (meta && meta.verzija_popisa) || '']);
        progId[p.id] = rp.rows[0].id;
      }
      for (const d of dokumenti) {
        const rd = await c.query(
          `INSERT INTO dokumenti (naziv, vrsta, izvor, priznato_pravilo)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (naziv) DO UPDATE SET vrsta=EXCLUDED.vrsta, izvor=EXCLUDED.izvor, priznato_pravilo=EXCLUDED.priznato_pravilo
           RETURNING id`,
          [d.naziv, d.vrsta || 'zakon', d.izvor || '', !!d.priznato_pravilo]);
        dokId[d.id] = rd.rows[0].id;
      }
      // idempotentno: mapiranja uvezenih programa brisemo pa upisujemo ispocetka
      const idsProg = Object.values(progId);
      for (const pid of idsProg) await c.query('DELETE FROM program_dokumenti WHERE program_id=$1', [pid]); // ⭐ v007 — portabilno
      let n = 0;
      for (const m of mapiranja) {
        if (!progId[m.program] || !dokId[m.dokument_id]) continue;
        await c.query(
          `INSERT INTO program_dokumenti (program_id, dokument_id, sekcija_put, uze_podrucje, redni, izvor_naveden, obuhvat, priznato)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [progId[m.program], dokId[m.dokument_id], m.put || '', m.uze || null, m.redni || 0, m.izvor_naveden || '', m.napomena || '', !!m.priznato]);
        n++;
      }
      return { programa: idsProg.length, dokumenata: Object.keys(dokId).length, mapiranja: n };
    });
    res.json({ ok: true, ...rez });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Superadmin: uvoz clanaka jednog propisa (kanonski format; zamjenjuje postojece)
app.post('/api/admin/uvoz/clanci', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const { dokument_id, dokument_naziv, clanci, nn_izvor, vrsta, priznato_pravilo } = req.body || {};
    if (!Array.isArray(clanci) || clanci.length === 0) return res.status(400).json({ error: 'Očekujem polje clanci.' });
    if (clanci.length > 3000) return res.status(400).json({ error: 'Previše članaka u jednom uvozu.' });
    const rez = await withTx(async (c) => {
      let dokId = parseInt(dokument_id, 10) || null;
      if (!dokId && dokument_naziv) {
        const rd = await c.query('SELECT id FROM dokumenti WHERE naziv=$1', [String(dokument_naziv)]);
        if (rd.rowCount === 0) {
          // ⭐ v104 — auto-kreiraj dokument ako ne postoji (npr. tehnicki_uvjet/normativ koji nije u ispitnom programu).
          // Time TU/normativi idu izravno pod "Članci", bez zasebnog šifrarnik-koraka. Vrsta iz JSON-a (default 'zakon').
          const rc = await c.query(
            `INSERT INTO dokumenti (naziv, vrsta, izvor, priznato_pravilo) VALUES ($1,$2,$3,$4) RETURNING id`,
            [String(dokument_naziv), String(vrsta || 'zakon'), String(nn_izvor || ''), !!priznato_pravilo]);
          dokId = rc.rows[0].id;
        } else {
          dokId = rd.rows[0].id;
          // ako je JSON donio vrstu/priznato, osvježi (idempotentno)
          if (vrsta) await c.query(`UPDATE dokumenti SET vrsta=$2, priznato_pravilo=$3 WHERE id=$1`,
            [dokId, String(vrsta), !!priznato_pravilo]);
        }
      }
      if (!dokId) throw new Error('Nedostaje dokument_id ili dokument_naziv.');
      const crypto = require('crypto');
      const h1 = (o) => crypto.createHash('md5').update(`${o.oznaka}\u0001${o.naslov}\u0001${o.tekst}`, 'utf8').digest('hex');
      const norm = (cl, idx) => ({ redoslijed: cl.redoslijed || idx + 1,
        oznaka: String(cl.oznaka || '').slice(0, 120),   // ⭐ v121 — 60→120 (DB je TEXT; VOB/GUP oznake s pravilom/dijelom dulje). Identitet je oznaka pa rezanje ne smije spajati različite.
        naslov: String(cl.naslov || '').slice(0, 300),
        tekst: String(cl.tekst || '') });
      const ulaz = clanci.map(norm);
      const izvor = String(nn_izvor || '').slice(0, 120);
      const danas = new Date().toISOString().slice(0, 10);

      const rPost = await c.query(
        `SELECT id, oznaka, naslov, tekst, status FROM clanci WHERE dokument_id=$1 ORDER BY redoslijed`, [dokId]);
      const prije = rPost.rowCount;

      // ⭐ v011 prečac ostaje: identičan CIJELI dokument → ništa (čuva bookmarke, ne troši verzije)
      const hashDoc = (arr) => crypto.createHash('md5')
        .update(arr.map(x => `${x.oznaka}\u0001${x.naslov}\u0001${x.tekst}`).join('\u0002'), 'utf8').digest('hex');
      if (prije > 0 && hashDoc(rPost.rows) === hashDoc(ulaz)) {
        return { dokument_id: dokId, status: 'identicno', clanaka: prije };
      }

      // ⭐ v018 — F4 UPSERT-PO-OZNACI (03 §2): identitet = oznaka unutar dokumenta;
      // duplikatne oznake (novele-prijelazni "Članak 3." ×2) → ključ oznaka#rbrPojave.
      const kljucevi = (arr) => {
        const br = {}; return arr.map(x => { br[x.oznaka] = (br[x.oznaka] || 0) + 1;
          return br[x.oznaka] > 1 ? `${x.oznaka}#${br[x.oznaka]}` : x.oznaka; });
      };
      const stariK = kljucevi(rPost.rows), noviK = kljucevi(ulaz);
      const stariPo = new Map(rPost.rows.map((r, i) => [stariK[i], r]));
      const diff = { novi: [], izmijenjeni: [], brisani: [], isti: 0, reaktivirani: [] };

      for (let i = 0; i < ulaz.length; i++) {
        const u = ulaz[i], k = noviK[i], s = stariPo.get(k);
        if (!s) {                                              // NOVI: INSERT + prva verzija
          const ri = await c.query(
            `INSERT INTO clanci (dokument_id, redoslijed, oznaka, naslov, tekst, status, dirty)
             VALUES ($1,$2,$3,$4,$5,'aktivan',true) RETURNING id`,
            [dokId, u.redoslijed, u.oznaka, u.naslov, u.tekst]);
          await c.query(`INSERT INTO clanci_verzije (clanak_id, oznaka, naslov, tekst, vrijedi_od, nn_izvor, hash)
                         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [ri.rows[0].id, u.oznaka, u.naslov, u.tekst, danas, izvor, h1(u)]);
          diff.novi.push(u.oznaka);
          continue;
        }
        stariPo.delete(k);
        const isti = s.oznaka === u.oznaka && s.naslov === u.naslov && s.tekst === u.tekst;
        if (isti && s.status === 'aktivan') {
          diff.isti++;
          await c.query(`UPDATE clanci SET redoslijed=$1 WHERE id=$2`, [u.redoslijed, s.id]);
          continue;
        }
        if (isti && s.status !== 'aktivan') {                  // REAKTIVIRAN istim tekstom
          await c.query(`UPDATE clanci SET status='aktivan', dirty=true, redoslijed=$1 WHERE id=$2`, [u.redoslijed, s.id]);
          await c.query(`UPDATE clanci_verzije SET vrijedi_do=NULL WHERE clanak_id=$1 AND vrijedi_do IS NOT NULL
                         AND id=(SELECT MAX(id) FROM clanci_verzije WHERE clanak_id=$1)`, [s.id]);
          diff.reaktivirani.push(u.oznaka);
          continue;
        }
        // IZMIJENJEN: zatvori aktualnu verziju + nova verzija + UPDATE clanci + dirty (bookmark ŽIVI: isti id 🔒)
        await c.query(`UPDATE clanci_verzije SET vrijedi_do=$1 WHERE clanak_id=$2 AND vrijedi_do IS NULL`, [danas, s.id]);
        await c.query(`INSERT INTO clanci_verzije (clanak_id, oznaka, naslov, tekst, vrijedi_od, nn_izvor, hash)
                       VALUES ($1,$2,$3,$4,$5,$6,$7)`, [s.id, u.oznaka, u.naslov, u.tekst, danas, izvor, h1(u)]);
        await c.query(`UPDATE clanci SET oznaka=$1, naslov=$2, tekst=$3, redoslijed=$4, status='aktivan', dirty=true WHERE id=$5`,
          [u.oznaka, u.naslov, u.tekst, u.redoslijed, s.id]);
        diff.izmijenjeni.push(u.oznaka);
      }
      // NESTALI: status='brisan', tekst OSTAJE (traka u čitaču), verzija se zatvara; bookmarki/citati žive 🔒
      let rep = ulaz.length;
      for (const [, s] of stariPo) {
        if (s.status !== 'brisan') {
          await c.query(`UPDATE clanci SET status='brisan', dirty=true, redoslijed=$1 WHERE id=$2`, [++rep, s.id]);
          await c.query(`UPDATE clanci_verzije SET vrijedi_do=$1 WHERE clanak_id=$2 AND vrijedi_do IS NULL`, [danas, s.id]);
          diff.brisani.push(s.oznaka);
        } else {
          await c.query(`UPDATE clanci SET redoslijed=$1 WHERE id=$2`, [++rep, s.id]);
        }
      }
      const meta = JSON.stringify({ datum: danas, nn_izvor: izvor, novi: diff.novi.slice(0, 200),
        izmijenjeni: diff.izmijenjeni.slice(0, 200), brisani: diff.brisani.slice(0, 200),
        isti: diff.isti, reaktivirani: diff.reaktivirani.slice(0, 50) });
      await c.query(`INSERT INTO sustav_meta (kljuc, vrijednost) VALUES ($1,$2)
                     ON CONFLICT (kljuc) DO UPDATE SET vrijednost=$2, azurirano=now()`,
        [`novela_diff_${dokId}`, meta]);
      return { dokument_id: dokId, status: prije > 0 ? 'upsert' : 'novo', clanaka: ulaz.length,
               novi: diff.novi.length, izmijenjeni: diff.izmijenjeni.length,
               brisani: diff.brisani.length, isti: diff.isti, reaktivirani: diff.reaktivirani.length };
    });
    res.json({ ok: true, ...rez });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v018 — F4: diff zadnjeg uvoza (hrani "što donosi novela")
app.get('/api/admin/novela-diff/:dokument_id', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const dokId = parseInt(req.params.dokument_id, 10);
    if (!dokId) return res.status(400).json({ error: 'Neispravan dokument_id.' });
    const r = await q(`SELECT vrijednost FROM sustav_meta WHERE kljuc=$1`, [`novela_diff_${dokId}`]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Nema zabilježenog diffa za ovaj dokument.' });
    res.json({ ok: true, diff: JSON.parse(r.rows[0].vrijednost) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v073 — čitljivi sažetak izmjena za Novosti (superadmin upisuje, kandidati čitaju).
// App detektira ŠTO se promijenilo (novela_diff_); ovdje se sprema ljudski opis KAKO/ZAŠTO.
app.post('/api/admin/novela-sazetak/:dokument_id', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const dokId = parseInt(req.params.dokument_id, 10);
    if (!dokId) return res.status(400).json({ error: 'Neispravan dokument_id.' });
    const sazetak = String((req.body || {}).sazetak || '').trim().slice(0, 4000);
    if (!sazetak) {                                          // prazan => briši postojeći
      await q(`DELETE FROM sustav_meta WHERE kljuc=$1`, [`novela_sazetak_${dokId}`]);
      return res.json({ ok: true, obrisano: true });
    }
    await q(`INSERT INTO sustav_meta (kljuc, vrijednost) VALUES ($1,$2)
             ON CONFLICT (kljuc) DO UPDATE SET vrijednost=$2, azurirano=now()`,
      [`novela_sazetak_${dokId}`, sazetak]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v011 — pregled uvezenog gradiva za admin progress (superadmin)
app.get('/api/admin/uvoz/status', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const ru = await q(`SELECT COUNT(*)::int AS n FROM dokumenti WHERE status='aktivno'`);
    const rd = await q(
      `SELECT d.naziv, COUNT(c.id)::int AS clanaka
       FROM clanci c JOIN dokumenti d ON d.id = c.dokument_id
       GROUP BY d.naziv ORDER BY d.naziv LIMIT 500`);
    const ukupnoClanaka = rd.rows.reduce((s, x) => s + x.clanaka, 0);
    res.json({ ok: true, dokumenata_ukupno: ru.rows[0].n,
               uvezeno: rd.rows.length, clanaka: ukupnoClanaka, popis: rd.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v017 — neuvezeni dokumenti (0 clanaka) s programima — pregled + kopiranje popisa
// (pg-mem safe: GROUP BY pomocni upiti + Map/Set spajanje, bez ANY() i koreliranih subquerija)
app.get('/api/admin/uvoz/neuvezeni', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const rd = await q(`SELECT id, naziv, vrsta, izvor, priznato_pravilo FROM dokumenti
                        WHERE status='aktivno' ORDER BY vrsta, naziv LIMIT 1000`);
    const rbc = await q(`SELECT dokument_id, COUNT(*)::int AS br FROM clanci GROUP BY dokument_id`);
    const ima = new Set(rbc.rows.filter(x => x.br > 0).map(x => x.dokument_id));
    const rpd = await q(`SELECT pd.dokument_id, p.kod FROM program_dokumenti pd
                         JOIN ispitni_programi p ON p.id = pd.program_id`);
    const prog = new Map();
    for (const x of rpd.rows) {
      if (!prog.has(x.dokument_id)) prog.set(x.dokument_id, new Set());
      prog.get(x.dokument_id).add(x.kod);
    }
    const popis = rd.rows.filter(d => !ima.has(d.id)).map(d => ({
      naziv: d.naziv, vrsta: d.vrsta, izvor: d.izvor,
      programi: [...(prog.get(d.id) || [])].sort(),
      // HRN norme i priznata pravila se NE parsiraju (pravna granica) — oznaka da lista ne zavarava
      ne_parsira_se: d.vrsta === 'norma' || d.priznato_pravilo === true,
    }));
    res.json({ ok: true, ukupno_aktivnih: rd.rows.length,
               uvezeno: rd.rows.length - popis.length, neuvezeno: popis.length, popis });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v013 — superadmin dashboard: KPI + korisnici + aktivnost (pg-mem safe: bez SQL
// interval aritmetike — granica 7 dana kao JS parametar; bez koreliranih subquerija)
// ⭐ v094 — TTS potrošnja (Google Cloud): ukupno + po korisniku za tekući mjesec.
// Cijena po glasu: Chirp3-HD 30$/1M, WaveNet 4$/1M (ENV TTS_CIJENA_MILIJUN, def 30). 1M besplatno/mj.
const TTS_CIJENA_MILIJUN = () => parseFloat(process.env.TTS_CIJENA_MILIJUN || '30');
const TTS_BESPLATNO = () => parseFloat(process.env.TTS_BESPLATNO || '1000000');
app.get('/api/admin/tts-potrosnja', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const odMjeseca = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    // dohvati sve TTS događaje ovaj mjesec (meta.znakova); agregacija u JS-u (pg-mem safe)
    const ev = await q(`SELECT e.korisnik_id, e.meta, k.ime, k.email, k.korisnicko_ime
      FROM events e LEFT JOIN korisnici k ON k.id=e.korisnik_id
      WHERE e.tip='tts' AND e.ts >= $1`, [odMjeseca]);
    const poKorisniku = new Map();
    let ukupnoZnakova = 0, ukupnoPoziva = 0;
    for (const row of ev.rows) {
      let zn = 0; try { const m = typeof row.meta === 'string' ? JSON.parse(row.meta) : (row.meta || {}); zn = Number(m.znakova) || 0; } catch (_) {}
      ukupnoZnakova += zn; ukupnoPoziva++;
      const kid = row.korisnik_id || 0;
      const rec = poKorisniku.get(kid) || { korisnik_id: kid, ime: row.ime || '—', email: row.email || '', korisnicko_ime: row.korisnicko_ime || '', znakova: 0, poziva: 0 };
      rec.znakova += zn; rec.poziva++;
      poKorisniku.set(kid, rec);
    }
    const cijena = TTS_CIJENA_MILIJUN(), besplatno = TTS_BESPLATNO();
    const naplativo = Math.max(0, ukupnoZnakova - besplatno);
    const trosakUsd = (naplativo / 1e6) * cijena;
    const lista = [...poKorisniku.values()].sort((a, b) => b.znakova - a.znakova)
      .map(r => ({ ...r, trosak_udio_usd: +((r.znakova / 1e6) * cijena).toFixed(4) })); // udio (bez besplatnog praga, za relativni doprinos)
    res.json({
      ok: true,
      mjesec: odMjeseca.slice(0, 7),
      ukupno: { znakova: ukupnoZnakova, poziva: ukupnoPoziva, korisnika: poKorisniku.size,
        besplatno_prag: besplatno, naplativo_znakova: naplativo, cijena_milijun: cijena, trosak_usd: +trosakUsd.toFixed(2) },
      po_korisniku: lista,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v095 — superadmin: dodijeli tier korisniku (FREE/BASIC/PRO) s opcijskim istekom + zapisom u povijest
const TIEROVI = ['free', 'basic', 'pro'];
app.patch('/api/admin/korisnik/:id/tier', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const kid = parseInt(req.params.id, 10);
    if (!kid) return res.status(400).json({ error: 'Neispravan korisnik.' });
    const noviTier = String((req.body || {}).tier || '').toLowerCase();
    if (!TIEROVI.includes(noviTier)) return res.status(400).json({ error: 'Tier mora biti free, basic ili pro.' });
    let istek = (req.body || {}).istek ? String((req.body || {}).istek).slice(0, 10) : null; // YYYY-MM-DD ili null
    if (istek && !/^\d{4}-\d{2}-\d{2}$/.test(istek)) return res.status(400).json({ error: 'Datum isteka mora biti YYYY-MM-DD.' });
    if (noviTier === 'free') istek = null; // free nema istek
    const napomena = String((req.body || {}).napomena || '').slice(0, 300);
    const rc = await q(`SELECT id, tier, tier_istek FROM korisnici WHERE id=$1`, [kid]);
    if (!rc.rowCount) return res.status(404).json({ error: 'Korisnik ne postoji.' });
    const stari = rc.rows[0].tier;
    await q(`UPDATE korisnici SET tier=$1, tier_istek=$2 WHERE id=$3`, [noviTier, istek, kid]);
    const admin = await ucitajKorisnika(req.uid);
    await q(`INSERT INTO tier_promjene (korisnik_id, stari_tier, novi_tier, istek, promijenio_id, promijenio_ime, napomena)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [kid, stari, noviTier, istek, req.uid, (admin && (admin.ime || admin.korisnicko_ime)) || 'admin', napomena]);
    zabiljezi(req.uid, 'tier_promjena', { korisnik_id: kid, iz: stari, u: noviTier, istek });
    res.json({ ok: true, tier: noviTier, istek });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v095 — povijest promjena tiera za korisnika
app.get('/api/admin/korisnik/:id/tier-povijest', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const kid = parseInt(req.params.id, 10);
    if (!kid) return res.status(400).json({ error: 'Neispravan korisnik.' });
    const r = await q(`SELECT stari_tier, novi_tier, istek, promijenio_ime, napomena, ts
      FROM tier_promjene WHERE korisnik_id=$1 ORDER BY ts DESC LIMIT 50`, [kid]);
    res.json({ ok: true, povijest: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/dashboard', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const g7 = new Date(Date.now() - 7 * 864e5).toISOString();
    const rk = await q(`SELECT COUNT(*)::int AS n FROM korisnici`);
    const rk7 = await q(`SELECT COUNT(*)::int AS n FROM korisnici WHERE created_at > $1`, [g7]);
    const rt = await q(`SELECT tier, COUNT(*)::int AS n FROM korisnici GROUP BY tier`);
    const ra7 = await q(`SELECT COUNT(DISTINCT korisnik_id)::int AS n FROM events WHERE ts > $1 AND korisnik_id IS NOT NULL`, [g7]);
    const rb = await q(`SELECT COUNT(*)::int AS n FROM bookmarki`);
    // korisnici (≤200, najsvjeziji prvo) + aktivnost u dva pomocna upita (Set/Map spajanje)
    const ru = await q(`SELECT k.id, k.ime, k.email, k.korisnicko_ime, k.tier, k.tier_istek, k.cilj_datum,
        k.created_at, k.zadnja_prijava, k.uze_podrucje, p.kod AS program_kod
      FROM korisnici k LEFT JOIN ispitni_programi p ON p.id = k.program_id
      ORDER BY k.id DESC LIMIT 200`);
    const rev = await q(`SELECT korisnik_id, COUNT(*)::int AS n, MAX(ts) AS zadnje
      FROM events WHERE korisnik_id IS NOT NULL GROUP BY korisnik_id`);
    const rbk = await q(`SELECT korisnik_id, COUNT(*)::int AS n FROM bookmarki GROUP BY korisnik_id`);
    const mEv = new Map(rev.rows.map(x => [x.korisnik_id, x]));
    const mBk = new Map(rbk.rows.map(x => [x.korisnik_id, x.n]));
    for (const u of ru.rows) {
      const e = mEv.get(u.id);
      u.dogadjaja = e ? e.n : 0; u.zadnja_aktivnost = e ? e.zadnje : null;
      u.bookmarka = mBk.get(u.id) || 0;
    }
    // top otvarani clanci + zadnje pretrage (sadrzajni uvid)
    const rtc = await q(`SELECT e.meta, COUNT(*)::int AS n FROM events e
      WHERE e.tip='clanak_otvoren' GROUP BY e.meta ORDER BY n DESC LIMIT 10`);
    const topIds = rtc.rows.map(x => { try { return JSON.parse(typeof x.meta==='string'?x.meta:JSON.stringify(x.meta)).clanak_id; } catch(_) { return null; } }).filter(Boolean);
    let topClanci = [];
    for (let i = 0; i < topIds.length; i++) { // petlja umjesto ANY() — pg-mem lekcija
      const rc = await q(`SELECT c.id, c.oznaka, d.naziv FROM clanci c JOIN dokumenti d ON d.id=c.dokument_id WHERE c.id=$1`, [topIds[i]]);
      if (rc.rowCount) topClanci.push({ ...rc.rows[0], otvaranja: rtc.rows[i].n });
    }
    const rp = await q(`SELECT meta, ts FROM events WHERE tip='pretraga' ORDER BY id DESC LIMIT 15`);
    // ⭐ v015 — grafovski agregati (pg-mem safe: grupiranje po danu radimo u JS-u,
    // bez date_trunc/interval; dohvatimo ts zadnjih N dana pa izbrojimo po danu)
    const g14 = new Date(Date.now() - 14 * 864e5).toISOString();
    const g30 = new Date(Date.now() - 30 * 864e5).toISOString();
    const danKljuc = (ts) => new Date(ts).toISOString().slice(0, 10); // YYYY-MM-DD
    const nizDana = (koliko) => {
      const out = [];
      for (let i = koliko - 1; i >= 0; i--) out.push(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10));
      return out;
    };
    // aktivnost po danu (14 d): ukupno događaja + jedinstveni korisnici
    const rAkt = await q(`SELECT korisnik_id, ts FROM events WHERE ts > $1`, [g14]);
    const poDanu = {}; for (const d of nizDana(14)) poDanu[d] = { dogadjaja: 0, kor: new Set() };
    for (const e of rAkt.rows) { const d = danKljuc(e.ts); if (poDanu[d]) { poDanu[d].dogadjaja++; if (e.korisnik_id) poDanu[d].kor.add(e.korisnik_id); } }
    const aktivnost = nizDana(14).map(d => ({ dan: d, dogadjaja: poDanu[d].dogadjaja, korisnika: poDanu[d].kor.size }));
    // raspodjela tipova događaja (14 d)
    const rTip = await q(`SELECT tip, COUNT(*)::int AS n FROM events WHERE ts > $1 GROUP BY tip ORDER BY n DESC`, [g14]);
    // registracije po danu (30 d)
    const rReg = await q(`SELECT created_at FROM korisnici WHERE created_at > $1`, [g30]);
    const regDani = {}; for (const d of nizDana(30)) regDani[d] = 0;
    for (const r of rReg.rows) { const d = danKljuc(r.created_at); if (regDani[d] != null) regDani[d]++; }
    const registracije = nizDana(30).map(d => ({ dan: d, n: regDani[d] }));
    res.json({ ok: true,
      kpi: { korisnika: rk.rows[0].n, novih_7d: rk7.rows[0].n, aktivnih_7d: ra7.rows[0].n,
             po_tieru: rt.rows, bookmarka: rb.rows[0].n },
      grafovi: { aktivnost, tipovi: rTip.rows, registracije },
      korisnici: ru.rows, top_clanci: topClanci,
      pretrage: rp.rows.map(x => { try { const m = typeof x.meta==='string'?JSON.parse(x.meta):x.meta; return { q: m.q, n: m.n, ts: x.ts }; } catch(_) { return { q:'', ts:x.ts }; } }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Uci: struktura korisnikova programa (sekcije -> propisi + br. clanaka)
app.get('/api/uci/struktura', auth, async (req, res) => {
  try {
    const k = await ucitajKorisnika(req.uid);
    if (!k) return res.status(404).json({ error: 'Korisnik ne postoji.' });
    if (!k.program_id) return res.json({ ok: true, program: null, sekcije: [] });
    const r = await q(
      `SELECT pd.sekcija_put, pd.uze_podrucje, pd.redni, pd.izvor_naveden, pd.obuhvat, pd.priznato,
              d.id AS dokument_id, d.naziv, d.vrsta, d.izvor
       FROM program_dokumenti pd JOIN dokumenti d ON d.id = pd.dokument_id
       WHERE pd.program_id = $1 AND d.status = 'aktivno'
       ORDER BY pd.id LIMIT 1000`, [k.program_id]);
    // ⭐ v007 — broj clanaka jednim GROUP BY (portabilno; brze od koreliranog subquerija)
    const rbc = await q(`SELECT dokument_id, COUNT(*)::int AS br FROM clanci GROUP BY dokument_id`);
    const brOd = {}; for (const x of rbc.rows) brOd[x.dokument_id] = x.br;
    const sekcije = [];
    const poKljucu = {};
    for (const row of r.rows) {
      const kljuc = row.sekcija_put || 'Ostalo';
      if (!poKljucu[kljuc]) { poKljucu[kljuc] = { put: kljuc, uze_podrucje: row.uze_podrucje, propisi: [] }; sekcije.push(poKljucu[kljuc]); }
      poKljucu[kljuc].propisi.push({
        dokument_id: row.dokument_id, naziv: row.naziv, vrsta: row.vrsta,
        izvor: row.izvor_naveden || row.izvor, obuhvat: row.obuhvat, priznato: row.priznato, br_clanaka: brOd[row.dokument_id] || 0,
      });
    }
    res.json({ ok: true, program: { kod: k.program_kod, naziv: k.program_naziv, uze_podrucje: k.uze_podrucje }, sekcije });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Uci: dokument + popis clanaka (bez punog teksta)
app.get('/api/dokument/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Neispravan ID.' });
    const rd = await q(`SELECT id, naziv, vrsta, izvor, priznato_pravilo FROM dokumenti WHERE id=$1 AND status='aktivno'`, [id]);
    if (rd.rowCount === 0) return res.status(404).json({ error: 'Dokument ne postoji.' });
    const k = await ucitajKorisnika(req.uid);
    let obuhvat = '';
    if (k && k.program_id) {
      const ro = await q(`SELECT obuhvat FROM program_dokumenti WHERE program_id=$1 AND dokument_id=$2 AND obuhvat<>'' LIMIT 1`, [k.program_id, id]);
      if (ro.rowCount) obuhvat = ro.rows[0].obuhvat;
    }
    // ⭐ v010 — preview za clanke bez naslova (stariji zakoni): tekst rezemo u
    // Node-u (portabilno, pg-mem safe), klijentu ide max 90 znakova, ne cijeli tekst
    const rc = await q(`SELECT c.id, c.redoslijed, c.oznaka, c.naslov, c.tekst
      FROM clanci c WHERE c.dokument_id=$1 ORDER BY c.redoslijed LIMIT 3000`, [id]);
    for (const c of rc.rows) { c.preview = c.naslov ? '' : String(c.tekst || '').slice(0, 90); delete c.tekst; }
    // ⭐ v007 — bookmark oznake jednim upitom (portabilno)
    const rbm = await q(`SELECT clanak_id FROM bookmarki WHERE korisnik_id=$1`, [req.uid]);
    const bset = new Set(rbm.rows.map(x => x.clanak_id));
    for (const c of rc.rows) c.bookmark = bset.has(c.id);
    res.json({ ok: true, dokument: { ...rd.rows[0], obuhvat }, clanci: rc.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Uci: jedan clanak (puni tekst) + prev/next + bookmark stanje
app.get('/api/clanak/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Neispravan ID.' });
    const r = await q(`SELECT c.*, d.naziv AS dokument_naziv, d.izvor AS dokument_izvor
      FROM clanci c JOIN dokumenti d ON d.id=c.dokument_id WHERE c.id=$1`, [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Članak ne postoji.' });
    const cl = r.rows[0];
    // ⭐ v018 — F4: ?na_dan=YYYY-MM-DD vraca verziju presjeka (04 §3, "džepni vještak" F17)
    const naDan = String(req.query.na_dan || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(naDan)) {
      const rv = await q(`SELECT oznaka, naslov, tekst, vrijedi_od, vrijedi_do, nn_izvor FROM clanci_verzije
        WHERE clanak_id=$1 AND vrijedi_od<=$2 AND (vrijedi_do IS NULL OR vrijedi_do>$2)
        ORDER BY id DESC LIMIT 1`, [id, naDan]);
      if (rv.rowCount === 0) return res.status(404).json({ error: 'Za taj datum nema verzije članka (prije stupanja na snagu).' });
      const v = rv.rows[0];
      cl.oznaka = v.oznaka; cl.naslov = v.naslov; cl.tekst = v.tekst;
      cl.povijesno = v.vrijedi_do !== null;
      cl.na_dan = naDan; cl.nn_izvor = v.nn_izvor; cl.vrijedi_od = v.vrijedi_od; cl.vrijedi_do = v.vrijedi_do;
    }
    const rbm = await q('SELECT 1 FROM bookmarki WHERE korisnik_id=$1 AND clanak_id=$2', [req.uid, id]);
    cl.bookmark = rbm.rowCount > 0; // ⭐ v007 — portabilno umjesto EXISTS u projekciji
    zabiljezi(req.uid, 'clanak_otvoren', { clanak_id: id }); // ⭐ v013
    const rp = await q(`SELECT id FROM clanci WHERE dokument_id=$1 AND redoslijed<$2 ORDER BY redoslijed DESC LIMIT 1`, [cl.dokument_id, cl.redoslijed]);
    const rn = await q(`SELECT id FROM clanci WHERE dokument_id=$1 AND redoslijed>$2 ORDER BY redoslijed ASC LIMIT 1`, [cl.dokument_id, cl.redoslijed]);
    res.json({ ok: true, clanak: cl, prev_id: rp.rows[0] ? rp.rows[0].id : null, next_id: rn.rows[0] ? rn.rows[0].id : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bookmark toggle (race-safe: INSERT ON CONFLICT, pa DELETE ako je vec postojao)
app.post('/api/bookmark', auth, async (req, res) => {
  try {
    const clanakId = parseInt(req.body.clanak_id, 10);
    if (!clanakId) return res.status(400).json({ error: 'Nedostaje clanak_id.' });
    // ⭐ v007 — portabilan toggle: DELETE odlucuje (rowCount); INSERT s ON CONFLICT cuva od utrke
    const del = await q('DELETE FROM bookmarki WHERE korisnik_id=$1 AND clanak_id=$2', [req.uid, clanakId]);
    if (del.rowCount > 0) { zabiljezi(req.uid, 'bookmark_off', { clanak_id: clanakId }); return res.json({ ok: true, bookmarkiran: false }); } // ⭐ v013
    try {
      await q(`INSERT INTO bookmarki (korisnik_id, clanak_id) VALUES ($1,$2)
        ON CONFLICT (korisnik_id, clanak_id) DO NOTHING`, [req.uid, clanakId]);
    } catch (e) {
      if (e.code === '23503' || /foreign key/i.test(e.message || '')) return res.status(404).json({ error: 'Članak ne postoji.' });
      throw e;
    }
    zabiljezi(req.uid, 'bookmark_on', { clanak_id: clanakId }); // ⭐ v013
    res.json({ ok: true, bookmarkiran: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/bookmarki', auth, async (req, res) => {
  try {
    const r = await q(`SELECT b.clanak_id, c.oznaka, c.naslov, d.naziv AS dokument_naziv
      FROM bookmarki b JOIN clanci c ON c.id=b.clanak_id JOIN dokumenti d ON d.id=c.dokument_id
      WHERE b.korisnik_id=$1 ORDER BY b.created_at DESC LIMIT 100`, [req.uid]);
    res.json({ ok: true, bookmarki: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Jednostavna pretraga po naslovima (prava semanticka stize u Fazi 5)
app.get('/api/uci/pretraga', auth, async (req, res) => {
  try {
    const qs = String(req.query.q || '').trim().slice(0, 80);
    if (qs.length < 2) return res.json({ ok: true, propisi: [], clanci: [] });
    const k = await ucitajKorisnika(req.uid);
    if (!k) return res.json({ ok: true, propisi: [], clanci: [] });
    const like = '%' + qs.replace(/[%_]/g, '') + '%';
    // ⭐ v125 — jedinstvena pretraga po 4 polja s PRIORITETOM: dokument_naziv > vrsta > oznaka članka > tekst članka.
    // Superadmin pretražuje SVE gradivo; običan korisnik samo svoj program. Rang određuje redoslijed prikaza.
    const sviDok = !!k.je_superadmin;
    const progFilter = sviDok ? '' : ' AND EXISTS (SELECT 1 FROM program_dokumenti pd WHERE pd.dokument_id=d.id AND pd.program_id=$2)';
    const params = sviDok ? [like] : [like, k.program_id];
    // Dokumenti: match po nazivu (rang 1) ili vrsti (rang 2)
    const rd = await q(`SELECT d.id AS dokument_id, d.naziv, d.vrsta,
        CASE WHEN d.naziv ILIKE $1 THEN 1 ELSE 2 END AS rang
      FROM dokumenti d
      WHERE d.status='aktivno' AND (d.naziv ILIKE $1 OR d.vrsta ILIKE $1)${progFilter}
      ORDER BY rang, d.naziv LIMIT 25`, params);
    // Članci: match po oznaci (rang 3) ili tekstu (rang 4). Oznaka prije teksta.
    const rc = await q(`SELECT c.id, c.oznaka, c.naslov, d.naziv AS dokument_naziv, d.vrsta,
        LEFT(c.tekst, 180) AS ulomak,
        CASE WHEN c.oznaka ILIKE $1 OR c.naslov ILIKE $1 THEN 3 ELSE 4 END AS rang
      FROM clanci c JOIN dokumenti d ON d.id=c.dokument_id
      WHERE d.status='aktivno' AND (c.oznaka ILIKE $1 OR c.naslov ILIKE $1 OR c.tekst ILIKE $1)${progFilter}
      ORDER BY rang, c.oznaka LIMIT 40`, params);
    zabiljezi(req.uid, 'pretraga', { q: qs.slice(0, 80), n: rd.rowCount + rc.rowCount }); // ⭐ v013
    res.json({ ok: true, propisi: rd.rows, clanci: rc.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PWA staticki fajlovi (eksplicitno; ne serviramo cijeli dir) ──────
const STATICKI = { '/sw.js': 'application/javascript', '/manifest.webmanifest': 'application/manifest+json', '/icon-192.png': 'image/png', '/icon-512.png': 'image/png', '/icon-maskable.png': 'image/png' };
for (const [ruta, mime] of Object.entries(STATICKI)) {
  app.get(ruta, (req, res) => {
    if (ruta === '/sw.js') res.setHeader('Cache-Control', 'no-cache');
    res.type(mime).sendFile(path.join(__dirname, ruta.slice(1)), (err) => { if (err) res.status(404).end(); });
  });
}
// ⭐ v020 — F4 pomoćnik: HARD reset dokumenta (za demo-testove novela).
// OPREZ: briše članke kaskadno (verzije, chunkovi, BOOKMARKI korisnika!) — zato
// traži tocan naziv u bodyju kao potvrdu namjere. Nakon reseta: uvezi original.
app.post('/api/admin/uvoz/reset', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const naziv = String((req.body || {}).dokument_naziv || '').trim();
    if (!naziv) return res.status(400).json({ error: 'Upiši točan dokument_naziv kao potvrdu.' });
    const rd = await q('SELECT id FROM dokumenti WHERE naziv=$1', [naziv]);
    if (!rd.rowCount) return res.status(404).json({ error: 'Dokument nije pronađen: ' + naziv });
    const dokId = rd.rows[0].id;
    const r = await q('DELETE FROM clanci WHERE dokument_id=$1', [dokId]);
    await q('DELETE FROM sustav_meta WHERE kljuc=$1', ['novela_diff_' + dokId]);
    res.json({ ok: true, dokument_id: dokId, obrisano_clanaka: r.rowCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════ ⭐ v019 — F5: AI / RAG temelj (07) ═══════════════════════
const AI_ON = () => String(process.env.AI_ENABLED || '').toLowerCase() === 'true';

// PROMPTOVI — doslovno iz biblije 07 §5 🔒 (P1 nadograđen po 13-INTELIGENCIJA §2 — IRAC + hijerarhija + alati) // ⭐ v041
const P1_SYSTEM = `Ti si Vještak — stručni AI asistent za hrvatske propise u graditeljstvu (platforma ŽBUKA AI).
Kratice koje korisnici koriste: ZOG/ZoG=Zakon o gradnji · ZOPU=Zakon o prostornom uređenju · ZNR=Zakon o zaštiti na radu · ZOP/ZZOP=Zakon o zaštiti od požara · ZUP=Zakon o općem upravnom postupku · ZOO=Zakon o obveznim odnosima · GD=građevinska dozvola · UD=uporabna dozvola · GLP/GP=glavni projekt. // ⭐ v039
ALATI (agentska pretraga): // ⭐ v041 — 13 §1
- Prije konačnog odgovora smiješ u najviše 4 kruga koristiti alate: trazi_propise (nova ciljana pretraga kad priloženi izvori ne pokrivaju dio pitanja), procitaj_clanak (puni tekst članka i susjednih kad trebaš točan sadržaj, nabrajanje ili kontekst), clanak_na_dan (verzija članka na povijesni datum — sporovi, ugovori, stara stanja).
- Alat pozovi ČIM uočiš rupu: korisnik traži konkretan članak kojeg nema u izvorima; odredba upućuje na drugi propis ("posebnim propisom", "iz članka X."); pitanje se odnosi na prošli datum; izvor je odrezan usred nabrajanja. Ako priloženi IZVORI već pokrivaju pitanje — odgovori odmah, bez alata.
- Rezultati alata stižu kao novi numerirani izvori ([13], [14]…) — citiraš ih jednako kao početne. Budi štedljiv: svaki krug troši korisnikov budžet.
PRAVILA (kruta):
1. Odgovaraš ISKLJUČIVO na temelju priloženih IZVORA (početnih i onih dobivenih alatima). Vlastito opće znanje smiješ koristiti samo za povezivanje i strukturu, nikad za tvrdnje o sadržaju propisa.
2. Svaku pravnu tvrdnju označi referencom [n] na izvor iz kojeg dolazi. Ne izmišljaj brojeve članaka ni NN brojeve.
3. Ako ni nakon pretrage alatima izvori ne pokrivaju dio pitanja, izričito napiši što nedostaje i predloži gdje bi se moglo nalaziti (naziv propisa), bez nagađanja sadržaja.
4. DULJINA I REGISTAR — prilagodi se onome što korisnik traži (procijeni PRIJE pisanja): // ⭐ v074 — adaptivni registar
   (a) ZADANO (bez posebnog zahtjeva): kratko, izravno, sažeto — kao profesionalac na terenu koji nema vremena za okolišanje. Koristi strukturu iz točke 4b.
   (b) KORISNIK TRAŽI DUBINU ("raspiši detaljnije", "objasni dublje", "sve o tome", "detaljno", "pojasni mi to temeljito"): tada slobodno proširi — puna analiza, više konteksta, iznimke, protuargumenti, primjeri iz prakse, prijelazne odredbe. Zadrži jasnu strukturu i citate [n], ali smiješ ići u širinu.
   (c) KORISNIK TRAŽI DOKUMENT ("složi dopis", "napiši prigovor/zahtjev/žalbu", "sudski podnesak", "obavijest investitoru", "formalno pismo"): piši GOTOV, profesionalan dokument u odgovarajućem formalnom registru (zaglavlje/naslov, uljudno oslovljavanje, pravni okvir s pozivom na konkretne članke [n], jasan zahtjev/stav, mjesto za datum i potpis). Ozbiljan, precizan ton — kao da ga sastavlja iskusni vještak. Ovdje duljina služi svrsi dokumenta, ne skraćuj umjetno.
   Prepoznaj registar iz formulacije pitanja; kad nisi siguran, ostani na zadanom (a) i na kraju ponudi "Trebaš li da ovo raspišem detaljnije ili složim kao formalni dopis?".
   BEZ UVODA I META-KOMENTARA: ne opisuj što ćeš raditi, ne prepričavaj pitanje, ne objašnjavaj da je poruka kratka ni da izvori nešto ne pokrivaju u zasebnim odlomcima. Ako je poruka nejasna — pitaj u JEDNOJ rečenici što točno treba i stani. Ako izvori ne pokrivaju temu — reci to u jednoj rečenici na kraju ("Za X nemam izravan izvor — provjeri Y."), ne raspisuj. Kreni ODMAH od odgovora.
4b. STRUKTURA ZA ZADANI (kratki) NAČIN — za čitanje na gradilištu (10-20 sekundi, ne esej). Duboku analizu odradi u razmišljanju; korisniku daj DESTILAT u kratkim crticama. // ⭐ v073
   Za situacijska i pravna pitanja koristi OVE podnaslove (svaki 1-3 crtice, bez dugih odlomaka):
   "Ukratko" — izravan odgovor u 1-2 rečenice ODMAH na vrhu (što korisnik mora učiniti / kako stoji stvar).
   "Analiza" — 2-4 kratke crtice: što je mjerodavno i kojim redom (pravna hijerarhija: zakon → pravilnik → tehnički propis), svaka s [n]. Ovdje se vidi smjer zaključivanja, ali zbijeno.
   "Zaključak" — 1-2 rečenice: konačan odgovor + "Pazi:" (rok, rizik, česta greška) ako postoji.
   "Članci" — popis ključnih referenci [n] koje si koristio (oznaka + propis), da korisnik zna gdje provjeriti.
   Za kratka činjenična pitanja (rok, broj, definicija): SAMO izravan odgovor u 1-3 rečenice + [n]. Bez podnaslova.
   Ne raspisuj "Situacija" i "Pravno pitanje" kao zasebne odlomke — to sažmi u jednu crticu "Ukratko" ako uopće treba. Cilj: kraće za ~trećinu, gušće informacijom.
5. PRAVNA HIJERARHIJA I KOLIZIJE: viši akt jači od nižeg (zakon > pravilnik > tehnički propis); posebni propis jači od općeg (lex specialis); kasniji jači od ranijeg (lex posterior). Kad se odredbe sukobljavaju, izričito napiši koja prevladava i zašto. UVIJEK vodi računa o važenju na datum pitanja — zadano je danas; za prošle datume koristi clanak_na_dan i naglasi o kojoj verziji govoriš. // ⭐ v041 — 13 §2
6. Piši hrvatski, ti-forma, jasno i bez pravničkog viška. Ne ponavljaj tekst članaka doslovno više od nužnog citata. Crtice drži kratkima (idealno ispod 20 riječi) — konkretno, ne opisno. Formatiranje: smiješ koristiti **podebljano** za podnaslove i crtice ("- ") za nabrajanja; NE koristi ## znakove, tablice ni vodoravne crte (---). // ⭐ v042/v073
7. Ovo nije pravni savjet u pojedinačnom sporu — kad pitanje miriše na spor, uputi na ovlaštenog vještaka/odvjetnika, ali svejedno daj pravni okvir iz izvora.`;
const P2_PLANNER = `Zadatak: rastavi korisnikovo pitanje o hrvatskim propisima u graditeljstvu na 1-4 kratka pretraživačka upita (imenske fraze, terminologija propisa) i izvuci ključne pojmove. Odgovori SAMO JSON:
{"pod_upiti":["..."],"kljucni_pojmovi":["..."]}
Primjer: "što mi sve treba za početak gradnje?" ->
{"pod_upiti":["prijava početka građenja","pravomoćnost građevinske dozvole","elaborat iskolčenja","dokumentacija na gradilištu"],"kljucni_pojmovi":["prijava početka","iskolčenje","gradilište"]}
Primjer 2 (životnu situaciju preslikaj u pravne institute): "izvođač mi je ugradio nekvalitetan materijal, a uporabna dozvola je već izdana" ->
{"pod_upiti":["odgovornost izvođača za nedostatke građevine","jamstvo za solidnost građevine rok","pravne posljedice uporabne dozvole","dokazivanje svojstava ugrađenih građevnih proizvoda"],"kljucni_pojmovi":["nedostaci","solidnost","uporabna dozvola"]}
Kratice koje korisnici koriste: ZOG/ZoG=Zakon o gradnji · ZOPU=Zakon o prostornom uređenju · ZNR=Zakon o zaštiti na radu · ZOP/ZZOP=Zakon o zaštiti od požara · ZUP=Zakon o općem upravnom postupku · ZOO=Zakon o obveznim odnosima · GD=građevinska dozvola · UD=uporabna dozvola · GLP/GP=glavni projekt.
Napomena: koristi terminologiju PROPISA, uključivo sinonime kad postoje (gradilište/privremeno radilište; građevinska dozvola/akt za građenje; naknada/pristojba; izjava o svojstvima/deklaracija).`; // ⭐ v028+v029
const AI_DISCLAIMER = 'Informativni prikaz propisa — nije pravni savjet za pojedinačni slučaj. Provjeri izvor klikom na citat; za sporove se obrati ovlaštenom stručnjaku.';
// ⭐ v042 — P9: Skraćeno / Primjer po članku (selling point čitača; keš u clanak_pomoc)
const P9_SKRACENO = `Razloži priloženi članak hrvatskog propisa u 3-7 kratkih crtica.
Pravila: svaka crtica pocinje sa "• " i ima najviše 14 riječi · običan jezik, bez pravničkog · bez uvoda i zaključka · ako članak nabraja stavke, grupiraj ih smisleno · brojevi, rokovi i iznosi SAMO ako doslovno stoje u članku · ne dodaji ništa čega u članku nema.`;
const P9_PRIMJER = `Napiši JEDAN konkretan primjer s gradilišta (5-8 rečenica) koji slikovito pokazuje što priloženi članak znači u praksi.
Pravila: imenuj uloge (investitor, izvođač, nadzorni inženjer, projektant…) · običan jezik · smiješ izmisliti imena i situaciju, ali pravni sadržaj (obveze, rokovi, posljedice) uzimaš isključivo iz članka · završi jednom rečenicom koja počinje "Poanta: " · bez naslova i uvoda.`;
// ⭐ v047 — F16 promptovi. P5 uvod, P6 procjena (STROGI JSON, MODEL_PLANNER), P7 rubrika (STROGI JSON).
// ⭐ v069 — KOMISIJA: 4 člana s područjima. Član se bira po temi pitanja (ključne riječi u tekstu).
// ⭐ v100 — KARAKTERI: svaki član ima temperament (ton) i strogost 1-5. Strogost NE mijenja poštenje
// ocjene (fer ostaje fer 🔒), nego prag tolerancije na nepotpunost i ton (blaži prašta sitnice i ohrabruje;
// stroži traži preciznost, osobito ZOP/požar gdje greška košta života). Realizam prave komisije.
// Realizam: pravi usmeni je pred komisijom, svaki član pokriva svoje područje (ZNR/ZOP/OTR/opće graditeljstvo).
const KOMISIJA = [
  { id: 'znr', ime: 'ing. Kovač',   inicijal: 'K', podrucje: 'zaštita na radu', strogost: 3,
    ton: 'staložen i pravičan; cijeni praktično iskustvo s gradilišta; ohrabruje kad kandidat razmišlja logično',
    kw: ['zaštit', 'na radu', 'znr', 'koordinator', 'ozljed', 'gradilišt', 'skela', 'osobn', 'ozo', 'rizik', 'prevencij', 'posloda'] },
  { id: 'zop', ime: 'ing. Perić',   inicijal: 'P', podrucje: 'zaštita od požara', strogost: 5,
    ton: 'precizan i zahtjevan; požar ne oprašta pa traži točnost u brojkama i oznakama (REI, razredi); korektan ali ozbiljan',
    kw: ['požar', 'zop', 'gorenj', 'evakuacij', 'otpornost na', 'reakcij', 'rei', 'hidrant', 'dim', 'sprinkl', 'vatrog', 'sigurnosn'] },
  { id: 'otr', ime: 'ing. Horvat',  inicijal: 'H', podrucje: 'organizacija i tehnologija građenja', strogost: 4,
    ton: 'sistematičan i temeljit; voli da kandidat poveže postupak (tko, čime, kojim redom); traži jasnu logiku',
    kw: ['dozvol', 'projekt', 'nadzor', 'investitor', 'izvođač', 'dnevnik', 'tehnički pregled', 'uporabn', 'građevinsk', 'lokacij', 'rok', 'obračun',
         'gradnj', 'građenj', 'gradi', 'rekonstrukcij', 'građevin', 'zakon o gradnji', 'sudionik', 'norm', 'tehnički propis', 'proizvod'] },
  { id: 'opc', ime: 'ing. Novak',   inicijal: 'N', podrucje: 'graditeljstvo', strogost: 2,
    ton: 'topao i ohrabrujući; smiruje tremu, vodi kandidata potpitanjima; nagrađuje trud i razumijevanje',
    kw: [] } // fallback — opće graditeljstvo
];
const STROGOST_OPIS = (s) => s >= 5 ? 'VRLO STROG: traži preciznost i točne oznake/brojke; nepotpun odgovor jasno prepoznaj, ali ostani korektan i pošten'
  : s >= 4 ? 'STROG: očekuj cjelovitost i jasnu logiku postupka; sitne propuste smiješ tolerirati ako je bit tu'
  : s >= 3 ? 'UMJEREN: pravičan, tražiš bit bez cjepidlačenja'
  : s >= 2 ? 'BLAG: ohrabruješ, praštaš sitnice, vodiš kandidata; nagradi trud i razumijevanje'
  : 'VRLO BLAG: maksimalno podupireš, smiruješ tremu, tražiš samo osnovnu bit';
function odaberiClana(tekstPitanja) {
  const t = String(tekstPitanja || '').toLowerCase();
  let naj = KOMISIJA[KOMISIJA.length - 1], najBod = 0;               // default = opći član
  for (const c of KOMISIJA) {
    const bod = c.kw.reduce((a, k) => a + (t.includes(k) ? 1 : 0), 0);
    if (bod > najBod) { najBod = bod; naj = c; }
  }
  return naj;
}
// ⭐ v100 — persona blok koji se ubacuje u P5/P6/P7A da član zvuči i ocjenjuje dosljedno svom karakteru.
// Strogost utječe na TON i PRAG TOLERANCIJE na nepotpunost — NIKAD na iskrivljavanje točnosti (fer 🔒).
function personaBlok(clan) {
  return `\nTVOJ KARAKTER (dosljedno kroz cijeli ispit): Ti si ${clan.ime}, član ispitne komisije za ${clan.podrucje}. Ton: ${clan.ton}. Stil ocjenjivanja: ${STROGOST_OPIS(clan.strogost)}. Ostani u ovoj ulozi prirodno, bez glume i bez spominjanja "karaktera" ili "strogosti" naglas. VAŽNO: strogost mijenja TON i koliko tražiš cjelovitost — ali ocjena točnosti uvijek mora biti POŠTENA i istinita (nikad ne napuhuj ni ne obaraj sadržajno točan odgovor).`;
}

const P5_ISPITIVAC = `Ti si ISPITIVAČ na usmenom dijelu stručnog ispita za graditeljstvo u Hrvatskoj — ozbiljan ispit za buduće OVLAŠTENE INŽENJERE.
Dobit ćeš PITANJE iz službene banke. Napiši: (1) kratki scenarij s gradilišta (2-3 rečenice) koji uokviruje temu, (2) jasno postavljeno pitanje kandidatu.
Pravila: profesionalan, miran i ozbiljan ton na "vi" · NIKAD ne otkrivaj niti nagovještavaj točan odgovor · bez uvoda tipa "Evo scenarija" · ukupno do 90 riječi.`;
// ⭐ v101 — RECENZENT točnosti: usporedi golden odgovor sa stvarnim tekstom propisa (RAG izvori).
// Iskren je: razlikuje "provjereno protiv izvora" od "izvor ne pokriva" (nema_izvora) — bez nagađanja.
const P_RECENZENT = `Ti si RECENZENT točnosti golden odgovora za hrvatski stručni ispit iz graditeljstva. Dobit ćeš PITANJE, GOLDEN ODGOVOR (koji provjeravaš) i IZVOR (članci propisa iz baze — mogu biti nepotpuni ili se ne odnositi na pitanje).
Prosudi slaže li se GOLDEN ODGOVOR sa sadržajem propisa.
Vrati ISKLJUČIVO JSON bez ikakvog drugog teksta:
{"slaganje":"da"|"djelomicno"|"ne"|"nema_izvora","problem":"kratko što je sporno (prazno ako je 'da')","clanak":"oznaka članka/propisa na koji se oslanjaš (ili prazno)"}
Pravila:
- "da" = odgovor je u skladu s izvorom; ILI izvor ne pokriva temu ali je odgovor nedvojbeno točan po općepoznatom pravilu struke.
- "djelomicno" = uglavnom točno ali ima manju netočnost, zastarjeli podatak ili nepreciznost — navedi je u "problem".
- "ne" = odgovor SADRŽAJNO proturječi izvoru (kriva brojka/oznaka/tvrdnja) — navedi točno što u "problem".
- "nema_izvora" = izvor se ne odnosi na ovo pitanje pa NE MOŽEŠ provjeriti protiv propisa i nisi siguran u točnost — ne nagađaj.
- Budi strog SAMO prema stvarnim netočnostima; ne kažnjavaj slobodnu formulaciju, sinonime ni izostanak broja članka ako je bit točna.
- Za brojke i oznake (REI, dB, rokovi, postoci, klase, članci) budi posebno pažljiv — ondje su greške najčešće i najskuplje.`;
const P6_PROCJENA = `Ti si ISPITIVAČ na usmenom ispitu koji procjenjuje odgovor kandidata. Dobit ćeš ZLATNI ODGOVOR (službeni), PITANJE i TRANSKRIPT.
Vrati ISKLJUČIVO JSON bez ikakvog drugog teksta:
{"tocnost":0-100,"pokriveno":["…"],"nedostaje":["…"],"sljedece":"potpitanje"|"kraj","potpitanje":"…"}
Pravila ODLUKE:
- "kraj" ako: bitno pokriveno (tocnost>=80) ILI kandidat je već dobio hint u transkriptu a i dalje ne zna ILI je ovo 3. potpitanje.
- "potpitanje" inače.
LJUDSKI FAKTOR (ključno) — ovo je stvaran ispit za OVLAŠTENE INŽENJERE. Razlikuj situacije, ali OPREZNO — većina kandidata se TRUDI, pa je zadana pretpostavka DOBRONAMJERNOST:
  ⭐ ZEZANCIJA / ISMIJAVANJE (RIJETKO — samo očiti slučajevi): opomeni SAMO ako kandidat OČITO ismijava ispitivača ili se ne trudi — provokacija, ruganje, čista besmislica, off-topic dosjetka, uvreda, ili odgovor koji jasno pokazuje da uopće ne pokušava ("nema veze", "briga me", šala umjesto odgovora). To NIJE: kratak odgovor, nesiguran odgovor, djelomično točan odgovor, laički formuliran odgovor, ni pogađanje u dobroj vjeri. Ako SUMNJAŠ je li zezancija ili trud — tretiraj kao TRUD. Kad je stvarno zezancija: u "potpitanje" dostojanstveno opomeni (ispit za ovlaštene inženjere, neozbiljno nosi 0, uozbiljite se pa pokušajte) i ponovi pitanje. Ako i nakon opomene nastavi ismijavati → "kraj".
  ⭐ TRUDI SE (VEĆINA SLUČAJEVA — uključujući djelomično točne): ako kandidat POŠTENO pokušava — čak i kratko, nesigurno, laički, ili pogodi samo DIO ("obuhvaća zaštitu od požara, tu idu požarni zidovi i evakuacije") — to je TRUD, NIKAD zezancija. Prepoznaj što je pogodio, POHVALI taj dio, pa ga usmjeri na ostalo. U "potpitanje" daj KRATAK HINT ili PRIMJER IZ PRAKSE koji ga vodi na dio koji nedostaje (spomeni orijentir iz zlatnog odgovora bez cijelog odgovora). Primjer: "Dobro, požarne sektore i evakuaciju ste pogodili. A tko takav elaborat smije izraditi i od kojih se dijelova sastoji — tekstualni i…?" Pomozi mu, ne ruši ga.
  ⭐ POGODI IZ PRVE: ako kandidat odmah da potpun, točan odgovor svojim riječima → NEMA potpitanja radi mučenja, idi na "kraj" i to će rezultirati visokom ocjenom (bravo). Ne traži dlaku u jajetu.
  ⭐ PRIMJER IZ PRAKSE (za navođenje): kad kandidat ne ide u smjeru koji tražiš — ispričaj KRATAK REALAN PRIMJER SA GRADILIŠTA (2-3 rečenice, konkretna situacija) pa pitaj kako bi postupio. Npr. umjesto "što je građevinska dozvola?" → "Susjed prijavi da gradite bez papira, inspektor traži dokument koji dokazuje da smijete graditi. Koji je to dokument?".
- ako kandidat DJELOMIČNO zna: potpitanje cilja najveću prazninu, na "vi", pohvali pogođeno, ne odaje cijeli odgovor.
- ⭐ ZAMKA / PRAKTIČNO PROTUPITANJE (ako kandidat pokazuje znanje): kad solidno odgovori, POVREMENO (svako 2.-3. potpitanje, ne uvijek) postavi ŽIVO protupitanje iz prakse — scenarij "a što ako se na terenu dogodi…?" ili netočnu tvrdnju "a je li točno da…?". Netočnu tvrdnju NIKAD kao hint kad ne zna.
- ⭐ OCJENJIVANJE SMISLA (ključno): ocjenjuj RAZUMIJEVANJE, ne doslovnost. Ako kandidat svojim riječima pogodi bit ili DIO — to se broji, i kad ne citira članak. Djelomično točan iskren odgovor = SREDNJA točnost (npr. pogodio 2 od 5 elemenata = ~40), NE niska. Ne snižavaj zbog izostanka broja članka, sinonima ili laičke formulacije. Snizi na 0-15 SAMO za stvarnu zezanciju/ismijavanje ili potpuno prazan/besmislen odgovor — NE za iskren nepotpun pokušaj. Budi razuman ispitivač koji nagrađuje shvaćanje.
- "nedostaje" formuliraj neutralno, bez doslovnog citiranja zlatnog teksta.`;
const P7_RUBRIKA = `Ti si ISPITIVAČ koji zaključuje usmeni ispit. Dobit ćeš ZLATNI ODGOVOR, PITANJE i cijeli TRANSKRIPT.
Vrati ISKLJUČIVO JSON bez ikakvog drugog teksta:
{"ocjena":1-5,"sazetak":"2-3 rečenice na vi","jake_strane":["…"],"praznine":["…"],"savjet":"što točno ponoviti (članci/teme)"}
Pravila: ocjena po pokrivenosti zlatnog odgovora kroz CIJELI razgovor · sada SMIJEŠ navesti ključne točke koje su nedostajale (ispit je gotov) · konkretno i kratko.`;
// ⭐ v053 — P7 zamijenjen: završna ocjena je DETERMINISTIČKA (prosjek pitanja, prag 90/100 — financijska
// matematika sveta 🔒), a po pitanju ide P7A ispravak. P7 ostaje kao povijest (ne poziva se).
const P7A_ISPRAVAK = `Ti si ISKUSAN, DOBRONAMJERAN ISPITIVAČ koji zaključuje JEDNO pitanje usmenog ispita. Dobit ćeš ZLATNI ODGOVOR, PITANJE i TRANSKRIPT tog pitanja.
Vrati ISKLJUČIVO JSON bez ikakvog drugog teksta:
{"ocjena":0-100,"kriteriji":{"potpunost":0-100,"tocnost_citata":0-100,"prakticnost":0-100,"komunikacija":0-100},"ispravak":"…"}
Pravila:
- ocjena = pokrivenost SMISLA zlatnog odgovora kroz cijeli transkript pitanja.
- kriteriji (DIJAGNOSTIKA, ne mijenjaju "ocjena"): potpunost = koliko je ključnih točaka zlatnog odgovora pokrio; tocnost_citata = koliko su navodi propisa/članaka točni (ako ih nema, ocijeni po točnosti tvrdnji); prakticnost = primjena na stvarnu situaciju s terena; komunikacija = jasnoća i struktura izlaganja. Svaki 0-100, pošteno kao i ocjena. Nagradi razumijevanje: ako kandidat svojim riječima pogodi bit, ocjena je visoka i bez doslovnog citiranja članaka. Ako pogodi DIO elemenata — ocjena je razmjerna (npr. 2 od 5 ključnih točaka = ~40, 3 od 5 = ~60), NIKAD niska za iskren djelomičan pokušaj. NE snižavaj zbog izostanka broja članka, drukčije formulacije ili sinonima. (100 = bit potpuno shvaćena; 0 = ništa točno ili zezancija; pošteno, ne cjepidlački.)
- ⭐ VAŽNO — ocjenjuj STVARNO ZNANJE, ne ono što je otkriveno hintovima. Ako je kandidat SAM iz prve pogodio bit → visoko (85-100). Ako je dio pogodio sam pa dopunio nakon blagog navođenja → srednje-visoko (60-80). Ako je gotovo sve izvučeno hintovima → nisko-srednje (30-55). Ključno: DJELOMIČAN ali ISKREN i SAMOSTALAN pokušaj (kao "obuhvaća zaštitu od požara, tu idu požarni zidovi, evakuacije, požarne zone") NIJE nizak — to je pogođen dio, ocijeni ga pošteno (~35-50), NE 18.
- ⭐ ZEZANCIJA (RIJETKO — samo očito ismijavanje): ocjena 0-30 SAMO ako je kandidat OČITO ismijavao ispitivača, provocirao, davao besmislice ili odbijao pokušati. Kratak, nesiguran, laički ili djelomično točan iskren odgovor NIJE zezancija — ne kažnjavaj ga kao takav. Ako sumnjaš — NIJE zezancija.
- "ispravak" na "vi", do 130 riječi, ton ovisi o nastupu:
  · ako se kandidat POŠTENO trudio ili nije znao (VEĆINA): topao ton dobrog profesora — POHVALI što je pogodio ("Točno ste prepoznali požarne sektore i evakuaciju"), pa DOPUNI što je nedostajalo i objasni cijeli točan odgovor. Podučavaj, NE prekoravaj. NIKAD ne nazivaj iskren pokušaj "neozbiljnim" ili "preturšim".
  · ako je kandidat STVARNO ismijavao/zezao se: dostojanstveno mu daj do znanja da ispit traži ozbiljan pristup, pa mirno objasni točan odgovor. Bez vrijeđanja.
  Pitanje je zaključeno pa SMIJEŠ i trebaš navesti sadržaj zlatnog odgovora. Zaključi kratkom orijentir-uputom (koji članak/propis ponoviti).
- bez uvoda tipa "Evo ispravka" i bez ponavljanja pitanja.`;
// ⭐ v061 — F7: on-the-fly generator ~10% pitanja pismenog testa ("iznenađenje" iz živih propisa).
// Generirana pitanja se SPREMAJU u banku (izvor='ai', rok_oznaka='AI-GEN') — jedna generacija služi sve 💰.
const P3T_PISMENI = `Ti si autor pitanja za PISMENI dio stručnog ispita za graditeljstvo u Hrvatskoj. Dobit ćeš IZVOR (tekst članaka propisa s [id] oznakama).
Vrati ISKLJUČIVO tražen broj JSON redova (svaki objekt u svom retku, bez ikakvog drugog teksta):
{"tip":"abc","pitanje":"…","opcije":["A) …","B) …","C) …","D) …"],"tocno":"B","obrazlozenje":"… s referencom (Članak X.)","clanak_refs":[id],"tezina":1-5}
Pravila: pitanje provjerava RAZUMIJEVANJE teksta izvora (ne pamćenje brojeva NN) · distraktori uvjerljivi ali jasno netočni PO TEKSTU članka · bez opcija "sve navedeno/ništa navedeno" · obrazloženje kratko i konkretno.`;
// ⭐ v096 — generiranje USMENIH pitanja iz živih zakona (10% usmenog): otvoreno pitanje + očekivani odgovor (za rubriku)
const P5G_USMENI = `Ti si autor pitanja za USMENI dio stručnog ispita za graditeljstvo u Hrvatskoj. Dobit ćeš IZVOR (tekst članaka propisa s [id] oznakama).
Generiraj OTVORENA usmena pitanja (na koja se odgovara govorom, objašnjavanjem — NE zaokruživanjem).
Vrati ISKLJUČIVO tražen broj JSON redova (svaki objekt u svom retku, bez ikakvog drugog teksta):
{"tip":"usmeno","pitanje":"Objasnite/Što/Kako… (otvoreno pitanje iz prakse)","tocno":"Sažet očekivani odgovor s ključnim točkama koje kandidat mora spomenuti","obrazlozenje":"referenca (Članak X.)","clanak_refs":[id],"tezina":1-5}
Pravila: pitanje potiče OBJAŠNJENJE i primjenu u praksi (ne da/ne) · "tocno" je golden answer s 2-4 ključne točke (server-only, NIKAD kandidatu) · realno za usmeni ispit gdje komisija procjenjuje razumijevanje.`;
// ⭐ v137 — MENTOR mikro-tutor "Zašto?": kratko objašnjenje zašto je točan točan (i zašto je kandidatov izbor kriv).
const P_ZASTO = `Ti si strpljiv mentor za stručni ispit iz graditeljstva u Hrvatskoj. Kandidat je odgovorio na pismeno pitanje. Objasni KRATKO (3-5 rečenica, na "ti"): zašto je TOČAN odgovor točan i — ako je kandidat pogriješio — zašto je baš njegov odabir kriv. Osloni se na priloženo obrazloženje i izvor propisa; NE izmišljaj brojeve članaka ni podatke kojih nema u izvoru. Bez uvoda, bez ponavljanja pitanja — izravno na bit, tonom mentora koji podučava.`;
// ⭐ v144 — kontekstualno sređivanje izdiktiranog (glasom) hrvatskog teksta. Ispravlja fonetske promašaje STT-a po SMISLU rečenice.
// ⭐ v145 — MENTOR "Objasni primjerom": oživi suhoparni članak kroz konkretnu situaciju s gradilišta.
const P_PRIMJER = `Ti si mentor za stručni ispit iz graditeljstva u Hrvatskoj koji suhoparne propise objašnjava kroz KONKRETNE primjere. Kandidat je odgovorio na pismeno pitanje. Objasni zašto je TOČAN odgovor točan kroz živ, konkretan primjer iz prakse ovlaštenog inženjera / sa stvarnog gradilišta.
Struktura (na "ti", 6-10 rečenica): 1) kratka, konkretna situacija s terena koja pokazuje pravilo na djelu; 2) što se u njoj događa po pravilu i zašto baš tako; 3) poveži s propisom (pozovi se na priloženi izvor — NE izmišljaj brojeve članaka ni podatke kojih nema). Cilj je da kandidat pravilo ZAPAMTI jer ga vidi u primjeru. Bez uvoda i bez ponavljanja pitanja — počni odmah situacijom.`;
const P_GLAS = `Ispravljaš tekst koji je korisnik izdiktirao glasom na hrvatskom. Vrati ISKLJUČIVO ispravljen tekst — bez uvoda, bez navodnika, bez objašnjenja i bez odgovaranja na sadržaj.
Pravila: ispravi pravopis, gramatiku i očite pogreške glasovnog prepoznavanja prema SMISLU rečenice (npr. "pravomošnost"→"pravomoćnost", "obaveštava"→"obavještava", "uslov"→"uvjet"). Koristi hrvatski standardni jezik (ijekavica). NE mijenjaj značenje, NE dodaji i NE izbacuj sadržaj — samo ispravi oblik riječi. Ako je tekst već ispravan, vrati ga nepromijenjenog.`;
function pokusajJson(t) { // ⭐ v047 — model ponekad omota JSON; režemo ograde i vanjski tekst
  try {
    let x = String(t || '').replace(/\u0060\u0060\u0060json|\u0060\u0060\u0060/g, '').trim();
    const a = x.indexOf('{'), b = x.lastIndexOf('}');
    if (a >= 0 && b > a) x = x.slice(a, b + 1);
    return JSON.parse(x);
  } catch (_) { return null; }
}

// Anthropic poziv — retry politika 🔒: 429/529 -> 1 s -> retry -> 2 s -> retry -> odustani; timeout 60 s
async function anthropicPoziv(model, system, messages, maxTokens, temp) {
  const spavaj = (ms) => new Promise(r => setTimeout(r, ms));
  for (let pokusaj = 0; ; pokusaj++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 60000);
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens || 1600, ...(modelBezTemp(model) ? {} : { temperature: temp === undefined ? 0.2 : temp }), // ⭐ v040
          system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }], // 💰 prompt caching 🔒
          messages }) });
      clearTimeout(t);
      if ((r.status === 429 || r.status === 529) && pokusaj < 2) { await spavaj(1000 * (pokusaj + 1)); continue; }
      const d = await r.json();
      if (!r.ok) throw new Error((d.error && d.error.message) || ('Anthropic HTTP ' + r.status));
      return { tekst: (d.content || []).filter(x => x.type === 'text').map(x => x.text).join(''),
               in: (d.usage && d.usage.input_tokens) || 0, out: (d.usage && d.usage.output_tokens) || 0 };
    } catch (e) {
      clearTimeout(t);
      if (pokusaj < 2 && /abort|fetch|network/i.test(String(e.message))) { await spavaj(1000 * (pokusaj + 1)); continue; }
      throw e;
    }
  }
}
// ⭐ v035 — F15: streaming varijanta (SSE): onDelta prima tekstualne delte; vraća pun tekst+usage.
async function anthropicStream(model, system, messages, maxTokens, temp, onDelta) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 90000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens || 1600, ...(modelBezTemp(model) ? {} : { temperature: temp === undefined ? 0.2 : temp }), // ⭐ v040
        stream: true,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages }) });
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d.error && d.error.message) || ('Anthropic HTTP ' + r.status)); }
    const rd = r.body.getReader(); const dec = new TextDecoder();
    let buf = '', tekst = '', tin = 0, tout = 0;
    for (;;) {
      const { done, value } = await rd.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const dijelovi = buf.split('\n\n'); buf = dijelovi.pop();
      for (const blok of dijelovi) {
        const linija = blok.split('\n').find(x => x.startsWith('data:'));
        if (!linija) continue;
        try {
          const e = JSON.parse(linija.slice(5));
          if (e.type === 'error') throw new Error((e.error && e.error.message) || 'Anthropic stream error'); // ⭐ v036
          if (e.type === 'content_block_delta' && e.delta && e.delta.type === 'text_delta') { tekst += e.delta.text; onDelta(e.delta.text); }
          if (e.type === 'message_start' && e.message && e.message.usage) tin = e.message.usage.input_tokens || 0;
          if (e.type === 'message_delta' && e.usage) tout = e.usage.output_tokens || tout;
        } catch (_) {}
      }
    }
    clearTimeout(t);
    return { tekst, in: tin, out: tout };
  } catch (e) { clearTimeout(t); throw e; }
}

// Voyage embeddingi — input_type document/query asimetrija 🔒; batch <=64; retry 429
async function voyageEmbed(tekstovi, inputType) {
  const out = [];
  for (let i = 0; i < tekstovi.length; i += 64) {
    // ⭐ v121 — zaštita: Voyage vraća 400 na prazan string. Prazne dijelove zamijeni razmakom
    // (embedding im nije bitan, ali očuvamo poravnanje out[i] ↔ dijelovi[i]).
    const batch = tekstovi.slice(i, i + 64).map(t => (t && t.trim()) ? t : ' ');
    // ⭐ v118 — robusni retry za cjelodnevni ingest: 6 pokušaja, eksponencijalni backoff,
    // hvata 429 (rate limit) i 5xx i mrežne greške. ⭐ v121 — trajni 4xx (osim 429) NE retrya (uzalud
    // troši 6 pokušaja ~60s); odmah javi jer je to greška zahtjeva, ne privremeni problem.
    let d = null;
    for (let pokusaj = 0; pokusaj < 6; pokusaj++) {
      try {
        const r = await fetch('https://api.voyageai.com/v1/embeddings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (process.env.VOYAGE_API_KEY || '') },
          body: JSON.stringify({ model: 'voyage-law-2', input: batch, input_type: inputType }) });
        if ((r.status === 429 || r.status >= 500) && pokusaj < 5) {
          const cekaj = Math.min(30000, 2000 * Math.pow(2, pokusaj)); // 2s,4s,8s,16s,30s
          await new Promise(x => setTimeout(x, cekaj)); continue;
        }
        d = await r.json();
        if (!r.ok) { const e = new Error(d.detail || d.error || 'Voyage HTTP ' + r.status); e.trajna = (r.status >= 400 && r.status < 500 && r.status !== 429); throw e; }
        break;
      } catch (e) {
        if (e.trajna) throw e;                                 // ⭐ v121 — klijentska greška: ne troši pokušaje
        if (pokusaj < 5) { await new Promise(x => setTimeout(x, Math.min(30000, 2000 * Math.pow(2, pokusaj)))); continue; }
        throw e; // nakon 6 pokušaja predaj grešku gore
      }
    }
    if (!d || !Array.isArray(d.data)) throw new Error('Voyage odgovor bez podataka'); // ⭐ v121 — obrana od d=null
    for (const e of d.data) out.push(e.embedding);
  }
  return out;
}
const vec = (a) => '[' + a.join(',') + ']'; // -> ::vector parametar
// ⭐ v040/v070 — modeli koji NE primaju sampling parametre (temperature…): vraćaju 400.
// Sonnet 5 / Fable / Mythos generacija + noviji Opus (4.7, 4.8 i dalje) su deprecirali temperature.
const modelBezTemp = (m) => {
  const s = String(m || '');
  if (/sonnet-5|fable|mythos/.test(s)) return true;
  const opus = s.match(/opus-(\d+)-(\d+)/);              // npr. opus-4-8 -> [4,8]
  if (opus) { const maj = +opus[1], min = +opus[2]; if (maj > 4 || (maj === 4 && min >= 7)) return true; }
  return false;
};
// ⭐ v028 — Voyage rerank (cross-encoder): pitanje + kandidati -> stvarna relevantnost.
// Model iz ENV-a 🔒; 200M free tokena za rerank-2.5 klasu. Pad -> RRF poredak (graceful).
async function voyageRerank(query, dokumenti) {
  const r = await fetch('https://api.voyageai.com/v1/rerank', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (process.env.VOYAGE_API_KEY || '') },
    body: JSON.stringify({ model: process.env.VOYAGE_RERANK_MODEL || 'rerank-2.5-lite',
      query, documents: dokumenti, top_k: Math.min(dokumenti.length, 32) }) }); // ⭐ v029: 24->32
  const d = await r.json();
  if (!r.ok) throw new Error(d.detail || d.error || 'Voyage rerank HTTP ' + r.status);
  return d.data.map(x => x.index); // indeksi kandidata, najrelevantniji prvi
}

// CHUNKER 🔓 (07 §2): clanak <=450 tok = 1 chunk; veci po stavcima (N), 2-5 do ~400,
// preklop = zadnji stavak prethodnog; zaglavlje "[dokument — oznaka naslov] "
const tokGruba = (s) => Math.ceil(s.length / 3.6);
function chunkiraj(dokument, oznaka, naslov, tekst) {
  const glava = `[${dokument} — ${oznaka}${naslov ? ' ' + naslov : ''}] `;
  if (tokGruba(glava + tekst) <= 450) return [glava + tekst];
  const stavci = tekst.split('\n').filter(Boolean);
  const chunks = []; let buf = [];
  const flush = () => { if (buf.length) { chunks.push(glava + buf.join('\n')); } };
  for (const s of stavci) {
    buf.push(s);
    if (buf.length >= 2 && (tokGruba(glava + buf.join('\n')) > 400 || buf.length >= 5)) {
      flush(); buf = [buf[buf.length - 1]];              // preklop: zadnji stavak
    }
  }
  if (buf.length > 1 || chunks.length === 0) flush();
  if (chunks.length === 0) chunks.push(glava.trim()); // ⭐ v119 — nikad prazno (prazan tekst bi inače vratio [] → 0 chunkova → vječna petlja u ingestu)
  return chunks;
}

// RETRIEVAL (07 §3): planner -> (vector+FTS)×pod-upiti -> RRF -> diversitet -> top12
async function dohvatiIzvoreImpl(pitanje, opts) {
  opts = opts || {}; // ⭐ v032 — {bezReranka:true} za masovna mapiranja (uvoz rok-pitanja)
  let plan = { pod_upiti: [pitanje], kljucni_pojmovi: [] };
  if (!opts.bezPlannera) { // ⭐ v041 — alatni upiti (trazi_propise) su već ciljani: preskoči planner (trošak+latencija)
  try {
    const p = await anthropicPoziv(process.env.MODEL_PLANNER, P2_PLANNER,
      [{ role: 'user', content: pitanje }], 300, 0);
    const j = JSON.parse(p.tekst.replace(/```json|```/g, '').trim());
    if (Array.isArray(j.pod_upiti) && j.pod_upiti.length) plan = j;
  } catch (_) { /* planner pad -> pitanje kao jedini upit */ }
  } // ⭐ v041
  // ⭐ v027 tuning-1: originalno pitanje uvijek prvi upit + plannerovi pod-upiti (max 5)
  const podUpiti = [...new Set([pitanje, ...plan.pod_upiti])].slice(0, 5);
  let upozorenje = null;
  let embeds = null;
  try { embeds = await voyageEmbed(podUpiti, 'query'); }
  catch (_) { upozorenje = 'smanjena_preciznost'; }        // Voyage down -> FTS-only (07 §10)
  const score = new Map(); const info = new Map();
  const dodaj = (rows) => rows.forEach((r, rank) => {
    score.set(r.id, (score.get(r.id) || 0) + 1 / (60 + rank + 1));  // RRF k=60
    if (!info.has(r.id)) info.set(r.id, r);
  });
  for (let i = 0; i < podUpiti.length; i++) {
    if (embeds) {
      const rv = await q(`SELECT ch.id, ch.clanak_id, ch.tekst, c.oznaka, c.naslov, c.dokument_id, d.naziv AS dokument
        FROM chunkovi ch JOIN clanci c ON c.id=ch.clanak_id JOIN dokumenti d ON d.id=c.dokument_id
        WHERE ch.embedding IS NOT NULL AND c.status='aktivan'
        ORDER BY ch.embedding <=> $1::vector LIMIT 12`, [vec(embeds[i])]); // ⭐ v027: 8->12
      dodaj(rv.rows);
    }
    const rf = await q(`SELECT ch.id, ch.clanak_id, ch.tekst, c.oznaka, c.naslov, c.dokument_id, d.naziv AS dokument
      FROM chunkovi ch JOIN clanci c ON c.id=ch.clanak_id JOIN dokumenti d ON d.id=c.dokument_id
      WHERE c.status='aktivan' AND ch.fts @@ websearch_to_tsquery('simple', unaccent($1))
      ORDER BY ts_rank(ch.fts, websearch_to_tsquery('simple', unaccent($1))) DESC LIMIT 12`, [podUpiti[i]]); // ⭐ v027: 8->12
    dodaj(rf.rows);
    // ⭐ v028 — kanal C: pg_trgm word_similarity (HR morfologija: dozvola/dozvolom, radilište/gradilište).
    // Lokalni mini-eval: FTS-only 7% vs TRGM-only 83% na 30 pitanja — dokazano nužan.
    const rt = await q(`SELECT ch.id, ch.clanak_id, ch.tekst, c.oznaka, c.naslov, c.dokument_id, d.naziv AS dokument
      FROM chunkovi ch JOIN clanci c ON c.id=ch.clanak_id JOIN dokumenti d ON d.id=c.dokument_id
      WHERE c.status='aktivan'
      ORDER BY word_similarity(unaccent(lower($1)), unaccent(lower(ch.tekst))) DESC LIMIT 12`, [podUpiti[i]]);
    dodaj(rt.rows);
  }
  let rang = [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => info.get(id));
  // ⭐ v028 — RERANK sloj: cross-encoder presloži top-40 RRF kandidata po stvarnoj
  // relevantnosti prema ORIGINALNOM pitanju; pad -> ostaje RRF poredak (graceful).
  let rerankOk = false; // ⭐ v030
  if (!opts.bezReranka && rang.length > 2) { // ⭐ v032
    try {
      const kand = rang.slice(0, 60); // ⭐ v029: 40->60 — rerank vidi i duboke kandidate
      const redoslijed = await voyageRerank(pitanje, kand.map(x => x.tekst.slice(0, 2200)));
      rang = redoslijed.map(i => kand[i]).concat(rang.slice(60)); // ⭐ v030 fix: rep 40->60 (bez duplikata)
      rerankOk = true;
    } catch (_) { upozorenje = upozorenje || 'smanjena_preciznost'; }
  }
  const poDok = {}, poCl = {}, izvori = [];                 // diversitet 🔒: <=3/dokument, <=2/clanak
  for (const r of rang) {
    if (izvori.length >= 12) break;
    poDok[r.dokument_id] = (poDok[r.dokument_id] || 0);
    poCl[r.clanak_id] = (poCl[r.clanak_id] || 0);
    // ⭐ v030 — dok-cap NAKON reranka 6 (cross-encoder zna relevantnost; pravna pitanja
    // legitimno žive u 5-6 članaka istog zakona), u RRF fallbacku ostaje 4 (šum stvaran).
    if (poDok[r.dokument_id] >= (rerankOk ? 6 : 4) || poCl[r.clanak_id] >= 2) continue;
    poDok[r.dokument_id]++; poCl[r.clanak_id]++;
    izvori.push(r);
  }
  return { izvori, upozorenje, plan };
}

// POST-PROVJERA CITATA KODOM 🔒 (07 §4): [n] ∈ poslani; spomenute oznake ∈ oznake izvora
function provjeriCitate(tekst, izvori) {
  const problemi = [];
  const maxN = izvori.length;
  for (const m of tekst.matchAll(/\[(\d{1,2})\]/g)) {
    const n = parseInt(m[1], 10);
    if (n < 1 || n > maxN) problemi.push(`[${n}] nije među priloženim izvorima (1-${maxN})`);
  }
  const dopusteneOzn = new Set(izvori.map(x => (x.oznaka.match(/\d+\.?[a-z]?/) || [''])[0].replace(/\.$/, '')));
  for (const m of tekst.matchAll(/[Čč]lan(?:ak|ka|ku)\s+(\d+\.?[a-z]?)/g)) {
    const br = m[1].replace(/\.$/, '');
    if (!dopusteneOzn.has(br)) problemi.push(`Članak ${m[1]} nije među izvorima`);
  }
  return problemi;
}

// ⭐ v147 — označi citate čiji članak sadrži sliku tablice (TABLICA_SLIKA) → klijent prikaže "📊 Vidi tablicu" link.
async function obogatiTablicom(citati) {
  try {
    const ids = [...new Set((citati || []).map(c => c.clanak_id).filter(Boolean))];
    if (!ids.length) return citati;
    const rt = await q(`SELECT id FROM clanci WHERE id = ANY($1::int[]) AND tekst LIKE '%TABLICA_SLIKA:%'`, [ids]);
    const s = new Set(rt.rows.map(r => r.id));
    for (const c of citati) if (s.has(c.clanak_id)) c.tablica = true;
  } catch (_) { /* nikad ne ruši odgovor zbog ovoga */ }
  return citati;
}

// ═══════════ ⭐ v041 — F15.5: Vještak v2 mozak — agentska tool-use petlja (13 §1) ═══════════
// Model prije odgovora smije do MAX_KRUGOVA puta pozvati alate; svaki rezultat ulazi u
// kontekst kao novi numerirani izvor [n]; korisniku se streama SSE {status:"🔍 tražim…"};
// budžet tokena po pitanju (ENV AI_PETLJA_BUDZET); post-check citata 🔒 radi nad NARASLIM izvorima.
const AI_MAX_KRUGOVA = 4;                                    // 13 §1 🔒: max 4 kruga alata
const AI_MAX_IZVORA = 24;                                    // zaštita konteksta (početnih 12 + alatni)
const aiPetljaBudzet = () => parseInt(process.env.AI_PETLJA_BUDZET || '30000', 10); // tok in+out po pitanju

const AI_ALATI = [
  { name: 'trazi_propise',
    description: 'Pretraži bazu hrvatskih propisa u graditeljstvu novim ciljanim upitom (terminologija propisa, imenska fraza). Koristi kad priloženi izvori ne pokrivaju dio pitanja. Vraća do 8 najrelevantnijih odlomaka kao nove numerirane izvore.',
    input_schema: { type: 'object', properties: {
      upit: { type: 'string', description: 'kratki pretraživački upit, npr. "jamstvo za solidnost građevine rok"' } },
      required: ['upit'] } },
  { name: 'procitaj_clanak',
    description: 'Dohvati PUNI tekst određenog članka propisa + susjedne članke (kontekst). Koristi kad trebaš točan sadržaj, cijelo nabrajanje ili kad odredba upućuje na susjedni članak.',
    input_schema: { type: 'object', properties: {
      dokument: { type: 'string', description: 'naziv ili kratica propisa, npr. "Zakon o gradnji" ili "ZOG"' },
      oznaka: { type: 'string', description: 'oznaka članka, npr. "Članak 153.", "153." ili "čl. 153"' } },
      required: ['dokument', 'oznaka'] } },
  { name: 'clanak_na_dan',
    description: 'Dohvati verziju članka koja je VRIJEDILA na određeni datum (povijesni presjek — sporovi, ugovori, stanja prije izmjene propisa). Vraća tekst te verzije s razdobljem važenja i NN izvorom.',
    input_schema: { type: 'object', properties: {
      dokument: { type: 'string', description: 'naziv ili kratica propisa' },
      oznaka: { type: 'string', description: 'oznaka članka' },
      datum: { type: 'string', description: 'datum u formatu YYYY-MM-DD' } },
      required: ['dokument', 'oznaka', 'datum'] } },
];

// Kratice -> puni nazivi (isti rječnik kao P1/P2) + fuzzy ILIKE po nazivu dokumenta.
const KRATICE_DOK = { 'zog': 'Zakon o gradnji', 'zg': 'Zakon o gradnji', 'zopu': 'Zakon o prostornom uređenju',
  'znr': 'Zakon o zaštiti na radu', 'zop': 'Zakon o zaštiti od požara', 'zzop': 'Zakon o zaštiti od požara',
  'zup': 'Zakon o općem upravnom postupku', 'zoo': 'Zakon o obveznim odnosima' };
async function nadjiDokument(ime) {
  const s = String(ime || '').trim();
  if (!s) return { dok: null, poruka: 'Nedostaje naziv dokumenta.' };
  const puni = KRATICE_DOK[s.toLowerCase().replace(/[^a-zčćžšđ]/gi, '')] || s;
  let r = await q(`SELECT id, naziv FROM dokumenti WHERE status='aktivno' AND naziv=$1 LIMIT 1`, [puni]);
  if (!r.rowCount)
    r = await q(`SELECT id, naziv FROM dokumenti WHERE status='aktivno' AND naziv ILIKE $1 ORDER BY naziv LIMIT 3`, ['%' + puni + '%']);
  if (!r.rowCount) return { dok: null, poruka: `Ne nalazim propis "${s}" u bazi. Pokušaj trazi_propise s pojmom iz pitanja.` };
  const tocan = r.rows.find(x => x.naziv.toLowerCase() === puni.toLowerCase()); // case-insensitive pogodak pobjeđuje
  if (tocan) return { dok: tocan, poruka: null };
  if (r.rowCount > 1) return { dok: null, poruka: `Naziv "${s}" je višeznačan: ${r.rows.map(x => x.naziv).join(' · ')}. Ponovi s točnim nazivom.` };
  return { dok: r.rows[0], poruka: null };
}
// "Članak 153.a" / "čl. 153" / "153." -> normalizirani ključ "153a"
const oznKljuc = (s) => { const m = String(s || '').match(/(\d+)\s*\.?\s*([a-zčćžšđ])?/i); return m ? m[1] + (m[2] || '').toLowerCase() : ''; };

// Dedup ključ izvora: chunk id kad postoji, inače clanak+početak teksta (mock/alatni izvori nemaju ch.id)
const izvorKljuc = (x) => x.id != null ? 'ch' + x.id : 'cl' + x.clanak_id + ':' + String(x.tekst || '').slice(0, 40);
function dodajIzvor(ctx, x) {                                // vraća {n, nov}
  const klj = izvorKljuc(x);
  const post = ctx.izvori.findIndex(y => izvorKljuc(y) === klj);
  if (post >= 0) return { n: post + 1, nov: false };
  if (ctx.izvori.length >= AI_MAX_IZVORA) return { n: 0, nov: false };
  ctx.izvori.push(x);
  return { n: ctx.izvori.length, nov: true };
}
const fmtIzvor = (n, x, cap) => `[${n}] ${x.dokument} — ${x.oznaka}${x.naslov ? ' ' + x.naslov : ''}: ${String(x.tekst).slice(0, cap || 1800)}`;

async function alatTraziPropise(input, ctx) {
  const upit = String((input || {}).upit || '').trim().slice(0, 200);
  if (!upit) return 'Nedostaje upit.';
  const { izvori } = await ctx.fnI(upit, { bezPlannera: true });  // top-liste iz retrievala v2
  const linije = []; let preko = false;
  for (const x of izvori.slice(0, 8)) {
    const { n } = dodajIzvor(ctx, x);
    if (!n) { preko = true; continue; }
    linije.push(fmtIzvor(n, x));
  }
  if (!linije.length) return preko ? 'Limit izvora je dosegnut — radi s postojećim izvorima.'
    : `Pretraga "${upit}" nije našla ništa novo. Preformuliraj terminologijom propisa ili odgovori s postojećim izvorima.`;
  return 'NOVI IZVORI:\n' + linije.join('\n\n') + (preko ? '\n\n(Limit izvora dosegnut — dio rezultata izostavljen.)' : '');
}

async function alatProcitajClanak(input, ctx) {
  const { dok, poruka } = await nadjiDokument((input || {}).dokument);
  if (!dok) return poruka;
  const klj = oznKljuc((input || {}).oznaka);
  if (!klj) return 'Ne prepoznajem oznaku članka — očekujem npr. "Članak 153." ili "153.".';
  const rc = await q(`SELECT c.id, c.oznaka, c.naslov, c.tekst, c.redoslijed, c.dokument_id, c.status
    FROM clanci c WHERE c.dokument_id=$1 ORDER BY c.redoslijed LIMIT 900`, [dok.id]);
  const pogodci = rc.rows.filter(x => x.status !== 'brisan' && oznKljuc(x.oznaka) === klj);
  if (!pogodci.length) {
    const brisan = rc.rows.find(x => x.status === 'brisan' && oznKljuc(x.oznaka) === klj);
    if (brisan) return `${brisan.oznaka} propisa "${dok.naziv}" je BRISAN izmjenom zakona ili pravilnika. Za tekst koji je vrijedio prije brisanja koristi clanak_na_dan s datumom.`;
    return `U propisu "${dok.naziv}" ne nalazim članak s oznakom "${input.oznaka}" (propis ima ${rc.rowCount} jedinica). Provjeri broj ili koristi trazi_propise.`;
  }
  const cl = pogodci[0];                                     // duplikatne oznake (prijelazne odredbe novela): prvi + napomena
  const cijeli = { id: 'cl-pun-' + cl.id, clanak_id: cl.id, oznaka: cl.oznaka, naslov: cl.naslov,
    dokument_id: cl.dokument_id, dokument: dok.naziv, tekst: String(cl.tekst).slice(0, 7000) };
  // ako članak već postoji kao chunk-izvor: zamijeni tekst PUNIM (isti [n] — numeracija stabilna)
  const postIdx = ctx.izvori.findIndex(y => y.clanak_id === cl.id);
  let n;
  if (postIdx >= 0) { ctx.izvori[postIdx] = { ...cijeli, id: ctx.izvori[postIdx].id != null ? ctx.izvori[postIdx].id : cijeli.id }; n = postIdx + 1; }
  else { const d = dodajIzvor(ctx, cijeli); n = d.n; }
  if (!n) return 'Limit izvora je dosegnut — radi s postojećim izvorima.';
  const dijelovi = ['[' + n + '] ' + cijeli.dokument + ' — ' + cijeli.oznaka + (cijeli.naslov ? ' ' + cijeli.naslov : '') + ' (PUNI TEKST): ' + cijeli.tekst];
  const idx = rc.rows.findIndex(x => x.id === cl.id);        // susjed-kontekst (13 §1)
  for (const sus of [rc.rows[idx - 1], rc.rows[idx + 1]]) {
    if (!sus || sus.status === 'brisan') continue;
    const sx = { id: 'cl-sus-' + sus.id, clanak_id: sus.id, oznaka: sus.oznaka, naslov: sus.naslov,
      dokument_id: sus.dokument_id, dokument: dok.naziv, tekst: String(sus.tekst).slice(0, 900) };
    if (ctx.izvori.some(y => y.clanak_id === sus.id)) continue;
    const d = dodajIzvor(ctx, sx);
    if (d.n) dijelovi.push(fmtIzvor(d.n, sx, 900) + ' (susjedni članak)');
  }
  if (pogodci.length > 1) dijelovi.push(`Napomena: u propisu postoji još ${pogodci.length - 1} jedinica s istom oznakom (prijelazne odredbe izmjena).`);
  return dijelovi.join('\n\n');
}

async function alatClanakNaDan(input, ctx) {
  const { dok, poruka } = await nadjiDokument((input || {}).dokument);
  if (!dok) return poruka;
  const klj = oznKljuc((input || {}).oznaka);
  const datum = String((input || {}).datum || '').slice(0, 10);
  if (!klj) return 'Ne prepoznajem oznaku članka.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return 'Datum mora biti u formatu YYYY-MM-DD.';
  const rc = await q(`SELECT c.id, c.oznaka FROM clanci c WHERE c.dokument_id=$1 ORDER BY c.redoslijed LIMIT 900`, [dok.id]); // i brisani — povijest je poanta
  const cl = rc.rows.find(x => oznKljuc(x.oznaka) === klj);
  if (!cl) return `U propisu "${dok.naziv}" ne nalazim članak "${input.oznaka}" (ni među brisanima).`;
  const rv = await q(`SELECT oznaka, naslov, tekst, vrijedi_od, vrijedi_do, nn_izvor FROM clanci_verzije
    WHERE clanak_id=$1 AND vrijedi_od<=$2 AND (vrijedi_do IS NULL OR vrijedi_do>$2)
    ORDER BY id DESC LIMIT 1`, [cl.id, datum]);              // isti presjek kao F4 ruta /api/clanak?na_dan
  if (!rv.rowCount) return `Na dan ${datum} nije postojala verzija članka ${cl.oznaka} (stupanje na snagu je kasnije).`;
  const v = rv.rows[0];
  const fd = (x) => { try { return new Date(x).toISOString().slice(0, 10); } catch (_) { return String(x).slice(0, 10); } }; // DATE -> YYYY-MM-DD
  const raspon = `vrijedi od ${fd(v.vrijedi_od)}${v.vrijedi_do ? ' do ' + fd(v.vrijedi_do) : ' (aktualna)'}${v.nn_izvor ? ', ' + v.nn_izvor : ''}`;
  const x = { id: 'cl-dan-' + cl.id + '-' + datum, clanak_id: cl.id, oznaka: v.oznaka, naslov: v.naslov,
    dokument_id: dok.id, dokument: dok.naziv, tekst: `[verzija na dan ${datum}; ${raspon}] ` + String(v.tekst).slice(0, 6500) };
  const d = dodajIzvor(ctx, x);
  if (!d.n) return 'Limit izvora je dosegnut — radi s postojećim izvorima.';
  return fmtIzvor(d.n, x, 7000) + (v.vrijedi_do ? '\n\nPOZOR: ovo je POVIJESNA verzija — u odgovoru izričito navedi na koji se datum odnosi.' : '');
}

const AI_STATUS = { trazi_propise: (i) => '🔍 tražim: ' + String((i || {}).upit || '').slice(0, 80),
  procitaj_clanak: (i) => '📖 čitam: ' + String((i || {}).dokument || '').slice(0, 40) + ' ' + String((i || {}).oznaka || '').slice(0, 20),
  clanak_na_dan: (i) => '📅 provjeravam ' + String((i || {}).dokument || '').slice(0, 40) + ' ' + String((i || {}).oznaka || '').slice(0, 20) + ' na dan ' + String((i || {}).datum || '').slice(0, 10) };
async function izvrsiAlat(name, input, ctx) {                // nikad ne baca — petlja mora preživjeti kvar alata
  try {
    if (name === 'trazi_propise') return await alatTraziPropise(input, ctx);
    if (name === 'procitaj_clanak') return await alatProcitajClanak(input, ctx);
    if (name === 'clanak_na_dan') return await alatClanakNaDan(input, ctx);
    return 'Nepoznat alat: ' + name;
  } catch (e) { return 'Alat trenutno nedostupan (' + String(e.message).slice(0, 120) + ') — odgovori s postojećim izvorima.'; }
}

// Streaming Anthropic poziv S ALATIMA: parsira tool_use blokove (input_json_delta) i stop_reason.
// Ista retry/timeout disciplina kao anthropicStream 🔒; tools=null => običan poziv (prisilni završetak).
async function anthropicStreamAlati(model, system, messages, maxTokens, tools, onDelta) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 90000);
  // ⭐ v065/v072 — extended thinking za Vještak (teški pravni upiti, samokritičnost). ENV AI_THINKING=1.
  // Noviji modeli (Opus 4.7/4.8, Sonnet 5, Fable/Mythos) NE primaju type:enabled+budget_tokens (400) — koriste type:adaptive.
  // Stariji (Opus 4.6, Sonnet 4.6) koriste type:enabled + budget_tokens. Zato biramo format po modelu.
  const thinkUkljucen = process.env.AI_THINKING === '1';
  const noviThink = modelBezTemp(model);                    // isti skup modela: novi API (adaptive + bez temperature)
  const budzMisli = parseInt(process.env.AI_THINKING_BUDZET || '2000', 10) || 2000;
  const misli = thinkUkljucen;                              // koristi li se ikakav thinking (za max_tokens i thinking-blok parsing)
  const thinkCfg = !thinkUkljucen ? null
    : (noviThink ? { type: 'adaptive' } : { type: 'enabled', budget_tokens: budzMisli });
  const maxT = misli ? Math.max((maxTokens || 1600) + budzMisli, budzMisli + 1024) : (maxTokens || 1600);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxT,
        ...(thinkCfg ? { thinking: thinkCfg } : (modelBezTemp(model) ? {} : { temperature: 0.2 })), // ⭐ v072 — adaptive/enabled po modelu; bez temp za nove modele
        stream: true, ...(tools && tools.length ? { tools } : {}),
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }], // 💰 caching 🔒
        messages }) });
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d.error && d.error.message) || ('Anthropic HTTP ' + r.status)); }
    const rd = r.body.getReader(); const dec = new TextDecoder();
    let buf = '', tekst = '', tin = 0, tout = 0, stop = null;
    const bloc = {}; const alati = []; const misliMap = {}; const misliBlok = []; // ⭐ v065 — misli: thinking-blokovi u izgradnji; misliBlok: gotovi (za tool-use kontinuitet)
    for (;;) {
      const { done, value } = await rd.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const dijelovi = buf.split('\n\n'); buf = dijelovi.pop();
      for (const blok of dijelovi) {
        const linija = blok.split('\n').find(x => x.startsWith('data:'));
        if (!linija) continue;
        try {
          const e = JSON.parse(linija.slice(5));
          if (e.type === 'error') throw new Error((e.error && e.error.message) || 'Anthropic stream error');
          if (e.type === 'content_block_start' && e.content_block && e.content_block.type === 'tool_use')
            bloc[e.index] = { id: e.content_block.id, name: e.content_block.name, json: '' };
          if (e.type === 'content_block_start' && e.content_block && (e.content_block.type === 'thinking' || e.content_block.type === 'redacted_thinking'))
            misliMap[e.index] = { type: e.content_block.type, thinking: '', signature: '', data: e.content_block.data || '' }; // ⭐ v065
          if (e.type === 'content_block_delta' && e.delta) {
            if (e.delta.type === 'text_delta') { tekst += e.delta.text; if (onDelta) onDelta(e.delta.text); }
            if (e.delta.type === 'input_json_delta' && bloc[e.index]) bloc[e.index].json += e.delta.partial_json || '';
            if (e.delta.type === 'thinking_delta' && misliMap[e.index]) misliMap[e.index].thinking += e.delta.thinking || ''; // ⭐ v065 — NE šalje se korisniku
            if (e.delta.type === 'signature_delta' && misliMap[e.index]) misliMap[e.index].signature += e.delta.signature || '';
          }
          if (e.type === 'content_block_stop' && bloc[e.index]) {
            const b = bloc[e.index]; let inp = {};
            try { inp = b.json ? JSON.parse(b.json) : {}; } catch (_) {}
            alati.push({ id: b.id, name: b.name, input: inp }); delete bloc[e.index];
          }
          if (e.type === 'content_block_stop' && misliMap[e.index]) { // ⭐ v065 — završen thinking blok
            const m = misliMap[e.index];
            misliBlok.push(m.type === 'redacted_thinking' ? { type: 'redacted_thinking', data: m.data }
              : { type: 'thinking', thinking: m.thinking, signature: m.signature });
            delete misliMap[e.index];
          }
          if (e.type === 'message_start' && e.message && e.message.usage) tin = e.message.usage.input_tokens || 0;
          if (e.type === 'message_delta') { if (e.usage) tout = e.usage.output_tokens || tout;
            if (e.delta && e.delta.stop_reason) stop = e.delta.stop_reason; }
        } catch (err) { if (/Anthropic stream error|overloaded/i.test(String(err.message))) throw err; }
      }
    }
    clearTimeout(t);
    return { tekst, alati, stop, in: tin, out: tout, misliBlok }; // ⭐ v065 — thinking blokovi za tool-use kontinuitet
  } catch (e) { clearTimeout(t); throw e; }
}

// AGENTSKA PETLJA 13 §1 🔒: max 4 kruga alata -> prisilni završetak; budžet tokena; SSE status.
// fnStream(system, messages, tools|null, onDelta) -> {tekst, alati, stop, in, out} — injektabilno za testove.
async function vjestakPetlja(opts) {
  const { system, poruke, ctx, fnStream, salji } = opts;
  const budzet = aiPetljaBudzet();
  const msgs = [...poruke];
  let punTekst = '', tin = 0, tout = 0, krugova = 0;
  if (process.env.AI_THINKING === '1' && salji) salji({ status: '🤔 analiziram pitanje i mjerodavne propise…' }); // ⭐ v069 — Opus dubina vidljiva
  for (let i = 0; ; i++) {
    const prisili = krugova >= AI_MAX_KRUGOVA || (tin + tout) >= budzet;
    if (prisili && i > 0)
      msgs.push({ role: 'user', content: '[SUSTAV] Budžet pretrage je potrošen — odgovori SADA na temelju dosad prikupljenih izvora. Ako nešto nedostaje, navedi što (pravilo 3).' });
    let novi = false;                                        // \n\n spojnica među krugovima i u streamu i u spremljenom tekstu
    const onD = (d) => { if (!novi) { novi = true; if (punTekst && salji) salji({ t: '\n\n' }); } if (salji) salji({ t: d }); };
    const r = await fnStream(system, msgs, prisili ? null : AI_ALATI, onD);
    tin += r.in || 0; tout += r.out || 0;
    if (r.tekst) punTekst += (punTekst ? '\n\n' : '') + r.tekst;
    if (prisili || r.stop !== 'tool_use' || !(r.alati || []).length) break;
    krugova++;
    msgs.push({ role: 'assistant', content: [ ...((r.misliBlok || [])), // ⭐ v065 — thinking PRVI (API zahtijeva kad je enabled + tool_use)
      ...(r.tekst ? [{ type: 'text', text: r.tekst }] : []),
      ...r.alati.map(a => ({ type: 'tool_use', id: a.id, name: a.name, input: a.input })) ] });
    const rezultati = [];
    for (const a of r.alati) {
      const st = (AI_STATUS[a.name] || (() => '🔧 ' + a.name))(a.input);
      if (salji) salji({ status: st });                      // korisnik vidi ŠTO se traži prije izvršenja
      const rez = await izvrsiAlat(a.name, a.input, ctx);
      rezultati.push({ type: 'tool_result', tool_use_id: a.id, content: rez });
    }
    msgs.push({ role: 'user', content: rezultati });
  }
  return { tekst: punTekst, in: tin, out: tout, krugova, msgs };
}

// ⭐ v021 — potrošnja korisnika u USD za tekući mjesec (iz ai_poruke tokena).
// Cijene i budžeti iz ENV-a (USD/1M tokena; Sonnet-klasa defaulti) — lako mijenjaš bez koda.
const aiCijene = () => ({ cin: parseFloat(process.env.AI_CIJENA_IN || '3'), cout: parseFloat(process.env.AI_CIJENA_OUT || '15') });
const aiBudzet = (k) => k.je_superadmin ? Infinity
  : parseFloat(k.tier === 'pro' ? (process.env.AI_BUDZET_PRO || '10') : (process.env.AI_BUDZET_FREE || '1'));
async function aiPotrosnjaUsd(korisnikId) {
  const odMjeseca = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(); // pg-mem: bez date_trunc
  const r = await q(`SELECT COALESCE(SUM(p.tokeni_in),0)::bigint AS tin, COALESCE(SUM(p.tokeni_out),0)::bigint AS tout
    FROM ai_poruke p JOIN ai_razgovori r ON r.id=p.razgovor_id
    WHERE r.korisnik_id=$1 AND p.uloga='assistant' AND p.created_at >= $2`, [korisnikId, odMjeseca]);
  const r2 = await q(`SELECT COALESCE(SUM(tokeni_in),0)::bigint AS tin, COALESCE(SUM(tokeni_out),0)::bigint AS tout
    FROM clanak_pomoc WHERE korisnik_id=$1 AND created_at >= $2`, [korisnikId, odMjeseca]); // ⭐ v042 — Skraćeno/Primjer tereti generatora (keš je besplatan)
  const r3 = await q(`SELECT COALESCE(SUM(tokeni_in),0)::bigint AS tin, COALESCE(SUM(tokeni_out),0)::bigint AS tout
    FROM usmeni_sesije WHERE korisnik_id=$1 AND created_at >= $2`, [korisnikId, odMjeseca]); // ⭐ v047 — usmeni
  const { cin, cout } = aiCijene();
  return ((Number(r.rows[0].tin) + Number(r2.rows[0].tin) + Number(r3.rows[0].tin)) * cin
        + (Number(r.rows[0].tout) + Number(r2.rows[0].tout) + Number(r3.rows[0].tout)) * cout) / 1e6;
}

// ── rute ──
app.post('/api/admin/ai/ingest', auth, zahtijevajSuperadmin, async (req, res) => { // 💰
  try {
    if (!AI_ON()) return res.status(503).json({ error: 'AI privremeno nedostupan' });
    const { dokument_id, sve, dirty_only } = req.body || {};
    // ⭐ v118/v119 — SERIJSKI + ROBUSTAN ingest za cjelodnevni rad bez nadzora:
    //  • obradi najviše `limit` članaka po pozivu → vrati {preostalo}; klijent petlja (nema gateway timeouta)
    //  • per-članak TRANSAKCIJA (DELETE+INSERT atomarno) → nema djelomičnih chunkova ako proces padne
    //  • per-članak hvatanje greške: broji padove; nakon 3 pada članak ide na skip (poison NE blokira sve).
    //    Prolazni pad (Voyage kratko down) se retrya kroz serije jer članak nema chunkove dok ne uspije.
    global.__ingestFail = global.__ingestFail || new Map();
    global.__ingestSkip = global.__ingestSkip || new Set();
    if ((req.body || {}).reset_skip) { global.__ingestFail.clear(); global.__ingestSkip.clear(); } // ⭐ v119 — ručni reset poison-liste
    const limit = Math.min(200, Math.max(1, parseInt((req.body || {}).limit, 10) || 40));
    let uvjet = `c.status='aktivan'`; const par = [];
    if (dokument_id) { par.push(parseInt(dokument_id, 10)); uvjet += ` AND c.dokument_id=$${par.length}`; }
    else if (!sve) return res.status(400).json({ error: 'Zadaj dokument_id ili sve:true.' });
    if (dirty_only) uvjet += ` AND c.dirty=true`;
    const filtChunk = dirty_only ? '' : ` AND NOT EXISTS (SELECT 1 FROM chunkovi ch WHERE ch.clanak_id=c.id)`;
    const skipArr = [...global.__ingestSkip];
    const r = await q(`SELECT c.id, c.oznaka, c.naslov, c.tekst, d.naziv AS dokument
      FROM clanci c JOIN dokumenti d ON d.id=c.dokument_id
      WHERE ${uvjet}${filtChunk} AND NOT (c.id = ANY($${par.length + 1}::int[]))
      ORDER BY c.dokument_id, c.redoslijed LIMIT $${par.length + 2}`, [...par, skipArr, limit]);
    let chunkova = 0, embeddano = 0, greske = 0;
    for (const cl of r.rows) {
      try {
        const dijelovi = chunkiraj(cl.dokument, cl.oznaka, cl.naslov, cl.tekst);
        const emb = await voyageEmbed(dijelovi, 'document');   // 6 pokušaja + backoff unutra
        if (!Array.isArray(emb) || emb.length !== dijelovi.length) throw new Error('Voyage vratio ' + (emb ? emb.length : 0) + '/' + dijelovi.length + ' embeddinga'); // ⭐ v119 — spriječi vec(undefined)
        await withTx(async (c) => {                            // ⭐ v119 — atomarno: bez djelomičnih chunkova
          await c.query(`DELETE FROM chunkovi WHERE clanak_id=$1`, [cl.id]);
          const rv = await c.query(`SELECT id FROM clanci_verzije WHERE clanak_id=$1 AND vrijedi_do IS NULL ORDER BY id DESC LIMIT 1`, [cl.id]);
          const vid = rv.rowCount ? rv.rows[0].id : null;
          for (let i = 0; i < dijelovi.length; i++) {
            await c.query(`INSERT INTO chunkovi (clanak_id, verzija_id, redoslijed, tekst, tokeni, embedding, fts)
                     VALUES ($1,$2,$3,$4,$5,$6::vector, to_tsvector('simple', unaccent($4)))`,
              [cl.id, vid, i + 1, dijelovi[i], tokGruba(dijelovi[i]), vec(emb[i])]);
            chunkova++;
          }
          await c.query(`UPDATE clanci SET dirty=false WHERE id=$1`, [cl.id]);
        });
        global.__ingestFail.delete(cl.id);
        embeddano++;
      } catch (eArt) {
        greske++;
        const n = (global.__ingestFail.get(cl.id) || 0) + 1;
        global.__ingestFail.set(cl.id, n);
        if (n >= 3) global.__ingestSkip.add(cl.id);            // poison → preskoči (ovaj proces)
        // ⭐ v122 — DIJAGNOSTIKA: zapiši razlog pada da ga vidiš u appu i riješimo bug naknadno.
        global.__ingestGreske = global.__ingestGreske || [];
        global.__ingestGreske.unshift({ clanak_id: cl.id, dokument: cl.dokument, oznaka: cl.oznaka,
          razlog: String(eArt && eArt.message || eArt).slice(0, 300), pokusaj: n,
          preskocen: n >= 3, vrijeme: new Date().toISOString() });
        global.__ingestGreske = global.__ingestGreske.slice(0, 50); // zadnjih 50
        try { await q(`INSERT INTO sustav_meta (kljuc, vrijednost) VALUES ('ingest_greske',$1)
          ON CONFLICT (kljuc) DO UPDATE SET vrijednost=$1, azurirano=now()`,
          [JSON.stringify(global.__ingestGreske)]); } catch (_) {} // upis dijagnostike ne smije srušiti ingest
      }
    }
    // koliko još neingestanih ostaje (bez poison-preskočenih) — za napredak i petlju klijenta
    const rp = await q(`SELECT COUNT(*)::int AS n FROM clanci c WHERE ${uvjet}
      AND NOT EXISTS (SELECT 1 FROM chunkovi ch WHERE ch.clanak_id=c.id)
      AND NOT (c.id = ANY($${par.length + 1}::int[]))`, [...par, [...global.__ingestSkip]]);
    res.json({ ok: true, embeddano, chunkova, greske, preostalo: rp.rows[0].n, preskoceno_poison: global.__ingestSkip.size });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v135 — USMENI OBLAČIĆ PRAVI FIX: kratka riječ ("pristupačnost","platformu") lomila se nasred jer je kandidatov wrap (flex-column, min-width:0) STISKAO mjehurić na najmanju širinu pa fit-content kolabirao. Sad kandidatov wrap = text-align:right blok, mjehurić = inline-block (prati širinu teksta) + word-break:keep-all (ne lomi riječ). // ⭐ v134 — PISMENI OCJENJIVANJE ROBUSNO (točan javljao netočno unatoč v133): novo ocjenjivanje nađe INDEKS odabrane opcije po tekstu i INDEKS točne (iz pit.tocno bilo slovo "A", "A) tekst", ili pun tekst), pa usporedi indekse. Radi za SVE formate spremanja pitanja (slovo/tekst/s prefiksom/bez). Prije je pretpostavljao da je tocno uvijek slovo → padalo na drugim formatima. // ⭐ v133 — PISMENI OCJENJIVANJE FIX (pravi uzrok "točan=netočno"): server je rezao odgovor na slice(0,40) — ostatak iz doba kad je odgovor bio SLOVO ("A"). Otkad v131 šalje PUN TEKST opcije (200+ znakova), 40 znakova ga odsiječe pa se usporedba po tekstu NIKAD ne poklopi → svaki točan klik = netočno. Sad slice(0,2000). Ovo čini v131 shuffle konačno upotrebljivim. // ⭐ v132 — USMENI OBLAČIĆ FIX: kandidatov mjehurić overflow-wrap:break-word umjesto anywhere → kratka riječ ("iskustvo") se više NE lomi nasred ("iskust vo"), ide u novi red tek kad stvarno ne stane. Pismeni random (v131) potvrđen ispravnim — treba samo deploy+osvježavanje. // ⭐ v131 — PISMENI RANDOM DEFINITIVNO: klijent SAM miješa prikazani redoslijed (i ABC i tocno_netocno) Fisher-Yatesom pri svakom prikazu, šalje ČIST TEKST odabrane opcije (ne slovo), server ocjenjuje po TEKSTU i vraća tekst točne opcije, klijent boja po tekstu. Potpuno neovisno o serverskom miješanju — nema šanse za "uvijek A". Slova A/B/C/D su samo vizualne oznake prikaza. // ⭐ v130 — PISMENI TOCNO_NETOCNO FIX + USMENI MJEHURIĆ: (1) PRAVI UZROK "uvijek A": klijent je za tocno_netocno TVRDO KODIRAO [Točno,Netočno] pa je Točno uvijek prvi (A) — ignorirao serversko miješanje; sad klijent miješa redoslijed prikaza (50% Netočno prvo), ocjenjivanje po RIJEČI ostaje robusno; ABC je server već ispravno miješao. (2) kandidatov mjehurić fit-content — kratak odgovor ("nije") više se ne lomi u "ni je". // ⭐ v129 — PISMENI PRAVI RANDOM + USMENI MEKŠA STROGOST: (1) shuffle_seed BIGINT kolona na test_sesije → slučajan seed po sesiji, isto pitanje daje drukčiji raspored svaki test (INIT-DB POTREBAN); sad miješa i tocno_netocno (Točno nije uvijek prvo); (2) P6/P7A: zezancija usko definirana (SAMO očito ismijavanje) — iskren djelomičan pokušaj se POHVALI i ocijeni pošteno (2/5 točaka=~40), nikad "neozbiljan/preturšt"; pogodi iz prve=bravo 100; ako sumnja=nije zezancija. // ⭐ v128 — BUG HUNT + UX: (1) login vraćao krnji objekt bez je_superadmin → admin sučelje se nije vidjelo nakon svježe prijave (sad ucitajKorisnika pun objekt); (2) uredi pitanje = pravi MODAL s punim uvidom (pitanje, opcije+radio za točan kod ABC, obrazloženje) umjesto dva slijepa prompt(); (3) getToken/setToken otporni na blokiran localStorage (incognito više ne puca); (4) bonus brzine ignorira apsurdno vrijeme >10min; (5) modal scroll na malom ekranu (Samsung). // ⭐ v127 — USMENI ŽIVA INTERAKCIJA + PISMENI RANDOM + BRZINA: (1) P6 daje PRIMJERE IZ PRAKSE za navođenje kad kandidat luta + povremeno (svako 2-3) živo praktično protupitanje za dobre kandidate; (2) TTS usporen 10% (server 1.13, browser 1.11); (3) PISMENI seededShuffle dobio splitmix32 hash — točan odgovor sad ravnomjerno A/B/C/D (prije pristran na D, korisnik vidio obrazac); (4) usmeni tajmer 90s + BONUS BRZINE: brz+dobar prvi odgovor (≤20s +8, ≤40s +5, ≤60s +2, samo ocjena≥60). // ⭐ v127 — USMENI ŽIVA INTERAKCIJA + PISMENI RANDOM + BRZINA: (1) P6 daje PRIMJERE IZ PRAKSE za navođenje + povremeno živo protupitanje; (2) TTS usporen 10%; (3) PISMENI seededShuffle splitmix32 hash — točan ravnomjerno A/B/C/D; (4) usmeni 90s + BONUS BRZINE. // ⭐ v126 — USMENI LJUDSKI OSJEĆAJ: ispitivač razlikuje tri situacije — (1) trudi se/dobar smjer → navodi i pomaže, (2) pluta ali pošteno → hint jednom pa niska ocjena, (3) zezancija/neozbiljno → OPOMENA "uozbiljite se, ispit za ovlaštene inženjere, neozbiljno=0 bodova" pa ako nastavi kraj bez hinta. P7A: ocjenjuje STVARNO znanje (ne ono otkriveno hintovima), zezancija=niska ocjena 0-30, stroži ton ispravka kod neozbiljnosti. Rješava 70/100 za zezajući odgovor. // ⭐ v125 — JEDINSTVENA PRETRAGA: uci/pretraga (Mentor+Vještak dijele) i gradivo dashboard sad traže po 4 polja s PRIORITETOM: dokument_naziv > vrsta > oznaka članka > tekst članka (tekst manji rang, ponuđen ispod ostalih s ulomkom gdje je pogodak). Prije nije tražilo po tekstu pa nije nalazilo. // ⭐ v124 — PRETRAGA GRADIVA: uci/pretraga za superadmina vidi SVE dokumente (ne samo programske — novouvezeni GUP/VOB/TU se sad nalaze) + traži po oznaci članka (npr. DIN 18202); nova ruta admin/gradivo/trazi-clanke; gradivo dashboard traži i članke po oznaci. // ⭐ v123 — USMENI TTS: govor 25% brži (Google speakingRate 1.25 + browser rate 1.23); toggle Ispitivač čita naglas sad odmah prekida govor kad se odznači i pročita zadnje pitanje kad se označi. // ⭐ v122 — DIJAGNOSTIKA INGESTA: zadnje greške (razlog pada po članku) da ih vidiš u appu
app.get('/api/admin/ai/ingest-greske', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const r = await q(`SELECT vrijednost, azurirano FROM sustav_meta WHERE kljuc='ingest_greske'`);
    if (r.rowCount === 0) return res.json({ ok: true, greske: [], azurirano: null });
    res.json({ ok: true, greske: JSON.parse(r.rows[0].vrijednost), azurirano: r.rows[0].azurirano });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/ai/ingest-greske-reset', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    global.__ingestGreske = [];
    await q(`DELETE FROM sustav_meta WHERE kljuc='ingest_greske'`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/ai/retrieval-test', auth, zahtijevajSuperadmin, async (req, res) => { // za eval.js (jeftin GATE)
  try {
    if (!AI_ON()) return res.status(503).json({ error: 'AI privremeno nedostupan' });
    const pitanje = String((req.body || {}).pitanje || '').slice(0, 500);
    if (!pitanje) return res.status(400).json({ error: 'Nedostaje pitanje.' });
    const fn = req.app.get('dohvatiIzvore') || dohvatiIzvoreImpl;
    const { izvori, upozorenje, plan } = await fn(pitanje);
    // ⭐ v026 — dijagnostika očekivanih: postoji li članak i ima li chunkove (kriva mapa vs rupa u ingestu vs retrieval)
    const provjera = [];
    for (const e of (Array.isArray((req.body || {}).ocekivani) ? req.body.ocekivani : []).slice(0, 8)) {
      const rd = await q(`SELECT c.id, c.oznaka, c.naslov FROM clanci c JOIN dokumenti d ON d.id=c.dokument_id
        WHERE d.naziv=$1 AND c.oznaka LIKE $2 ORDER BY c.id LIMIT 1`,
        [String(e.dokument || ''), 'Članak ' + String(e.clanak) + '.%']);
      if (!rd.rowCount) { provjera.push({ ...e, postoji: false }); continue; }
      let chunkova = null;
      try { const rc = await q(`SELECT COUNT(*)::int AS n FROM chunkovi WHERE clanak_id=$1`, [rd.rows[0].id]);
        chunkova = rc.rows[0].n; } catch (_) {}
      provjera.push({ ...e, postoji: true, naslov: rd.rows[0].naslov, chunkova });
    }
    res.json({ ok: true, upozorenje, pod_upiti: plan.pod_upiti, provjera,
      izvori: izvori.map((x, i) => ({ n: i + 1, clanak_id: x.clanak_id, oznaka: x.oznaka, dokument: x.dokument })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ai/pitaj', auth, async (req, res) => {
  try {
    if (!AI_ON()) return res.status(503).json({ error: 'AI privremeno nedostupan' });
    const k = await ucitajKorisnika(req.uid);
    if (!k) return res.status(404).json({ error: 'Korisnik ne postoji.' });
    const budzet = aiBudzet(k);                              // ⭐ v021 — $ budžet po tieru (ENV)
    if (budzet !== Infinity) {
      const potroseno = await aiPotrosnjaUsd(req.uid);
      if (potroseno >= budzet) return res.status(402).json({ error: 'limit', nadogradnja: k.tier !== 'pro' });
    }
    const tekst = String((req.body || {}).tekst || '').trim().slice(0, 2000);
    if (!tekst) return res.status(400).json({ error: 'Nedostaje tekst pitanja.' });
    const nacinFlag = String((req.body || {}).nacin || ''); // ⭐ v074 — 'dokument'|'dubina' eksplicitni override iz UI (Dopisi)
    let razgovorId = parseInt((req.body || {}).razgovor_id, 10) || null;
    if (razgovorId) {
      const rr = await q(`SELECT id FROM ai_razgovori WHERE id=$1 AND korisnik_id=$2`, [razgovorId, req.uid]);
      if (!rr.rowCount) return res.status(404).json({ error: 'Razgovor ne postoji.' });
    } else {
      const rr = await q(`INSERT INTO ai_razgovori (korisnik_id, naslov) VALUES ($1,$2) RETURNING id`, [req.uid, tekst.slice(0, 80)]);
      razgovorId = rr.rows[0].id;
    }
    await q(`INSERT INTO ai_poruke (razgovor_id, uloga, tekst) VALUES ($1,'user',$2)`, [razgovorId, tekst]);

    // ⭐ v076 — kontekst-aware retrieval: kratka nastavljajuća poruka ("može", "da", "nastavi", "hvala")
    // ne nosi pojmove za pretragu -> koristi prethodnu korisnikovu poruku kao upit (inače retrieval nađe smeće).
    let upitZaPretragu = tekst;
    const kratkoNastavak = tekst.length < 25 || /^(može|moze|da|ok|okej|dobro|nastavi|hvala|može tako|to|može može|važi|slažem se|idemo|samo naprijed|aha|može molim|da molim)\.?$/i.test(tekst.trim());
    if (kratkoNastavak && razgovorId) {
      try {
        const rzp = await q(`SELECT tekst FROM ai_poruke WHERE razgovor_id=$1 AND uloga='user' AND id < (SELECT MAX(id) FROM ai_poruke WHERE razgovor_id=$1) ORDER BY id DESC LIMIT 1`, [razgovorId]);
        if (rzp.rowCount) { const prosli = String(rzp.rows[0].tekst).replace(/^IZVORI:[\s\S]*?PITANJE: /, '').trim();
          if (prosli && prosli.length > tekst.length) upitZaPretragu = prosli + ' ' + tekst; } // spoji: prošla tema + trenutni odgovor
      } catch (_) {}
    }
    const fnI = req.app.get('dohvatiIzvore') || dohvatiIzvoreImpl;
    const { izvori, upozorenje } = await fnI(upitZaPretragu);
    if (!izvori.length) return res.status(503).json({ error: 'Pretraga trenutno ne nalazi izvore (gradivo/ingest?).' });
    const blok = izvori.map((x, i) => `[${i + 1}] ${x.dokument} — ${x.oznaka}${x.naslov ? ' ' + x.naslov : ''}: ${x.tekst}`).join('\n\n');
    const userMsg = `IZVORI:\n${blok}\n\nPITANJE: ${tekst}`;
    // ⭐ v039/v076 — povijest razgovora: zadnjih 10 poruka (bez starih IZVORA blokova — samo tekstovi)
    // u messages, da Vještak pamti kontekst ("pročitaj taj članak", "a što s rokom iz prethodnog?", "može").
    let povijest = [];
    try {
      const rpv = await q(`SELECT uloga, tekst FROM ai_poruke WHERE razgovor_id=$1 ORDER BY id DESC LIMIT 11`, [razgovorId]);
      povijest = rpv.rows.reverse().slice(0, -1)                        // bez upravo upisane user poruke
        .map(p => ({ role: p.uloga === 'user' ? 'user' : 'assistant',
                     content: p.uloga === 'user' ? String(p.tekst).replace(/^IZVORI:[\s\S]*?PITANJE: /, '') : String(p.tekst) }))
        .slice(-10);
    } catch (_) {}
    // ⭐ v035 — F15 SSE grana (04 §4): ?stream=1 -> text/event-stream; post-check nakon
    // punog teksta; pad -> event {retry:true} + drugi pokušaj; 2. pad -> upozorenje traka.
    if (String(req.query.stream || '') === '1') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
      let zivo = true; // ⭐ v036 — prekid klijenta ne smije srušiti handler; odgovor se ipak sprema
      req.on('close', () => { zivo = false; });
      const salji = (o) => { if (!zivo) return; try { res.write('data: ' + JSON.stringify(o) + '\n\n'); } catch (_) { zivo = false; } };
      const mock = req.app.get('aiOdgovor');
      // ⭐ v041 — F15.5: ctx.izvori RASTE kroz alate; post-check i citati rade nad naraslim skupom.
      // aiPetljaStream = test hook (skriptirani tool_use krugovi); mock aiOdgovor = legacy jednoprolazni put.
      const ctx = { izvori: [...izvori], fnI }; // kopija 🔒 — petlja RASTE u vlastitom polju, nikad ne mutira retrievalov rezultat
      // ⭐ v074 — adaptivni max_tokens: dubina/dokument traže više prostora (default kratko = 1600).
      // Napomena: bez \b jer JS \b ne radi ispred hrvatskih dijakritika (ž/č/ć).
      // nacinFlag (iz UI, npr. Dopisi) ima prednost nad regex detekcijom.
      const traziDubinu = nacinFlag === 'dubina' || /(detaljn|dublj|temeljit|opširn|razrad|sve o tome|raspiš|pojasni mi|razjasni)/i.test(tekst);
      const traziDokument = nacinFlag === 'dokument' || /(dopis|prigovor|žalb|zahtjev|podnesak|podnesk|obavijest|pismo|očitovanj|izjav|molb|urgencij|požurnic|sastavi mi|složi mi|napiši mi|sastavi dopis|treba mi žalb|treba mi dopis)/i.test(tekst);
      const maxOdg = traziDokument ? 8000 : (traziDubinu ? 3000 : 1600); // ⭐ v074 — dokument 8000 (dugi dopisi); dubina 3000; kratko 1600
      const fnS = req.app.get('aiPetljaStream') ||
        ((sys, ms, tools, onD) => anthropicStreamAlati(process.env.MODEL_ODGOVOR, sys, ms, maxOdg, tools, onD)); // ⭐ v041/v074
      const jedanPokusaj = async (msgs) => {
        if (mock) { const m = await mock(P1_SYSTEM, msgs); salji({ t: m.tekst }); return m; }
        return fnS(P1_SYSTEM, msgs, null, (d) => salji({ t: d })); // ⭐ v041 — retry-korekcija: bez alata
      };
      try {
        let odgS; // ⭐ v041 — produkcija ide agentskom petljom; mock zadržava v035 semantiku (1 t-event)
        if (mock) odgS = await jedanPokusaj([...povijest, { role: 'user', content: userMsg }]); // ⭐ v039
        else odgS = await vjestakPetlja({ system: P1_SYSTEM, ctx, fnStream: fnS, salji,
          poruke: [...povijest, { role: 'user', content: userMsg }] });
        let problemiS = provjeriCitate(odgS.tekst, ctx.izvori);
        let trakaS = null;
        if (problemiS.length) {
          salji({ retry: true });
          const o2 = await jedanPokusaj([...(odgS.msgs || [...povijest, { role: 'user', content: userMsg }]), // ⭐ v041 — korekcija vidi i tool-rezultate
            { role: 'assistant', content: odgS.tekst },
            { role: 'user', content: 'U odgovoru si naveo nepriloženi izvor (' + problemiS[0] + '). Ispravi odgovor tako da koristiš ISKLJUČIVO priložene izvore [1-' + ctx.izvori.length + '] i njihove oznake članaka.' }]);
          odgS = { tekst: o2.tekst, in: (odgS.in || 0) + (o2.in || 0), out: (odgS.out || 0) + (o2.out || 0) };
          problemiS = provjeriCitate(odgS.tekst, ctx.izvori);
          if (problemiS.length) { trakaS = 'provjeri_citate'; zabiljezi(req.uid, 'ai_citat_fail', { razgovor_id: razgovorId }); }
        }
        const koristeniS = new Set([...odgS.tekst.matchAll(/\[(\d{1,2})\]/g)].map(m => parseInt(m[1], 10)));
        const citatiS = ctx.izvori.map((x, i) => ({ n: i + 1, clanak_id: x.clanak_id, oznaka: x.oznaka, dokument: x.dokument })) // ⭐ v041
          .filter(c => koristeniS.has(c.n));
        await obogatiTablicom(citatiS); // ⭐ v147
        const rpS = await q(`INSERT INTO ai_poruke (razgovor_id, uloga, tekst, citati, upozorenje, tokeni_in, tokeni_out)
          VALUES ($1,'assistant',$2,$3,$4,$5,$6) RETURNING id`,
          [razgovorId, odgS.tekst, JSON.stringify(citatiS), trakaS || upozorenje || null, odgS.in || 0, odgS.out || 0]);
        zabiljezi(req.uid, 'ai_pitanje', { razgovor_id: razgovorId, tokeni_in: odgS.in || 0, tokeni_out: odgS.out || 0 });
        salji({ done: true, razgovor_id: razgovorId, poruka_id: rpS.rows[0].id, citati: citatiS,
                upozorenje: trakaS || upozorenje || undefined, disclaimer: AI_DISCLAIMER });
      } catch (e) {
        salji({ error: /abort/i.test(String(e.message)) ? 'Gužva na AI servisu, pokušaj za minutu.' : e.message });
      }
      if (zivo) return res.end();
      return; // veza već zatvorena
    }
    const fnA = req.app.get('aiOdgovor') ||
      ((sys, msgs) => anthropicPoziv(process.env.MODEL_ODGOVOR, sys, msgs, 1200, 0.2));
    let odg = await fnA(P1_SYSTEM, [...povijest, { role: 'user', content: userMsg }]); // ⭐ v039
    let problemi = provjeriCitate(odg.tekst, izvori);
    let traka = null;
    if (problemi.length) {                                   // 1 retry s uputom 🔒
      odg = await fnA(P1_SYSTEM, [{ role: 'user', content: userMsg },
        { role: 'assistant', content: odg.tekst },
        { role: 'user', content: 'U odgovoru si naveo nepriloženi izvor (' + problemi[0] + '). Ispravi odgovor tako da koristiš ISKLJUČIVO priložene izvore [1-' + izvori.length + '] i njihove oznake članaka.' }]);
      problemi = provjeriCitate(odg.tekst, izvori);
      if (problemi.length) { traka = 'provjeri_citate'; zabiljezi(req.uid, 'ai_citat_fail', { razgovor_id: razgovorId }); }
    }
    const koristeni = new Set([...odg.tekst.matchAll(/\[(\d{1,2})\]/g)].map(m => parseInt(m[1], 10)));
    const citati = izvori.map((x, i) => ({ n: i + 1, clanak_id: x.clanak_id, oznaka: x.oznaka, dokument: x.dokument }))
      .filter(c => koristeni.has(c.n));
    await obogatiTablicom(citati); // ⭐ v147
    const rp = await q(`INSERT INTO ai_poruke (razgovor_id, uloga, tekst, citati, upozorenje, tokeni_in, tokeni_out)
      VALUES ($1,'assistant',$2,$3,$4,$5,$6) RETURNING id`,
      [razgovorId, odg.tekst, JSON.stringify(citati), traka || upozorenje || null, odg.in || 0, odg.out || 0]);
    zabiljezi(req.uid, 'ai_pitanje', { razgovor_id: razgovorId, tokeni_in: odg.in || 0, tokeni_out: odg.out || 0 });
    res.json({ ok: true, razgovor_id: razgovorId, poruka_id: rp.rows[0].id, tekst: odg.tekst, citati,
               upozorenje: traka || upozorenje || undefined, disclaimer: AI_DISCLAIMER });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ai/potrosnja', auth, async (req, res) => { // ⭐ v021 — za progress bar u Ja tabu
  try {
    const k = await ucitajKorisnika(req.uid);
    if (!k) return res.status(404).json({ error: 'Korisnik ne postoji.' });
    const budzet = aiBudzet(k);
    const potroseno = await aiPotrosnjaUsd(req.uid);
    const pct = budzet === Infinity ? 0 : Math.min(100, Math.round(potroseno / budzet * 100));
    res.json({ ok: true, potroseno_usd: Math.round(potroseno * 10000) / 10000,
      budzet_usd: budzet === Infinity ? null : budzet, postotak: pct, tier: k.tier,
      neogranicen: budzet === Infinity });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v043 — Novosti (Vještak tab): feed novela — aktualne verzije članaka koji IMAJU stariju verziju,
// grupirano po (dokument, datum stupanja, NN). Read-only, bez sheme, bez AI.
// ⭐ v078 — F17 praksa mod: strukturirana forma dopisa (popuniš polja -> gotov dopis <2min) + kopiraj gumb u AI odgovoru // ⭐ v077 — F9+F10: procjena spremnosti po užem području (iz gotovih testova) + plan za danas.
// Spremnost = % točnih po uze_podrucje kroz sve korisnikove gotove test-sesije (min 3 odgovora za prikaz).
// Plan = najslabije područje + dani do ispita + SRS dužnici. Kod računa, AI ne dira brojke 🔒.
app.get('/api/spremnost', auth, async (req, res) => {
  try {
    const k = await ucitajKorisnika(req.uid);
    if (!k) return res.status(404).json({ error: 'Korisnik ne postoji.' });
    // Raspakiraj rezultate (JSONB niz) svih gotovih testova, spoji s pitanjima po uze_podrucje.
    const r = await q(`
      SELECT COALESCE(NULLIF(p.uze_podrucje,''),'Zajedničko') AS podrucje,
             COUNT(*)::int AS ukupno,
             SUM(CASE WHEN (x->>'tocan')::boolean THEN 1 ELSE 0 END)::int AS tocnih
      FROM test_sesije s
      CROSS JOIN LATERAL jsonb_array_elements(s.rezultati) AS x
      JOIN pitanja p ON p.id = (x->>'pitanje_id')::int
      WHERE s.korisnik_id=$1 AND s.stanje='gotovo'
      GROUP BY COALESCE(NULLIF(p.uze_podrucje,''),'Zajedničko')
      ORDER BY 1`, [req.uid]);
    const MIN_ZA_PRIKAZ = 3;                                 // ispod ovoga "nedovoljno podataka"
    const podrucja = r.rows.map(row => ({
      podrucje: row.podrucje,
      ukupno: row.ukupno,
      tocnih: row.tocnih,
      postotak: row.ukupno >= MIN_ZA_PRIKAZ ? Math.round(100 * row.tocnih / row.ukupno) : null }));
    // Ukupna spremnost = ponderirani prosjek (po broju odgovora) preko područja s dovoljno podataka.
    const sDovoljno = podrucja.filter(p => p.postotak !== null);
    const ukTocnih = sDovoljno.reduce((a, p) => a + p.tocnih, 0);
    const ukUkupno = sDovoljno.reduce((a, p) => a + p.ukupno, 0);
    const spremnost = ukUkupno > 0 ? Math.round(100 * ukTocnih / ukUkupno) : null;
    // Dani do ispita
    let daniDoIspita = null;
    if (k.cilj_datum) {
      const ms = new Date(k.cilj_datum).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
      daniDoIspita = Math.round(ms / 864e5);
    }
    // SRS dužnici (pitanja za ponavljanje, due danas ili prošlo)
    const rsrs = await q(`SELECT COUNT(*)::int AS n FROM srs_stavke WHERE korisnik_id=$1 AND due_at <= now()`, [req.uid]);
    const srsDue = rsrs.rows[0].n;
    // Broj gotovih testova (za "prvi test" stanje)
    const rt = await q(`SELECT COUNT(*)::int AS n FROM test_sesije WHERE korisnik_id=$1 AND stanje='gotovo' AND vrsta='test'`, [req.uid]);
    const brTestova = rt.rows[0].n;
    // PLAN ZA DANAS (deterministički): prioritet SRS dužnici -> najslabije područje -> prvi test.
    let plan;
    const najslabije = sDovoljno.slice().sort((a, b) => a.postotak - b.postotak)[0] || null;
    if (brTestova === 0) {
      plan = { tip: 'prvi_test', naslov: 'Riješi prvi test.',
        tekst: 'Napravi prvi pismeni test (20 pitanja) da izmjerimo spremnost po predmetima.', cta: 'test' };
    } else if (srsDue > 0) {
      plan = { tip: 'srs', naslov: `Ponovi ${srsDue} ${srsDue === 1 ? 'pitanje' : 'pitanja'} koje si promašio.`,
        tekst: 'Ponavljanje po razmaku učvršćuje ono što ti izmiče. Kreni od dužnika za danas.', cta: 'srs' };
    } else if (najslabije && najslabije.postotak < 80) {
      plan = { tip: 'slabo', naslov: `Vježbaj: ${najslabije.podrucje}.`,
        tekst: `Tu si trenutačno na ${najslabije.postotak}%. Jedan test iz tog područja diže spremnost najbrže.`, cta: 'test' };
    } else {
      plan = { tip: 'odrzavanje', naslov: 'Održavaj formu.',
        tekst: 'Stojiš dobro. Kratki test ili ponavljanje drži znanje svježim do ispita.', cta: 'test' };
    }
    if (daniDoIspita !== null && daniDoIspita >= 0) plan.dani = daniDoIspita;
    // ⭐ v100 — TREND: prosjek točnosti po danu završetka testa (za graf razvoja u napretku).
    // pg-mem nema date_trunc → dohvaćamo završene testove i grupiramo u JS po danu.
    let trend = [];
    try {
      const rtr = await q(`SELECT zavrsena_at, rezultati FROM test_sesije
        WHERE korisnik_id=$1 AND stanje='gotovo' AND zavrsena_at IS NOT NULL
        ORDER BY zavrsena_at ASC`, [req.uid]);
      const poDanu = new Map();
      for (const row of rtr.rows) {
        const dan = new Date(row.zavrsena_at).toISOString().slice(0, 10);
        const niz = Array.isArray(row.rezultati) ? row.rezultati : [];
        let t = 0, u = 0;
        for (const x of niz) { u++; if (x && x.tocan) t++; }
        const rec = poDanu.get(dan) || { dan, tocnih: 0, ukupno: 0 };
        rec.tocnih += t; rec.ukupno += u; poDanu.set(dan, rec);
      }
      trend = [...poDanu.values()].filter(d => d.ukupno > 0)
        .map(d => ({ dan: d.dan, postotak: Math.round(100 * d.tocnih / d.ukupno), pitanja: d.ukupno }))
        .slice(-14); // zadnjih do 14 mjernih dana
    } catch (_) { trend = []; }
    // smjer razvoja: usporedi prosjek prve i druge polovice trenda
    let smjer = null;
    if (trend.length >= 2) {
      const pol = Math.floor(trend.length / 2);
      const prva = trend.slice(0, pol), druga = trend.slice(pol);
      const avg = (a) => Math.round(a.reduce((s, x) => s + x.postotak, 0) / a.length);
      const d = avg(druga) - avg(prva);
      smjer = { delta: d, raste: d > 2, pada: d < -2, prvi: avg(prva), zadnji: avg(druga) };
    }
    res.json({ ok: true, spremnost, podrucja, plan, dani_do_ispita: daniDoIspita, srs_due: srsDue, br_testova: brTestova, trend, smjer });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/novosti', auth, async (req, res) => {
  try {
    const r = await q(`SELECT d.naziv AS dokument, d.id AS dokument_id, v.vrijedi_od, v.nn_izvor, COUNT(*)::int AS clanaka
      FROM clanci_verzije v
      JOIN (SELECT clanak_id, COUNT(*) AS n FROM clanci_verzije GROUP BY clanak_id) m ON m.clanak_id = v.clanak_id
      JOIN clanci c ON c.id = v.clanak_id
      JOIN dokumenti d ON d.id = c.dokument_id
      WHERE v.vrijedi_do IS NULL AND m.n > 1
      GROUP BY d.naziv, d.id, v.vrijedi_od, v.nn_izvor
      ORDER BY v.vrijedi_od DESC LIMIT 40`);
    // ⭐ v073 — pridruži čitljivi sažetak izmjena (ako ga je superadmin upisao)
    const ids = r.rows.map(x => x.dokument_id);
    let sazetci = {};
    if (ids.length) {
      const rs = await q(`SELECT kljuc, vrijednost FROM sustav_meta WHERE kljuc = ANY($1)`,
        [ids.map(id => `novela_sazetak_${id}`)]);
      for (const row of rs.rows) sazetci[row.kljuc.replace('novela_sazetak_', '')] = row.vrijednost;
    }
    const novosti = r.rows.map(x => ({ ...x, sazetak: sazetci[x.dokument_id] || null }));
    res.json({ ok: true, novosti });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v042 — Skraćeno / Primjer po članku: kill-switch -> validacija -> keš (hash) -> budžet -> generacija -> keširaj.
// Keš pogodak NE troši budžet i služi sve korisnike; generacija tereti pozivatelja (aiPotrosnjaUsd).
app.post('/api/ai/clanak-pomoc', auth, async (req, res) => {
  try {
    if (!AI_ON()) return res.status(503).json({ error: 'AI privremeno nedostupan' });
    const clanakId = parseInt((req.body || {}).clanak_id, 10);
    const tip = String((req.body || {}).tip || '');
    if (!clanakId || !['skraceno', 'primjer'].includes(tip)) return res.status(400).json({ error: 'Očekujem clanak_id i tip (skraceno|primjer).' });
    const rc = await q(`SELECT c.id, c.oznaka, c.naslov, c.tekst, d.naziv AS dokument
      FROM clanci c JOIN dokumenti d ON d.id=c.dokument_id WHERE c.id=$1`, [clanakId]);
    if (!rc.rowCount) return res.status(404).json({ error: 'Članak ne postoji.' });
    const cl = rc.rows[0];
    const hash = crypto.createHash('md5').update(String(cl.tekst), 'utf8').digest('hex');
    const rk = await q(`SELECT tekst, clanak_hash FROM clanak_pomoc WHERE clanak_id=$1 AND tip=$2`, [clanakId, tip]);
    if (rk.rowCount && rk.rows[0].clanak_hash === hash)
      return res.json({ ok: true, tip, tekst: rk.rows[0].tekst, iz_cache: true });
    const k = await ucitajKorisnika(req.uid);
    if (!k) return res.status(404).json({ error: 'Korisnik ne postoji.' });
    const budzet = aiBudzet(k);                              // isti $ budžet kao Vještak (v021)
    if (budzet !== Infinity && (await aiPotrosnjaUsd(req.uid)) >= budzet)
      return res.status(402).json({ error: 'limit', nadogradnja: k.tier !== 'pro' });
    const fnA = req.app.get('aiOdgovor') ||
      ((sys, msgs) => anthropicPoziv(process.env.MODEL_POMOC || process.env.MODEL_ODGOVOR, sys, msgs, 700));
    const odg = await fnA(tip === 'skraceno' ? P9_SKRACENO : P9_PRIMJER,
      [{ role: 'user', content: `ČLANAK (${cl.dokument} — ${cl.oznaka}${cl.naslov ? ' ' + cl.naslov : ''}):\n${String(cl.tekst).slice(0, 12000)}` }]);
    await q(`DELETE FROM clanak_pomoc WHERE clanak_id=$1 AND tip=$2`, [clanakId, tip]); // zamjena zastarjelog hasha
    await q(`INSERT INTO clanak_pomoc (clanak_id, tip, clanak_hash, tekst, korisnik_id, tokeni_in, tokeni_out)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`, [clanakId, tip, hash, odg.tekst, req.uid, odg.in || 0, odg.out || 0]);
    zabiljezi(req.uid, 'clanak_pomoc', { clanak_id: clanakId, tip });
    res.json({ ok: true, tip, tekst: odg.tekst, iz_cache: false });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v138 — MENTOR dijagnostika: točnost kandidata po užem području (iz gotovih testova). Podloga za "vježbaj baš ovo".
app.get('/api/mentor/slabe-teme', auth, async (req, res) => {
  try {
    const k = await ucitajKorisnika(req.uid);
    if (!k) return res.status(404).json({ error: 'Korisnik ne postoji.' });
    const rs = await q(`SELECT rezultati FROM test_sesije WHERE korisnik_id=$1 AND stanje='gotovo' AND vrsta='test' ORDER BY created_at DESC LIMIT 60`, [req.uid]);
    const stat = {}; const idset = new Set();
    for (const row of rs.rows) {
      const arr = Array.isArray(row.rezultati) ? row.rezultati : [];
      for (const r of arr) { const pid = parseInt(r.pitanje_id, 10); if (!pid) continue; idset.add(pid);
        const s = stat[pid] || (stat[pid] = { t: 0, n: 0 }); s.n++; if (r.tocan) s.t++; }
    }
    if (!idset.size) return res.json({ ok: true, teme: [], ukupno_odgovora: 0 });
    const ids = [...idset];
    const rp = await q(`SELECT id, uze_podrucje FROM pitanja WHERE id = ANY($1::int[])`, [ids]);
    const temaOd = {};
    for (const p of rp.rows) temaOd[p.id] = (p.uze_podrucje && String(p.uze_podrucje).trim()) ? String(p.uze_podrucje).trim() : 'Općenito';
    const agg = {}; let ukupno = 0;
    for (const pid of ids) { const t = temaOd[pid] || 'Općenito'; const s = stat[pid];
      const a = agg[t] || (agg[t] = { tema: t, tocnih: 0, ukupno: 0 }); a.tocnih += s.t; a.ukupno += s.n; ukupno += s.n; }
    const teme = Object.values(agg)
      .map(a => ({ tema: a.tema, tocnih: a.tocnih, ukupno: a.ukupno, postotak: Math.round(100 * a.tocnih / a.ukupno) }))
      .filter(a => a.ukupno >= 3)                     // dovoljno uzorka da ocjena teme ima smisla
      .sort((a, b) => a.postotak - b.postotak || b.ukupno - a.ukupno);
    res.json({ ok: true, teme, ukupno_odgovora: ukupno });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v137 — MENTOR mikro-tutor "Zašto?": nakon pismenog odgovora objasni zašto je točno/kandidatov izbor kriv.
// Grounding: obrazloženje pitanja + tekst referenciranih članaka (clanak_refs). Budžet kao Vještak (free ima mali $).
app.post('/api/mentor/objasni', auth, async (req, res) => {
  try {
    if (!AI_ON()) return res.status(503).json({ error: 'AI privremeno nedostupan' });
    const k = await ucitajKorisnika(req.uid);
    if (!k) return res.status(404).json({ error: 'Korisnik ne postoji.' });
    const budzet = aiBudzet(k);
    if (budzet !== Infinity && (await aiPotrosnjaUsd(req.uid)) >= budzet)
      return res.status(402).json({ error: 'limit', nadogradnja: k.tier !== 'pro' });
    const pid = parseInt((req.body || {}).pitanje_id, 10);
    const odgovor = String((req.body || {}).odgovor || '').slice(0, 300);
    if (!pid) return res.status(400).json({ error: 'Nedostaje pitanje_id.' });
    const rp = await q(`SELECT id, tip, pitanje, opcije, tocno, obrazlozenje, clanak_refs FROM pitanja WHERE id=$1`, [pid]);
    if (!rp.rowCount) return res.status(404).json({ error: 'Pitanje ne postoji.' });
    const pit = rp.rows[0];
    let izvor = '';
    const refs = Array.isArray(pit.clanak_refs) ? pit.clanak_refs.filter(Number.isInteger).slice(0, 4) : [];
    for (const cid of refs) {
      const rc = await q(`SELECT c.oznaka, c.naslov, c.tekst, d.naziv FROM clanci c JOIN dokumenti d ON d.id=c.dokument_id WHERE c.id=$1`, [cid]);
      if (rc.rowCount) izvor += `[${rc.rows[0].naziv} — ${rc.rows[0].oznaka}${rc.rows[0].naslov ? ' ' + rc.rows[0].naslov : ''}]\n${String(rc.rows[0].tekst).slice(0, 900)}\n\n`;
    }
    const tocnaR = pit.tip === 'tocno_netocno' ? tocnaRijecTN(pit) : String(pit.tocno || '');
    const podloga = `PITANJE:\n${pit.pitanje}\n\n`
      + (Array.isArray(pit.opcije) && pit.opcije.length ? `OPCIJE:\n${pit.opcije.join('\n')}\n\n` : '')
      + `TOČAN ODGOVOR: ${tocnaR}\nKANDIDATOV ODGOVOR: ${odgovor || '(nije naveden)'}\n`
      + (pit.obrazlozenje ? `SLUŽBENO OBRAZLOŽENJE: ${pit.obrazlozenje}\n` : '')
      + (izvor ? `\nIZVOR (propisi):\n${izvor}` : '');
    // ⭐ v145 — nacin: 'primjer' = živ primjer s gradilišta (Sonnet 5, više tokena); inače kratko 'zašto'
    const nacin = ((req.body || {}).nacin === 'primjer') ? 'primjer' : 'zasto';
    const prompt = nacin === 'primjer' ? P_PRIMJER : P_ZASTO;
    const maxTok = nacin === 'primjer' ? 620 : 350;
    const fnA = req.app.get('aiOdgovor') || ((sys, msgs, mt) => anthropicPoziv(process.env.MODEL_ODGOVOR, sys, msgs, mt || 350, 0.2));
    const o = await fnA(prompt, [{ role: 'user', content: podloga }], maxTok);
    zabiljezi(req.uid, 'mentor_objasni', { pitanje_id: pid, nacin, tokeni_in: o.in || 0, tokeni_out: o.out || 0 });
    res.json({ ok: true, tekst: o.tekst });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v144 — GLAS: kontekstualno sređivanje izdiktiranog teksta (Haiku). PLATFORMSKI trošak (ne tereti korisnika ~$0.0016/poziv).
// Fail-safe: na SVAKU grešku vrati original — glasovni unos nikad ne smije biti blokiran ni pokvaren.
app.post('/api/glas/ocisti', auth, async (req, res) => {
  const original = String((req.body || {}).tekst || '');
  try {
    if (!AI_ON()) return res.json({ ok: true, tekst: original });
    const tekst = original.trim();
    if (!tekst || tekst.length < 3) return res.json({ ok: true, tekst: original });
    if (tekst.length > 1200) return res.json({ ok: true, tekst: original }); // predugo za diktat — ne diraj
    const fnA = req.app.get('aiOdgovor') || ((sys, msgs, mt) => anthropicPoziv(process.env.MODEL_PLANNER, sys, msgs, mt || 400, 0.1));
    const o = await fnA(P_GLAS, [{ role: 'user', content: tekst }], 400);
    let out = String(o.tekst || '').trim();
    // sanity: ako model pobjegne (predugačko / prazno), zadrži original
    if (!out || out.length > tekst.length * 2.2 + 40) out = tekst;
    zabiljezi(req.uid, 'glas_ocisti', { tokeni_in: o.in || 0, tokeni_out: o.out || 0 });
    res.json({ ok: true, tekst: out });
  } catch (e) { res.json({ ok: true, tekst: original }); }
});

// ⭐ v146 — TABLICE: proxy slika tablica iz propisa iz oi-gradivo repoa. Posluženo kao 'self' (bez CSP promjene).
// JAVNO (bez auth): <img src> ne šalje Authorization header, a sadržaj je javni repo. Zaštite: fiksni repo (nema SSRF),
// bez path-traversal, samo slike, veličinski cap, cache 1 dan; globalni rate-limit vrijedi.
const GRADIVO_RAW = 'https://raw.githubusercontent.com/zbuka-cakaric/oi-gradivo/main/';
app.get('/api/tablica', async (req, res) => {
  try {
    const p = String(req.query.p || '');
    if (!p || p.length > 400 || p.includes('..') || p.startsWith('/') || !/\.(png|jpe?g|webp)$/i.test(p)) return res.status(400).end();
    const url = GRADIVO_RAW + p.split('/').map(encodeURIComponent).join('/');
    const r = await fetch(url);
    if (!r.ok) return res.status(404).end();
    const ct = r.headers.get('content-type') || 'image/png';
    if (!ct.startsWith('image/')) return res.status(415).end();
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) return res.status(413).end();
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.end(buf);
  } catch (e) { res.status(502).end(); }
});

// ═══ ⭐ v139 — BATCH 5: SIMULACIJA ROKA ═══
// Zajednički ishod pravog roka: pismeni + usmeni. Klijent vodi tok (odradi oba postojeća toka),
// server VERIFICIRA (obje sesije vlasnikove i 'gotovo'), čita STVARNE ocjene iz baze i računa prolaz
// (oba dijela moraju proći). Ocjene se NE primaju od klijenta — čitaju se iz DB (bez varanja).
app.post('/api/simulacija/zavrsi', auth, async (req, res) => {
  try {
    const tid = parseInt((req.body || {}).test_sesija_id, 10);
    const uid = parseInt((req.body || {}).usmeni_sesija_id, 10);
    if (!tid || !uid) return res.status(400).json({ error: 'Očekujem test_sesija_id i usmeni_sesija_id.' });
    const rt = await q(`SELECT ocjena, prolaz, stanje FROM test_sesije WHERE id=$1 AND korisnik_id=$2`, [tid, req.uid]);
    const ru = await q(`SELECT ocjena, prolaz, stanje FROM usmeni_sesije WHERE id=$1 AND korisnik_id=$2`, [uid, req.uid]);
    if (!rt.rowCount || !ru.rowCount) return res.status(404).json({ error: 'Sesija simulacije ne postoji.' });
    if (rt.rows[0].stanje !== 'gotovo' || ru.rows[0].stanje !== 'gotovo') return res.status(409).json({ error: 'Oba dijela simulacije moraju biti završena.' });
    const op = rt.rows[0].ocjena || 0, ou = ru.rows[0].ocjena || 0;
    const pp = !!rt.rows[0].prolaz, pu = !!ru.rows[0].prolaz;
    const prolaz = pp && pu;
    const rs = await q(`INSERT INTO simulacije (korisnik_id, test_sesija_id, usmeni_sesija_id, ocjena_pismeni, ocjena_usmeni, prolaz_pismeni, prolaz_usmeni, prolaz)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, created_at`, [req.uid, tid, uid, op, ou, pp, pu, prolaz]);
    zabiljezi(req.uid, 'simulacija_kraj', { id: rs.rows[0].id, prolaz });
    res.json({ ok: true, id: rs.rows[0].id, ocjena_pismeni: op, ocjena_usmeni: ou, prolaz_pismeni: pp, prolaz_usmeni: pu, prolaz });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/simulacija/povijest', auth, async (req, res) => {
  try {
    const rs = await q(`SELECT id, ocjena_pismeni, ocjena_usmeni, prolaz_pismeni, prolaz_usmeni, prolaz, created_at
      FROM simulacije WHERE korisnik_id=$1 ORDER BY created_at DESC LIMIT 20`, [req.uid]);
    res.json({ ok: true, simulacije: rs.rows, prolaz_pismeni_prag: TEST_PROLAZ(), prolaz_usmeni_prag: USMENI_PROLAZ() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══ ⭐ v139 — BATCH 5: PREDMETI (case-file mape) ═══
// Korisnikove mape spisa; svaka skuplja stavke (bilješke, spremljeni Vještak odgovori, članci, dopisi).
// Sve strogo po vlasniku (korisnik_id iz JWT-a); nema dijeljenja među korisnicima.
const PRED_LIMIT = 200, STAVKA_LIMIT = 500; // higijenske granice po korisniku/predmetu
app.get('/api/predmeti', auth, async (req, res) => {
  try {
    const rs = await q(`SELECT p.id, p.naziv, p.opis, p.created_at, p.updated_at,
      (SELECT COUNT(*)::int FROM predmet_stavke s WHERE s.predmet_id=p.id) AS stavki
      FROM predmeti p WHERE p.korisnik_id=$1 ORDER BY p.updated_at DESC LIMIT ${PRED_LIMIT}`, [req.uid]);
    res.json({ ok: true, predmeti: rs.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/predmeti', auth, async (req, res) => {
  try {
    const naziv = String((req.body || {}).naziv || '').trim().slice(0, 160);
    const opis = String((req.body || {}).opis || '').trim().slice(0, 2000);
    if (!naziv) return res.status(400).json({ error: 'Predmet treba naziv.' });
    const rc = await q(`SELECT COUNT(*)::int AS n FROM predmeti WHERE korisnik_id=$1`, [req.uid]);
    if (rc.rows[0].n >= PRED_LIMIT) return res.status(429).json({ error: 'Dosegnut je maksimalan broj predmeta.' });
    const rs = await q(`INSERT INTO predmeti (korisnik_id, naziv, opis) VALUES ($1,$2,$3) RETURNING id, naziv, opis, created_at, updated_at`, [req.uid, naziv, opis]);
    res.json({ ok: true, predmet: { ...rs.rows[0], stavki: 0 } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/predmeti/:id', auth, async (req, res) => {
  try {
    const pid = parseInt(req.params.id, 10);
    const rp = await q(`SELECT id, naziv, opis, created_at, updated_at FROM predmeti WHERE id=$1 AND korisnik_id=$2`, [pid, req.uid]);
    if (!rp.rowCount) return res.status(404).json({ error: 'Predmet ne postoji.' });
    const rs = await q(`SELECT id, tip, naslov, sadrzaj, meta, created_at FROM predmet_stavke WHERE predmet_id=$1 ORDER BY created_at DESC`, [pid]);
    res.json({ ok: true, predmet: rp.rows[0], stavke: rs.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.patch('/api/predmeti/:id', auth, async (req, res) => {
  try {
    const pid = parseInt(req.params.id, 10);
    const naziv = String((req.body || {}).naziv || '').trim().slice(0, 160);
    const opis = String((req.body || {}).opis || '').trim().slice(0, 2000);
    if (!naziv) return res.status(400).json({ error: 'Predmet treba naziv.' });
    const ru = await q(`UPDATE predmeti SET naziv=$1, opis=$2, updated_at=now() WHERE id=$3 AND korisnik_id=$4 RETURNING id`, [naziv, opis, pid, req.uid]);
    if (!ru.rowCount) return res.status(404).json({ error: 'Predmet ne postoji.' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/predmeti/:id', auth, async (req, res) => {
  try {
    const pid = parseInt(req.params.id, 10);
    const rd = await q(`DELETE FROM predmeti WHERE id=$1 AND korisnik_id=$2 RETURNING id`, [pid, req.uid]); // CASCADE briše stavke
    if (!rd.rowCount) return res.status(404).json({ error: 'Predmet ne postoji.' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/predmeti/:id/stavke', auth, async (req, res) => {
  try {
    const pid = parseInt(req.params.id, 10);
    const rp = await q(`SELECT id FROM predmeti WHERE id=$1 AND korisnik_id=$2`, [pid, req.uid]);
    if (!rp.rowCount) return res.status(404).json({ error: 'Predmet ne postoji.' });
    const tip = String((req.body || {}).tip || 'biljeska').slice(0, 24);
    const naslov = String((req.body || {}).naslov || '').trim().slice(0, 200);
    const sadrzaj = String((req.body || {}).sadrzaj || '').trim().slice(0, 20000);
    if (!sadrzaj && !naslov) return res.status(400).json({ error: 'Stavka treba naslov ili sadržaj.' });
    let meta = (req.body || {}).meta; try { const s = meta != null ? JSON.stringify(meta) : null; meta = (s && s.length <= 4000) ? s : null; } catch (_) { meta = null; }
    const rc = await q(`SELECT COUNT(*)::int AS n FROM predmet_stavke WHERE predmet_id=$1`, [pid]);
    if (rc.rows[0].n >= STAVKA_LIMIT) return res.status(429).json({ error: 'Dosegnut je maksimalan broj stavki u predmetu.' });
    const rs = await q(`INSERT INTO predmet_stavke (predmet_id, tip, naslov, sadrzaj, meta) VALUES ($1,$2,$3,$4,$5) RETURNING id, tip, naslov, sadrzaj, meta, created_at`,
      [pid, tip, naslov, sadrzaj, meta]);
    await q(`UPDATE predmeti SET updated_at=now() WHERE id=$1`, [pid]);
    res.json({ ok: true, stavka: rs.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/predmeti/:id/stavke/:sid', auth, async (req, res) => {
  try {
    const pid = parseInt(req.params.id, 10), sid = parseInt(req.params.sid, 10);
    const rp = await q(`SELECT id FROM predmeti WHERE id=$1 AND korisnik_id=$2`, [pid, req.uid]);
    if (!rp.rowCount) return res.status(404).json({ error: 'Predmet ne postoji.' });
    const rd = await q(`DELETE FROM predmet_stavke WHERE id=$1 AND predmet_id=$2 RETURNING id`, [sid, pid]);
    if (!rd.rowCount) return res.status(404).json({ error: 'Stavka ne postoji.' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// Tok: start (pitanje iz ovjerene banke -> P5 uvod) -> odgovori (P6 procjena JSON -> potpitanje ILI
// P7 rubrika JSON -> kraj). 🔒: zlatni sadržaj ne izlazi prije kraja; kandidatov odgovor NIKAD u retrieval;
// planEnforce SAMO server (limit 3 usmene/dan za Pro, superadmin ∞, free 402).
const USMENI_DNEVNO = () => parseInt(process.env.USMENI_DNEVNO || '3', 10);
const USMENI_BR_PITANJA = () => Math.max(1, parseInt(process.env.USMENI_BR_PITANJA || '10', 10) || 10); // ⭐ v053
const USMENI_PROLAZ = () => Math.min(100, Math.max(1, parseInt(process.env.USMENI_PROLAZ || '80', 10) || 80)); // ⭐ v065 — prag 80 (bio 90; smisao>doslovnost) // v053 — prag /100
async function usmeniSesijaVlasnika(id, uid) {
  const r = await q(`SELECT s.*, p.pitanje, p.tocno, p.obrazlozenje, p.opcije, p.tip FROM usmeni_sesije s
    JOIN pitanja p ON p.id = s.pitanje_id WHERE s.id=$1 AND s.korisnik_id=$2`, [id, uid]);
  return r.rowCount ? r.rows[0] : null;
}
const usmeniTrans = (poruke) => poruke.map(x => (x.uloga === 'ispitivac' ? 'ISPITIVAČ: ' : 'KANDIDAT: ') + x.tekst).join('\n');

// ⭐ v093 — Google Cloud TTS (prirodan hrvatski glas, Chirp3-HD) — SAMO Pro; free ostaje browserov glas
// ENV: GOOGLE_TTS_KEY (API ključ). Glas: GOOGLE_TTS_VOICE (def hr-HR-Chirp3-HD-Aoede). Vraća MP3.
const TTS_GLAS = () => process.env.GOOGLE_TTS_VOICE || 'hr-HR-Chirp3-HD-Aoede';
app.post('/api/tts', auth, async (req, res) => {
  try {
    const kljuc = process.env.GOOGLE_TTS_KEY || '';
    if (!kljuc) return res.status(503).json({ error: 'tts-off' }); // nije konfiguriran -> klijent fallback na browser
    const k = await ucitajKorisnika(req.uid);
    if (!k) return res.status(404).json({ error: 'Korisnik ne postoji.' });
    if (!k.je_superadmin && k.tier !== 'pro') return res.status(402).json({ error: 'pro' }); // prirodan glas = Pro pogodnost
    const tekst = String((req.body || {}).tekst || '').trim().slice(0, 1200); // limit po pozivu (trošak)
    if (!tekst) return res.status(400).json({ error: 'Nema teksta.' });
    const glas = String((req.body || {}).glas || TTS_GLAS());
    const jezik = glas.split('-').slice(0, 2).join('-') || 'hr-HR';
    const r = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize?key=' + encodeURIComponent(kljuc), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: tekst },
        voice: { languageCode: jezik, name: glas },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1.13 }, // ⭐ v127 — usporeno 10% (bilo 1.25); prirodniji tempo (Chirp3-HD ignorira, Neural2/Standard glasovi poslušaju)
      }),
    });
    if (!r.ok) { const t = await r.text().catch(() => ''); return res.status(502).json({ error: 'tts-greska', detalj: t.slice(0, 200) }); }
    const d = await r.json();
    if (!d.audioContent) return res.status(502).json({ error: 'tts-prazno' });
    const buf = Buffer.from(d.audioContent, 'base64');
    zabiljezi(req.uid, 'tts', { znakova: tekst.length, glas }); // ⭐ v094 — praćenje TTS potrošnje po korisniku
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/usmeni/start', auth, async (req, res) => {
  try {
    if (!AI_ON()) return res.status(503).json({ error: 'AI privremeno nedostupan' });
    const k = await ucitajKorisnika(req.uid);
    if (!k) return res.status(404).json({ error: 'Korisnik ne postoji.' });
    if (!k.je_superadmin && k.tier !== 'pro') return res.status(402).json({ error: 'pro' }); // usmeni = Pro (12 §3)
    if (!k.program_id) return res.status(400).json({ error: 'Prvo odaberi strukovno područje u kartici Ja.' });
    if (!k.je_superadmin) {
      const d0 = new Date(); d0.setHours(0, 0, 0, 0);
      const rc = await q(`SELECT COUNT(*)::int AS n FROM usmeni_sesije WHERE korisnik_id=$1 AND created_at >= $2`,
        [req.uid, d0.toISOString()]);
      if (rc.rows[0].n >= USMENI_DNEVNO()) return res.status(429).json({ error: 'Dnevna kvota usmenih vježbi je iskorištena — nova stiže sutra.' });
    }
    const uze = String((req.body || {}).uze || k.uze_podrucje || '');
    // ⭐ v096 — usmeni koristi CIJELU banku: abc pitanja (tekst bez opcija — odgovara se govorom) + usmeno/otvoreno.
    // Prije: samo 'usmeno'/'otvoreno' (kojih je banka imala ~0) pa se vrtio uzak skup. LIMIT 800 (bila 50).
    let rp = await q(`SELECT id, pitanje, tocno, obrazlozenje, tezina FROM pitanja
      WHERE program_id=$1 AND status='ovjereno' AND tip IN ('abc','usmeno','otvoreno')
      ${uze ? "AND (uze_podrucje=$2 OR uze_podrucje='')" : ''} ORDER BY id LIMIT 800`,
      uze ? [k.program_id, uze] : [k.program_id]);
    if (!rp.rowCount)
      rp = await q(`SELECT id, pitanje, tocno, obrazlozenje, tezina FROM pitanja
        WHERE program_id=$1 AND status='ovjereno' ORDER BY id LIMIT 800`, [k.program_id]);
    if (!rp.rowCount) return res.status(404).json({ error: 'Banka pitanja za tvoj program još nema ovjerenih pitanja.' });
    // ⭐ v096 — izbjegni nedavno viđena pitanja (zadnjih 5 sesija) da se ne vrte ista; ako presiromašno, ignoriraj filter
    const rNed = await q(`SELECT plan_pitanja FROM usmeni_sesije WHERE korisnik_id=$1 ORDER BY id DESC LIMIT 5`, [req.uid]);
    const nedavno = new Set();
    for (const s of rNed.rows) { const pl = Array.isArray(s.plan_pitanja) ? s.plan_pitanja : []; for (const id of pl) nedavno.add(id); }
    let dostupno = rp.rows.filter(x => !nedavno.has(x.id));
    if (dostupno.length < USMENI_BR_PITANJA()) dostupno = rp.rows; // premalo svježih -> koristi sve (banka mala ili puno odrađeno)
    // ⭐ v098 — težinsko biranje: pitanja veće težine (češća na rokovima) imaju veću šansu, ali svako može doći.
    // Weighted shuffle: svakom pitanju random ključ ^ (1/težina) — veća težina = ključ bliže 1 = ranije u nizu.
    const shuf = dostupno.map(p => ({ p, k: Math.pow(Math.random(), 1 / Math.max(1, (p.tezina || 3))) }))
      .sort((a, b) => b.k - a.k).map(x => x.p);
    let plan = shuf.slice(0, Math.min(USMENI_BR_PITANJA(), shuf.length));
    // ⭐ v096 — ~10% AI "iznenađenja" iz živih propisa (kao pismeni): AI čita članke i generira otvorena usmena pitanja.
    // Platformski trošak (MODEL_PLANNER), NE tereti korisnika. Generirana pitanja se SPREMAJU pa recikliraju kroz banku.
    const aiN = Math.min(Math.round(plan.length * 0.10), 2);
    if (aiN > 0 && AI_ON()) {
      try {
        const rc2 = await q(`SELECT id FROM clanci WHERE status='aktivan' LIMIT 800`);
        if (rc2.rowCount >= aiN) {
          const cs = rc2.rows.map(x => x.id);
          for (let i = cs.length - 1; i > 0; i--) { const jx = Math.floor(Math.random() * (i + 1)); const t2 = cs[i]; cs[i] = cs[jx]; cs[jx] = t2; }
          const rclRows = [];
          for (const cid of cs.slice(0, aiN + 1)) { // +1 rezerva
            const r1 = await q(`SELECT c.id, c.oznaka, c.naslov, c.tekst, d.naziv FROM clanci c JOIN dokumenti d ON d.id=c.dokument_id WHERE c.id=$1`, [cid]);
            if (r1.rowCount) rclRows.push(r1.rows[0]);
          }
          const izvor = rclRows.map(c => `[${c.id}] ${c.naziv} — ${c.oznaka} ${c.naslov}\n${String(c.tekst).slice(0, 1500)}`).join('\n\n');
          const fnG = req.app.get('aiOdgovor') || ((sys, msgs, mt) => anthropicPoziv(process.env.MODEL_PLANNER, sys, msgs, mt || 900));
          const g = await fnG(P5G_USMENI, [{ role: 'user', content: 'Generiraj TOČNO ' + aiN + ' usmena pitanja.\n\nIZVOR:\n' + izvor }], 900);
          const noviIds = [];
          for (const linija of String(g.tekst || '').split('\n')) {
            const o = pokusajJson(linija);
            if (!o || !o.pitanje || !o.tocno) continue;
            const ri = await q(`INSERT INTO pitanja (program_id, uze_podrucje, tip, pitanje, tocno, obrazlozenje, clanak_refs, izvor, rok_oznaka, tezina, status)
              VALUES ($1,'','usmeno',$2,$3,$4,$5,'ai','AI-USMENI',$6,'ovjereno') RETURNING id, pitanje, tocno, obrazlozenje`,
              [k.program_id, String(o.pitanje).slice(0, 1000), String(o.tocno).slice(0, 1500), String(o.obrazlozenje || '').slice(0, 600),
               Array.isArray(o.clanak_refs) ? o.clanak_refs.filter(x => Number.isInteger(x)) : [], Math.min(5, Math.max(1, parseInt(o.tezina, 10) || 3))]);
            noviIds.push(ri.rows[0]);
            if (noviIds.length >= aiN) break;
          }
          if (noviIds.length) { // ubaci AI pitanja u plan (zamijeni zadnje) pa promiješaj
            plan = noviIds.concat(plan.slice(0, plan.length - noviIds.length));
            for (let i = plan.length - 1; i > 0; i--) { const jx = Math.floor(Math.random() * (i + 1)); const t2 = plan[i]; plan[i] = plan[jx]; plan[jx] = t2; }
          }
        }
      } catch (_) { /* fallback: sve iz banke */ }
    }
    const pit = plan[0];
    const clan = odaberiClana(pit.pitanje);                              // ⭐ v069 — član komisije po temi
    const fnA = req.app.get('aiOdgovor') || ((sys, msgs) => anthropicPoziv(process.env.MODEL_ODGOVOR, sys, msgs, 500));
    const uv = await fnA(P5_ISPITIVAC + personaBlok(clan),
      [{ role: 'user', content: 'PITANJE IZ BANKE:\n' + pit.pitanje }]);
    const rs = await q(`INSERT INTO usmeni_sesije (korisnik_id, pitanje_id, plan_pitanja, pitanje_br, rezultati, tokeni_in, tokeni_out)
      VALUES ($1,$2,$3,1,'[]',$4,$5) RETURNING id`, [req.uid, pit.id, JSON.stringify(plan.map(x => x.id)), uv.in || 0, uv.out || 0]);
    const sid = rs.rows[0].id;
    await q(`INSERT INTO usmeni_poruke (sesija_id, uloga, tekst) VALUES ($1,'ispitivac',$2)`, [sid, uv.tekst]);
    zabiljezi(req.uid, 'usmeni_start', { sesija_id: sid, pitanje_id: pit.id, pitanja: plan.length });
    res.json({ ok: true, sesija_id: sid, tekst: uv.tekst, pitanje_br: 1, ukupno: plan.length,
      clan: { ime: clan.ime, inicijal: clan.inicijal, podrucje: clan.podrucje, strogost: clan.strogost } }); // ⭐ v069/v100 · 🔒 bez pit.tocno/obrazlozenje
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/usmeni/odgovori', auth, async (req, res) => {
  try {
    if (!AI_ON()) return res.status(503).json({ error: 'AI privremeno nedostupan' });
    const sid = parseInt((req.body || {}).sesija_id, 10);
    const tekst = String((req.body || {}).tekst || '').trim().slice(0, 4000);
    const vrijemeMs = Math.max(0, parseInt((req.body || {}).vrijeme_ms, 10) || 0); // ⭐ v127 — vrijeme odgovora (ms) za bonus brzine
    if (!sid || !tekst) return res.status(400).json({ error: 'Očekujem sesija_id i tekst.' });
    const s2 = await usmeniSesijaVlasnika(sid, req.uid);
    if (!s2) return res.status(404).json({ error: 'Sesija ne postoji.' });
    if (s2.stanje === 'gotovo') return res.status(409).json({ error: 'Sesija je završena — pokreni novu vježbu.' });
    await q(`INSERT INTO usmeni_poruke (sesija_id, uloga, tekst) VALUES ($1,'kandidat',$2)`, [sid, tekst]);
    // ⭐ v053 — transkript SAMO aktivnog pitanja: sve poslije zadnjeg zaključenog (rezultati[].do_id)
    const rezultati = Array.isArray(s2.rezultati) ? s2.rezultati.slice() : [];
    const odId = rezultati.length ? (rezultati[rezultati.length - 1].do_id || 0) : 0;
    const rp = await q(`SELECT id, uloga, tekst FROM usmeni_poruke WHERE sesija_id=$1 ORDER BY id`, [sid]);
    const rpAkt = rp.rows.filter(x => x.id > odId);
    // ⭐ v096 — zlatni odgovor: za abc pitanja iskoristi TEKST točne opcije (ne samo slovo) + obrazloženje
    let zlatniTekst = s2.tocno;
    if (Array.isArray(s2.opcije) && s2.opcije.length && String(s2.tip) === 'abc') {
      const slovo = String(s2.tocno || '').trim().charAt(0).toUpperCase();
      const tocnaOpc = s2.opcije.find(o => String(o).trim().charAt(0).toUpperCase() === slovo);
      if (tocnaOpc) zlatniTekst = String(tocnaOpc).replace(/^[A-D]\)\s*/, '').trim();
    }
    const zlatni = 'ZLATNI ODGOVOR:\n' + zlatniTekst + (s2.obrazlozenje ? '\nOBRAZLOŽENJE:\n' + s2.obrazlozenje : '');
    // ⭐ v064 — distraktor-zamke: ako pitanje ima abc opcije, netočne ponudi ispitivaču kao moguće "je li točno da…?" zamke
    let zamke = '';
    if (Array.isArray(s2.opcije) && s2.opcije.length && String(s2.tip) === 'abc') {
      const tocnoSlovo = String(s2.tocno || '').trim().charAt(0).toUpperCase();
      const netocne = s2.opcije.filter(o => String(o).trim().charAt(0).toUpperCase() !== tocnoSlovo)
        .map(o => String(o).replace(/^[A-D]\)\s*/, '').trim()).filter(Boolean);
      if (netocne.length) zamke = '\n\nMOGUĆE ZAMKE (netočne tvrdnje — smiješ JEDNU povremeno ponuditi kao provjeru "a je li točno da…?", ali NE svaki put i NIKAD kao pravi hint): ' + netocne.slice(0, 3).join(' | ');
    }
    const podloga = zlatni + zamke + '\n\nPITANJE:\n' + s2.pitanje + '\n\nTRANSKRIPT:\n' + usmeniTrans(rpAkt);
    const clanP = odaberiClana(s2.pitanje);                               // ⭐ v100 — isti član ocjenjuje kao što je i pitao
    const fnA = req.app.get('aiOdgovor') || ((sys, msgs, mt) => anthropicPoziv(
      sys.startsWith(P6_PROCJENA) ? process.env.MODEL_PLANNER : process.env.MODEL_ODGOVOR, sys, msgs, mt || 500));
    let tin = 0, tout = 0;
    const pr = await fnA(P6_PROCJENA + personaBlok(clanP), [{ role: 'user', content: podloga }], 400);
    tin += pr.in || 0; tout += pr.out || 0;
    const proc = pokusajJson(pr.tekst) || { sljedece: 'kraj' };              // neparsabilno -> siguran kraj
    // ⭐ v059 — ljudski faktor: broj "ne znam" odgovora kandidata u OVOM pitanju (zaštita od beskonačnog forsiranja)
    const neznamRe = /\b(ne\s?znam|nemam\s?pojma|nemam\s?idej|pojma\s?nemam|ne\s?bih\s?znao|nisam\s?siguran)\b/i;
    const nezna = rpAkt.filter(x => x.uloga === 'kandidat' && neznamRe.test(x.tekst)).length;
    const kraj = proc.sljedece !== 'potpitanje' || !proc.potpitanje || s2.potpitanja >= 3
      || (nezna >= 2); // 2+ "ne znam" (nakon što je već dobio hint) -> zaključi, ne davi
    if (!kraj) {
      const pot = String(proc.potpitanje).slice(0, 500);
      await q(`INSERT INTO usmeni_poruke (sesija_id, uloga, tekst) VALUES ($1,'ispitivac',$2)`, [sid, pot]);
      await q(`UPDATE usmeni_sesije SET potpitanja=potpitanja+1, tokeni_in=tokeni_in+$2, tokeni_out=tokeni_out+$3 WHERE id=$1`, [sid, tin, tout]);
      return res.json({ ok: true, tekst: pot });                            // 🔒 procjena (pokriveno/nedostaje) NE ide klijentu
    }
    // ⭐ v053 — pitanje je zaključeno: P7A ispravak + ocjena /100 (fallback: P6 tocnost)
    const ri = await fnA(P7A_ISPRAVAK + personaBlok(clanP), [{ role: 'user', content: podloga }], 700);
    tin += ri.in || 0; tout += ri.out || 0;
    const isp = pokusajJson(ri.tekst) || {};
    let ocjP = Math.min(100, Math.max(0, parseInt(isp.ocjena, 10) >= 0 ? parseInt(isp.ocjena, 10) : (parseInt(proc.tocnost, 10) || 50)));
    // ⭐ v127 — BONUS BRZINE: brz + dobar odgovor znači da kandidat STVARNO zna → mali bonus (do +8).
    // Samo za solidne odgovore (ocjena≥60); slab odgovor brzinom se ne spašava. Sporo (blizu 90s) = bez bonusa.
    // Bonus se računa na PRVI odgovor pitanja (vrijeme mjereno od prikaza pitanja do prvog slanja).
    if (vrijemeMs > 0 && vrijemeMs < 600000 && ocjP >= 60 && rpAkt.filter(x => x.uloga === 'kandidat').length === 1) {
      const sek = vrijemeMs / 1000;
      let bonus = 0;
      if (sek <= 20) bonus = 8;        // munjevito i točno — očito zna napamet
      else if (sek <= 40) bonus = 5;
      else if (sek <= 60) bonus = 2;
      // 60-90s: bez bonusa (razmišljao, i dalje dobro)
      ocjP = Math.min(100, ocjP + bonus);
    }
    const ispT = String(isp.ispravak || 'Ključne točke ovog pitanja pogledaj u banci pitanja — zapis ispravka nije uspio.').slice(0, 1600);
    // ⭐ v138 — rubrika po kriterijima (dijagnostika; ne mijenja ocjenu/prolaz). Nedostajući kriterij = ocjena pitanja.
    const kri = isp.kriteriji || {};
    const kClamp = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : ocjP; };
    const kriteriji = { potpunost: kClamp(kri.potpunost), tocnost_citata: kClamp(kri.tocnost_citata), prakticnost: kClamp(kri.prakticnost), komunikacija: kClamp(kri.komunikacija) };
    const rIsp = await q(`INSERT INTO usmeni_poruke (sesija_id, uloga, tekst) VALUES ($1,'ispitivac',$2) RETURNING id`,
      [sid, 'Ispravak (pitanje ' + s2.pitanje_br + ') — ocjena ' + ocjP + '/100.\n' + ispT]);
    rezultati.push({ br: s2.pitanje_br, pitanje_id: s2.pitanje_id, ocjena: ocjP, kriteriji, do_id: rIsp.rows[0].id });
    const plan = Array.isArray(s2.plan_pitanja) ? s2.plan_pitanja : [];
    const ukupnoPit = Math.max(plan.length, 1);
    if (s2.pitanje_br < ukupnoPit) {
      // sljedeće pitanje: novi P5 uvod, brojač potpitanja na nulu
      const nextId = plan[s2.pitanje_br];                                    // pitanje_br je 1-baziran -> indeks sljedećeg
      const np = await q(`SELECT id, pitanje FROM pitanja WHERE id=$1`, [nextId]);
      const clan2 = odaberiClana(np.rows[0].pitanje);                         // ⭐ v069 — član komisije za sljedeće pitanje
      const uv = await fnA(P5_ISPITIVAC + personaBlok(clan2),
        [{ role: 'user', content: 'PITANJE IZ BANKE:\n' + np.rows[0].pitanje }], 500);
      tin += uv.in || 0; tout += uv.out || 0;
      await q(`INSERT INTO usmeni_poruke (sesija_id, uloga, tekst) VALUES ($1,'ispitivac',$2)`, [sid, uv.tekst]);
      await q(`UPDATE usmeni_sesije SET pitanje_id=$2, pitanje_br=$3, potpitanja=0, rezultati=$4,
        tokeni_in=tokeni_in+$5, tokeni_out=tokeni_out+$6 WHERE id=$1`,
        [sid, nextId, s2.pitanje_br + 1, JSON.stringify(rezultati), tin, tout]);
      return res.json({ ok: true, ispravak: { ocjena: ocjP, tekst: ispT }, tekst: uv.tekst,
        pitanje_br: s2.pitanje_br + 1, ukupno: ukupnoPit,
        clan: { ime: clan2.ime, inicijal: clan2.inicijal, podrucje: clan2.podrucje, strogost: clan2.strogost } }); // ⭐ v069/v100 · 🔒 bez zlatnog SLJEDEĆEG pitanja
    }
    // ⭐ v053 — finale DETERMINISTIČKI (financijska matematika sveta 🔒): prosjek pitanja, prag USMENI_PROLAZ
    const suma = rezultati.reduce((a, x) => a + (x.ocjena || 0), 0);
    const ukupna = Math.min(100, Math.max(1, Math.round(suma / rezultati.length)));
    const prag = USMENI_PROLAZ();
    const prolaz = ukupna >= prag;
    const najsl = rezultati.slice().sort((a, b) => a.ocjena - b.ocjena).slice(0, 2);
    // ⭐ v138 — agregacija kriterija DETERMINISTIČKI (prosjek po pitanjima). Ne utječe na ocjenu/prolaz.
    const kAgg = { potpunost: 0, tocnost_citata: 0, prakticnost: 0, komunikacija: 0 }; let kN = 0;
    for (const x of rezultati) { if (x.kriteriji) { kN++; for (const kk of Object.keys(kAgg)) kAgg[kk] += (parseInt(x.kriteriji[kk], 10) || 0); } }
    const kriterijiUk = kN ? { potpunost: Math.round(kAgg.potpunost / kN), tocnost_citata: Math.round(kAgg.tocnost_citata / kN), prakticnost: Math.round(kAgg.prakticnost / kN), komunikacija: Math.round(kAgg.komunikacija / kN) } : null;
    const rub = {
      ocjena: ukupna, prolaz, prag,
      po_pitanjima: rezultati.map(x => ({ br: x.br, ocjena: x.ocjena })),
      kriteriji: kriterijiUk,
      sazetak: 'Ispit od ' + rezultati.length + (rezultati.length === 1 ? ' pitanje' : ' pitanja') + ' — prosjek ' + ukupna + '/100. '
        + (prolaz ? 'Prag od ' + prag + '/100 je dosegnut.' : 'Prag od ' + prag + '/100 nije dosegnut.'),
      savjet: prolaz ? 'Zadrži formu — ponovi ispravke pitanja s ocjenom ispod ' + prag + '.'
        : 'Najslabije: ' + najsl.map(x => 'pitanje ' + x.br + ' (' + x.ocjena + '/100)').join(', ') + ' — kreni od tih ispravaka iznad.'
    };
    const zav = 'Usmeni ispit je zaključen — ukupna ocjena ' + ukupna + '/100 (prag ' + prag + '). '
      + (prolaz ? 'PROLAZ.' : 'Ovaj put nije prolaz — pogledaj ispravke po pitanjima.');
    await q(`INSERT INTO usmeni_poruke (sesija_id, uloga, tekst) VALUES ($1,'ispitivac',$2)`, [sid, zav]);
    await q(`UPDATE usmeni_sesije SET stanje='gotovo', rubrika=$2, rezultati=$3, zavrsena_at=now(),
      ocjena=$6, prolaz=$7, tokeni_in=tokeni_in+$4, tokeni_out=tokeni_out+$5 WHERE id=$1`, [sid, JSON.stringify(rub), JSON.stringify(rezultati), tin, tout, ukupna, prolaz]); // ⭐ v066 — ocjena+prolaz za povijest
    zabiljezi(req.uid, 'usmeni_kraj', { sesija_id: sid, ocjena: ukupna, prolaz });
    res.json({ ok: true, gotovo: true, ispravak: { ocjena: ocjP, tekst: ispT }, tekst: zav, rubrika: rub });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/usmeni/sesija/:id', auth, async (req, res) => {
  try {
    const s2 = await usmeniSesijaVlasnika(parseInt(req.params.id, 10), req.uid);
    if (!s2) return res.status(404).json({ error: 'Sesija ne postoji.' });
    const rp = await q(`SELECT uloga, tekst, created_at FROM usmeni_poruke WHERE sesija_id=$1 ORDER BY id`, [s2.id]);
    res.json({ ok: true, stanje: s2.stanje, poruke: rp.rows, pitanje_br: s2.pitanje_br,
      ukupno: (Array.isArray(s2.plan_pitanja) ? s2.plan_pitanja : []).length || 1,
      rubrika: s2.stanje === 'gotovo' ? s2.rubrika : null }); // ⭐ v053 — napredak ispita; 🔒 nikad tocno/obrazlozenje
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══ ⭐ v061 — F7 PISMENI TEST (free tier; usmeni ostaje Pro) ═══
const TEST_BR_PITANJA = () => Math.max(1, parseInt(process.env.TEST_BR_PITANJA || '10', 10) || 10); // ⭐ v087 — 10 pitanja (bilo 20)
const TEST_PROLAZ = () => Math.min(100, Math.max(1, parseInt(process.env.TEST_PROLAZ || '80', 10) || 80)); // ⭐ v065 — prag 80 (bio 90)
const TEST_MJESECNO = () => Math.max(1, parseInt(process.env.TEST_MJESECNO || '10', 10) || 10); // free kvota
// ⭐ v091 — RUNTIME miješanje ABC opcija po (sesija, pitanje): isti par uvijek daje istu permutaciju
// (pa slanje i ocjenjivanje slažu), ali svaki test i pitanje ima drugačiji raspored -> nema fiksnog uzorka.
// Seed iz sesija_id+pitanje_id (bez pamćenja mape u bazi). Vraća { opcije, permTocno } gdje je permTocno
// slovo (A-D) koje je TOČNO NAKON miješanja. Klijent dobiva samo promiješane opcije (bez točnog 🔒).
function seededShuffleIdx(n, seed) { // Fisher-Yates s mulberry32 PRNG (deterministički iz seeda)
  // ⭐ v127 — dodatno hashiranje seeda (splitmix32) da male promjene seeda daju posve različite permutacije;
  // stari seed je davao pristran raspored (točan prečesto na D) — sad ravnomjerno po A/B/C/D.
  let h = seed >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  let s = h >>> 0; const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
  return idx;
}
function promijesajOpcije(pit, sesija_id, pitanje_id, sesijaSeed) {
  // ⭐ v129 — miješa ABC i TOCNO_NETOCNO. Seed: slučajan po sesiji (sesijaSeed) + pitanje_id → svaki test drukčiji raspored.
  // Ako sesijaSeed nema (stare sesije), fallback na determinizam po sesija_id (zadržava kompatibilnost pri ocjenjivanju).
  const baza = (sesijaSeed != null ? Number(sesijaSeed) : Number(sesija_id) * 100003) >>> 0;
  const seed = (baza + Number(pitanje_id) * 2654435761) >>> 0;
  // tocno_netocno: opcije su ['Točno','Netočno'] ili slično — miješaj redoslijed da "Točno" nije uvijek prvo
  if (pit.tip === 'tocno_netocno') {
    const opc = Array.isArray(pit.opcije) && pit.opcije.length >= 2
      ? pit.opcije.map(o => String(o).replace(/^\s*[A-D]\)\s*/, '').trim())
      : ['Točno', 'Netočno'];
    const perm = seededShuffleIdx(opc.length, seed);
    const slova = ['A', 'B', 'C', 'D'];
    // permTocno: nađi gdje je "Točno" opcija završila; ocjenjivanje ide po RIJEČI pa permTocno ostaje riječ
    const opcije = perm.map((stariIdx, novaPoz) => slova[novaPoz] + ') ' + opc[stariIdx]);
    return { opcije, permTocno: pit.tocno }; // tocno ostaje riječ (Točno/Netočno) — testOcijeni radi po riječi
  }
  if (pit.tip !== 'abc' || !Array.isArray(pit.opcije) || pit.opcije.length < 2) return { opcije: pit.opcije, permTocno: pit.tocno };
  const n = pit.opcije.length;
  const cist = pit.opcije.map((o) => String(o).replace(/^\s*[A-D]\)\s*/, '').trim());
  const perm = seededShuffleIdx(n, seed); // perm[novaPozicija] = staraPozicija
  const slova = ['A', 'B', 'C', 'D', 'E', 'F'];
  const stariTocnoIdx = String(pit.tocno || '').trim().toUpperCase().charCodeAt(0) - 65; // A=0
  let novoTocnoIdx = 0;
  const opcije = perm.map((stariIdx, novaPoz) => {
    if (stariIdx === stariTocnoIdx) novoTocnoIdx = novaPoz;
    return slova[novaPoz] + ') ' + cist[stariIdx];
  });
  return { opcije, permTocno: slova[novoTocnoIdx] };
}
const testPitanjeKlijentu = (p2) => ({ id: p2.id, tip: p2.tip, pitanje: p2.pitanje, opcije: p2.opcije }); // 🔒 bez tocno/obrazlozenje
function testOcijeni(tip, tocno, odgovor) { // deterministicka usporedba
  const t = String(tocno || '').trim().toUpperCase(), o = String(odgovor || '').trim().toUpperCase();
  // ⭐ v087 — ako je točan odgovor slovo (A-D), uvijek usporedi po slovu (pokriva i "A) Točno/B) Netočno" format)
  if (tip === 'abc' || /^[A-D]$/.test(t.charAt(0)) && t.length <= 2) return o.charAt(0) === t.charAt(0);
  // tocno_netocno (odgovor je riječ): prihvati TOČNO/T/DA vs NETOČNO/N/NE (normalizacija na T/N)
  const n = (s) => (s.startsWith('NE') || s.startsWith('N')) && !s.startsWith('NA') ? 'N' : 'T';
  return n(o) === n(t);
}
// ⭐ v136 — kanonski Točno/Netočno iz bilo koje riječi (radi za "Točno"/"Netočno", "Nije", "Da/Ne" po prvom slovu N/NE).
const kanonTN = (s) => { const u = String(s || '').trim().toUpperCase(); return ((u.startsWith('NE')) || (u.charAt(0) === 'N' && !u.startsWith('NA'))) ? 'N' : 'T'; };
// ⭐ v136 — kanonska RIJEČ točnog odgovora za tocno_netocno kad pitanje NEMA opcija: razrješava "A"/"B" (preko sintetskih Točno/Netočno) i "A) ..." prefiks.
function tocnaRijecTN(pit) {
  let t = String((pit && pit.tocno) || '').trim();
  if (/^[A-F]$/i.test(t)) { const idx = t.toUpperCase().charCodeAt(0) - 65; t = ['Točno', 'Netočno'][idx] || t; }
  return t.replace(/^\s*[A-F]\)\s*/, '').trim();
}
async function testSesijaVlasnika(id, uid) {
  const r = await q(`SELECT * FROM test_sesije WHERE id=$1 AND korisnik_id=$2`, [id, uid]);
  return r.rowCount ? r.rows[0] : null;
}

app.post('/api/test/start', auth, async (req, res) => {
  try {
    const k = await ucitajKorisnika(req.uid);
    if (!k) return res.status(404).json({ error: 'Korisnik ne postoji.' });
    if (!k.program_id) return res.status(400).json({ error: 'Prvo odaberi strukovno područje u kartici Ja.' });
    if (!k.je_superadmin && k.tier !== 'pro') { // free: mjesecna kvota
      const odMj = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      // ⭐ v136 — SRS ponavljanja (vrsta='srs') NE troše mjesečnu kvotu pravih testova; broji samo vrsta='test'.
      const rc = await q(`SELECT COUNT(*)::int AS n FROM test_sesije WHERE korisnik_id=$1 AND created_at >= $2 AND vrsta='test'`, [req.uid, odMj]);
      if (rc.rows[0].n >= TEST_MJESECNO()) return res.status(429).json({ error: 'Mjesečna kvota testova je iskorištena — nova stiže s novim mjesecom, ili prijeđi na Pro.' });
    }
    const uze = String(k.uze_podrucje || '');
    const tema = String((req.body || {}).tema || '').slice(0, 120).trim(); // ⭐ v138 — ciljana vježba: samo zadano uže područje ("vježbaj baš ovo")
    // ⭐ v086 — ABC pitanje MORA imati opcije (inače prazan ekran); filtriramo u JS-u (pg-mem safe, bez jsonb_array_length)
    const opcijeOk = (row) => row.tip === 'tocno_netocno' || (Array.isArray(row.opcije) && row.opcije.length >= 2);
    let rpAll = tema
      ? await q(`SELECT id, tip, opcije FROM pitanja WHERE program_id=$1 AND status='ovjereno' AND tip IN ('abc','tocno_netocno') AND uze_podrucje=$2 ORDER BY id LIMIT 600`, [k.program_id, tema])
      : await q(`SELECT id, tip, opcije FROM pitanja WHERE program_id=$1 AND status='ovjereno' AND tip IN ('abc','tocno_netocno')
      ${uze ? "AND (uze_podrucje=$2 OR uze_podrucje='')" : ''} ORDER BY id LIMIT 600`,
        uze ? [k.program_id, uze] : [k.program_id]);                          // 80% zajedničkih + 20% za uže područje (kao usmeni)
    let rp = { rows: rpAll.rows.filter(opcijeOk), rowCount: rpAll.rows.filter(opcijeOk).length };
    if (!rp.rowCount) { // fallback: ignoriraj uže ako je premalo
      rpAll = await q(`SELECT id, tip, opcije FROM pitanja WHERE program_id=$1 AND status='ovjereno' AND tip IN ('abc','tocno_netocno') ORDER BY id LIMIT 600`, [k.program_id]);
      rp = { rows: rpAll.rows.filter(opcijeOk), rowCount: rpAll.rows.filter(opcijeOk).length };
    }
    if (!rp.rowCount) return res.status(404).json({ error: 'Banka još nema pismenih pitanja s ponuđenim odgovorima za tvoj program. Ako si nedavno uvezao pitanja, ponovno ih uvezi (Admin → Pitanja) da se dopune opcije.' }); // ⭐ v086
    const shuf = rp.rows.map(x => x.id);
    for (let i = shuf.length - 1; i > 0; i--) { const jx = Math.floor(Math.random() * (i + 1)); const t2 = shuf[i]; shuf[i] = shuf[jx]; shuf[jx] = t2; }
    const ukupno = Math.min(TEST_BR_PITANJA(), shuf.length);
    let plan = shuf.slice(0, ukupno);
    // ⭐ v061 — ~10% AI "iznenađenja" iz živih propisa (1 poziv MODEL_PLANNER; platformski trošak, NE tereti korisnikov budžet;
    // fallback = banka; generirana pitanja se SPREMAJU pa recikliraju kroz banku u budućim testovima)
    const aiN = Math.min(Math.round(ukupno * 0.10), 3);
    if (aiN > 0 && AI_ON() && !tema) { // ⭐ v138 — ciljana vježba ostaje strogo u zadanoj temi (bez AI iznenađenja izvan teme)
      try {
        const rc2 = await q(`SELECT id FROM clanci WHERE status='aktivan' LIMIT 800`);
        if (rc2.rowCount >= aiN) {
          const cs = rc2.rows.map(x => x.id);
          for (let i = cs.length - 1; i > 0; i--) { const jx = Math.floor(Math.random() * (i + 1)); const t2 = cs[i]; cs[i] = cs[jx]; cs[jx] = t2; }
          const rclRows = [];
          for (const cid of cs.slice(0, aiN)) { // pg-mem: bez ANY(array) — petlja po id
            const r1 = await q(`SELECT c.id, c.oznaka, c.naslov, c.tekst, d.naziv FROM clanci c JOIN dokumenti d ON d.id=c.dokument_id WHERE c.id=$1`, [cid]);
            if (r1.rowCount) rclRows.push(r1.rows[0]);
          }
          const izvor = rclRows.map(c => `[${c.id}] ${c.naziv} — ${c.oznaka} ${c.naslov}\n${String(c.tekst).slice(0, 1500)}`).join('\n\n');
          const fnA = req.app.get('aiOdgovor') || ((sys, msgs, mt) => anthropicPoziv(process.env.MODEL_PLANNER, sys, msgs, mt || 900));
          const g = await fnA(P3T_PISMENI, [{ role: 'user', content: 'Generiraj TOČNO ' + aiN + ' pitanja.\n\nIZVOR:\n' + izvor }], 900);
          const noviIds = [];
          for (const linija of String(g.tekst || '').split('\n')) {
            const o = pokusajJson(linija);
            if (!o || o.tip !== 'abc' || !Array.isArray(o.opcije) || o.opcije.length !== 4 || !/^[A-D]$/.test(String(o.tocno || '').trim().toUpperCase())) continue;
            const ri = await q(`INSERT INTO pitanja (program_id, uze_podrucje, tip, pitanje, opcije, tocno, obrazlozenje, clanak_refs, izvor, rok_oznaka, tezina, status)
              VALUES ($1,'','abc',$2,$3,$4,$5,$6,'ai','AI-GEN',$7,'ovjereno') RETURNING id`,
              [k.program_id, String(o.pitanje).slice(0, 1000), JSON.stringify(o.opcije), String(o.tocno).trim().toUpperCase(),
               String(o.obrazlozenje || '').slice(0, 1200), Array.isArray(o.clanak_refs) ? o.clanak_refs.filter(x => Number.isInteger(x)) : [],
               Math.min(5, Math.max(1, parseInt(o.tezina, 10) || 3))]);
            noviIds.push(ri.rows[0].id);
            if (noviIds.length >= aiN) break;
          }
          if (noviIds.length) plan = noviIds.concat(plan.slice(0, ukupno - noviIds.length)); // AI pitanja rasporedi kasnije shuffleom
          for (let i = plan.length - 1; i > 0; i--) { const jx = Math.floor(Math.random() * (i + 1)); const t2 = plan[i]; plan[i] = plan[jx]; plan[jx] = t2; }
        }
      } catch (_) { /* fallback: sve iz banke */ }
    }
    const seedRnd = Math.floor(Math.random() * 2000000000); // ⭐ v129 — slučajan seed po sesiji za pravi random raspored
    const rs = await q(`INSERT INTO test_sesije (korisnik_id, plan_pitanja, pitanje_br, rezultati, shuffle_seed)
      VALUES ($1,$2,1,'[]',$3) RETURNING id`, [req.uid, JSON.stringify(plan), seedRnd]);
    const p1 = await q(`SELECT id, tip, pitanje, opcije FROM pitanja WHERE id=$1`, [plan[0]]);
    zabiljezi(req.uid, 'test_start', { sesija_id: rs.rows[0].id, pitanja: plan.length });
    const p1m = promijesajOpcije(p1.rows[0], rs.rows[0].id, p1.rows[0].id, seedRnd); // ⭐ v129 — seed po sesiji
    res.json({ ok: true, sesija_id: rs.rows[0].id, pitanje: testPitanjeKlijentu({ ...p1.rows[0], opcije: p1m.opcije }), pitanje_br: 1, ukupno: plan.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/test/odgovori', auth, async (req, res) => {
  try {
    const sid = parseInt((req.body || {}).sesija_id, 10);
    const odgovor = String((req.body || {}).odgovor || '').trim().slice(0, 2000); // ⭐ v133 — bilo slice(0,40) iz doba kad je odgovor bio SLOVO; sad je PUN TEKST opcije (v131) pa 40 znakova odsijeca duge opcije → usporedba po tekstu je uvijek padala (točan=netočno). Sad 2000.
    if (!sid || !odgovor) return res.status(400).json({ error: 'Očekujem sesija_id i odgovor.' });
    const s2 = await testSesijaVlasnika(sid, req.uid);
    if (!s2) return res.status(404).json({ error: 'Sesija ne postoji.' });
    if (s2.stanje === 'gotovo') return res.status(409).json({ error: 'Test je završen — pokreni novi.' });
    const plan = Array.isArray(s2.plan_pitanja) ? s2.plan_pitanja : [];
    const pid = plan[s2.pitanje_br - 1];
    if (!pid) return res.status(409).json({ error: 'Sesija je oštećena — pokreni novi test.' }); // ⭐ v061 guard
    const rp = await q(`SELECT id, tip, pitanje, opcije, tocno, obrazlozenje FROM pitanja WHERE id=$1`, [pid]);
    if (!rp.rowCount) return res.status(409).json({ error: 'Pitanje je u međuvremenu povučeno iz banke — pokreni novi test.' }); // ⭐ v061 guard
    const pit = rp.rows[0];
    // ⭐ v134 — ROBUSNO ocjenjivanje po tekstu (radi za sve formate tocno/opcija). Klijent šalje čist tekst odabrane opcije.
    let tocan;
    const norm = (x) => String(x || '').replace(/^\s*[A-F]\)\s*/, '').trim().toLowerCase();
    // ⭐ v136 — tocno_netocno S OPCIJAMA ide istim robusnim indeks-po-tekstu putem kao abc (radi za bilo koji tekst opcije).
    if ((pit.tip === 'abc' || pit.tip === 'tocno_netocno') && Array.isArray(pit.opcije) && pit.opcije.length) {
      const nOdg = norm(odgovor);
      // 1) nađi INDEKS opcije koju je korisnik odabrao (po tekstu)
      const odabraniIdx = pit.opcije.findIndex(o => norm(o) === nOdg);
      // 2) odredi INDEKS točne opcije iz pit.tocno (može biti slovo "A"/"B" ILI tekst opcije)
      const tRaw = String(pit.tocno || '').trim();
      let tocanIdx = -1;
      if (/^[A-F]$/i.test(tRaw)) {
        tocanIdx = tRaw.toUpperCase().charCodeAt(0) - 65;         // slovo → indeks
      } else if (/^[A-F]\)/i.test(tRaw)) {
        tocanIdx = tRaw.charAt(0).toUpperCase().charCodeAt(0) - 65; // "A) ..." → indeks
      } else {
        tocanIdx = pit.opcije.findIndex(o => norm(o) === norm(tRaw)); // tocno je tekst → nađi indeks
      }
      // 3) točan ako je odabrani indeks == točni indeks (i valjani su)
      if (odabraniIdx >= 0 && tocanIdx >= 0) {
        tocan = odabraniIdx === tocanIdx;
      } else {
        // fallback: izravna usporedba teksta odgovora s tekstom točne opcije (po slovu ako je moguće)
        const idxFromLetter = /^[A-F]/i.test(tRaw) ? (tRaw.toUpperCase().charCodeAt(0) - 65) : -1;
        const tocnaOpc = (idxFromLetter >= 0 && idxFromLetter < pit.opcije.length) ? pit.opcije[idxFromLetter] : tRaw;
        tocan = nOdg === norm(tocnaOpc) && norm(tocnaOpc) !== '';
      }
    } else {
      // ⭐ v136 — tocno_netocno BEZ opcija: kanonski T/N odgovora vs kanonski T/N razriješene točne riječi
      // (radi i kad je pit.tocno slovo "A"/"B" ili "A) Točno", ne samo čista riječ). Prije je testOcijeni na
      // slovo-tocno uspoređivao slovo s riječju odgovora → točan je javljao netočno za dio banke.
      tocan = kanonTN(odgovor) === kanonTN(tocnaRijecTN(pit));
    }
    const pitM = promijesajOpcije(pit, sid, pid, s2.shuffle_seed); // za feedback prikaz (permTocno slovo)
    // ⭐ v134 — tekst točne opcije (klijent boja po tekstu); isti robustni indeks kao ocjenjivanje
    let tocnoTekst = String(pit.tocno || '');
    if ((pit.tip === 'abc' || pit.tip === 'tocno_netocno') && Array.isArray(pit.opcije) && pit.opcije.length) { // ⭐ v136 — i T/N s opcijama
      const tRaw2 = String(pit.tocno || '').trim();
      let ti = -1;
      if (/^[A-F]$/i.test(tRaw2)) ti = tRaw2.toUpperCase().charCodeAt(0) - 65;
      else if (/^[A-F]\)/i.test(tRaw2)) ti = tRaw2.charAt(0).toUpperCase().charCodeAt(0) - 65;
      else ti = pit.opcije.findIndex(o => String(o).replace(/^\s*[A-F]\)\s*/, '').trim().toLowerCase() === tRaw2.toLowerCase());
      if (ti >= 0 && ti < pit.opcije.length) tocnoTekst = String(pit.opcije[ti]).replace(/^\s*[A-F]\)\s*/, '').trim();
    } else if (pit.tip === 'tocno_netocno') { // ⭐ v136 — bez opcija: prava riječ (Točno/Netočno), ne slovo — za bojanje/feedback
      tocnoTekst = tocnaRijecTN(pit);
    }
    const rezultati = (Array.isArray(s2.rezultati) ? s2.rezultati : []).concat([{ br: s2.pitanje_br, pitanje_id: pid, odgovor, tocan }]);
    // ⭐ v062 — F8 SRS: kriv odgovor bilo gdje -> stavka u ponavljanje (box1, due sad); točan u SRS sesiji -> napreduj kutiju
    const SRS_DANI = [1, 3, 7, 14, 30]; // box 1..5 -> interval dana za SLJEDEĆE ponavljanje
    if (!tocan) {
      const due = new Date(Date.now() + SRS_DANI[0] * 864e5).toISOString();
      await q(`INSERT INTO srs_stavke (korisnik_id, pitanje_id, box, due_at, updated_at)
        VALUES ($1,$2,1,$3,now()) ON CONFLICT (korisnik_id, pitanje_id)
        DO UPDATE SET box=1, due_at=$3, updated_at=now()`, [req.uid, pid, due]);
    } else if (s2.vrsta === 'srs') { // točan u ponavljanju -> box+1, dalje odgodi (max box 5)
      const rb = await q(`SELECT box FROM srs_stavke WHERE korisnik_id=$1 AND pitanje_id=$2`, [req.uid, pid]);
      if (rb.rowCount) {
        const nb = Math.min(5, (rb.rows[0].box || 1) + 1);
        const due = new Date(Date.now() + SRS_DANI[nb - 1] * 864e5).toISOString();
        await q(`UPDATE srs_stavke SET box=$3, due_at=$4, updated_at=now() WHERE korisnik_id=$1 AND pitanje_id=$2`, [req.uid, pid, nb, due]);
      }
    }
    const gotovo = s2.pitanje_br >= plan.length;
    if (!gotovo) {
      const np = await q(`SELECT id, tip, pitanje, opcije FROM pitanja WHERE id=$1`, [plan[s2.pitanje_br]]);
      if (np.rowCount) { // ⭐ v061 guard — sljedeće postoji: normalan tok
        await q(`UPDATE test_sesije SET pitanje_br=$2, rezultati=$3 WHERE id=$1`, [sid, s2.pitanje_br + 1, JSON.stringify(rezultati)]);
        const npM = promijesajOpcije(np.rows[0], sid, np.rows[0].id, s2.shuffle_seed); // ⭐ v129 — sljedeće pitanje isti seed sesije
        return res.json({ ok: true, tocan, tocno: tocnoTekst, obrazlozenje: pit.obrazlozenje, // ⭐ v131 — tekst točne opcije (klijent boja po tekstu)
          pitanje: testPitanjeKlijentu({ ...np.rows[0], opcije: npM.opcije }), pitanje_br: s2.pitanje_br + 1, ukupno: plan.length });
      } // sljedeće povučeno iz banke -> zaključi test s dosadašnjim odgovorima (bolje nego crash)
    }
    // finale DETERMINISTIČKI (financijska matematika sveta 🔒)
    const tocnih = rezultati.filter(x => x.tocan).length;
    const ocjena = Math.min(100, Math.max(0, Math.round(100 * tocnih / rezultati.length)));
    const prolaz = ocjena >= TEST_PROLAZ();
    await q(`UPDATE test_sesije SET stanje='gotovo', ocjena=$2, prolaz=$3, rezultati=$4, zavrsena_at=now() WHERE id=$1`,
      [sid, ocjena, prolaz, JSON.stringify(rezultati)]);
    zabiljezi(req.uid, 'test_kraj', { sesija_id: sid, ocjena, prolaz });
    res.json({ ok: true, tocan, tocno: tocnoTekst, obrazlozenje: pit.obrazlozenje, gotovo: true, // ⭐ v131 — tekst točne opcije
      rezultat: { ocjena, prolaz, prag: TEST_PROLAZ(), tocnih, ukupno: rezultati.length } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══ ⭐ v066 — POVIJEST USMENIH ISPITA (podaci se već spremaju; ovdje se izlažu) ═══
app.get('/api/usmeni/povijest', auth, async (req, res) => {
  try {
    const r = await q(`SELECT id, ocjena, prolaz, plan_pitanja, zavrsena_at FROM usmeni_sesije
      WHERE korisnik_id=$1 AND stanje='gotovo' AND zavrsena_at IS NOT NULL
      ORDER BY id DESC LIMIT 50`, [req.uid]);
    const sve = r.rows.map(x => ({ id: x.id, ocjena: x.ocjena, prolaz: x.prolaz,
      broj_pitanja: (Array.isArray(x.plan_pitanja) ? x.plan_pitanja : []).length, zavrsena_at: x.zavrsena_at }));
    const ocjene = sve.filter(x => typeof x.ocjena === 'number');
    const prosjek = ocjene.length ? Math.round(ocjene.reduce((a, x) => a + x.ocjena, 0) / ocjene.length) : null;
    const najbolja = ocjene.length ? Math.max(...ocjene.map(x => x.ocjena)) : null;
    const polozeno = sve.filter(x => x.prolaz).length;
    res.json({ ok: true, broj: sve.length, prosjek, najbolja, polozeno, prag: USMENI_PROLAZ(),
      sesije: sve.slice().reverse() }); // kronoloski za graf
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/usmeni/povijest/:id', auth, async (req, res) => {
  try {
    const s2 = await q(`SELECT id, rubrika, rezultati, plan_pitanja, zavrsena_at, ocjena, prolaz
      FROM usmeni_sesije WHERE id=$1 AND korisnik_id=$2 AND stanje='gotovo'`, [parseInt(req.params.id, 10), req.uid]);
    if (!s2.rowCount) return res.status(404).json({ error: 'Ispit nije pronađen.' });
    const s = s2.rows[0];
    const plan = Array.isArray(s.plan_pitanja) ? s.plan_pitanja : [];
    const rez = Array.isArray(s.rezultati) ? s.rezultati : [];
    // dohvati tekstove pitanja (samo pitanja, NE zlatni odgovor — 🔒 klijent ne dobiva točne odgovore)
    const pitanja = [];
    for (let i = 0; i < plan.length; i++) {
      const rp = await q(`SELECT pitanje FROM pitanja WHERE id=$1`, [plan[i]]);
      const r = rez.find(x => x.pitanje_id === plan[i] || x.br === i + 1);
      pitanja.push({ br: i + 1, pitanje: rp.rowCount ? rp.rows[0].pitanje : '(pitanje uklonjeno)', ocjena: r ? r.ocjena : null });
    }
    res.json({ ok: true, id: s.id, ocjena: s.ocjena, prolaz: s.prolaz, zavrsena_at: s.zavrsena_at,
      rubrika: s.rubrika || null, pitanja });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/test/napredak', auth, async (req, res) => { // ⭐ v061 — Napredak tab: ocjene kroz vrijeme
  try {
    const r = await q(`SELECT id, ocjena, prolaz, created_at FROM test_sesije
      WHERE korisnik_id=$1 AND stanje='gotovo' ORDER BY id DESC LIMIT 20`, [req.uid]);
    const sve = r.rows;
    const prosjek = sve.length ? Math.round(sve.reduce((a, x) => a + (x.ocjena || 0), 0) / sve.length) : null;
    const najbolja = sve.length ? Math.max(...sve.map(x => x.ocjena || 0)) : null;
    res.json({ ok: true, broj: sve.length, prosjek, najbolja, sesije: sve.reverse() }); // kronoloski za graf
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══ ⭐ v062 — F8 SRS "Ponovi pogreške" (besplatno, bez kvote — jezgra učenja) ═══
app.get('/api/srs/status', auth, async (req, res) => {
  try {
    const rd = await q(`SELECT COUNT(*)::int AS n FROM srs_stavke WHERE korisnik_id=$1 AND due_at <= now()`, [req.uid]);
    const ru = await q(`SELECT COUNT(*)::int AS n FROM srs_stavke WHERE korisnik_id=$1`, [req.uid]);
    res.json({ ok: true, dospjelo: rd.rows[0].n, ukupno: ru.rows[0].n });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/srs/start', auth, async (req, res) => {
  try {
    const rp = await q(`SELECT s.pitanje_id FROM srs_stavke s JOIN pitanja p ON p.id=s.pitanje_id
      WHERE s.korisnik_id=$1 AND s.due_at <= now() AND p.status='ovjereno' AND p.tip IN ('abc','tocno_netocno')
      ORDER BY s.due_at LIMIT 200`, [req.uid]);
    if (!rp.rowCount) return res.status(404).json({ error: 'Nema pitanja za ponavljanje — riješi koji test pa se pogreške skupe ovdje.' });
    const shuf = rp.rows.map(x => x.pitanje_id);
    for (let i = shuf.length - 1; i > 0; i--) { const jx = Math.floor(Math.random() * (i + 1)); const t2 = shuf[i]; shuf[i] = shuf[jx]; shuf[jx] = t2; }
    const plan = shuf.slice(0, Math.min(TEST_BR_PITANJA(), shuf.length));
    const seedRnd = Math.floor(Math.random() * 2000000000); // ⭐ v129
    const rs = await q(`INSERT INTO test_sesije (korisnik_id, plan_pitanja, pitanje_br, rezultati, vrsta, shuffle_seed)
      VALUES ($1,$2,1,'[]','srs',$3) RETURNING id`, [req.uid, JSON.stringify(plan), seedRnd]);
    const p1 = await q(`SELECT id, tip, pitanje, opcije FROM pitanja WHERE id=$1`, [plan[0]]);
    zabiljezi(req.uid, 'srs_start', { sesija_id: rs.rows[0].id, pitanja: plan.length });
    const p1m = promijesajOpcije(p1.rows[0], rs.rows[0].id, p1.rows[0].id, seedRnd); // ⭐ v129 — seed po sesiji
    res.json({ ok: true, sesija_id: rs.rows[0].id, pitanje: testPitanjeKlijentu({ ...p1.rows[0], opcije: p1m.opcije }), pitanje_br: 1, ukupno: plan.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/ai/ingest-lista', auth, zahtijevajSuperadmin, async (req, res) => { // ⭐ v021 — napredak ingesta po dokumentu
  try {
    const r = await q(`SELECT d.id, d.naziv, d.vrsta, COUNT(c.id)::int AS clanaka,
        COALESCE(SUM(CASE WHEN ch.n > 0 THEN 1 ELSE 0 END),0)::int AS s_chunkovima
      FROM dokumenti d LEFT JOIN clanci c ON c.dokument_id=d.id AND c.status='aktivan'
      LEFT JOIN (SELECT clanak_id, COUNT(*)::int AS n FROM chunkovi GROUP BY clanak_id) ch ON ch.clanak_id=c.id
      GROUP BY d.id, d.naziv, d.vrsta ORDER BY d.vrsta, d.naziv`);
    let ukupno_chunkova = null;
    try { const rc = await q(`SELECT COUNT(*)::int AS n FROM chunkovi`); ukupno_chunkova = rc.rows[0].n; } catch (_) {} // ⭐ v026
    res.json({ ok: true, dokumenti: r.rows, ukupno_chunkova });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v115 — obriši CIJELU GRUPU dokumenata po vrsti (npr. svih 19 'tehnicki_uvjet' odjednom).
// Traži potvrdu (body.potvrda === 'OBRISI-<VRSTA>') da se ne okine slučajno.
app.post('/api/admin/vrsta-obrisi', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const vrsta = String((req.body || {}).vrsta || '').trim();
    const potvrda = String((req.body || {}).potvrda || '').trim();
    if (!vrsta) return res.status(400).json({ error: 'Nedostaje vrsta.' });
    // ⭐ v116 — robusnija potvrda: usporedi bez ovisnosti o velikim/malim slovima
    const ocekivano = ('OBRISI-' + vrsta).toUpperCase();
    if (potvrda.toUpperCase() !== ocekivano) return res.status(400).json({ error: 'Potvrda se ne poklapa. Očekujem "' + ocekivano + '".' });
    const koraci = [];
    const out = await withTx(async (c) => {
      const rd = await c.query('SELECT id FROM dokumenti WHERE vrsta=$1', [vrsta]);
      const ids = rd.rows.map(r => r.id);
      koraci.push('Nađeno dokumenata vrste "' + vrsta + '": ' + ids.length);
      if (ids.length === 0) return { dokumenata: 0, clanaka: 0, chunkova: 0, koraci };
      const rch = await c.query(`DELETE FROM chunkovi WHERE clanak_id IN (SELECT id FROM clanci WHERE dokument_id = ANY($1))`, [ids]);
      koraci.push('Obrisano chunkova (RAG): ' + rch.rowCount);
      await c.query(`DELETE FROM clanci_verzije WHERE clanak_id IN (SELECT id FROM clanci WHERE dokument_id = ANY($1))`, [ids]).catch(() => {});
      const rcl = await c.query(`DELETE FROM clanci WHERE dokument_id = ANY($1)`, [ids]);
      koraci.push('Obrisano članaka: ' + rcl.rowCount);
      await c.query(`DELETE FROM program_dokumenti WHERE dokument_id = ANY($1)`, [ids]).catch(() => {});
      const rdok = await c.query(`DELETE FROM dokumenti WHERE id = ANY($1)`, [ids]);
      koraci.push('Obrisano dokumenata: ' + rdok.rowCount);
      return { dokumenata: rdok.rowCount, clanaka: rcl.rowCount, chunkova: rch.rowCount, koraci };
    });
    res.json({ ok: true, vrsta, ...out });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v114 — pun tekst jednog članka (za čitanje u dashboardu gradiva)
app.get('/api/admin/clanak/:id', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const r = await q(`SELECT c.id, c.oznaka, c.naslov, c.tekst, c.redoslijed, d.naziv AS dokument
      FROM clanci c JOIN dokumenti d ON d.id=c.dokument_id WHERE c.id=$1`, [parseInt(req.params.id, 10)]);
    if (!r.rowCount) return res.status(404).json({ error: 'Članak nije pronađen.' });
    res.json({ ok: true, clanak: r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v114 — obriši POJEDINAČNI članak (+ njegove chunkove iz RAG-a)
app.post('/api/admin/clanak-obrisi', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const clId = parseInt((req.body || {}).clanak_id, 10);
    if (!clId) return res.status(400).json({ error: 'Nedostaje clanak_id.' });
    const out = await withTx(async (c) => {
      const rc = await c.query('SELECT oznaka, dokument_id FROM clanci WHERE id=$1', [clId]);
      if (!rc.rowCount) throw new Error('Članak nije pronađen.');
      await c.query('DELETE FROM chunkovi WHERE clanak_id=$1', [clId]);
      await c.query('DELETE FROM clanci_verzije WHERE clanak_id=$1', [clId]).catch(() => {});
      await c.query('DELETE FROM clanci WHERE id=$1', [clId]);
      return { oznaka: rc.rows[0].oznaka, dokument_id: rc.rows[0].dokument_id };
    });
    res.json({ ok: true, ...out });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v112 — pregled članaka jednog dokumenta (dashboard gradiva: vidi što je uneseno prije brisanja)
// ⭐ v124/v125 — pretraga članaka po oznaci > naslovu > tekstu kroz cijelo gradivo (za dashboard, npr. "DIN 18202" ili riječ iz teksta)
app.get('/api/admin/gradivo/trazi-clanke', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const qs = String(req.query.q || '').trim().slice(0, 80);
    if (qs.length < 2) return res.json({ ok: true, clanci: [] });
    const like = '%' + qs.replace(/[%_]/g, '') + '%';
    const r = await q(`SELECT c.id, c.oznaka, c.naslov, c.dokument_id, d.naziv AS dokument_naziv, d.vrsta,
        LEFT(c.tekst, 180) AS ulomak,
        CASE WHEN c.oznaka ILIKE $1 OR c.naslov ILIKE $1 THEN 1 ELSE 2 END AS rang
      FROM clanci c JOIN dokumenti d ON d.id=c.dokument_id
      WHERE d.status='aktivno' AND (c.oznaka ILIKE $1 OR c.naslov ILIKE $1 OR c.tekst ILIKE $1)
      ORDER BY rang, c.oznaka LIMIT 50`, [like]); // ⭐ v125 — oznaka/naslov prije teksta
    res.json({ ok: true, clanci: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/dokument-clanci/:id', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const dokId = parseInt(req.params.id, 10);
    const rd = await q('SELECT naziv, vrsta, izvor FROM dokumenti WHERE id=$1', [dokId]);
    if (!rd.rowCount) return res.status(404).json({ error: 'Dokument nije pronađen.' });
    const rc = await q(`SELECT id, oznaka, naslov, LEFT(tekst, 220) AS ulomak, length(tekst) AS duljina
      FROM clanci WHERE dokument_id=$1 AND status='aktivan' ORDER BY redoslijed, id`, [dokId]);
    res.json({ ok: true, dokument: rd.rows[0], clanci: rc.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v112 — obriši CIJELI dokument (članci + chunkovi + sam dokument). Traži potvrdu (naziv).
app.post('/api/admin/dokument-obrisi', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const dokId = parseInt((req.body || {}).dokument_id, 10);
    const potvrda = String((req.body || {}).potvrda || '').trim();
    if (!dokId) return res.status(400).json({ error: 'Nedostaje dokument_id.' });
    const out = await withTx(async (c) => {
      const rd = await c.query('SELECT naziv FROM dokumenti WHERE id=$1', [dokId]);
      if (!rd.rowCount) throw new Error('Dokument nije pronađen.');
      if (potvrda !== rd.rows[0].naziv) { const e = new Error('Potvrda se ne poklapa s nazivom dokumenta.'); e.code = 'POTVRDA'; throw e; }
      // chunkovi vise o clanci (ON DELETE CASCADE u shemi); clanci i clanci_verzije brišemo pa dokument
      await c.query(`DELETE FROM chunkovi WHERE clanak_id IN (SELECT id FROM clanci WHERE dokument_id=$1)`, [dokId]);
      await c.query(`DELETE FROM clanci_verzije WHERE clanak_id IN (SELECT id FROM clanci WHERE dokument_id=$1)`, [dokId]).catch(() => {});
      const rcl = await c.query('DELETE FROM clanci WHERE dokument_id=$1', [dokId]);
      await c.query('DELETE FROM program_dokumenti WHERE dokument_id=$1', [dokId]).catch(() => {});
      await c.query('DELETE FROM dokumenti WHERE id=$1', [dokId]);
      return { naziv: rd.rows[0].naziv, obrisano_clanaka: rcl.rowCount };
    });
    res.json({ ok: true, ...out });
  } catch (e) {
    if (e.code === 'POTVRDA') return res.status(400).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/ai/eval-pitanja', auth, zahtijevajSuperadmin, async (req, res) => { // ⭐ v022 — za eval gumb (mobilno)
  try {
    const fs = require('fs');
    const p = path.join(__dirname, 'eval', 'pitanja.jsonl');
    if (!fs.existsSync(p)) return res.status(404).json({ error: 'eval/pitanja.jsonl nije deployan uz kod.' });
    const pitanja = []; // ⭐ v031 — tolerancija po retku (pokvaren red ne ruši eval)
    for (const x of fs.readFileSync(p, 'utf8').split('\n')) {
      if (!x.trim()) continue;
      try { pitanja.push(JSON.parse(x)); } catch (_) {}
    }
    res.json({ ok: true, pitanja: pitanja.map(x => ({ id: x.id, pitanje: x.pitanje, ocekivani: x.ocekivani || [] })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════ ⭐ v025 — F6: banka pitanja (04 §5, prompt P3 iz 07 §5) ═══════════════
const P3_GENERATOR = (n, program, uze) => `Iz priloženih članaka sastavi ${n} ispitnih pitanja za stručni ispit (${program}, uže područje: ${uze || 'opći dio'}).
Mješavina: 60% abc (4 opcije, jedna točna, distraktori uvjerljivi ali jasno netočni PO TEKSTU članka), 25% tocno_netocno, 15% otvoreno (traži nabrajanje/postupak).
Za svako vrati JSON red: {"tip":"abc","pitanje":"...","opcije":["A) ...","B) ...","C) ...","D) ..."],"tocno":"B","obrazlozenje":"... s referencom (Članak X., stavak Y.)","clanak_refs":[<id-jevi iz zaglavlja izvora>],"tezina":1-5}
Zabranjeno: pitanja o brojevima NN-a, trik-pitanja o interpunkciji, opcije "sve navedeno/ništa navedeno".`;

async function programPoKodu(kod) {
  const r = await q(`SELECT id, naziv FROM ispitni_programi WHERE kod=$1`, [String(kod || 'GRA')]);
  return r.rowCount ? r.rows[0] : null;
}

// generator: uzmi blok članaka dokumenta bez pitanja -> P3 -> JSONL nacrti
app.post('/api/admin/pitanja/generiraj', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    if (!AI_ON()) return res.status(503).json({ error: 'AI privremeno nedostupan' });
    const { dokument_id, n, program_kod, uze_podrucje } = req.body || {};
    const dokId = parseInt(dokument_id, 10);
    const brojN = Math.min(Math.max(parseInt(n, 10) || 5, 1), 10);
    if (!dokId) return res.status(400).json({ error: 'Zadaj dokument_id.' });
    const prog = await programPoKodu(program_kod);
    if (!prog) return res.status(400).json({ error: 'Nepoznat program.' });
    // blok 1-3 članaka koji još nemaju AI pitanja (filtar u Node-u — pg-mem ne zna korelirani ANY(array))
    const rSvi = await q(`SELECT c.id, c.oznaka, c.naslov, c.tekst, d.naziv AS dokument
      FROM clanci c JOIN dokumenti d ON d.id=c.dokument_id
      WHERE c.dokument_id=$1 AND c.status='aktivan' ORDER BY c.redoslijed`, [dokId]);
    const rRefs = await q(`SELECT clanak_refs FROM pitanja WHERE izvor='ai' AND program_id=$1`, [prog.id]);
    const pokriveni = new Set(); rRefs.rows.forEach(x => (x.clanak_refs || []).forEach(id => pokriveni.add(id)));
    const rc = { rows: rSvi.rows.filter(c => !pokriveni.has(c.id)).slice(0, 3) };
    if (!rc.rows.length) return res.json({ ok: true, nacrta: 0, poruka: 'Svi članci dokumenta već imaju AI pitanja.' });
    const blokIzvora = rc.rows.map(c => `[clanak_id=${c.id}] ${c.dokument} — ${c.oznaka}${c.naslov ? ' ' + c.naslov : ''}:\n${c.tekst}`).join('\n\n');
    const fnA = req.app.get('aiOdgovor') ||
      ((sys, msgs) => anthropicPoziv(process.env.MODEL_ODGOVOR, sys, msgs, 2500, 0.4));
    const odg = await fnA(P3_GENERATOR(brojN, prog.naziv, uze_podrucje || ''),
      [{ role: 'user', content: 'IZVORI:\n' + blokIzvora + '\n\nGeneriraj pitanja. Odgovori SAMO JSONL redovima, bez ikakvog drugog teksta.' }]);
    const validniId = new Set(rc.rows.map(c => c.id));
    let nacrta = 0, odbaceno = 0, duplikata = 0;
    for (const linija of odg.tekst.replace(/```jsonl?|```/g, '').split('\n')) {
      const t = linija.trim(); if (!t.startsWith('{')) continue;
      try {
        const o = JSON.parse(t);
        if (!o.pitanje || !['abc', 'tocno_netocno', 'otvoreno'].includes(o.tip)) { odbaceno++; continue; }
        if (o.tip === 'abc' && (!Array.isArray(o.opcije) || o.opcije.length !== 4)) { odbaceno++; continue; }
        const refs = (Array.isArray(o.clanak_refs) ? o.clanak_refs : []).map(x => parseInt(x, 10)).filter(x => validniId.has(x));
        if (!refs.length) { odbaceno++; continue; }                       // clanak_refs obavezan 🔒
        const dup = await q(`SELECT 1 FROM pitanja WHERE program_id=$1 AND pitanje=$2 LIMIT 1`, [prog.id, String(o.pitanje)]);
        if (dup.rowCount) { duplikata++; continue; }
        await q(`INSERT INTO pitanja (program_id, uze_podrucje, tip, pitanje, opcije, tocno, obrazlozenje, clanak_refs, izvor, tezina, status)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ai',$9,'nacrt')`,
          [prog.id, String(uze_podrucje || ''), o.tip, String(o.pitanje),
           o.opcije ? JSON.stringify(o.opcije) : null, String(o.tocno || ''), String(o.obrazlozenje || ''),
           refs, Math.min(Math.max(parseInt(o.tezina, 10) || 3, 1), 5)]);
        nacrta++;
      } catch (_) { odbaceno++; }
    }
    res.json({ ok: true, nacrta, odbaceno, duplikata, clanci: rc.rows.map(c => c.oznaka) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// uvoz rok-pitanja (serije <=50): RAG mapira clanak_refs, sve kao nacrt izvor='rok'
app.post('/api/admin/pitanja/uvoz-rokovi', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const { stavke, program_kod, bez_rag, osvjezi } = req.body || {};
    if (!Array.isArray(stavke) || !stavke.length) return res.status(400).json({ error: 'Očekujem polje stavke.' });
    if (stavke.length > 50) return res.status(400).json({ error: 'Najviše 50 stavki po pozivu (šalji u serijama).' });
    const prog = await programPoKodu(program_kod);
    if (!prog) return res.status(400).json({ error: 'Nepoznat program.' });
    const fnI = req.app.get('dohvatiIzvore') || dohvatiIzvoreImpl;
    let uvezeno = 0, duplikata = 0, dopunjeno = 0, osvjezeno = 0;
    for (const st of stavke) {
      const pit = String(st.pitanje || '').trim(); if (!pit) continue;
      const tipSt = ['abc', 'tocno_netocno', 'otvoreno', 'usmeno'].includes(st.tip) ? st.tip : 'otvoreno';
      const opcSt = Array.isArray(st.opcije) && st.opcije.length ? JSON.stringify(st.opcije) : null;
      const dup = await q(`SELECT id, opcije FROM pitanja WHERE program_id=$1 AND pitanje=$2 LIMIT 1`, [prog.id, pit]);
      if (dup.rowCount) {
        // ⭐ v088 — osvjezi: ažuriraj opcije+tocno+tip+obrazloženje (npr. promiješan raspored točnih odgovora)
        if (osvjezi && opcSt) {
          await q(`UPDATE pitanja SET opcije=$1, tocno=$2, tip=$3, obrazlozenje=$4 WHERE id=$5`,
            [opcSt, String(st.tocno || ''), tipSt, String(st.obrazlozenje || ''), dup.rows[0].id]);
          osvjezeno++;
          continue;
        }
        // ⭐ v085 — postojeće pitanje: ako nema opcije a stigle su (ABC), dopuni ih (popravak ranijih uvoza bez opcija)
        const imaOpc = Array.isArray(dup.rows[0].opcije) && dup.rows[0].opcije.length;
        if (!imaOpc && opcSt) {
          await q(`UPDATE pitanja SET opcije=$1, tocno=$2, tip=$3 WHERE id=$4`, [opcSt, String(st.tocno || ''), tipSt, dup.rows[0].id]);
          dopunjeno++;
        } else { duplikata++; }
        continue;
      }
      let refs = [];
      if (!bez_rag && AI_ON()) {
        try { const { izvori } = await fnI(pit, { bezReranka: true }); refs = [...new Set(izvori.map(x => x.clanak_id))].slice(0, 3); } catch (_) {} // ⭐ v032 — brzi mod
      }
      await q(`INSERT INTO pitanja (program_id, uze_podrucje, tip, pitanje, opcije, tocno, obrazlozenje, clanak_refs, izvor, rok_oznaka, tezina, status)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'rok',$9,$10,'nacrt')`,
        [prog.id, String(st.uze || ''), tipSt,
         pit, opcSt, // ⭐ v085 — ABC opcije (bez ovoga test nema ponuđene odgovore)
         String(st.tocno || ''), String(st.obrazlozenje || ''), refs, String(st.rok_oznaka || '').slice(0, 120),
         Math.min(5, Math.max(1, parseInt(st.tezina, 10) || 3))]); // ⭐ v098 — težina/učestalost s rokova
      uvezeno++;
    }
    res.json({ ok: true, uvezeno, duplikata, dopunjeno, osvjezeno });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v033 — masovna ovjera rok-nacrta BEZ ⚠ flaga (odgovori doslovno iz provjerene
// Skripte; flagirani "stari ZOG/ZOPU" ostaju nacrt za strojnu reviziju kroz razlike).
app.post('/api/admin/pitanja/ovjeri-sve', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const r = await q(`UPDATE pitanja SET status='ovjereno', ovjerio=$1
      WHERE status='nacrt' AND izvor='rok' AND obrazlozenje NOT LIKE '[⚠%'`, [req.uid]);
    res.json({ ok: true, ovjereno: r.rowCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v110 — ČISTI RESTART: obriši SVA rok-pitanja (za ponovni uvoz očišćenog mastera). Traži potvrdu
// (body.potvrda === 'OBRISI-ROK') da se ne okine slučajno. AI-generirana (izvor='ai') se NE diraju.
app.post('/api/admin/pitanja/obrisi-rok', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    if ((req.body || {}).potvrda !== 'OBRISI-ROK') return res.status(400).json({ error: 'Nedostaje potvrda. Očekujem { potvrda: "OBRISI-ROK" }.' });
    const prog = await programPoKodu(String((req.body || {}).program || 'GRA'));
    const pid = prog ? prog.id : -1;
    const out = await withTx(async (c) => {
      const prije = await c.query(`SELECT COUNT(*)::int AS n FROM pitanja WHERE program_id=$1 AND izvor='rok'`, [pid]);
      // ⭐ v111 — usmeni_sesije.pitanje_id je NOT NULL REFERENCES pitanja BEZ cascade → prvo obriši sesije
      // koje pokazuju na rok-pitanja koja brišemo. srs_stavke ima ON DELETE CASCADE pa se čisti sam.
      const us = await c.query(`DELETE FROM usmeni_sesije WHERE pitanje_id IN
        (SELECT id FROM pitanja WHERE program_id=$1 AND izvor='rok')`, [pid]);
      const r = await c.query(`DELETE FROM pitanja WHERE program_id=$1 AND izvor='rok'`, [pid]);
      return { obrisano: r.rowCount, bilo: prije.rows[0].n, usmeni_sesije: us.rowCount };
    });
    res.json({ ok: true, ...out });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v100 — KOMISIJA S KARAKTERIMA: svaki član ima temperament + strogost 1-5 (Perić/ZOP strog 5, Novak/opće blag 2); persona ide u P5+P6+P7A (dosljedan ton i prag tolerancije, ali ocjena OSTAJE poštena 🔒). Napredak dobiva TREND (spremnost po danu + smjer raste/pada). // ⭐ v099 — PROVJERA BANKE PITANJA (temelj Master moda): zdravstveni pregled uvezene
// banke. Agregacija u JS-u (pg-mem nema HAVING/jsonb_array_length/RANDOM). NE šalje
// zlatni sadržaj kao popis — samo brojke, uzorke pitanja i zastavice. 🔒
app.get('/api/admin/pitanja/provjera', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const prog = await programPoKodu(String(req.query.program || 'GRA'));
    // ⭐ v105 — LAGAN SELECT: ne dohvaćaj pun tekst pitanja/obrazloženja (težak upit koji je pod
    // konkurencijom s Provjeri točnost znao pasti). Umjesto toga računaj zastavice u SQL-u, a duplikate
    // teksta preko kratkog hash-a (md5) umjesto povlačenja cijelog teksta u JS. Za uzorak povuci samo 6 redaka.
    const pid = prog ? prog.id : -1;
    // ⭐ v108 — statement_timeout 15s: radije brzo padni s jasnom porukom nego da visiš do gateway-timeouta
    // (koji vrati ne-JSON i klijent pokaže generičku "Greška."). Ako pun pregled ne stigne (pod opterećenjem
    // Provjeri točnost), padamo na LAKI COUNT pregled da bar dobiješ osnovne brojke.
    try { await q(`SET LOCAL statement_timeout = 15000`); } catch (_) {}
    let r;
    try {
      r = await q(`SELECT
        tip, status, izvor, COALESCE(NULLIF(uze_podrucje,''),'(zajedničko)') AS uzem, tezina,
        opcije, tocno,
        CASE WHEN provjera IS NULL THEN 'neprovjereno' ELSE COALESCE(provjera->>'slaganje','neprovjereno') END AS slag,
        (CASE WHEN tip='abc' THEN length(trim(coalesce(obrazlozenje,''))) ELSE length(trim(coalesce(tocno,''))) END < 15) AS prazan,
        (coalesce(obrazlozenje,'') LIKE '[⚠%') AS flag,
        md5(lower(trim(coalesce(pitanje,'')))) AS ph
      FROM pitanja WHERE program_id=$1`, [pid]);
    } catch (ePun) {
      // ⭐ v108 — LAKI fallback: samo brojevi po statusu/tipu (bez ABC/duplikat detalja), da rutine ne padne
      const rc = await q(`SELECT tip, status, izvor, COALESCE(NULLIF(uze_podrucje,''),'(zajedničko)') AS uzem, tezina,
        CASE WHEN provjera IS NULL THEN 'neprovjereno' ELSE COALESCE(provjera->>'slaganje','neprovjereno') END AS slag
        FROM pitanja WHERE program_id=$1`, [pid]);
      const poTipu2 = {}, poStatusu2 = {}, poIzvoru2 = {}, poUzem2 = {}, poTezini2 = {}, poTocnosti2 = {};
      const inc2 = (o, k) => { o[k] = (o[k] || 0) + 1; };
      for (const p of rc.rows) { inc2(poTipu2, p.tip); inc2(poStatusu2, p.status); inc2(poIzvoru2, p.izvor); inc2(poUzem2, p.uzem); inc2(poTezini2, 't' + p.tezina); inc2(poTocnosti2, p.slag); }
      const brj = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v }));
      return res.json({ ok: true, laki: true, program: prog ? prog.kod : null, ukupno: rc.rows.length, sveOk: null,
        poTipu: brj(poTipu2), poStatusu: brj(poStatusu2), poIzvoru: brj(poIzvoru2), poUzem: brj(poUzem2), poTezini: brj(poTezini2), poTocnosti: brj(poTocnosti2),
        greske: { abc_bez_opcija: 0, abc_tocno_izvan_opcija: 0, prazan_zlatni: 0, duplikat_teksta: 0, flag_upozorenje: 0, primjeri_id: { abc_tocno_izvan_opcija: [], prazan_zlatni: [], duplikat_teksta: [] } },
        uzorak: [], napomena: 'Laki pregled (pun je istekao pod opterećenjem — vjerojatno Provjeri točnost radi). Pokušaj ponovno kad točnost dovrši.' });
    }
    const P = r.rows;
    const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };
    const poTipu = {}, poStatusu = {}, poIzvoru = {}, poUzem = {}, poTezini = {}, poTocnosti = {};
    const greske = { abc_bez_opcija: 0, abc_tocno_izvan_opcija: 0, prazan_zlatni: 0, duplikat_teksta: 0, flag_upozorenje: 0 };
    const vidjeno = new Set();
    for (const p of P) {
      inc(poTipu, p.tip); inc(poStatusu, p.status); inc(poIzvoru, p.izvor);
      inc(poUzem, p.uzem); inc(poTezini, 't' + p.tezina); inc(poTocnosti, p.slag);
      if (p.tip === 'abc') {                                  // ABC validacija u JS-u (pg vraća opcije kao niz/null)
        const opc = Array.isArray(p.opcije) ? p.opcije : [];
        if (opc.length < 3) greske.abc_bez_opcija++;
        else if (!opc.includes(p.tocno)) greske.abc_tocno_izvan_opcija++;
      }
      if (p.prazan) greske.prazan_zlatni++;
      if (p.flag) greske.flag_upozorenje++;
      if (p.ph) { if (vidjeno.has(p.ph)) greske.duplikat_teksta++; else vidjeno.add(p.ph); }
    }
    const brojac = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v }));
    // uzorak: 6 pitanja SAMO tekst (bez zlatnog 🔒), lagano
    let uzorak = [];
    try {
      const ru = await q(`SELECT id, tip, pitanje, uze_podrucje, status FROM pitanja WHERE program_id=$1 ORDER BY id LIMIT 6`, [pid]);
      uzorak = ru.rows.map(u => ({ id: u.id, tip: u.tip, pitanje: u.pitanje, uze: u.uze_podrucje, status: u.status }));
    } catch (_) {}
    const sveOk = greske.abc_bez_opcija === 0 && greske.abc_tocno_izvan_opcija === 0 && greske.prazan_zlatni === 0 && greske.duplikat_teksta === 0;
    res.json({
      ok: true, program: prog ? prog.kod : null, ukupno: P.length, sveOk,
      poTipu: brojac(poTipu), poStatusu: brojac(poStatusu), poIzvoru: brojac(poIzvoru),
      poUzem: brojac(poUzem), poTezini: brojac(poTezini), poTocnosti: brojac(poTocnosti),
      greske: {
        abc_bez_opcija: greske.abc_bez_opcija,
        abc_tocno_izvan_opcija: greske.abc_tocno_izvan_opcija,
        prazan_zlatni: greske.prazan_zlatni,
        duplikat_teksta: greske.duplikat_teksta,
        flag_upozorenje: greske.flag_upozorenje,
        primjeri_id: { abc_tocno_izvan_opcija: [], prazan_zlatni: [], duplikat_teksta: [] }
      },
      uzorak
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v110 — ČISTI RESTART: ruta /api/admin/pitanja/obrisi-rok (potvrda OBRISI-ROK) briše sva rok-pitanja za ponovni uvoz očišćenog mastera + gumb s dvostrukom potvrdom. // ⭐ v109 — PRAVI UZROK NAĐEN: Provjeri banku gumb je slao POST na GET-rutu (api() umjesto apiGet()) → 404 HTML → generička "Greška.". Bug od v099 — zato nikad nije radila. Sad apiGet(). v107/v108 (bulletproof SQL + timeout + fallback) ostaju kao dodatna otpornost. // ⭐ v108 — Provjeri banku: statement_timeout 15s + LAKI COUNT fallback ako pun pregled istekne pod opterećenjem (Provjeri točnost); dijagnostički gumb pokazuje HTTP status. Uzrok generičke Greške = gateway timeout jer točnost drži konekcije. // ⭐ v107 — HOTFIX: Provjeri banku više ne puca (v105 je uveo jsonb_array_length(opcije) koji puca na usmenim pitanjima gdje je opcije=NULL — PostgreSQL ne štiti OR-kratki-spoj). Sad ABC validacija u JS-u (Array.isArray hvata null), bez rizičnih jsonb SQL funkcija. // ⭐ v106 — STT BUGFIX: mikrofon kod usmenog više ne ponavlja riječi ("hrvatskihrvatskihrvatski"). Uzrok bio loop od 0 koji je re-lijepio sve rezultate uključivo međurezultate; sad obrađuje samo nove (od e.resultIndex) i razdvaja konačne (isFinal) od međurezultata. // ⭐ v105 — BUGFIX: Provjeri banku optimiziran (lagan SQL SELECT umjesto povlačenja punog teksta 2000+ pitanja — više ne pada pod konkurencijom s Provjeri točnost); Provjeri točnost sad VRAĆA U NACRT ovjerena pitanja koja proturječe propisu (ne ostaju kao točna); klijentsko upozorenje da ne pokreneš oboje istovremeno. // ⭐ v104 — uvoz/clanci auto-kreira dokument ako ne postoji (vrsta/priznato iz JSON-a) → tehnički uvjeti i normativi idu izravno pod "Članci", bez zasebnog šifrarnik-koraka. // ⭐ v103 — WAKE LOCK: zaslon ostaje upaljen tijekom dugih uvoza/provjera (Wake Lock API + re-akvizicija na visibilitychange + indikator 🔆); wireiran u admPitUvoz i admPitTocnost. // ⭐ v102 — BUGFIX+UX: dopis izrezan (samo dopis u Word, vidljiv gumb); admin pretplata UI (desktop grid+mobilni); Nastavi gdje si stao (test/članak/usmeni); pismeni promo na Danas; SIGURNOST: CSP+HSTS+Permissions-Policy, throttle register/reset, startup upozorenje za default tajne. // ⭐ v101 — AI PROVJERA TOČNOSTI: za batch neprovjerenih pitanja dohvati RAG-izvore (propise)
// i AI-recenzentom usporedi golden odgovor s tekstom propisa. Verdikt se sprema u pitanja.provjera.
// Sadržajno pogrešna ("ne") i djelomično sporna ("djelomicno") dobiju [⚠ pa ih "Ovjeri sve" preskoči.
// Radi u batchevima (trošak+latencija); klijent petlja. NE mijenja točan odgovor — samo označava. 🔒
app.post('/api/admin/pitanja/provjeri-tocnost', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    if (!AI_ON()) return res.status(503).json({ error: 'AI nije uključen (ANTHROPIC_API_KEY/AI_ENABLED).' });
    const prog = await programPoKodu(String((req.body || {}).program || 'GRA'));
    if (!prog) return res.status(400).json({ error: 'Nepoznat program.' });
    const limit = Math.min(20, Math.max(1, parseInt((req.body || {}).limit, 10) || 10));
    const ponovi = !!(req.body || {}).ponovi; // true = provjeri i već provjerena (nova runda nakon uvoza propisa)
    const r = await q(`SELECT id, pitanje, tocno, obrazlozenje, tip, opcije FROM pitanja
      WHERE program_id=$1 AND izvor='rok' ${ponovi ? '' : 'AND provjera IS NULL'}
      ORDER BY id ASC LIMIT $2`, [prog.id, limit]);
    const fnI = req.app.get('dohvatiIzvore') || dohvatiIzvoreImpl;
    const fnA = req.app.get('aiOdgovor') || ((sys, msgs, mt) => anthropicPoziv(process.env.MODEL_ODGOVOR, sys, msgs, mt || 300, 0));
    let prov = 0; const tally = { da: 0, djelomicno: 0, ne: 0, nema_izvora: 0 };
    for (const p of r.rows) {
      // golden = za abc TEKST točne opcije + obrazloženje; za usmeno tocno (+obrazloženje)
      let golden = p.tocno;
      if (Array.isArray(p.opcije) && p.opcije.length && String(p.tip) === 'abc') {
        const slovo = String(p.tocno || '').trim().charAt(0).toUpperCase();
        const to = p.opcije.find(o => String(o).trim().charAt(0).toUpperCase() === slovo);
        if (to) golden = String(to).replace(/^[A-D]\)\s*/, '').trim();
      }
      const obr = String(p.obrazlozenje || '').replace(/^\[⚠[^\]]*\]\s*/, ''); // makni raniji flag iz prikaza recenzentu
      const goldenPun = golden + (obr ? '\n' + obr : '');
      let izvoriTxt = '';
      try {
        const { izvori } = await fnI(p.pitanje, { bezReranka: false });
        izvoriTxt = (izvori || []).slice(0, 6).map(x => '[' + (x.oznaka || '') + ' — ' + (x.dokument || '') + ']\n' + String(x.tekst || '').slice(0, 900)).join('\n\n');
      } catch (_) { izvoriTxt = ''; }
      const podloga = 'PITANJE:\n' + p.pitanje + '\n\nGOLDEN ODGOVOR:\n' + goldenPun +
        '\n\nIZVOR (propisi iz baze' + (izvoriTxt ? '' : ' — PRAZNO, nema pronađenih članaka') + '):\n' + (izvoriTxt || '(nema)');
      let verdikt = { slaganje: 'nema_izvora', problem: 'AI recenzija nije uspjela', clanak: '' };
      try {
        const rr = await fnA(P_RECENZENT, [{ role: 'user', content: podloga }], 300);
        const j = pokusajJson(rr.tekst);
        if (j && ['da', 'djelomicno', 'ne', 'nema_izvora'].includes(j.slaganje)) {
          verdikt = { slaganje: j.slaganje, problem: String(j.problem || '').slice(0, 400), clanak: String(j.clanak || '').slice(0, 120) };
        }
      } catch (_) { /* ostaje default nema_izvora */ }
      verdikt.kada = new Date().toISOString().slice(0, 10);
      tally[verdikt.slaganje] = (tally[verdikt.slaganje] || 0) + 1;
      prov++;
      // flag u obrazloženju za sadržajno sporne (da ih "Ovjeri sve" preskoči)
      let novoObr = obr;
      let vratiUNacrt = false;
      if (verdikt.slaganje === 'ne' || verdikt.slaganje === 'djelomicno') {
        const oznaka = verdikt.slaganje === 'ne' ? 'AI: proturječi propisu' : 'AI: provjeri';
        novoObr = '[⚠ ' + oznaka + (verdikt.clanak ? ' (' + verdikt.clanak + ')' : '') + (verdikt.problem ? ' — ' + verdikt.problem : '') + '] ' + obr;
        // ⭐ v105 — ako "ne" (proturječi), povuci OVJERENO pitanje natrag u nacrt (da netočan odgovor
        // ne ostane u opticaju dok ga ručno ne provjeriš). "djelomicno" ne dira status (samo flag).
        if (verdikt.slaganje === 'ne') vratiUNacrt = true;
      }
      if (vratiUNacrt) {
        await q(`UPDATE pitanja SET provjera=$1, obrazlozenje=$2, status=CASE WHEN status='ovjereno' THEN 'nacrt' ELSE status END WHERE id=$3`,
          [JSON.stringify(verdikt), novoObr.slice(0, 2000), p.id]);
      } else {
        await q(`UPDATE pitanja SET provjera=$1, obrazlozenje=$2 WHERE id=$3`, [JSON.stringify(verdikt), novoObr.slice(0, 2000), p.id]);
      }
    }
    // koliko još neprovjerenih ostaje (za progres na klijentu)
    const rc = await q(`SELECT COUNT(*)::int AS n FROM pitanja WHERE program_id=$1 AND izvor='rok' AND provjera IS NULL`, [prog.id]);
    res.json({ ok: true, provjereno: prov, tally, preostalo_neprovjereno: rc.rows[0].n });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ⭐ v034 — primjena revizije rok-pitanja (novi odgovori/reference po NN 155/25);
// match po (izvor='rok', pitanje); status NE dira (flag nestaje -> "Ovjeri sve" ih pokupi)
app.post('/api/admin/pitanja/revizija', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const { stavke } = req.body || {};
    if (!Array.isArray(stavke) || !stavke.length) return res.status(400).json({ error: 'Očekujem polje stavke.' });
    if (stavke.length > 100) return res.status(400).json({ error: 'Najviše 100 stavki po pozivu.' });
    let azurirano = 0, nenadjeno = 0;
    for (const s of stavke) {
      const r = await q(`UPDATE pitanja SET tocno=$1, obrazlozenje=$2, pitanje=$3
        WHERE izvor='rok' AND pitanje=$4`,
        [String(s.tocno || ''), String(s.obrazlozenje || ''), String(s.novo_pitanje || s.pitanje || ''), String(s.pitanje || '')]);
      r.rowCount ? azurirano++ : nenadjeno++;
    }
    res.json({ ok: true, azurirano, nenadjeno });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/pitanja', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const uvjeti = []; const par = [];
    for (const [polje, kol] of [['status', 'status'], ['tip', 'tip'], ['izvor', 'izvor']]) {
      if (req.query[polje]) { par.push(String(req.query[polje])); uvjeti.push(`${kol}=$${par.length}`); }
    }
    if (req.query.q) { par.push('%' + String(req.query.q).slice(0, 80) + '%'); uvjeti.push(`pitanje ILIKE $${par.length}`); }
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    par.push(30, (page - 1) * 30);
    const r = await q(`SELECT id, tip, pitanje, tocno, obrazlozenje, opcije, clanak_refs, izvor, rok_oznaka, tezina, status, uze_podrucje
      FROM pitanja ${uvjeti.length ? 'WHERE ' + uvjeti.join(' AND ') : ''}
      ORDER BY id DESC LIMIT $${par.length - 1} OFFSET $${par.length}`, par);
    const rc = await q(`SELECT status, COUNT(*)::int AS n FROM pitanja GROUP BY status`);
    const brojke = {}; rc.rows.forEach(x => brojke[x.status] = x.n);
    res.json({ ok: true, pitanja: r.rows, brojke, page });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/admin/pitanja/:id', auth, zahtijevajSuperadmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    if (b.status) {                                          // ovjeri / povuci / vrati u nacrt
      if (!['nacrt', 'ovjereno', 'povuceno'].includes(b.status)) return res.status(400).json({ error: 'Neispravan status.' });
      const r = await q(`UPDATE pitanja SET status=$1, ovjerio=$2 WHERE id=$3`,
        [b.status, b.status === 'ovjereno' ? req.uid : null, id]);
      if (!r.rowCount) return res.status(404).json({ error: 'Pitanje ne postoji.' });
      return res.json({ ok: true });
    }
    const dopustena = ['pitanje', 'tocno', 'obrazlozenje', 'uze_podrucje', 'tip', 'tezina'];
    const set = []; const par = [];
    for (const k of dopustena) if (b[k] !== undefined) { par.push(k === 'tezina' ? parseInt(b[k], 10) || 3 : String(b[k])); set.push(`${k}=$${par.length}`); }
    if (b.opcije !== undefined) { par.push(b.opcije ? JSON.stringify(b.opcije) : null); set.push(`opcije=$${par.length}`); }
    if (!set.length) return res.status(400).json({ error: 'Nema polja za izmjenu.' });
    par.push(id);
    const r = await q(`UPDATE pitanja SET ${set.join(', ')} WHERE id=$${par.length}`, par);
    if (!r.rowCount) return res.status(404).json({ error: 'Pitanje ne postoji.' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ai/razgovori', auth, async (req, res) => {
  try {
    const r = await q(`SELECT r.id, r.naslov, r.created_at, COUNT(p.id)::int AS poruka
      FROM ai_razgovori r LEFT JOIN ai_poruke p ON p.razgovor_id=r.id
      WHERE r.korisnik_id=$1 GROUP BY r.id, r.naslov, r.created_at ORDER BY r.id DESC LIMIT 100`, [req.uid]); // ⭐ v042 — broj poruka za Povijest
    res.json({ ok: true, razgovori: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/ai/razgovor/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const rr = await q(`SELECT id, naslov FROM ai_razgovori WHERE id=$1 AND korisnik_id=$2`, [id, req.uid]);
    if (!rr.rowCount) return res.status(404).json({ error: 'Razgovor ne postoji.' });
    const rp = await q(`SELECT id, uloga, tekst, citati, upozorenje, ocjena, created_at FROM ai_poruke WHERE razgovor_id=$1 ORDER BY id`, [id]);
    res.json({ ok: true, razgovor: rr.rows[0],
      poruke: rp.rows.map(x => ({ ...x, citati: JSON.parse(x.citati || '[]') })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/ai/razgovor/:id', auth, async (req, res) => {
  try {
    const r = await q(`DELETE FROM ai_razgovori WHERE id=$1 AND korisnik_id=$2`, [parseInt(req.params.id, 10), req.uid]);
    if (!r.rowCount) return res.status(404).json({ error: 'Razgovor ne postoji.' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/ai/ocjena', auth, async (req, res) => {
  try {
    const { poruka_id, ocjena } = req.body || {};
    if (![1, -1].includes(ocjena)) return res.status(400).json({ error: 'Ocjena mora biti 1 ili -1.' });
    const r = await q(`UPDATE ai_poruke p SET ocjena=$1 FROM ai_razgovori r
      WHERE p.id=$2 AND p.razgovor_id=r.id AND r.korisnik_id=$3`, [ocjena, parseInt(poruka_id, 10), req.uid]);
    if (!r.rowCount) return res.status(404).json({ error: 'Poruka ne postoji.' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/favicon.ico', (req, res) => res.type('image/png').sendFile(path.join(__dirname, 'icon-192.png'), () => res.status(404).end()));

// ⭐ v004 — Faza 2: self-host fontovi (eksplicitna lista, immutable cache 1g)
const FONTOVI = [
  'newsreader-latin-opsz-normal.woff2', 'newsreader-latin-ext-opsz-normal.woff2',
  'newsreader-latin-opsz-italic.woff2', 'newsreader-latin-ext-opsz-italic.woff2',
  'inter-latin-wght-normal.woff2', 'inter-latin-ext-wght-normal.woff2',
  'ibm-plex-mono-latin-400-normal.woff2', 'ibm-plex-mono-latin-ext-400-normal.woff2',
  'ibm-plex-mono-latin-500-normal.woff2', 'ibm-plex-mono-latin-ext-500-normal.woff2',
];
app.get('/fonts/:dat', (req, res) => {
  if (!FONTOVI.includes(req.params.dat)) return res.status(404).end();
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.type('font/woff2').sendFile(path.join(__dirname, 'fonts', req.params.dat), (err) => { if (err) res.status(404).end(); });
});

// SPA fallback (zadnje)
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => console.log(`OI Ispit ${VERZIJA} (faza ${FAZA}) slusa na :${PORT}${DEV_MODE ? ' [DEV: bez Resend]' : ''}`));
// ⭐ v102 — sigurnosno upozorenje: ako su tajne ostale na dev-defaultu u produkciji, tokeni su krivotvorivi.
if (!DEV_MODE) {
  if (JWT_SECRET === 'dev-tajna-promijeni-me') console.error('🔴 KRITIČNO: JWT_SECRET nije postavljen u ENV — tokeni su nesigurni! Postavi JWT_SECRET na Railwayu.');
  if (PWD_PEPPER === 'dev-pepper') console.error('🔴 KRITIČNO: PWD_PEPPER nije postavljen u ENV — lozinke su slabije zaštićene! Postavi PWD_PEPPER na Railwayu.');
}

module.exports = app; // ⭐ v019 — test mock hookovi (app.set)
