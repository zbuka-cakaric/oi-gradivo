/*  OI Ispit — service worker
 *  CHANGELOG
 *    v001 — pocetni SW: offline ljuska (app shell), network-first za /api
 *    v002 — Faza 1: nepromijenjena logika; bump verzije zbog novih ekrana
 *    v003 — bump verzije (Norma redizajn mailova u server.js)
 *    v004 — Faza 2: app ljuska + self-host fontovi u SHELL precacheu
 *    v005 — bump verzije (PWA instalacijski banner u index.html)
 *    v006 — bump verzije (hardening u server.js, manifest id)
 *    v007 — bump verzije (Faza 3a: gradivo + Uči + uvoz)
 *    v008 — bump verzije (onboarding: datum opcionalan, podrucje se sprema odmah)
 *    v009 — auto-osvjezavanje nakon deploya (update-provjera + reload u index.html)
 *    v010 — preview clanka bez naslova u listi (stariji zakoni)
 *    v011 — admin: progress uvezenog gradiva + skip identicnog uvoza (cuva bookmarke)
 *    v012 — health-ping auto-refresh (deterministicki) + SKIP message handler
 *    v013 — events aktivnost + superadmin dashboard (korisnici, KPI, top clanci, pretrage)
 *    v014 — update-traka safety net + dashboard toggle/error dotjerivanja
 *    v015 — dashboard grafovi (aktivnost, vrste, registracije) inline SVG
 *    v016 — batch uvoz clanaka (multi-file, zbirni izvjestaj)
 *    v017 — admin: popis neuvezenih propisa (pregled po vrsti + kopiranje)
 *    v018 — F4: upsert-po-oznaci + clanci_verzije + na_dan citanje + novela-diff
 *    v019 — F5: RAG temelj (chunkovi, ingest, hibridni retrieval, /api/ai/pitaj, eval)
 *    v020 — admin: reset dokumenta (demo čišćenje novela-testa)
 *    v021 — AI kvote po korisniku ($ budžeti iz ENV) + progress bar + admin Ingest gumb
 *    v022 — admin Eval gumb (GATE hit@12 s mobitela, bez Node-a)
 *    v023 — init-db vraća AI dijagnostiku (chunkovi + pg verzija + razlog pada)
 *    v024 — fix PG18: fts običan stupac (unaccent nije IMMUTABLE u GENERATED)
 *    v025 — F6: banka pitanja (shema, generator P3, uvoz rok-pitanja, admin ekran)
 *    v026 — eval dijagnostika (uzrok promašaja: mapa/ingest/retrieval) + total chunkova
 *    v027 — retrieval tuning-1: +orig. pitanje kao upit, bazen 12/kanal, dok-cap 4
 *    v028 — Retrieval v2: pg_trgm kanal (HR morfologija) + Voyage rerank + planner sinonimi
 *    v029 — eval fix E028/E034 (MROSP verifikacija) + rerank 60/32 + P2 primjer preslikavanja
 *    v030 — post-rerank dok-cap 6 (fallback 4) + fix repa kandidata (bez duplikata)
 *    v031 — revizija: esc naslova u eval dijagnostici, tolerancija redaka pitanja.jsonl
 *    v032 — uvoz rok-pitanja: brzi RAG mod (bez reranka), serije 5, per-serija tolerancija
 *    v033 — masovna ovjera rok-nacrta bez ⚠ flaga (Skripta = provjeren izvor)
 *    v034 — primjena revizije 164 ZOG/ZOPU pitanja po NN 155/25 (ruta + gumb)
 *    v035 — F15: Vještak ekran (SSE stream, citati->članak, razgovori, ocjena, disclaimer)
 *    v036 — revizija F15: stream error-event throw, prekid klijenta safe, pill.aktivna CSS
 *    v037 — ŽBUKA AI header (svjetloplava kvačica) + Vještak layout fix (btn width eksplozija)
 *    v038 — fix: AI kartica na Danas vidljiva od prvog ekrana (kvota se učitava i na danas)
 *    v039 — MOZAK: povijest razgovora + kratice (ZOG…); tri-mod okvir (picker, footer, boje); input fix; originalni logo
 *    v040 — Sonnet 5 podrška (bez temperature za novu generaciju, max_tokens 1600 zbog tokenizera)
 *    v041 — F15.5 Vještak v2 mozak: agentska tool-use petlja (trazi_propise/procitaj_clanak/
 *           clanak_na_dan, max 4 kruga, SSE status, token-budžet) + IRAC i pravna hijerarhija u P1
 *    v042 — UX okvir v2: Razgovor/Povijest kao pravi tabovi po modu (fix zaglavljenog moda i
 *           naslaganih ekrana), krović-indikator, MD render, Ja potrošnja $, Skraćeno/Primjer u čitaču
 *    v043 — Dopisi (predlošci kroz Vještaka) + Novosti (feed novela, /api/novosti) + dizajn v2
 *           (mode-atmosfera accsoft/accent2, chat-dokument klase, čitač serif); Ja kroz gornju pilulu u Vještaku
 *    v044 — poliranje po Ivanovom testu: footer nikad ne prekriva sadržaj (padding 122), btn-sek za
 *           Skraćeno/Primjer (btn-svjetli bio nevidljiv na bijelom), centrirani nazivi tabova (.nlab),
 *           logo -40%, Razgovor prazno-stanje s primjerima, overscroll-behavior:none, picker označava aktivni mod
 *    v045 — citat vodi RAVNO na članak (fix race ucitajUci), overflow-x:clip + overflow-wrap (fantomska
 *           praznina/odsječen naslov), neproziran header i footer, fade bez transforma, avatar izbornik
 *           (profil/notifikacije-uskoro/osvježi/odjava), audit dizajna
 *    v046 — FINALNI dizajn-sloj (zaključen): chat živost (tipkajuće točkice + karet), rastuća kućica upisa,
 *           Ja u SVIM modovima (Vještak 6 tabova — Ivanova odluka), Ja v2 (Pretplata + Aplikacija),
 *           Nastavi gdje si stao, Novosti točkica, čitač progres + swipe, uvodni tour, premium CSS sloj
 *    v047 — F16 MENTOR: usmeni AI ispitivač (kartica u Testovima -> tab Usmeni): P5 scenarij+pitanje iz
 *           ovjerene banke, P6 procjena (Haiku, strogi JSON, <=3 potpitanja), P7 rubrika s ocjenom 1-5;
 *           zlatni sadržaj nikad prije kraja 🔒, kandidatov odgovor nikad u retrieval 🔒, 3/dan Pro
 *    v048 — podvrh: naslov taba u sticky headeru iz routera (jedna implementacija — kraj "pojedenih"
 *           naslova) + kontekstna akcija desno; sadržaj 168px od footera; rast kućice i na prefill
 *    v049 — APP-LJUSKA (konačan fix "footer prekriva", 5 verzija saga): skrola se SAMO .sadrzaj između
 *           headera i footera — preklapanje konstrukcijski nemoguće; text-size-adjust:100% (Samsung
 *           font-boost = napuhani naslovi/praznine); skrolVrh/skrolDno umjesto window.scrollTo
 *    v050 — hotfix ljuske: overflow lock i na <html> (samo body nije dovoljno — viewport je skrolao pa
 *           je statični nav "nestao" na dno dokumenta) + height:100% fallback za dvh
 *    v051 — skrol fix (.sadrzaj flex-basis 0 — min-height:auto quirk), tabovi STROGO po modu (usmeni
 *           u footer Mentora, više ne curi u Vještaka), tekst-logo s kvačicom u boji moda
 *    v052 — KONAČNA ljuska: #app position:fixed inset:0 (viewport-prikovan okvir, imun na svaki
 *           html/body skrol quirk — footer i skrol rade po konstrukciji) + monogram logo (kvačica
 *           u boji moda + bold Z, Ivanov nacrt)
 */

// ⭐ v016 — CACHE_VERSION (drzi sinkrono sa server.js VERZIJA i footerom u index.html)
const CACHE_VERSION = 'oi-v147';

// ⭐ v012 — klijent moze gurnuti SW koji ceka (safety uz skipWaiting u installu)
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP') self.skipWaiting();
});
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/fonts/newsreader-latin-opsz-normal.woff2',
  '/fonts/newsreader-latin-ext-opsz-normal.woff2',
  '/fonts/newsreader-latin-opsz-italic.woff2',
  '/fonts/newsreader-latin-ext-opsz-italic.woff2',
  '/fonts/inter-latin-wght-normal.woff2',
  '/fonts/inter-latin-ext-wght-normal.woff2',
  '/fonts/ibm-plex-mono-latin-400-normal.woff2',
  '/fonts/ibm-plex-mono-latin-ext-400-normal.woff2',
  '/fonts/ibm-plex-mono-latin-500-normal.woff2',
  '/fonts/ibm-plex-mono-latin-ext-500-normal.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // API: network-first (uvijek svjezi podaci), bez perzistentnog cachiranja
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // ⭐ v055 — HTML/navigacija = NETWORK-FIRST (uvijek svjeza ljuska; keš samo offline fallback).
  // Prije je index.html bio cache-first pa je stara ljuska ostajala vidljiva nakon deploya dok se SW ne osvjezi
  // — to je bio uzrok "stalno mi se vraca stara verzija". Sada svjezi HTML uvijek pobjeduje. 🔒
  const jeHTML = e.request.mode === 'navigate'
    || (e.request.destination === 'document')
    || url.pathname === '/' || url.pathname === '/index.html';
  if (jeHTML) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok && url.origin === location.origin) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put('/index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('/index.html').then((hit) => hit || caches.match(e.request))) // ⭐ v061 fix — || na Promise je uvijek truthy; pravi fallback lanac
    );
    return;
  }

  // Ljuska/asseti: cache-first, pa mreza (i osvjezi cache)
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit ||
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          if (res.ok && url.origin === location.origin) {
            caches.open(CACHE_VERSION).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match('/index.html'))
    )
  );
});
