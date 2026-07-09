# OI ISPIT — BIBLIJA PROJEKTA (docs/ index)
**Verzija dokumentacije:** 3.1 · **Datum:** 2026-07-09 · **Stanje koda:** v183 · Faza 18
**Vlasnik:** Ivan Čakarić (ŽBUKA Čakarić d.o.o.) · **Sastavio:** Claude (Fable 5) u suradnji s Ivanom

> **Što je ovo:** jedina istina o aplikaciji OI Ispit (oi-ispit.zbuka.hr) — vizija, arhitektura, svaka tablica, svaka ruta, svaki algoritam, svaka faza do v1.0 i dalje. Piše se za DVA čitatelja: (1) Ivana, koji nije programer ali donosi sve odluke, i (2) AI asistenta (Opus/Sonnet/budući) koji izvodi faze. Ako kod i biblija proturječe — **kod pobjeđuje**, ali se proturječje odmah upisuje u §CHANGELOG dotičnog dokumenta.

## ⭐ NOVO — počni ovdje ako si nov na projektu
**VODIC-ZA-NOVI-RAZGOVOR.md** — potpuno znanje aplikacije u jednom dokumentu (tko je Ivan, što je aplikacija, kako radi, protokoli, što je sljedeće). Pročitaj PRVO ako preuzimaš projekt.

## Mapa dokumenata
| # | Fajl | Sadržaj | Kad ga prilažeš/povlačiš |
|---|---|---|---|
| 00 | `00-BIBLIJA-INDEX.md` | ovaj dokument: mapa + protokol sesija | UVIJEK |
| 01 | `01-VIZIJA-PROIZVOD.md` | proizvod, personas, **feature katalog s tehnologijom po sastavnici**, monetizacija | produkt-odluke, novi featurei |
| 02 | `02-ARHITEKTURA-STACK.md` | stack s razlozima, infrastruktura, ENV katalog, sigurnost, PWA/SW | svaka faza |
| 03 | `03-BAZA-PODATAKA.md` | sve tablice (postojeće+buduće), identiteti 🔒, obrasci, migracije | faze sa shemom |
| 04 | `04-API-KATALOG.md` | sve rute (postojeće+buduće) s payload/response | svaka faza s rutama |
| 05 | `05-FRONTEND.md` | router, ekrani, uzorci koda, Norma design system, UX tokovi | faze s UI-jem |
| 06 | `06-SADRZAJNI-PIPELINE.md` | parseri (8 profila: A, B, D, D2, D-t, E, F, G + predobrada), QC, fenomeni izvornika, uvoz, novele | uvoz gradiva, F4 |
| 07 | `07-AI-RAG.md` | retrieval, promptovi doslovno, usmeni state-machine, eval, troškovi, failure-modes | F5, F6, F15, F16, F17 |
| 08 | `08-FAZE-ROADMAP.md` | F3b→F20 razrada + predlošci prve poruke po fazi | otvaranje svake sesije |
| 11 | `11-MASTER-PLAN.md` | STRATEGIJA iznad svega: teza, 3 stupa, moat, GRA-first etape E1–E6 s "gotovo kad", monetizacija, GTM, metrike | svaka sesija — prvih 5 min |
| 10 | `10-INVESTITOR.md` | ZADNJA faza (F21–F27): kčbr→WFS geometrija→GUP pravila→volumetrija→investicijska studija; brand smjernice | poslije F20 |
| 09 | `09-OPERATIVA-RUNBOOK.md` | deploy ritual, backup, dijagnostika, incidenti, rječnik za Ivana | problemi, održavanje |

**Odnos prema starijim dokumentima:** `OI-AI-Spec.md v1.1` je APSORBIRAN u 07+08 (i djelomično 03) — biblija ga zamjenjuje. `OI-Ispit-Master-Plan.md` i `Vodič izrade` ostaju povijesni kontekst. HANDOFF fajlovi ostaju živi mehanizam predaje TRENUTNOG stanja između sesija (biblija = trajno; HANDOFF = "gdje smo stali jučer").

## Protokol sesije (ritual — ne preskače se)
1. **Jedna faza = jedna sesija.** Nova sesija dobiva: 00 + fazno-relevantne dokumente (tablica gore) + aktualni HANDOFF + aktualni kod (`server.js`, `index.html`, `sw.js`, `test-v007.js`, `manifest.webmanifest`).
2. **Povlačenje bez uploada:** sve u repou `zbuka-cakaric/oi-gradivo/docs/` — AI čita `https://raw.githubusercontent.com/zbuka-cakaric/oi-gradivo/main/docs/<fajl>.md`. Ako Ivan ne priloži, AI je DUŽAN sam povući 00 + relevantne.
3. **Prva poruka** = predložak iz 08 §PREDLOŠCI za tu fazu. AI prvo potvrdi da je pročitao relevantne dokumente, nabroji 🔒 odluke koje faza dira, da plan u 5 redaka — TEK ONDA kod.
4. **Prije prihvata isporuke** Ivan provjerava: BUILD-GATE ispisan ✅ · testovi N/N i N ne pada ✅ · verzija u 3 mjesta ✅ · ⭐ markeri ✅ · init-db da/ne s razlogom ✅ · nijedan 🔒 prekršen ✅ · isporuka u ZIP-u ✅.
5. **Nakon deploya:** git commit + tag `vNNN`; ako je faza dirala shemu → ručni backup PRIJE deploya (09 §BACKUP); ažuriraj HANDOFF; ako je faza promijenila trajnu istinu → ažuriraj relevantni biblija-dokument + njegov §CHANGELOG + upload u repo.
6. **Legenda kroz sve dokumente:** 🔒 nepromjenjivo bez CHANGELOG odluke · 🔓 slobodno evoluira · ⚠ poznata zamka · 💰 trošak.

## Trenutno stanje u jednoj rečenici
PWA v128 živa na oi-ispit.zbuka.hr — tri moda (Mentor/Vještak/Investitor-najava), RAG GATE 93%, banka 1072 pitanja, usmeni AI ispitivač s komisijom i ljudskim osjećajem (v126/v127), kompletna OBRAČUNSKA sekcija (TU+VOB+PN norme). Sljedeći veliki modul: INVESTITOR (konceptualni razvoj — vidi 10-INVESTITOR.md v2.0).

## STATUS PREKRETNICE (2026-07-07, v128)
**Mentor+Vještak zreli, obračunska sekcija kompletirana, Investitor koncept razbijen.**
- Usmeni AI ispitivač: komisija-persone (v100) + LJUDSKI OSJEĆAJ (v126) + ŽIVA INTERAKCIJA s primjerima iz prakse + bonus brzine (v127) — glavni selling point.
- Pismeni: pravi random raspored točnog odgovora (v127 splitmix32 fix).
- Jedinstvena pretraga po 4 polja (v125): Mentor+Vještak+Gradivo.
- **OBRAČUNSKA SEKCIJA GOTOVA:** TU (19 vrsta radova) + VOB (60 DIN normi) + Prosječne norme I-VII+niskogradnja (41 stavka). Sve `obracun`, ekavica→hrvatski, samo pravila obračuna (ne tablice utroška).
- Bug hunt (v128): admin sučelje nakon prijave, incognito, modal uređivanja pitanja.
- **INVESTITOR:** 7 Ivanovih odluka razbijeno (vidi 10-INVESTITOR.md v2.0); DGU WFS potvrđen javan; prvi kod = WFS prikaz čestice. **SLJEDEĆA SESIJA = konceptualni razvoj Investitora** (PRVI-PROMPT-INVESTITOR.md).

## STATUS PREKRETNICE (2026-07-05, v038)
E1 KOMPLETNA: F4 ✓ (verzioniranje+novele) · F5 ✓ (**RAG GATE 93 %** — retrieval v2: vector+trgm+FTS→RRF→rerank, 07 v2.1) · F6 ✓ (**513 ovjerenih pitanja**, revizija 164 po NN 155/25) · F15 ✓ (Vještak SSE chat s citatima). **REBRAND: ŽBUKA AI, tri moda** — vidi 12-BRAND-MODOVI.md. Sljedeće: Okvir sesija (mode-picker+nav+boje) → F7/F16.

## CHANGELOG
- +2026-07-07 (3.0): status prekretnice v128 — Mentor usmeni zreo (ljudski osjećaj+interakcija+brzina), obračunska sekcija kompletirana (TU+VOB+PN), bug hunt, Investitor koncept razbijen (10-INVESTITOR v2.0 + PRVI-PROMPT-INVESTITOR). Novi HANDOFF-2026-07-07.md.
- +2026-07-05: status prekretnice (E1 done, GATE 93%, rebrand ŽBUKA AI, +12-BRAND-MODOVI).
- 2.5 (2026-07-05): 06 → v2.3 (Profil A potvrđen na ZSPC, Profil G EUR-Lex); GRA gradivo dopunjeno (11/788).
- 2.4 (2026-07-05): dodan 11-MASTER-PLAN.md (krovna strategija: GRA-first etape, launch prije jesenskog roka, GTM); smjer pobjeđuje 11, izvedbu 01–10.
- 2.3 (2026-07-05): dodan 10-INVESTITOR.md (treći stup: kčbr→studija; F21–F27 poslije launcha); 01 §2 prošireno na tri stupa; strategija: GRA-first (ostali sektori nakon GRA revolucije).
- 2.2 (2026-07-05): 06 → v2.2 (Profil F: konsolidirani PDF s izmjenama; TP RUETZZ isporučen — 82 čl.).
- 2.1 (2026-07-05): 06 → v2.1 (novi parser-profili D/D2/D-t/E, isporučen batch 9–10: 21 propis / 929 jedinica); stanje koda v016.
- 2.0 (2026-07-04): biblija uspostavljena (10 dokumenata), apsorbira OI-AI-Spec v1.1.

---
## DOPUNA 2026-07-09 · doc v3.1 · stanje koda **v183** · Faza 18
- **Novi dokumenti u mapi:** `OI-DGU-IZVORI-PODATAKA.md` (svi državni/gradski izvori prostornih podataka — ATOM/WFS/WMS, obavezan za Investitor sesije) · `OI-Investitor-MASTER-strategija.md` (F1–F5 strategija) · `HANDOFF-2026-07-09.md` (v129→v183) · `PRVI-PROMPT-F15-ATOM.md`
- **Investitor NIJE više "poslije F20"** — aktivan je treći mod (zeleni), F1 (karta+čestica) isporučen, F1.5 (ATOM ingestion) je SLJEDEĆA sesija. Za Investitor sesije prilažu se: 00 + 10 + OI-DGU-IZVORI-PODATAKA + OI-Investitor-MASTER-strategija + HANDOFF.
- **Testovi:** `test-ui-v043.js` sada 200/200; dodani moduli `dopis-docx.js` i `dopis-pdf.js` idu u svaku isporuku.
- Ovaj indeks vrijedi i dalje; HANDOFF-2026-07-09 je aktualan most.
