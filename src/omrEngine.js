import cvModule from '@techstark/opencv-js';
import jsQR from 'jsqr';

async function obtenerOpenCV() {
  if (cvModule && cvModule.Mat) return cvModule;
  if (cvModule instanceof Promise) return await cvModule;
  return new Promise((resolve) => {
    cvModule.onRuntimeInitialized = () => resolve(cvModule);
  });
}

// Lee el QR buscando primero en un recorte ampliado de la esquina superior derecha
function leerCodigoQR(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width, height } = canvas;

  const cropX = Math.floor(width * 0.62);
  const cropY = 0;
  const cropW = width - cropX;
  const cropH = Math.floor(height * 0.25);

  const cropData = ctx.getImageData(cropX, cropY, cropW, cropH);
  let code = jsQR(cropData.data, cropW, cropH, { inversionAttempts: 'attemptBoth' });

  if (!code) {
    const fullData = ctx.getImageData(0, 0, width, height);
    code = jsQR(fullData.data, width, height, { inversionAttempts: 'attemptBoth' });
  }

  if (code && code.data) {
    try {
      const parsed = JSON.parse(code.data);
      return {
        r: parsed.r || parsed.rut || 'Sin RUT',
        n: parsed.n || parsed.nombre || 'Estudiante',
        c: parsed.c || parsed.curso || '',
        e: parsed.e || ''
      };
    } catch {
      return { r: code.data, n: 'Estudiante QR', c: '' };
    }
  }
  return null;
}

function ordenarEsquinas(puntos) {
  const sumas = puntos.map((p) => p.x + p.y);
  const restas = puntos.map((p) => p.y - p.x);

  const supIzq = puntos[sumas.indexOf(Math.min(...sumas))];
  const infDer = puntos[sumas.indexOf(Math.max(...sumas))];
  const supDer = puntos[restas.indexOf(Math.min(...restas))];
  const infIzq = puntos[restas.indexOf(Math.max(...restas))];

  return [supIzq, supDer, infDer, infIzq];
}

export async function procesarHojaOMR(archivoImagen, configEvaluacion) {
  const cv = await obtenerOpenCV();

  const img = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = e.target.result;
    };
    reader.readAsDataURL(archivoImagen);
  });

  const maxDim = 2200;
  const escala = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * escala);
  canvas.height = Math.round(img.height * escala);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // 1. Leer QR
  const qrData = archivoImagen.qrPreDetectado || leerCodigoQR(canvas);

  const totalPreguntas = Number(configEvaluacion.numPreguntas || 30);
  const alternativasStr = configEvaluacion.alternativas || 'ABCD';
  const opciones = alternativasStr.split('');
  const pauta = configEvaluacion.pauta || {};

  // 2. Detectar los 4 cuadros negros fiduciales
  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const thresh = new cv.Mat();

  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
  cv.adaptiveThreshold(blurred, thresh, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 25, 10);

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  const areaTotal = canvas.width * canvas.height;
  const candidatos = [];

  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i);
    const area = cv.contourArea(cnt);
    if (area > areaTotal * 0.0002 && area < areaTotal * 0.02) {
      const rect = cv.boundingRect(cnt);
      const aspecto = rect.width / rect.height;
      const extension = area / (rect.width * rect.height);
      if (aspecto >= 0.7 && aspecto <= 1.35 && extension >= 0.7) {
        candidatos.push({
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2
        });
      }
    }
    cnt.delete();
  }

  const objetivos = [
    { x: canvas.width * (16 / 215.9), y: canvas.height * (16 / 279.4) },
    { x: canvas.width * (199 / 215.9), y: canvas.height * (16 / 279.4) },
    { x: canvas.width * (199 / 215.9), y: canvas.height * (262 / 279.4) },
    { x: canvas.width * (16 / 215.9), y: canvas.height * (262 / 279.4) }
  ];

  let esquinasDetectadas = null;
  if (candidatos.length >= 4) {
    const elegidos = objetivos.map((obj) => {
      let mejor = null;
      let distMin = Infinity;
      for (const c of candidatos) {
        const d = Math.hypot(c.x - obj.x, c.y - obj.y);
        if (d < distMin) {
          distMin = d;
          mejor = c;
        }
      }
      return mejor;
    });

    const unicos = new Set(elegidos.map((p) => `${Math.round(p.x)}_${Math.round(p.y)}`));
    if (unicos.size === 4) {
      esquinasDetectadas = ordenarEsquinas(elegidos);
    }
  }

  // 3. Enderezar área entre centros
  const W = 1830;
  const H = 2460;
  const warped = new cv.Mat();

  if (esquinasDetectadas) {
    const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
      esquinasDetectadas[0].x, esquinasDetectadas[0].y,
      esquinasDetectadas[1].x, esquinasDetectadas[1].y,
      esquinasDetectadas[2].x, esquinasDetectadas[2].y,
      esquinasDetectadas[3].x, esquinasDetectadas[3].y
    ]);
    const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, W, 0, W, H, 0, H]);
    const M = cv.getPerspectiveTransform(srcPts, dstPts);
    cv.warpPerspective(src, warped, M, new cv.Size(W, H));
    srcPts.delete();
    dstPts.delete();
    M.delete();
  } else {
    const x0 = Math.round(canvas.width * (16 / 215.9));
    const y0 = Math.round(canvas.height * (16 / 279.4));
    const rw = Math.round(canvas.width * (183 / 215.9));
    const rh = Math.round(canvas.height * (246 / 279.4));
    const rect = new cv.Rect(x0, y0, Math.min(rw, canvas.width - x0), Math.min(rh, canvas.height - y0));
    const cropped = src.roi(rect);
    cv.resize(cropped, warped, new cv.Size(W, H));
    cropped.delete();
  }

  // 4. Medir tinta dentro de cada burbuja (calibrado para círculos pintados, cruces X y trazos suaves)
  const warpedGray = new cv.Mat();
  const warpedBin = new cv.Mat();
  cv.cvtColor(warped, warpedGray, cv.COLOR_RGBA2GRAY);
  cv.threshold(warpedGray, warpedBin, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

  const outCanvas = document.createElement('canvas');
  cv.imshow(outCanvas, warped);
  const outCtx = outCanvas.getContext('2d');

  // Radio interior de 20px (evita el borde impreso del círculo de 27px)
  const radioPx = 20;
  const respuestas = {};

  for (let p = 1; p <= totalPreguntas; p++) {
    const col = p <= 25 ? 0 : 1;
    const fila = p <= 25 ? p - 1 : p - 26;
    const baseX = col === 0 ? 32 : 122;
    const baseY = 56 + fila * 7.8;

    const densidades = opciones.map((letra, idx) => {
      const cx = baseX + idx * 11;
      const px = Math.round((cx - 16) * 10);
      const py = Math.round((baseY - 16) * 10);

      let oscuros = 0;
      let total = 0;
      for (let dy = -radioPx; dy <= radioPx; dy++) {
        for (let dx = -radioPx; dx <= radioPx; dx++) {
          if (dx * dx + dy * dy <= radioPx * radioPx) {
            if (py + dy >= 0 && py + dy < H && px + dx >= 0 && px + dx < W) {
              const val = warpedBin.ucharPtr(py + dy, px + dx)[0];
              if (val > 0) oscuros++;
              total++;
            }
          }
        }
      }
      return { letra, ratio: total > 0 ? oscuros / total : 0, px, py };
    });

    // Línea base de los círculos vacíos de esta misma pregunta (promedio de los 2 menos oscuros)
    const ordenados = [...densidades].sort((a, b) => a.ratio - b.ratio);
    const baseVacio = (ordenados[0].ratio + ordenados[1].ratio) / 2;

    // Detección híbrida:
    // - Marca llena (> 0.38)
    // - O cruz / trazo suave (> 0.23 y al menos +0.12 más oscuro que los círculos vacíos de la fila)
    const marcadas = densidades.filter(
      (d) => d.ratio > 0.38 || (d.ratio > 0.23 && d.ratio - baseVacio >= 0.12)
    );

    let respuestaFinal = '';
    if (marcadas.length === 1) {
      respuestaFinal = marcadas[0].letra;
    } else if (marcadas.length > 1) {
      // Si hay una marca muy rellena (>0.50) y otra fue apenas un roce/cruz tenue (<0.30), prioriza la rellena
      const muyLlenas = marcadas.filter((m) => m.ratio > 0.50);
      if (muyLlenas.length === 1 && marcadas.every((m) => m === muyLlenas[0] || m.ratio < 0.30)) {
        respuestaFinal = muyLlenas[0].letra;
      } else {
        respuestaFinal = 'DOBLE';
      }
    }

    respuestas[p] = respuestaFinal;

    const itemPauta = pauta[p];
    const correcta = typeof itemPauta === 'object' ? itemPauta?.correcta : itemPauta;
    const esCorrecta = Boolean(correcta) && respuestaFinal === correcta;

    densidades.forEach((d) => {
      const fueElegida = respuestaFinal === d.letra || (respuestaFinal === 'DOBLE' && marcadas.some((m) => m.letra === d.letra));
      if (fueElegida) {
        outCtx.beginPath();
        outCtx.arc(d.px, d.py, 28, 0, 2 * Math.PI);
        outCtx.lineWidth = 6;
        outCtx.strokeStyle = esCorrecta ? '#16a34a' : '#dc2626';
        outCtx.stroke();
      } else if (correcta && d.letra === correcta && !esCorrecta) {
        outCtx.beginPath();
        outCtx.arc(d.px, d.py, 26, 0, 2 * Math.PI);
        outCtx.lineWidth = 4;
        outCtx.strokeStyle = '#2563eb';
        outCtx.stroke();
      }
    });
  }

  src.delete();
  gray.delete();
  blurred.delete();
  thresh.delete();
  contours.delete();
  hierarchy.delete();
  warped.delete();
  warpedGray.delete();
  warpedBin.delete();

  return {
    qrData,
    respuestas,
    imagenProcesada: outCanvas.toDataURL('image/jpeg', 0.6)
  };
}