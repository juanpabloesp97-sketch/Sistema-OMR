import React, { useState } from 'react';
import {
  CheckSquare, Wand2, FileText, Upload, ExternalLink,
  Trash2, PlusCircle, Calculator, X, ListChecks, FileEdit
} from 'lucide-react';
import { obtenerOAsPorNivel } from './oaMatematica';
import { supabase } from './supabaseClient';

export default function PautaEditor({ config, setConfig, nivelNombre = '' }) {
  const numPreguntas = Number(config.numPreguntas || 0);
  const opciones = (config.alternativas || 'ABCD').split('');
  const pauta = config.pauta || {};

  const listaOAsNivel = obtenerOAsPorNivel(nivelNombre);

  // Modal de agregar preguntas
  const [modalAgregarAbierto, setModalAgregarAbierto] = useState(false);
  const [cantidadAgregar, setCantidadAgregar] = useState(10);
  const [tipoPreguntaAgregar, setTipoPreguntaAgregar] = useState('alternativa');

  // Asignación masiva de OA
  const [rangoInicio, setRangoInicio] = useState(1);
  const [rangoFin, setRangoFin] = useState(10);
  const [oaMasivo, setOaMasivo] = useState('');

  // Asignación masiva de Puntaje
  const [rangoPtsInicio, setRangoPtsInicio] = useState(1);
  const [rangoPtsFin, setRangoPtsFin] = useState(10);
  const [puntajeMasivo, setPuntajeMasivo] = useState(1);

  const [subiendoPdf, setSubiendoPdf] = useState(false);

  const obtenerClavesItem = (item) => {
    if (!item) return [];
    if (typeof item === 'string') return item ? [item] : [];
    if (Array.isArray(item.correcta)) return item.correcta;
    return item.correcta ? [item.correcta] : [];
  };

  const obtenerPuntajeItem = (item) => {
    if (typeof item === 'object' && item !== null && item.puntaje !== undefined) {
      return Number(item.puntaje);
    }
    return 1;
  };

  const puntajeIdealTotal = Array.from({ length: numPreguntas }, (_, idx) => {
    const item = pauta[idx + 1];
    return obtenerPuntajeItem(item);
  }).reduce((acc, val) => acc + val, 0);

  const preguntasAnuladasCount = Array.from({ length: numPreguntas }, (_, idx) => {
    return obtenerPuntajeItem(pauta[idx + 1]) === 0 ? 1 : 0;
  }).reduce((acc, val) => acc + val, 0);

  const confirmarAgregarPreguntas = () => {
    if (tipoPreguntaAgregar !== 'alternativa') return;
    const cant = Math.max(1, Math.min(50 - numPreguntas, Number(cantidadAgregar || 1)));
    if (cant <= 0) {
      alert('Ya alcanzaste el máximo de 50 preguntas por hoja OMR.');
      return;
    }

    const nuevaPauta = { ...pauta };
    for (let i = 1; i <= cant; i++) {
      const numP = numPreguntas + i;
      if (!nuevaPauta[numP]) {
        nuevaPauta[numP] = {
          tipo: 'alternativa',
          correcta: [],
          oa: '',
          habilidad: '',
          puntaje: 1
        };
      }
    }

    setConfig((prev) => ({
      ...prev,
      numPreguntas: numPreguntas + cant,
      pauta: nuevaPauta
    }));
    setModalAgregarAbierto(false);
  };

  // Elimina una pregunta específica y renumera correlativamente las siguientes (1..N)
  const eliminarPreguntaIndividual = (numAEliminar) => {
    const nuevaPauta = {};
    let nuevoIndice = 1;

    for (let p = 1; p <= numPreguntas; p++) {
      if (p === numAEliminar) continue;
      if (pauta[p] !== undefined) {
        nuevaPauta[nuevoIndice] = pauta[p];
      }
      nuevoIndice++;
    }

    setConfig((prev) => ({
      ...prev,
      numPreguntas: Math.max(0, numPreguntas - 1),
      pauta: nuevaPauta
    }));
  };

  const toggleAlternativaCorrecta = (numP, letra) => {
    const actual = pauta[numP];
    const clavesActuales = obtenerClavesItem(actual);
    const yaEsta = clavesActuales.includes(letra);
    const nuevasClaves = yaEsta
      ? clavesActuales.filter((l) => l !== letra)
      : [...clavesActuales, letra].sort();

    const objBase = typeof actual === 'object' && actual !== null
      ? { ...actual }
      : { tipo: 'alternativa', correcta: [], oa: '', habilidad: '', puntaje: 1 };

    objBase.correcta = nuevasClaves;

    setConfig((prev) => ({
      ...prev,
      pauta: {
        ...prev.pauta,
        [numP]: objBase
      }
    }));
  };

  const actualizarItem = (numP, campo, valor) => {
    const actual = pauta[numP];
    const objBase = typeof actual === 'object' && actual !== null
      ? { ...actual }
      : { tipo: 'alternativa', correcta: obtenerClavesItem(actual), oa: '', habilidad: '', puntaje: 1 };

    if (campo === 'oa') {
      objBase.oa = valor;
      const oaEncontrado = listaOAsNivel.find((item) => item.codigo === valor);
      if (oaEncontrado) {
        objBase.habilidad = oaEncontrado.descripcion;
      }
    } else if (campo === 'puntaje') {
      objBase.puntaje = Number(valor);
    } else {
      objBase[campo] = valor;
    }

    setConfig((prev) => ({
      ...prev,
      pauta: {
        ...prev.pauta,
        [numP]: objBase
      }
    }));
  };

  const aplicarOAMasivo = () => {
    if (!oaMasivo.trim() || numPreguntas === 0) return;
    const inicio = Math.max(1, Math.min(numPreguntas, Number(rangoInicio)));
    const fin = Math.max(inicio, Math.min(numPreguntas, Number(rangoFin)));
    const oaEncontrado = listaOAsNivel.find((item) => item.codigo === oaMasivo.trim());

    const nuevaPauta = { ...pauta };
    for (let p = inicio; p <= fin; p++) {
      const actual = nuevaPauta[p];
      const objBase = typeof actual === 'object' && actual !== null
        ? { ...actual }
        : { tipo: 'alternativa', correcta: obtenerClavesItem(actual), oa: '', habilidad: '', puntaje: 1 };

      objBase.oa = oaMasivo.trim();
      if (oaEncontrado) {
        objBase.habilidad = oaEncontrado.descripcion;
      }
      nuevaPauta[p] = objBase;
    }

    setConfig((prev) => ({ ...prev, pauta: nuevaPauta }));
  };

  const aplicarPuntajeMasivo = () => {
    if (numPreguntas === 0) return;
    const inicio = Math.max(1, Math.min(numPreguntas, Number(rangoPtsInicio)));
    const fin = Math.max(inicio, Math.min(numPreguntas, Number(rangoPtsFin)));

    const nuevaPauta = { ...pauta };
    for (let p = inicio; p <= fin; p++) {
      const actual = nuevaPauta[p];
      const objBase = typeof actual === 'object' && actual !== null
        ? { ...actual }
        : { tipo: 'alternativa', correcta: obtenerClavesItem(actual), oa: '', habilidad: '', puntaje: 1 };

      objBase.puntaje = Number(puntajeMasivo);
      nuevaPauta[p] = objBase;
    }

    setConfig((prev) => ({ ...prev, pauta: nuevaPauta }));
  };

  const manejarSubidaPdfNube = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;

    setSubiendoPdf(true);
    try {
      const nombreLimpio = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const rutaArchivo = `${config.docenteId || 'docente'}/${Date.now()}_${nombreLimpio}`;

      const { error: uploadError } = await supabase.storage
        .from('pruebas_pdf')
        .upload(rutaArchivo, file, { upsert: true });

      if (uploadError) {
        alert('Error al subir PDF: ' + uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('pruebas_pdf')
        .getPublicUrl(rutaArchivo);

      const urlPublica = publicUrlData.publicUrl;

      setConfig((prev) => ({
        ...prev,
        pdfPruebaUrl: urlPublica,
        pdfPruebaNombre: file.name
      }));

      if (config.id) {
        await supabase
          .from('evaluaciones')
          .update({
            pdf_prueba_url: urlPublica,
            pdf_prueba_nombre: file.name
          })
          .eq('id', config.id);
      }

      alert('✅ PDF de la prueba guardado permanentemente.');
    } catch (err) {
      alert('No se pudo subir el PDF: ' + err.message);
    } finally {
      setSubiendoPdf(false);
      e.target.value = '';
    }
  };

  const quitarPdfPrueba = async () => {
    setConfig((prev) => ({
      ...prev,
      pdfPruebaUrl: '',
      pdfPruebaNombre: ''
    }));
    if (config.id && supabase) {
      await supabase
        .from('evaluaciones')
        .update({ pdf_prueba_url: null, pdf_prueba_nombre: null })
        .eq('id', config.id);
    }
  };

  return (
    <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckSquare size={20} color="#16a34a" />
            Pauta, Puntajes y Objetivos (OA)
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Puedes marcar <strong>1 o más alternativas correctas</strong> por ítem y asignar <strong>0 pts</strong> para anular una pregunta.
          </p>
        </div>

        {/* Escala + Puntaje Ideal Total + PDF */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', width: '100%' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', fontSize: '12.5px', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#dbeafe', color: '#1e3a8a', padding: '4px 10px', borderRadius: '6px', fontWeight: '800' }}>
              <Calculator size={14} /> Puntaje Ideal: {puntajeIdealTotal} pts
              {preguntasAnuladasCount > 0 && ` (${preguntasAnuladasCount} anulada${preguntasAnuladasCount === 1 ? '' : 's'})`}
            </span>

            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <strong>Exigencia:</strong>
              <input
                type="number"
                min="1"
                max="100"
                value={config.exigencia ?? 60}
                onChange={(e) => setConfig({ ...config, exigencia: Number(e.target.value) })}
                style={{ width: '48px', padding: '3px 5px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
              />%
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <strong>Mín:</strong>
              <input
                type="number"
                step="0.1"
                value={config.notaMin ?? 1.0}
                onChange={(e) => setConfig({ ...config, notaMin: Number(e.target.value) })}
                style={{ width: '48px', padding: '3px 5px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <strong>Aprob:</strong>
              <input
                type="number"
                step="0.1"
                value={config.notaAprob ?? 4.0}
                onChange={(e) => setConfig({ ...config, notaAprob: Number(e.target.value) })}
                style={{ width: '48px', padding: '3px 5px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <strong>Máx:</strong>
              <input
                type="number"
                step="0.1"
                value={config.notaMax ?? 7.0}
                onChange={(e) => setConfig({ ...config, notaMax: Number(e.target.value) })}
                style={{ width: '48px', padding: '3px 5px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
              />
            </label>
          </div>

          {/* PDF de la prueba */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {config.pdfPruebaUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '8px', padding: '7px 12px', fontSize: '12.5px' }}>
                <FileText size={16} color="#1d4ed8" />
                <span style={{ fontWeight: '700', color: '#1e3a8a', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {config.pdfPruebaNombre || 'Prueba_Adjunta.pdf'}
                </span>
                <a href={config.pdfPruebaUrl} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', display: 'inline-flex', alignItems: 'center' }}>
                  <ExternalLink size={14} />
                </a>
                <label style={{ cursor: 'pointer', color: '#2563eb', fontWeight: '700', marginLeft: '4px' }}>
                  Cambiar
                  <input type="file" accept="application/pdf" onChange={manejarSubidaPdfNube} disabled={subiendoPdf} style={{ display: 'none' }} />
                </label>
                <button type="button" onClick={quitarPdfPrueba} style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0 2px', display: 'flex', alignItems: 'center' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <label
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '7px',
                  background: subiendoPdf ? '#e2e8f0' : '#eff6ff',
                  color: '#1e40af', border: '1px solid #93c5fd',
                  padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px',
                  fontWeight: '700', cursor: subiendoPdf ? 'wait' : 'pointer'
                }}
              >
                <Upload size={15} color="#1e40af" />
                <span>{subiendoPdf ? 'Subiendo PDF...' : 'Subir Prueba en PDF'}</span>
                <input type="file" accept="application/pdf" onChange={manejarSubidaPdfNube} disabled={subiendoPdf} style={{ display: 'none' }} />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Único botón superior para agregar preguntas */}
      <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => {
            setTipoPreguntaAgregar('alternativa');
            setCantidadAgregar(Math.min(10, Math.max(1, 50 - numPreguntas)));
            setModalAgregarAbierto(true);
          }}
          style={{
            background: '#16a34a',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '9px 16px',
            fontSize: '13.5px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 4px rgba(22,163,74,0.2)'
          }}
        >
          <PlusCircle size={17} /> Agregar Preguntas
        </button>

        <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>
          Total actual: {numPreguntas} pregunta{numPreguntas === 1 ? '' : 's'}
        </span>
      </div>

      {/* Herramientas rápidas por rango (OA + Puntaje) */}
      {numPreguntas > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '9px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '13px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: '#1e40af' }}>
              <Wand2 size={15} /> Asignar OA:
            </span>
            <span>Desde P.</span>
            <input type="number" min="1" max={numPreguntas} value={rangoInicio} onChange={(e) => setRangoInicio(e.target.value)} style={{ width: '50px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #93c5fd' }} />
            <span>hasta P.</span>
            <input type="number" min="1" max={numPreguntas} value={rangoFin} onChange={(e) => setRangoFin(e.target.value)} style={{ width: '50px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #93c5fd' }} />

            {listaOAsNivel.length > 0 ? (
              <select value={oaMasivo} onChange={(e) => setOaMasivo(e.target.value)} style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #93c5fd', maxWidth: '300px', fontWeight: '600' }}>
                <option value="">-- Elegir OA de {nivelNombre} --</option>
                {listaOAsNivel.map((oa) => (
                  <option key={oa.codigo} value={oa.codigo}>
                    {oa.codigo} — {oa.descripcion.slice(0, 60)}...
                  </option>
                ))}
              </select>
            ) : (
              <input type="text" placeholder="Ej: OA 1" value={oaMasivo} onChange={(e) => setOaMasivo(e.target.value)} style={{ width: '100px', padding: '5px 8px', borderRadius: '6px', border: '1px solid #93c5fd' }} />
            )}

            <button type="button" onClick={aplicarOAMasivo} style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontWeight: '700', cursor: 'pointer' }}>
              Aplicar OA
            </button>
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '9px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '13px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: '#334155' }}>
              <Calculator size={15} /> Asignar Puntaje:
            </span>
            <span>Desde P.</span>
            <input type="number" min="1" max={numPreguntas} value={rangoPtsInicio} onChange={(e) => setRangoPtsInicio(e.target.value)} style={{ width: '50px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <span>hasta P.</span>
            <input type="number" min="1" max={numPreguntas} value={rangoPtsFin} onChange={(e) => setRangoPtsFin(e.target.value)} style={{ width: '50px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <select value={puntajeMasivo} onChange={(e) => setPuntajeMasivo(Number(e.target.value))} style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '700' }}>
              <option value={0}>0 pts (Anular preguntas)</option>
              <option value={1}>1 punto (Predeterminado)</option>
              <option value={2}>2 puntos</option>
              <option value={3}>3 puntos</option>
              <option value={4}>4 puntos</option>
              <option value={5}>5 puntos</option>
            </select>
            <button type="button" onClick={aplicarPuntajeMasivo} style={{ background: '#334155', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontWeight: '700', cursor: 'pointer' }}>
              Aplicar Puntaje
            </button>
          </div>
        </div>
      )}

      {/* Grilla de preguntas con basurero individual al lado de cada pregunta */}
      {numPreguntas === 0 ? (
        <div style={{ padding: '28px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '14px' }}>
          Aún no has agregado preguntas. Haz clic en <strong>+ Agregar Preguntas</strong> arriba para comenzar.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(365px, 1fr))', gap: '10px' }}>
          {Array.from({ length: numPreguntas }, (_, idx) => {
            const p = idx + 1;
            const item = pauta[p];
            const clavesCorrectas = obtenerClavesItem(item);
            const oaActual = typeof item === 'object' ? (item?.oa || '') : '';
            const descActual = typeof item === 'object' ? (item?.habilidad || '') : '';
            const puntajeActual = obtenerPuntajeItem(item);
            const anulada = puntajeActual === 0;

            return (
              <div
                key={p}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: anulada ? '1px solid #fca5a5' : clavesCorrectas.length > 0 ? '1px solid #86efac' : '1px solid #e2e8f0',
                  background: anulada ? '#fef2f2' : clavesCorrectas.length > 0 ? '#f0fdf4' : '#ffffff',
                  opacity: anulada ? 0.78 : 1,
                  gap: '6px'
                }}
              >
                <span style={{ fontWeight: '800', fontSize: '13.5px', minWidth: '26px', color: anulada ? '#dc2626' : '#0f172a' }}>
                  {p}.
                </span>

                <div style={{ display: 'flex', gap: '4px' }}>
                  {opciones.map((letra) => {
                    const activa = clavesCorrectas.includes(letra);
                    return (
                      <button
                        key={letra}
                        type="button"
                        onClick={() => toggleAlternativaCorrecta(p, letra)}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '999px',
                          border: activa ? '2px solid #16a34a' : '1px solid #cbd5e1',
                          background: activa ? '#16a34a' : '#ffffff',
                          color: activa ? '#ffffff' : '#334155',
                          fontWeight: '800',
                          fontSize: '11.5px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {letra}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {listaOAsNivel.length > 0 ? (
                    <select
                      value={oaActual}
                      onChange={(e) => actualizarItem(p, 'oa', e.target.value)}
                      title={descActual || 'Selecciona un OA del nivel'}
                      style={{
                        width: '72px',
                        padding: '5px 3px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        color: oaActual ? '#1e3a8a' : '#64748b',
                        background: '#ffffff'
                      }}
                    >
                      <option value="">OA...</option>
                      {listaOAsNivel.map((oa) => (
                        <option key={oa.codigo} value={oa.codigo}>
                          {oa.codigo} — {oa.descripcion}
                        </option>
                      ))}
                      {oaActual && !listaOAsNivel.some((o) => o.codigo === oaActual) && (
                        <option value={oaActual}>{oaActual}</option>
                      )}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="OA"
                      value={oaActual}
                      onChange={(e) => actualizarItem(p, 'oa', e.target.value)}
                      style={{ width: '62px', padding: '5px 5px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11.5px' }}
                    />
                  )}

                  <select
                    value={puntajeActual}
                    onChange={(e) => actualizarItem(p, 'puntaje', Number(e.target.value))}
                    title="Puntaje de la pregunta (0 pts = Anulada)"
                    style={{
                      width: '64px',
                      padding: '5px 3px',
                      borderRadius: '6px',
                      border: anulada ? '1px solid #ef4444' : '1px solid #cbd5e1',
                      fontSize: '11.5px',
                      fontWeight: '800',
                      color: anulada ? '#dc2626' : '#0f172a',
                      background: anulada ? '#fee2e2' : '#ffffff'
                    }}
                  >
                    <option value={0}>0 pts (Anul.)</option>
                    <option value={1}>1 pt</option>
                    <option value={2}>2 pts</option>
                    <option value={3}>3 pts</option>
                    <option value={4}>4 pts</option>
                    <option value={5}>5 pts</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => eliminarPreguntaIndividual(p)}
                    title={`Eliminar pregunta ${p}`}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '6px'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.background = '#fee2e2'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VENTANA MODAL EN LA MISMA PÁGINA PARA AGREGAR PREGUNTAS */}
      {modalAgregarAbierto && (
        <div
          onClick={() => setModalAgregarAbierto(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '460px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  Agregar Preguntas
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                  Selecciona el tipo de pregunta y la cantidad
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAgregarAbierto(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}
              >
                <X size={18} color="#475569" />
              </button>
            </div>

            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Opción 1: Preguntas de Alternativa */}
              <div
                onClick={() => setTipoPreguntaAgregar('alternativa')}
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: tipoPreguntaAgregar === 'alternativa' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                  background: tipoPreguntaAgregar === 'alternativa' ? '#f0fdf4' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ListChecks size={20} color="#16a34a" />
                    </div>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '15px', color: '#0f172a' }}>
                        Preguntas de Alternativa
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Lectura automática mediante hoja OMR
                      </div>
                    </div>
                  </div>
                  <input
                    type="radio"
                    checked={tipoPreguntaAgregar === 'alternativa'}
                    onChange={() => setTipoPreguntaAgregar('alternativa')}
                    style={{ width: '17px', height: '17px', accentColor: '#16a34a' }}
                  />
                </div>

                {tipoPreguntaAgregar === 'alternativa' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px dashed #86efac' }}>
                    <label style={{ fontSize: '13px', fontWeight: '700', color: '#166534' }}>
                      Cantidad de preguntas:
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={Math.max(1, 50 - numPreguntas)}
                      value={cantidadAgregar}
                      onChange={(e) => setCantidadAgregar(e.target.value)}
                      style={{
                        width: '76px',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: '1px solid #16a34a',
                        fontSize: '15px',
                        fontWeight: '800',
                        textAlign: 'center',
                        color: '#0f172a'
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Opción 2: Preguntas de Desarrollo (Próximamente) */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1px dashed #cbd5e1',
                  background: '#f8fafc',
                  opacity: 0.72,
                  cursor: 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileEdit size={19} color="#64748b" />
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '14.5px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      Preguntas de Desarrollo
                      <span style={{ background: '#e2e8f0', color: '#475569', fontSize: '10.5px', fontWeight: '800', padding: '2px 7px', borderRadius: '999px' }}>
                        Próximamente
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      Evaluación por rúbrica o puntaje abierto
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '14px 22px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setModalAgregarAbierto(false)}
                style={{
                  background: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmarAgregarPreguntas}
                style={{
                  background: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 18px',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <PlusCircle size={16} /> Agregar {cantidadAgregar} Pregunta{Number(cantidadAgregar) === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}