// ⭐ v141 — PDF generator za dopise (sibling dopis-docx.js). Ovisi o npm 'pdfkit' + TTF font s HR
// dijakritikom u /fonts/ (DejaVuSans.ttf + DejaVuSans-Bold.ttf) — oboje lazy U funkciji (nedostatak NE ruši boot).
// ⭐ v141 FIX: footer se crta uz privremeno margins.bottom=0 (inače je pdfkit dodavao prazne stranice).
// ⭐ v141 DIZAJN: pročišćen letterhead — hairline pod zaglavljem, tracked labele, izražajniji PREDMET, potpisni blok.
'use strict';
const fs = require('fs');
const path = require('path');

const INK = '#1E2228', BRAND = '#1F3A5F', MUTED = '#6B6F76', FAINT = '#9AA0A6', HAIR = '#E2E4E8';

function nadjiFont(imena) {
  const dir = path.join(__dirname, 'fonts');
  for (const im of imena) { try { const p = path.join(dir, im); if (fs.existsSync(p)) return p; } catch (_) {} }
  return null;
}

function blokovi(tekst) {
  const linije = String(tekst || '').replace(/\r/g, '').split('\n');
  const out = []; let blok = [];
  const flush = () => {
    if (!blok.length) return;
    const t = blok.join(' ').trim(); blok = [];
    if (!t) return;
    const m = t.match(/^PREDMET\s*:?\s*(.*)$/i);
    if (m) { out.push({ tip: 'predmet', tekst: m[1].trim() }); return; }
    if (/^(s\s+poštovanjem|srdačan pozdrav|s\s+štovanjem)/i.test(t)) { out.push({ tip: 'potpis', tekst: t }); return; }
    out.push({ tip: 'para', tekst: t });
  };
  for (const l of linije) { if (l.trim() === '') flush(); else blok.push(l.trim()); }
  flush();
  return out;
}

async function generirajDopisPdf({ tekst, korisnik, ur_broj, mjesto, datum }) {
  let PDFDocument;
  try { PDFDocument = require('pdfkit'); }
  catch (_) { throw new Error('PDF izvoz treba npm paket "pdfkit" — dodaj ga u package.json i redeploy.'); }
  const regular = nadjiFont(['DejaVuSans.ttf', 'NotoSans-Regular.ttf', 'LiberationSans-Regular.ttf']);
  const bold = nadjiFont(['DejaVuSans-Bold.ttf', 'NotoSans-Bold.ttf', 'LiberationSans-Bold.ttf']);
  if (!regular) throw new Error('PDF izvoz treba font s hrvatskim znakovima u /fonts/ (dodaj DejaVuSans.ttf i DejaVuSans-Bold.ttf).');

  const k = korisnik || {};
  const pravna = k.tip_osobe === 'pravna';
  const doc = new PDFDocument({ size: 'A4', margins: { top: 74, bottom: 78, left: 70, right: 70 },
    bufferPages: true, info: { Title: 'Dopis', Author: 'ŽBUKA AI · oi.zbuka.hr' } });
  doc.registerFont('reg', regular);
  doc.registerFont('bold', bold || regular);

  const chunks = [];
  const gotovo = new Promise((res, rej) => {
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => res(Buffer.concat(chunks)));
    doc.on('error', rej);
  });

  const L = doc.page.margins.left, R = doc.page.width - doc.page.margins.right, W = R - L;

  // ── ZAGLAVLJE: naziv + kontakt, s tankom brand-crtom lijevo i hairline ispod ──
  const naziv = pravna ? (k.naplatni_naziv || 'Tvrtka') : (k.naplatni_naziv || k.ime || 'Ime i prezime');
  const adrGrad = [k.adresa, k.grad ? ((k.posta ? k.posta + ' ' : '') + k.grad) : ''].filter(Boolean).join(', ');
  const linija2 = [adrGrad, k.oib ? 'OIB ' + k.oib : '', pravna ? (k.email || '') : ''].filter(Boolean).join('   ·   ');
  const hdrTop = doc.y;
  doc.font('bold').fontSize(pravna ? 15 : 18).fillColor(INK).text(naziv, L + 16, hdrTop, { width: W - 16 });
  if (linija2) doc.font('reg').fontSize(9).fillColor(MUTED).text(linija2, L + 16, doc.y + 3, { width: W - 16 });
  const hdrBottom = doc.y;
  doc.save().rect(L, hdrTop + 1, 3.5, Math.max(hdrBottom - hdrTop - 2, 12)).fill(pravna ? BRAND : INK).restore();
  doc.moveDown(0.9);
  const ruleY = doc.y;
  doc.save().moveTo(L, ruleY).lineTo(R, ruleY).lineWidth(0.75).strokeColor(HAIR).stroke().restore();
  doc.moveDown(1.1);

  // ── META: ur.broj (lijevo) + mjesto/datum (desno) ──
  const dat = datum || (new Date().toLocaleDateString('hr-HR', { day: 'numeric', month: 'long', year: 'numeric' }) + '.');
  const mj = mjesto || 'Zagreb';
  const metaY = doc.y;
  if (ur_broj) doc.font('reg').fontSize(9).fillColor(MUTED).text('Ur. broj  ' + ur_broj, L, metaY, { width: W / 2 });
  doc.font('reg').fontSize(9).fillColor(INK).text(mj + ', ' + dat, L, metaY, { width: W, align: 'right' });
  doc.moveDown(2.0);

  // ── TIJELO ──
  for (const b of blokovi(tekst)) {
    if (b.tip === 'predmet') {
      doc.moveDown(0.2);
      const py = doc.y;
      doc.font('bold').fontSize(8).fillColor(BRAND).text('PREDMET', L + 16, py, { characterSpacing: 2 });
      doc.font('bold').fontSize(14).fillColor(INK).text(b.tekst, L + 16, doc.y + 2, { width: W - 16, lineGap: 1 });
      doc.save().rect(L, py - 1, 3.5, Math.max(doc.y - (py - 1), 14)).fill(BRAND).restore();
      doc.moveDown(1.2);
    } else if (b.tip === 'potpis') {
      doc.moveDown(1.6);
      doc.font('reg').fontSize(11).fillColor(INK).text(b.tekst, L, doc.y, { width: W, lineGap: 3 });
    } else {
      doc.font('reg').fontSize(11).fillColor(INK).text(b.tekst, L, doc.y, { width: W, align: 'justify', lineGap: 3.5 });
      doc.moveDown(0.8);
    }
  }

  // ── FOOTER-IMPRESSUM na svakoj stranici (margins.bottom=0 da pdfkit ne dodaje prazne stranice) ──
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const staraMargina = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // ⭐ v141 — ključni fix za prazne stranice
    const fy = doc.page.height - 56;
    doc.save().moveTo(L, fy - 8).lineTo(R, fy - 8).lineWidth(0.5).strokeColor(HAIR).stroke().restore();
    doc.font('reg').fontSize(7.5).fillColor(FAINT)
      .text('Izrađeno putem oi.zbuka.hr   ·   ŽBUKA AI  ·  ŽBUKA Čakarić d.o.o.', L, fy, { width: W - 40, lineBreak: false });
    if (range.count > 1) doc.font('reg').fontSize(7.5).fillColor(FAINT)
      .text((i - range.start + 1) + ' / ' + range.count, R - 40, fy, { width: 40, align: 'right', lineBreak: false });
    doc.page.margins.bottom = staraMargina;
  }

  doc.end();
  return gotovo;
}

module.exports = { generirajDopisPdf };
