import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import jsQR from 'jsqr';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function convertirPdfAImagenes(pdfFile, onProgreso = null) {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPaginas = pdf.numPages;
  const archivosImagenes = [];

  for (let numPag = 1; numPag <= totalPaginas; numPag++) {
    if (onProgreso) onProgreso(numPag, totalPaginas);

    const page = await pdf.getPage(numPag);
    const viewport = page.getViewport({ scale: 3.0 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;

    // 1. Buscar QR en toda la franja superior de la página
    let qrDetectado = null;
    const topH = Math.floor(canvas.height * 0.35);
    const topData = context.getImageData(0, 0, canvas.width, topH);
    const code = jsQR(topData.data, canvas.width, topH, { inversionAttempts: 'attemptBoth' });

    if (code && code.data) {
      try {
        const parsed = JSON.parse(code.data);
        qrDetectado = {
          r: parsed.r || parsed.rut || 'Sin RUT',
          n: parsed.n || parsed.nombre || `Estudiante Pág. ${numPag}`,
          c: parsed.c || parsed.curso || ''
        };
      } catch {
        qrDetectado = { r: code.data, n: 'Estudiante QR', c: '' };
      }
    }

    // 2. Respaldo directo leyendo el texto "Estudiante:" y "RUT:" del PDF
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
    const imageFile = new File([blob], `${pdfFile.name}_pag_${numPag}.png`, { type: 'image/png' });
    imageFile.qrPreDetectado = qrDetectado;
    archivosImagenes.push(imageFile);
  }

  return archivosImagenes;
}