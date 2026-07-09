# DGU IZVORI PODATAKA — obavještajna karta za Investitor modul
*(v1 · 2026-07-09 · destilirano iz: Jogun (LinkedIn, 2024), catalog.uredjenazemlja.hr, oss.uredjenazemlja.hr, registri.nipp.hr, dgu.gov.hr — sve verificirano)*

## ⭐ PLAN A — ATOM (bez tokena, bez registracije, javno)
Svi ATOM skupovi: **https://geoportal.dgu.hr/services/atom/xml** (popis). Tjedno osvježavanje (DKP). Preuzimanje = ZIP s GML/SHP/GeoTIFF.
⚠ Raspakiranje: 7zip/unzip (default Windows zna zakazati). ⚠ GML je tekstualan/neindeksiran → mi parsiramo u PostgreSQL (naš "GPKG").

### 1) DIGITALNI KATASTARSKI PLAN — po katastarskoj općini 🔑 (F1.5)
- **Index svih k.o.**: https://oss.uredjenazemlja.hr/oss/public/atom/atom_feed.xml → naziv k.o. → poveznica
- **Per-k.o. ZIP**: https://oss.uredjenazemlja.hr/oss/public/atom/ko-{MATIČNI_BROJ}.zip (primjer KO Toranj: ko-327891.zip)
- ZIP putanja `zisapp\atom`, 4 GML-a:
  - **katastarske_cestice.gml** — atributi: BROJ_CESTICE, POVRSINA_GRAFICKA, CESTICA_ID, MATICNI_BROJ_KO ⭐
  - katastarske_opcine.gml — ⚠ LINIJSKI sloj (granica, ne poligon)
  - nacini_uporabe_zemljista.gml — najmanje podataka
  - **nacini_uporabe_zgrada.gml** — katastarske zgrade, detaljna geometrija + način uporabe (kuća/gospodarska/pomoćna) ⭐ za F3 kontekst
- Koordinate: HTRS96/TM **EPSG:3765** (naš konverter spreman)
- Zlatni test: **k.o. Črnomerec, kčbr 2362** (Hercegovačka 56); MBR server vadi iz atom_feed.xml

### 2) ADRESE cijele HR 🔑 (adresa → parcela lookup!)
- https://geoportal.dgu.hr/services/atom/INSPIRE_Addresses_(AD).zip
- Address.gml; ključni atribut **alternativeIdentifier** = "ulica kbr naselje pošta" (npr. "Prosika 23 Betina 22243 Murter")
- ⚠ TTB skupovi su u **ETRS89/LAEA EPSG:3035** (ne 3765!) → treba LAEA→WGS84 konverzija

### 3) UPRAVNE JEDINICE (koji GUP/PPUO vrijedi — F3/F5 routing)
- https://geoportal.dgu.hr/services/atom/INSPIRE_Administrative_Units_(AU).zip
- AdministrativeUnit.gml; slojevi po **LocalisedCharacterString**: Država/Županija/JLS/Naselje/Statistički krug/Popisni krug; naziv u atributu `text`

### 4) VISINE — DMR (teren/nagib parcele)
- https://geoportal.dgu.hr/services/atom/INSPIRE_Elevation_Grid_Coverage_(EL-COV).gml → grid s linkovima na **84 GeoTIFF-a** (npr. RH_ELEV_17.tif)

### 5) Ostalo dostupno (po potrebi)
- Zgrade TTB (ne katastarske): INSPIRE_Building_(BU-CORE2D).zip → Building.gml
- Korištenje zemljišta: INSPIRE_Existing_Land_Use_(ELU).zip → ExistingLandUseObject.gml
- Pokrov: INSPIRE_Land_Cover_Vector_(LCV).zip; Hidrografija: INSPIRE_Hydro_Physical_Waters_(HY-P).zip (10 GML-ova); More: INSPIRE_Sea_Regions_(SR).zip
- Prometnice: INSPIRE_Road_Transport_Network_(TN-RO).zip (RoadArea/RoadLink — pristup parceli), TN-RA/TN-A/TN-C/TN-W
- Podjele na listove (SHP, HTRS96/TM): podjele_na_listove.zip

### Jogunov zaključak (potvrđen)
Geometrija odlična; najbolji skupovi: **katastar, upravne jedinice, adrese, DMR**. Atributi = INSPIRE identifikatori (ne "ljudski"). WFS (autorizirano) = real-time + više atributa.

## ⭐ NOVO od DGU (mail, 2026-07-09): CP servisi su ZA ANONIMNE KORISNIKE!
- WMS (podloga): https://api.uredjenazemlja.hr/services/inspire/cp_wms/wms — anoniman ✅ (v183 klijent koristi ovaj; OSS inspireService/wms traži token — NE koristiti)
- WFS (čestice): https://api.uredjenazemlja.hr/services/inspire/cp/wfs — anoniman ✅ (naš v179+ default, radi BEZ DGU_TOKEN-a)
- **Zgrade iz DKP — WFS**: https://api.uredjenazemlja.hr/services/inspire/bu/wfs — anoniman ✅ (katastarske zgrade real-time; zlato za F3)
- ⚠ api.* gateway BLOKIRA ne-browser klijente (Claude fetcher dobiva 400 na sve, i valjane pozive) — testirati isključivo iz browsera ili s Railwaya (probe ruta)
- Ivanov token 8ea1…dd05: čuvati u Railway ENV (DGU_TOKEN) kao pričuvu — za OSS varijante i buduće registrirane usluge (DOF ortofoto?)

## PLAN B — WFS s tokenom (real-time; paralelno čekamo)
- Endpoint: https://api.uredjenazemlja.hr/services/inspire/cp/wfs (typeNames **cp:CadastralParcel**, bbox bez srs sufiksa, EPSG:3765)
- OSS alternativa: https://oss.uredjenazemlja.hr/OssWebServices/inspireService/wfs
- Token: besplatna registracija OSS (NIAS/e-Građani, "Promjena subjekta" za tvrtku) ILI mail info@dgu.hr; poslano — čekamo
- ENV kad stigne: DGU_TOKEN=... (param 'token', promjenjiv kroz DGU_TOKEN_PARAM); probe: /api/investitor/probe (D_katalog put)
- Uvjeti: novi proizvodi s dodanom vrijednošću OK; zabranjena masovna rekonstrukcija (per-čestica proxy + keš = usklađeni)

## IMPLEMENTACIJSKI PLAN F1.5 (sljedeći razgovor, SHEMA → init-db)
1. Server: preuzmi atom_feed.xml → tablica `ko_opcine(naziv, mbr, url, dohvaceno)` (cijela HR)
2. Na prvi upit za k.o.: povuci ko-{mbr}.zip → raspakiraj (adm-zip ili unzip) → parsiraj katastarske_cestice.gml → tablica `cestice(ko_mbr, kcbr, povrsina, geom_json, azurirano)`
3. Klik/GPS: point-in-polygon nad lokalnom bazom; kčbr: direktan SELECT; tjedno osvježavanje ko-ova u uporabi
4. Zlatni test: Črnomerec → 2362 → poligon + POVRSINA_GRAFICKA na karti
5. (Kasnije) Adrese AD: LAEA 3035 konverter → "Hercegovačka 56" → koordinata → čestica
