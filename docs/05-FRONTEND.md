# 05 — FRONTEND (jedan index.html: router, ekrani, uzorci, dizajn)

## 1. Arhitektura fajla
`index.html` = `<style>` (Norma) + `<body>` sekcije-ekrani + `<script>` (stanje, router, API sloj, funkcije po tabu). Bez builda, bez modula — funkcije su globalne, disciplina imenovanja drži red (prefiks po području: `uci*`, `adm*`, `onb*`…). ⭐ markeri odjeljuju povijest verzija.

## 2. Stanje i API sloj
- `TOKEN_KEY='oi_token'` u localStorage; `getToken/setToken/delToken`.
- `KORISNIK` globalni objekt (nakon login/profil fetch), `UCI_CACHE` (struktura gradiva; invalidira se nakon admin uvoza), `PROGRAMI`.
- `api(path, body, auth)` POST i `apiGet(path)` — omotači fetcha: Bearer header, JSON parse, `{error}` → throw; 401 → delToken + login ekran.
- `esc(s)` HTML escape — OBAVEZAN na svakom umetanju korisničkog/podatkovnog teksta u innerHTML 🔒 (XSS).
- `val(id)` čitanje inputa; localStorage ključevi: `oi_token`, `oi_onb_skip`, `oi_inst_skip`.

## 3. Router i navigacija
Hash-router: `#danas #testovi #napredak #uci #ja` — `TABOVI` lista s **bounds guardom** (nepoznat hash → danas) 🔒 uzorak za sve nove ekrane. Donja navigacija = **5 tabova MAX** ⚠ (mobilna ergonomija) — zato AI asistent (F15) NE dobiva 6. tab nego: istaknuta kartica na Danas + gumb "Pitaj o ovom članku" u čitaču. Pod-ekrani unutar taba (Uči: lista→dokument→članak) = interni prikazi (`uciPrikaz('lista'|'dok'|'clanak')`, display toggle + scrollTo(0,0)), s "← Natrag" gumbom.

## 4. Ekrani — postojeći (v012) i budući
| Tab/ekran | Sadržaj sada | Dolazi (faza) |
|---|---|---|
| **Danas** | skeleton: prsten (bez izmišljenih brojki), pozdrav | prsten spremnosti s komponentama (F8), due kartice + "Ponovi (N)" (F9), dnevni plan (F11), AI kartica (F15), streak (F9) |
| **Testovi** | placeholder | izbor tipa → tijek 1-pitanje/ekran s progresom → rezultat s obrazloženjima i "otvori članak" (F7) |
| **Napredak** | placeholder | razrez po sekcijama, najslabije 3 s CTA, povijest sesija (F8) |
| **Uči** | search bar (debounce 300 ms) → sekcije → propis (obuhvat, NN, br. članaka; disabled ako 0) → lista članaka (oznaka + naslov ILI preview kurziv v010 + ★) → čitač (meta, naslov, `<p>` po `\n`, ★ toggle, prev/next) | "✓ Pročitano" (F8), bilješke (F12), "na dan" date-picker Pro (F17), sažetak toggle (F6+), traka "brisan novelom" (F4) |
| **Ja** | profil (plan pill, područje, uže, datum ispita), ADMIN kartica (2 uvoza + status poruke + **progress bar & popis v011**), Aplikacija (verzija `#ja-verzija` 🔒 sidro health-pinga, donator), pravno (Uvjeti/Privatnost/Impressum modali), odjava | preklopnik Priprema/Praksa (F17), push postavke (F10), plan&kvote + Stripe portal (F13/14), izvoz/brisanje računa (F19) |
| **Onboarding** | modal 2 koraka: područje (sprema ODMAH ⚠ v008 lekcija — preskok datuma ne smije izgubiti izbor), datum (opcionalan); `oi_onb_skip` | +cilj/plan korak (F11) |
| **Instalacijski banner** | Android beforeinstallprompt / iOS upute; skriva se u standalone | — |

## 5. Norma design system (tokeni — NE izmišljati nove bez odluke)
```css
--paper:#F5F5F1; --ink:#16181B; --ink2:(sekundarni); --ink3:(tercijarni);
--accent:#2B4A75; --line:(razdjelnice);
--serif: Newsreader (naslovi, brand momenti); --sans: Inter (UI tekst);
--mono: IBM Plex Mono (oznake članaka, brojevi, verzija);
radius: kartice ~14px, inputi 11px, pill 99px; touch mete ≥44px visine.
```
Uzorci komponenti (reuse, ne reinvent): `.kartica`, `.red` (label↔vrijednost), `.mlab` (mono nadnaslov), `.tag` (+`.siva`), `.btn`, `.prazno` (empty-state s piktogramom), `.propis`/`.clanak-red` liste, `.adm-bar` progress (v011), `.field` input wrap. Empty-state UVIJEK objašnjava ŠTO i KAKO dalje ("Gradivo se uvozi kroz Ja → Admin").

## 6. Ključni frontend uzorci (kopiraj stil, ne izmišljaj)
- **Render liste:** `array.map(x=>\`<button …>${esc(x.polje)}</button>\`).join('')` u innerHTML; onclick inline s ID-em.
- **Debounce pretrage:** `clearTimeout(T); T=setTimeout(async()=>{…},300)`.
- **Toggle prikaza rezultata pretrage:** sekcije display none dok ima upita ≥2 zn., vraćanje na prazan.
- **Offline queue (F7):** red u memoriji `[{path,body}]`, `window.addEventListener('online', flush)`, retry s malim backoffom; UI označi "spremam…".
- **SSE čitanje (F15):** `const rd=(await fetch(...)).body.getReader(); … split('\n\n') … JSON.parse(line.slice(6))` → append u DOM (bez innerHTML+= po tokenu ⚠ — append u textContent noda radi performansi).
- **Auto-refresh v012** (02 §5) + **F7 guard:** `window.OI_BLOK_RELOAD` — postaviti na start testa/usmenog, skinuti na kraj; `pingaj()` prvo provjeri flag.
- **Update-traka (v014):** ako health-ping 3× uzastopno vidi noviju verziju bez uspješnog reloada → fiksna traka "Nova verzija je spremna — Osvježi" (safety net protiv tihe zaglave).
- **Verzija ×3 sidro:** `#ja-verzija` tekst "vNNN · Faza N" — health-ping ga parsira `split(' ')[0]` 🔒 ne mijenjati format.

## 7. UX principi (kratko ali obavezno)
Mobile-first (Ivan testira ISKLJUČIVO Samsung Android ⚠ — svaka isporuka mora biti palac-upotrebljiva); jedan primarni CTA po ekranu; brojke uvijek s kontekstom (ne "73" nego "73 od 162 pročitano"); nikad lažni podaci u skeletonima; greške ljudskim jezikom + što učiniti; sve destruktivno traži potvrdu; dijakritika svugdje ispravna (latin-ext fontovi ✔).

## 8. ŽBUKA AI — brend u sučelju (v037+) i tri-mod navigacija (Okvir sesija)
Header: ŽBUKA AI logotip (kvačica-krović **svjetloplava**, "AI" svjetloplav; v037 CSS placeholder dok Ivan ne ubaci originalne SVG-ove). **Potpis sučelja: kvačica-krović** = aktivni tab indikator (krović iznad ikone) i mode-picker kartice. Tri moda: footeri po modu (Ispit: postojećih 5 tabova NETAKNUTO · Vještak: Razgovor·Povijest·Propisi·Ja · Investitor: Parcela·Analize·Karta·Ja); `MOD` u localStorage('zb_mod'); boje: plava #2B4A75 / narančasta #D06A1F / tamnozelena #1E5741; login logo gradient prelijevanje plava→narančasta→zelena (reduced-motion safe). Detalji + roadmap po modu: **12-BRAND-MODOVI.md**.

## CHANGELOG
- 2.2 (2026-07-05): +§8 brend i tri-mod nav; F15 isporučen (v035-v038; lekcija: globalni .btn je width:100% — inline gumbi MORAJU width:auto).
- 2.1 (2026-07-04): +update-traka (v014).
- 2.0 (2026-07-04): inicijalno.
