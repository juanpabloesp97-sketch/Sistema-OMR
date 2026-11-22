import cvModule from '@techstark/opencv-js';
import jsQR from 'jsqr';

async function obtenerOpenCV() {
  if (cvModule && cvModule.Mat) return cvModule;
  if (cvModule instanceof Promise) return await cvModule;
  return new Promise((resolve) => {
    cvModule.onRuntimeInitialized = () => resolve(cvModule);
  });
}

function obtenerClavesItem(item) {
  if (!item) return [];
  if (typeof item === 'string') return item ? [item] : [];
  if (Array.isArray(item.correcta)) return item.correcta;
  return item.correcta ? [item.correcta] : [];
}

function obtenerPuntajeItem(item) {
  if (typeof item === 'object' && item !== null && item.puntaje !== undefined) {
    return Number(item.puntaje);
  }
  return 1;
}

function leerCodigoQR(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width, height } = canvas;

  const cropX = Math.floor(width * 0.55);
  const cropY = 0;
  const cropW = width - cropX;
  const cropH = Math.floor(height * 0.30);

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

function dibujarTicketVerde(ctx, x, y) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - 14, y + 2);
  ctx.lineTo(x - 4, y + 13);
  ctx.lineTo(x + 17, y - 12);
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#16a34a';
  ctx.stroke();
  ctx.restore();
}

function dibujarCruzRoja(ctx, x, y) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 12);
  ctx.lineTo(x + 12, y + 12);
  ctx.moveTo(x + 12, y - 12);
  ctx.lineTo(x - 12, y + 12);
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#dc2626';
  ctx.stroke();
  ctx.restore();
}

function dibujarEtiquetaEstado(ctx, x, y, texto, colorFondo) {
  ctx.save();
  ctx.font = 'bold 20px sans-serif';
  const ancho = ctx.measureText(texto).width + 16;
  ctx.fillStyle = colorFondo;
  ctx.fillRect(x, y - 15, ancho, 28);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(texto, x + 8, y + 6);
  ctx.restore();
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

  const qrData = archivoImagen.qrPreDetectado || leerCodigoQR(canvas);
  const esFotoCamara = archivoImagen.name?.startsWith('captura_omr_');

  const totalPreguntas = Number(configEvaluacion.numPreguntas || 30);
  const alternativasStr = configEvaluacion.alternativas || 'ABCD';
  const opciones = alternativasStr.split('');
  const pauta = configEvaluacion.pauta || {};

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

  let esquinasDetectadas = null;

  if (esFotoCamara && candidatos.length >= 4) {
    const mitadX = canvas.width * 0.5;
    const mitadY = canvas.height * 0.5;
    const qSupIzq = candidatos.filter((c) => c.x < mitadX && c.y < mitadY);
    const qSupDer = candidatos.filter((c) => c.x >= mitadX && c.y < mitadY);
    const qInfDer = candidatos.filter((c) => c.x >= mitadX && c.y >= mitadY);
    const qInfIzq = candidatos.filter((c) => c.x < mitadX && c.y >= mitadY);

    if (qSupIzq.length > 0 && qSupDer.length > 0 && qInfDer.length > 0 && qInfIzq.length > 0) {
      const supIzq = qSupIzq.reduce((best, c) => (c.x + c.y < best.x + best.y ? c : best));
      const supDer = qSupDer.reduce((best, c) => (c.y - c.x < best.y - best.x ? c : best));
      const infDer = qInfDer.reduce((best, c) => (c.x + c.y > best.x + best.y ? c : best));
      const infIzq = qInfIzq.reduce((best, c) => (c.y - c.x > best.y - best.x ? c : best));
      esquinasDetectadas = ordenarEsquinas([supIzq, supDer, infDer, infIzq]);
    }
  } else if (candidatos.length >= 4) {
    const objetivos = [
      { x: canvas.width * (16 / 215.9), y: canvas.height * (16 / 279.4) },
      { x: canvas.width * (199 / 215.9), y: canvas.height * (16 / 279.4) },
      { x: canvas.width * (199 / 215.9), y: canvas.height * (262 / 279.4) },
      { x: canvas.width * (16 / 215.9), y: canvas.height * (262 / 279.4) }
    ];

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

  const warpedGray = new cv.Mat();
  const warpedBin = new cv.Mat();
  cv.cvtColor(warped, warpedGray, cv.COLOR_RGBA2GRAY);
  cv.threshold(warpedGray, warpedBin, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

  const outCanvas = document.createElement('canvas');
  cv.imshow(outCanvas, warped);
  const outCtx = outCanvas.getContext('2d');

  const radioPx = 22;
  const radioNucleoPx = 15;
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

      let oscurosBin = 0;
      let totalBin = 0;
      let sumaGrisNucleo = 0;
      let totalNucleo = 0;

      for (let dy = -radioPx; dy <= radioPx; dy++) {
        for (let dx = -radioPx; dx <= radioPx; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 <= radioPx * radioPx) {
            if (py + dy >= 0 && py + dy < H && px + dx >= 0 && px + dx < W) {
              const valBin = warpedBin.ucharPtr(py + dy, px + dx)[0];
              if (valBin > 0) oscurosBin++;
              totalBin++;

              if (d2 <= radioNucleoPx * radioNucleoPx) {
                const valGris = warpedGray.ucharPtr(py + dy, px + dx)[0];
                sumaGrisNucleo += valGris;
                totalNucleo++;
              }
            }
          }
        }
      }

      const ratio = totalBin > 0 ? oscurosBin / totalBin : 0;
      const brilloNucleo = totalNucleo > 0 ? sumaGrisNucleo / totalNucleo : 255;

      return { letra, ratio, brilloNucleo, px, py };
    });

    const fondoFilaRatio = Math.min(...densidades.map((d) => d.ratio));
    const fondoFilaBrillo = Math.max(...densidades.map((d) => d.brilloNucleo));

    const marcadas = densidades.filter((d) => {
      const marcaFuerte = d.ratio > 0.26 && d.ratio - fondoFilaRatio > 0.09;
      const marcaTenueGrafito = d.brilloNucleo < 220 && fondoFilaBrillo - d.brilloNucleo > 18;
      return marcaFuerte || marcaTenueGrafito;
    });

    let respuestaFinal = '';
    if (marcadas.length === 1) {
      respuestaFinal = marcadas[0].letra;
    } else if (marcadas.length > 1) {
      respuestaFinal = 'DOBLE';
    }

    respuestas[p] = respuestaFinal;

    const itemPauta = pauta[p];
    const clavesValidas = obtenerClavesItem(itemPauta);
    const puntajeItem = obtenerPuntajeItem(itemPauta);
    const esAnulada = puntajeItem === 0;
    const esCorrecta = !esAnulada && clavesValidas.length > 0 && clavesValidas.includes(respuestaFinal);

    const ultimaBurbuja = densidades[densidades.length - 1];
    const posXIcono = ultimaBurbuja.px + 54;
    const posYIcono = ultimaBurbuja.py;

    densidades.forEach((d) => {
      if (marcadas.some((m) => m.letra === d.letra)) {
        outCtx.beginPath();
        outCtx.arc(d.px, d.py, 28, 0, 2 * Math.PI);
        outCtx.lineWidth = 6;
        outCtx.strokeStyle = esAnulada ? '#64748b' : esCorrecta ? '#16a34a' : '#dc2626';
        outCtx.stroke();
      } else if (!esAnulada && clavesValidas.includes(d.letra) && !esCorrecta) {
        outCtx.beginPath();
        outCtx.arc(d.px, d.py, 26, 0, 2 * Math.PI);
        outCtx.lineWidth = 4;
        outCtx.strokeStyle = '#2563eb';
        outCtx.stroke();
      }
    });

    if (esAnulada) {
      dibujarEtiquetaEstado(outCtx, posXIcono, posYIcono, 'ANULADA', '#64748b');
    } else if (respuestaFinal === '') {
      dibujarCruzRoja(outCtx, posXIcono, posYIcono);
      dibujarEtiquetaEstado(outCtx, posXIcono + 22, posYIcono, 'BLANCO', '#64748b');
    } else if (respuestaFinal === 'DOBLE') {
      dibujarCruzRoja(outCtx, posXIcono, posYIcono);
      dibujarEtiquetaEstado(outCtx, posXIcono + 22, posYIcono, 'DOBLE', '#d97706');
    } else if (esCorrecta) {
      dibujarTicketVerde(outCtx, posXIcono, posYIcono);
    } else if (clavesValidas.length > 0) {
      dibujarCruzRoja(outCtx, posXIcono, posYIcono);
    }
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
    imagenProcesada: outCanvas.toDataURL('image/jpeg', 0.85)
  };
}