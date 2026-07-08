// ⭐ v089 — DOCX generator za dopise (potvrđeni dizajn: vertikalne brand-linije, footer-impressum)
// Ovisi o npm 'docx'. Poziva se iz servera; prima tekst dopisa (markdown-ish) + podatke korisnika.
const {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  BorderStyle, Footer, PositionalTab, PositionalTabAlignment, PositionalTabLeader,
  Table, TableRow, TableCell, WidthType, VerticalAlign,
} = require('docx');

// Paleta
const INK = '22252A', BRAND = '1F3A5F', MUTED = '6B6B6B', FAINT = '9A9A9A', HAIR = 'DEDEDE';
const SERIF = 'Georgia', MONO = 'Consolas', SANS = 'Calibri';

// Footer-impressum (na svakoj stranici)
function hairline() { // ⭐ v141 — tanka linija razdvajanja (pod zaglavljem)
  return new Paragraph({
    spacing: { before: 40, after: 300 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: HAIR, space: 6 } },
    children: [],
  });
}
function footerImpressum() {
  return new Footer({
    children: [
      new Paragraph({
        spacing: { before: 0, after: 60 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: HAIR, space: 8 } },
        children: [],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Izrađeno putem ', size: 15, font: SANS, color: FAINT }),
          new TextRun({ text: 'oi.zbuka.hr', size: 15, font: SANS, color: BRAND, bold: true }),
          new TextRun({ text: '   ŽBUKA AI  ·  ŽBUKA Čakarić d.o.o.', size: 15, font: SANS, color: FAINT }),
          new PositionalTab({ alignment: PositionalTabAlignment.RIGHT, relativeTo: 'margin', leader: PositionalTabLeader.NONE }),
          new TextRun({ children: ['PAGE'], size: 15, font: SANS, color: FAINT }),
        ],
      }),
    ],
  });
}

// Vertikalna brand-linija uz sadržaj (2-stupčana tablica)
function vertLinija(paragrafi, boja) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [70, 9290],
    borders: {
      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
    },
    rows: [ new TableRow({ children: [
      new TableCell({
        width: { size: 70, type: WidthType.DXA },
        borders: { right: { style: BorderStyle.SINGLE, size: 18, color: boja || BRAND } },
        children: [ new Paragraph({ children: [] }) ],
      }),
      new TableCell({
        width: { size: 9290, type: WidthType.DXA },
        margins: { left: 200 }, verticalAlign: VerticalAlign.CENTER, borders: {},
        children: paragrafi,
      }),
    ] }) ],
  });
}

// Header za PRAVNU OSOBU
function headerTvrtka(k) {
  const naziv = k.naplatni_naziv || 'Tvrtka';
  const linija2 = [k.adresa, k.grad ? ((k.posta ? k.posta + ' ' : '') + k.grad) : ''].filter(Boolean).join(', ');
  const oib = k.oib ? 'OIB ' + k.oib : '';
  const kontakt = k.email || '';
  const meta = [linija2, oib, kontakt].filter(Boolean).join('   ·   ');
  return [
    vertLinija([
      new Paragraph({ children: [ new TextRun({ text: naziv, bold: true, size: 21, font: SANS, color: INK }) ], spacing: { after: 8 } }),
      new Paragraph({ children: [ new TextRun({ text: meta, size: 16, font: SANS, color: MUTED }) ] }),
    ]),
    new Paragraph({ children: [], spacing: { after: 340 } }),
  ];
}

// Header za FIZIČKU OSOBU
function headerFizicka(k) {
  const ime = k.naplatni_naziv || k.ime || 'Ime i prezime';
  const linija2 = [k.adresa, k.grad ? ((k.posta ? k.posta + ' ' : '') + k.grad) : '', k.oib ? 'OIB ' + k.oib : ''].filter(Boolean).join('  ·  ');
  const djeca = [ new Paragraph({ children: [ new TextRun({ text: ime, bold: true, size: 26, font: SERIF, color: INK }) ], spacing: { after: linija2 ? 5 : 0 } }) ];
  if (linija2) djeca.push(new Paragraph({ children: [ new TextRun({ text: linija2, size: 16, font: SANS, color: MUTED }) ] }));
  return [ vertLinija(djeca, INK), new Paragraph({ children: [], spacing: { after: 340 } }) ];
}

// Parsiraj tekst dopisa u paragrafe. Prepoznaje PREDMET, poštovani, potpis.
// Tekst dolazi kao plain (iz chata); dijelimo po praznim redovima na odlomke.
function tijeloIzTeksta(tekst) {
  const out = [];
  const linije = String(tekst || '').replace(/\r/g, '').split('\n');
  let blok = [];
  const flush = () => {
    if (!blok.length) return;
    const t = blok.join(' ').trim();
    blok = [];
    if (!t) return;
    // PREDMET poseban stil
    const mPred = t.match(/^PREDMET\s*:?\s*(.*)$/i);
    if (mPred) {
      out.push(vertLinija([
        new Paragraph({ children: [ new TextRun({ text: 'PREDMET', bold: true, size: 15, font: SANS, color: BRAND, characterSpacing: 40 }) ], spacing: { after: 40 } }),
        new Paragraph({ children: [ new TextRun({ text: mPred[1].trim(), bold: true, size: 21, font: SERIF, color: INK }) ] }),
      ]));
      out.push(new Paragraph({ children: [], spacing: { after: 260 } }));
      return;
    }
    // ⭐ v141 — potpisni blok (S poštovanjem…) dobiva zrak iznad i nije poravnat obostrano
    if (/^(s\s+poštovanjem|srdačan pozdrav|s\s+štovanjem)/i.test(t)) {
      out.push(new Paragraph({
        children: [ new TextRun({ text: t, size: 21, font: SERIF, color: INK }) ],
        spacing: { before: 300, after: 170, line: 306 },
      }));
      return;
    }
    out.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      children: [ new TextRun({ text: t, size: 21, font: SERIF, color: INK }) ],
      spacing: { after: 170, line: 306 },
    }));
  };
  for (const l of linije) {
    if (l.trim() === '') { flush(); } else { blok.push(l.trim()); }
  }
  flush();
  return out;
}

// Meta: ur.broj + datum (desno), primatelj (lijevo)
function metaBlok(opts) {
  const dat = opts.datum || new Date().toLocaleDateString('hr-HR', { day: 'numeric', month: 'long', year: 'numeric' }) + '.';
  const mjesto = opts.mjesto || 'Zagreb';
  const el = [];
  el.push(new Paragraph({
    children: [
      ...(opts.ur_broj ? [ new TextRun({ text: 'Ur. broj  ', size: 16, font: SANS, color: MUTED }), new TextRun({ text: opts.ur_broj, size: 16, font: MONO, color: INK }) ] : []),
      new PositionalTab({ alignment: PositionalTabAlignment.RIGHT, relativeTo: 'margin', leader: PositionalTabLeader.NONE }),
      new TextRun({ text: mjesto + ', ', size: 16, font: SANS, color: MUTED }),
      new TextRun({ text: dat, size: 16, font: MONO, color: INK }),
    ],
    spacing: { after: 300 },
  }));
  return el;
}

// Glavni ulaz: generiraj DOCX buffer
async function generirajDopisDocx({ tekst, korisnik, ur_broj, mjesto, datum }) {
  const k = korisnik || {};
  const pravna = k.tip_osobe === 'pravna';
  const header = pravna ? headerTvrtka(k) : headerFizicka(k);
  const doc = new Document({
    creator: 'ŽBUKA AI · oi.zbuka.hr',
    title: 'Dopis',
    sections: [{
      properties: { page: { margin: { top: 1080, bottom: 1080, left: 1440, right: 1440 } } },
      footers: { default: footerImpressum() },
      children: [
        ...header,
        hairline(),
        ...metaBlok({ ur_broj, mjesto, datum }),
        ...tijeloIzTeksta(tekst),
      ],
    }],
  });
  return Packer.toBuffer(doc);
}

module.exports = { generirajDopisDocx };
