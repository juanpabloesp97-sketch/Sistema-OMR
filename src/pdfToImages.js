import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Convierte cada página de un archivo PDF en un objeto File (PNG) en alta resolución
 * para que pueda ser leído directamente por procesarHojaOMR.
 */
export async function convertirPdfAImagenes(pdfFile, onProgreso = null) {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPaginas = pdf.numPages;
  const archivosImagenes = [];

  for (let numPag = 1; numPag <= totalPaginas; numPag++) {
    if (onProgreso) onProgreso(numPag, totalPaginas);

    const page = await pdf.getPage(numPag);
    // Escala 2.5 (~180-200 DPI) asegura lectura nítida de burbujas y código QR
    const viewport = page.getViewport({ scale: 2.5 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const imageFile = new File([blob], `${pdfFile.name}_pag_${numPag}.png`, {
      type: 'image/png'
    });

    archivosImagenes.push(imageFile);
  }

  return archivosImagenes;
}