// Mətni serverə (serve.js → backend/simplify.js → Claude) göndərib B1/B2 səviyyəli sadə ingilis dilinə çevirir.
// Server cavabı NDJSON axınıdır: progress sətirləri, sonda done (text) və ya error (message).
// onProgress(done, total) — neçə hissənin hazır olduğunu göstərmək üçün (istəyə bağlı).
// Uğursuz olduqda xəta atır; çağıran tərəf kitabı translatedText: null ilə saxlaya bilər.

async function translateText(text, level, onProgress = () => {}) {
  let res;
  try {
    res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, level }),
    });
  } catch {
    throw new Error('Serverə qoşulmaq olmadı. Sayt "node serve.js" ilə açılıbmı?');
  }
  if (!res.ok || !res.body) throw new Error(`Server xətası (${res.status}).`);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += value;
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.type === 'progress') onProgress(msg.done, msg.total);
      else if (msg.type === 'done') return msg.text;
      else if (msg.type === 'error') throw new Error(msg.message);
    }
    if (done) break;
  }
  throw new Error('Server cavabı yarımçıq qaldı.');
}
