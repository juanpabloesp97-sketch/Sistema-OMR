import React, { useState } from 'react';
import { CheckSquare, Wand2 } from 'lucide-react';
import { obtenerOAsPorNivel } from './oaMatematica';

export default function PautaEditor({ config, setConfig, nivelNombre = '' }) {
  const numPreguntas = Number(config.numPreguntas || 30);
  const opciones = (config.alternativas || 'ABCD').split('');
  const pauta = config.pauta || {};

  const listaOAsNivel = obtenerOAsPorNivel(nivelNombre);

  // Estado para asignación masiva rápida por rango de preguntas
  const [rangoInicio, setRangoInicio] = useState(1);
  const [rangoFin, setRangoFin] = useState(10);
  const [oaMasivo, setOaMasivo] = useState('');

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

        {/* Escala rápida */}
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

      {/* Grilla de 3 columnas con burbujas + menú desplegable compacto de OA */}
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

              {/* Botones circulares A B C D */}
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

              {/* Desplegable compacto de OA del nivel (o texto libre si no es 1°-8° básico) */}
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