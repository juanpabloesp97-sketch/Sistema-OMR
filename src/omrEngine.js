import cvModule from '@techstark/opencv-js';
import jsQR from 'jsqr';

// Inicializador seguro de OpenCV en el navegador
async function obtenerOpenCV() {
  if (cvModule && cvModule.Mat) return cvModule;
  if (cvModule instanceof Promise) return await cvModule;
  return new Promise((resolve) => {
    cvModule.onRuntimeInitialized = () => resolve(cvModule);
  });
}

// Cálculo oficial de nota chilena (1.0 a 7.0 o 2.0 a 7.0 con exigencia variable)
export function calcularNotaChilena(puntaje, puntajeMax, exigenciaPct = 60, notaMin = 1.0, notaAprob = 4.0, notaMax = 7.0) {
  if (puntajeMax <= 0) return notaMin;
  const p = Math.max(0, Math.min(puntaje, puntajeMax));
  const pAprob = puntajeMax * (exigenciaPct / 100);

  let nota = notaMin;
  if (p < pAprob) {
    nota = notaMin + ((notaAprob - notaMin) * p) / pAprob;
  } else {
    const tramoSuperior = puntajeMax - pAprob;
    nota = tramoSuperior > 0
      ? notaAprob + ((notaMax - notaAprob) * (p - pAprob)) / tramoSuperior
      : notaMax;
  }
  return Math.round(nota * 10) / 10;
}

// Leer código QR desde un elemento Canvas
function leerCodigoQR(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const code = jsQR(imageData.data, width, height, { inversionAttempts: 'dontInvert' });

  if (code && code.data) {
    try {
      return JSON.parse(code.data);
    } catch {
      return { raw: code.data };
    }
  }
  return null;
}

// Ordenar 4 puntos: [Superior-Izq, Superior-Der, Inferior-Der, Inferior-Izq]
function ordenarEsquinas(puntos) {
  const sumas = puntos.map((p) => p.x + p.y);
  const restas = puntos.map((p) => p.y - p.x);

  const supIzq = puntos[sumas.indexOf(Math.min(...sumas))];
  const infDer = puntos[sumas.indexOf(Math.max(...sumas))];
  const supDer = puntos[restas.indexOf(Math.min(...restas))];
  const infIzq = puntos[restas.indexOf(Math.max(...restas))];

  return [supIzq, supDer, infDer, infIzq];
}

// Función principal: procesa la imagen de una hoja OMR
export async function procesarHojaOMR(archivoImagen, configEvaluacion) {
  const cv = await obtenerOpenCV();

  // Cargar imagen en memoria
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

  // Dibujar en canvas escalado (máx 1600px de alto para velocidad y precisión)
  const maxDim = 1600;
  const escala = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * escala);
  canvas.height = Math.round(img.height * escala);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // 1. Leer QR (si no se detecta, usamos los datos actuales de configuración)
  const datosQR = leerCodigoQR(canvas);
  const totalPreguntas = datosQR?.preguntas || configEvaluacion.numPreguntas || 30;
  const alternativasStr = datosQR?.alt || configEvaluacion.alternativas || 'ABCD';
  const opciones = alternativasStr.split('');

  // 2. Procesamiento OpenCV para encontrar los 4 cuadrados negros de referencia
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
    // Los cuadrados negros de 6x6mm ocupan aprox entre 0.03% y 1.5% de la hoja
    if (area > areaTotal * 0.00025 && area < areaTotal * 0.015) {
      const rect = cv.boundingRect(cnt);
      const aspecto = rect.width / rect.height;
      const extension = area / (rect.width * rect.height);
      // Un cuadrado sólido tiene relación de aspecto cercana a 1 y relleno > 0.72
      if (aspecto >= 0.72 && aspecto <= 1.35 && extension >= 0.72) {
        candidatos.push({
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          area,
        });
      }
    }
    cnt.delete();
  }

  // Buscar el candidato más cercano a cada una de las 4 esquinas ideales del área OMR
  // En el PDF: X va de 18 a 195 (sobre 215.9mm), Y va de 53 a 259 (sobre 279.4mm)
  const objetivos = [
    { x: canvas.width * (18 / 215.9), y: canvas.height * (53 / 279.4) },
    { x: canvas.width * (195 / 215.9), y: canvas.height * (53 / 279.4) },
    { x: canvas.width * (195 / 215.9), y: canvas.height * (259 / 279.4) },
    { x: canvas.width * (18 / 215.9), y: canvas.height * (259 / 279.4) },
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

    // Verificar que los 4 puntos sean distintos
    const unicos = new Set(elegidos.map((p) => `${Math.round(p.x)}_${Math.round(p.y)}`));
    if (unicos.size === 4) {
      esquinasDetectadas = ordenarEsquinas(elegidos);
    }
  }

  // 3. Enderezar perspectiva (Warp Perspective) a 1770 x 2060 px (10 px = 1 mm exacto)
  const W = 1770;
  const H = 2060;
  const warped = new cv.Mat();

  if (esquinasDetectadas) {
    const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
      esquinasDetectadas[0].x, esquinasDetectadas[0].y,
      esquinasDetectadas[1].x, esquinasDetectadas[1].y,
      esquinasDetectadas[2].x, esquinasDetectadas[2].y,
      esquinasDetectadas[3].x, esquinasDetectadas[3].y,
    ]);
    const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, W, 0, W, H, 0, H]);
    const M = cv.getPerspectiveTransform(srcPts, dstPts);
    cv.warpPerspective(src, warped, M, new cv.Size(W, H));
    srcPts.delete();
    dstPts.delete();
    M.delete();
  } else {
    // Respaldo si no se detectaron los 4 cuadros (recorte proporcional estándar)
    const x0 = Math.round(canvas.width * (18 / 215.9));
    const y0 = Math.round(canvas.height * (53 / 279.4));
    const rw = Math.round(canvas.width * (177 / 215.9));
    const rh = Math.round(canvas.height * (206 / 279.4));
    const rect = new cv.Rect(x0, y0, Math.min(rw, canvas.width - x0), Math.min(rh, canvas.height - y0));
    const cropped = src.roi(rect);
    cv.resize(cropped, warped, new cv.Size(W, H));
    cropped.delete();
  }

  // 4. Binarizar la zona enderezada para medir tinta dentro de cada círculo
  const warpedGray = new cv.Mat();
  const warpedBin = new cv.Mat();
  cv.cvtColor(warped, warpedGray, cv.COLOR_RGBA2GRAY);
  cv.threshold(warpedGray, warpedBin, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

  // Canvas de salida visual con marcas verdes/rojas para revisión del docente
  const outCanvas = document.createElement('canvas');
  cv.imshow(outCanvas, warped);
  const outCtx = outCanvas.getContext('2d');

  const inicioY = 64;
  const espacioVertical = 7.6;
  const radioPx = 23; // Radio interno de muestreo (2.3mm)
  const pauta = configEvaluacion.pauta || {};

  const detallePreguntas = [];
  let buenas = 0;

  for (let p = 1; p <= totalPreguntas; p++) {
    const esSegundaColumna = p > 25;
    const indiceFila = esSegundaColumna ? p - 26 : p - 1;
    const baseX = esSegundaColumna ? 112 : 28;
    const posY = inicioY + indiceFila * espacioVertical;

    const densidades = opciones.map((letra, idx) => {
      const centroX = baseX + 12 + idx * 11;
      const px = Math.round((centroX - 18) * 10);
      const py = Math.round((posY - 53) * 10);

      // Contar píxeles oscuros dentro del círculo
      let oscuros = 0;
      let total = 0;
      for (let dy = -radioPx; dy <= radioPx; dy++) {
        for (let dx = -radioPx; dx <= radioPx; dx++) {
          if (dx * dx + dy * dy <= radioPx * radioPx) {
            const val = warpedBin.ucharPtr(py + dy, px + dx)[0];
            if (val > 0) oscuros++;
            total++;
          }
        }
      }
      return { letra, ratio: oscuros / total, px, py };
    });

    // Ordenar de mayor a menor relleno
    const ordenadas = [...densidades].sort((a, b) => b.ratio - a.ratio);
    const mayor = ordenadas[0];
    const segunda = ordenadas[1] || { ratio: 0 };

    // Umbral: > 42% relleno y claramente más oscura que la segunda opción
    let respuestaAlumno = 'OMITIDA';
    if (mayor.ratio > 0.42) {
      if (segunda.ratio > 0.42 && mayor.ratio - segunda.ratio < 0.15) {
        respuestaAlumno = 'DOBLE';
      } else {
        respuestaAlumno = mayor.letra;
      }
    }

    const correcta = pauta[p]?.correcta || '';
    const oa = pauta[p]?.oa || 'Sin OA';
    const esCorrecta = correcta !== '' && respuestaAlumno === correcta;
    if (esCorrecta) buenas++;

    // Dibujar retroalimentación visual sobre la hoja
    densidades.forEach((d) => {
      if (d.letra === respuestaAlumno) {
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

    detallePreguntas.push({
      pregunta: p,
      marcada: respuestaAlumno,
      correcta,
      esCorrecta,
      oa,
    });
  }

  // Liberar memoria de OpenCV
  src.delete();
  gray.delete();
  blurred.delete();
  thresh.delete();
  contours.delete();
  hierarchy.delete();
  warped.delete();
  warpedGray.delete();
  warpedBin.delete();

  const nota = calcularNotaChilena(
    buenas,
    totalPreguntas,
    configEvaluacion.exigencia,
    configEvaluacion.notaMin,
    configEvaluacion.notaAprob,
    configEvaluacion.notaMax
  );

  return {
    rut: datosQR?.rut || 'No detectado',
    nombre: datosQR?.nombre || 'Estudiante (QR no leído)',
    curso: datosQR?.curso || 'Sin Curso',
    qrDetectado: Boolean(datosQR),
    esquinasOk: Boolean(esquinasDetectadas),
    buenas,
    totalPreguntas,
    porcentajeLogro: Math.round((buenas / totalPreguntas) * 100),
    nota,
    detallePreguntas,
    imagenProcesada: outCanvas.toDataURL('image/jpeg', 0.85),
  };
}