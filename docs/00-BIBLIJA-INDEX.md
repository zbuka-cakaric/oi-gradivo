# OI ISPIT — BIBLIJA PROJEKTA (docs/ index)
**Verzija dokumentacije:** 2.1 · **Datum:** 2026-07-05 · **Stanje koda:** v016 · Faza 3
**Vlasnik:** Ivan Čakarić (ŽBUKA Čakarić d.o.o.) · **Sastavio:** Claude (Fable 5) u suradnji s Ivanom

> **Što je ovo:** jedina istina o aplikaciji OI Ispit (oi-ispit.zbuka.hr) — vizija, arhitektura, svaka tablica, svaka ruta, svaki algoritam, svaka faza do v1.0 i dalje. Piše se za DVA čitatelja: (1) Ivana, koji nije programer ali donosi sve odluke, i (2) AI asistenta (Opus/Sonnet/budući) koji izvodi faze. Ako kod i biblija proturječe — **kod pobjeđuje**, ali se proturječje odmah upisuje u §CHANGELOG dotičnog dokumenta.

## Mapa dokumenata
| # | Fajl | Sadržaj | Kad ga prilažeš/povlačiš |
|---|---|---|---|
| 00 | `00-BIBLIJA-INDEX.md` | ovaj dokument: mapa + protokol sesija | UVIJEK |
| 01 | `01-VIZIJA-PROIZVOD.md` | proizvod, personas, **feature katalog s tehnologijom po sastavnici**, monetizacija | produkt-odluke, novi featurei |
| 02 | `02-ARHITEKTURA-STACK.md` | stack s razlozima, infrastruktura, ENV katalog, sigurnost, PWA/SW | svaka faza |
| 03 | `03-BAZA-PODATAKA.md` | sve tablice (postojeće+buduće), identiteti 🔒, obrasci, migracije | faze sa shemom |
| 04 | `04-API-KATALOG.md` | sve rute (postojeće+buduće) s payload/response | svaka faza s rutama |
| 05 | `05-FRONTEND.md` | router, ekrani, uzorci koda, Norma design system, UX tokovi | faze s UI-jem |
| 06 | `06-SADRZAJNI-PIPELINE.md` | parseri (6 profila: A, B, D, D2, D-t, E + predobrada), QC, fenomeni izvornika, uvoz, novele | uvoz gradiva, F4 |
| 07 | `07-AI-RAG.md` | retrieval, promptovi doslovno, usmeni state-machine, eval, troškovi, failure-modes | F5, F6, F15, F16, F17 |
| 08 | `08-FAZE-ROADMAP.md` | F3b→F20 razrada + predlošci prve poruke po fazi | otvaranje svake sesije |
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
PWA v012 živa na oi-ispit.zbuka.hr (auth, gradivo 15+ propisa / ~2.900 članaka, Uči čitač s pretragom i bookmarkima, admin uvoz s progressom i hash-skipom, auto-refresh health-ping); slijedi F3b pa F4 (verzioniranje) pa F5 (RAG) — punim redom u 08.

## CHANGELOG
- 2.1 (2026-07-05): 06 → v2.1 (novi parser-profili D/D2/D-t/E, isporučen batch 9–10: 21 propis / 929 jedinica); stanje koda v016.
- 2.0 (2026-07-04): biblija uspostavljena (10 dokumenata), apsorbira OI-AI-Spec v1.1.
