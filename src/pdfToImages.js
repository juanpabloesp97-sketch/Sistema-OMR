import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import jsQR from 'jsqr';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function decodificarDesdeImageData(imgData, w, h) {
  const code = jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' });
  if (code && code.data) {
    try {
      const parsed = JSON.parse(code.data);
      return {
        r: parsed.r || parsed.rut || 'Sin RUT',
        n: parsed.n || parsed.nombre || 'Estudiante',
        c: parsed.c || parsed.curso || ''
      };
    } catch {
      return { r: code.data, n: 'Estudiante QR', c: '' };
    }
  }
  return null;
}

export async function convertirPdfAImagenes(pdfFile, onProgreso = null) {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPaginas = pdf.numPages;
  const archivosImagenes = [];

  for (let numPag = 1; numPag <= totalPaginas; numPag++) {
    if (onProgreso) onProgreso(numPag, totalPaginas);

    const page = await pdf.getPage(numPag);
    const viewport = page.getViewport({ scale: 2.2 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;

    // 1. Buscar QR en cuadrante superior derecho
    const cropX = Math.floor(canvas.width * 0.52);
    const cropY = 0;
    const cropW = canvas.width - cropX;
    const cropH = Math.floor(canvas.height * 0.32);
    const cropData = context.getImageData(cropX, cropY, cropW, cropH);

    let qrDetectado = decodificarDesdeImageData(cropData, cropW, cropH);

    // 2. Binarizado blanco/negro puro para eliminar sombras o tóner oscuro
    if (!qrDetectado) {
      const binData = new ImageData(new Uint8ClampedArray(cropData.data), cropW, cropH);
      const d = binData.data;
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const bw = lum < 155 ? 0 : 255;
        d[i] = bw;
        d[i + 1] = bw;
        d[i + 2] = bw;
      }
      qrDetectado = decodificarDesdeImageData(binData, cropW, cropH);
    }

    // 3. Reducción al 55% para limpiar ruido de escáner
    if (!qrDetectado) {
      const smallCanvas = document.createElement('canvas');
      smallCanvas.width = Math.floor(cropW * 0.55);
      smallCanvas.height = Math.floor(cropH * 0.55);
      const sCtx = smallCanvas.getContext('2d', { willReadFrequently: true });
      sCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, smallCanvas.width, smallCanvas.height);
      const smallData = sCtx.getImageData(0, 0, smallCanvas.width, smallCanvas.height);
      qrDetectado = decodificarDesdeImageData(smallData, smallCanvas.width, smallCanvas.height);
    }

    // 4. Respaldo directo leyendo texto embebido del PDF
    if (!qrDetectado) {
      const textContent = await page.getTextContent();
      const textoPagina = textContent.items.map((item) => item.str).join(' ');
      const matchEst = textoPagina.match(/Estudiante:\s*(.+?)\s*RUT:/i);
      const matchRut = textoPagina.match(/RUT:\s*([0-9kK.\-]+)/i);
      const matchCurso = textoPagina.match(/Curso:\s*([^\s].*?)(?:\s+1\.|$)/i);

      if (matchRut || matchEst) {
        qrDetectado = {
          r: matchRut ? matchRut[1].trim() : 'Sin RUT',
          n: matchEst ? matchEst[1].trim() : `Estudiante Pág. ${numPag}`,
          c: matchCurso ? matchCurso[1].trim() : ''
        };
      }
    }

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    const imageFile = new File([blob], `${pdfFile.name}_pag_${numPag}.jpg`, { type: 'image/jpeg' });
    imageFile.qrPreDetectado = qrDetectado;
    archivosImagenes.push(imageFile);
  }

  return archivosImagenes;
}