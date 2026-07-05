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
**Izvor:** Chrome "Save as PDF" NN web stranice (jednostupčano ✔ — za službeni NN tiskani dvostupčani PDF vidi Profil E §4e).
**Specifičnosti:** heading = **goli centrirani broj** `^\s{10,}(\d+)\.\s*$`; oznaka se GRADI (`"Uzanca N."` — parametar prefiksa; pravilnici će koristiti "Članak N." 🔓) · naslov je DVOSMJERAN: iznad broja ILI ispod (slog odlučuje) — parser drži buf_iznad + naslov_ispod (mixed-case centrirano dok body ne krene) · CAPS tematske ("UGOVORNA KAZNA") i "DIO N" = struktura-preskok · **PUA čišćenje 🔒**: web-font ikonice U+E000–F8FF kontaminiraju linije (U+E603 je skrivao uzancu 42!) — globalni strip na ulazu · print-smeće filtar ("Moj profil", "Baza je ažurirana…", NN header linija) · **hard-stop** na `^\s*Klasa:` (potpisni blok, "Izvor:", "Copyright ©" — indent 1, upao bi u zadnju uzancu) · prijelom stranice može pasti USRED odlomka: `\f` se briše BEZ umetanja praznog retka (kontinuitet).
**Kalibrirano na:** Posebne uzance o građenju NN 137/21 → 107/107 ✔.

## 4a. PROFIL D — zakon.hr HTML (`parse_html.py`) — GLAVNI za pravilnike
**Izvor:** zakon.hr stranica → Ctrl+S (cijela stranica, .html). NAJČIŠĆI profil: CSS klase eksplicitno nose strukturu — nema prijeloma stranica, orphan duplikata ni PUA ikonica.
**Klasifikacija:** `class~clanak/Clanak--` = heading · centriranost na 4 načina: `pcenter` klasa, `align="center"`, `style="text-align:center"`, `<center>` tag (stari predlošci!) · centrirano mixed-case = naslov, CAPS/rimski/DIO = struktura · pad broja članka = novela → naslov "Prijelazne i završne odredbe", oznaka ostaje gola (smije kolidirati s osnovnim — konvencija Profila A) · zakon.hr sam upisuje sufikse `(NN 90/22)` u heading izmijenjenih članaka — čuvaju se u oznaci.
**Kalibrirano na:** pravilnici batch 5–10 (rukovanje el. energijom, održavanje cesta, vodopravni akti, okolišna dozvola, uredsko poslovanje… ukupno 25+ propisa).

## 4b. PREDOBRADA `pre_br_split.py` — stari NN/HTML predložak s `<br>`-headinzima
Neki stariji propisi na zakon.hr lijepe strukturu i heading u ISTI blok: `<p align=center>I. OPĆE ODREDBE<br><br>Članak 1.</p>` → Profil D vidi jedan neprepoznatljiv blok (simptom: rupe u numeraciji BAŠ na člancima ispod rimskih glava — autobusna stajališta [1,2,8,19,22]!). Predobrada rascijepa svaki `<p>` na `<br>`-granicama u više `<p>` S ISTIM ATRIBUTIMA, pa se pušta standardni `parse_html.py`. Kalibrirano: Pravilnik o autobusnim stajalištima 22→27/27 ✔.

## 4c. PROFIL D2 — NN web stranica (`parse_nnweb.py`)
**Izvor:** narodne-novine.nn.hr stranica → Ctrl+S. Sadržaj je u `<div class="sl-content">` kao tekst s `<br>` separatorima (`<br>` = granica odlomka, NEMA `<p>` strukture!).
**Specifičnosti:** heading `^Članak N\.$` je vlastita linija, ALI u preambuli zna biti SLIJEPLJEN usred prve linije ("…donosi TEHNIČKI PROPIS… Članak 1. (1) Ovim se…") → regex-split linije na inline heading · CAPS/rimski = struktura · kratka mixed-case linija bez završne interpunkcije prije headinga = naslov · hard-stop `^Klasa:` · **prilozi (PRILOG A/B/C…) ostaju IZVAN** — kod TP-ova je to velik dio sadržaja (tablice/norme) ⚠ evidentirati za buduću odluku.
**Kalibrirano na:** Tehnički propis za sustave zaštite od munje NN 87/08 → 44/44 ✔.

## 4d. PROFIL D-t — točkasti propisi (`parse_tocke.py`)
Tehnički pravilnici strukturirani NUMERIRANIM TOČKAMA umjesto članaka (simptom u Profilu D: "8 članaka" a fajl 333 KB — sav tehnički sadržaj zguran u zadnji članak!). Jedinice: uvodni/prijelazni članci (`class~clanak`) kao u D · **točka razine 1** (klase `TB-PN`/`*fett`, tekst `N. NASLOV`) → oznaka `"Točka N."` · **razine 2** (`*curz`, `N.N. Naslov`) → `"Točka N.N."` · razina ≥3 ostaje naslovna linija UNUTAR teksta · razina-1 točka bez vlastitog teksta = struktura, izbacuje se · numerirana nabrajanja u body-ju (`MsoNormal` "1. razred") NISU točke — klasa je primarni filtar, ne regex! · tablice: `<div class="tablica-wrapper">` zaseban prolaz → blok `"TABLICA: …"` u tekstu (best-effort) · ⚠ NIKAD `<(p|div)>` alternativa u block-regexu — vanjski div proguta stotine `<p>`-ova do prvog `</div>`.
**Kalibrirano na:** Pravilnik o osnovnim uvjetima za javne ceste NN 110/01 → 49 jedinica (8 čl. + 41 točka) ✔.

## 4e. PROFIL E — službeni NN PDF, DVOSTUPČANI slog (`parse_nn2col.py`)
Za propise kojih NEMA na zakon.hr ni kao čist NN-web (vuče se originalni tiskani NN broj — InDesign/Distiller, isječak izdanja: prva stranica zna nositi REP PRETHODNOG dokumenta!). pdfplumber, ne pdftotext.
**Geometrija 🔒:** granica kolona = `page.width/2` (verso/recto ZRCALNE margine — sredina je uvijek u međuprostoru; fiksna granica puca na neparnim stranicama!) · rubovi sloga kalibriraju se GLOBALNO: mode(x0)/mode(x1) po klasi (parnost stranice × strana kolone) — pojedina stranica s tablicama/grafikama VARA rubove · NN header linije crop reže na pola → prošireni regex (i "SRIJEDA," datumske!).
**Odlomci:** prvi redak UVUČEN fiksno ~17pt (13–22pt = novi odlomak), nastavci na rubu; markeri `^\(\d+\)|–|•|[a-z]\)` (⚠ `^\(` bez `\d+` lomi "(TK- pruga)."!) · **sidro:** heading se ne prihvaća dok ne dođe "Članak 1." (isječak izdanja!).
**Naslov članka:** IZNAD "Članak N." · primarni signal = KURZIV (`MinionPro-CnIt` vs body `MinionPro-Cn`; it_ratio≥0.7) · NN slog NEKONZISTENTAN: neki naslovi NISU kurzivni i pune su širine kolone (geometrijski = body redak!) → pre-pass "wide naslov": unatrag od headinga, max 2 retka koji počinju velikim slovom, ne završavaju `.,;:`, a prethodni redak rečenicu ZAVRŠAVA · geometrijska centriranost = SIMETRIČNE margine |L−D|<25 + nije uvlaka (kratki jednoredni uvučeni odlomak "Prilozi od 1. do 3…" lažno izgleda centriran!) · centrirani podnaslovi `a) …` = struktura, ne naslov.
**Crtice na kraju retka 🔒:** spajaju se BEZ crtice; crtica se ČUVA samo ako je zadnja riječ ∈ SLOZENICE whitelist (željezničko, signalno, crveno, žuto… — lista u parseru, proširiva) + iduće malo slovo. Pravilo "završava na o" je PREŠIROKO (upo-zorenja, kolo-sijeka, polo-žajem svi krivi!) — whitelist jedini pouzdan; sve odluke idu u hyphen_log (QC ispis).
**Grafike (slike signala):** "Slika N" natpisi (i višestruki, i "lijevo/desno") + lookahead-filtar 4 linije unatrag za kratke ne-rečenične linije (brojke "90 100" u pločama!) + `(cid:N)` font-smeće + "6OLN" (= 'Slika' u simbolskom fontu) · **fi/fl ligature** izvornika daju razmak ("konfi guracije") → regex fix na ulazu, QC provjerava ostatke · geo-centrirano s znamenkama u body = tablični redak → vlastiti odlomak (tablice brzina/daljina čl. 7/9 sačuvane) · hard-stop `^Klasa:` (prilozi izvan).
**Kalibrirano na:** Pravilnik o signalima NN 94/15 → 97/97, spot-check 18/18 kritičnih brojki ✔.

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
**Isporučeno za uvoz (2026-07-05, batch 9–10):** ceste 8 (održavanje, stajališta, osnovni uvjeti D-t, elaborat, priključci, projekti, razvrstavanje) · željeznice 5 (križanja, promet 177 čl!, pružni pojas, razvrstavanje pruga, signali — Profil E) · batch 10: energetsko certificiranje, vodopravni akti, buka, sanitarne zone, TP prozori, TP munja (D2), okolišna dozvola, PUO, uredsko poslovanje — ukupno 21 propis / 929 jedinica.
**Preostalo GRA:** ~26 zakona (batch 3: zapaljive tekućine, radiološka, neionizirajuće, okoliš, buka, priroda, kulturna dobra; batch 4: tehnička+uža područja — popis u razgovoru/HANDOFF-u), 54 pravilnika + 20 TP (NN-print profil; TP tablice = best-effort tekst ⚠), 5 planova/programa nisko-prioritetno.

## CHANGELOG
- 2.1 (2026-07-05): dodani profili D (zakon.hr HTML — dokumentiran naknadno), predobrada pre_br_split, D2 (NN web sl-content), D-t (točkasti propisi), E (službeni NN dvostupčani PDF — pdfplumber, kurziv-naslovi, globalna kalibracija rubova, whitelist crtica, filtar grafika). §4 referenca na E. §8: isporučen batch 9–10 (21 propis, 929 jedinica).
- 2.0 (2026-07-04): inicijalno — kompletno znanje parsera iz sesije v009–v012.
