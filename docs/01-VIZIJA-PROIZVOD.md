# 01 — VIZIJA I PROIZVOD (feature katalog s tehnologijom)

## 1. Misija
**Džepni sudski vještak i instruktor budućih ovlaštenih inženjera.** Jedna aplikacija koja: (a) kandidata provede od nule do položenog stručnog ispita (GRA/ARH/ELE/STR), i (b) praktičaru na gradilištu u 30 sekundi da odgovor utemeljen u propisu s klikabilnim dokazom — umjesto poziva vještaku, maila odvjetniku i tri dana čekanja.

## 2. Dva moda, jedan temelj
| | **PRIPREMA** (instruktor) | **PRAKSA** (vještak) |
|---|---|---|
| Korisnik | kandidat, student | inženjer, voditelj, arhitekt, vještak |
| Ritam | dnevni plan do datuma ispita | ad-hoc, "sada mi treba" |
| Srce | testovi + SRS + usmeni simulator | AI odgovor s citatima + alati |
| KPI | spremnost %, položen ispit | vrijeme-do-odgovora, točnost citata |
Temelj im je identičan: ista baza članaka, isti retrieval, isti račun — mod je UX preklopnik (Ja tab, F17), ne odvojen sustav 🔒.

**TREĆI STUP (zadnja faza, poslije v1.0): INVESTITOR** — kčbr+k.o. → službena geometrija (WFS, ne slika!) → GUP pravila (kurirani JSON, kod računa) → volumetrijska studija + pravni checklist s citatima iz ISTE baze → investicijska studija (PDF). Kompletna istina: **10-INVESTITOR.md** 🔒. Tri proizvoda, jedan temelj — propisi.

**STRATEGIJA REDOSLIJEDA 🔒 (Ivan, 2026-07-05): GRA-first.** Sve faze (F4–F20 + F21–F27) dovršavaju se i dokazuju na GRADITELJSTVU (Ivanov sektor: gradivo GRA ~89 % uvezeno, Ivan je živi evaluator za mentora, vještaka i investitora). Ostali sektori (ELE/STR/ARH) dobivaju gradivo i fino podešavanje TEK kad GRA radi end-to-end — šifrarnik i arhitektura su već multi-program pa je širenje samo sadržajni posao, ne kodni.

## 3. Personas (dizajniraj ZA njih)
- **Kandidat (28–45, VSS, zaposlen):** uči navečer, mobitel, treba dozirano + osjećaj kontrole. Neprijatelj: preplavljenost (125 propisa!). Naše oružje: plan, spremnost-prsten, push disciplina.
- **Praktičar:** ne želi učiti, želi RIJEŠITI. Neprijatelj: nesigurnost i gubitak vremena. Oružje: odgovor+citat+koraci ("U praksi" sekcija svakog AI odgovora), kalkulatori, dopisi.
- **Vještak/pravnik-tehničar:** treba povijest prava ("na dan"), precizne reference. Oružje: clanci_verzije.
- **Student:** budući kandidat, free segment, budući evangelist. Oružje: besplatno gradivo + testovi.
- **Tvrtka (B2B, post-v1.0):** seatovi + uvid u spremnost tima. NE gradi se prije v1.0 — samo ne zabetonirati odluke koje bi ga onemogućile (identiteti, planEnforce arhitektura već su kompatibilni).

## 4. FEATURE KATALOG — svaka sastavnica: što · tehnologija · faza · tier
> Ovo je srce dokumenta. "Tehnologija" = točan alat/tehnika u NAŠEM stacku (02), ne generički pojam.

### 4.1 Gradivo i čitanje
| Sastavnica | Kako radi / tehnologija | Faza | Tier |
|---|---|---|---|
| Katalog propisa po programu | `sifrarnik` JSON (195+ propisa, 438+ mapiranja iz 4 ministarska PDF-a + naši dodaci) → tablice `dokumenti`+`program_dokumenti`; Uči grupira po `sekcija_put` jednim GROUP BY | ✅ v007 | Free |
| Članci propisa | vanjski Python pipeline (06) → JSON → `POST admin/uvoz/clanci` s hash-skipom; čitač: prev/next, `<p>` po `\n` | ✅ v007–v011 | Free |
| Preview članaka bez naslova | server šalje `preview` (prvih 90 zn. teksta samo kad naslova nema; rezanje u Node-u, pun tekst ne putuje) | ✅ v010 | Free |
| Pretraga gradiva | ILIKE nad `dokumenti.naziv` + `clanci.oznaka/naslov`, 15+15, debounce 300 ms; od F5 nadograđuje se HIBRIDOM (vektor+FTS) i pretragom PO TEKSTU članaka | ✅ v007 → F5 | Free |
| Bookmarki | tablica `bookmarki`, DELETE-first toggle (pg-mem lekcija), zvjezdica u čitaču i listi | ✅ v007 | Free |
| Označi pročitano | `napredak_clanci` PK(korisnik,clanak), toggle gumb u čitaču — hrani pokrivenost | F8 | Free |
| Bilješke po članku | `biljeske` (bez highlight raspona ⚠ offseti pucaju kroz verzije; highlight tek uz verzija_id sidro 🔓) | F12 | Pro |
| "Na dan" prikaz prava | `clanci_verzije` (vrijedi_od/do) + date-picker u čitaču → SQL vremenski presjek | F4 (podaci) + F17 (UI) | Pro |
| Sažetak članka (toggle) | Claude sažetak generiran JEDNOM po verziji članka, spremljen u bazu (ne live 💰), toggle u čitaču | F6+ 🔓 | Pro |
| Pojmovi (rječnik struke) | tablica `pojmovi` postoji; punjenje uz gradivo, tooltip/lista u Uči | F3b+ 🔓 | Free |

### 4.2 Testiranje i napredak (instruktor)
| Sastavnica | Tehnologija | Faza | Tier |
|---|---|---|---|
| Banka pitanja | `pitanja` (abc/TN/otvoreno/usmeno, `clanak_refs[]` 🔒, tezina); nacrte generira Claude IZ ČLANAKA (07 §prompt 5.3), Ivan ovjerava u admin UI; dedup preko embedding cosine>0.92 flag | F6 | — |
| Pitanja s rokova | Ivanov JSON upload → RAG mapira `clanak_refs` → nacrt → ovjera; `rok_oznaka` čuva porijeklo | F6 | — |
| Testovi (brzi 10 / puni 30 / sekcija / slabe točke) | `test_sesije`+`test_odgovori`; server bira pitanja i NIKAD ne šalje točno prije predaje 🔒; odgovor-po-odgovor s offline queue (flush na 'online'); otvorena pitanja ocjenjuje Claude rubrikom q0–5 | F7 | Free 10/mj (`usage_mjesec` atomarno) / Pro ∞ |
| Obrazloženja odgovora | u `pitanja.obrazlozenje` (ovjereno), s "otvori članak" linkovima | F7 | Pro (Free vidi samo točno/netočno) |
| SRS ponavljanje | `srs_stanje`, SM-2 lite: `ef'=max(1.3, ef+0.1-(5-q)(0.08+(5-q)·0.02))`; intervali 1d, 6d, `round(i·ef)`; due kartice na Danas | F9 | Pro |
| Spremnost (prsten) | `0.35·pokrivenost + 0.45·točnost(w=0.5^(dana/30)) + 0.20·SRS-svježina` — komponente VIDLJIVE, po sekcijama razrez, "najslabije 3" s CTA | F8 | Free (osnovno) / Pro (razrez) |
| Dnevni plan | kod (ne AI): dana-do-ispita × sekcije ponderirane brojem članaka i težinom (config JSON) → raspored na Danas | F11 | Pro |
| Streak | `events` agregat, prikaz na Danas, `streak_spas` push | F9/F10 | Free |

### 4.3 AI (vještak + instruktor)
| Sastavnica | Tehnologija | Faza | Tier |
|---|---|---|---|
| AI asistent (pitanja o propisima) | RAG (07): Haiku planner → hibrid pgvector(voyage-law-2)+FTS → RRF → Sonnet grounded odgovor s [n] citatima → post-provjera KODOM 🔒 → SSE stream; ulaz: kartica na Danas + "Pitaj o ovom članku" u čitaču | F5 (API) + F15 (UI) | Pro (50 por/dan soft) |
| Klikabilni citati | citati nose `clanak_id` 🔒 → tap → postojeći `otvoriClanak()` | F15 | Pro |
| Usmeni AI ispitivač | state-machine (07 §3.6.3): scenarij sa "zlatnim sadržajem" fiksiranim na startu → glavno pitanje → Haiku procjena rupa → ≤3 ciljana potpitanja → rubrika JSON (potpunost/točnost citata/praktičnost/komunikacija) + "ponovi" linkovi; kandidatov odgovor NIKAD u retrieval 🔒 | F16 | Pro (3 sesije/dan) |
| Generator pitanja (admin) | Claude iz članak-klastera, JSONL izlaz, status 'nacrt' | F6 | admin |
| "Što donosi novela" | kod-diff verzija članaka → Claude 1 rečenica/članak → objava + push | F4 bonus | Free (čitanje) |

### 4.4 Praksa alati (vještak)
| Sastavnica | Tehnologija | Faza | Tier |
|---|---|---|---|
| Generator dopisa | strukturirane forme (prigovor na zapisnik, požurnica čl. 48/66 rokovi, obavijest o nedostacima, zahtjev produljenja roka po uzancama) → Claude puni nacrt iz forme + RAG citata; few-shot = Ivanova anonimizirana arhiva stvarnih dopisa (HZZ, Ingrad, Caparol…); izlaz tekst-za-kopiranje (docx 🔓 kasnije preko postojećeg ŽBUKA know-howa) | F17 | Pro |
| Kalkulator rokova | kurirana `rokovi.json` u repou `{naziv, propis, clanak_id, formula}` — **KOD računa** (date math), AI samo objašnjava, izvor uvijek prikazan ⚠ AI nikad ne računa rok | F17 | Pro |
| Checkliste | statički definirane (prijava početka; dokumentacija gradilišta čl. 93; tehnički pregled; uklanjanje) + `korisnik_checklist` stanje | F3b (prva) + F17 | Free (1) / Pro (sve) |
| Vodič kroz prijavu ispita | statički sadržaj (Ivan daje točne upravne korake ⚠ AI ne izmišlja) + checklist | F3b | Free |

### 4.5 Angažman i komunikacija
| Sastavnica | Tehnologija | Faza | Tier |
|---|---|---|---|
| Push notifikacije | web-push VAPID, sw.js push+notificationclick (deep-link hash), in-process scheduler 15 min (⚠ lock kroz `sustav_meta` ako ikad >1 instanca); katalog: ispit_t14/7/3, spremnost_alarm(≤21d ∧ <50%), due≥15, streak_spas, novo_gradivo; tihe sate 21–08, max 1/dan, isti tip ≥72 h, 404/410→DELETE pretplate | F10 | Free (osnovne) / Pro (pametne) |
| Transakcijski mailovi | Resend, `mailOkvir()` tablični layout, plain-text dio + reply_to (deliverability), DMARC postavljen | ✅ v003 | — |
| Onboarding | 2 koraka (područje odmah sprema, datum opcionalan) → v2: + cilj i plan | ✅ v008 → F11 | Free |

### 4.6 Račun, plaćanje, administracija
| Sastavnica | Tehnologija | Faza | Tier |
|---|---|---|---|
| Auth | email+lozinka (bcryptjs + PWD_PEPPER), JWT 7d; register atomaran (UNIQUE→409, retry sufiks), reset atomaran (UPDATE…RETURNING u tx) — v006 hardening | ✅ | — |
| Tier enforcement | `planEnforce(feature)` middleware — SAMO server 🔒; kvote `usage_mjesec` ON CONFLICT DO UPDATE RETURNING | F13 | — |
| Stripe | Checkout + Customer Portal + webhook (RAW body ⚠ prije express.json!), idempotentnost UNIQUE(event_id) 🔒, tier+tier_do sync | F14 | — |
| Admin uvoz + progress | 2 file inputa, hash-skip (čuva bookmarke), `admin/uvoz/status` progress bar + popis | ✅ v011 | superadmin |
| Admin pitanja/ovjera | lista nacrta, uredi, ovjeri/povuci | F6 | superadmin |
| Admin analitika | events agregati: DAU, testovi, AI upiti, thumbs-down klasteri (= backlog sadržaja), trošak-alarm >€10/dan | F18 | superadmin |
| GDPR | DELETE računa (email potvrda) + JSON izvoz svega; ON DELETE CASCADE lanac provjeren pri svakoj tablici 🔒 | F19 | — |

## 5. Monetizacija (tehničke činjenice; cijene su Ivanova poluga)
FREE: gradivo+pretraga+bookmarki+10 testova/mj (bez obrazloženja)+osnovni push. PRO 19,99 €/mj: sve + AI (50/dan soft) + usmeni (3/dan) + SRS/plan/razrez + Praksa alati + "na dan". Poluge kasnije 🔓: godišnja cijena, studentski popust, B2B seatovi. Referentni cilj održivosti: 100 Pro ≈ €2.000 MRR uz ≈ €50–70 AI troška (07 §troškovnik).

## 6. Sjeverna zvijezda kvalitete
Dva referentna pitanja koja MORAJU raditi savršeno prije nego F15 proglasimo gotovim (i ostaju trajni regresijski test): **"Što mi sve treba za početak gradnje?"** i **"Kako reagirati ako je ugrađen nekvalitetan materijal, a uporabna dozvola je dobivena?"** — odgovor točan, strukturiran (odgovor→temelj→u praksi→pazi), svi citati klikabilni i ispravni.

## TRI MODA (2026-07-05 — krovna odluka, detalji u 12)
Platforma **ŽBUKA AI** (krovni brend; plavi logo → oi.zbuka.hr, crveni → ai.zbuka.hr/Gradilište). Selling point: **tehnologija kritičkog razmišljanja** — **Mentor** (OI Ispit, plava) · **Vještak** (teren za profesionalce, narančasta) · **Investitor** ("informacija vrijedi više nego zemljište", tamnozelena). Jedan račun, jedna baza propisa, jedan AI mozak (GATE 93 %); tri footera, tri ulazne situacije.

## CHANGELOG
- +2026-07-05: tri moda + ŽBUKA AI rebrand (vidi 12-BRAND-MODOVI).
- 2.1 (2026-07-05): §2 treći stup INVESTITOR (→10) + strategija GRA-first.
- 2.0 (2026-07-04): inicijalno.

> ✅ **Provjereno 2026-07-09 (stanje koda v183).**
## DOPUNA 2026-07-09 (v183)
- **Tri moda su stvarnost u produkciji:** Mentor (plava), Vještak (narančasta), **Investitor (zelena — karta katastra, GPS, kčbr pretraga, obuhvat više čestica).**
- **Monetizacija — novi mehanizmi u kodu:** 🎁 **Promo akcije** (tablica `promo_akcije`, rang-logika dodjele, hook na registraciju, superadmin panel) · ⚙️ **Ovlasti pretplata** (`tier_postavke`: DB override budžeta USD i mjesečnih kvota po tieru za pismeni/usmeni/vjestak/investitor; NULL=∞; provedba u sva 4 toka).
- **Vještak je narastao u punopravni radni alat:** privici do 50 MB (📎 gumb + drag&drop overlay + Ctrl+V paste), progresna traka, procjena troška prije slanja, prikaz stvarnog troška ispod odgovora ("⚡ Ovaj odgovor: N tokena", superadmin vidi i $), retry na zagušenje (529/429), auto-nastavak odrezanih dugih odgovora.
- **Raščlamba potrošnje po značajkama** u profilu (klik na mjerač tokena) — transparentnost prema korisniku.
