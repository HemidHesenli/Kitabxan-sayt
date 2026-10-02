const PAGE_CHARS = 2500; // bir səhifəyə təxminən neçə simvol düşür

const textEl = document.getElementById('text');
const pagerEl = document.getElementById('pager');
const pageInfo = document.getElementById('page-info');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const modeBtn = document.getElementById('mode-toggle');

// localStorage brauzerdə bloklana bilər — xəta olsa, sadəcə yadda saxlamırıq.
const prefs = {
  get(key, fallback) {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  },
};

let pages = [];
let current = 0;
let mode = prefs.get('reader-mode', 'pages');
let fontSize = Number(prefs.get('reader-font', 19));
let bookId = null;

// PDF-dən gələn sətir sonlarını birləşdirib abzaslara bölür.
function toParagraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}

// Abzasları kəsmədən təxminən PAGE_CHARS ölçülü səhifələrə yığır.
function paginate(paragraphs) {
  const result = [];
  let page = [];
  let size = 0;
  for (const p of paragraphs) {
    if (size > 0 && size + p.length > PAGE_CHARS) {
      result.push(page);
      page = [];
      size = 0;
    }
    page.push(p);
    size += p.length;
  }
  if (page.length) result.push(page);
  return result;
}

function renderParagraphs(paragraphs) {
  textEl.replaceChildren(
    ...paragraphs.map((p) => {
      const el = document.createElement('p');
      el.textContent = p;
      return el;
    })
  );
}

function render() {
  if (mode === 'scroll') {
    renderParagraphs(pages.flat());
    pagerEl.hidden = true;
    modeBtn.textContent = 'Səhifə rejimi';
  } else {
    renderParagraphs(pages[current] || []);
    pagerEl.hidden = false;
    pageInfo.textContent = `${current + 1} / ${pages.length}`;
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current >= pages.length - 1;
    modeBtn.textContent = 'Scroll rejimi';
    prefs.set(`reader-page-${bookId}`, current);
  }
}

function goTo(index) {
  if (index < 0 || index >= pages.length) return;
  current = index;
  render();
  window.scrollTo({ top: 0 });
}

function applyFont() {
  document.documentElement.style.setProperty('--reader-size', `${fontSize}px`);
  prefs.set('reader-font', fontSize);
}

prevBtn.addEventListener('click', () => goTo(current - 1));
nextBtn.addEventListener('click', () => goTo(current + 1));
modeBtn.addEventListener('click', () => {
  mode = mode === 'scroll' ? 'pages' : 'scroll';
  prefs.set('reader-mode', mode);
  render();
});
document.getElementById('font-up').addEventListener('click', () => {
  fontSize = Math.min(fontSize + 1, 30);
  applyFont();
});
document.getElementById('font-down').addEventListener('click', () => {
  fontSize = Math.max(fontSize - 1, 14);
  applyFont();
});
document.addEventListener('keydown', (e) => {
  if (mode !== 'pages') return;
  if (e.key === 'ArrowRight') goTo(current + 1);
  if (e.key === 'ArrowLeft') goTo(current - 1);
});

async function init() {
  applyFont();
  bookId = new URLSearchParams(location.search).get('id');
  const book = bookId && (await BookDB.get(bookId));
  if (!book) {
    document.getElementById('book-title').textContent = 'Kitab tapılmadı';
    pagerEl.hidden = true;
    textEl.innerHTML = '<p><a href="library.html">Kitabxanaya qayıt</a></p>';
    return;
  }

  document.title = `${book.title} — Kitabxana`;
  document.getElementById('book-title').textContent = book.title;
  const levelEl = document.getElementById('book-level');
  levelEl.textContent = book.level;
  levelEl.classList.add(book.level);

  const statusEl = document.getElementById('book-status');
  if (book.translatedText) {
    statusEl.textContent = 'Tərcümə olunub';
    statusEl.classList.add('done');
  } else {
    statusEl.textContent = 'Tərcümə gözləyir';
    statusEl.classList.add('pending');
    const notice = document.getElementById('notice');
    notice.textContent = 'Bu kitab hələ tərcümə olunmayıb — orijinal mətn göstərilir.';
    notice.hidden = false;
  }

  pages = paginate(toParagraphs(book.translatedText || book.originalText));
  current = Math.min(Number(prefs.get(`reader-page-${bookId}`, 0)) || 0, pages.length - 1);
  render();
}

init();
