// Symbole für Kategorien: schlichte Linien-Symbole (Raster 24 × 24), dargestellt wie das
// App-Symbol – weißes Motiv auf dem Verlauf Blau → Lila.
//
// Eine Kategorie speichert ihr Symbol in `icon` (Schlüssel aus ICONS). Fehlt es (vorbelegte
// Kategorien, Kategorien aus älteren Versionen), wählt categoryIconKey() eins aus:
// vorbelegte Kategorie → festes Symbol, sonst passend zum Namen, sonst „Sonstiges“.

import { h } from '../ui.js';
import { DEFAULT_CATEGORIES } from '../defaults.js';

// Punkte als gefüllte Kreise (wirken bei kleiner Größe ruhiger als Strich-Punkte)
const dot = (x, y, r = 1.15) => `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;

/**
 * label: Name für Vorlesen/Auswahl; words: Wortteile (klein), an denen die App das Symbol
 * für einen neuen Kategorienamen vorschlägt – das längste passende Wort gewinnt.
 */
export const ICONS = {
  // Geld & Arbeit
  briefcase: { label: 'Aktentasche', words: ['gehalt', 'lohn', 'arbeit', 'job', 'bonus', 'beruf'],
    svg: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7M3 12.5h18"/>' },
  banknote: { label: 'Geldschein', words: ['bargeld', 'geld', 'taschengeld', 'cash'],
    svg: `<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/>${dot(6.5, 12)}${dot(17.5, 12)}` },
  coins: { label: 'Münzen', words: ['neben', 'minijob', 'trinkgeld', 'münz', 'zuverdienst'],
    svg: '<ellipse cx="12" cy="6.5" rx="7" ry="2.8"/><path d="M5 6.5v4c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-4M5 10.5v3.8c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-3.8M5 14.3v3.2c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-3.2"/>' },
  wallet: { label: 'Geldbörse', words: ['geldbörse', 'portemonnaie', 'budget'],
    svg: '<path d="M4 8v10a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6a2 2 0 0 1 0-4h11v4"/><path d="M20 12h-3.5a2 2 0 0 0 0 4H20"/>' },
  card: { label: 'Karte', words: ['karte', 'kreditkarte', 'gebühr', 'visa', 'paypal'],
    svg: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>' },
  piggy: { label: 'Sparschwein', words: ['spar', 'rücklage', 'notgroschen', 'reserve'],
    svg: `<path d="M18.5 11.5c0-3.3-3-5.5-7-5.5a8 8 0 0 0-2.8.5L6 5v3.2A6 6 0 0 0 4.6 10H3v4h1.7a6.4 6.4 0 0 0 1.8 2.2V19h3v-1.3a9 9 0 0 0 4 0V19h3v-2.6a5.5 5.5 0 0 0 2-4.9z"/><path d="M18.5 11.5c1 0 2-.6 2-1.8M10.5 9h3"/>${dot(7.6, 10.6, 1)}` },
  bank: { label: 'Bank', words: ['bank', 'konto', 'kredit', 'darlehen', 'tilgung', 'rate'],
    svg: '<path d="M3 9.5 12 4l9 5.5z"/><path d="M6 12.5V17M10 12.5V17M14 12.5V17M18 12.5V17M3.5 20h17"/>' },
  trend: { label: 'Kurve nach oben', words: ['zins', 'ertrag', 'dividende', 'aktie', 'etf', 'invest', 'depot', 'rendite'],
    svg: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>' },
  percent: { label: 'Prozent', words: ['rabatt', 'cashback', 'prämie', 'zulage'],
    svg: '<path d="M18.5 5.5l-13 13"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>' },
  refund: { label: 'Zurück', words: ['erstatt', 'rückzahl', 'zurück', 'gutschrift'],
    svg: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>' },
  tag: { label: 'Preisschild', words: ['verkauf', 'flohmarkt', 'ebay', 'kleinanzeigen', 'vinted', 'preis'],
    svg: `<path d="M3.5 4.5v6.8a1.5 1.5 0 0 0 .44 1.06l7.7 7.7a1.5 1.5 0 0 0 2.12 0l6.8-6.8a1.5 1.5 0 0 0 0-2.12l-7.7-7.7A1.5 1.5 0 0 0 11.8 3H5a1.5 1.5 0 0 0-1.5 1.5z"/>${dot(8, 7.5, 1.4)}` },
  document: { label: 'Dokument', words: ['steuer', 'vertrag', 'amt', 'behörde', 'rundfunk', 'verwaltung'],
    svg: '<path d="M14 3.5H6.5a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V8z"/><path d="M14 3.5V8h4.5M9 12.5h6M9 16h6"/>' },
  building: { label: 'Gebäude', words: ['büro', 'firma', 'arbeitgeber', 'geschäft'],
    svg: `<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M10.5 20.5v-3.5h3v3.5"/>${dot(9, 7.5)}${dot(12, 7.5)}${dot(15, 7.5)}${dot(9, 11)}${dot(12, 11)}${dot(15, 11)}` },
  laptop: { label: 'Laptop', words: ['computer', 'laptop', 'software', 'technik', 'elektronik', 'freelance'],
    svg: '<rect x="4.5" y="5" width="15" height="10.5" rx="1.5"/><path d="M2.5 19h19"/>' },

  // Wohnen & Alltag
  house: { label: 'Haus', words: ['miete', 'wohn', 'haus', 'eigenheim', 'immobilie'],
    svg: '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>' },
  key: { label: 'Schlüssel', words: ['schlüssel', 'kaution', 'schloss'],
    svg: '<circle cx="8" cy="15.5" r="4.5"/><path d="M11.2 12.3 19.5 4M16.5 7l2.5 2.5M14 9.5l2 2"/>' },
  sofa: { label: 'Sofa', words: ['möbel', 'einricht', 'haushalt', 'deko', 'sofa'],
    svg: '<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3 13a2 2 0 0 1 4 0v1.5h10V13a2 2 0 0 1 4 0v4.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M5.5 18.5V20M18.5 18.5V20"/>' },
  bolt: { label: 'Blitz', words: ['strom', 'energie', 'nebenkosten'],
    svg: '<path d="M13.5 3 5 13.5h6.5L10.5 21 19 10.5h-6.5z"/>' },
  flame: { label: 'Flamme', words: ['heiz', 'gas', 'heizöl', 'fernwärme', 'kamin'],
    svg: '<path d="M12 21a6.5 6.5 0 0 1-6.5-6.5c0-3.8 2.8-5.6 3.6-9.5 2.4 1.5 3.6 3.6 3.7 6 .9-.6 1.5-1.6 1.8-2.9 1.9 1.7 3.9 4 3.9 6.4A6.5 6.5 0 0 1 12 21z"/>' },
  drop: { label: 'Tropfen', words: ['wasser', 'abwasser'],
    svg: '<path d="M12 3.5c3 3.8 6 7 6 10.5a6 6 0 0 1-12 0c0-3.5 3-6.7 6-10.5z"/>' },
  wifi: { label: 'WLAN', words: ['internet', 'wlan', 'dsl', 'glasfaser', 'router'],
    svg: `<path d="M2.5 9.2a14 14 0 0 1 19 0M5.6 12.6a9.5 9.5 0 0 1 12.8 0M8.8 16a5 5 0 0 1 6.4 0"/>${dot(12, 19.3, 1.3)}` },
  phone: { label: 'Handy', words: ['handy', 'telefon', 'mobilfunk', 'smartphone', 'tarif'],
    svg: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>' },
  tv: { label: 'Fernseher', words: ['fernseh', 'tv', 'gez', 'beamer'],
    svg: '<rect x="2.5" y="4.5" width="19" height="12.5" rx="2"/><path d="M8 20.5h8M12 17v3.5"/>' },
  wrench: { label: 'Werkzeug', words: ['reparatur', 'werkstatt', 'handwerk', 'wartung', 'tüv', 'werkzeug', 'baumarkt'],
    svg: '<path d="M14.6 3.6a5 5 0 0 0-4.8 6.8L3.9 16.3a1.9 1.9 0 0 0 2.7 2.7l5.9-5.9a5 5 0 0 0 6.8-4.8l-2.9 2.9-2.8-.8-.8-2.8z"/>' },
  plant: { label: 'Pflanze', words: ['garten', 'pflanze', 'blume', 'balkon'],
    svg: '<path d="M12 20v-8"/><path d="M12 12C12 8 9.5 5.5 5 5.5c0 4.2 2.8 6.5 7 6.5z"/><path d="M12 14c0-3.6 2.4-6 6.5-6 0 3.6-2.4 6-6.5 6z"/><path d="M7.5 20h9"/>' },
  cart: { label: 'Einkaufswagen', words: ['lebensmittel', 'supermarkt', 'einkauf', 'edeka', 'rewe', 'aldi', 'lidl', 'netto', 'kaufland'],
    svg: '<path d="M2.5 4h2.3l2.3 10.3a1.5 1.5 0 0 0 1.47 1.2h8.6a1.5 1.5 0 0 0 1.45-1.12L20.5 8H5.7"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>' },
  bag: { label: 'Einkaufstasche', words: ['shopping', 'kaufhaus', 'online', 'amazon', 'bestellung'],
    svg: '<path d="M5 8h14l-1 11.6a1 1 0 0 1-1 .9H7a1 1 0 0 1-1-.9z"/><path d="M9 10.5V7a3 3 0 0 1 6 0v3.5"/>' },

  // Unterwegs
  car: { label: 'Auto', words: ['auto', 'kfz', 'leasing', 'mobilität', 'pkw'],
    svg: '<path d="M5 17H4a1 1 0 0 1-1-1v-3.6a1 1 0 0 1 .3-.7L5 10l1.8-3.7A2 2 0 0 1 8.6 5h6.8a2 2 0 0 1 1.8 1.3L19 10l1.7 1.7a1 1 0 0 1 .3.7V16a1 1 0 0 1-1 1h-1"/><path d="M5 10h14M9.5 17h5"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/>' },
  fuel: { label: 'Zapfsäule', words: ['tank', 'sprit', 'benzin', 'diesel', 'ladestrom'],
    svg: '<path d="M4.5 20V5a1.5 1.5 0 0 1 1.5-1.5h6.5A1.5 1.5 0 0 1 14 5v15M3 20h12.5M4.5 10H14"/><path d="M14 8.5h1.5a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 0 3 0V8.5L17.5 6"/>' },
  parking: { label: 'Parken', words: ['park', 'garage', 'stellplatz'],
    svg: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M9.5 17V7.5H13a3 3 0 0 1 0 6H9.5"/>' },
  train: { label: 'Bahn', words: ['bahn', 'zug', 'öpnv', 'deutschlandticket', 'nahverkehr', 'bus'],
    svg: `<path d="M7 3.5h10a2 2 0 0 1 2 2V15a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 15V5.5a2 2 0 0 1 2-2z"/><path d="M5 10.5h14M8.5 21l1.8-3.5M15.5 21l-1.8-3.5"/>${dot(8.7, 14)}${dot(15.3, 14)}` },
  bike: { label: 'Fahrrad', words: ['fahrrad', 'bike', 'roller'],
    svg: '<circle cx="5.5" cy="16" r="3.5"/><circle cx="18.5" cy="16" r="3.5"/><path d="M5.5 16 9 9h6.5M5.5 16H12l4-7M9 9l3 7M15.5 9l3 7M7.5 9h3M14.5 6.5h2.5l-1.5 2.5"/>' },
  plane: { label: 'Flugzeug', words: ['urlaub', 'reise', 'flug', 'ferien'],
    svg: '<path d="M12 2.8c.9 0 1.5 1.1 1.5 2.4v3.9l7 4.2v2l-7-2.1v4.2l2.3 1.7V21L12 20l-3.8 1v-1.9l2.3-1.7v-4.2l-7 2.1v-2l7-4.2V5.2c0-1.3.6-2.4 1.5-2.4z" transform="rotate(45 12 12)"/>' },
  globe: { label: 'Weltkugel', words: ['ausland', 'welt', 'sprach'],
    svg: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3z"/>' },
  sun: { label: 'Sonne', words: ['sommer', 'solar', 'strand'],
    svg: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>' },

  // Essen & Trinken
  cutlery: { label: 'Besteck', words: ['essen', 'restaurant', 'lieferando', 'imbiss', 'kantine', 'mittag', 'lieferdienst', 'gastro'],
    svg: '<path d="M6.5 3v5.5a2.5 2.5 0 0 0 5 0V3M9 3v18"/><path d="M17.5 21V3c-2.2 1.6-3.3 4.2-3.3 7.8V13h3.3"/>' },
  coffee: { label: 'Kaffeetasse', words: ['kaffee', 'café', 'cafe', 'bäcker', 'frühstück'],
    svg: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2.5M12 3.5v2.5"/>' },
  glass: { label: 'Weinglas', words: ['getränk', 'wein', 'bier', 'alkohol', 'party', 'kneipe', 'cocktail'],
    svg: '<path d="M7 3.5h10l-.4 4.2a4.6 4.6 0 0 1-9.2 0z"/><path d="M12 12.5v8M8.5 20.5h7"/>' },
  cake: { label: 'Kuchen', words: ['geburtstag', 'feier', 'kuchen', 'hochzeit'],
    svg: '<path d="M4 20.5h16M5 20.5v-7a1.5 1.5 0 0 1 1.5-1.5h11a1.5 1.5 0 0 1 1.5 1.5v7"/><path d="M5 15.8c1.2 0 1.8.9 3.5.9s2.3-.9 3.5-.9 1.8.9 3.5.9 2.3-.9 3.5-.9M12 12V9"/><path d="M12 4.2c.9.9 1.1 1.8 0 2.6-1.1-.8-.9-1.7 0-2.6z"/>' },

  // Freizeit
  ticket: { label: 'Eintrittskarte', words: ['freizeit', 'kino', 'konzert', 'event', 'theater', 'ausflug', 'eintritt', 'ticket'],
    svg: '<path d="M3 8.5V6.5a1.5 1.5 0 0 1 1.5-1.5h15A1.5 1.5 0 0 1 21 6.5v2a3.5 3.5 0 0 0 0 7v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-2a3.5 3.5 0 0 0 0-7z"/><path d="M14.5 5v2M14.5 11v2M14.5 17v2"/>' },
  play: { label: 'Abspielen', words: ['abo', 'streaming', 'netflix', 'spotify', 'disney', 'mitglied', 'youtube'],
    svg: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9.2 4.8 2.8-4.8 2.8z"/>' },
  music: { label: 'Musik', words: ['musik', 'instrument', 'gesang'],
    svg: '<path d="M9 18V5.5l10-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>' },
  gamepad: { label: 'Spielkonsole', words: ['spiel', 'gaming', 'konsole', 'playstation', 'nintendo', 'xbox'],
    svg: `<path d="M7.5 7h9a4.5 4.5 0 0 1 4.4 5.4l-.8 3.9a2.4 2.4 0 0 1-4.1 1.1L14 15.5h-4l-2 1.9a2.4 2.4 0 0 1-4.1-1.1l-.8-3.9A4.5 4.5 0 0 1 7.5 7z"/><path d="M8 9.8v3.4M6.3 11.5h3.4"/>${dot(15.2, 10.6)}${dot(17, 12.4)}` },
  palette: { label: 'Farbpalette', words: ['hobby', 'basteln', 'kunst', 'malen', 'kreativ'],
    svg: `<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.9 1.4-1.9-.5-1.2.3-2.3 1.6-2.3h2a3.5 3.5 0 0 0 3.5-3.5c0-5.3-3.8-9.3-8.5-9.3z"/>${dot(7.5, 11.5, 1.3)}${dot(10, 7.5, 1.3)}${dot(14.5, 7.5, 1.3)}` },
  camera: { label: 'Kamera', words: ['foto', 'kamera'],
    svg: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>' },
  book: { label: 'Buch', words: ['buch', 'bücher', 'bildung', 'schule', 'kurs', 'weiterbildung', 'zeitung', 'zeitschrift'],
    svg: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5v13"/>' },
  dumbbell: { label: 'Hantel', words: ['sport', 'fitness', 'gym', 'training', 'verein'],
    svg: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>' },
  star: { label: 'Stern', words: ['extra', 'wunsch', 'luxus', 'gönn', 'belohnung'],
    svg: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>' },

  // Gesundheit, Familie & Pflege
  health: { label: 'Kreuz', words: ['gesundheit', 'arzt', 'kranken', 'klinik', 'pflege'],
    svg: '<path d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z"/>' },
  pill: { label: 'Tablette', words: ['apotheke', 'medikament', 'tablette'],
    svg: '<rect x="2.6" y="8.5" width="18.8" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="m8.5 8.5 7 7"/>' },
  tooth: { label: 'Zahn', words: ['zahn', 'zähne', 'kieferorthopäd'],
    svg: '<path d="M7.5 4C5 4 3.5 6 3.5 8.5c0 3 1.5 4 2 7 .4 2.8 1 5 2.5 5s1.5-2 2-4c.3-1.2.8-2 2-2s1.7.8 2 2c.5 2 .5 4 2 4s2.1-2.2 2.5-5c.5-3 2-4 2-7C20.5 6 19 4 16.5 4c-2 0-2.8 1-4.5 1S9.5 4 7.5 4z"/>' },
  glasses: { label: 'Brille', words: ['brille', 'optik', 'kontaktlinse'],
    svg: '<circle cx="6.5" cy="14.5" r="3.5"/><circle cx="17.5" cy="14.5" r="3.5"/><path d="M10 14.5c.6-.7 1.3-1 2-1s1.4.3 2 1M3 14.5 4.2 8H6.5M21 14.5 19.8 8h-2.3"/>' },
  sparkles: { label: 'Funkeln', words: ['kosmetik', 'drogerie', 'beauty', 'körperpflege', 'parfum', 'putz', 'reinigung'],
    svg: '<path d="M10 4c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7z"/><path d="M18.5 15v5M16 17.5h5"/>' },
  scissors: { label: 'Schere', words: ['friseur', 'frisör', 'haare', 'barbier'],
    svg: '<circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/><path d="M8.2 15.7 17 4M15.8 15.7 7 4"/>' },
  shirt: { label: 'T-Shirt', words: ['kleidung', 'mode', 'schuhe', 'klamotten', 'bekleidung'],
    svg: '<path d="M9 4 4 6.5l-1.5 4.5 3 1.3V20h13v-7.7l3-1.3L20 6.5 15 4a3 3 0 0 1-6 0z"/>' },
  heart: { label: 'Herz', words: ['spende', 'partner', 'liebe', 'charity', 'hilfe'],
    svg: '<path d="M12 20 4.6 12.7A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 7.4 5.7z"/>' },
  paw: { label: 'Pfote', words: ['haustier', 'hund', 'katze', 'tier', 'futter'],
    svg: `${dot(6.5, 10, 1.9)}${dot(9.8, 6, 1.9)}${dot(14.2, 6, 1.9)}${dot(17.5, 10, 1.9)}<path d="M12 11.5c-2.4 0-5 3.3-5 5.6 0 1.5 1.1 2.4 2.5 2.4 1 0 1.6-.6 2.5-.6s1.5.6 2.5.6c1.4 0 2.5-.9 2.5-2.4 0-2.3-2.6-5.6-5-5.6z"/>` },
  stroller: { label: 'Kinderwagen', words: ['kind', 'baby', 'kita', 'kindergeld', 'kindergarten', 'windel', 'unterhalt'],
    svg: '<path d="M4 10.5a7 7 0 0 1 7-7v7"/><path d="M3.5 10.5h16a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z"/><path d="M18 10.5 19.6 5h2"/><circle cx="7.5" cy="19.5" r="1.6"/><circle cx="15.5" cy="19.5" r="1.6"/>' },
  people: { label: 'Familie', words: ['familie', 'eltern', 'freunde', 'gemeinsam'],
    svg: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M15.5 4.7a3.5 3.5 0 0 1 0 6.6M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>' },
  graduation: { label: 'Doktorhut', words: ['studium', 'uni', 'studien', 'ausbildung', 'semester'],
    svg: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.5c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3V11M21.5 9v5"/>' },
  shield: { label: 'Schild', words: ['versicher', 'haftpflicht', 'rechtsschutz', 'schutz', 'vorsorge'],
    svg: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>' },

  // Sonstiges
  gift: { label: 'Geschenk', words: ['geschenk', 'präsent', 'weihnacht'],
    svg: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7M12 8v12"/><path d="M12 8C10.6 4.8 6.5 4.3 6.5 6.5 6.5 8 9.5 8 12 8c2.5 0 5.5 0 5.5-1.5 0-2.2-4.1-1.7-5.5 1.5z"/>' },
  umbrella: { label: 'Schirm', words: ['regen', 'absicherung'],
    svg: '<path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v6a2 2 0 0 0 4 0M12 3v-.5"/>' },
  calendar: { label: 'Kalender', words: ['jährlich', 'monatlich', 'termin', 'beitrag'],
    svg: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>' },
  more: { label: 'Sonstiges', words: ['sonstig', 'divers', 'andere', 'weitere'],
    svg: `<circle cx="12" cy="12" r="9"/>${dot(8, 12, 1.3)}${dot(12, 12, 1.3)}${dot(16, 12, 1.3)}` },
};

/** Reihenfolge und Gruppen in der Auswahl beim Anlegen/Bearbeiten einer Kategorie */
export const ICON_GROUPS = [
  { title: 'Geld & Arbeit', keys: ['briefcase', 'banknote', 'coins', 'wallet', 'card', 'piggy', 'bank', 'trend', 'percent', 'refund', 'tag', 'document', 'building', 'laptop'] },
  { title: 'Wohnen & Alltag', keys: ['house', 'key', 'sofa', 'bolt', 'flame', 'drop', 'wifi', 'phone', 'tv', 'wrench', 'plant', 'cart', 'bag'] },
  { title: 'Unterwegs', keys: ['car', 'fuel', 'parking', 'train', 'bike', 'plane', 'globe', 'sun'] },
  { title: 'Essen & Trinken', keys: ['cutlery', 'coffee', 'glass', 'cake'] },
  { title: 'Freizeit', keys: ['ticket', 'play', 'music', 'gamepad', 'palette', 'camera', 'book', 'dumbbell', 'star'] },
  { title: 'Gesundheit & Familie', keys: ['health', 'pill', 'tooth', 'glasses', 'sparkles', 'scissors', 'shirt', 'heart', 'paw', 'stroller', 'people', 'graduation'] },
  { title: 'Verträge & Sonstiges', keys: ['shield', 'umbrella', 'calendar', 'gift', 'more'] },
];

export const FALLBACK_ICON = 'more';

const DEFAULT_ICON_BY_KEY = new Map(DEFAULT_CATEGORIES.map((c) => [c.key, c.icon]));

export function isIconKey(key) {
  return typeof key === 'string' && Object.hasOwn(ICONS, key);
}

// Kurze Wörter (bis 4 Zeichen) zählen nur am Wortanfang: "Gas" ja, "Gastronomie" nein
const LETTER = /[a-zäöüß]/;
function matches(text, word) {
  if (word.length > 4) return text.includes(word);
  for (let i = text.indexOf(word); i !== -1; i = text.indexOf(word, i + 1)) {
    if (i === 0 || !LETTER.test(text[i - 1])) return true;
  }
  return false;
}

/** Passendes Symbol zu einem Kategorienamen (oder null) – das längste passende Wort gewinnt */
export function suggestIcon(name) {
  const text = String(name || '').toLocaleLowerCase('de');
  if (!text.trim()) return null;
  let best = null;
  let bestLen = 0;
  for (const [key, def] of Object.entries(ICONS)) {
    for (const w of def.words) {
      if (w.length > bestLen && matches(text, w)) { best = key; bestLen = w.length; }
    }
  }
  return best;
}

const suggestCache = new Map();

/** Symbol einer Kategorie: gewählt → vorbelegt → passend zum Namen → „Sonstiges“ */
export function categoryIconKey(cat) {
  if (!cat) return FALLBACK_ICON;
  if (isIconKey(cat.icon)) return cat.icon;
  const byKey = cat.key ? DEFAULT_ICON_BY_KEY.get(cat.key) : null;
  if (byKey) return byKey;
  if (!suggestCache.has(cat.name)) suggestCache.set(cat.name, suggestIcon(cat.name) || FALLBACK_ICON);
  return suggestCache.get(cat.name);
}

/** Nur das Symbol (SVG) */
export function iconSvg(key, size = 22) {
  const def = ICONS[key] || ICONS[FALLBACK_ICON];
  const span = document.createElement('span');
  span.className = 'icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${def.svg}</svg>`;
  return span;
}

/**
 * Kachel mit Symbol wie das App-Symbol. Entweder für eine Kategorie (cat) oder ein Symbol (iconKey).
 * slot: Farbe aus dem Ring "Wohin ging das Geld?" statt Verlauf (dann zugleich Legende).
 */
export function catTile(cat, { iconKey = null, size = 'md', slot = null, className = '' } = {}) {
  const key = iconKey || categoryIconKey(cat);
  const px = { sm: 18, md: 21, lg: 26 }[size] || 21;
  return h('span', {
    class: `cat-tile ${size} ${className}`.trim(),
    'data-icon': key,
    'data-slot': slot != null ? String(slot) : null,
    'aria-hidden': 'true',
  }, iconSvg(key, px));
}
