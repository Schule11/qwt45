// Merkt sich, ob gerade ein Eingabeformular offen ist (Buchung, später auch
// Überstunden). Es ist immer nur eines gleichzeitig offen, und ein Update der
// App wird erst eingespielt, wenn kein Formular mehr offen ist.

let open = false;
const closeListeners = new Set();

export function isFormOpen() { return open; }
export function onFormClosed(fn) { closeListeners.add(fn); }

/**
 * Formular anmelden. Gibt null zurück, wenn schon eines offen ist –
 * sonst eine Funktion, die beim Schließen aufgerufen wird.
 */
export function registerForm() {
  if (open) return null;
  open = true;
  return () => {
    open = false;
    for (const fn of closeListeners) fn();
  };
}
