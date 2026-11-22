// Kleiner Helfer für IndexedDB – die Datenbank, die der Browser auf dem Gerät
// bereitstellt. Hier wird nur geöffnet, gelesen und geschrieben; was die Daten
// bedeuten, steht in data.js.

const DB_NAME = 'hundeschule';
const DB_VERSION = 3;

let dbPromise = null;

/**
 * Datenbank-Aufbau. Für neue Bereiche (z. B. Rechnungen) die Version oben
 * erhöhen und hier einen weiteren Block ergänzen – bestehende Daten bleiben.
 */
function upgrade(db, oldVersion) {
  if (oldVersion < 1) {
    db.createObjectStore('bookings', { keyPath: 'id' });   // Buchungen
    db.createObjectStore('categories', { keyPath: 'id' }); // Kategorien
    db.createObjectStore('receipts', { keyPath: 'id' });   // Belegfotos
    db.createObjectStore('tombstones', { keyPath: 'id' }); // Merkzettel für Gelöschtes (fürs Zusammenführen)
    db.createObjectStore('meta', { keyPath: 'key' });      // Einstellungen u. Ä.
  }
  if (oldVersion < 2) {
    db.createObjectStore('contacts', { keyPath: 'id' });   // Kund:innen
  }
  if (oldVersion < 3) {
    db.createObjectStore('products', { keyPath: 'id' }); // Preisliste
    db.createObjectStore('routes', { keyPath: 'id' });   // häufige Strecken
    db.createObjectStore('invoices', { keyPath: 'id' }); // Rechnungen & Quittungen
    db.createObjectStore('vouchers', { keyPath: 'id' }); // Gutscheine
    db.createObjectStore('cards', { keyPath: 'id' });    // 10er-Karten
    db.createObjectStore('courses', { keyPath: 'id' });  // Gruppenkurse
  }
  // Für spätere Erweiterungen: if (oldVersion < 4) { ... }
}

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in self)) {
      reject(new Error('Dieser Browser bietet keinen lokalen Speicher (IndexedDB) an.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => upgrade(req.result, event.oldVersion);
    req.onsuccess = () => {
      const db = req.result;
      // Falls eine neuere App-Version in einem anderen Tab die Datenbank umbaut
      db.onversionchange = () => { db.close(); location.reload(); };
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error('Datenbank konnte nicht geöffnet werden.'));
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function done(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll(store) {
  const db = await openDB();
  return done(db.transaction(store).objectStore(store).getAll());
}

export async function getAllKeys(store) {
  const db = await openDB();
  return done(db.transaction(store).objectStore(store).getAllKeys());
}

export async function get(store, key) {
  const db = await openDB();
  return done(db.transaction(store).objectStore(store).get(key));
}

/**
 * Schreibt in einer einzigen Transaktion: Entweder klappt alles oder nichts.
 * `fn` bekommt ein Objekt mit den Stores und muss die Befehle sofort
 * (ohne await) absetzen.
 */
export async function write(storeNames, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite');
    const stores = {};
    for (const name of storeNames) stores[name] = tx.objectStore(name);
    let result;
    try {
      result = fn(stores);
    } catch (err) {
      try { tx.abort(); } catch { /* schon beendet */ }
      reject(err);
      return;
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Speichern abgebrochen.'));
  });
}
