// Kitabları brauzerin IndexedDB bazasında saxlayır.
// Kitab obyekti: { id, title, fileName, level, originalText, translatedText, createdAt }
// translatedText === null olarsa, kitab hələ tərcümə olunmayıb.

const BookDB = (() => {
  const DB_NAME = 'kitabxana';
  const STORE = 'books';
  let dbPromise = null;

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  async function run(mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
    });
  }

  return {
    save: (book) => run('readwrite', (s) => s.put(book)),
    get: (id) => run('readonly', (s) => s.get(id)),
    all: () => run('readonly', (s) => s.getAll()),
    remove: (id) => run('readwrite', (s) => s.delete(id)),
  };
})();
