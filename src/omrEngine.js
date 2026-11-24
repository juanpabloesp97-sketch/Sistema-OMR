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
  ctx.font = 'bold 20px sans-serif';
  const ancho = ctx.measureText(texto).width + 16;
  ctx.fillStyle = colorFondo;
  ctx.fillRect(x, y - 15, ancho, 28);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(texto, x + 8, y + 6);
  ctx.restore();
}

function pintarAnotacionesSobreCanvas(outCtx, respuestas, configEvaluacion) {
  const totalPreguntas = Number(configEvaluacion.numPreguntas || 30);
  const alternativasStr = configEvaluacion.alternativas || 'ABCD';
  const opciones = alternativasStr.split('');
  const pauta = configEvaluacion.pauta || {};
  const respMap = respuestas || {};

  for (let p = 1; p <= totalPreguntas; p++) {
    const col = p <= 25 ? 0 : 1;
    const fila = p <= 25 ? p - 1 : p - 26;
    const baseX = col === 0 ? 32 : 122;
    const baseY = 56 + fila * 7.8;

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
    const posXIcono = ultimaBurbuja.px + 54;
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

  const totalPreguntas = Number(configEvaluacion?.numPreguntas || 30);
  const alternativasStr = configEvaluacion?.alternativas || 'ABCD';
  const opciones = alternativasStr.split('');
  const escalaX = canvas.width / 1830;
  const escalaY = canvas.height / 2460;

  ctx.save();
  ctx.scale(escalaX, escalaY);
  for (let p = 1; p <= totalPreguntas; p++) {
    const col = p <= 25 ? 0 : 1;
    const fila = p <= 25 ? p - 1 : p - 26;
    const baseX = col === 0 ? 32 : 122;
    const baseY = 56 + fila * 7.8;

    const primX = Math.round((baseX - 16) * 10);
    const ultX = Math.round((baseX + (opciones.length - 1) * 11 - 16) * 10);
    const py = Math.round((baseY - 16) * 10);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(primX - 34, py - 34, (ultX - primX) + 250, 68);
  }
  ctx.restore();

  const canvasRestaurado = document.createElement('canvas');
  canvasRestaurado.width = img.width;
  canvasRestaurado.height = img.height;
  const ctxRest = canvasRestaurado.getContext('2d');
  ctxRest.drawImage(img, 0, 0);

  ctx.save();
  ctx.scale(escalaX, escalaY);
  for (let p = 1; p <= totalPreguntas; p++) {
    const col = p <= 25 ? 0 : 1;
    const fila = p <= 25 ? p - 1 : p - 26;
    const baseX = col === 0 ? 32 : 122;
    const baseY = 56 + fila * 7.8;
    const py = Math.round((baseY - 16) * 10);

    opciones.forEach((_, idx) => {
      const cx = baseX + idx * 11;
      const px = Math.round((cx - 16) * 10);
      const sx = Math.max(0, Math.round((px - 22) * escalaX));
      const sy = Math.max(0, Math.round((py - 22) * escalaY));
      const sw = Math.max(1, Math.round(44 * escalaX));
      const sh = Math.max(1, Math.round(44 * escalaY));
      ctx.drawImage(
        canvasRestaurado,
        sx,
        sy,
        sw,
        sh,
        px - 22,
        py - 22,
        44,
        44
      );
    });
  }

  pintarAnotacionesSobreCanvas(ctx, respuestasMap, configEvaluacion);
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.72);
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
  cv.GaussianBlur(warpedGray, warpedGray, new cv.Size(3, 3), 0);
  cv.adaptiveThreshold(warpedGray, warpedBin, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 31, 10);

  const outCanvas = document.createElement('canvas');
  cv.imshow(outCanvas, warped);
  const outCtx = outCanvas.getContext('2d');

  const radioPx = 22;
  const radioNucleoPx = 13;
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

    const ordenadosBrillo = [...densidades].sort((a, b) => b.brilloNucleo - a.brilloNucleo);
    const fondoFilaBrillo = (ordenadosBrillo[0].brilloNucleo + ordenadosBrillo[1].brilloNucleo) / 2;

    const candidatosMarcados = densidades.filter((d) => {
      const oscuridadRelativa = fondoFilaBrillo - d.brilloNucleo;
      return (d.brilloNucleo < 185 && oscuridadRelativa > 26) || d.ratio > 0.36;
    });

    let marcadas = [];
    if (candidatosMarcados.length === 1) {
      marcadas = candidatosMarcados;
    } else if (candidatosMarcados.length > 1) {
      const ordenadosOscuridad = [...candidatosMarcados].sort((a, b) => a.brilloNucleo - b.brilloNucleo);
      const masOscura = ordenadosOscuridad[0];
      const segundaMasOscura = ordenadosOscuridad[1];
      const diferenciaBrillo = segundaMasOscura.brilloNucleo - masOscura.brilloNucleo;

      if (diferenciaBrillo > 35 && segundaMasOscura.brilloNucleo > 155) {
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
  }

  pintarAnotacionesSobreCanvas(outCtx, respuestas, configEvaluacion);

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
    imagenProcesada: outCanvas.toDataURL('image/jpeg', 0.65)
  };
}