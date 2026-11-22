import React, { useState } from 'react';
import { CheckSquare, Wand2, FileText, Upload, ExternalLink, Trash2, PlusCircle, Calculator } from 'lucide-react';
import { obtenerOAsPorNivel } from './oaMatematica';
import { supabase } from './supabaseClient';

export default function PautaEditor({ config, setConfig, nivelNombre = '' }) {
  const numPreguntas = Number(config.numPreguntas || 0);
  const opciones = (config.alternativas || 'ABCD').split('');
  const pauta = config.pauta || {};

  const listaOAsNivel = obtenerOAsPorNivel(nivelNombre);

  // Constructor modular de preguntas
  const [cantidadAgregar, setCantidadAgregar] = useState(10);
  const [tipoPreguntaAgregar, setTipoPreguntaAgregar] = useState('seleccion_multiple');

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

  // Puntaje ideal dinámico sumando todas las preguntas activas (excluyendo las de 0 pts)
  const puntajeIdealTotal = Array.from({ length: numPreguntas }, (_, idx) => {
    const item = pauta[idx + 1];
    return obtenerPuntajeItem(item);
  }).reduce((acc, val) => acc + val, 0);

  const preguntasAnuladasCount = Array.from({ length: numPreguntas }, (_, idx) => {
    return obtenerPuntajeItem(pauta[idx + 1]) === 0 ? 1 : 0;
  }).reduce((acc, val) => acc + val, 0);

  const agregarBloquePreguntas = () => {
    if (tipoPreguntaAgregar !== 'seleccion_multiple') return;
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
          tipo: 'seleccion_multiple',
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
  };

  const eliminarUltimaPregunta = () => {
    if (numPreguntas <= 0) return;
    const nuevaPauta = { ...pauta };
    delete nuevaPauta[numPreguntas];
    setConfig((prev) => ({
      ...prev,
      numPreguntas: numPreguntas - 1,
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
      : { tipo: 'seleccion_multiple', correcta: [], oa: '', habilidad: '', puntaje: 1 };

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
      : { tipo: 'seleccion_multiple', correcta: obtenerClavesItem(actual), oa: '', habilidad: '', puntaje: 1 };

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
        : { tipo: 'seleccion_multiple', correcta: obtenerClavesItem(actual), oa: '', habilidad: '', puntaje: 1 };

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
        : { tipo: 'seleccion_multiple', correcta: obtenerClavesItem(actual), oa: '', habilidad: '', puntaje: 1 };

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

      {/* Constructor Modular de Preguntas */}
      <div style={{ background: '#f0fdf4', border: '1px solid #86efac', padding: '12px 14px', borderRadius: '10px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', fontSize: '13px' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <span style={{ fontWeight: '800', color: '#166534' }}>Estructura ({numPreguntas} ítems):</span>
          <input
            type="number"
            min="1"
            max="50"
            value={cantidadAgregar}
            onChange={(e) => setCantidadAgregar(e.target.value)}
            style={{ width: '58px', padding: '5px 7px', borderRadius: '6px', border: '1px solid #86efac', fontWeight: '700' }}
          />
          <select
            value={tipoPreguntaAgregar}
            onChange={(e) => setTipoPreguntaAgregar(e.target.value)}
            style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #86efac', fontWeight: '600', background: '#ffffff' }}
          >
            <option value="seleccion_multiple">Selección Múltiple (Hoja OMR)</option>
            <option value="desarrollo" disabled>Desarrollo / Rúbrica (Próximamente)</option>
          </select>
          <button
            type="button"
            onClick={agregarBloquePreguntas}
            style={{
              background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px',
              padding: '6px 12px', fontWeight: '700', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '5px'
            }}
          >
            <PlusCircle size={15} /> Agregar Preguntas
          </button>
        </div>

        {numPreguntas > 0 && (
          <button
            type="button"
            onClick={eliminarUltimaPregunta}
            style={{
              background: '#ffffff', color: '#dc2626', border: '1px solid #fecaca',
              borderRadius: '6px', padding: '5px 10px', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
            }}
          >
            Quitar última (P{numPreguntas})
          </button>
        )}
      </div>

      {/* Herramientas rápidas por rango (OA + Puntaje) */}
      {numPreguntas > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {/* Rango OA */}
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

          {/* Rango Puntaje */}
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

      {/* Grilla de preguntas */}
      {numPreguntas === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '14px' }}>
          Aún no has agregado preguntas. Elige la cantidad arriba y presiona <strong>+ Agregar Preguntas</strong>.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(335px, 1fr))', gap: '10px' }}>
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

                {/* Burbujas (permite marcar 1 o más claves) */}
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

                {/* Desplegable OA + Desplegable Puntaje */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {listaOAsNivel.length > 0 ? (
                    <select
                      value={oaActual}
                      onChange={(e) => actualizarItem(p, 'oa', e.target.value)}
                      title={descActual || 'Selecciona un OA del nivel'}
                      style={{
                        width: '74px',
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
                      style={{ width: '64px', padding: '5px 5px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11.5px' }}
                    />
                  )}

                  <select
                    value={puntajeActual}
                    onChange={(e) => actualizarItem(p, 'puntaje', Number(e.target.value))}
                    title="Puntaje de la pregunta (0 pts = Anulada)"
                    style={{
                      width: '66px',
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}