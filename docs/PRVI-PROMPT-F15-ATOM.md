# PRVI PROMPT ZA NOVI RAZGOVOR — F1.5 ATOM (kopiraj sve ispod crte)

---

Bok! Nastavljamo ŽBUKA AI (oi-ispit.zbuka.hr). Ova sesija = **F1.5 — ATOM ingestion katastra** (Investitor prelazi s nepouzdanog DGU WFS-a na lokalnu bazu čestica iz ATOM servisa).

**Prvo povuci i pročitaj (raw.githubusercontent.com/zbuka-cakaric/oi-gradivo/main/docs/):**
1. HANDOFF-2026-07-09.md (most — v129→v183, DGU zaključci)
2. 00-BIBLIJA-INDEX.md
3. 10-INVESTITOR.md (§V3 = stanje + §V3.4 = točan recept F1.5)
4. OI-DGU-IZVORI-PODATAKA.md (izvori: ATOM feed, per-k.o. ZIP, GML atributi)
5. 03-BAZA-PODATAKA.md i 04-API-KATALOG.md (dopune 2026-07-09)

**Prilažem aktualni kod (v183):** server.js, index.html, sw.js, test-ui-v043.js, dopis-docx.js, dopis-pdf.js.

**Zadatak F1.5 (SHEMA → na kraju init-db):**
1. Tablice `ko_opcine` + `cestice` (specifikacija u 03-BAZA dopuni)
2. Feed loader: atom_feed.xml → ko_opcine (cijela HR)
3. On-demand ingest k.o.: download ko-{mbr}.zip → unzip → stream-parse katastarske_cestice.gml (NE cijeli u memoriju!) → TM→WGS84 (konverter postoji u server.js) → upsert cestice; ZIP obrisati; tjedni refresh korištenih k.o.
4. `/api/investitor/parcela-tocka` i `/parcela` prebaciti na lokalnu bazu (bbox + point-in-polygon; SELECT po kčbr); WFS ostaje fallback; k.o. bez ingesta → pokreni ingest uz poruku korisniku
5. GeoJSON sloj granica čestica na karti iz vlastite baze (viewport bbox)
6. **Zlatni test: k.o. Črnomerec → kčbr 2362 → Hercegovačka 56 (poligon + površina)**

**Statusne informacije:**
- v183 pushan: [DA/NE] · granice na karti vidljive: [DA/NE] · čestica 2362 preko WFS-a: [RADI/NE RADI — probe ispis: …]
- DGU_TOKEN u Railway ENV: [DA/NE]

Protokoli standardni: hrvatski "ti", kirurški str_replace, verzija ×3, BUILD-GATE (200/200 + novi testovi), ZIP isporuka 6 datoteka, ja pusham. Kreni!
