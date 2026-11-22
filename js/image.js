// Belegfotos verkleinern, bevor sie gespeichert werden.
// Ein Handyfoto (3–5 MB) wird so zu einem gut lesbaren JPEG mit ca. 150–300 KB.

const MAX_SIZE = 1600;  // längste Seite in Pixeln
const QUALITY = 0.72;   // JPEG-Qualität

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Das Foto konnte nicht gelesen werden.'));
    img.src = url;
  });
}

export async function resizeImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) throw new Error('Das Foto konnte nicht gelesen werden.');
    const scale = Math.min(1, MAX_SIZE / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // falls das Bild durchsichtige Stellen hat
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Das Foto konnte nicht verkleinert werden.'))),
        'image/jpeg',
        QUALITY,
      );
    });
    // Als ArrayBuffer speichern: funktioniert in Safari am zuverlässigsten
    const data = await new Response(blob).arrayBuffer();
    return { data, type: 'image/jpeg', width: cw, height: ch, size: blob.size };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const MAX_PDF_BYTES = 15 * 1024 * 1024;

/** Beleg vorbereiten: Fotos werden verkleinert, PDFs unverändert übernommen. */
export async function prepareReceipt(file) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  if (!isPdf) return resizeImage(file);
  if (file.size > MAX_PDF_BYTES) throw new Error('Das PDF ist größer als 15 MB. Bitte eine kleinere Datei wählen.');
  const data = await new Response(file).arrayBuffer();
  return { data, type: 'application/pdf', name: file.name || 'Beleg.pdf', size: file.size };
}
