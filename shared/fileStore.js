/* IndexedDB-based file store for export packaging. */
(function () {
  const DB_NAME = "sos_portfolio_files_v1";
  const DB_VERSION = 1;
  const STORE = "files";

  let scopePrefix = "";

  function setScope(scopeRoot) {
    scopePrefix = scopeRoot ? `${String(scopeRoot)}::` : "";
  }

  function toStoreKey(itemId) {
    return `${scopePrefix}${itemId}`;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("Failed to open IndexedDB"));
    });
  }

  function withStore(mode, fn) {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, mode);
          const store = tx.objectStore(STORE);
          const result = fn(store);
          tx.oncomplete = () => {
            db.close();
            resolve(result);
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error || new Error("IndexedDB transaction failed"));
          };
        }),
    );
  }

  function putFile(key, file) {
    // Store as Blob to avoid base64 bloat.
    const record = {
      key: toStoreKey(key),
      name: file.name,
      type: file.type || "application/octet-stream",
      lastModified: file.lastModified || null,
      size: file.size || null,
      blob: file,
      savedAt: new Date().toISOString(),
    };
    return withStore("readwrite", (store) => store.put(record));
  }

  function getFile(key) {
    return withStore("readonly", (store) => {
      return new Promise((resolve, reject) => {
        const req = store.get(toStoreKey(key));
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error || new Error("IndexedDB get failed"));
      });
    });
  }

  function deleteFile(key) {
    return withStore("readwrite", (store) => store.delete(toStoreKey(key)));
  }

  function clearAll() {
    return withStore("readwrite", (store) => store.clear());
  }

  function clearCurrentScope() {
    const prefix = scopePrefix;
    if (!prefix) {
      return clearAll();
    }
    return withStore("readwrite", (store) => {
      return new Promise((resolve, reject) => {
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            if (String(cursor.key).startsWith(prefix)) {
              cursor.delete();
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        req.onerror = () => reject(req.error || new Error("cursor failed"));
      });
    });
  }

  window.PortfolioFileStore = {
    setScope,
    putFile,
    getFile,
    deleteFile,
    clearAll,
    clearCurrentScope,
  };
})();

