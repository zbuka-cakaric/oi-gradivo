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
| **Mentor (F16 usmeni)** | Sokratovska petlja | model NE odgovara — ispituje: pitanje→procjena kandidatova odgovora (rubrika: točnost/potpunost/citat)→potpitanje; ista banka (513 ✓) + isti alati za provjeru kandidatovih tvrdnji |
| **Investitor** | Checklist engine | deterministički: pravila.json (GUP) + parcela-parametri → izračun; AI SAMO obrazlaže i citira odredbe plana — brojke nikad iz LLM-a 🔒 (financijska matematika je sveta) |

## 6. MJERENJE 🔒 (bez ovoga je sve dojam)
Held-out ~100 rok-pitanja (Ivan šalje) = **prije/poslije** mjerilo za §1–2; puštanje BEZ izmjena prvo. Novi eval sloj: 15 višekoračnih pitanja ("pročitaj X pa…", lanci uputa) — mjere agentsku petlju. Ivanova ocjena serije od 10 terenskih pitanja nakon F15.5 (cilj ≥4/5).

## Redoslijed
**F15.5** (§1+§2, 1 sesija) → held-out eval → **F16 Mentor** (nasljeđuje petlju) → §3 verifier → §4 postupno → Investitor engine (F21+).

## CHANGELOG
- 1.0 (2026-07-05): doktrina inteligencije — usvojena kao temelj za F15.5/F16/Investitor.
