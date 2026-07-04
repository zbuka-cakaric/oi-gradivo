# 06 — SADRŽAJNI PIPELINE (zakoni → čisti članci u bazi)

> Ovo je znanje plaćeno stvarnim bugovima — NIGDJE drugdje ne postoji. Pipeline radi AI (Claude, bilo koji model) u svom sandboxu, Pythonom NA DISKU (nula token-troška, nula halucinacija u pravnom tekstu 🔒 — pravni tekst se NIKAD ne pretipkava kroz kontekst razgovora).

## 1. Tok od izvora do aplikacije
```
zakon.hr "Preuzmi PDF" ─┐
NN web → Chrome Save-as-PDF ─┼→ Ivan upload u GitHub oi-gradivo (public; imena "<Naziv> - zakon.hr.pdf")
                             │
AI sandbox: curl raw.githubusercontent → pdftotext -layout -enc UTF-8
  → parser (profil §3/§4) → QC (§5) → JSON {dokument_naziv, clanci:[{redoslijed,oznaka,naslov,tekst}]}
  → ZIP isporuka → Ivan: Ja→Admin→Članci propisa → hash-skip/upsert → Uči
```
🔒 `dokument_naziv` MORA biti egzaktan naziv iz šifrarnika (dokumenti.naziv je upsert sidro). AI ga UVIJEK provjeri u `oi-sifrarnik-regulative-v*.json` prije parsiranja.
⚠ AI sandbox mreža: SAMO github/npm/pypi domene — zato je GitHub most; nn.hr/zakon.hr se ne mogu povući direktno.

## 2. Format izlaza (ugovor s rutom uvoza) 🔒
`oznaka` ≤60 zn. · `naslov` ≤300 · `tekst`: odlomci (stavci/točke) spojeni JEDNIM `\n` (frontend svaki `\n` renderira kao `<p>`), unutar odlomka retci spojeni razmakom · redoslijed 1..N linearan (prezentacijski, NIJE identitet — identitet je oznaka).

## 3. PROFIL A — zakon.hr generator (`parse_gen.py`) — zakoni
**Layout:** header "preuzeto DD.MM.YYYY." · footer 2 linije "{Naziv}  N / M" + "na snazi od … | NN …" (naziv-parametriziran regex!) · TOC na str. 1 (preskače se — parser kreće od prvog headinga) · centrirano (indent>0) = struktura/heading/naslov; kolona 0 = tekst · `\f` dijeli stranice.
**Heading:** `^\s+(Članak (\d+)\.([a-z])?(?: \(([^)]{1,60})\))?)\s*$` — hvata i sufikse: `(NN 94/18)` noveliran, `(N 110/21)` ⚠ tipfeler IZVORNIKA (ZUP čl. 26 — čuva se vjerno), `(na snazi od 01.01.2028.)` odgođena primjena (Energetska čl. 10). Oznaka = puni normalizirani heading.
**Naslov članka:** centrirane mixed-case linije ISPOD headinga do prvog kolona-0 retka (višeredne spoji). Stariji zakoni često NEMAJU naslove — vjernost: prazan naslov ostaje prazan (UI v010 pokazuje preview) 🔒.
**Struktura (preskače se + loguje):** `DIO …`, `GLAVA …`, rimske sekcije `I. OPĆE ODREDBE`, podsekcije ` 1. Naziv` — sve centrirano između članaka.
**Razdjelnice novela:** `Prijelazne i završne odredbe iz NN X/YY` — DVA oblika: (A) standalone između članaka (ZNR); (B) na poziciji naslova ISPOD headinga (Požar — novela s 1 člankom). Članci nakon razdjelnice: numeracija kreće ispočetka po noveli (VIŠE razdjelnica moguće — PUG 2, Nezakonito 3!), `naslov` = razdjelnica (± ' — ' vlastiti), oznaka smije kolidirati s osnovnim (id je ključ). ⚠ TOC zna sadržavati razdjelnicu (1-space indent) — guard: ignorira se prije prvog članka.
**KRITIČNI FENOMEN — orphan dedup 🔒:** generator PONAVLJA zadnju liniju prelomljene stranice na vrhu sljedeće (ZoG 19×, Prostorno 35×, ZOO 117×!). Algoritam: po `\f` granicama, ako je zadnja SADRŽAJNA linija str. N == prva str. N+1 → briši PRVU pojavu (nastavak odlomka slijedi drugu). Bez ovoga JSON ima duplikate rečenica u pravnom tekstu.
**SUDSKA PRAKSA filter 🔒:** zakon.hr uz članke (ZOO, ZUP, ZNR, Komunalno) lijepi kolona-0 blok `SUDSKA PRAKSA: Presuda, Presuda, Rješenje…` (link-labeli, može višeredno) — odlomak koji POČINJE tim prefiksom se izbacuje (nije tekst zakona).
**Sitni fixevi:** hyphen na kraju retka (`kulturno-` + `povijesne` → bez razmaka, crtica ostaje) · prelomljeni NN broj `145 /24.` → `145/24.` (regex `(\d) /(\d)` — nema legitimnog izvora).
**Brisani članci:** rupe u numeraciji su LEGITIMNE (novele brišu); zakon.hr zna eksplicirati "Članci od 1030-1038 su brisani". QC: rupa = warning; ali **protuprovjera na sirovom tekstu** — ako heading postoji a nije uhvaćen → HARD greška (parser promašaj; upravo je ovako uhvaćen ZUP čl. 26 i Energetska čl. 10).

## 4. PROFIL B — NN-print (`parse_uzance.py`) — uzance i budući pravilnici (54 kom!)
**Izvor:** Chrome "Save as PDF" NN web stranice (jednostupčano ✔ — nikad službeni NN tiskani PDF, dvostupčani je muka).
**Specifičnosti:** heading = **goli centrirani broj** `^\s{10,}(\d+)\.\s*$`; oznaka se GRADI (`"Uzanca N."` — parametar prefiksa; pravilnici će koristiti "Članak N." 🔓) · naslov je DVOSMJERAN: iznad broja ILI ispod (slog odlučuje) — parser drži buf_iznad + naslov_ispod (mixed-case centrirano dok body ne krene) · CAPS tematske ("UGOVORNA KAZNA") i "DIO N" = struktura-preskok · **PUA čišćenje 🔒**: web-font ikonice U+E000–F8FF kontaminiraju linije (U+E603 je skrivao uzancu 42!) — globalni strip na ulazu · print-smeće filtar ("Moj profil", "Baza je ažurirana…", NN header linija) · **hard-stop** na `^\s*Klasa:` (potpisni blok, "Izvor:", "Copyright ©" — indent 1, upao bi u zadnju uzancu) · prijelom stranice može pasti USRED odlomka: `\f` se briše BEZ umetanja praznog retka (kontinuitet).
**Kalibrirano na:** Posebne uzance o građenju NN 137/21 → 107/107 ✔.

## 5. QC — obavezan, u parseru, exit≠0 blokira isporuku 🔒
Kontinuitet osnovnog dijela (rupe→warning s brisan-protuprovjere §3) · duplikati oznaka unutar osnovnog = greška · dodaci rastući UNUTAR svake razdjelnice · 0 praznih tekstova · dijakritika prisutna (čćšž hard, đ warning) · mojibake/PUA sken izlaza · DB limiti (60/300) · **uzastopni-duplikat test** `(.{40,}?) \1` po odlomku (orphan ostatak; NE globalna fraza-pretraga ⚠ — pravni tekst legitimno ponavlja formule "…eura kaznit će se…" i NN citate) · spot-usporedba 5+ članaka s izvornikom (počeci, krajevi, broj stavaka, kritične brojke — kazne, rokovi, datumi) · **regresija pri svakoj izmjeni parsera**: ZoG mora ostati bit-identičan referentnom JSON-u + hash-diff svih ranije čistih.

## 6. Uvoz u aplikaciju
Sada (v011): hash-skip → identično se NE dira (bookmarki žive) → inače delete-pa-insert. **F4 (upsert-po-oznaci):** mapiranje po `oznaka` unutar dokumenta → isti hash: ništa · različit: zatvori staru verziju (vrijedi_do=danas) + nova verzija + UPDATE clanci + dirty=true · novi: INSERT + prva verzija · nestali: status='brisan' (tekst i reference žive). Redoslijed re-sortira (broj pa slovo za .a). Odgovor s diff brojkama → hrani "što donosi novela".

## 7. Novele — modus operandi (dogovoren)
Novi pročišćeni PDF → repo **UZ stari** (verzionirana imena; repo = trajni arhiv izvornika i pravno pokriće disclaimera) → AI: parsiraj + **diff izvještaj** (dodani/izmijenjeni/brisani s razlikama — Ivan vidi PRIJE uvoza) → JSON (+ šifrarnik vN ako se NN izvor mijenja — UVIJEK PUNI šifrarnik ⚠ ruta briše mapiranja po programu) → uvoz (F4: bookmarki, embeddingi-dirty-only, pitanja s referencom na izmijenjene → review lista).

## 8. Stanje sadržaja + poznata odstupanja izvora
Uvezeno (2026-07-04): ZoG 162 · Prostorno 250 · ZNR 113 · Požar 73 · Drž. inspektorat 146 · Energetska 79 · Građ. inspekcija 79 · Komore 79 · Komunalno 141 · Normizacija 21 · **ZOO 1177** · ZUP 172 · PUG 127 · Nezakonito 77 · **Uzance 107**.
⚠ Šifrarnik-izvori zastarjeli (MPGI popis 1.1.2026): ZOO ima i **NN 69/26**, Nezakonito i **NN 48/26** → ažurirati u šifrarniku v3 pri prvom sljedećem šifrarnik-bumpu. zakon.hr baza ažurna do **NN 47/26** (banner) — dovoljno svježa, ali svaki uvoz nosi datum povlačenja u imenu PDF-a.
**Ne parsira se:** HRN norme (autorski zaštićene, HZN prodaje) — ostaju stavke šifrarnika bez sadržaja 🔒 pravna granica. EU uredbe: EUR-Lex HTML/PDF, poseban mali profil kad dođu 🔓.
**Preostalo GRA:** ~26 zakona (batch 3: zapaljive tekućine, radiološka, neionizirajuće, okoliš, buka, priroda, kulturna dobra; batch 4: tehnička+uža područja — popis u razgovoru/HANDOFF-u), 54 pravilnika + 20 TP (NN-print profil; TP tablice = best-effort tekst ⚠), 5 planova/programa nisko-prioritetno.

## CHANGELOG
- 2.0 (2026-07-04): inicijalno — kompletno znanje parsera iz sesije v009–v012.
