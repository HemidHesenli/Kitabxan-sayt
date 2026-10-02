// Word (.docx) və PDF fayllarını Azure Translator ilə Azərbaycan dilinə çevirir (mənbə dili avtomatik tanınır).
// derman-sayti/tools/translate-doc.js əsasında; orada istiqamət az → en idi.
//
//   node tools/translate-doc.js <fayl.docx|fayl.pdf> [başqa fayllar…]           tərcümə et
//   node tools/translate-doc.js <fayl.docx|fayl.pdf> --count                     yalnız simvolları say (limit xərclənmir)
//
// Nəticə eyni qovluqda, eyni formatda yazılır: ad.docx → ad.az.docx, ad.pdf → ad.az.pdf
// .docx: hər abzasın mətni tərcümə olunur, format (qalın/kursiv, başlıqlar, cədvəllər, şəkillər) qalır.
// .pdf: mətn çıxarılıb abzaslara bölünür və yeni PDF-ə yazılır — hər orijinal səhifə yeni səhifədən başlayır,
//       amma PDF-in tərtibatı (sütunlar, şəkillər, şriftlər) qorunmur.
// Açar layihə kökündəki .env-dən oxunur (AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
  // .env yoxdur — aşağıda açar yoxlanılır
}

const TO = 'az';
// `from` verilmir — Azure mənbə dilini özü tanıyır
const AZURE_URL = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${TO}`;
// Azure bir sorğuda 50 000 simvola qədər qəbul edir; pulsuz planda kiçik paketlər daha az 429 verir
const BATCH_CHARS = 10000;
const BATCH_ITEMS = 100;
const MONTHLY_FREE_CHARS = 2000000;

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const DOCX_PARTS = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;

// PDF üçün Azərbaycan hərflərini (ə, ğ, ı, ş…) dəstəkləyən Windows şriftləri
const FONTS_DIR = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts');
const PDF_FONT = ['arial.ttf', 'segoeui.ttf', 'calibri.ttf'].map((f) => path.join(FONTS_DIR, f)).find(fs.existsSync);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Azure ---

async function translateBatch(texts, textType) {
  const headers = { 'Ocp-Apim-Subscription-Key': process.env.AZURE_TRANSLATOR_KEY, 'Content-Type': 'application/json' };
  const region = process.env.AZURE_TRANSLATOR_REGION;
  if (region && region.toLowerCase() !== 'global') headers['Ocp-Apim-Subscription-Region'] = region;

  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${AZURE_URL}&textType=${textType}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(texts.map((Text) => ({ Text }))),
    });
    if (res.ok) return (await res.json()).map((r) => r.translations[0].text);
    if (res.status === 429 && attempt < 6) {
      const wait = Number(res.headers.get('retry-after')) || 10 * attempt;
      console.log(`  Azure limiti (429) — ${wait} saniyə gözlənilir…`);
      await sleep(wait * 1000);
      continue;
    }
    if (res.status === 401) throw new Error('Azure açarı yanlışdır (401). .env faylını yoxlayın.');
    if (res.status === 403) throw new Error('Azure aylıq pulsuz limiti bitib və ya giriş qadağandır (403).');
    throw new Error(`Azure xətası ${res.status}: ${await res.text()}`);
  }
}

// Mətnləri paketlərə bölüb tərcümə edir, sıranı saxlayır
async function translateAll(texts, textType) {
  const out = [];
  let batch = [];
  let size = 0;
  const flush = async () => {
    if (!batch.length) return;
    out.push(...(await translateBatch(batch, textType)));
    process.stdout.write(`\r  Tərcümə olunub: ${out.length}/${texts.length} abzas`);
    batch = [];
    size = 0;
  };
  for (const t of texts) {
    if (batch.length && (size + t.length > BATCH_CHARS || batch.length >= BATCH_ITEMS)) await flush();
    batch.push(t);
    size += t.length;
  }
  await flush();
  if (texts.length) process.stdout.write('\n');
  return out;
}

// --- .docx ---

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unescapeHtml = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const stripTags = (s) => s.replace(/<[^>]*>/g, '');

// Abzasın öz <w:t> düyünləri (mətn qutusundakı daxili abzaslarınkı yox — onlar ayrıca işlənir)
function ownTextNodes(p) {
  return Array.from(p.getElementsByTagNameNS(W_NS, 't')).filter((t) => {
    let a = t.parentNode;
    while (a && !(a.namespaceURI === W_NS && a.localName === 'p')) a = a.parentNode;
    return a === p;
  });
}

// Azure sonu durğu işarəsiz qısa ifadələri bəzən uydurur; müvəqqəti nöqtə bunu düzəldir
const needsDot = (text) => !/[.!?:;…]\s*$/.test(text);
const dropAddedDot = (text) => text.replace(/\.(\s*)$/, '$1');

// Hər mətn parçası <span id="i"> ilə göndərilir ki, Azure tərcüməni eyni parçalara (qalın, kursiv…) qaytarsın
function paragraphToHtml(nodes) {
  const html = nodes
    .map((n, i) => (n.textContent.trim() ? `<span id="${i}">${escapeHtml(n.textContent)}</span>` : ''))
    .join('');
  return needsDot(nodes.map((n) => n.textContent).join('')) ? `${html}.` : html;
}

function applyTranslation(nodes, html, addedDot) {
  const parts = new Array(nodes.length).fill(null);
  const re = /<span id="(\d+)">([\s\S]*?)<\/span>/g;
  let last = 0;
  let prev = null;
  let lead = '';
  for (let m; (m = re.exec(html)); ) {
    const gap = unescapeHtml(stripTags(html.slice(last, m.index))); // spanlar arasındakı boşluq və s.
    if (prev === null) lead += gap;
    else parts[prev] += gap;
    const i = Number(m[1]);
    if (i < nodes.length) {
      parts[i] = (parts[i] || '') + unescapeHtml(stripTags(m[2]));
      prev = i;
    }
    last = re.lastIndex;
  }
  const tail = unescapeHtml(stripTags(html.slice(last)));

  const used = parts.map((p, i) => (p !== null ? i : -1)).filter((i) => i >= 0);
  if (!used.length) {
    // Azure teqləri saxlamayıbsa — bütün tərcümə birinci parçaya
    const first = nodes.findIndex((n) => n.textContent.trim());
    parts[first] = unescapeHtml(stripTags(html));
  } else {
    parts[used[0]] = lead + parts[used[0]];
    parts[used[used.length - 1]] += tail;
  }

  // Müvəqqəti nöqtəni sil, parçaların qovşağında yaranan ikiqat boşluqları təmizlə
  const filled = parts.map((p, i) => (p !== null ? i : -1)).filter((i) => i >= 0);
  if (addedDot && filled.length) {
    const lastIdx = filled[filled.length - 1];
    parts[lastIdx] = dropAddedDot(parts[lastIdx]);
  }
  filled.forEach((i, k) => {
    parts[i] = parts[i].replace(/ {2,}/g, ' ');
    if (k > 0 && parts[filled[k - 1]].endsWith(' ')) parts[i] = parts[i].replace(/^ +/, '');
  });

  nodes.forEach((n, i) => {
    if (!n.textContent.trim()) return; // yalnız boşluq olan parçalar olduğu kimi qalır
    n.textContent = parts[i] || '';
    n.setAttribute('xml:space', 'preserve');
  });
}

async function translateDocx(file, countOnly) {
  const JSZip = require('jszip');
  const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const parts = [];
  for (const name of Object.keys(zip.files).filter((n) => DOCX_PARTS.test(n))) {
    const doc = new DOMParser().parseFromString(await zip.file(name).async('string'), 'text/xml');
    const paragraphs = Array.from(doc.getElementsByTagNameNS(W_NS, 'p'))
      .map(ownTextNodes)
      .filter((nodes) => nodes.some((n) => n.textContent.trim()));
    parts.push({ name, doc, paragraphs });
  }

  const all = parts.flatMap((p) => p.paragraphs);
  const html = all.map(paragraphToHtml);
  const chars = all.reduce((s, nodes) => s + nodes.reduce((t, n) => t + n.textContent.length, 0), 0);
  report(all.length, chars);
  if (countOnly) return null;

  const translated = await translateAll(html, 'html');
  all.forEach((nodes, i) => applyTranslation(nodes, translated[i], html[i].endsWith('.')));

  for (const { name, doc } of parts) zip.file(name, new XMLSerializer().serializeToString(doc));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// --- .pdf ---

// PDF mətni sətir-sətir gəlir; sətirləri abzaslara birləşdirir
function linesToParagraphs(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const longest = Math.max(0, ...lines.map((l) => l.length));
  const paragraphs = [];
  let cur = '';
  const push = () => {
    if (cur.trim()) paragraphs.push(cur.trim());
    cur = '';
  };
  for (const line of lines) {
    if (!line) { push(); continue; }
    if (/^([•▪●◦\-–]|\d+[.)])\s/.test(line)) push(); // siyahı bəndi yeni abzasdır
    if (cur.endsWith('-')) cur = cur.slice(0, -1) + line; // sətir sonunda hecalanma
    else cur = cur ? `${cur} ${line}` : line;
    // Durğu işarəsi ilə bitən və ya qısa sətir (başlıq, abzasın son sətri) abzası bitirir
    if (/[.!?:;]$/.test(line) || line.length < longest * 0.6) push();
  }
  push();
  return paragraphs;
}

// Tərcümə olunmuş abzaslardan PDF yaradır; hər orijinal səhifə yeni səhifədən başlayır
function buildPdf(pages, title) {
  if (!PDF_FONT) throw new Error(`PDF üçün şrift tapılmadı (${FONTS_DIR} içində arial.ttf, segoeui.ttf və ya calibri.ttf).`);
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: 'A4', margin: 64, info: { Title: title } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.font(PDF_FONT).fontSize(11.5);
  pages.forEach((paras, i) => {
    if (i > 0) doc.addPage();
    for (const text of paras) doc.text(text, { lineGap: 2, paragraphGap: 8 });
  });
  doc.end();
  return done;
}

async function translatePdf(file, countOnly) {
  const { PDFParse } = require('pdf-parse');
  const parser = new PDFParse({ data: fs.readFileSync(file) });
  let result;
  try {
    result = await parser.getText();
  } finally {
    await parser.destroy();
  }

  const pages = result.pages.map((p) => linesToParagraphs(p.text));
  const all = pages.flat();
  const chars = all.reduce((s, p) => s + p.length, 0);
  if (chars < 20) {
    throw new Error('Bu PDF-də oxuna bilən mətn yoxdur (çox güman ki, skan edilib). Belə fayllar üçün əvvəlcə OCR lazımdır.');
  }
  report(all.length, chars);
  if (countOnly) return null;

  const translated = (await translateAll(all.map((p) => (needsDot(p) ? `${p}.` : p)), 'plain')).map((t, i) =>
    needsDot(all[i]) ? dropAddedDot(t) : t
  );
  let k = 0;
  const translatedPages = pages.map((paras) => paras.map(() => translated[k++]));
  return buildPdf(translatedPages, path.basename(file, '.pdf'));
}

// --- CLI ---

function report(paragraphs, chars) {
  const pct = ((chars / MONTHLY_FREE_CHARS) * 100).toFixed(2);
  console.log(`  ${paragraphs} abzas, ${chars.toLocaleString('az')} simvol (aylıq pulsuz limitin ~${pct}%-i)`);
}

async function translateFile(file, countOnly) {
  if (!fs.existsSync(file)) throw new Error(`Fayl tapılmadı: ${file}`);
  const ext = path.extname(file).toLowerCase();
  if (ext !== '.docx' && ext !== '.pdf') {
    throw new Error('Yalnız .docx və .pdf dəstəklənir. Köhnə .doc faylını Word-də "Save As → .docx" ilə çevirin.');
  }

  console.log(`${path.basename(file)} oxunur…`);
  const buffer = ext === '.docx' ? await translateDocx(file, countOnly) : await translatePdf(file, countOnly);
  if (!buffer) return;

  // ad.docx → ad.az.docx, ad.pdf → ad.az.pdf
  const out = path.join(path.dirname(file), `${path.basename(file, path.extname(file))}.${TO}${ext}`);
  fs.writeFileSync(out, buffer);
  console.log(`Hazırdır: ${out}`);
}

async function main() {
  const args = process.argv.slice(2);
  const countOnly = args.includes('--count');
  const files = args.filter((a) => !a.startsWith('--'));
  if (!files.length) {
    console.log('İstifadə: node tools/translate-doc.js <fayl.docx|fayl.pdf> [başqa fayllar…] [--count]');
    process.exit(1);
  }
  if (!countOnly && !process.env.AZURE_TRANSLATOR_KEY) throw new Error('AZURE_TRANSLATOR_KEY .env faylında yoxdur.');

  let failed = 0;
  for (const file of files) {
    try {
      await translateFile(file, countOnly);
    } catch (err) {
      failed++;
      console.error(`Xəta (${path.basename(file)}): ${err.message}`);
    }
  }
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(`Xəta: ${err.message}`);
  process.exit(1);
});
