# 13 — MODEL RAZMIŠLJANJA (doktrina inteligencije za sva tri moda)

> **Teza:** ista jezgra razmišljanja pokreće Vještaka (savjet), Mentora (usmeni F16) i Investitora (što smijem graditi). Jezgra = **agentska petlja nad propisima + strukturirano pravno rezoniranje + samoprovjera**. Razlikuje se samo "način ispitivanja" po modu.

## 0. Gdje smo (v040) — temelj položen ✓
Retrieval v2 (voyage-law-2 + pg_trgm + FTS → RRF → rerank; **GATE 93 %**) · povijest razgovora (6 poruka) · rječnik kratica · post-check citata regexom + retry · Sonnet 5 odgovor / Sonnet 4.6 planner. **Strop: jednoprolazni tok** (retrieval→odgovor) — model ne može sam potražiti ono što otkrije da mu fali.

## 1. AGENTSKA PETLJA 🔒 (najveći skok — "F15.5 Vještak v2 mozak", 1 sesija)
Modelu dati ALATE i pustiti ga 2–4 kruga PRIJE odgovora (Sonnet 5 je građen za ovo):
- `trazi_propise(upit)` → postojeći retrieval v2 (top 8, kompaktno)
- `procitaj_clanak(dokument, oznaka)` → puni tekst članka + njegov susjed-kontekst
- `clanak_na_dan(dokument, oznaka, datum)` → verzija iz clanci_verzije (F4!)
- (P2) `poveznice(clanak_id)` → članci na koje se ovaj poziva
Pravila: max 4 kruga · svaki tool-rezultat ulazi u kontekst s [n] oznakom · budžet tokena po pitanju · korisniku se streama "🔍 tražim: …" status. **Rješava izravno**: "pročitaj čl. 153 ZOG" (model sam pozove alat!), višekoračna pitanja, upute-dalje lance.

## 2. IRAC REZONIRANJE 🔒 (prompt nadogradnja, ista sesija)
P1 struktura odgovora: **Činjenice → Pravno pitanje → Mjerodavne odredbe (hijerarhija!) → Primjena na situaciju → Zaključak + rizici/iznimke**. Hijerarhijska pravila u promptu: zakon > pravilnik > tehnički propis; lex specialis > generalis; lex posterior; UVIJEK provjeri važenje na datum pitanja (default danas; Vještak "na dan" za sporove).

## 3. SEMANTIČKI VERIFIER (P2 — nadogradnja post-checka)
Drugi, jeftini prolaz (planner model): "Za svaku tvrdnju s [n]: potvrđuje li citirani tekst tvrdnju? Vrati JSON {tvrdnja, utemeljena, razlog}." Neutemeljena → regeneracija tog dijela ili vidljiva ⚠ uz rečenicu. Metrika `citat_preciznost` ide u dashboard (GATE cilj ≥0.95 iz 07 §8 postaje mjerljiv automatski).

## 4. ZNANJE O ZNANJU (P2/P3)
- **Pojmovnik**: tablica `pojmovi` (šema postoji) — definicije (čl. 3 ZoG…) kao nulti retrieval sloj + query-expansion (cilja preostale eval promašaje E031/E032 tipa).
- **Graf poveznica**: parse "iz članka X.", "posebnim propisom (NN …)" referenci pri ingestu → `clanak_ref(izvor, cilj)`; dohvat članka povlači 1-hop reference.
- **Memorija iskustva**: 👍👎 + citat-fail eventi → tjedna revija → zlatna pitanja u eval korpus; najbolji odgovori kasnije kao few-shot primjeri po tipu pitanja.

## 5. ISTA JEZGRA, TRI NAČINA ISPITIVANJA
| Mod | Način | Specifično |
|---|---|---|
| **Vještak** | IRAC savjet | alati §1 + "na dan" + generator dopisa (F17) nad istim citatima |
| **Mentor (F16 usmeni)** | Sokratovska petlja + **ispit od N pitanja (v053)** | model NE odgovara — ispituje: pitanje→procjena (P6)→≤3 potpitanja→**P7A ispravak + ocjena /100**; plan od N pitanja (def 10) fiksiran na startu; **finale DETERMINISTIČKI** = round(prosjek ocjena), prag prolaza 90 🔒 (LLM ne računa ukupnu — kao Investitorove brojke); ista banka (513 ✓) + isti alati; kandidatov odgovor NIKAD u retrieval |
| **Investitor** | Checklist engine | deterministički: pravila.json (GUP) + parcela-parametri → izračun; AI SAMO obrazlaže i citira odredbe plana — brojke nikad iz LLM-a 🔒 (financijska matematika je sveta) |

## 6. MJERENJE 🔒 (bez ovoga je sve dojam)
Held-out ~100 rok-pitanja (Ivan šalje) = **prije/poslije** mjerilo za §1–2; puštanje BEZ izmjena prvo. Novi eval sloj: 15 višekoračnih pitanja ("pročitaj X pa…", lanci uputa) — mjere agentsku petlju. Ivanova ocjena serije od 10 terenskih pitanja nakon F15.5 (cilj ≥4/5).

## Redoslijed
**F15.5** (§1+§2, 1 sesija) → held-out eval → **F16 Mentor** (nasljeđuje petlju) → §3 verifier → §4 postupno → Investitor engine (F21+).

## CHANGELOG
- 1.2 (2026-07-05): **v060 — ljudski faktor u Mentoru**: "ne znam" → hint (jednom) pa zaključi; kod-brana 2+ "ne znam" forsira kraj (ne davi); P7A ispravak poučan (profesorski ton, objasni umjesto prekoravanja). Sokratska petlja sada ima empatiju, ne samo strogост.
- 1.1 (2026-07-05): **F16 v053 — usmeni prerastao u ISPIT od N pitanja.** Po zaključenju svakog pitanja (P6 "kraj" ili ≥3 potpitanja) ide **P7A_ISPRAVAK** (STROGI JSON `{"ocjena":0-100,"ispravak":"…"}`; smije otkriti zlatni jer je TO pitanje zaključeno; fallback ocjena = P6 tocnost). Rez transkripta po pitanju (`rezultati[].do_id` = id poruke ispravka → P6/P7A vide samo poruke aktivnog pitanja). **Finale DETERMINISTIČKI** (§5 doktrina "brojke nikad iz LLM-a" 🔒 sada vrijedi i za Mentora): ukupna = round(prosjek), prolaz = ukupna ≥ prag (ENV `USMENI_PROLAZ` def 90); rubrika `{ocjena,prolaz,prag,po_pitanjima,sazetak,savjet}`. ENV `USMENI_BR_PITANJA` (def 10). P7_RUBRIKA (1-5) ostaje u kodu kao povijest, ne poziva se. 🔒 nepromijenjeni: zlatni ne curi prije zaključenja tog pitanja, P6 procjena ne curi, kandidatov odgovor nikad u retrieval.
- 1.0 (2026-07-05): doktrina inteligencije — usvojena kao temelj za F15.5/F16/Investitor.
