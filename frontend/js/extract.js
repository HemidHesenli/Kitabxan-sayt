// PDF (pdf.js) və DOCX (mammoth.js) fayllarından mətn çıxarır.
// Abzaslar boş sətirlə ("\n\n") ayrılır.

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// PDF-də abzaslar arasında boş sətir olmur — onları sətirlər arasındakı
// adi boşluqdan böyük olan şaquli məsafəyə görə tanıyırıq.
function pdfPageText(items) {
  const lines = [];
  let text = '';
  let y = null;
  for (const item of items) {
    if (y === null && item.str.trim()) y = item.transform[5];
    text += item.str;
    if (item.hasEOL) {
      if (text.trim()) lines.push({ text: text.trim(), y });
      text = '';
      y = null;
    }
  }
  if (text.trim()) lines.push({ text: text.trim(), y });

  const gaps = lines.slice(1).map((line, i) => Math.abs(lines[i].y - line.y));
  const typical = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] || 0;

  return lines
    .map((line, i) => (i > 0 && gaps[i - 1] > typical * 1.3 ? '\n\n' : i > 0 ? '\n' : '') + line.text)
    .join('');
}

async function extractPdf(file) {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    pages.push(pdfPageText(content.items));
  }
  return pages.filter(Boolean).join('\n\n');
}

async function extractDocx(file) {
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

async function extractText(file) {
  const name = file.name.toLowerCase();
  let text;
  if (name.endsWith('.pdf')) text = await extractPdf(file);
  else if (name.endsWith('.docx')) text = await extractDocx(file);
  else throw new Error('Yalnız PDF və DOCX faylları dəstəklənir.');

  text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) {
    throw new Error('Fayldan mətn çıxarıla bilmədi. Skan edilmiş (şəkil) PDF ola bilər.');
  }
  return text;
}
