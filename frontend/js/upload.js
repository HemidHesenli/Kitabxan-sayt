const form = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');
const dropzone = document.getElementById('dropzone');
const dropzoneText = document.getElementById('dropzone-text');
const titleInput = document.getElementById('title-input');
const submitBtn = document.getElementById('submit-btn');
const statusEl = document.getElementById('status');

let selectedFile = null;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function selectFile(file) {
  if (!file) return;
  if (!/\.(pdf|docx)$/i.test(file.name)) {
    setStatus('Yalnız PDF və ya DOCX faylı seçin.', true);
    return;
  }
  selectedFile = file;
  dropzone.classList.add('has-file');
  dropzoneText.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
  if (!titleInput.value.trim()) titleInput.value = file.name.replace(/\.(pdf|docx)$/i, '');
  submitBtn.disabled = false;
  titleInput.focus();
  setStatus('');
}

fileInput.addEventListener('change', () => selectFile(fileInput.files[0]));

['dragenter', 'dragover'].forEach((type) =>
  dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  })
);
['dragleave', 'drop'].forEach((type) =>
  dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  })
);
dropzone.addEventListener('drop', (e) => selectFile(e.dataTransfer.files[0]));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedFile) return;

  const level = form.querySelector('input[name="level"]:checked').value;
  const title = titleInput.value.trim() || selectedFile.name;
  submitBtn.disabled = true;

  try {
    setStatus('Mətn çıxarılır…');
    const originalText = await extractText(selectedFile);

    setStatus(`${level} səviyyəsində sadə ingilis dilinə çevrilir…`);
    let translatedText = null;
    let translateError = null;
    try {
      translatedText = await translateText(originalText, level, (done, total) =>
        setStatus(`${level} səviyyəsində sadə ingilis dilinə çevrilir… ${done}/${total} hissə`)
      );
    } catch (err) {
      // Mətn itməsin: kitab "tərcümə gözləyir" kimi saxlanılır, sonra kitabxanadan yenidən cəhd etmək olar
      console.error(err);
      translateError = err.message;
    }

    const book = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      title,
      fileName: selectedFile.name,
      level,
      originalText,
      translatedText,
      createdAt: Date.now(),
    };
    await BookDB.save(book);

    statusEl.classList.toggle('error', Boolean(translateError));
    statusEl.innerHTML = '';
    statusEl.append(
      translateError
        ? `"${title}" saxlanıldı, amma tərcümə alınmadı: ${translateError} Kitabxanada "Tərcümə et" ilə yenidən cəhd edə bilərsiniz. `
        : `"${title}" saxlanıldı. `
    );
    const link = document.createElement('a');
    link.href = `reader.html?id=${encodeURIComponent(book.id)}`;
    link.textContent = 'İndi oxu →';
    statusEl.append(link);

    form.reset();
    selectedFile = null;
    dropzone.classList.remove('has-file');
    dropzoneText.textContent = 'Kitabı bura sürüşdür və ya seçmək üçün klikləyin…';
  } catch (err) {
    console.error(err);
    setStatus(err.message || 'Xəta baş verdi.', true);
    submitBtn.disabled = false;
  }
});
