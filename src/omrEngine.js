import cvModule from '@techstark/opencv-js';
import jsQR from 'jsqr';

async function obtenerOpenCV() {
  if (cvModule && cvModule.Mat) return cvModule;
  if (cvModule instanceof Promise) return await cvModule;
  return new Promise((resolve) => {
    cvModule.onRuntimeInitialized = () => resolve(cvModule);
  });
}

function obtenerTipoItem(item) {
  if (typeof item === 'object' && item !== null && item.tipo) {
    return item.tipo;
  }
  return 'alternativa';
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

function construirMapaPaginasDesdeConfig(configEvaluacion) {
  const total = Number(configEvaluacion?.numPreguntas || 30);
  const pautaMap = configEvaluacion?.pauta || {};
  const alternativas = [];
  const completacion = [];
  const desarrollo = [];

  for (let p = 1; p <= total; p++) {
    const it = pautaMap[p] || { tipo: 'alternativa' };
    const tipo = obtenerTipoItem(it);
    if (tipo === 'completacion') completacion.push({ p, item: it });
    else if (tipo === 'desarrollo') desarrollo.push({ p, item: it });
    else alternativas.push({ p, item: it });
  }

  const tieneSoloAlt = completacion.length === 0 && desarrollo.length === 0;
  if (tieneSoloAlt) {
    return {
      usaPagina2: false,
      seccionesP1: { alternativas, completacion: [], desarrollo: [] },
      seccionesP2: { alternativas: [], completacion: [], desarrollo: [] }
    };
  }

  let yCursor = 54;
  if (alternativas.length > 0) {
    const filasAlt = Math.ceil(alternativas.length / 2);
    yCursor += 5 + filasAlt * 7.8 + 4;
  }

  const compP1 = [];
  const compP2 = [];
  if (completacion.length > 0) {
    yCursor += 6;
    const filasComp = Math.ceil(completacion.length / 2);
    const altoComp = filasComp * 13;
    if (yCursor + altoComp <= 253) {
      compP1.push(...completacion);
      yCursor += altoComp + 4;
    } else {
      compP2.push(...completacion);
    }
  }

  const desP1 = [];
  const desP2 = [];
  if (desarrollo.length > 0) {
    let ySim = yCursor + 6;
    desarrollo.forEach((d) => {
      const lineas = Math.max(3, Number(d.item?.lineas || 5));
      const altoCaja = 6 + lineas * 7.5;
      if (desP2.length === 0 && ySim + altoCaja <= 253) {
        desP1.push(d);
        ySim += altoCaja + 4;
      } else {
        desP2.push(d);
      }
    });
  }

  const usaPagina2 = compP2.length > 0 || desP2.length > 0;
  return {
    usaPagina2,
    seccionesP1: { alternativas, completacion: compP1, desarrollo: desP1 },
    seccionesP2: { alternativas: [], completacion: compP2, desarrollo: desP2 }
  };
}

function leerCodigoQR(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width, height } = canvas;

  const cropX = Math.floor(width * 0.50);
  const cropY = 0;
  const cropW = width - cropX;
  const cropH = Math.floor(height * 0.35);

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
        e: parsed.e || '',
        p: Number(parsed.p || 1),
        tp: Number(parsed.tp || 1)
      };
    } catch {
      return { r: code.data, n: 'Estudiante QR', c: '', p: 1, tp: 1 };
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

function completarCuatroEsquinas(cuadrantes) {
  const [tl, tr, br, bl] = cuadrantes;
  const presentes = [tl, tr, br, bl].filter(Boolean);
  if (presentes.length === 4) return [tl, tr, br, bl];
  if (presentes.length < 3) return null;

  if (!tl && tr && br && bl) {
    return [{ x: bl.x + (tr.x - br.x), y: bl.y + (tr.y - br.y) }, tr, br, bl];
  }
  if (!tr && tl && br && bl) {
    return [tl, { x: br.x + (tl.x - bl.x), y: br.y + (tl.y - bl.y) }, br, bl];
  }
  if (!br && tl && tr && bl) {
    return [tl, tr, { x: tr.x + (bl.x - tl.x), y: tr.y + (bl.y - tl.y) }, bl];
  }
  if (!bl && tl && tr && br) {
    return [tl, tr, br, { x: tl.x + (br.x - tr.x), y: tl.y + (br.y - tr.y) }];
  }
  return null;
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
  ctx.font = 'bold 19px sans-serif';
  const ancho = ctx.measureText(texto).width + 14;
  ctx.fillStyle = colorFondo;
  ctx.fillRect(x, y - 14, ancho, 26);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(texto, x + 7, y + 5);
  ctx.restore();
}

function obtenerNivelAlcanzadoEnRubrica(itemPauta, ptsObtenidos) {
  const rubrica = Array.isArray(itemPauta?.rubrica) ? itemPauta.rubrica : [];
  if (rubrica.length === 0) return '';
  let mejor = rubrica[0];
  let menorDiff = Math.abs(Number(rubrica[0].puntaje || 0) - Number(ptsObtenidos));
  for (const niv of rubrica) {
    const diff = Math.abs(Number(niv.puntaje || 0) - Number(ptsObtenidos));
    if (diff < menorDiff) {
      menorDiff = diff;
      mejor = niv;
    }
  }
  return mejor?.nivel || '';
}

function normalizarNumeroTexto(val) {
  return String(val ?? '').trim().replace(',', '.').toLowerCase();
}

function pintarAnotacionesSobreCanvas(outCtx, respuestas, configEvaluacion, paginaHoja = 1) {
  const alternativasStr = configEvaluacion?.alternativas || 'ABCD';
  const opciones = alternativasStr.split('');
  const pauta = configEvaluacion?.pauta || {};
  const respMap = respuestas || {};
  const iaMap = respMap._ia || {};

  const { seccionesP1, seccionesP2 } = construirMapaPaginasDesdeConfig(configEvaluacion);
  const sec = paginaHoja === 2 ? seccionesP2 : seccionesP1;
  const soloAlternativas = sec.completacion.length === 0 && sec.desarrollo.length === 0;
  let yCursor = 54;

  if (sec.alternativas.length > 0) {
    const inicioYAlt = soloAlternativas ? 56 : 62.2;
    const mitad = soloAlternativas ? 25 : Math.ceil(sec.alternativas.length / 2);

    sec.alternativas.forEach(({ p }, idxItem) => {
      const col = idxItem < mitad ? 0 : 1;
      const fila = idxItem < mitad ? idxItem : idxItem - mitad;
      const baseX = col === 0 ? 32 : 122;
      const baseY = inicioYAlt + fila * 7.8;

      const burbujas = opciones.map((letra, idx) => {
        const cx = baseX + idx * 11;
        const px = Math.round((cx - 16) * 10);
        const py = Math.round((baseY - 16) * 10);
        return { letra, px, py };
      });

      const respuestaFinal = respMap[p] || '';
      const itemPauta = pauta[p];
      const clavesValidas = obtenerClavesItem(itemPauta);
      const puntajeItem = obtenerPuntajeItem(itemPauta);
      const esAnulada = puntajeItem === 0;
      const esCorrecta =
        !esAnulada &&
        clavesValidas.length > 0 &&
        respuestaFinal !== '' &&
        respuestaFinal !== 'DOBLE' &&
        clavesValidas.includes(respuestaFinal);

      const ultimaBurbuja = burbujas[burbujas.length - 1];
      const posXIcono = ultimaBurbuja.px + 50;
      const posYIcono = ultimaBurbuja.py;

      burbujas.forEach((b) => {
        if (respuestaFinal === b.letra) {
          outCtx.beginPath();
          outCtx.arc(b.px, b.py, 28, 0, 2 * Math.PI);
          outCtx.lineWidth = 6;
          outCtx.strokeStyle = esAnulada ? '#64748b' : esCorrecta ? '#16a34a' : '#dc2626';
          outCtx.stroke();
        } else if (!esAnulada && clavesValidas.includes(b.letra) && !esCorrecta) {
          outCtx.beginPath();
          outCtx.arc(b.px, b.py, 26, 0, 2 * Math.PI);
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
    });

    const filasUsadas = Math.min(mitad, sec.alternativas.length);
    yCursor = inicioYAlt + filasUsadas * 7.8 + 3;
  }

  if (sec.completacion.length > 0) {
    yCursor += 6.8;
    const mitadComp = Math.ceil(sec.completacion.length / 2);

    sec.completacion.forEach(({ p, item }, idx) => {
      const col = idx < mitadComp ? 0 : 1;
      const fila = idx < mitadComp ? idx : idx - mitadComp;
      const xBox = col === 0 ? 34 : 122;
      const yRow = yCursor + fila * 13;

      const ptsMax = obtenerPuntajeItem(item);
      const infoIa = iaMap[p] || {};
      const ptsObtenidos = infoIa.puntajeFinal !== undefined && infoIa.puntajeFinal !== null
        ? Number(infoIa.puntajeFinal)
        : infoIa.puntajeSugerido !== undefined && infoIa.puntajeSugerido !== null
          ? Number(infoIa.puntajeSugerido)
          : 0;

      const pxDer = Math.round((xBox + 67 - 16) * 10);
      const pyCentro = Math.round((yRow + 5.2 - 16) * 10);

      if (ptsMax === 0) {
        dibujarEtiquetaEstado(outCtx, pxDer, pyCentro, 'ANULADA', '#64748b');
      } else if (ptsObtenidos >= ptsMax && ptsMax > 0) {
        dibujarTicketVerde(outCtx, pxDer + 14, pyCentro);
        dibujarEtiquetaEstado(outCtx, pxDer + 36, pyCentro, `OK (${ptsObtenidos}/${ptsMax} pt)`, '#16a34a');
      } else {
        const esp = normalizarNumeroTexto(item?.respuestaExacta || '');
        dibujarCruzRoja(outCtx, pxDer + 14, pyCentro);
        dibujarEtiquetaEstado(
          outCtx,
          pxDer + 36,
          pyCentro,
          esp ? `Esp: ${item.respuestaExacta} (${ptsObtenidos}/${ptsMax})` : `${ptsObtenidos}/${ptsMax} pt`,
          '#dc2626'
        );
      }
    });

    yCursor += mitadComp * 13 + 3;
  }

  if (sec.desarrollo.length > 0) {
    yCursor += 6.5;

    sec.desarrollo.forEach(({ p, item }) => {
      const numLineas = Math.max(3, Number(item?.lineas || 5));
      const interlineado = 7.5;
      const altoCaja = 5.5 + numLineas * interlineado;

      const ptsMax = obtenerPuntajeItem(item);
      const infoIa = iaMap[p] || {};
      const ptsObtenidos = infoIa.puntajeFinal !== undefined && infoIa.puntajeFinal !== null
        ? Number(infoIa.puntajeFinal)
        : infoIa.puntajeSugerido !== undefined && infoIa.puntajeSugerido !== null
          ? Number(infoIa.puntajeSugerido)
          : 0;

      const nivelNombre = obtenerNivelAlcanzadoEnRubrica(item, ptsObtenidos);
      const labelDes = nivelNombre
        ? `${ptsObtenidos}/${ptsMax} pts — ${nivelNombre}`
        : `${ptsObtenidos}/${ptsMax} pts`;

      const pxBadge = Math.round((191 - 16) * 10);
      const pyBadge = Math.round((yCursor + 2.5 - 16) * 10);

      outCtx.save();
      outCtx.font = 'bold 17px sans-serif';
      const ancho = outCtx.measureText(labelDes).width + 16;
      outCtx.fillStyle = ptsObtenidos >= ptsMax ? '#16a34a' : ptsObtenidos > 0 ? '#7c3aed' : '#dc2626';
      outCtx.fillRect(pxBadge - ancho, pyBadge - 12, ancho, 24);
      outCtx.fillStyle = '#ffffff';
      outCtx.fillText(labelDes, pxBadge - ancho + 8, pyBadge + 5);
      outCtx.restore();

      yCursor += altoCaja + 4;
    });
  }
}

export async function actualizarAnotacionesImagenOMR(imagenBase64, respuestasMap, configEvaluacion) {
  if (!imagenBase64) return null;

  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = imagenBase64;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const alternativasStr = configEvaluacion?.alternativas || 'ABCD';
  const opciones = alternativasStr.split('');
  const escalaX = canvas.width / 1830;
  const escalaY = canvas.height / 2460;

  const { seccionesP1 } = construirMapaPaginasDesdeConfig(configEvaluacion);
  const soloAlternativas = seccionesP1.completacion.length === 0 && seccionesP1.desarrollo.length === 0;
  const inicioYAlt = soloAlternativas ? 56 : 62.2;
  const mitad = soloAlternativas ? 25 : Math.ceil(seccionesP1.alternativas.length / 2);

  // Limpia toda la franja de cada fila (incluyendo etiquetas BLANCO / DOBLE / cruces anteriores)
  ctx.save();
  ctx.scale(escalaX, escalaY);
  seccionesP1.alternativas.forEach((_, idxItem) => {
    const col = idxItem < mitad ? 0 : 1;
    const fila = idxItem < mitad ? idxItem : idxItem - mitad;
    const baseX = col === 0 ? 32 : 122;
    const baseY = inicioYAlt + fila * 7.8;

    const primX = Math.round((baseX - 16) * 10);
    const ultX = Math.round((baseX + (opciones.length - 1) * 11 - 16) * 10);
    const py = Math.round((baseY - 16) * 10);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ultX + 20, py - 27, 275, 54);
  });

  pintarAnotacionesSobreCanvas(ctx, respuestasMap, configEvaluacion, 1);
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.72);
}

function recortarRegionWarped(canvasFuente, xMm, yMm, wMm, hMm) {
  const px = Math.max(0, Math.round((xMm - 16) * 10));
  const py = Math.max(0, Math.round((yMm - 16) * 10));
  const pw = Math.min(canvasFuente.width - px, Math.round(wMm * 10));
  const ph = Math.min(canvasFuente.height - py, Math.round(hMm * 10));
  if (pw <= 10 || ph <= 10) return null;

  const tmp = document.createElement('canvas');
  tmp.width = pw;
  tmp.height = ph;
  const tCtx = tmp.getContext('2d');
  tCtx.drawImage(canvasFuente, px, py, pw, ph, 0, 0, pw, ph);
  return tmp.toDataURL('image/jpeg', 0.85);
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
    reader.onerror = reject;
    reader.readAsDataURL(archivoImagen);
  });

  const maxDim = 2400;
  const escala = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * escala);
  canvas.height = Math.round(img.height * escala);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const qrData = archivoImagen.qrPreDetectado || leerCodigoQR(canvas);
  const paginaHoja = Number(qrData?.p || 1);

  const alternativasStr = configEvaluacion.alternativas || 'ABCD';
  const opciones = alternativasStr.split('');
  const { seccionesP1, seccionesP2 } = construirMapaPaginasDesdeConfig(configEvaluacion);
  const secActual = paginaHoja === 2 ? seccionesP2 : seccionesP1;

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
    if (area > areaTotal * 0.00015 && area < areaTotal * 0.015) {
      const rect = cv.boundingRect(cnt);
      const aspecto = rect.width / rect.height;
      const extension = area / (rect.width * rect.height);
      if (aspecto >= 0.65 && aspecto <= 1.45 && extension >= 0.65) {
        candidatos.push({
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          area
        });
      }
    }
    cnt.delete();
  }

  const corteX = canvas.width * 0.5;
  const corteY = canvas.height * 0.5;

  const elegirEnCuadrante = (lista, scoreFn) => {
    if (!lista.length) return null;
    return lista.reduce((mejor, actual) => (scoreFn(actual) < scoreFn(mejor) ? actual : mejor));
  };

  const qTL = candidatos.filter((c) => c.x < corteX && c.y < corteY);
  const qTR = candidatos.filter((c) => c.x >= corteX && c.y < corteY);
  const qBR = candidatos.filter((c) => c.x >= corteX && c.y >= corteY);
  const qBL = candidatos.filter((c) => c.x < corteX && c.y >= corteY);

  const tl = elegirEnCuadrante(qTL, (c) => Math.hypot(c.x, c.y));
  const tr = elegirEnCuadrante(qTR, (c) => Math.hypot(canvas.width - c.x, c.y));
  const br = elegirEnCuadrante(qBR, (c) => Math.hypot(canvas.width - c.x, canvas.height - c.y));
  const bl = elegirEnCuadrante(qBL, (c) => Math.hypot(c.x, canvas.height - c.y));

  let esquinasDetectadas = completarCuatroEsquinas([tl, tr, br, bl]);
  if (esquinasDetectadas) {
    esquinasDetectadas = ordenarEsquinas(esquinasDetectadas);
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
    const x0 = Math.max(0, Math.round(canvas.width * 0.055));
    const y0 = Math.max(0, Math.round(canvas.height * 0.043));
    const rw = Math.max(10, Math.min(canvas.width - x0, Math.round(canvas.width * 0.85)));
    const rh = Math.max(10, Math.min(canvas.height - y0, Math.round(canvas.height * 0.88)));
    const rect = new cv.Rect(x0, y0, rw, rh);
    const cropped = src.roi(rect);
    cv.resize(cropped, warped, new cv.Size(W, H));
    cropped.delete();
  }

  const warpedGray = new cv.Mat();
  const warpedBin = new cv.Mat();
  cv.cvtColor(warped, warpedGray, cv.COLOR_RGBA2GRAY);
  cv.threshold(warpedGray, warpedBin, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

  const cleanCanvas = document.createElement('canvas');
  cv.imshow(cleanCanvas, warped);

  const outCanvas = document.createElement('canvas');
  cv.imshow(outCanvas, warped);
  const outCtx = outCanvas.getContext('2d');

  const radioPx = 22;
  const radioNucleoPx = 12;
  const respuestas = {};

  const soloAlternativas = secActual.completacion.length === 0 && secActual.desarrollo.length === 0;
  let yCursor = 54;

  if (secActual.alternativas.length > 0) {
    const inicioYAlt = soloAlternativas ? 56 : 62.2;
    const mitad = soloAlternativas ? 25 : Math.ceil(secActual.alternativas.length / 2);

    secActual.alternativas.forEach(({ p }, idxItem) => {
      const col = idxItem < mitad ? 0 : 1;
      const fila = idxItem < mitad ? idxItem : idxItem - mitad;
      const baseX = col === 0 ? 32 : 122;
      const baseY = inicioYAlt + fila * 7.8;

      const densidades = opciones.map((letra, idx) => {
        const cx = baseX + idx * 11;
        const pxBase = Math.round((cx - 16) * 10);
        const pyBase = Math.round((baseY - 16) * 10);

        let mejorMuestra = { letra, ratio: 0, brilloNucleo: 255, px: pxBase, py: pyBase };
        const offsets = [
          [0, 0],
          [-4, 0],
          [4, 0],
          [0, -4],
          [0, 4]
        ];

        for (const [ox, oy] of offsets) {
          const px = pxBase + ox;
          const py = pyBase + oy;
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

          if (ratio > mejorMuestra.ratio || (ratio === mejorMuestra.ratio && brilloNucleo < mejorMuestra.brilloNucleo)) {
            mejorMuestra = { letra, ratio, brilloNucleo, px: pxBase, py: pyBase };
          }
        }

        return mejorMuestra;
      });

      const ordenadosBrillo = [...densidades].sort((a, b) => b.brilloNucleo - a.brilloNucleo);
      const fondoFilaBrillo = (ordenadosBrillo[0].brilloNucleo + ordenadosBrillo[1].brilloNucleo) / 2;

      const ordenadosOscuridad = [...densidades].sort((a, b) => a.brilloNucleo - b.brilloNucleo);
      const segundaMasOscuraBrillo = ordenadosOscuridad[1]?.brilloNucleo ?? 255;

      const candidatosMarcados = densidades.filter((d) => {
        const oscuridadRelativa = fondoFilaBrillo - d.brilloNucleo;
        const marcaNormal = d.brilloNucleo < 192 && oscuridadRelativa > 24;
        const marcaGrafitoClaro =
          d.brilloNucleo < 208 &&
          oscuridadRelativa > 22 &&
          segundaMasOscuraBrillo - d.brilloNucleo >= 15;
        return marcaNormal || marcaGrafitoClaro || d.ratio > 0.34;
      });

      let marcadas = [];
      if (candidatosMarcados.length === 1) {
        marcadas = candidatosMarcados;
      } else if (candidatosMarcados.length > 1) {
        const ordOsc = [...candidatosMarcados].sort((a, b) => a.brilloNucleo - b.brilloNucleo);
        const masOscura = ordOsc[0];
        const segundaOsc = ordOsc[1];
        const diferenciaBrillo = segundaOsc.brilloNucleo - masOscura.brilloNucleo;

        if (diferenciaBrillo > 32 && segundaOsc.brilloNucleo > 155) {
          marcadas = [masOscura];
        } else {
          marcadas = candidatosMarcados;
        }
      }

      let respuestaFinal = '';
      if (marcadas.length === 1) {
        respuestaFinal = marcadas[0].letra;
      } else if (marcadas.length > 1) {
        respuestaFinal = 'DOBLE';
      }

      respuestas[p] = respuestaFinal;
    });

    const filasUsadas = Math.min(mitad, secActual.alternativas.length);
    yCursor = (soloAlternativas ? 56 : 62.2) + filasUsadas * 7.8 + 3;
  }

  const recortesIA = {};

  if (secActual.completacion.length > 0) {
    yCursor += 6.8;
    const mitadComp = Math.ceil(secActual.completacion.length / 2);

    secActual.completacion.forEach(({ p }, idx) => {
      const col = idx < mitadComp ? 0 : 1;
      const fila = idx < mitadComp ? idx : idx - mitadComp;
      const xBox = col === 0 ? 34 : 122;
      const yRow = yCursor + fila * 13;

      const imgRecorte = recortarRegionWarped(cleanCanvas, xBox - 1, yRow - 1, 68, 12.5);
      if (imgRecorte) {
        recortesIA[p] = {
          tipo: 'completacion',
          imagen: imgRecorte
        };
      }
    });

    yCursor += mitadComp * 13 + 3;
  }

  if (secActual.desarrollo.length > 0) {
    yCursor += 6.5;

    secActual.desarrollo.forEach(({ p, item }) => {
      const numLineas = Math.max(3, Number(item?.lineas || 5));
      const interlineado = 7.5;
      const altoCaja = 5.5 + numLineas * interlineado;

      const imgRecorte = recortarRegionWarped(cleanCanvas, 22, yCursor - 1, 171, altoCaja + 2);
      if (imgRecorte) {
        recortesIA[p] = {
          tipo: 'desarrollo',
          imagen: imgRecorte
        };
      }

      yCursor += altoCaja + 4;
    });
  }

  pintarAnotacionesSobreCanvas(outCtx, respuestas, configEvaluacion, paginaHoja);

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
    paginaHoja,
    respuestas,
    recortesIA,
    imagenProcesada: outCanvas.toDataURL('image/jpeg', 0.65)
  };
}