import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import jsQR from 'jsqr';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Convierte cada página de un archivo PDF en un File (PNG) en alta resolución
 * y pre-extrae los datos del QR / estudiante de esa página.
 */
export async function convertirPdfAImagenes(pdfFile, onProgreso = null) {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPaginas = pdf.numPages;
  const archivosImagenes = [];

  for (let numPag = 1; numPag <= totalPaginas; numPag++) {
    if (onProgreso) onProgreso(numPag, totalPaginas);

    const page = await pdf.getPage(numPag);
    // Escala 3.0 para máxima nitidez en el QR y burbujas
    const viewport = page.getViewport({ scale: 3.0 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    // 1. Intentar leer QR recortando específicamente el cuadrante superior derecho
    let qrDetectado = null;
    const cropX = Math.floor(canvas.width * 0.65);
    const cropY = 0;
    const cropW = canvas.width - cropX;
    const cropH = Math.floor(canvas.height * 0.25);

    const qrImageData = context.getImageData(cropX, cropY, cropW, cropH);
    const code = jsQR(qrImageData.data, cropW, cropH, { inversionAttempts: 'attemptBoth' });

    if (code && code.data) {
      try {
        qrDetectado = JSON.parse(code.data);
      } catch (e) {
        qrDetectado = { r: code.data, n: 'Estudiante QR', c: '' };
      }
    }

    // 2. Respaldo: leer texto embebido de la página PDF si el QR no fue decodificado
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

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const imageFile = new File([blob], `${pdfFile.name}_pag_${numPag}.png`, {
      type: 'image/png'
    });

    // Adjuntamos los datos del estudiante al objeto File
    imageFile.qrPreDetectado = qrDetectado;
    archivosImagenes.push(imageFile);
  }

  return archivosImagenes;
}