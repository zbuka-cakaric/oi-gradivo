# 12 — ŽBUKA AI: brend i tri moda (koncept, čeka Ivanovo 🔒)

> **Teza:** jedna platforma, jedan račun, jedna baza propisa i jedan AI mozak (retrieval v2, GATE 93 %) — a korisniku TRI jasna alata prema životnoj situaciji: *učim za ispit* / *imam situaciju na terenu* / *procjenjujem parcelu*. Modovi dijele infrastrukturu, razlikuju se ulaznim pitanjem, navigacijom i bojom.

## 1. Brend
- **Naziv platforme:** ŽBUKA AI. Proizvodi-modovi: **OI Ispit** · **Vještak** · **Investitor** (radni naziv; TEMELJ iz 10-INVESTITOR ostaje kandidat za samostalni brend — odluka u F27).
- **Logo:** Ivanov (light/dark isporučeni). **Potpis sučelja: kvačica-krović** sa Ž — nosi ga logo, aktivni tab (krović iznad ikone) i mode-picker kartice.
- **✅ ODLUKA (Ivan, 2026-07-05) — boja:** kvačica i "AI" = **SVJETLOPLAVA**, iz ORIGINALNOG loga (sve što je na originalu crveno postaje svjetloplavo; bez vlastitih modifikacija oblika). Privremeni CSS placeholder u v037 (#6FA8DC) zamjenjuje se Ivanovim SVG-om iz repoa.
- **✅ ODLUKA (Ivan, 2026-07-05) — imena i domene:** isti naziv namjerno; **plavi logo = oi.zbuka.hr** (OI platforma; do kraja razvoja ostaje oi-ispit.zbuka.hr, preseljenje na kraju) · **crveni logo = ai.zbuka.hr** (Gradilište SaaS). ŽBUKA AI = krovni brend.
- **Selling point (Ivanova formulacija, u sve marketinške tekstove):** *tehnologija kritičkog razmišljanja* — Mentor (OI Ispit) · Vještak (teren za profesionalce) · Investitor ("informacija vrijedi više nego zemljište").
- **✅ Boje modova — FINALNO (Ivan, 2026-07-05):** Mentor/OI Ispit **PLAVA** `#2B4A75` · Vještak **NARANČASTA** `--vjestak:#D06A1F` · Investitor **TAMNOZELENA** `--investitor:#1E5741`. Norma papir/tinta/serif-sans netaknuti 🔒.
- **Login (v053):** pravi **ŽBUKA AI PNG logo** (dark varijanta = tamnosivi tekst, za svijetli paper login; light varijanta u rezervi za tamnu podlogu) ugrađen inline base64. **Paleta logina = bordeaux brand, neovisno o zadnjem modu**: `main{--accent:var(--brand-bord)}` (`#960C10`) → gumb, linkovi, fokus inputa bordeaux; tekst tamnosivi kao logo. (Gradient-prelijevanje kvačice iz ranije vizije NIJE implementirano — Ivan je odabrao čisti brand-logo; ostaje kao moguća buduća varijanta.)

## 2. Informacijska arhitektura
- **Ulaz:** mode-picker (3 kartice s krovićem) na prvom ulasku; izbor u `localStorage('zb_mod')`. **Header (v053):** inline SVG logo `.zmark` prema Ivanovu originalu — crveni krov s dimnjakom + tamnosivi Z; u appu **krov (`.zkrov`) prati mod preko `var(--accent)`** (plava/narančasta/zelena), Z (`.zslovo`) ostaje tamnosivi `#3A3D42`. Mod-pilula desno (tap = picker). Deep-link `#mod/ispit|vjestak|investitor`.
- **Footeri po modu** (5 tabova MAX pravilo 🔒 vrijedi po modu):
  | Mod | Tabovi | Ekran 1 |
  |---|---|---|
  | OI Ispit | Danas · Testovi · Napredak · Uči · Ja | postojeće, netaknuto |
  | Vještak | Razgovor · Povijest · Propisi · Dopisi · Novosti · **Ja** | **✅ v046** — Ja u svim modovima (Ivanova odluka 2026-07-05); pravilo footera od sada: **5, iznimno 6 uz Ivanov potpis** 🔒 |
  | Investitor | Parcela · Ja *(do F21: najava)* | **✅ najava tab v042**; puni footer Parcela·Analize·Karta·Ja stiže s F21 |
- **Dijeljeno:** Ja (račun, kvota, admin) identičan svugdje; "Propisi" u Vještaku = Uči bez ispitnog konteksta (isti kod, drugi naslov); AI kvota jedna po računu, mjeri sve modove.
- **Tehnika (minimalna invazija):** postojeći hash-router ostaje; `MOD` varijabla filtrira koje tabove nav renderira i koji je sadržaj "prvog" taba; nula promjena API-ja. Procjena: 1 sesija za okvir (picker+nav+boje), 1 za Vještak-mod poliranje.

## 3. Roadmap nadogradnji PO MODU (ideje → prioritet uz Ivana)
**OI ISPIT** (jezgra po 08): F7 testovi · F8 spremnost/SRS · F9 streak+due · F11 dnevni plan · F16 usmeni AI ispitivač (selling #1) · F17 "na dan" čitanje · E5 struke ELE/STR/ARH · kasnije: grupno učenje/leaderboard, mentor-izvještaj tjedni mailom.
**VJEŠTAK:** predlošci upita po ulozi (izvođač/nadzor/investitor/projektant) · **generator dopisa s citatima (F17/P8)** — nacrt prigovora, zahtjeva, očitovanja · povijest po gradilištu (tag razgovora) · **izvoz PDF "stručno mišljenje"** s citatima i disclaimerom · foto situacije → opis (vision, kasnije) · "što donosi novela" push obavijest (F4 diff + F10) · na-dan pravni presjek za sporove.
**INVESTITOR** (10-INVESTITOR F21–27 🔒 vrijedi): kčbr+k.o. → DGU/INSPIRE geometrija → GUP namjena (WMS + ljudska potvrda) → pravila.json → gruba BRP/kig/kis → troskovi.json → feasibility izvještaj (zlatni test = Hercegovačka 56) · nadogradnje: praćenje izmjena planova za spremljene parcele, usporedba 2 parcele, izvoz PDF za banku.
**Monetizacija (prijedlog, Ivan odlučuje 💰):** jedan Pro račun otključava Ispit+Vještak (19,99 €); Investitor = zasebno naplaćen izvještaj (pay-per-report, npr. 9,99 €/parcela ili 5 uključeno u Pro+). Kvote po modu iz ENV-a (v021 temelj već postoji).

## 4. Migracijski koraci (kad Ivan odobri)
1. Ivan: logo SVG/PNG u repo (`static/logo-light.svg`, `logo-dark.svg`) + odluka kvačica/kolizija.
2. vNNN "Okvir": tokeni modova, header s pilulom, mode-picker, nav-po-modu, Ispit netaknut (regresija = svi postojeći testovi).
3. vNNN+1 "Vještak mod": Razgovor kao prvi tab, Povijest ekran, predlošci upita.
4. Investitor tab = najava + waitlist do F21.
5. Biblija: 00/01/05/08/11 changelog + ovaj dokument = izvor istine za brend.

## CHANGELOG
- 1.6 (2026-07-05): **v059 — KONCEPT sučelja pročišćen (Ivan)**: HEADER identičan uvijek = logo (tap=picker) · mod-pilula (aktivni alat) · **avatar (=profil/Ja + Osvježi + Odjava)**. **Ja MAKNUT iz footera** (živio u svakom modu, duplicirao avatar, gurao na 6 tabova/gusto) → footer sada 5 MAX bez gužve: Ispit=Danas·Testovi·Usmeni·Napredak·Uči · Vještak=Razgovor·Povijest·Propisi·Dopisi·Novosti · Investitor=Parcela. Ja dostupan preko avatar→Moj profil. **Tier pilula uklonjena iz headera** (redundantna; tier u profilu). Footer 🔒 = SAMO tabovi moda, nikad profil.
- 1.5 (2026-07-05): **v053 login** — OI badge placeholder zamijenjen pravim ŽBUKA AI PNG logom (dark, inline base64); login paleta → bordeaux brand (`#960C10`) preko `main{}` token-overridea (neovisno o `data-mod`). Boje uzorkovane iz loga: bordeaux `#960C10`, tamnosivi `#373637`.
- 1.4 (2026-07-05): **v053 logo** — CSS-trokut monogram (v052) zamijenjen inline SVG-om vjernim Ivanovu originalu (krov+dimnjak+Z); krov u boji moda (`var(--accent)`), Z tamnosivi. PNG i dalje samo na loginu.
- 1.5 (2026-07-05): v046 — Ja vraćen u footer svih modova (6 tabova u Vještaku, zbijeni raspored); 🔒 pravilo ažurirano na "5, iznimno 6 uz Ivanov potpis". Dizajn proglašen ZAKLJUČENIM za fazu 15.x — daljnje izmjene samo uz novu brend-odluku.
- 1.4 (2026-07-05): **v043** — Vještak footer finaliziran s Dopisi+Novosti; Ja u Vještaku dostupan kroz gornju pilulu (plan-pilula) i uvijek dozvoljen u routeru. Mode-atmosfera: accsoft/accent2 definirani po modu (dosad samo accent). Dizajn v2 sloj dokumentiran u 05 v2.4.
- 1.3 (2026-07-05): **v042 okvir implementiran** — footer po modu iz MOD_TABOVI (bez pod-prikaza; fix zaglavljenog moda v039-v041), krović kao indikator aktivnog taba ✓, Investitor odabirljiv (najava ekran), picker vodi na prvi tab moda instantno. Otvoreno za Ivana: dodatni Vještak tabovi kad zatrebaju (kandidati: Dopisi/F17, Na dan, Novosti-novele) — 5 MAX 🔒.
- 1.2 (2026-07-05): finalne boje modova (plava/narančasta/tamnozelena) + login gradient prelijevanje.
- 1.1 (2026-07-05): **ODOBRENO** — odluke upisane (svjetloplava iz originala; oi.zbuka.hr/ai.zbuka.hr split; selling point). v037 = prvi brend dodir u headeru.
- 1.0 (2026-07-05): inicijalni koncept (mockup: zbuka-ai-mockup.html).

> ✅ **Provjereno 2026-07-09 (stanje koda v183).**
## DOPUNA 2026-07-09
Investitor zeleni (#1E5741) je živ u produkciji (tab + ekran s-inv). Tri moda vidljiva u tab routeru.
