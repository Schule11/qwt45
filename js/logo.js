// Logo fürs PDF: wird einmal als JPEG vorbereitet, damit PDFs ohne Wartezeit entstehen
// (auf dem iPhone muss das Teilen direkt im Tipp passieren).

let logo = null;

/** Lädt das Logo vorab (als JPEG), damit das PDF später ohne Wartezeit entsteht. */
export function preloadLogo() {
  if (logo) return;
  logo = { loading: true };
  const img = new Image();
  img.onload = () => {
    const w = img.naturalWidth * 2;
    const h = img.naturalHeight * 2;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    canvas.toBlob(async (blob) => {
      if (!blob) { logo = null; return; }
      const bytes = new Uint8Array(await new Response(blob).arrayBuffer());
      logo = { bytes, width: w, height: h };
    }, 'image/jpeg', 0.92);
  };
  img.onerror = () => { logo = null; };
  img.src = 'assets/logo.png';
}


export function getLogo() {
  return logo?.bytes ? logo : null;
}
