const listEl = document.getElementById('book-list');
const emptyEl = document.getElementById('empty');

function badge(text, cls) {
  const el = document.createElement('span');
  el.className = `badge ${cls}`;
  el.textContent = text;
  return el;
}

function renderBook(book) {
  const item = document.createElement('div');
  item.className = 'book';

  const info = document.createElement('div');
  const title = document.createElement('p');
  title.className = 'book-title';
  title.textContent = book.title;

  const meta = document.createElement('div');
  meta.className = 'book-meta';
  meta.append(
    badge(book.level, book.level),
    book.translatedText
      ? badge('Tərcümə olunub', 'done')
      : badge('Tərcümə gözləyir', 'pending')
  );
  const date = document.createElement('span');
  date.className = 'muted small';
  date.textContent = new Date(book.createdAt).toLocaleDateString('az-AZ');
  meta.append(date);
  info.append(title, meta);

  const actions = document.createElement('div');
  actions.className = 'book-actions';
  const read = document.createElement('a');
  read.className = 'btn primary';
  read.href = `reader.html?id=${encodeURIComponent(book.id)}`;
  read.textContent = 'Oxu';
  const del = document.createElement('button');
  del.className = 'btn danger';
  del.textContent = 'Sil';
  del.addEventListener('click', async () => {
    if (!confirm(`"${book.title}" silinsin?`)) return;
    await BookDB.remove(book.id);
    load();
  });
  actions.append(read, del);

  if (!book.translatedText) {
    const tr = document.createElement('button');
    tr.className = 'btn';
    tr.textContent = 'Tərcümə et';
    tr.addEventListener('click', async () => {
      tr.disabled = del.disabled = true;
      tr.textContent = 'Çevrilir…';
      try {
        book.translatedText = await translateText(book.originalText, book.level, (done, total) => {
          tr.textContent = `Çevrilir… ${done}/${total}`;
        });
        await BookDB.save(book);
        load();
      } catch (err) {
        alert(`Tərcümə alınmadı: ${err.message}`);
        tr.disabled = del.disabled = false;
        tr.textContent = 'Tərcümə et';
      }
    });
    actions.prepend(tr);
  }

  item.append(info, actions);
  return item;
}

async function load() {
  const books = (await BookDB.all()).sort((a, b) => b.createdAt - a.createdAt);
  listEl.replaceChildren(...books.map(renderBook));
  emptyEl.hidden = books.length > 0;
}

load();
