# PRVI PROMPT ZA NOVU SESIJU — Konceptualni razvoj Investitor moda

> Copy-paste donji tekst u novu sesiju. Uz njega priloži svježi ZIP koda (repo je privatan) ILI reci Claudeu da povuče repo kao arhivu.

---

## PROMPT (kopiraj od ovdje)

Nastavljamo **ŽBUKA AI / OI Ispit**. Prvo pročitaj `docs/HANDOFF-2026-07-07.md` pa povuci bibliju s `raw.githubusercontent.com/zbuka-cakaric/oi-gradivo/main/docs/` — **obavezno 00, 01, 10-INVESTITOR.md (v2.0!), 02, 03, 04, 07**. Ako pojedinačni raw ne radi (krivi bajtovi u nazivima), povuci cijeli repo kao arhivu: `curl -sL codeload.github.com/zbuka-cakaric/oi-gradivo/tar.gz/refs/heads/main`.

**Stanje:** produkcija na v128, obračunska sekcija kompletirana (TU+VOB+PN), sve BUILD-GATE čisto, testovi 112/112.

**ZADATAK ove sesije: KONCEPTUALNI RAZVOJ INVESTITOR MODA — idi detaljno.**

Nastavljamo razgovor koji smo prekinuli: razbijanje koncepta Investitora. U 10-INVESTITOR.md v2.0 §0 su moje odluke iz prošle sesije (profesionalci, sve troje u jednom PDF-u, multi-grad od dana 1, WFS+fallback slika, financije djelomično u MVP, **app predlaže masu koju prstom korigiram uz živu zeleno/crveno provjeru**, prvi kod = WFS prikaz čestice). Potvrđen je javni DGU WFS (`api.uredjenazemlja.hr/services/inspire/cp/wfs`) i GBP pravni temelj (Pravilnik čl. 3/4).

**Referentne čestice za širi test:** [OVDJE IVAN UPISUJE 2-3 KONKRETNE kčbr + k.o., ILI kaže Claudeu da predloži po tipu: kutna M1, stambena S unutar bloka, veća K]. Zlatni test ostaje **Hercegovačka 56 (k.č. 2362, k.o. Črnomerec)** — imam stvarne brojke svog projekta (Po+P+1+Uvučeni, 3 stana+6 garaža, breakeven ~5.741 €/m², target 7.000).

**Prije ikakvog koda:**
1. Potvrdi da si pročitao 10-INVESTITOR.md v2.0 i HANDOFF.
2. Nabroji koje 🔒 odluke ovaj rad dira (§0 i §3 tog dokumenta).
3. Predloži plan u 5-7 redaka: kako da razvijemo koncept do razine da SLJEDEĆA sesija samo izvodi kod (bez izmišljanja arhitekture). Fokus prvo na **WFS prikaz čestice** (prvi kodni korak) — što točno treba: endpoint verifikacija, format upita (kčbr+MB k.o.), prikaz na karti (Leaflet + WMS podloga), dohvat susjednih čestica, fallback lanac.
4. TEK ONDA krećemo — korak po korak, kako sam rekao ("idemo redom").

**Pravila (ako dođe do koda):** kirurške izmjene s `⭐ vNNN`, verzija u 3 mjesta, BUILD-GATE (uklj. UI testove 112/112, testovi samo rastu), init-db samo ako dira shemu, sve dirnute fajlove u ZIP. Hrvatski, ti-forma, bez laskanja. Kod pobjeđuje bibliju uz upozorenje; 🔒 se ne krši bez mog odobrenja i CHANGELOG zapisa.

Ovo je zadnji veliki modul aplikacije i moj najambiciozniji — idi temeljito, budi iskren o granicama (kao dosad), i ne uljepšavaj.

## (kraj prompta)

---

## Napomena za Ivana
- Prije slanja: **upiši referentne čestice** u [zagradu] gore, ili obriši rečenicu i pusti Claudea da predloži.
- Ako želiš prvo dovršiti testiranje Mentora/Vještaka i uvoz obračuna prije Investitora — reci to na početku sesije, Claude će prilagoditi redoslijed.
- Mrežni pristup: Claude će možda trebati da mu odobriš domene `api.uredjenazemlja.hr` i `oss.uredjenazemlja.hr` za WFS testiranje (ako radi kroz bash/mrežu).
