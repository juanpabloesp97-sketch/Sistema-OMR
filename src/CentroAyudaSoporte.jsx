import React, { useState, useRef, useEffect } from 'react';
import {
  HelpCircle, X, Send, Sparkles, MessageSquarePlus, CheckCircle2, Bot
} from 'lucide-react';
import { supabase } from './supabaseClient';

const PREGUNTAS_RAPIDAS = [
  '¿Cómo creo una evaluación y agrego preguntas?',
  '¿Cómo imprimo hojas con QR o en blanco?',
  '¿Cómo escaneo con cámara o subo un PDF?',
  '¿Cómo funciona la rúbrica IA en desarrollo?',
  '¿Cómo promuevo los cursos al siguiente año?'
];

export default function CentroAyudaSoporte({ profesor, colegioActual }) {
  const [abierto, setAbierto] = useState(false);
  const [pestana, setPestana] = useState('ia');

  const [mensajes, setMensajes] = useState([
    {
      role: 'assistant',
      content: `¡Hola ${profesor?.nombre?.split(' ')[0] || ''}! Soy el asistente de ayuda de Sistema OMR. ¿En qué te puedo ayudar hoy?`
    }
  ]);
  const [inputPregunta, setInputPregunta] = useState('');
  const [consultandoIa, setConsultandoIa] = useState(false);
  const chatEndRef = useRef(null);

  const [asuntoTicket, setAsuntoTicket] = useState('');
  const [mensajeTicket, setMensajeTicket] = useState('');
  const [enviandoTicket, setEnviandoTicket] = useState(false);
  const [ticketEnviadoOk, setTicketEnviadoOk] = useState(false);

  useEffect(() => {
    if (abierto && pestana === 'ia') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes, abierto, pestana]);

  const consultarAsistenteIA = async (textoPregunta) => {
    const q = String(textoPregunta || inputPregunta).trim();
    if (!q || consultandoIa) return;

    const nuevosMensajes = [...mensajes, { role: 'user', content: q }];
    setMensajes(nuevosMensajes);
    setInputPregunta('');
    setConsultandoIa(true);

    try {
      if (!supabase) throw new Error('Sin conexión a Supabase');

      const { data, error } = await supabase.functions.invoke('ayuda-ia', {
        body: {
          pregunta: q,
          historial: nuevosMensajes.slice(-6),
          rolUsuario: profesor?.rol || 'docente'
        }
      });

      if (error) throw error;

      const respuestaTexto =
        data?.respuesta ||
        'No pude obtener una respuesta en este momento. Puedes enviarnos una solicitud en la pestaña "Enviar Solicitud".';

      setMensajes((prev) => [...prev, { role: 'assistant', content: respuestaTexto }]);
    } catch {
      setMensajes((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Tuve un problema temporal de conexión. Puedes revisar los pasos en el menú lateral o enviarnos tu consulta en la pestaña "Enviar Solicitud".'
        }
      ]);
    } finally {
      setConsultandoIa(false);
    }
  };

  const enviarSolicitudSoporte = async (e) => {
    e.preventDefault();
    if (!asuntoTicket.trim() || !mensajeTicket.trim() || !supabase) return;

    setEnviandoTicket(true);
    try {
      const { error } = await supabase.from('soporte_tickets').insert([
        {
          colegio_id: profesor?.colegio_id || 'default',
          colegio_nombre: colegioActual?.nombre || profesor?.establecimiento || 'Establecimiento',
          usuario_id: profesor?.id || null,
          usuario_nombre: profesor?.nombre || 'Usuario',
          usuario_email: profesor?.email || '',
          asunto: asuntoTicket.trim(),
          mensaje: mensajeTicket.trim(),
          estado: 'pendiente'
        }
      ]);

      if (error) {
        alert('Error al enviar solicitud: ' + error.message);
        return;
      }

      setAsuntoTicket('');
      setMensajeTicket('');
      setTicketEnviadoOk(true);
      setTimeout(() => setTicketEnviadoOk(false), 5000);
    } finally {
      setEnviandoTicket(false);
    }
  };

  return (
    <>
      {/* Botón flotante esquina inferior derecha */}
      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        title="Centro de Ayuda IA y Soporte"
        style={{
          position: 'fixed',
          right: '22px',
          bottom: '22px',
          zIndex: 1050,
          background: '#1e3a8a',
          color: '#ffffff',
          border: 'none',
          borderRadius: '999px',
          padding: '12px 18px',
          fontSize: '13.5px',
          fontWeight: '800',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 10px 25px rgba(30, 58, 138, 0.35)'
        }}
      >
        <HelpCircle size={19} />
        <span>Ayuda / Soporte</span>
      </button>

      {/* Ventana flotante del Centro de Ayuda */}
      {abierto && (
        <div
          style={{
            position: 'fixed',
            right: '22px',
            bottom: '76px',
            width: '380px',
            maxWidth: 'calc(100vw - 32px)',
            height: '510px',
            maxHeight: 'calc(100vh - 100px)',
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 20px 45px rgba(15, 23, 42, 0.22)',
            zIndex: 1060,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Cabecera */}
          <div style={{ background: '#1e3a8a', color: '#ffffff', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={20} color="#93c5fd" />
              <div>
                <div style={{ fontWeight: '800', fontSize: '14.5px' }}>Centro de Ayuda y Soporte</div>
                <div style={{ fontSize: '11px', color: '#bfdbfe' }}>Asistente IA • Respuesta inmediata</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '7px', padding: '5px', color: '#ffffff', cursor: 'pointer', display: 'flex' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Selector de Pestañas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <button
              type="button"
              onClick={() => setPestana('ia')}
              style={{
                padding: '10px',
                border: 'none',
                borderBottom: pestana === 'ia' ? '2px solid #2563eb' : '2px solid transparent',
                background: pestana === 'ia' ? '#ffffff' : 'transparent',
                color: pestana === 'ia' ? '#1d4ed8' : '#64748b',
                fontWeight: '700',
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <Sparkles size={14} /> Preguntar a IA
            </button>

            <button
              type="button"
              onClick={() => setPestana('ticket')}
              style={{
                padding: '10px',
                border: 'none',
                borderBottom: pestana === 'ticket' ? '2px solid #2563eb' : '2px solid transparent',
                background: pestana === 'ticket' ? '#ffffff' : 'transparent',
                color: pestana === 'ticket' ? '#1d4ed8' : '#64748b',
                fontWeight: '700',
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <MessageSquarePlus size={14} /> Enviar Solicitud
            </button>
          </div>

          {/* CONTENIDO PESTAÑA 1: CHAT IA */}
          {pestana === 'ia' && (
            <>
              <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', background: '#f8fafc' }}>
                {mensajes.map((m, idx) => {
                  const esUsuario = m.role === 'user';
                  return (
                    <div
                      key={idx}
                      style={{
                        alignSelf: esUsuario ? 'flex-end' : 'flex-start',
                        maxWidth: '86%',
                        background: esUsuario ? '#2563eb' : '#ffffff',
                        color: esUsuario ? '#ffffff' : '#1e293b',
                        border: esUsuario ? 'none' : '1px solid #e2e8f0',
                        borderRadius: esUsuario ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        padding: '9px 12px',
                        fontSize: '13px',
                        lineHeight: 1.45,
                        whiteSpace: 'pre-line',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                      }}
                    >
                      {m.content}
                    </div>
                  );
                })}

                {consultandoIa && (
                  <div style={{ alignSelf: 'flex-start', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '8px 12px', fontSize: '12.5px', color: '#64748b' }}>
                    Escribiendo respuesta...
                  </div>
                )}

                {mensajes.length <= 2 && !consultandoIa && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '4px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>Preguntas frecuentes:</div>
                    {PREGUNTAS_RAPIDAS.map((pq) => (
                      <button
                        key={pq}
                        type="button"
                        onClick={() => consultarAsistenteIA(pq)}
                        style={{
                          textAlign: 'left',
                          background: '#eff6ff',
                          color: '#1e3a8a',
                          border: '1px solid #bfdbfe',
                          borderRadius: '8px',
                          padding: '6px 10px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        {pq}
                      </button>
                    ))}
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  consultarAsistenteIA(inputPregunta);
                }}
                style={{ padding: '10px', borderTop: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', gap: '6px' }}
              >
                <input
                  type="text"
                  placeholder="Escribe tu duda sobre la plataforma..."
                  value={inputPregunta}
                  onChange={(e) => setInputPregunta(e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
                <button
                  type="submit"
                  disabled={!inputPregunta.trim() || consultandoIa}
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    cursor: !inputPregunta.trim() || consultandoIa ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Send size={15} />
                </button>
              </form>
            </>
          )}

          {/* CONTENIDO PESTAÑA 2: BUZÓN DE SOLICITUDES */}
          {pestana === 'ticket' && (
            <form onSubmit={enviarSolicitudSoporte} style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
              <div style={{ fontSize: '12.5px', color: '#475569' }}>
                ¿Necesitas ampliar cupos, reportar un inconveniente o solicitar una mejora? Envíanos tu mensaje directo al equipo administrador:
              </div>

              {ticketEnviadoOk && (
                <div style={{ background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: '8px', padding: '10px 12px', fontSize: '12.5px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <CheckCircle2 size={16} />
                  ¡Solicitud enviada! Te responderemos a la brevedad.
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  Motivo / Asunto
                </label>
                <select
                  required
                  value={asuntoTicket}
                  onChange={(e) => setAsuntoTicket(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#ffffff' }}
                >
                  <option value="">-- Seleccionar motivo --</option>
                  <option value="Ampliación de cupos de usuarios">Ampliación de cupos de usuarios</option>
                  <option value="Problema al escanear / leer hoja">Problema al escanear / leer hoja</option>
                  <option value="Consulta sobre notas, pautas o OA">Consulta sobre notas, pautas o OA</option>
                  <option value="Sugerencia de nueva función">Sugerencia de nueva función</option>
                  <option value="Otro requerimiento">Otro requerimiento</option>
                </select>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  Detalle de tu solicitud
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Cuéntanos qué necesitas o qué ocurrió..."
                  value={mensajeTicket}
                  onChange={(e) => setMensajeTicket(e.target.value)}
                  style={{
                    width: '100%',
                    flex: 1,
                    padding: '9px 10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={enviandoTicket}
                style={{
                  background: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '9px',
                  padding: '10px 14px',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: enviandoTicket ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Send size={15} />
                {enviandoTicket ? 'Enviando solicitud...' : 'Enviar Solicitud al Equipo'}
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}