import React, { useState } from 'react';
import { CheckSquare, Wand2, FileText, Upload, ExternalLink, Trash2 } from 'lucide-react';
import { obtenerOAsPorNivel } from './oaMatematica';
import { supabase } from './supabaseClient';

export default function PautaEditor({ config, setConfig, nivelNombre = '' }) {
  const numPreguntas = Number(config.numPreguntas || 30);
  const opciones = (config.alternativas || 'ABCD').split('');
  const pauta = config.pauta || {};

  const listaOAsNivel = obtenerOAsPorNivel(nivelNombre);

  const [rangoInicio, setRangoInicio] = useState(1);
  const [rangoFin, setRangoFin] = useState(10);
  const [oaMasivo, setOaMasivo] = useState('');
  const [subiendoPdf, setSubiendoPdf] = useState(false);

  const actualizarItem = (numP, campo, valor) => {
    const actual = pauta[numP];
    const objBase = typeof actual === 'object' && actual !== null
      ? { ...actual }
      : { correcta: actual || '', oa: '', habilidad: '', puntaje: 1 };

    if (campo === 'oa') {
      objBase.oa = valor;
      const oaEncontrado = listaOAsNivel.find((item) => item.codigo === valor);
      if (oaEncontrado) {
        objBase.habilidad = oaEncontrado.descripcion;
      }
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
    if (!oaMasivo.trim()) return;
    const inicio = Math.max(1, Math.min(numPreguntas, Number(rangoInicio)));
    const fin = Math.max(inicio, Math.min(numPreguntas, Number(rangoFin)));
    const oaEncontrado = listaOAsNivel.find((item) => item.codigo === oaMasivo.trim());

    const nuevaPauta = { ...pauta };
    for (let p = inicio; p <= fin; p++) {
      const actual = nuevaPauta[p];
      const objBase = typeof actual === 'object' && actual !== null
        ? { ...actual }
        : { correcta: actual || '', oa: '', habilidad: '', puntaje: 1 };

      objBase.oa = oaMasivo.trim();
      if (oaEncontrado) {
        objBase.habilidad = oaEncontrado.descripcion;
      }
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

      // Si la evaluación ya existe en la nube, guardar la URL de inmediato
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckSquare size={20} color="#16a34a" />
            Pauta de Respuestas Correctas y Objetivos (OA)
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            {nivelNombre
              ? `Nivel detectado: ${nivelNombre} (${listaOAsNivel.length} OAs curriculares disponibles)`
              : 'Selecciona un curso arriba para cargar automáticamente los OAs oficiales del nivel.'}
          </p>
        </div>

        {/* Fila de Escala + Subida Permanente de PDF de la Prueba en el espacio derecho */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', width: '100%' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '12.5px', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
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

          {/* Botón permanente para subir/ver PDF de la prueba */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {config.pdfPruebaUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '8px', padding: '7px 12px', fontSize: '12.5px' }}>
                <FileText size={16} color="#1d4ed8" />
                <span style={{ fontWeight: '700', color: '#1e3a8a', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={config.pdfPruebaNombre || 'Prueba PDF'}>
                  {config.pdfPruebaNombre || 'Prueba_Adjunta.pdf'}
                </span>
                <a
                  href={config.pdfPruebaUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#1d4ed8', display: 'inline-flex', alignItems: 'center' }}
                  title="Abrir PDF en pestaña nueva"
                >
                  <ExternalLink size={14} />
                </a>
                <label style={{ cursor: 'pointer', color: '#2563eb', fontWeight: '700', marginLeft: '4px' }} title="Reemplazar PDF">
                  Cambiar
                  <input type="file" accept="application/pdf" onChange={manejarSubidaPdfNube} disabled={subiendoPdf} style={{ display: 'none' }} />
                </label>
                <button
                  type="button"
                  onClick={quitarPdfPrueba}
                  style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0 2px', display: 'flex', alignItems: 'center' }}
                  title="Quitar PDF"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  background: subiendoPdf ? '#94a3b8' : '#0f172a',
                  color: '#ffffff',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: subiendoPdf ? 'wait' : 'pointer'
                }}
              >
                <Upload size={15} />
                {subiendoPdf ? 'Subiendo PDF...' : 'Subir Prueba en PDF'}
                <input type="file" accept="application/pdf" onChange={manejarSubidaPdfNube} disabled={subiendoPdf} style={{ display: 'none' }} />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Herramienta rápida para asignar un OA a un bloque de preguntas */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', fontSize: '13px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: '#1e40af' }}>
          <Wand2 size={16} /> Asignación rápida de OA:
        </span>
        <span>Desde P.</span>
        <input
          type="number"
          min="1"
          max={numPreguntas}
          value={rangoInicio}
          onChange={(e) => setRangoInicio(e.target.value)}
          style={{ width: '52px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #93c5fd' }}
        />
        <span>hasta P.</span>
        <input
          type="number"
          min="1"
          max={numPreguntas}
          value={rangoFin}
          onChange={(e) => setRangoFin(e.target.value)}
          style={{ width: '52px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #93c5fd' }}
        />

        {listaOAsNivel.length > 0 ? (
          <select
            value={oaMasivo}
            onChange={(e) => setOaMasivo(e.target.value)}
            style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #93c5fd', maxWidth: '320px', fontWeight: '600' }}
          >
            <option value="">-- Elegir OA de {nivelNombre} --</option>
            {listaOAsNivel.map((oa) => (
              <option key={oa.codigo} value={oa.codigo}>
                {oa.codigo} — {oa.descripcion.slice(0, 65)}...
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            placeholder="Ej: OA 1"
            value={oaMasivo}
            onChange={(e) => setOaMasivo(e.target.value)}
            style={{ width: '110px', padding: '5px 8px', borderRadius: '6px', border: '1px solid #93c5fd' }}
          />
        )}

        <button
          type="button"
          onClick={aplicarOAMasivo}
          style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontWeight: '700', cursor: 'pointer' }}
        >
          Aplicar
        </button>
      </div>

      {/* Grilla de burbujas + menú desplegable compacto de OA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '10px' }}>
        {Array.from({ length: numPreguntas }, (_, idx) => {
          const p = idx + 1;
          const item = pauta[p];
          const correcta = typeof item === 'object' ? item?.correcta : item;
          const oaActual = typeof item === 'object' ? (item?.oa || '') : '';
          const descActual = typeof item === 'object' ? (item?.habilidad || '') : '';

          return (
            <div
              key={p}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '10px',
                border: correcta ? '1px solid #86efac' : '1px solid #e2e8f0',
                background: correcta ? '#f0fdf4' : '#ffffff',
                gap: '8px'
              }}
            >
              <span style={{ fontWeight: '800', fontSize: '14px', minWidth: '28px', color: '#0f172a' }}>
                {p}.
              </span>

              <div style={{ display: 'flex', gap: '5px' }}>
                {opciones.map((letra) => {
                  const activa = correcta === letra;
                  return (
                    <button
                      key={letra}
                      type="button"
                      onClick={() => actualizarItem(p, 'correcta', activa ? '' : letra)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '999px',
                        border: activa ? '2px solid #16a34a' : '1px solid #cbd5e1',
                        background: activa ? '#16a34a' : '#ffffff',
                        color: activa ? '#ffffff' : '#334155',
                        fontWeight: '800',
                        fontSize: '12px',
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

              {listaOAsNivel.length > 0 ? (
                <select
                  value={oaActual}
                  onChange={(e) => actualizarItem(p, 'oa', e.target.value)}
                  title={descActual || 'Selecciona un OA del nivel'}
                  style={{
                    width: '86px',
                    padding: '5px 4px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
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
                  placeholder="OA 1"
                  value={oaActual}
                  onChange={(e) => actualizarItem(p, 'oa', e.target.value)}
                  style={{
                    width: '78px',
                    padding: '5px 6px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px'
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}