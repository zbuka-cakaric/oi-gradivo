# 05 — FRONTEND (jedan index.html: router, ekrani, uzorci, dizajn)

## 1. Arhitektura fajla
`index.html` = `<style>` (Norma) + `<body>` sekcije-ekrani + `<script>` (stanje, router, API sloj, funkcije po tabu). Bez builda, bez modula — funkcije su globalne, disciplina imenovanja drži red (prefiks po području: `uci*`, `adm*`, `onb*`…). ⭐ markeri odjeljuju povijest verzija.

## 2. Stanje i API sloj
- `TOKEN_KEY='oi_token'` u localStorage; `getToken/setToken/delToken`.
- `KORISNIK` globalni objekt (nakon login/profil fetch), `UCI_CACHE` (struktura gradiva; invalidira se nakon admin uvoza), `PROGRAMI`.
- `api(path, body, auth)` POST i `apiGet(path)` — omotači fetcha: Bearer header, JSON parse, `{error}` → throw; 401 → delToken + login ekran.
- `esc(s)` HTML escape — OBAVEZAN na svakom umetanju korisničkog/podatkovnog teksta u innerHTML 🔒 (XSS).
- `val(id)` čitanje inputa; localStorage ključevi: `oi_token`, `oi_onb_skip`, `oi_inst_skip`.

## 3. Router i navigacija (v2 — v042)
Hash-router: superset tabova `#danas #testovi #napredak #uci #ja #razgovor #povijest #invest`; **granice PO MODU** u `renderTab` (tab izvan moda pada na prvi tab moda) 🔒. Footer `#nav` se **GRADI** iz `MOD_TABOVI` (`navRender(m)`) — bez relabel/hide hakova; ikone u `IKONE` mapi. **Krović** (potpis brenda, 12 §1) = `::before` trokut u `--accent` iznad aktivnog gumba. Točno JEDNA `.tab` sekcija aktivna — **pod-prikazi su ukinuti** (⚠ lekcija v039-v041: `danas-ai` display-toggle je zaglavljivao mod i slagao ekrane preko Ja). Donja navigacija = 5 tabova MAX po modu ⚠. Pod-ekrani unutar Uči ostaju (`uciPrikaz`).
Modovi: `postaviMod(m)` = localStorage `zb_mod` → `primijeniMod()` (body[data-mod], pilula, navRender) → `idiNaTab(prvi tab moda)` — instantno. Ulaz u chat isključivo `otvoriVjestak(pre?)` (Danas kartica, čitač gumb, citat).

## 4. Ekrani — postojeći (v012) i budući
| Tab/ekran | Sadržaj sada | Dolazi (faza) |
|---|---|---|
| **Danas** | skeleton: prsten (bez izmišljenih brojki), pozdrav | prsten spremnosti s komponentama (F8), due kartice + "Ponovi (N)" (F9), dnevni plan (F11), AI kartica (F15), streak (F9) |
| **Testovi** | placeholder | izbor tipa → tijek 1-pitanje/ekran s progresom → rezultat s obrazloženjima i "otvori članak" (F7) |
| **Napredak** | placeholder | razrez po sekcijama, najslabije 3 s CTA, povijest sesija (F8) |
| **Uči** | search bar (debounce 300 ms) → sekcije → propis (obuhvat, NN, br. članaka; disabled ako 0) → lista članaka (oznaka + naslov ILI preview kurziv v010 + ★) → čitač (meta, naslov, `<p>` po `\n`, ★ toggle, prev/next) | "✓ Pročitano" (F8), bilješke (F12), "na dan" date-picker Pro (F17), sažetak toggle (F6+), traka "brisan novelom" (F4) |
| **Razgovor** (Vještak) | v042: chat kao pravi tab — naslov aktivnog razgovora (`#rz-akt`), ➕ Novi, MD render (`mdRender`, XSS-safe esc-prvo), SSE `{status}` linija | glas, predlošci upita po ulozi |
| **Povijest** (Vještak) | v042: lista razgovora (naslov, datum, br. pitanja, 🗑), tap → Razgovor | tag po gradilištu, pretraga |
| **Parcela** (Investitor) | v042: najava kartica (kčbr → namjena/kig/kis) | F21+ |
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
- 2.13 (2026-07-05): **v053 — POVRATAK NA KLASIČNU LJUSKU 🔒 (Ivanov nalog; zamjenjuje pravila v049–v052)**: na Samsungu se viewport-lock ljuska raspadala (nav renderiran na VRHU, ništa ne skrola) iako je CSS bio validan (css-tree 0 grešaka). NOVO TRAJNO PRAVILO: **window skrola CIJELU stranicu; `.nav` je `position:fixed;bottom:0` (pluta); `.sadrzaj` drži `padding-bottom:168px+safe-area` (v048) pa footer nikad ne prekriva; `.vrh` ostaje sticky; `text-size-adjust:100%` ostaje**. Ukinuti: html/body `u-appu` overflow-lock (v050), `#app{position:fixed;inset:0}` (v052), `.sadrzaj` kao skroler (v051), `.nav{position:static}` (v052) — popis u CSS komentaru, ne vraćati bez Ivana. `skrolVrh/skrolDno` = window.scrollTo. Klase `u-appu` u JS-u OSTAJU (gate za main/footer display + instal offset). **Usmeni UI**: `#um-st` = "PITANJE X / N", `umIspravak()` kartica "ISPRAVAK — OCJENA n/100", `umRubrika()` = ukupna /100 + pill PROLAZ/NIJE PROLAZ + prag + razrez po pitanjima + "Novi ispit"; `OI_BLOK_RELOAD` uključen na start ispita, skinut na rubrici. UI testovi 46/46.
- 2.12 (2026-07-05): **v052 — KONAČNA ljuska 🔒**: `body.u-appu #app{position:fixed;inset:0;flex-column;min-height:0}` — okvir prikovan za viewport, neovisan o html/body skrol quirkovima (v049-v051 height/overflow pristupi na Samsungu nisu zagrizli); `.sadrzaj` jedini skroler. **Monogram logo** `.zmark`: bold Z (Inter 800, 26px) + `.zkv` kvačica u `var(--accent)` — boja prati mod (Ivanov nacrt); PNG samo na loginu. CSS validacija (css-tree) dodana u BUILD-GATE.
- 2.11 (2026-07-05): **v051** — `.sadrzaj{flex:1 1 0%}` (min-height:auto quirk je gutao skrol) + `#app{overflow:hidden}`; tabovi STROGO po modu (dozvoljeni = MOD_TABOVI + 'ja'; **usmeni u footeru Mentora** danas·testovi·usmeni·napredak·uči·ja — 6 uz Ivanov potpis); header logo = tekst `.zblogo` s `.zbkv/.zbai` u `var(--accent)` → **boja loga prati mod** (PNG ostaje na loginu).
- 2.10 (2026-07-05): **v050 hotfix ljuske** — overflow lock MORA biti i na `<html>` (klasa `u-appu` na documentElement u udjiUApp/odjava); samo `body{overflow:hidden}` NE zaključava viewport pa statični nav padne na dno dokumenta ("nema footera"). `height:100%` fallback ispred `100dvh`. ⚠ trajno pravilo uz v049 lekciju.
- 2.9 (2026-07-05): **v049 — APP-LJUSKA 🔒 (konačan fix sage "footer prekriva")**: `body.u-appu{height:100dvh;overflow:hidden}`, skrola se ISKLJUČIVO `.sadrzaj` (flex:1, overflow-y:auto) između headera i statičnog footera — preklapanje je konstrukcijski nemoguće; tipkovnica steže dvh pa unos+traka ostaju vidljivi. `text-size-adjust:100%` gasi Samsung font-boost (uzrok napuhanih naslova i fantomskih praznina kroz v044–v048). `skrolVrh()/skrolDno()` zamjenjuju SVE `window.scrollTo` (⚠ pravilo: nikad window-skrol u appu). 96px margin-hack ukinut.
- 2.8 (2026-07-05): **v048** — `podvrh` u sticky headeru: naslov aktivnog taba + kontekstna akcija (➕ Novi / ✕ Izađi) renderira ROUTER iz PV_N/PV_A mapa (jedna implementacija; kraj klase bugova "pojedeni/plutajući naslovi"); sekcijski h2-ovi dobivaju `.pn-skloni` (naslov-red u Razgovor/Povijest/Usmeni uklonjen); `.sadrzaj` 168px od footera; `rzRast` se zove i na programatski prefill (otvoriVjestak/rzPrimjer) + reset visine nakon slanja. UI testovi 38/38.
- 2.7 (2026-07-05): **v046 — DIZAJN ZAKLJUČEN** (Ivanov nalog "završi i idemo dalje s fazama"). Chat živost: `.tipka` točkice do prvog tokena + `.karet` treptavi kursor u streamu; `rzRast` rastuća kućica (max 32vh). **Ja u footeru SVIH modova** (Ivanova odluka — Vještak 6 tabova, `.nav.gusto`; ⚠ mijenja raniji "5 MAX": novo pravilo = 5, iznimno 6 uz Ivanov potpis). Ja v2: Pretplata kartica (Pro pitch + mailto; skrivena za Pro) + Aplikacija kartica (Osvježi, obavijesti-uskoro). **Nastavi gdje si stao** (`oi_zadnji_clanak` localStorage, kartica na Danas → `_skokClanak`). **Novosti točkica** (`novTockica`, `oi_nov_vidjeno`). Čitač: `#uc-prog` "ČLANAK X OD N" + swipe prev/next (64px prag). **Tour** 3 koraka (`oi_tour_done`). Premium sloj: tap-highlight off, ::selection, sjena/linija tokeni, active scale, karticе radius 16. Push novela = F15.6 (traži package.json + VAPID ENV). UI testovi 31/31.
- 2.6 (2026-07-05): **v045** — citat u chatu vodi RAVNO na članak (`_skokClanak` u renderTab; fix race: `ucitajUci` je async gazio `otvoriClanak` — postojao od v035); `overflow-x:clip` + `overflow-wrap:anywhere` (duge neprelomive linije širile stranicu → naslov "bježao" ulijevo + fantomska praznina); fade animacija bez transforma; header i footer NEPROZIRNI (var(--paper)/#fff — sadržaj se ne smije vidjeti kroz njih 🔒-lekcija); `.sadrzaj` 12px top / 140px bottom; **avatar izbornik** u headeru (`.av`, `.av-menu`: Moj profil · Notifikacije-uskoro · Osvježi aplikaciju · Odjava, zatvaranje klikom vani); grafovi Napretka tokenizirani (var(--accent)). Audit dizajna: fontovi 100% kroz tokene, radijus skala 11/14/16/18/999. UI testovi 23/23.
- 2.5 (2026-07-05): **v044 poliranje po Ivanovom terenskom testu** — `.sadrzaj` padding-bottom 122px (footer NIKAD ne prekriva sadržaj 🔒-lekcija), `.btn-sek` za sekundarne gumbe na svijetlom (btn-svjetli je SAMO za tamne kartice ⚠), `.nlab` centriran naziv taba, logo 18px, Razgovor prazno-stanje s 3 primjer-pitanja (`rzPrimjer`), `overscroll-behavior:none` (One UI rastezanje + pull-to-refresh), picker prsten na aktivnom modu. UI testovi 19/19.
- 2.4 (2026-07-05): **v043** — Vještak footer = Razgovor·Povijest·Propisi·**Dopisi**·**Novosti** (5 MAX 🔒; **Ja kroz gornju pilulu** u Vještaku — Ivanova odluka); Dopisi = 6 predložaka → otvoriVjestak sa strukturiranim uputama (do F17); Novosti = /api/novosti feed → otvoriDok; dizajn v2: `--accsoft/--accent2` po modu (fix: pilule/fokusi ostajali plavi), `--sjena`, `.naslov::after` podcrta u boji moda, chat klase `.ai-u/.ai-b/.cit-chip`, čitač `#uc-tekst` u serifu 16.5/1.7, prefers-reduced-motion. **Interni UI test: test-ui-v043.js (jsdom, 15 provjera — ulovio TABOVI regresiju).**
- 2.3 (2026-07-05): **v042 UX okvir v2** — §3 prepisan (tabovi po modu, navRender, krović indikator, pod-prikazi ukinuti); +Razgovor/Povijest/Parcela ekrani; čitač: ⚡Skraćeno/💡Primjer gumbi (`pomocDaj`, `#uc-pomoc`); Ja: potrošnja API-ja u $ (`#ja-ai-usd`); `mdRender` za AI tekst (model smije **bold** i crtice, bez ##).
- 2.2 (2026-07-05): +§8 brend i tri-mod nav; F15 isporučen (v035-v038; lekcija: globalni .btn je width:100% — inline gumbi MORAJU width:auto).
- 2.1 (2026-07-04): +update-traka (v014).
- 2.0 (2026-07-04): inicijalno.
