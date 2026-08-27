/*
 * Storage for GM-created content (custom handouts and custom music tracks).
 *
 * Everything here is local to this browser/device: it uses IndexedDB to keep
 * uploaded images and audio files as Blobs. Nothing is uploaded anywhere.
 *
 * This module is loaded by BOTH index.html (GM Dashboard) and player.html
 * (Public Screen). IndexedDB is scoped per browser origin, not per window,
 * so the Public Screen can open the same database and read the same Blobs
 * the GM saved — without ever needing to send a Blob across BroadcastChannel
 * or localStorage (neither is a good fit for that: BroadcastChannel can
 * technically carry a Blob but localStorage cannot, and the fallback path
 * needs to keep working).
 *
 * Object URLs created with URL.createObjectURL() are only valid in the
 * window/document that created them, so each window resolves its own object
 * URL from the shared Blob instead of trying to reuse one made elsewhere.
 */
(function () {
  const DB_NAME = "the-outsider-storage-v1";
  const DB_VERSION = 1;
  const HANDOUT_STORE = "customHandouts";
  const TRACK_STORE = "customTracks";

  let dbPromise = null;
  const objectUrlCache = { handout: new Map(), track: new Map() };

  function openDatabase() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB is not available in this browser."));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(HANDOUT_STORE)) {
          db.createObjectStore(HANDOUT_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(TRACK_STORE)) {
          db.createObjectStore(TRACK_STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open local storage."));
    });
    return dbPromise;
  }

  function withStore(storeName, mode, callback) {
    return openDatabase().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const result = callback(store);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error("Local storage operation failed."));
      tx.onabort = () => reject(tx.error || new Error("Local storage operation was aborted."));
    }));
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function makeId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return `${prefix}-${window.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function invalidateObjectUrl(kind, id) {
    const cache = objectUrlCache[kind];
    const existing = cache.get(id);
    if (existing) {
      URL.revokeObjectURL(existing);
      cache.delete(id);
    }
  }

  // ---- Handouts -------------------------------------------------------

  function addHandout({ title, category, blob }) {
    const record = { id: makeId("handout"), title, category, blob, createdAt: Date.now() };
    return withStore(HANDOUT_STORE, "readwrite", (store) => store.put(record)).then(() => record.id);
  }

  function updateHandout(id, { title, category, blob } = {}) {
    return withStore(HANDOUT_STORE, "readwrite", (store) => {
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (!existing) return;
        if (title !== undefined) existing.title = title;
        if (category !== undefined) existing.category = category;
        if (blob !== undefined) {
          existing.blob = blob;
          invalidateObjectUrl("handout", id);
        }
        store.put(existing);
      };
      return getRequest;
    });
  }

  function deleteHandout(id) {
    invalidateObjectUrl("handout", id);
    return withStore(HANDOUT_STORE, "readwrite", (store) => store.delete(id));
  }

  function getAllHandouts() {
    return withStore(HANDOUT_STORE, "readonly", (store) => requestToPromise(store.getAll())).then((result) => result);
  }

  function getHandoutObjectURL(id) {
    const cached = objectUrlCache.handout.get(id);
    if (cached) return Promise.resolve(cached);
    return withStore(HANDOUT_STORE, "readonly", (store) => requestToPromise(store.get(id))).then((record) => {
      if (!record || !record.blob) return null;
      const url = URL.createObjectURL(record.blob);
      objectUrlCache.handout.set(id, url);
      return url;
    });
  }

  // ---- Tracks -----------------------------------------------------------

  function addTrack({ name, blob }) {
    const record = { id: makeId("track"), name, blob, createdAt: Date.now() };
    return withStore(TRACK_STORE, "readwrite", (store) => store.put(record)).then(() => record.id);
  }

  function updateTrack(id, { name, blob } = {}) {
    return withStore(TRACK_STORE, "readwrite", (store) => {
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (!existing) return;
        if (name !== undefined) existing.name = name;
        if (blob !== undefined) {
          existing.blob = blob;
          invalidateObjectUrl("track", id);
        }
        store.put(existing);
      };
      return getRequest;
    });
  }

  function deleteTrack(id) {
    invalidateObjectUrl("track", id);
    return withStore(TRACK_STORE, "readwrite", (store) => store.delete(id));
  }

  function getAllTracks() {
    return withStore(TRACK_STORE, "readonly", (store) => requestToPromise(store.getAll())).then((result) => result);
  }

  function getTrackObjectURL(id) {
    const cached = objectUrlCache.track.get(id);
    if (cached) return Promise.resolve(cached);
    return withStore(TRACK_STORE, "readonly", (store) => requestToPromise(store.get(id))).then((record) => {
      if (!record || !record.blob) return null;
      const url = URL.createObjectURL(record.blob);
      objectUrlCache.track.set(id, url);
      return url;
    });
  }

  window.OutsiderStorage = {
    addHandout, updateHandout, deleteHandout, getAllHandouts, getHandoutObjectURL,
    addTrack, updateTrack, deleteTrack, getAllTracks, getTrackObjectURL
  };
})();
