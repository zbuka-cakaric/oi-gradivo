# 02 — ARHITEKTURA I TEHNOLOŠKI STACK (s razlozima, ne samo popisom)

## 1. Stack u jednoj tablici
| Sloj | Tehnologija | ZAŠTO baš to (odluka, ne slučajnost) |
|---|---|---|
| Backend | **Node.js + Express, JEDAN `server.js`** | isti obrazac kao ŽBUKA Gradilište (6.300 linija, dokazan): Ivan i AI vide CIJELI sustav u jednom fajlu, kirurške izmjene su moguće, nema build-stepa, nema skrivenih slojeva. Monolit je feature dok je tim = 1 čovjek + AI. 🔒 do daljnjega |
| Baza | **PostgreSQL (Railway managed)** | relacijski integritet (FK kaskade), JSONB gdje treba fleksibilnost, **pgvector** ekstenzija za F5 u ISTOJ bazi (nema drugog sustava za embeddinge — jedna baza, jedan backup, jedna istina) 🔒 |
| Frontend | **JEDAN `index.html`** — vanilla JS, hash-router, bez frameworka/builda | isti razlog kao backend; PWA shell je malen, ekrani su forme+liste — React bi dodao build pipeline i ovisnosti bez proporcionalne koristi. 🔒 dok app ne preraste (~5.000 linija JS je prag preispitivanja 🔓) |
| Stil | **Norma design system** (ručni CSS, custom properties) | identitet: paper `#F5F5F1`, ink `#16181B`, ink2/ink3 nijanse, accent `#2B4A75` (slate); fontovi **self-hosted** woff2: Newsreader (serif, naslovi; variable opsz+ital), Inter (UI; variable wght), IBM Plex Mono (oznake/brojevi; 400/500) — latin+latin-ext zbog č/ć/đ/š/ž ⚠; Google Fonts izbačen (privatnost+brzina) 🔒 |
| PWA | manifest (`id:"/"`), sw.js ručni | instalabilnost bez store-a; SW strategije niže §5 |
| Mail | **Resend** (`RESEND_*` ENV) | jednostavan API, dobra deliverability; DMARC na zbuka.hr postavljen |
| AI | **Anthropic API** (Sonnet=odgovori, Haiku=planner/procjene) + **Voyage voyage-law-2** (embeddingi, 1024 dim) | Claude: kvaliteta grounded HR pravnog teksta; voyage-law-2: treniran na pravnom domenom, asimetrični query/document tip 🔒 detalji u 07 |
| Plaćanje | **Stripe** (F14) | standard; webhook idempotentnost 🔒 |
| Push | **web-push** lib (VAPID) | standard web push, bez Firebasea (manje ovisnosti) |
| Testovi | **pg-mem** integracijski harness (`test-v007.js`) | testovi bez žive baze = pokreću se svugdje u sekundi; monkeypatch `require.cache['pg']`; ⚠ lekcije §6 |
| Deploy | **GitHub → Railway auto-deploy** | push = deploy; nula CI konfiguracije; rollback = git tag |
| Sadržajni pipeline | **Python (pdftotext/pdfplumber) IZVAN appa**, u AI sandboxu | parsiranje zakona je batch-posao s QC-om, ne runtime — detalji 06; F4 razmatra port u Node 🔓 |

## 2. Topologija
```
[korisnik: Chrome/WebAPK Android · Safari iOS]
        │ HTTPS
[oi-ispit.zbuka.hr]  (CNAME oi-ispit → mz0aarzc.up.railway.app, TXT _railway-verify)
        │
[Railway: Node server.js :8080] ──── [Railway PostgreSQL]
        │ ├── Resend API (mail)
        │ ├── Anthropic API (F5+)      💰 tokeni se logiraju
        │ ├── Voyage API (F5+)         💰
        │ ├── Stripe API+webhook (F14)
        │ └── web-push → browser push servisi (F10)
[GitHub zbuka-cakaric/oi-ispit]  = kod (main = produkcija)
[GitHub zbuka-cakaric/oi-gradivo] = PDF izvornici + docs/ (ova biblija) — PUBLIC (AI čita raw)
[QNAP ZBUKA] = odredište ručnih backupova baze
```

## 3. ENV katalog (Railway → Variables) — POTPUN, s fazom uvođenja
| Varijabla | Vrijednost/oblik | Od | Napomena |
|---|---|---|---|
| `DATABASE_URL` | referenca na Railway PG | v001 | |
| `PORT` | 8080 (Railway ga daje) | v001 | |
| `INIT_KEY` | `io-ispit-2026` ⚠ "io", ne "oi" | v001 | init-db zaštita; SAMO uz promjenu sheme |
| `JWT_SECRET` | tajna | v001 | promjena = globalna odjava (bezopasno) |
| `PWD_PEPPER` | tajna | v001 | 🔒 **NE MIJENJATI nakon prvih pravih korisnika** — ruši sve prijave |
| `SUPERADMIN_EMAIL` | info@zbuka.hr | v001 | `je_superadmin` se računa u hodu (do F13 `uloga` stupca) |
| `APP_URL` | https://oi-ispit.zbuka.hr | v001 | linkovi u mailovima |
| `RESEND_API_KEY` / `RESEND_FROM` / `RESEND_REPLY_TO` | … / `OI Ispit <noreply@zbuka.hr>` / info@zbuka.hr | v003 | |
| `AI_ENABLED` | true/false | F5 | kill-switch: sve AI rute → 503 🔒 |
| `ANTHROPIC_API_KEY` | … | F5 | |
| `MODEL_ODGOVOR` / `MODEL_PLANNER` | npr. claude-sonnet-4-6 / claude-haiku-4-5-20251001 | F5 | 🔒 imena modela NIKAD hardkodirana u kodu |
| `VOYAGE_API_KEY` | … (Ivan ga ima) | F5 | |
| `VAPID_PUBLIC` / `VAPID_PRIVATE` / `VAPID_SUBJECT` | `npx web-push generate-vapid-keys`; subject `mailto:info@zbuka.hr` | F10 | |
| `STRIPE_SECRET` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_PRO` | test pa live | F14 | |

## 4. Sigurnosni model (postojeći + planirano)
- **Auth:** email+lozinka; hash = bcryptjs(lozinka + PWD_PEPPER); JWT 7 d u Authorization Bearer; prisilna promjena lozinke flow postoji (kredencijali mailom pri registraciji admin-kreiranih? — vidi server.js za točan tok).
- **Hardening v006 (drži se obrasca u SVIM novim rutama):** `withTx(fn)` transakcije; reset-token atomarno (`UPDATE … WHERE iskoristen=false RETURNING` u istoj tx s promjenom lozinke — nema SELECT-pa-UPDATE utrke); register atomaran (UNIQUE odlučuje → 409; retry random sufiks na sudar korisničkog imena; dup-detekcija `e.code==='23505' || /duplicate key|unique/i` radi i na pg-mem); **`s(v,max)` koercija+limit na SVIM inputima** (ne-string ne smije srušiti rutu); LIMIT clamp na listama.
- **Superadmin gate:** `zahtijevajSuperadmin` middleware na svim admin rutama (403, ne 401 — prijavljeni bez prava).
- **Rate limiting:** naslijediti ŽBUKA obrazac pri F19 prolazu (login pokušaji perzistentno u bazi; API in-memory po ruti za AI: ~10/min/korisnik).
- **CORS/headeri:** F19 sigurnosni prolaz preslikava ŽBUKA set (X-Frame-Options, X-XSS, Referrer-Policy; CORS na APP_URL).
- 🔒 **planEnforce SAMO server** (01 §4.6); 🔒 **točni odgovori nikad klijentu prije predaje**; 🔒 **AI post-provjera citata** (07).
- **Tajne:** žive SAMO u Railway ENV — nikad u kodu, repou, chatu.

## 5. PWA / Service Worker strategija (naučena krvlju — v009→v012 saga)
- **Precache SHELL** (install): `/`, index, manifest, ikone, 10 font fajlova → cache `oi-vNNN`.
- **Fetch pravila:** `/api/*` → **network-first** (offline → 503 `{offline:true}`), NIKAD perzistentni cache API-ja 🔒 (zato health-ping ne laže). Sve ostalo → cache-first + pozadinsko osvježenje kopije.
- **Update mehanizam (v012, konačni)** 🔒: install→`skipWaiting()`, activate→brisanje starih cacheeva+`clients.claim()`; klijent: `controllerchange` (uz guard prve instalacije) → `location.reload()`; **health-ping** — stranica čita svoju verziju iz `#ja-verzija` DOM-a i uspoređuje s `GET /api/health` na: load, `focus`, `visibilitychange→visible`, `online`, svakih 5 min → razlika → `reg.update()`; `reg.waiting` → `postMessage({type:'SKIP'})` (sw ima message handler). ⚠ Naučeno: sama visibilitychange NIJE dovoljna (app u fokusu tijekom deploya + Android resume bez eventa).
- ⚠ **F7 guard:** globalni `window.OI_BLOK_RELOAD=true` dok test traje — `pingaj()` ga poštuje (reload usred testa = izgubljeni odgovori).
- **Instalacija:** Android beforeinstallprompt banner + iOS Share-upute (v005); ⚠ Play Protect epizoda: nepotpisani WebAPK na svježem certu — instalirati kroz Chrome; `manifest id:"/"` (v006). iOS instalacija još netestirana.
- ⚠ **Svaka izmjena sw.js = verzija ×3** (server VERZIJA / sw CACHE_VERSION+changelog / index #ja-verzija) — bez iznimke.

## 6. pg-mem testni harness — pravila igre
Pokretanje: `npm i --no-save pg-mem && node test-v007.js` (pg-mem NIJE u produkcijskim deps ⚠ ali JE u package.json devDeps po Ivanovoj odluci — Railway pokreće samo server.js). Harness monkeypatcha `require.cache[require.resolve('pg')]` PRIJE `require('./server.js')`, postavlja ENV, gađa localhost:3299 fetchom.
**Lekcije (obavezne u novim rutama):** bez koreliranih subquerija u SELECT projekciji (GROUP BY ili poseban upit + Set); bez `ANY($1::int[])` (petlja); toggle preko DELETE rowCount (ne ON CONFLICT…RETURNING za toggle); `ON CONFLICT DO UPDATE … RETURNING` za brojače RADI ✔; dup-detekcija code+message. **Od F5:** vektorski sloj se u testovima MOCK-a (funkcija `dohvatiIzvore` zamjenjiva) — pg-mem nema pgvector; živi kvalitet mjeri eval.js na pravoj bazi (07 §eval).

## 7. Konvencije koda (nepromjenjive radne navike)
Kirurški `str_replace` (nikad prepisivanje cijelog fajla; programski: assert count==1) · `⭐ vNNN` markeri se NIKAD ne brišu · rute IZNAD `app.get('*')` · envelope `{ok:…}` / `{error:"…"} + točan HTTP status` · NOT NULL+DEFAULT+indeks uz svaku tablicu · initDb idempotentan (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS), kumulativan (stari blokovi se ne brišu) · komentari HR bez dijakritike · UI copy HR ti-forma · BUILD-GATE prije svake isporuke: `node --check` server+sw + izvučeni index JS + UTF-8/mojibake sken + grep verzije ×3 + `node test-v007.js` (testovi samo rastu; trenutno **30/30**) · isporuke fajlova u ZIP-u · commit+tag po deployu.

## CHANGELOG
- 2.0 (2026-07-04): inicijalno.

> ✅ **Provjereno 2026-07-09 (stanje koda v183).**
## DOPUNA 2026-07-09 (v183)
### ENV — nove varijable (Investitor / DGU)
| Var | Default | Svrha |
|---|---|---|
| `DGU_WFS_URL` | `https://api.uredjenazemlja.hr/services/inspire/cp/wfs` | WFS endpoint čestica — **NE postavljati** (default je službeni anonimni; mijenja se samo za OSS varijantu) |
| `DGU_TOKEN` (alias `DGU_AUTH_KEY`) | prazno | token iz OSS registracije — **pričuva** (CP servisi su anonimni po potvrdi DGU 2026-07-09); Ivanov ključ čuvati SAMO u Railway ENV |
| `DGU_TOKEN_PARAM` | `token` | naziv query parametra za token |
- WFS timeout: 8000 ms (konstanta `INV_TIMEOUT` u server.js).
### CSP (v179) — dopuštene domene za kartu
`script-src`: + unpkg.com, cdn.jsdelivr.net · `img-src`: + tile.openstreetmap.org (a/b/c), api.uredjenazemlja.hr, oss.uredjenazemlja.hr, geoportal.dgu.hr · `connect-src`: + api/oss.uredjenazemlja.hr. Leaflet 1.9.4: unpkg primarno, jsdelivr fallback (`ucitajSa` helper).
### ⚠ Naučeno o državnim serverima
`api.uredjenazemlja.hr` **gateway filtrira ne-browser klijente** (na sve pozive vraća 400, i na dokumentirane primjere) — jedini mjerodavni testovi su browser i Railway (`/api/investitor/probe`). `oss.uredjenazemlja.hr/oss/public/atom/*` (statični ATOM) NE filtrira i radi strojno. WFS zna vratiti i 500 (njihova strana).
