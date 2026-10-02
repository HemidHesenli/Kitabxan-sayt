// Saytı lokal açmaq üçün kiçik server: node serve.js [port]
// Statik faylları verir və POST /api/translate ilə mətni Claude vasitəsilə sadə ingilis dilinə çevirir.
const http = require('http');
const fs = require('fs');
const path = require('path');

try {
  process.loadEnvFile(path.join(__dirname, '..', '.env'));
} catch {
  // .env yoxdur — tərcümə sorğusu açarın olmadığını bildirəcək
}
const { simplifyText } = require('../backend/simplify');

const root = __dirname;
const port = Number(process.argv[2] || 8765);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };
const MAX_BODY = 20 * 1024 * 1024;

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('Mətn çox böyükdür (20 MB-dan çox).')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('Sorğu JSON deyil.')); }
    });
    req.on('error', reject);
  });
}

// Cavab NDJSON axınıdır: {type:"progress",done,total} … sonra {type:"done",text} və ya {type:"error",message}
async function handleTranslate(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' });
  const send = (obj) => res.write(JSON.stringify(obj) + '\n');
  try {
    const { text, level } = await readJson(req);
    if (typeof text !== 'string' || !text.trim()) throw new Error('Mətn boşdur.');
    const started = Date.now();
    const result = await simplifyText(text, level, (done, total) => send({ type: 'progress', done, total }));
    console.log(
      `Tərcümə (${level}): ${text.length} simvol, ${result.chunks} hissə, ` +
      `${result.usage.input}+${result.usage.output} token, ~$${result.cost.toFixed(3)}, ${((Date.now() - started) / 1000).toFixed(0)} san.`
    );
    send({ type: 'done', text: result.text });
  } catch (err) {
    console.error('Tərcümə xətası:', err.message);
    send({ type: 'error', message: err.message });
  }
  res.end();
}

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/api/translate' && req.method === 'POST') return handleTranslate(req, res);
  if (p === '/') p = '/index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, () => console.log(`http://localhost:${port}`));
