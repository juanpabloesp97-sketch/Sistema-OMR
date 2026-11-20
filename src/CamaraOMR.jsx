import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, Flashlight, RotateCcw, Check } from 'lucide-react';

export default function CamaraOMR({ tituloPrueba, onCapturarImagen, onCerrar }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [errorCamara, setErrorCamara] = useState('');
  const [linternaActiva, setLinternaActiva] = useState(false);
  const [soportaLinterna, setSoportaLinterna] = useState(false);
  const [fotoPrevia, setFotoPrevia] = useState(null);
  const [archivoCapturado, setArchivoCapturado] = useState(null);

  useEffect(() => {
    iniciarCamara();
    return () => detenerCamara();
  }, []);

  const iniciarCamara = async () => {
    setErrorCamara('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 2560 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Verificar si el celular permite activar flash/linterna continua
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if (capabilities.torch) {
        setSoportaLinterna(true);
      }
    } catch (err) {
      setErrorCamara('No se pudo acceder a la cámara. Asegúrate de dar permisos de cámara en el navegador.');
    }
  };

  const detenerCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const toggleLinterna = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      const nuevoEstado = !linternaActiva;
      await track.applyConstraints({ advanced: [{ torch: nuevoEstado }] });
      setLinternaActiva(nuevoEstado);
    } catch (e) {
      console.warn('No se pudo activar la linterna:', e);
    }
  };

  const tomarCaptura = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `captura_omr_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setArchivoCapturado(file);
        setFotoPrevia(URL.createObjectURL(blob));
      },
      'image/jpeg',
      0.92
    );
  };

  const confirmarYProcesar = () => {
    if (!archivoCapturado) return;
    detenerCamara();
    onCapturarImagen(archivoCapturado);
  };

  const repetirFoto = () => {
    setFotoPrevia(null);
    setArchivoCapturado(null);
  };

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
      {/* Barra superior estilo ZipGrade */}
      <div
        style={{
          background: '#14532d',
          color: '#ffffff',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10
        }}
      >
        <button
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
            gap: '6px',
            fontWeight: '700',
            fontSize: '15px'
          }}
        >
          <X size={24} /> Salir
        </button>

        <div style={{ fontWeight: '800', fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase' }}>
          ESCANEANDO OMR
        </div>

        {soportaLinterna ? (
          <button
            onClick={toggleLinterna}
            style={{
              background: linternaActiva ? '#facc15' : 'rgba(255,255,255,0.15)',
              color: linternaActiva ? '#0f172a' : '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Linterna"
          >
            <Flashlight size={20} />
          </button>
        ) : (
          <div style={{ width: '36px' }} />
        )}
      </div>

      {/* Área de cámara con los 4 visores de esquina */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {errorCamara ? (
          <div style={{ color: '#ffffff', padding: '24px', textAlign: 'center', maxWidth: '340px' }}>
            <p style={{ fontSize: '15px', lineHeight: 1.5 }}>{errorCamara}</p>
            <button
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

            {/* Marco guía proporcional a la hoja Carta (183 x 246 mm) con 4 visores en las esquinas */}
            <div
              style={{
                position: 'absolute',
                width: '84%',
                maxWidth: '420px',
                aspectRatio: '183 / 246',
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              {/* Fila superior de visores */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div
                  style={{
                    width: '62px',
                    height: '62px',
                    background: 'rgba(255, 255, 255, 0.22)',
                    border: '3px solid #22c55e',
                    borderRadius: '6px',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.4)'
                  }}
                />
                <div
                  style={{
                    width: '62px',
                    height: '62px',
                    background: 'rgba(255, 255, 255, 0.22)',
                    border: '3px solid #22c55e',
                    borderRadius: '6px',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.4)'
                  }}
                />
              </div>

              {/* Etiqueta flotante inferior estilo ZipGrade */}
              <div
                style={{
                  alignSelf: 'center',
                  background: 'rgba(15, 23, 42, 0.78)',
                  color: '#ffffff',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  backdropFilter: 'blur(4px)'
                }}
              >
                Alinear cuadrados en visores
                <div style={{ fontSize: '11.5px', fontWeight: '500', color: '#cbd5e1', marginTop: '2px' }}>
                  {tituloPrueba || 'Hoja OMR'}
                </div>
              </div>

              {/* Fila inferior de visores */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div
                  style={{
                    width: '62px',
                    height: '62px',
                    background: 'rgba(255, 255, 255, 0.22)',
                    border: '3px solid #22c55e',
                    borderRadius: '6px',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.4)'
                  }}
                />
                <div
                  style={{
                    width: '62px',
                    height: '62px',
                    background: 'rgba(255, 255, 255, 0.22)',
                    border: '3px solid #22c55e',
                    borderRadius: '6px',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.4)'
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Botonera inferior */}
      <div
        style={{
          background: '#0f172a',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px'
        }}
      >
        {!fotoPrevia ? (
          <button
            onClick={tomarCaptura}
            disabled={Boolean(errorCamara)}
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '999px',
              background: '#ffffff',
              border: '5px solid #22c55e',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Capturar Hoja"
          >
            <Camera size={28} color="#0f172a" />
          </button>
        ) : (
          <>
            <button
              onClick={repetirFoto}
              style={{
                background: '#334155',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 18px',
                fontWeight: '700',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RotateCcw size={18} /> Repetir
            </button>

            <button
              onClick={confirmarYProcesar}
              style={{
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 22px',
                fontWeight: '700',
                fontSize: '15px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Check size={20} /> Corregir Hoja
            </button>
          </>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}