/* ═══ ⭐ v043 — INTERNI USER-TEST (jsdom): simulacija klikanja kroz UI ═══
 * Pokreće PRAVI index.html (inline skripta se izvršava), stubira fetch/alert,
 * pa prolazi tokove koji su pucali u v041 (zaglavljeni mod, naslagani ekrani)
 * + nove v042/v043 ekrane. Pokretanje: node test-ui-v043.js  */
const { JSDOM } = require('jsdom');
const path = require('path');

let T = 0, PAD = 0;
const tocka = (naziv, ok) => { T++; if (!ok) PAD++; console.log((ok ? 'OK ' : 'PAD') + '  ' + naziv); };
const tick = (ms = 25) => new Promise(r => setTimeout(r, ms));

let UM_N = 0; let TS_N = 0; // ⭐ v061
const ODG = (url) => {
  const u = String(url);
  if (u.includes('ai/razgovor/1')) return { ok: true, poruke: [
    { uloga: 'user', tekst: 'Koji je rok za prijavu gradilišta?' },
    { uloga: 'assistant', tekst: '**Zaključak**\nRok je 8 dana [1].', citati: [] }] };
  if (u.includes('ai/razgovori')) return { ok: true, razgovori: [
    { id: 1, naslov: 'Rok za prijavu gradilišta', created_at: '2026-07-01T10:00:00.000Z', poruka: 4 }] };
  if (u.includes('ai/potrosnja')) return { ok: true, postotak: 12, potroseno_usd: 0.1234, budzet_usd: 1, tier: 'free', neogranicen: false, tokeni_total: 1000000, tokeni_iskoristeno: 120000 };
  if (u.includes('novosti')) return { ok: true, novosti: [
    { dokument: 'Zakon o gradnji', dokument_id: 1, vrijedi_od: '2026-01-01T00:00:00.000Z', nn_izvor: 'NN 155/25', clanaka: 47 }] };
  if (u.includes('uci/struktura')) return { ok: true, sekcije: [] };
  if (u.includes('test/start')) return { ok: true, sesija_id: 77, // ⭐ v061 — F7 pismeni
    pitanje: { id: 501, tip: 'abc', pitanje: 'Tko izdaje građevinsku dozvolu?', opcije: ['A) HZZO', 'B) Upravno tijelo', 'C) HGK', 'D) MUP'] },
    pitanje_br: 1, ukupno: 2 };
  if (u.includes('test/odgovori')) { TS_N++;
    if (TS_N === 1) return { ok: true, tocan: false, tocno: 'Upravno tijelo', obrazlozenje: 'Dozvolu izdaje upravno tijelo (Članak 99.).',
      pitanje: { id: 502, tip: 'abc', pitanje: 'Drugo pitanje?', opcije: ['A) a', 'B) b', 'C) c', 'D) d'] }, pitanje_br: 2, ukupno: 2 };
    return { ok: true, tocan: true, tocno: 'b', obrazlozenje: 'Točno (Članak 1.).', gotovo: true,
      rezultat: { ocjena: 50, prolaz: false, prag: 80, tocnih: 1, ukupno: 2 } }; }
  if (u.includes('srs/status')) return { ok: true, dospjelo: 3, ukupno: 5 }; // ⭐ v062
  if (u.includes('srs/start')) return { ok: true, sesija_id: 88,
    pitanje: { id: 601, tip: 'abc', pitanje: 'Ponovljeno pitanje?', opcije: ['A) a', 'B) b', 'C) c', 'D) d'] }, pitanje_br: 1, ukupno: 1 };
  if (u.includes('test/napredak')) return { ok: true, broj: 2, prosjek: 75, najbolja: 100,
    sesije: [ { ocjena: 50, prolaz: false, created_at: '2026-07-01' }, { ocjena: 100, prolaz: true, created_at: '2026-07-05' } ] };
  if (u.includes('usmeni/povijest/')) return { ok: true, id: 7, ocjena: 85, prolaz: true, zavrsena_at: '2026-07-05T10:00:00Z',
    rubrika: { savjet: 'Ponovi članke o nadzoru.' }, pitanja: [ { br: 1, pitanje: 'Tko vodi dnevnik?', ocjena: 90 }, { br: 2, pitanje: 'Tko potpisuje?', ocjena: 80 } ] };
  if (u.includes('usmeni/povijest')) return { ok: true, broj: 2, prosjek: 78, najbolja: 85, polozeno: 1, prag: 80,
    sesije: [ { id: 6, ocjena: 71, prolaz: false, broj_pitanja: 2, zavrsena_at: '2026-07-01T10:00:00Z' }, { id: 7, ocjena: 85, prolaz: true, broj_pitanja: 2, zavrsena_at: '2026-07-05T10:00:00Z' } ] };
  if (u.includes('usmeni/start')) return { ok: true, sesija_id: 9, tekst: 'Na gradilištu nadzor traži dnevnik. Tko ga potpisuje?', pitanje_br: 1, ukupno: 2,
    clan: { ime: 'ing. Horvat', inicijal: 'H', podrucje: 'organizacija i tehnologija građenja' } }; // ⭐ v069 — član komisije
  if (u.includes('usmeni/odgovori')) { UM_N++; // ⭐ v053 — potpitanje -> ispravak+uvod2 -> finale
    if (UM_N === 1) return { ok: true, tekst: 'A tko ovjerava upise?' };
    if (UM_N === 2) return { ok: true, ispravak: { ocjena: 72, tekst: 'Nedostajala je ovjera nadzornog inženjera.' },
      tekst: 'Drugo pitanje: kada je potrebna uporabna dozvola?', pitanje_br: 2, ukupno: 2 };
    return { ok: true, gotovo: true, ispravak: { ocjena: 96, tekst: 'Sve ključne točke pokrivene.' },
      tekst: 'Usmeni ispit je zaključen — ukupna ocjena 72/100 (prag 80).',
      rubrika: { ocjena: 72, prolaz: false, prag: 80, po_pitanjima: [{ br: 1, ocjena: 60 }, { br: 2, ocjena: 84 }],
        sazetak: 'Ispit od 2 pitanja — prosjek 84/100.', savjet: 'Najslabije: pitanje 1 (72/100).' } }; }
  if (u.includes('clanak/55')) return { ok: true, clanak: { id: 55, oznaka: 'Članak 27.', naslov: 'Revident',
    tekst: 'Revident je fizička osoba…', dokument_naziv: 'Zakon o gradnji', dokument_izvor: 'NN 155/25',
    bookmark: false, prev_id: null, next_id: null } };
  return { ok: true };
};

(async () => {
  const dom = await JSDOM.fromFile(path.join(__dirname, 'index.html'), {
    runScripts: 'dangerously',
    url: 'https://oi-ispit.zbuka.hr/',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.fetch = (url) => Promise.resolve({ ok: true, status: 200, json: async () => ODG(url), text: async () => '' });
      w.alert = () => {}; w.confirm = () => true; w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = () => {};
    }
  });
  const w = dom.window, d = w.document;
  await tick(60); // boot IIFE

  const aktivni = () => [...d.querySelectorAll('.tab.active')].map(e => e.id);
  const navTabs = () => [...d.querySelectorAll('#nav > button[data-tab]')].map(b => b.dataset.tab);
  const navAkt  = () => [...d.querySelectorAll('#nav > button[data-tab].active')].map(b => b.dataset.tab);

  // 0) boot bez tokena -> login ekran, app skriven
  tocka('UI boot: login vidljiv, app skriven', !d.body.classList.contains('u-appu'));
  tocka('UI v058: HTML struktura — svih 12 tabova UNUTAR .sadrzaj (ne ispadaju u #app), footer ostaje 3. grid dijete', // ⭐ v058 — dupli </div></section> je rušio grid pa je footer nestajao
    (()=>{ const app=d.getElementById('app');
      const direktna=[...app.children].map(c=>c.tagName.toLowerCase()+'.'+(c.className||c.id||''));
      const tabovaUSadrzaj=d.querySelector('.sadrzaj').querySelectorAll('.tab').length;
      const tabovaUApp=[...app.children].filter(c=>c.classList&&c.classList.contains('tab')).length;
      return tabovaUSadrzaj===12 && tabovaUApp===0 && d.getElementById('nav').parentElement.id==='app'; })());
  tocka('UI v056: prikazi(login) čisti u-appu (nav se ne probija preko logina)', // ⭐ v056
    (()=>{ d.body.classList.add('u-appu'); w.prikazi('s-prijava');
      const ok=!d.body.classList.contains('u-appu') && w.getComputedStyle(d.getElementById('app')).display==='none';
      return ok; })());
  tocka('UI v053: login logo = ŽBUKA AI (brand-logo img), bez OI badgea', // ⭐ v053
    !!d.querySelector('main .mark img.brand-logo') && !d.querySelector('main .mark .badge'));
  tocka('UI v053: login gumb bordeaux (main{} override na brand-bord)', // ⭐ v053 — token, ne inline
    (()=>{ const css=[...d.querySelectorAll('style')].map(s=>s.textContent).join('');
      return /main\{[^}]*--accent:var\(--brand-bord\)/.test(css) && css.indexOf('--brand-bord:#960C10')>=0; })());

  // 1) ulaz u app (Mentor default) — tour testiramo zasebno
  w.localStorage.setItem('oi_tour_done','1');
  w.localStorage.removeItem('zb_mod'); // ⭐ v058 — simulira prvi ulazak (bez izabranog moda)
  w.udjiUApp({ id: 1, ime: 'Ivan', email: 'i@z.hr', korisnicko_ime: 'ivan', tier: 'free',
    program_id: 1, program_naziv: 'Građevinarstvo', cilj_datum: '2026-10-01', je_superadmin: false });
  await tick();
  tocka('UI v058: prvi ulazak bez izabranog moda → OI Ispit (Mentor), NE Vještak', // ⭐ v058
    w.localStorage.getItem('zb_mod')==='ispit' && w.trenutniMod()==='ispit');
  tocka('UI v058 Mentor: 5 tabova u footeru (bez Ja — Ja je u avataru), aktivan Danas, TOČNO 1 sekcija',
    navTabs().join()==='danas,testovi,usmeni,napredak,uci' && aktivni().join()==='t-danas' && navAkt().join()==='danas');

  // 2) v041 REGRESIJA: šaltanje modova naprijed-natrag (bug: zaglavio na Vještaku)
  w.postaviMod('vjestak'); await tick();
  const vjOk = d.body.dataset.mod==='vjestak' && aktivni().join()==='t-razgovor'
    && navTabs().join()==='razgovor,povijest,uci,dopisi,novosti'
    && d.getElementById('mod-pil').textContent==='VJEŠTAK';
  w.postaviMod('ispit'); await tick();
  const natragOk = d.body.dataset.mod==='ispit' && aktivni().join()==='t-danas'
    && navTabs().join()==='danas,testovi,usmeni,napredak,uci';
  tocka('UI mod round-trip: ispit→vještak→ispit radi, footer se pregrađuje', vjOk && natragOk);

  // ⭐ v068 — OI oznaka u headeru koristi var(--accent) pa prati boju moda (provjera u CSS izvoru)
  tocka('UI v068: header .oi-mark postoji i CSS ga veže na var(--accent)',
    !!d.querySelector('.oi-mark') && /\.oi-mark\{[^}]*var\(--accent\)/.test(d.querySelector('style').textContent.replace(/\s+/g,'')));
  // ⭐ v068 — Vještak balon: red + avatar + ime "Vještak"
  w.postaviMod('vjestak'); await tick();
  if(w.aiDodajUser) w.aiDodajUser('test pitanje');
  const uRed=d.querySelector('#ai-poruke .ai-red.ja');
  tocka('UI v068: Vještak korisnički balon = red s avatarom (TI) desno',
    !!uRed && !!uRed.querySelector('.ai-av.ja') && uRed.querySelector('.ai-av').textContent==='TI'
    && !!uRed.querySelector('.ai-u'));
  const asN=w.aiDodajAsistent && w.aiDodajAsistent();
  const bRed=d.querySelector('#ai-poruke .ai-red:not(.ja)');
  tocka('UI v068: Vještak asistent balon = red s avatarom (V) + ime "Vještak" + kuca indikator',
    !!bRed && bRed.querySelector('.ai-av').textContent==='V'
    && bRed.querySelector('.ai-ime').textContent==='Vještak'
    && !!bRed.querySelector('.tipka'));

  // 3) v042 REGRESIJA: Ja se otvara SAM (bez naslaganih ekrana), u svakom modu
  w.postaviMod('vjestak'); await tick();
  w.idiNaTab('ja'); await tick();
  const jaVj = aktivni().join()==='t-ja';
  w.postaviMod('investitor'); await tick();
  w.idiNaTab('ja'); await tick();
  const jaInv = aktivni().join()==='t-ja';
  tocka('UI Ja: sam na ekranu u Vještaku (pilula) i Investitoru', jaVj && jaInv);
  tocka('UI Ja: potrošnja u marketinškim tokenima (v161)', d.getElementById('ja-ai-usd').textContent==='120K / 1M tokena');

  // 4) Investitor: najava tab, 2 gumba
  w.idiNaTab('invest'); await tick();
  tocka('UI v058 Investitor: najava aktivna, footer samo Parcela (bez Ja)', aktivni().join()==='t-invest' && navTabs().join()==='invest');

  // 5) Vještak ekrani: Povijest / Dopisi / Novosti
  w.postaviMod('vjestak'); await tick();
  w.idiNaTab('povijest'); await tick(60);
  tocka('UI Povijest: razgovor izlistan s datumom i brojem pitanja',
    aktivni().join()==='t-povijest' && d.getElementById('pov-lista').textContent.includes('Rok za prijavu gradilišta')
    && d.getElementById('pov-lista').textContent.includes('2 pitanja'));
  d.querySelector('#pov-lista button').click(); await tick(60);
  tocka('UI Povijest→Razgovor: tap otvara razgovor, naslov u zaglavlju, MD renderiran',
    aktivni().join()==='t-razgovor' && d.getElementById('rz-akt').textContent.startsWith('KOJI JE ROK')
    && d.querySelector('#ai-poruke .ai-b .tx').innerHTML.includes('<b>Zaključak</b>'));
  w.idiNaTab('dopisi'); await tick();
  tocka('UI Dopisi: 6 predložaka', aktivni().join()==='t-dopisi' && d.querySelectorAll('#dop-lista .dop-k').length===6);
  d.querySelector('#dop-lista .dop-k').click(); await tick();
  tocka('UI v078: klik na dopis otvara formu (F17)', d.querySelectorAll('#dop-lista .dop-in').length>0);
  // popuni jedno polje pa sastavi -> ide u razgovor s dokument-registrom
  const dopIn=d.querySelector('#dop-lista .dop-in'); if(dopIn){ dopIn.value='ŽBUKA Čakarić d.o.o.'; }
  d.querySelector('#dop-lista .btn').click(); await tick(320);
  tocka('UI v078: Sastavi šalje dopis u razgovor (dokument-registar)', aktivni().join()==='t-razgovor');
  d.getElementById('ai-input').value='';
  w.idiNaTab('novosti'); await tick(60);
  tocka('UI Novosti: novela izlistana (NN, broj članaka)', aktivni().join()==='t-novosti'
    && d.getElementById('nov-lista').textContent.includes('Zakon o gradnji')
    && d.getElementById('nov-lista').textContent.includes('NN 155/25')
    && d.getElementById('nov-lista').textContent.includes('47'));

  // 6) otvoriVjestak s prefill-om iz Mentora (čitač tok)
  w.postaviMod('ispit'); await tick();
  w.otvoriVjestak('Objasni mi Članak 131.'); await tick();
  tocka('UI otvoriVjestak: mod skače, Razgovor aktivan, prefill sjeda',
    d.body.dataset.mod==='vjestak' && aktivni().join()==='t-razgovor'
    && d.getElementById('ai-input').value==='Objasni mi Članak 131.');

  // 6b) ⭐ v044 — poliranje: btn-sek, nlab centriranje, prazno stanje, logo
  tocka('UI v044: Skraćeno/Primjer su btn-sek (vidljivi na bijelom)',
    d.getElementById('pom-b-skraceno').className==='btn-sek' && d.getElementById('pom-b-primjer').className==='btn-sek');
  tocka('UI v044: nazivi tabova u vlastitom centriranom retku (.nlab)',
    [...d.querySelectorAll('#nav > button[data-tab]')].every(b=>b.querySelector('.nlab')));
  w.postaviMod('vjestak'); await tick();
  w.aiNovi(); w.idiNaTab('razgovor'); await tick();
  const przVidljiv = d.getElementById('rz-prazno').style.display!=='none';
  d.querySelector('#rz-prazno .pill').click();
  const primjerOk = d.getElementById('ai-input').value==='Rok prijave gradilišta?';
  w.aiDodajUser('Pitanje s terena');
  tocka('UI v044: prazno stanje s primjerima, nestaje na prvu poruku',
    przVidljiv && primjerOk && d.getElementById('rz-prazno').style.display==='none');
  tocka('UI v044/v052: header logo kompaktan (monogram)', !!d.querySelector('.vrh .zmark'));

  // 6c) ⭐ v045 — citat vodi RAVNO na članak (fix race), avatar izbornik
  w.postaviMod('vjestak'); await tick();
  w.aiOtvoriCitat(55); await tick(90);
  tocka('UI v045: citat -> Propisi s OTVORENIM člankom (ne lista)',
    aktivni().join()==='t-uci' && d.getElementById('u-clanak').style.display!=='none'
    && d.getElementById('u-lista').style.display==='none'
    && d.getElementById('uc-meta').textContent.includes('Zakon o gradnji'));
  d.getElementById('av-btn').click(); await tick();
  const menOtv = d.getElementById('av-menu').classList.contains('on');
  const stavke = [...d.querySelectorAll('#av-menu button')].map(b=>b.textContent);
  d.body.click(); await tick();
  tocka('UI v045: avatar izbornik — otvara se, ima 4 stavke, zatvara se klikom vani',
    menOtv && stavke.length===4 && stavke.some(x=>x.includes('Odjava')) && !d.getElementById('av-menu').classList.contains('on'));
  tocka('UI v045: avatar pokazuje inicijal', d.getElementById('av-btn').textContent==='I');

  // 6d) ⭐ v046 — Ja u footeru svih modova, Nastavi, Novosti točkica, tour, Pro kartica
  w.localStorage.removeItem('oi_nov_vidjeno'); // raniji test je već 'vidio' novosti
  w.postaviMod('vjestak'); await tick(80);
  tocka('UI v058: Vještak footer 5 tabova bez Ja (ne gusto)',
    navTabs().length===5 && !navTabs().includes('ja') && !d.getElementById('nav').classList.contains('gusto'));
  tocka('UI v046: Novosti točkica dok ima neviđenih novela',
    !!d.querySelector('#nav button[data-tab="novosti"] .dot'));
  w.idiNaTab('novosti'); await tick(60);
  tocka('UI v046: otvaranje Novosti gasi točkicu i pamti viđeno',
    !d.querySelector('#nav button[data-tab="novosti"] .dot') && w.localStorage.getItem('oi_nov_vidjeno')==='2026-01-01');
  w.localStorage.setItem('oi_zadnji_clanak', JSON.stringify({id:55,oznaka:'Članak 27.',naslov:'Revident',dok:'Zakon o gradnji'}));
  w.postaviMod('ispit'); await tick();
  const nastVidljiv = d.getElementById('d-nastavi').style.display!=='none'
    && d.getElementById('d-nastavi-t').textContent.includes('Revident');
  w.nastaviSkok(); await tick(90);
  tocka('UI v046: Nastavi gdje si stao — kartica na Danas, tap otvara članak',
    nastVidljiv && aktivni().join()==='t-uci' && d.getElementById('u-clanak').style.display!=='none');
  tocka('UI v046: čitač progres skriven bez konteksta dokumenta (skok)',
    d.getElementById('uc-prog').style.display==='none');
  w.otvoriTour(); await tick();
  const tourOtv = d.getElementById('tour').classList.contains('on') && d.getElementById('tour-br').textContent==='1 / 3';
  w.tourDalje(); w.tourDalje(); w.tourDalje(); await tick();
  tocka('UI v046: tour — 3 koraka, Kreni zatvara i pamti',
    tourOtv && !d.getElementById('tour').classList.contains('on') && w.localStorage.getItem('oi_tour_done')==='1');
  w.idiNaTab('ja'); await tick();
  tocka('UI v046: Ja — Pretplata kartica za besplatni plan', d.getElementById('ja-pro-k').style.display!=='none');
  tocka('UI v046: rastuća kućica — rzRast postoji i vezana na input',
    typeof w.rzRast==='function' && d.getElementById('ai-input').getAttribute('oninput')==='rzRast(this)');

  // 6e) ⭐ v047 — F16 usmeni tok (⭐ v053 — ispit od N pitanja: ispravak /100 + finale s pragom)
  w.postaviMod('ispit'); await tick();
  w.idiNaTab('testovi'); await tick();
  const umKart = d.querySelector('#t-testovi .staza[onclick="idiNaTab(\'usmeni\')"]'); // ⭐ v082 — staza vodi na uvod
  w.umStart(); await tick(80);
  tocka('UI v047/v082: usmeni — staza u Testovima vodi na uvod, umStart otvara vježbu',
    !!umKart && aktivni().join()==='t-usmeni' && d.querySelector('#um-poruke .ai-b .tx').textContent.includes('dnevnik'));
  tocka('UI v082: Danas promo kartica vodi na usmeni tab (idiNaTab), Pro promo',
    d.getElementById('d-ai-kartica').getAttribute('onclick')==="idiNaTab('usmeni')"
    && d.getElementById('d-ai-kartica').textContent.includes('USMENI'));
  tocka('UI v082: usmeni uvodni ekran postoji (Započni gumb + info)',
    !!d.getElementById('um-uvod') && !!d.getElementById('um-uvod-btn') && typeof w.usmeniTab==='function');
  tocka('UI v083: trajno brisanje — modal, 2 koraka, potvrda-input, funkcije',
    !!d.getElementById('del-overlay') && !!d.getElementById('del-korak1') && !!d.getElementById('del-korak2')
    && !!d.getElementById('del-potvrda') && typeof w.brisiRacunKorak==='function' && typeof w.brisiRacunPotvrdi==='function');
  w.KORISNIK={ ime:'Test Korisnik', email:'t@t.hr' };
  w.brisiRacunKorak(1);
  const delK1 = d.getElementById('del-overlay').classList.contains('on') && d.getElementById('del-korak2').style.display==='none';
  w.brisiRacunKorak(2);
  const delK2 = d.getElementById('del-korak2').style.display!=='none' && d.getElementById('del-korak1').style.display==='none';
  w.brisiZatvori();
  const delZat = !d.getElementById('del-overlay').classList.contains('on');
  tocka('UI v083: modal koraci rade (1->2->zatvori)', delK1 && delK2 && delZat);
  w.postaviMod('ispit');
  tocka('UI v084: desktop sidebar — brand (mod-picker) + noga (profil/osvježi/odjava) injektirani, glavni tabovi netaknuti',
    d.querySelectorAll('#nav .side-brand').length===1 && d.querySelectorAll('#nav .side-noga').length===1
    && [...d.querySelectorAll('#nav > button[data-tab]')].map(b=>b.dataset.tab).join(',')==='danas,testovi,usmeni,napredak,uci');
  w.navRender('vjestak'); w.navRender('ispit');
  tocka('UI v084: navRender ne duplicira sidebar (brand/noga ostaju 1/1)',
    d.querySelectorAll('#nav .side-brand').length===1 && d.querySelectorAll('#nav .side-noga').length===1);
  tocka('UI v084: desktop naslov element (#sdn) postoji za sticky naslov taba',
    !!d.getElementById('sdn') && !!d.getElementById('pv-naslov-d'));
  tocka('UI v089: DOCX izvoz — aiWord funkcija postoji za Word gumb u dopisima',
    typeof w.aiWord==='function');
  tocka('UI v091: spinner overlay — spinPokazi/spinSakrij funkcije + #spin-overlay element',
    typeof w.spinPokazi==='function' && typeof w.spinSakrij==='function' && !!d.getElementById('spin-overlay'));
  tocka('UI v092: umIzadi funkcija postoji (prekida govor pri izlasku iz usmenog)',
    typeof w.umIzadi==='function');
  tocka('UI v093: ttsStop funkcija postoji (prekida Google TTS audio + browser)',
    typeof w.ttsStop==='function');
  tocka('UI v095: tier uređivač funkcije (tierUredi/tierPick/tierSpremi) za dodjelu pretplate',
    typeof w.tierUredi==='function' && typeof w.tierPick==='function' && typeof w.tierSpremi==='function');
  tocka('UI v070: Nastavi-gdje-si-stao kartica ima lijevi rub (vidljivost u dark modu)',
    /border-left/.test(d.getElementById('d-nastavi').getAttribute('style')));
  tocka('UI v073: Novosti render podržava čitljivi sažetak (n.sazetak)',
    require('fs').readFileSync(path.join(__dirname,'index.html'),'utf8').includes('n.sazetak'));
  tocka('UI v074/v078: Dopisi sastavljaju s eksplicitnim dokument-registrom',
    require('fs').readFileSync(path.join(__dirname,'index.html'),'utf8').includes("otvoriVjestak(poruka,'dokument')"));
  tocka('UI v076: citat-traka ima eksplicitnu boju teksta (dark mode čitljivost)',
    /id="ai-traka"[^>]*color:var\(--warn\)/.test(require('fs').readFileSync(path.join(__dirname,'index.html'),'utf8')));
  tocka('UI v077: F9+F10 spremnost — kontejner predmeta + dinamički plan + funkcija',
    !!d.getElementById('d-predmeti') && !!d.getElementById('d-plan-naslov') && !!d.getElementById('d-plan-cta')
    && typeof w.ucitajSpremnost==='function');
  tocka('UI v081: F19 registracija — tip osobe segment + uvjeti checkbox + funkcija regTip',
    d.querySelectorAll('#r-tip .seg-b').length===2 && !!d.getElementById('r-uvjeti') && typeof w.regTip==='function');
  tocka('UI v081: F19 naplatni podaci u profilu (OIB/adresa/tip)',
    !!d.getElementById('np-oib') && !!d.getElementById('np-adresa') && !!d.getElementById('np-naziv')
    && typeof w.naplataSpremi==='function');
  tocka('UI v081: F19 pravni sadržaj (uvjeti/privatnost/impressum) + otvoriPravno',
    typeof w.otvoriPravno==='function' && !!d.getElementById('pravno-tekst'));
  tocka('UI v081: mode-picker redizajn — svaka kartica ima ikonu i strelicu',
    d.querySelectorAll('#mod-overlay .mod-k .mod-ic').length===3 && d.querySelectorAll('#mod-overlay .mod-k .mod-str').length===3);
  tocka('UI v069: komisija — avatar nosi inicijal člana (H), ime iznad = ime · područje',
    d.querySelector('#um-poruke .ai-red:not(.ja) .ai-av').textContent==='H'
    && d.querySelector('#um-poruke .ai-red:not(.ja) .ai-ime').textContent.includes('ing. Horvat')
    && d.querySelector('#um-poruke .ai-red:not(.ja) .ai-ime').textContent.includes('organizacija'));
  tocka('UI v069: glas kontrole postoje (mic gumb + tempo toggle) i graceful bez Web Speech',
    !!d.getElementById('um-mic') && !!d.getElementById('um-tempo') && !!d.getElementById('um-tts')
    && typeof w.umCitaj==='function' && typeof w.umMic==='function');
  tocka('UI v053: napredak u naslovu (PITANJE 1 / 2) + reload-guard uključen',
    d.getElementById('um-st').textContent==='PITANJE 1 / 2' && w.OI_BLOK_RELOAD===true);
  d.getElementById('um-input').value='Inženjer gradilišta.'; w.umPosalji(); await tick(80);
  tocka('UI v047: potpitanje stiže kao ispitivač', d.getElementById('um-poruke').textContent.includes('ovjerava upise'));
  d.getElementById('um-input').value='Nadzorni inženjer.'; w.umPosalji(); await tick(80);
  tocka('UI v053: ispravak kartica (72/100) + uvod sljedećeg + napredak 2 / 2',
    d.getElementById('um-poruke').textContent.includes('ISPRAVAK — OCJENA 72/100')
    && d.getElementById('um-poruke').textContent.includes('uporabna dozvola')
    && d.getElementById('um-st').textContent==='PITANJE 2 / 2');
  d.getElementById('um-input').value='Nakon završetka radova.'; w.umPosalji(); await tick(80);
  tocka('UI v047/v053: rubrika — 72/100, NIJE PROLAZ (prag 80), unos se zaključava, Novi ispit gumb',
    d.getElementById('um-rubrika').textContent.includes('84') && d.getElementById('um-rubrika').textContent.includes('NIJE PROLAZ')
    && d.getElementById('um-rubrika').textContent.includes('prag 80') && d.getElementById('um-unos').style.display==='none'
    && d.getElementById('um-rubrika').textContent.includes('Novi ispit'));
  tocka('UI v053: razrez po pitanjima u rubrici + reload-guard skinut',
    d.getElementById('um-rubrika').textContent.includes('Pitanje 1') && d.getElementById('um-rubrika').textContent.includes('72/100')
    && w.OI_BLOK_RELOAD===false);

  // 6e2) ⭐ v061 — F7 pismeni test tok
  w.idiNaTab('testovi'); await tick();
  const tsKart = d.querySelector('#t-testovi .staza[onclick="tsStart()"]'); // ⭐ v063 — redizajn: .staza
  w.tsStart(); await tick(80);
  tocka('UI v061: pismeni — kartica u Testovima, start otvara t-pismeni s PITANJE 1 / 2 + reload-guard',
    !!tsKart && aktivni().join()==='t-pismeni' && d.getElementById('ts-st').textContent==='PITANJE 1 / 2'
    && d.getElementById('ts-pitanje').textContent.includes('građevinsku dozvolu') && w.OI_BLOK_RELOAD===true
    && d.querySelectorAll('#ts-opcije .ts-op').length===4);
  d.querySelector('#ts-opcije .ts-op[data-v="HZZO"]').click(); await tick(80); // krivi odgovor (data-v = čist tekst)
  tocka('UI v061: krivi odgovor -> NETOČNO + točan odgovor + obrazloženje + gumb Sljedeće',
    d.getElementById('ts-feedback').textContent.includes('NETOČNO')
    && d.getElementById('ts-feedback').textContent.includes('Upravno tijelo')
    && d.getElementById('ts-feedback').textContent.includes('upravno tijelo (Članak 99.)')
    && d.getElementById('ts-feedback').textContent.includes('Sljedeće pitanje'));
  w.tsDalje(); await tick();
  tocka('UI v061: Sljedeće pitanje -> PITANJE 2 / 2', d.getElementById('ts-st').textContent==='PITANJE 2 / 2');
  d.querySelector('#ts-opcije .ts-op[data-v="b"]').click(); await tick(80); // točan, finale (data-v = čist tekst)
  tocka('UI v061: finale — ocjena 50/100, NIJE PROLAZ, prag 80, Novi test + reload-guard skinut',
    d.getElementById('ts-rezultat').textContent.includes('50')
    && d.getElementById('ts-rezultat').textContent.includes('NIJE PROLAZ')
    && d.getElementById('ts-rezultat').textContent.includes('prag 80')
    && d.getElementById('ts-rezultat').textContent.includes('Novi test') && w.OI_BLOK_RELOAD===false);
  w.idiNaTab('napredak'); await tick(80);
  tocka('UI v061: Napredak tab — pismeni prosjek 75/100 + SVG trend stupci',
    d.getElementById('np-sadrzaj').textContent.includes('75/100')
    && d.querySelectorAll('#np-sadrzaj svg rect').length>=2);
  tocka('UI v066: Napredak — usmeni sekcija (položeno 1/2, prosjek 78, povijest lista)',
    d.getElementById('np-sadrzaj').textContent.includes('USMENI ISPITI')
    && d.getElementById('np-sadrzaj').textContent.includes('78/100')
    && !!d.getElementById('ud-7'));
  w.usmeniDetalj(7); await tick(60);
  tocka('UI v066: tap na usmeni ispit -> inline rubrika (pitanja + savjet)',
    d.getElementById('ud-7').textContent.includes('Tko vodi dnevnik')
    && d.getElementById('ud-7').textContent.includes('Ponovi članke'));
  w.postaviMod('vjestak'); await tick();
  w.idiNaTab('pismeni'); await tick();
  tocka('UI v061: pismeni NEDOSTUPAN izvan Mentora (pada na prvi tab moda)', aktivni().join()!=='t-pismeni'); // ⭐ v061 — kao usmeni
  w.postaviMod('ispit'); await tick();
  // ⭐ v062 — F8 SRS "Ponovi pogreške"
  w.idiNaTab('testovi'); await tick(80);
  const srsKart = d.querySelector('#t-testovi .ponovi-traka'); // ⭐ v063 — redizajn: traka ponavljanja
  tocka('UI v063: Testovi = 2 staze (pismeni/usmeni) + traka ponavljanja s brojem (3 dospjelo)',
    d.querySelectorAll('#t-testovi .staza').length===2 && !!srsKart
    && d.getElementById('pt-broj').textContent.includes('3') && srsKart.style.display!=='none');
  w.tsStart('srs'); await tick(80);
  tocka('UI v062: SRS start otvara ponavljanje (izvor=srs, PITANJE 1 / 1)',
    aktivni().join()==='t-pismeni' && w._tsIzvor==='srs' && d.getElementById('ts-st').textContent==='PITANJE 1 / 1'
    && d.getElementById('ts-pitanje').textContent.includes('Ponovljeno'));
  tocka('UI v056 ljuska: GRID okvir (3 reda, NIŠTA position:fixed, .sadrzaj srednji red skrola, footer 3. red)',
    (()=>{ const css=[...d.querySelectorAll('style')].map(s=>s.textContent).join('');
      return /body\.u-appu #app\{display:grid;grid-template-rows:auto minmax\(0,1fr\) auto/.test(css)  // grid 3 reda
        && /body\.u-appu \.nav\{grid-row:3\}/.test(css)                                              // footer u 3. redu
        && /\.sadrzaj\{min-height:0;overflow-y:auto/.test(css)                                       // srednji red skrola
        && css.indexOf('#app{display:flex;position:fixed')===-1                                      // NIJE fixed (Samsung bug)
        && css.indexOf('body.u-appu #app{display:flex;position:fixed')===-1
        && /\.vrh\{position:relative/.test(css); })());                                              // header nije sticky, prvi grid red

  // 6f) ⭐ v048 — podvrh: naslov taba iz routera, prati mod, akcija radi
  w.postaviMod('ispit'); await tick();
  const pvDanas = d.getElementById('pv-naslov').textContent==='Danas';
  w.postaviMod('vjestak'); await tick();
  w.idiNaTab('uci'); await tick();
  const pvPropisi = d.getElementById('pv-naslov').textContent==='Propisi';
  w.idiNaTab('razgovor'); await tick();
  tocka('UI v048: podvrh naslov prati tab i mod (Danas / Propisi / Razgovor)',
    pvDanas && pvPropisi && d.getElementById('pv-naslov').textContent==='Razgovor');
  w.idiNaTab('ja'); await tick();
  tocka('UI v054: Ja-tab zaglavlje = ime korisnika (ne "Ja")', d.getElementById('pv-naslov').textContent==='Ivan'); // ⭐ v054
  tocka('UI v059/v168: Ja NIJE u footeru (živi u avataru); tier badge JE u headeru (v168)', // ⭐ v059/v168
    (()=>{ let ok=true;
      for(const m of ['ispit','vjestak','investitor']){ w.postaviMod(m);
        if([...d.querySelectorAll('#nav > button[data-tab]')].some(b=>b.dataset.tab==='ja')) ok=false; }
      const mp=[...d.querySelectorAll('#av-menu button')].find(b=>b.textContent.includes('Moj profil'));
      return ok && !!mp && !!d.getElementById('vrh-tier'); })());
  w.postaviMod('vjestak'); await tick();
  w.idiNaTab('razgovor'); await tick(); // natrag za akcija-test (razgovor je Vještak tab)
  w.aiDodajUser('nešto');
  d.querySelector('#pv-akcija .btn').click(); await tick();
  tocka('UI v048: podvrh akcija ➕ Novi čisti razgovor',
    d.getElementById('ai-poruke').childElementCount===0 && d.getElementById('rz-akt').textContent==='NOVI RAZGOVOR');
  const prefIn = d.getElementById('ai-input');
  w.otvoriVjestak('Dugačko pitanje za rast kućice — provjera da programatski unos okida rast.'); await tick();
  tocka('UI v048: prefill okida rast kućice (height postavljen)',
    prefIn.style.height!=='' && prefIn.value.indexOf('Dugačko')===0);
  tocka('UI v050: ljuska zaključava i <html> (u-appu na documentElement)',
    d.documentElement.classList.contains('u-appu'));
  tocka('UI v048: sekcijski naslovi sklonjeni (podvrh preuzeo)',
    [...d.querySelectorAll('.tab > .naslov')].every(x=>x.classList.contains('pn-skloni')));

  // 6g) ⭐ v051 — tabovi STROGO po modu + logo u boji moda
  w.postaviMod('vjestak'); await tick();
  w.idiNaTab('usmeni'); await tick();
  tocka('UI v051: usmeni NE postoji u Vještaku (pada na Razgovor)', aktivni().join()==='t-razgovor');
  w.postaviMod('ispit'); await tick();
  w.idiNaTab('usmeni'); await tick();
  tocka('UI v051: usmeni tab u Mentoru izravno iz footera', aktivni().join()==='t-usmeni'
    && !!d.querySelector('#nav button[data-tab="usmeni"]'));
  tocka('UI v067: header = OI oznaka u .zmark (dark-mode čitljivo, umjesto logotipa)',
    !!d.querySelector('.vrh .zmark .oi-mark') && d.querySelector('.vrh .zmark .oi-mark').textContent==='OI');
  tocka('UI v067: login = dual logo (dark+light) + OI badge',
    !!d.querySelector('.login-mark .logo-dark') && !!d.querySelector('.login-mark .logo-light')
    && !!d.querySelector('.login-mark .oi-badge'));

  // 7) mdRender: MD u HTML + XSS štit
  const md = w.mdRender('## Naslov\n**bold** tekst\n- stavka\nrok 5 - 8 dana\n<img src=x onerror=1>');
  tocka('UI mdRender: naslov/bold/crtica, bez sirovog ##', md.includes('<b>bold</b>') && md.includes('• stavka') && md.includes('5 - 8 dana')
    && md.includes('>Naslov</span>') && !md.includes('##'));
  tocka('UI mdRender: XSS pobjegnut', !md.includes('<img') && md.includes('&lt;img'));

  // 8) invarijanta kroz SVE modove i tabove: uvijek točno jedna aktivna sekcija
  let jedna = true;
  for (const m of ['ispit','vjestak','investitor']) {
    w.postaviMod(m); await tick();
    for (const t2 of ['danas','testovi','napredak','uci','ja','razgovor','povijest','dopisi','novosti','invest']) {
      w.idiNaTab(t2); await tick(15);
      if (aktivni().length !== 1) { jedna = false; console.log('  ! dupli prikaz:', m, t2, aktivni()); }
    }
  }
  tocka('UI invarijanta: 30 kombinacija mod×tab — uvijek TOČNO 1 aktivna sekcija', jedna);

  // 9) ⭐ v045 — odjava iz avatara (zadnje: ruši sesiju)
  d.getElementById('av-btn').click(); await tick();
  [...d.querySelectorAll('#av-menu button')].find(b=>b.textContent.includes('Odjava')).click(); await tick();
  tocka('UI v045: Odjava iz avatara vraća na prijavu', !d.body.classList.contains('u-appu')
    && !d.documentElement.classList.contains('u-appu'));

  // 10) ⭐ v099 — Provjera banke: gumb + funkcija + kontejner postoje
  tocka('UI v099: gumb "Provjeri banku" + admPitProvjera + kontejner postoje',
    !!d.querySelector('button[onclick="admPitProvjera()"]')
    && typeof w.admPitProvjera === 'function'
    && !!d.getElementById('adm-pit-provjera'));

  // 11) ⭐ v100 — komisija s karakterima: strogost-oznaka u umBubble + persona u server promptovima
  const idxSrc = require('fs').readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const srvSrc = require('fs').readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  tocka('UI v100: umBubble prikazuje oznaku strogosti (zahtjevan/temeljit/susretljiv)',
    idxSrc.includes('zahtjevan') && idxSrc.includes('susretljiv') && idxSrc.includes('UM_CLAN&&UM_CLAN.strogost'));
  tocka('UI v100: komisija ima karaktere (strogost 1-5) + personaBlok ide u P5/P6/P7A',
    /strogost:\s*5/.test(srvSrc) && /strogost:\s*2/.test(srvSrc)
    && srvSrc.includes('function personaBlok')
    && srvSrc.includes('P6_PROCJENA + personaBlok') && srvSrc.includes('P7A_ISPRAVAK + personaBlok'));
  tocka('UI v100: napredak trend (razvoj znanja) + smjer raste/pada u spremnost API i UI',
    srvSrc.includes('trend') && srvSrc.includes('smjer') && idxSrc.includes('RAZVOJ ZNANJA'));
  // ⭐ v101 — AI provjera točnosti protiv propisa
  tocka('UI v101: gumb "Provjeri točnost" + admPitTocnost + petlja batcheva',
    !!d.querySelector('button[onclick="admPitTocnost()"]') && typeof w.admPitTocnost === 'function');
  tocka('UI v101: ruta provjeri-tocnost + recenzent + verdikt stupac + flag spornih',
    srvSrc.includes("'/api/admin/pitanja/provjeri-tocnost'") && srvSrc.includes('P_RECENZENT')
    && srvSrc.includes('provjera JSONB') && srvSrc.includes("slaganje === 'ne'"));
  // ⭐ v102 — bugfixevi + UX
  tocka('UI v102/v141: izreziDopis + akcijski gumb Word na odgovoru (aibtn)',
    typeof w.izreziDopis === 'function' && idxSrc.includes("b('aiWord','📄','Word')") && idxSrc.includes('class="aibtn"'));
  tocka('UI v102: izreziDopis odbacuje AI-uvod i zadržava dopis',
    (function(){ try{ const r=w.izreziDopis('Evo dopisa koji sam sastavio:\nŽBUKA d.o.o.\nPREDMET: Test\nPoštovani,\n...\nS poštovanjem'); return r.startsWith('ŽBUKA') && !r.toLowerCase().includes('evo dopisa'); }catch(_){ return false; } })());
  tocka('UI v102: Nastavi gdje si stao prati test/članak/usmeni',
    typeof w.nastavakZabiljezi === 'function' && idxSrc.includes("nastavakZabiljezi('test'") && idxSrc.includes("nastavakZabiljezi('usmeni'") && idxSrc.includes("nastavakZabiljezi('clanak'"));
  tocka('UI v102: pismeni promo kartica na Danas ekranu',
    !!d.getElementById('d-pismeni-kartica') && d.getElementById('d-pismeni-kartica').getAttribute('onclick').includes("tsStart('test')"));
  tocka('UI v102: admin tier editor ima grid polja (.tu-polja) + responsive',
    idxSrc.includes('tu-polja') && idxSrc.includes('@media(max-width:640px){ .tier-uredi'));
  tocka('UI v102: sigurnosni headeri pojačani (CSP + HSTS + Permissions-Policy)',
    srvSrc.includes('Content-Security-Policy') && srvSrc.includes('Strict-Transport-Security') && srvSrc.includes('Permissions-Policy'));
  tocka('UI v102: anti-spam throttle na register i reset + startup provjera tajni',
    srvSrc.includes("loginThrottle('reg|'") && srvSrc.includes("loginThrottle('zab|'") && srvSrc.includes('dev-tajna-promijeni-me'));
  // ⭐ v103 — wake lock
  tocka('UI v103: wake lock helper (drži/pusti) + re-akvizicija + indikator',
    typeof w.wakeDrzi === 'function' && typeof w.wakePusti === 'function'
    && idxSrc.includes("navigator.wakeLock.request('screen')") && idxSrc.includes('wake-ind'));
  tocka('UI v103: wake lock wireiran u uvoz i provjeru točnosti',
    idxSrc.includes('await wakeDrzi()') && idxSrc.includes('await wakePusti()'));
  // ⭐ v105 — bugfix provjera banke + tocnost vraća u nacrt
  tocka('UI v105/v107: Provjeri banku lagan i bulletproof (md5 hash, ABC u JS)',
    srvSrc.includes("md5(lower(trim(coalesce(pitanje,'')))") && srvSrc.includes('Array.isArray(p.opcije)')
    && srvSrc.includes('ABC validacija u JS') && !srvSrc.includes('provjera-STARO'));
  tocka('UI v105: Provjeri točnost vraća ovjereno→nacrt kad proturječi propisu',
    srvSrc.includes("status='ovjereno' THEN 'nacrt'") && srvSrc.includes('vratiUNacrt'));
  tocka('UI v105: upozorenje da ne pokreneš banku i točnost istovremeno',
    idxSrc.includes('window._tocnostRadi'));
  // ⭐ v106 — STT akumulacija: obrađuje samo nove rezultate (resultIndex) + isFinal razdvajanje
  tocka('UI v140: STT continuous=false + gradnja iz SVIH rezultata (bez ponavljanja riječi)',
    idxSrc.includes('UM_REC.continuous=false') && idxSrc.includes('for(let i=0;i<e.results.length;i++) txt+=e.results[i][0].transcript') && !idxSrc.includes('let konacni='));

  tocka('UI v109: Provjeri banku zove apiGet (GET), ne api (POST) — inače 404 "Greška."',
    idxSrc.includes("apiGet('admin/pitanja/provjera?program=GRA')") && !idxSrc.includes("api('admin/pitanja/provjera?program=GRA',null,true)"));
  // ⭐ v112-v115 — dashboard gradiva
  tocka('UI v112-115: gradivo dashboard (pregled/članci/brisanje dok/članka/grupe)',
    srvSrc.includes('dokument-clanci/:id') && srvSrc.includes('dokument-obrisi') && srvSrc.includes('clanak-obrisi')
    && srvSrc.includes('vrsta-obrisi') && typeof w.gradivoDash==='function' && typeof w.vrstaObrisi==='function');
  // ⭐ v136 — bugfix batch 1: SRS kvota + tocno_netocno robusno
  tocka('SRV v136: SRS ne troši mjesečnu kvotu (brojač uzima AND vrsta=\'test\')',
    srvSrc.includes("created_at >= $2 AND vrsta='test'"));
  tocka('SRV v136: tocno_netocno robusno (kanonTN + tocnaRijecTN + indeks-po-tekstu za T/N s opcijama)',
    srvSrc.includes('const kanonTN') && srvSrc.includes('function tocnaRijecTN')
    && srvSrc.includes("(pit.tip === 'abc' || pit.tip === 'tocno_netocno') && Array.isArray(pit.opcije)"));
  tocka('UI v136: klijent za T/N koristi serverove opcije ako postoje',
    idxSrc.includes('so.length>=2 ? so : [\'Točno\',\'Netočno\']'));

  // ⭐ v137 — Batch 2: Vještak izvoz (PDF + u dopis + STT)
  tocka('SRV v137: PDF izvoz dopisa (/api/dopis/pdf + generirajDopisPdf + dopis-pdf.js)',
    srvSrc.includes("'/api/dopis/pdf'") && srvSrc.includes('generirajDopisPdf')
    && require('fs').existsSync(path.join(__dirname, 'dopis-pdf.js')));
  tocka('UI v137/v141: aiPdf gumb (📕 PDF, aibtn) + funkcija',
    typeof w.aiPdf === 'function' && idxSrc.includes("b('aiPdf','📕','PDF')") && idxSrc.includes("fetch('/api/dopis/pdf'"));
  tocka('UI v141: akcijski gumbi ispod odgovora (.ai-akcije/.aibtn) + povratna info + graciozan prekid streama',
    idxSrc.includes('class="ai-akcije"') && idxSrc.includes('.aibtn{') && idxSrc.includes('Je li odgovor pomogao')
    && idxSrc.includes('Veza je prekinuta'));
  tocka('UI v137/v142: "Dopis" gumb (aiUDopis, nacin=dokument)',
    typeof w.aiUDopis === 'function' && idxSrc.includes("window._aiNacin='dokument'") && idxSrc.includes("b('aiUDopis',"));
  tocka('UI v142: STT hrvatski normalizator (hrNormaliziraj + SR_HR, primijenjen u oba mikrofona)',
    typeof w.hrNormaliziraj === 'function' && w.hrNormaliziraj('obaveštava uslov tačno')==='obavještava uvjet točno'
    && (idxSrc.match(/hrNormaliziraj\(\(bazni\+txt\)/g)||[]).length===2);
  tocka('UI v137/v140: glasovni unos u Vještaku (aiMic + #ai-mic, vlastito AI_ stanje, continuous=false)',
    typeof w.aiMic === 'function' && !!d.getElementById('ai-mic')
    && idxSrc.includes('let AI_REC=null') && idxSrc.includes('AI_REC.continuous=false'));

  // ⭐ v137 — Batch 3: vremeplov + mikro-tutor
  tocka('UI v137: vremeplov "Na dan" u čitaču (ucNaDan/ucNaDanToggle + otvoriClanak(id, naDan))',
    typeof w.ucNaDan === 'function' && typeof w.ucNaDanToggle === 'function'
    && !!d.getElementById('uc-nadan') && idxSrc.includes("'?na_dan='+encodeURIComponent(naDan)"));
  tocka('SRV v137: MENTOR mikro-tutor (/api/mentor/objasni + P_ZASTO, budžet kao Vještak)',
    srvSrc.includes("'/api/mentor/objasni'") && srvSrc.includes('const P_ZASTO')
    && srvSrc.includes('aiBudzet(k)'));
  tocka('UI v137/v145: mikro-tutor gumbi (🧠 Zašto? + 🎓 Primjerom) + tsZasto(nacin) → mentor/objasni',
    typeof w.tsZasto === 'function' && idxSrc.includes("tsZasto("+"") && idxSrc.includes("🎓 Primjerom") && idxSrc.includes("🧠 Zašto?")
    && idxSrc.includes("api('mentor/objasni'") && idxSrc.includes("nacin:nacin||'zasto'"));
  tocka('SRV v145: "Objasni primjerom" (P_PRIMJER + nacin=primjer u mentor/objasni, više tokena)',
    srvSrc.includes('const P_PRIMJER') && srvSrc.includes("(req.body || {}).nacin === 'primjer'") && srvSrc.includes('gradilišta'));

  // ⭐ v138 — Batch 4: dijagnostika slabih tema + vježbaj + rubrika po kriterijima
  tocka('SRV v138: dijagnostika slabih tema (/api/mentor/slabe-teme, agregira po uze_podrucje)',
    srvSrc.includes("'/api/mentor/slabe-teme'") && srvSrc.includes('id = ANY($1::int[])') && srvSrc.includes('postotak'));
  tocka('SRV v138: "vježbaj baš ovo" (test/start prima tema filter + preskače AI izvan teme)',
    srvSrc.includes("const tema = String((req.body || {}).tema") && srvSrc.includes("AND uze_podrucje=$2 ORDER BY id LIMIT 600")
    && srvSrc.includes('AI_ON() && !tema'));
  tocka('UI v138: tsStart prima temu + Napredak ima Slabe teme s Vježbaj gumbom',
    idxSrc.includes('async function tsStart(izvor, tema)') && idxSrc.includes('SLABE TEME')
    && idxSrc.includes("apiGet('mentor/slabe-teme')") && idxSrc.includes('Vježbaj baš ovo'));
  tocka('SRV v138: rubrika po kriterijima (P7A vraća kriterije + finale ih prosječi, ne dira ocjenu)',
    srvSrc.includes('"kriteriji":{"potpunost"') && srvSrc.includes('const kriterijiUk')
    && srvSrc.includes('tocnost_citata') && srvSrc.includes('komunikacija'));
  tocka('UI v138: umRubrika prikazuje trake PO KRITERIJIMA (samo kad sesija ima podatke)',
    idxSrc.includes('PO KRITERIJIMA') && idxSrc.includes('const kritKart') && idxSrc.includes('r.kriteriji'));

  // ⭐ v139 — Batch 5: simulacija roka + predmeti (case-file). SHEMA: init-db + backup.
  tocka('SRV v139: nove tablice (simulacije, predmeti, predmet_stavke) u initDb',
    srvSrc.includes('CREATE TABLE IF NOT EXISTS simulacije') && srvSrc.includes('CREATE TABLE IF NOT EXISTS predmeti')
    && srvSrc.includes('CREATE TABLE IF NOT EXISTS predmet_stavke'));
  tocka('SRV v139: simulacija/zavrsi VERIFICIRA sesije + čita ocjene iz baze (bez varanja) + povijest',
    srvSrc.includes("'/api/simulacija/zavrsi'") && srvSrc.includes("'/api/simulacija/povijest'")
    && srvSrc.includes('const prolaz = pp && pu') && srvSrc.includes("stanje !== 'gotovo'"));
  tocka('SRV v139: predmeti CRUD (list/create/detail/patch/delete + stavke add/delete, sve po vlasniku)',
    srvSrc.includes("app.get('/api/predmeti'") && srvSrc.includes("app.post('/api/predmeti'")
    && srvSrc.includes("app.get('/api/predmeti/:id'") && srvSrc.includes("app.patch('/api/predmeti/:id'")
    && srvSrc.includes("app.delete('/api/predmeti/:id'") && srvSrc.includes("/api/predmeti/:id/stavke")
    && srvSrc.includes("app.delete('/api/predmeti/:id/stavke/:sid'"));
  tocka('UI v139: simulacija roka (simStart/simNaUsmeni/simZavrsi + Danas kartica + hookovi u finalima)',
    typeof w.simStart==='function' && typeof w.simNaUsmeni==='function' && typeof w.simZavrsi==='function'
    && !!d.getElementById('d-sim-kartica') && idxSrc.includes("SIM.faza==='pismeni'") && idxSrc.includes("SIM.faza==='usmeni'"));
  tocka('UI v139/v167: simulacija dostupna plaćenim tierovima (blokiran samo free)',
    idxSrc.includes("!k.tier || k.tier==='free')){ alert('Simulacija roka") && idxSrc.includes('Simulacija roka uključuje usmeni'));
  tocka('UI v139: Predmeti overlay (modal + funkcije + ulaz iz Vještaka + 📁 na odgovoru)',
    !!d.getElementById('predmeti-modal') && typeof w.predOtvori==='function' && typeof w.predDetalj==='function'
    && typeof w.aiUPredmet==='function' && idxSrc.includes("onclick=\"predOtvori()\"") && idxSrc.includes("b('aiUPredmet',"));
  tocka('UI v139: api() podržava method (PATCH/DELETE) uz zadani POST',
    idxSrc.includes('async function api(put, body, withAuth, method)') && idxSrc.includes("method:method||'POST'"));

  tocka('UI v144: glasovni AI-cleanup (/api/glas/ocisti + P_GLAS, platformski + fail-safe) + glasOcisti hook u oba mikrofona',
    srvSrc.includes("'/api/glas/ocisti'") && srvSrc.includes('const P_GLAS') && srvSrc.includes('res.json({ ok: true, tekst: original })')
    && typeof w.glasOcisti === 'function' && (idxSrc.match(/glasOcisti\(inp, mic\);/g)||[]).length===2);

  tocka('SRV v146: proxy tablica-slika (/api/tablica + GRADIVO_RAW, blok path-traversal + samo slike)',
    srvSrc.includes("'/api/tablica'") && srvSrc.includes('GRADIVO_RAW') && srvSrc.includes("p.includes('..')") && srvSrc.includes('/\\.(png|jpe?g|webp)$/i'));
  tocka('UI v146: čitač renderira pipe-tablice + TABLICA_SLIKA sliku (renderClanakTekst/renderPipeTablica)',
    typeof w.renderClanakTekst === 'function' && typeof w.renderPipeTablica === 'function'
    && idxSrc.includes('/api/tablica?p=') && idxSrc.includes('renderClanakTekst(d.clanak.tekst'));

  tocka('SRV v147: citati dobiju tablica-flag (obogatiTablicom + TABLICA_SLIKA LIKE, pozvan u oba puta)',
    srvSrc.includes('async function obogatiTablicom') && srvSrc.includes("tekst LIKE '%TABLICA_SLIKA:%'")
    && (srvSrc.match(/await obogatiTablicom\(/g)||[]).length===2);
  tocka('UI v147: "📊 Vidi tablicu" chip u odgovoru (tabl-chip + filter c.tablica)',
    idxSrc.includes('.tabl-chip{') && idxSrc.includes('_cit.filter(c=>c.tablica)') && idxSrc.includes('Vidi tablicu uživo'));

  tocka('SRV v148/v151: popis propisa (/api/admin/popis, superadmin, samo UVEZENI — HAVING ≥1 aktivan članak)',
    srvSrc.includes("'/api/admin/popis'") && srvSrc.includes("zahtijevajSuperadmin") && srvSrc.includes("WHERE d.status='aktivno'")
    && srvSrc.includes("HAVING COUNT(c.id) FILTER (WHERE c.status='aktivan') > 0"));
  tocka('UI v148: dashboard gumb "Popis propisa" + kopiranje (dashPopis/dashPopisKopiraj)',
    typeof w.dashPopis === 'function' && typeof w.dashPopisKopiraj === 'function'
    && idxSrc.includes('Popis propisa u aplikaciji') && idxSrc.includes("apiGet('admin/popis')"));

  tocka('SRV v149: uvoz — normalizirana oznaka (Članak 3. == Članak 3) + preview/dry-run (rollback marker)',
    srvSrc.includes('const normOzn') && srvSrc.includes("replace(/[.\\u00A0]+$/, '')")
    && srvSrc.includes("const preview = !!(req.body && req.body.preview)") && srvSrc.includes("__PREVIEW__"));
  tocka('UI v149: uvoz traži potvrdu prije overwrite-a (preview:true + confirm koji imenuje članke)',
    idxSrc.includes('preview:true') && idxSrc.includes('OVERWRITE u') && idxSrc.includes('Nastaviti s uvozom'));

  tocka('SRV v150: MERGE uvoz (spajanje) — parcijalni uvoz NE briše članke izvan uvoza',
    srvSrc.includes("const spajanje = !!(req.body && req.body.spajanje)") && srvSrc.includes('if (spajanje) continue;'));
  tocka('UI v150: tražilica prioritet (naziv→oznaka, bez tekst-šuma) + Gradivo toggle',
    idxSrc.includes('cl=cl.filter(c=>c.rang===1)') && idxSrc.includes('async function gradivoDash(refresh)')
    && idxSrc.includes("if(!refresh && box.innerHTML.trim()){ box.innerHTML=''; return; }"));

  tocka('UI v152/v158: sistemski back Propisi/Uči (history-trap u uciPrikaz + popstate kroz stog)',
    idxSrc.includes("history.pushState({uciTrap:1}") && idxSrc.includes("addEventListener('popstate'")
    && idxSrc.includes("uciPrikaz(UCI_STACK[UCI_STACK.length-1], true)"));

  tocka('SRV v154: Novosti vraćaju clanci_izmijenjeni + admin/novosti/procisti (marker čišćenja)',
    srvSrc.includes("array_agg(DISTINCT v.clanak_id) AS clanci_izmijenjeni") && srvSrc.includes("'/api/admin/novosti/procisti'")
    && srvSrc.includes("novosti_procisceno_od"));
  tocka('UI v154: otvoriDok istakni-bounce + dashOcistiNovosti',
    idxSrc.includes('async function otvoriDok(id, istakni)') && idxSrc.includes('clanak-nov') && idxSrc.includes('@keyframes novPulse')
    && idxSrc.includes('async function dashOcistiNovosti(') && idxSrc.includes("api('admin/novosti/procisti'"));
  tocka('UI v155: Novosti skok na dokument (_skokDok, novOtvori) + osvježeno-oznaka + veći ai-input',
    idxSrc.includes('window._skokDok') && idxSrc.includes('function novOtvori(') && idxSrc.includes("onclick=\"novOtvori(")
    && idxSrc.includes('nov-tag') && idxSrc.includes('id="ai-input" rows="2"'));

  tocka('SRV v156: pametna tražilica — f_unaccent (bez dijakritike) + NN izvor + rang naziv/izvor/oznaka/tekst',
    srvSrc.includes('CREATE OR REPLACE FUNCTION f_unaccent') && srvSrc.includes('f_unaccent(d.naziv) ILIKE f_unaccent($1)')
    && srvSrc.includes('d.izvor ILIKE $1') && srvSrc.includes('f_unaccent(c.tekst) ILIKE f_unaccent($1)'));
  tocka('UI v156: stacked redak (flex-direction column) + NN izvor u rezultatima',
    idxSrc.includes('.clanak-red{position:relative;display:flex;flex-direction:column') && idxSrc.includes('.clanak-red .zv{position:absolute')
    && idxSrc.includes('c.izvor?') );

  tocka('UI v157: sistemski back home-sidro (anchor + vraćanje na home umjesto izlaza)',
    idxSrc.includes("history.replaceState({anchor:1}") && idxSrc.includes('history.state.anchor && tab && tab!==home') && idxSrc.includes('idiNaTab(home); return;'));

  tocka('UI v158: eksplicitni stog prikaza Propisi (UCI_STACK) + back kroz stog + uciNatrag preko history',
    idxSrc.includes("let UCI_STACK=['lista']") && idxSrc.includes("tab==='uci' && UCI_STACK.length>1")
    && idxSrc.includes('UCI_STACK.pop()') && idxSrc.includes('history.go(-steps)'));

  tocka('SRV v159: pretraga tolerancija na tipfelere (word_similarity <%) + qraw',
    srvSrc.includes('const qraw = qs.replace') && srvSrc.includes('f_unaccent($2) <% f_unaccent(d.naziv)') && srvSrc.includes("f_unaccent($2) <% f_unaccent(COALESCE(c.naslov"));
  tocka('UI v159: bold pogođenih (hl+mark) + Brzi pristup (Nedavno/Označeno) + Novosti po datumu + Mentor guardovi',
    idxSrc.includes('function hl(s, q)') && idxSrc.includes('mark{background:var(--accsoft)')
    && idxSrc.includes('async function renderBrziPristup()') && idxSrc.includes('oi_nedavno')
    && idxSrc.includes("let novHtml='', zadnjiDat=''") && idxSrc.includes('function tsRezultat(r){ r=r||{}'));

  tocka('SRV v160→161: enterprise u TIEROVI + admin dodjela tiera',
    srvSrc.includes("'free', 'basic', 'pro', 'enterprise'") && srvSrc.includes("/api/admin/korisnik/:id/tier"));
  tocka('UI v160→161: prikaz svih tierova + istek + enterprise editor + rich prompt',
    idxSrc.includes("TIER_LABEL={free:'BESPLATNO',basic:'BASIC',pro:'PRO',enterprise:'ENTERPRISE'}") && idxSrc.includes('function pretplataProvjeriPrompt')
    && idxSrc.includes('function tierCestitka') && idxSrc.includes("tg('enterprise','ENTERPRISE')") && idxSrc.includes('.tier-enterprise'));

  tocka('SRV v161: token-budžet po tieru + marketinški tokeni + usmeni na budžetu',
    srvSrc.includes('const TIER_BUDZET = { free: 1, basic: 5, pro: 10, enterprise: 40 }') && srvSrc.includes('const TOKENI_PO_USD')
    && srvSrc.includes('tokeni_total: tokeniTotal') && srvSrc.includes("razlog: 'tokeni'")
    && !srvSrc.includes('const FREE_UPITI') && !srvSrc.includes('aiBrojUpita'));
  tocka('UI v161: profil u tokenima (fmtTok) + bogati modali (tierCestitka/nadogradi/TIER_TEMA)',
    idxSrc.includes('function fmtTok(n)') && idxSrc.includes('const TIER_TEMA') && idxSrc.includes('function tierCestitka')
    && idxSrc.includes('function pretplataNadogradiPrompt') && idxSrc.includes("fmtTok(d.tokeni_iskoristeno)+' / '+fmtTok(d.tokeni_total)")
    && idxSrc.includes('@keyframes tmPop'));

  tocka('SRV v162: čestitka(napomena+pročitano) + moja/korisnik aktivnost + trošak po korisniku',
    srvSrc.includes('cestitka_procitana') && srvSrc.includes("/api/cestitka/procitano") && srvSrc.includes("/api/moja-aktivnost")
    && srvSrc.includes("/api/admin/korisnik/:id/aktivnost") && srvSrc.includes('async function svibUkupniTrosak') && srvSrc.includes('u.trosak_usd = t ?'));
  tocka('UI v162: cijena→uskoro + horiz. legenda + korisnikDetalj + trošak badge + moja aktivnost + čestitka napomena',
    idxSrc.includes('OI Ispit <b>Pro</b> — <span style="color:var(--accent)">uskoro</span>') && idxSrc.includes('flex-wrap:wrap;gap:7px;justify-content:center')
    && idxSrc.includes('async function korisnikDetalj') && idxSrc.includes('const trosakBadge') && idxSrc.includes('async function ucitajMojuAktivnost')
    && idxSrc.includes('function cestitkaProcitano') && idxSrc.includes('tierCestitka(k.cestitka.tier, k.cestitka.istek, k.cestitka.napomena)'));

  tocka('UI v163: detalji korisnika u punom panelu + 2-stupčana mreža + širi dashboard',
    idxSrc.includes('id="kor-detalj-panel"') && idxSrc.includes("getElementById('kor-detalj-panel')")
    && idxSrc.includes('.kd-mreza{display:grid') && idxSrc.includes('dash-otvoren .sadrzaj>.tab#t-ja')
    && !idxSrc.includes("'<div id=\"kor-detalj-'+u.id+'\"></div>'"));

  tocka('UI v164: SIGURNOST — resetAdminUI ruši dashboard za ne-superadmina + otvoriDash guard',
    idxSrc.includes('function resetAdminUI') && idxSrc.includes('else resetAdminUI();')
    && idxSrc.includes("if(!KORISNIK || !KORISNIK.je_superadmin){ resetAdminUI(); return; }")
    && idxSrc.includes("try{ resetAdminUI(); }catch(_){ }"));

  tocka('SRV v167: bug hunt — svi plaćeni tierovi (ne samo pro); free-only gateovi',
    srvSrc.includes("k.tier === 'free') return res.status(402).json({ error: 'pro' })")
    && srvSrc.includes("k.tier === 'free') { // ⭐ v167 — mjesečna kvota testova SAMO za free")
    && !srvSrc.includes("k.tier !== 'pro') return res.status(402).json({ error: 'pro' })"));
  tocka('UI v167: tour "ne prikazuj više" (robustan) + simulacija roka svi plaćeni',
    idxSrc.includes('function tourNeprikazuj') && idxSrc.includes('onclick="tourNeprikazuj()">Ne prikazuj više')
    && idxSrc.includes("try{ localStorage.setItem('oi_tour_done','1'); }catch(_){ }")
    && idxSrc.includes("!k.tier || k.tier==='free')){ alert('Simulacija roka"));

  tocka('SRV v168: sesije (jti+aktivne_sesije+auth async+ipLimit) + GDPR izvoz',
    srvSrc.includes('CREATE TABLE IF NOT EXISTS aktivne_sesije') && srvSrc.includes('function jwtPotpis(k, jti)')
    && srvSrc.includes('const ipLimit') && srvSrc.includes('async function auth') && srvSrc.includes("razlog: 'sesija'")
    && srvSrc.includes("app.get('/api/moji-podaci'") && srvSrc.includes("app.post('/api/sesije/odjavi-druge'")
    && srvSrc.includes("error: 'previse_uredjaja'"));
  tocka('UI v168: header badge + 409 handler + sesijaProvjera + GDPR/odjavi-druge',
    idxSrc.includes('id="vrh-tier" class="tier-b') && idxSrc.includes("vt.className='tier-b tier-'+(k.tier")
    && idxSrc.includes("e.data.error==='previse_uredjaja'") && idxSrc.includes('function sesijaProvjera')
    && idxSrc.includes('function preuzmiPodatke') && idxSrc.includes('function odjaviDrugeUredjaje'));

  tocka('SRV v169: GDPR izvoz popravljen (naplatni s korisnici, usmeni rezultati)',
    srvSrc.includes('FROM korisnici WHERE id=$1`, [uid]).catch') && srvSrc.includes('SELECT created_at, rezultati FROM usmeni_sesije')
    && !srvSrc.includes('FROM naplatni_podaci WHERE korisnik_id'));
  tocka('UI v169: renderUci defenziva (sek.put guard)',
    idxSrc.includes("esc((sek.put||sek.uze_podrucje||'').split(' / ').pop())"));

  console.log(`\n${T - PAD}/${T} UI testova prošlo`);
  process.exit(PAD ? 1 : 0);
})().catch(e => { console.error('UI test greška:', e); process.exit(1); });
