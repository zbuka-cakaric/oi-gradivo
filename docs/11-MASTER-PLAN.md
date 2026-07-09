# 11 — MASTER PLAN (strategija · vizija · put do revolucije)

> Krovni dokument IZNAD tehničke biblije. Tehnika se NE duplicira — ovdje je ZAŠTO i KOJIM REDOM; KAKO žive 01–10. Kad se strategija i tehnika sukobe, ovaj dokument pobjeđuje smjer, biblija pobjeđuje izvedbu.

## 1. Teza
Znanje o hrvatskoj graditeljskoj regulativi (125+ propisa po programu) danas je zaključano u glavama rijetkih vještaka, skupim satima odvjetnika i PDF-ovima koje nitko ne čita. Kandidat za stručni ispit se guši, inženjer na gradilištu čeka odgovor danima, investitor ulazi u zemljište slijep. **Mi smo propise pretvorili u strukturiran, citiran i izračunljiv temelj** — i na njemu gradimo tri proizvoda koji pokrivaju cijeli životni ciklus znanja: naučiti → primijeniti → investirati.

## 2. Tri stupa, jedan temelj
| | **PRIPREMA** (instruktor) | **VJEŠTAK** (praksa) | **INVESTITOR** (studija) |
|---|---|---|---|
| Pitanje korisnika | "Kako da položim?" | "Što propis kaže SADA?" | "Što smijem graditi i isplati li se?" |
| Srce | plan+testovi+SRS+**usmeni AI simulator** | AI odgovor s klikabilnim citatima + kalkulatori + dopisi | kčbr→geometrija→GUP pravila→volumetrija→**investicijska studija PDF** |
| Detalji | 01 §4, 07, F6–F13, F16 | 01 §4, 07, F15/F17 | **10-INVESTITOR.md** |
🔒 Temelj je JEDAN: ista baza članaka (verzionirana, "na dan"), isti hibridni retrieval, ista post-provjera citata KODOM, isti račun/tier. Novi stup = novi ekran + kurirane tablice, nikad nova aplikacija.

## 3. Zašto baš mi (moat — nepošteno teško kopirati)
1. **Ivan = domena + evaluator + brojke.** 25+ godina gradilišta, vlastiti razvojni projekt (Hercegovačka 56 = zlatni test engine-a!), stvarne cijene gradnje, dopisi iz stvarnih sporova kao few-shot. Konkurent bez takvog čovjeka trenira na zraku.
2. **Pipeline gradiva (06): 7 parser-profila** za svaki oblik u kojem hrvatski propis postoji (zakon.hr, NN web, NN print, dvostupčani NN PDF, točkasti propisi, konsolidati s izmjenama). To je mjesecima plaćeno znanje — i vječna prednost kod novela.
3. **Citati su svetinja:** svaki AI odgovor post-provjeren KODOM ([n] ∈ poslani izvori), 2× fail → vidljiva traka. Halucinacija = incident, ne "AI stvar".
4. **Kod računa, AI objašnjava** (rokovi.json, gup-pravila.json, troskovi.json) — brojke nikad iz jezičnog modela.
5. **Trošak izgradnje ~0** (AI-built, Railway) → cijene koje etablirani ne mogu pratiti.

## 4. Strategija redoslijeda: GRA-FIRST 🔒 (odluka 2026-07-05)
Sve dokazujemo na GRADITELJSTVU do kraja — tek onda širimo. Razlog: Ivan je živi evaluator SAMO za GRA; pola-gotova četiri sektora = ništa gotovo. Arhitektura je već multi-program (šifrarnik, programi, planEnforce) pa je širenje kasnije čisto sadržajni posao.

### Etape (svaka ima mjerljivo "GOTOVO KAD")
**E1 — TEMELJ ZNANJA** *(sada → ~2–3 tj.)* · GRA gradivo 100 % parsabilnog uvezeno (plan: GRA-plan-gradiva.md — ostalo 13+2!) · **Ivanovih 40 eval-pitanja** · F4 upsert/verzioniranje · F5 vektorizacija. **Gotovo kad: hit@12 ≥ 0.90 na evalu** (GATE — bez ovoga ne postoji proizvod). Ivanova uloga: uploadi + eval pitanja + spot-checkovi.
**E2 — INSTRUKTOR** *(~4–6 tj.)* · F6 generator pitanja → F7–F10 testovi/SRS/plan/spremnost → F13 push. **Gotovo kad: Ivan (koji je ispit POLOŽIO) prođe simulirani ciklus i kaže "ovako bih učio".**
**E3 — VJEŠTAK + NAPLATA** *(~4–6 tj.)* · F14 Stripe → F15 AI asistent (referentna pitanja 07 §7 savršena) → **F16 usmeni simulator = selling #1** (Ivanov potpis na ton!) → F17 praksa mod (dopis iz stvarnog slučaja < 2 min). **Gotovo kad: prvi NEPOZNATI korisnik plati Pro.**
**E4 — LAUNCH v1.0** *(~2 tj.)* · F18 analitika, F19 pravnik/GDPR, F20 backup+meta+tag. **Cilj datuma: v1.0 prije JESENSKOG ISPITNOG ROKA** (sezonalnost je naš plimni val — kandidati kupuju 6–10 tj. prije roka; svaki launch/kampanja se veže uz rokove!).
**E5 — INVESTITOR** *(zima)* · F21–F27 po 10-INVESTITOR.md; zlatni test Hercegovačka; brand odluka (10 §9) na kraju.
**E6 — ŠIRENJE** · sektori redom **ELE → STR → ARH** (dijele najviše gradiva s GRA), po sektoru: gradivo (pipeline!) + 40 eval-pitanja domenskog stručnjaka + rok-kalendar; kod se NE dira · zatim B2B seatovi (identiteti/planEnforce već kompatibilni, 01 §3).

## 5. Monetizacija (tehnika gotova, cijene su Ivanova poluga)
Free: gradivo + 10 test-sesija/mj (usage atomarno) — magnet i evangelizacija studenata · **Pro 19,99 €/mj:** sve + AI (50 poruka/dan soft) + 3 usmene/dan · **Investitor:** zaseban paket (model per-analiza vs. mjesečna — odluka F27 🔓; per-analiza je vjerojatniji fit: investitor dolazi epizodno) · B2B (E6): seatovi + uvid u spremnost tima · Troškovna disciplina 🔒: prompt-caching, Haiku planner, admin alarm > 10 €/dan.

## 6. Go-to-market (GRA)
Kanali redom isplativosti: (1) **sezonske kampanje oko ispitnih rokova** (kalendar rokova = marketinški kalendar); (2) Ivanov kredibilitet + ŽBUKA ekosistem (title-block promocija već 🔒, ai.zbuka.hr stil); (3) grupe/forumi kandidata i graditelja (FB/LinkedIn/Reddit-hr) s BESPLATNIM demo pitanjima i "koliko si spreman?" mini-kvizom (viralna petlja); (4) testimonijali "položio uz app" (tražiti dopuštenje u aplikaciji nakon položenog!); (5) kasnije: komore/fakulteti/revije. NE plaćeni oglasi prije nego organika dokaže poruku.

## 7. Sjeverna zvijezda + metrike po stupu
**Sjeverna zvijezda: broj ispravno citiranih odgovora koji su nekome uštedjeli dan.** · PRIPREMA: % korisnika koji polože (anketa nakon roka), spremnost-krivulja, streak · VJEŠTAK: vrijeme-do-citata < 30 s, tjedni povratak, thumbs-up ≥ 90 % · INVESTITOR: analiza < 5 min, PDF preuzet, konverzija u plaćeno · Sustav: eval hit@12, citat-fail rate < 1 %, trošak/korisnik.

## 8. Principi koji se ne pregovaraju 🔒
Citati post-provjereni kodom · kod-računa-AI-objašnjava · vjernost izvorniku (pipeline QC) · jedan temelj-tri stupa · GRA-first · testovi samo rastu · Ivan odobrava ton (F16) i sve brojke (pravila/troškovi) · točni odgovori pitanja NIKAD klijentu prije predaje · pravne ograde doslovne (07 §6.7, 10 §4).

## 9. Rizici → protumjere
Halucinacija citata → post-check + eval + kill-switch · pravna odgovornost → disclaimeri + F19 pravnik + "nije zamjena za stručnjaka" svugdje · promjene propisa → repo-arhiv izvornika + F4 verzioniranje + diff-izvještaji novela · DGU/geoportal servisi → fallback lanac (10 §3.1) + keš · Ivanovo vrijeme → biblija drži kontekst-trošak nula, sesije = 1 faza · API trošak → §5 disciplina · konkurencija → §3 moat; brzina: launch prije jesenskog roka.

## 10. Odmah sljedeće (ovim redom)
1. **Ivan: 40 eval-pitanja** (format: eval-UPUTE.md + eval-pitanja-PREDLOZAK.jsonl iz v016 ZIP-a) — pitanja KAKVA BI KANDIDAT/INŽENJER STVARNO PITAO, uz oznaku članaka koji su točan odgovor. To je jedini korak koji NITKO osim Ivana ne može.
2. Paralelno: upload GRA fajlova (GRA-plan-gradiva.md) → parsiranje.
3. F4 sesija (upsert+verzioniranje, diff test) → F5 (embeddingi, GATE hit@12).

## STATUS (2026-07-05)
✅ E1 zaključena: F4, F5 (GATE hit@12 **93 %**), F6 (**513 ovjerenih**), F15 (Vještak UI). 🔶 Nova prekretnica: **ŽBUKA AI tri-mod platforma** (12-BRAND) — "Okvir" sesija ulazi u plan prije F7. Held-out eval (~100 rok-pitanja bez odgovora) čeka Ivanov materijal — puštanje BEZ izmjena retrievala 🔒.

## CHANGELOG
- +2026-07-05: status E1 + rebrand prekretnica.
- 1.0 (2026-07-05): inicijalni master plan — teza, tri stupa, moat, GRA-first etape E1–E6 s "gotovo kad", monetizacija, GTM (rokovi=sezonalnost), metrike, principi, rizici.

> ✅ **Provjereno 2026-07-09 (stanje koda v183).**
## DOPUNA 2026-07-09
Strategija nepromijenjena. Napomena: Investitor (treći stup diferencijacije) ušao u aktivnu gradnju paralelno s GRA-first etapama — F1 isporučen, F1.5 ATOM sljedeći. Monetizacijski alati (tierovi, tier_postavke, promo) spremni u kodu.
