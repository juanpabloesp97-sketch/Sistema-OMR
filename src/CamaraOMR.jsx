import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, Flashlight, RotateCcw, Check, Zap } from 'lucide-react';

let cvCache = null;

async function cargarCvCamara() {
  if (cvCache?.Mat) return cvCache;
  const mod = await import('@techstark/opencv-js');
  const cv = mod.default || mod;
  if (cv && cv.Mat) {
    cvCache = cv;
    return cv;
  }
  if (cv instanceof Promise) {
    cvCache = await cv;
    return cvCache;
  }
  await new Promise((resolve) => {
    const prev = cv.onRuntimeInitialized;
    cv.onRuntimeInitialized = () => {
      if (typeof prev === 'function') prev();
      resolve();
    };
  });
  cvCache = cv;
  return cv;
}

function detectarCuatroEsquinasEnCanvas(cv, canvas) {
  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const thresh = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  let detectadas = false;

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.adaptiveThreshold(
      blurred,
      thresh,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      25,
      10
    );
    cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const areaTotal = canvas.width * canvas.height;
    const candidatos = [];

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if (area > areaTotal * 0.00025 && area < areaTotal * 0.035) {
        const rect = cv.boundingRect(cnt);
        const aspecto = rect.width / Math.max(1, rect.height);
        const extension = area / Math.max(1, rect.width * rect.height);
        if (aspecto >= 0.65 && aspecto <= 1.4 && extension >= 0.68) {
          candidatos.push({
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2
          });
        }
      }
      cnt.delete();
    }

    if (candidatos.length >= 4) {
      const mx = canvas.width * 0.5;
      const my = canvas.height * 0.5;
      const q1 = candidatos.filter((p) => p.x < mx && p.y < my);
      const q2 = candidatos.filter((p) => p.x >= mx && p.y < my);
      const q3 = candidatos.filter((p) => p.x >= mx && p.y >= my);
      const q4 = candidatos.filter((p) => p.x < mx && p.y >= my);
      detectadas = Boolean(q1.length && q2.length && q3.length && q4.length);
    }
  } finally {
    src.delete();
    gray.delete();
    blurred.delete();
    thresh.delete();
    contours.delete();
    hierarchy.delete();
  }

  return detectadas;
}

export default function CamaraOMR({ tituloPrueba, onCapturarImagen, onCerrar }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const guideRef = useRef(null);
  const framesEstablesRef = useRef(0);
  const capturandoRef = useRef(false);

  const [errorCamara, setErrorCamara] = useState('');
  const [linternaActiva, setLinternaActiva] = useState(false);
  const [soportaLinterna, setSoportaLinterna] = useState(false);
  const [autoDisparo, setAutoDisparo] = useState(true);
  const [esquinasListas, setEsquinasListas] = useState(false);
  const [fotoPrevia, setFotoPrevia] = useState(null);
  const [archivoCapturado, setArchivoCapturado] = useState(null);

  useEffect(() => {
    let activo = true;
    let streamLocal = null;

    const arrancar = async () => {
      setErrorCamara('');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 1920 }
          },
          audio: false
        });
        if (!activo) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamLocal = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.torch) {
          setSoportaLinterna(true);
        }
      } catch {
        if (activo) {
          setErrorCamara('No se pudo acceder a la cámara. Revisa los permisos de cámara en tu celular.');
        }
      }
    };

    arrancar();
    return () => {
      activo = false;
      if (streamLocal) {
        streamLocal.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (fotoPrevia || errorCamara) {
      setEsquinasListas(false);
      framesEstablesRef.current = 0;
      return;
    }

    const timer = setInterval(async () => {
      if (capturandoRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;

      try {
        const cv = await cargarCvCamara();
        const tempCanvas = document.createElement('canvas');
        const escala = Math.min(1, 540 / Math.max(video.videoWidth, video.videoHeight));
        tempCanvas.width = Math.round(video.videoWidth * escala);
        tempCanvas.height = Math.round(video.videoHeight * escala);
        const tctx = tempCanvas.getContext('2d', { willReadFrequently: true });
        tctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

        const ok = detectarCuatroEsquinasEnCanvas(cv, tempCanvas);
        setEsquinasListas(ok);

        if (ok) {
          framesEstablesRef.current += 1;
          if (autoDisparo && framesEstablesRef.current >= 2) {
            framesEstablesRef.current = 0;
            tomarCaptura();
          }
        } else {
          framesEstablesRef.current = 0;
        }
      } catch {
        // Ignora errores transitorios en vivo
      }
    }, 350);

    return () => clearInterval(timer);
  }, [fotoPrevia, errorCamara, autoDisparo]);

  const detenerCamara = () => {
    const stream = videoRef.current?.srcObject;
    if (stream && typeof stream.getTracks === 'function') {
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const toggleLinterna = async () => {
    const stream = videoRef.current?.srcObject;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    try {
      const nuevoEstado = !linternaActiva;
      await track.applyConstraints({ advanced: [{ torch: nuevoEstado }] });
      setLinternaActiva(nuevoEstado);
    } catch (e) {
      console.warn('No se pudo activar la linterna:', e);
    }
  };

  const tomarCaptura = () => {
    if (capturandoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;

    capturandoRef.current = true;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const vRect = video.getBoundingClientRect();
    const gRect = guideRef.current?.getBoundingClientRect();

    let sx = 0;
    let sy = 0;
    let sw = vw;
    let sh = vh;

    if (vRect && gRect && vRect.width > 0 && vRect.height > 0 && gRect.width > 0 && gRect.height > 0) {
      const scaleCover = Math.max(vRect.width / vw, vRect.height / vh);
      const dispW = vw * scaleCover;
      const dispH = vh * scaleCover;
      const offsetX = (vRect.width - dispW) / 2;
      const offsetY = (vRect.height - dispH) / 2;

      const padX = gRect.width * 0.08;
      const padY = gRect.height * 0.06;

      const visLeft = gRect.left - vRect.left - offsetX - padX;
      const visTop = gRect.top - vRect.top - offsetY - padY;
      const visW = gRect.width + padX * 2;
      const visH = gRect.height + padY * 2;

      sx = Math.max(0, Math.min(vw - 1, Math.round(visLeft / scaleCover)));
      sy = Math.max(0, Math.min(vh - 1, Math.round(visTop / scaleCover)));
      sw = Math.max(100, Math.min(vw - sx, Math.round(visW / scaleCover)));
      sh = Math.max(100, Math.min(vh - sy, Math.round(visH / scaleCover)));
    }

    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

    canvas.toBlob(
      (blob) => {
        capturandoRef.current = false;
        if (!blob) return;
        const file = new File([blob], `captura_omr_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setArchivoCapturado(file);
        setFotoPrevia(URL.createObjectURL(blob));
      },
      'image/jpeg',
      0.9
    );
  };

  const confirmarYProcesar = () => {
    if (!archivoCapturado) return;
    detenerCamara();
    onCapturarImagen(archivoCapturado);
  };

  const repetirFoto = () => {
    capturandoRef.current = false;
    framesEstablesRef.current = 0;
    setFotoPrevia(null);
    setArchivoCapturado(null);
  };

  const colorMarco = esquinasListas ? '#22c55e' : '#f59e0b';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#000000',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <div
        style={{
          background: esquinasListas ? '#14532d' : '#0f172a',
          color: '#ffffff',
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          zIndex: 10
        }}
      >
        <button
          type="button"
          onClick={() => {
            detenerCamara();
            onCerrar();
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#ffffff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: '700',
            fontSize: '14px',
            padding: '4px'
          }}
        >
          <X size={20} /> Salir
        </button>

        <div style={{ fontWeight: '800', fontSize: '12px', letterSpacing: '0.5px', textTransform: 'uppercase', textAlign: 'center' }}>
          {esquinasListas ? '4 ESQUINAS LISTAS' : 'BUSCANDO ESQUINAS'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setAutoDisparo((prev) => !prev)}
            style={{
              background: autoDisparo ? '#16a34a' : 'rgba(255,255,255,0.15)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '11.5px',
              fontWeight: '700'
            }}
          >
            <Zap size={14} /> {autoDisparo ? 'Auto' : 'Manual'}
          </button>

          {soportaLinterna && (
            <button
              type="button"
              onClick={toggleLinterna}
              style={{
                background: linternaActiva ? '#facc15' : 'rgba(255,255,255,0.15)',
                color: linternaActiva ? '#0f172a' : '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Linterna"
            >
              <Flashlight size={17} />
            </button>
          )}
        </div>
      </div>

      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {errorCamara ? (
          <div style={{ color: '#ffffff', padding: '20px', textAlign: 'center', maxWidth: '320px' }}>
            <p style={{ fontSize: '14px', lineHeight: 1.5 }}>{errorCamara}</p>
            <button
              type="button"
              onClick={onCerrar}
              style={{ marginTop: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontWeight: '700' }}
            >
              Volver
            </button>
          </div>
        ) : fotoPrevia ? (
          <img
            src={fotoPrevia}
            alt="Vista previa"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />

            <div
              ref={guideRef}
              style={{
                position: 'absolute',
                width: 'min(80vw, 390px)',
                maxHeight: '64vh',
                aspectRatio: '183 / 246',
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    background: esquinasListas ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255, 255, 255, 0.18)',
                    border: `3px solid ${colorMarco}`,
                    borderRadius: '6px'
                  }}
                />
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    background: esquinasListas ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255, 255, 255, 0.18)',
                    border: `3px solid ${colorMarco}`,
                    borderRadius: '6px'
                  }}
                />
              </div>

              <div
                style={{
                  alignSelf: 'center',
                  maxWidth: '92%',
                  background: esquinasListas ? 'rgba(20, 83, 45, 0.9)' : 'rgba(15, 23, 42, 0.82)',
                  color: '#ffffff',
                  padding: '7px 12px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  fontSize: '12.5px',
                  fontWeight: '700'
                }}
              >
                {esquinasListas
                  ? (autoDisparo ? '¡Listo! Capturando...' : 'Cuadros listos — toca capturar')
                  : 'Encaja los 4 cuadros negros en los visores'}
                <div style={{ fontSize: '11px', fontWeight: '500', color: '#cbd5e1', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {tituloPrueba || 'Hoja OMR'}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    background: esquinasListas ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255, 255, 255, 0.18)',
                    border: `3px solid ${colorMarco}`,
                    borderRadius: '6px'
                  }}
                />
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    background: esquinasListas ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255, 255, 255, 0.18)',
                    border: `3px solid ${colorMarco}`,
                    borderRadius: '6px'
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div
        style={{
          background: '#0f172a',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          flexWrap: 'wrap'
        }}
      >
        {!fotoPrevia ? (
          <button
            type="button"
            onClick={tomarCaptura}
            disabled={Boolean(errorCamara)}
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '999px',
              background: '#ffffff',
              border: `5px solid ${colorMarco}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Capturar Hoja"
          >
            <Camera size={26} color="#0f172a" />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={repetirFoto}
              style={{
                background: '#334155',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '11px 16px',
                fontWeight: '700',
                fontSize: '13.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RotateCcw size={17} /> Repetir
            </button>

            <button
              type="button"
              onClick={confirmarYProcesar}
              style={{
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '11px 20px',
                fontWeight: '700',
                fontSize: '14.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Check size={19} /> Corregir Hoja
            </button>
          </>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}