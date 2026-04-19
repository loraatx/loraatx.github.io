// TourStorage — localStorage + IndexedDB wrapper for visitor interactions.
// All keys namespaced by location.pathname so multiple tours coexist safely.
//
// Exposes window.TourStorage with:
//   getVisited(stopId) / setVisited(stopId, bool)   (localStorage)
//   getNote(stopId)    / setNote(stopId, text)      (localStorage)
//   getPhoto(stopId)   / setPhoto(stopId, Blob)     (IndexedDB)
//   deletePhoto(stopId)

(function () {
  const NS = location.pathname;
  const DB_NAME = 'tourmap';
  const DB_VERSION = 1;
  const STORE = 'photos';

  let _dbPromise = null;

  function openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return _dbPromise;
  }

  function photoKey(stopId) {
    return `${NS}:${stopId}`;
  }

  async function getPhoto(stopId) {
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(photoKey(stopId));
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('TourStorage.getPhoto failed', e);
      return null;
    }
  }

  async function setPhoto(stopId, blob) {
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(blob, photoKey(stopId));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('TourStorage.setPhoto failed', e);
    }
  }

  async function deletePhoto(stopId) {
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(photoKey(stopId));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('TourStorage.deletePhoto failed', e);
    }
  }

  function lsKey(kind, stopId) {
    return `tm:${NS}:${kind}:${stopId}`;
  }

  window.TourStorage = {
    getVisited(stopId) {
      try { return localStorage.getItem(lsKey('visited', stopId)) === '1'; }
      catch { return false; }
    },
    setVisited(stopId, bool) {
      try {
        if (bool) localStorage.setItem(lsKey('visited', stopId), '1');
        else localStorage.removeItem(lsKey('visited', stopId));
      } catch {}
    },
    getNote(stopId) {
      try { return localStorage.getItem(lsKey('note', stopId)) ?? ''; }
      catch { return ''; }
    },
    setNote(stopId, text) {
      try {
        if (text && text.trim().length) localStorage.setItem(lsKey('note', stopId), text);
        else localStorage.removeItem(lsKey('note', stopId));
      } catch {}
    },
    getPhoto,
    setPhoto,
    deletePhoto,
  };
})();
