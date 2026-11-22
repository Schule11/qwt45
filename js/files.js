// Dateien an den Nutzer geben: auf dem Handy über "Teilen"
// (iPhone: "In Dateien sichern", Mail, AirDrop …), am Laptop als Download.

import { isTouchDevice } from './ui.js';

export function canShareFile(file) {
  try {
    return !!(navigator.canShare && navigator.canShare({ files: [file] }));
  } catch {
    return false;
  }
}

/** Soll auf diesem Gerät geteilt (statt heruntergeladen) werden? */
export function prefersShare(file) {
  return isTouchDevice() && canShareFile(file);
}

export function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * Gibt die Datei weiter. MUSS direkt im Tipp-Handler aufgerufen werden
 * (ohne await davor), sonst blockiert das iPhone das Teilen-Menü.
 * Ruft onDone(true) auf, wenn geteilt/heruntergeladen wurde.
 */
export function saveFile(file, onDone = () => {}) {
  if (prefersShare(file)) {
    navigator.share({ files: [file], title: file.name })
      .then(() => onDone(true))
      .catch((err) => {
        if (err?.name === 'AbortError') { onDone(false); return; } // abgebrochen
        downloadFile(file);
        onDone(true);
      });
  } else {
    downloadFile(file);
    onDone(true);
  }
}

/** Datei ansehen: iPhone über das Teilen-Menü (mit Vorschau), Laptop in neuem Tab */
export function openFile(file) {
  if (prefersShare(file)) {
    navigator.share({ files: [file], title: file.name }).catch(() => {});
    return;
  }
  const url = URL.createObjectURL(file);
  const win = window.open(url, '_blank');
  if (!win) downloadFile(file);
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}
